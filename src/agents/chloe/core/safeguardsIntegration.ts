/**
 * Robust Safeguards Integration Guide
 * 
 * This file demonstrates how to integrate the RobustSafeguards class
 * with various components of the Chloe agent system.
 */

import { TaskLogger as CoreTaskLogger } from './taskLogger';
import { TaskLogger as BaseTaskLogger } from '../task-logger';
import { RobustSafeguards } from './robustSafeguards';
import { Task } from '../types/state';
import { PlanWithSteps } from '../types/planning';

// Helper function to ensure we have the right TaskLogger type
function ensureCompatibleLogger(logger?: BaseTaskLogger | CoreTaskLogger): CoreTaskLogger | undefined {
  if (!logger) return undefined;
  
  // If it's already compatible, return it
  if ('logAction' in logger) {
    return logger as unknown as CoreTaskLogger;
  }
  
  // Otherwise create a simple adapter
  return {
    logAction: (action: string, details?: Record<string, any>) => {
      if ('logAction' in logger) {
        (logger as any).logAction(action, details);
      }
    }
  } as unknown as CoreTaskLogger;
}

/**
 * Example: Integrating RobustSafeguards with Task Execution
 * 
 * This example shows how to use the RobustSafeguards to:
 * 1. Validate a task before execution
 * 2. Check resource limits
 * 3. Use the enhanced circuit breaker pattern
 * 4. Register and execute cleanup tasks
 */
export async function executeTaskWithSafeguards(
  task: Task,
  executeFunction: () => Promise<any>,
  taskLogger?: BaseTaskLogger
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  // Initialize safeguards with compatible logger
  const compatibleLogger = ensureCompatibleLogger(taskLogger);
  const safeguards = new RobustSafeguards(compatibleLogger);
  
  try {
    // Step 1: Validate the task
    if (!safeguards.validateTask(task)) {
      throw new Error('Task validation failed');
    }
    
    // Step 2: Check resource limits
    if (!await safeguards.checkResourceLimits()) {
      throw new Error('Resource limits exceeded');
    }
    
    // Step 3: Register a cleanup task
    const cleanupTaskId = safeguards.registerCleanupTask(
      `Cleanup for task: ${task.id}`,
      ['memory', 'cache'],
      'medium'
    );
    
    // Step 4: Execute with circuit breaker
    const result = await safeguards.executeWithCircuitBreaker(
      'task_execution',
      executeFunction,
      {
        timeout: 300000, // 5 minutes
        fallback: { success: false, error: 'Operation timed out' }
      }
    );
    
    // Step 5: Execute cleanup
    await safeguards.executeCleanupTask(cleanupTaskId);
    
    return {
      success: true,
      result
    };
  } catch (error) {
    compatibleLogger?.logAction('Task execution error', {
      taskId: task.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Example: Integrating RobustSafeguards with Plan Execution
 */
export async function executePlanWithSafeguards(
  plan: PlanWithSteps,
  executePlanFunction: () => Promise<any>,
  taskLogger?: BaseTaskLogger
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  const compatibleLogger = ensureCompatibleLogger(taskLogger);
  const safeguards = new RobustSafeguards(compatibleLogger);
  
  try {
    // Validate the plan
    if (!safeguards.validatePlan(plan)) {
      throw new Error('Plan validation failed');
    }
    
    // Execute with circuit breaker
    const result = await safeguards.executeWithCircuitBreaker(
      'plan_execution',
      executePlanFunction,
      {
        timeout: 600000, // 10 minutes
        fallback: { success: false, error: 'Plan execution timed out' }
      }
    );
    
    return {
      success: true,
      result
    };
  } catch (error) {
    compatibleLogger?.logAction('Plan execution error', {
      planDescription: plan.description,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Example: Monitoring Resource Usage
 */
export async function monitorResources(
  taskLogger?: BaseTaskLogger
): Promise<{
  safeToExecute: boolean;
  metrics?: any;
}> {
  const compatibleLogger = ensureCompatibleLogger(taskLogger);
  const safeguards = new RobustSafeguards(compatibleLogger);
  
  // Monitor resources
  const metrics = await safeguards.monitorResources();
  
  // Check if within limits
  const safeToExecute = await safeguards.checkResourceLimits();
  
  return {
    safeToExecute,
    metrics
  };
}

/**
 * Example: Getting System Status Report
 */
export function getSystemStatus(
  taskLogger?: BaseTaskLogger
): {
  resourceMetrics: any;
  circuitBreakers: any[];
  pendingCleanupTasks: number;
} {
  const compatibleLogger = ensureCompatibleLogger(taskLogger);
  const safeguards = new RobustSafeguards(compatibleLogger);
  return safeguards.getStatusReport();
}

/**
 * Example: Integrating into a Class
 * 
 * This example shows how to integrate RobustSafeguards into a class
 */
export class SafeExecutionManager {
  private safeguards: RobustSafeguards;
  private taskLogger: BaseTaskLogger;
  private compatibleLogger: CoreTaskLogger;
  
  constructor(taskLogger?: BaseTaskLogger) {
    this.taskLogger = taskLogger || new BaseTaskLogger();
    this.compatibleLogger = ensureCompatibleLogger(this.taskLogger) as CoreTaskLogger;
    this.safeguards = new RobustSafeguards(this.compatibleLogger);
  }
  
  async executeTask(task: Task, executeFn: () => Promise<any>): Promise<any> {
    return executeTaskWithSafeguards(task, executeFn, this.taskLogger);
  }
  
  async executePlan(plan: PlanWithSteps, executeFn: () => Promise<any>): Promise<any> {
    return executePlanWithSafeguards(plan, executeFn, this.taskLogger);
  }
  
  async checkSystemHealth(): Promise<boolean> {
    const resources = await this.safeguards.monitorResources();
    const status = this.safeguards.getStatusReport();
    
    this.compatibleLogger.logAction('System health check', {
      memoryUsage: resources.memoryUsage,
      cpuUsage: resources.cpuUsage,
      circuitBreakers: status.circuitBreakers.length,
      pendingCleanupTasks: status.pendingCleanupTasks
    });
    
    return resources.memoryUsage < 0.8 && resources.cpuUsage < 0.7;
  }
  
  async cleanup(): Promise<void> {
    const result = await this.safeguards.executeAllCleanupTasks();
    
    this.compatibleLogger.logAction('System cleanup completed', {
      successfulTasks: result.success,
      failedTasks: result.failure,
      remainingTasks: result.remaining
    });
  }
} 