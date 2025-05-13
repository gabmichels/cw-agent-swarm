/**
 * TaskTypes.ts
 * 
 * This file contains standardized types and enumerations related to tasks
 * in the agent system. These types are used throughout the codebase to ensure
 * consistency in task handling and status tracking.
 */

/**
 * Defines the possible statuses of a task in the system.
 * Used to track the progression of tasks through their lifecycle.
 * 
 * @enum {string}
 * @property {string} PENDING - Task is created but not yet started
 * @property {string} IN_PROGRESS - Task is currently being worked on
 * @property {string} COMPLETED - Task has been successfully completed
 * @property {string} FAILED - Task could not be completed successfully
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Enum defining the priority levels for task steps.
 * 
 * @enum {string}
 * @property {string} LOW - Low priority tasks
 * @property {string} MEDIUM - Medium priority tasks 
 * @property {string} HIGH - High priority tasks
 */
export enum PlanStepPriority {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high'
}

/**
 * Interface for task decomposition strategies.
 * Defines how a complex task can be broken down into smaller steps.
 * 
 * @enum {string}
 */
export enum TaskDecompositionStrategy {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  HIERARCHICAL = 'hierarchical',
  ADAPTIVE = 'adaptive'
}

/**
 * Basic interface for a task in the system.
 * 
 * @interface Task
 * @property {string} id - Unique identifier for the task
 * @property {string} description - Human-readable description of the task
 * @property {TaskStatus} status - Current status of the task
 * @property {number} priority - Numerical priority value (higher = more important)
 * @property {Date} created_at - When the task was created
 * @property {Date} updated_at - When the task was last updated
 * @property {Record<string, any>} [metadata] - Optional metadata for the task
 */
export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: number;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
} 