/**
 * ExecutionResultProcessor.ts - Result validation and processing
 * 
 * This component handles the processing, validation, transformation, and
 * aggregation of execution results from actions and steps.
 */

import { ulid } from 'ulid';
import { 
  ExecutionResultProcessor as IExecutionResultProcessor,
  StepExecutionResult,
  ActionExecutionResult,
  ExecutionContext,
  ResultProcessingOptions,
  ValidationRule,
  ValidationResult
} from '../interfaces/ExecutionInterfaces';
import { createLogger } from '@/lib/logging/winston-logger';

/**
 * Configuration for result processing
 */
export interface ResultProcessorConfig {
  /** Enable result validation by default */
  enableValidation: boolean;
  
  /** Enable result transformation by default */
  enableTransformation: boolean;
  
  /** Enable result storage by default */
  enableStorage: boolean;
  
  /** Enable processing logging */
  enableLogging: boolean;
  
  /** Maximum result size for processing (bytes) */
  maxResultSize: number;
  
  /** Default validation timeout (ms) */
  validationTimeoutMs: number;
  
  /** Enable result caching */
  enableCaching: boolean;
  
  /** Cache TTL (ms) */
  cacheTtlMs: number;
}

/**
 * Default configuration for result processing
 */
const DEFAULT_CONFIG: ResultProcessorConfig = {
  enableValidation: true,
  enableTransformation: true,
  enableStorage: true,
  enableLogging: true,
  maxResultSize: 10 * 1024 * 1024, // 10MB
  validationTimeoutMs: 5000, // 5 seconds
  enableCaching: false,
  cacheTtlMs: 300000 // 5 minutes
};

/**
 * Result processing error
 */
export class ResultProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly resultId: string,
    public readonly recoverable: boolean = true,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ResultProcessingError';
  }
}

/**
 * Result cache entry
 */
interface CacheEntry {
  result: ActionExecutionResult;
  timestamp: number;
  ttl: number;
}

/**
 * Implementation of ExecutionResultProcessor interface
 */
export class ExecutionResultProcessor implements IExecutionResultProcessor {
  private readonly logger = createLogger({ moduleId: 'result-processor' });
  private readonly config: ResultProcessorConfig;
  private readonly resultCache = new Map<string, CacheEntry>();
  private readonly validationRules = new Map<string, ValidationRule[]>();

  constructor(config: Partial<ResultProcessorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enableLogging) {
      this.logger.info('ExecutionResultProcessor initialized', { config: this.config });
    }

    // Setup cache cleanup if caching is enabled
    if (this.config.enableCaching) {
      this.setupCacheCleanup();
    }
  }

  /**
   * Process step execution results
   */
  async processStepResult(
    result: StepExecutionResult,
    context: ExecutionContext,
    options: ResultProcessingOptions = {}
  ): Promise<StepExecutionResult> {
    const processingId = ulid();
    const startTime = Date.now();

    try {
      if (this.config.enableLogging) {
        this.logger.info('Processing step result', {
          processingId,
          stepId: result.metadata.stepId,
          success: result.success,
          actionCount: result.actionResults.length
        });
      }

      let processedResult = { ...result };

      // Validate results if enabled
      if (options.validateResults ?? this.config.enableValidation) {
        await this.validateStepResult(processedResult, options);
      }

      // Transform results if enabled
      if (options.transformResults ?? this.config.enableTransformation) {
        processedResult = await this.transformStepResult(processedResult, options);
      }

      // Store results if enabled
      if (options.storeResults ?? this.config.enableStorage) {
        await this.storeStepResult(processedResult, context, options);
      }

      // Update metadata
      processedResult.metadata = {
        ...processedResult.metadata,
        processedAt: new Date().toISOString(),
        processingId,
        processingTime: Date.now() - startTime
      };

      if (this.config.enableLogging) {
        this.logger.info('Step result processing completed', {
          processingId,
          stepId: result.metadata.stepId,
          processingTime: Date.now() - startTime
        });
      }

      return processedResult;

    } catch (error) {
      if (this.config.enableLogging) {
        this.logger.error('Step result processing failed', {
          processingId,
          stepId: result.metadata.stepId,
          error: error instanceof Error ? error.message : String(error),
          processingTime: Date.now() - startTime
        });
      }

      throw new ResultProcessingError(
        `Step result processing failed: ${error instanceof Error ? error.message : String(error)}`,
        'STEP_PROCESSING_FAILED',
        result.metadata.stepId as string,
        true,
        { processingId }
      );
    }
  }

  /**
   * Process action execution results
   */
  async processActionResult(
    result: ActionExecutionResult,
    context: ExecutionContext,
    options: ResultProcessingOptions = {}
  ): Promise<ActionExecutionResult> {
    const processingId = ulid();
    const startTime = Date.now();

    try {
      if (this.config.enableLogging) {
        this.logger.info('Processing action result', {
          processingId,
          actionId: result.actionId,
          success: result.success,
          outputSize: this.getResultSize(result.output)
        });
      }

      // Check result size
      const resultSize = this.getResultSize(result.output);
      if (resultSize > this.config.maxResultSize) {
        throw new ResultProcessingError(
          `Result size exceeds maximum allowed size: ${resultSize} > ${this.config.maxResultSize}`,
          'RESULT_TOO_LARGE',
          result.actionId,
          false,
          { resultSize, maxSize: this.config.maxResultSize }
        );
      }

      let processedResult = { ...result };

      // Check cache first if enabled
      if (this.config.enableCaching) {
        const cached = this.getCachedResult(result.actionId);
        if (cached) {
          if (this.config.enableLogging) {
            this.logger.debug('Returning cached result', {
              processingId,
              actionId: result.actionId
            });
          }
          return cached;
        }
      }

      // Validate results if enabled
      if (options.validateResults ?? this.config.enableValidation) {
        const validationRules = options.validationRules || this.getValidationRules(result.actionId);
        if (validationRules.length > 0) {
          const validationResults = await this.validateResults([result], validationRules);
          if (validationResults.some(vr => !vr.isValid)) {
            throw new ResultProcessingError(
              'Result validation failed',
              'VALIDATION_FAILED',
              result.actionId,
              true,
              { validationResults }
            );
          }
        }
      }

      // Transform results if enabled
      if (options.transformResults ?? this.config.enableTransformation) {
        processedResult = await this.transformActionResult(processedResult, options);
      }

      // Store results if enabled
      if (options.storeResults ?? this.config.enableStorage) {
        await this.storeActionResult(processedResult, context, options);
      }

      // Cache result if enabled
      if (this.config.enableCaching) {
        this.cacheResult(processedResult);
      }

      // Update metadata
      processedResult.metadata = {
        ...processedResult.metadata,
        processedAt: new Date().toISOString(),
        processingId,
        processingTime: Date.now() - startTime
      };

      if (this.config.enableLogging) {
        this.logger.info('Action result processing completed', {
          processingId,
          actionId: result.actionId,
          processingTime: Date.now() - startTime
        });
      }

      return processedResult;

    } catch (error) {
      if (this.config.enableLogging) {
        this.logger.error('Action result processing failed', {
          processingId,
          actionId: result.actionId,
          error: error instanceof Error ? error.message : String(error),
          processingTime: Date.now() - startTime
        });
      }

      throw new ResultProcessingError(
        `Action result processing failed: ${error instanceof Error ? error.message : String(error)}`,
        'ACTION_PROCESSING_FAILED',
        result.actionId,
        true,
        { processingId }
      );
    }
  }

  /**
   * Aggregate results from multiple actions
   */
  async aggregateResults(
    results: ActionExecutionResult[],
    context: ExecutionContext
  ): Promise<StepExecutionResult> {
    const aggregationId = ulid();
    const startTime = Date.now();

    try {
      if (this.config.enableLogging) {
        this.logger.info('Aggregating action results', {
          aggregationId,
          resultCount: results.length,
          successfulResults: results.filter(r => r.success).length
        });
      }

      // Separate successful and failed results
      const successfulResults = results.filter(r => r.success);
      const failedResults = results.filter(r => !r.success);

      // Determine overall success
      const success = failedResults.length === 0;

      // Aggregate outputs
      const outputs = successfulResults
        .map(r => r.output)
        .filter(output => output !== undefined);

      // Aggregate metrics
      const aggregatedMetrics = this.aggregateMetrics(results);

      // Aggregate artifacts
      const aggregatedArtifacts = this.aggregateArtifacts(results);

      // Create step result
      const stepResult: StepExecutionResult = {
        success,
        output: outputs.length === 1 ? outputs[0] : outputs,
        metrics: aggregatedMetrics,
        actionResults: results,
        artifacts: aggregatedArtifacts,
        metadata: {
          aggregationId,
          aggregatedAt: new Date().toISOString(),
          aggregationTime: Date.now() - startTime,
          totalActions: results.length,
          successfulActions: successfulResults.length,
          failedActions: failedResults.length
        }
      };

      if (this.config.enableLogging) {
        this.logger.info('Result aggregation completed', {
          aggregationId,
          success,
          aggregationTime: Date.now() - startTime
        });
      }

      return stepResult;

    } catch (error) {
      if (this.config.enableLogging) {
        this.logger.error('Result aggregation failed', {
          aggregationId,
          error: error instanceof Error ? error.message : String(error),
          aggregationTime: Date.now() - startTime
        });
      }

      throw new ResultProcessingError(
        `Result aggregation failed: ${error instanceof Error ? error.message : String(error)}`,
        'AGGREGATION_FAILED',
        aggregationId,
        true
      );
    }
  }

  /**
   * Validate execution results
   */
  async validateResults(
    results: ActionExecutionResult[],
    rules: ValidationRule[]
  ): Promise<ValidationResult[]> {
    const validationId = ulid();
    const startTime = Date.now();

    try {
      if (this.config.enableLogging) {
        this.logger.info('Validating results', {
          validationId,
          resultCount: results.length,
          ruleCount: rules.length
        });
      }

      const validationResults: ValidationResult[] = [];

      for (const result of results) {
        const resultValidation = await this.validateSingleResult(result, rules);
        validationResults.push(resultValidation);
      }

      if (this.config.enableLogging) {
        this.logger.info('Result validation completed', {
          validationId,
          validationTime: Date.now() - startTime,
          validResults: validationResults.filter(vr => vr.isValid).length,
          invalidResults: validationResults.filter(vr => !vr.isValid).length
        });
      }

      return validationResults;

    } catch (error) {
      if (this.config.enableLogging) {
        this.logger.error('Result validation failed', {
          validationId,
          error: error instanceof Error ? error.message : String(error),
          validationTime: Date.now() - startTime
        });
      }

      throw new ResultProcessingError(
        `Result validation failed: ${error instanceof Error ? error.message : String(error)}`,
        'VALIDATION_FAILED',
        validationId,
        true
      );
    }
  }

  /**
   * Transform results for storage or further processing
   */
  async transformResults(
    results: ActionExecutionResult[],
    transformations: Record<string, unknown>
  ): Promise<ActionExecutionResult[]> {
    const transformationId = ulid();
    const startTime = Date.now();

    try {
      if (this.config.enableLogging) {
        this.logger.info('Transforming results', {
          transformationId,
          resultCount: results.length,
          transformations: Object.keys(transformations)
        });
      }

      const transformedResults: ActionExecutionResult[] = [];

      for (const result of results) {
        const transformedResult = await this.transformSingleResult(result, transformations);
        transformedResults.push(transformedResult);
      }

      if (this.config.enableLogging) {
        this.logger.info('Result transformation completed', {
          transformationId,
          transformationTime: Date.now() - startTime
        });
      }

      return transformedResults;

    } catch (error) {
      if (this.config.enableLogging) {
        this.logger.error('Result transformation failed', {
          transformationId,
          error: error instanceof Error ? error.message : String(error),
          transformationTime: Date.now() - startTime
        });
      }

      throw new ResultProcessingError(
        `Result transformation failed: ${error instanceof Error ? error.message : String(error)}`,
        'TRANSFORMATION_FAILED',
        transformationId,
        true
      );
    }
  }

  /**
   * Validate step result
   */
  private async validateStepResult(
    result: StepExecutionResult,
    options: ResultProcessingOptions
  ): Promise<void> {
    // Validate that step has required fields
    if (!result.metadata.stepId) {
      throw new ResultProcessingError(
        'Step result missing stepId',
        'INVALID_STEP_RESULT',
        'unknown',
        false
      );
    }

    // Validate action results
    if (options.validationRules) {
      await this.validateResults(result.actionResults, options.validationRules);
    }
  }

  /**
   * Transform step result
   */
  private async transformStepResult(
    result: StepExecutionResult,
    options: ResultProcessingOptions
  ): Promise<StepExecutionResult> {
    // Apply transformations if specified
    if (options.transformResults && result.output) {
      // Basic transformation - could be extended with more sophisticated logic
      const transformedOutput = this.applyBasicTransformations(result.output);
      return {
        ...result,
        output: transformedOutput
      };
    }

    return result;
  }

  /**
   * Store step result
   */
  private async storeStepResult(
    result: StepExecutionResult,
    context: ExecutionContext,
    options: ResultProcessingOptions
  ): Promise<void> {
    // Store in shared data for access by other steps
    const storageKey = `step_${result.metadata.stepId}_result`;
    context.sharedData[storageKey] = result;

    if (this.config.enableLogging) {
      this.logger.debug('Step result stored', {
        stepId: result.metadata.stepId,
        storageKey
      });
    }
  }

  /**
   * Transform action result
   */
  private async transformActionResult(
    result: ActionExecutionResult,
    options: ResultProcessingOptions
  ): Promise<ActionExecutionResult> {
    // Apply transformations if specified
    if (options.transformResults && result.output) {
      const transformedOutput = this.applyBasicTransformations(result.output);
      return {
        ...result,
        output: transformedOutput
      };
    }

    return result;
  }

  /**
   * Store action result
   */
  private async storeActionResult(
    result: ActionExecutionResult,
    context: ExecutionContext,
    options: ResultProcessingOptions
  ): Promise<void> {
    // Store in shared data for access by other actions
    const storageKey = `action_${result.actionId}_result`;
    context.sharedData[storageKey] = result;

    if (this.config.enableLogging) {
      this.logger.debug('Action result stored', {
        actionId: result.actionId,
        storageKey
      });
    }
  }

  /**
   * Validate single result
   */
  private async validateSingleResult(
    result: ActionExecutionResult,
    rules: ValidationRule[]
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 1.0;

    for (const rule of rules) {
      try {
        const ruleResult = await this.applyValidationRule(result, rule);
        if (!ruleResult.isValid) {
          errors.push(ruleResult.error || rule.errorMessage);
          score *= 0.5; // Reduce score for each failed rule
        }
      } catch (error) {
        warnings.push(`Validation rule '${rule.name}' failed to execute: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      isValid: errors.length === 0,
      score: Math.max(0, score),
      errors,
      warnings,
      validatedData: result.output
    };
  }

  /**
   * Apply validation rule
   */
  private async applyValidationRule(
    result: ActionExecutionResult,
    rule: ValidationRule
  ): Promise<{ isValid: boolean; error?: string }> {
    switch (rule.type) {
      case 'required':
        return {
          isValid: result.output !== null && result.output !== undefined,
          error: result.output === null || result.output === undefined ? 'Required field is missing' : undefined
        };

      case 'type':
        const expectedType = rule.parameters.type as string;
        const actualType = typeof result.output;
        return {
          isValid: actualType === expectedType,
          error: actualType !== expectedType ? `Expected type ${expectedType}, got ${actualType}` : undefined
        };

      case 'range':
        if (typeof result.output === 'number') {
          const min = rule.parameters.min as number;
          const max = rule.parameters.max as number;
          const isValid = result.output >= min && result.output <= max;
          return {
            isValid,
            error: !isValid ? `Value ${result.output} is outside range [${min}, ${max}]` : undefined
          };
        }
        return { isValid: false, error: 'Range validation requires numeric value' };

      case 'pattern':
        if (typeof result.output === 'string') {
          const pattern = new RegExp(rule.parameters.pattern as string);
          const isValid = pattern.test(result.output);
          return {
            isValid,
            error: !isValid ? `Value does not match pattern ${rule.parameters.pattern}` : undefined
          };
        }
        return { isValid: false, error: 'Pattern validation requires string value' };

      case 'custom':
        // Custom validation would be implemented here
        return { isValid: true };

      default:
        return { isValid: true };
    }
  }

  /**
   * Transform single result
   */
  private async transformSingleResult(
    result: ActionExecutionResult,
    transformations: Record<string, unknown>
  ): Promise<ActionExecutionResult> {
    let transformedOutput = result.output;

    // Apply basic transformations
    if (transformations.normalize && typeof transformedOutput === 'string') {
      transformedOutput = transformedOutput.trim().toLowerCase();
    }

    if (transformations.truncate && typeof transformedOutput === 'string') {
      const maxLength = transformations.maxLength as number || 1000;
      transformedOutput = transformedOutput.substring(0, maxLength);
    }

    return {
      ...result,
      output: transformedOutput,
      metadata: {
        ...result.metadata,
        transformed: true,
        transformations: Object.keys(transformations)
      }
    };
  }

  /**
   * Apply basic transformations
   */
  private applyBasicTransformations(output: unknown): unknown {
    if (typeof output === 'string') {
      // Basic string transformations
      return output.trim();
    }

    if (Array.isArray(output)) {
      // Basic array transformations
      return output.filter(item => item !== null && item !== undefined);
    }

    return output;
  }

  /**
   * Aggregate metrics from multiple results
   */
  private aggregateMetrics(results: ActionExecutionResult[]): any {
    const totalExecutionTime = results.reduce((sum, r) => sum + (r.metrics.executionTime || 0), 0);
    const totalQueueTime = results.reduce((sum, r) => sum + (r.metrics.queueTime || 0), 0);
    const totalApiCalls = results.reduce((sum, r) => sum + (r.metrics.apiCalls || 0), 0);
    const totalTokensUsed = results.reduce((sum, r) => sum + (r.metrics.tokensUsed || 0), 0);

    return {
      executionTime: totalExecutionTime,
      queueTime: totalQueueTime,
      apiCalls: totalApiCalls,
      tokensUsed: totalTokensUsed,
      averageExecutionTime: results.length > 0 ? totalExecutionTime / results.length : 0
    };
  }

  /**
   * Aggregate artifacts from multiple results
   */
  private aggregateArtifacts(results: ActionExecutionResult[]): Record<string, unknown> {
    const aggregatedArtifacts: Record<string, unknown> = {};

    for (const result of results) {
      if (result.artifacts) {
        Object.assign(aggregatedArtifacts, result.artifacts);
      }
    }

    return aggregatedArtifacts;
  }

  /**
   * Get result size in bytes
   */
  private getResultSize(output: unknown): number {
    try {
      return new Blob([JSON.stringify(output)]).size;
    } catch {
      return 0;
    }
  }

  /**
   * Get cached result
   */
  private getCachedResult(actionId: string): ActionExecutionResult | null {
    const entry = this.resultCache.get(actionId);
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return entry.result;
    }
    
    if (entry) {
      this.resultCache.delete(actionId);
    }
    
    return null;
  }

  /**
   * Cache result
   */
  private cacheResult(result: ActionExecutionResult): void {
    this.resultCache.set(result.actionId, {
      result,
      timestamp: Date.now(),
      ttl: this.config.cacheTtlMs
    });
  }

  /**
   * Get validation rules for action
   */
  private getValidationRules(actionId: string): ValidationRule[] {
    return this.validationRules.get(actionId) || [];
  }

  /**
   * Setup cache cleanup
   */
  private setupCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.resultCache.entries()) {
        if (now - entry.timestamp >= entry.ttl) {
          this.resultCache.delete(key);
        }
      }
    }, this.config.cacheTtlMs);
  }

  /**
   * Register validation rules for an action type
   */
  registerValidationRules(actionId: string, rules: ValidationRule[]): void {
    this.validationRules.set(actionId, rules);
    
    if (this.config.enableLogging) {
      this.logger.info('Validation rules registered', {
        actionId,
        ruleCount: rules.length
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ResultProcessorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  configure(newConfig: Partial<ResultProcessorConfig>): void {
    Object.assign(this.config, newConfig);
    
    if (this.config.enableLogging) {
      this.logger.info('ExecutionResultProcessor configuration updated', { config: this.config });
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    cacheSize: number;
    validationRulesCount: number;
    config: ResultProcessorConfig;
  } {
    return {
      healthy: true,
      cacheSize: this.resultCache.size,
      validationRulesCount: this.validationRules.size,
      config: this.config
    };
  }

  /**
   * Clear cache and cleanup
   */
  cleanup(): void {
    this.resultCache.clear();
    this.validationRules.clear();
    
    if (this.config.enableLogging) {
      this.logger.info('ExecutionResultProcessor cleanup completed');
    }
  }
} 