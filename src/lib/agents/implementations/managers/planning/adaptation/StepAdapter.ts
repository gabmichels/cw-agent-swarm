/**
 * StepAdapter.ts - Dynamic step modification and adaptation
 * 
 * This component handles dynamic modification of plan steps based on context,
 * execution feedback, and changing requirements. It provides failure recovery
 * strategies and performance optimization for individual steps.
 */

import { ulid } from 'ulid';
import { 
  PlanStep, 
  PlanAction 
} from '../../../../../../agents/shared/base/managers/PlanningManager.interface';
import { 
  ValidationResult,
  ValidationIssue 
} from '../interfaces/PlanningInterfaces';
import { createLogger } from '../../../../../logging/winston-logger';

/**
 * Configuration for step adaptation
 */
export interface StepAdapterConfig {
  /** Enable context-aware adaptation */
  enableContextAdaptation: boolean;
  
  /** Enable failure recovery */
  enableFailureRecovery: boolean;
  
  /** Enable performance optimization */
  enablePerformanceOptimization: boolean;
  
  /** Enable logging */
  enableLogging: boolean;
  
  /** Maximum adaptation attempts per step */
  maxAdaptationAttempts: number;
  
  /** Adaptation timeout (ms) */
  adaptationTimeoutMs: number;
  
  /** Minimum confidence threshold for adaptations */
  confidenceThreshold: number;
}

/**
 * Default configuration for step adaptation
 */
const DEFAULT_CONFIG: StepAdapterConfig = {
  enableContextAdaptation: true,
  enableFailureRecovery: true,
  enablePerformanceOptimization: true,
  enableLogging: true,
  maxAdaptationAttempts: 3,
  adaptationTimeoutMs: 30000, // 30 seconds
  confidenceThreshold: 0.7
};

/**
 * Context for step adaptation
 */
export interface AdaptationContext {
  /** Execution history */
  executionHistory?: ExecutionRecord[];
  
  /** Available resources */
  availableResources?: Record<string, unknown>;
  
  /** Performance metrics */
  performanceMetrics?: PerformanceMetrics;
  
  /** Environmental factors */
  environment?: Record<string, unknown>;
  
  /** User feedback */
  userFeedback?: string;
  
  /** Previous adaptation attempts */
  previousAdaptations?: AdaptationRecord[];
}

/**
 * Execution record for tracking step performance
 */
export interface ExecutionRecord {
  /** Step ID */
  stepId: string;
  
  /** Execution start time */
  startTime: Date;
  
  /** Execution end time */
  endTime?: Date;
  
  /** Execution status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  
  /** Execution result */
  result?: unknown;
  
  /** Error information */
  error?: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  };
  
  /** Performance metrics */
  metrics?: {
    duration: number;
    resourceUsage: Record<string, number>;
    quality: number;
  };
}

/**
 * Performance metrics for step execution
 */
export interface PerformanceMetrics {
  /** Average execution time (ms) */
  averageExecutionTime: number;
  
  /** Success rate (0-1) */
  successRate: number;
  
  /** Resource efficiency (0-1) */
  resourceEfficiency: number;
  
  /** Quality score (0-1) */
  qualityScore: number;
  
  /** Trend indicators */
  trends: {
    executionTime: 'improving' | 'stable' | 'degrading';
    successRate: 'improving' | 'stable' | 'degrading';
    resourceUsage: 'improving' | 'stable' | 'degrading';
  };
}

/**
 * Record of adaptation attempts
 */
export interface AdaptationRecord {
  /** Adaptation ID */
  id: string;
  
  /** Step ID that was adapted */
  stepId: string;
  
  /** Adaptation type */
  type: 'context' | 'failure_recovery' | 'performance' | 'manual';
  
  /** Adaptation reason */
  reason: string;
  
  /** Original step */
  originalStep: PlanStep;
  
  /** Adapted step */
  adaptedStep: PlanStep;
  
  /** Adaptation timestamp */
  timestamp: Date;
  
  /** Adaptation confidence */
  confidence: number;
  
  /** Adaptation result */
  result?: {
    success: boolean;
    improvementMetrics?: Record<string, number>;
    issues?: string[];
  };
}

/**
 * Options for step adaptation
 */
export interface StepAdaptationOptions {
  /** Adaptation type to apply */
  adaptationType?: 'context' | 'failure_recovery' | 'performance' | 'auto';
  
  /** Specific reason for adaptation */
  reason?: string;
  
  /** Target performance improvements */
  targetImprovements?: {
    executionTime?: number; // Target reduction percentage
    successRate?: number;   // Target success rate
    resourceUsage?: number; // Target reduction percentage
  };
  
  /** Constraints for adaptation */
  constraints?: {
    preserveSemantics?: boolean;
    maxComplexityIncrease?: number;
    requiredCapabilities?: string[];
  };
}

/**
 * Result of step adaptation
 */
export interface StepAdaptationResult {
  /** Whether adaptation was successful */
  success: boolean;
  
  /** Original step */
  originalStep: PlanStep;
  
  /** Adapted step */
  adaptedStep?: PlanStep;
  
  /** Adaptation confidence */
  confidence: number;
  
  /** Adaptation type applied */
  adaptationType: string;
  
  /** Adaptation reason */
  reason: string;
  
  /** Expected improvements */
  expectedImprovements: Record<string, number>;
  
  /** Validation results */
  validationResults?: ValidationResult;
  
  /** Adaptation metadata */
  metadata: {
    adaptationId: string;
    timestamp: Date;
    duration: number;
    attemptNumber: number;
  };
  
  /** Error information if failed */
  error?: string;
}

/**
 * Step adaptation error
 */
export class StepAdaptationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly stepId: string,
    public readonly recoverable: boolean = true,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'StepAdaptationError';
  }
}

/**
 * Implementation of step adaptation functionality
 */
export class StepAdapter {
  private readonly logger = createLogger({ moduleId: 'step-adapter' });
  private readonly config: StepAdapterConfig;
  private readonly adaptationHistory: Map<string, AdaptationRecord[]> = new Map();
  private readonly executionHistory: Map<string, ExecutionRecord[]> = new Map();

  constructor(config: Partial<StepAdapterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enableLogging) {
      this.logger.info('StepAdapter initialized', { config: this.config });
    }
  }

  /**
   * Adapt a step based on context and requirements
   */
  async adaptStep(
    step: PlanStep,
    context: AdaptationContext = {},
    options: StepAdaptationOptions = {}
  ): Promise<StepAdaptationResult> {
    const adaptationId = ulid();
    const startTime = Date.now();

    try {
      if (this.config.enableLogging) {
        this.logger.info('Starting step adaptation', {
          adaptationId,
          stepId: step.id,
          stepName: step.name,
          adaptationType: options.adaptationType,
          reason: options.reason
        });
      }

      // Validate input
      if (!step.id || !step.name) {
        throw new StepAdaptationError(
          'Invalid step: missing required fields',
          'INVALID_STEP',
          step.id || 'unknown',
          false
        );
      }

      // Check adaptation attempts
      const previousAdaptations = this.adaptationHistory.get(step.id) || [];
      if (previousAdaptations.length >= this.config.maxAdaptationAttempts) {
        throw new StepAdaptationError(
          'Maximum adaptation attempts exceeded',
          'MAX_ATTEMPTS_EXCEEDED',
          step.id,
          false,
          { attempts: previousAdaptations.length, maxAttempts: this.config.maxAdaptationAttempts }
        );
      }

      // Determine adaptation type
      const adaptationType = options.adaptationType || this.determineAdaptationType(step, context);
      
      // Apply adaptation based on type
      let adaptedStep: PlanStep;
      let confidence: number;
      let expectedImprovements: Record<string, number>;

      switch (adaptationType) {
        case 'context':
          ({ adaptedStep, confidence, expectedImprovements } = await this.applyContextAdaptation(step, context, options));
          break;
        case 'failure_recovery':
          ({ adaptedStep, confidence, expectedImprovements } = await this.applyFailureRecovery(step, context, options));
          break;
        case 'performance':
          ({ adaptedStep, confidence, expectedImprovements } = await this.applyPerformanceOptimization(step, context, options));
          break;
        case 'auto':
          ({ adaptedStep, confidence, expectedImprovements } = await this.applyAutoAdaptation(step, context, options));
          break;
        default:
          throw new StepAdaptationError(
            `Unknown adaptation type: ${adaptationType}`,
            'UNKNOWN_ADAPTATION_TYPE',
            step.id,
            true,
            { adaptationType }
          );
      }

      // Validate adapted step
      const validationResults = await this.validateAdaptedStep(adaptedStep, step);
      if (!validationResults.isValid || validationResults.score < this.config.confidenceThreshold) {
        throw new StepAdaptationError(
          'Adapted step failed validation',
          'VALIDATION_FAILED',
          step.id,
          true,
          { validationResults, confidence, threshold: this.config.confidenceThreshold }
        );
      }

             // Record adaptation
       const adaptationRecord: AdaptationRecord = {
         id: adaptationId,
         stepId: step.id,
         type: adaptationType as 'context' | 'failure_recovery' | 'performance' | 'manual',
         reason: options.reason || `${adaptationType} adaptation`,
         originalStep: step,
         adaptedStep,
         timestamp: new Date(),
         confidence
       };

       this.recordAdaptation(adaptationRecord);

       const duration = Date.now() - startTime;

       if (this.config.enableLogging) {
         this.logger.info('Step adaptation completed', {
           adaptationId,
           stepId: step.id,
           adaptationType,
           confidence,
           duration,
           expectedImprovements
         });
       }

       return {
         success: true,
         originalStep: step,
         adaptedStep,
         confidence,
         adaptationType,
         reason: options.reason || `${adaptationType} adaptation`,
         expectedImprovements,
         validationResults,
         metadata: {
           adaptationId,
           timestamp: new Date(),
           duration,
           attemptNumber: previousAdaptations.length + 1
         }
       };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (this.config.enableLogging) {
        this.logger.error('Step adaptation failed', {
          adaptationId,
          stepId: step.id,
          error: error instanceof Error ? error.message : String(error),
          duration
        });
      }

      return {
        success: false,
        originalStep: step,
        confidence: 0,
        adaptationType: options.adaptationType || 'unknown',
        reason: options.reason || 'adaptation failed',
        expectedImprovements: {},
                 metadata: {
           adaptationId,
           timestamp: new Date(),
           duration,
           attemptNumber: (this.adaptationHistory.get(step.id) || []).length + 1
         },
         error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Determine the best adaptation type for a step
   */
  private determineAdaptationType(
    step: PlanStep,
    context: AdaptationContext
  ): 'context' | 'failure_recovery' | 'performance' | 'auto' {
    // Check for failure indicators
    const executionRecords = context.executionHistory?.filter(record => record.stepId === step.id) || [];
    const hasFailures = executionRecords.some(record => record.status === 'failed');
    
    if (hasFailures) {
      return 'failure_recovery';
    }

    // Check for performance issues
    const performanceMetrics = context.performanceMetrics;
    if (performanceMetrics) {
      const hasPerformanceIssues = 
        performanceMetrics.successRate < 0.8 ||
        performanceMetrics.resourceEfficiency < 0.6 ||
        performanceMetrics.trends.executionTime === 'degrading';
      
      if (hasPerformanceIssues) {
        return 'performance';
      }
    }

    // Check for context changes
    if (context.environment || context.availableResources || context.userFeedback) {
      return 'context';
    }

    // Default to auto adaptation
    return 'auto';
  }

  /**
   * Apply context-aware adaptation
   */
  private async applyContextAdaptation(
    step: PlanStep,
    context: AdaptationContext,
    options: StepAdaptationOptions
  ): Promise<{ adaptedStep: PlanStep; confidence: number; expectedImprovements: Record<string, number> }> {
    const adaptedStep: PlanStep = { ...step };
    let confidence = 0.8;
    const expectedImprovements: Record<string, number> = {};

    // Adapt based on available resources
    if (context.availableResources) {
      adaptedStep.actions = await this.adaptActionsForResources(step.actions, context.availableResources);
      expectedImprovements.resourceEfficiency = 15;
    }

    // Adapt based on environment
    if (context.environment) {
      adaptedStep.description = this.adaptDescriptionForEnvironment(step.description, context.environment);
      expectedImprovements.contextRelevance = 20;
    }

    // Adapt based on user feedback
    if (context.userFeedback) {
      const feedbackAdaptations = this.adaptForUserFeedback(step, context.userFeedback);
      Object.assign(adaptedStep, feedbackAdaptations);
      expectedImprovements.userSatisfaction = 25;
      confidence += 0.1;
    }

         // Update timestamp
     adaptedStep.updatedAt = new Date();

    return { adaptedStep, confidence, expectedImprovements };
  }

  /**
   * Apply failure recovery strategies
   */
  private async applyFailureRecovery(
    step: PlanStep,
    context: AdaptationContext,
    options: StepAdaptationOptions
  ): Promise<{ adaptedStep: PlanStep; confidence: number; expectedImprovements: Record<string, number> }> {
    const adaptedStep: PlanStep = { ...step };
    let confidence = 0.7;
    const expectedImprovements: Record<string, number> = {};

    // Analyze failure patterns
    const executionRecords = context.executionHistory?.filter(record => 
      record.stepId === step.id && record.status === 'failed'
    ) || [];

    if (executionRecords.length > 0) {
      // Add retry logic
      adaptedStep.actions = await this.addRetryLogic(step.actions, executionRecords);
      expectedImprovements.successRate = 30;

      // Add error handling
      adaptedStep.actions = await this.addErrorHandling(adaptedStep.actions, executionRecords);
      expectedImprovements.reliability = 25;

      // Add fallback actions
      const fallbackActions = await this.generateFallbackActions(step, executionRecords);
      adaptedStep.actions = [...adaptedStep.actions, ...fallbackActions];
      expectedImprovements.robustness = 20;

      confidence += 0.15;
    }

         // Update timestamp
     adaptedStep.updatedAt = new Date();

    return { adaptedStep, confidence, expectedImprovements };
  }

  /**
   * Apply performance optimization
   */
  private async applyPerformanceOptimization(
    step: PlanStep,
    context: AdaptationContext,
    options: StepAdaptationOptions
  ): Promise<{ adaptedStep: PlanStep; confidence: number; expectedImprovements: Record<string, number> }> {
    const adaptedStep: PlanStep = { ...step };
    let confidence = 0.75;
    const expectedImprovements: Record<string, number> = {};

    // Optimize action sequence
    adaptedStep.actions = await this.optimizeActionSequence(step.actions);
    expectedImprovements.executionTime = 20;

         // Optimize resource usage
     if (context.performanceMetrics && context.performanceMetrics.resourceEfficiency < 0.7) {
       adaptedStep.actions = await this.optimizeResourceUsage(adaptedStep.actions);
       expectedImprovements.resourceEfficiency = 25;
     }

    // Add performance monitoring
    const monitoringAction = await this.createPerformanceMonitoringAction(step);
    adaptedStep.actions.push(monitoringAction);
    expectedImprovements.observability = 15;

    // Apply target improvements if specified
    if (options.targetImprovements) {
      if (options.targetImprovements.executionTime) {
        adaptedStep.actions = await this.optimizeForSpeed(adaptedStep.actions, options.targetImprovements.executionTime);
        expectedImprovements.executionTime = options.targetImprovements.executionTime;
        confidence += 0.1;
      }
    }

         // Update timestamp
     adaptedStep.updatedAt = new Date();

    return { adaptedStep, confidence, expectedImprovements };
  }

  /**
   * Apply automatic adaptation based on analysis
   */
  private async applyAutoAdaptation(
    step: PlanStep,
    context: AdaptationContext,
    options: StepAdaptationOptions
  ): Promise<{ adaptedStep: PlanStep; confidence: number; expectedImprovements: Record<string, number> }> {
    // Analyze step and context to determine best adaptations
    const adaptations: Array<{
      type: string;
      confidence: number;
      improvements: Record<string, number>;
      apply: () => Promise<PlanStep>;
    }> = [];

    // Consider context adaptation
    if (context.availableResources || context.environment) {
      adaptations.push({
        type: 'context',
        confidence: 0.7,
        improvements: { contextRelevance: 15, resourceEfficiency: 10 },
        apply: async () => (await this.applyContextAdaptation(step, context, options)).adaptedStep
      });
    }

         // Consider performance optimization
     if (context.performanceMetrics && context.performanceMetrics.resourceEfficiency < 0.8) {
       adaptations.push({
         type: 'performance',
         confidence: 0.8,
         improvements: { executionTime: 15, resourceEfficiency: 20 },
         apply: async () => (await this.applyPerformanceOptimization(step, context, options)).adaptedStep
       });
     }

    // Select best adaptation
    const bestAdaptation = adaptations.reduce((best, current) => 
      current.confidence > best.confidence ? current : best,
      { type: 'none', confidence: 0, improvements: {}, apply: async () => step }
    );

    if (bestAdaptation.confidence > 0.6) {
      const adaptedStep = await bestAdaptation.apply();
      return {
        adaptedStep,
        confidence: bestAdaptation.confidence,
        expectedImprovements: bestAdaptation.improvements
      };
    }

    // No significant adaptation needed
    return {
      adaptedStep: { ...step, updatedAt: new Date() },
      confidence: 0.9,
      expectedImprovements: { stability: 5 }
    };
  }

  /**
   * Adapt actions for available resources
   */
  private async adaptActionsForResources(
    actions: PlanAction[],
    availableResources: Record<string, unknown>
  ): Promise<PlanAction[]> {
    return actions.map(action => ({
      ...action,
      parameters: {
        ...action.parameters,
        availableResources,
        resourceOptimized: true
      },
      updatedAt: new Date()
    }));
  }

  /**
   * Adapt description for environment
   */
  private adaptDescriptionForEnvironment(
    description: string,
    environment: Record<string, unknown>
  ): string {
    // Add environment context to description
    const envContext = Object.entries(environment)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    return `${description} (Environment: ${envContext})`;
  }

  /**
   * Adapt step based on user feedback
   */
  private adaptForUserFeedback(
    step: PlanStep,
    feedback: string
  ): Partial<PlanStep> {
    const adaptations: Partial<PlanStep> = {};

    // Analyze feedback for priority changes
    if (feedback.toLowerCase().includes('urgent') || feedback.toLowerCase().includes('priority')) {
      adaptations.priority = Math.min((step.priority || 0.5) + 0.2, 1.0);
    }

    // Analyze feedback for description improvements
    if (feedback.toLowerCase().includes('unclear') || feedback.toLowerCase().includes('confusing')) {
      adaptations.description = `${step.description} (Clarified based on feedback: ${feedback.substring(0, 50)}...)`;
    }

    return adaptations;
  }

  /**
   * Add retry logic to actions
   */
  private async addRetryLogic(
    actions: PlanAction[],
    failureRecords: ExecutionRecord[]
  ): Promise<PlanAction[]> {
    return actions.map(action => ({
      ...action,
      parameters: {
        ...action.parameters,
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true,
          retryConditions: ['timeout', 'network_error', 'temporary_failure']
        }
      },
      updatedAt: new Date()
    }));
  }

  /**
   * Add error handling to actions
   */
  private async addErrorHandling(
    actions: PlanAction[],
    failureRecords: ExecutionRecord[]
  ): Promise<PlanAction[]> {
    return actions.map(action => ({
      ...action,
      parameters: {
        ...action.parameters,
        errorHandling: {
          continueOnError: false,
          logErrors: true,
          notifyOnError: true,
          fallbackStrategy: 'retry_with_backoff'
        }
      },
      updatedAt: new Date()
    }));
  }

  /**
   * Generate fallback actions
   */
  private async generateFallbackActions(
    step: PlanStep,
    failureRecords: ExecutionRecord[]
  ): Promise<PlanAction[]> {
    const fallbackActions: PlanAction[] = [];

    // Create a generic fallback action
    fallbackActions.push({
      id: `${step.id}_fallback`,
      name: `Fallback for ${step.name}`,
      type: 'fallback',
      description: `Fallback action for step: ${step.description}`,
      parameters: {
        originalStepId: step.id,
        fallbackReason: 'Previous execution failures',
        failureCount: failureRecords.length
      },
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return fallbackActions;
  }

  /**
   * Optimize action sequence
   */
  private async optimizeActionSequence(actions: PlanAction[]): Promise<PlanAction[]> {
    // Sort actions by estimated execution time (shorter first)
    return [...actions].sort((a, b) => {
      const aTime = (a.parameters?.estimatedTime as number) || 10;
      const bTime = (b.parameters?.estimatedTime as number) || 10;
      return aTime - bTime;
    });
  }

  /**
   * Optimize resource usage
   */
  private async optimizeResourceUsage(actions: PlanAction[]): Promise<PlanAction[]> {
    return actions.map(action => ({
      ...action,
      parameters: {
        ...action.parameters,
        resourceOptimization: {
          enableCaching: true,
          batchOperations: true,
          parallelExecution: false,
          memoryLimit: '512MB'
        }
      },
      updatedAt: new Date()
    }));
  }

  /**
   * Create performance monitoring action
   */
  private async createPerformanceMonitoringAction(step: PlanStep): Promise<PlanAction> {
    return {
      id: `${step.id}_monitor`,
      name: `Monitor ${step.name}`,
      type: 'monitoring',
      description: `Performance monitoring for step: ${step.description}`,
      parameters: {
        monitorType: 'performance',
        metrics: ['executionTime', 'resourceUsage', 'successRate'],
        originalStepId: step.id
      },
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Optimize actions for speed
   */
  private async optimizeForSpeed(
    actions: PlanAction[],
    targetReduction: number
  ): Promise<PlanAction[]> {
    return actions.map(action => ({
      ...action,
      parameters: {
        ...action.parameters,
        speedOptimization: {
          targetReduction,
          enableParallelization: true,
          useCache: true,
          skipNonEssential: true
        }
      },
      updatedAt: new Date()
    }));
  }

  /**
   * Validate adapted step
   */
  private async validateAdaptedStep(
    adaptedStep: PlanStep,
    originalStep: PlanStep
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

    // Validate step structure
    if (!adaptedStep.id || !adaptedStep.name || !adaptedStep.description) {
      issues.push({
        severity: 'error',
        message: 'Adapted step missing required fields',
        location: { stepId: adaptedStep.id },
        suggestedFix: 'Ensure all required fields are present'
      });
      score -= 0.3;
    }

    // Validate actions
    if (!adaptedStep.actions || adaptedStep.actions.length === 0) {
      issues.push({
        severity: 'warning',
        message: 'Adapted step has no actions',
        location: { stepId: adaptedStep.id },
        suggestedFix: 'Add at least one action to the step'
      });
      score -= 0.2;
    }

    // Check for semantic preservation
    const semanticSimilarity = this.calculateSemanticSimilarity(originalStep, adaptedStep);
    if (semanticSimilarity < 0.7) {
      issues.push({
        severity: 'warning',
        message: 'Adapted step significantly differs from original semantics',
        location: { stepId: adaptedStep.id },
        suggestedFix: 'Review adaptation to preserve original intent'
      });
      score -= 0.1;
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(score, 0),
      issues,
      suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[]
    };
  }

  /**
   * Calculate semantic similarity between steps
   */
  private calculateSemanticSimilarity(original: PlanStep, adapted: PlanStep): number {
    // Simple similarity calculation based on name and description
    const nameMatch = original.name === adapted.name ? 1 : 0.5;
    const descMatch = original.description === adapted.description ? 1 : 0.7;
    const actionCountMatch = original.actions.length === adapted.actions.length ? 1 : 0.8;
    
    return (nameMatch + descMatch + actionCountMatch) / 3;
  }

  /**
   * Record adaptation attempt
   */
  private recordAdaptation(record: AdaptationRecord): void {
    const stepHistory = this.adaptationHistory.get(record.stepId) || [];
    stepHistory.push(record);
    this.adaptationHistory.set(record.stepId, stepHistory);
  }

  /**
   * Record execution result
   */
  recordExecution(record: ExecutionRecord): void {
    const stepHistory = this.executionHistory.get(record.stepId) || [];
    stepHistory.push(record);
    this.executionHistory.set(record.stepId, stepHistory);
  }

  /**
   * Get adaptation history for a step
   */
  getAdaptationHistory(stepId: string): AdaptationRecord[] {
    return this.adaptationHistory.get(stepId) || [];
  }

  /**
   * Get execution history for a step
   */
  getExecutionHistory(stepId: string): ExecutionRecord[] {
    return this.executionHistory.get(stepId) || [];
  }

  /**
   * Configure step adapter behavior
   */
  configure(config: Partial<StepAdapterConfig>): void {
    Object.assign(this.config, config);
    
    if (this.config.enableLogging) {
      this.logger.info('StepAdapter configuration updated', { config: this.config });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): StepAdapterConfig {
    return { ...this.config };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    config: StepAdapterConfig;
    statistics: {
      totalAdaptations: number;
      successfulAdaptations: number;
      adaptationsByType: Record<string, number>;
      averageConfidence: number;
    };
  } {
    const allAdaptations = Array.from(this.adaptationHistory.values()).flat();
    const successfulAdaptations = allAdaptations.filter(a => a.result?.success !== false);
    
    const adaptationsByType = allAdaptations.reduce((acc, adaptation) => {
      acc[adaptation.type] = (acc[adaptation.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageConfidence = allAdaptations.length > 0 
      ? allAdaptations.reduce((sum, a) => sum + a.confidence, 0) / allAdaptations.length 
      : 0;

    return {
      healthy: true,
      config: this.config,
      statistics: {
        totalAdaptations: allAdaptations.length,
        successfulAdaptations: successfulAdaptations.length,
        adaptationsByType,
        averageConfidence
      }
    };
  }
} 