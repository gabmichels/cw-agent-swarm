/**
 * Task.model.ts - Task Model
 * 
 * This file defines the data model for scheduled tasks.
 */

import { ulid } from 'ulid';

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  DEFERRED = 'deferred'
}

/**
 * Task schedule type enum
 */
export enum TaskScheduleType {
  EXPLICIT = 'explicit',  // Tasks with a specific scheduled time
  INTERVAL = 'interval',  // Tasks that repeat at intervals
  PRIORITY = 'priority'   // Tasks scheduled based on priority
}

/**
 * Task priority enum
 */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Convert TaskPriority enum to numeric priority value
 * 
 * @param priority TaskPriority enum value
 * @returns Numeric priority (0-10, higher is more important)
 */
export function taskPriorityToNumber(priority: TaskPriority): number {
  switch (priority) {
    case TaskPriority.LOW:
      return 2;
    case TaskPriority.MEDIUM:
      return 5;
    case TaskPriority.HIGH:
      return 8;
    case TaskPriority.URGENT:
      return 10;
    default:
      return 5; // Default to medium priority
  }
}

/**
 * Task metadata type
 */
export interface TaskMetadata {
  /**
   * Custom tags for categorizing tasks
   */
  tags?: string[];
  
  /**
   * Time it took to execute the task (in milliseconds)
   */
  executionTime?: number;
  
  /**
   * Time the task waited in the queue (in milliseconds)
   */
  waitTime?: number;
  
  /**
   * Number of times the task has been retried
   */
  retryCount?: number;
  
  /**
   * Error information if the task failed
   */
  errorInfo?: {
    message: string;
    code?: string;
    stack?: string;
  };
  
  /**
   * Additional custom metadata
   */
  [key: string]: unknown;
}

/**
 * Task dependency configuration
 */
export interface TaskDependency {
  /**
   * ID of the task this task depends on
   */
  taskId: string;
  
  /**
   * Required status of the dependent task
   */
  requiredStatus: TaskStatus;
}

/**
 * Task model interface
 */
export interface Task {
  /**
   * Unique identifier for the task
   */
  id: string;
  
  /**
   * Name of the task
   */
  name: string;
  
  /**
   * Description of the task
   */
  description?: string;
  
  /**
   * Type of schedule for this task
   */
  scheduleType: TaskScheduleType;
  
  /**
   * Function to execute when the task runs
   */
  handler: (...args: unknown[]) => Promise<unknown>;
  
  /**
   * Arguments to pass to the handler
   */
  handlerArgs?: unknown[];
  
  /**
   * Current status of the task
   */
  status: TaskStatus;
  
  /**
   * Priority level (0-10, higher is more important)
   */
  priority: number;
  
  /**
   * When to execute the task (for explicit scheduling)
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
   * Task dependencies that must be satisfied before execution
   */
  dependencies?: TaskDependency[];
  
  /**
   * When the task was created
   */
  createdAt: Date;
  
  /**
   * When the task was last updated
   */
  updatedAt: Date;
  
  /**
   * When the task was last executed
   */
  lastExecutedAt?: Date;
  
  /**
   * When the task execution is expected to complete (for timeouts)
   */
  expectedCompletionTime?: Date;
  
  /**
   * Additional task metadata
   */
  metadata?: TaskMetadata;
}

/**
 * Create a new task with default values
 * 
 * @param partial - Partial task data
 * @returns A complete task object with defaults filled in
 */
export function createTask(partial: Partial<Task>): Task {
  const now = new Date();
  
  return {
    id: partial.id || ulid(),
    name: partial.name || 'Unnamed Task',
    description: partial.description,
    scheduleType: partial.scheduleType || TaskScheduleType.EXPLICIT,
    handler: partial.handler || (async () => {}),
    handlerArgs: partial.handlerArgs || [],
    status: partial.status || TaskStatus.PENDING,
    priority: partial.priority !== undefined ? partial.priority : 5,
    scheduledTime: partial.scheduledTime,
    interval: partial.interval,
    dependencies: partial.dependencies || [],
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
    lastExecutedAt: partial.lastExecutedAt,
    expectedCompletionTime: partial.expectedCompletionTime,
    metadata: partial.metadata || {}
  };
} 