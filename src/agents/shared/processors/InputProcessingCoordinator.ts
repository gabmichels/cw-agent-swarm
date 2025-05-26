/**
 * InputProcessingCoordinator.ts - Coordinates input processing and validation
 * 
 * This component is responsible for:
 * - Input validation and preprocessing
 * - Input routing to appropriate processors
 * - Input transformation and normalization
 * - Error handling for malformed inputs
 */

import { AgentBase } from '../base/AgentBase.interface';
import { MessageProcessingOptions } from '../base/AgentBase.interface';
import { InputProcessor } from '../base/managers/InputProcessor.interface';
import { ManagerType } from '../base/managers/ManagerType';
import { createLogger } from '../../../lib/logging/winston-logger';

/**
 * Input processing result
 */
export interface InputProcessingResult {
  success: boolean;
  processedContent: string;
  originalContent: string;
  transformations: string[];
  validationResults: InputValidationResult[];
  metadata: Record<string, unknown>;
  warnings: string[];
  errors: string[];
}

/**
 * Input validation result
 */
export interface InputValidationResult {
  ruleName: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
  details?: Record<string, unknown>;
}

/**
 * Input transformation configuration
 */
export interface InputTransformation {
  name: string;
  enabled: boolean;
  priority: number;
  transform: (content: string, options: MessageProcessingOptions) => Promise<string>;
  validate?: (content: string) => boolean;
}

/**
 * Input validation rule
 */
export interface InputValidationRule {
  name: string;
  enabled: boolean;
  priority: number;
  validate: (content: string, options: MessageProcessingOptions) => Promise<InputValidationResult>;
  required: boolean;
}

/**
 * Input processing configuration
 */
export interface InputProcessingConfig {
  enableValidation: boolean;
  enableTransformation: boolean;
  enableNormalization: boolean;
  maxInputLength: number;
  allowEmptyInput: boolean;
  trimWhitespace: boolean;
  convertToLowercase: boolean;
  removeSpecialCharacters: boolean;
  enableContentFiltering: boolean;
  blockedPatterns: string[];
  allowedLanguages: string[];
}

/**
 * Error class for input processing errors
 */
export class InputProcessingError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'INPUT_PROCESSING_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'InputProcessingError';
    this.code = code;
    this.context = context;
  }
}

/**
 * InputProcessingCoordinator class - Coordinates input processing and validation
 */
export class InputProcessingCoordinator {
  private logger: ReturnType<typeof createLogger>;
  private agent: AgentBase;
  private config: InputProcessingConfig;
  private transformations: Map<string, InputTransformation> = new Map();
  private validationRules: Map<string, InputValidationRule> = new Map();
  private processingStats: {
    totalProcessed: number;
    successfulProcessed: number;
    failedProcessed: number;
    averageProcessingTime: number;
  };

  constructor(agent: AgentBase, config: Partial<InputProcessingConfig> = {}) {
    this.agent = agent;
    this.logger = createLogger({
      moduleId: 'input-processing-coordinator',
    });
    
    // Set default configuration
    this.config = {
      enableValidation: true,
      enableTransformation: true,
      enableNormalization: true,
      maxInputLength: 10000,
      allowEmptyInput: false,
      trimWhitespace: true,
      convertToLowercase: false,
      removeSpecialCharacters: false,
      enableContentFiltering: true,
      blockedPatterns: [
        '(password|secret|token|key)\\s*[:=]\\s*[\\w\\-]+',
        '(api[_\\s]?key|access[_\\s]?token)\\s*[:=]\\s*[\\w\\-]+',
        '(credit[_\\s]?card|ssn|social[_\\s]?security)'
      ],
      allowedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
      ...config
    };

    // Initialize processing stats
    this.processingStats = {
      totalProcessed: 0,
      successfulProcessed: 0,
      failedProcessed: 0,
      averageProcessingTime: 0
    };

    // Initialize default transformations and validation rules
    this.initializeDefaultTransformations();
    this.initializeDefaultValidationRules();
  }

  /**
   * Process input content with validation and transformation
   */
  async processInput(
    content: string,
    options: MessageProcessingOptions = {}
  ): Promise<InputProcessingResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting input processing');
      
      const result: InputProcessingResult = {
        success: false,
        processedContent: content,
        originalContent: content,
        transformations: [],
        validationResults: [],
        metadata: {
          startTime: new Date().toISOString(),
          options: options
        },
        warnings: [],
        errors: []
      };

      // Step 1: Initial validation
      if (this.config.enableValidation) {
        const validationResults = await this.validateInput(content, options);
        result.validationResults = validationResults;
        
        // Check for critical validation failures
        const criticalErrors = validationResults.filter(v => !v.passed && v.severity === 'error');
        if (criticalErrors.length > 0) {
          result.errors = criticalErrors.map(e => e.message);
          throw new InputProcessingError(
            `Input validation failed: ${criticalErrors.map(e => e.message).join(', ')}`,
            'VALIDATION_FAILED',
            { validationResults: criticalErrors }
          );
        }
        
        // Collect warnings
        const warnings = validationResults.filter(v => !v.passed && v.severity === 'warning');
        result.warnings = warnings.map(w => w.message);
      }

      // Step 2: Apply transformations
      if (this.config.enableTransformation) {
        const transformationResult = await this.applyTransformations(result.processedContent, options);
        result.processedContent = transformationResult.content;
        result.transformations = transformationResult.applied;
      }

      // Step 3: Normalize input
      if (this.config.enableNormalization) {
        const normalizedContent = await this.normalizeInput(result.processedContent);
        if (normalizedContent !== result.processedContent) {
          result.processedContent = normalizedContent;
          result.transformations.push('normalization');
        }
      }

      // Step 4: Route to input processor if available
      const inputProcessor = this.agent.getManager<InputProcessor>(ManagerType.INPUT_PROCESSOR);
      if (inputProcessor) {
        try {
          // Create input message for processor
          const inputMessage = {
            id: `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            senderId: 'coordinator',
            timestamp: new Date(),
            content: result.processedContent,
            modality: 'text' as const,
            metadata: (options.metadata as Record<string, unknown>) || ({ __placeholder: true } as Record<string, unknown>),
            context: options.context as { conversationId?: string; replyToMessageId?: string; threadId?: string; sessionId?: string; } | undefined
          };
          
          const processorResult = await inputProcessor.processInput(inputMessage);
          result.processedContent = processorResult.processedContent;
          result.metadata = {
            ...result.metadata,
            inputProcessorUsed: true,
            processorMetadata: processorResult.processingMetadata
          };
        } catch (error) {
          this.logger.warn('Input processor failed, continuing with coordinator result:', { error: error instanceof Error ? error.message : String(error) });
          result.warnings.push(`Input processor failed: ${(error as Error).message}`);
        }
      }

      // Update final metadata
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      result.metadata = {
        ...result.metadata,
        endTime: new Date().toISOString(),
        processingTime,
        contentLength: result.processedContent.length,
        transformationCount: result.transformations.length
      };

      result.success = true;
      this.updateProcessingStats(true, processingTime);
      
      this.logger.info(`Input processing completed successfully in ${processingTime}ms`);
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(false, processingTime);
      
      this.logger.error('Error during input processing:', { error: error instanceof Error ? error.message : String(error) });
      
      return {
        success: false,
        processedContent: content,
        originalContent: content,
        transformations: [],
        validationResults: [],
        metadata: {
          error: true,
          errorMessage: (error as Error).message,
          processingTime
        },
        warnings: [],
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * Validate input content
   */
  private async validateInput(
    content: string,
    options: MessageProcessingOptions
  ): Promise<InputValidationResult[]> {
    const results: InputValidationResult[] = [];
    
    // Sort validation rules by priority
    const sortedRules = Array.from(this.validationRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      try {
        const result = await rule.validate(content, options);
        results.push(result);
        
        // Stop on critical errors if rule is required
        if (!result.passed && result.severity === 'error' && rule.required) {
          break;
        }
      } catch (error) {
        this.logger.warn(`Validation rule ${rule.name} failed:`, { error: error instanceof Error ? error.message : String(error) });
        results.push({
          ruleName: rule.name,
          passed: false,
          message: `Validation rule failed: ${(error as Error).message}`,
          severity: 'error'
        });
      }
    }
    
    return results;
  }

  /**
   * Apply transformations to input content
   */
  private async applyTransformations(
    content: string,
    options: MessageProcessingOptions
  ): Promise<{ content: string; applied: string[] }> {
    let transformedContent = content;
    const appliedTransformations: string[] = [];
    
    // Sort transformations by priority
    const sortedTransformations = Array.from(this.transformations.values())
      .filter(transform => transform.enabled)
      .sort((a, b) => b.priority - a.priority);
    
    for (const transformation of sortedTransformations) {
      try {
        // Check if transformation should be applied
        if (transformation.validate && !transformation.validate(transformedContent)) {
          continue;
        }
        
        const previousContent = transformedContent;
        transformedContent = await transformation.transform(transformedContent, options);
        
        if (transformedContent !== previousContent) {
          appliedTransformations.push(transformation.name);
          this.logger.info(`Applied transformation: ${transformation.name}`);
        }
        
      } catch (error) {
        this.logger.warn(`Transformation ${transformation.name} failed:`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    return {
      content: transformedContent,
      applied: appliedTransformations
    };
  }

  /**
   * Normalize input content
   */
  private async normalizeInput(content: string): Promise<string> {
    let normalized = content;
    
    // Trim whitespace
    if (this.config.trimWhitespace) {
      normalized = normalized.trim();
    }
    
    // Convert to lowercase
    if (this.config.convertToLowercase) {
      normalized = normalized.toLowerCase();
    }
    
    // Remove special characters
    if (this.config.removeSpecialCharacters) {
      normalized = normalized.replace(/[^\w\s]/gi, '');
    }
    
    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ');
    
    return normalized;
  }

  /**
   * Initialize default transformations
   */
  private initializeDefaultTransformations(): void {
    // Security transformation - remove potentially dangerous content
    this.addTransformation({
      name: 'security_filter',
      enabled: true,
      priority: 100,
      transform: async (content: string) => {
        let filtered = content;
        
        // Remove script tags
        filtered = filtered.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT_REMOVED]');
        
        // Remove potential SQL injection patterns
        filtered = filtered.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/gi, '[SQL_COMMAND]');
        
        // Remove javascript: URLs
        filtered = filtered.replace(/javascript:/gi, 'javascript-blocked:');
        
        return filtered;
      }
    });

    // Content filtering transformation
    this.addTransformation({
      name: 'content_filter',
      enabled: this.config.enableContentFiltering,
      priority: 90,
      transform: async (content: string) => {
        let filtered = content;
        
        for (const pattern of this.config.blockedPatterns) {
          const regex = new RegExp(pattern, 'gi');
          filtered = filtered.replace(regex, '[REDACTED]');
        }
        
        return filtered;
      }
    });

    // URL normalization transformation
    this.addTransformation({
      name: 'url_normalization',
      enabled: true,
      priority: 50,
      transform: async (content: string) => {
        // Normalize URLs to a standard format
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        return content.replace(urlRegex, (url) => {
          try {
            const normalized = new URL(url);
            return normalized.toString();
          } catch {
            return url; // Return original if invalid URL
          }
        });
      }
    });
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultValidationRules(): void {
    // Length validation
    this.addValidationRule({
      name: 'length_check',
      enabled: true,
      priority: 100,
      required: true,
      validate: async (content: string) => {
        const isValid = content.length <= this.config.maxInputLength;
        return {
          ruleName: 'length_check',
          passed: isValid,
          message: isValid 
            ? 'Input length is valid' 
            : `Input exceeds maximum length of ${this.config.maxInputLength} characters`,
          severity: isValid ? 'info' : 'error',
          details: { length: content.length, maxLength: this.config.maxInputLength }
        };
      }
    });

    // Empty input validation
    this.addValidationRule({
      name: 'empty_check',
      enabled: !this.config.allowEmptyInput,
      priority: 90,
      required: true,
      validate: async (content: string) => {
        const isValid = content.trim().length > 0;
        return {
          ruleName: 'empty_check',
          passed: isValid,
          message: isValid ? 'Input is not empty' : 'Input cannot be empty',
          severity: isValid ? 'info' : 'error'
        };
      }
    });

    // Content pattern validation
    this.addValidationRule({
      name: 'content_pattern_check',
      enabled: this.config.enableContentFiltering,
      priority: 80,
      required: false,
      validate: async (content: string) => {
        for (const pattern of this.config.blockedPatterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(content)) {
            return {
              ruleName: 'content_pattern_check',
              passed: false,
              message: 'Input contains blocked content pattern',
              severity: 'warning',
              details: { pattern }
            };
          }
        }
        
        return {
          ruleName: 'content_pattern_check',
          passed: true,
          message: 'No blocked patterns detected',
          severity: 'info'
        };
      }
    });
  }

  /**
   * Add custom transformation
   */
  addTransformation(transformation: InputTransformation): void {
    this.transformations.set(transformation.name, transformation);
    this.logger.info(`Added transformation: ${transformation.name}`);
  }

  /**
   * Add custom validation rule
   */
  addValidationRule(rule: InputValidationRule): void {
    this.validationRules.set(rule.name, rule);
    this.logger.info(`Added validation rule: ${rule.name}`);
  }

  /**
   * Remove transformation
   */
  removeTransformation(name: string): boolean {
    const removed = this.transformations.delete(name);
    if (removed) {
      this.logger.info(`Removed transformation: ${name}`);
    }
    return removed;
  }

  /**
   * Remove validation rule
   */
  removeValidationRule(name: string): boolean {
    const removed = this.validationRules.delete(name);
    if (removed) {
      this.logger.info(`Removed validation rule: ${name}`);
    }
    return removed;
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(success: boolean, processingTime: number): void {
    this.processingStats.totalProcessed++;
    
    if (success) {
      this.processingStats.successfulProcessed++;
    } else {
      this.processingStats.failedProcessed++;
    }
    
    // Update average processing time
    const totalSuccessful = this.processingStats.successfulProcessed;
    const currentAverage = this.processingStats.averageProcessingTime;
    
    if (success && totalSuccessful > 0) {
      this.processingStats.averageProcessingTime = 
        ((currentAverage * (totalSuccessful - 1)) + processingTime) / totalSuccessful;
    }
  }

  /**
   * Get processing statistics
   */
  getStatistics(): typeof this.processingStats {
    return { ...this.processingStats };
  }

  /**
   * Get current configuration
   */
  getConfig(): InputProcessingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<InputProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Input processing configuration updated');
  }

  /**
   * Get available transformations
   */
  getTransformations(): InputTransformation[] {
    return Array.from(this.transformations.values());
  }

  /**
   * Get available validation rules
   */
  getValidationRules(): InputValidationRule[] {
    return Array.from(this.validationRules.values());
  }
} 