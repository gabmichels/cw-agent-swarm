/**
 * SchedulerHelper.ts - Helper functions for scheduling autonomous tasks
 * 
 * This file provides functions to facilitate autonomous scheduling, including
 * setting up polling timers, checking for due tasks, and executing scheduled tasks.
 */

import { ManagerType } from '../base/managers/ManagerType';
import type { DefaultAgent } from '../DefaultAgent';
import type { ScheduledTask } from '../base/managers/SchedulerManager.interface';

/**
 * Scheduler Helper Class
 * 
 * Provides autonomous scheduling capabilities that can be attached to DefaultAgent
 */
export class SchedulerHelper {
  // Scheduling timer reference
  private static schedulingTimer: NodeJS.Timeout | null = null;
  
  /**
   * Setup the scheduling timer for autonomous operation
   * @param agent - The agent to attach the timer to
   * @param intervalMs - Polling interval in milliseconds
   * @returns true if setup was successful
   */
  public static setupSchedulingTimer(agent: DefaultAgent, intervalMs: number = 5000): boolean {
    // Clear existing timer if any
    if (this.schedulingTimer) {
      clearInterval(this.schedulingTimer);
      this.schedulingTimer = null;
    }
    
    console.log(`[SchedulerHelper] Setting up scheduling timer with interval ${intervalMs}ms`);
    
    try {
      // Setup new timer
      this.schedulingTimer = setInterval(async () => {
        try {
          const executedCount = await this.pollForDueTasks(agent);
          if (executedCount > 0) {
            console.log(`[SchedulerHelper] Executed ${executedCount} due tasks`);
          }
        } catch (error) {
          console.error('[SchedulerHelper] Error in scheduling timer:', error);
        }
      }, intervalMs);
      
      // Don't keep Node.js process running just for this timer
      if (this.schedulingTimer.unref) {
        this.schedulingTimer.unref();
      }
      
      console.log('[SchedulerHelper] Scheduling timer has been set up successfully');
      return true;
    } catch (error) {
      console.error('[SchedulerHelper] Failed to set up scheduling timer:', error);
      return false;
    }
  }
  
  /**
   * Poll for tasks that are due and execute them
   * @param agent - The agent to check for due tasks
   * @returns Number of tasks executed
   */
  public static async pollForDueTasks(agent: DefaultAgent): Promise<number> {
    try {
      console.log('[SchedulerHelper] 🕤 Polling for due tasks');
      // Get the scheduler manager
      const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
      if (!schedulerManager) {
        console.error('[SchedulerHelper] No scheduler manager available');
        return 0;
      }
      
      // Get all due tasks
      const dueTasks = await this.getDueTasks(agent);
      
      if (dueTasks.length === 0) {
        return 0;
      }
      
      console.log(`[SchedulerHelper] Found ${dueTasks.length} due tasks`);
      
      // Execute each due task
      let executedCount = 0;
      
      for (const task of dueTasks) {
        try {
          // Execute the task
          const result = await this.executeDueTask(agent, task);
          if (result) {
            executedCount++;
          }
        } catch (error) {
          console.error(`[SchedulerHelper] Error executing task ${task.id}:`, error);
        }
      }
      
      return executedCount;
    } catch (error) {
      console.error('[SchedulerHelper] Error polling for due tasks:', error);
      return 0;
    }
  }
  
  /**
   * Get all tasks that are due for execution
   * @param agent - The agent to check for due tasks
   * @returns Array of due tasks
   */
  public static async getDueTasks(agent: DefaultAgent): Promise<ScheduledTask[]> {
    try {
      // Get the scheduler manager
      const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
      if (!schedulerManager) {
        return [];
      }
      
      // Get all tasks - try different method names since interface might vary
      let tasks: any[] = [];
      
      if (typeof (schedulerManager as any).getTasks === 'function') {
        tasks = await (schedulerManager as any).getTasks();
      } else if (typeof (schedulerManager as any).getAllTasks === 'function') {
        tasks = await (schedulerManager as any).getAllTasks();
      } else if (typeof (schedulerManager as any).getScheduledTasks === 'function') {
        tasks = await (schedulerManager as any).getScheduledTasks();
      } else {
        console.warn('[SchedulerHelper] No method found to get tasks from scheduler manager');
        return [];
      }
      
      // Filter for pending tasks with due scheduledTime
      const now = new Date();
      const dueTasks = tasks.filter((task: ScheduledTask) => {
        // Check if task is pending
        if (task.status !== 'pending') {
          return false;
        }
        
        // Check if task has a scheduled time
        const scheduledTime = task.metadata?.scheduledTime;
        if (!scheduledTime) {
          return false;
        }
        
        // Parse scheduled time based on its type
        let taskTime: Date;
        
        if (scheduledTime instanceof Date) {
          taskTime = scheduledTime;
        } else if (typeof scheduledTime === 'string') {
          taskTime = new Date(scheduledTime);
        } else if (typeof scheduledTime === 'number') {
          taskTime = new Date(scheduledTime);
        } else {
          return false; // Invalid scheduled time format
        }
        
        // Check if the task is due
        return taskTime <= now;
      });
      
      return dueTasks;
    } catch (error) {
      console.error('[SchedulerHelper] Error getting due tasks:', error);
      return [];
    }
  }
  
  /**
   * Execute a due task
   * @param agent - The agent to execute the task with
   * @param task - The task to execute
   * @returns Whether the task was executed successfully
   */
  public static async executeDueTask(agent: DefaultAgent, task: ScheduledTask): Promise<boolean> {
    try {
      // Check if the task has an action and parameters
      const action = task.metadata?.action;
      if (!action || typeof action !== 'string') {
        console.error(`[SchedulerHelper] Task ${task.id} has no action`);
        return false;
      }
      
      // Check if we can handle this action
      if (action === 'processUserInput') {
        const parameters = (task.metadata?.parameters || {}) as { message?: string };
        
        // Safely access message property
        if (!parameters.message || typeof parameters.message !== 'string') {
          console.error(`[SchedulerHelper] Task ${task.id} has invalid message parameter`);
          return false;
        }
        
        // Execute the action
        console.log(`[SchedulerHelper] Executing task ${task.id} with message: ${parameters.message}`);
        await agent.processUserInput(parameters.message);
        
        // Update task status if possible
        const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
        if (schedulerManager && 'updateTask' in schedulerManager) {
          const updateMethod = schedulerManager.updateTask as (id: string, updates: Partial<ScheduledTask>) => Promise<unknown>;
          await updateMethod(task.id, {
            status: 'completed',
            updatedAt: new Date()
          });
          console.log(`[SchedulerHelper] Task ${task.id} marked as completed`);
        }
        
        return true;
      } else {
        console.error(`[SchedulerHelper] Unsupported action: ${action}`);
        return false;
      }
    } catch (error) {
      console.error(`[SchedulerHelper] Error executing task ${task.id}:`, error);
      return false;
    }
  }
  
  /**
   * Clean up resources used by the scheduler helper
   */
  public static cleanup(): void {
    if (this.schedulingTimer) {
      clearInterval(this.schedulingTimer);
      this.schedulingTimer = null;
      console.log('[SchedulerHelper] Scheduling timer has been cleaned up');
    }
  }
} 