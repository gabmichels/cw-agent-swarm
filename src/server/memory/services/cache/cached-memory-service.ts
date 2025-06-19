/**
 * Cached Memory Service
 * A wrapper around EnhancedMemoryService that adds caching capabilities
 */

import { EnhancedMemoryService } from '../multi-agent/enhanced-memory-service';
import { CacheManager, CachePriority } from './types';
import { GetMemoryParams, AddMemoryParams, UpdateMemoryParams, DeleteMemoryParams, MemoryResult, SearchMemoryParams } from '../memory/types';
import { BaseMemorySchema, MemoryPoint } from '../../models';
import { MemoryType } from '@/server/memory/config/types';

/**
 * Configuration for cached memory service
 */
interface CachedMemoryServiceConfig {
  /**
   * Cache TTL for each memory type in milliseconds
   * Default TTL is used if not specified for a type
   */
  cacheTtl?: Partial<Record<MemoryType, number>>;
  
  /**
   * Default TTL for memory items in milliseconds
   * Default: 5 minutes (300,000ms)
   */
  defaultTtl?: number;
  
  /**
   * Whether to enable logging
   * Default: false
   */
  enableLogging?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<CachedMemoryServiceConfig> = {
  cacheTtl: {},
  defaultTtl: 5 * 60 * 1000, // 5 minutes
  enableLogging: false
};

/**
 * Memory Service with caching capabilities
 * Works with the enhanced memory service for improved query performance
 */
export class CachedMemoryService {
  private memoryService: EnhancedMemoryService;
  private cache: CacheManager;
  private config: Required<CachedMemoryServiceConfig>;
  
  /**
   * Create a new cached memory service
   * @param memoryService The underlying enhanced memory service
   * @param cache The cache manager to use
   * @param config Configuration options
   */
  constructor(
    memoryService: EnhancedMemoryService,
    cache: CacheManager,
    config?: CachedMemoryServiceConfig
  ) {
    this.memoryService = memoryService;
    this.cache = cache;
    this.config = {
      defaultTtl: 300000, // 5 minutes
      enableLogging: false,
      cacheTtl: {},
      ...config
    };
    
    this.log('CachedMemoryService initialized with EnhancedMemoryService');
  }
  
  /**
   * Get a memory item by ID and type
   * Uses cache if available, falls back to memory service
   * @param params Get memory parameters
   * @returns Memory item or null if not found
   */
  async getMemory<T extends BaseMemorySchema>(
    params: GetMemoryParams
  ): Promise<MemoryPoint<T> | null> {
    const cacheKey = this.getMemoryCacheKey(params.id, params.type);
    
    try {
      const cachedItem = await this.cache.get<MemoryPoint<T>>(cacheKey);
      if (cachedItem) {
        this.log(`Cache hit for memory: ${params.id} (${params.type})`);
        return cachedItem;
      }
    } catch (error) {
      this.log(`Error retrieving from cache: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    this.log(`Cache miss for memory: ${params.id} (${params.type})`);
    const memory = await this.memoryService.getMemory<T>(params);
    
    if (memory) {
      try {
        const ttl = this.getTtlForMemoryType(params.type);
        const priority = this.getPriorityForMemoryType(params.type);
        const tags = [
          `memory:${params.id}`,
          `type:${params.type}`,
          'memory'
        ];
        
        if (params.collection) {
          tags.push(`collection:${params.collection}`);
        }
        
        await this.cache.set(cacheKey, memory, {
          ttl,
          priority,
          tags
        });
        
        this.log(`Cached memory: ${params.id} (${params.type}) for ${ttl}ms`);
      } catch (error) {
        this.log(`Error caching memory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return memory;
  }
  
  /**
   * Add a new memory item
   * Updates cache after adding to memory service
   * @param params Add memory parameters
   * @returns Result with ID
   */
  async addMemory<T extends BaseMemorySchema>(
    params: AddMemoryParams<T>
  ): Promise<MemoryResult> {
    // Add to memory service
    const result = await this.memoryService.addMemory<T>(params);
    
    if (result.success && result.id) {
      // Get the full memory item to cache it
      const memory = await this.memoryService.getMemory<T>({
        id: result.id,
        type: params.type
      });
      
      if (memory) {
        // Store in cache
        try {
          const cacheKey = this.getMemoryCacheKey(result.id, params.type);
          const ttl = this.getTtlForMemoryType(params.type);
          const priority = this.getPriorityForMemoryType(params.type);
          
          await this.cache.set(cacheKey, memory, {
            ttl,
            priority,
            tags: [
              `memory:${result.id}`,
              `type:${params.type}`,
              'memory'
            ]
          });
          
          this.log(`Cached new memory: ${result.id} (${params.type}) for ${ttl}ms`);
        } catch (error) {
          this.log(`Error caching new memory: ${error instanceof Error ? error.message : String(error)}`);
          // Continue even if we can't cache
        }
      }
    }
    
    return result;
  }
  
  /**
   * Update a memory item
   * Invalidates cache after updating memory service
   * @param params Update memory parameters
   * @returns Success status
   */
  async updateMemory<T extends BaseMemorySchema>(
    params: UpdateMemoryParams<T>
  ): Promise<boolean> {
    const success = await this.memoryService.updateMemory<T>(params);
    
    if (success) {
      try {
        // Invalidate by memory ID and type
        const memoryTags = [
          `memory:${params.id}`,
          `type:${params.type}`,
          'memory'
        ];
        
        if (params.collection) {
          memoryTags.push(`collection:${params.collection}`);
        }
        
        // Also invalidate any related memories if specified
        if (params.relatedMemoryIds?.length) {
          memoryTags.push(...params.relatedMemoryIds.map(id => `memory:${id}`));
        }
        
        for (const tag of memoryTags) {
          await this.cache.invalidateByTag(tag);
        }
        
        this.log(`Invalidated cache for updated memory: ${params.id} (${params.type})`);
        
        // Optionally refresh the cache with updated memory
        const updatedMemory = await this.memoryService.getMemory<T>({
          id: params.id,
          type: params.type,
          collection: params.collection
        });
        
        if (updatedMemory) {
          const cacheKey = this.getMemoryCacheKey(params.id, params.type);
          const ttl = this.getTtlForMemoryType(params.type);
          const priority = this.getPriorityForMemoryType(params.type);
          
          await this.cache.set(cacheKey, updatedMemory, {
            ttl,
            priority,
            tags: memoryTags
          });
          
          this.log(`Refreshed cache for updated memory: ${params.id} (${params.type})`);
        }
      } catch (error) {
        this.log(`Error handling cache for update: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return success;
  }
  
  /**
   * Delete a memory item
   * Invalidates cache after deleting from memory service
   * @param params Delete memory parameters
   * @returns Success status
   */
  async deleteMemory(params: DeleteMemoryParams): Promise<boolean> {
    const success = await this.memoryService.deleteMemory(params);
    
    if (success) {
      try {
        // Invalidate by memory ID and type
        const memoryTags = [
          `memory:${params.id}`,
          `type:${params.type}`,
          'memory'
        ];
        
        if (params.collection) {
          memoryTags.push(`collection:${params.collection}`);
        }
        
        // Also invalidate any related memories if specified
        if (params.relatedMemoryIds?.length) {
          memoryTags.push(...params.relatedMemoryIds.map(id => `memory:${id}`));
        }
        
        for (const tag of memoryTags) {
          await this.cache.invalidateByTag(tag);
        }
        
        this.log(`Invalidated cache for deleted memory: ${params.id} (${params.type})`);
      } catch (error) {
        this.log(`Error handling cache for delete: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return success;
  }
  
  /**
   * Search for memories
   * This method does not use caching due to the dynamic nature of search queries
   * @param params Search parameters
   * @returns Array of memory items matching the search criteria
   */
  async searchMemories<T extends BaseMemorySchema>(
    params: SearchMemoryParams
  ): Promise<MemoryPoint<T>[]> {
    // For search operations, we don't cache results directly
    // Instead, we rely on individual memory caching
    const results = await this.memoryService.searchMemories<T>(params);
    
    // Cache individual memories from search results
    for (const memory of results) {
      try {
        const cacheKey = this.getMemoryCacheKey(memory.id, memory.payload.type);
        const ttl = this.getTtlForMemoryType(memory.payload.type);
        const priority = this.getPriorityForMemoryType(memory.payload.type);
        
        await this.cache.set(cacheKey, memory, {
          ttl,
          priority,
          tags: [
            `memory:${memory.id}`,
            `type:${memory.payload.type}`,
            'memory'
          ]
        });
      } catch (error) {
        this.log(`Error caching search result: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return results;
  }
  
  /**
   * Get history of memory modifications
   * @param params History parameters
   * @returns Array of memory versions
   */
  async getMemoryHistory<T extends BaseMemorySchema>(
    params: {
      id: string;
      type?: MemoryType;
      limit?: number;
    }
  ): Promise<MemoryPoint<T>[]> {
    // History queries are not cached as they're typically infrequent
    // and should reflect the latest state
    return this.memoryService.getMemoryHistory<T>(params);
  }
  
  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  async getCacheStats() {
    return this.cache.getStats();
  }
  
  /**
   * Clear the memory cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    this.log('Memory cache cleared');
  }
  
  /**
   * Get the cache key for a memory item
   * @param id Memory ID
   * @param type Memory type
   * @returns Cache key
   */
  private getMemoryCacheKey(id: string, type: MemoryType): string {
    return `memory:${type}:${id}`;
  }
  
  /**
   * Get the TTL for a memory type
   * @param type Memory type
   * @returns TTL in milliseconds
   */
  private getTtlForMemoryType(type: MemoryType): number {
    return this.config.cacheTtl[type] ?? this.config.defaultTtl;
  }
  
  /**
   * Get the cache priority for a memory type
   * @param type Memory type
   * @returns Cache priority
   */
  private getPriorityForMemoryType(type: MemoryType): CachePriority {
    // Assign higher priority to frequently accessed types
    switch (type) {
      case MemoryType.MESSAGE:
      case MemoryType.CHAT:
      case MemoryType.USER_MESSAGE:
      case MemoryType.AGENT_MESSAGE:
        return CachePriority.HIGH;
        
      case MemoryType.THOUGHT:
      case MemoryType.TASK:
      case MemoryType.DOCUMENT:
        return CachePriority.MEDIUM;
        
      default:
        return CachePriority.LOW;
    }
  }
  
  /**
   * Log a message if logging is enabled
   * @param message Message to log
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[CachedMemoryService] ${message}`);
    }
  }
} 