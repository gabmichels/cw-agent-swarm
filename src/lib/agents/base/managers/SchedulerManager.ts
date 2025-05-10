/**
 * Scheduler Manager Interface
 * 
 * This file defines the scheduler manager interface that provides task scheduling,
 * prioritization, and execution services for agents. It extends the base manager interface
 * with scheduling-specific functionality.
 */

import type { BaseManager, ManagerConfig } from '../../../../agents/shared/base/managers/BaseManager';
import type { AgentBase } from '../../../../agents/shared/base/AgentBase';

/**
 * Configuration options for scheduler managers
 */
export interface SchedulerManagerConfig extends ManagerConfig {
  /** Whether this manager is enabled */
  enabled: boolean;
  
  /** Whether to enable automatic task scheduling */
  enableAutoScheduling?: boolean;
  
  /** Interval for checking scheduled tasks in milliseconds */
  schedulingIntervalMs?: number;
  
  /** Maximum number of concurrent tasks */
  maxConcurrentTasks?: number;
  
  /** Whether to enable task prioritization */
  enableTaskPrioritization?: boolean;
  
  /** Whether to enable task dependencies */
  enableTaskDependencies?: boolean;
  
  /** Whether to enable task retries */
  enableTaskRetries?: boolean;
  
  /** Maximum number of task retry attempts */
  maxRetryAttempts?: number;
  
  /** Whether to enable task timeouts */
  enableTaskTimeouts?: boolean;
  
  /** Default task timeout in milliseconds */
  defaultTaskTimeoutMs?: number;
  
  /** Default task priority */
  defaultPriority?: number;
  
  /** Whether to use adaptive scheduling */
  adaptiveScheduling?: boolean;
  
  /** Default scheduling algorithm */
  schedulingAlgorithm?: 'fifo' | 'priority' | 'deadline' | 'resource-aware' | 'custom';
  
  /** How aggressively to preempt tasks (0-1) */
  preemptionAggressiveness?: number;
  
  /** Whether to track resource utilization */
  trackResourceUtilization?: boolean;
  
  /** Whether to track task dependencies */
  trackDependencies?: boolean;
  
  /** Whether to enable task batching */
  enableBatching?: boolean;
  
  /** Maximum batch size */
  maxBatchSize?: number;
  
  /** Default deadline buffer in milliseconds */
  defaultDeadlineBufferMs?: number;
  
  /** Default interval for periodic tasks in milliseconds */
  defaultPeriodicIntervalMs?: number;
  
  /** Whether to persist scheduled tasks across sessions */
  persistTasks?: boolean;
  
  /** Resource limits */
  resourceLimits?: {
    /** CPU utilization limit (0-1) */
    cpuUtilization?: number;
    
    /** Memory limit in bytes */
    memoryBytes?: number;
    
    /** Token rate limit per minute */
    tokensPerMinute?: number;
    
    /** API call rate limit per minute */
    apiCallsPerMinute?: number;
  };
}

/**
 * Task structure
 */
export interface ScheduledTask {
  /** Unique identifier for this task */
  id: string;
  
  /** Task name */
  name: string;
  
  /** Task description */
  description: string;
  
  /** Task type */
  type: string;
  
  /** Task status */
  status: 'pending' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  
  /** Task priority (0-1) */
  priority: number;
  
  /** Task schedule (cron expression) */
  schedule?: string;
  
  /** When this task should start */
  startTime?: Date;
  
  /** When this task should end */
  endTime?: Date;
  
  /** Task dependencies */
  dependencies?: string[];
  
  /** Task parameters */
  parameters: Record<string, unknown>;
  
  /** Task metadata */
  metadata: Record<string, unknown>;
  
  /** When this task was created */
  createdAt: Date;
  
  /** When this task was last updated */
  updatedAt: Date;
  
  /** When this task was last executed */
  lastExecutedAt?: Date;
  
  /** Number of times this task has been executed */
  executionCount: number;
  
  /** Number of times this task has failed */
  failureCount: number;
}

/**
 * Options for task creation
 */
export interface TaskCreationOptions {
  /** Task name */
  name: string;
  
  /** Task description */
  description: string;
  
  /** Task type */
  type: string;
  
  /** Task priority (0-1) */
  priority?: number;
  
  /** Task schedule (cron expression) */
  schedule?: string;
  
  /** When this task should start */
  startTime?: Date;
  
  /** When this task should end */
  endTime?: Date;
  
  /** Task dependencies */
  dependencies?: string[];
  
  /** Task parameters */
  parameters?: Record<string, unknown>;
  
  /** Task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of task creation
 */
export interface TaskCreationResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Created task */
  task?: ScheduledTask;
  
  /** Error message if unsuccessful */
  error?: string;
}

/**
 * Result of task execution
 */
export interface TaskExecutionResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Updated task */
  task?: ScheduledTask;
  
  /** Error message if unsuccessful */
  error?: string;
}

/**
 * Task batch interface
 */
export interface TaskBatch {
  /** Unique ID for the batch */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Batch description */
  description: string;
  
  /** Task IDs in this batch */
  taskIds: string[];
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last updated timestamp */
  updatedAt: Date;
  
  /** Batch status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  
  /** When processing started */
  startedAt?: Date;
  
  /** When processing completed */
  completedAt?: Date;
  
  /** Priority (inherited from tasks or set explicitly) */
  priority: number;
  
  /** Execution strategy */
  executionStrategy: 'sequential' | 'parallel' | 'optimized';
  
  /** Success rate (0-1) */
  successRate?: number;
  
  /** Tags for categorization */
  tags?: string[];
  
  /** Batch-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Resource utilization interface
 */
export interface ResourceUtilization {
  /** Timestamp of this measurement */
  timestamp: Date;
  
  /** CPU utilization (0-1) */
  cpuUtilization: number;
  
  /** Memory utilization in bytes */
  memoryBytes: number;
  
  /** Token usage rate per minute */
  tokensPerMinute: number;
  
  /** API call rate per minute */
  apiCallsPerMinute: number;
  
  /** Number of active tasks */
  activeTasks: number;
  
  /** Number of pending tasks */
  pendingTasks: number;
  
  /** Resource utilization by task */
  taskUtilization?: Record<string, {
    cpuUtilization?: number;
    memoryBytes?: number;
    tokensPerMinute?: number;
    apiCallsPerMinute?: number;
  }>;
}

/**
 * Scheduler event interface
 */
export interface SchedulerEvent {
  /** Unique ID for the event */
  id: string;
  
  /** Event type */
  type: 'task-scheduled' | 'task-started' | 'task-completed' | 'task-failed' | 
        'task-cancelled' | 'task-paused' | 'task-resumed' | 'batch-created' | 
        'batch-completed' | 'resource-exceeded' | 'scheduler-paused' | 
        'scheduler-resumed' | 'custom';
  
  /** Event timestamp */
  timestamp: Date;
  
  /** Related task ID */
  taskId?: string;
  
  /** Related batch ID */
  batchId?: string;
  
  /** Event details */
  details?: Record<string, unknown>;
}

/**
 * Scheduler metrics interface
 */
export interface SchedulerMetrics {
  /** Time period these metrics cover */
  period: {
    start: Date;
    end: Date;
  };
  
  /** Task counts by status */
  taskCounts: Record<ScheduledTask['status'], number>;
  
  /** Task counts by type */
  taskTypeDistribution: Record<ScheduledTask['type'], number>;
  
  /** Average task completion time in milliseconds */
  avgTaskCompletionTimeMs: number;
  
  /** Success rate (0-1) */
  successRate: number;
  
  /** Throughput (tasks per minute) */
  throughput: number;
  
  /** Resource utilization summary */
  resourceUtilization?: {
    avgCpuUtilization: number;
    avgMemoryBytes: number;
    avgTokensPerMinute: number;
    avgApiCallsPerMinute: number;
    peakCpuUtilization: number;
    peakMemoryBytes: number;
    peakTokensPerMinute: number;
    peakApiCallsPerMinute: number;
  };
  
  /** Wait time metrics */
  waitTimeMs: {
    /** Average wait time */
    avg: number;
    
    /** Median wait time */
    median: number;
    
    /** 95th percentile wait time */
    p95: number;
    
    /** Maximum wait time */
    max: number;
    
    /** Wait time by priority level */
    byPriority?: Record<number, number>;
  };
  
  /** Batch metrics */
  batchMetrics?: {
    /** Total batches */
    totalBatches: number;
    
    /** Average batch size */
    avgBatchSize: number;
    
    /** Average batch processing time in milliseconds */
    avgProcessingTimeMs: number;
    
    /** Batch success rate (0-1) */
    successRate: number;
  };
}

/**
 * Scheduler manager interface
 */
export interface SchedulerManager extends BaseManager {
  /**
   * Create a new scheduled task
   * @param options Task creation options
   * @returns Promise resolving to the creation result
   */
  createTask(options: TaskCreationOptions): Promise<TaskCreationResult>;
  
  /**
   * Get a task by ID
   * @param taskId Task ID
   * @returns Promise resolving to the task
   */
  getTask(taskId: string): Promise<ScheduledTask | null>;
  
  /**
   * Get all tasks
   * @returns Promise resolving to all tasks
   */
  getAllTasks(): Promise<ScheduledTask[]>;
  
  /**
   * Update a task
   * @param taskId Task ID
   * @param updates Task updates
   * @returns Promise resolving to the updated task
   */
  updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null>;
  
  /**
   * Delete a task
   * @param taskId Task ID
   * @returns Promise resolving to whether the deletion was successful
   */
  deleteTask(taskId: string): Promise<boolean>;
  
  /**
   * Execute a task
   * @param taskId Task ID
   * @returns Promise resolving to the execution result
   */
  executeTask(taskId: string): Promise<TaskExecutionResult>;
  
  /**
   * Cancel a task
   * @param taskId Task ID
   * @returns Promise resolving to whether the cancellation was successful
   */
  cancelTask(taskId: string): Promise<boolean>;
  
  /**
   * Get tasks that are due for execution
   * @returns Promise resolving to tasks that are due
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
   * @param taskId Task ID
   * @returns Promise resolving to the execution result
   */
  retryTask(taskId: string): Promise<TaskExecutionResult>;
  
  /**
   * List tasks with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching tasks
   */
  listTasks(options?: {
    status?: ScheduledTask['status'][];
    type?: ScheduledTask['type'][];
    priority?: number;
    minPriority?: number;
    tags?: string[];
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
    sortBy?: 'priority' | 'scheduledAt' | 'createdAt' | 'updatedAt';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ScheduledTask[]>;
  
  /**
   * Create a batch of tasks
   * @param batch The batch to create
   * @returns Promise resolving to the created batch
   */
  createBatch(
    batch: Omit<TaskBatch, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'startedAt' | 'completedAt' | 'successRate'>
  ): Promise<TaskBatch>;
  
  /**
   * Get a batch by ID
   * @param batchId The batch ID to retrieve
   * @returns Promise resolving to the batch or null if not found
   */
  getBatch(batchId: string): Promise<TaskBatch | null>;
  
  /**
   * List batches with optional filtering
   * @param options Filter options
   * @returns Promise resolving to matching batches
   */
  listBatches(options?: {
    status?: TaskBatch['status'][];
    tags?: string[];
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<TaskBatch[]>;
  
  /**
   * Cancel a batch
   * @param batchId The batch ID to cancel
   * @returns Promise resolving to true if cancelled, false if not found
   */
  cancelBatch(batchId: string): Promise<boolean>;
  
  /**
   * Pause the scheduler
   * Stops processing new tasks but keeps currently running tasks
   * @returns Promise resolving to true if paused successfully
   */
  pauseScheduler(): Promise<boolean>;
  
  /**
   * Resume the scheduler
   * Resumes processing tasks
   * @returns Promise resolving to true if resumed successfully
   */
  resumeScheduler(): Promise<boolean>;
  
  /**
   * Get the current resource utilization
   * @returns Promise resolving to the current resource utilization
   */
  getResourceUtilization(): Promise<ResourceUtilization>;
  
  /**
   * Get resource utilization history
   * @param options History retrieval options
   * @returns Promise resolving to resource utilization history
   */
  getResourceUtilizationHistory(options?: {
    from?: Date;
    to?: Date;
    interval?: 'minute' | 'hour' | 'day';
    limit?: number;
  }): Promise<ResourceUtilization[]>;
  
  /**
   * Set resource limits
   * @param limits The resource limits to set
   * @returns Promise resolving to true if limits were set successfully
   */
  setResourceLimits(limits: SchedulerManagerConfig['resourceLimits']): Promise<boolean>;
  
  /**
   * Get recent scheduler events
   * @param options Event retrieval options
   * @returns Promise resolving to recent scheduler events
   */
  getEvents(options?: {
    types?: SchedulerEvent['type'][];
    from?: Date;
    to?: Date;
    taskId?: string;
    batchId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SchedulerEvent[]>;
  
  /**
   * Get statistics about scheduled tasks
   * @param options Statistics retrieval options
   * @returns Promise resolving to scheduler metrics
   */
  getMetrics(options?: {
    from?: Date;
    to?: Date;
    includeResourceMetrics?: boolean;
    includeBatchMetrics?: boolean;
  }): Promise<SchedulerMetrics>;
  
  /**
   * Subscribe to scheduler events
   * @param eventTypes The event types to subscribe to
   * @param callback The callback function to call when events occur
   * @returns Subscription ID
   */
  subscribeToEvents(
    eventTypes: SchedulerEvent['type'][],
    callback: (event: SchedulerEvent) => void
  ): string;
  
  /**
   * Unsubscribe from scheduler events
   * @param subscriptionId The subscription ID to unsubscribe
   * @returns Promise resolving to true if unsubscribed successfully
   */
  unsubscribeFromEvents(subscriptionId: string): Promise<boolean>;
} 