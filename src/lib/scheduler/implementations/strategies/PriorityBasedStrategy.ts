/**
 * PriorityBasedStrategy.ts - Priority-Based Scheduling Strategy
 * 
 * This file provides a scheduling strategy for tasks that are scheduled based on priority.
 */

import { ulid } from 'ulid';
import { Task, TaskScheduleType, TaskStatus } from '../../models/Task.model';
import { SchedulingStrategy } from '../../strategies/SchedulingStrategy.interface';

/**
 * Strategy for scheduling tasks based on priority
 */
export class PriorityBasedStrategy implements SchedulingStrategy {
  /**
   * Unique identifier for the strategy
   */
  public readonly strategyId: string;
  
  /**
   * Human-readable name of the strategy
   */
  public readonly name: string = 'Priority-Based Strategy';

  /**
   * The minimum priority level for a task to be considered due
   */
  private readonly highPriorityThreshold: number;

  /**
   * The maximum time in milliseconds that a task can remain pending before it's due
   */
  private readonly maxPendingTimeMs: number;

  /**
   * Create a new PriorityBasedStrategy
   * 
   * @param highPriorityThreshold - Minimum priority level for immediate execution (0-10)
   * @param maxPendingTimeMs - Maximum time a task can remain pending in milliseconds
   */
  constructor(highPriorityThreshold: number = 8, maxPendingTimeMs: number = 24 * 60 * 60 * 1000) {
    this.strategyId = `priority-strategy-${ulid()}`;
    this.highPriorityThreshold = highPriorityThreshold;
    this.maxPendingTimeMs = maxPendingTimeMs;
  }

  /**
   * Determine if a task is due according to this strategy
   * 
   * @param task - The task to evaluate
   * @param referenceTime - Optional reference time (defaults to current time)
   * @returns true if the task is due for execution
   */
  async isTaskDue(task: Task, referenceTime?: Date): Promise<boolean> {
    if (!this.appliesTo(task)) {
      return false;
    }

    const now = referenceTime || new Date();
    
    // High priority tasks are always due
    if (task.priority >= this.highPriorityThreshold) {
      return true;
    }

    // For medium and low priority tasks, check how long they've been pending
    const pendingTime = now.getTime() - task.createdAt.getTime();
    const priorityFactor = task.priority / 10; // Normalize priority to 0-1 range
    
    // Calculate adjusted max pending time based on priority
    // Higher priority tasks become due sooner
    const adjustedMaxPendingTime = this.maxPendingTimeMs * (1 - priorityFactor);
    
    // The task is due if it has been pending longer than the adjusted max pending time
    return pendingTime >= adjustedMaxPendingTime;
  }

  /**
   * Calculate the next execution time for a task
   * 
   * @param task - The task to calculate for
   * @param lastExecutionTime - Optional timestamp of the last execution
   * @returns The next execution time or null if not applicable
   */
  async calculateNextExecutionTime(task: Task, lastExecutionTime?: Date): Promise<Date | null> {
    if (!this.appliesTo(task)) {
      return null;
    }

    // For priority-based tasks, calculate when it will become due based on priority
    const priorityFactor = task.priority / 10; // Normalize priority to 0-1 range
    const adjustedMaxPendingTime = this.maxPendingTimeMs * (1 - priorityFactor);
    
    // High priority tasks are due immediately
    if (task.priority >= this.highPriorityThreshold) {
      return new Date();
    }

    // For other tasks, calculate when they'll be due based on creation time
    return new Date(task.createdAt.getTime() + adjustedMaxPendingTime);
  }

  /**
   * Check if this strategy applies to a given task
   * 
   * @param task - The task to check
   * @returns true if this strategy applies to the task
   */
  appliesTo(task: Task): boolean {
    // This strategy applies to tasks with the PRIORITY schedule type
    // or to any PENDING task without an explicit schedule time or interval
    return (
      task.scheduleType === TaskScheduleType.PRIORITY ||
      (
        task.status === TaskStatus.PENDING &&
        task.scheduledTime === undefined &&
        task.scheduleType !== TaskScheduleType.INTERVAL
      )
    );
  }
} 