/**
 * Query Performance Monitoring and Optimization
 * 
 * Provides monitoring, analysis, and optimization for query performance.
 */

import { QueryParams, QueryResponse, QueryOptimizationStrategy } from './types';
import { AppError } from '../../../../lib/errors/base';
import { QueryErrorCode } from './types';

/**
 * Query performance metrics
 */
export interface QueryMetrics {
  /**
   * Query execution time in milliseconds
   */
  executionTimeMs: number;
  
  /**
   * Cache hit/miss status
   */
  cacheStatus: 'hit' | 'miss';
  
  /**
   * Number of results returned
   */
  resultCount: number;
  
  /**
   * Query optimization strategy used
   */
  strategy: QueryOptimizationStrategy;
  
  /**
   * Query complexity score (0-1)
   */
  complexityScore: number;
  
  /**
   * Filter complexity score (0-1)
   */
  filterComplexityScore: number;
  
  /**
   * Memory usage in bytes
   */
  memoryUsageBytes: number;
}

/**
 * Query performance analysis
 */
export interface QueryAnalysis {
  /**
   * Query pattern classification
   */
  pattern: 'simple' | 'complex' | 'filter-heavy' | 'result-heavy';
  
  /**
   * Recommended optimization strategy
   */
  recommendedStrategy: QueryOptimizationStrategy;
  
  /**
   * Performance bottlenecks identified
   */
  bottlenecks: string[];
  
  /**
   * Optimization suggestions
   */
  suggestions: string[];
}

/**
 * Query performance monitor configuration
 */
export interface QueryPerformanceConfig {
  /**
   * Whether to enable detailed metrics collection
   * @default true
   */
  enableDetailedMetrics: boolean;
  
  /**
   * Metrics retention period in milliseconds
   * @default 86400000 (24 hours)
   */
  metricsRetentionMs: number;
  
  /**
   * Performance alert thresholds
   */
  alertThresholds: {
    /**
     * Maximum execution time in milliseconds
     * @default 1000
     */
    maxExecutionTimeMs: number;
    
    /**
     * Minimum cache hit rate (0-1)
     * @default 0.8
     */
    minCacheHitRate: number;
    
    /**
     * Maximum memory usage per query in bytes
     * @default 10485760 (10MB)
     */
    maxMemoryUsageBytes: number;
  };
  
  /**
   * Whether to enable automatic optimization
   * @default true
   */
  enableAutoOptimization: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<QueryPerformanceConfig> = {
  enableDetailedMetrics: true,
  metricsRetentionMs: 86400000, // 24 hours
  alertThresholds: {
    maxExecutionTimeMs: 1000,
    minCacheHitRate: 0.8,
    maxMemoryUsageBytes: 10485760 // 10MB
  },
  enableAutoOptimization: true
};

/**
 * Query performance monitor
 */
export class QueryPerformanceMonitor {
  private metrics: Map<string, QueryMetrics[]> = new Map();
  private config: Required<QueryPerformanceConfig>;
  
  /**
   * Create a new query performance monitor
   * @param config Configuration options
   */
  constructor(config?: Partial<QueryPerformanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupInterval();
  }
  
  /**
   * Record query performance metrics
   * @param params Query parameters
   * @param response Query response
   * @param metrics Performance metrics
   */
  recordMetrics(
    params: QueryParams,
    response: QueryResponse<unknown>,
    metrics: Omit<QueryMetrics, 'complexityScore' | 'filterComplexityScore'>
  ): void {
    const key = this.getMetricsKey(params);
    const fullMetrics: QueryMetrics = {
      ...metrics,
      complexityScore: this.calculateQueryComplexity(params),
      filterComplexityScore: this.calculateFilterComplexity(params)
    };
    
    const collectionMetrics = this.metrics.get(params.collection) || [];
    collectionMetrics.push(fullMetrics);
    this.metrics.set(params.collection, collectionMetrics);
    
    this.checkAlerts(params, fullMetrics);
  }
  
  /**
   * Analyze query performance
   * @param params Query parameters
   * @returns Performance analysis
   */
  analyzeQuery(params: QueryParams): QueryAnalysis {
    const metrics = this.getMetricsForQuery(params);
    const pattern = this.classifyQueryPattern(params, metrics);
    const bottlenecks = this.identifyBottlenecks(metrics);
    const suggestions = this.generateOptimizationSuggestions(pattern, bottlenecks);
    
    return {
      pattern,
      recommendedStrategy: this.recommendStrategy(pattern, metrics),
      bottlenecks,
      suggestions
    };
  }
  
  /**
   * Get performance metrics for a query
   * @param params Query parameters
   * @returns Array of metrics
   */
  getMetricsForQuery(params: QueryParams): QueryMetrics[] {
    const key = this.getMetricsKey(params);
    return this.metrics.get(params.collection) || [];
  }
  
  /**
   * Get performance statistics for a collection
   * @param collection Collection name
   * @returns Performance statistics
   */
  getCollectionStats(collection: string): {
    avgExecutionTimeMs: number;
    cacheHitRate: number;
    avgResultCount: number;
    commonBottlenecks: string[];
  } {
    const metrics = this.metrics.get(collection) || [];
    if (metrics.length === 0) {
      return {
        avgExecutionTimeMs: 0,
        cacheHitRate: 0,
        avgResultCount: 0,
        commonBottlenecks: []
      };
    }
    
    const cacheHits = metrics.filter(m => m.cacheStatus === 'hit').length;
    const totalQueries = metrics.length;
    
    return {
      avgExecutionTimeMs: metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / totalQueries,
      cacheHitRate: cacheHits / totalQueries,
      avgResultCount: metrics.reduce((sum, m) => sum + m.resultCount, 0) / totalQueries,
      commonBottlenecks: this.getCommonBottlenecks(metrics)
    };
  }
  
  /**
   * Clear old metrics
   */
  private clearOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionMs;
    
    for (const [collection, metrics] of Array.from(this.metrics.entries())) {
      const filteredMetrics = metrics.filter((m: QueryMetrics) => m.executionTimeMs > cutoffTime);
      if (filteredMetrics.length === 0) {
        this.metrics.delete(collection);
      } else {
        this.metrics.set(collection, filteredMetrics);
      }
    }
  }
  
  /**
   * Start metrics cleanup interval
   */
  private startCleanupInterval(): void {
    // Clean up old metrics every hour
    setInterval(() => this.clearOldMetrics(), 3600000);
  }
  
  /**
   * Get metrics key for a query
   */
  private getMetricsKey(params: QueryParams): string {
    return `${params.collection}:${params.query}:${params.type || 'any'}`;
  }
  
  /**
   * Calculate query complexity score
   */
  private calculateQueryComplexity(params: QueryParams): number {
    const words = params.query.split(/\s+/).length;
    const hasFilters = params.filters && Object.keys(params.filters).length > 0;
    const hasType = !!params.type;
    
    // Simple scoring based on query characteristics
    let score = 0;
    score += Math.min(words / 10, 1) * 0.4; // Word count contribution
    score += (hasFilters ? 0.3 : 0); // Filter contribution
    score += (hasType ? 0.3 : 0); // Type filter contribution
    
    return Math.min(score, 1);
  }
  
  /**
   * Calculate filter complexity score
   */
  private calculateFilterComplexity(params: QueryParams): number {
    if (!params.filters) return 0;
    
    const filterCount = Object.keys(params.filters).length;
    const valueComplexity = Object.values(params.filters).reduce((sum: number, value: unknown): number => {
      if (Array.isArray(value)) return sum + value.length;
      if (typeof value === 'object' && value !== null) return sum + 2;
      return sum + 1;
    }, 0);
    
    return Math.min((filterCount * 0.3 + valueComplexity * 0.7) / 10, 1);
  }
  
  /**
   * Classify query pattern
   */
  private classifyQueryPattern(
    params: QueryParams,
    metrics: QueryMetrics[]
  ): 'simple' | 'complex' | 'filter-heavy' | 'result-heavy' {
    const complexityScore = this.calculateQueryComplexity(params);
    const filterScore = this.calculateFilterComplexity(params);
    
    if (filterScore > 0.7) return 'filter-heavy';
    if (complexityScore > 0.7) return 'complex';
    if (metrics.some(m => m.resultCount > 100)) return 'result-heavy';
    return 'simple';
  }
  
  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(metrics: QueryMetrics[]): string[] {
    const bottlenecks: string[] = [];
    const thresholds = this.config.alertThresholds;
    
    // Check execution time
    if (metrics.some(m => m.executionTimeMs > thresholds.maxExecutionTimeMs)) {
      bottlenecks.push('high_execution_time');
    }
    
    // Check memory usage
    if (metrics.some(m => m.memoryUsageBytes > thresholds.maxMemoryUsageBytes)) {
      bottlenecks.push('high_memory_usage');
    }
    
    // Check cache hit rate
    const cacheHits = metrics.filter(m => m.cacheStatus === 'hit').length;
    const hitRate = cacheHits / metrics.length;
    if (hitRate < thresholds.minCacheHitRate) {
      bottlenecks.push('low_cache_hit_rate');
    }
    
    return bottlenecks;
  }
  
  /**
   * Get common bottlenecks from metrics
   */
  private getCommonBottlenecks(metrics: QueryMetrics[]): string[] {
    const bottlenecks = new Map<string, number>();
    
    for (const metric of metrics) {
      const metricBottlenecks = this.identifyBottlenecks([metric]);
      for (const bottleneck of metricBottlenecks) {
        bottlenecks.set(bottleneck, (bottlenecks.get(bottleneck) || 0) + 1);
      }
    }
    
    return Array.from(bottlenecks.entries())
      .filter(([_, count]) => count > metrics.length * 0.2) // Bottlenecks in >20% of queries
      .map(([bottleneck]) => bottleneck);
  }
  
  /**
   * Recommend optimization strategy
   */
  private recommendStrategy(
    pattern: 'simple' | 'complex' | 'filter-heavy' | 'result-heavy',
    metrics: QueryMetrics[]
  ): QueryOptimizationStrategy {
    switch (pattern) {
      case 'simple':
        return QueryOptimizationStrategy.HIGH_SPEED;
      case 'complex':
        return QueryOptimizationStrategy.HIGH_QUALITY;
      case 'filter-heavy':
        return metrics.some(m => m.executionTimeMs > 500)
          ? QueryOptimizationStrategy.HIGH_SPEED
          : QueryOptimizationStrategy.BALANCED;
      case 'result-heavy':
        return QueryOptimizationStrategy.BALANCED;
      default:
        return QueryOptimizationStrategy.BALANCED;
    }
  }
  
  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(
    pattern: 'simple' | 'complex' | 'filter-heavy' | 'result-heavy',
    bottlenecks: string[]
  ): string[] {
    const suggestions: string[] = [];
    
    // Pattern-based suggestions
    switch (pattern) {
      case 'complex':
        suggestions.push('Consider splitting complex queries into simpler ones');
        suggestions.push('Use more specific filters to reduce result set size');
        break;
      case 'filter-heavy':
        suggestions.push('Optimize filter conditions for better performance');
        suggestions.push('Consider using composite filters');
        break;
      case 'result-heavy':
        suggestions.push('Implement pagination for large result sets');
        suggestions.push('Consider using more specific filters');
        break;
    }
    
    // Bottleneck-based suggestions
    if (bottlenecks.includes('high_execution_time')) {
      suggestions.push('Consider using HIGH_SPEED optimization strategy');
      suggestions.push('Implement query caching for frequently used queries');
    }
    if (bottlenecks.includes('high_memory_usage')) {
      suggestions.push('Implement result set size limits');
      suggestions.push('Consider using streaming for large result sets');
    }
    if (bottlenecks.includes('low_cache_hit_rate')) {
      suggestions.push('Review cache invalidation strategy');
      suggestions.push('Consider implementing query pattern-based caching');
    }
    
    return suggestions;
  }
  
  /**
   * Check and trigger performance alerts
   */
  private checkAlerts(params: QueryParams, metrics: QueryMetrics): void {
    const thresholds = this.config.alertThresholds;
    const alerts: string[] = [];
    
    if (metrics.executionTimeMs > thresholds.maxExecutionTimeMs) {
      alerts.push(`Query execution time (${metrics.executionTimeMs}ms) exceeded threshold (${thresholds.maxExecutionTimeMs}ms)`);
    }
    
    if (metrics.memoryUsageBytes > thresholds.maxMemoryUsageBytes) {
      alerts.push(`Query memory usage (${metrics.memoryUsageBytes} bytes) exceeded threshold (${thresholds.maxMemoryUsageBytes} bytes)`);
    }
    
    if (alerts.length > 0) {
      // TODO: Implement proper alert handling
      console.warn(`[QueryPerformance] Alerts for query ${params.query}:`, alerts);
    }
  }
} 