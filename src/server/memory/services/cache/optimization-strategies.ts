/**
 * Cache optimization strategies
 */
import { CacheManager, CacheEntryOptions, CachePriority, CacheStats } from './types';

/**
 * Configuration for adaptive TTL strategy
 */
export interface AdaptiveTtlConfig {
  /**
   * Base TTL in milliseconds
   */
  baseTtl: number;
  
  /**
   * Maximum TTL in milliseconds
   */
  maxTtl: number;
  
  /**
   * Minimum TTL in milliseconds
   */
  minTtl: number;
  
  /**
   * Hit rate threshold to increase TTL
   */
  hitRateThreshold: number;
  
  /**
   * TTL adjustment factor (0-1)
   */
  adjustmentFactor: number;
}

/**
 * Default adaptive TTL configuration
 */
const DEFAULT_ADAPTIVE_TTL_CONFIG: AdaptiveTtlConfig = {
  baseTtl: 5 * 60 * 1000, // 5 minutes
  maxTtl: 30 * 60 * 1000, // 30 minutes
  minTtl: 1 * 60 * 1000, // 1 minute
  hitRateThreshold: 0.7, // 70% hit rate
  adjustmentFactor: 0.2 // 20% adjustment
};

/**
 * Adaptive TTL strategy
 * Adjusts TTL based on cache hit rates and access patterns
 */
export class AdaptiveTtlStrategy {
  private cache: CacheManager;
  private config: AdaptiveTtlConfig;
  private lastStats: CacheStats | null = null;
  private adjustmentInterval: NodeJS.Timeout | null = null;
  
  constructor(cache: CacheManager, config?: Partial<AdaptiveTtlConfig>) {
    this.cache = cache;
    this.config = { ...DEFAULT_ADAPTIVE_TTL_CONFIG, ...config };
  }
  
  /**
   * Start the adaptive TTL adjustment process
   * @param interval Interval in milliseconds to check and adjust TTLs
   */
  start(interval: number = 5 * 60 * 1000): void {
    if (this.adjustmentInterval) {
      clearInterval(this.adjustmentInterval);
    }
    
    this.adjustmentInterval = setInterval(() => {
      this.adjustTtls();
    }, interval);
  }
  
  /**
   * Stop the adaptive TTL adjustment process
   */
  stop(): void {
    if (this.adjustmentInterval) {
      clearInterval(this.adjustmentInterval);
      this.adjustmentInterval = null;
    }
  }
  
  /**
   * Adjust TTLs based on cache performance
   */
  private async adjustTtls(): Promise<void> {
    const currentStats = await this.cache.getStats();
    
    if (!this.lastStats) {
      this.lastStats = currentStats;
      return;
    }
    
    // Calculate hit rate change
    const hitRateChange = currentStats.hitRate - this.lastStats.hitRate;
    
    // Adjust TTL based on hit rate
    if (currentStats.hitRate >= this.config.hitRateThreshold) {
      // Increase TTL if hit rate is good
      const newTtl = Math.min(
        this.config.maxTtl,
        this.config.baseTtl * (1 + this.config.adjustmentFactor)
      );
      this.config.baseTtl = newTtl;
    } else if (hitRateChange < 0) {
      // Decrease TTL if hit rate is declining
      const newTtl = Math.max(
        this.config.minTtl,
        this.config.baseTtl * (1 - this.config.adjustmentFactor)
      );
      this.config.baseTtl = newTtl;
    }
    
    this.lastStats = currentStats;
  }
  
  /**
   * Get the current adaptive TTL for a cache entry
   * @param key Cache key
   * @param baseOptions Base cache entry options
   * @returns Adjusted cache entry options
   */
  async getAdaptiveTtl(key: string, baseOptions?: CacheEntryOptions): Promise<CacheEntryOptions> {
    const stats = await this.cache.getStats();
    const tags = await this.cache.getTags(key);
    
    // Calculate priority-based TTL adjustment
    let ttlMultiplier = 1.0;
    if (baseOptions?.priority === CachePriority.HIGH) {
      ttlMultiplier = 1.5;
    } else if (baseOptions?.priority === CachePriority.LOW) {
      ttlMultiplier = 0.75;
    }
    
    // Calculate tag-based TTL adjustment
    if (tags?.has('frequent_access')) {
      ttlMultiplier *= 1.2;
    }
    
    // Calculate hit rate-based TTL adjustment
    if (stats.hitRate >= this.config.hitRateThreshold) {
      ttlMultiplier *= 1.1;
    }
    
    const adjustedTtl = Math.min(
      this.config.maxTtl,
      Math.max(
        this.config.minTtl,
        Math.round(this.config.baseTtl * ttlMultiplier)
      )
    );
    
    return {
      ...baseOptions,
      ttl: adjustedTtl
    };
  }
}

/**
 * Priority-based eviction strategy
 * Manages cache eviction based on item priority and access patterns
 */
export class PriorityEvictionStrategy {
  private cache: CacheManager;
  private maxSize: number;
  private evictionThreshold: number;
  
  constructor(cache: CacheManager, maxSize: number = 5000, evictionThreshold: number = 0.9) {
    this.cache = cache;
    this.maxSize = maxSize;
    this.evictionThreshold = evictionThreshold;
  }
  
  /**
   * Check if eviction is needed and perform if necessary
   */
  async checkAndEvict(): Promise<number> {
    const stats = await this.cache.getStats();
    
    if (stats.size >= this.maxSize * this.evictionThreshold) {
      return this.evict();
    }
    
    return 0;
  }
  
  /**
   * Perform eviction based on priority and access patterns
   * @returns Number of items evicted
   */
  private async evict(): Promise<number> {
    const stats = await this.cache.getStats();
    const entriesToRemove = Math.max(1, Math.floor(stats.size * 0.1)); // Remove 10% of entries
    
    // Get all entries and sort by priority and access patterns
    const entries = await this.getSortedEntries();
    
    // Remove the lowest priority entries
    let removed = 0;
    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      const [key] = entries[i];
      await this.cache.delete(key);
      removed++;
    }
    
    return removed;
  }
  
  /**
   * Get cache entries sorted by priority and access patterns
   */
  private async getSortedEntries(): Promise<[string, any][]> {
    // This is a placeholder - in a real implementation, we would need to
    // extend the CacheManager interface to expose entry metadata
    // For now, we'll rely on the built-in eviction in InMemoryCacheManager
    return [];
  }
} 