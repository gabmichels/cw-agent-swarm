/**
 * Core types for memory system
 */

/**
 * Supported memory types - standardized enum for use throughout the system
 */
export enum MemoryType {
  AGENT = 'agent',
  AGENT_COLLABORATION = 'agent_collaboration',
  AGENT_KNOWLEDGE = 'agent_knowledge',
  AGENT_MESSAGE = 'agent_message',
  AGENT_RELATIONSHIP = 'agent_relationship',
  AGENT_REQUEST = 'agent_request',
  AGENT_RESPONSE = 'agent_response',
  AGENT_TASK = 'agent_task',
  ANALYSIS = 'analysis',
  CAPABILITY_DEFINITION = 'capability_definition',
  CHAT = 'chat',
  DAILY_CYCLE_LOG = 'daily_cycle_log',
  DECISION = 'decision',
  DOCUMENT = 'document',
  EXECUTION_OUTCOME = 'execution_outcome',
  FACT = 'fact',
  FEEDBACK = 'feedback',
  GOAL = 'goal',
  IDEA = 'idea',
  INSIGHT = 'insight',
  KNOWLEDGE = 'knowledge',
  MEMORY_EDIT = 'memory_edit',
  MESSAGE = 'message',
  OTHER = 'other',
  REFERENCE = 'reference',
  REFLECTION = 'reflection',
  SUMMARY = 'summary',
  SYSTEM_COMMAND = 'system_command',
  SYSTEM_ERROR = 'system_error',
  SYSTEM_EVENT = 'system_event',
  SYSTEM_LEARNING = 'system_learning',
  SYSTEM_STATUS = 'system_status',
  TASK = 'task',
  THOUGHT = 'thought',
  TOOL_EXECUTION_METRICS = 'tool_execution_metrics',
  UNKNOWN = 'unknown',
  USER_MESSAGE = 'user_message',
  WEEKLY_CYCLE_LOG = 'weekly_cycle_log'
}

/**
 * Memory importance levels
 */
export enum ImportanceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
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

// Extended memory source enum that includes additional sources
export enum ExtendedMemorySource {
  USER = 'user',
  ASSISTANT = 'assistant',
  CHLOE = 'chloe',
  SYSTEM = 'system',
  TOOL = 'tool',
  WEB = 'web',
  EXTERNAL = 'external',

}

/**
 * Source categorization for memory entries
 */
export enum MemorySourceType {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system',
  TOOL = 'tool',
  INTEGRATION = 'integration',
  EXTERNAL = 'external',
  INFERENCE = 'inference',
  ANALYSIS = 'analysis',
  REFLECTION = 'reflection',
  OTHER = 'other',
  FILE = "FILE"
}

// Backward compatibility alias
export { MemorySourceType as MemorySource };

/**
 * Interface for index definitions in collections
 */
export interface IndexDefinition {
  /**
   * Field path to index (e.g. 'metadata.chatId')
   */
  field: string;
  
  /**
   * Index name for reference
   */
  indexName: string;
  
  /**
   * Field data type for proper indexing
   */
  fieldType: 'keyword' | 'integer' | 'float' | 'geo' | 'text' | 'bool' | 'datetime';
} 

// Re-exported from lib/constants/memory for compatibility
export type { MemoryTypeCategory } from '../../../lib/constants/memory';
export type { MemoryTypeString } from '../../../lib/constants/memory';
export { isValidMemoryType } from '../../../lib/constants/memory';
export { getMemoryTypeCategory } from '../../../lib/constants/memory';
export { getMemoryTypeGroup } from '../../../lib/constants/memory';

// Re-exported from memory config files for compatibility
export { DEFAULTS } from './constants';
export { COLLECTION_CONFIGS } from './collections';
export { MEMORY_EDIT_COLLECTION } from './collections';
export { COLLECTION_NAMES } from './constants';