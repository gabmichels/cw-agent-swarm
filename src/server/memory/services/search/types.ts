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