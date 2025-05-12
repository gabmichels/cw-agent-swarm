/**
 * Cache warmer implementation
 */
import { ICacheWarmer, CacheWarmingConfig, CacheWarmingStrategy, CacheWarmingTrigger, CacheWarmingResult, CachePriority } from './types';
import { CacheManager } from './types';
import { MemoryService } from '../memory/memory-service';
import { MemoryType } from '../../config';
import { MemoryPoint, BaseMemorySchema } from '../../models/base-schema';
import { MemoryErrorCode } from '@/lib/errors/types';
import { handleMemoryError } from '../../utils';
import { CognitiveProcessMetadata, TaskMetadata, MessageMetadata } from '@/types/metadata';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CacheWarmingConfig = {
  enabled: true,
  strategies: [CacheWarmingStrategy.FREQUENT_ACCESS, CacheWarmingStrategy.RECENT_ACCESS],
  triggers: [CacheWarmingTrigger.STARTUP, CacheWarmingTrigger.ACCESS_PATTERN],
  maxItemsPerStrategy: 100,
  recentAccessWindow: 24 * 60 * 60 * 1000, // 24 hours
  minAccessCount: 5,
  warmOnStartup: true
};

/**
 * Cache warmer implementation
 */
export class CacheWarmer implements ICacheWarmer {
  private cache: CacheManager;
  private memoryService: MemoryService;
  private config: CacheWarmingConfig;
  private isWarming: boolean = false;
  private warmingInterval: NodeJS.Timeout | null = null;
  private lastWarmed: Date = new Date(0);
  private totalItemsWarmed: number = 0;
  private totalWarmingTime: number = 0;
  private errors: Error[] = [];
  
  /**
   * Create a new cache warmer
   */
  constructor(
    cache: CacheManager,
    memoryService: MemoryService,
    config?: Partial<CacheWarmingConfig>
  ) {
    this.cache = cache;
    this.memoryService = memoryService;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Initialize the cache warmer
   */
  async initialize(): Promise<void> {
    try {
      // Start warming on startup if configured
      if (this.config.warmOnStartup) {
        await this.warmCache();
      }
      
      // Set up scheduled warming if configured
      if (this.config.triggers.includes(CacheWarmingTrigger.SCHEDULED) && this.config.warmingSchedule) {
        // TODO: Implement cron-based scheduling
        // For now, use a simple interval
        this.warmingInterval = setInterval(() => {
          this.warmCache().catch(error => {
            console.error('Error in scheduled cache warming:', error);
            this.errors.push(error);
          });
        }, 30 * 60 * 1000); // Every 30 minutes
      }
    } catch (error) {
      console.error('Error initializing cache warmer:', error);
      throw handleMemoryError(error, 'initialize');
    }
  }
  
  /**
   * Start cache warming
   */
  async warmCache(strategy?: CacheWarmingStrategy): Promise<CacheWarmingResult[]> {
    if (this.isWarming) {
      throw new Error('Cache warming already in progress');
    }
    
    this.isWarming = true;
    const startTime = Date.now();
    const results: CacheWarmingResult[] = [];
    
    try {
      // Use specific strategy or all configured strategies
      const strategies = strategy ? [strategy] : this.config.strategies;
      
      for (const strategy of strategies) {
        const strategyStartTime = Date.now();
        let itemsWarmed = 0;
        const strategyErrors: Error[] = [];
        
        try {
          switch (strategy) {
            case CacheWarmingStrategy.FREQUENT_ACCESS:
              itemsWarmed = await this.warmFrequentAccess();
              break;
            case CacheWarmingStrategy.RECENT_ACCESS:
              itemsWarmed = await this.warmRecentAccess();
              break;
            case CacheWarmingStrategy.GRAPH_RELATED:
              itemsWarmed = await this.warmGraphRelated();
              break;
            case CacheWarmingStrategy.TIME_BASED:
              itemsWarmed = await this.warmTimeBased();
              break;
            case CacheWarmingStrategy.PATTERN_BASED:
              itemsWarmed = await this.warmPatternBased();
              break;
            default:
              throw new Error(`Unknown warming strategy: ${strategy}`);
          }
        } catch (error) {
          console.error(`Error in ${strategy} warming:`, error);
          strategyErrors.push(error instanceof Error ? error : new Error(String(error)));
        }
        
        const timeTaken = Date.now() - strategyStartTime;
        results.push({
          strategy,
          itemsWarmed,
          timeTaken,
          errors: strategyErrors.length > 0 ? strategyErrors : undefined
        });
        
        // Update statistics
        this.totalItemsWarmed += itemsWarmed;
        this.totalWarmingTime += timeTaken;
        this.errors.push(...strategyErrors);
      }
      
      this.lastWarmed = new Date();
      return results;
    } finally {
      this.isWarming = false;
    }
  }
  
  /**
   * Stop cache warming
   */
  async stopWarming(): Promise<void> {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
    }
    this.isWarming = false;
  }
  
  /**
   * Get warming statistics
   */
  async getWarmingStats(): Promise<{
    lastWarmed: Date;
    totalItemsWarmed: number;
    averageTimePerItem: number;
    strategiesUsed: CacheWarmingStrategy[];
    errors: Error[];
  }> {
    return {
      lastWarmed: this.lastWarmed || new Date(0),
      totalItemsWarmed: this.totalItemsWarmed,
      averageTimePerItem: this.totalItemsWarmed > 0 ? this.totalWarmingTime / this.totalItemsWarmed : 0,
      strategiesUsed: this.config.strategies,
      errors: this.errors
    };
  }
  
  /**
   * Warm frequently accessed memories
   */
  private async warmFrequentAccess(): Promise<number> {
    let itemsWarmed = 0;
    
    // Get memories with high access count
    const memories = await this.memoryService.searchMemories({
      type: MemoryType.MESSAGE,
      filter: {
        'metadata.access_count': {
          $gte: this.config.minAccessCount
        }
      },
      limit: this.config.maxItemsPerStrategy
    });
    
    // Warm each memory
    for (const memory of memories) {
      try {
        const cacheKey = this.getMemoryCacheKey(memory.id, memory.payload.type);
        await this.cache.set(cacheKey, memory, {
          priority: CachePriority.HIGH,
          tags: ['frequent_access', `type:${memory.payload.type}`]
        });
        itemsWarmed++;
      } catch (error) {
        console.error(`Error warming frequent memory ${memory.id}:`, error);
        this.errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    return itemsWarmed;
  }
  
  /**
   * Warm recently accessed memories
   */
  private async warmRecentAccess(): Promise<number> {
    let itemsWarmed = 0;
    const cutoffTime = Date.now() - this.config.recentAccessWindow;
    
    // Get recently accessed memories
    const memories = await this.memoryService.searchMemories({
      type: MemoryType.MESSAGE,
      filter: {
        'metadata.last_accessed': {
          $gte: cutoffTime
        }
      },
      limit: this.config.maxItemsPerStrategy
    });
    
    // Warm each memory
    for (const memory of memories) {
      try {
        const cacheKey = this.getMemoryCacheKey(memory.id, memory.payload.type);
        await this.cache.set(cacheKey, memory, {
          priority: CachePriority.MEDIUM,
          tags: ['recent_access', `type:${memory.payload.type}`]
        });
        itemsWarmed++;
      } catch (error) {
        console.error(`Error warming recent memory ${memory.id}:`, error);
        this.errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    return itemsWarmed;
  }
  
  /**
   * Warm graph-related memories
   * Uses relationship metadata to find and warm related memories
   */
  private async warmGraphRelated(): Promise<number> {
    let itemsWarmed = 0;
    
    // Get memories with relationships
    const memories = await this.memoryService.searchMemories<BaseMemorySchema>({
      type: MemoryType.THOUGHT, // Use THOUGHT type since it has the most relationship metadata
      filter: {
        $or: [
          { 'metadata.relatedTo': { $exists: true } },
          { 'metadata.influences': { $exists: true } },
          { 'metadata.influencedBy': { $exists: true } },
          { 'metadata.led_to': { $exists: true } },
          { 'metadata.caused_by': { $exists: true } }
        ]
      },
      limit: this.config.maxItemsPerStrategy
    });
    
    // Warm each memory and its related memories
    for (const memory of memories) {
      try {
        // Warm the source memory
        const cacheKey = this.getMemoryCacheKey(memory.id, memory.payload.type);
        await this.cache.set(cacheKey, memory, {
          priority: CachePriority.HIGH,
          tags: ['graph_related', `type:${memory.payload.type}`, `memory:${memory.id}`]
        });
        itemsWarmed++;
        
        // Get and warm related memories
        const relatedIds = new Set<string>();
        
        // Add related memories from metadata
        const metadata = memory.payload.metadata as CognitiveProcessMetadata;
        if (metadata.relatedTo) {
          metadata.relatedTo.forEach(id => relatedIds.add(id));
        }
        if (metadata.influences) {
          metadata.influences.forEach(id => relatedIds.add(id));
        }
        if (metadata.influencedBy) {
          metadata.influencedBy.forEach(id => relatedIds.add(id));
        }
        if (metadata.led_to) {
          metadata.led_to.forEach(rel => relatedIds.add(rel.memoryId));
        }
        if (metadata.caused_by) {
          relatedIds.add(metadata.caused_by.memoryId);
        }
        
        // Fetch and warm each related memory
        for (const relatedId of Array.from(relatedIds)) {
          try {
            const relatedMemory = await this.memoryService.getMemory<BaseMemorySchema>({ 
              id: relatedId,
              type: MemoryType.THOUGHT // Default to THOUGHT type, will be adjusted if needed
            });
            if (relatedMemory) {
              const relatedCacheKey = this.getMemoryCacheKey(relatedId, relatedMemory.payload.type);
              await this.cache.set(relatedCacheKey, relatedMemory, {
                priority: CachePriority.MEDIUM,
                tags: ['graph_related', `type:${relatedMemory.payload.type}`, `related_to:${memory.id}`]
              });
              itemsWarmed++;
            }
          } catch (error) {
            console.error(`Error warming related memory ${relatedId}:`, error);
            this.errors.push(error instanceof Error ? error : new Error(String(error)));
          }
        }
      } catch (error) {
        console.error(`Error warming graph memory ${memory.id}:`, error);
        this.errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    return itemsWarmed;
  }
  
  /**
   * Warm time-based memories
   * Uses temporal patterns and scheduled tasks to warm relevant memories
   */
  private async warmTimeBased(): Promise<number> {
    let itemsWarmed = 0;
    const now = new Date();
    
    // Get memories that are time-sensitive or scheduled
    const memories = await this.memoryService.searchMemories<BaseMemorySchema>({
      type: MemoryType.TASK, // Start with tasks since they're most time-sensitive
      filter: {
        $or: [
          // Scheduled tasks
          {
            'metadata.status': { $ne: 'completed' },
            'metadata.dueDate': { $exists: true } // Use dueDate instead of scheduledFor
          },
          // Time-sensitive insights
          {
            type: MemoryType.INSIGHT,
            'metadata.validityPeriod': { $exists: true }
          },
          // Recent cognitive processes
          {
            type: { $in: [MemoryType.THOUGHT, MemoryType.REFLECTION, MemoryType.INSIGHT] },
            timestamp: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() }
          },
          // Daily and weekly cycle logs
          {
            type: { $in: [MemoryType.DAILY_CYCLE_LOG, MemoryType.WEEKLY_CYCLE_LOG] },
            timestamp: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() }
          }
        ]
      },
      limit: this.config.maxItemsPerStrategy
    });
    
    // Warm each memory
    for (const memory of memories) {
      try {
        const cacheKey = this.getMemoryCacheKey(memory.id, memory.payload.type);
        let priority = CachePriority.MEDIUM;
        
        // Adjust priority based on time sensitivity
        if (memory.payload.type === MemoryType.TASK) {
          const taskMetadata = memory.payload.metadata as TaskMetadata;
          if (taskMetadata.dueDate) {
            const dueTime = new Date(taskMetadata.dueDate);
            const timeUntilDue = dueTime.getTime() - now.getTime();
            
            // Higher priority for tasks due within the next hour
            if (timeUntilDue > 0 && timeUntilDue <= 60 * 60 * 1000) {
              priority = CachePriority.HIGH;
            }
          }
        }
        
        await this.cache.set(cacheKey, memory, {
          priority,
          tags: ['time_based', `type:${memory.payload.type}`]
        });
        itemsWarmed++;
      } catch (error) {
        console.error(`Error warming time-based memory ${memory.id}:`, error);
        this.errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    return itemsWarmed;
  }
  
  /**
   * Warm pattern-based memories
   * Uses access patterns and importance metrics to warm relevant memories
   */
  private async warmPatternBased(): Promise<number> {
    let itemsWarmed = 0;
    
    // Get memories based on various patterns
    const memories = await this.memoryService.searchMemories<BaseMemorySchema>({
      type: MemoryType.THOUGHT, // Start with thoughts since they have the most metadata
      filter: {
        $or: [
          // High importance memories
          {
            'metadata.importance_score': { $gte: 0.8 }
          },
          // Frequently used memories
          {
            'metadata.usage_count': { $gte: this.config.minAccessCount }
          },
          // Critical memories
          {
            'metadata.critical': true
          },
          // Memories with high confidence tags
          {
            'metadata.tag_confidence': { $gte: 0.8 }
          },
          // Recent messages (likely part of active threads)
          {
            type: MemoryType.MESSAGE,
            timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
          }
        ]
      },
      limit: this.config.maxItemsPerStrategy
    });
    
    // Warm each memory
    for (const memory of memories) {
      try {
        const cacheKey = this.getMemoryCacheKey(memory.id, memory.payload.type);
        let priority = CachePriority.MEDIUM;
        
        // Adjust priority based on patterns
        const importanceScore = memory.payload.metadata.importance_score ?? 0;
        const usageCount = memory.payload.metadata.usage_count ?? 0;
        
        if (importanceScore >= 0.9 || memory.payload.metadata.critical) {
          priority = CachePriority.HIGH;
        } else if (usageCount >= this.config.minAccessCount * 2) {
          priority = CachePriority.HIGH;
        }
        
        // Build tags based on patterns
        const tags = ['pattern_based', `type:${memory.payload.type}`];
        if (importanceScore >= 0.8) tags.push('high_importance');
        if (memory.payload.metadata.critical) tags.push('critical');
        
        // Add thread tag for recent messages
        if (memory.payload.type === MemoryType.MESSAGE) {
          const messageMetadata = memory.payload.metadata as MessageMetadata;
          const messageTime = new Date(memory.payload.timestamp);
          const isRecent = messageTime.getTime() > Date.now() - 24 * 60 * 60 * 1000;
          if (isRecent) {
            tags.push('recent_thread');
          }
        }
        
        await this.cache.set(cacheKey, memory, {
          priority,
          tags
        });
        itemsWarmed++;
      } catch (error) {
        console.error(`Error warming pattern-based memory ${memory.id}:`, error);
        this.errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    return itemsWarmed;
  }
  
  /**
   * Get cache key for a memory
   */
  private getMemoryCacheKey(id: string, type: MemoryType): string {
    return `memory:${type}:${id}`;
  }
} 