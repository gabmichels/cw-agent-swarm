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
import { Plan, PlanStep } from '../planning/Planner';
import { ToolRouter, ToolResult } from '../tools/ToolRouter';

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
    try {
      console.log(`Executing plan ${plan.id} for agent ${context.agentId}`);
      
      // Create execution result object
      const executionId = `exec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const executionResult: ExecutionResult = {
        planId: plan.id,
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
        console.log(`Dry run for plan ${plan.id}, not executing steps`);
        executionResult.status = ExecutionStatus.COMPLETED;
        executionResult.endTime = new Date();
        executionResult.success = true;
        executionResult.finalOutput = 'Dry run completed successfully';
        return executionResult;
      }
      
      // Execute each step
      for (const step of plan.steps) {
        const stepResult = await this.executeStep(step, context, options);
        executionResult.stepResults.push(stepResult);
        
        // Stop on error if configured
        if (stepResult.status === ExecutionStatus.FAILED && options.stopOnError) {
          console.log(`Step ${step.id} failed, stopping execution as stopOnError is true`);
          executionResult.status = ExecutionStatus.FAILED;
          executionResult.endTime = new Date();
          executionResult.success = false;
          executionResult.error = `Failed at step ${step.id}: ${stepResult.error}`;
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
      }
      
      // Clean up
      this.activeExecutions.delete(executionId);
      
      return executionResult;
    } catch (error) {
      console.error(`Error executing plan ${plan.id}:`, error);
      
      // Return error result
      return {
        planId: plan.id,
        agentId: context.agentId,
        status: ExecutionStatus.FAILED,
        startTime: new Date(),
        endTime: new Date(),
        stepResults: [],
        success: false,
        error: `Execution error: ${error instanceof Error ? error.message : String(error)}`
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
    try {
      console.log(`Executing step ${step.id}: ${step.action}`);
      
      const stepResult: StepExecutionResult = {
        stepId: step.id,
        status: ExecutionStatus.IN_PROGRESS,
        startTime: new Date(),
        toolResults: []
      };
      
      // Execute using appropriate tools
      if (step.tools && step.tools.length > 0) {
        // Execute with specified tools
        for (const toolName of step.tools) {
          // Build parameters (would normally be extracted from step action by LLM)
          const params = { action: step.action };
          
          // Execute the tool
          const toolResult = await this.toolRouter.executeTool(
            context.agentId,
            toolName,
            params,
            { step, context }
          );
          
          stepResult.toolResults!.push(toolResult);
          
          if (!toolResult.success) {
            stepResult.status = ExecutionStatus.FAILED;
            stepResult.error = toolResult.error;
            break;
          }
        }
      } else {
        // Just mark as complete for now
        // In real implementation, would use LLM to determine what tool to use
        stepResult.output = `Simulated execution of: ${step.action}`;
      }
      
      // If we didn't fail during tool execution
      if (stepResult.status !== ExecutionStatus.FAILED) {
        stepResult.status = ExecutionStatus.COMPLETED;
      }
      
      stepResult.endTime = new Date();
      return stepResult;
    } catch (error) {
      console.error(`Error executing step ${step.id}:`, error);
      
      return {
        stepId: step.id,
        status: ExecutionStatus.FAILED,
        startTime: new Date(),
        endTime: new Date(),
        error: `Step execution error: ${error instanceof Error ? error.message : String(error)}`
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
} 