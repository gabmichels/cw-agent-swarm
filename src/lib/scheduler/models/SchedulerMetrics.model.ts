/**
 * SchedulerMetrics.model.ts - Scheduler Metrics Model
 * 
 * This file defines metrics for monitoring scheduler performance.
 */

/**
 * Task execution statistics
 */
export interface TaskExecutionStats {
  /**
   * Total number of task executions
   */
  totalExecutions: number;
  
  /**
   * Number of successful executions
   */
  successfulExecutions: number;
  
  /**
   * Number of failed executions
   */
  failedExecutions: number;
  
  /**
   * Number of cancelled executions
   */
  cancelledExecutions: number;
  
  /**
   * Number of retry attempts
   */
  retryAttempts: number;
  
  /**
   * Average execution time in milliseconds
   */
  averageExecutionTimeMs: number;
  
  /**
   * Minimum execution time in milliseconds
   */
  minExecutionTimeMs: number;
  
  /**
   * Maximum execution time in milliseconds
   */
  maxExecutionTimeMs: number;
  
  /**
   * Average wait time in queue in milliseconds
   */
  averageWaitTimeMs: number;
}

/**
 * Resource utilization metrics
 */
export interface ResourceUtilization {
  /**
   * CPU utilization (0-1)
   */
  cpuUtilization: number;
  
  /**
   * Memory usage in bytes
   */
  memoryBytes: number;
  
  /**
   * Token usage per minute (for LLM calls)
   */
  tokensPerMinute: number;
  
  /**
   * API calls per minute
   */
  apiCallsPerMinute: number;
}

/**
 * Task status counts
 */
export interface TaskStatusCounts {
  /**
   * Number of pending tasks
   */
  pending: number;
  
  /**
   * Number of running tasks
   */
  running: number;
  
  /**
   * Number of completed tasks
   */
  completed: number;
  
  /**
   * Number of failed tasks
   */
  failed: number;
  
  /**
   * Number of cancelled tasks
   */
  cancelled: number;
  
  /**
   * Number of deferred tasks
   */
  deferred: number;
}

/**
 * Interface for scheduler performance metrics
 */
export interface SchedulerMetrics {
  /**
   * Timestamp when metrics were collected
   */
  timestamp: Date;
  
  /**
   * Whether the scheduler is currently running
   */
  isRunning: boolean;
  
  /**
   * Scheduler uptime in milliseconds
   */
  uptime: number;
  
  /**
   * Total number of tasks across all statuses
   */
  totalTasks: number;
  
  /**
   * Count of tasks by status
   */
  taskStatusCounts: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    deferred: number;
  };
  
  /**
   * Stats about task execution
   */
  executionStats: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    cancelledExecutions: number;
    retryAttempts: number;
    averageExecutionTimeMs: number;
    minExecutionTimeMs: number;
    maxExecutionTimeMs: number;
    averageWaitTimeMs: number;
  };
  
  /**
   * Current resource utilization metrics
   */
  currentResourceUtilization: {
    cpuUtilization: number;
    memoryBytes: number;
    tokensPerMinute: number;
    apiCallsPerMinute: number;
  };
  
  /**
   * Number of scheduling iterations performed
   */
  schedulingIterations: number;
  
  /**
   * Average time to process a scheduling cycle in milliseconds
   */
  averageSchedulingTimeMs: number;
  
  /**
   * Number of priority adjustments made
   */
  priorityChanges: number;
  
  /**
   * Number of dependency violations detected
   */
  dependencyViolations: number;
  
  /**
   * Number of task timeouts
   */
  timeouts: number;
  
  /**
   * Average time for a scheduling loop in milliseconds
   */
  averageLoopTimeMs: number;
  
  /**
   * Number of tasks in the queue
   */
  queuedTasks: number;
  
  /**
   * Number of tasks that are currently active/running
   */
  activeTasks: number;
  
  /**
   * Task counts by schedule type
   */
  scheduledTasksByType: {
    explicit: number;
    interval: number;
    priority: number;
  };
  
  /**
   * Information about currently running tasks
   */
  currentlyRunningTasks: any[];
} 