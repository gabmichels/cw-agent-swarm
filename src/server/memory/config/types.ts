/**
 * Core types for memory system
 */

/**
 * Supported memory types - standardized enum for use throughout the system
 */
export enum MemoryType {
  MESSAGE = 'message',
  THOUGHT = 'thought',
  DOCUMENT = 'document',
  TASK = 'task',
  MEMORY_EDIT = 'memory_edit',
}

/**
 * Importance levels for memory items
 */
export enum ImportanceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Filter condition type for memory queries
 */
export interface MemoryCondition {
  key: string;
  match?: {
    value: any;
    in?: any[];
  };
  range?: {
    gt?: any;
    gte?: any;
    lt?: any;
    lte?: any;
  };
}

/**
 * Standard filter for memory queries
 */
export interface MemoryFilter {
  [key: string]: any;
  must?: MemoryCondition[];
  should?: MemoryCondition[];
  must_not?: MemoryCondition[];
}

/**
 * Sort options for memory queries
 */
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Schema for a memory collection
 */
export interface CollectionConfig<T> {
  name: string;         // Collection name in database
  schema: T;            // Schema type for this collection
  indices: string[];    // Fields to be indexed
  defaults: Partial<T>; // Default values for schema
}

/**
 * Result validation interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Memory error codes
 */
export enum MemoryErrorCode {
  NOT_FOUND = 'MEMORY_NOT_FOUND',
  VALIDATION_ERROR = 'MEMORY_VALIDATION_ERROR',
  DATABASE_ERROR = 'MEMORY_DATABASE_ERROR',
  EMBEDDING_ERROR = 'MEMORY_EMBEDDING_ERROR',
  INITIALIZATION_ERROR = 'MEMORY_INITIALIZATION_ERROR',
  CONFIGURATION_ERROR = 'MEMORY_CONFIGURATION_ERROR',
  OPERATION_ERROR = 'MEMORY_OPERATION_ERROR',
}

/**
 * Memory-specific error class
 */
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