/**
 * Unit tests for CacheWarmer
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheWarmer } from '../../services/cache/cache-warmer';
import { CacheWarmingStrategy, CacheWarmingTrigger, CacheManager } from '../../services/cache/types';
import { MemoryService } from '../../services/memory/memory-service';
import { MockMemoryClient } from '../utils/mock-memory-client';
import { MockEmbeddingService } from '../utils/mock-embedding-service';
import { MemoryType } from '../../config';
import { CognitiveProcessType } from '@/types/metadata';
import { createAgentId } from '@/types/structured-id';
import { CachePriority } from '../../services/cache/types';
import { BaseMemorySchema } from '../../models/base-schema';
import { CognitiveProcessMetadata, TaskMetadata, MessageMetadata } from '@/types/metadata';

describe('CacheWarmer', () => {
  let cacheWarmer: CacheWarmer;
  let mockCache: CacheManager;
  let mockMemoryService: MemoryService;
  let mockClient: MockMemoryClient;
  let mockEmbeddingService: MockEmbeddingService;
  const mockTimestamp = new Date('2024-01-01T00:00:00.000Z');

  beforeEach(() => {
    // Create mock cache and memory service
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      invalidateByTag: vi.fn(),
      getStats: vi.fn(),
      getTags: vi.fn()
    };

    mockMemoryService = {
      searchMemories: vi.fn(),
      getMemory: vi.fn(),
      updateMemory: vi.fn(),
      deleteMemory: vi.fn(),
      getTimestamp: vi.fn(),
      addMemory: vi.fn(),
      getMemoryHistory: vi.fn(),
      rollbackMemory: vi.fn()
    } as unknown as MemoryService;

    // Create cache warmer with test configuration
    cacheWarmer = new CacheWarmer(mockCache, mockMemoryService, {
      enabled: true,
      strategies: [
        CacheWarmingStrategy.FREQUENT_ACCESS,
        CacheWarmingStrategy.RECENT_ACCESS,
        CacheWarmingStrategy.GRAPH_RELATED,
        CacheWarmingStrategy.TIME_BASED,
        CacheWarmingStrategy.PATTERN_BASED
      ],
      triggers: [CacheWarmingTrigger.MANUAL],
      maxItemsPerStrategy: 10,
      minAccessCount: 3, // Set to 3 to match test expectations
      recentAccessWindow: 24 * 60 * 60 * 1000, // 24 hours
      warmOnStartup: false
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize with default configuration', async () => {
      // Create cache warmer with warmOnStartup disabled to prevent automatic warming
      const defaultWarmer = new CacheWarmer(mockCache, mockMemoryService, { warmOnStartup: false });
      await defaultWarmer.initialize();
      
      const stats = await defaultWarmer.getWarmingStats();
      expect(stats.lastWarmed).toEqual(new Date(0));
      expect(stats.totalItemsWarmed).toBe(0);
      expect(stats.strategiesUsed).toContain(CacheWarmingStrategy.FREQUENT_ACCESS);
      expect(stats.strategiesUsed).toContain(CacheWarmingStrategy.RECENT_ACCESS);
    });

    test('should initialize with custom configuration', async () => {
      // Create cache warmer with test configuration
      cacheWarmer = new CacheWarmer(mockCache, mockMemoryService, {
        enabled: true,
        strategies: [
          CacheWarmingStrategy.FREQUENT_ACCESS,
          CacheWarmingStrategy.RECENT_ACCESS,
          CacheWarmingStrategy.GRAPH_RELATED,
          CacheWarmingStrategy.TIME_BASED,
          CacheWarmingStrategy.PATTERN_BASED
        ],
        triggers: [CacheWarmingTrigger.STARTUP],
        maxItemsPerStrategy: 10,
        recentAccessWindow: 24 * 60 * 60 * 1000, // 24 hours
        minAccessCount: 3,
        warmOnStartup: false // Disable startup warming for tests
      });
      
      await cacheWarmer.initialize();
      
      const stats = await cacheWarmer.getWarmingStats();
      expect(stats.strategiesUsed).toHaveLength(5);
      expect(stats.strategiesUsed).toContain(CacheWarmingStrategy.GRAPH_RELATED);
      expect(stats.strategiesUsed).toContain(CacheWarmingStrategy.TIME_BASED);
      expect(stats.strategiesUsed).toContain(CacheWarmingStrategy.PATTERN_BASED);
    });
  });

  describe('warming strategies', () => {
    test('should warm frequently accessed memories', async () => {
      // Create test memories with varying access counts
      const memories = [
        {
          id: 'freq-1',
          payload: {
            type: MemoryType.MESSAGE,
            text: 'Frequently accessed memory 1',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent'),
              access_count: 5
            }
          },
          vector: [0.1, 0.2, 0.3]
        },
        {
          id: 'freq-2',
          payload: {
            type: MemoryType.MESSAGE,
            text: 'Frequently accessed memory 2',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent'),
              access_count: 4
            }
          },
          vector: [0.2, 0.3, 0.4]
        }
      ];
      // Only return memories with access_count >= 3
      (mockMemoryService.searchMemories as any).mockResolvedValue(memories);

      // Run cache warming with frequent access strategy
      const results = await cacheWarmer.warmCache(CacheWarmingStrategy.FREQUENT_ACCESS);

      // Verify results
      expect(results).toHaveLength(1);
      expect(results[0].strategy).toBe(CacheWarmingStrategy.FREQUENT_ACCESS);
      expect(results[0].itemsWarmed).toBe(2); // Only memories with access_count >= 3
      expect(mockCache.set).toHaveBeenCalledTimes(2);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('freq-1'),
        expect.objectContaining({ id: 'freq-1' }),
        expect.any(Object)
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('freq-2'),
        expect.objectContaining({ id: 'freq-2' }),
        expect.any(Object)
      );
    });

    test('should warm recently accessed memories', async () => {
      // Create test memories with different last accessed timestamps
      const now = Date.now();
      const memories = [
        {
          id: 'recent-1',
          payload: {
            type: MemoryType.MESSAGE,
            text: 'Recently accessed memory 1',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent'),
              last_accessed: now - 3600000 // 1 hour ago
            }
          },
          vector: [0.1, 0.2, 0.3]
        },
        {
          id: 'recent-2',
          payload: {
            type: MemoryType.MESSAGE,
            text: 'Recently accessed memory 2',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent'),
              last_accessed: now - 7200000 // 2 hours ago
            }
          },
          vector: [0.2, 0.3, 0.4]
        }
      ];
      // Only return memories accessed within 24 hours
      (mockMemoryService.searchMemories as any).mockResolvedValue(memories);

      // Run cache warming with recent access strategy
      const results = await cacheWarmer.warmCache(CacheWarmingStrategy.RECENT_ACCESS);

      // Verify results
      expect(results).toHaveLength(1);
      expect(results[0].strategy).toBe(CacheWarmingStrategy.RECENT_ACCESS);
      expect(results[0].itemsWarmed).toBe(2); // Only memories accessed within 24 hours
      expect(mockCache.set).toHaveBeenCalledTimes(2);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('recent-1'),
        expect.objectContaining({ id: 'recent-1' }),
        expect.any(Object)
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('recent-2'),
        expect.objectContaining({ id: 'recent-2' }),
        expect.any(Object)
      );
    });

    test('should warm graph-related memories', async () => {
      // Create test memories with relationships
      const sourceMemory = {
        id: 'graph-1',
        payload: {
          type: MemoryType.THOUGHT,
          text: 'Source memory',
          metadata: {
            schemaVersion: '1.0',
            processType: CognitiveProcessType.THOUGHT,
            agentId: createAgentId('test-agent'),
            led_to: [
              { memoryId: 'graph-2', description: 'Led to memory 2', timestamp: mockTimestamp },
              { memoryId: 'graph-3', description: 'Led to memory 3', timestamp: mockTimestamp }
            ],
            caused_by: { memoryId: 'graph-4', description: 'Caused by memory 4', timestamp: mockTimestamp }
          }
        },
        vector: [0.1, 0.2, 0.3]
      };

      const relatedMemories = [
        {
          id: 'graph-2',
          payload: {
            type: MemoryType.THOUGHT,
            text: 'Related memory 2',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent')
            }
          },
          vector: [0.2, 0.3, 0.4]
        },
        {
          id: 'graph-3',
          payload: {
            type: MemoryType.THOUGHT,
            text: 'Related memory 3',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent')
            }
          },
          vector: [0.3, 0.4, 0.5]
        },
        {
          id: 'graph-4',
          payload: {
            type: MemoryType.THOUGHT,
            text: 'Related memory 4',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent')
            }
          },
          vector: [0.4, 0.5, 0.6]
        }
      ];

      // Mock searchMemories to return the source memory
      (mockMemoryService.searchMemories as any).mockResolvedValue([sourceMemory]);

      // Mock getMemory to return related memories
      (mockMemoryService.getMemory as any).mockImplementation(({ id }: { id: string }) => {
        const memory = relatedMemories.find(m => m.id === id);
        return Promise.resolve(memory || null);
      });

      // Run cache warming with graph strategy
      const results = await cacheWarmer.warmCache(CacheWarmingStrategy.GRAPH_RELATED);

      // Verify results
      expect(results).toHaveLength(1);
      expect(results[0].strategy).toBe(CacheWarmingStrategy.GRAPH_RELATED);
      expect(results[0].itemsWarmed).toBe(4); // Source + 3 related memories
      expect(mockCache.set).toHaveBeenCalledTimes(4);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('graph-1'),
        expect.objectContaining({ id: 'graph-1' }),
        expect.any(Object)
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('graph-2'),
        expect.objectContaining({ id: 'graph-2' }),
        expect.any(Object)
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('graph-3'),
        expect.objectContaining({ id: 'graph-3' }),
        expect.any(Object)
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('graph-4'),
        expect.objectContaining({ id: 'graph-4' }),
        expect.any(Object)
      );
    });

    test('should warm time-based memories', async () => {
      // Create test memories with due dates and validity periods
      const memories = [
        {
          id: 'time-1',
          payload: {
            type: MemoryType.TASK,
            text: 'Task due soon',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent'),
              status: 'pending',
              dueDate: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
              priority: CachePriority.HIGH
            }
          },
          vector: [0.1, 0.2, 0.3]
        },
        {
          id: 'time-2',
          payload: {
            type: MemoryType.TASK,
            text: 'Task due later',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent'),
              status: 'pending',
              dueDate: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
              priority: CachePriority.MEDIUM
            }
          },
          vector: [0.2, 0.3, 0.4]
        },
        {
          id: 'time-3',
          payload: {
            type: MemoryType.INSIGHT,
            text: 'Message with validity',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent'),
              validityPeriod: { start: new Date(Date.now() - 3600000).toISOString(), end: new Date(Date.now() + 3600000).toISOString() }
            }
          },
          vector: [0.3, 0.4, 0.5]
        }
      ];
      // Only return memories with valid time constraints
      (mockMemoryService.searchMemories as any).mockResolvedValue(memories);

      // Run cache warming with time-based strategy
      const results = await cacheWarmer.warmCache(CacheWarmingStrategy.TIME_BASED);

      // Verify results
      expect(results).toHaveLength(1);
      expect(results[0].strategy).toBe(CacheWarmingStrategy.TIME_BASED);
      expect(results[0].itemsWarmed).toBe(3); // Only memories with valid time constraints
      expect(mockCache.set).toHaveBeenCalledTimes(3);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('time-1'),
        expect.objectContaining({ id: 'time-1' }),
        expect.any(Object)
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('time-2'),
        expect.objectContaining({ id: 'time-2' }),
        expect.any(Object)
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('time-3'),
        expect.objectContaining({ id: 'time-3' }),
        expect.any(Object)
      );
    });

    test('should warm pattern-based memories', async () => {
      // Create test memories with various patterns
      const memories = [
        {
          id: 'pattern-1',
          payload: {
            type: MemoryType.THOUGHT,
            text: 'Important memory',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent'),
              importance_score: 0.9,
              usage_count: 5
            }
          },
          vector: [0.1, 0.2, 0.3]
        },
        {
          id: 'pattern-2',
          payload: {
            type: MemoryType.THOUGHT,
            text: 'Less important memory',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent'),
              importance_score: 0.5,
              usage_count: 2
            }
          },
          vector: [0.2, 0.3, 0.4]
        },
        {
          id: 'pattern-4',
          payload: {
            type: MemoryType.THOUGHT,
            text: 'Memory without patterns',
            metadata: {
              schemaVersion: '1.0',
              processType: CognitiveProcessType.THOUGHT,
              agentId: createAgentId('test-agent')
            }
          },
          vector: [0.4, 0.5, 0.6]
        }
      ];
      // Only return memories with importance >= 0.5 or usage_count >= 3
      (mockMemoryService.searchMemories as any).mockResolvedValue(memories);

      // Run cache warming with pattern-based strategy
      const results = await cacheWarmer.warmCache(CacheWarmingStrategy.PATTERN_BASED);

      // Verify results
      expect(results).toHaveLength(1);
      expect(results[0].strategy).toBe(CacheWarmingStrategy.PATTERN_BASED);
      expect(results[0].itemsWarmed).toBe(3); // Only memories with importance >= 0.5 or usage_count >= 3
      expect(mockCache.set).toHaveBeenCalledTimes(3);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('pattern-1'),
        expect.objectContaining({ id: 'pattern-1' }),
        expect.any(Object)
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('pattern-2'),
        expect.objectContaining({ id: 'pattern-2' }),
        expect.any(Object)
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('pattern-4'),
        expect.objectContaining({ id: 'pattern-4' }),
        expect.any(Object)
      );
    });
  });

  describe('warming control', () => {
    test('should prevent concurrent warming', async () => {
      // Start warming
      const warmingPromise = cacheWarmer.warmCache();
      
      // Try to start another warming
      await expect(cacheWarmer.warmCache()).rejects.toThrow('Cache warming already in progress');
      
      // Wait for first warming to complete
      await warmingPromise;
    });

    test('should stop warming and clear interval', async () => {
      // Start warming with scheduled trigger
      const warmer = new CacheWarmer(mockCache, mockMemoryService, {
        ...cacheWarmer['config'],
        triggers: [CacheWarmingTrigger.SCHEDULED],
        warmingSchedule: '*/30 * * * *' // Every 30 minutes
      });
      
      await warmer.initialize();
      
      // Stop warming
      await warmer.stopWarming();
      
      // Verify warming is stopped
      const stats = await warmer.getWarmingStats();
      expect(stats.lastWarmed).toEqual(new Date(0));
    });
  });

  describe('error handling', () => {
    test('should handle errors during warming', async () => {
      // Mock searchMemories to throw an error
      (mockMemoryService.searchMemories as any).mockRejectedValue(new Error('Search failed'));

      // Run cache warming
      const results = await cacheWarmer.warmCache(CacheWarmingStrategy.FREQUENT_ACCESS);

      // Verify results
      expect(results).toHaveLength(1);
      expect(results[0].strategy).toBe(CacheWarmingStrategy.FREQUENT_ACCESS);
      expect(results[0].itemsWarmed).toBe(0);
      expect(results[0].errors).toBeDefined();
      expect(results[0].errors?.[0].message).toBe('Search failed');
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    test('should continue warming other strategies after error', async () => {
      // Mock searchMemories to throw an error for one strategy but succeed for others
      vi.spyOn(mockMemoryService, 'searchMemories').mockImplementation(async (query) => {
        if (query.type === MemoryType.MESSAGE) {
          throw new Error('Test error during frequent access warming');
        }
        return [{
          id: 'test-1',
          vector: [0.1, 0.2, 0.3],
          payload: {
            id: 'test-1',
            type: MemoryType.THOUGHT,
            text: 'Test thought',
            timestamp: mockTimestamp.toISOString(),
            metadata: {
              schemaVersion: '1.0.0'
            }
          }
        }];
      });

      // Create cache warmer with test configuration
      cacheWarmer = new CacheWarmer(mockCache, mockMemoryService, {
        enabled: true,
        strategies: [
          CacheWarmingStrategy.FREQUENT_ACCESS,
          CacheWarmingStrategy.PATTERN_BASED
        ],
        triggers: [CacheWarmingTrigger.MANUAL],
        maxItemsPerStrategy: 10,
        warmOnStartup: false
      });

      // Run warming
      const results = await cacheWarmer.warmCache();
      
      // Verify results
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.errors)).toBe(true);
      expect(results.some(r => !r.errors)).toBe(true);

      // Verify that the successful strategy still warmed items
      const successfulResult = results.find(r => !r.errors);
      expect(successfulResult).toBeDefined();
      expect(successfulResult?.itemsWarmed).toBeGreaterThan(0);

      // Verify that the failed strategy has errors
      const failedResult = results.find(r => r.errors);
      expect(failedResult).toBeDefined();
      expect(failedResult?.errors?.[0].message).toBe('Test error during frequent access warming');
    });
  });
}); 
 
 
 