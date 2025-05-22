/**
 * MemoryTaskRegistry.ts - In-Memory Task Registry Implementation
 * 
 * This file provides an in-memory implementation of the TaskRegistry interface,
 * which can be used for development, testing, or lightweight production use.
 */

import { ulid } from 'ulid';
import { Task, TaskStatus, createTask } from '../../models/Task.model';
import { TaskFilter } from '../../models/TaskFilter.model';
import { TaskRegistry } from '../../interfaces/TaskRegistry.interface';
import { TaskRegistryError, TaskRegistryErrorCode } from '../../errors/TaskRegistryError';

/**
 * In-memory implementation of the TaskRegistry interface
 */
export class MemoryTaskRegistry implements TaskRegistry {
  /**
   * Map of task ID to task objects
   */
  private tasks: Map<string, Task> = new Map();

  /**
   * Create a new MemoryTaskRegistry
   */
  constructor() {}

  /**
   * Store a task in the registry
   * 
   * @param task - The task to store
   * @returns The stored task with any generated metadata
   * @throws {TaskRegistryError} If the task cannot be stored
   */
  async storeTask(task: Task): Promise<Task> {
    try {
      // Validate the task
      if (!task.name) {
        throw TaskRegistryError.invalidTask('Task name is required');
      }

      // Generate an ID if not provided
      const taskToStore = task.id ? { ...task } : createTask({ ...task, id: ulid() });

      // Check for duplicate ID
      if (this.tasks.has(taskToStore.id)) {
        throw TaskRegistryError.duplicateTaskId(taskToStore.id);
      }

      // Update timestamps
      const now = new Date();
      taskToStore.createdAt = taskToStore.createdAt || now;
      taskToStore.updatedAt = now;

      // Store the task
      this.tasks.set(taskToStore.id, taskToStore);

      return taskToStore;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to store task: ${(error as Error).message}`);
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
    try {
      if (!taskId) {
        throw TaskRegistryError.invalidTask('Task ID is required');
      }

      const task = this.tasks.get(taskId);
      return task || null;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to retrieve task: ${(error as Error).message}`);
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
    try {
      if (!task.id) {
        throw TaskRegistryError.invalidTask('Task ID is required for updates');
      }

      // Check if the task exists
      if (!this.tasks.has(task.id)) {
        throw TaskRegistryError.taskNotFound(task.id);
      }

      // Get the existing task to preserve immutable properties
      const existingTask = this.tasks.get(task.id)!;

      // Create updated task, preserving creation timestamp
      const updatedTask: Task = {
        ...task,
        createdAt: existingTask.createdAt,
        updatedAt: new Date()
      };

      // Store the updated task
      this.tasks.set(updatedTask.id, updatedTask);

      return updatedTask;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to update task: ${(error as Error).message}`);
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
    try {
      if (!taskId) {
        throw TaskRegistryError.invalidTask('Task ID is required');
      }

      const existed = this.tasks.has(taskId);
      this.tasks.delete(taskId);
      return existed;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to delete task: ${(error as Error).message}`);
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
    try {
      // Get all tasks as an array
      let tasks = Array.from(this.tasks.values());

      // Apply filters
      if (filter.ids && filter.ids.length > 0) {
        tasks = tasks.filter(task => filter.ids!.includes(task.id));
      }

      if (filter.name) {
        tasks = tasks.filter(task => task.name === filter.name);
      }

      if (filter.nameContains) {
        tasks = tasks.filter(task => 
          task.name.toLowerCase().includes(filter.nameContains!.toLowerCase())
        );
      }

      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        tasks = tasks.filter(task => statuses.includes(task.status));
      }

      if (filter.scheduleType) {
        const scheduleTypes = Array.isArray(filter.scheduleType) 
          ? filter.scheduleType 
          : [filter.scheduleType];
        tasks = tasks.filter(task => scheduleTypes.includes(task.scheduleType));
      }

      if (filter.minPriority !== undefined) {
        tasks = tasks.filter(task => task.priority >= filter.minPriority!);
      }

      if (filter.maxPriority !== undefined) {
        tasks = tasks.filter(task => task.priority <= filter.maxPriority!);
      }

      if (filter.tags && filter.tags.length > 0) {
        tasks = tasks.filter(task => 
          filter.tags!.every(tag => task.metadata?.tags?.includes(tag))
        );
      }

      if (filter.anyTags && filter.anyTags.length > 0) {
        tasks = tasks.filter(task => 
          task.metadata?.tags && 
          filter.anyTags!.some(tag => task.metadata!.tags!.includes(tag))
        );
      }

      if (filter.createdBetween) {
        tasks = tasks.filter(task => 
          task.createdAt >= filter.createdBetween!.start && 
          task.createdAt <= filter.createdBetween!.end
        );
      }

      if (filter.scheduledBetween && filter.scheduledBetween.start && filter.scheduledBetween.end) {
        tasks = tasks.filter(task => 
          task.scheduledTime && 
          task.scheduledTime >= filter.scheduledBetween!.start && 
          task.scheduledTime <= filter.scheduledBetween!.end
        );
      }

      if (filter.lastExecutedBetween && filter.lastExecutedBetween.start && filter.lastExecutedBetween.end) {
        tasks = tasks.filter(task => 
          task.lastExecutedAt && 
          task.lastExecutedAt >= filter.lastExecutedBetween!.start && 
          task.lastExecutedAt <= filter.lastExecutedBetween!.end
        );
      }

      if (filter.isOverdue) {
        const now = new Date();
        tasks = tasks.filter(task => 
          task.scheduledTime && task.scheduledTime < now && task.status === TaskStatus.PENDING
        );
      }

      if (filter.isDueNow) {
        const now = new Date();
        tasks = tasks.filter(task => 
          task.scheduledTime && task.scheduledTime <= now && task.status === TaskStatus.PENDING
        );
      }

      if (filter.metadata) {
        tasks = tasks.filter(task => {
          if (!task.metadata) return false;
          
          return Object.entries(filter.metadata!).every(([key, value]) => {
            // Handle nested objects (like agentId)
            if (value !== null && typeof value === 'object') {
              // If the metadata key doesn't exist or isn't an object, no match
              if (!task.metadata || !task.metadata[key] || typeof task.metadata[key] !== 'object') {
                return false;
              }
              
              // Check all properties in the nested object
              return Object.entries(value).every(([nestedKey, nestedValue]) => {
                const taskNestedObj = task.metadata![key] as Record<string, unknown>;
                
                // If the nested object has its own nested objects (like agentId.id)
                if (nestedValue !== null && typeof nestedValue === 'object') {
                  // If the nested key doesn't exist or isn't an object, no match
                  if (!taskNestedObj[nestedKey] || typeof taskNestedObj[nestedKey] !== 'object') {
                    return false;
                  }
                  
                  // Check all properties in the deeply nested object
                  return Object.entries(nestedValue as Record<string, unknown>).every(
                    ([deepKey, deepValue]) => {
                      const taskDeepObj = taskNestedObj[nestedKey] as Record<string, unknown>;
                      return taskDeepObj[deepKey] === deepValue;
                    }
                  );
                }
                
                // Simple nested property comparison
                return taskNestedObj[nestedKey] === nestedValue;
              });
            }
            
            // Simple property comparison
            return task.metadata![key] === value;
          });
        });
      }

      // Apply sorting
      if (filter.sortBy) {
        const sortField = filter.sortBy;
        const sortDirection = filter.sortDirection || 'asc';
        
        tasks.sort((a, b) => {
          let valueA: any;
          let valueB: any;

          // Extract the fields to compare
          switch (sortField) {
            case 'priority':
              valueA = a.priority;
              valueB = b.priority;
              break;
            case 'createdAt':
              valueA = a.createdAt.getTime();
              valueB = b.createdAt.getTime();
              break;
            case 'scheduledTime':
              valueA = a.scheduledTime ? a.scheduledTime.getTime() : Number.MAX_SAFE_INTEGER;
              valueB = b.scheduledTime ? b.scheduledTime.getTime() : Number.MAX_SAFE_INTEGER;
              break;
            case 'lastExecutedAt':
              valueA = a.lastExecutedAt ? a.lastExecutedAt.getTime() : 0;
              valueB = b.lastExecutedAt ? b.lastExecutedAt.getTime() : 0;
              break;
            default:
              valueA = a[sortField as keyof Task];
              valueB = b[sortField as keyof Task];
          }

          // Compare based on sort direction
          if (sortDirection === 'asc') {
            return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
          } else {
            return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
          }
        });
      }

      // Apply pagination
      if (filter.offset !== undefined || filter.limit !== undefined) {
        const offset = filter.offset || 0;
        const limit = filter.limit !== undefined ? filter.limit : tasks.length;
        tasks = tasks.slice(offset, offset + limit);
      }

      return tasks;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to query tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Count tasks matching the specified filter criteria
   * 
   * @param filter - The filter criteria to apply
   * @returns The number of tasks matching the filter
   * @throws {TaskRegistryError} If there's an error counting tasks
   */
  async countTasks(filter: TaskFilter = {}): Promise<number> {
    try {
      // Remove pagination to count all matching tasks
      const { offset, limit, ...filterWithoutPagination } = filter;
      const tasks = await this.findTasks(filterWithoutPagination);
      return tasks.length;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to count tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Clear all tasks from the registry
   * 
   * @returns true if successful
   * @throws {TaskRegistryError} If there's an error clearing tasks
   */
  async clearAllTasks(): Promise<boolean> {
    try {
      this.tasks.clear();
      return true;
    } catch (error) {
      throw TaskRegistryError.storageError(`Failed to clear tasks: ${(error as Error).message}`);
    }
  }
} 