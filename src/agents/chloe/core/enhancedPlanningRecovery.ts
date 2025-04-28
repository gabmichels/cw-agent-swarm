import { StateManager } from './stateManager';
import { TaskLogger } from './taskLogger';
import { PlanWithSteps, ExecutionResult, PlanStep, StepResult } from '../types/planning';
import { ChloeState } from '../types/state';

interface CheckpointMetadata {
  type: 'pre_planning' | 'post_planning' | 'pre_execution' | 'post_execution' | 'rollback';
  fromCheckpoint?: string;
  planId?: string;
  stepIndex?: number;
}

interface RetryStrategy {
  maxRetries: number;
  backoffFactor: number;
  maxBackoff: number;
  retryOnErrors: string[];
}

interface PlanAdaptationConfig {
  maxAdaptations: number;
  adaptationThreshold: number;
  learningRate: number;
}

export class EnhancedPlanningRecovery {
  private stateManager: StateManager;
  private taskLogger?: TaskLogger;
  private retryStrategies: Map<string, RetryStrategy>;
  private planAdaptationConfig: PlanAdaptationConfig;
  private currentPlanId: string | null = null;
  private adaptationHistory: Map<string, number> = new Map();

  constructor(
    stateManager: StateManager,
    taskLogger?: TaskLogger,
    planAdaptationConfig?: Partial<PlanAdaptationConfig>
  ) {
    this.stateManager = stateManager;
    this.taskLogger = taskLogger;
    this.retryStrategies = new Map();
    this.planAdaptationConfig = {
      maxAdaptations: planAdaptationConfig?.maxAdaptations ?? 3,
      adaptationThreshold: planAdaptationConfig?.adaptationThreshold ?? 0.7,
      learningRate: planAdaptationConfig?.learningRate ?? 0.1
    };

    // Initialize default retry strategies
    this.initializeRetryStrategies();
  }

  private initializeRetryStrategies(): void {
    // Default retry strategy for general errors
    this.retryStrategies.set('default', {
      maxRetries: 3,
      backoffFactor: 2,
      maxBackoff: 30000, // 30 seconds
      retryOnErrors: ['timeout', 'network_error', 'rate_limit']
    });

    // Retry strategy for planning errors
    this.retryStrategies.set('planning', {
      maxRetries: 2,
      backoffFactor: 1.5,
      maxBackoff: 15000, // 15 seconds
      retryOnErrors: ['planning_error', 'invalid_plan', 'timeout']
    });

    // Retry strategy for execution errors
    this.retryStrategies.set('execution', {
      maxRetries: 3,
      backoffFactor: 2,
      maxBackoff: 30000, // 30 seconds
      retryOnErrors: ['execution_error', 'resource_error', 'timeout']
    });
  }

  /**
   * Create a checkpoint for the current state
   */
  async createCheckpoint(
    state: ChloeState,
    metadata: CheckpointMetadata
  ): Promise<string> {
    try {
      const checkpointId = await this.stateManager.createCheckpoint(state, metadata);
      this.taskLogger?.logAction('Created checkpoint', {
        checkpointId,
        metadata,
        timestamp: new Date()
      });
      return checkpointId;
    } catch (error) {
      this.taskLogger?.logAction('Error creating checkpoint', {
        error: error instanceof Error ? error.message : String(error),
        metadata
      });
      throw error;
    }
  }

  /**
   * Rollback to a previous checkpoint
   */
  async rollback(checkpointId: string): Promise<ChloeState | null> {
    try {
      const restoredState = await this.stateManager.rollback(checkpointId);
      if (restoredState) {
        this.taskLogger?.logAction('Rolled back to checkpoint', {
          checkpointId,
          timestamp: new Date()
        });
        return restoredState as unknown as ChloeState;
      }
      return null;
    } catch (error) {
      this.taskLogger?.logAction('Error rolling back to checkpoint', {
        checkpointId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Execute a function with retry strategy
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    strategyKey: string = 'default'
  ): Promise<T> {
    const strategy = this.retryStrategies.get(strategyKey) || this.retryStrategies.get('default')!;
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < strategy.maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable
        const isRetryable = strategy.retryOnErrors.some(errorType => 
          lastError!.message.toLowerCase().includes(errorType.toLowerCase())
        );

        if (!isRetryable) {
          throw lastError;
        }

        retries++;
        
        // Calculate backoff time with exponential backoff
        const backoffTime = Math.min(
          Math.pow(strategy.backoffFactor, retries) * 1000,
          strategy.maxBackoff
        );

        this.taskLogger?.logAction('Retrying operation', {
          attempt: retries,
          maxRetries: strategy.maxRetries,
          backoffTime,
          error: lastError.message
        });

        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }

    if (!lastError) {
      throw new Error(`Max retries (${strategy.maxRetries}) exceeded`);
    }
    throw lastError;
  }

  /**
   * Adapt a plan based on execution results
   */
  async adaptPlan(
    originalPlan: PlanWithSteps,
    executionResult: ExecutionResult
  ): Promise<PlanWithSteps> {
    if (!this.currentPlanId) {
      this.currentPlanId = `plan_${Date.now()}`;
    }

    const adaptationCount = this.adaptationHistory.get(this.currentPlanId) || 0;
    
    if (adaptationCount >= this.planAdaptationConfig.maxAdaptations) {
      this.taskLogger?.logAction('Max adaptations reached', {
        planId: this.currentPlanId,
        adaptations: adaptationCount
      });
      return originalPlan;
    }

    // Calculate success rate
    const successRate = executionResult.stepResults?.filter((step: StepResult) => step.success).length || 0;
    const totalSteps = executionResult.stepResults?.length || 0;
    const currentSuccessRate = totalSteps > 0 ? successRate / totalSteps : 0;

    // Only adapt if success rate is below threshold
    if (currentSuccessRate >= this.planAdaptationConfig.adaptationThreshold) {
      return originalPlan;
    }

    // Increment adaptation count
    this.adaptationHistory.set(this.currentPlanId, adaptationCount + 1);

    // Create adapted plan
    const adaptedPlan: PlanWithSteps = {
      ...originalPlan,
      steps: originalPlan.steps.map((step: PlanStep, index: number) => {
        const stepResult = executionResult.stepResults?.[index];
        
        // If step failed, add more detail or alternative approach
        if (stepResult && !stepResult.success) {
          return {
            ...step,
            description: `${step.description} (Adapted: ${stepResult.output})`,
            metadata: {
              ...step.metadata,
              adaptationCount: (step.metadata?.adaptationCount || 0) + 1,
              lastError: stepResult.output
            }
          };
        }
        
        return step;
      })
    };

    this.taskLogger?.logAction('Plan adapted', {
      planId: this.currentPlanId,
      originalSuccessRate: currentSuccessRate,
      adaptations: adaptationCount + 1
    });

    return adaptedPlan;
  }

  /**
   * Reset the current plan state
   */
  resetPlanState(): void {
    this.currentPlanId = null;
    this.adaptationHistory.clear();
  }
} 