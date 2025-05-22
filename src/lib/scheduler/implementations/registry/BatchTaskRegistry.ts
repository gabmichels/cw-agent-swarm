/**
 * BatchTaskRegistry.ts - Batch Task Registry Decorator
 * 
 * This file provides a decorator implementation of the TaskRegistry interface that
 * adds batch operations to any TaskRegistry implementation for improved performance.
 */

import { Task } from '../../models/Task.model';
import { TaskFilter } from '../../models/TaskFilter.model';
import { TaskRegistry } from '../../interfaces/TaskRegistry.interface';
import { TaskRegistryError } from '../../errors/TaskRegistryError';

/**
 * Decorator that adds batch operations to any TaskRegistry implementation
 */
export class BatchTaskRegistry implements TaskRegistry {
  private registry: TaskRegistry;
  private batchSize: number;

  /**
   * Create a new BatchTaskRegistry
   * 
   * @param registry - The underlying TaskRegistry implementation
   * @param batchSize - The maximum size of batches for operations
   */
  constructor(registry: TaskRegistry, batchSize = 50) {
    this.registry = registry;
    this.batchSize = batchSize;
  }

  /**
   * Store a task in the registry
   * 
   * @param task - The task to store
   * @returns The stored task with any generated metadata
   * @throws {TaskRegistryError} If the task cannot be stored
   */
  async storeTask(task: Task): Promise<Task> {
    return this.registry.storeTask(task);
  }

  /**
   * Store multiple tasks in a batch operation
   * 
   * @param tasks - Array of tasks to store
   * @returns Array of stored tasks with generated metadata
   * @throws {TaskRegistryError} If tasks cannot be stored
   */
  async storeTasks(tasks: Task[]): Promise<Task[]> {
    try {
      const results: Task[] = [];

      // Process in batches
      for (let i = 0; i < tasks.length; i += this.batchSize) {
        const batch = tasks.slice(i, i + this.batchSize);
        const batchPromises = batch.map(task => this.registry.storeTask(task));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to store tasks in batch: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieve a task by its ID
   * 
   * @param taskId - The ID of the task to retrieve
   * @returns The task if found, null otherwise
   * @throws {TaskRegistryError} If there's an error retrieving the task
   */
  async getTaskById(taskId: string): Promise<Task | null> {
    return this.registry.getTaskById(taskId);
  }

  /**
   * Retrieve multiple tasks by ID in a batch operation
   * 
   * @param taskIds - Array of task IDs to retrieve
   * @returns Array of tasks found (null for tasks that don't exist)
   * @throws {TaskRegistryError} If there's an error retrieving tasks
   */
  async getTasksByIds(taskIds: string[]): Promise<(Task | null)[]> {
    try {
      const results: (Task | null)[] = [];

      // Process in batches
      for (let i = 0; i < taskIds.length; i += this.batchSize) {
        const batchIds = taskIds.slice(i, i + this.batchSize);
        const batchPromises = batchIds.map(id => this.registry.getTaskById(id));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to retrieve tasks in batch: ${(error as Error).message}`);
    }
  }

  /**
   * Update an existing task
   * 
   * @param task - The task with updated fields
   * @returns The updated task
   * @throws {TaskRegistryError} If the task does not exist or cannot be updated
   */
  async updateTask(task: Task): Promise<Task> {
    return this.registry.updateTask(task);
  }

  /**
   * Update multiple tasks in a batch operation
   * 
   * @param tasks - Array of tasks with updated fields
   * @returns Array of updated tasks
   * @throws {TaskRegistryError} If tasks cannot be updated
   */
  async updateTasks(tasks: Task[]): Promise<Task[]> {
    try {
      const results: Task[] = [];

      // Process in batches
      for (let i = 0; i < tasks.length; i += this.batchSize) {
        const batch = tasks.slice(i, i + this.batchSize);
        const batchPromises = batch.map(task => this.registry.updateTask(task));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to update tasks in batch: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a task by its ID
   * 
   * @param taskId - The ID of the task to delete
   * @returns true if the task was deleted, false if it didn't exist
   * @throws {TaskRegistryError} If there's an error deleting the task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    return this.registry.deleteTask(taskId);
  }

  /**
   * Delete multiple tasks by ID in a batch operation
   * 
   * @param taskIds - Array of task IDs to delete
   * @returns Array of boolean values indicating if each task was deleted
   * @throws {TaskRegistryError} If there's an error deleting tasks
   */
  async deleteTasks(taskIds: string[]): Promise<boolean[]> {
    try {
      const results: boolean[] = [];

      // Process in batches
      for (let i = 0; i < taskIds.length; i += this.batchSize) {
        const batchIds = taskIds.slice(i, i + this.batchSize);
        const batchPromises = batchIds.map(id => this.registry.deleteTask(id));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to delete tasks in batch: ${(error as Error).message}`);
    }
  }

  /**
   * Find tasks matching the specified filter criteria
   * 
   * @param filter - The filter criteria to apply
   * @returns An array of tasks matching the filter
   * @throws {TaskRegistryError} If there's an error querying for tasks
   */
  async findTasks(filter: TaskFilter = {}): Promise<Task[]> {
    return this.registry.findTasks(filter);
  }

  /**
   * Count tasks matching the specified filter criteria
   * 
   * @param filter - The filter criteria to apply
   * @returns The number of tasks matching the filter
   * @throws {TaskRegistryError} If there's an error counting tasks
   */
  async countTasks(filter: TaskFilter = {}): Promise<number> {
    return this.registry.countTasks(filter);
  }

  /**
   * Clear all tasks from the registry
   * 
   * @returns true if successful
   * @throws {TaskRegistryError} If there's an error clearing tasks
   */
  async clearAllTasks(): Promise<boolean> {
    return this.registry.clearAllTasks();
  }
} 