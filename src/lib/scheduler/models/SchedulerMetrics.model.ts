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
 * Scheduler performance metrics
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
   * Time since the scheduler was started (milliseconds)
   */
  uptime: number;
  
  /**
   * Total number of tasks in the system
   */
  totalTasks: number;
  
  /**
   * Current counts of tasks by status
   */
  taskStatusCounts: TaskStatusCounts;
  
  /**
   * Task execution statistics
   */
  executionStats: TaskExecutionStats;
  
  /**
   * Current resource utilization
   */
  currentResourceUtilization: ResourceUtilization;
  
  /**
   * Number of scheduling iterations performed
   */
  schedulingIterations: number;
  
  /**
   * Average time per scheduling iteration in milliseconds
   */
  averageSchedulingTimeMs: number;
  
  /**
   * Number of task priority changes
   */
  priorityChanges: number;
  
  /**
   * Number of task dependency violations
   */
  dependencyViolations: number;
  
  /**
   * Number of task timeouts
   */
  timeouts: number;
  
  /**
   * Average scheduler loop time in milliseconds
   */
  averageLoopTimeMs: number;
  
  /**
   * Number of tasks currently in the queue
   */
  queuedTasks: number;
  
  /**
   * Number of tasks by schedule type
   */
  scheduleTypeCounts: {
    explicit: number;
    interval: number;
    priority: number;
  };
  
  /**
   * Task execution counts by hour of day (0-23)
   */
  executionsByHour: number[];
  
  /**
   * Custom metrics
   */
  custom: Record<string, number>;
} 