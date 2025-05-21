/**
 * Memory collection configurations
 */
import { MemoryType } from './types';
import { 
  COLLECTION_NAMES, 
  DEFAULT_INDICES, 
  getCollectionNameWithFallback, 
  getDefaultIndicesWithFallback 
} from './constants';
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
  name: getCollectionNameWithFallback(MemoryType.MESSAGE),
  schema: {} as MessageSchema, // Type definition only, not used at runtime
  indices: getDefaultIndicesWithFallback(MemoryType.MESSAGE),
  defaults: MESSAGE_DEFAULTS
};

/**
 * Thought collection configuration
 */
export const THOUGHT_COLLECTION: CollectionConfig<ThoughtSchema> = {
  name: getCollectionNameWithFallback(MemoryType.THOUGHT),
  schema: {} as ThoughtSchema, // Type definition only, not used at runtime
  indices: getDefaultIndicesWithFallback(MemoryType.THOUGHT),
  defaults: THOUGHT_DEFAULTS
};

/**
 * Document collection configuration
 */
export const DOCUMENT_COLLECTION: CollectionConfig<DocumentSchema> = {
  name: getCollectionNameWithFallback(MemoryType.DOCUMENT),
  schema: {} as DocumentSchema, // Type definition only, not used at runtime
  indices: getDefaultIndicesWithFallback(MemoryType.DOCUMENT),
  defaults: DOCUMENT_DEFAULTS
};

/**
 * Task collection configuration
 */
export const TASK_COLLECTION: CollectionConfig<TaskSchema> = {
  name: getCollectionNameWithFallback(MemoryType.TASK),
  schema: {} as TaskSchema, // Type definition only, not used at runtime
  indices: getDefaultIndicesWithFallback(MemoryType.TASK),
  defaults: TASK_DEFAULTS
};

/**
 * Memory edit collection configuration
 * Note: Defaults are created at runtime via createMemoryEditDefaults()
 */
export const MEMORY_EDIT_COLLECTION: CollectionConfig<MemoryEditSchema> = {
  name: getCollectionNameWithFallback(MemoryType.MEMORY_EDIT),
  schema: {} as MemoryEditSchema, // Type definition only, not used at runtime
  indices: getDefaultIndicesWithFallback(MemoryType.MEMORY_EDIT),
  defaults: {} as Partial<MemoryEditSchema> // Defaults created at runtime
};

/**
 * Visualization collection configuration
 * This is a dedicated collection for agent thinking visualizations
 * Note: This is NOT a memory collection, but uses same database infrastructure
 */
export const VISUALIZATION_COLLECTION = {
  name: 'thinking_visualizations',
  // Using any for now as visualization schema is defined elsewhere
  schema: {} as any,
  // We're not using CollectionConfig<T> here since visualizations aren't memories
  // and will have their own dedicated access methods
  indices: [] as string[],
  defaults: {}
};

// Define a separate constant for visualization indices
export const VISUALIZATION_INDICES = [
  {
    field: 'metadata.chatId',
    indexName: 'chatId',
    fieldType: 'keyword'
  },
  {
    field: 'metadata.messageId',
    indexName: 'messageId',
    fieldType: 'keyword'
  },
  {
    field: 'metadata.userId',
    indexName: 'userId',
    fieldType: 'keyword'
  },
  {
    field: 'metadata.agentId',
    indexName: 'agentId',
    fieldType: 'keyword'
  },
  {
    field: 'metadata.requestId',
    indexName: 'requestId',
    fieldType: 'keyword'
  },
  {
    field: 'metadata.timestamp',
    indexName: 'timestamp',
    fieldType: 'integer'
  }
];

/**
 * Map of memory types to their collection configurations
 * Note: This is a selective subset of memory types that map to actual collections.
 * Other memory types are logically mapped to one of these core collections with appropriate metadata/tags.
 */
export const COLLECTION_CONFIGS: Partial<Record<MemoryType, CollectionConfig<any>>> = {
  [MemoryType.MESSAGE]: MESSAGE_COLLECTION,
  [MemoryType.THOUGHT]: THOUGHT_COLLECTION,
  [MemoryType.DOCUMENT]: DOCUMENT_COLLECTION,
  [MemoryType.TASK]: TASK_COLLECTION,
  [MemoryType.MEMORY_EDIT]: MEMORY_EDIT_COLLECTION,
  [MemoryType.TOOL_EXECUTION_METRICS]: DOCUMENT_COLLECTION, // Store tool metrics in document collection
  // Remove visualization from memory types
  // [MemoryType.VISUALIZATION]: VISUALIZATION_COLLECTION,
};

/**
 * Get collection configuration for a specific memory type
 * @param type Memory type
 * @returns Collection configuration
 */
export function getCollectionConfig<T extends MemoryType>(
  type: T
): CollectionConfig<any> {
  // If no direct configuration exists, use message collection as fallback
  return COLLECTION_CONFIGS[type] || COLLECTION_CONFIGS[MemoryType.MESSAGE] || MESSAGE_COLLECTION;
}

/**
 * Get the collection name for a memory type
 * @param type Memory type
 * @returns Collection name
 */
export function getCollectionName(type: MemoryType): string {
  return getCollectionNameWithFallback(type);
} 