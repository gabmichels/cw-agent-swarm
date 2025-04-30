/**
 * Constants related to memory types and categories
 */

/**
 * Base memory types
 */
export enum MemoryType {
  MESSAGE = 'message',
  THOUGHT = 'thought',
  DOCUMENT = 'document',
  TASK = 'task',
}

/**
 * Extended memory types specific to Chloe
 */
export enum ChloeMemoryType {
  // Base types
  MESSAGE = 'message',
  THOUGHT = 'thought',
  DOCUMENT = 'document',
  TASK = 'task',
  
  // Extended types
  INSIGHT = 'insight',
  EXECUTION_RESULT = 'execution_result',
  PLAN = 'plan',
  PERFORMANCE_REVIEW = 'performance_review',
  SEARCH_RESULT = 'search_result',
  STRATEGIC_INSIGHT = 'strategic_insight',
  REFLECTION = 'reflection',
  
  // System types
  SYSTEM = 'system',
  TOOL_LOG = 'tool_log',
  MEMORY_LOG = 'memory_log'
}

/**
 * Memory importance levels
 */
export enum ImportanceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Memory source
 */
export enum MemorySource {
  USER = 'user',
  SYSTEM = 'system',
  AGENT = 'agent',
  EXTERNAL = 'external',
} 