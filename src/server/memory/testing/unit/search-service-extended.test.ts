/**
 * Extended Unit Tests for SearchService
 * 
 * These tests focus on functionality not covered in the main search-service.test.ts:
 * - Query optimizer integration
 * - Causal chain search
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { SearchService } from '../../services/search/search-service';
import { MemoryService } from '../../services/memory/memory-service';
import { MockMemoryClient } from '../utils/mock-memory-client';
import { MockEmbeddingService } from '../utils/mock-embedding-service';
import { COLLECTION_NAMES, MemoryType } from '../../config';
import { generateMemoryPoint } from '../utils/test-data-generator';
import { BaseMemorySchema } from '../../models';
import { IQueryOptimizer, QueryOptimizationStrategy } from '../../services/query/types';

// Mock query optimizer
class MockQueryOptimizer implements IQueryOptimizer {
  query = vi.fn().mockImplementation(() => Promise.resolve({
    results: [
      {
        id: 'optimized-result-1',
        text: 'Optimized result 1',
        score: 0.95,
        metadata: {
          type: MemoryType.MESSAGE,
          id: 'optimized-result-1',
          text: 'Optimized result 1',
          timestamp: Date.now().toString(),
          metadata: { schemaVersion: '1.0' }
        }
      },
      {
        id: 'optimized-result-2',
        text: 'Optimized result 2',
        score: 0.85,
        metadata: {
          type: MemoryType.DOCUMENT,
          id: 'optimized-result-2',
          text: 'Optimized result 2',
          timestamp: Date.now().toString(),
          metadata: { schemaVersion: '1.0' }
        }
      }
    ],
    totalMatches: 2,
    truncated: false,
    executionTimeMs: 15
  }));
  
  suggestQueries = vi.fn().mockImplementation(() => Promise.resolve([
    'suggested query 1',
    'suggested query 2'
  ]));
  
  analyzeQuery = vi.fn().mockImplementation(() => QueryOptimizationStrategy.BALANCED);
  
  clearCache = vi.fn().mockImplementation(() => Promise.resolve(true));
}

describe('SearchService - Extended Tests', () => {
  // Test setup
  let mockClient: MockMemoryClient;
  let mockEmbeddingService: MockEmbeddingService;
  let mockQueryOptimizer: MockQueryOptimizer;
  let memoryService: MemoryService;
  let searchService: SearchService;
  
  beforeEach(() => {
    // Create mocks
    mockClient = new MockMemoryClient();
    mockEmbeddingService = new MockEmbeddingService();
    mockQueryOptimizer = new MockQueryOptimizer();
    
    // Mock collectionExists to return true
    vi.spyOn(mockClient, 'collectionExists').mockResolvedValue(true);
    
    // Initialize services
    // @ts-ignore - MockEmbeddingService needs to be compatible with EmbeddingService
    memoryService = new MemoryService(mockClient, mockEmbeddingService, {
      getTimestamp: () => Date.now()
    });
    
    // @ts-ignore - MockEmbeddingService needs to be compatible with EmbeddingService
    searchService = new SearchService(
      mockClient,
      mockEmbeddingService,
      memoryService
    );
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Query Optimizer Integration', () => {
    test('should set and use query optimizer', async () => {
      // Set the query optimizer
      searchService.setQueryOptimizer(mockQueryOptimizer);
      
      // Perform search using a single memory type to trigger optimizer
      const query = 'test with optimizer';
      const results = await searchService.search(query, {
        types: [MemoryType.MESSAGE]
      });
      
      // Verify query optimizer was called
      expect(mockQueryOptimizer.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query,
          collection: COLLECTION_NAMES[MemoryType.MESSAGE]
        }),
        undefined
      );
      
      // Verify results
      expect(results).toHaveLength(2);
      expect(results[0].point.payload.text).toBe('Optimized result 1');
    });
    
    test('should use HIGH_QUALITY strategy when specified', async () => {
      // Set the query optimizer
      searchService.setQueryOptimizer(mockQueryOptimizer);
      
      // Perform search with highQuality option
      await searchService.search('high quality search', {
        types: [MemoryType.DOCUMENT],
        highQuality: true
      });
      
      // Verify query optimizer was called with HIGH_QUALITY strategy
      expect(mockQueryOptimizer.query).toHaveBeenCalledWith(
        expect.anything(),
        QueryOptimizationStrategy.HIGH_QUALITY
      );
    });
    
    test('should use HIGH_SPEED strategy when specified', async () => {
      // Set the query optimizer
      searchService.setQueryOptimizer(mockQueryOptimizer);
      
      // Perform search with highSpeed option
      await searchService.search('fast search', {
        types: [MemoryType.DOCUMENT],
        highSpeed: true
      });
      
      // Verify query optimizer was called with HIGH_SPEED strategy
      expect(mockQueryOptimizer.query).toHaveBeenCalledWith(
        expect.anything(),
        QueryOptimizationStrategy.HIGH_SPEED
      );
    });
    
    test('should fall back to standard search when optimizer fails', async () => {
      // Set the query optimizer but make it fail
      searchService.setQueryOptimizer(mockQueryOptimizer);
      mockQueryOptimizer.query.mockRejectedValueOnce(new Error('Optimizer failed'));
      
      // Mock standard search methods
      vi.spyOn(mockEmbeddingService, 'getEmbedding').mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
        model: 'mock-model',
        usedFallback: false
      });
      
      vi.spyOn(mockClient, 'searchPoints').mockResolvedValue([
        {
          id: 'fallback-result',
          score: 0.8,
          payload: {
            text: 'Fallback result',
            type: MemoryType.MESSAGE,
            timestamp: Date.now().toString(),
            id: 'fallback-result',
            metadata: { schemaVersion: '1.0' }
          }
        }
      ]);
      
      // Perform search with a failing optimizer
      const results = await searchService.search('fallback search', {
        types: [MemoryType.MESSAGE]
      });
      
      // Verify optimizer was called but fallback worked
      expect(mockQueryOptimizer.query).toHaveBeenCalled();
      expect(mockClient.searchPoints).toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].point.payload.text).toBe('Fallback result');
    });
  });
  
  describe('searchCausalChain', () => {
    beforeEach(() => {
      // Add spy for search method
      vi.spyOn(searchService, 'search');
    });

    test('should retrieve causal chain for a memory', async () => {
      // Create test memory with text property
      const originMemory = {
        id: 'memory-id',
        vector: [],
        payload: {
          text: 'Origin memory',
          type: MemoryType.MESSAGE,
          id: 'memory-id',
          timestamp: Date.now().toString(),
          metadata: { schemaVersion: '1.0' }
        }
      };
      
      vi.spyOn(memoryService, 'getMemory').mockResolvedValue({
        ...originMemory,
        // Add content property for the causal chain to access
        content: 'Origin memory'
      } as any);
      
      // Mock search method for related memories
      vi.spyOn(searchService, 'search').mockResolvedValue([
        {
          point: {
            id: 'thought-1',
            vector: [],
            payload: {
              text: 'Related thought 1',
              type: MemoryType.THOUGHT,
              id: 'thought-1',
              timestamp: Date.now().toString(),
              metadata: { schemaVersion: '1.0' }
            } as BaseMemorySchema
          },
          score: 0.9,
          type: MemoryType.THOUGHT,
          collection: COLLECTION_NAMES[MemoryType.THOUGHT] as string
        },
        {
          point: {
            id: 'message-1',
            vector: [],
            payload: {
              text: 'Related message 1',
              type: MemoryType.MESSAGE, 
              id: 'message-1',
              timestamp: Date.now().toString(),
              metadata: { schemaVersion: '1.0' }
            } as BaseMemorySchema
          },
          score: 0.8,
          type: MemoryType.MESSAGE,
          collection: COLLECTION_NAMES[MemoryType.MESSAGE] as string
        },
        {
          point: {
            id: 'thought-2',
            vector: [],
            payload: {
              text: 'Related thought 2',
              type: MemoryType.THOUGHT,
              id: 'thought-2',
              timestamp: Date.now().toString(),
              metadata: { schemaVersion: '1.0' }
            } as BaseMemorySchema
          },
          score: 0.7,
          type: MemoryType.THOUGHT,
          collection: COLLECTION_NAMES[MemoryType.THOUGHT] as string
        },
        {
          point: {
            id: 'message-2',
            vector: [],
            payload: {
              text: 'Related message 2',
              type: MemoryType.MESSAGE,
              id: 'message-2',
              timestamp: Date.now().toString(),
              metadata: { schemaVersion: '1.0' }
            } as BaseMemorySchema
          },
          score: 0.6,
          type: MemoryType.MESSAGE,
          collection: COLLECTION_NAMES[MemoryType.MESSAGE] as string
        }
      ]);
      
      // Get causal chain
      const result = await searchService.searchCausalChain('memory-id', {
        maxDepth: 1,
        direction: 'both'
      });
      
      // Verify result structure
      expect(result).toHaveProperty('origin');
      expect(result).toHaveProperty('causes');
      expect(result).toHaveProperty('effects');
      
      // Should have causes and effects
      expect(result.causes.length).toBeGreaterThan(0);
      expect(result.effects.length).toBeGreaterThan(0);
      
      // Verify memory service was called
      expect(memoryService.getMemory).toHaveBeenCalledWith({
        id: 'memory-id',
        type: MemoryType.MESSAGE
      });
      
      // Verify search was called with origin content
      expect(searchService.search).toHaveBeenCalledWith('Origin memory', {
        limit: 10,
        types: [MemoryType.THOUGHT, MemoryType.MESSAGE]
      });
    });
    
    test('should handle missing origin memory', async () => {
      // Mock memory service to return null (memory not found)
      vi.spyOn(memoryService, 'getMemory').mockResolvedValue(null);
      
      // Get causal chain for non-existent memory
      const result = await searchService.searchCausalChain('non-existent-id');
      
      // Verify result structure for missing memory
      expect(result).toHaveProperty('origin');
      expect(result.origin.id).toBe('non-existent-id');
      expect(result.causes).toHaveLength(0);
      expect(result.effects).toHaveLength(0);
      
      // Search should not have been called
      expect(searchService.search).not.toHaveBeenCalled();
    });
    
    test('should handle search errors gracefully', async () => {
      // Mock memory retrieval with content property
      const originMemory = {
        id: 'error-memory-id',
        vector: [],
        payload: {
          text: 'Origin memory with error',
          type: MemoryType.MESSAGE,
          id: 'error-memory-id',
          timestamp: Date.now().toString(),
          metadata: { schemaVersion: '1.0' }
        }
      };
      
      vi.spyOn(memoryService, 'getMemory').mockResolvedValue({
        ...originMemory,
        content: 'Origin memory with error'
      } as any);
      
      // Mock search to throw an error
      vi.spyOn(searchService, 'search').mockRejectedValue(
        new Error('Search failed')
      );
      
      // Get causal chain with failing search
      const result = await searchService.searchCausalChain('error-memory-id');
      
      // Should return basic structure with empty arrays
      expect(result).toHaveProperty('origin');
      expect(result.origin.id).toBe('error-memory-id');
      expect(result.causes).toHaveLength(0);
      expect(result.effects).toHaveLength(0);
    });
  });
}); 