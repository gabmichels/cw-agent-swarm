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
      
      // Execute each step
      for (const plannerStep of plan.steps) {
        // Convert PlanStep from Planner.ts to PlanStep from agentTypes.ts
        const step = this.convertToPlanStep(plannerStep, executionId);
        const stepResult = await this.executeStep(step, context, options);
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
        
        // Execute the tool
        const toolResult = await this.toolRouter.executeTool(
          context.agentId,
          toolName,
          params,
          { step, context }
        );
        
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
            resultData: toolResult.data ? JSON.stringify(toolResult.data).substring(0, 100) : undefined
          }
        });
        
        stepResult.toolResults!.push(toolResult);
        
        if (!toolResult.success) {
          stepResult.status = ExecutionStatus.FAILED;
          stepResult.error = toolResult.error;
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
    // Generate a unique ID for the step
    const stepId = `step_${executionId}_${Math.floor(Math.random() * 10000)}`;
    
    // Create a compatible PlanStep
    return {
      id: stepId,
      description: plannerStep.description,
      status: 'pending',
      tool: plannerStep.requiredTools?.[0], // Use first tool if available
      params: {
        difficulty: plannerStep.difficulty,
        estimatedTimeMinutes: plannerStep.estimatedTimeMinutes,
        dependsOn: plannerStep.dependsOn
      }
    };
  }
} 