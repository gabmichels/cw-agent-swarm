/**
 * Unit tests for CacheManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheManager } from '../../services/cache/cache-manager';
import { MemoryType } from '../../config/types';
import { BaseMemorySchema } from '../../models';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockTimestamp: number;
  const baseMemory = {
    id: 'test-id',
    text: 'test content',
    type: MemoryType.MESSAGE,
    timestamp: '1625097600000',
    metadata: { schemaVersion: '1.0.0' }
  };

  beforeEach(() => {
    // Reset timers and mock Date.now
    vi.useFakeTimers();
    mockTimestamp = 1625097600000; // Fixed timestamp for testing
    vi.setSystemTime(mockTimestamp);

    cacheManager = new CacheManager({
      maxSize: 1000,
      ttl: 3600000, // 1 hour in milliseconds
      getTimestamp: () => Date.now()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Cache Operations', () => {
    it('should set and get cache item', async () => {
      const key = 'test-key';
      const value = { ...baseMemory };

      // Set cache item
      await cacheManager.set(key, value);

      // Get cache item
      const result = await cacheManager.get(key);

      // Assertions
      expect(result).toBeDefined();
      expect(result?.id).toBe(value.id);
      expect(result?.text).toBe(value.text);
      expect(result?.type).toBe(value.type);
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheManager.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should delete cache item', async () => {
      const key = 'delete-test-key';
      const value = { ...baseMemory };

      // Set and then delete
      await cacheManager.set(key, value);
      await cacheManager.delete(key);

      // Verify deletion
      const result = await cacheManager.get(key);
      expect(result).toBeNull();
    });
  });

  describe('TTL Handling', () => {
    it('should expire items after TTL', async () => {
      const key = 'ttl-test-key';
      const value = { ...baseMemory };

      // Set item with short TTL
      await cacheManager.set(key, value, { ttl: 1000 });

      // Fast forward time
      vi.advanceTimersByTime(2000);

      // Verify expiration
      const result = await cacheManager.get(key);
      expect(result).toBeNull();
    });

    it('should respect custom TTL per item', async () => {
      const key1 = 'ttl-custom-1';
      const key2 = 'ttl-custom-2';
      const value = { ...baseMemory };

      // Set items with different TTLs
      await cacheManager.set(key1, value, { ttl: 1000 });
      await cacheManager.set(key2, value, { ttl: 3000 });

      // Fast forward time
      vi.advanceTimersByTime(2000);

      // Verify first item expired but second hasn't
      expect(await cacheManager.get(key1)).toBeNull();
      expect(await cacheManager.get(key2)).toBeDefined();
    });
  });

  describe('Eviction Policies', () => {
    it('should evict least recently used items when cache is full', async () => {
      // Create cache with small size
      const smallCache = new CacheManager({
        maxSize: 2,
        ttl: 3600000,
        getTimestamp: () => Date.now()
      });

      // Fill cache
      vi.advanceTimersByTime(1); // Ensure unique timestamp
      await smallCache.set('key1', { ...baseMemory, id: '1', text: 'content1' });
      vi.advanceTimersByTime(1); // Ensure unique timestamp
      await smallCache.set('key2', { ...baseMemory, id: '2', text: 'content2' });
      vi.advanceTimersByTime(1); // Ensure unique timestamp
      // Access key1 to make it more recently used
      await smallCache.get('key1');
      vi.advanceTimersByTime(1); // Ensure unique timestamp
      // Add new item which should evict key2
      await smallCache.set('key3', { ...baseMemory, id: '3', text: 'content3' });
      vi.advanceTimersByTime(1); // Ensure unique timestamp for assertions

      // Verify key2 was evicted
      expect(await smallCache.get('key2')).toBeNull();
      expect(await smallCache.get('key1')).toBeDefined();
      expect(await smallCache.get('key3')).toBeDefined();
    });

    it('should evict expired items during cleanup', async () => {
      const key1 = 'expired-key';
      const key2 = 'valid-key';
      const value = { ...baseMemory };

      // Set items with different TTLs
      await cacheManager.set(key1, value, { ttl: 1000 });
      await cacheManager.set(key2, value, { ttl: 3600000 });

      // Fast forward time
      vi.advanceTimersByTime(2000);

      // Trigger cleanup
      await cacheManager.cleanup();

      // Verify expired item was removed
      expect(await cacheManager.get(key1)).toBeNull();
      expect(await cacheManager.get(key2)).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should track cache size', async () => {
      const key = 'size-test-key';
      const value = { ...baseMemory };

      // Get initial size
      const initialSize = await cacheManager.getSize();

      // Add item
      await cacheManager.set(key, value);

      // Verify size increased
      const newSize = await cacheManager.getSize();
      expect(newSize).toBeGreaterThan(initialSize);
    });

    it('should clear all items', async () => {
      // Add some items
      await cacheManager.set('key1', { ...baseMemory, id: '1', text: 'content1' });
      await cacheManager.set('key2', { ...baseMemory, id: '2', text: 'content2' });

      // Clear cache
      await cacheManager.clear();

      // Verify all items removed
      expect(await cacheManager.get('key1')).toBeNull();
      expect(await cacheManager.get('key2')).toBeNull();
      expect(await cacheManager.getSize()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid keys', async () => {
      await expect(cacheManager.set('', { ...baseMemory })).rejects.toThrow();
      await expect(cacheManager.get('')).rejects.toThrow();
    });

    it('should handle invalid values', async () => {
      await expect(cacheManager.set('key', null as unknown as BaseMemorySchema)).rejects.toThrow();
      await expect(cacheManager.set('key', undefined as unknown as BaseMemorySchema)).rejects.toThrow();
    });

    it('should handle storage errors', async () => {
      // Mock storage error
      vi.spyOn(cacheManager['storage'], 'set').mockRejectedValueOnce(new Error('Storage error'));

      // Verify error is handled
      await expect(cacheManager.set('key', { ...baseMemory, id: 'test', text: 'test' }))
        .rejects.toThrow('Storage error');
    });
  });
}); 