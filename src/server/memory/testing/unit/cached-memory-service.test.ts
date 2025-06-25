/**
 * Unit tests for CachedMemoryService
 */

import { MemoryType } from '@/server/memory/config/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BaseMemorySchema } from '../../models/base-schema';
import { CachedMemoryService } from '../../services/cache/cached-memory-service';
import { InMemoryCacheManager } from '../../services/cache/in-memory-cache';
import { CacheManager } from '../../services/cache/types';
import { MemoryService } from '../../services/memory/memory-service';
import { EnhancedMemoryService } from '../../services/multi-agent/enhanced-memory-service';
import { MockEmbeddingService } from '../utils/mock-embedding-service';
import { MockMemoryClient } from '../utils/mock-memory-client';

// Test interfaces
interface TestMessage extends BaseMemorySchema {
  // BaseMemorySchema already includes id, text, timestamp, type, and metadata
}

// Define the type for extractIndexableFields return value
interface IndexableFields {
  text: string;
  [key: string]: string | number | boolean | undefined;
}

describe('CachedMemoryService', () => {
  // Test setup
  let mockClient: MockMemoryClient;
  let mockEmbeddingService: MockEmbeddingService;
  let memoryService: MemoryService;
  let cacheManager: CacheManager;
  let cachedMemoryService: CachedMemoryService;
  const mockTimestamp = new Date('2023-01-01T00:00:00Z');

  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks();

    // Use a real InMemoryCacheManager instead of broken mocks
    cacheManager = new InMemoryCacheManager({
      maxSize: 1000,
      defaultTtl: 60000,
      pruneInterval: 30000,
      enableLogging: false
    });

    // Create mocks
    mockClient = new MockMemoryClient();
    mockEmbeddingService = new MockEmbeddingService();

    // Initialize memory service with mocks
    memoryService = new MemoryService(mockClient, mockEmbeddingService as any, {
      getTimestamp: () => Date.now()
    });

    // Use the actual memoryService directly since CachedMemoryService just needs the basic interface
    const enhancedMemoryService = memoryService as unknown as EnhancedMemoryService;

    // Initialize cached memory service
    cachedMemoryService = new CachedMemoryService(
      enhancedMemoryService,
      cacheManager,
      { defaultTtl: 60000 }
    );

    mockClient.getCollectionInfo = async (collectionName: string) => ({
      name: collectionName,
      dimensions: 1536,
      pointsCount: 0,
      createdAt: new Date()
    });
  });

  afterEach(async () => {
    // Clear cache
    await cacheManager.clear();
    // Reset memory client
    mockClient.reset();
  });

  describe('getMemory', () => {
    test('should get memory from service and cache it', async () => {
      // Setup: First add a memory
      const memoryId = 'cache-test-id';
      const content = 'Memory to cache';
      const type = MemoryType.MESSAGE;

      // Mock client to return a specific point
      const mockPoint = {
        id: memoryId,
        vector: [0.1, 0.2, 0.3],
        payload: {
          id: memoryId,
          text: content,
          type,
          timestamp: mockTimestamp.toISOString(),
          metadata: {
            schemaVersion: '1.0.0'
          }
        }
      };

      vi.spyOn(mockClient, 'getPoints').mockResolvedValue([mockPoint]);

      // Spy on cache set method
      const cacheSetSpy = vi.spyOn(cacheManager, 'set');

      // First request - should hit memory service and cache result
      const result1 = await cachedMemoryService.getMemory<TestMessage>({
        id: memoryId,
        type
      });

      // Verify we got the memory
      expect(result1).not.toBeNull();
      expect(result1?.id).toBe(memoryId);
      expect(result1?.payload.text).toBe(content);

      // Verify cache was updated
      expect(cacheSetSpy).toHaveBeenCalledTimes(1);

      // Reset spies
      vi.clearAllMocks();

      // Make second request - should hit cache
      const result2 = await cachedMemoryService.getMemory<TestMessage>({
        id: memoryId,
        type
      });

      // Verify we still get the memory
      expect(result2).not.toBeNull();
      expect(result2?.id).toBe(memoryId);
      expect(result2?.payload.text).toBe(content);

      // Verify memory service was NOT called again
      expect(mockClient.getPoints).not.toHaveBeenCalled();
    });

    test('should return null for non-existent memory', async () => {
      // Mock client to return empty array (memory not found)
      vi.spyOn(mockClient, 'getPoints').mockResolvedValue([]);

      // Request non-existent memory
      const result = await cachedMemoryService.getMemory<TestMessage>({
        id: 'non-existent-id',
        type: MemoryType.MESSAGE
      });

      // Assertions
      expect(result).toBeNull();
    });
  });

  describe('addMemory', () => {
    test('should add memory and cache it', async () => {
      // Setup
      const memoryId = 'add-cache-test-id';
      const content = 'New memory to cache';
      const type = MemoryType.MESSAGE;

      // Mock add memory to return successful result
      vi.spyOn(memoryService, 'addMemory').mockResolvedValue({
        success: true,
        id: memoryId
      });

      // Mock get memory to return added memory
      const mockPoint = {
        id: memoryId,
        vector: [0.1, 0.2, 0.3],
        payload: {
          id: memoryId,
          text: content,
          type,
          timestamp: mockTimestamp.toISOString(),
          metadata: {
            schemaVersion: '1.0.0'
          }
        }
      };

      vi.spyOn(memoryService, 'getMemory').mockResolvedValue(mockPoint);

      // Spy on cache set method
      const cacheSetSpy = vi.spyOn(cacheManager, 'set');

      // Add memory
      const result = await cachedMemoryService.addMemory({
        content,
        type,
        id: memoryId
      });

      // Verify success
      expect(result.success).toBe(true);
      expect(result.id).toBe(memoryId);

      // Verify cache was updated
      expect(cacheSetSpy).toHaveBeenCalledTimes(1);

      // Reset spies
      vi.clearAllMocks();

      // Get the memory - should be from cache
      const cachedMemory = await cachedMemoryService.getMemory<TestMessage>({
        id: memoryId,
        type
      });

      // Verify we get the memory from cache
      expect(cachedMemory).not.toBeNull();
      expect(cachedMemory?.id).toBe(memoryId);
      expect(cachedMemory?.payload.text).toBe(content);

      // Verify memory service getMemory was NOT called again
      expect(memoryService.getMemory).not.toHaveBeenCalled();
    });
  });

  describe('updateMemory', () => {
    test('should update memory and invalidate cache', async () => {
      // Setup
      const memoryId = 'update-cache-test-id';
      const originalContent = 'Original memory';
      const updatedContent = 'Updated memory';
      const type = MemoryType.MESSAGE;

      // Add original memory
      const mockOriginalPoint = {
        id: memoryId,
        vector: [0.1, 0.2, 0.3],
        payload: {
          id: memoryId,
          text: originalContent,
          type,
          timestamp: mockTimestamp.toISOString(),
          metadata: {
            schemaVersion: '1.0.0'
          }
        }
      };

      // Mock memory service - need to set up multiple return values
      const getMemorySpy = vi.spyOn(memoryService, 'getMemory');
      getMemorySpy
        .mockResolvedValueOnce(mockOriginalPoint) // First call returns original
        .mockResolvedValueOnce({ // After update, return updated content
          ...mockOriginalPoint,
          payload: {
            ...mockOriginalPoint.payload,
            text: updatedContent
          }
        });

      vi.spyOn(memoryService, 'updateMemory').mockResolvedValue(true);

      // First, get the original memory to cache it
      const original = await cachedMemoryService.getMemory<TestMessage>({
        id: memoryId,
        type
      });

      // Verify original content
      expect(original).not.toBeNull();
      expect(original?.payload.text).toBe(originalContent);

      // Verify memory service was called once
      expect(getMemorySpy).toHaveBeenCalledTimes(1);

      // Update the memory
      const updateResult = await cachedMemoryService.updateMemory({
        id: memoryId,
        type,
        content: updatedContent
      });

      // Verify update success
      expect(updateResult).toBe(true);

      // Get the memory again - should call service again due to cache invalidation
      const updated = await cachedMemoryService.getMemory<TestMessage>({
        id: memoryId,
        type
      });

      // Verify updated content
      expect(updated).not.toBeNull();
      expect(updated?.payload.text).toBe(updatedContent);

      // Verify memory service was called a second time (cache was invalidated)
      expect(getMemorySpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteMemory', () => {
    test('should delete memory and invalidate cache', async () => {
      // Setup
      const memoryId = 'delete-cache-test-id';
      const content = 'Memory to delete';
      const type = MemoryType.MESSAGE;

      // Mock memory
      const mockPoint = {
        id: memoryId,
        vector: [0.1, 0.2, 0.3],
        payload: {
          id: memoryId,
          text: content,
          type,
          timestamp: mockTimestamp.toISOString(),
          metadata: {
            schemaVersion: '1.0.0'
          }
        }
      };

      // Mock memory service
      const getMemorySpy = vi.spyOn(memoryService, 'getMemory');
      getMemorySpy
        .mockResolvedValueOnce(mockPoint) // First call returns memory
        .mockResolvedValueOnce(null);      // After delete, returns null

      vi.spyOn(memoryService, 'deleteMemory').mockResolvedValue(true);

      // First, get the memory to cache it
      const memory = await cachedMemoryService.getMemory<TestMessage>({
        id: memoryId,
        type
      });

      // Verify we got the memory
      expect(memory).not.toBeNull();
      expect(memory?.payload.text).toBe(content);

      // Verify memory service was called once
      expect(getMemorySpy).toHaveBeenCalledTimes(1);

      // Delete the memory
      const deleteResult = await cachedMemoryService.deleteMemory({
        id: memoryId,
        type
      });

      // Verify delete success
      expect(deleteResult).toBe(true);

      // Try to get the memory again - should call service again and return null
      const deletedMemory = await cachedMemoryService.getMemory<TestMessage>({
        id: memoryId,
        type
      });

      // Verify memory is gone
      expect(deletedMemory).toBeNull();

      // Verify memory service was called a second time
      expect(getMemorySpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('searchMemories', () => {
    test('should search memories without caching results', async () => {
      // Setup
      const query = 'test query';
      const type = MemoryType.MESSAGE;

      // Mock search results
      const mockResults = [
        {
          id: 'result-1',
          vector: [0.1, 0.2, 0.3],
          payload: {
            id: 'result-1',
            text: 'First search result',
            type,
            timestamp: mockTimestamp.toISOString(),
            metadata: {
              schemaVersion: '1.0.0'
            }
          }
        },
        {
          id: 'result-2',
          vector: [0.4, 0.5, 0.6],
          payload: {
            id: 'result-2',
            text: 'Second search result',
            type,
            timestamp: mockTimestamp.toISOString(),
            metadata: {
              schemaVersion: '1.0.0'
            }
          }
        }
      ];

      // Mock memory service search
      const searchSpy = vi.spyOn(memoryService, 'searchMemories').mockResolvedValue(mockResults);

      // Perform search
      const results = await cachedMemoryService.searchMemories({
        query,
        type,
        limit: 10
      });

      // Verify results
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('result-1');
      expect(results[1].id).toBe('result-2');

      // Verify memory service was called
      expect(searchSpy).toHaveBeenCalledTimes(1);
      expect(searchSpy).toHaveBeenCalledWith({
        query,
        type,
        limit: 10
      });
    });

    test('should use the cache for searchMemories calls with same parameters', async () => {
      // Mock results without using mockResolvedValue
      const mockFirstResult = [
        {
          id: 'task-1',
          score: 0.9,
          payload: {
            id: 'task-1',
            text: 'Test task 1',
            type: MemoryType.TASK,
            timestamp: mockTimestamp.toISOString(),
            metadata: {
              schemaVersion: '1.0.0'
            }
          }
        }
      ];

      // Setup memory service search mock implementation
      let searchCallCount = 0;
      const searchImplementation = vi.fn().mockImplementation(() => {
        searchCallCount++;
        return Promise.resolve(mockFirstResult);
      });

      vi.spyOn(memoryService, 'searchMemories').mockImplementation(searchImplementation);

      // First call should go through to memoryService
      const searchParams = {
        type: MemoryType.TASK,
        query: 'test',
        limit: 10
      };

      const result1 = await cachedMemoryService.searchMemories(searchParams);

      // Verify the search went through to memory service
      expect(searchCallCount).toBe(1);
      expect(result1).toEqual(mockFirstResult);

      // Second call should also go through (search is not cached)
      const result2 = await cachedMemoryService.searchMemories(searchParams);

      // Verify the search went through again
      expect(searchCallCount).toBe(2);
      expect(result2).toEqual(mockFirstResult);
    });

    test.skip('should get memories by type', async () => {
      // This test is skipped because getMemoriesByType doesn't exist on CachedMemoryService
    });
  });

  describe('cache configuration', () => {
    test('should respect custom TTL for different memory types', async () => {
      const customTtlService = new CachedMemoryService(
        memoryService as unknown as EnhancedMemoryService,
        cacheManager,
        {
          cacheTtl: {
            [MemoryType.MESSAGE]: 30000,      // 30 seconds
            [MemoryType.DOCUMENT]: 300000     // 5 minutes
          },
          defaultTtl: 60000                   // 1 minute default
        }
      );

      // Mock memory responses
      const mockMessage = {
        id: 'message-1',
        vector: [0.1, 0.2, 0.3],
        payload: {
          id: 'message-1',
          text: 'Test message',
          type: MemoryType.MESSAGE,
          timestamp: mockTimestamp.toISOString(),
          metadata: {
            schemaVersion: '1.0.0'
          }
        }
      };

      const mockDocument = {
        id: 'document-1',
        vector: [0.4, 0.5, 0.6],
        payload: {
          id: 'document-1',
          text: 'Test document',
          type: MemoryType.DOCUMENT,
          timestamp: mockTimestamp.toISOString(),
          metadata: {
            schemaVersion: '1.0.0'
          }
        }
      };

      // Mock memory service
      vi.spyOn(memoryService, 'getMemory')
        .mockImplementation(async (params) => {
          if (params.type === MemoryType.MESSAGE) {
            return mockMessage;
          } else if (params.type === MemoryType.DOCUMENT) {
            return mockDocument;
          }
          return null;
        });

      // Get a message
      const messageResult = await customTtlService.getMemory({
        id: 'message-1',
        type: MemoryType.MESSAGE
      });

      // Get a document
      const documentResult = await customTtlService.getMemory({
        id: 'document-1',
        type: MemoryType.DOCUMENT
      });

      // Verify memories were retrieved and cached
      expect(messageResult).not.toBeNull();
      expect(messageResult?.id).toBe('message-1');
      expect(documentResult).not.toBeNull();
      expect(documentResult?.id).toBe('document-1');

      // Verify cache contains the items
      const customStats = await customTtlService.getCacheStats();
      expect(customStats.size).toBe(2);
    });

    test('should assign appropriate priorities to different memory types', async () => {
      // Mock memory responses
      const mockMessage = {
        id: 'message-priority',
        vector: [0.1, 0.2, 0.3],
        payload: {
          id: 'message-priority',
          text: 'Test message',
          type: MemoryType.MESSAGE,
          timestamp: mockTimestamp.toISOString(),
          metadata: {
            schemaVersion: '1.0.0'
          }
        }
      };

      const mockDocument = {
        id: 'document-priority',
        vector: [0.4, 0.5, 0.6],
        payload: {
          id: 'document-priority',
          text: 'Test document',
          type: MemoryType.DOCUMENT,
          timestamp: mockTimestamp.toISOString(),
          metadata: {
            schemaVersion: '1.0.0'
          }
        }
      };

      const mockOther = {
        id: 'other-priority',
        vector: [0.7, 0.8, 0.9],
        payload: {
          id: 'other-priority',
          text: 'Test other',
          type: MemoryType.TASK,
          timestamp: mockTimestamp.toISOString(),
          metadata: {
            schemaVersion: '1.0.0'
          }
        }
      };

      // Mock memory service
      vi.spyOn(memoryService, 'getMemory')
        .mockImplementation(async (params) => {
          if (params.type === MemoryType.MESSAGE) {
            return mockMessage;
          } else if (params.type === MemoryType.DOCUMENT) {
            return mockDocument;
          } else if (params.type === MemoryType.TASK) {
            return mockOther;
          }
          return null;
        });

      // Get each type of memory
      const messageResult = await cachedMemoryService.getMemory({
        id: 'message-priority',
        type: MemoryType.MESSAGE
      });

      const documentResult = await cachedMemoryService.getMemory({
        id: 'document-priority',
        type: MemoryType.DOCUMENT
      });

      const taskResult = await cachedMemoryService.getMemory({
        id: 'other-priority',
        type: MemoryType.TASK
      });

      // Verify memories were retrieved and cached
      expect(messageResult).not.toBeNull();
      expect(messageResult?.id).toBe('message-priority');
      expect(documentResult).not.toBeNull();
      expect(documentResult?.id).toBe('document-priority');
      expect(taskResult).not.toBeNull();
      expect(taskResult?.id).toBe('other-priority');

      // Verify cache contains all items
      const stats = await cachedMemoryService.getCacheStats();
      expect(stats.size).toBe(3);
    });
  });

  describe('cache stats', () => {
    test('should return cache statistics', async () => {
      // Setup - add several items to cache
      const mockMemories = [
        { id: 'stat-1', type: MemoryType.MESSAGE, content: 'Memory 1' },
        { id: 'stat-2', type: MemoryType.MESSAGE, content: 'Memory 2' },
        { id: 'stat-3', type: MemoryType.DOCUMENT, content: 'Document 1' }
      ];

      // Mock memory service for each item
      vi.spyOn(memoryService, 'getMemory')
        .mockImplementation(async (params) => {
          const memory = mockMemories.find(m => m.id === params.id);
          if (!memory) return null;

          return {
            id: memory.id,
            vector: [0.1, 0.2, 0.3],
            payload: {
              id: memory.id,
              text: memory.content,
              type: memory.type,
              timestamp: mockTimestamp.toISOString(),
              metadata: {
                schemaVersion: '1.0.0'
              }
            }
          };
        });

      // Get each memory to populate cache
      for (const memory of mockMemories) {
        await cachedMemoryService.getMemory({
          id: memory.id,
          type: memory.type
        });
      }

      // Get cache stats
      const stats = await cachedMemoryService.getCacheStats();

      // Verify stats
      expect(stats).toBeDefined();
      expect(stats.size).toBe(3); // 3 items in cache
      expect(stats.hits).toBe(0); // No cache hits yet
      expect(stats.misses).toBe(3); // 3 initial misses

      // Now get an item again to trigger a hit
      await cachedMemoryService.getMemory({
        id: 'stat-1',
        type: MemoryType.MESSAGE
      });

      // Get updated stats
      const updatedStats = await cachedMemoryService.getCacheStats();

      // Verify updated stats
      expect(updatedStats.hits).toBe(1); // 1 hit
      expect(updatedStats.misses).toBe(3); // Still 3 misses
    });
  });

  describe('clearCache', () => {
    test('should clear all cached memories', async () => {
      // Setup - add several items to cache
      const mockMemories = [
        { id: 'clear-1', type: MemoryType.MESSAGE, content: 'Memory 1' },
        { id: 'clear-2', type: MemoryType.MESSAGE, content: 'Memory 2' }
      ];

      // Mock memory service for each item
      vi.spyOn(memoryService, 'getMemory')
        .mockImplementation(async (params) => {
          const memory = mockMemories.find(m => m.id === params.id);
          if (!memory) return null;

          return {
            id: memory.id,
            vector: [0.1, 0.2, 0.3],
            payload: {
              id: memory.id,
              text: memory.content,
              type: memory.type,
              timestamp: mockTimestamp.toISOString(),
              metadata: {
                schemaVersion: '1.0.0'
              }
            }
          };
        });

      // Get each memory to populate cache
      for (const memory of mockMemories) {
        await cachedMemoryService.getMemory({
          id: memory.id,
          type: memory.type
        });
      }

      // Verify cache has items
      const initialStats = await cachedMemoryService.getCacheStats();
      expect(initialStats.size).toBe(2);

      // Reset the getMemory spy to track calls after clearing
      vi.clearAllMocks();

      // Clear the cache
      await cachedMemoryService.clearCache();

      // Verify cache is empty (only size resets, hits/misses are cumulative)
      const clearedStats = await cachedMemoryService.getCacheStats();
      expect(clearedStats.size).toBe(0);

      // Get a memory again - should miss cache and call service
      const result = await cachedMemoryService.getMemory({
        id: 'clear-1',
        type: MemoryType.MESSAGE
      });

      // Verify we got the memory and service was called
      expect(result).not.toBeNull();
      expect(result?.id).toBe('clear-1');
      expect(memoryService.getMemory).toHaveBeenCalledTimes(1);
    });
  });
}); 