/**
 * AgentMemory.ts - Core memory interface for agents
 * 
 * This file defines the core memory interface that all agent memory implementations
 * must follow. It provides a type-safe contract for memory operations.
 */

import { MemoryType, ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryEntry, MemorySearchOptions, MemoryStats } from './types';

/**
 * Core memory interface for agents
 */
export interface AgentMemory {
  /**
   * Initialize the memory system
   */
  initialize(): Promise<boolean>;
  
  /**
   * Add a new memory
   */
  addMemory(
    content: string,
    type: MemoryType,
    importance: ImportanceLevel,
    source: MemorySource,
    metadata?: Record<string, unknown>
  ): Promise<MemoryEntry>;
  
  /**
   * Search for memories
   */
  search(
    query: string,
    options?: MemorySearchOptions
  ): Promise<MemoryEntry[]>;
  
  /**
   * Get recently modified memories
   */
  getRecentlyModifiedMemories(limit?: number): Promise<MemoryEntry[]>;
  
  /**
   * Get memory statistics
   */
  getStats(): Promise<MemoryStats>;
  
  /**
   * Clear all memories
   */
  clear(): Promise<void>;
  
  /**
   * Shutdown the memory system
   */
  shutdown(): Promise<void>;
} 