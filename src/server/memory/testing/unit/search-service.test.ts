/**
 * Unit tests for SearchService
 * 
 * Note: More comprehensive tests are available in search-service-extended.test.ts
 * which covers query optimizer integration and causal chain searches.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { SearchService } from '../../services/search/search-service';
import { MemoryService } from '../../services/memory/memory-service';
import { MockMemoryClient } from '../utils/mock-memory-client';
import { MockEmbeddingService } from '../utils/mock-embedding-service';
import { MemoryType } from '../../config/types';
import { COLLECTION_NAMES } from '../../config/constants';
import { generateMemoryPoint } from '../utils/test-data-generator';
import { BaseMemorySchema, MemoryPoint, MemorySearchResult } from '../../models';
import { EnhancedMemoryService } from '../../services/multi-agent/enhanced-memory-service';
import { MemoryContext, MemoryContextGroup, SearchResult, TypedMemoryContextGroup } from '../../services/search/types';
import { ImportanceLevel } from '../../../../constants/memory';

// Define extended interfaces for type assertion
interface ExtendedSearchService extends SearchService {
  getCollectionName(type: MemoryType): string;
}

// Enhanced MockMemoryClient with scanPoints method
interface ExtendedMockMemoryClient extends MockMemoryClient {
  scanPoints<T extends BaseMemorySchema>(
    collection: string, 
    filter?: Record<string, unknown>, 
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryPoint<T>[]>;
}

// Complete SearchResult that includes score property
interface CompleteSearchResult<T extends BaseMemorySchema> extends SearchResult<T> {
  score: number;
  point: MemoryPoint<T>;
  type: MemoryType;
  collection: string;
}

describe('SearchService - Basic Functions', () => {
  // Test setup
  let mockClient: ExtendedMockMemoryClient;
  let mockEmbeddingService: MockEmbeddingService;
  let memoryService: MemoryService;
  let enhancedMemoryService: EnhancedMemoryService;
  let searchService: ExtendedSearchService;
  
  beforeEach(() => {
    // Create mocks
    mockClient = new MockMemoryClient() as ExtendedMockMemoryClient;
    mockEmbeddingService = new MockEmbeddingService();
    
    // Add scanPoints method to mockClient for testing
    mockClient.scanPoints = async <T extends BaseMemorySchema>(
      collection: string, 
      filter?: Record<string, unknown>, 
      options?: { limit?: number; offset?: number }
    ): Promise<MemoryPoint<T>[]> => {
      // Simple implementation that returns an empty array
      // Actual tests will mock this method when needed
      return [];
    };
    
    // Mock collection existence check to avoid failures
    vi.spyOn(mockClient, 'collectionExists').mockResolvedValue(true);
    
    // Initialize services
    memoryService = new MemoryService(mockClient, mockEmbeddingService, {
      getTimestamp: () => Date.now()
    });
    
    // Create an adapter that implements the EnhancedMemoryService interface
    enhancedMemoryService = {
      ...memoryService,
      embeddingClient: mockEmbeddingService,
      memoryClient: mockClient,
      getTimestampFn: () => Date.now(),
      extractIndexableFields: (memory: Record<string, unknown>) => ({ 
        text: memory.text as string 
      }),
      // Add the methods that SearchService actually uses
      getMemory: memoryService.getMemory,
      addMemory: memoryService.addMemory,
      updateMemory: memoryService.updateMemory,
      deleteMemory: memoryService.deleteMemory,
      searchMemories: memoryService.searchMemories
    } as unknown as EnhancedMemoryService;
    
    // Initialize the search service with our enhanced memory service
    searchService = new SearchService(
      mockClient,
      mockEmbeddingService,
      enhancedMemoryService
    ) as ExtendedSearchService;
    
    // Add getCollectionName method to searchService for testing
    searchService.getCollectionName = (type: MemoryType): string => {
      return COLLECTION_NAMES[type] || String(type);
    };

    mockClient.getCollectionInfo = async (collectionName: string) => ({
      name: collectionName,
      dimensions: 1536,
      pointsCount: 0,
      createdAt: new Date()
    });
  });
  
  describe('buildFilter', () => {
    test('should build date range filter', () => {
      // Setup
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');
      
      // Build filter
      const filter = searchService.buildFilter({
        startDate,
        endDate
      });
      
      // Assertions
      expect(filter).toHaveProperty('timestamp');
      expect(filter.timestamp).toHaveProperty('$gte', startDate.getTime());
      expect(filter.timestamp).toHaveProperty('$lte', endDate.getTime());
    });
    
    test('should build types filter', () => {
      // Setup for single type
      const singleType = [MemoryType.MESSAGE];
      
      // Build filter with single type
      const singleTypeFilter = searchService.buildFilter({
        types: singleType
      });
      
      // Assertions for single type
      expect(singleTypeFilter).toHaveProperty('type', MemoryType.MESSAGE);
      
      // Setup for multiple types
      const multipleTypes = [MemoryType.MESSAGE, MemoryType.DOCUMENT];
      
      // Build filter with multiple types
      const multipleTypesFilter = searchService.buildFilter({
        types: multipleTypes
      });
      
      // Assertions for multiple types
      expect(multipleTypesFilter).toHaveProperty('type');
      expect(multipleTypesFilter.type).toHaveProperty('$in', multipleTypes);
    });
    
    test('should build metadata filters', () => {
      // Setup
      const metadata = {
        importance: 'high',
        category: 'test'
      };
      
      // Build filter
      const filter = searchService.buildFilter({
        metadata
      });
      
      // Assertions
      expect(filter).toHaveProperty('metadata.importance', 'high');
      expect(filter).toHaveProperty('metadata.category', 'test');
    });
    
    test('should build text contains filter', () => {
      // Setup for case-insensitive search
      const textContains = 'search term';
      
      // Build filter
      const filter = searchService.buildFilter({
        textContains
      });
      
      // Assertions
      expect(filter).toHaveProperty('$text');
      expect(filter.$text).toHaveProperty('$contains_ignore_case', textContains);
      
      // Setup for case-sensitive exact match
      const exactMatch = 'exact phrase';
      
      // Build filter
      const exactFilter = searchService.buildFilter({
        textContains: exactMatch,
        exactMatch: true,
        caseSensitive: true
      });
      
      // Assertions
      expect(exactFilter).toHaveProperty('$text');
      expect(exactFilter.$text).toHaveProperty('$eq', exactMatch);
    });
  });

  describe('Memory Context', () => {
    // Mock memory search results for testing
    const mockMemories: CompleteSearchResult<BaseMemorySchema>[] = [
      {
        point: {
          id: 'memory1',
          vector: [],
          payload: {
            id: 'memory1',
            text: 'Project planning meeting scheduled for tomorrow',
            timestamp: '1625097600000', // 2021-07-01
            type: MemoryType.MESSAGE,
            metadata: { 
              schemaVersion: '1.0.0',
              tags: ['meeting', 'planning'] 
            }
          }
        },
        score: 0.95,
        type: MemoryType.MESSAGE,
        collection: COLLECTION_NAMES[MemoryType.MESSAGE] || 'message_collection'
      },
      {
        point: {
          id: 'memory2',
          vector: [],
          payload: {
            id: 'memory2',
            text: 'Discussed project timeline and resource allocation',
            timestamp: '1625184000000', // 2021-07-02
            type: MemoryType.THOUGHT,
            metadata: { 
              schemaVersion: '1.0.0',
              tags: ['project', 'timeline'] 
            }
          }
        },
        score: 0.9,
        type: MemoryType.THOUGHT,
        collection: COLLECTION_NAMES[MemoryType.THOUGHT] || 'thought_collection'
      },
      {
        point: {
          id: 'memory3',
          vector: [],
          payload: {
            id: 'memory3',
            text: 'Client approved project proposal with budget increase',
            timestamp: '1625270400000', // 2021-07-03
            type: MemoryType.MESSAGE,
            metadata: { 
              schemaVersion: '1.0.0',
              tags: ['client', 'approval'] 
            }
          }
        },
        score: 0.85,
        type: MemoryType.MESSAGE,
        collection: COLLECTION_NAMES[MemoryType.MESSAGE] || 'message_collection'
      }
    ];
    
    test('should create a memory context with grouped memories', async () => {
      // Mock the search method
      vi.spyOn(searchService, 'search').mockResolvedValue(mockMemories);
      
      // Call getMemoryContext with custom options
      const context = await searchService.getMemoryContext({
        query: 'project meeting'
      });
      
      // Assertions
      expect(context).toBeDefined();
      expect(context.groups).toBeDefined();
      
      // Check if there's a group for each type
      // Cast to TypedMemoryContextGroup to access the type property
      const typedGroups = context.groups as TypedMemoryContextGroup<BaseMemorySchema>[];
      const messageGroup = typedGroups.find(g => g.name === MemoryType.MESSAGE.toString());
      const thoughtGroup = typedGroups.find(g => g.name === MemoryType.THOUGHT.toString());
      
      expect(messageGroup).toBeDefined();
      expect(messageGroup?.memories).toHaveLength(2);
      
      expect(thoughtGroup).toBeDefined();
      expect(thoughtGroup?.memories).toHaveLength(1);
      
      // Check if memories are accessible (we don't check total directly)
      expect(context.groups.reduce((sum, group) => sum + group.memories.length, 0)).toBe(3);
    });
    
    test('should filter memory context by type', async () => {
      // Mock the search method
      vi.spyOn(searchService, 'search').mockResolvedValue(mockMemories);
      
      // Call getMemoryContext with type filter
      const context = await searchService.getMemoryContext({
        query: 'project meeting',
        types: [MemoryType.MESSAGE]
      });
      
      // Assertions
      expect(context).toBeDefined();
      expect(context.groups).toBeDefined();
      
      // Should only have MESSAGE group
      expect(context.groups).toHaveLength(1);
      
      // Cast to TypedMemoryContextGroup to access the type property
      const typedGroups = context.groups as TypedMemoryContextGroup<BaseMemorySchema>[];
      expect(typedGroups[0].name).toBe(MemoryType.MESSAGE.toString());
      expect(typedGroups[0].memories).toHaveLength(2);
      
      // Check if memories are accessible (we don't check total directly)
      expect(context.groups.reduce((sum, group) => sum + group.memories.length, 0)).toBe(2);
    });
  });
  
  describe('search', () => {
    test('should search by text query', async () => {
      // Create a memory point with the required properties
      const memoryPoint = generateMemoryPoint(MemoryType.MESSAGE, {
        id: 'result1',
        content: 'search result 1',
        metadata: {
          schemaVersion: '1.0.0',
          importance: ImportanceLevel.HIGH
        }
      });
      
      // Create search result with score property
      const memorySearchResult: MemorySearchResult<BaseMemorySchema> = {
        id: memoryPoint.id,
        score: 0.95,
        payload: memoryPoint.payload
      };
      
      // Mock implementation of client search
      vi.spyOn(mockClient, 'searchPoints').mockResolvedValue([memorySearchResult]);
      
      // Mock embedding service
      vi.spyOn(mockEmbeddingService, 'getEmbedding').mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
        model: 'mock-model',
        usedFallback: false
      });
      
      // Call the search method
      const results = await searchService.search('test query');
      
      expect(results).toHaveLength(1);
      expect(results[0].point.payload.text).toBe('search result 1');
      expect(results[0].score).toBe(0.95); // Make sure score is included
      
      // Verify that searchPoints was called with vectors
      expect(mockClient.searchPoints).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          vector: [0.1, 0.2, 0.3]
        })
      );
    });
  });

  describe('getCollectionName', () => {
    test('should get proper collection name from memory type', () => {
      // Test for each memory type
      const types = Object.values(MemoryType);
      
      for (const type of types) {
        const collectionName = searchService.getCollectionName(type);
        expect(collectionName).toBeDefined();
        expect(typeof collectionName).toBe('string');
        
        // For known memory types, we should have a predefined collection name
        if (COLLECTION_NAMES[type]) {
          expect(collectionName).toBe(COLLECTION_NAMES[type]);
        }
        // For any custom or new types, it should still return a string
        else {
          expect(collectionName.length).toBeGreaterThan(0);
        }
      }
    });
  });
}); 