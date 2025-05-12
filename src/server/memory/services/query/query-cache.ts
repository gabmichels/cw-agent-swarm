/**
 * Enhanced query caching implementation
 */
import { CacheManager, CacheEntryOptions, CachePriority } from '../cache/types';
import { QueryParams, QueryResponse } from './types';
import { MemoryType } from '../../config';
import { BaseMemorySchema } from '../../models/base-schema';

/**
 * Configuration for query cache
 */
export interface QueryCacheConfig {
  /**
   * Default TTL for query results in milliseconds
   * @default 300000 (5 minutes)
   */
  defaultTtl?: number;
  
  /**
   * TTL for different query types in milliseconds
   */
  typeTtl?: Partial<Record<MemoryType, number>>;
  
  /**
   * Maximum number of cached queries per collection
   * @default 1000
   */
  maxQueriesPerCollection?: number;
  
  /**
   * Whether to enable partial result caching
   * @default true
   */
  enablePartialResults?: boolean;
  
  /**
   * Minimum score threshold for partial results
   * @default 0.7
   */
  partialResultThreshold?: number;
  
  /**
   * Whether to enable logging
   * @default false
   */
  enableLogging?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<QueryCacheConfig> = {
  defaultTtl: 300000, // 5 minutes
  typeTtl: {},
  maxQueriesPerCollection: 1000,
  enablePartialResults: true,
  partialResultThreshold: 0.7,
  enableLogging: false
};

/**
 * Query cache entry with metadata
 */
interface QueryCacheEntry<T> {
  /**
   * The cached query results
   */
  results: QueryResponse<T>;
  
  /**
   * When the entry was created
   */
  createdAt: number;
  
  /**
   * When the entry expires
   */
  expiresAt: number;
  
  /**
   * Tags for cache invalidation
   */
  tags: Set<string>;
  
  /**
   * Query parameters used
   */
  params: QueryParams;
  
  /**
   * Whether this is a partial result
   */
  isPartial: boolean;
}

/**
 * Enhanced query cache implementation
 */
export class QueryCache {
  private cache: CacheManager;
  private config: Required<QueryCacheConfig>;
  private queryEntries: Map<string, Map<string, QueryCacheEntry<any>>> = new Map();
  
  /**
   * Create a new query cache
   * @param cache The cache manager to use
   * @param config Configuration options
   */
  constructor(
    cache: CacheManager,
    config?: QueryCacheConfig
  ) {
    this.cache = cache;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Get cached query results
   * @param params Query parameters
   * @returns Cached results or undefined if not found
   */
  async getCachedResults<T extends BaseMemorySchema>(
    params: QueryParams
  ): Promise<QueryResponse<T> | undefined> {
    const cacheKey = this.getCacheKey(params);
    const collectionCache = this.queryEntries.get(params.collection);
    
    if (!collectionCache) {
      return undefined;
    }
    
    const entry = collectionCache.get(cacheKey);
    if (!entry) {
      return undefined;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      collectionCache.delete(cacheKey);
      return undefined;
    }
    
    // If partial results are enabled, check if we can use them
    if (this.config.enablePartialResults && entry.isPartial) {
      const fullResults = await this.getFullResults<T>(params);
      if (fullResults) {
        // Update cache with full results
        await this.cacheResults(params, fullResults, false);
        return fullResults;
      }
    }
    
    return entry.results as QueryResponse<T>;
  }
  
  /**
   * Cache query results
   * @param params Query parameters
   * @param results Query results to cache
   * @param isPartial Whether these are partial results
   */
  async cacheResults<T extends BaseMemorySchema>(
    params: QueryParams,
    results: QueryResponse<T>,
    isPartial: boolean = false
  ): Promise<void> {
    const cacheKey = this.getCacheKey(params);
    const ttl = this.getTtlForQuery(params);
    
    // Create cache entry
    const entry: QueryCacheEntry<T> = {
      results,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      tags: this.getTagsForQuery(params),
      params,
      isPartial
    };
    
    // Get or create collection cache
    let collectionCache = this.queryEntries.get(params.collection);
    if (!collectionCache) {
      collectionCache = new Map();
      this.queryEntries.set(params.collection, collectionCache);
    }
    
    // Store in collection cache
    collectionCache.set(cacheKey, entry);
    
    // Store in main cache
    await this.cache.set(cacheKey, entry, {
      ttl,
      priority: CachePriority.MEDIUM,
      tags: Array.from(entry.tags)
    });
    
    // Enforce collection cache size limit
    if (collectionCache.size > this.config.maxQueriesPerCollection) {
      const oldestKey = Array.from(collectionCache.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0][0];
      collectionCache.delete(oldestKey);
    }
    
    this.log(`Cached ${isPartial ? 'partial' : 'full'} results for query: ${params.query}`);
  }
  
  /**
   * Invalidate cache entries
   * @param tags Tags to invalidate
   * @param collection Optional collection to limit invalidation to
   */
  async invalidateCache(tags: string[], collection?: string): Promise<void> {
    const collections = collection 
      ? [collection]
      : Array.from(this.queryEntries.keys());
    
    for (const coll of collections) {
      const collectionCache = this.queryEntries.get(coll);
      if (!collectionCache) continue;
      
      // Find entries to invalidate
      const entriesToDelete = Array.from(collectionCache.entries())
        .filter(([_, entry]) => 
          tags.some(tag => entry.tags.has(tag))
        )
        .map(([key]) => key);
      
      // Delete from collection cache
      for (const key of entriesToDelete) {
        collectionCache.delete(key);
      }
      
      // Delete from main cache
      for (const tag of tags) {
        await this.cache.invalidateByTag(tag);
      }
    }
    
    this.log(`Invalidated cache entries for tags: ${tags.join(', ')}`);
  }
  
  /**
   * Clear the query cache
   * @param collection Optional collection to clear cache for
   */
  async clearCache(collection?: string): Promise<void> {
    if (collection) {
      this.queryEntries.delete(collection);
      await this.cache.invalidateByTag(`collection:${collection}`);
    } else {
      this.queryEntries.clear();
      await this.cache.clear();
    }
    
    this.log(`Cleared query cache${collection ? ` for ${collection}` : ''}`);
  }
  
  /**
   * Get cache key for a query
   * @param params Query parameters
   * @returns Cache key
   */
  private getCacheKey(params: QueryParams): string {
    const queryStr = params.query.toLowerCase().trim();
    const filtersStr = params.filters 
      ? JSON.stringify(params.filters)
      : '';
    const limitStr = params.limit?.toString() || '';
    const minScoreStr = params.minScore?.toString() || '';
    
    return `query:${params.collection}:${queryStr}|${filtersStr}|${limitStr}|${minScoreStr}`;
  }
  
  /**
   * Get tags for a query
   * @param params Query parameters
   * @returns Set of tags
   */
  private getTagsForQuery(params: QueryParams): Set<string> {
    const tags = new Set<string>([
      `collection:${params.collection}`,
      'query'
    ]);
    
    // Add type-specific tags
    if (params.type) {
      tags.add(`type:${params.type}`);
    }
    
    // Add filter-specific tags
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') {
          tags.add(`filter:${key}:${value}`);
        }
      });
    }
    
    return tags;
  }
  
  /**
   * Get TTL for a query
   * @param params Query parameters
   * @returns TTL in milliseconds
   */
  private getTtlForQuery(params: QueryParams): number {
    if (params.type && this.config.typeTtl[params.type]) {
      return this.config.typeTtl[params.type]!;
    }
    return this.config.defaultTtl;
  }
  
  /**
   * Get full results for a query
   * This is a placeholder for the actual implementation
   * @param params Query parameters
   * @returns Full query results or undefined
   */
  private async getFullResults<T extends BaseMemorySchema>(
    params: QueryParams
  ): Promise<QueryResponse<T> | undefined> {
    // TODO: Implement actual query execution
    // This would typically call the query optimizer or memory service
    return undefined;
  }
  
  /**
   * Log a message if logging is enabled
   * @param message Message to log
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[QueryCache] ${message}`);
    }
  }
} 