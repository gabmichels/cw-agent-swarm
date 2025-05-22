/**
 * StrategyBasedTaskScheduler.ts - Strategy-Based Task Scheduler Implementation
 * 
 * This file provides an implementation of the TaskScheduler interface that uses
 * multiple scheduling strategies to determine which tasks are due for execution.
 */

import { ulid } from 'ulid';
import { Task } from '../../models/Task.model';
import { TaskScheduler } from '../../interfaces/TaskScheduler.interface';
import { SchedulingStrategy } from '../../strategies/SchedulingStrategy.interface';
import { SchedulerError } from '../../errors/SchedulerError';

/**
 * Implementation of TaskScheduler that uses multiple scheduling strategies
 */
export class StrategyBasedTaskScheduler implements TaskScheduler {
  /**
   * Registered scheduling strategies
   */
  private strategies: Map<string, SchedulingStrategy> = new Map();

  /**
   * Create a new StrategyBasedTaskScheduler
   * 
   * @param initialStrategies - Optional initial strategies to register
   */
  constructor(initialStrategies: SchedulingStrategy[] = []) {
    // Register initial strategies
    initialStrategies.forEach(strategy => {
      this.strategies.set(strategy.strategyId, strategy);
    });
  }

  /**
   * Add a scheduling strategy to the scheduler
   * 
   * @param strategy - The scheduling strategy to add
   * @returns true if the strategy was added successfully
   * @throws {SchedulerError} If the strategy cannot be added
   */
  async addStrategy(strategy: SchedulingStrategy): Promise<boolean> {
    try {
      if (!strategy.strategyId) {
        throw new SchedulerError('Strategy must have a valid ID', 'INVALID_STRATEGY');
      }

      if (this.strategies.has(strategy.strategyId)) {
        throw new SchedulerError(
          `Strategy with ID ${strategy.strategyId} already exists`, 
          'DUPLICATE_STRATEGY'
        );
      }

      this.strategies.set(strategy.strategyId, strategy);
      return true;
    } catch (error) {
      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to add strategy: ${(error as Error).message}`,
        'STRATEGY_ADD_ERROR'
      );
    }
  }

  /**
   * Remove a scheduling strategy from the scheduler
   * 
   * @param strategyId - The ID of the strategy to remove
   * @returns true if the strategy was removed, false if it didn't exist
   * @throws {SchedulerError} If the strategy cannot be removed
   */
  async removeStrategy(strategyId: string): Promise<boolean> {
    try {
      if (!strategyId) {
        throw new SchedulerError('Strategy ID is required', 'INVALID_STRATEGY_ID');
      }

      const existed = this.strategies.has(strategyId);
      this.strategies.delete(strategyId);
      return existed;
    } catch (error) {
      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to remove strategy: ${(error as Error).message}`,
        'STRATEGY_REMOVE_ERROR'
      );
    }
  }

  /**
   * Get all due tasks based on the registered scheduling strategies
   * 
   * @param allTasks - All available tasks to evaluate
   * @returns Array of tasks that are due for execution
   * @throws {SchedulerError} If there's an error determining due tasks
   */
  async getDueTasks(allTasks: Task[]): Promise<Task[]> {
    try {
      if (!allTasks.length) {
        return [];
      }

      if (!this.strategies.size) {
        throw new SchedulerError('No scheduling strategies registered', 'NO_STRATEGIES');
      }

      const dueTasks: Task[] = [];
      const strategyArray = Array.from(this.strategies.values());

      // For each task, check if it's due according to any strategy
      for (const task of allTasks) {
        // Find the strategies that apply to this task
        const applicableStrategies = strategyArray.filter(strategy => 
          strategy.appliesTo(task)
        );

        // If no strategies apply, skip this task
        if (!applicableStrategies.length) {
          continue;
        }

        // Check if the task is due according to any applicable strategy
        for (const strategy of applicableStrategies) {
          const isDue = await strategy.isTaskDue(task);
          if (isDue) {
            dueTasks.push(task);
            break; // Task is due, no need to check other strategies
          }
        }
      }

      return dueTasks;
    } catch (error) {
      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to determine due tasks: ${(error as Error).message}`,
        'DUE_TASKS_ERROR'
      );
    }
  }

  /**
   * Check if a specific task is due for execution
   * 
   * @param task - The task to check
   * @returns true if the task is due for execution
   * @throws {SchedulerError} If there's an error checking the task
   */
  async isTaskDue(task: Task): Promise<boolean> {
    try {
      if (!this.strategies.size) {
        throw new SchedulerError('No scheduling strategies registered', 'NO_STRATEGIES');
      }

      // Find strategies that apply to this task
      const applicableStrategies = Array.from(this.strategies.values()).filter(strategy =>
        strategy.appliesTo(task)
      );

      // If no strategies apply, the task is not due
      if (!applicableStrategies.length) {
        return false;
      }

      // Check if the task is due according to any applicable strategy
      for (const strategy of applicableStrategies) {
        const isDue = await strategy.isTaskDue(task);
        if (isDue) {
          return true;
        }
      }

      return false;
    } catch (error) {
      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to check if task is due: ${(error as Error).message}`,
        'TASK_DUE_CHECK_ERROR'
      );
    }
  }

  /**
   * Calculate the next execution time for a task
   * 
   * @param task - The task to calculate for
   * @returns The next execution time as a Date, or null if the task won't execute again
   * @throws {SchedulerError} If there's an error calculating the next time
   */
  async calculateNextExecutionTime(task: Task): Promise<Date | null> {
    try {
      if (!this.strategies.size) {
        throw new SchedulerError('No scheduling strategies registered', 'NO_STRATEGIES');
      }

      // Find strategies that apply to this task
      const applicableStrategies = Array.from(this.strategies.values()).filter(strategy =>
        strategy.appliesTo(task)
      );

      // If no strategies apply, there's no next execution time
      if (!applicableStrategies.length) {
        return null;
      }

      // Calculate next execution time from each applicable strategy
      const nextTimes: Date[] = [];
      
      for (const strategy of applicableStrategies) {
        const nextTime = await strategy.calculateNextExecutionTime(task);
        if (nextTime) {
          nextTimes.push(nextTime);
        }
      }

      // If no strategy provided a next time, return null
      if (!nextTimes.length) {
        return null;
      }

      // Return the earliest next execution time
      return new Date(Math.min(...nextTimes.map(date => date.getTime())));
    } catch (error) {
      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to calculate next execution time: ${(error as Error).message}`,
        'NEXT_EXECUTION_ERROR'
      );
    }
  }

  /**
   * Reset the scheduler state
   * 
   * @returns true if successful
   * @throws {SchedulerError} If there's an error resetting the scheduler
   */
  async reset(): Promise<boolean> {
    try {
      this.strategies.clear();
      return true;
    } catch (error) {
      throw new SchedulerError(
        `Failed to reset scheduler: ${(error as Error).message}`,
        'RESET_ERROR'
      );
    }
  }
} 