/**
 * CachingOpportunityRegistry.ts
 * 
 * Implements a caching layer for the OpportunityRegistry interface.
 * This wraps another registry implementation and adds caching for improved performance.
 */

import { 
  Opportunity, 
  OpportunityCreationOptions,
  OpportunityFilter,
  OpportunityOrderOptions,
  OpportunityStatus
} from '../models/opportunity.model';
import { OpportunityRegistry } from '../interfaces/OpportunityRegistry.interface';
import { OpportunityRegistryError } from '../errors/OpportunityError';

/**
 * Configuration for the caching registry
 */
export interface CachingRegistryConfig {
  /** Maximum number of opportunities to cache */
  maxCacheSize?: number;
  
  /** Cache time-to-live in milliseconds */
  cacheTtlMs?: number;
  
  /** Whether to cache filtered results */
  cacheFilteredResults?: boolean;
  
  /** Maximum number of filtered result sets to cache */
  maxFilterCacheSize?: number;
}

/**
 * Cache key generator for filter queries
 */
function generateFilterCacheKey(
  filter?: OpportunityFilter,
  orderBy?: OpportunityOrderOptions,
  limit?: number,
  offset?: number
): string {
  return JSON.stringify({
    filter: filter || {},
    orderBy: orderBy || {},
    limit: limit || null,
    offset: offset || 0
  });
}

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  expiry: number; // Timestamp when the entry expires
}

/**
 * Implements a caching layer for any OpportunityRegistry
 */
export class CachingOpportunityRegistry implements OpportunityRegistry {
  private initialized: boolean = false;
  private cache: Map<string, CacheEntry<Opportunity>> = new Map();
  private filterCache: Map<string, CacheEntry<Opportunity[]>> = new Map();
  private lastHealthCheck: Date = new Date();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private filterCacheHits: number = 0;
  private filterCacheMisses: number = 0;
  
  // Default configuration
  private config: Required<CachingRegistryConfig> = {
    maxCacheSize: 1000,
    cacheTtlMs: 5 * 60 * 1000, // 5 minutes
    cacheFilteredResults: true,
    maxFilterCacheSize: 100
  };
  
  /**
   * Create a new caching registry
   * @param baseRegistry The underlying registry to wrap
   * @param config Configuration for the cache
   */
  constructor(
    private readonly baseRegistry: OpportunityRegistry,
    config?: Partial<CachingRegistryConfig>
  ) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }
  
  /**
   * Initialize the registry
   */
  async initialize(): Promise<boolean> {
    try {
      await this.baseRegistry.initialize();
      this.initialized = true;
      this.lastHealthCheck = new Date();
      return true;
    } catch (error) {
      throw new OpportunityRegistryError(
        `Failed to initialize caching registry: ${error instanceof Error ? error.message : String(error)}`,
        'INITIALIZATION_FAILED'
      );
    }
  }
  
  /**
   * Ensure the registry is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new OpportunityRegistryError(
        'Caching registry not initialized',
        'REGISTRY_NOT_INITIALIZED'
      );
    }
  }
  
  /**
   * Add an item to the cache
   */
  private cacheItem(id: string, item: Opportunity): void {
    // Remove least recently used item if at capacity
    if (this.cache.size >= this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    // Add to cache with expiry
    this.cache.set(id, {
      data: item,
      expiry: Date.now() + this.config.cacheTtlMs
    });
  }
  
  /**
   * Add filtered results to the cache
   */
  private cacheFilteredResults(
    key: string,
    results: Opportunity[]
  ): void {
    if (!this.config.cacheFilteredResults) {
      return;
    }
    
    // Remove least recently used item if at capacity
    if (this.filterCache.size >= this.config.maxFilterCacheSize) {
      const oldestKey = this.filterCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.filterCache.delete(oldestKey);
      }
    }
    
    // Add to cache with expiry
    this.filterCache.set(key, {
      data: [...results], // Create a copy
      expiry: Date.now() + this.config.cacheTtlMs
    });
  }
  
  /**
   * Get an item from the cache if it exists and is not expired
   */
  private getCachedItem(id: string): Opportunity | null {
    const entry = this.cache.get(id);
    
    if (!entry) {
      this.cacheMisses++;
      return null;
    }
    
    // Check if the entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(id);
      this.cacheMisses++;
      return null;
    }
    
    this.cacheHits++;
    return entry.data;
  }
  
  /**
   * Get filtered results from cache if they exist and are not expired
   */
  private getCachedFilteredResults(key: string): Opportunity[] | null {
    if (!this.config.cacheFilteredResults) {
      return null;
    }
    
    const entry = this.filterCache.get(key);
    
    if (!entry) {
      this.filterCacheMisses++;
      return null;
    }
    
    // Check if the entry has expired
    if (Date.now() > entry.expiry) {
      this.filterCache.delete(key);
      this.filterCacheMisses++;
      return null;
    }
    
    this.filterCacheHits++;
    return [...entry.data]; // Return a copy
  }
  
  /**
   * Invalidate an item in the cache
   */
  private invalidateCache(id: string): void {
    this.cache.delete(id);
    
    // Also invalidate filter cache since results could change
    if (this.config.cacheFilteredResults) {
      this.filterCache.clear();
    }
  }
  
  /**
   * Store a new opportunity
   */
  async createOpportunity(opportunityData: OpportunityCreationOptions): Promise<Opportunity> {
    this.ensureInitialized();
    
    const opportunity = await this.baseRegistry.createOpportunity(opportunityData);
    
    // Add to cache
    this.cacheItem(opportunity.id, opportunity);
    
    // Invalidate filter cache since results could change
    if (this.config.cacheFilteredResults) {
      this.filterCache.clear();
    }
    
    return opportunity;
  }
  
  /**
   * Get an opportunity by ID
   */
  async getOpportunityById(id: string): Promise<Opportunity | null> {
    this.ensureInitialized();
    
    // Check cache first
    const cached = this.getCachedItem(id);
    if (cached) {
      return cached;
    }
    
    // Not in cache, get from base registry
    const opportunity = await this.baseRegistry.getOpportunityById(id);
    
    // If found, add to cache
    if (opportunity && opportunity.id) {
      this.cacheItem(opportunity.id, opportunity);
    }
    
    return opportunity;
  }
  
  /**
   * Update an existing opportunity
   */
  async updateOpportunity(id: string, updates: Partial<Opportunity>): Promise<Opportunity | null> {
    this.ensureInitialized();
    
    const updated = await this.baseRegistry.updateOpportunity(id, updates);
    
    // Update cache
    if (updated && updated.id) {
      this.cacheItem(updated.id, updated);
    } else if (id) {
      this.invalidateCache(id);
    }
    
    // Invalidate filter cache since results could change
    if (this.config.cacheFilteredResults) {
      this.filterCache.clear();
    }
    
    return updated;
  }
  
  /**
   * Update the status of an opportunity
   */
  async updateOpportunityStatus(
    id: string,
    status: OpportunityStatus,
    result?: Record<string, unknown>
  ): Promise<Opportunity | null> {
    this.ensureInitialized();
    
    const updated = await this.baseRegistry.updateOpportunityStatus(id, status, result);
    
    // Update cache
    if (updated && updated.id) {
      this.cacheItem(updated.id, updated);
    } else if (id) {
      this.invalidateCache(id);
    }
    
    // Invalidate filter cache since results could change
    if (this.config.cacheFilteredResults) {
      this.filterCache.clear();
    }
    
    return updated;
  }
  
  /**
   * Delete an opportunity
   */
  async deleteOpportunity(id: string): Promise<boolean> {
    this.ensureInitialized();
    
    const deleted = await this.baseRegistry.deleteOpportunity(id);
    
    // Update cache
    if (deleted && id) {
      this.invalidateCache(id);
    }
    
    return deleted;
  }
  
  /**
   * Find opportunities matching a filter
   */
  async findOpportunities(
    filter?: OpportunityFilter,
    orderBy?: OpportunityOrderOptions,
    limit?: number,
    offset?: number
  ): Promise<Opportunity[]> {
    this.ensureInitialized();
    
    if (this.config.cacheFilteredResults) {
      // Generate cache key
      const cacheKey = generateFilterCacheKey(filter, orderBy, limit, offset);
      
      // Check cache
      const cached = this.getCachedFilteredResults(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Not in cache, get from base registry
      const results = await this.baseRegistry.findOpportunities(filter, orderBy, limit, offset);
      
      // Cache results
      this.cacheFilteredResults(cacheKey, results);
      
      return results;
    }
    
    // Not using filter cache
    return this.baseRegistry.findOpportunities(filter, orderBy, limit, offset);
  }
  
  /**
   * Find opportunities for a specific agent
   */
  async findOpportunitiesForAgent(
    agentId: string,
    filter?: Omit<OpportunityFilter, 'agentIds'>,
    orderBy?: OpportunityOrderOptions,
    limit?: number,
    offset?: number
  ): Promise<Opportunity[]> {
    this.ensureInitialized();
    
    if (this.config.cacheFilteredResults) {
      // Generate cache key
      const extendedFilter: OpportunityFilter = {
        ...filter,
        agentIds: [agentId]
      };
      
      const cacheKey = generateFilterCacheKey(extendedFilter, orderBy, limit, offset);
      
      // Check cache
      const cached = this.getCachedFilteredResults(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Not in cache, get from base registry
      const results = await this.baseRegistry.findOpportunitiesForAgent(
        agentId, filter, orderBy, limit, offset
      );
      
      // Cache results
      this.cacheFilteredResults(cacheKey, results);
      
      return results;
    }
    
    // Not using filter cache
    return this.baseRegistry.findOpportunitiesForAgent(agentId, filter, orderBy, limit, offset);
  }
  
  /**
   * Count opportunities matching a filter
   */
  async countOpportunities(filter?: OpportunityFilter): Promise<number> {
    this.ensureInitialized();
    return this.baseRegistry.countOpportunities(filter);
  }
  
  /**
   * Delete expired opportunities
   */
  async clearExpiredOpportunities(before?: Date): Promise<number> {
    this.ensureInitialized();
    
    const count = await this.baseRegistry.clearExpiredOpportunities(before);
    
    // If any were cleared, invalidate the whole cache
    if (count > 0) {
      this.cache.clear();
      if (this.config.cacheFilteredResults) {
        this.filterCache.clear();
      }
    }
    
    return count;
  }
  
  /**
   * Get health status
   */
  async getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    details?: Record<string, unknown>;
  }> {
    this.lastHealthCheck = new Date();
    
    // Get base registry health
    const baseHealth = await this.baseRegistry.getHealth();
    
    return {
      isHealthy: this.initialized && baseHealth.isHealthy,
      lastCheck: this.lastHealthCheck,
      details: {
        baseRegistry: baseHealth,
        cacheSize: this.cache.size,
        filterCacheSize: this.filterCache.size,
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        filterCacheHits: this.filterCacheHits,
        filterCacheMisses: this.filterCacheMisses,
        cacheHitRate: this.cacheHits / (this.cacheHits + this.cacheMisses || 1),
        filterCacheHitRate: this.filterCacheHits / (this.filterCacheHits + this.filterCacheMisses || 1)
      }
    };
  }
  
  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.filterCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    itemCacheSize: number;
    filterCacheSize: number;
    cacheHits: number;
    cacheMisses: number;
    filterCacheHits: number;
    filterCacheMisses: number;
  } {
    return {
      itemCacheSize: this.cache.size,
      filterCacheSize: this.filterCache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      filterCacheHits: this.filterCacheHits,
      filterCacheMisses: this.filterCacheMisses
    };
  }
} 