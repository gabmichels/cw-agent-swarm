/**
 * Dummy Cache Manager
 * 
 * A no-op implementation of the CacheManager interface for use when caching is not needed.
 */

import { CacheManager, CacheEntryOptions, CacheStats } from './types';

/**
 * A dummy implementation of CacheManager that performs no actual caching.
 * Useful for testing or when caching needs to be disabled.
 */
export class DummyCacheManager implements CacheManager {
  /**
   * Get a value from the cache (always returns undefined)
   */
  async get<T>(key: string): Promise<T | undefined> {
    return undefined;
  }

  /**
   * Set a value in the cache (no-op)
   */
  async set<T>(key: string, value: T, options?: CacheEntryOptions): Promise<void> {
    // No-op
  }

  /**
   * Delete a value from the cache (no-op)
   */
  async delete(key: string): Promise<boolean> {
    return true; // Pretend it succeeded
  }

  /**
   * Clear the entire cache (no-op)
   */
  async clear(): Promise<void> {
    // No-op
  }

  /**
   * Check if a key exists in the cache (always returns false)
   */
  async has(key: string): Promise<boolean> {
    return false;
  }

  /**
   * Invalidate all entries with the given tag (no-op)
   */
  async invalidateByTag(tag: string): Promise<number> {
    return 0; // No keys invalidated
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    return {
      size: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
      invalidations: 0,
      averageAge: 0,
      memoryUsage: 0
    };
  }

  /**
   * Get tags for a given key (always returns empty set)
   */
  async getTags(key: string): Promise<Set<string>> {
    return new Set();
  }
} 