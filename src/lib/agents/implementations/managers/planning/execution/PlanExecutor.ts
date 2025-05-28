/**
 * PlanExecutor.ts - Plan execution orchestration
 * 
 * This component handles the execution of complete plans with step sequencing,
 * progress tracking, and execution state management.
 */

import { ulid } from 'ulid';
import { 
  PlanExecutor as IPlanExecutor,
  ExecutionContext,
  ExecutionState,
  StepExecutionState,
  ExecutionStatus,
  PlanExecutionConfig,
  StepExecutionResult
} from '../interfaces/ExecutionInterfaces';
import { 
  Plan, 
  PlanStep, 
  PlanExecutionResult 
} from '../../../../../../agents/shared/base/managers/PlanningManager.interface';
import { ActionExecutor } from './ActionExecutor';
import { AgentBase } from '../../../../../../agents/shared/base/AgentBase.interface';
import { createLogger } from '@/lib/logging/winston-logger';

/**
 * Configuration for plan execution
 */
export interface PlanExecutorConfig {
  /** Default execution configuration */
  defaultExecutionConfig: PlanExecutionConfig;
  
  /** Enable execution logging */
  enableLogging: boolean;
  
  /** Enable progress tracking */
  enableProgressTracking: boolean;
  
  /** Progress update interval (ms) */
  progressUpdateIntervalMs: number;
  
  /** Enable execution metrics */
  enableMetrics: boolean;
  
  /** Maximum execution time (ms) */
  maxExecutionTimeMs: number;
}

/**
 * Default configuration for plan execution
 */
const DEFAULT_CONFIG: PlanExecutorConfig = {
  defaultExecutionConfig: {
    maxConcurrentSteps: 3,
    maxConcurrentActions: 5,
    stepTimeoutMs: 300000, // 5 minutes
    actionTimeoutMs: 60000, // 1 minute
    continueOnStepFailure: false,
    continueOnActionFailure: true,
    maxRetryAttempts: 3,
    retryDelayMs: 2000
  },
  enableLogging: true,
  enableProgressTracking: true,
  progressUpdateIntervalMs: 5000, // 5 seconds
  enableMetrics: true,
  maxExecutionTimeMs: 3600000 // 1 hour
};

/**
 * Plan execution error
 */
export class PlanExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly planId: string,
    public readonly recoverable: boolean = true,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'PlanExecutionError';
  }
}

/**
 * Implementation of PlanExecutor interface
 */
export class PlanExecutor implements IPlanExecutor {
  private readonly logger = createLogger({ moduleId: 'plan-executor' });
  private readonly config: PlanExecutorConfig;
  private readonly actionExecutor: ActionExecutor;
  private readonly agent?: AgentBase;
  private readonly activeExecutions = new Map<string, ExecutionContext>();
  private readonly progressTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    config: Partial<PlanExecutorConfig> = {},
    actionExecutor?: ActionExecutor,
    agent?: AgentBase
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.agent = agent;
    this.actionExecutor = actionExecutor || new ActionExecutor({}, agent);
    
    if (this.config.enableLogging) {
      this.logger.info('PlanExecutor initialized', { config: this.config });
    }
  }

  /**
   * Execute a complete plan
   */
  async executePlan(
    plan: Plan,
    config: Partial<PlanExecutionConfig> = {}
  ): Promise<PlanExecutionResult> {
    const executionId = ulid();
    const startTime = new Date();
    
    // Merge execution config with defaults
    const execConfig = { ...this.config.defaultExecutionConfig, ...config };
    
    // Create execution context
    const context: ExecutionContext = {
      executionId,
      plan,
      state: this.createInitialExecutionState(plan),
      sharedData: {},
      config: execConfig,
      startTime,
      currentTime: startTime
    };

    this.activeExecutions.set(executionId, context);

    try {
      if (this.config.enableLogging) {
        this.logger.info('Starting plan execution', {
          executionId,
          planId: plan.id,
          stepCount: plan.steps.length,
          config: execConfig
        });
      }

      // Start progress tracking if enabled
      if (this.config.enableProgressTracking) {
        this.startProgressTracking(context);
      }

      // Execute plan steps
      const result = await this.executeStepsWithDependencies(context);

      // Update final execution state
      context.state.status = result.success ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED;
      context.state.progress = 1.0;

      if (this.config.enableLogging) {
        this.logger.info('Plan execution completed', {
          executionId,
          planId: plan.id,
          success: result.success,
          duration: Date.now() - startTime.getTime()
        });
      }

      return result;

    } catch (error) {
      context.state.status = ExecutionStatus.FAILED;
      context.state.error = {
        message: error instanceof Error ? error.message : String(error),
        code: 'PLAN_EXECUTION_ERROR',
        recoverable: true
      };

      if (this.config.enableLogging) {
        this.logger.error('Plan execution failed', {
          executionId,
          planId: plan.id,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime.getTime()
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

    } finally {
      // Cleanup
      this.stopProgressTracking(executionId);
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute a single step
   */
  async executeStep(
    step: PlanStep,
    context: ExecutionContext
  ): Promise<StepExecutionResult> {
    const stepStartTime = Date.now();
    
    // Initialize step execution state
    const stepState: StepExecutionState = {
      stepId: step.id,
      status: ExecutionStatus.RUNNING,
      startTime: new Date(),
      actionStates: {},
      retryCount: 0
    };

    context.state.stepStates[step.id] = stepState;
    context.state.currentStepId = step.id;

    try {
      if (this.config.enableLogging) {
        this.logger.info('Starting step execution', {
          executionId: context.executionId,
          stepId: step.id,
          stepName: step.name,
          actionCount: step.actions.length
        });
      }

      // Execute step actions
      const actionResults = await this.executeStepActions(step, context);
      
      // Process step results
      const stepResult = this.processStepResults(step, actionResults, context);
      
      // Update step state
      stepState.status = stepResult.success ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED;
      stepState.endTime = new Date();
      stepState.result = stepResult;

      // Update overall progress
      this.updateExecutionProgress(context);

      if (this.config.enableLogging) {
        this.logger.info('Step execution completed', {
          executionId: context.executionId,
          stepId: step.id,
          success: stepResult.success,
          duration: Date.now() - stepStartTime
        });
      }

      return stepResult;

    } catch (error) {
      stepState.status = ExecutionStatus.FAILED;
      stepState.endTime = new Date();
      stepState.error = {
        message: error instanceof Error ? error.message : String(error),
        code: 'STEP_EXECUTION_ERROR',
        recoverable: true
      };

      if (this.config.enableLogging) {
        this.logger.error('Step execution failed', {
          executionId: context.executionId,
          stepId: step.id,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - stepStartTime
        });
      }

      throw new PlanExecutionError(
        `Step execution failed: ${error instanceof Error ? error.message : String(error)}`,
        'STEP_EXECUTION_FAILED',
        context.plan.id,
        true,
        { stepId: step.id }
      );
    }
  }

  /**
   * Pause plan execution
   */
  async pauseExecution(executionId: string): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    
    if (!context) {
      throw new PlanExecutionError(
        'Execution not found',
        'EXECUTION_NOT_FOUND',
        'unknown',
        false
      );
    }

    context.state.status = ExecutionStatus.PAUSED;
    
    if (this.config.enableLogging) {
      this.logger.info('Plan execution paused', { executionId });
    }
  }

  /**
   * Resume plan execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    
    if (!context) {
      throw new PlanExecutionError(
        'Execution not found',
        'EXECUTION_NOT_FOUND',
        'unknown',
        false
      );
    }

    if (context.state.status === ExecutionStatus.PAUSED) {
      context.state.status = ExecutionStatus.RUNNING;
      
      if (this.config.enableLogging) {
        this.logger.info('Plan execution resumed', { executionId });
      }
    }
  }

  /**
   * Cancel plan execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    
    if (!context) {
      throw new PlanExecutionError(
        'Execution not found',
        'EXECUTION_NOT_FOUND',
        'unknown',
        false
      );
    }

    context.state.status = ExecutionStatus.CANCELLED;
    
    // Cancel action executor operations
    this.actionExecutor.cancelAllExecutions();
    
    if (this.config.enableLogging) {
      this.logger.info('Plan execution cancelled', { executionId });
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionState> {
    const context = this.activeExecutions.get(executionId);
    
    if (!context) {
      throw new PlanExecutionError(
        'Execution not found',
        'EXECUTION_NOT_FOUND',
        'unknown',
        false
      );
    }

    // Update current time
    context.currentTime = new Date();
    
    return { ...context.state };
  }

  /**
   * Execute steps with dependency management
   */
  private async executeStepsWithDependencies(context: ExecutionContext): Promise<PlanExecutionResult> {
    const { plan, config } = context;
    const stepQueue: PlanStep[] = [...plan.steps];
    const completedSteps = new Set<string>();
    const failedSteps = new Set<string>();

    context.state.status = ExecutionStatus.RUNNING;

    while (stepQueue.length > 0 && context.state.status === ExecutionStatus.RUNNING) {
      // Find steps that can be executed (dependencies satisfied)
      const readySteps = stepQueue.filter(step => 
        this.areStepDependenciesSatisfied(step, completedSteps)
      );

      if (readySteps.length === 0) {
        // Check if we have a deadlock
        if (stepQueue.length > 0) {
          throw new PlanExecutionError(
            'Dependency deadlock detected',
            'DEPENDENCY_DEADLOCK',
            plan.id,
            false
          );
        }
        break;
      }

      // Execute ready steps (up to maxConcurrentSteps)
      const stepsToExecute = readySteps.slice(0, config.maxConcurrentSteps);
      const stepPromises = stepsToExecute.map(step => this.executeStep(step, context));

      try {
        const stepResults = await Promise.allSettled(stepPromises);
        
        // Process results
        for (let i = 0; i < stepResults.length; i++) {
          const step = stepsToExecute[i];
          const result = stepResults[i];
          
          // Remove from queue
          const queueIndex = stepQueue.indexOf(step);
          if (queueIndex >= 0) {
            stepQueue.splice(queueIndex, 1);
          }

          if (result.status === 'fulfilled') {
            completedSteps.add(step.id);
            context.state.completedSteps.push(step.id);
          } else {
            failedSteps.add(step.id);
            context.state.failedSteps.push(step.id);
            
            if (!config.continueOnStepFailure) {
              throw new PlanExecutionError(
                `Step failed: ${result.reason}`,
                'STEP_EXECUTION_FAILED',
                plan.id,
                true,
                { stepId: step.id }
              );
            }
          }
        }

      } catch (error) {
        throw error;
      }
    }

    // Determine overall success
    const success = failedSteps.size === 0 && completedSteps.size === plan.steps.length;

    return {
      success,
      plan: {
        ...plan,
        status: success ? 'completed' : 'failed'
      }
    };
  }

  /**
   * Execute actions within a step
   */
  private async executeStepActions(
    step: PlanStep,
    context: ExecutionContext
  ): Promise<any[]> {
    const { config } = context;
    
    let actionResults: any[];
    
    if (config.maxConcurrentActions > 1) {
      // Execute actions concurrently
      actionResults = await this.actionExecutor.executeActionsConcurrently(
        step.actions,
        context,
        {
          timeoutMs: config.actionTimeoutMs,
          maxRetries: config.maxRetryAttempts,
          retryDelayMs: config.retryDelayMs
        }
      );
    } else {
      // Execute actions sequentially
      actionResults = await this.actionExecutor.executeActionsSequentially(
        step.actions,
        context,
        {
          timeoutMs: config.actionTimeoutMs,
          maxRetries: config.maxRetryAttempts,
          retryDelayMs: config.retryDelayMs
        }
      );
    }

    // Store action results back in the original PlanAction objects
    if (this.config.enableLogging) {
      this.logger.debug('Processing action results', {
        stepId: step.id,
        actionCount: step.actions.length,
        resultCount: actionResults.length
      });
    }

    for (let i = 0; i < Math.min(step.actions.length, actionResults.length); i++) {
      const action = step.actions[i];
      const result = actionResults[i];
      
      if (this.config.enableLogging) {
        this.logger.debug('Storing action result', {
          actionId: action.id,
          actionName: action.name,
          resultSuccess: result.success,
          resultOutput: result.output ? 'present' : 'missing'
        });
      }

      // Store the execution result in the action
      (action as any).executionResult = result;
      
      // Update action status based on result
      action.status = result.success ? 'completed' : 'failed';
      action.updatedAt = new Date();
    }

    return actionResults;
  }

  /**
   * Process step execution results
   */
  private processStepResults(
    step: PlanStep,
    actionResults: any[],
    context: ExecutionContext
  ): StepExecutionResult {
    const successfulActions = actionResults.filter(result => result.success);
    const failedActions = actionResults.filter(result => !result.success);
    
    const success = context.config.continueOnActionFailure 
      ? successfulActions.length > 0 
      : failedActions.length === 0;

    // Aggregate outputs
    const outputs = successfulActions
      .map(result => result.output)
      .filter(output => output !== undefined);

    return {
      success,
      output: outputs.length === 1 ? outputs[0] : outputs,
      metrics: {
        executionTime: actionResults.reduce((sum, result) => sum + (result.metrics?.executionTime || 0), 0),
        queueTime: 0
      },
      actionResults,
      metadata: {
        stepId: step.id,
        stepName: step.name,
        actionCount: step.actions.length,
        successfulActions: successfulActions.length,
        failedActions: failedActions.length,
        executedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Check if step dependencies are satisfied
   */
  private areStepDependenciesSatisfied(step: PlanStep, completedSteps: Set<string>): boolean {
    return step.dependencies.every(depId => completedSteps.has(depId));
  }

  /**
   * Create initial execution state
   */
  private createInitialExecutionState(plan: Plan): ExecutionState {
    return {
      status: ExecutionStatus.PENDING,
      completedSteps: [],
      failedSteps: [],
      stepStates: {},
      progress: 0
    };
  }

  /**
   * Update execution progress
   */
  private updateExecutionProgress(context: ExecutionContext): void {
    const totalSteps = context.plan.steps.length;
    const completedSteps = context.state.completedSteps.length;
    const failedSteps = context.state.failedSteps.length;
    
    context.state.progress = totalSteps > 0 ? (completedSteps + failedSteps) / totalSteps : 0;
  }

  /**
   * Start progress tracking
   */
  private startProgressTracking(context: ExecutionContext): void {
    const timer = setInterval(() => {
      if (this.config.enableLogging) {
        this.logger.debug('Execution progress update', {
          executionId: context.executionId,
          planId: context.plan.id,
          progress: context.state.progress,
          status: context.state.status,
          completedSteps: context.state.completedSteps.length,
          totalSteps: context.plan.steps.length
        });
      }
    }, this.config.progressUpdateIntervalMs);

    this.progressTimers.set(context.executionId, timer);
  }

  /**
   * Stop progress tracking
   */
  private stopProgressTracking(executionId: string): void {
    const timer = this.progressTimers.get(executionId);
    if (timer) {
      clearInterval(timer);
      this.progressTimers.delete(executionId);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PlanExecutorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  configure(newConfig: Partial<PlanExecutorConfig>): void {
    Object.assign(this.config, newConfig);
    
    if (this.config.enableLogging) {
      this.logger.info('PlanExecutor configuration updated', { config: this.config });
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    activeExecutions: number;
    config: PlanExecutorConfig;
  } {
    return {
      healthy: true,
      activeExecutions: this.activeExecutions.size,
      config: this.config
    };
  }

  /**
   * Cleanup resources
   */
  shutdown(): void {
    // Cancel all active executions
    for (const executionId of this.activeExecutions.keys()) {
      this.cancelExecution(executionId).catch(error => {
        this.logger.error('Error cancelling execution during shutdown', {
          executionId,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }

    // Clear all timers
    for (const timer of this.progressTimers.values()) {
      clearInterval(timer);
    }
    this.progressTimers.clear();

    if (this.config.enableLogging) {
      this.logger.info('PlanExecutor shutdown completed');
    }
  }
} 