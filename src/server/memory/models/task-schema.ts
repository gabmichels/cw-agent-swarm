/**
 * Task memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema } from './base-schema';
import { BaseMetadata, TaskStatus, TaskPriority } from '../../../types/metadata';
import { MemoryImportanceLevel } from '../../../constants/memory';

/**
 * Task schema for storing objectives and goals
 */
export interface TaskSchema extends BaseMemorySchema {
  type: MemoryType.TASK;
  metadata: TaskMetadataSchema;
}

/**
 * Task-specific metadata
 */
export interface TaskMetadataSchema extends BaseMetadata {
  // Task status and priority
  status: TaskStatus;
  priority: TaskPriority;
  
  // Task timing
  dueDate?: string;
  startDate?: string;
  completedDate?: string;
  
  // Task assignment
  assignedTo?: string;
  createdBy?: string;
  
  // Task relationships
  parentTaskId?: string;
  subtaskIds?: string[];
  dependsOn?: string[];
  blockedBy?: string[];
  
  // Task category and metadata
  category?: string;
  estimatedDuration?: string;
  actualDuration?: string;
  progress?: number; // 0-100
}

/**
 * Default values for task schema
 */
export const TASK_DEFAULTS: Partial<TaskSchema> = {
  type: MemoryType.TASK,
  metadata: {
    schemaVersion: "1.0.0",
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM
  }
}; 