/**
 * ExplicitTimeStrategy.ts - Explicit Time Scheduling Strategy
 * 
 * This file provides a scheduling strategy for tasks with an explicit scheduled time.
 */

import { ulid } from 'ulid';
import { Task, TaskScheduleType } from '../../models/Task.model';
import { SchedulingStrategy } from '../../strategies/SchedulingStrategy.interface';

/**
 * Strategy for scheduling tasks with an explicit scheduled time
 */
export class ExplicitTimeStrategy implements SchedulingStrategy {
  /**
   * Unique identifier for the strategy
   */
  public readonly strategyId: string;
  
  /**
   * Human-readable name of the strategy
   */
  public readonly name: string = 'Explicit Time Strategy';

  /**
   * Create a new ExplicitTimeStrategy
   */
  constructor() {
    this.strategyId = `explicit-time-strategy-${ulid()}`;
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
      console.log("🔍 TIMING DEBUG: ExplicitTimeStrategy - Task doesn't apply", {
        taskId: task.id,
        scheduleType: task.scheduleType,
        hasScheduledTime: !!task.scheduledTime
      });
      return false;
    }

    const now = referenceTime || new Date();
    const isDue = task.scheduledTime !== undefined && task.scheduledTime <= now;
    
    console.log("🔍 TIMING DEBUG: ExplicitTimeStrategy - Due check", {
      taskId: task.id,
      taskName: task.name,
      scheduledTime: task.scheduledTime instanceof Date ? task.scheduledTime.toISOString() : task.scheduledTime,
      scheduledTimeMs: task.scheduledTime instanceof Date ? task.scheduledTime.getTime() : null,
      currentTime: now.toISOString(),
      currentTimeMs: now.getTime(),
      timeDifference: task.scheduledTime instanceof Date ? (task.scheduledTime.getTime() - now.getTime()) : null,
      timeDifferenceSeconds: task.scheduledTime instanceof Date ? Math.round((task.scheduledTime.getTime() - now.getTime()) / 1000) : null,
      isDue,
      reason: !isDue ? (task.scheduledTime instanceof Date ? 'Scheduled time is in the future' : 'No scheduled time') : 'Task is due'
    });
    
    // Task is due if it has a scheduled time that is in the past or now
    return isDue;
  }

  /**
   * Calculate the next execution time for a task
   * 
   * @param task - The task to calculate for
   * @param lastExecutionTime - Optional timestamp of the last execution
   * @returns The next execution time or null if not applicable
   */
  async calculateNextExecutionTime(task: Task, lastExecutionTime?: Date): Promise<Date | null> {
    if (!this.appliesTo(task) || !task.scheduledTime) {
      return null;
    }

    // For explicit time tasks, the next execution time is the scheduled time
    // Once it's executed, there's no next execution unless rescheduled
    const now = new Date();
    
    // If the task has been executed after the scheduled time, there's no next execution
    if (lastExecutionTime && lastExecutionTime >= task.scheduledTime) {
      return null;
    }
    
    return task.scheduledTime;
  }

  /**
   * Check if this strategy applies to a given task
   * 
   * @param task - The task to check
   * @returns true if this strategy applies to the task
   */
  appliesTo(task: Task): boolean {
    // This strategy applies to tasks with the EXPLICIT schedule type and a defined scheduledTime
    return task.scheduleType === TaskScheduleType.EXPLICIT && task.scheduledTime !== undefined;
  }
} 