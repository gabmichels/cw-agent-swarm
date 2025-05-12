/**
 * In-memory cache implementation
 */
import { CacheManager, CacheEntryOptions, CacheStats, CachePriority, InMemoryCacheConfig } from './types';

/**
 * Internal cache entry with metadata
 */
interface CacheEntry<T> {
  /**
   * The cached value
   */
  value: T;
  
  /**
   * When the entry was created
   */
  createdAt: number;
  
  /**
   * When the entry expires (0 for no expiration)
   */
  expiresAt: number;
  
  /**
   * Priority of this entry
   */
  priority: CachePriority;
  
  /**
   * Tags for this entry
   */
  tags: Set<string>;
  
  /**
   * Last accessed timestamp
   */
  lastAccessed: number;
  
  /**
   * Number of times this entry has been accessed
   */
  accessCount: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<InMemoryCacheConfig> = {
  maxSize: 5000,
  defaultTtl: 5 * 60 * 1000, // 5 minutes
  autoPrune: true,
  pruneInterval: 60 * 1000, // 1 minute
  enableLogging: false
};

/**
 * In-memory cache manager implementation
 * Uses LRU (least recently used) with priority consideration for eviction
 */
export class InMemoryCacheManager implements CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: Required<InMemoryCacheConfig>;
  private pruneIntervalId: NodeJS.Timeout | null = null;
  
  // Statistics
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;
  private invalidationCount = 0;
  
  /**
   * Create a new in-memory cache manager
   * @param config Cache configuration
   */
  constructor(config?: InMemoryCacheConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.autoPrune) {
      this.startPruneInterval();
    }
    
    this.log('InMemoryCacheManager initialized');
  }
  
  /**
   * Get an item from the cache
   * @param key Cache key
   * @returns The cached value or undefined if not found/expired
   */
  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    
    // Not in cache
    if (!entry) {
      this.missCount++;
      this.log(`Cache miss: ${key}`);
      return undefined;
    }
    
    // Check if expired
    if (entry.expiresAt > 0 && entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      this.invalidationCount++;
      this.missCount++;
      this.log(`Cache entry expired: ${key}`);
      return undefined;
    }
    
    // Update access metadata
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    
    this.hitCount++;
    this.log(`Cache hit: ${key}`);
    return entry.value;
  }
  
  /**
   * Set an item in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param options Cache entry options
   */
  async set<T>(key: string, value: T, options?: CacheEntryOptions): Promise<void> {
    // Check if we need to evict entries due to size constraints
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictEntries();
    }
    
    const now = Date.now();
    const ttl = options?.ttl ?? this.config.defaultTtl;
    const expiresAt = ttl > 0 ? now + ttl : 0;
    
    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt,
      priority: options?.priority ?? CachePriority.MEDIUM,
      tags: new Set(options?.tags ?? []),
      lastAccessed: now,
      accessCount: 0
    };
    
    this.cache.set(key, entry);
    this.log(`Cache set: ${key}, expires: ${expiresAt > 0 ? new Date(expiresAt).toISOString() : 'never'}`);
  }
  
  /**
   * Check if an item exists in the cache
   * @param key Cache key
   * @returns True if the item exists and is not expired, false otherwise
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (entry.expiresAt > 0 && entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      this.invalidationCount++;
      return false;
    }
    
    return true;
  }
  
  /**
   * Remove an item from the cache
   * @param key Cache key
   * @returns True if the item was removed, false if it wasn't in the cache
   */
  async delete(key: string): Promise<boolean> {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    
    if (existed) {
      this.invalidationCount++;
      this.log(`Cache delete: ${key}`);
    }
    
    return existed;
  }
  
  /**
   * Remove all items from the cache
   */
  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.invalidationCount += size;
    this.log(`Cache cleared, ${size} entries removed`);
  }
  
  /**
   * Remove items by tag
   * @param tag Tag to invalidate
   * @returns Number of items removed
   */
  async invalidateByTag(tag: string): Promise<number> {
    let count = 0;
    
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.tags.has(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      this.invalidationCount += count;
      this.log(`Invalidated ${count} entries with tag: ${tag}`);
    }
    
    return count;
  }
  
  /**
   * Get cache statistics
   * @returns Current cache statistics
   */
  async getStats(): Promise<CacheStats> {
    let totalAge = 0;
    let memoryUsage = 0;
    const now = Date.now();
    
    const entries = Array.from(this.cache.values());
    for (const entry of entries) {
      totalAge += now - entry.createdAt;
      
      // Rough estimate of memory usage (in bytes)
      try {
        // Estimate the size of the value
        const valueSize = JSON.stringify(entry.value).length * 2; // Approx 2 bytes per character
        
        // Add overhead for metadata
        const metadataSize = 200; // Rough estimate for timestamps, counters, etc.
        
        // Add tag sizes
        const tagSize = Array.from(entry.tags).join(',').length * 2;
        
        memoryUsage += valueSize + metadataSize + tagSize;
      } catch (e) {
        // If we can't stringify, use a conservative estimate
        memoryUsage += 1000;
      }
    }
    
    const size = this.cache.size;
    const averageAge = size > 0 ? totalAge / size : 0;
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
    
    return {
      size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate,
      evictions: this.evictionCount,
      invalidations: this.invalidationCount,
      averageAge,
      memoryUsage
    };
  }
  
  /**
   * Clean up resources when the cache is no longer needed
   */
  destroy(): void {
    if (this.pruneIntervalId) {
      clearInterval(this.pruneIntervalId);
      this.pruneIntervalId = null;
    }
    
    this.cache.clear();
    this.log('InMemoryCacheManager destroyed');
  }
  
  /**
   * Start the interval to prune expired entries
   */
  private startPruneInterval(): void {
    this.pruneIntervalId = setInterval(() => {
      this.pruneExpiredEntries();
    }, this.config.pruneInterval);
  }
  
  /**
   * Remove expired entries from the cache
   * @returns Number of entries removed
   */
  private pruneExpiredEntries(): number {
    let count = 0;
    const now = Date.now();
    
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.expiresAt > 0 && entry.expiresAt <= now) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      this.invalidationCount += count;
      this.log(`Pruned ${count} expired entries`);
    }
    
    return count;
  }
  
  /**
   * Evict entries to make room for new ones
   * Uses a combination of LRU and priority for eviction
   */
  private evictEntries(): void {
    // We need to remove at least 1 entry, more if cache is very full
    const entriesToRemove = Math.max(1, Math.floor(this.cache.size * 0.05)); // Remove 5% of entries
    
    // Get all entries and sort by priority (lowest first) and then by last accessed (oldest first)
    const entries = Array.from(this.cache.entries()).sort((a, b) => {
      // First compare priority
      if (a[1].priority !== b[1].priority) {
        return a[1].priority - b[1].priority;
      }
      
      // Then compare last accessed time
      return a[1].lastAccessed - b[1].lastAccessed;
    });
    
    // Remove the first N entries (lowest priority, least recently used)
    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    this.evictionCount += entriesToRemove;
    this.log(`Evicted ${entriesToRemove} entries due to cache size constraints`);
  }
  
  /**
   * Log a message if logging is enabled
   * @param message Message to log
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[InMemoryCache] ${message}`);
    }
  }
  
  /**
   * Get all tags for a cache entry
   * @param key Cache key
   * @returns Set of tags or undefined if entry doesn't exist
   */
  async getTags(key: string): Promise<Set<string> | undefined> {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    return entry.tags;
  }
} 