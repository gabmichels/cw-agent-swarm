/**
 * Types for search service
 */
import { MemoryFilter, MemoryType, SortOptions } from '../../config';
import { BaseMemorySchema, MemoryPoint } from '../../models';

/**
 * Search options
 */
export interface SearchOptions {
  // Memory types to search (all if not specified)
  types?: MemoryType[];
  
  // Filter to apply
  filter?: MemoryFilter;
  
  // Maximum results to return
  limit?: number;
  
  // Offset for pagination
  offset?: number;
  
  // Sorting options
  sort?: SortOptions;
  
  // Minimum score threshold (0-1)
  minScore?: number;
  
  // Whether to include vectors in results
  includeVectors?: boolean;
  
  // Maximum depth for causal chain traversal
  maxDepth?: number;
  
  // Direction for causal chain traversal
  direction?: 'forward' | 'backward' | 'both';
  
  // Whether to analyze the results
  analyze?: boolean;
  
  // Optimization strategy flags
  
  // Prioritize high quality results (more accurate but slower)
  highQuality?: boolean;
  
  // Prioritize high speed (faster but possibly less accurate)
  highSpeed?: boolean;
}

/**
 * Search result
 */
export interface SearchResult<T extends BaseMemorySchema> {
  // Memory point
  point: MemoryPoint<T>;
  
  // Similarity score (0-1)
  score: number;
  
  // Memory type
  type: MemoryType;
  
  // Collection name
  collection: string;
}

/**
 * Filter builder options
 */
export interface FilterBuilderOptions {
  // Date range options
  startDate?: Date | number;
  endDate?: Date | number;
  
  // Content type options
  types?: MemoryType[];
  
  // Metadata filters
  metadata?: Record<string, any>;
  
  // Text match options
  textContains?: string;
  exactMatch?: boolean;
  caseSensitive?: boolean;
}

/**
 * Filter options for direct filtering without semantic search
 */
export interface FilterOptions {
  // Memory types to filter (all if not specified)
  types?: MemoryType[];
  
  // Filter to apply
  filter?: MemoryFilter;
  
  // Maximum results to return
  limit?: number;
  
  // Offset for pagination
  offset?: number;
  
  // Field to sort by (e.g., 'timestamp')
  sortBy?: string;
  
  // Sort direction
  sortOrder?: 'asc' | 'desc';
}

/**
 * Memory context contains related memories for a specific context
 */
export interface MemoryContext<T extends BaseMemorySchema = BaseMemorySchema> {
  // Original query or context identifier
  contextId: string;
  
  // Timestamp when the context was created
  timestamp: number;
  
  // Related memories grouped by relevance or relationship
  groups: MemoryContextGroup<T>[];
  
  // Overall context summary (if generated)
  summary?: string;
  
  // Additional metadata
  metadata?: Record<string, any>;
}

/**
 * Group of related memories in a context
 */
export interface MemoryContextGroup<T extends BaseMemorySchema = BaseMemorySchema> {
  // Group name or category
  name: string;
  
  // Brief description of this group
  description?: string;
  
  // Memories in this group
  memories: SearchResult<T>[];
  
  // Relevance of this group to the context (0-1)
  relevance: number;
}

/**
 * Options for memory context retrieval
 */
export interface MemoryContextOptions {
  // Query used to find relevant memories
  query?: string;
  
  // Filter criteria for memories
  filter?: MemoryFilter;
  
  // Memory types to include
  types?: MemoryType[];
  
  // Maximum memories per group
  maxMemoriesPerGroup?: number;
  
  // Maximum total memories
  maxTotalMemories?: number;
  
  // Whether to generate a summary
  includeSummary?: boolean;
  
  // Minimum similarity score (0-1)
  minScore?: number;
  
  // Whether to use time-weighted relevance
  timeWeighted?: boolean;
  
  // Number of groups to create
  numGroups?: number;
  
  // Groups to explicitly include
  includedGroups?: string[];
  
  // Custom grouping strategy
  groupingStrategy?: 'time' | 'topic' | 'type' | 'custom';
}

/**
 * Hybrid search options
 */
export interface HybridSearchOptions extends SearchOptions {
  // Text search weight (0-1)
  textWeight?: number;
  
  // Vector search weight (0-1)
  vectorWeight?: number;
  
  // Whether to normalize scores
  normalizeScores?: boolean;
} 