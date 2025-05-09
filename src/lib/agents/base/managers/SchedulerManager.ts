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
  
  /** Maximum concurrent tasks */
  maxConcurrentTasks?: number;
  
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
 * Scheduled task interface
 */
export interface ScheduledTask {
  /** Unique ID for the task */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Task description */
  description: string;
  
  /** Task type */
  type: 'one-time' | 'periodic' | 'event-triggered' | 'continuous';
  
  /** Task status */
  status: 'pending' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  
  /** Priority (higher number = higher priority) */
  priority: number;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last updated timestamp */
  updatedAt: Date;
  
  /** When this task is scheduled to run */
  scheduledAt?: Date;
  
  /** When this task started running */
  startedAt?: Date;
  
  /** When this task completed */
  completedAt?: Date;
  
  /** Deadline for this task */
  deadline?: Date;
  
  /** For periodic tasks, the interval in milliseconds */
  intervalMs?: number;
  
  /** For event-triggered tasks, the event trigger */
  triggerEvent?: {
    type: string;
    condition?: string;
    source?: string;
  };
  
  /** The function to execute when running this task */
  executeFn: () => Promise<unknown>;
  
  /** Task dependencies (IDs of tasks this depends on) */
  dependencies?: string[];
  
  /** Estimated duration in milliseconds */
  estimatedDurationMs?: number;
  
  /** Actual duration in milliseconds (if completed) */
  actualDurationMs?: number;
  
  /** Estimated resource requirements */
  estimatedResources?: {
    /** CPU utilization (0-1) */
    cpuUtilization?: number;
    
    /** Memory in bytes */
    memoryBytes?: number;
    
    /** Estimated token usage */
    tokenUsage?: number;
    
    /** Estimated API calls */
    apiCalls?: number;
  };
  
  /** Retry configuration */
  retry?: {
    /** Maximum retry attempts */
    maxAttempts: number;
    
    /** Current attempt count */
    attempts: number;
    
    /** Delay between retries in milliseconds */
    delayMs: number;
    
    /** Whether to use exponential backoff */
    useExponentialBackoff: boolean;
  };
  
  /** Execution results */
  result?: {
    /** Success or failure */
    success: boolean;
    
    /** Result data */
    data?: unknown;
    
    /** Error information if failed */
    error?: {
      message: string;
      code?: string;
      stack?: string;
    };
  };
  
  /** Tags for categorization */
  tags?: string[];
  
  /** Task-specific metadata */
  metadata?: Record<string, unknown>;
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
   * Schedule a task to be executed
   * @param task The task to schedule
   * @returns Promise resolving to the scheduled task
   */
  scheduleTask(
    task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<ScheduledTask>;
  
  /**
   * Cancel a scheduled task
   * @param taskId The task ID to cancel
   * @returns Promise resolving to true if cancelled, false if not found
   */
  cancelTask(taskId: string): Promise<boolean>;
  
  /**
   * Pause a running or scheduled task
   * @param taskId The task ID to pause
   * @returns Promise resolving to the updated task
   */
  pauseTask(taskId: string): Promise<ScheduledTask>;
  
  /**
   * Resume a paused task
   * @param taskId The task ID to resume
   * @returns Promise resolving to the updated task
   */
  resumeTask(taskId: string): Promise<ScheduledTask>;
  
  /**
   * Get a task by ID
   * @param taskId The task ID to retrieve
   * @returns Promise resolving to the task or null if not found
   */
  getTask(taskId: string): Promise<ScheduledTask | null>;
  
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
   * Update a task
   * @param taskId The task ID to update
   * @param updates The updates to apply
   * @returns Promise resolving to the updated task
   */
  updateTask(
    taskId: string,
    updates: Partial<Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ScheduledTask>;
  
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