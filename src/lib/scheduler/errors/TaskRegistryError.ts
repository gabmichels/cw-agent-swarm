/**
 * TaskRegistryError.ts - Task Registry Error
 * 
 * This file defines errors related to the task registry component.
 */

import { SchedulerError } from './SchedulerError';

/**
 * Error codes for task registry errors
 */
export enum TaskRegistryErrorCode {
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  DUPLICATE_TASK_ID = 'DUPLICATE_TASK_ID',
  INVALID_TASK = 'INVALID_TASK',
  STORAGE_ERROR = 'STORAGE_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  CONCURRENCY_ERROR = 'CONCURRENCY_ERROR'
}

/**
 * Error class for task registry related errors
 */
export class TaskRegistryError extends SchedulerError {
  /**
   * Create a new TaskRegistryError
   * 
   * @param message - Error message
   * @param code - Error code
   * @param context - Additional context information
   */
  constructor(
    message: string,
    code: TaskRegistryErrorCode | string = TaskRegistryErrorCode.STORAGE_ERROR,
    context: Record<string, unknown> = {}
  ) {
    super(message, `TASK_REGISTRY_${code}`, context);
    this.name = 'TaskRegistryError';
  }
  
  /**
   * Create a task not found error
   * 
   * @param taskId - ID of the task that wasn't found
   * @param context - Additional context
   * @returns A TaskRegistryError with the appropriate code and message
   */
  static taskNotFound(taskId: string, context: Record<string, unknown> = {}): TaskRegistryError {
    return new TaskRegistryError(
      `Task with ID "${taskId}" not found`,
      TaskRegistryErrorCode.TASK_NOT_FOUND,
      { taskId, ...context }
    );
  }
  
  /**
   * Create a duplicate task ID error
   * 
   * @param taskId - ID of the duplicate task
   * @param context - Additional context
   * @returns A TaskRegistryError with the appropriate code and message
   */
  static duplicateTaskId(taskId: string, context: Record<string, unknown> = {}): TaskRegistryError {
    return new TaskRegistryError(
      `Task with ID "${taskId}" already exists`,
      TaskRegistryErrorCode.DUPLICATE_TASK_ID,
      { taskId, ...context }
    );
  }
  
  /**
   * Create an invalid task error
   * 
   * @param message - Details about the validation failure
   * @param context - Additional context
   * @returns A TaskRegistryError with the appropriate code and message
   */
  static invalidTask(message: string, context: Record<string, unknown> = {}): TaskRegistryError {
    return new TaskRegistryError(
      `Invalid task: ${message}`,
      TaskRegistryErrorCode.INVALID_TASK,
      context
    );
  }
  
  /**
   * Create a storage error
   * 
   * @param message - Details about the storage error
   * @param context - Additional context
   * @returns A TaskRegistryError with the appropriate code and message
   */
  static storageError(message: string, context: Record<string, unknown> = {}): TaskRegistryError {
    return new TaskRegistryError(
      `Task registry storage error: ${message}`,
      TaskRegistryErrorCode.STORAGE_ERROR,
      context
    );
  }
}