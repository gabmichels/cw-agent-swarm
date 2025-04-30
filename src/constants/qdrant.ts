/**
 * Constants related to Qdrant vectorstore operations
 */

/**
 * Collection names used in Qdrant
 */
export const COLLECTIONS = {
  message: 'messages',
  thought: 'thoughts',
  document: 'documents',
  task: 'tasks',
};

/**
 * Memory types for Qdrant operations
 */
export const MEMORY_TYPES = {
  MESSAGE: 'message',
  THOUGHT: 'thought',
  DOCUMENT: 'document',
  TASK: 'task',
};

/**
 * Importance levels for memory filtering
 */
export const IMPORTANCE_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Storage keys for LocalStorage & IndexedDB
 */
export const STORAGE_KEYS = {
  SAVED_ATTACHMENTS: 'crowd-wisdom-saved-attachments',
  IMAGE_DATA: 'crowd-wisdom-image-data',
  INDEXED_DB_NAME: 'crowd-wisdom-storage',
  ATTACHMENT_STORE: 'file-attachments',
  DEV_SHOW_INTERNAL_MESSAGES: 'DEV_SHOW_INTERNAL_MESSAGES',
};

/**
 * Default values for Qdrant operations
 */
export const DEFAULTS = {
  DIMENSIONS: 1536,
  CONNECTION_TIMEOUT: 5000,
  FETCH_TIMEOUT: 30000,
  DEFAULT_USER_ID: 'gab',
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 2000,
  EMBEDDING_MODEL: 'text-embedding-ada-002',
};

/**
 * Filter keys for Qdrant queries
 */
export const FILTER_KEYS = {
  METADATA: 'metadata',
  USER_ID: 'userId',
  ROLE: 'role',
  SOURCE: 'source',
  MESSAGE_TYPE: 'messageType',
  IMPORTANCE: 'importance',
  INTERNAL_MESSAGE: 'isInternalMessage',
  NOT_FOR_CHAT: 'notForChat',
  TIMESTAMP: 'timestamp',
}; 