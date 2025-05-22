/**
 * IntervalStrategy.ts - Interval Scheduling Strategy
 * 
 * This file provides a scheduling strategy for tasks that run at regular intervals.
 */

import { ulid } from 'ulid';
import { Task, TaskScheduleType } from '../../models/Task.model';
import { SchedulingStrategy } from '../../strategies/SchedulingStrategy.interface';

/**
 * Helper function to parse interval expression
 * 
 * @param expression - Interval expression (e.g., "1h", "30m", "1d")
 * @returns Milliseconds represented by the expression
 */
function parseIntervalExpression(expression: string): number {
  const regex = /^(\d+)([smhdwMy])$/;
  const match = expression.match(regex);

  if (!match) {
    throw new Error(`Invalid interval expression: ${expression}`);
  }

  const [, valueStr, unit] = match;
  const value = parseInt(valueStr, 10);

  switch (unit) {
    case 's': return value * 1000; // seconds
    case 'm': return value * 60 * 1000; // minutes
    case 'h': return value * 60 * 60 * 1000; // hours
    case 'd': return value * 24 * 60 * 60 * 1000; // days
    case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
    case 'M': return value * 30 * 24 * 60 * 60 * 1000; // months (approx)
    case 'y': return value * 365 * 24 * 60 * 60 * 1000; // years (approx)
    default: throw new Error(`Unknown interval unit: ${unit}`);
  }
}

/**
 * Strategy for scheduling tasks that run at regular intervals
 */
export class IntervalStrategy implements SchedulingStrategy {
  /**
   * Unique identifier for the strategy
   */
  public readonly strategyId: string;
  
  /**
   * Human-readable name of the strategy
   */
  public readonly name: string = 'Interval Strategy';

  /**
   * Create a new IntervalStrategy
   */
  constructor() {
    this.strategyId = `interval-strategy-${ulid()}`;
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
    
    // If the task has never been executed, it's due if the scheduled start time has passed
    if (!task.lastExecutedAt) {
      return task.scheduledTime ? task.scheduledTime <= now : true;
    }

    // Check if the task has reached its maximum executions
    if (task.interval?.maxExecutions !== undefined && 
        task.interval.executionCount >= task.interval.maxExecutions) {
      return false;
    }

    // Calculate when the next execution should be based on the last execution and interval
    const intervalMs = parseIntervalExpression(task.interval!.expression);
    const nextExecutionTime = new Date(task.lastExecutedAt.getTime() + intervalMs);

    // The task is due if the next execution time has been reached
    return nextExecutionTime <= now;
  }

  /**
   * Calculate the next execution time for a task
   * 
   * @param task - The task to calculate for
   * @param lastExecutionTime - Optional timestamp of the last execution
   * @returns The next execution time or null if not applicable
   */
  async calculateNextExecutionTime(task: Task, lastExecutionTime?: Date): Promise<Date | null> {
    if (!this.appliesTo(task) || !task.interval) {
      return null;
    }

    // Check if the task has reached its maximum executions
    if (task.interval.maxExecutions !== undefined && 
        task.interval.executionCount >= task.interval.maxExecutions) {
      return null;
    }

    // Use provided last execution time or task's recorded time
    const lastExecution = lastExecutionTime || task.lastExecutedAt;
    
    // If the task has never been executed, use the scheduled time or current time
    if (!lastExecution) {
      return task.scheduledTime || new Date();
    }

    // Calculate the next execution time based on the interval
    const intervalMs = parseIntervalExpression(task.interval.expression);
    return new Date(lastExecution.getTime() + intervalMs);
  }

  /**
   * Check if this strategy applies to a given task
   * 
   * @param task - The task to check
   * @returns true if this strategy applies to the task
   */
  appliesTo(task: Task): boolean {
    // This strategy applies to tasks with the INTERVAL schedule type and a defined interval
    return task.scheduleType === TaskScheduleType.INTERVAL && 
           task.interval !== undefined && 
           task.interval.expression !== undefined;
  }
} 