/**
 * Enhanced Embedding Service
 * 
 * This service extends the base embedding service with caching, batch optimization,
 * and precomputation features.
 */

// Use require for lru-cache to avoid TypeScript definition issues
const LRU = require('lru-cache');
import { EmbeddingService, EmbeddingServiceOptions, EmbeddingResult } from './embedding-service';
import { IEnhancedEmbeddingService, EmbeddingCacheConfig } from './types';
import { AppError } from '../../../../lib/errors/base';

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: EmbeddingCacheConfig = {
  maxSize: 10000,
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
  enablePrecomputation: true,
  precomputationBatchSize: 100,
  minConfidenceThreshold: 0.95
};

/**
 * Cache entry type
 */
interface CacheEntry {
  embedding: number[];
  timestamp: number;
  model?: string;
  confidence: number;
}

/**
 * Enhanced embedding service implementation
 */
export class EnhancedEmbeddingService extends EmbeddingService implements IEnhancedEmbeddingService {
  private cache: any; // Use any type to avoid TypeScript issues with lru-cache
  private cacheStats = {
    hits: 0,
    misses: 0,
    totalLatency: 0,
    requestCount: 0
  };
  private precomputationQueue: Array<{
    texts: string[];
    priority: 'low' | 'normal' | 'high';
    callback?: (progress: number) => void;
  }> = [];
  private isPrecomputing = false;
  
  constructor(
    options?: EmbeddingServiceOptions & { cacheConfig?: Partial<EmbeddingCacheConfig> }
  ) {
    super(options);
    
    // Initialize cache with configuration
    const config = { ...DEFAULT_CACHE_CONFIG, ...options?.cacheConfig };
    this.cache = new LRU({
      max: config.maxSize,
      ttl: config.ttlMs,
      updateAgeOnGet: true
    });
  }
  
  /**
   * Get embedding with caching
   */
  async getEmbeddingWithCache(
    text: string,
    options?: { forceRefresh?: boolean; minConfidence?: number }
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(text);
    const minConfidence = options?.minConfidence ?? DEFAULT_CACHE_CONFIG.minConfidenceThreshold;
    
    // Check cache if not forcing refresh
    if (!options?.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.confidence >= minConfidence) {
        this.updateStats(true, Date.now() - startTime);
        return {
          embedding: cached.embedding,
          model: cached.model,
          usedFallback: false
        };
      }
    }
    
    // Generate new embedding
    const result = await super.getEmbedding(text);
    this.updateStats(false, Date.now() - startTime);
    
    // Cache result
    this.cache.set(cacheKey, {
      embedding: result.embedding,
      timestamp: Date.now(),
      model: result.model,
      confidence: this.calculateConfidence(result)
    });
    
    return result;
  }
  
  /**
   * Generate batch embeddings with optimization
   */
  async getBatchEmbeddingsOptimized(
    texts: string[],
    options?: { batchSize?: number; parallel?: boolean; useCache?: boolean }
  ): Promise<EmbeddingResult[]> {
    const batchSize = options?.batchSize ?? DEFAULT_CACHE_CONFIG.precomputationBatchSize;
    const useCache = options?.useCache ?? true;
    
    // Split texts into batches
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }
    
    // Process batches
    const results: EmbeddingResult[] = [];
    if (options?.parallel) {
      // Process batches in parallel
      const batchResults = await Promise.all(
        batches.map(batch => this.processBatch(batch, useCache))
      );
      results.push(...batchResults.flat());
    } else {
      // Process batches sequentially
      for (const batch of batches) {
        const batchResults = await this.processBatch(batch, useCache);
        results.push(...batchResults);
      }
    }
    
    return results;
  }
  
  /**
   * Precompute embeddings for a set of texts
   */
  async precomputeEmbeddings(
    texts: string[],
    options?: { priority?: 'low' | 'normal' | 'high'; callback?: (progress: number) => void }
  ): Promise<void> {
    // Add to precomputation queue
    this.precomputationQueue.push({
      texts,
      priority: options?.priority ?? 'normal',
      callback: options?.callback
    });
    
    // Sort queue by priority
    this.precomputationQueue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    // Start precomputation if not already running
    if (!this.isPrecomputing) {
      await this.processPrecomputationQueue();
    }
  }
  
  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
    averageLatency: number;
  }> {
    const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      size: this.cache.size,
      hitRate: totalRequests > 0 ? this.cacheStats.hits / totalRequests : 0,
      averageLatency: this.cacheStats.requestCount > 0
        ? this.cacheStats.totalLatency / this.cacheStats.requestCount
        : 0
    };
  }
  
  /**
   * Clear the embedding cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      totalLatency: 0,
      requestCount: 0
    };
  }
  
  /**
   * Update cache configuration
   */
  async updateCacheConfig(config: Partial<EmbeddingCacheConfig>): Promise<void> {
    // Update cache size and TTL
    if (config.maxSize !== undefined || config.ttlMs !== undefined) {
      const newCache = new LRU({
        max: config.maxSize ?? this.cache.max,
        ttl: config.ttlMs ?? this.cache.ttl,
        updateAgeOnGet: true
      });
      
      // Copy existing entries using Array.from with proper typing
      for (const [key, value] of this.cache.entries()) {
        newCache.set(key, value);
      }
      
      this.cache = newCache;
    }
    
    // Update other config values
    Object.assign(DEFAULT_CACHE_CONFIG, config);
  }
  
  /**
   * Process a batch of texts
   */
  private async processBatch(
    texts: string[],
    useCache: boolean
  ): Promise<EmbeddingResult[]> {
    if (useCache) {
      // Try to get from cache first
      const results: (EmbeddingResult | null)[] = await Promise.all(
        texts.map(text => this.getEmbeddingWithCache(text).catch(() => null))
      );
      
      // Generate embeddings for cache misses
      const missingIndices: number[] = [];
      const missingTexts: string[] = [];
      
      results.forEach((result, index) => {
        if (!result) {
          missingIndices.push(index);
          missingTexts.push(texts[index]);
        }
      });
      
      if (missingTexts.length > 0) {
        const missingResults = await super.getBatchEmbeddings(missingTexts);
        missingIndices.forEach((originalIndex, missingIndex) => {
          results[originalIndex] = missingResults[missingIndex];
        });
      }
      
      return results.filter((r): r is EmbeddingResult => r !== null);
    } else {
      // Generate all embeddings without caching
      return super.getBatchEmbeddings(texts);
    }
  }
  
  /**
   * Process the precomputation queue
   */
  private async processPrecomputationQueue(): Promise<void> {
    if (this.isPrecomputing || this.precomputationQueue.length === 0) {
      return;
    }
    
    this.isPrecomputing = true;
    
    try {
      while (this.precomputationQueue.length > 0) {
        const { texts, callback } = this.precomputationQueue.shift()!;
        const batchSize = DEFAULT_CACHE_CONFIG.precomputationBatchSize;
        
        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);
          await this.getBatchEmbeddingsOptimized(batch, { useCache: true });
          
          if (callback) {
            callback(Math.min(1, (i + batch.length) / texts.length));
          }
        }
      }
    } finally {
      this.isPrecomputing = false;
      
      // Process next item in queue if any
      if (this.precomputationQueue.length > 0) {
        await this.processPrecomputationQueue();
      }
    }
  }
  
  /**
   * Update cache statistics
   */
  private updateStats(hit: boolean, latency: number): void {
    if (hit) {
      this.cacheStats.hits++;
    } else {
      this.cacheStats.misses++;
    }
    this.cacheStats.totalLatency += latency;
    this.cacheStats.requestCount++;
  }
  
  /**
   * Calculate confidence score for an embedding
   */
  private calculateConfidence(result: EmbeddingResult): number {
    // Base confidence on whether fallback was used
    let confidence = result.usedFallback ? 0.5 : 1.0;
    
    // Adjust confidence based on model
    if (result.model) {
      // Higher confidence for newer models
      if (result.model.includes('3')) {
        confidence *= 1.2;
      } else if (result.model.includes('2')) {
        confidence *= 1.0;
      } else {
        confidence *= 0.8;
      }
    }
    
    return Math.min(1.0, confidence);
  }
  
  /**
   * Generate cache key for text
   */
  private getCacheKey(text: string): string {
    // Simple hash function for text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
} 