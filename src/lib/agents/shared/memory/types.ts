/**
 * types.ts - Type declarations for the memory system
 */

import { MemoryType, ImportanceLevel, MemorySource } from '../../../constants/memory';

/**
 * Base memory schema
 */
export interface BaseMemorySchema {
  text: string;
  type: MemoryType;
  metadata: Record<string, unknown>;
}

/**
 * Memory entry
 */
export interface MemoryEntry {
  id: string;
  content: string;
  type: MemoryType;
  importance: ImportanceLevel;
  source: MemorySource;
  metadata: Record<string, unknown>;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
}

/**
 * Search result
 */
export interface SearchResult<T> {
  id: string;
  content: string;
  type: MemoryType;
  metadata: Record<string, unknown>;
  score: number;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  minScore?: number;
  type?: MemoryType;
  metadata?: Record<string, unknown>;
}

/**
 * Memory search options
 */
export interface MemorySearchOptions {
  limit?: number;
  offset?: number;
  minScore?: number;
  type?: MemoryType;
  metadata?: Record<string, unknown>;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  totalMemories: number;
  shortTermMemories: number;
  longTermMemories: number;
  memoryUsageRatio: number;
  averageMemorySize: number;
  consolidationStats: {
    lastConsolidation: Date;
    memoriesConsolidated: number;
  };
  pruningStats: {
    lastPruning: Date;
    memoriesPruned: number;
  };
}

/**
 * Memory service interface
 */
export interface MemoryService {
  initialize(): Promise<void>;
  addMemory(params: {
    id: string;
    content: string;
    type: MemoryType;
    metadata: Record<string, unknown>;
  }): Promise<void>;
  getRecentMemories(limit: number): Promise<SearchResult<MemoryEntry>[]>;
  getStats(): Promise<{
    totalMemories: number;
    shortTermMemories: number;
    longTermMemories: number;
    memoryUsageRatio: number;
    averageMemorySize: number;
    consolidationStats: {
      lastConsolidation: string;
      memoriesConsolidated: number;
    };
    pruningStats: {
      lastPruning: string;
      memoriesPruned: number;
    };
  }>;
  clearMemories(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Search service interface
 */
export interface SearchService {
  search<T>(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult<T>[]>;
}

/**
 * Memory error class
 */
export class MemoryError extends Error {
  code: string;
  context: Record<string, unknown>;

  constructor(
    message: string,
    context: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(message);
    this.name = 'MemoryError';
    this.code = 'MEMORY_ERROR';
    this.context = context;
    if (cause) {
      this.cause = cause;
    }
  }

  static initFailed(
    message: string,
    context: Record<string, unknown> = {},
    cause?: Error
  ): MemoryError {
    const error = new MemoryError(message, context, cause);
    error.code = 'INIT_FAILED';
    return error;
  }

  static shutdownFailed(
    message: string,
    context: Record<string, unknown> = {},
    cause?: Error
  ): MemoryError {
    const error = new MemoryError(message, context, cause);
    error.code = 'SHUTDOWN_FAILED';
    return error;
  }
} 