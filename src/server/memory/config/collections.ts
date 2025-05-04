/**
 * Memory collection configurations
 */
import { MemoryType } from './types';
import { COLLECTION_NAMES, DEFAULT_INDICES } from './constants';
import { CollectionConfig } from './types';
import {
  MessageSchema,
  MESSAGE_DEFAULTS,
  ThoughtSchema,
  THOUGHT_DEFAULTS,
  DocumentSchema,
  DOCUMENT_DEFAULTS,
  TaskSchema,
  TASK_DEFAULTS,
  MemoryEditSchema
} from '../models';
import { createMemoryEditDefaults } from '../models/memory-edit-schema';

/**
 * Message collection configuration
 */
export const MESSAGE_COLLECTION: CollectionConfig<MessageSchema> = {
  name: COLLECTION_NAMES[MemoryType.MESSAGE],
  schema: {} as MessageSchema, // Type definition only, not used at runtime
  indices: DEFAULT_INDICES[MemoryType.MESSAGE],
  defaults: MESSAGE_DEFAULTS
};

/**
 * Thought collection configuration
 */
export const THOUGHT_COLLECTION: CollectionConfig<ThoughtSchema> = {
  name: COLLECTION_NAMES[MemoryType.THOUGHT],
  schema: {} as ThoughtSchema, // Type definition only, not used at runtime
  indices: DEFAULT_INDICES[MemoryType.THOUGHT],
  defaults: THOUGHT_DEFAULTS
};

/**
 * Document collection configuration
 */
export const DOCUMENT_COLLECTION: CollectionConfig<DocumentSchema> = {
  name: COLLECTION_NAMES[MemoryType.DOCUMENT],
  schema: {} as DocumentSchema, // Type definition only, not used at runtime
  indices: DEFAULT_INDICES[MemoryType.DOCUMENT],
  defaults: DOCUMENT_DEFAULTS
};

/**
 * Task collection configuration
 */
export const TASK_COLLECTION: CollectionConfig<TaskSchema> = {
  name: COLLECTION_NAMES[MemoryType.TASK],
  schema: {} as TaskSchema, // Type definition only, not used at runtime
  indices: DEFAULT_INDICES[MemoryType.TASK],
  defaults: TASK_DEFAULTS
};

/**
 * Memory edit collection configuration
 * Note: Defaults are created at runtime via createMemoryEditDefaults()
 */
export const MEMORY_EDIT_COLLECTION: CollectionConfig<MemoryEditSchema> = {
  name: COLLECTION_NAMES[MemoryType.MEMORY_EDIT],
  schema: {} as MemoryEditSchema, // Type definition only, not used at runtime
  indices: DEFAULT_INDICES[MemoryType.MEMORY_EDIT],
  defaults: {} as Partial<MemoryEditSchema> // Defaults created at runtime
};

/**
 * Map of memory types to their collection configurations
 */
export const COLLECTION_CONFIGS: Record<MemoryType, CollectionConfig<any>> = {
  [MemoryType.MESSAGE]: MESSAGE_COLLECTION,
  [MemoryType.THOUGHT]: THOUGHT_COLLECTION,
  [MemoryType.DOCUMENT]: DOCUMENT_COLLECTION,
  [MemoryType.TASK]: TASK_COLLECTION,
  [MemoryType.MEMORY_EDIT]: MEMORY_EDIT_COLLECTION
};

/**
 * Get collection configuration for a specific memory type
 * @param type Memory type
 * @returns Collection configuration
 */
export function getCollectionConfig<T extends MemoryType>(
  type: T
): CollectionConfig<any> {
  return COLLECTION_CONFIGS[type];
}

/**
 * Get the collection name for a memory type
 * @param type Memory type
 * @returns Collection name
 */
export function getCollectionName(type: MemoryType): string {
  return COLLECTION_NAMES[type];
} 