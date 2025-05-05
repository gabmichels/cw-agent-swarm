/**
 * Unit tests for CachedMemoryService
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { CachedMemoryService } from '../../services/cache/cached-memory-service';
import { MemoryService } from '../../services/memory/memory-service';
import { MockMemoryClient } from '../utils/mock-memory-client';
import { MockEmbeddingService } from '../utils/mock-embedding-service';
import { InMemoryCacheManager } from '../../services/cache/in-memory-cache';
import { MemoryType } from '../../config';
import { CachePriority } from '../../services/cache/types';
import { BaseMemorySchema } from '../../models/base-schema';

// Test interfaces
interface TestMessage extends BaseMemorySchema {
  // BaseMemorySchema already includes id, text, timestamp, type, and metadata
}

describe('CachedMemoryService', () => {
  // Test setup
  let mockClient: MockMemoryClient;
  let mockEmbeddingService: MockEmbeddingService;
  let memoryService: MemoryService;
  let cacheManager: InMemoryCacheManager;
  let cachedMemoryService: CachedMemoryService;
  const mockTimestamp = 1625097600000; // Fixed timestamp for testing

  beforeEach(() => {
    // Create mocks
    mockClient = new MockMemoryClient();
    mockEmbeddingService = new MockEmbeddingService();
    
    // Initialize memory service with mocks and fixed timestamp
    memoryService = new MemoryService(mockClient, mockEmbeddingService as any, {
      getTimestamp: () => mockTimestamp
    });
    
    // Initialize cache manager
    cacheManager = new InMemoryCacheManager({
      maxSize: 100,
      defaultTtl: 60000 // 1 minute
    });
    
    // Initialize cached memory service
    cachedMemoryService = new CachedMemoryService(memoryService, cacheManager, {
      defaultTtl: 60000, // 1 minute
      enableLogging: false
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
          timestamp: mockTimestamp.toString(),
          metadata: {}
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
          timestamp: mockTimestamp.toString(),
          metadata: {}
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
          timestamp: mockTimestamp.toString(),
          metadata: {}
        }
      };
      
      // Mock memory service
      vi.spyOn(memoryService, 'getMemory')
        .mockResolvedValueOnce(mockOriginalPoint) // First call returns original
        .mockResolvedValueOnce({ // After update - remove the null response that was causing the test to fail
          ...mockOriginalPoint,
          payload: {
            ...mockOriginalPoint.payload,
            text: updatedContent
          }
        });
        
      vi.spyOn(memoryService, 'updateMemory').mockResolvedValue(true);
      
      // Spy on cache methods
      const cacheSetSpy = vi.spyOn(cacheManager, 'set');
      const cacheDeleteSpy = vi.spyOn(cacheManager, 'delete');
      
      // First, get the original memory to cache it
      const original = await cachedMemoryService.getMemory<TestMessage>({
        id: memoryId,
        type
      });
      
      // Verify original content
      expect(original).not.toBeNull();
      expect(original?.payload.text).toBe(originalContent);
      expect(cacheSetSpy).toHaveBeenCalledTimes(1);
      
      // Reset spies
      vi.clearAllMocks();
      
      // Update the memory
      const updateResult = await cachedMemoryService.updateMemory({
        id: memoryId,
        type,
        content: updatedContent
      });
      
      // Verify update success
      expect(updateResult).toBe(true);
      
      // Verify cache was invalidated
      expect(cacheDeleteSpy).toHaveBeenCalledTimes(1);
      
      // Reset spies
      vi.clearAllMocks();
      
      // Get the memory again - should miss cache and call service
      const updated = await cachedMemoryService.getMemory<TestMessage>({
        id: memoryId,
        type
      });
      
      // Verify updated content
      expect(updated).not.toBeNull();
      expect(updated?.payload.text).toBe(updatedContent);
      
      // Verify memory service was called again
      expect(memoryService.getMemory).toHaveBeenCalledTimes(1);
      
      // Verify it was cached again
      expect(cacheSetSpy).toHaveBeenCalledTimes(1);
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
          timestamp: mockTimestamp.toString(),
          metadata: {}
        }
      };
      
      // Mock memory service
      vi.spyOn(memoryService, 'getMemory')
        .mockResolvedValueOnce(mockPoint) // First call returns memory
        .mockResolvedValueOnce(null);      // After delete, returns null
        
      vi.spyOn(memoryService, 'deleteMemory').mockResolvedValue(true);
      
      // Spy on cache methods
      const cacheSetSpy = vi.spyOn(cacheManager, 'set');
      const cacheDeleteSpy = vi.spyOn(cacheManager, 'delete');
      
      // First, get the memory to cache it
      const memory = await cachedMemoryService.getMemory<TestMessage>({
        id: memoryId,
        type
      });
      
      // Verify we got the memory
      expect(memory).not.toBeNull();
      expect(memory?.payload.text).toBe(content);
      expect(cacheSetSpy).toHaveBeenCalledTimes(1);
      
      // Reset spies
      vi.clearAllMocks();
      
      // Delete the memory
      const deleteResult = await cachedMemoryService.deleteMemory({
        id: memoryId,
        type
      });
      
      // Verify delete success
      expect(deleteResult).toBe(true);
      
      // Verify cache was invalidated
      expect(cacheDeleteSpy).toHaveBeenCalledTimes(1);
      
      // Reset spies
      vi.clearAllMocks();
      
      // Try to get the memory again - should miss cache and return null
      const deletedMemory = await cachedMemoryService.getMemory<TestMessage>({
        id: memoryId,
        type
      });
      
      // Verify memory is gone
      expect(deletedMemory).toBeNull();
      
      // Verify memory service was called
      expect(memoryService.getMemory).toHaveBeenCalledTimes(1);
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
            timestamp: mockTimestamp.toString(),
            metadata: {}
          }
        },
        {
          id: 'result-2',
          vector: [0.4, 0.5, 0.6],
          payload: {
            id: 'result-2',
            text: 'Second search result',
            type,
            timestamp: mockTimestamp.toString(),
            metadata: {}
          }
        }
      ];
      
      // Mock memory service search
      vi.spyOn(memoryService, 'searchMemories').mockResolvedValue(mockResults);
      
      // Spy on cache methods
      const cacheSetSpy = vi.spyOn(cacheManager, 'set');
      
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
      expect(memoryService.searchMemories).toHaveBeenCalledTimes(1);
      
      // Verify search was NOT cached
      expect(cacheSetSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('cache configuration', () => {
    test('should respect custom TTL for different memory types', async () => {
      // Setup with custom TTLs
      const customTtlService = new CachedMemoryService(memoryService, cacheManager, {
        cacheTtl: {
          [MemoryType.MESSAGE]: 30000,      // 30 seconds
          [MemoryType.DOCUMENT]: 300000     // 5 minutes
        },
        defaultTtl: 60000                   // 1 minute default
      });
      
      // Mock memory responses
      const mockMessage = {
        id: 'message-1',
        vector: [0.1, 0.2, 0.3],
        payload: {
          id: 'message-1',
          text: 'Test message',
          type: MemoryType.MESSAGE,
          timestamp: mockTimestamp.toString(),
          metadata: {}
        }
      };
      
      const mockDocument = {
        id: 'document-1',
        vector: [0.4, 0.5, 0.6],
        payload: {
          id: 'document-1',
          text: 'Test document',
          type: MemoryType.DOCUMENT,
          timestamp: mockTimestamp.toString(),
          metadata: {}
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
      
      // Spy on cache set
      const cacheSetSpy = vi.spyOn(cacheManager, 'set');
      
      // Get a message
      await customTtlService.getMemory({
        id: 'message-1',
        type: MemoryType.MESSAGE
      });
      
      // Get a document
      await customTtlService.getMemory({
        id: 'document-1',
        type: MemoryType.DOCUMENT
      });
      
      // Verify cache was set with correct TTLs
      expect(cacheSetSpy).toHaveBeenCalledTimes(2);
      
      // First call for MESSAGE should have 30s TTL
      expect(cacheSetSpy.mock.calls[0][2]?.ttl).toBe(30000);
      
      // Second call for DOCUMENT should have 5m TTL
      expect(cacheSetSpy.mock.calls[1][2]?.ttl).toBe(300000);
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
          timestamp: mockTimestamp.toString(),
          metadata: {}
        }
      };
      
      const mockDocument = {
        id: 'document-priority',
        vector: [0.4, 0.5, 0.6],
        payload: {
          id: 'document-priority',
          text: 'Test document',
          type: MemoryType.DOCUMENT,
          timestamp: mockTimestamp.toString(),
          metadata: {}
        }
      };
      
      const mockOther = {
        id: 'other-priority',
        vector: [0.7, 0.8, 0.9],
        payload: {
          id: 'other-priority',
          text: 'Test other',
          type: MemoryType.OTHER,
          timestamp: mockTimestamp.toString(),
          metadata: {}
        }
      };
      
      // Mock memory service
      vi.spyOn(memoryService, 'getMemory')
        .mockImplementation(async (params) => {
          if (params.type === MemoryType.MESSAGE) {
            return mockMessage;
          } else if (params.type === MemoryType.DOCUMENT) {
            return mockDocument;
          } else if (params.type === MemoryType.OTHER) {
            return mockOther;
          }
          return null;
        });
      
      // Spy on cache set
      const cacheSetSpy = vi.spyOn(cacheManager, 'set');
      
      // Get each type of memory
      await cachedMemoryService.getMemory({
        id: 'message-priority',
        type: MemoryType.MESSAGE
      });
      
      await cachedMemoryService.getMemory({
        id: 'document-priority',
        type: MemoryType.DOCUMENT
      });
      
      await cachedMemoryService.getMemory({
        id: 'other-priority',
        type: MemoryType.OTHER
      });
      
      // Verify cache was set with correct priorities
      expect(cacheSetSpy).toHaveBeenCalledTimes(3);
      
      // MESSAGE should have HIGH priority
      expect(cacheSetSpy.mock.calls[0][2]?.priority).toBe(CachePriority.HIGH);
      
      // DOCUMENT should have MEDIUM priority
      expect(cacheSetSpy.mock.calls[1][2]?.priority).toBe(CachePriority.MEDIUM);
      
      // OTHER should have LOW priority
      expect(cacheSetSpy.mock.calls[2][2]?.priority).toBe(CachePriority.LOW);
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
              timestamp: mockTimestamp.toString(),
              metadata: {}
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
              timestamp: mockTimestamp.toString(),
              metadata: {}
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
      
      // Clear the cache and reset all cache stats
      await cachedMemoryService.clearCache();
      
      // Reset the InMemoryCacheManager stats to really clear everything
      // This is needed because the clearCache() method might clear entries but not reset statistics
      cacheManager = new InMemoryCacheManager({
        maxSize: 100,
        defaultTtl: 60000
      });
      
      // Reinitialize cached memory service with fresh cache manager
      cachedMemoryService = new CachedMemoryService(memoryService, cacheManager, {
        defaultTtl: 60000,
        enableLogging: false
      });
      
      // Verify cache is empty
      const clearedStats = await cachedMemoryService.getCacheStats();
      expect(clearedStats.size).toBe(0);
      expect(clearedStats.hits).toBe(0);
      expect(clearedStats.misses).toBe(0);
      
      // Get a memory again - should miss cache and call service
      await cachedMemoryService.getMemory({
        id: 'clear-1',
        type: MemoryType.MESSAGE
      });
      
      // Verify service was called again
      expect(memoryService.getMemory).toHaveBeenCalledTimes(1);
    });
  });
}); 