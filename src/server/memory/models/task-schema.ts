/**
 * Task memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema } from './base-schema';
import { TaskMetadata, TaskStatus, TaskPriority } from '../../../types/metadata';
import { MemoryImportanceLevel } from '../../../constants/memory';
import { EntityNamespace, EntityType, createEnumStructuredId } from '../../../types/structured-id';

/**
 * Task schema for storing objectives and goals
 */
export interface TaskSchema extends BaseMemorySchema {
  type: MemoryType.TASK;
  metadata: TaskMetadataSchema;
}

/**
 * Task-specific metadata
 * Extends TaskMetadata directly since we've unified the base interfaces
 */
export interface TaskMetadataSchema extends TaskMetadata {
  // No additional fields needed as TaskMetadata already contains everything
}

/**
 * Default values for task schema
 */
export const TASK_DEFAULTS: Partial<TaskSchema> = {
  type: MemoryType.TASK,
  metadata: {
    schemaVersion: "1.0.0",
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    title: "Untitled Task",
    createdBy: createEnumStructuredId(EntityNamespace.SYSTEM, EntityType.USER, 'system')
  }
}; 