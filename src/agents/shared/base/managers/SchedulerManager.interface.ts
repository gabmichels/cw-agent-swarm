/**
 * SchedulerManager.interface.ts - Scheduler Manager Interface
 * 
 * This file defines the scheduler manager interface that provides scheduling 
 * and task management for agents. It extends the base manager interface with 
 * scheduling-specific functionality.
 */

import { BaseManager, ManagerConfig } from './BaseManager';
import { ManagerType } from './ManagerType';
import { Task, TaskStatus, TaskScheduleType } from '../../../../lib/scheduler/models/Task.model';
import { TaskFilter } from '../../../../lib/scheduler/models/TaskFilter.model';
import { TaskExecutionResult } from '../../../../lib/scheduler/models/TaskExecutionResult.model';
import { SchedulerConfig } from '../../../../lib/scheduler/models/SchedulerConfig.model';
import { SchedulerMetrics } from '../../../../lib/scheduler/models/SchedulerMetrics.model';

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
  task: Task;
}

/**
 * Task batch interface
 */
export interface TaskBatch {
  id: string;
  tasks: Task[];
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

// Re-export Task type and related types for convenience
export type { Task as ScheduledTask } from '../../../../lib/scheduler/models/Task.model';
export type { TaskExecutionResult } from '../../../../lib/scheduler/models/TaskExecutionResult.model';
export type { TaskFilter } from '../../../../lib/scheduler/models/TaskFilter.model';
export type { SchedulerMetrics } from '../../../../lib/scheduler/models/SchedulerMetrics.model';

/**
 * Task creation options - simplified version for agent usage
 */
export interface TaskCreationOptions {
  /**
   * Name of the task (required)
   */
  name: string;

  /**
   * Description of what the task does
   */
  description?: string;

  /**
   * Schedule type (explicit, interval, priority)
   */
  scheduleType: TaskScheduleType;

  /**
   * Priority of the task (0-10, higher is more important)
   */
  priority?: number;

  /**
   * When to execute the task (specific time)
   */
  scheduledTime?: Date;

  /**
   * Interval configuration (for interval scheduling)
   */
  interval?: {
    /**
     * Interval expression (e.g., '1h', '30m', '1d')
     */
    expression: string;
    
    /**
     * Cron expression for more complex scheduling
     */
    cronExpression?: string;
    
    /**
     * Maximum number of times to execute (undefined = unlimited)
     */
    maxExecutions?: number;
    
    /**
     * Current execution count
     */
    executionCount: number;
  };

  /**
   * IDs of tasks that must complete before this one
   */
  dependencies?: string[];

  /**
   * Function to execute (will be serialized or referenced)
   */
  handler?: (...args: unknown[]) => Promise<unknown>;
  
  /**
   * Arguments to pass to the handler
   */
  handlerArgs?: unknown[];

  /**
   * Additional task metadata
   */
  metadata?: Record<string, unknown>;
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
   * Create a new task for a specific agent
   */
  createTaskForAgent(options: TaskCreationOptions, agentId: string): Promise<TaskCreationResult>;

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Promise<Task | null>;

  /**
   * Find tasks matching a filter
   */
  findTasks(filter: TaskFilter): Promise<Task[]>;

  /**
   * Find tasks specific to an agent
   */
  findTasksForAgent(agentId: string, filter?: TaskFilter): Promise<Task[]>;

  /**
   * Update an existing task
   */
  updateTask(task: Task): Promise<Task | null>;

  /**
   * Execute a task immediately
   */
  executeTaskNow(taskId: string): Promise<TaskExecutionResult>;

  /**
   * Execute a task (possibly according to schedule)
   */
  executeTask(taskId: string): Promise<TaskExecutionResult>;

  /**
   * Execute due tasks for a specific agent
   */
  executeDueTasksForAgent(agentId: string): Promise<TaskExecutionResult[]>;

  /**
   * Retry a failed task immediately
   */
  retryTaskNow(taskId: string): Promise<TaskExecutionResult>;

  /**
   * Retry a failed task
   */
  retryTask(taskId: string): Promise<TaskExecutionResult>;

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): Promise<boolean>;

  /**
   * Delete a task permanently
   */
  deleteTask(taskId: string): Promise<boolean>;

  /**
   * Get all tasks
   */
  getTasks(): Promise<Task[]>;

  /**
   * Get active tasks
   * @returns Promise resolving to active tasks
   */
  getActiveTasks(): Promise<Task[]>;
  
  /**
   * Get tasks that are due for execution
   * @returns Promise resolving to due tasks
   */
  getDueTasks(): Promise<Task[]>;
  
  /**
   * Get tasks that are currently running
   * @returns Promise resolving to running tasks
   */
  getRunningTasks(): Promise<Task[]>;
  
  /**
   * Get tasks that are pending execution
   * @returns Promise resolving to pending tasks
   */
  getPendingTasks(): Promise<Task[]>;
  
  /**
   * Get tasks that have failed
   * @returns Promise resolving to failed tasks
   */
  getFailedTasks(): Promise<Task[]>;
  
  /**
   * Get scheduler metrics
   */
  getMetrics(): Promise<SchedulerMetrics>;
  
  /**
   * Reset the manager state
   */
  reset(): Promise<boolean>;
} 