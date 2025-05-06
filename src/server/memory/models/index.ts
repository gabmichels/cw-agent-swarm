/**
 * Memory schema exports
 */

// Base schemas
export * from './base-schema';

// Memory type schemas
export * from './message-schema';
export * from './cognitive-process-schema';
export * from './document-schema';
export * from './task-schema';
export * from './memory-edit-schema';

// Note: thought-schema.ts is deprecated and will be removed in future versions
// All functionality has been moved to cognitive-process-schema.ts

// Re-export schema types
import { MessageSchema } from './message-schema';
import { 
  ThoughtSchema, 
  ReflectionSchema, 
  InsightSchema, 
  PlanningSchema,
  CognitiveProcessSchema
} from './cognitive-process-schema';
import { DocumentSchema } from './document-schema';
import { TaskSchema } from './task-schema';
import { MemoryEditSchema } from './memory-edit-schema';
import { MemoryType } from '../config';

/**
 * Union type of all memory schemas
 */
export type MemorySchema = 
  | MessageSchema
  | CognitiveProcessSchema  // Base cognitive process
  | ThoughtSchema
  | ReflectionSchema
  | InsightSchema
  | PlanningSchema
  | DocumentSchema
  | TaskSchema
  | MemoryEditSchema;

/**
 * Map of memory types to their schema interfaces
 */
export type MemorySchemaMap = {
  [MemoryType.MESSAGE]: MessageSchema;
  [MemoryType.THOUGHT]: ThoughtSchema;
  [MemoryType.REFLECTION]: ReflectionSchema;
  [MemoryType.INSIGHT]: InsightSchema;
  [MemoryType.TASK]: TaskSchema | PlanningSchema; // Task can be a planning memory
  [MemoryType.DOCUMENT]: DocumentSchema;
  [MemoryType.MEMORY_EDIT]: MemoryEditSchema;
  [MemoryType.ANALYSIS]: CognitiveProcessSchema; // General cognitive process for analysis
}; 