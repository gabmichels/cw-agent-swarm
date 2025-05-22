/**
 * BasicTaskExecutor.ts - Basic Task Executor Implementation
 * 
 * This file provides an implementation of the TaskExecutor interface that executes
 * tasks with proper error handling and concurrency control.
 */

import { ulid } from 'ulid';
import { Task, TaskStatus } from '../../models/Task.model';
import { TaskExecutionResult, createTaskExecutionResult } from '../../models/TaskExecutionResult.model';
import { TaskExecutor } from '../../interfaces/TaskExecutor.interface';
import { TaskExecutorError, TaskExecutorErrorCode } from '../../errors/TaskExecutorError';

/**
 * Basic implementation of the TaskExecutor interface
 */
export class BasicTaskExecutor implements TaskExecutor {
  /**
   * Map of task ID to promise for running tasks
   */
  private runningTasks: Map<string, Promise<TaskExecutionResult>> = new Map();
  
  /**
   * Whether task execution is paused
   */
  private paused = false;
  
  /**
   * Default timeout for task execution in milliseconds
   */
  private defaultTimeoutMs: number;
  
  /**
   * Maximum number of concurrent tasks
   */
  private maxConcurrentTasks: number;

  /**
   * Create a new BasicTaskExecutor
   * 
   * @param options - Configuration options
   */
  constructor(options: {
    defaultTimeoutMs?: number;
    maxConcurrentTasks?: number;
  } = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs || 30000; // 30 seconds
    this.maxConcurrentTasks = options.maxConcurrentTasks || 10;
  }

  /**
   * Execute a single task
   * 
   * @param task - The task to execute
   * @returns The execution result
   * @throws {TaskExecutorError} If there's an error during execution
   */
  async executeTask(task: Task): Promise<TaskExecutionResult> {
    try {
      // Check if execution is paused
      if (this.paused) {
        throw TaskExecutorError.executionFailed(
          task.id,
          'Task execution is paused',
          { paused: true }
        );
      }

      // Check if we're at the concurrency limit
      if (this.runningTasks.size >= this.maxConcurrentTasks) {
        throw new TaskExecutorError(
          `Maximum concurrent tasks limit (${this.maxConcurrentTasks}) reached`,
          TaskExecutorErrorCode.CONCURRENCY_LIMIT,
          { taskId: task.id, maxConcurrentTasks: this.maxConcurrentTasks }
        );
      }

      // Validate task has a handler
      if (!task.handler || typeof task.handler !== 'function') {
        throw new TaskExecutorError(
          `Task handler is missing or not a function`,
          TaskExecutorErrorCode.INVALID_TASK_STATE,
          { taskId: task.id, task }
        );
      }

      // Prepare execution
      const startTime = new Date();
      const timeoutMs = task.expectedCompletionTime 
        ? task.expectedCompletionTime.getTime() - startTime.getTime()
        : this.defaultTimeoutMs;

      // Create execution promise with timeout
      const executionPromise = this.executeWithTimeout(task, timeoutMs);
      
      // Track the running task
      this.runningTasks.set(task.id, executionPromise);
      
      // Wait for execution to complete and clean up
      try {
        const result = await executionPromise;
        return result;
      } finally {
        // Always remove from running tasks when complete
        this.runningTasks.delete(task.id);
      }
    } catch (error) {
      if (error instanceof TaskExecutorError) {
        throw error;
      }
      throw TaskExecutorError.executionFailed(
        task.id,
        (error as Error).message,
        { originalError: error }
      );
    }
  }

  /**
   * Execute multiple tasks concurrently
   * 
   * @param tasks - Array of tasks to execute
   * @param maxConcurrent - Maximum number of tasks to run concurrently (optional)
   * @returns Array of execution results in the same order as the input tasks
   * @throws {TaskExecutorError} If there's an error during batch execution
   */
  async executeTasks(tasks: Task[], maxConcurrent?: number): Promise<TaskExecutionResult[]> {
    try {
      if (!tasks.length) {
        return [];
      }

      // Check if execution is paused
      if (this.paused) {
        throw new TaskExecutorError(
          'Task execution is paused',
          TaskExecutorErrorCode.EXECUTION_FAILED,
          { paused: true }
        );
      }

      // Use provided maxConcurrent or instance default
      const concurrencyLimit = maxConcurrent || this.maxConcurrentTasks;
      
      // Execute tasks with concurrency limit
      const results: TaskExecutionResult[] = [];
      const tasksCopy = [...tasks]; // Copy array to avoid modifying the original
      
      // Process tasks in batches
      while (tasksCopy.length > 0) {
        // Get the next batch of tasks to execute
        const batch = tasksCopy.splice(0, concurrencyLimit);
        
        // Execute the batch concurrently
        const batchResults = await Promise.all(
          batch.map(task => 
            this.executeTask(task).catch(error => {
              // Convert any errors to execution results
              if (error instanceof TaskExecutorError) {
                const now = new Date();
                return createTaskExecutionResult(
                  task.id,
                  TaskStatus.FAILED,
                  now,
                  now,
                  false,
                  {
                    error: {
                      message: error.message,
                      code: error.code,
                      stack: error.stack
                    }
                  }
                );
              } else {
                const now = new Date();
                return createTaskExecutionResult(
                  task.id,
                  TaskStatus.FAILED,
                  now,
                  now,
                  false,
                  {
                    error: {
                      message: (error as Error).message,
                      stack: (error as Error).stack
                    }
                  }
                );
              }
            })
          )
        );
        
        // Add batch results to overall results
        results.push(...batchResults);
      }
      
      return results;
    } catch (error) {
      if (error instanceof TaskExecutorError) {
        throw error;
      }
      throw new TaskExecutorError(
        `Failed to execute tasks batch: ${(error as Error).message}`,
        TaskExecutorErrorCode.EXECUTION_FAILED,
        { originalError: error }
      );
    }
  }

  /**
   * Cancel a running task
   * 
   * @param taskId - ID of the task to cancel
   * @returns true if the task was cancelled, false if it wasn't running or couldn't be cancelled
   * @throws {TaskExecutorError} If there's an error during cancellation
   */
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      if (!taskId) {
        throw new TaskExecutorError(
          'Task ID is required',
          TaskExecutorErrorCode.INVALID_TASK_STATE
        );
      }

      // Check if the task is running
      if (!this.runningTasks.has(taskId)) {
        return false;
      }

      // We can't actually cancel a promise in JavaScript, but we can mark the task as cancelled
      // and handle it in the execution logic
      
      // Remove task from running tasks
      this.runningTasks.delete(taskId);
      
      return true;
    } catch (error) {
      if (error instanceof TaskExecutorError) {
        throw error;
      }
      throw new TaskExecutorError(
        `Failed to cancel task: ${(error as Error).message}`,
        TaskExecutorErrorCode.CANCELLED,
        { taskId }
      );
    }
  }

  /**
   * Get the currently running tasks
   * 
   * @returns Array of currently executing tasks
   * @throws {TaskExecutorError} If there's an error retrieving running tasks
   */
  async getRunningTasks(): Promise<Task[]> {
    try {
      // We don't have direct access to the task objects here,
      // so we return an array of objects with just the ID
      return Array.from(this.runningTasks.keys()).map(taskId => ({
        id: taskId
      } as unknown as Task));
    } catch (error) {
      throw new TaskExecutorError(
        `Failed to get running tasks: ${(error as Error).message}`,
        TaskExecutorErrorCode.EXECUTION_FAILED
      );
    }
  }

  /**
   * Check if a task is currently running
   * 
   * @param taskId - ID of the task to check
   * @returns true if the task is currently running
   * @throws {TaskExecutorError} If there's an error checking the task status
   */
  async isTaskRunning(taskId: string): Promise<boolean> {
    try {
      if (!taskId) {
        throw new TaskExecutorError(
          'Task ID is required',
          TaskExecutorErrorCode.INVALID_TASK_STATE
        );
      }

      return this.runningTasks.has(taskId);
    } catch (error) {
      if (error instanceof TaskExecutorError) {
        throw error;
      }
      throw new TaskExecutorError(
        `Failed to check if task is running: ${(error as Error).message}`,
        TaskExecutorErrorCode.EXECUTION_FAILED,
        { taskId }
      );
    }
  }

  /**
   * Pause all task execution
   * 
   * @returns true if execution was paused successfully
   * @throws {TaskExecutorError} If there's an error pausing execution
   */
  async pauseExecution(): Promise<boolean> {
    try {
      if (this.paused) {
        return false; // Already paused
      }
      
      this.paused = true;
      return true;
    } catch (error) {
      throw new TaskExecutorError(
        `Failed to pause execution: ${(error as Error).message}`,
        TaskExecutorErrorCode.EXECUTION_FAILED
      );
    }
  }

  /**
   * Resume task execution after pausing
   * 
   * @returns true if execution was resumed successfully
   * @throws {TaskExecutorError} If there's an error resuming execution
   */
  async resumeExecution(): Promise<boolean> {
    try {
      if (!this.paused) {
        return false; // Already running
      }
      
      this.paused = false;
      return true;
    } catch (error) {
      throw new TaskExecutorError(
        `Failed to resume execution: ${(error as Error).message}`,
        TaskExecutorErrorCode.EXECUTION_FAILED
      );
    }
  }

  /**
   * Execute a task with a timeout
   * 
   * @param task - The task to execute
   * @param timeoutMs - Timeout in milliseconds
   * @returns Promise that resolves to the execution result
   */
  private async executeWithTimeout(task: Task, timeoutMs: number): Promise<TaskExecutionResult> {
    return new Promise<TaskExecutionResult>(async (resolve, reject) => {
      // Create timeout handler
      const timeoutId = setTimeout(() => {
        reject(TaskExecutorError.timeout(task.id, timeoutMs));
      }, timeoutMs);
      
      try {
        // Record start time
        const startTime = new Date();
        
        // Mark task as running
        const runningTask = {
          ...task,
          status: TaskStatus.RUNNING
        };
        
        let result: unknown;
        let error: Error | undefined;
        
        try {
          // Execute the task handler
          result = await task.handler(...(task.handlerArgs || []));
        } catch (err) {
          error = err as Error;
        }
        
        // Record end time
        const endTime = new Date();
        
        // Clear timeout
        clearTimeout(timeoutId);
        
        // Create execution result
        const successful = !error;
        const resultStatus = successful ? TaskStatus.COMPLETED : TaskStatus.FAILED;
        
        const executionResult = createTaskExecutionResult(
          task.id,
          resultStatus,
          startTime,
          endTime,
          successful,
          {
            result: successful ? result : undefined,
            error: error ? {
              message: error.message,
              code: undefined,
              stack: error.stack
            } : undefined,
            wasRetry: false,
            retryCount: 0
          }
        );
        
        resolve(executionResult);
      } catch (err) {
        // Clear timeout
        clearTimeout(timeoutId);
        
        // Handle unexpected errors
        reject(TaskExecutorError.executionFailed(
          task.id,
          (err as Error).message,
          { originalError: err }
        ));
      }
    });
  }
} 