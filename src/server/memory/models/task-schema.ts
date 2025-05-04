/**
 * Task memory schema
 */
import { ImportanceLevel, MemoryType } from '../config';
import { BaseMemorySchema, BaseMetadataSchema } from './base-schema';

/**
 * Task status types
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task-specific metadata
 */
export interface TaskMetadataSchema extends BaseMetadataSchema {
  // Task status info
  status: TaskStatus;
  priority: TaskPriority;
  
  // Scheduling info
  dueDate?: string;
  completedAt?: string;
  startedAt?: string;
  
  // Assignment
  assignedTo?: string;
  createdBy?: string;
  
  // Progress
  progress?: number;
  progressNotes?: string[];
  
  // Parent/child relationships
  parentTaskId?: string;
  childTaskIds?: string[];
  
  // Dependencies
  dependsOn?: string[];
  blockedBy?: string[];
}

/**
 * Task schema
 */
export interface TaskSchema extends BaseMemorySchema {
  type: MemoryType.TASK;
  metadata: TaskMetadataSchema;
}

/**
 * Default values for task schema
 */
export const TASK_DEFAULTS: Partial<TaskSchema> = {
  type: MemoryType.TASK,
  metadata: {
    status: 'pending',
    priority: 'medium',
    importance: ImportanceLevel.MEDIUM,
  }
}; 