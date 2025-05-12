/**
 * Types for memory client
 */
import { MemoryFilter, SortOptions } from '../../config';
import { BaseMemorySchema, MemoryPoint, MemorySearchResult } from '../../models';
import { IEmbeddingService } from '../base/types';
import { EmbeddingResult } from './embedding-service';

/**
 * Memory client options for initialization
 */
export interface MemoryClientOptions {
  // Connection options
  qdrantUrl?: string;
  qdrantApiKey?: string;
  
  // Embedding options
  useOpenAI?: boolean;
  openAIApiKey?: string;
  embeddingModel?: string;
  
  // Timeout options
  connectionTimeout?: number;
  requestTimeout?: number;
  
  // Fallback options
  useInMemoryFallback?: boolean;
  logErrors?: boolean;
}

/**
 * Search query parameters
 */
export interface SearchQuery {
  // Content to search for (text to embed)
  query?: string;
  
  // Pre-computed embedding vector
  vector?: number[];
  
  // Filter parameters
  filter?: MemoryFilter;
  
  // Limit of results to return
  limit?: number;
  
  // Offset for pagination
  offset?: number;
  
  // Sorting options
  sort?: SortOptions;
  
  // Whether to include vectors in response
  includeVectors?: boolean;
  
  // Score threshold (0-1)
  scoreThreshold?: number;
}

/**
 * Options for point deletion
 */
export interface DeleteOptions {
  // Perform hard delete (true) or soft delete (false)
  hardDelete?: boolean;
  
  // Additional metadata to record with deletion
  metadata?: Record<string, any>;
}

/**
 * Client status information
 */
export interface ClientStatus {
  initialized: boolean;
  connected: boolean;
  collectionsReady: string[];
  usingFallback: boolean;
}

/**
 * Interface for memory client implementations
 */
export interface IMemoryClient {
  // Initialization
  initialize(): Promise<void>;
  isInitialized(): boolean;
  getStatus(): Promise<ClientStatus>;
  
  // Collection management
  createCollection(collectionName: string, dimensions: number): Promise<boolean>;
  collectionExists(collectionName: string): Promise<boolean>;
  
  // CRUD operations
  addPoint<T extends BaseMemorySchema>(
    collectionName: string,
    point: MemoryPoint<T>
  ): Promise<string>;
  
  getPoints<T extends BaseMemorySchema>(
    collectionName: string, 
    ids: string[]
  ): Promise<MemoryPoint<T>[]>;
  
  searchPoints<T extends BaseMemorySchema>(
    collectionName: string,
    query: SearchQuery
  ): Promise<MemorySearchResult<T>[]>;
  
  updatePoint<T extends BaseMemorySchema>(
    collectionName: string,
    id: string,
    updates: Partial<MemoryPoint<T>>
  ): Promise<boolean>;
  
  deletePoint(
    collectionName: string,
    id: string,
    options?: DeleteOptions
  ): Promise<boolean>;
  
  // Batch operations
  addPoints<T extends BaseMemorySchema>(
    collectionName: string,
    points: MemoryPoint<T>[]
  ): Promise<string[]>;
  
  // Scroll API (for pagination)
  scrollPoints<T extends BaseMemorySchema>(
    collectionName: string,
    filter?: MemoryFilter,
    limit?: number,
    offset?: number
  ): Promise<MemoryPoint<T>[]>;
  
  // Utility methods
  getPointCount(collectionName: string, filter?: MemoryFilter): Promise<number>;
}

/**
 * Embedding cache configuration
 */
export interface EmbeddingCacheConfig {
  // Maximum number of embeddings to cache
  maxSize: number;
  
  // Time-to-live for cached embeddings (in milliseconds)
  ttlMs: number;
  
  // Whether to enable precomputation
  enablePrecomputation: boolean;
  
  // Batch size for precomputation
  precomputationBatchSize: number;
  
  // Minimum confidence threshold for cache hits
  minConfidenceThreshold: number;
}

/**
 * Enhanced embedding service interface
 */
export interface IEnhancedEmbeddingService extends IEmbeddingService {
  /**
   * Get embedding with caching
   */
  getEmbeddingWithCache(text: string, options?: {
    forceRefresh?: boolean;
    minConfidence?: number;
  }): Promise<EmbeddingResult>;
  
  /**
   * Generate batch embeddings with optimization
   */
  getBatchEmbeddingsOptimized(texts: string[], options?: {
    batchSize?: number;
    parallel?: boolean;
    useCache?: boolean;
  }): Promise<EmbeddingResult[]>;
  
  /**
   * Precompute embeddings for a set of texts
   */
  precomputeEmbeddings(texts: string[], options?: {
    priority?: 'low' | 'normal' | 'high';
    callback?: (progress: number) => void;
  }): Promise<void>;
  
  /**
   * Get cache statistics
   */
  getCacheStats(): Promise<{
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
    averageLatency: number;
  }>;
  
  /**
   * Clear the embedding cache
   */
  clearCache(): Promise<void>;
  
  /**
   * Update cache configuration
   */
  updateCacheConfig(config: Partial<EmbeddingCacheConfig>): Promise<void>;
}

/**
 * Operation queue priority levels
 */
export type OperationPriority = 'low' | 'normal' | 'high';

/**
 * Operation queue item
 */
export interface OperationQueueItem<T = any> {
  id: string;
  payload: T;
  priority: OperationPriority;
  enqueuedAt: number;
  execute: () => Promise<any>;
}

/**
 * Operation queue statistics
 */
export interface OperationQueueStats {
  size: number;
  processing: number;
  completed: number;
  failed: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  rateLimit: number;
}

/**
 * Operation queue configuration
 */
export interface OperationQueueConfig {
  maxConcurrent: number;
  rateLimit: number; // operations per second
  batchSize: number;
  healthCheckIntervalMs: number;
}

/**
 * Operation queue interface
 */
export interface IOperationQueue<T = any> {
  enqueue(item: OperationQueueItem<T>): Promise<void>;
  dequeue(): Promise<OperationQueueItem<T> | undefined>;
  processNext(): Promise<void>;
  processBatch(): Promise<void>;
  getStats(): OperationQueueStats;
  updateConfig(config: Partial<OperationQueueConfig>): void;
  clear(): void;
  on(event: 'completed' | 'failed' | 'health', callback: (data: any) => void): void;
} 