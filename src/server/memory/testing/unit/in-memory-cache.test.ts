/**
 * Unit tests for InMemoryCacheManager
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryCacheManager, CachePriority } from '../../services/cache';

describe('InMemoryCacheManager', () => {
  let cache: InMemoryCacheManager;

  beforeEach(() => {
    // Create a new cache instance before each test
    cache = new InMemoryCacheManager({
      maxSize: 100,
      defaultTtl: 1000, // 1 second for faster testing
      enableLogging: false
    });
  });

  afterEach(() => {
    // Clean up after each test
    cache.destroy();
  });

  test('should store and retrieve values', async () => {
    // Store a value
    await cache.set('test-key', { name: 'Test' });
    
    // Retrieve the value
    const value = await cache.get('test-key');
    
    // Verify the value was retrieved
    expect(value).toEqual({ name: 'Test' });
  });

  test('should report if key exists', async () => {
    // Initially the key doesn't exist
    expect(await cache.has('test-key')).toBe(false);
    
    // Store a value
    await cache.set('test-key', { name: 'Test' });
    
    // Now the key should exist
    expect(await cache.has('test-key')).toBe(true);
  });

  test('should delete values', async () => {
    // Store a value
    await cache.set('test-key', { name: 'Test' });
    
    // Verify it exists
    expect(await cache.has('test-key')).toBe(true);
    
    // Delete the value
    const result = await cache.delete('test-key');
    
    // Verify it was deleted
    expect(result).toBe(true);
    expect(await cache.has('test-key')).toBe(false);
  });

  test('should clear all values', async () => {
    // Store multiple values
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');
    
    // Verify they exist
    expect(await cache.has('key1')).toBe(true);
    expect(await cache.has('key2')).toBe(true);
    
    // Clear the cache
    await cache.clear();
    
    // Verify all values are gone
    expect(await cache.has('key1')).toBe(false);
    expect(await cache.has('key2')).toBe(false);
  });

  test('should respect TTL for cache entries', async () => {
    // Store a value with a short TTL
    await cache.set('test-key', { name: 'Test' }, { ttl: 50 }); // 50ms TTL
    
    // Immediately the value should exist
    expect(await cache.has('test-key')).toBe(true);
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Now the value should be gone
    expect(await cache.has('test-key')).toBe(false);
  });

  test('should invalidate by tag', async () => {
    // Store values with different tags
    await cache.set('key1', 'value1', { tags: ['tag1', 'common'] });
    await cache.set('key2', 'value2', { tags: ['tag2', 'common'] });
    
    // Verify both exist
    expect(await cache.has('key1')).toBe(true);
    expect(await cache.has('key2')).toBe(true);
    
    // Invalidate by tag1
    const count = await cache.invalidateByTag('tag1');
    
    // Verify only key1 was removed
    expect(count).toBe(1);
    expect(await cache.has('key1')).toBe(false);
    expect(await cache.has('key2')).toBe(true);
    
    // Invalidate by common tag
    const count2 = await cache.invalidateByTag('common');
    
    // Verify key2 was also removed
    expect(count2).toBe(1);
    expect(await cache.has('key2')).toBe(false);
  });

  test('should provide accurate cache statistics', async () => {
    // Get initial stats
    const initialStats = await cache.getStats();
    expect(initialStats.size).toBe(0);
    expect(initialStats.hits).toBe(0);
    expect(initialStats.misses).toBe(0);
    
    // Add some items
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');
    
    // Get stats after adding
    const statsAfterAdd = await cache.getStats();
    expect(statsAfterAdd.size).toBe(2);
    
    // Perform a hit
    await cache.get('key1');
    
    // Perform a miss
    await cache.get('non-existent');
    
    // Get stats after operations
    const statsAfterOps = await cache.getStats();
    expect(statsAfterOps.hits).toBe(1);
    expect(statsAfterOps.misses).toBe(1);
    expect(statsAfterOps.hitRate).toBeCloseTo(0.5, 2); // 1 hit out of 2 attempts
  });

  test('should evict entries when size limit is reached', async () => {
    // Create a cache with small size limit
    const smallCache = new InMemoryCacheManager({
      maxSize: 3,
      defaultTtl: 1000
    });
    
    try {
      // Add entries with different priorities
      await smallCache.set('low', 'low-value', { priority: CachePriority.LOW });
      await smallCache.set('medium', 'medium-value', { priority: CachePriority.MEDIUM });
      await smallCache.set('high', 'high-value', { priority: CachePriority.HIGH });
      
      // Add one more to trigger eviction
      await smallCache.set('critical', 'critical-value', { priority: CachePriority.CRITICAL });
      
      // Check which one was evicted (should be low priority)
      expect(await smallCache.has('low')).toBe(false);
      expect(await smallCache.has('medium')).toBe(true);
      expect(await smallCache.has('high')).toBe(true);
      expect(await smallCache.has('critical')).toBe(true);
      
      // Get stats to check evictions
      const stats = await smallCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    } finally {
      smallCache.destroy();
    }
  });

  test('should prune expired entries', async () => {
    // Mock Date.now
    const originalNow = Date.now;
    const mockNow = vi.fn();
    let now = originalNow();
    mockNow.mockImplementation(() => now);
    global.Date.now = mockNow;
    
    try {
      // Create a cache with manual pruning
      const pruneCache = new InMemoryCacheManager({
        maxSize: 10,
        defaultTtl: 100,
        autoPrune: false
      });
      
      // Add entries
      await pruneCache.set('key1', 'value1');
      await pruneCache.set('key2', 'value2');
      
      // Advance time
      now += 200; // Advance 200ms
      
      // Both entries should be considered expired now, but still in cache
      expect(await pruneCache.has('key1')).toBe(false); // has() checks expiration
      expect(await pruneCache.has('key2')).toBe(false);
      
      // Get stats - should still show 0 size because the has() calls removed the expired items
      const stats = await pruneCache.getStats();
      expect(stats.size).toBe(0);
      
      // Clean up
      pruneCache.destroy();
    } finally {
      // Restore original Date.now
      global.Date.now = originalNow;
    }
  });
}); 