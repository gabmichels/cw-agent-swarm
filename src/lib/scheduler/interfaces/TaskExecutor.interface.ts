/**
 * TaskExecutor.interface.ts - Task Executor Interface
 * 
 * This interface defines the contract for components that execute tasks.
 * The TaskExecutor is responsible for running tasks and handling execution outcomes.
 */

import { Task } from '../models/Task.model';
import { TaskExecutionResult } from '../models/TaskExecutionResult.model';
import { TaskExecutorError } from '../errors/TaskExecutorError';

/**
 * Interface for the task executor component
 */
export interface TaskExecutor {
  /**
   * Execute a single task
   * 
   * @param task - The task to execute
   * @returns The execution result
   * @throws {TaskExecutorError} If there's an error during execution
   */
  executeTask(task: Task): Promise<TaskExecutionResult>;
  
  /**
   * Execute multiple tasks concurrently
   * 
   * @param tasks - Array of tasks to execute
   * @param maxConcurrent - Maximum number of tasks to run concurrently (optional)
   * @returns Array of execution results in the same order as the input tasks
   * @throws {TaskExecutorError} If there's an error during batch execution
   */
  executeTasks(tasks: Task[], maxConcurrent?: number): Promise<TaskExecutionResult[]>;
  
  /**
   * Cancel a running task
   * 
   * @param taskId - ID of the task to cancel
   * @returns true if the task was cancelled, false if it wasn't running or couldn't be cancelled
   * @throws {TaskExecutorError} If there's an error during cancellation
   */
  cancelTask(taskId: string): Promise<boolean>;
  
  /**
   * Get the currently running tasks
   * 
   * @returns Array of currently executing tasks
   * @throws {TaskExecutorError} If there's an error retrieving running tasks
   */
  getRunningTasks(): Promise<Task[]>;
  
  /**
   * Check if a task is currently running
   * 
   * @param taskId - ID of the task to check
   * @returns true if the task is currently running
   * @throws {TaskExecutorError} If there's an error checking the task status
   */
  isTaskRunning(taskId: string): Promise<boolean>;
  
  /**
   * Pause all task execution
   * 
   * @returns true if execution was paused successfully
   * @throws {TaskExecutorError} If there's an error pausing execution
   */
  pauseExecution(): Promise<boolean>;
  
  /**
   * Resume task execution after pausing
   * 
   * @returns true if execution was resumed successfully
   * @throws {TaskExecutorError} If there's an error resuming execution
   */
  resumeExecution(): Promise<boolean>;
} 