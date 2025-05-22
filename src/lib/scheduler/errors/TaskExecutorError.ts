/**
 * TaskExecutorError.ts - Task Executor Error
 * 
 * This file defines errors related to the task executor component.
 */

import { SchedulerError } from './SchedulerError';

/**
 * Error codes for task executor errors
 */
export enum TaskExecutorErrorCode {
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  INVALID_TASK_STATE = 'INVALID_TASK_STATE',
  TIMEOUT = 'TIMEOUT',
  CONCURRENCY_LIMIT = 'CONCURRENCY_LIMIT',
  RESOURCE_LIMIT = 'RESOURCE_LIMIT',
  DEPENDENCY_FAILURE = 'DEPENDENCY_FAILURE',
  HANDLER_ERROR = 'HANDLER_ERROR',
  CANCELLED = 'CANCELLED',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR'
}

/**
 * Error class for task executor related errors
 */
export class TaskExecutorError extends SchedulerError {
  /**
   * Create a new TaskExecutorError
   * 
   * @param message - Error message
   * @param code - Error code
   * @param context - Additional context information
   */
  constructor(
    message: string,
    code: TaskExecutorErrorCode | string = TaskExecutorErrorCode.EXECUTION_FAILED,
    context: Record<string, unknown> = {}
  ) {
    super(message, `TASK_EXECUTOR_${code}`, context);
    this.name = 'TaskExecutorError';
  }
  
  /**
   * Create a task execution failure error
   * 
   * @param taskId - ID of the task that failed
   * @param errorDetails - Details about the execution failure
   * @param context - Additional context
   * @returns A TaskExecutorError with the appropriate code and message
   */
  static executionFailed(
    taskId: string, 
    errorDetails: string, 
    context: Record<string, unknown> = {}
  ): TaskExecutorError {
    return new TaskExecutorError(
      `Task execution failed for task "${taskId}": ${errorDetails}`,
      TaskExecutorErrorCode.EXECUTION_FAILED,
      { taskId, errorDetails, ...context }
    );
  }
  
  /**
   * Create a task not found error
   * 
   * @param taskId - ID of the task that wasn't found
   * @param context - Additional context
   * @returns A TaskExecutorError with the appropriate code and message
   */
  static taskNotFound(taskId: string, context: Record<string, unknown> = {}): TaskExecutorError {
    return new TaskExecutorError(
      `Task with ID "${taskId}" not found for execution`,
      TaskExecutorErrorCode.TASK_NOT_FOUND,
      { taskId, ...context }
    );
  }
  
  /**
   * Create an invalid task state error
   * 
   * @param taskId - ID of the task
   * @param currentState - Current state of the task
   * @param expectedState - Expected state of the task
   * @param context - Additional context
   * @returns A TaskExecutorError with the appropriate code and message
   */
  static invalidTaskState(
    taskId: string,
    currentState: string,
    expectedState: string | string[],
    context: Record<string, unknown> = {}
  ): TaskExecutorError {
    const expectedStates = Array.isArray(expectedState) ? expectedState.join(', ') : expectedState;
    
    return new TaskExecutorError(
      `Task "${taskId}" is in invalid state: expected ${expectedStates}, got ${currentState}`,
      TaskExecutorErrorCode.INVALID_TASK_STATE,
      { taskId, currentState, expectedState, ...context }
    );
  }
  
  /**
   * Create a timeout error
   * 
   * @param taskId - ID of the task that timed out
   * @param timeoutMs - Timeout duration in milliseconds
   * @param context - Additional context
   * @returns A TaskExecutorError with the appropriate code and message
   */
  static timeout(
    taskId: string,
    timeoutMs: number,
    context: Record<string, unknown> = {}
  ): TaskExecutorError {
    return new TaskExecutorError(
      `Task "${taskId}" execution timed out after ${timeoutMs}ms`,
      TaskExecutorErrorCode.TIMEOUT,
      { taskId, timeoutMs, ...context }
    );
  }
  
  /**
   * Create a handler error
   * 
   * @param taskId - ID of the task
   * @param error - Original error from the handler
   * @param context - Additional context
   * @returns A TaskExecutorError with the appropriate code and message
   */
  static handlerError(
    taskId: string,
    error: Error,
    context: Record<string, unknown> = {}
  ): TaskExecutorError {
    return new TaskExecutorError(
      `Task "${taskId}" handler threw an error: ${error.message}`,
      TaskExecutorErrorCode.HANDLER_ERROR,
      { 
        taskId, 
        originalError: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        ...context 
      }
    );
  }
}