/**
 * memory.ts - Memory-related constants
 */

/**
 * Memory types
 */
export enum MemoryType {
  MESSAGE = 'message',
  DOCUMENT = 'document',
  THOUGHT = 'thought',
  REFLECTION = 'reflection',
  INSIGHT = 'insight',
  TASK = 'task'
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
 * Memory sources
 */
export enum MemorySource {
  AGENT = 'agent',
  USER = 'user',
  SYSTEM = 'system',
  EXTERNAL = 'external'
} 