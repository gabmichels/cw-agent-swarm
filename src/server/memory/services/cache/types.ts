/**
 * Type definitions for memory system caching
 */

/**
 * Configuration options for cache entries
 */
export interface CacheEntryOptions {
  /**
   * Time-to-live in milliseconds
   * If not provided, the default TTL will be used
   */
  ttl?: number;
  
  /**
   * Priority of this cache entry
   * Higher priority items are less likely to be evicted
   */
  priority?: CachePriority;
  
  /**
   * Tags associated with this cache entry
   * Used for grouped invalidation
   */
  tags?: string[];
}

/**
 * Priority levels for cache entries
 */
export enum CachePriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Statistics about the cache
 */
export interface CacheStats {
  /**
   * Total number of items in the cache
   */
  size: number;
  
  /**
   * Number of cache hits
   */
  hits: number;
  
  /**
   * Number of cache misses
   */
  misses: number;
  
  /**
   * Hit rate (hits / (hits + misses))
   */
  hitRate: number;
  
  /**
   * Number of evictions due to size constraints
   */
  evictions: number;
  
  /**
   * Number of invalidations (manual or TTL-based)
   */
  invalidations: number;
  
  /**
   * Average item age in cache (milliseconds)
   */
  averageAge: number;
  
  /**
   * Memory usage estimate (bytes)
   */
  memoryUsage: number;
}

/**
 * Interface for cache managers
 */
export interface CacheManager {
  /**
   * Get an item from the cache
   * @param key Cache key
   * @returns The cached value or undefined if not found
   */
  get<T>(key: string): Promise<T | undefined>;
  
  /**
   * Set an item in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param options Cache entry options
   */
  set<T>(key: string, value: T, options?: CacheEntryOptions): Promise<void>;
  
  /**
   * Check if an item exists in the cache
   * @param key Cache key
   * @returns True if the item exists, false otherwise
   */
  has(key: string): Promise<boolean>;
  
  /**
   * Remove an item from the cache
   * @param key Cache key
   * @returns True if the item was removed, false if it wasn't in the cache
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * Remove all items from the cache
   */
  clear(): Promise<void>;
  
  /**
   * Remove items by tag
   * @param tag Tag to invalidate
   * @returns Number of items removed
   */
  invalidateByTag(tag: string): Promise<number>;
  
  /**
   * Get cache statistics
   * @returns Current cache statistics
   */
  getStats(): Promise<CacheStats>;
  
  /**
   * Get all tags for a cache entry
   * @param key Cache key
   * @returns Set of tags or undefined if entry doesn't exist
   */
  getTags(key: string): Promise<Set<string> | undefined>;
}

/**
 * Configuration for in-memory cache
 */
export interface InMemoryCacheConfig {
  /**
   * Maximum number of items to store in the cache
   * Default: 5000
   */
  maxSize?: number;
  
  /**
   * Default TTL for cache entries in milliseconds
   * Default: 5 minutes (300,000ms)
   */
  defaultTtl?: number;
  
  /**
   * Whether to automatically prune expired items
   * Default: true
   */
  autoPrune?: boolean;
  
  /**
   * Interval in milliseconds to prune expired items
   * Default: 1 minute (60,000ms)
   */
  pruneInterval?: number;
  
  /**
   * Log cache events (for debugging)
   * Default: false
   */
  enableLogging?: boolean;
}

/**
 * Cache warming strategy types
 */
export enum CacheWarmingStrategy {
  FREQUENT_ACCESS = 'frequent_access',
  RECENT_ACCESS = 'recent_access',
  GRAPH_RELATED = 'graph_related',
  TIME_BASED = 'time_based',
  PATTERN_BASED = 'pattern_based'
}

/**
 * Cache warming trigger types
 */
export enum CacheWarmingTrigger {
  ACCESS_PATTERN = 'access_pattern',
  SCHEDULED = 'scheduled',
  STARTUP = 'startup',
  MANUAL = 'manual'
}

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
  /**
   * Whether cache warming is enabled
   */
  enabled: boolean;
  
  /**
   * Strategies to use for warming
   */
  strategies: CacheWarmingStrategy[];
  
  /**
   * Triggers that activate warming
   */
  triggers: CacheWarmingTrigger[];
  
  /**
   * Maximum number of items to warm per strategy
   */
  maxItemsPerStrategy: number;
  
  /**
   * Time window for recent access strategy (in ms)
   */
  recentAccessWindow: number;
  
  /**
   * Minimum access count for frequent access strategy
   */
  minAccessCount: number;
  
  /**
   * Schedule for time-based warming (cron expression)
   */
  warmingSchedule?: string;
  
  /**
   * Whether to warm on startup
   */
  warmOnStartup: boolean;
}

/**
 * Cache warming result
 */
export interface CacheWarmingResult {
  /**
   * Strategy used for warming
   */
  strategy: CacheWarmingStrategy;
  
  /**
   * Number of items warmed
   */
  itemsWarmed: number;
  
  /**
   * Time taken to warm (in ms)
   */
  timeTaken: number;
  
  /**
   * Any errors that occurred
   */
  errors?: Error[];
}

/**
 * Cache warming interface
 */
export interface ICacheWarmer {
  /**
   * Initialize the cache warmer
   */
  initialize(): Promise<void>;
  
  /**
   * Start cache warming
   * @param strategy Optional specific strategy to use
   */
  warmCache(strategy?: CacheWarmingStrategy): Promise<CacheWarmingResult[]>;
  
  /**
   * Stop cache warming
   */
  stopWarming(): Promise<void>;
  
  /**
   * Get warming statistics
   */
  getWarmingStats(): Promise<{
    lastWarmed: Date;
    totalItemsWarmed: number;
    averageTimePerItem: number;
    strategiesUsed: CacheWarmingStrategy[];
    errors: Error[];
  }>;
} 