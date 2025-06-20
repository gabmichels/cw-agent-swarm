/**
 * Core types for memory system
 * 
 * ⚠️  IMPORTANT: THIS IS THE SINGLE CANONICAL SOURCE FOR ALL MEMORY TYPES ⚠️
 * 
 * This file contains the complete, authoritative definition of all memory types
 * used throughout the system. This is NOT technical debt or duplication.
 * 
 * ARCHITECTURE NOTES:
 * - This is the ONLY place where MemoryType should be defined
 * - Client-side components should import from @/constants/memory (which re-exports from here)
 * - Server-side components should import directly from this file
 * - DO NOT create additional MemoryType enums or duplicate these types
 * - The memory system consolidation was completed and this is the correct architecture
 * 
 * MEMORY TYPE CONSOLIDATION COMPLETED ✅
 * - Merged 4 separate MemoryType sources into this single canonical source
 * - 38 comprehensive memory types covering all use cases
 * - Backward compatibility maintained through proper re-exports
 * - All imports standardized to use this canonical source
 * 
 * If you're seeing this and thinking "this looks like technical debt" - it's not!
 * This is the CORRECT, COMPLETED architecture after memory system standardization.
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

/**
 * Memory type categories for organization
 */
export enum MemoryTypeCategory {
  CORE = 'core',
  KNOWLEDGE = 'knowledge',
  DECISION = 'decision',
  AGENT_INTERACTION = 'agent',
  SYSTEM = 'system',
  VERSION_CONTROL = 'version_control',
  OTHER = 'other'
}

/**
 * Helper type for memory type validation
 */
export type MemoryTypeString = keyof typeof MemoryType;

/**
 * Helper function to check if a string is a valid memory type
 */
export function isValidMemoryType(type: string): type is MemoryTypeString {
  return Object.values(MemoryType).includes(type as MemoryType);
}

/**
 * Helper function to get memory type category
 */
export function getMemoryTypeCategory(type: MemoryType): MemoryTypeCategory {
  switch (type) {
    // Core types
    case MemoryType.MESSAGE:
    case MemoryType.DOCUMENT:
    case MemoryType.THOUGHT:
    case MemoryType.REFLECTION:
    case MemoryType.INSIGHT:
    case MemoryType.TASK:
      return MemoryTypeCategory.CORE;
      
    // Knowledge types
    case MemoryType.FACT:
    case MemoryType.KNOWLEDGE:
    case MemoryType.SYSTEM_LEARNING:
    case MemoryType.IDEA:
    case MemoryType.SUMMARY:
      return MemoryTypeCategory.KNOWLEDGE;
      
    // Decision types
    case MemoryType.DECISION:
    case MemoryType.FEEDBACK:
      return MemoryTypeCategory.DECISION;
      
    // Agent interaction types
    case MemoryType.AGENT_MESSAGE:
    case MemoryType.AGENT_REQUEST:
    case MemoryType.AGENT_RESPONSE:
    case MemoryType.AGENT_TASK:
    case MemoryType.AGENT_KNOWLEDGE:
    case MemoryType.AGENT_COLLABORATION:
      return MemoryTypeCategory.AGENT_INTERACTION;
      
    // System types
    case MemoryType.SYSTEM_EVENT:
    case MemoryType.SYSTEM_COMMAND:
    case MemoryType.SYSTEM_STATUS:
    case MemoryType.SYSTEM_ERROR:
      return MemoryTypeCategory.SYSTEM;
      
    // Version control types
    case MemoryType.MEMORY_EDIT:
      return MemoryTypeCategory.VERSION_CONTROL;
      
    // Fallback
    case MemoryType.UNKNOWN:
    default:
      return MemoryTypeCategory.OTHER;
  }
}

/**
 * Helper function to get memory type group for UI display
 */
export function getMemoryTypeGroup(type: MemoryType): string {
  switch (type) {
    // Core types
    case MemoryType.MESSAGE:
    case MemoryType.DOCUMENT:
    case MemoryType.THOUGHT:
    case MemoryType.REFLECTION:
    case MemoryType.INSIGHT:
    case MemoryType.TASK:
      return 'Core Memories';
      
    // Knowledge types
    case MemoryType.FACT:
    case MemoryType.KNOWLEDGE:
    case MemoryType.SYSTEM_LEARNING:
    case MemoryType.IDEA:
    case MemoryType.SUMMARY:
      return 'Knowledge Base';
      
    // Decision types
    case MemoryType.DECISION:
    case MemoryType.FEEDBACK:
      return 'Decisions & Feedback';
      
    // Agent interaction types
    case MemoryType.AGENT_MESSAGE:
    case MemoryType.AGENT_REQUEST:
    case MemoryType.AGENT_RESPONSE:
    case MemoryType.AGENT_TASK:
    case MemoryType.AGENT_KNOWLEDGE:
    case MemoryType.AGENT_COLLABORATION:
      return 'Agent Interactions';
      
    // System types
    case MemoryType.SYSTEM_EVENT:
    case MemoryType.SYSTEM_COMMAND:
    case MemoryType.SYSTEM_STATUS:
    case MemoryType.SYSTEM_ERROR:
      return 'System Events';
      
    // Version control types
    case MemoryType.MEMORY_EDIT:
      return 'Version History';
      
    // Fallback
    case MemoryType.UNKNOWN:
    default:
      return 'Other';
  }
}