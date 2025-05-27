/**
 * Action Processor
 * 
 * Handles action execution coordination, result processing, progress tracking,
 * and impact assessment for improvement actions. Extracted from DefaultReflectionManager.
 */

import { ulid } from 'ulid';
import { 
  ActionProcessor as IActionProcessor,
  ImprovementAction,
  ActionProcessingResult,
  ActionProgress,
  ActionReport,
  ImpactAssessment
} from '../interfaces/ReflectionInterfaces';

/**
 * Error class for action processing errors
 */
export class ActionProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ActionProcessingError';
  }
}

/**
 * Configuration for action processing
 */
export interface ActionProcessorConfig {
  maxConcurrentActions?: number;
  defaultTimeout?: number;
  retryAttempts?: number;
  progressUpdateInterval?: number;
  impactMeasurementDelay?: number;
  enableMetrics?: boolean;
}

/**
 * Context for action execution
 */
export interface ActionExecutionContext {
  actionId: string;
  startTime: Date;
  timeout?: number;
  metadata: Record<string, unknown>;
  dependencies: string[];
  resources: Record<string, unknown>;
}

/**
 * Implementation of ActionProcessor interface
 */
export class ActionProcessor implements IActionProcessor {
  private readonly config: Required<ActionProcessorConfig>;
  private readonly activeActions: Map<string, ActionExecutionContext> = new Map();
  private readonly actionProgress: Map<string, ActionProgress> = new Map();
  private readonly actionResults: Map<string, ActionProcessingResult> = new Map();
  private readonly impactAssessments: Map<string, ImpactAssessment> = new Map();
  private readonly metrics: Map<string, number> = new Map();

  constructor(config: ActionProcessorConfig = {}) {
    this.config = {
      maxConcurrentActions: config.maxConcurrentActions || 5,
      defaultTimeout: config.defaultTimeout || 300000, // 5 minutes
      retryAttempts: config.retryAttempts || 3,
      progressUpdateInterval: config.progressUpdateInterval || 5000, // 5 seconds
      impactMeasurementDelay: config.impactMeasurementDelay || 60000, // 1 minute
      enableMetrics: config.enableMetrics ?? true
    };

    if (this.config.enableMetrics) {
      this.initializeMetrics();
    }
  }

  /**
   * Process an improvement action
   */
  async processAction(action: ImprovementAction): Promise<ActionProcessingResult> {
    // Check concurrent action limit
    if (this.activeActions.size >= this.config.maxConcurrentActions) {
      throw new ActionProcessingError(
        `Maximum concurrent actions (${this.config.maxConcurrentActions}) reached`,
        'CAPACITY_EXCEEDED',
        { activeActions: this.activeActions.size }
      );
    }

    // Validate action for processing
    await this.validateActionForProcessing(action);

    // Initialize execution context
    const context: ActionExecutionContext = {
      actionId: action.id,
      startTime: new Date(),
      timeout: this.config.defaultTimeout,
      metadata: { priority: action.priority, targetArea: action.targetArea },
      dependencies: [],
      resources: {}
    };

    this.activeActions.set(action.id, context);

    try {
      // Initialize progress tracking
      await this.initializeProgress(action);

      // Execute action steps
      const rawResults = await this.executeActionSteps(action, context);

      // Process results
      const processedResults = await this.processResults(action, rawResults);

      // Generate next steps
      const nextSteps = await this.generateNextSteps(action, processedResults);

      // Create final result
      const result: ActionProcessingResult = {
        actionId: action.id,
        success: true,
        results: processedResults,
        nextSteps,
        executionTime: Date.now() - context.startTime.getTime(),
        metadata: {
          processingTimestamp: new Date(),
          executionContext: context.metadata,
          metricsSnapshot: this.config.enableMetrics ? Object.fromEntries(this.metrics) : {}
        }
      };

      // Store result
      this.actionResults.set(action.id, result);

      // Update metrics
      if (this.config.enableMetrics) {
        this.updateMetrics('actionsProcessed', 1);
        this.updateMetrics('totalExecutionTime', result.executionTime);
      }

      return result;

    } catch (error) {
      const errorResult: ActionProcessingResult = {
        actionId: action.id,
        success: false,
        results: {},
        nextSteps: [],
        executionTime: Date.now() - context.startTime.getTime(),
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          processingTimestamp: new Date(),
          executionContext: context.metadata,
          errorDetails: error instanceof Error ? { name: error.name, stack: error.stack } : {}
        }
      };

      this.actionResults.set(action.id, errorResult);

      if (this.config.enableMetrics) {
        this.updateMetrics('actionsFailed', 1);
      }

      throw new ActionProcessingError(
        `Action processing failed: ${errorResult.error}`,
        'PROCESSING_FAILED',
        { actionId: action.id, error: errorResult.error }
      );

    } finally {
      this.activeActions.delete(action.id);
    }
  }

  /**
   * Track progress of an action
   */
  async trackProgress(actionId: string): Promise<ActionProgress> {
    const progress = this.actionProgress.get(actionId);
    if (!progress) {
      throw new ActionProcessingError(
        `No progress tracking found for action: ${actionId}`,
        'PROGRESS_NOT_FOUND',
        { actionId }
      );
    }

    // Update progress if action is active
    if (this.activeActions.has(actionId)) {
      await this.updateProgress(actionId);
    }

    return this.actionProgress.get(actionId)!;
  }

  /**
   * Assess impact of a processed action
   */
  async assessImpact(actionId: string): Promise<ImpactAssessment> {
    const result = this.actionResults.get(actionId);
    if (!result) {
      throw new ActionProcessingError(
        `No processing result found for action: ${actionId}`,
        'RESULT_NOT_FOUND',
        { actionId }
      );
    }

    if (!result.success) {
      throw new ActionProcessingError(
        `Cannot assess impact of failed action: ${actionId}`,
        'ACTION_FAILED',
        { actionId, error: result.error }
      );
    }

    // Check if assessment already exists
    let assessment = this.impactAssessments.get(actionId);
    if (!assessment) {
      // Calculate new assessment
      assessment = await this.calculateImpactAssessment(actionId, result);
      this.impactAssessments.set(actionId, assessment);
    }

    return assessment;
  }

  /**
   * Generate comprehensive report for an action
   */
  async generateReport(actionId: string): Promise<ActionReport> {
    const result = this.actionResults.get(actionId);
    const progress = this.actionProgress.get(actionId);
    
    if (!result) {
      throw new ActionProcessingError(
        `No processing result found for action: ${actionId}`,
        'RESULT_NOT_FOUND',
        { actionId }
      );
    }

    let impact: ImpactAssessment | undefined;
    try {
      impact = await this.assessImpact(actionId);
    } catch (error) {
      // Impact assessment may fail for unsuccessful actions
    }

    const summary = this.generateSummary(result, progress, impact);
    const recommendations = await this.generateRecommendations(actionId, result, impact);

    return {
      actionId,
      generatedAt: new Date(),
      summary,
      result,
      progress,
      impact,
      recommendations,
      metadata: {
        reportVersion: '1.0',
        generatorConfig: this.config
      }
    };
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): Record<string, unknown> {
    const stats = {
      activeActions: this.activeActions.size,
      totalProcessed: this.actionResults.size,
      totalProgress: this.actionProgress.size,
      totalImpactAssessments: this.impactAssessments.size,
      config: this.config
    };

    if (this.config.enableMetrics) {
      return {
        ...stats,
        metrics: Object.fromEntries(this.metrics)
      };
    }

    return stats;
  }

  /**
   * Cancel an active action
   */
  async cancelAction(actionId: string): Promise<boolean> {
    const context = this.activeActions.get(actionId);
    if (!context) {
      return false; // Action not active
    }

    // Remove from active actions
    this.activeActions.delete(actionId);

    // Update progress to cancelled
    const progress = this.actionProgress.get(actionId);
    if (progress) {
      progress.status = 'cancelled';
      progress.completedSteps = progress.totalSteps; // Mark as completed to stop tracking
      progress.lastUpdated = new Date();
    }

    // Create cancelled result
    const cancelledResult: ActionProcessingResult = {
      actionId,
      success: false,
      results: {},
      nextSteps: [],
      executionTime: Date.now() - context.startTime.getTime(),
      error: 'Action was cancelled',
      metadata: {
        processingTimestamp: new Date(),
        executionContext: context.metadata,
        cancellationReason: 'User requested cancellation'
      }
    };

    this.actionResults.set(actionId, cancelledResult);

    if (this.config.enableMetrics) {
      this.updateMetrics('actionsCancelled', 1);
    }

    return true;
  }

  /**
   * Clear all processing data (for testing)
   */
  async clear(): Promise<void> {
    this.activeActions.clear();
    this.actionProgress.clear();
    this.actionResults.clear();
    this.impactAssessments.clear();
    
    if (this.config.enableMetrics) {
      this.metrics.clear();
      this.initializeMetrics();
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async validateActionForProcessing(action: ImprovementAction): Promise<void> {
    if (!action.id || action.id.trim().length === 0) {
      throw new ActionProcessingError(
        'Action must have a valid ID',
        'INVALID_ACTION_ID',
        { action }
      );
    }

    if (action.status !== 'accepted' && action.status !== 'in_progress') {
      throw new ActionProcessingError(
        `Action must be in 'accepted' or 'in_progress' status, current: ${action.status}`,
        'INVALID_ACTION_STATUS',
        { actionId: action.id, status: action.status }
      );
    }

    if (this.activeActions.has(action.id)) {
      throw new ActionProcessingError(
        `Action is already being processed: ${action.id}`,
        'ACTION_ALREADY_PROCESSING',
        { actionId: action.id }
      );
    }
  }

  private async initializeProgress(action: ImprovementAction): Promise<void> {
    const totalSteps = action.implementationSteps?.length || 1;
    const estimatedCompletion = this.calculateEstimatedCompletion(action);

    const progress: ActionProgress = {
      actionId: action.id,
      status: 'in_progress',
      completedSteps: 0,
      totalSteps,
      percentComplete: 0,
      estimatedCompletion,
      lastUpdated: new Date(),
      blockers: [],
      milestones: []
    };

    this.actionProgress.set(action.id, progress);
  }

  private async updateProgress(actionId: string): Promise<void> {
    const progress = this.actionProgress.get(actionId);
    const context = this.activeActions.get(actionId);
    
    if (!progress || !context) {
      return;
    }

    // Simulate progress updates based on execution time
    const elapsedTime = Date.now() - context.startTime.getTime();
    const estimatedTotal = this.config.defaultTimeout;
    const timeBasedProgress = Math.min(elapsedTime / estimatedTotal, 0.9); // Cap at 90%

    progress.percentComplete = Math.max(progress.percentComplete, timeBasedProgress * 100);
    progress.lastUpdated = new Date();

    // Update estimated completion
    if (progress.percentComplete > 0) {
      const remainingTime = (elapsedTime / progress.percentComplete) * (100 - progress.percentComplete);
      progress.estimatedCompletion = new Date(Date.now() + remainingTime);
    }
  }

  private async executeActionSteps(
    action: ImprovementAction, 
    context: ActionExecutionContext
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    const steps = action.implementationSteps || [{ description: action.description, status: 'pending' }];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      try {
        // Execute individual step
        const stepResult = await this.executeStep(step, i, context);
        results[`step_${i + 1}`] = stepResult;

        // Update progress
        const progress = this.actionProgress.get(action.id);
        if (progress) {
          progress.completedSteps = i + 1;
          progress.percentComplete = ((i + 1) / steps.length) * 100;
          progress.lastUpdated = new Date();
        }

        // Check for cancellation
        if (!this.activeActions.has(action.id)) {
          throw new ActionProcessingError(
            'Action was cancelled during execution',
            'ACTION_CANCELLED',
            { actionId: action.id, completedSteps: i + 1 }
          );
        }

      } catch (error) {
        // Add blocker to progress
        const progress = this.actionProgress.get(action.id);
        if (progress) {
          progress.blockers.push({
            description: `Step ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'high',
            identifiedAt: new Date()
          });
        }

        throw error;
      }
    }

    return results;
  }

  private async executeStep(
    step: { description: string; status: string },
    index: number,
    context: ActionExecutionContext
  ): Promise<Record<string, unknown>> {
    // Simulate step execution with complexity-based timing
    const complexity = this.estimateStepComplexity(step.description);
    const executionTime = Math.min(complexity * 1000, 10000); // Max 10 seconds per step

    await new Promise(resolve => setTimeout(resolve, executionTime));

    return {
      stepIndex: index,
      description: step.description,
      executionTime,
      complexity,
      status: 'completed',
      timestamp: new Date(),
      metadata: {
        contextId: context.actionId,
        estimatedComplexity: complexity
      }
    };
  }

  private async processResults(
    action: ImprovementAction,
    rawResults: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Process and enhance raw results
    const processedResults = {
      ...rawResults,
      processingMetadata: {
        actionId: action.id,
        targetArea: action.targetArea,
        priority: action.priority,
        expectedImpact: action.expectedImpact,
        difficulty: action.difficulty,
        processedAt: new Date()
      },
      qualityMetrics: {
        completeness: this.calculateCompleteness(rawResults),
        consistency: this.calculateConsistency(rawResults),
        reliability: this.calculateReliability(rawResults)
      }
    };

    return processedResults;
  }

  private async generateNextSteps(
    action: ImprovementAction,
    results: Record<string, unknown>
  ): Promise<string[]> {
    const nextSteps: string[] = [];

    // Generate next steps based on action target area
    switch (action.targetArea) {
      case 'tools':
        nextSteps.push('Monitor tool performance metrics');
        nextSteps.push('Gather user feedback on tool improvements');
        break;
      case 'planning':
        nextSteps.push('Evaluate planning efficiency improvements');
        nextSteps.push('Update planning templates and strategies');
        break;
      case 'learning':
        nextSteps.push('Assess learning outcome improvements');
        nextSteps.push('Update learning algorithms and strategies');
        break;
      case 'knowledge':
        nextSteps.push('Validate knowledge base enhancements');
        nextSteps.push('Monitor knowledge retrieval performance');
        break;
      case 'execution':
        nextSteps.push('Monitor execution performance metrics');
        nextSteps.push('Evaluate execution strategy effectiveness');
        break;
      case 'interaction':
        nextSteps.push('Gather user interaction feedback');
        nextSteps.push('Monitor interaction quality metrics');
        break;
    }

    // Add generic next steps
    nextSteps.push('Document lessons learned');
    nextSteps.push('Schedule follow-up impact assessment');

    return nextSteps;
  }

  private async calculateImpactAssessment(
    actionId: string,
    result: ActionProcessingResult
  ): Promise<ImpactAssessment> {
    // Simulate impact measurement delay
    await new Promise(resolve => setTimeout(resolve, this.config.impactMeasurementDelay));

    const qualityMetrics = result.results.qualityMetrics as Record<string, number> || {};

    return {
      actionId,
      assessedAt: new Date(),
      overallImpact: (qualityMetrics.completeness || 0.7) * 0.4 + 
                     (qualityMetrics.consistency || 0.8) * 0.3 + 
                     (qualityMetrics.reliability || 0.75) * 0.3,
      impactAreas: {
        performance: qualityMetrics.reliability || 0.75,
        quality: qualityMetrics.completeness || 0.7,
        efficiency: qualityMetrics.consistency || 0.8,
        userSatisfaction: 0.8 // Simulated
      },
      metrics: {
        executionTime: result.executionTime,
        successRate: result.success ? 1.0 : 0.0,
        qualityScore: Object.values(qualityMetrics).reduce((a, b) => a + b, 0) / Object.keys(qualityMetrics).length || 0.75
      },
      confidence: 0.85,
      recommendations: [
        'Continue monitoring impact metrics',
        'Consider scaling successful improvements',
        'Document best practices for future actions'
      ]
    };
  }

  private generateSummary(
    result: ActionProcessingResult,
    progress?: ActionProgress,
    impact?: ImpactAssessment
  ): string {
    let summary = `Action ${result.actionId} `;
    
    if (result.success) {
      summary += `completed successfully in ${result.executionTime}ms`;
      if (impact) {
        summary += ` with ${(impact.overallImpact * 100).toFixed(1)}% overall impact`;
      }
    } else {
      summary += `failed with error: ${result.error}`;
    }

    if (progress) {
      summary += `. Progress: ${progress.completedSteps}/${progress.totalSteps} steps completed`;
    }

    return summary;
  }

  private async generateRecommendations(
    actionId: string,
    result: ActionProcessingResult,
    impact?: ImpactAssessment
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (result.success) {
      recommendations.push('Document successful implementation approach');
      
      if (impact && impact.overallImpact > 0.8) {
        recommendations.push('Consider replicating this approach for similar actions');
      }
      
      if (result.executionTime < this.config.defaultTimeout * 0.5) {
        recommendations.push('Action completed efficiently - consider increasing scope for future similar actions');
      }
    } else {
      recommendations.push('Analyze failure causes and update implementation strategy');
      recommendations.push('Consider breaking down into smaller, more manageable actions');
    }

    // Add next steps as recommendations
    recommendations.push(...result.nextSteps);

    return recommendations;
  }

  private calculateEstimatedCompletion(action: ImprovementAction): Date {
    const baseTime = this.config.defaultTimeout;
    const difficultyMultiplier = action.difficulty || 0.5;
    const stepCount = action.implementationSteps?.length || 1;
    
    const estimatedTime = baseTime * difficultyMultiplier * Math.log(stepCount + 1);
    return new Date(Date.now() + estimatedTime);
  }

  private estimateStepComplexity(description: string): number {
    // Simple complexity estimation based on description length and keywords
    const baseComplexity = Math.min(description.length / 100, 1.0);
    const complexityKeywords = ['analyze', 'design', 'implement', 'test', 'deploy', 'monitor'];
    const keywordBonus = complexityKeywords.filter(keyword => 
      description.toLowerCase().includes(keyword)
    ).length * 0.1;
    
    return Math.min(baseComplexity + keywordBonus, 1.0);
  }

  private calculateCompleteness(results: Record<string, unknown>): number {
    // Calculate completeness based on result structure and content
    const resultKeys = Object.keys(results);
    const expectedMinKeys = 3; // Minimum expected result keys
    
    return Math.min(resultKeys.length / expectedMinKeys, 1.0);
  }

  private calculateConsistency(results: Record<string, unknown>): number {
    // Calculate consistency based on result patterns
    const stepResults = Object.keys(results).filter(key => key.startsWith('step_'));
    if (stepResults.length === 0) return 0.8; // Default for non-step results
    
    // Check if all steps have similar structure
    const firstStepKeys = Object.keys(results[stepResults[0]] as Record<string, unknown> || {});
    const consistentSteps = stepResults.filter(stepKey => {
      const stepResult = results[stepKey] as Record<string, unknown> || {};
      const stepKeys = Object.keys(stepResult);
      return firstStepKeys.every(key => stepKeys.includes(key));
    });
    
    return consistentSteps.length / stepResults.length;
  }

  private calculateReliability(results: Record<string, unknown>): number {
    // Calculate reliability based on error rates and completion status
    const stepResults = Object.keys(results).filter(key => key.startsWith('step_'));
    if (stepResults.length === 0) return 0.9; // Default for non-step results
    
    const successfulSteps = stepResults.filter(stepKey => {
      const stepResult = results[stepKey] as Record<string, unknown> || {};
      return stepResult.status === 'completed';
    });
    
    return successfulSteps.length / stepResults.length;
  }

  private initializeMetrics(): void {
    this.metrics.set('actionsProcessed', 0);
    this.metrics.set('actionsFailed', 0);
    this.metrics.set('actionsCancelled', 0);
    this.metrics.set('totalExecutionTime', 0);
  }

  private updateMetrics(key: string, value: number): void {
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + value);
  }
} 