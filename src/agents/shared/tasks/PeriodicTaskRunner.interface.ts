/**
 * Periodic Task Runner Interface
 * 
 * This file defines interfaces for running periodic tasks
 * like weekly reflections, daily summaries, etc.
 */

/**
 * Periodic task type
 */
export enum PeriodicTaskType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom'
}

/**
 * Periodic task status
 */
export enum PeriodicTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
  SKIPPED = 'skipped'
}

/**
 * Periodic task definition
 */
export interface PeriodicTask {
  /** Unique ID for the task */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Type of periodic task */
  type: PeriodicTaskType;
  
  /** When the task should next run */
  nextRunTime: Date;
  
  /** Custom cron expression for complex schedules */
  cronExpression?: string;
  
  /** Last time the task was run */
  lastRunTime?: Date;
  
  /** Current status of the task */
  status: PeriodicTaskStatus;
  
  /** Last execution result */
  lastResult?: string;
  
  /** Error from last execution if any */
  lastError?: string;
  
  /** Additional task metadata */
  metadata?: Record<string, unknown>;
  
  /** Optional target agent/component ID */
  targetId?: string;
  
  /** Task parameters */
  parameters?: Record<string, unknown>;
  
  /** Creation time */
  createdAt: Date;
  
  /** Last update time */
  updatedAt: Date;
  
  /** Whether the task is enabled */
  enabled: boolean;
}

/**
 * Periodic task execution result
 */
export interface PeriodicTaskResult {
  /** Task ID */
  taskId: string;
  
  /** Execution ID */
  executionId: string;
  
  /** Whether execution succeeded */
  success: boolean;
  
  /** Result details */
  result?: string | Record<string, unknown>;
  
  /** Error details if execution failed */
  error?: string;
  
  /** When execution started */
  startTime: Date;
  
  /** When execution completed */
  endTime: Date;
  
  /** Duration in milliseconds */
  durationMs: number;
  
  /** Updated task state */
  updatedTask: PeriodicTask;
}

/**
 * Periodic task runner interface
 */
export interface PeriodicTaskRunner {
  /**
   * Register a periodic task
   * 
   * @param task - Task to register
   * @returns Registered task
   */
  registerPeriodicTask(task: Omit<PeriodicTask, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<PeriodicTask>;
  
  /**
   * Get a task by ID
   * 
   * @param taskId - ID of task to retrieve
   * @returns Task or null if not found
   */
  getPeriodicTask(taskId: string): Promise<PeriodicTask | null>;
  
  /**
   * Update a task
   * 
   * @param taskId - ID of task to update
   * @param updates - Updates to apply
   * @returns Updated task
   */
  updatePeriodicTask(
    taskId: string, 
    updates: Partial<Omit<PeriodicTask, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<PeriodicTask>;
  
  /**
   * List tasks with optional filtering
   * 
   * @param options - Filter options
   * @returns Matching tasks
   */
  listPeriodicTasks(options?: {
    type?: PeriodicTaskType[];
    status?: PeriodicTaskStatus[];
    enabled?: boolean;
    targetId?: string;
    sortBy?: 'nextRunTime' | 'lastRunTime' | 'createdAt' | 'name';
    sortDirection?: 'asc' | 'desc';
  }): Promise<PeriodicTask[]>;
  
  /**
   * Run a task immediately
   * 
   * @param taskId - ID of task to run
   * @param options - Run options
   * @returns Execution result
   */
  runPeriodicTask(
    taskId: string,
    options?: {
      parameters?: Record<string, unknown>;
      updateNextRunTime?: boolean;
    }
  ): Promise<PeriodicTaskResult>;
  
  /**
   * Enable or disable a task
   * 
   * @param taskId - ID of task to update
   * @param enabled - Whether task should be enabled
   * @returns Updated task
   */
  setPeriodicTaskEnabled(
    taskId: string,
    enabled: boolean
  ): Promise<PeriodicTask>;
  
  /**
   * Delete a task
   * 
   * @param taskId - ID of task to delete
   * @returns Whether deletion succeeded
   */
  deletePeriodicTask(taskId: string): Promise<boolean>;
  
  /**
   * Get due tasks
   * 
   * @returns Tasks that are due to run
   */
  getDuePeriodicTasks(): Promise<PeriodicTask[]>;
  
  /**
   * Get execution history for a task
   * 
   * @param taskId - ID of task to get history for
   * @param options - History options
   * @returns Execution history
   */
  getTaskExecutionHistory(
    taskId: string,
    options?: {
      limit?: number;
      offset?: number;
      sortDirection?: 'asc' | 'desc';
    }
  ): Promise<PeriodicTaskResult[]>;
} 