/**
 * Task Tracking Interface
 * 
 * This file defines interfaces for comprehensive task tracking and analysis,
 * enabling enhanced monitoring, reporting, and optimization of agent tasks.
 */

/**
 * Task execution status
 */
export enum TaskExecutionStatus {
  PENDING = 'pending',           // Scheduled but not yet started
  RUNNING = 'running',           // Currently executing
  COMPLETED = 'completed',       // Successfully completed
  FAILED = 'failed',             // Failed to complete
  CANCELED = 'canceled',         // Manually canceled
  SKIPPED = 'skipped',           // Skipped execution
  DEFERRED = 'deferred',         // Deferred to later time
  TIMEOUT = 'timeout'            // Timed out during execution
}

/**
 * Task priority level
 */
export enum TaskPriority {
  CRITICAL = 'critical',         // Must execute, can preempt others
  HIGH = 'high',                 // High importance
  MEDIUM = 'medium',             // Standard priority
  LOW = 'low',                   // Run when resources available
  BACKGROUND = 'background'      // Run only when system is idle
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  /** Success or failure */
  success: boolean;
  
  /** Execution status */
  status: TaskExecutionStatus;
  
  /** Result data (if successful) */
  data?: unknown;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Error details (if failed) */
  errorDetails?: Error | Record<string, unknown>;
  
  /** Time when execution started */
  startTime: Date;
  
  /** Time when execution ended */
  endTime: Date;
  
  /** Duration in milliseconds */
  durationMs: number;
  
  /** Memory usage during execution (in bytes) */
  memoryUsage?: number;
  
  /** CPU usage during execution (percentage) */
  cpuUsage?: number;
  
  /** Number of external API calls made */
  apiCallCount?: number;
  
  /** Tokens used (for LLM tasks) */
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  
  /** Task-specific metrics */
  metrics?: Record<string, number | string | boolean>;
  
  /** Resource consumption details */
  resources?: {
    /** Tool usage counts */
    toolUsage?: Record<string, number>;
    
    /** Database operations */
    databaseOperations?: {
      reads: number;
      writes: number;
      deletes: number;
      updates: number;
    };
    
    /** Network activity */
    network?: {
      requestCount: number;
      bytesReceived: number;
      bytesSent: number;
    };
  };
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task execution log entry
 */
export interface TaskLogEntry {
  /** Unique identifier */
  id: string;
  
  /** Associated task ID */
  taskId: string;
  
  /** Timestamp */
  timestamp: Date;
  
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';
  
  /** Log message */
  message: string;
  
  /** Associated execution phase */
  phase?: 'initialization' | 'execution' | 'completion' | 'error';
  
  /** Contextual data */
  context?: Record<string, unknown>;
}

/**
 * Task execution history entry
 */
export interface TaskExecutionHistory {
  /** Unique execution ID */
  executionId: string;
  
  /** Task ID */
  taskId: string;
  
  /** Execution result */
  result: TaskExecutionResult;
  
  /** Log entries for this execution */
  logs?: TaskLogEntry[];
  
  /** Trigger type (what initiated this execution) */
  triggerType: 'schedule' | 'manual' | 'event' | 'dependency';
  
  /** Trigger details */
  triggerDetails?: Record<string, unknown>;
  
  /** Task configuration used for this execution */
  configuration?: Record<string, unknown>;
}

/**
 * Task dependency relationship
 */
export interface TaskDependency {
  /** Source task ID (dependent task) */
  sourceTaskId: string;
  
  /** Target task ID (task being depended on) */
  targetTaskId: string;
  
  /** Dependency type */
  type: 'required' | 'optional' | 'conditional';
  
  /** Wait for specific status */
  waitForStatus?: TaskExecutionStatus;
  
  /** Condition for conditional dependencies */
  condition?: string;
  
  /** Maximum wait time in milliseconds */
  maxWaitTimeMs?: number;
  
  /** What to do if dependency fails */
  onFailure?: 'fail' | 'continue' | 'retry' | 'skip';
}

/**
 * Task performance metrics
 */
export interface TaskPerformanceMetrics {
  /** Task ID */
  taskId: string;
  
  /** Number of executions analyzed */
  executionCount: number;
  
  /** Success rate (0-1) */
  successRate: number;
  
  /** Average duration in milliseconds */
  avgDurationMs: number;
  
  /** Minimum duration in milliseconds */
  minDurationMs: number;
  
  /** Maximum duration in milliseconds */
  maxDurationMs: number;
  
  /** Standard deviation of duration */
  stdDevDurationMs: number;
  
  /** Average memory usage in bytes */
  avgMemoryUsage?: number;
  
  /** Average CPU usage percentage */
  avgCpuUsage?: number;
  
  /** Average token usage */
  avgTokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  
  /** Failure analysis */
  failures?: {
    /** Count by error type */
    byErrorType: Record<string, number>;
    
    /** Most common error message */
    mostCommonError: string;
    
    /** Mean time between failures (in milliseconds) */
    mtbf: number;
  };
  
  /** Task-specific average metrics */
  avgMetrics?: Record<string, number>;
  
  /** Trend analysis */
  trends?: {
    /** Duration trend direction */
    duration: 'improving' | 'stable' | 'degrading';
    
    /** Success rate trend direction */
    successRate: 'improving' | 'stable' | 'degrading';
    
    /** Resource usage trend direction */
    resourceUsage: 'improving' | 'stable' | 'degrading';
  };
  
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Task analysis report
 */
export interface TaskAnalysisReport {
  /** Report ID */
  id: string;
  
  /** Report generation timestamp */
  timestamp: Date;
  
  /** Report time period */
  period: {
    start: Date;
    end: Date;
  };
  
  /** Overall statistics */
  overall: {
    /** Total number of tasks */
    taskCount: number;
    
    /** Total number of executions */
    executionCount: number;
    
    /** Overall success rate */
    successRate: number;
    
    /** Average duration across all tasks */
    avgDurationMs: number;
    
    /** Tasks by status counts */
    tasksByStatus: Record<TaskExecutionStatus, number>;
  };
  
  /** Performance metrics by task */
  taskMetrics: TaskPerformanceMetrics[];
  
  /** Tasks sorted by different criteria */
  rankings: {
    /** Most frequently executed tasks */
    byFrequency: Array<{ taskId: string; executionCount: number }>;
    
    /** Longest running tasks */
    byDuration: Array<{ taskId: string; avgDurationMs: number }>;
    
    /** Tasks with highest failure rates */
    byFailureRate: Array<{ taskId: string; failureRate: number }>;
    
    /** Most resource-intensive tasks */
    byResourceUsage: Array<{ taskId: string; metric: string; value: number }>;
  };
  
  /** Identified issues */
  issues: Array<{
    /** Issue type */
    type: 'performance' | 'reliability' | 'resource' | 'dependency';
    
    /** Severity level */
    severity: 'critical' | 'high' | 'medium' | 'low';
    
    /** Affected task ID */
    taskId: string;
    
    /** Issue description */
    description: string;
    
    /** Recommended actions */
    recommendations: string[];
  }>;
  
  /** Suggested optimizations */
  optimizations: Array<{
    /** Optimization target task ID */
    taskId: string;
    
    /** Optimization type */
    type: 'scheduling' | 'resources' | 'dependencies' | 'configuration';
    
    /** Current value */
    currentValue?: unknown;
    
    /** Suggested value */
    suggestedValue: unknown;
    
    /** Expected improvement */
    expectedImprovement: string;
    
    /** Confidence level (0-1) */
    confidence: number;
  }>;
  
  /** Report format version */
  version: string;
}

/**
 * Task tracking configuration options
 */
export interface TaskTrackingOptions {
  /** Enable detailed logging */
  enableDetailedLogs?: boolean;
  
  /** Log retention period in days */
  logRetentionDays?: number;
  
  /** Enable performance metrics collection */
  enablePerformanceMetrics?: boolean;
  
  /** Metrics calculation interval in milliseconds */
  metricsCalculationInterval?: number;
  
  /** Resources to monitor */
  monitorResources?: {
    memory?: boolean;
    cpu?: boolean;
    network?: boolean;
    database?: boolean;
    tokens?: boolean;
  };
  
  /** Maximum log entries per task */
  maxLogEntriesPerTask?: number;
  
  /** Maximum history entries per task */
  maxHistoryEntriesPerTask?: number;
  
  /** Enable automatic analysis reports */
  enableAutomaticReports?: boolean;
  
  /** Report generation interval in milliseconds */
  reportGenerationInterval?: number;
}

/**
 * Task tracking system interface
 */
export interface TaskTrackingSystem {
  /**
   * Initialize the task tracking system
   * 
   * @param options Configuration options
   * @returns Promise resolving to initialization success
   */
  initialize(options: TaskTrackingOptions): Promise<boolean>;
  
  /**
   * Record task execution start
   * 
   * @param taskId Task ID
   * @param triggerType What triggered the execution
   * @param triggerDetails Additional trigger details
   * @returns Promise resolving to execution ID
   */
  recordTaskStart(
    taskId: string,
    triggerType: 'schedule' | 'manual' | 'event' | 'dependency',
    triggerDetails?: Record<string, unknown>
  ): Promise<string>;
  
  /**
   * Record task execution completion
   * 
   * @param executionId Execution ID from recordTaskStart
   * @param result Execution result
   * @returns Promise resolving to success
   */
  recordTaskCompletion(
    executionId: string,
    result: Omit<TaskExecutionResult, 'startTime' | 'durationMs'>
  ): Promise<boolean>;
  
  /**
   * Log a message for a task execution
   * 
   * @param executionId Execution ID
   * @param level Log level
   * @param message Log message
   * @param context Additional context
   * @param phase Execution phase
   * @returns Promise resolving to success
   */
  logTaskMessage(
    executionId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>,
    phase?: 'initialization' | 'execution' | 'completion' | 'error'
  ): Promise<boolean>;
  
  /**
   * Get task execution history
   * 
   * @param taskId Task ID
   * @param limit Maximum number of entries
   * @param offset Offset for pagination
   * @returns Promise resolving to task execution history
   */
  getTaskHistory(
    taskId: string,
    limit?: number,
    offset?: number
  ): Promise<TaskExecutionHistory[]>;
  
  /**
   * Get task execution logs
   * 
   * @param executionId Execution ID
   * @param filter Optional filter criteria
   * @returns Promise resolving to log entries
   */
  getTaskLogs(
    executionId: string,
    filter?: {
      level?: Array<'debug' | 'info' | 'warn' | 'error'>;
      phase?: Array<'initialization' | 'execution' | 'completion' | 'error'>;
      timeRange?: { start: Date; end: Date };
    }
  ): Promise<TaskLogEntry[]>;
  
  /**
   * Calculate performance metrics for a task
   * 
   * @param taskId Task ID
   * @param timeRange Optional time range to analyze
   * @returns Promise resolving to task performance metrics
   */
  calculateTaskMetrics(
    taskId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<TaskPerformanceMetrics>;
  
  /**
   * Generate task analysis report
   * 
   * @param timeRange Time range to analyze
   * @param taskIds Optional specific tasks to include (all if omitted)
   * @returns Promise resolving to task analysis report
   */
  generateAnalysisReport(
    timeRange: { start: Date; end: Date },
    taskIds?: string[]
  ): Promise<TaskAnalysisReport>;
  
  /**
   * Register a task dependency
   * 
   * @param dependency Task dependency to register
   * @returns Promise resolving to success
   */
  registerTaskDependency(dependency: TaskDependency): Promise<boolean>;
  
  /**
   * Get dependencies for a task
   * 
   * @param taskId Task ID
   * @param direction 'incoming' for tasks that this task depends on, 'outgoing' for tasks that depend on this task
   * @returns Promise resolving to task dependencies
   */
  getTaskDependencies(
    taskId: string,
    direction: 'incoming' | 'outgoing' | 'both'
  ): Promise<TaskDependency[]>;
  
  /**
   * Get tasks with performance issues
   * 
   * @param thresholds Threshold criteria for identifying issues
   * @returns Promise resolving to tasks with issues
   */
  getTasksWithIssues(
    thresholds: {
      minFailureRate?: number;
      maxAvgDuration?: number;
      minResourceUsage?: Record<string, number>;
    }
  ): Promise<Array<{ taskId: string; issues: string[] }>>;
  
  /**
   * Optimize task schedule based on performance data
   * 
   * @param taskIds Tasks to optimize (all if omitted)
   * @returns Promise resolving to optimization suggestions
   */
  suggestScheduleOptimizations(
    taskIds?: string[]
  ): Promise<Array<{
    taskId: string;
    currentSchedule: string;
    suggestedSchedule: string;
    reason: string;
  }>>;
  
  /**
   * Clear old task history and logs
   * 
   * @param olderThan Delete entries older than this date
   * @returns Promise resolving to number of entries deleted
   */
  cleanupOldData(olderThan: Date): Promise<{
    deletedLogs: number;
    deletedHistory: number;
  }>;
  
  /**
   * Export task data for external analysis
   * 
   * @param format Export format
   * @param timeRange Time range to export
   * @param taskIds Optional specific tasks to include
   * @returns Promise resolving to exported data
   */
  exportTaskData(
    format: 'json' | 'csv',
    timeRange: { start: Date; end: Date },
    taskIds?: string[]
  ): Promise<string>;
  
  /**
   * Shutdown the task tracking system
   * 
   * @returns Promise resolving to shutdown success
   */
  shutdown(): Promise<boolean>;
} 