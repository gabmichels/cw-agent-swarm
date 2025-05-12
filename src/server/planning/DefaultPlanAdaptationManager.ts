import { v4 as uuidv4 } from 'uuid';
import { TaskLogger } from '../../agents/chloe/task-logger';
import { 
  PlanAdaptationManager,
  PlanAdaptationRequest,
  PlanAdaptationResult,
  PlanOptimizationRequest,
  PlanOptimizationResult,
  PlanValidationRequest,
  PlanValidationResult,
  PlanAdaptationReason,
  PlanAdaptationType
} from '../../lib/shared/types/planning';
import {
  PlanWithSteps,
  BaseManagerOptions,
  ToolExecutionResult,
  PlanStep as BasePlanStep
} from '../../lib/shared/types/agentTypes';
import {
  ExtendedPlanStep,
  TaskStatus,
  PlanAdaptationMetrics,
  PlanOptimizationMetrics,
  OptimizationGoal,
  PriorityChange,
  ResourceConstraints,
  NewInformation,
  AdaptationContext,
  AdaptationStrategy,
  OptimizationResult,
  ValidationRule,
  ValidationIssue,
  ValidationResult,
  ResourceLimits,
  StepGroup,
  StepMetrics,
  StepOptimizationResult,
  PlanOptimizationContext,
  PlanAdaptationContext
} from '../../lib/shared/types/planAdaptation';
import { TaskStatus as BaseTaskStatus } from '../../constants/task';

/**
 * Options for initializing the plan adaptation manager
 */
export interface PlanAdaptationManagerOptions extends BaseManagerOptions {
  logger?: TaskLogger;
  maxAdaptationAttempts?: number;
  maxOptimizationTime?: number;
  enableMetrics?: boolean;
  adaptationHistorySize?: number;
  optimizationHistorySize?: number;
}

/**
 * Internal config type for the manager
 */
type PlanAdaptationManagerConfig = {
  agentId: string;
  logger: TaskLogger;
  maxAdaptationAttempts: number;
  maxOptimizationTime: number;
  enableMetrics: boolean;
  adaptationHistorySize: number;
  optimizationHistorySize: number;
};

/**
 * Default implementation of the PlanAdaptationManager interface
 */
export class DefaultPlanAdaptationManager implements PlanAdaptationManager {
  private initialized: boolean = false;
  private logger: TaskLogger;
  private config: PlanAdaptationManagerConfig;
  private adaptationHistory: Map<string, PlanAdaptationResult[]>;
  private optimizationHistory: Map<string, PlanOptimizationResult[]>;
  private metrics: {
    totalAdaptations: number;
    successfulAdaptations: number;
    totalOptimizations: number;
    successfulOptimizations: number;
    totalAdaptationTime: number;
    totalOptimizationTime: number;
  };
  private currentPlan: PlanWithSteps | null = null;
  private dependencyGraph: Map<string, Set<string>> = new Map();

  constructor(options: PlanAdaptationManagerOptions) {
    if (!options.agentId) {
      throw new Error('agentId is required for PlanAdaptationManager');
    }
    this.logger = options.logger || new TaskLogger();
    this.config = {
      agentId: options.agentId,
      logger: this.logger,
      maxAdaptationAttempts: options.maxAdaptationAttempts ?? 3,
      maxOptimizationTime: options.maxOptimizationTime ?? 5000,
      enableMetrics: options.enableMetrics ?? true,
      adaptationHistorySize: options.adaptationHistorySize ?? 100,
      optimizationHistorySize: options.optimizationHistorySize ?? 100
    };
    this.adaptationHistory = new Map();
    this.optimizationHistory = new Map();
    this.metrics = {
      totalAdaptations: 0,
      successfulAdaptations: 0,
      totalOptimizations: 0,
      successfulOptimizations: 0,
      totalAdaptationTime: 0,
      totalOptimizationTime: 0
    };
  }

  /**
   * Initialize the plan adaptation manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.logAction('Initializing plan adaptation manager');
      this.initialized = true;
      this.logger.logAction('Plan adaptation manager initialized successfully');
    } catch (error) {
      this.logger.logAction('Error initializing plan adaptation manager', { error: String(error) });
      throw error;
    }
  }

  /**
   * Shutdown and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      this.logger.logAction('Shutting down plan adaptation manager');
      this.initialized = false;
      this.logger.logAction('Plan adaptation manager shutdown complete');
    } catch (error) {
      this.logger.logAction('Error during plan adaptation manager shutdown', { error: String(error) });
      throw error;
    }
  }

  /**
   * Adapt a plan based on the given request
   */
  async adaptPlan(request: PlanAdaptationRequest): Promise<PlanAdaptationResult> {
    if (!this.initialized) {
      throw new Error('Plan adaptation manager not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalAdaptations++;

    try {
      this.logger.logAction('Adapting plan', { 
        planId: request.plan.goal,
        reason: request.reason 
      });

      // Validate the plan first
      const validationResult = await this.validatePlan({
        plan: request.plan,
        validationRules: [
          {
            type: 'DEPENDENCY',
            rule: 'No circular dependencies',
            severity: 'ERROR'
          },
          {
            type: 'RESOURCE',
            rule: 'Resource constraints must be satisfied',
            severity: 'WARNING'
          }
        ]
      });

      if (!validationResult.valid) {
        throw new Error(`Plan validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      // Determine adaptation strategy based on reason
      const adaptationStrategy = this.determineAdaptationStrategy(request);
      
      // Apply the adaptation
      const adaptedSteps = await this.performAdaptation(this.convertToExtendedPlanSteps(request.plan.steps), request);
      const adaptedPlan = this.toPlanWithSteps(adaptedSteps, request.plan.goal, request.plan.reasoning);
      
      // Validate the adapted plan with the same rules
      const adaptedValidationResult = await this.validatePlan({
        plan: adaptedPlan,
        validationRules: [
          {
            type: 'DEPENDENCY',
            rule: 'No circular dependencies',
            severity: 'ERROR'
          },
          {
            type: 'RESOURCE',
            rule: 'Resource constraints must be satisfied',
            severity: 'WARNING'
          }
        ]
      });

      if (!adaptedValidationResult.valid) {
        throw new Error(`Adapted plan validation failed: ${adaptedValidationResult.errors.map(e => e.message).join(', ')}`);
      }

      // Record the adaptation
      const result: PlanAdaptationResult = {
        success: true,
        adaptedPlan,
        changes: adaptationStrategy.changes,
        metrics: this.calculateAdaptationMetrics(request.plan, adaptedPlan)
      };

      // Update history
      this.updateAdaptationHistory(request.plan.goal, result);
      
      // Update metrics
      const endTime = Date.now();
      this.metrics.totalAdaptationTime += (endTime - startTime);
      this.metrics.successfulAdaptations++;

      this.logger.logAction('Plan adaptation completed successfully', {
        planId: request.plan.goal,
        changes: adaptationStrategy.changes.length,
        confidence: result.metrics.confidence
      });

      return result;
    } catch (error) {
      this.logger.logAction('Error adapting plan', { 
        planId: request.plan.goal,
        error: String(error)
      });

      return {
        success: false,
        adaptedPlan: request.plan,
        changes: [],
        metrics: this.calculateAdaptationMetrics(request.plan, request.plan),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Optimize a plan based on the given request
   */
  async optimizePlan(request: PlanOptimizationRequest): Promise<PlanOptimizationResult> {
    if (!this.initialized) {
      throw new Error('Plan optimization manager not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalOptimizations++;

    try {
      this.logger.logAction('Optimizing plan', { 
        planId: request.plan.goal,
        goals: request.optimizationGoals.map(g => g.type)
      });

      // Validate the plan first
      const validationResult = await this.validatePlan({
        plan: request.plan,
        validationRules: [
          {
            type: 'DEPENDENCY',
            rule: 'No circular dependencies',
            severity: 'ERROR'
          }
        ]
      });

      if (!validationResult.valid) {
        throw new Error(`Plan validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      // Apply optimization strategies based on goals
      const optimizedSteps = await this.performOptimization(this.convertToExtendedPlanSteps(request.plan.steps), request);
      const optimizedPlan = this.toPlanWithSteps(optimizedSteps, request.plan.goal, request.plan.reasoning);
      
      // Calculate improvements
      const improvements = this.calculateImprovements(request.plan, optimizedPlan, request.optimizationGoals);
      
      // Record the optimization
      const result: PlanOptimizationResult = {
        success: true,
        optimizedPlan,
        improvements,
        metrics: this.calculateOptimizationMetrics(request.plan, optimizedPlan)
      };

      // Update history
      this.updateOptimizationHistory(request.plan.goal, result);
      
      // Update metrics
      this.metrics.totalOptimizationTime += (Date.now() - startTime);
      this.metrics.successfulOptimizations++;

      this.logger.logAction('Plan optimization completed successfully', {
        planId: request.plan.goal,
        improvements: improvements.length,
        reliabilityScore: result.metrics.reliabilityScore
      });

      return result;
    } catch (error) {
      this.logger.logAction('Error optimizing plan', { 
        planId: request.plan.goal,
        error: String(error)
      });

      return {
        success: false,
        optimizedPlan: request.plan,
        improvements: [],
        metrics: this.calculateOptimizationMetrics(request.plan, request.plan),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate a plan based on the given request
   */
  async validatePlan(request: PlanValidationRequest): Promise<PlanValidationResult> {
    if (!this.initialized) {
      throw new Error('Plan validation manager not initialized');
    }

    try {
      this.logger.logAction('Validating plan', { 
        planId: request.plan.goal,
        ruleCount: request.validationRules.length
      });

      const errors: PlanValidationResult['errors'] = [];
      const warnings: PlanValidationResult['warnings'] = [];

      // Check each validation rule
      for (const rule of request.validationRules) {
        const validationResult = await this.validateRule(request.plan, rule);
        
        if (validationResult.errors.length > 0) {
          errors.push(...validationResult.errors);
        }
        
        if (validationResult.warnings.length > 0) {
          warnings.push(...validationResult.warnings);
        }
      }

      const result: PlanValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings
      };

      this.logger.logAction('Plan validation completed', {
        planId: request.plan.goal,
        valid: result.valid,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return result;
    } catch (error) {
      this.logger.logAction('Error validating plan', { 
        planId: request.plan.goal,
        error: String(error)
      });

      return {
        valid: false,
        errors: [{
          type: 'LOGIC',
          rule: 'Validation failed',
          severity: 'ERROR',
          message: error instanceof Error ? error.message : String(error),
          affectedSteps: []
        }],
        warnings: []
      };
    }
  }

  /**
   * Check if a plan can be adapted for the given reason
   */
  async canAdaptPlan(plan: PlanWithSteps, reason: PlanAdaptationReason): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Plan adaptation manager not initialized');
    }

    try {
      // Check if we've exceeded max adaptation attempts
      const history = this.adaptationHistory.get(plan.goal) || [];
      if (history.length >= this.config.maxAdaptationAttempts) {
        return false;
      }

      // Check if the plan is valid for adaptation
      const validationResult = await this.validatePlan({
        plan,
        validationRules: [
          {
            type: 'LOGIC',
            rule: 'Plan must be valid for adaptation',
            severity: 'ERROR'
          }
        ]
      });

      return validationResult.valid;
    } catch (error) {
      this.logger.logAction('Error checking plan adaptation possibility', {
        planId: plan.goal,
        error: String(error)
      });
      return false;
    }
  }

  /**
   * Check if a plan can be optimized
   */
  async canOptimizePlan(plan: PlanWithSteps): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Plan optimization manager not initialized');
    }

    try {
      // Check if the plan is valid for optimization
      const validationResult = await this.validatePlan({
        plan,
        validationRules: [
          {
            type: 'LOGIC',
            rule: 'Plan must be valid for optimization',
            severity: 'ERROR'
          }
        ]
      });

      return validationResult.valid;
    } catch (error) {
      this.logger.logAction('Error checking plan optimization possibility', {
        planId: plan.goal,
        error: String(error)
      });
      return false;
    }
  }

  /**
   * Get adaptation history for a plan
   */
  async getAdaptationHistory(planId: string): Promise<PlanAdaptationResult[]> {
    return this.adaptationHistory.get(planId) || [];
  }

  /**
   * Get optimization history for a plan
   */
  async getOptimizationHistory(planId: string): Promise<PlanOptimizationResult[]> {
    return this.optimizationHistory.get(planId) || [];
  }

  /**
   * Get metrics for the plan adaptation manager
   */
  async getMetrics(): Promise<{
    totalAdaptations: number;
    successfulAdaptations: number;
    totalOptimizations: number;
    successfulOptimizations: number;
    averageAdaptationTime: number;
    averageOptimizationTime: number;
  }> {
    return {
      totalAdaptations: this.metrics.totalAdaptations,
      successfulAdaptations: this.metrics.successfulAdaptations,
      totalOptimizations: this.metrics.totalOptimizations,
      successfulOptimizations: this.metrics.successfulOptimizations,
      averageAdaptationTime: this.metrics.totalAdaptations > 0 
        ? this.metrics.totalAdaptationTime / this.metrics.totalAdaptations 
        : 0,
      averageOptimizationTime: this.metrics.totalOptimizations > 0
        ? this.metrics.totalOptimizationTime / this.metrics.totalOptimizations
        : 0
    };
  }

  // Private helper methods

  private determineAdaptationStrategy(request: PlanAdaptationRequest): {
    changes: Array<{
      type: PlanAdaptationType;
      description: string;
      affectedSteps: string[];
      reason: string;
    }>;
  } {
    const changes: Array<{
      type: PlanAdaptationType;
      description: string;
      affectedSteps: string[];
      reason: string;
    }> = [];

    switch (request.reason) {
      case 'STEP_FAILURE':
        if (request.context.failedStepId) {
          changes.push({
            type: 'REPLACE',
            description: 'Replace failed step with alternative approach',
            affectedSteps: [request.context.failedStepId],
            reason: 'Step execution failed'
          });
        }
        break;

      case 'RESOURCE_CONSTRAINT':
        if (request.context.resourceConstraints) {
          changes.push({
            type: 'OPTIMIZE',
            description: 'Optimize steps for resource constraints',
            affectedSteps: request.plan.steps.map(s => s.id),
            reason: 'Resource constraints require optimization'
          });
        }
        break;

      case 'NEW_INFORMATION':
        if (request.context.newInformation) {
          changes.push({
            type: 'ADD',
            description: 'Add steps based on new information',
            affectedSteps: [],
            reason: 'New information requires additional steps'
          });
        }
        break;

      // Add cases for other adaptation reasons
    }

    return { changes };
  }

  private async performAdaptation(
    steps: ExtendedPlanStep[],
    request: PlanAdaptationRequest
  ): Promise<ExtendedPlanStep[]> {
    let adaptedSteps = [...steps];

    switch (request.reason) {
      case 'STEP_FAILURE':
        if (request.context.failedStepId) {
          adaptedSteps = this.handleStepFailure(adaptedSteps, [{
            stepId: request.context.failedStepId,
            error: 'Step execution failed'
          }]);
        }
        break;
      case 'RESOURCE_CONSTRAINT':
        if (request.context.resourceConstraints) {
          adaptedSteps = this.handleResourceConstraint(adaptedSteps, {
            maxMemory: request.context.resourceConstraints.memoryAvailable,
            maxCpu: request.context.resourceConstraints.cpuAvailable,
            maxConcurrentSteps: Math.floor((request.context.resourceConstraints.timeRemaining || 0) / 1000)
          });
        }
        break;
      case 'NEW_INFORMATION':
        if (request.context.newInformation) {
          adaptedSteps = this.handleNewInformation(adaptedSteps, {
            type: request.context.newInformation.source,
            data: request.context.newInformation.content
          });
        }
        break;
      case 'OPTIMIZATION': {
        const optimizationGoals: OptimizationGoal[] = [];
        if (Array.isArray(request.context.priorityChanges)) {
          for (const change of request.context.priorityChanges) {
            const priority = typeof change.priority === 'number' ? change.priority : 0;
            optimizationGoals.push({
              type: priority > 0.8 ? 'TIME' : 'RELIABILITY',
              targetTime: priority > 0.8 ? 1000 : undefined,
              resourceLimits: {
                maxMemory: request.context.resourceConstraints?.memoryAvailable,
                maxCpu: request.context.resourceConstraints?.cpuAvailable
              }
            });
          }
        }
        adaptedSteps = await this.performOptimization(adaptedSteps, {
          plan: this.toPlanWithSteps(adaptedSteps, request.plan.goal, request.plan.reasoning),
          optimizationGoals
        });
        break;
      }
    }

    return adaptedSteps;
  }

  private async performOptimization(
    steps: ExtendedPlanStep[],
    request: { plan: PlanWithSteps; optimizationGoals: OptimizationGoal[] }
  ): Promise<ExtendedPlanStep[]> {
    let optimizedSteps = [...steps];

    // Apply optimizations based on goals
    for (const goal of request.optimizationGoals) {
      const plan = this.toPlanWithSteps(optimizedSteps, request.plan.goal, request.plan.reasoning);
      const optimizedPlanOrSteps: PlanWithSteps | ExtendedPlanStep[] = await (async (): Promise<PlanWithSteps | ExtendedPlanStep[]> => {
        switch (goal.type) {
          case 'TIME':
            return this.optimizeForTime(plan, goal.targetTime);
          case 'EFFICIENCY':
            return this.optimizeForEfficiency(plan);
          case 'RESOURCE':
            return this.optimizeForResources(plan, goal.resourceLimits);
          case 'RELIABILITY':
            return this.optimizeForReliability(plan);
        }
        return plan;
      })();
      if (Array.isArray(optimizedPlanOrSteps)) {
        optimizedSteps = optimizedPlanOrSteps;
      } else if (optimizedPlanOrSteps && 'steps' in optimizedPlanOrSteps) {
        optimizedSteps = this.convertToExtendedPlanSteps(optimizedPlanOrSteps.steps);
      }
    }
    return optimizedSteps;
  }

  private handleStepFailure(
    steps: ExtendedPlanStep[],
    failedSteps: { stepId: string; error: string }[]
  ): ExtendedPlanStep[] {
    return steps.map(step => {
      const failure = failedSteps.find(f => f.stepId === step.id);
      if (!failure) return step;

      return {
        ...step,
        parameters: {
          ...step.parameters,
          retryPolicy: {
            maxRetries: 3,
            backoff: 'exponential'
          },
          fallbackAction: {
            type: 'SKIP_AND_CONTINUE',
            notifyOnFailure: true
          }
        }
      };
    });
  }

  private handleResourceConstraint(
    steps: ExtendedPlanStep[],
    constraints: { maxMemory?: number; maxCpu?: number; maxConcurrentSteps?: number }
  ): ExtendedPlanStep[] {
    return this.balanceResourceUsage(steps, constraints);
  }

  private handleNewInformation(
    steps: ExtendedPlanStep[],
    newInfo: { type: string; data: any }
  ): ExtendedPlanStep[] {
    // Update steps based on new information
    return steps.map(step => ({
      ...step,
      parameters: {
        ...step.parameters,
        updatedInfo: newInfo
      }
    }));
  }

  private async applyAdaptation(
    plan: PlanWithSteps,
    strategy: { changes: Array<{ type: PlanAdaptationType; description: string; affectedSteps: string[]; reason: string; }> }
  ): Promise<PlanWithSteps> {
    let adaptedPlan = { ...plan };

    for (const change of strategy.changes) {
      switch (change.type) {
        case 'REORDER':
          adaptedPlan = this.reorderSteps(adaptedPlan, change.affectedSteps);
          break;
        case 'REPLACE':
          adaptedPlan = await this.replaceSteps(adaptedPlan, change.affectedSteps);
          break;
        case 'ADD':
          adaptedPlan = await this.addSteps(adaptedPlan);
          break;
        case 'REMOVE':
          adaptedPlan = this.removeSteps(adaptedPlan, change.affectedSteps);
          break;
        case 'MERGE':
          adaptedPlan = this.mergeSteps(adaptedPlan, change.affectedSteps);
          break;
        case 'SPLIT':
          adaptedPlan = this.splitSteps(adaptedPlan, change.affectedSteps);
          break;
        case 'OPTIMIZE':
          adaptedPlan = await this.optimizeSteps(adaptedPlan, change.affectedSteps);
          break;
        case 'RESTRUCTURE':
          adaptedPlan = await this.restructurePlan(adaptedPlan);
          break;
      }
    }

    return adaptedPlan;
  }

  private async applyOptimizations(request: PlanOptimizationRequest): Promise<PlanWithSteps> {
    let optimizedPlan = { ...request.plan };

    // Sort optimization goals by priority
    const sortedGoals = [...request.optimizationGoals].sort((a, b) => b.priority - a.priority);

    for (const goal of sortedGoals) {
      switch (goal.type) {
        case 'TIME':
          const timeOptimizedSteps = await this.optimizeForTime(optimizedPlan, goal.target);
          optimizedPlan = this.toPlanWithSteps(timeOptimizedSteps, optimizedPlan.goal, optimizedPlan.reasoning);
          break;
        case 'RESOURCE':
          optimizedPlan = await this.optimizeForResources(optimizedPlan, request.constraints?.resourceLimits);
          break;
        case 'RELIABILITY':
          optimizedPlan = await this.optimizeForReliability(optimizedPlan);
          break;
        case 'EFFICIENCY':
          optimizedPlan = await this.optimizeForEfficiency(optimizedPlan);
          break;
      }
    }

    return optimizedPlan;
  }

  private async validateRule(
    plan: PlanWithSteps,
    rule: PlanValidationRequest['validationRules'][0]
  ): Promise<{ errors: PlanValidationResult['errors']; warnings: PlanValidationResult['warnings'] }> {
    const errors: PlanValidationResult['errors'] = [];
    const warnings: PlanValidationResult['warnings'] = [];

    switch (rule.type) {
      case 'DEPENDENCY':
        const dependencyIssues = this.validateDependencies(plan);
        if (dependencyIssues.length > 0) {
          if (rule.severity === 'ERROR') {
            errors.push(...dependencyIssues.map(issue => ({
              type: rule.type,
              rule: rule.rule,
              severity: rule.severity,
              message: issue,
              affectedSteps: []
            })));
          } else {
            warnings.push(...dependencyIssues.map(issue => ({
              type: rule.type,
              rule: rule.rule,
              severity: rule.severity,
              message: issue,
              affectedSteps: []
            })));
          }
        }
        break;

      case 'RESOURCE':
        const resourceIssues = await this.validateResources(plan);
        if (resourceIssues.length > 0) {
          if (rule.severity === 'ERROR') {
            errors.push(...resourceIssues.map(issue => ({
              type: rule.type,
              rule: rule.rule,
              severity: rule.severity,
              message: issue,
              affectedSteps: []
            })));
          } else {
            warnings.push(...resourceIssues.map(issue => ({
              type: rule.type,
              rule: rule.rule,
              severity: rule.severity,
              message: issue,
              affectedSteps: []
            })));
          }
        }
        break;

      // Add cases for other validation types
    }

    return { errors, warnings };
  }

  // Implementation of specific adaptation methods
  private reorderSteps(plan: PlanWithSteps, affectedSteps: string[]): PlanWithSteps {
    // Implementation for reordering steps
    return plan;
  }

  private async replaceSteps(plan: PlanWithSteps, affectedSteps: string[]): Promise<PlanWithSteps> {
    // Implementation for replacing steps
    return plan;
  }

  private async addSteps(plan: PlanWithSteps): Promise<PlanWithSteps> {
    // Implementation for adding steps
    return plan;
  }

  private removeSteps(plan: PlanWithSteps, affectedSteps: string[]): PlanWithSteps {
    // Implementation for removing steps
    return plan;
  }

  private mergeSteps(plan: PlanWithSteps, affectedSteps: string[]): PlanWithSteps {
    // Implementation for merging steps
    return plan;
  }

  private splitSteps(plan: PlanWithSteps, affectedSteps: string[]): PlanWithSteps {
    // Implementation for splitting steps
    return plan;
  }

  private async optimizeSteps(plan: PlanWithSteps, affectedSteps: string[]): Promise<PlanWithSteps> {
    // Implementation for optimizing steps
    return plan;
  }

  private async restructurePlan(plan: PlanWithSteps): Promise<PlanWithSteps> {
    // Implementation for restructuring the entire plan
    return plan;
  }

  // Implementation of specific optimization methods
  private async optimizeForTime(plan: PlanWithSteps, targetTime?: number): Promise<ExtendedPlanStep[]> {
    const steps = this.convertToExtendedPlanSteps(plan.steps);
    const optimizedSteps = this.reduceStepExecutionTime(steps, targetTime || 0);
    return optimizedSteps;
  }

  private async optimizeForEfficiency(plan: PlanWithSteps): Promise<PlanWithSteps> {
    const steps = this.convertToExtendedPlanSteps(plan.steps);
    const optimizedSteps = this.reorderForEfficiency(
      this.removeRedundantSteps(
        this.optimizeStepParameters(steps)
      )
    );
    return this.toPlanWithSteps(optimizedSteps, plan.goal, plan.reasoning);
  }

  private async optimizeForResources(
    plan: PlanWithSteps,
    resourceLimits?: { maxMemory?: number; maxCpu?: number; maxConcurrentSteps?: number }
  ): Promise<PlanWithSteps> {
    const steps = this.convertToExtendedPlanSteps(plan.steps);
    const optimizedSteps = this.balanceResourceUsage(steps, resourceLimits);
    return this.toPlanWithSteps(optimizedSteps, plan.goal, plan.reasoning);
  }

  private async optimizeForReliability(plan: PlanWithSteps): Promise<PlanWithSteps> {
    const steps = this.convertToExtendedPlanSteps(plan.steps);
    const optimizedSteps = this.addRetryLogic(
      this.addValidationSteps(
        this.addFallbackOptions(steps)
      )
    );
    return this.toPlanWithSteps(optimizedSteps, plan.goal, plan.reasoning);
  }

  private optimizeStepParameters(steps: ExtendedPlanStep[]): ExtendedPlanStep[] {
    return steps.map(step => {
      const params = { ...step.parameters };
      
      // Optimize based on step type
      switch (step.type) {
        case 'API_CALL':
          params.batchSize = Math.min((params.batchSize as number) || 100, 50);
          params.timeout = Math.max((params.timeout as number) || 5000, 1000);
          break;
        case 'DATA_PROCESSING':
          params.bufferSize = Math.min((params.bufferSize as number) || 1024 * 1024, 512 * 1024);
          params.compression = true;
          break;
        case 'MEMORY_OPERATION':
          params.cacheSize = Math.min((params.cacheSize as number) || 100 * 1024 * 1024, 50 * 1024 * 1024);
          params.evictionPolicy = 'LRU';
          break;
      }

      return { ...step, parameters: params };
    });
  }

  private balanceResourceUsage(
    steps: ExtendedPlanStep[],
    limits?: { maxMemory?: number; maxCpu?: number; maxConcurrentSteps?: number }
  ): ExtendedPlanStep[] {
    const maxMemory = limits?.maxMemory || Number.MAX_SAFE_INTEGER;
    const maxCpu = limits?.maxCpu || Number.MAX_SAFE_INTEGER;
    const maxConcurrent = limits?.maxConcurrentSteps || Number.MAX_SAFE_INTEGER;

    return steps.map(step => {
      const params = { ...step.parameters };
      const memoryUsage = this.estimateMemoryUsage(step);
      const cpuUsage = this.estimateCpuUsage(step);
      const concurrency = (params.concurrency as number) || 1;

      if (memoryUsage > maxMemory) {
        params.bufferSize = Math.floor(maxMemory / 2);
        params.compression = true;
      }

      if (cpuUsage > maxCpu) {
        params.batchSize = Math.max(1, Math.floor((params.batchSize as number) || 100 / 2));
        params.parallelProcessing = false;
      }

      if (concurrency > maxConcurrent) {
        params.concurrency = maxConcurrent;
        params.coordinationStrategy = 'sequential';
      }

      return { ...step, parameters: params };
    });
  }

  private reduceStepExecutionTime(steps: ExtendedPlanStep[], targetTime: number): ExtendedPlanStep[] {
    const currentTime = this.calculateTotalTime(this.toPlanWithSteps(steps));
    if (currentTime <= targetTime) return steps;
    
    const timeReduction = currentTime - targetTime;
    const stepsByTime = [...steps].sort((a, b) => 
      (this.estimateStepTime(b) - this.estimateStepTime(a))
    );
    
    return stepsByTime.map(step => {
      const stepTime = this.estimateStepTime(step);
      const reductionRatio = timeReduction / currentTime;
      const newTime = Math.max(stepTime * (1 - reductionRatio), this.getMinStepTime(step));
      
      return this.optimizeStepForTime(step, newTime);
    });
  }

  // Helper methods for time optimization
  private groupParallelSteps(steps: ExtendedPlanStep[]): ExtendedPlanStep[][] {
    const groups: ExtendedPlanStep[][] = [];
    const visited = new Set<string>();
    const graph = new Map<string, Set<string>>();
    
    // Build dependency graph
    steps.forEach(step => {
      graph.set(step.id, new Set(step.dependencies || []));
    });
    
    // Find parallel groups
    steps.forEach(step => {
      if (visited.has(step.id)) return;
      
      const group: ExtendedPlanStep[] = [step];
      visited.add(step.id);
      
      steps.forEach(otherStep => {
        if (visited.has(otherStep.id)) return;
        
        const canParallelize = !this.hasDependencyPath(graph, step.id, otherStep.id) &&
                              !this.hasDependencyPath(graph, otherStep.id, step.id);
        
        if (canParallelize) {
          group.push(otherStep);
          visited.add(otherStep.id);
        }
      });
      
      if (group.length > 0) {
        groups.push(group);
      }
    });
    
    return groups;
  }

  private parallelizeSteps(groups: ExtendedPlanStep[][]): ExtendedPlanStep[] {
    return groups.map(group => {
      if (group.length === 1) return group[0];
      
      const parallelStep: ExtendedPlanStep = {
        id: `parallel_${group.map(s => s.id).join('_')}`,
        type: 'PARALLEL',
        description: `Parallel execution of ${group.length} steps`,
        status: TaskStatus.PENDING,
        parameters: {
          steps: group,
          maxConcurrent: this.calculateOptimalConcurrency(group)
        },
        dependencies: this.getUniqueDependencies(group)
      };
      
      return parallelStep;
    });
  }

  private orderStepsByEfficiency(steps: ExtendedPlanStep[]): ExtendedPlanStep[] {
    return [...steps].sort((a, b) => {
      // Compare weights first
      const weightA = this.calculateStepWeight(a);
      const weightB = this.calculateStepWeight(b);
      if (weightA !== weightB) {
        return weightB - weightA; // Higher weight first
      }

      // Then compare dependency counts
      const depsA = a.dependencies?.length || 0;
      const depsB = b.dependencies?.length || 0;
      if (depsA !== depsB) {
        return depsA - depsB; // Fewer dependencies first
      }

      // Finally compare estimated times
      const timeA = a.estimatedTime || 0;
      const timeB = b.estimatedTime || 0;
      return timeA - timeB; // Shorter time first
    });
  }

  private mergeShortSequentialSteps(steps: ExtendedPlanStep[]): ExtendedPlanStep[] {
    const mergedSteps: ExtendedPlanStep[] = [];
    let currentGroup: ExtendedPlanStep[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      const currentStep = steps[i];
      const nextStep = steps[i + 1];
      
      if (nextStep && this.canMergeSteps(currentStep, nextStep)) {
        currentGroup.push(currentStep);
      } else {
        if (currentGroup.length > 0) {
          currentGroup.push(currentStep);
          mergedSteps.push(this.mergeStepGroup(currentGroup));
          currentGroup = [];
        } else {
          mergedSteps.push(currentStep);
        }
      }
    }
    
    return mergedSteps;
  }

  private optimizeStepForTime(step: ExtendedPlanStep, targetTime?: number): ExtendedPlanStep {
    if (!targetTime) return step;

    const optimizedStep = { ...step };
    const currentTime = this.estimateStepTime(step);

    if (typeof currentTime !== 'number' || typeof targetTime !== 'number' || currentTime === 0) return step;
    if (currentTime > targetTime) {
      const batchSize = typeof step.parameters?.batchSize === 'number' ? step.parameters.batchSize : 1;
      optimizedStep.parameters = {
        ...step.parameters,
        batchSize: Math.ceil(batchSize * (targetTime / currentTime)),
        optimizationLevel: 'HIGH',
        useParallelProcessing: true
      };
    }

    return optimizedStep;
  }

  private optimizeApiCallParameters(parameters: any): any {
    return {
      ...parameters,
      timeout: Math.min(parameters?.timeout || 30000, 30000),
      retryStrategy: {
        maxRetries: 3,
        backoff: 'exponential',
        maxDelay: 5000
      },
      caching: {
        enabled: true,
        ttl: 300
      }
    };
  }

  private optimizeDataProcessingParameters(parameters: any): any {
    return {
      ...parameters,
      batchSize: Math.min(parameters?.batchSize || 100, 1000),
      chunkSize: Math.min(parameters?.chunkSize || 1024, 8192),
      compression: true,
      validation: {
        enabled: true,
        strict: true
      }
    };
  }

  private optimizeMemoryOperationParameters(parameters: any): any {
    // Implementation for optimizing memory operation parameters
    return parameters;
  }

  private optimizeCpuIntensiveGroup(steps: ExtendedPlanStep[]): ExtendedPlanStep[] {
    return steps.map(step => ({
      ...step,
      parameters: {
        ...step.parameters,
        useThreading: true,
        optimizationLevel: 'HIGH',
        batchSize: Math.min(typeof step.parameters?.batchSize === 'number' ? step.parameters.batchSize : 100, 50)
      }
    }));
  }

  private optimizeMemoryIntensiveGroup(steps: ExtendedPlanStep[]): ExtendedPlanStep[] {
    return steps.map(step => ({
      ...step,
      parameters: {
        ...step.parameters,
        compression: true,
        cleanupStrategy: 'IMMEDIATE',
        batchSize: Math.min(typeof step.parameters?.batchSize === 'number' ? step.parameters.batchSize : 1000, 100)
      }
    }));
  }

  private interleaveStepGroups(groups: ExtendedPlanStep[][]): ExtendedPlanStep[] {
    const result: ExtendedPlanStep[] = [];
    const maxLength = Math.max(...groups.map(g => g.length));
    
    for (let i = 0; i < maxLength; i++) {
      groups.forEach(group => {
        if (i < group.length) {
          result.push(group[i]);
        }
      });
    }
    
    return result;
  }

  private groupStepsByResourceType(steps: ExtendedPlanStep[]): Record<string, ExtendedPlanStep[]> {
    const groups: Record<string, ExtendedPlanStep[]> = {
      'CPU_INTENSIVE': [],
      'MEMORY_INTENSIVE': [],
      'IO_INTENSIVE': [],
      'OTHER': []
    };

    steps.forEach(step => {
      const type = this.determineResourceType(step);
      groups[type].push(step);
    });

    return groups;
  }

  private calculateStepHash(step: ExtendedPlanStep): string {
    const { type, description, parameters } = step;
    return JSON.stringify({ type, description, parameters });
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private hasDependencyPath(
    graph: Map<string, Set<string>>,
    start: string,
    end: string,
    visited: Set<string> = new Set()
  ): boolean {
    if (start === end) return true;
    if (visited.has(start)) return false;
    
    visited.add(start);
    const dependencies = graph.get(start);
    if (!dependencies) return false;

    // Convert Set to Array for iteration
    const depsArray = Array.from(dependencies);
    for (const dep of depsArray) {
      if (this.hasDependencyPath(graph, dep, end, visited)) {
        return true;
      }
    }

    return false;
  }

  private calculateStepWeight(step: ExtendedPlanStep): number {
    const baseWeight = this.estimateStepTime(step);
    const dependencyWeight = this.calculateDependencyWeight(step.id, this.dependencyGraph);
    const criticalityWeight = this.calculateCriticalityWeight(step);
    
    return baseWeight + dependencyWeight + criticalityWeight;
  }

  private canMergeSteps(step1: ExtendedPlanStep, step2: ExtendedPlanStep): boolean {
    return step1.type === step2.type &&
           this.estimateStepTime(step1) + this.estimateStepTime(step2) <= this.getMaxMergedStepTime() &&
           this.areStepsSequential(step1, step2);
  }

  private areStepsSequential(step1: ExtendedPlanStep, step2: ExtendedPlanStep): boolean {
    return (step1.dependencies || []).includes(step2.id) ||
           (step2.dependencies || []).includes(step1.id);
  }

  /**
   * Convert a base plan step to an extended plan step
   */
  private convertToExtendedPlanStep(step: BasePlanStep): ExtendedPlanStep {
    const baseStep = step as any;
    return {
      ...step,
      type: baseStep.type || 'GENERIC',
      status: baseStep.status || TaskStatus.PENDING,
      parameters: baseStep.parameters || {},
      dependencies: baseStep.dependencies || [],
      estimatedTime: baseStep.estimatedTime || 0,
      priority: baseStep.priority || 0,
      retryCount: baseStep.retryCount || 0,
      validationRules: baseStep.validationRules || [],
      fallbackOptions: baseStep.fallbackOptions || []
    };
  }

  /**
   * Convert a base task status to an extended task status
   */
  private convertToExtendedTaskStatus(status: BaseTaskStatus): TaskStatus {
    switch (status) {
      case BaseTaskStatus.PENDING:
        return TaskStatus.PENDING;
      case BaseTaskStatus.IN_PROGRESS:
        return TaskStatus.IN_PROGRESS;
      case BaseTaskStatus.COMPLETED:
        return TaskStatus.COMPLETED;
      case BaseTaskStatus.FAILED:
        return TaskStatus.FAILED;
      case BaseTaskStatus.BLOCKED:
        return TaskStatus.BLOCKED;
      case BaseTaskStatus.PAUSED:
        return TaskStatus.PAUSED;
      case BaseTaskStatus.EXECUTED:
        return TaskStatus.EXECUTED;
      default:
        return TaskStatus.PENDING;
    }
  }

  /**
   * Convert extended plan steps to base plan steps
   */
  private convertToBasePlanSteps(steps: ExtendedPlanStep[]): BasePlanStep[] {
    return steps.map(step => ({
      id: step.id,
      description: step.description,
      status: step.status,
      startTime: step.startTime,
      endTime: step.endTime,
      result: step.result,
      error: step.error
    }));
  }

  /**
   * Convert an extended task status to a base task status
   */
  private convertToBaseTaskStatus(status: TaskStatus): BaseTaskStatus {
    switch (status) {
      case TaskStatus.PENDING:
        return BaseTaskStatus.PENDING;
      case TaskStatus.IN_PROGRESS:
        return BaseTaskStatus.IN_PROGRESS;
      case TaskStatus.COMPLETED:
        return BaseTaskStatus.COMPLETED;
      case TaskStatus.FAILED:
        return BaseTaskStatus.FAILED;
      case TaskStatus.BLOCKED:
        return BaseTaskStatus.BLOCKED;
      case TaskStatus.PAUSED:
        return BaseTaskStatus.PAUSED;
      case TaskStatus.EXECUTED:
        return BaseTaskStatus.EXECUTED;
      default:
        return BaseTaskStatus.PENDING;
    }
  }

  /**
   * Convert base plan steps to extended plan steps
   */
  private convertToExtendedPlanSteps(steps: BasePlanStep[]): ExtendedPlanStep[] {
    return steps.map(step => this.convertToExtendedPlanStep(step));
  }

  /**
   * Convert a plan with extended steps to a plan with base steps
   */
  private toPlanWithSteps(steps: ExtendedPlanStep[], goal: string = 'Optimized Plan', reasoning: string = 'Auto-generated'): PlanWithSteps {
    return {
      goal,
      steps: this.convertToBasePlanSteps(steps),
      reasoning
    };
  }

  private calculateAdaptationMetrics(originalPlan: PlanWithSteps, adaptedPlan: PlanWithSteps): PlanAdaptationMetrics {
    return {
      originalStepCount: originalPlan.steps.length,
      newStepCount: adaptedPlan.steps.length,
      estimatedTimeChange: this.calculateTimeChange(originalPlan, adaptedPlan),
      confidence: this.calculateAdaptationConfidence({
        changes: this.determineAdaptationStrategy({
          plan: originalPlan,
          reason: 'OPTIMIZATION',
          context: {}
        }).changes
      })
    };
  }

  private calculateOptimizationMetrics(originalPlan: PlanWithSteps, optimizedPlan: PlanWithSteps): PlanOptimizationMetrics {
    return {
      optimizationTime: Date.now() - this.metrics.totalOptimizationTime,
      stepCount: optimizedPlan.steps.length,
      estimatedTotalTime: this.calculateTotalTime(optimizedPlan),
      estimatedResourceUsage: this.calculateResourceUsage(optimizedPlan),
      reliabilityScore: this.calculateReliabilityScore(optimizedPlan)
    };
  }

  /**
   * Handle priority changes
   */
  private handlePriorityChanges(steps: ExtendedPlanStep[], changes: { newPriorities: string[]; removedPriorities: string[] }): ExtendedPlanStep[] {
    // Example logic: just return steps for now
    this.logger.logAction('Handling priority changes', changes);
    return steps;
  }

  private calculateReliabilityScore(plan: PlanWithSteps): number {
    const stepScores = this.convertToExtendedPlanSteps(plan.steps).map(step => {
      const baseScore = typeof step.parameters?.reliability === 'number' ? step.parameters.reliability : 0.8;
      const dependencyScore = this.calculateDependencyReliability(step);
      return Math.min(baseScore * (typeof dependencyScore === 'number' ? dependencyScore : 1), 1);
    });
    return stepScores.reduce((sum, score) => sum + (typeof score === 'number' ? score : 0), 0) / (stepScores.length || 1);
  }

  private validateDependencies(plan: PlanWithSteps): string[] {
    const issues: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const steps = this.convertToExtendedPlanSteps(plan.steps);

    const checkCycles = (stepId: string) => {
      if (recursionStack.has(stepId)) {
        issues.push(`Circular dependency detected involving step ${stepId}`);
        return;
      }

      if (visited.has(stepId)) return;

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step?.dependencies) {
        for (const depId of step.dependencies) {
          if (!steps.some(s => s.id === depId)) {
            issues.push(`Step ${stepId} depends on non-existent step ${depId}`);
          } else {
            checkCycles(depId);
          }
        }
      }

      recursionStack.delete(stepId);
    };

    steps.forEach(step => {
      if (!visited.has(step.id)) {
        checkCycles(step.id);
      }
    });

    return issues;
  }

  private calculateMetric(plan: PlanWithSteps, type: 'TIME' | 'RESOURCE' | 'RELIABILITY' | 'EFFICIENCY'): number {
    switch (type) {
      case 'TIME':
        return this.calculateTotalTime(plan);
      case 'RESOURCE':
        return this.calculateResourceUsage(plan);
      case 'RELIABILITY':
        return this.calculateReliabilityScore(plan);
      case 'EFFICIENCY':
        return this.calculateEfficiencyGain(plan, plan);
      default:
        return 0;
    }
  }

  private calculateOptimizationConfidence(type: 'TIME' | 'RESOURCE' | 'RELIABILITY' | 'EFFICIENCY', improvement: number): number {
    const thresholds = new Map([
      ['TIME', 0.2],
      ['RESOURCE', 0.15],
      ['RELIABILITY', 0.1],
      ['EFFICIENCY', 0.25]
    ]);

    const threshold = thresholds.get(type) || 0.2;
    return Math.min(improvement / threshold, 1);
  }

  private calculateDependencyReliability(step: ExtendedPlanStep): number {
    if (!step.dependencies?.length) return 1;
    const dependencyScores = step.dependencies.map(depId => {
      const depStep = this.findStepById(depId);
      return depStep && typeof depStep.parameters?.reliability === 'number' ? depStep.parameters.reliability : 0.8;
    });
    return dependencyScores.reduce((sum, score) => sum + (typeof score === 'number' ? score : 0), 0) / (dependencyScores.length || 1);
  }

  private findStepById(stepId: string): ExtendedPlanStep | undefined {
    return this.currentPlan ? 
      this.convertToExtendedPlanSteps(this.currentPlan.steps).find(s => s.id === stepId) : 
      undefined;
  }

  private async validateResources(plan: PlanWithSteps): Promise<string[]> {
    const issues: string[] = [];
    const resourceLimits = this.getResourceLimits();
    const steps = this.convertToExtendedPlanSteps(plan.steps);

    for (const step of steps) {
      const profile = this.analyzeResourceProfile(step);

      if (profile.memory > resourceLimits.maxMemory) {
        issues.push(`Step ${step.id} exceeds memory limit: ${profile.memory} > ${resourceLimits.maxMemory}`);
      }

      if (profile.cpu > resourceLimits.maxCpu) {
        issues.push(`Step ${step.id} exceeds CPU limit: ${profile.cpu} > ${resourceLimits.maxCpu}`);
      }

      if (profile.io > resourceLimits.maxIo) {
        issues.push(`Step ${step.id} exceeds IO limit: ${profile.io} > ${resourceLimits.maxIo}`);
      }
    }

    return issues;
  }

  private getResourceLimits(): { maxMemory: number; maxCpu: number; maxIo: number } {
    return {
      maxMemory: 1024 * 1024 * 1024, // 1GB
      maxCpu: 0.8, // 80% CPU
      maxIo: 0.8 // 80% IO
    };
  }

  private calculateTimeChange(originalPlan: PlanWithSteps, adaptedPlan: PlanWithSteps): number {
    const originalTime = this.calculateTotalTime(originalPlan);
    const adaptedTime = this.calculateTotalTime(adaptedPlan);
    return originalTime - adaptedTime;
  }

  private calculateAdaptationConfidence(strategy: { 
    changes: Array<{ 
      type: PlanAdaptationType; 
      description: string; 
      affectedSteps: string[]; 
      reason: string; 
    }> 
  }): number {
    // Calculate confidence based on number and type of changes
    const changeWeights = new Map<PlanAdaptationType, number>([
      ['REORDER', 0.8],
      ['REPLACE', 0.6],
      ['ADD', 0.7],
      ['REMOVE', 0.9],
      ['MERGE', 0.8],
      ['SPLIT', 0.7],
      ['OPTIMIZE', 0.9],
      ['RESTRUCTURE', 0.5]
    ]);

    const totalWeight = strategy.changes.reduce((sum, change) => {
      return sum + (changeWeights.get(change.type) || 0.5);
    }, 0);

    return Math.min(totalWeight / strategy.changes.length, 1);
  }

  private calculateImprovements(
    originalPlan: PlanWithSteps,
    optimizedPlan: PlanWithSteps,
    goals: PlanOptimizationRequest['optimizationGoals']
  ): PlanOptimizationResult['improvements'] {
    const improvements: PlanOptimizationResult['improvements'] = [];

    goals.forEach(goal => {
      const before = this.calculateMetric(originalPlan, goal.type);
      const after = this.calculateMetric(optimizedPlan, goal.type);
      const improvement = before - after;

      if (improvement > 0) {
        improvements.push({
          type: goal.type,
          before,
          after,
          improvement,
          confidence: this.calculateOptimizationConfidence(goal.type, improvement)
        });
      }
    });

    return improvements;
  }

  private calculateResourceUsage(plan: PlanWithSteps): number {
    return this.convertToExtendedPlanSteps(plan.steps).reduce((total, step) => {
      const profile = this.analyzeResourceProfile(step);
      return total + (profile.memory + profile.cpu + profile.io);
    }, 0);
  }

  private calculateTotalTime(plan: PlanWithSteps): number {
    const steps = this.convertToExtendedPlanSteps(plan.steps);
    return steps.reduce((total, step) => {
      const stepTime = this.estimateStepTime(step);
      return total + (stepTime || 0);
    }, 0);
  }

  private updateAdaptationHistory(planId: string, result: PlanAdaptationResult): void {
    const history = this.adaptationHistory.get(planId) || [];
    history.push(result);
    if (history.length > this.config.adaptationHistorySize) {
      history.shift();
    }
    this.adaptationHistory.set(planId, history);
  }

  private updateOptimizationHistory(planId: string, result: PlanOptimizationResult): void {
    const history = this.optimizationHistory.get(planId) || [];
    history.push(result);
    if (history.length > this.config.optimizationHistorySize) {
      history.shift();
    }
    this.optimizationHistory.set(planId, history);
  }

  private calculateEfficiencyGain(originalPlan: PlanWithSteps, optimizedPlan: PlanWithSteps): number {
    const originalTime = this.calculateTotalTime(originalPlan);
    const optimizedTime = this.calculateTotalTime(optimizedPlan);
    return ((originalTime - optimizedTime) / originalTime) * 100;
  }

  private calculateReliabilityImprovement(originalPlan: PlanWithSteps, optimizedPlan: PlanWithSteps): number {
    const originalScore = this.calculateReliabilityScore(originalPlan);
    const optimizedScore = this.calculateReliabilityScore(optimizedPlan);
    return ((optimizedScore - originalScore) / originalScore) * 100;
  }

  private mergeStepGroup(steps: ExtendedPlanStep[]): ExtendedPlanStep {
    const baseStep = steps[0];
    return {
      ...baseStep,
      id: `merged_${steps.map(s => s.id).join('_')}`,
      type: 'MERGED',
      description: `Merged execution of ${steps.length} steps`,
      status: TaskStatus.PENDING,
      parameters: {
        steps,
        executionStrategy: 'SEQUENTIAL',
        optimizationLevel: 'HIGH'
      },
      dependencies: this.getUniqueDependencies(steps)
    };
  }

  private getUniqueDependencies(steps: ExtendedPlanStep[]): string[] {
    const deps = new Set<string>();
    for (const step of steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          deps.add(dep);
        }
      }
    }
    return Array.from(deps);
  }

  private analyzeResourceProfile(step: ExtendedPlanStep): {
    memory: number;
    cpu: number;
    io: number;
    concurrency: number;
  } {
    return {
      memory: this.estimateMemoryUsage(step),
      cpu: this.estimateCpuUsage(step),
      io: this.estimateIoUsage(step),
      concurrency: this.estimateConcurrency(step)
    };
  }

  private estimateStepTime(step: ExtendedPlanStep): number {
    const baseTime = step.estimatedTime || 0;
    const complexity = (step.parameters?.complexity as number) || 1;
    const dataSize = (step.parameters?.dataSize as number) || 0;
    return baseTime * complexity + (dataSize / 1000); // Convert data size to time impact
  }

  private estimateMemoryUsage(step: ExtendedPlanStep): number {
    const baseMemory = (step.parameters?.baseMemory as number) || 0;
    const dataSize = (step.parameters?.dataSize as number) || 0;
    const bufferSize = (step.parameters?.bufferSize as number) || 0;
    return baseMemory + dataSize + bufferSize;
  }

  private estimateCpuUsage(step: ExtendedPlanStep): number {
    const baseCpu = (step.parameters?.baseCpu as number) || 0;
    const complexity = (step.parameters?.complexity as number) || 1;
    const concurrency = (step.parameters?.concurrency as number) || 1;
    return baseCpu * complexity * concurrency;
  }

  private estimateIoUsage(step: ExtendedPlanStep): number {
    const baseIo = (step.parameters?.baseIo as number) || 0;
    const dataSize = (step.parameters?.dataSize as number) || 0;
    const batchSize = (step.parameters?.batchSize as number) || 1;
    return baseIo + (dataSize / batchSize);
  }

  private estimateConcurrency(step: ExtendedPlanStep): number {
    let baseConcurrency = 1;
    switch (step.type) {
      case 'API_CALL':
        baseConcurrency = 5;
        break;
      case 'DATA_PROCESSING':
        baseConcurrency = 3;
        break;
      default:
        baseConcurrency = 1;
    }
    
    if (step.parameters?.maxConcurrency) {
      baseConcurrency = Math.min(baseConcurrency, step.parameters.maxConcurrency as number);
    }
    
    return baseConcurrency;
  }

  private getMaxMergedStepTime(): number {
    return 5000; // 5 seconds
  }

  private getMinStepTime(step: ExtendedPlanStep): number {
    return 100; // 100ms
  }

  private calculateDependencyWeight(stepId: string, dependencyMap: Map<string, Set<string>>): number {
    const visited = new Set<string>();
    const stack = [stepId];
    let weight = 0;

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const dependencies = dependencyMap.get(current);
      if (dependencies) {
        // Convert Set to Array for iteration
        const depsArray = Array.from(dependencies);
        for (const dep of depsArray) {
          if (!visited.has(dep)) {
            stack.push(dep);
            weight++;
          }
        }
      }
    }

    return weight;
  }

  private calculateCriticalityWeight(step: ExtendedPlanStep): number {
    return step.parameters?.critical ? 1000 : 0; // Critical steps get higher priority
  }

  private reorderForEfficiency(steps: ExtendedPlanStep[]): ExtendedPlanStep[] {
    const resourceGroups = this.groupStepsByResourceType(steps);
    const optimizedGroups = Object.entries(resourceGroups).map(([type, groupSteps]) => {
      switch (type) {
        case 'CPU_INTENSIVE':
          return this.optimizeCpuIntensiveGroup(groupSteps);
        case 'MEMORY_INTENSIVE':
          return this.optimizeMemoryIntensiveGroup(groupSteps);
        case 'IO_INTENSIVE':
          return this.optimizeIoIntensiveGroup(groupSteps);
        default:
          return groupSteps;
      }
    });
    
    return this.interleaveStepGroups(optimizedGroups);
  }

  private optimizeIoIntensiveGroup(steps: ExtendedPlanStep[]): ExtendedPlanStep[] {
    // Implementation for optimizing IO intensive group
    return steps;
  }

  private removeRedundantSteps(steps: ExtendedPlanStep[]): ExtendedPlanStep[] {
    const uniqueSteps = new Map<string, ExtendedPlanStep>();
    const stepHashes = new Set<string>();
    
    steps.forEach(step => {
      const hash = this.calculateStepHash(step);
      if (!stepHashes.has(hash)) {
        stepHashes.add(hash);
        uniqueSteps.set(step.id, step);
      }
    });
    
    return Array.from(uniqueSteps.values());
  }

  private addRetryLogic(steps: ExtendedPlanStep[]): ExtendedPlanStep[] {
    return steps.map(step => {
      if (!this.requiresRetryLogic(step)) return step;

      const retryStep: ExtendedPlanStep = {
        ...step,
        id: `retry_${step.id}`,
        type: 'RETRY',
        description: `Retry logic for ${step.description}`,
        status: TaskStatus.PENDING,
        parameters: {
          targetStepId: step.id,
          maxRetries: this.determineRetryCount(step),
          retryDelay: this.determineRetryDelay(step),
          backoffStrategy: 'exponential'
        },
        dependencies: [step.id]
      };

      return [step, retryStep];
    }).flat();
  }

  private addValidationSteps(steps: ExtendedPlanStep[]): ExtendedPlanStep[] {
    return steps.map(step => {
      if (!this.requiresValidation(step)) return step;
      
      const validationStep: ExtendedPlanStep = {
        id: `validation_${step.id}`,
        type: 'VALIDATION',
        description: `Validation for ${step.description}`,
        status: TaskStatus.PENDING,
        parameters: {
          targetStepId: step.id,
          validationRules: this.determineValidationRules(step)
        },
        dependencies: [step.id]
      };
      
      return [step, validationStep];
    }).flat();
  }

  private addFallbackOptions(steps: ExtendedPlanStep[]): ExtendedPlanStep[] {
    return steps.map(step => {
      if (!this.requiresFallback(step)) return step;

      const fallbackStep: ExtendedPlanStep = {
        ...step,
        id: `fallback_${step.id}`,
        type: 'FALLBACK',
        description: `Fallback for ${step.description}`,
        status: TaskStatus.PENDING,
        parameters: {
          targetStepId: step.id,
          fallbackAction: this.determineFallbackAction(step),
          triggerConditions: ['ERROR', 'TIMEOUT', 'RESOURCE_EXHAUSTION']
        },
        dependencies: [step.id]
      };

      return [step, fallbackStep];
    }).flat();
  }

  private requiresRetryLogic(step: ExtendedPlanStep): boolean {
    const reliability = typeof step.parameters?.reliability === 'number' ? step.parameters.reliability : 0.8;
    return step.parameters?.critical === true || 
           step.parameters?.requiresRetry === true ||
           (typeof reliability === 'number' ? reliability : 0.8) < 0.9;
  }

  private requiresValidation(step: ExtendedPlanStep): boolean {
    return step.parameters?.critical === true || 
           step.parameters?.requiresValidation === true ||
           this.hasUnreliableDependencies(step);
  }

  private requiresFallback(step: ExtendedPlanStep): boolean {
    const reliability = typeof step.parameters?.reliability === 'number' ? step.parameters.reliability : 0.8;
    return step.parameters?.critical === true || 
           step.parameters?.requiresFallback === true ||
           (typeof reliability === 'number' ? reliability : 0.8) < 0.8;
  }

  private determineRetryCount(step: ExtendedPlanStep): number {
    if (step.parameters?.critical) return 5;
    const reliability = typeof step.parameters?.reliability === 'number' ? step.parameters.reliability : 0.8;
    if ((typeof reliability === 'number' ? reliability : 0.8) < 0.8) return 3;
    return 1;
  }

  private determineRetryDelay(step: ExtendedPlanStep): number {
    if (step.parameters?.critical) return 2000;
    const reliability = typeof step.parameters?.reliability === 'number' ? step.parameters.reliability : 0.8;
    if ((typeof reliability === 'number' ? reliability : 0.8) < 0.8) return 1000;
    return 500;
  }

  private determineFallbackAction(step: ExtendedPlanStep): any {
    if (step.parameters?.fallbackAction) {
      return step.parameters.fallbackAction;
    }

    return {
      type: 'GENERIC_FALLBACK',
      action: 'SKIP_AND_CONTINUE',
      notifyOnFailure: true
    };
  }

  private determineValidationRules(step: ExtendedPlanStep): any[] {
    const rules: any[] = [];

    if (step.parameters?.validationRules && Array.isArray(step.parameters.validationRules)) {
      rules.push(...step.parameters.validationRules);
    }

    if (step.type === 'API_CALL') {
      rules.push({
        type: 'API_VALIDATION',
        rules: [
          { type: 'STATUS_CODE', expected: [200, 201, 202] },
          { type: 'RESPONSE_FORMAT', format: 'JSON' }
        ]
      });
    }

    if (step.type === 'DATA_PROCESSING') {
      rules.push({
        type: 'DATA_VALIDATION',
        rules: [
          { type: 'DATA_INTEGRITY', check: 'COMPLETE' },
          { type: 'FORMAT_VALIDATION', format: step.parameters?.dataFormat }
        ]
      });
    }

    return rules;
  }

  private hasUnreliableDependencies(step: ExtendedPlanStep): boolean {
    return (step.dependencies || []).some(depId => {
      const depStep = this.findStepById(depId);
      const reliability = depStep && typeof depStep.parameters?.reliability === 'number' ? depStep.parameters.reliability : 0.8;
      return depStep ? (typeof reliability === 'number' ? reliability : 0.8) < 0.9 : true;
    });
  }

  private calculateOptimalConcurrency(steps: ExtendedPlanStep[]): number {
    const resourceProfiles = steps.map(step => this.analyzeResourceProfile(step));
    const maxConcurrency = Math.min(
      ...resourceProfiles.map(profile => profile.concurrency),
      steps.length
    );
    
    return Math.max(1, maxConcurrency);
  }

  private determineResourceType(step: ExtendedPlanStep): 'CPU_INTENSIVE' | 'MEMORY_INTENSIVE' | 'IO_INTENSIVE' | 'OTHER' {
    const profile = this.analyzeResourceProfile(step);
    
    if (profile.cpu > 0.5) return 'CPU_INTENSIVE';
    if (profile.memory > 100 * 1024 * 1024) return 'MEMORY_INTENSIVE';
    if (profile.io > 0.5) return 'IO_INTENSIVE';
    return 'OTHER';
  }
} 