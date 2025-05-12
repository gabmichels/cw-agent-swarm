/**
 * Enhanced Embedding Service Tests
 */

import { describe, it, expect, beforeEach, vi, MockInstance } from 'vitest';
import { EnhancedEmbeddingService } from './enhanced-embedding-service';
import { EmbeddingService } from './embedding-service';
import { EmbeddingResult } from './embedding-service';

describe('EnhancedEmbeddingService', () => {
  let service: EnhancedEmbeddingService;
  let mockGetEmbedding: MockInstance<[string], Promise<EmbeddingResult>>;
  let mockGetBatchEmbeddings: MockInstance<[string[]], Promise<EmbeddingResult[]>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEmbedding = vi.spyOn(EmbeddingService.prototype, 'getEmbedding').mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
      model: 'text-embedding-3-small',
      usedFallback: false
    });
    mockGetBatchEmbeddings = vi.spyOn(EmbeddingService.prototype, 'getBatchEmbeddings').mockImplementation(async (texts: string[]) =>
      texts.map(() => ({
        embedding: [0.1, 0.2, 0.3],
        model: 'text-embedding-3-small',
        usedFallback: false
      }))
    );
    service = new EnhancedEmbeddingService({
      cacheConfig: {
        maxSize: 100,
        ttlMs: 1000,
        enablePrecomputation: true,
        precomputationBatchSize: 2,
        minConfidenceThreshold: 0.9
      }
    });
  });
  
  describe('caching', () => {
    it('should cache embeddings', async () => {
      const text = 'test text';
      
      // First call should use base service
      const result1 = await service.getEmbeddingWithCache(text);
      expect(mockGetEmbedding).toHaveBeenCalledTimes(1);
      expect(result1.embedding).toEqual([0.1, 0.2, 0.3]);
      
      // Second call should use cache
      const result2 = await service.getEmbeddingWithCache(text);
      expect(mockGetEmbedding).toHaveBeenCalledTimes(1);
      expect(result2.embedding).toEqual([0.1, 0.2, 0.3]);
      
      // Verify cache stats
      const stats = await service.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
    });
    
    it('should respect force refresh option', async () => {
      const text = 'test text';
      
      // First call
      await service.getEmbeddingWithCache(text);
      expect(mockGetEmbedding).toHaveBeenCalledTimes(1);
      
      // Second call with force refresh
      await service.getEmbeddingWithCache(text, { forceRefresh: true });
      expect(mockGetEmbedding).toHaveBeenCalledTimes(2);
    });
    
    it('should clear cache', async () => {
      const text = 'test text';
      
      // Add to cache
      await service.getEmbeddingWithCache(text);
      expect((await service.getCacheStats()).size).toBe(1);
      
      // Clear cache
      await service.clearCache();
      expect((await service.getCacheStats()).size).toBe(0);
      
      // Verify cache is empty
      await service.getEmbeddingWithCache(text);
      expect(mockGetEmbedding).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('batch operations', () => {
    it('should process batch embeddings with caching', async () => {
      const texts = ['text1', 'text2', 'text3', 'text4'];
      
      // First batch call
      const results1 = await service.getBatchEmbeddingsOptimized(texts, {
        batchSize: 2,
        useCache: true
      });
      expect(mockGetEmbedding).toHaveBeenCalledTimes(4);
      expect(mockGetBatchEmbeddings).toHaveBeenCalledTimes(0);
      expect(results1).toHaveLength(4);
      
      // Second batch call should use cache
      const results2 = await service.getBatchEmbeddingsOptimized(texts, {
        batchSize: 2,
        useCache: true
      });
      expect(mockGetEmbedding).toHaveBeenCalledTimes(4);
      expect(mockGetBatchEmbeddings).toHaveBeenCalledTimes(0);
      expect(results2).toHaveLength(4);
    });
    
    it('should process batch embeddings in parallel', async () => {
      const texts = ['text1', 'text2', 'text3', 'text4'];
      
      // Mock base service to simulate delay
      const mockGetBatchEmbeddings = vi.fn().mockImplementation(async (batch: string[]) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return batch.map(() => ({
          embedding: [0.1, 0.2, 0.3],
          model: 'text-embedding-3-small',
          usedFallback: false
        }));
      });
      
      // Replace the mock implementation
      (EmbeddingService.prototype as any).getBatchEmbeddings = mockGetBatchEmbeddings;
      
      const startTime = Date.now();
      await service.getBatchEmbeddingsOptimized(texts, {
        batchSize: 2,
        parallel: true,
        useCache: false
      });
      const duration = Date.now() - startTime;
      
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(150); // 2 batches * 50ms + overhead
    });
  });
  
  describe('precomputation', () => {
    it('should precompute embeddings with priority', async () => {
      const texts1 = ['text1', 'text2'];
      const texts2 = ['text3', 'text4'];
      const texts3 = ['text5', 'text6'];
      
      // Start precomputation with different priorities
      const precomputePromises = [
        service.precomputeEmbeddings(texts1, { priority: 'low' }),
        service.precomputeEmbeddings(texts2, { priority: 'high' }),
        service.precomputeEmbeddings(texts3, { priority: 'normal' })
      ];
      
      // Wait for all precomputation to complete
      await Promise.all(precomputePromises);
      
      // Verify all texts were processed
      const stats = await service.getCacheStats();
      expect(stats.size).toBe(6);
    });
    
    it('should report precomputation progress', async () => {
      const texts = ['text1', 'text2', 'text3', 'text4'];
      const progressUpdates: number[] = [];
      
      await service.precomputeEmbeddings(texts, {
        callback: (progress) => progressUpdates.push(progress)
      });
      
      // Verify progress updates
      expect(progressUpdates).toHaveLength(1); // Only 1 batch or callback at end
      expect(progressUpdates[0]).toBe(1);
    });
  });
  
  describe('cache configuration', () => {
    it('should update cache configuration', async () => {
      // Initial config
      expect((await service.getCacheStats()).size).toBe(0);
      
      // Add some entries
      await service.getEmbeddingWithCache('text1');
      await service.getEmbeddingWithCache('text2');
      expect((await service.getCacheStats()).size).toBe(2);
      
      // Update config with smaller size
      await service.updateCacheConfig({ maxSize: 1 });
      
      // Verify cache was resized
      const stats = await service.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(1);
    });
    
    it('should respect TTL configuration', async () => {
      // Set short TTL
      await service.updateCacheConfig({ ttlMs: 100 });
      
      // Add to cache
      await service.getEmbeddingWithCache('text1');
      expect((await service.getCacheStats()).size).toBe(1);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify cache entry expired
      await service.getEmbeddingWithCache('text1');
      expect(mockGetEmbedding).toHaveBeenCalledTimes(2);
    });
  });
}); 