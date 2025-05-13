/**
 * Executor.ts - Shared task execution system
 * 
 * This module provides:
 * - Execution of planned tasks
 * - Step-by-step task tracking
 * - Error handling and recovery
 * - Execution result reporting
 */

import { ChatOpenAI } from '@langchain/openai';
import { Plan } from '../planning/Planner';
import { PlanStep } from '../../../lib/shared/types/agentTypes';
import { ToolRouter, ToolResult } from '../tools/ToolRouter';
import { AgentMonitor } from '../monitoring/AgentMonitor';
import { TaskStatus as ConstantsTaskStatus } from '../../../constants/task';
import { TaskStatus } from '../../../agents/shared/types/TaskTypes';

// Execution status enum
export enum ExecutionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

// Step execution result
export interface StepExecutionResult {
  stepId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  toolResults?: ToolResult[];
  output?: string;
  error?: string;
}

// Full execution result
export interface ExecutionResult {
  planId: string;
  agentId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  stepResults: StepExecutionResult[];
  finalOutput?: string;
  success: boolean;
  error?: string;
}

// Execution options
export interface ExecutionOptions {
  dryRun?: boolean;
  stopOnError?: boolean;
  maxRetries?: number;
  autonomyLevel?: number;
  requireConfirmation?: boolean;
  timeoutMs?: number;
}

// Execution context
export interface ExecutionContext {
  agentId: string;
  sessionId?: string;
  variables?: Record<string, any>;
  memory?: any;
  previousResults?: Record<string, any>;
  // Delegation tracking fields
  parentTaskId?: string;
  delegationContextId?: string;
  originAgentId?: string;
  agent?: any;
}

/**
 * Run a function with retry logic and timeout support
 * @param fn Function to run
 * @param maxRetries Maximum retry attempts
 * @param baseDelay Base delay in ms before retrying
 * @param timeoutMs Optional timeout in ms
 * @param context Optional execution context for logging
 */
async function runWithRetries<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 1000,
  timeoutMs?: number,
  context?: {
    agentId: string;
    taskId: string;
    stepId?: string;
    memory?: any;
  }
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If a timeout is specified, race the function against a timeout promise
      if (timeoutMs) {
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Execution timeout exceeded')), timeoutMs)
          ),
        ]);
        return result;
      }
      
      // No timeout specified, just run the function
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      
      // If this was the last attempt, rethrow the error
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Log the retry attempt if context is provided
      if (context) {
        const reason = lastError.message;
        
        // Log retry event
        AgentMonitor.log({
          agentId: context.agentId,
          taskId: context.taskId,
          eventType: 'error',
          timestamp: Date.now(),
          metadata: { attempt, reason, stepId: context.stepId, isRetry: true }
        });
        
        // Store in agent memory if available
        if (context.memory && typeof context.memory.write === 'function') {
          context.memory.write({
            content: `Retry ${attempt + 1}/${maxRetries} on ${context.stepId ? `step ${context.stepId}` : 'task'} due to: ${reason}`,
            scope: 'reflections',
            kind: 'feedback',
            timestamp: Date.now(),
            relevance: 0.6,
            tags: ['retry', context.stepId || context.taskId]
          });
        }

        console.log(`Retry attempt ${attempt + 1}/${maxRetries} due to: ${reason}`);
      }
      
      // Calculate delay with exponential backoff (base * 2^attempt)
      const delay = baseDelay * Math.pow(2, attempt);
      
      // Wait before the next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never be reached, but TypeScript requires it
  throw lastError || new Error('Maximum retry attempts reached');
}

/**
 * Shared task executor for all agents
 */
export class Executor {
  private model: ChatOpenAI;
  private toolRouter: ToolRouter;
  private initialized: boolean = false;
  private activeExecutions: Map<string, ExecutionResult> = new Map();
  
  constructor(model: ChatOpenAI, toolRouter: ToolRouter) {
    this.model = model;
    this.toolRouter = toolRouter;
  }
  
  /**
   * Initialize the executor
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Executor...');
      
      // Initialization logic will be added here
      
      this.initialized = true;
      console.log('Executor initialized successfully');
    } catch (error) {
      console.error('Error initializing Executor:', error);
      throw error;
    }
  }
  
  /**
   * Execute a plan with proper agent context
   */
  async executePlan(
    plan: Plan,
    context: ExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    // Get plan-level retry options
    const planRetryCount = plan.retryCount !== undefined ? plan.retryCount : 2;
    const planRetryDelayMs = plan.retryDelayMs !== undefined ? plan.retryDelayMs : 2000;
    const planTimeoutMs = options.timeoutMs || plan.timeoutMs;
    
    // Setup retry context for plan-level retries
    const planLogContext = {
      agentId: context.agentId,
      taskId: `plan_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      memory: context.memory
    };
    
    // Execute with retry logic at the plan level
    return runWithRetries(
      async () => {
        const startTime = Date.now();
        const taskId = `exec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        try {
          console.log(`Executing plan for agent ${context.agentId}`);
          
          // Ensure delegation tracking fields are passed through
          if (context.delegationContextId) {
            plan.context.delegationContextId = context.delegationContextId;
          }
          
          if (context.parentTaskId) {
            context.parentTaskId = context.parentTaskId;
          }
          
          if (context.originAgentId) {
            context.originAgentId = context.originAgentId;
          }
          
          // Log task start with delegation context
          AgentMonitor.log({
            agentId: context.agentId,
            taskId,
            taskType: plan.context.goal || 'execution',
            eventType: 'task_start',
            timestamp: startTime,
            parentTaskId: context.parentTaskId || context.sessionId,
            delegationContextId: context.delegationContextId,
            metadata: { 
              planSteps: plan.steps.length,
              planGoal: plan.context.goal,
              options,
              originAgentId: context.originAgentId || context.agentId
            }
          });
          
          // Create execution result object
          const executionId = `exec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const executionResult: ExecutionResult = {
            planId: taskId,
            agentId: context.agentId,
            status: ExecutionStatus.IN_PROGRESS,
            startTime: new Date(),
            stepResults: [],
            success: false
          };
          
          // Track active execution
          this.activeExecutions.set(executionId, executionResult);
          
          // Check if this is a dry run
          if (options.dryRun) {
            console.log(`Dry run for plan, not executing steps`);
            executionResult.status = ExecutionStatus.COMPLETED;
            executionResult.endTime = new Date();
            executionResult.success = true;
            executionResult.finalOutput = 'Dry run completed successfully';
            
            // Log task end for dry run
            AgentMonitor.log({
              agentId: context.agentId,
              taskId,
              taskType: plan.context.goal || 'execution',
              eventType: 'task_end',
              status: 'success',
              timestamp: Date.now(),
              durationMs: Date.now() - startTime,
              parentTaskId: context.sessionId,
              metadata: { dryRun: true }
            });
            
            return executionResult;
          }
          
          // Execute each step with retry logic
          for (const plannerStep of plan.steps) {
            // Convert PlanStep from Planner.ts to PlanStep from agentTypes.ts
            const step = this.convertToPlanStep(plannerStep, executionId);
            
            // Get retry options from step or default values
            const stepRetryCount = step.retryCount !== undefined ? step.retryCount : 1;
            const stepRetryDelayMs = step.retryDelayMs !== undefined ? step.retryDelayMs : 1000;
            const stepTimeoutMs = step.timeoutMs !== undefined ? step.timeoutMs : undefined;
            
            // Execute step with retry logic
            const stepLogContext = {
              agentId: context.agentId,
              taskId,
              stepId: step.id,
              memory: context.memory
            };
            
            try {
              const stepResult = await runWithRetries(
                () => this.executeStep(step, context, options),
                stepRetryCount,
                stepRetryDelayMs,
                stepTimeoutMs,
                stepLogContext
              );
              
              executionResult.stepResults.push(stepResult);
              
              // Stop on error if configured
              if (stepResult.status === ExecutionStatus.FAILED && options.stopOnError) {
                console.log(`Step ${stepResult.stepId} failed, stopping execution as stopOnError is true`);
                executionResult.status = ExecutionStatus.FAILED;
                executionResult.endTime = new Date();
                executionResult.success = false;
                executionResult.error = `Failed at step ${stepResult.stepId}: ${stepResult.error}`;
                
                // Log task end with failure
                AgentMonitor.log({
                  agentId: context.agentId,
                  taskId,
                  taskType: plan.context.goal || 'execution',
                  eventType: 'task_end',
                  status: 'failure',
                  timestamp: Date.now(),
                  durationMs: Date.now() - startTime,
                  errorMessage: executionResult.error,
                  parentTaskId: context.sessionId,
                  metadata: { 
                    completedSteps: executionResult.stepResults.length,
                    totalSteps: plan.steps.length 
                  }
                });
                
                break;
              }
            } catch (error) {
              // All retries failed for this step
              const errorMessage = error instanceof Error ? error.message : String(error);
              const stepResult: StepExecutionResult = {
                stepId: step.id,
                status: ExecutionStatus.FAILED,
                startTime: new Date(),
                endTime: new Date(),
                error: `Max retries exceeded: ${errorMessage}`
              };
              
              executionResult.stepResults.push(stepResult);
              
              if (options.stopOnError) {
                executionResult.status = ExecutionStatus.FAILED;
                executionResult.endTime = new Date();
                executionResult.success = false;
                executionResult.error = `Max retries exceeded for step ${step.id}: ${errorMessage}`;
                break;
              }
            }
          }
          
          // If we completed all steps without failing
          if (executionResult.status !== ExecutionStatus.FAILED) {
            executionResult.status = ExecutionStatus.COMPLETED;
            executionResult.endTime = new Date();
            executionResult.success = true;
            
            // Generate final output based on step results
            const completedSteps = executionResult.stepResults.filter(
              step => step.status === ExecutionStatus.COMPLETED
            );
            
            executionResult.finalOutput = `Completed ${completedSteps.length} of ${plan.steps.length} steps successfully.`;
            
            // Log task end with success including delegation context
            AgentMonitor.log({
              agentId: context.agentId,
              taskId,
              taskType: plan.context.goal || 'execution',
              eventType: 'task_end',
              status: 'success',
              timestamp: Date.now(),
              durationMs: Date.now() - startTime,
              parentTaskId: context.parentTaskId || context.sessionId,
              delegationContextId: context.delegationContextId,
              metadata: { 
                completedSteps: completedSteps.length,
                totalSteps: plan.steps.length,
                originAgentId: context.originAgentId || context.agentId
              }
            });
            
            // Trigger the postTaskHook for ethics reflection if agent is provided
            if (context.agent && typeof context.agent.postTaskHook === 'function') {
              try {
                await context.agent.postTaskHook(taskId);
              } catch (error) {
                console.error(`Error in postTaskHook for agent ${context.agentId}:`, error);
                // Non-critical, so we don't affect the main execution result
              }
            }
          }
          
          return executionResult;
        } catch (error) {
          // Log execution error
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Error executing plan:`, error);
          
          AgentMonitor.log({
            agentId: context.agentId,
            taskId,
            taskType: plan.context.goal || 'execution',
            eventType: 'error',
            status: 'failure',
            timestamp: Date.now(),
            durationMs: Date.now() - startTime,
            errorMessage,
            parentTaskId: context.parentTaskId || context.sessionId,
            delegationContextId: context.delegationContextId
          });
          
          // Trigger the postTaskHook for ethics reflection even on failure
          if (context.agent && typeof context.agent.postTaskHook === 'function') {
            try {
              await context.agent.postTaskHook(taskId);
            } catch (hookError) {
              console.error(`Error in postTaskHook for agent ${context.agentId}:`, hookError);
              // Non-critical, so we don't affect the main execution result
            }
          }
          
          return {
            planId: taskId,
            agentId: context.agentId,
            status: ExecutionStatus.FAILED,
            startTime: new Date(startTime),
            endTime: new Date(),
            stepResults: [],
            success: false,
            error: errorMessage
          };
        }
      },
      planRetryCount,
      planRetryDelayMs,
      planTimeoutMs,
      planLogContext
    );
  }
  
  /**
   * Execute a single step in the plan
   */
  private async executeStep(
    step: PlanStep,
    context: ExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<StepExecutionResult> {
    const stepStartTime = Date.now();
    
    try {
      console.log(`Executing step ${step.id}: ${step.description}`);
      
      // Log step start with delegation context
      AgentMonitor.log({
        agentId: context.agentId,
        taskId: step.id,
        taskType: 'step',
        eventType: 'task_start',
        timestamp: stepStartTime,
        parentTaskId: context.sessionId,
        delegationContextId: context.delegationContextId,
        metadata: { 
          description: step.description,
          tool: step.tool,
          originAgentId: context.originAgentId || context.agentId
        }
      });
      
      const stepResult: StepExecutionResult = {
        stepId: step.id,
        status: ExecutionStatus.IN_PROGRESS,
        startTime: new Date(),
        toolResults: []
      };
      
      // Execute using appropriate tool
      if (step.tool) {
        // Execute with specified tool
        const toolName = step.tool;
        
        // Build parameters (would normally be extracted from step description by LLM)
        const params = { action: step.description, ...(step.params || {}) };
        
        // Log tool start
        AgentMonitor.log({
          agentId: context.agentId,
          taskId: step.id,
          taskType: 'step',
          toolUsed: toolName,
          eventType: 'tool_start',
          timestamp: Date.now(),
          parentTaskId: context.sessionId
        });
        
        const toolStartTime = Date.now();
        
        // Execute the tool with a local timeout if specified
        let toolResult: ToolResult;
        try {
          // Execute the tool with better error handling
          toolResult = await this.toolRouter.executeTool(
            context.agentId,
            toolName,
            params,
            { step, context }
          );
        } catch (error) {
          // Handle tool execution errors
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Tool execution error for ${toolName}:`, error);
          
          toolResult = {
            success: false,
            error: `Tool execution failed: ${errorMessage}`,
            data: null
          };
        }
        
        // Log tool end
        AgentMonitor.log({
          agentId: context.agentId,
          taskId: step.id,
          taskType: 'step',
          toolUsed: toolName,
          eventType: 'tool_end',
          status: toolResult.success ? 'success' : 'failure',
          timestamp: Date.now(),
          durationMs: Date.now() - toolStartTime,
          errorMessage: toolResult.error,
          parentTaskId: context.sessionId,
          metadata: { 
            resultData: toolResult.data ? JSON.stringify(toolResult.data).substring(0, 100) : undefined,
            retryCount: step.retryCount,
            timeoutMs: step.timeoutMs
          }
        });
        
        stepResult.toolResults!.push(toolResult);
        
        if (!toolResult.success) {
          stepResult.status = ExecutionStatus.FAILED;
          stepResult.error = toolResult.error;
          
          // Throw the error to trigger retry if enabled
          throw new Error(toolResult.error || 'Tool execution failed');
        }
      } else {
        // Just mark as complete for now
        // In real implementation, would use LLM to determine what tool to use
        stepResult.output = `Simulated execution of: ${step.description}`;
      }
      
      // If we didn't fail during tool execution
      if (stepResult.status !== ExecutionStatus.FAILED) {
        stepResult.status = ExecutionStatus.COMPLETED;
      }
      
      stepResult.endTime = new Date();
      
      // Log step end
      AgentMonitor.log({
        agentId: context.agentId,
        taskId: step.id,
        taskType: 'step',
        eventType: 'task_end',
        status: stepResult.status === ExecutionStatus.COMPLETED ? 'success' : 'failure',
        timestamp: Date.now(),
        durationMs: Date.now() - stepStartTime,
        errorMessage: stepResult.error,
        parentTaskId: context.sessionId,
        metadata: { 
          output: stepResult.output ? stepResult.output.substring(0, 100) : undefined
        }
      });
      
      return stepResult;
    } catch (error) {
      console.error(`Error executing step ${step.id}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log error
      AgentMonitor.log({
        agentId: context.agentId,
        taskId: step.id,
        taskType: 'step',
        eventType: 'error',
        status: 'failure',
        timestamp: Date.now(),
        durationMs: Date.now() - stepStartTime,
        errorMessage,
        parentTaskId: context.sessionId
      });
      
      return {
        stepId: step.id,
        status: ExecutionStatus.FAILED,
        startTime: new Date(),
        endTime: new Date(),
        error: `Step execution error: ${errorMessage}`
      };
    }
  }
  
  /**
   * Get the status of an active execution
   */
  getExecutionStatus(executionId: string): ExecutionResult | null {
    return this.activeExecutions.get(executionId) || null;
  }
  
  /**
   * Cancel an active execution
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }
    
    execution.status = ExecutionStatus.CANCELLED;
    execution.endTime = new Date();
    return true;
  }
  
  /**
   * Check if executor is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Shutdown the executor
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Executor...');
    
    // Cancel any active executions
    Array.from(this.activeExecutions.entries()).forEach(([executionId, execution]) => {
      if (execution.status === ExecutionStatus.IN_PROGRESS || 
          execution.status === ExecutionStatus.PENDING) {
        this.cancelExecution(executionId);
        console.log(`Cancelled active execution ${executionId}`);
      }
    });
    
    // Clear the active executions map
    this.activeExecutions.clear();
    
    console.log('Executor shutdown complete');
  }

  /**
   * Convert a PlanStep from Planner.ts to PlanStep from agentTypes.ts
   */
  private convertToPlanStep(
    plannerStep: import('../planning/Planner').PlanStep, 
    executionId: string
  ): PlanStep {
    const stepId = `step_${executionId}_${Date.now()}`;
    
    return {
      id: stepId,
      description: plannerStep.description,
      status: TaskStatus.PENDING,
      tool: plannerStep.requiredTools?.[0], // Use first tool if available
      params: {
        difficulty: plannerStep.difficulty,
        estimatedTimeMinutes: plannerStep.estimatedTimeMinutes,
        dependsOn: plannerStep.dependsOn
      }
    };
  }
} 