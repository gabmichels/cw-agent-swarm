/**
 * Constants related to memory types and categories
 * 
 * Note: These enums are meant for backwards compatibility with the agent code.
 * Most new code should import from server/memory/config directly.
 */

import { MemoryType as StandardMemoryType } from '../server/memory/config';

/**
 * Base memory types - aligned with standard memory types
 * 
 * @deprecated Use StandardMemoryType directly from server/memory/config
 */
export enum MemoryType {
  MESSAGE = 'message',
  THOUGHT = 'thought',
  DOCUMENT = 'document',
  TASK = 'task',
}

/**
 * Extended memory types specific to Chloe
 * 
 * @deprecated This enum is being phased out in favor of StandardMemoryType.
 * Use StandardMemoryType for standard types, and string literals for custom types.
 * Import from: import { MemoryType } from '../server/memory/config';
 */
export enum ChloeMemoryType {
  // Base types - directly use StandardMemoryType values
  MESSAGE = StandardMemoryType.MESSAGE,
  THOUGHT = StandardMemoryType.THOUGHT,
  DOCUMENT = StandardMemoryType.DOCUMENT,
  TASK = StandardMemoryType.TASK,
  MEMORY_EDIT = StandardMemoryType.MEMORY_EDIT,
  
  // Extended types
  INSIGHT = 'insight',
  EXECUTION_RESULT = 'execution_result',
  PLAN = 'plan',
  PERFORMANCE_REVIEW = 'performance_review',
  SEARCH_RESULT = 'search_result',
  STRATEGIC_INSIGHT = 'strategic_insight',
  REFLECTION = 'reflection',
  
  // Markdown content types
  STRATEGY = 'strategy',
  PERSONA = 'persona',
  VISION = 'vision',
  PROCESS = 'process',
  KNOWLEDGE = 'knowledge',
  
  // System types
  SYSTEM = 'system',
  TOOL_LOG = 'tool',
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
  FILE = 'file',
} 