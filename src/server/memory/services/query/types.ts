/**
 * Query Optimization Layer
 * 
 * Provides optimized query capabilities for memory retrieval, focusing on
 * performance and relevance for vector database operations.
 */

import { StructuredId } from '../../../../utils/ulid';
import { FilterCondition } from '../filters/types';

/**
 * Query parameters for optimized memory retrieval
 */
export interface QueryParams {
  /**
   * Query text to search for
   */
  query: string;
  
  /**
   * Collection to search in
   */
  collection: string;
  
  /**
   * Optional filter conditions to apply
   */
  filters?: FilterCondition<unknown>[];
  
  /**
   * Maximum number of results to return
   * @default 10
   */
  limit?: number;
  
  /**
   * Minimum similarity score (0.0 to 1.0)
   * @default 0.6
   */
  minScore?: number;
  
  /**
   * Whether to include the score in the results
   * @default true
   */
  includeScore?: boolean;
  
  /**
   * Whether to include metadata in the results
   * @default true
   */
  includeMetadata?: boolean;
  
  /**
   * Optional partition key to limit search to a specific segment
   */
  partitionKey?: string;
}

/**
 * Result item from a memory query
 */
export interface QueryResultItem<T = Record<string, unknown>> {
  /**
   * Unique identifier of the result
   */
  id: StructuredId;
  
  /**
   * Text content of the result
   */
  text: string;
  
  /**
   * Similarity score (0.0 to 1.0)
   */
  score: number;
  
  /**
   * Associated metadata
   */
  metadata: T;
}

/**
 * Response from a memory query operation
 */
export interface QueryResponse<T = Record<string, unknown>> {
  /**
   * Array of result items
   */
  results: QueryResultItem<T>[];
  
  /**
   * Total number of matches found
   */
  totalMatches: number;
  
  /**
   * Whether the results were truncated due to limit
   */
  truncated: boolean;
  
  /**
   * Execution time in milliseconds
   */
  executionTimeMs: number;
}

/**
 * Query optimization strategies
 */
export enum QueryOptimizationStrategy {
  /**
   * Balance between speed and recall
   */
  BALANCED = 'balanced',
  
  /**
   * Prioritize recall/quality over speed
   */
  HIGH_QUALITY = 'high_quality',
  
  /**
   * Prioritize speed over recall/quality
   */
  HIGH_SPEED = 'high_speed',
  
  /**
   * Context-aware (adapts based on query characteristics)
   */
  CONTEXT_AWARE = 'context_aware'
}

/**
 * Configuration for query optimizer
 */
export interface QueryOptimizerConfig {
  /**
   * Default optimization strategy
   * @default QueryOptimizationStrategy.BALANCED
   */
  defaultStrategy: QueryOptimizationStrategy;
  
  /**
   * Default limit for query results
   * @default 10
   */
  defaultLimit: number;
  
  /**
   * Default minimum similarity score
   * @default 0.6
   */
  defaultMinScore: number;
  
  /**
   * Maximum execution time in milliseconds
   * @default 1000
   */
  timeoutMs: number;
  
  /**
   * Whether to enable query caching
   * @default true
   */
  enableCaching: boolean;
  
  /**
   * Cache time-to-live in seconds
   * @default 300 (5 minutes)
   */
  cacheTtlSeconds: number;
}

/**
 * Interface for the query optimization layer
 */
export interface IQueryOptimizer {
  /**
   * Execute an optimized query against the memory system
   * 
   * @param params Query parameters
   * @param strategy Optional optimization strategy to use
   * @returns Query response with results
   */
  query<T = Record<string, unknown>>(
    params: QueryParams,
    strategy?: QueryOptimizationStrategy
  ): Promise<QueryResponse<T>>;
  
  /**
   * Generate query suggestions based on partial input
   * 
   * @param partialQuery Partial query text
   * @param collection Collection to generate suggestions for
   * @param limit Maximum number of suggestions
   * @returns Array of query suggestions
   */
  suggestQueries(
    partialQuery: string,
    collection: string,
    limit?: number
  ): Promise<string[]>;
  
  /**
   * Analyze a query to determine the best optimization strategy
   * 
   * @param query Query text to analyze
   * @returns Recommended optimization strategy
   */
  analyzeQuery(query: string): QueryOptimizationStrategy;
  
  /**
   * Clear the query cache
   * 
   * @param collection Optional collection to clear cache for
   * @returns Whether the operation was successful
   */
  clearCache(collection?: string): Promise<boolean>;
}

/**
 * Error codes for query optimization operations
 */
export enum QueryErrorCode {
  INVALID_QUERY = 'QUERY_INVALID_QUERY',
  COLLECTION_NOT_FOUND = 'QUERY_COLLECTION_NOT_FOUND',
  EXECUTION_TIMEOUT = 'QUERY_EXECUTION_TIMEOUT',
  EMBEDDING_FAILED = 'QUERY_EMBEDDING_FAILED',
  FILTER_ERROR = 'QUERY_FILTER_ERROR',
  OPTIMIZATION_FAILED = 'QUERY_OPTIMIZATION_FAILED'
} 