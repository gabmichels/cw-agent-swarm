/**
 * TaskExecutionResult.model.ts - Task Execution Result Model
 * 
 * This file defines the data model for task execution results.
 */

import { TaskStatus } from './Task.model';

/**
 * Result of task execution
 */
export interface TaskExecutionResult {
  /**
   * ID of the executed task
   */
  taskId: string;
  
  /**
   * Status after execution
   */
  status: TaskStatus;
  
  /**
   * When execution started
   */
  startTime: Date;
  
  /**
   * When execution completed
   */
  endTime: Date;
  
  /**
   * Duration of execution in milliseconds
   */
  duration: number;
  
  /**
   * Whether the execution was successful
   */
  successful: boolean;
  
  /**
   * Result data from the execution
   */
  result?: unknown;
  
  /**
   * Error information if execution failed
   */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  
  /**
   * Whether this was a retry attempt
   */
  wasRetry: boolean;
  
  /**
   * Current retry count after this execution
   */
  retryCount: number;
  
  /**
   * Additional execution metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Create a new task execution result
 * 
 * @param taskId - ID of the executed task
 * @param status - Resulting task status
 * @param startTime - When execution started
 * @param endTime - When execution ended
 * @param successful - Whether execution succeeded
 * @param options - Additional options
 * @returns A task execution result object
 */
export function createTaskExecutionResult(
  taskId: string,
  status: TaskStatus,
  startTime: Date,
  endTime: Date,
  successful: boolean,
  options?: {
    result?: unknown;
    error?: { message: string; code?: string; stack?: string };
    wasRetry?: boolean;
    retryCount?: number;
    metadata?: Record<string, unknown>;
  }
): TaskExecutionResult {
  return {
    taskId,
    status,
    startTime,
    endTime,
    duration: endTime.getTime() - startTime.getTime(),
    successful,
    result: options?.result,
    error: options?.error,
    wasRetry: options?.wasRetry || false,
    retryCount: options?.retryCount || 0,
    metadata: options?.metadata || {}
  };
} 