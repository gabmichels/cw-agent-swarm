/**
 * TaskRegistry.interface.ts - Task Registry Interface
 * 
 * This interface defines the contract for components that store and retrieve tasks.
 * The TaskRegistry is responsible for persisting tasks and providing query capabilities.
 */

import { Task } from '../models/Task.model';
import { TaskFilter } from '../models/TaskFilter.model';
import { TaskRegistryError } from '../errors/TaskRegistryError';

/**
 * Interface for the task registry component
 */
export interface TaskRegistry {
  /**
   * Store a task in the registry
   * 
   * @param task - The task to store
   * @returns The stored task with any generated metadata
   * @throws {TaskRegistryError} If the task cannot be stored
   */
  storeTask(task: Task): Promise<Task>;
  
  /**
   * Retrieve a task by its ID
   * 
   * @param taskId - The ID of the task to retrieve
   * @returns The task if found, null otherwise
   * @throws {TaskRegistryError} If there's an error retrieving the task
   */
  getTaskById(taskId: string): Promise<Task | null>;
  
  /**
   * Update an existing task
   * 
   * @param task - The task with updated fields
   * @returns The updated task
   * @throws {TaskRegistryError} If the task does not exist or cannot be updated
   */
  updateTask(task: Task): Promise<Task>;
  
  /**
   * Delete a task by its ID
   * 
   * @param taskId - The ID of the task to delete
   * @returns true if the task was deleted, false if it didn't exist
   * @throws {TaskRegistryError} If there's an error deleting the task
   */
  deleteTask(taskId: string): Promise<boolean>;
  
  /**
   * Find tasks matching the specified filter criteria
   * 
   * @param filter - The filter criteria to apply
   * @returns An array of tasks matching the filter
   * @throws {TaskRegistryError} If there's an error querying for tasks
   */
  findTasks(filter: TaskFilter): Promise<Task[]>;
  
  /**
   * Count tasks matching the specified filter criteria
   * 
   * @param filter - The filter criteria to apply
   * @returns The number of tasks matching the filter
   * @throws {TaskRegistryError} If there's an error counting tasks
   */
  countTasks(filter: TaskFilter): Promise<number>;
  
  /**
   * Clear all tasks from the registry
   * 
   * @returns true if successful
   * @throws {TaskRegistryError} If there's an error clearing tasks
   */
  clearAllTasks(): Promise<boolean>;
} 