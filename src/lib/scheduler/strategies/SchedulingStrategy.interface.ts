/**
 * SchedulingStrategy.interface.ts - Scheduling Strategy Interface
 * 
 * This interface defines the contract for components that implement different
 * task scheduling strategies.
 */

import { Task } from '../models/Task.model';

/**
 * Interface for scheduling strategies
 */
export interface SchedulingStrategy {
  /**
   * Unique identifier for the strategy
   */
  readonly strategyId: string;
  
  /**
   * Human-readable name of the strategy
   */
  readonly name: string;
  
  /**
   * Determine if a task is due according to this strategy
   * 
   * @param task - The task to evaluate
   * @param referenceTime - Optional reference time (defaults to current time)
   * @returns true if the task is due for execution
   */
  isTaskDue(task: Task, referenceTime?: Date): Promise<boolean>;
  
  /**
   * Calculate the next execution time for a task
   * 
   * @param task - The task to calculate for
   * @param lastExecutionTime - Optional timestamp of the last execution
   * @returns The next execution time or null if not applicable
   */
  calculateNextExecutionTime(task: Task, lastExecutionTime?: Date): Promise<Date | null>;
  
  /**
   * Check if this strategy applies to a given task
   * 
   * @param task - The task to check
   * @returns true if this strategy applies to the task
   */
  appliesTo(task: Task): boolean;
} 