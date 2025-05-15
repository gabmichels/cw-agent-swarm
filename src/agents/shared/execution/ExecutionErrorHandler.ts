/**
 * ExecutionErrorHandler.ts - Advanced error handling for task execution
 * 
 * This module provides robust error handling capabilities for execution errors, including:
 * - Error categorization and analysis
 * - Context-aware recovery strategies
 * - Automatic recovery attempt management
 * - Integration with plan recovery system
 * - Reflection-triggered learning after recovery attempts
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentMonitor } from '../monitoring/AgentMonitor';
import { DefaultPlanRecoverySystem } from '../planning/recovery/DefaultPlanRecoverySystem';
import { 
  PlanFailureCategory, 
  PlanFailureSeverity,
  PlanRecoveryActionType,
  RecoveryExecutionResult,
  RecoveryStrategy
} from '../planning/interfaces/PlanRecovery.interface';
import { ReflectionManager, ReflectionTrigger } from '../base/managers/ReflectionManager.interface';
import { ManagerType } from '../base/managers/ManagerType';
import { AgentBase } from '../base/AgentBase.interface';

// Execution error categories
export enum ExecutionErrorCategory {
  TOOL_ERROR = 'tool_error',
  RESOURCE_ERROR = 'resource_error',
  TIMEOUT_ERROR = 'timeout_error',
  PERMISSION_ERROR = 'permission_error',
  VALIDATION_ERROR = 'validation_error',
  LLM_ERROR = 'llm_error',
  DEPENDENCY_ERROR = 'dependency_error',
  UNKNOWN_ERROR = 'unknown_error'
}

// Error recovery options
export interface ErrorRecoveryOptions {
  maxRetries?: number;
  exponentialBackoff?: boolean;
  baseDelayMs?: number;
  maxDelayMs?: number;
  recoveryStrategy?: string;
  fallbackAction?: () => Promise<any>;
  context?: Record<string, unknown>;
}

// Recovery context for improved recovery attempts
export interface RecoveryContext {
  taskId: string;
  stepId?: string;
  agentId: string;
  errorCategory: ExecutionErrorCategory;
  originalError: Error;
  attemptCount: number;
  previousActions: string[];
  errorContext: Record<string, unknown>;
}

// Error handling result
export interface ErrorHandlingResult {
  success: boolean;
  recoveryApplied: boolean;
  strategy?: string;
  action?: string;
  error?: Error;
  result?: any;
  reflectionPerformed?: boolean;
  reflectionId?: string;
}

/**
 * Execution Error Handler for robust error handling and recovery
 */
export class ExecutionErrorHandler {
  private recoverySystem: DefaultPlanRecoverySystem;
  private errorHistory: Map<string, RecoveryContext[]> = new Map();
  private initialized: boolean = false;
  private agent?: AgentBase;

  /**
   * Create a new ExecutionErrorHandler
   */
  constructor(recoverySystem?: DefaultPlanRecoverySystem, agent?: AgentBase) {
    // Use provided recovery system or create a new one
    this.recoverySystem = recoverySystem || new DefaultPlanRecoverySystem();
    this.agent = agent;
  }

  /**
   * Set the agent instance for reflection capabilities
   */
  setAgent(agent: AgentBase): void {
    this.agent = agent;
  }

  /**
   * Initialize the error handler
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    // Initialize the recovery system if not already initialized
    await this.recoverySystem.initialize({ registerDefaultStrategies: true });
    
    // Register additional execution-specific recovery strategies
    await this.registerExecutionRecoveryStrategies();
    
    this.initialized = true;
    return true;
  }
  
  /**
   * Register execution-specific recovery strategies
   */
  private async registerExecutionRecoveryStrategies(): Promise<void> {
    // Create a tool retry strategy
    const toolRetryStrategy: RecoveryStrategy = {
      id: 'execution-tool-retry',
      name: 'Tool Execution Retry Strategy',
      description: 'Retries failed tool executions with exponential backoff',
      handleCategories: [PlanFailureCategory.TOOL_FAILURE, PlanFailureCategory.RESOURCE_UNAVAILABLE],
      canHandle: async (failure) => ({
        canHandle: failure.category === PlanFailureCategory.TOOL_FAILURE || 
                  failure.category === PlanFailureCategory.RESOURCE_UNAVAILABLE,
        confidence: 0.9,
        reason: 'Strategy designed for tool and resource failures'
      }),
      generateRecoveryActions: async (failure) => ([{
        type: PlanRecoveryActionType.RETRY,
        description: 'Retry the failed tool execution with exponential backoff',
        parameters: { 
          maxRetries: 3,
          baseDelayMs: 1000,
          exponentialBackoff: true
        },
        confidence: 0.9,
        successProbability: 0.7,
        estimatedEffort: 2
      }]),
      executeRecoveryAction: async (failure, action) => ({
        success: true,
        action,
        message: 'Retry scheduled',
        durationMs: 0,
        newState: 'resumed'
      })
    };
    
    // Create an alternative tool strategy
    const alternativeToolStrategy: RecoveryStrategy = {
      id: 'execution-alternative-tool',
      name: 'Alternative Tool Strategy',
      description: 'Attempts to use an alternative tool when the primary tool fails',
      handleCategories: [PlanFailureCategory.TOOL_FAILURE],
      canHandle: async (failure) => ({
        canHandle: failure.category === PlanFailureCategory.TOOL_FAILURE,
        confidence: 0.8,
        reason: 'Strategy designed for tool failures'
      }),
      generateRecoveryActions: async (failure) => ([{
        type: PlanRecoveryActionType.SUBSTITUTE,
        description: 'Use an alternative tool to accomplish the same task',
        parameters: { 
          findAlternativeTool: true 
        },
        confidence: 0.8,
        successProbability: 0.7,
        estimatedEffort: 4
      }]),
      executeRecoveryAction: async (failure, action) => ({
        success: true,
        action,
        message: 'Alternative tool scheduled',
        durationMs: 0,
        newState: 'modified'
      })
    };
    
    // Create a skip step strategy
    const skipStepStrategy: RecoveryStrategy = {
      id: 'execution-skip-step',
      name: 'Skip Non-Critical Step Strategy',
      description: 'Skips non-critical steps that fail execution',
      handleCategories: [PlanFailureCategory.TOOL_FAILURE, PlanFailureCategory.RESOURCE_UNAVAILABLE],
      canHandle: async (failure) => ({
        canHandle: failure.severity !== PlanFailureSeverity.CRITICAL && 
                 failure.severity !== PlanFailureSeverity.HIGH,
        confidence: 0.7,
        reason: 'Only applicable for non-critical steps'
      }),
      generateRecoveryActions: async (failure) => ([{
        type: PlanRecoveryActionType.SKIP,
        description: 'Skip this non-critical step and continue execution',
        confidence: 0.7,
        successProbability: 0.8,
        estimatedEffort: 1
      }]),
      executeRecoveryAction: async (failure, action) => ({
        success: true,
        action,
        message: 'Step skipped',
        durationMs: 0,
        newState: 'modified'
      })
    };
    
    // Register all strategies
    await this.recoverySystem.registerRecoveryStrategy(toolRetryStrategy);
    await this.recoverySystem.registerRecoveryStrategy(alternativeToolStrategy);
    await this.recoverySystem.registerRecoveryStrategy(skipStepStrategy);
  }

  /**
   * Categorize an execution error
   */
  categorizeError(error: Error, context?: Record<string, unknown>): ExecutionErrorCategory {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();
    
    // Check for timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return ExecutionErrorCategory.TIMEOUT_ERROR;
    }
    
    // Check for permission errors
    if (
      errorMessage.includes('permission') || 
      errorMessage.includes('access denied') || 
      errorMessage.includes('not authorized')
    ) {
      return ExecutionErrorCategory.PERMISSION_ERROR;
    }
    
    // Check for resource errors
    if (
      errorMessage.includes('resource') || 
      errorMessage.includes('unavailable') ||
      errorMessage.includes('not found')
    ) {
      return ExecutionErrorCategory.RESOURCE_ERROR;
    }
    
    // Check for validation errors
    if (
      errorMessage.includes('invalid') || 
      errorMessage.includes('validation') || 
      errorMessage.includes('schema')
    ) {
      return ExecutionErrorCategory.VALIDATION_ERROR;
    }
    
    // Check for LLM errors
    if (
      errorMessage.includes('model') || 
      errorMessage.includes('token') || 
      errorMessage.includes('completion') ||
      errorMessage.includes('openai') ||
      errorMessage.includes('llm')
    ) {
      return ExecutionErrorCategory.LLM_ERROR;
    }
    
    // Check for tool errors
    if (
      errorMessage.includes('tool') || 
      errorMessage.includes('execution failed') ||
      context?.toolName
    ) {
      return ExecutionErrorCategory.TOOL_ERROR;
    }
    
    // Check for dependency errors
    if (
      errorMessage.includes('depends') || 
      errorMessage.includes('dependency') || 
      errorMessage.includes('required step')
    ) {
      return ExecutionErrorCategory.DEPENDENCY_ERROR;
    }
    
    // Default to unknown error
    return ExecutionErrorCategory.UNKNOWN_ERROR;
  }

  /**
   * Convert execution error category to plan failure category
   */
  private convertToPlanFailureCategory(category: ExecutionErrorCategory): PlanFailureCategory {
    switch (category) {
      case ExecutionErrorCategory.TOOL_ERROR:
        return PlanFailureCategory.TOOL_FAILURE;
      case ExecutionErrorCategory.RESOURCE_ERROR:
        return PlanFailureCategory.RESOURCE_UNAVAILABLE;
      case ExecutionErrorCategory.TIMEOUT_ERROR:
        return PlanFailureCategory.TIMEOUT;
      case ExecutionErrorCategory.PERMISSION_ERROR:
        return PlanFailureCategory.PERMISSION_DENIED;
      case ExecutionErrorCategory.VALIDATION_ERROR:
        return PlanFailureCategory.INVALID_INPUT;
      case ExecutionErrorCategory.LLM_ERROR:
        return PlanFailureCategory.EXTERNAL_API_ERROR;
      case ExecutionErrorCategory.DEPENDENCY_ERROR:
        return PlanFailureCategory.DEPENDENCY_FAILURE;
      case ExecutionErrorCategory.UNKNOWN_ERROR:
      default:
        return PlanFailureCategory.UNKNOWN;
    }
  }

  /**
   * Handle an execution error with recovery
   */
  async handleError(
    error: Error,
    context: {
      taskId: string;
      stepId?: string;
      agentId: string;
      [key: string]: any;
    },
    options: ErrorRecoveryOptions = {}
  ): Promise<ErrorHandlingResult> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Generate a unique error ID for tracking this specific error instance
    const errorId = uuidv4();
    
    // Categorize the error
    const errorCategory = this.categorizeError(error, context);
    
    // Convert to plan failure category
    const failureCategory = this.convertToPlanFailureCategory(errorCategory);
    
    // Log the error in the monitoring system
    AgentMonitor.log({
      agentId: context.agentId,
      taskId: context.taskId,
      eventType: 'error',
      timestamp: Date.now(),
      errorMessage: error.message,
      parentTaskId: context.parentTaskId,
      delegationContextId: context.delegationContextId,
      metadata: { 
        errorCategory,
        errorName: error.name,
        stepId: context.stepId,
        errorId,
        recoveryAttempt: true
      }
    });
    
    try {
      // Create or update recovery context
      let recoveryContexts = this.errorHistory.get(context.taskId) || [];
      const attemptCount = recoveryContexts.filter(c => c.stepId === context.stepId).length;
      
      const recoveryContext: RecoveryContext = {
        taskId: context.taskId,
        stepId: context.stepId,
        agentId: context.agentId,
        errorCategory,
        originalError: error,
        attemptCount,
        previousActions: recoveryContexts
          .filter(c => c.stepId === context.stepId)
          .flatMap(c => c.previousActions),
        errorContext: { ...context }
      };
      
      recoveryContexts.push(recoveryContext);
      this.errorHistory.set(context.taskId, recoveryContexts);
      
      // Record the failure in the recovery system
      const failureId = await this.recoverySystem.recordFailure({
        planId: context.taskId,
        stepId: context.stepId,
        timestamp: new Date(),
        message: error.message,
        details: error,
        errorCode: error.name,
        category: failureCategory,
        severity: this.determineSeverity(errorCategory, context),
        context: { ...context, agentId: context.agentId }
      });
      
      // Get recovery actions
      const recoveryActions = await this.recoverySystem.getRecoveryActions(failureId, {
        recoveryContext,
        options
      });
      
      if (recoveryActions.length === 0) {
        return {
          success: false,
          recoveryApplied: false,
          error
        };
      }
      
      // Execute the most appropriate recovery action
      const recoveryAction = recoveryActions[0]; // Use the highest priority action
      
      const recoveryResult = await this.recoverySystem.executeRecovery(
        failureId,
        recoveryAction.type,
        recoveryAction.parameters
      );
      
      // Whether the recovery was successful or not, trigger a reflection
      // but don't block the recovery process on the reflection completion
      type ReflectionResultInfo = { 
        reflectionPerformed: boolean; 
        reflectionId?: string 
      };

      let reflectionResult: ReflectionResultInfo = { 
        reflectionPerformed: false,
        reflectionId: undefined 
      };
      
      if (this.agent) {
        try {
          // Trigger a reflection with the error and recovery context
          reflectionResult = await this.triggerRecoveryReflection(
            error,
            recoveryContext,
            recoveryResult,
            { failureId, failureCategory, recoveryAction }
          );
        } catch (reflectionError) {
          console.error('Error during recovery reflection:', reflectionError);
          // Keep the default reflectionResult value
        }
      }
      
      if (recoveryResult.success) {
        return {
          success: true,
          recoveryApplied: true,
          strategy: recoveryResult.action.type,
          action: recoveryResult.action.description,
          result: recoveryResult,
          ...reflectionResult
        };
      } else {
        return {
          success: false,
          recoveryApplied: true,
          strategy: recoveryResult.action.type,
          action: recoveryResult.action.description,
          error: new Error(typeof recoveryResult.error === 'string' ? recoveryResult.error : 'Recovery failed'),
          ...reflectionResult
        };
      }
    } catch (recoveryError) {
      console.error('Error during recovery process:', recoveryError);
      
      // If recovery fails, try fallback action if provided
      if (options.fallbackAction) {
        try {
          const fallbackResult = await options.fallbackAction();
          return {
            success: true,
            recoveryApplied: true,
            strategy: 'fallback',
            result: fallbackResult
          };
        } catch (fallbackError) {
          return {
            success: false,
            recoveryApplied: true,
            strategy: 'fallback',
            error: fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError))
          };
        }
      }
      
      return {
        success: false,
        recoveryApplied: false,
        error: recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError))
      };
    }
  }
  
  /**
   * Trigger a reflection based on error recovery
   * @param error The original error
   * @param context The recovery context
   * @param recoveryResult The recovery execution result
   * @param additionalContext Additional context information
   * @returns Promise resolving to reflection result info
   */
  private async triggerRecoveryReflection(
    error: Error,
    context: RecoveryContext,
    recoveryResult: RecoveryExecutionResult,
    additionalContext: {
      failureId: string;
      failureCategory: PlanFailureCategory;
      recoveryAction: any;
    }
  ): Promise<{ reflectionPerformed: boolean; reflectionId?: string }> {
    if (!this.agent) {
      return { reflectionPerformed: false };
    }

    // Get the reflection manager from the agent
    const reflectionManager = this.agent.getManager<ReflectionManager>(ManagerType.REFLECTION);
    if (!reflectionManager) {
      return { reflectionPerformed: false };
    }

    try {
      // Create context for reflection including error, recovery attempts, and outcome
      const reflectionContext = {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack
        },
        recoveryContext: {
          taskId: context.taskId,
          stepId: context.stepId,
          errorCategory: context.errorCategory,
          attemptCount: context.attemptCount,
          previousActions: context.previousActions
        },
        recoveryResult: {
          success: recoveryResult.success,
          action: recoveryResult.action,
          error: recoveryResult.error,
          duration: recoveryResult.durationMs
        },
        failure: {
          id: additionalContext.failureId,
          category: additionalContext.failureCategory
        }
      };

      // Trigger reflection with ERROR trigger type
      const result = await reflectionManager.reflect(
        ReflectionTrigger.ERROR,
        reflectionContext
      );

      return {
        reflectionPerformed: result.success,
        reflectionId: result.success ? result.id : undefined
      };
    } catch (reflectionError) {
      console.error('Error during recovery reflection:', reflectionError);
      return { reflectionPerformed: false };
    }
  }
  
  /**
   * Determine the severity of an error
   */
  private determineSeverity(
    category: ExecutionErrorCategory,
    context: Record<string, any>
  ): PlanFailureSeverity {
    // Determine severity based on error category and context
    switch (category) {
      case ExecutionErrorCategory.PERMISSION_ERROR:
        return PlanFailureSeverity.HIGH; // Security-related errors are high severity
        
      case ExecutionErrorCategory.DEPENDENCY_ERROR:
        return PlanFailureSeverity.HIGH; // Dependency failures can block the entire plan
        
      case ExecutionErrorCategory.RESOURCE_ERROR:
        return PlanFailureSeverity.MEDIUM; // Resource issues might be temporary
        
      case ExecutionErrorCategory.TIMEOUT_ERROR:
        return PlanFailureSeverity.MEDIUM; // Timeouts might be temporary
        
      case ExecutionErrorCategory.TOOL_ERROR:
        // Check if the tool is marked as critical
        return context.isCriticalTool ? PlanFailureSeverity.HIGH : PlanFailureSeverity.MEDIUM;
        
      case ExecutionErrorCategory.VALIDATION_ERROR:
        return PlanFailureSeverity.MEDIUM; // Validation errors might be fixable
        
      case ExecutionErrorCategory.LLM_ERROR:
        return PlanFailureSeverity.MEDIUM; // LLM errors might be temporary
        
      case ExecutionErrorCategory.UNKNOWN_ERROR:
      default:
        return PlanFailureSeverity.MEDIUM; // Default to medium for unknown errors
    }
  }
  
  /**
   * Get recovery history for a task
   */
  getRecoveryHistory(taskId: string): RecoveryContext[] {
    return this.errorHistory.get(taskId) || [];
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory.clear();
  }
  
  /**
   * Shutdown the error handler
   */
  async shutdown(): Promise<void> {
    // Clear any state
    this.errorHistory.clear();
    
    // Shutdown the recovery system
    await this.recoverySystem.shutdown();
    
    this.initialized = false;
  }
} 