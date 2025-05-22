/**
 * TaskScheduler.interface.ts - Task Scheduler Interface
 * 
 * This interface defines the contract for components that handle task scheduling logic.
 * The TaskScheduler is responsible for determining which tasks are due for execution.
 */

import { Task } from '../models/Task.model';
import { SchedulingStrategy } from '../strategies/SchedulingStrategy.interface';
import { SchedulerError } from '../errors/SchedulerError';

/**
 * Interface for the task scheduler component
 */
export interface TaskScheduler {
  /**
   * Add a scheduling strategy to the scheduler
   * 
   * @param strategy - The scheduling strategy to add
   * @returns true if the strategy was added successfully
   * @throws {SchedulerError} If the strategy cannot be added
   */
  addStrategy(strategy: SchedulingStrategy): Promise<boolean>;
  
  /**
   * Remove a scheduling strategy from the scheduler
   * 
   * @param strategyId - The ID of the strategy to remove
   * @returns true if the strategy was removed, false if it didn't exist
   * @throws {SchedulerError} If the strategy cannot be removed
   */
  removeStrategy(strategyId: string): Promise<boolean>;
  
  /**
   * Get all due tasks based on the registered scheduling strategies
   * 
   * @param allTasks - All available tasks to evaluate
   * @returns Array of tasks that are due for execution
   * @throws {SchedulerError} If there's an error determining due tasks
   */
  getDueTasks(allTasks: Task[]): Promise<Task[]>;
  
  /**
   * Check if a specific task is due for execution
   * 
   * @param task - The task to check
   * @returns true if the task is due for execution
   * @throws {SchedulerError} If there's an error checking the task
   */
  isTaskDue(task: Task): Promise<boolean>;
  
  /**
   * Calculate the next execution time for a task
   * 
   * @param task - The task to calculate for
   * @returns The next execution time as a Date, or null if the task won't execute again
   * @throws {SchedulerError} If there's an error calculating the next time
   */
  calculateNextExecutionTime(task: Task): Promise<Date | null>;
  
  /**
   * Reset the scheduler state
   * 
   * @returns true if successful
   * @throws {SchedulerError} If there's an error resetting the scheduler
   */
  reset(): Promise<boolean>;
} 