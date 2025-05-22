import { ImportanceLevel } from '../../constants/memory';

// Re-export MemoryType from config/types.ts
export { MemoryType } from './config/types';
export { ImportanceLevel };

// Default values for memory operations
export const DEFAULTS = {
  DIMENSIONS: 1536,              // Default embedding dimensions
  CONNECTION_TIMEOUT: 5000,      // Connection timeout in ms
  FETCH_TIMEOUT: 30000,          // Fetch timeout in ms
  DEFAULT_USER_ID: 'default',    // Default user ID
  DEFAULT_LIMIT: 10,             // Default result limit
  MAX_LIMIT: 2000,               // Maximum result limit
  EMBEDDING_MODEL: 'text-embedding-3-small', // Default embedding model
  SCHEMA_VERSION: '1.0.0',       // Default schema version
};

// Define collection names
export const COLLECTION_NAMES = {
  MESSAGE: 'messages',
  THOUGHT: 'thoughts',
  REFLECTION: 'reflections',
  INSIGHT: 'insights',
  DOCUMENT: 'documents',
  TASK: 'tasks',
};

// Export from types
export enum MemoryErrorCode {
  NOT_FOUND = 'MEMORY_NOT_FOUND',
  VALIDATION_ERROR = 'MEMORY_VALIDATION_ERROR',
  DATABASE_ERROR = 'MEMORY_DATABASE_ERROR',
  EMBEDDING_ERROR = 'MEMORY_EMBEDDING_ERROR',
  INITIALIZATION_ERROR = 'MEMORY_INITIALIZATION_ERROR',
  CONFIGURATION_ERROR = 'MEMORY_CONFIGURATION_ERROR',
  OPERATION_ERROR = 'MEMORY_OPERATION_ERROR',
}

export class MemoryError extends Error {
  constructor(
    message: string, 
    public code: MemoryErrorCode,
    public cause?: Error
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

// Re-export types from config/types.ts
export type { 
  MemoryCondition,
  MemoryFilter,
  SortOptions,
  CollectionConfig,
  ValidationResult,
  // Re-export MemoryErrorCode and ImportanceLevel types to avoid duplicates
  MemoryErrorCode as MemoryErrorCodeType,
  ExtendedMemorySource
} from './config/types'; 