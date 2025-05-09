/**
 * Task Manager Interface
 * 
 * This file defines the task manager interface that provides task management
 * capabilities for agents. It extends the base manager interface.
 */

import type { BaseManager } from '../../../../agents/shared/base/managers/BaseManager';

/**
 * Configuration options for task managers
 */
export interface TaskManagerConfig {
  /** Whether this manager is enabled */
  enabled: boolean;
  
  /** Maximum concurrent tasks */
  maxConcurrentTasks?: number;
  
  /** Whether to save task history to memory */
  saveTaskHistory?: boolean;
  
  /** Default task timeout in milliseconds */
  defaultTaskTimeoutMs?: number;
  
  /** How frequently to check task status in milliseconds */
  taskCheckIntervalMs?: number;
  
  /** Whether to retry failed tasks automatically */
  autoRetryFailedTasks?: boolean;
  
  /** Maximum retry attempts for failed tasks */
  maxRetryAttempts?: number;
  
  /** Whether to use priority-based scheduling */
  usePriorityScheduling?: boolean;
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

/**
 * Task interface
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  
  /** Task title */
  title: string;
  
  /** Task description */
  description: string;
  
  /** Current task status */
  status: TaskStatus;
  
  /** Task priority */
  priority: TaskPriority;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** When task was started */
  startedAt?: Date;
  
  /** When task was completed/failed/cancelled */
  completedAt?: Date;
  
  /** Task result data (if completed) */
  result?: unknown;
  
  /** Error information (if failed) */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  
  /** Function to execute for this task */
  execute: () => Promise<unknown>;
  
  /** Task timeout in milliseconds */
  timeoutMs?: number;
  
  /** Number of retry attempts so far */
  retryCount: number;
  
  /** Maximum retry attempts allowed */
  maxRetries: number;
  
  /** Dependencies on other tasks by ID */
  dependencies?: string[];
  
  /** Tags for categorization */
  tags?: string[];
  
  /** Additional task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task creation options
 */
export interface TaskOptions {
  /** Task title */
  title: string;
  
  /** Task description */
  description: string;
  
  /** Function to execute */
  execute: () => Promise<unknown>;
  
  /** Task priority */
  priority?: TaskPriority;
  
  /** Task timeout in milliseconds */
  timeoutMs?: number;
  
  /** Dependencies on other tasks by ID */
  dependencies?: string[];
  
  /** Maximum retry attempts */
  maxRetries?: number;
  
  /** Tags for categorization */
  tags?: string[];
  
  /** Additional task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task filter options
 */
export interface TaskFilterOptions {
  /** Filter by status */
  status?: TaskStatus | TaskStatus[];
  
  /** Filter by priority */
  priority?: TaskPriority | TaskPriority[];
  
  /** Filter by creation date range */
  createdFrom?: Date;
  createdTo?: Date;
  
  /** Filter by tags */
  tags?: string[];
  
  /** Filter by search term in title/description */
  searchTerm?: string;
  
  /** Pagination limit */
  limit?: number;
  
  /** Pagination offset */
  offset?: number;
  
  /** Sort property */
  sortBy?: 'createdAt' | 'priority' | 'status';
  
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Task performance metrics interface
 */
export interface TaskMetrics {
  /** Total tasks processed */
  totalTasks: number;
  
  /** Completed tasks count */
  completedTasks: number;
  
  /** Failed tasks count */
  failedTasks: number;
  
  /** Average task completion time in milliseconds */
  avgCompletionTimeMs: number;
  
  /** Success rate (percentage) */
  successRate: number;
  
  /** Tasks by status */
  tasksByStatus: Record<TaskStatus, number>;
  
  /** Tasks by priority */
  tasksByPriority: Record<TaskPriority, number>;
  
  /** Performance by tag */
  performanceByTag?: Record<string, {
    count: number;
    successRate: number;
    avgCompletionTimeMs: number;
  }>;
}

/**
 * Task manager interface
 */
export interface TaskManager extends BaseManager {
  /**
   * Create a new task
   * @param options Task creation options
   * @returns Promise resolving to the created task
   */
  createTask(options: TaskOptions): Promise<Task>;
  
  /**
   * Get a task by ID
   * @param taskId The task ID to retrieve
   * @returns Promise resolving to the task or null if not found
   */
  getTask(taskId: string): Promise<Task | null>;
  
  /**
   * Find tasks matching the filter criteria
   * @param filter Filter options
   * @returns Promise resolving to matching tasks
   */
  findTasks(filter: TaskFilterOptions): Promise<Task[]>;
  
  /**
   * Start a task execution
   * @param taskId The task ID to start
   * @returns Promise resolving to the started task
   */
  startTask(taskId: string): Promise<Task>;
  
  /**
   * Complete a task with a result
   * @param taskId The task ID to complete
   * @param result The task result
   * @returns Promise resolving to the completed task
   */
  completeTask(taskId: string, result: unknown): Promise<Task>;
  
  /**
   * Fail a task with an error
   * @param taskId The task ID to fail
   * @param error The error that caused the failure
   * @returns Promise resolving to the failed task
   */
  failTask(taskId: string, error: Error | string): Promise<Task>;
  
  /**
   * Cancel a task
   * @param taskId The task ID to cancel
   * @returns Promise resolving to the cancelled task
   */
  cancelTask(taskId: string): Promise<Task>;
  
  /**
   * Retry a failed task
   * @param taskId The task ID to retry
   * @returns Promise resolving to the retried task
   */
  retryTask(taskId: string): Promise<Task>;
  
  /**
   * Delete a task
   * @param taskId The task ID to delete
   * @returns Promise resolving to true if deleted successfully
   */
  deleteTask(taskId: string): Promise<boolean>;
  
  /**
   * Get current task queue information
   * @returns Promise resolving to the current task queue status
   */
  getQueueStatus(): Promise<{
    totalTasks: number;
    runningTasks: number;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    cancelledTasks: number;
  }>;
  
  /**
   * Get task performance metrics
   * @param options Optional filter options for metrics
   * @returns Promise resolving to task metrics
   */
  getMetrics(options?: {
    timeframeStartDate?: Date;
    timeframeEndDate?: Date;
    includeTags?: boolean;
  }): Promise<TaskMetrics>;
  
  /**
   * Clear the task history
   * @param options Options for clearing tasks
   * @returns Promise resolving to the number of tasks cleared
   */
  clearTaskHistory(options?: {
    before?: Date;
    status?: TaskStatus | TaskStatus[];
  }): Promise<number>;
} 