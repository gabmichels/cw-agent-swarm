/**
 * SchedulerManager.interface.ts - Scheduler Manager Interface
 * 
 * This file defines the scheduler manager interface that provides scheduling 
 * and task management for agents. It extends the base manager interface with 
 * scheduling-specific functionality.
 */

import { BaseManager, ManagerConfig } from './BaseManager';

/**
 * Configuration options for scheduler managers
 */
export interface SchedulerManagerConfig extends ManagerConfig {
  /** Whether to enable automatic task scheduling */
  enableAutoScheduling?: boolean;
  
  /** Interval for checking for due tasks in milliseconds */
  schedulingIntervalMs?: number;
  
  /** Maximum number of tasks that can run concurrently */
  maxConcurrentTasks?: number;
  
  /** Maximum number of retry attempts for failed tasks */
  maxRetryAttempts?: number;
  
  /** Default timeout for task execution in milliseconds */
  defaultTaskTimeoutMs?: number;
  
  /** Whether to enable task prioritization */
  enableTaskPrioritization?: boolean;
  
  /** Whether to enable task retries */
  enableTaskRetries?: boolean;
  
  /** Resource limits configuration */
  resourceLimits?: {
    maxCpuPercent?: number;
    maxMemoryBytes?: number;
    maxTokensPerMinute?: number;
    maxApiCallsPerMinute?: number;
  };
}

/**
 * Task creation options
 */
export interface TaskCreationOptions {
  /** Task title */
  title: string;
  
  /** Task description */
  description: string;
  
  /** Task type or category */
  type?: string;
  
  /** When the task should start */
  scheduledStartTime?: Date;
  
  /** Task deadline */
  dueDate?: Date;
  
  /** Task priority (0-1) */
  priority?: number;
  
  /** Task execution parameters */
  parameters?: Record<string, unknown>;
  
  /** Parent task ID if this is a subtask */
  parentTaskId?: string;
  
  /** Dependencies on other tasks (task IDs) */
  dependencies?: string[];
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task creation result
 */
export interface TaskCreationResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Created task (if successful) */
  task?: ScheduledTask;
  
  /** Error message (if unsuccessful) */
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Scheduled task
 */
export interface ScheduledTask {
  /** Unique task identifier */
  id: string;
  
  /** Task title */
  title: string;
  
  /** Task description */
  description: string;
  
  /** Task type or category */
  type?: string;
  
  /** When the task was created */
  createdAt: Date;
  
  /** When the task was last updated */
  updatedAt: Date;
  
  /** When the task should start */
  scheduledStartTime?: Date;
  
  /** Task deadline */
  dueDate?: Date;
  
  /** When the task started executing */
  startedAt?: Date;
  
  /** When the task completed executing */
  completedAt?: Date;
  
  /** Task status */
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  
  /** Task priority (0-1) */
  priority: number;
  
  /** Task execution parameters */
  parameters?: Record<string, unknown>;
  
  /** Parent task ID if this is a subtask */
  parentTaskId?: string;
  
  /** Dependencies on other tasks (task IDs) */
  dependencies: string[];
  
  /** Task result (if completed) */
  result?: unknown;
  
  /** Error details (if failed) */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  
  /** Number of retry attempts */
  retryAttempts: number;
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  
  /** Task ID */
  taskId: string;
  
  /** Execution result data (if successful) */
  result?: unknown;
  
  /** Error details (if unsuccessful) */
  error?: {
    message: string;
    code?: string;
  };
  
  /** Execution duration in milliseconds */
  durationMs: number;
  
  /** The task after execution */
  task?: ScheduledTask;
}

/**
 * Task batch
 */
export interface TaskBatch {
  /** Unique batch identifier */
  id: string;
  
  /** Batch name */
  name: string;
  
  /** Batch description */
  description?: string;
  
  /** Tasks in this batch */
  taskIds: string[];
  
  /** When the batch was created */
  createdAt: Date;
  
  /** When the batch was last updated */
  updatedAt: Date;
  
  /** When the batch started executing */
  startedAt?: Date;
  
  /** When the batch completed executing */
  completedAt?: Date;
  
  /** Batch status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'partial';
  
  /** Batch priority (0-1) */
  priority?: number;
  
  /** Success rate (0-1) */
  successRate: number;
  
  /** Batch execution parameters */
  parameters?: Record<string, unknown>;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Resource utilization metrics
 */
export interface ResourceUtilization {
  /** Timestamp when these metrics were recorded */
  timestamp: Date;
  
  /** CPU utilization percentage (0-100) */
  cpuUtilization: number;
  
  /** Memory usage in bytes */
  memoryBytes: number;
  
  /** Tokens consumed per minute */
  tokensPerMinute: number;
  
  /** API calls per minute */
  apiCallsPerMinute: number;
  
  /** Number of active tasks */
  activeTasks: number;
  
  /** Number of pending tasks */
  pendingTasks: number;
  
  /** Additional metrics */
  [key: string]: unknown;
}

/**
 * Scheduler event
 */
export interface SchedulerEvent {
  /** Unique event identifier */
  id: string;
  
  /** Event type */
  type: 'task_created' | 'task_started' | 'task_completed' | 'task_failed' | 'task_cancelled' | 
        'batch_created' | 'batch_completed' | 'batch_failed' | 'scheduler_paused' | 'scheduler_resumed' | 
        'resource_limit_reached' | 'error';
  
  /** When the event occurred */
  timestamp: Date;
  
  /** Associated task ID if applicable */
  taskId?: string;
  
  /** Associated batch ID if applicable */
  batchId?: string;
  
  /** Event details */
  details: Record<string, unknown>;
  
  /** Event severity */
  severity?: 'info' | 'warning' | 'error';
}

/**
 * Scheduler metrics
 */
export interface SchedulerMetrics {
  /** Time period for these metrics */
  period: {
    start: Date;
    end: Date;
  };
  
  /** Task-related metrics */
  taskMetrics?: {
    totalTasks: number;
    tasksCreated: number;
    tasksCompleted: number;
    tasksFailed: number;
    successRate: number;
    avgExecutionTime: number;
    avgWaitTime: number;
  };
  
  /** Batch-related metrics */
  batchMetrics?: {
    totalBatches: number;
    batchesCompleted: number;
    batchesFailed: number;
    successRate: number;
    avgCompletionTime: number;
  };
  
  /** Resource utilization metrics */
  resourceMetrics?: {
    avgCpuUtilization: number;
    peakCpuUtilization: number;
    avgMemoryUsage: number;
    peakMemoryUsage: number;
    totalTokensConsumed: number;
    totalApiCalls: number;
  };
  
  /** Additional metrics */
  [key: string]: unknown;
}

/**
 * Scheduler manager interface
 */
export interface SchedulerManager extends BaseManager {
  /**
   * Create a new task
   * @param options Task creation options
   * @returns Promise resolving to the task creation result
   */
  createTask(options: TaskCreationOptions): Promise<TaskCreationResult>;
  
  /**
   * Get a task by ID
   * @param taskId Task ID to retrieve
   * @returns Promise resolving to the task or null if not found
   */
  getTask(taskId: string): Promise<ScheduledTask | null>;
  
  /**
   * Get all tasks
   * @returns Promise resolving to all tasks
   */
  getAllTasks(): Promise<ScheduledTask[]>;
  
  /**
   * Update a task
   * @param taskId Task ID to update
   * @param updates Updates to apply
   * @returns Promise resolving to the updated task or null if not found
   */
  updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null>;
  
  /**
   * Delete a task
   * @param taskId Task ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  deleteTask(taskId: string): Promise<boolean>;
  
  /**
   * Execute a task
   * @param taskId Task ID to execute
   * @returns Promise resolving to the task execution result
   */
  executeTask(taskId: string): Promise<TaskExecutionResult>;
  
  /**
   * Cancel a task
   * @param taskId Task ID to cancel
   * @returns Promise resolving to true if cancelled, false if not found or not cancellable
   */
  cancelTask(taskId: string): Promise<boolean>;
  
  /**
   * Get tasks that are due for execution
   * @returns Promise resolving to due tasks
   */
  getDueTasks(): Promise<ScheduledTask[]>;
  
  /**
   * Get tasks that are currently running
   * @returns Promise resolving to running tasks
   */
  getRunningTasks(): Promise<ScheduledTask[]>;
  
  /**
   * Get tasks that are pending execution
   * @returns Promise resolving to pending tasks
   */
  getPendingTasks(): Promise<ScheduledTask[]>;
  
  /**
   * Get tasks that have failed
   * @returns Promise resolving to failed tasks
   */
  getFailedTasks(): Promise<ScheduledTask[]>;
  
  /**
   * Retry a failed task
   * @param taskId Task ID to retry
   * @returns Promise resolving to the task execution result
   */
  retryTask(taskId: string): Promise<TaskExecutionResult>;
} 