/**
 * Constants for memory system
 */
import { ImportanceLevel, MemoryType } from './types';

/**
 * Collection names in Qdrant mapped to memory types
 * This standardizes the relationship between memory types and collection names
 * Note: This is a selective subset of memory types that map to actual collections in storage.
 * Other memory types are stored in these core collections with appropriate tags/metadata.
 */
export const COLLECTION_NAMES: Partial<Record<MemoryType, string>> = {
  [MemoryType.MESSAGE]: 'messages',
  [MemoryType.THOUGHT]: 'thoughts',
  [MemoryType.REFLECTION]: 'reflections',
  [MemoryType.INSIGHT]: 'insights',
  [MemoryType.DOCUMENT]: 'documents',
  [MemoryType.TASK]: 'tasks',
  [MemoryType.MEMORY_EDIT]: 'memory_edits',
  [MemoryType.ANALYSIS]: 'analysis',
};

// Function to get a collection name with fallback to message collection
export function getCollectionNameWithFallback(type: MemoryType): string {
  return COLLECTION_NAMES[type] || COLLECTION_NAMES[MemoryType.MESSAGE] || 'messages';
}

/**
 * Filter keys for Qdrant queries - ensures consistent filtering
 */
export const FILTER_KEYS = {
  METADATA: 'metadata',
  USER_ID: 'userId',
  AGENT_ID: 'agentId',
  CHAT_ID: 'chatId',
  ROLE: 'role',
  SOURCE: 'source',
  MESSAGE_TYPE: 'messageType',
  IMPORTANCE: 'importance',
  THREAD_ID: 'thread.id',
  THREAD_POSITION: 'thread.position',
  PROCESS_TYPE: 'processType',
  CONTEXT_ID: 'contextId',
  TIMESTAMP: 'timestamp',
  SCHEMA_VERSION: 'schemaVersion',
  // Legacy fields - will be removed in future versions
  INTERNAL_MESSAGE: 'isInternalMessage',
  NOT_FOR_CHAT: 'notForChat',
};

/**
 * Default values for memory operations
 */
export const DEFAULTS = {
  DIMENSIONS: 1536,              // Default embedding dimensions
  CONNECTION_TIMEOUT: 5000,      // Connection timeout in ms
  FETCH_TIMEOUT: 30000,          // Fetch timeout in ms
  DEFAULT_USER_ID: 'default',    // Default user ID
  DEFAULT_LIMIT: 10,             // Default result limit
  MAX_LIMIT: 2000,               // Maximum result limit
  EMBEDDING_MODEL: 'text-embedding-3-small', // Default embedding model
  IMPORTANCE: ImportanceLevel.MEDIUM, // Default importance level
  SCHEMA_VERSION: '1.0.0',       // Default schema version
};

/**
 * Storage keys for persistence
 */
export const STORAGE_KEYS = {
  SAVED_ATTACHMENTS: 'saved-attachments',
  IMAGE_DATA: 'image-data',
  INDEXED_DB_NAME: 'memory-storage',
  ATTACHMENT_STORE: 'file-attachments',
  DEV_SHOW_INTERNAL_MESSAGES: 'DEV_SHOW_INTERNAL_MESSAGES',
};

/**
 * Common metadata field names
 * Standardized field names to use across all memory types
 */
export const METADATA_FIELDS = {
  // Core fields
  ID: 'id',
  TIMESTAMP: 'timestamp',
  TYPE: 'type',
  TEXT: 'text',
  SCHEMA_VERSION: 'schemaVersion',
  
  // Structured IDs
  USER_ID: 'userId',
  AGENT_ID: 'agentId',
  CHAT_ID: 'chatId',
  ASSIGNED_TO: 'assignedTo',
  CREATED_BY: 'createdBy',
  
  // Thread info
  THREAD: 'thread',
  THREAD_ID: 'thread.id',
  THREAD_POSITION: 'thread.position',
  THREAD_PARENT_ID: 'thread.parentId',
  
  // Importance fields
  IMPORTANCE: 'importance',
  IMPORTANCE_SCORE: 'importance_score',
  CRITICAL: 'critical',
  
  // Usage fields
  USAGE_COUNT: 'usage_count',
  LAST_USED: 'last_used',
  
  // Tags
  TAGS: 'tags',
  TAG_CONFIDENCE: 'tag_confidence',
  
  // Relationships
  LED_TO: 'led_to',
  CAUSED_BY: 'caused_by',
  RELATED_TO: 'relatedTo',
  INFLUENCES: 'influences',
  INFLUENCED_BY: 'influencedBy',
  
  // Soft deletion
  IS_DELETED: 'is_deleted',
  DELETION_TIMESTAMP: 'deletion_timestamp',
  
  // Version fields
  CURRENT: 'current',
  PREVIOUS_VERSION_ID: 'previous_version_id',
  EDITOR_TYPE: 'editor_type',
  EDITOR_ID: 'editor_id',
  
  // Message-specific
  ROLE: 'role',
  MESSAGE_TYPE: 'messageType',
  ATTACHMENTS: 'attachments',
  VISION_RESPONSE_FOR: 'visionResponseFor',
  
  // Cognitive process
  PROCESS_TYPE: 'processType',
  CONTEXT_ID: 'contextId',
  
  // Authentication and tenant context
  AUTH_CONTEXT: 'authContext',
  TENANT_CONTEXT: 'tenantContext',
  
  // Legacy fields - will be removed in future versions
  IS_INTERNAL_MESSAGE: 'isInternalMessage',
  NOT_FOR_CHAT: 'notForChat',
};

/**
 * Common message types
 */
export const MESSAGE_TYPES = {
  TEXT: 'text',
  THOUGHT: 'thought',
  REFLECTION: 'reflection',
  PLANNING: 'planning',
  SYSTEM: 'system',
  TOOL_LOG: 'tool_log',
  MEMORY_LOG: 'memory_log',
  AGENT_COMMUNICATION: 'agent-communication',
};

/**
 * Default indices for collections
 * These fields should be indexed for faster filtering
 * Note: This is a selective subset of memory types that map to actual collections in storage.
 * Other memory types are stored in these core collections with appropriate metadata/tags.
 */
export const DEFAULT_INDICES: Partial<Record<MemoryType, string[]>> = {
  [MemoryType.MESSAGE]: [
    'timestamp',
    'type',
    'metadata.schemaVersion',
    'metadata.role',
    'metadata.userId.id',
    'metadata.agentId.id',
    'metadata.chatId.id',
    'metadata.thread.id',
    'metadata.thread.position',
    'metadata.messageType',
    'metadata.importance',
  ],
  [MemoryType.THOUGHT]: [
    'timestamp',
    'type',
    'metadata.schemaVersion',
    'metadata.processType',
    'metadata.agentId.id',
    'metadata.contextId',
    'metadata.importance',
  ],
  [MemoryType.REFLECTION]: [
    'timestamp',
    'type',
    'metadata.schemaVersion',
    'metadata.processType',
    'metadata.agentId.id',
    'metadata.contextId',
    'metadata.importance',
  ],
  [MemoryType.INSIGHT]: [
    'timestamp',
    'type',
    'metadata.schemaVersion',
    'metadata.processType',
    'metadata.agentId.id',
    'metadata.contextId',
    'metadata.importance',
  ],
  [MemoryType.DOCUMENT]: [
    'timestamp',
    'type',
    'metadata.schemaVersion',
    'metadata.source',
    'metadata.contentType',
    'metadata.userId.id',
    'metadata.agentId.id',
    'metadata.importance',
  ],
  [MemoryType.TASK]: [
    'timestamp',
    'type',
    'metadata.schemaVersion',
    'metadata.status',
    'metadata.priority',
    'metadata.assignedTo.id',
    'metadata.createdBy.id',
    'metadata.importance',
  ],
  [MemoryType.MEMORY_EDIT]: [
    'timestamp',
    'type',
    'metadata.schemaVersion',
    'metadata.original_memory_id',
    'metadata.edit_type',
    'metadata.editor_type',
  ],
  [MemoryType.ANALYSIS]: [
    'timestamp',
    'type',
    'metadata.schemaVersion',
    'metadata.processType',
    'metadata.agentId.id',
    'metadata.contextId',
    'metadata.importance',
  ],
};

// Function to get default indices with fallback to message indices
export function getDefaultIndicesWithFallback(type: MemoryType): string[] {
  return DEFAULT_INDICES[type] || DEFAULT_INDICES[MemoryType.MESSAGE] || ['timestamp', 'type'];
} 