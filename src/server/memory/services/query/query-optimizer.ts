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
import { QueryCache } from './query-cache';
import { CacheManager } from '../cache/types';
import { BaseMemorySchema } from '../../models/base-schema';
import { QdrantFilter } from '../filters/types';
import { QueryPerformanceMonitor } from './query-performance';

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
    private readonly vectorDb: any, // TODO: Add proper type
    private readonly filterBuilder: any, // TODO: Add proper type
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
  async query<T = Record<string, unknown>>(
    params: QueryParams,
    strategy?: QueryOptimizationStrategy
  ): Promise<QueryResponse<T>> {
    const startTime = Date.now();
    const mergedParams = this.mergeQueryDefaults(params);
    const selectedStrategy = strategy || this.determineStrategy(params.query);
    
    try {
      // Check cache first
      const cachedResults = await this.queryCache.getCachedResults<BaseMemorySchema>(mergedParams);
      if (cachedResults) {
        const endTime = Date.now();
        this.performanceMonitor.recordMetrics(mergedParams, cachedResults, {
          executionTimeMs: endTime - startTime,
          cacheStatus: 'hit',
          resultCount: cachedResults.results.length,
          strategy: selectedStrategy,
          memoryUsageBytes: this.estimateMemoryUsage(cachedResults)
        });
        
        return cachedResults as unknown as QueryResponse<T>;
      }
      
      // Execute query with performance monitoring
      const results = await this.executeQueryWithStrategy<T>(mergedParams, selectedStrategy);
      const endTime = Date.now();
      
      // Record performance metrics
      this.performanceMonitor.recordMetrics(mergedParams, results, {
        executionTimeMs: endTime - startTime,
        cacheStatus: 'miss',
        resultCount: results.results.length,
        strategy: selectedStrategy,
        memoryUsageBytes: this.estimateMemoryUsage(results)
      });
      
      // Cache results
      await this.queryCache.cacheResults(mergedParams, results as unknown as QueryResponse<BaseMemorySchema>);
      
      // Analyze performance and suggest optimizations
      const analysis = this.performanceMonitor.analyzeQuery(mergedParams);
      if (analysis.bottlenecks.length > 0) {
        console.warn('[QueryOptimizer] Performance bottlenecks detected:', {
          query: mergedParams.query,
          bottlenecks: analysis.bottlenecks,
          suggestions: analysis.suggestions
        });
      }
      
      return results;
    } catch (error) {
      const endTime = Date.now();
      
      // Record error metrics
      this.performanceMonitor.recordMetrics(mergedParams, {
        results: [],
        totalMatches: 0,
        truncated: false,
        executionTimeMs: endTime - startTime
      }, {
        executionTimeMs: endTime - startTime,
        cacheStatus: 'miss',
        resultCount: 0,
        strategy: selectedStrategy,
        memoryUsageBytes: 0
      });
      
      throw error;
    }
  }
  
  /**
   * Execute a query with given parameters and optimization strategy
   * @param params Query parameters
   * @param strategy Optimization strategy
   * @returns Query response
   */
  private async executeQueryWithStrategy<T>(
    params: QueryParams,
    strategy: QueryOptimizationStrategy
  ): Promise<QueryResponse<T>> {
    const startTime = Date.now();
    
    try {
      // Generate embeddings
      const embeddings = await this.embeddingService.embedText(params.query);
      
      // Build filters
      const filters = this.filterBuilder.buildFilters(params.filters);
      
      // Apply optimization strategy
      const optimizedParams = this.applyOptimizationStrategy(
        params,
        embeddings,
        filters,
        strategy
      );
      
      // Execute query
      const searchResults = await this.vectorDb.search(
        params.collection,
        embeddings,
        optimizedParams.limit,
        filters,
        optimizedParams.scoreThreshold
      );
      
      // Format results
      const results: QueryResponse<T> = {
        results: searchResults.matches.map((match: { id: string; score: number; payload: Record<string, unknown> }) => ({
          id: match.id,
          text: match.payload.text as string,
          score: match.score,
          metadata: match.payload as T
        })),
        totalMatches: searchResults.totalCount,
        truncated: searchResults.totalCount > (params.limit ?? 0),
        executionTimeMs: Date.now() - startTime
      };
      
      // Check timeout
      if (results.executionTimeMs > 5000) { // 5 second timeout
        throw new AppError(
          QueryErrorCode.EXECUTION_TIMEOUT,
          `Query execution timed out after ${results.executionTimeMs}ms`
        );
      }
      
      return results;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        QueryErrorCode.OPTIMIZATION_FAILED,
        `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
    filter?: QdrantFilter;
    scoreThreshold: number;
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