/**
 * Query Optimizer for Memory System
 * 
 * Optimizes memory queries for performance and relevance using various strategies.
 */

import { AppError } from '../../../../lib/errors/base';
import { StructuredId, IdGenerator } from '../../../../utils/ulid';
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
  QueryResultItem,
  SearchResults
} from './types';
import { QueryCache } from './query-cache';
import { CacheManager } from '../cache/types';
import { BaseMemorySchema } from '../../models/base-schema';
import { QdrantFilter, FilterConditions, CompositeFilter } from '../filters/types';
import { QueryPerformanceMonitor } from './query-performance';

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
 * Query optimizer
 */
export class QueryOptimizer implements IQueryOptimizer {
  private queryCache: QueryCache;
  private performanceMonitor: QueryPerformanceMonitor;
  
  /**
   * Query patterns for optimization
   */
  private queryPatterns = new Map<RegExp, QueryOptimizationStrategy>([
    [/^(who|what|when|where|why|how).{3,}/i, QueryOptimizationStrategy.HIGH_QUALITY],
    [/^(list|find|search|get|show|display).{3,}/i, QueryOptimizationStrategy.HIGH_SPEED],
    [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, QueryOptimizationStrategy.HIGH_SPEED]
  ]);
  
  /**
   * Create a new query optimizer
   * @param vectorDb Vector database client
   * @param filterBuilder Filter builder for query conditions
   * @param embeddingService Service for creating embeddings
   * @param cacheManager Cache manager instance
   * @param config Configuration options
   */
  constructor(
    private readonly vectorDb: IVectorDatabaseClient,
    private readonly filterBuilder: QdrantFilterBuilder,
    private readonly embeddingService: { embedText(text: string): Promise<number[]> },
    private readonly cacheManager: CacheManager,
    private readonly config: QueryOptimizerConfig = DEFAULT_CONFIG
  ) {
    this.queryCache = new QueryCache(cacheManager, {
      defaultTtl: config.cacheTtlSeconds * 1000,
      enableLogging: true
    });
    this.performanceMonitor = new QueryPerformanceMonitor({
      enableDetailedMetrics: true,
      alertThresholds: {
        maxExecutionTimeMs: 2000, // 2 seconds
        minCacheHitRate: 0.7,
        maxMemoryUsageBytes: 52428800 // 50MB
      }
    });
  }
  
  /**
   * Execute a query with optimization
   * @param params Query parameters
   * @param strategy Optional optimization strategy
   * @returns Query response
   */
  public async query<T extends BaseMemorySchema = BaseMemorySchema>(params: QueryParams, strategy: QueryOptimizationStrategy = this.config.defaultStrategy): Promise<QueryResponse<T>> {
    const startTime = Date.now();
    const cacheKey = this.queryCache.generateKey(params);

    try {
      // Check cache first if enabled
      if (this.config.enableCaching) {
        const cachedResults = await this.queryCache.get<T>(cacheKey);
        if (cachedResults) {
          // If cachedResults is an array, wrap it in a QueryResponse object
          if (Array.isArray(cachedResults)) {
            return {
              results: cachedResults,
              totalMatches: cachedResults.length,
              truncated: false,
              executionTimeMs: 0
            };
          }
          return cachedResults;
        }
      }

      // Execute query with strategy
      const results = await this.executeQueryWithStrategy<T>(params, strategy);

      // Cache results if enabled
      if (this.config.enableCaching) {
        await this.queryCache.set(cacheKey, results, params);
      }
      return results;
    } catch (error) {
      // Preserve timeout errors
      if (error instanceof AppError && error.code === QueryErrorCode.EXECUTION_TIMEOUT) {
        throw error;
      }
      // Pass through known AppErrors
      if (error instanceof AppError) {
        if (error.code === QueryErrorCode.FILTER_ERROR) {
          throw error;
        }
      }
      // Handle optimization errors
      if (error instanceof Error && error.message.includes('DB error')) {
        throw new AppError(QueryErrorCode.OPTIMIZATION_FAILED, 'QUERY_OPTIMIZATION_FAILED');
      }
      // Wrap other errors
      throw new AppError(QueryErrorCode.OPTIMIZATION_FAILED, `Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Execute a query with given parameters and optimization strategy
   * @param params Query parameters
   * @param strategy Optimization strategy
   * @returns Query response
   */
  private async executeQueryWithStrategy<T extends BaseMemorySchema>(params: QueryParams, strategy: QueryOptimizationStrategy): Promise<QueryResponse<T>> {
    const startTime = Date.now();
    let timeoutHandle: NodeJS.Timeout | undefined;
    let timedOut = false;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        reject(new AppError(
          `TIMEOUT_ERROR: Query execution timed out after ${this.config.timeoutMs}ms`,
          QueryErrorCode.EXECUTION_TIMEOUT
        ));
      }, this.config.timeoutMs);
    });

    try {
      // Generate embeddings
      const embeddings = await this.embeddingService.embedText(params.query);
      
      // Build filters with proper typing
      let vectorDbFilter: Record<string, unknown>;
      if (params.filters) {
        const qdrantFilter = this.filterBuilder.build(params.filters as FilterConditions<T> | CompositeFilter<T>);
        // Convert QdrantFilter to Record<string, unknown> safely
        vectorDbFilter = JSON.parse(JSON.stringify(qdrantFilter)) as Record<string, unknown>;
      } else {
        vectorDbFilter = {};
      }
      
      // Apply optimization strategy
      const optimizedParams = this.applyOptimizationStrategy(
        params,
        embeddings,
        vectorDbFilter as QdrantFilter | undefined,
        strategy
      );
      
      // Execute query with timeout protection
      const searchPromise = this.vectorDb.search(
        params.collection,
        embeddings,
        optimizedParams.limit,
        (optimizedParams.filter as Record<string, unknown>) || {},
        optimizedParams.scoreThreshold
      );
      
      const searchResults = await Promise.race([searchPromise, timeoutPromise]);
      
      // Format results with proper typing
      const results: QueryResponse<T> = {
        results: searchResults.matches.map(match => ({
          id: IdGenerator.parse(match.id) || IdGenerator.generate('memory'),
          text: match.payload.text as string,
          score: match.score,
          metadata: match.payload as T
        })),
        totalMatches: searchResults.totalCount,
        truncated: searchResults.totalCount > optimizedParams.limit,
        executionTimeMs: Date.now() - startTime
      };
      
      return results;
    } catch (error: unknown) {
      if (error instanceof AppError && error.code === QueryErrorCode.EXECUTION_TIMEOUT) {
        throw error;
      }
      // Wrap other errors
      throw new AppError(QueryErrorCode.OPTIMIZATION_FAILED, `Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Estimate memory usage of query results
   * @param response Query response
   * @returns Estimated memory usage in bytes
   */
  private estimateMemoryUsage(response: QueryResponse<unknown>): number {
    return response.results.reduce((total: number, result: unknown) => {
      const resultSize = JSON.stringify(result).length;
      return total + resultSize;
    }, 0);
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
    await this.queryCache.clearCache(collection);
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
      minScore: params.minScore ?? this.config.defaultMinScore
    };
  }
  
  /**
   * Apply optimization strategy to query parameters
   */
  private applyOptimizationStrategy(
    params: QueryParams,
    embedding: number[],
    filter: QdrantFilter | undefined,
    strategy: QueryOptimizationStrategy
  ): {
    limit: number;
    filter: QdrantFilter | undefined;
    scoreThreshold: number;
  } {
    // Initialize with default values
    let limit = params.limit ?? this.config.defaultLimit;
    let scoreThreshold = params.minScore ?? this.config.defaultMinScore;
    
    // Apply strategy-specific optimizations
    switch (strategy) {
      case QueryOptimizationStrategy.HIGH_QUALITY:
        // Increase results and threshold for better quality
        limit = Math.min(Math.ceil(limit * 1.5), 50); // Cap at 50 results
        scoreThreshold = Math.max(0.7, scoreThreshold);
        // Add stricter filter conditions if available
        if (filter) {
          filter = {
            ...filter,
            must: [
              ...(filter.must || []),
              { key: 'score', range: { gte: scoreThreshold } }
            ]
          };
        }
        break;
        
      case QueryOptimizationStrategy.HIGH_SPEED:
        // Optimize for speed with tighter limits
        limit = Math.min(limit, 20);
        scoreThreshold = Math.min(0.5, scoreThreshold);
        // Simplify filter conditions if available
        if (filter && filter.must && filter.must.length > 2) {
          filter = {
            ...filter,
            must: filter.must.slice(0, 2) // Keep only the most important conditions
          };
        }
        break;
        
      case QueryOptimizationStrategy.CONTEXT_AWARE:
        // Dynamic adjustment based on embedding characteristics
        const embeddingMagnitude = Math.sqrt(
          embedding.reduce((sum, val) => sum + val * val, 0)
        );
        
        if (embeddingMagnitude > 1.2) {
          // More specific query, use higher threshold and smaller limit
          scoreThreshold = Math.max(0.65, scoreThreshold);
          limit = Math.min(limit, 15);
          // Add strict filter conditions
          if (filter) {
            filter = {
              ...filter,
              must: [
                ...(filter.must || []),
                { key: 'score', range: { gte: scoreThreshold } }
              ]
            };
          }
        } else if (embeddingMagnitude < 0.8) {
          // Less specific query, use lower threshold but more results
          scoreThreshold = Math.min(0.55, scoreThreshold);
          limit = Math.min(Math.ceil(limit * 1.2), 30);
          // Simplify filter conditions
          if (filter && filter.must && filter.must.length > 1) {
            filter = {
              ...filter,
              must: filter.must.slice(0, 1) // Keep only the most important condition
            };
          }
        } else {
          // Balanced approach for medium specificity
          scoreThreshold = Math.max(0.6, Math.min(0.7, scoreThreshold));
          limit = Math.min(Math.ceil(limit * 1.1), 25);
        }
        break;
        
      // BALANCED is the default, use the parameters as provided
      default:
        // Ensure reasonable defaults for balanced strategy
        limit = Math.min(Math.max(limit, 5), 30); // Between 5 and 30 results
        scoreThreshold = Math.max(0.6, Math.min(0.8, scoreThreshold)); // Between 0.6 and 0.8
        break;
    }
    
    return {
      limit,
      filter,
      scoreThreshold
    };
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
      setTimeout(() => {
        reject(new AppError(
          QueryErrorCode.EXECUTION_TIMEOUT,
          `Query execution timed out after ${this.config.timeoutMs}ms`
        ));
      }, this.config.timeoutMs);
    });
  }
} 