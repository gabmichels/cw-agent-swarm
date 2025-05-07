/**
 * Query Optimizer for Memory System
 * 
 * Optimizes memory queries for performance and relevance using various strategies.
 */

import { AppError } from '../../../../lib/errors/base';
import { StructuredId } from '../../../../utils/ulid';
import { QdrantFilterBuilder } from '../filters/filter-builder';
import { FilterCondition } from '../filters/types';
import { IVectorDatabaseClient } from '../base/types';
import { 
  IQueryOptimizer, 
  QueryErrorCode, 
  QueryOptimizationStrategy, 
  QueryOptimizerConfig, 
  QueryParams, 
  QueryResponse,
  QueryResultItem
} from './types';

/**
 * Search results interface for vector database
 */
interface SearchResults {
  matches: Array<{
    id: string;
    score: number;
    payload: Record<string, unknown>;
  }>;
  totalCount: number;
}

/**
 * Default configuration for the query optimizer
 */
const DEFAULT_CONFIG: QueryOptimizerConfig = {
  defaultStrategy: QueryOptimizationStrategy.BALANCED,
  defaultLimit: 10,
  defaultMinScore: 0.6,
  timeoutMs: 1000,
  enableCaching: true,
  cacheTtlSeconds: 300 // 5 minutes
};

/**
 * Implementation of the IQueryOptimizer interface
 */
export class QueryOptimizer implements IQueryOptimizer {
  /**
   * Cached query results: collection -> queryHash -> results
   */
  private queryCache: Map<string, Map<string, {
    results: QueryResponse<any>,
    timestamp: number
  }>> = new Map();
  
  /**
   * Query patterns for optimization
   */
  private queryPatterns = new Map<RegExp, QueryOptimizationStrategy>([
    [/^(who|what|when|where|why|how).{3,}/i, QueryOptimizationStrategy.HIGH_QUALITY],
    [/^(list|find|search|get|show|display).{3,}/i, QueryOptimizationStrategy.HIGH_SPEED],
    [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, QueryOptimizationStrategy.HIGH_SPEED]
  ]);
  
  /**
   * Constructor
   * 
   * @param vectorDb Vector database client
   * @param filterBuilder Filter builder for query conditions
   * @param embeddingService Service for creating embeddings
   * @param config Configuration options
   */
  constructor(
    private readonly vectorDb: IVectorDatabaseClient,
    private readonly filterBuilder: QdrantFilterBuilder,
    private readonly embeddingService: { embedText(text: string): Promise<number[]> },
    private readonly config: QueryOptimizerConfig = DEFAULT_CONFIG
  ) {}
  
  /**
   * Execute an optimized query against the memory system
   * 
   * @param params Query parameters
   * @param strategy Optional optimization strategy to use
   * @returns Query response with results
   */
  async query<T = Record<string, unknown>>(
    params: QueryParams,
    strategy?: QueryOptimizationStrategy
  ): Promise<QueryResponse<T>> {
    // Validate input
    if (!params.query || typeof params.query !== 'string') {
      throw new AppError(
        'Invalid query parameter',
        QueryErrorCode.INVALID_QUERY,
        { providedQuery: params.query }
      );
    }
    
    if (!params.collection || typeof params.collection !== 'string') {
      throw new AppError(
        'Invalid collection parameter',
        QueryErrorCode.COLLECTION_NOT_FOUND,
        { providedCollection: params.collection }
      );
    }
    
    // Merge defaults with provided params
    const mergedParams = this.mergeQueryDefaults(params);
    
    // Determine optimization strategy
    const selectedStrategy = strategy || this.determineStrategy(params.query);
    
    // Check cache if enabled
    if (this.config.enableCaching) {
      const cachedResults = this.getCachedResults<T>(mergedParams, selectedStrategy);
      if (cachedResults) {
        return cachedResults;
      }
    }
    
    // Set timeout if configured
    const timeoutPromise = this.createTimeout();
    
    try {
      // Start timing execution
      const startTime = Date.now();
      
      // Generate embedding for the query
      const embedding = await this.embeddingService.embedText(params.query);
      
      // Build optimized filter
      const filter = params.filters 
        ? this.filterBuilder.build(params.filters)
        : undefined;
      
      // Apply optimization strategy
      const optimizedParams = this.applyOptimizationStrategy(
        mergedParams,
        embedding,
        filter,
        selectedStrategy
      );
      
      // Execute query
      const searchResults = await Promise.race([
        this.search(
          params.collection,
          embedding,
          optimizedParams.limit,
          optimizedParams.filter,
          optimizedParams.scoreThreshold
        ),
        timeoutPromise
      ]);
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      // Format results
      const response: QueryResponse<T> = {
        results: searchResults.matches.map(match => ({
          id: match.id as unknown as StructuredId, // Type conversion for compatibility
          text: match.payload.text as string,
          score: match.score,
          metadata: match.payload as unknown as T
        })),
        totalMatches: searchResults.totalCount,
        truncated: searchResults.totalCount > (mergedParams.limit ?? 0),
        executionTimeMs: executionTime
      };
      
      // Cache results if enabled
      if (this.config.enableCaching) {
        this.cacheResults(mergedParams, selectedStrategy, response);
      }
      
      return response;
    } catch (error) {
      // Handle timeout error
      if (error === 'TIMEOUT') {
        throw new AppError(
          `Query execution timed out after ${this.config.timeoutMs}ms`,
          QueryErrorCode.EXECUTION_TIMEOUT,
          { 
            query: params.query,
            collection: params.collection,
            timeoutMs: this.config.timeoutMs
          }
        );
      }
      
      // Handle other errors
      throw new AppError(
        `Failed to execute query: ${error instanceof Error ? error.message : String(error)}`,
        QueryErrorCode.OPTIMIZATION_FAILED,
        {
          query: params.query,
          collection: params.collection,
          strategy: selectedStrategy
        }
      );
    }
  }
  
  /**
   * Search wrapper for vector database
   */
  private async search(
    collectionName: string,
    vector: number[],
    limit: number,
    filter?: Record<string, any>,
    scoreThreshold?: number
  ): Promise<SearchResults> {
    // Call adapter's search method
    return (this.vectorDb as any).search(
      collectionName,
      vector,
      limit,
      filter,
      scoreThreshold
    );
  }
  
  /**
   * Generate query suggestions based on partial input
   * 
   * @param partialQuery Partial query text
   * @param collection Collection to generate suggestions for
   * @param limit Maximum number of suggestions
   * @returns Array of query suggestions
   */
  async suggestQueries(
    partialQuery: string,
    collection: string,
    limit = 5
  ): Promise<string[]> {
    if (!partialQuery || partialQuery.length < 3) {
      return [];
    }
    
    try {
      // This is a simplified implementation - in a production system,
      // this would use more sophisticated methods like analyzing recent
      // successful queries or using a dedicated suggestion engine
      
      // For now, look for similar queries in the collection
      const embedding = await this.embeddingService.embedText(partialQuery);
      
      const searchResults = await this.search(
        collection,
        embedding,
        limit,
        undefined,
        0.5
      );
      
      // Extract unique query patterns from the results
      const suggestions = new Set<string>();
      
      for (const match of searchResults.matches) {
        // Extract the original query from metadata if available
        const originalQuery = match.payload.originalQuery as string | undefined;
        if (originalQuery) {
          suggestions.add(originalQuery);
        }
      }
      
      return Array.from(suggestions).slice(0, limit);
    } catch (error) {
      console.error('Failed to generate query suggestions:', error);
      return []; // Return empty array rather than failing
    }
  }
  
  /**
   * Analyze a query to determine the best optimization strategy
   * 
   * @param query Query text to analyze
   * @returns Recommended optimization strategy
   */
  analyzeQuery(query: string): QueryOptimizationStrategy {
    return this.determineStrategy(query);
  }
  
  /**
   * Clear the query cache
   * 
   * @param collection Optional collection to clear cache for
   * @returns Whether the operation was successful
   */
  async clearCache(collection?: string): Promise<boolean> {
    if (collection) {
      this.queryCache.delete(collection);
    } else {
      this.queryCache.clear();
    }
    
    return true;
  }
  
  /**
   * Determine the best optimization strategy for a query
   * 
   * @param query Query text
   * @returns Optimization strategy
   */
  private determineStrategy(query: string): QueryOptimizationStrategy {
    // Default to the configured default strategy
    let strategy = this.config.defaultStrategy;
    
    // Check if query matches any known patterns
    const patterns = Array.from(this.queryPatterns.keys());
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        strategy = this.queryPatterns.get(pattern) || strategy;
        break;
      }
    }
    
    // Special case: Short queries typically benefit from HIGH_SPEED
    if (query.length < 10 && strategy === QueryOptimizationStrategy.BALANCED) {
      strategy = QueryOptimizationStrategy.HIGH_SPEED;
    }
    
    // Special case: Complex queries typically benefit from HIGH_QUALITY
    if (query.split(' ').length > 15 && strategy === QueryOptimizationStrategy.BALANCED) {
      strategy = QueryOptimizationStrategy.HIGH_QUALITY;
    }
    
    return strategy;
  }
  
  /**
   * Merge query parameters with defaults
   * 
   * @param params Original query parameters
   * @returns Merged parameters with defaults
   */
  private mergeQueryDefaults(params: QueryParams): QueryParams {
    return {
      ...params,
      limit: params.limit ?? this.config.defaultLimit,
      minScore: params.minScore ?? this.config.defaultMinScore,
      includeScore: params.includeScore ?? true,
      includeMetadata: params.includeMetadata ?? true
    };
  }
  
  /**
   * Apply optimization strategy to query parameters
   * 
   * @param params Query parameters
   * @param embedding Query embedding
   * @param filter Compiled filter condition
   * @param strategy Optimization strategy
   * @returns Optimized parameters for the vector database
   */
  private applyOptimizationStrategy(
    params: QueryParams,
    embedding: number[],
    filter: any,
    strategy: QueryOptimizationStrategy
  ): {
    limit: number,
    filter: any,
    scoreThreshold: number
  } {
    // Initialize with default values to ensure they're never undefined
    let limit = params.limit ?? this.config.defaultLimit;
    let scoreThreshold = params.minScore ?? this.config.defaultMinScore;
    
    switch (strategy) {
      case QueryOptimizationStrategy.HIGH_QUALITY:
        // Increase results to get better quality with higher threshold
        limit = Math.ceil(limit * 1.5);
        scoreThreshold = Math.max(0.7, scoreThreshold); // Higher threshold
        break;
        
      case QueryOptimizationStrategy.HIGH_SPEED:
        // Optimize for speed with tighter limits
        limit = Math.min(limit, 20); // Cap at 20 for speed
        scoreThreshold = Math.min(0.5, scoreThreshold); // Lower threshold
        break;
        
      case QueryOptimizationStrategy.CONTEXT_AWARE:
        // Dynamic adjustment based on embedding characteristics
        // This is a simplified implementation; production systems would
        // have more sophisticated logic based on embedding statistics
        const embeddingMagnitude = Math.sqrt(
          embedding.reduce((sum, val) => sum + val * val, 0)
        );
        
        if (embeddingMagnitude > 1) {
          // More specific query, use higher threshold
          scoreThreshold = Math.max(0.65, scoreThreshold);
        } else {
          // Less specific query, use lower threshold but more results
          scoreThreshold = Math.min(0.55, scoreThreshold);
          limit = Math.ceil(limit * 1.2);
        }
        break;
        
      // BALANCED is the default, use the parameters as provided
      default:
        break;
    }
    
    return {
      limit,
      filter,
      scoreThreshold
    };
  }
  
  /**
   * Get cached results for a query
   * 
   * @param params Query parameters
   * @param strategy Optimization strategy
   * @returns Cached results or undefined if not found
   */
  private getCachedResults<T>(
    params: QueryParams,
    strategy: QueryOptimizationStrategy
  ): QueryResponse<T> | undefined {
    if (!this.config.enableCaching) {
      return undefined;
    }
    
    const collectionCache = this.queryCache.get(params.collection);
    if (!collectionCache) {
      return undefined;
    }
    
    const queryHash = this.hashQuery(params, strategy);
    const cachedItem = collectionCache.get(queryHash);
    if (!cachedItem) {
      return undefined;
    }
    
    // Check if cache has expired
    const now = Date.now();
    if (now - cachedItem.timestamp > this.config.cacheTtlSeconds * 1000) {
      collectionCache.delete(queryHash);
      return undefined;
    }
    
    return cachedItem.results as QueryResponse<T>;
  }
  
  /**
   * Cache results for a query
   * 
   * @param params Query parameters
   * @param strategy Optimization strategy
   * @param results Query results
   */
  private cacheResults<T>(
    params: QueryParams,
    strategy: QueryOptimizationStrategy,
    results: QueryResponse<T>
  ): void {
    if (!this.config.enableCaching) {
      return;
    }
    
    // Get or create collection cache
    let collectionCache = this.queryCache.get(params.collection);
    if (!collectionCache) {
      collectionCache = new Map();
      this.queryCache.set(params.collection, collectionCache);
    }
    
    // Cache the results
    const queryHash = this.hashQuery(params, strategy);
    collectionCache.set(queryHash, {
      results,
      timestamp: Date.now()
    });
    
    // Limit cache size (simple LRU-like approach)
    if (collectionCache.size > 100) {
      const oldestKey = Array.from(collectionCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        
      collectionCache.delete(oldestKey);
    }
  }
  
  /**
   * Create a simple hash for a query (for cache key)
   * 
   * @param params Query parameters
   * @param strategy Optimization strategy
   * @returns Hash string
   */
  private hashQuery(
    params: QueryParams,
    strategy: QueryOptimizationStrategy
  ): string {
    // Basic hash function for query + params
    const queryStr = params.query.toLowerCase().trim();
    const filtersStr = params.filters 
      ? JSON.stringify(params.filters)
      : '';
    const limitStr = params.limit?.toString() || '';
    const minScoreStr = params.minScore?.toString() || '';
    
    return `${queryStr}|${filtersStr}|${limitStr}|${minScoreStr}|${strategy}|${params.partitionKey || ''}`;
  }
  
  /**
   * Create a timeout promise
   * 
   * @returns Promise that rejects after timeout
   */
  private createTimeout(): Promise<never> {
    if (!this.config.timeoutMs || this.config.timeoutMs <= 0) {
      return new Promise(() => {}); // Never timeout
    }
    
    return new Promise((_, reject) => {
      setTimeout(() => reject('TIMEOUT'), this.config.timeoutMs);
    });
  }
} 