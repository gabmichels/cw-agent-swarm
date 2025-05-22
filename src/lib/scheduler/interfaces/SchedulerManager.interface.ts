/**
 * SchedulerManager.interface.ts - Scheduler Manager Interface
 * 
 * This interface defines the contract for the scheduler manager component, which
 * orchestrates the task registry, scheduler, and executor components.
 */

import { Task } from '../models/Task.model';
import { TaskExecutionResult } from '../models/TaskExecutionResult.model';
import { TaskFilter } from '../models/TaskFilter.model';
import { SchedulerError } from '../errors/SchedulerError';
import { SchedulerConfig } from '../models/SchedulerConfig.model';
import { SchedulerMetrics } from '../models/SchedulerMetrics.model';

/**
 * Interface for the scheduler manager component
 */
export interface SchedulerManager {
  /**
   * Initialize the scheduler manager
   * 
   * @param config - Optional configuration to override defaults
   * @returns true if initialization was successful
   * @throws {SchedulerError} If there's an error during initialization
   */
  initialize(config?: Partial<SchedulerConfig>): Promise<boolean>;
  
  /**
   * Create a new task
   * 
   * @param task - The task to create
   * @returns The created task with generated metadata
   * @throws {SchedulerError} If the task cannot be created
   */
  createTask(task: Task): Promise<Task>;
  
  /**
   * Update an existing task
   * 
   * @param task - The task with updated fields
   * @returns The updated task
   * @throws {SchedulerError} If the task cannot be updated
   */
  updateTask(task: Task): Promise<Task>;
  
  /**
   * Delete a task
   * 
   * @param taskId - ID of the task to delete
   * @returns true if the task was deleted successfully
   * @throws {SchedulerError} If the task cannot be deleted
   */
  deleteTask(taskId: string): Promise<boolean>;
  
  /**
   * Get a task by its ID
   * 
   * @param taskId - ID of the task to retrieve
   * @returns The task if found, null otherwise
   * @throws {SchedulerError} If there's an error retrieving the task
   */
  getTask(taskId: string): Promise<Task | null>;
  
  /**
   * Find tasks matching the specified criteria
   * 
   * @param filter - Filter criteria for tasks
   * @returns Array of matching tasks
   * @throws {SchedulerError} If there's an error querying for tasks
   */
  findTasks(filter: TaskFilter): Promise<Task[]>;
  
  /**
   * Execute tasks that are due according to scheduling strategies
   * 
   * @returns Array of execution results for tasks that were executed
   * @throws {SchedulerError} If there's an error during scheduled execution
   */
  executeDueTasks(): Promise<TaskExecutionResult[]>;
  
  /**
   * Execute a specific task immediately, regardless of scheduling
   * 
   * @param taskId - ID of the task to execute
   * @returns The execution result
   * @throws {SchedulerError} If the task cannot be executed
   */
  executeTaskNow(taskId: string): Promise<TaskExecutionResult>;
  
  /**
   * Start the scheduler to automatically execute due tasks at intervals
   * 
   * @returns true if the scheduler was started successfully
   * @throws {SchedulerError} If the scheduler cannot be started
   */
  startScheduler(): Promise<boolean>;
  
  /**
   * Stop the scheduler from automatically executing tasks
   * 
   * @returns true if the scheduler was stopped successfully
   * @throws {SchedulerError} If the scheduler cannot be stopped
   */
  stopScheduler(): Promise<boolean>;
  
  /**
   * Check if the scheduler is currently running
   * 
   * @returns true if the scheduler is running
   */
  isSchedulerRunning(): boolean;
  
  /**
   * Get metrics about the scheduler's performance
   * 
   * @returns Metrics object with performance data
   * @throws {SchedulerError} If metrics cannot be collected
   */
  getMetrics(): Promise<SchedulerMetrics>;
  
  /**
   * Reset the scheduler state, clearing all tasks
   * 
   * @returns true if the scheduler was reset successfully
   * @throws {SchedulerError} If the scheduler cannot be reset
   */
  reset(): Promise<boolean>;
} 