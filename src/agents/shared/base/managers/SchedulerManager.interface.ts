/**
 * SchedulerManager.interface.ts - Scheduler Manager Interface
 * 
 * This file defines the scheduler manager interface that provides scheduling 
 * and task management for agents. It extends the base manager interface with 
 * scheduling-specific functionality.
 */

import { BaseManager, ManagerConfig } from './BaseManager';
import { ManagerType } from './ManagerType';

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
 * Status of a scheduled task
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'scheduled';

/**
 * A task that can be scheduled and executed
 */
export interface ScheduledTask {
  /**
   * Unique identifier for the task
   */
  id: string;

  /**
   * Title of the task
   */
  title: string;

  /**
   * Description of what the task does
   */
  description: string;

  /**
   * Type of task
   */
  type: string;

  /**
   * When the task was created
   */
  createdAt: Date;

  /**
   * When the task was last updated
   */
  updatedAt: Date;

  /**
   * Current status of the task
   */
  status: TaskStatus;

  /**
   * Priority of the task (0-1)
   */
  priority: number;

  /**
   * Number of retry attempts made
   */
  retryAttempts: number;

  /**
   * IDs of tasks that must complete before this one
   */
  dependencies: string[];

  /**
   * Additional task metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Options for creating a new task
 */
export interface TaskCreationOptions {
  /**
   * Title of the task
   */
  title: string;

  /**
   * Description of what the task does
   */
  description: string;

  /**
   * Type of task
   */
  type: string;

  /**
   * Priority of the task (0-1)
   */
  priority?: number;

  /**
   * IDs of tasks that must complete before this one
   */
  dependencies?: string[];

  /**
   * Additional task metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Result of creating a task
 */
export interface TaskCreationResult {
  /**
   * Whether the task was created successfully
   */
  success: boolean;

  /**
   * The created task if successful
   */
  task: ScheduledTask;
}

/**
 * Result of executing a task
 */
export interface TaskExecutionResult {
  /**
   * Whether the task executed successfully
   */
  success: boolean;

  /**
   * ID of the executed task
   */
  taskId: string;

  /**
   * Time taken to execute in milliseconds
   */
  durationMs?: number;

  /**
   * Error message if execution failed
   */
  error?: string;
}

/**
 * Task batch interface
 */
export interface TaskBatch {
  id: string;
  tasks: ScheduledTask[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
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

  /** Per-task resource utilization */
  taskUtilization?: Record<string, {
    cpuUtilization: number;
    memoryBytes: number;
    tokensPerMinute: number;
    apiCallsPerMinute: number;
  }>;
  
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
 * Interface for scheduler managers
 */
export interface SchedulerManager extends BaseManager {
  /**
   * Create a new task
   */
  createTask(options: TaskCreationOptions): Promise<TaskCreationResult>;

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Promise<ScheduledTask | null>;

  /**
   * Execute a task
   */
  executeTask(taskId: string): Promise<TaskExecutionResult>;

  /**
   * Retry a failed task
   */
  retryTask(taskId: string): Promise<TaskExecutionResult>;

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): Promise<boolean>;

  /**
   * Get all tasks
   */
  getTasks(): Promise<ScheduledTask[]>;

  /**
   * Get active tasks
   * @returns Promise resolving to active tasks
   */
  getActiveTasks(): Promise<ScheduledTask[]>;
  
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
   * Reset the manager state
   */
  reset(): Promise<boolean>;
} 