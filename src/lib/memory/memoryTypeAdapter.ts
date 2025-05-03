/**
 * Memory Type Adapter
 * 
 * This utility file provides adapter functions for converting between
 * memory-related enum types and string literals.
 */

import { ChloeMemoryType, MemoryType, MemorySource, ImportanceLevel } from '../../constants/memory';
import { QdrantMemoryType } from '../../server/qdrant';
import { ExtendedMemorySource } from '../../agents/chloe/types/memory';
import { TaskStatus, MessageRole, ReflectionType, PlanStepPriority } from '../../agents/chloe/types/state';

/**
 * Convert ChloeMemoryType enum to QdrantMemoryType string literal
 */
export function memoryTypeToQdrant(type: ChloeMemoryType): QdrantMemoryType {
  switch (type) {
    case ChloeMemoryType.MESSAGE:
      return 'message';
    case ChloeMemoryType.THOUGHT:
      return 'thought';
    case ChloeMemoryType.DOCUMENT:
      return 'document';
    case ChloeMemoryType.TASK:
      return 'task';
    default:
      // Default to 'document' for types not directly supported by Qdrant
      return 'document';
  }
}

/**
 * Convert QdrantMemoryType string literal to ChloeMemoryType enum
 */
export function qdrantToMemoryType(type: QdrantMemoryType): ChloeMemoryType {
  switch (type) {
    case 'message':
      return ChloeMemoryType.MESSAGE;
    case 'thought':
      return ChloeMemoryType.THOUGHT;
    case 'document':
      return ChloeMemoryType.DOCUMENT;
    case 'task':
      return ChloeMemoryType.TASK;
    default:
      return ChloeMemoryType.DOCUMENT;
  }
}

/**
 * Convert ExtendedMemorySource enum to string literal
 */
export function memorySourceToString(source: ExtendedMemorySource): string {
  return source;
}

/**
 * Convert string literal to ExtendedMemorySource enum
 */
export function stringToMemorySource(source: string): ExtendedMemorySource {
  switch (source) {
    case 'user':
      return ExtendedMemorySource.USER;
    case 'chloe':
      return ExtendedMemorySource.CHLOE;
    case 'system':
      return ExtendedMemorySource.SYSTEM;
    case 'tool':
      return ExtendedMemorySource.TOOL;
    case 'web':
      return ExtendedMemorySource.WEB;
    case 'external':
      return ExtendedMemorySource.EXTERNAL;
    case 'file':
      return ExtendedMemorySource.FILE;
    default:
      return ExtendedMemorySource.SYSTEM;
  }
}

/**
 * Convert ImportanceLevel enum to string literal
 */
export function importanceLevelToString(level: ImportanceLevel): string {
  return level;
}

/**
 * Convert string literal to ImportanceLevel enum
 */
export function stringToImportanceLevel(level: string): ImportanceLevel {
  switch (level) {
    case 'low':
      return ImportanceLevel.LOW;
    case 'medium':
      return ImportanceLevel.MEDIUM;
    case 'high':
      return ImportanceLevel.HIGH;
    case 'critical':
      return ImportanceLevel.CRITICAL;
    default:
      return ImportanceLevel.MEDIUM;
  }
}

/**
 * Convert TaskStatus enum to string literal
 */
export function taskStatusToString(status: TaskStatus): string {
  return status;
}

/**
 * Convert string literal to TaskStatus enum
 */
export function stringToTaskStatus(status: string): TaskStatus {
  switch (status) {
    case 'pending':
      return TaskStatus.PENDING;
    case 'in_progress':
      return TaskStatus.IN_PROGRESS;
    case 'completed':
      return TaskStatus.COMPLETED;
    case 'failed':
      return TaskStatus.FAILED;
    default:
      return TaskStatus.PENDING;
  }
}

/**
 * Convert MessageRole enum to string literal
 */
export function messageRoleToString(role: MessageRole): string {
  return role;
}

/**
 * Convert string literal to MessageRole enum
 */
export function stringToMessageRole(role: string): MessageRole {
  switch (role) {
    case 'user':
      return MessageRole.USER;
    case 'assistant':
      return MessageRole.ASSISTANT;
    case 'system':
      return MessageRole.SYSTEM;
    default:
      return MessageRole.SYSTEM;
  }
}

/**
 * Convert ReflectionType enum to string literal
 */
export function reflectionTypeToString(type: ReflectionType): string {
  return type;
}

/**
 * Convert string literal to ReflectionType enum
 */
export function stringToReflectionType(type: string): ReflectionType {
  switch (type) {
    case 'success':
      return ReflectionType.SUCCESS;
    case 'failure':
      return ReflectionType.FAILURE;
    case 'improvement':
      return ReflectionType.IMPROVEMENT;
    default:
      return ReflectionType.IMPROVEMENT;
  }
}

/**
 * Convert PlanStepPriority enum to string literal
 */
export function planStepPriorityToString(priority: PlanStepPriority): string {
  return priority;
}

/**
 * Convert string literal to PlanStepPriority enum
 */
export function stringToPlanStepPriority(priority: string): PlanStepPriority {
  switch (priority) {
    case 'low':
      return PlanStepPriority.LOW;
    case 'medium':
      return PlanStepPriority.MEDIUM;
    case 'high':
      return PlanStepPriority.HIGH;
    default:
      return PlanStepPriority.MEDIUM;
  }
} 