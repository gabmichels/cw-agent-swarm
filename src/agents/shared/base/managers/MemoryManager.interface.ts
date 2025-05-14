/**
 * MemoryManager.interface.ts - Memory Manager Interface
 * 
 * This file defines the memory manager interface that provides memory services
 * for agents. It extends the base manager interface with memory-specific functionality.
 */

import { BaseManager, ManagerConfig } from './BaseManager';

/**
 * Configuration options for memory managers
 */
export interface MemoryManagerConfig extends ManagerConfig {
  /** Whether to enable automatic memory pruning */
  enableAutoPruning?: boolean;
  
  /** Interval for automatic pruning in milliseconds */
  pruningIntervalMs?: number;
  
  /** Maximum number of short-term memory entries */
  maxShortTermEntries?: number;
  
  /** Minimum relevance threshold for memory search */
  relevanceThreshold?: number;
  
  /** Whether to enable automatic memory consolidation */
  enableAutoConsolidation?: boolean;
  
  /** Interval for automatic consolidation in milliseconds */
  consolidationIntervalMs?: number;
  
  /** Minimum number of memories required for consolidation */
  minMemoriesForConsolidation?: number;
  
  /** Whether to remove source memories after consolidation */
  forgetSourceMemoriesAfterConsolidation?: boolean;
  
  /** Whether to enable memory injection */
  enableMemoryInjection?: boolean;
  
  /** Maximum number of injected memories */
  maxInjectedMemories?: number;
}

/**
 * Memory entry structure
 */
export interface MemoryEntry {
  /** Unique identifier for this memory */
  id: string;
  
  /** Memory content */
  content: string;
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
  
  /** When this memory was created */
  createdAt: Date;
  
  /** When this memory was last accessed */
  lastAccessedAt: Date;
  
  /** Number of times this memory has been accessed */
  accessCount: number;
}

/**
 * Options for memory search
 */
export interface MemorySearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  
  /** Minimum relevance score for results */
  minRelevance?: number;
  
  /** Filter by memory type */
  type?: 'short-term' | 'long-term';
  
  /** Filter by time range */
  timeRange?: {
    start?: Date;
    end?: Date;
  };
  
  /** Filter by metadata values */
  metadata?: Record<string, unknown>;
}

/**
 * Result of memory consolidation operation
 */
export interface MemoryConsolidationResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Number of memories consolidated */
  consolidatedCount: number;
  
  /** Status message */
  message: string;
}

/**
 * Result of memory pruning operation
 */
export interface MemoryPruningResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Number of memories pruned */
  prunedCount: number;
  
  /** Status message */
  message: string;
}

/**
 * Memory manager interface
 */
export interface MemoryManager extends BaseManager {
  /**
   * Add memory content
   * @param content Memory content to store
   * @param metadata Additional metadata
   * @returns Promise resolving to the stored memory
   */
  addMemory(content: string, metadata?: Record<string, unknown>): Promise<MemoryEntry>;
  
  /**
   * Search memories
   * @param query Query string
   * @param options Search options
   * @returns Promise resolving to matching memories
   */
  searchMemories(query: string, options?: MemorySearchOptions): Promise<MemoryEntry[]>;
  
  /**
   * Get recent memories
   * @param limit Maximum number of memories to retrieve
   * @returns Promise resolving to recent memories
   */
  getRecentMemories(limit?: number): Promise<MemoryEntry[]>;
  
  /**
   * Consolidate memories
   * @returns Promise resolving when consolidation is complete
   */
  consolidateMemories(): Promise<MemoryConsolidationResult>;
  
  /**
   * Prune memories
   * @returns Promise resolving when pruning is complete
   */
  pruneMemories(): Promise<MemoryPruningResult>;
} 