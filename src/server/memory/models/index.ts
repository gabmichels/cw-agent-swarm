/**
 * Memory schema exports
 */

// Base schemas
export * from './base-schema';

// Memory type schemas
export * from './message-schema';
export * from './thought-schema';
export * from './document-schema';
export * from './task-schema';
export * from './memory-edit-schema';

// Re-export schema types
import { MessageSchema } from './message-schema';
import { ThoughtSchema } from './thought-schema';
import { DocumentSchema } from './document-schema';
import { TaskSchema } from './task-schema';
import { MemoryEditSchema } from './memory-edit-schema';
import { MemoryType } from '../config';

/**
 * Union type of all memory schemas
 */
export type MemorySchema = 
  | MessageSchema
  | ThoughtSchema
  | DocumentSchema
  | TaskSchema
  | MemoryEditSchema;

/**
 * Map of memory types to their schema interfaces
 */
export type MemorySchemaMap = {
  [MemoryType.MESSAGE]: MessageSchema;
  [MemoryType.THOUGHT]: ThoughtSchema;
  [MemoryType.DOCUMENT]: DocumentSchema;
  [MemoryType.TASK]: TaskSchema;
  [MemoryType.MEMORY_EDIT]: MemoryEditSchema;
}; 