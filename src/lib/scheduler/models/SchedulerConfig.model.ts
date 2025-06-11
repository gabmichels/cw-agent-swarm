/**
 * SchedulerConfig.model.ts - Scheduler Configuration Model
 * 
 * This file defines the configuration model for the scheduler system.
 */

/**
 * Configuration for the scheduler system
 */
export interface SchedulerConfig {
  /**
   * Whether the scheduler is enabled
   */
  enabled: boolean;
  
  /**
   * Whether to enable automatic scheduling
   */
  enableAutoScheduling: boolean;
  
  /**
   * Interval for checking scheduled tasks in milliseconds
   */
  schedulingIntervalMs: number;
  
  /**
   * Maximum number of concurrent tasks
   */
  maxConcurrentTasks: number;
  
  /**
   * Whether to enable task prioritization
   */
  enableTaskPrioritization: boolean;
  
  /**
   * Whether to enable task dependencies
   */
  enableTaskDependencies: boolean;
  
  /**
   * Whether to enable task retries
   */
  enableTaskRetries: boolean;
  
  /**
   * Maximum number of retry attempts
   */
  maxRetryAttempts: number;
  
  /**
   * Whether to enable task timeouts
   */
  enableTaskTimeouts: boolean;
  
  /**
   * Default task timeout in milliseconds
   */
  defaultTaskTimeoutMs: number;
  
  /**
   * Default task priority
   */
  defaultPriority: number;
  
  /**
   * Whether to use adaptive scheduling
   */
  adaptiveScheduling: boolean;
  
  /**
   * Default scheduling algorithm
   */
  schedulingAlgorithm: 'fifo' | 'priority' | 'deadline' | 'resource-aware' | 'custom';
  
  /**
   * How aggressively to preempt tasks (0-1)
   */
  preemptionAggressiveness: number;
  
  /**
   * Whether to track resource utilization
   */
  trackResourceUtilization: boolean;
  
  /**
   * Whether to track task dependencies
   */
  trackDependencies: boolean;
  
  /**
   * Whether to enable task batching
   */
  enableBatching: boolean;
  
  /**
   * Maximum batch size
   */
  maxBatchSize: number;
  
  /**
   * Default deadline buffer in milliseconds
   */
  defaultDeadlineBufferMs: number;
  
  /**
   * Default interval for periodic tasks in milliseconds
   */
  defaultPeriodicIntervalMs: number;
  
  /**
   * Whether to log scheduling activity
   */
  logSchedulingActivity: boolean;
  
  /**
   * Whether to enable visualization
   */
  enableVisualization: boolean;
  
  /**
   * Resource limits configuration
   */
  resourceLimits?: {
    /**
     * Maximum CPU utilization (0-1)
     */
    maxCpuUtilization?: number;
    
    /**
     * Maximum memory usage in bytes
     */
    maxMemoryBytes?: number;
    
    /**
     * Maximum tokens per minute for LLM calls
     */
    maxTokensPerMinute?: number;
    
    /**
     * Maximum API calls per minute
     */
    maxApiCallsPerMinute?: number;
  };
  
  /**
   * Storage configuration
   */
  storage?: {
    /**
     * Storage type
     */
    type: 'memory' | 'file' | 'database';
    
    /**
     * Path for file storage
     */
    filePath?: string;
    
    /**
     * Database connection string
     */
    connectionString?: string;
  };
  
  /**
   * Custom configuration options
   */
  [key: string]: unknown;
}

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  enabled: true,
  enableAutoScheduling: false,
  schedulingIntervalMs: 60000, // 1 minute
  maxConcurrentTasks: 10,
  enableTaskPrioritization: true,
  enableTaskDependencies: true,
  enableTaskRetries: true,
  maxRetryAttempts: 3,
  enableTaskTimeouts: true,
  defaultTaskTimeoutMs: 300000, // 5 minutes
  defaultPriority: 5,
  adaptiveScheduling: false,
  schedulingAlgorithm: 'priority',
  preemptionAggressiveness: 0.5,
  trackResourceUtilization: true,
  trackDependencies: true,
  enableBatching: false,
  maxBatchSize: 5,
  defaultDeadlineBufferMs: 300000, // 5 minutes
  defaultPeriodicIntervalMs: 3600000, // 1 hour
  logSchedulingActivity: true,
  enableVisualization: false,
  resourceLimits: {
    maxCpuUtilization: 0.8,
    maxMemoryBytes: 1024 * 1024 * 512, // 512 MB
    maxTokensPerMinute: 50000,
    maxApiCallsPerMinute: 100
  },
  storage: {
    type: 'memory'
  }
}; 