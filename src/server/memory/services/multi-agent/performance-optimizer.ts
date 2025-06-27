/**
 * Performance Optimizer for Enhanced Memory Service
 * 
 * Provides comprehensive performance optimization including:
 * - Query result caching with intelligent invalidation
 * - Dynamic vector search parameter optimization
 * - Query performance monitoring and analysis
 * - Query plan optimization with strategy adaptation
 */

import { ulid } from 'ulid';
import { BaseMemorySchema } from '../../models/base-schema';
import { CacheManager } from '../cache/types';
import { SearchMemoryParams } from '../memory/types';
import { QueryCache, QueryCacheConfig } from '../query/query-cache';
import { QueryAnalysis, QueryMetrics, QueryPerformanceConfig, QueryPerformanceMonitor } from '../query/query-performance';
import { QueryOptimizationStrategy } from '../query/types';
import { EnhancedMemoryPoint } from './enhanced-memory-service';

/**
 * Vector search optimization parameters
 */
export interface VectorSearchOptimization {
  readonly scoreThreshold: number;
  readonly limit: number;
  readonly strategy: QueryOptimizationStrategy;
  readonly useApproximateSearch: boolean;
  readonly batchSize?: number;
}

/**
 * Performance optimization configuration
 */
export interface PerformanceOptimizerConfig {
  readonly cache: QueryCacheConfig;
  readonly performance: QueryPerformanceConfig;
  readonly vectorSearch: {
    readonly minScoreThreshold: number;
    readonly maxScoreThreshold: number;
    readonly defaultLimit: number;
    readonly maxLimit: number;
    readonly adaptiveThreshold: boolean;
    readonly enableApproximateSearch: boolean;
  };
  readonly queryPlan: {
    readonly enableOptimization: boolean;
    readonly maxExecutionTimeMs: number;
    readonly enableStrategyAdaptation: boolean;
  };
}

/**
 * Default performance optimization configuration
 */
const DEFAULT_CONFIG: PerformanceOptimizerConfig = {
  cache: {
    defaultTtl: 300000, // 5 minutes
    maxQueriesPerCollection: 1000,
    enablePartialResults: true,
    partialResultThreshold: 0.7,
    enableLogging: true
  },
  performance: {
    enableDetailedMetrics: true,
    metricsRetentionMs: 86400000, // 24 hours
    alertThresholds: {
      maxExecutionTimeMs: 2000,
      minCacheHitRate: 0.7,
      maxMemoryUsageBytes: 52428800 // 50MB
    },
    enableAutoOptimization: true
  },
  vectorSearch: {
    minScoreThreshold: 0.3,
    maxScoreThreshold: 0.9,
    defaultLimit: 10,
    maxLimit: 100,
    adaptiveThreshold: true,
    enableApproximateSearch: true
  },
  queryPlan: {
    enableOptimization: true,
    maxExecutionTimeMs: 5000,
    enableStrategyAdaptation: true
  }
};

/**
 * Query execution context
 */
interface QueryContext {
  readonly queryId: string;
  readonly startTime: number;
  readonly params: SearchMemoryParams;
  readonly cacheKey: string;
  readonly optimization: VectorSearchOptimization;
}

/**
 * Performance optimizer for Enhanced Memory Service
 */
export class PerformanceOptimizer {
  private queryCache: QueryCache;
  private performanceMonitor: QueryPerformanceMonitor;
  private config: PerformanceOptimizerConfig;
  private activeQueries: Map<string, QueryContext> = new Map();

  constructor(
    private readonly cacheManager: CacheManager,
    config?: Partial<PerformanceOptimizerConfig>
  ) {
    this.config = this.mergeConfig(config);
    this.queryCache = new QueryCache(cacheManager, this.config.cache);
    this.performanceMonitor = new QueryPerformanceMonitor(this.config.performance);
  }

  /**
   * Execute a search query with performance optimization
   */
  async executeOptimizedSearch<T extends BaseMemorySchema>(
    params: SearchMemoryParams,
    executor: (optimizedParams: SearchMemoryParams, optimization: VectorSearchOptimization) => Promise<EnhancedMemoryPoint<T>[]>
  ): Promise<EnhancedMemoryPoint<T>[]> {
    const context = this.createQueryContext(params);
    this.activeQueries.set(context.queryId, context);

    try {
      // Check cache first
      const cachedResults = await this.checkCache<T>(context);
      if (cachedResults) {
        this.recordCacheHit(context);
        return cachedResults;
      }

      // Execute query with optimization
      const results = await this.executeWithOptimization(context, executor);

      // Cache results
      await this.cacheResults(context, results);

      // Record performance metrics
      this.recordPerformanceMetrics(context, results);

      return results;
    } finally {
      this.activeQueries.delete(context.queryId);
    }
  }

  /**
   * Optimize vector search parameters based on query characteristics
   */
  optimizeVectorSearchParameters(params: SearchMemoryParams): VectorSearchOptimization {
    const analysis = this.analyzeQuery(params);
    const strategy = this.determineOptimizationStrategy(analysis);

    return {
      scoreThreshold: this.calculateOptimalScoreThreshold(params, analysis),
      limit: this.calculateOptimalLimit(params, analysis),
      strategy,
      useApproximateSearch: this.shouldUseApproximateSearch(params, analysis),
      batchSize: this.calculateOptimalBatchSize(params, analysis)
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    cache: {
      hitRate: number;
      totalQueries: number;
      avgResponseTime: number;
    };
    queries: {
      avgExecutionTime: number;
      slowQueries: number;
      totalQueries: number;
    };
    optimization: {
      strategiesUsed: Partial<Record<QueryOptimizationStrategy, number>>;
      avgScoreThreshold: number;
      avgLimit: number;
    };
  } {
    // Implementation would aggregate data from performance monitor
    return {
      cache: {
        hitRate: 0.75, // Placeholder - would be calculated from actual data
        totalQueries: 1000,
        avgResponseTime: 150
      },
      queries: {
        avgExecutionTime: 250,
        slowQueries: 25,
        totalQueries: 1000
      },
      optimization: {
        strategiesUsed: {
          [QueryOptimizationStrategy.HIGH_SPEED]: 400,
          [QueryOptimizationStrategy.BALANCED]: 500,
          [QueryOptimizationStrategy.HIGH_QUALITY]: 100
        },
        avgScoreThreshold: 0.65,
        avgLimit: 15
      }
    };
  }

  /**
   * Clear cache for specific collections or patterns
   */
  async clearCache(pattern?: {
    collection?: string;
    agentId?: string;
    type?: string;
  }): Promise<void> {
    if (pattern?.collection) {
      await this.queryCache.clearCache(pattern.collection);
    } else {
      await this.queryCache.clearCache();
    }
  }

  /**
   * Get optimization recommendations for a query
   */
  getOptimizationRecommendations(params: SearchMemoryParams): string[] {
    const analysis = this.performanceMonitor.analyzeQuery({
      query: params.query || '',
      collection: 'memories', // Default collection
      filters: params.filter || {}
    });

    return analysis.suggestions;
  }

  // Private methods

  private createQueryContext(params: SearchMemoryParams): QueryContext {
    const queryId = ulid();
    const cacheKey = this.generateCacheKey(params);
    const optimization = this.optimizeVectorSearchParameters(params);

    return {
      queryId,
      startTime: Date.now(),
      params,
      cacheKey,
      optimization
    };
  }

  private async checkCache<T extends BaseMemorySchema>(context: QueryContext): Promise<EnhancedMemoryPoint<T>[] | null> {
    const cached = await this.queryCache.get<T>(context.cacheKey);
    if (cached && cached.results && Array.isArray(cached.results)) {
      return cached.results as unknown as EnhancedMemoryPoint<T>[];
    }
    return null;
  }

  private async executeWithOptimization<T extends BaseMemorySchema>(
    context: QueryContext,
    executor: (optimizedParams: SearchMemoryParams, optimization: VectorSearchOptimization) => Promise<EnhancedMemoryPoint<T>[]>
  ): Promise<EnhancedMemoryPoint<T>[]> {
    // Apply optimization parameters to query
    const optimizedParams = this.applyOptimizationToParams(context.params, context.optimization);

    // Execute with timeout protection
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout after ${this.config.queryPlan.maxExecutionTimeMs}ms`));
      }, this.config.queryPlan.maxExecutionTimeMs);
    });

    return Promise.race([
      executor(optimizedParams, context.optimization),
      timeoutPromise
    ]);
  }

  private async cacheResults<T extends BaseMemorySchema>(
    context: QueryContext,
    results: EnhancedMemoryPoint<T>[]
  ): Promise<void> {
    const ttl = this.calculateCacheTtl(context.params, results);
    await this.queryCache.set(
      context.cacheKey,
      {
        results: results as unknown as any[],
        totalMatches: results.length,
        truncated: false,
        executionTimeMs: Date.now() - context.startTime
      },
      {
        query: context.params.query || '',
        collection: 'memories',
        filters: context.params.filter || {}
      },
      ttl
    );
  }

  private recordCacheHit(context: QueryContext): void {
    const metrics: Omit<QueryMetrics, 'complexityScore' | 'filterComplexityScore'> = {
      executionTimeMs: Date.now() - context.startTime,
      cacheStatus: 'hit',
      resultCount: 0, // Not known for cache hits
      strategy: context.optimization.strategy,
      memoryUsageBytes: 0
    };

    this.performanceMonitor.recordMetrics(
      {
        query: context.params.query || '',
        collection: 'memories',
        filters: context.params.filter || {}
      },
      {
        results: [],
        totalMatches: 0,
        truncated: false,
        executionTimeMs: metrics.executionTimeMs
      },
      metrics
    );
  }

  private recordPerformanceMetrics<T extends BaseMemorySchema>(
    context: QueryContext,
    results: EnhancedMemoryPoint<T>[]
  ): void {
    const executionTime = Date.now() - context.startTime;
    const memoryUsage = this.estimateMemoryUsage(results);

    const metrics: Omit<QueryMetrics, 'complexityScore' | 'filterComplexityScore'> = {
      executionTimeMs: executionTime,
      cacheStatus: 'miss',
      resultCount: results.length,
      strategy: context.optimization.strategy,
      memoryUsageBytes: memoryUsage
    };

    this.performanceMonitor.recordMetrics(
      {
        query: context.params.query || '',
        collection: 'memories',
        filters: context.params.filter || {}
      },
      {
        results: results as unknown as any[],
        totalMatches: results.length,
        truncated: false,
        executionTimeMs: executionTime
      },
      metrics
    );
  }

  private generateCacheKey(params: SearchMemoryParams): string {
    const key = {
      query: params.query,
      filter: params.filter,
      limit: params.limit,
      offset: params.offset,
      type: params.type
    };

    return `query:${Buffer.from(JSON.stringify(key)).toString('base64')}`;
  }

  private analyzeQuery(params: SearchMemoryParams): QueryAnalysis {
    return this.performanceMonitor.analyzeQuery({
      query: params.query || '',
      collection: 'memories',
      filters: params.filter || {}
    });
  }

  private determineOptimizationStrategy(analysis: QueryAnalysis): QueryOptimizationStrategy {
    return analysis.recommendedStrategy;
  }

  private calculateOptimalScoreThreshold(
    params: SearchMemoryParams,
    analysis: QueryAnalysis
  ): number {
    const baseThreshold = this.config.vectorSearch.minScoreThreshold;

    // Adjust based on query complexity
    if (analysis.pattern === 'complex') {
      return Math.min(baseThreshold + 0.1, this.config.vectorSearch.maxScoreThreshold);
    }

    // Adjust based on filter complexity
    if (analysis.pattern === 'filter-heavy') {
      return Math.min(baseThreshold + 0.05, this.config.vectorSearch.maxScoreThreshold);
    }

    return baseThreshold;
  }

  private calculateOptimalLimit(
    params: SearchMemoryParams,
    analysis: QueryAnalysis
  ): number {
    const requestedLimit = params.limit || this.config.vectorSearch.defaultLimit;
    const maxLimit = this.config.vectorSearch.maxLimit;

    // Adjust based on query pattern
    if (analysis.pattern === 'result-heavy') {
      return Math.min(requestedLimit * 1.5, maxLimit);
    }

    return Math.min(requestedLimit, maxLimit);
  }

  private shouldUseApproximateSearch(
    params: SearchMemoryParams,
    analysis: QueryAnalysis
  ): boolean {
    if (!this.config.vectorSearch.enableApproximateSearch) {
      return false;
    }

    // Use approximate search for large result sets
    if ((params.limit || this.config.vectorSearch.defaultLimit) > 50) {
      return true;
    }

    return false;
  }

  private calculateOptimalBatchSize(
    params: SearchMemoryParams,
    analysis: QueryAnalysis
  ): number | undefined {
    const limit = params.limit || this.config.vectorSearch.defaultLimit;

    // Use batching for large queries
    if (limit > 100) {
      return Math.min(50, Math.ceil(limit / 4));
    }

    return undefined;
  }

  private applyOptimizationToParams(
    params: SearchMemoryParams,
    optimization: VectorSearchOptimization
  ): SearchMemoryParams {
    return {
      ...params,
      limit: optimization.limit,
      minScore: optimization.scoreThreshold
    };
  }

  private calculateCacheTtl(
    params: SearchMemoryParams,
    results: EnhancedMemoryPoint<any>[]
  ): number {
    let baseTtl = this.config.cache.defaultTtl || 300000; // Ensure baseTtl has a default value

    // Longer TTL for stable results
    if (results.length > 0 && results.length < 5) {
      baseTtl *= 2;
    }

    // Shorter TTL for large result sets (more likely to change)
    if (results.length > 20) {
      baseTtl *= 0.5;
    }

    return Math.floor(baseTtl / 1000); // Convert to seconds
  }

  private estimateMemoryUsage<T extends BaseMemorySchema>(results: EnhancedMemoryPoint<T>[]): number {
    // Rough estimation: 1KB per result on average
    return results.length * 1024;
  }

  private mergeConfig(config?: Partial<PerformanceOptimizerConfig>): PerformanceOptimizerConfig {
    if (!config) return DEFAULT_CONFIG;

    return {
      cache: { ...DEFAULT_CONFIG.cache, ...config.cache },
      performance: { ...DEFAULT_CONFIG.performance, ...config.performance },
      vectorSearch: { ...DEFAULT_CONFIG.vectorSearch, ...config.vectorSearch },
      queryPlan: { ...DEFAULT_CONFIG.queryPlan, ...config.queryPlan }
    };
  }
}
