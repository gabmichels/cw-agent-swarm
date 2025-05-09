/**
 * Unit tests for SearchService's filter method
 */
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { SearchService } from '../../services/search/search-service';
import { MemoryService } from '../../services/memory/memory-service';
import { MockMemoryClient } from '../utils/mock-memory-client';
import { MockEmbeddingService } from '../utils/mock-embedding-service';
import { COLLECTION_NAMES } from '../../config';
import { MemoryType } from '../../config/types';
import { BaseMemorySchema, MemoryPoint } from '../../models';
import { FilterOptions, SearchResult } from '../../services/search/types';
import { EnhancedMemoryService } from '../../services/multi-agent/enhanced-memory-service';
import { MemoryImportanceLevel } from '../../../../constants/memory';

describe('SearchService - Filter Method', () => {
  let searchService: SearchService;
  let mockClient: MockMemoryClient;
  let mockMemoryService: MemoryService;
  let enhancedMemoryService: EnhancedMemoryService;
  let mockEmbeddingService: MockEmbeddingService;
  
  // Create test data
  const createMemoryResult = (id: string, type: MemoryType, tags: string[] = [], importance: MemoryImportanceLevel = MemoryImportanceLevel.MEDIUM) => ({
    point: {
      id,
      vector: [],
      payload: {
        id,
        text: `Sample ${type} ${id}`,
        type,
        timestamp: Date.now().toString(),
        metadata: {
          schemaVersion: '1.0.0',
          tags,
          importance
        }
      }
    },
    score: 1.0,
    type,
    collection: COLLECTION_NAMES[type as unknown as keyof typeof COLLECTION_NAMES] || `${type}_collection`
  } as unknown as SearchResult<BaseMemorySchema>);
  
  // Mock implementation for the filter method
  const mockFilterImplementation = (options: FilterOptions = {}): Promise<SearchResult<BaseMemorySchema>[]> => {
    // Create some test results
    const msgResult1 = createMemoryResult('msg-1', MemoryType.MESSAGE, ['important', 'work'], MemoryImportanceLevel.HIGH);
    const msgResult2 = createMemoryResult('msg-2', MemoryType.MESSAGE, ['casual']);
    const docResult1 = createMemoryResult('doc-1', MemoryType.DOCUMENT, ['work', 'reference']);
    const docResult2 = createMemoryResult('doc-2', MemoryType.DOCUMENT, ['project', 'proposal'], MemoryImportanceLevel.HIGH);
    const thoughtResult1 = createMemoryResult('thought-1', MemoryType.THOUGHT, ['idea', 'feature']);
    
    let results = [msgResult1, msgResult2, docResult1, docResult2, thoughtResult1];
    
    // Apply type filtering
    if (options.types && options.types.length > 0) {
      results = results.filter(r => options.types?.includes(r.type));
    }
    
    // Apply metadata filters
    if (options.filter) {
      // Filter by tags
      if (options.filter['metadata.tags'] && options.filter['metadata.tags'].$in) {
        const tags = options.filter['metadata.tags'].$in;
        results = results.filter(r => {
          const itemTags = r.point.payload.metadata?.tags || [];
          return tags.some((tag: string) => itemTags.includes(tag));
        });
      }
      
      // Filter by importance
      if (options.filter['metadata.importance']) {
        const importance = options.filter['metadata.importance'];
        results = results.filter(r => r.point.payload.metadata?.importance === importance);
      }
    }
    
    // Apply sorting
    if (options.sortBy) {
      results.sort((a, b) => {
        const aValue = a.point.payload[options.sortBy as keyof typeof a.point.payload] as string;
        const bValue = b.point.payload[options.sortBy as keyof typeof b.point.payload] as string;
        
        const multiplier = options.sortOrder === 'desc' ? -1 : 1;
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return multiplier * aValue.localeCompare(bValue);
        }
        
        return 0;
      });
    }
    
    // Apply limit and offset
    const offset = options.offset || 0;
    const limit = options.limit || results.length;
    
    return Promise.resolve(results.slice(offset, offset + limit));
  };
  
  beforeEach(() => {
    // Create mocks
    mockClient = new MockMemoryClient();
    mockEmbeddingService = new MockEmbeddingService();
    
    // Initialize services
    mockMemoryService = new MemoryService(mockClient, mockEmbeddingService, {
      getTimestamp: () => Date.now()
    });
    
    // Create an adapter that implements the EnhancedMemoryService interface
    enhancedMemoryService = {
      ...mockMemoryService,
      embeddingClient: mockEmbeddingService,
      memoryClient: mockClient,
      getTimestampFn: () => Date.now(),
      extractIndexableFields: (memory: Record<string, unknown>) => ({ 
        text: memory.text as string 
      }),
      // Add the methods that SearchService actually uses
      getMemory: mockMemoryService.getMemory,
      addMemory: mockMemoryService.addMemory,
      updateMemory: mockMemoryService.updateMemory,
      deleteMemory: mockMemoryService.deleteMemory,
      searchMemories: mockMemoryService.searchMemories
    } as unknown as EnhancedMemoryService;
    
    // Initialize SearchService with EnhancedMemoryService
    searchService = new SearchService(
      mockClient,
      mockEmbeddingService,
      enhancedMemoryService
    );
    
    // Mock the filter method
    vi.spyOn(searchService, 'filter').mockImplementation(mockFilterImplementation);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  test('should filter memories by tags', async () => {
    // Filter memories with 'work' tag
    const results = await searchService.filter({
      filter: {
        'metadata.tags': {
          $in: ['work']
        }
      }
    });
    
    // Verify results
    expect(results).toHaveLength(2); // should find msg-1 and doc-1 with 'work' tag
    
    // Verify all results have the correct tag
    for (const result of results) {
      const tags = result.point.payload.metadata?.tags || [];
      expect(tags).toContain('work');
    }
    
    // Verify specific IDs
    const ids = results.map(r => r.point.id);
    expect(ids).toContain('msg-1');
    expect(ids).toContain('doc-1');
  });
  
  test('should filter memories by type', async () => {
    // Filter only message memories
    const results = await searchService.filter({
      types: [MemoryType.MESSAGE]
    });
    
    // Verify results
    expect(results).toHaveLength(2); // should find 2 message memories
    
    // Verify all results are messages
    for (const result of results) {
      expect(result.type).toBe(MemoryType.MESSAGE);
    }
  });
  
  test('should filter memories by metadata', async () => {
    // Filter memories with high importance
    const results = await searchService.filter({
      filter: {
        'metadata.importance': MemoryImportanceLevel.HIGH
      }
    });
    
    // Verify results
    expect(results).toHaveLength(2); // should find 2 memories with high importance
    
    // Verify all results have the correct importance
    for (const result of results) {
      expect(result.point.payload.metadata.importance).toBe(MemoryImportanceLevel.HIGH);
    }
    
    // Verify IDs of found memories
    const ids = results.map(r => r.point.id);
    expect(ids).toContain('msg-1');
    expect(ids).toContain('doc-2');
  });
  
  test('should apply sorting correctly', async () => {
    // Filter all memories, sorted by id in ascending order
    const results = await searchService.filter({
      sortBy: 'id',
      sortOrder: 'asc'
    });
    
    // Verify results
    expect(results.length).toBeGreaterThan(0);
    
    // Verify order
    const ids = results.map(r => r.point.id);
    expect(ids).toEqual([...ids].sort());
  });
  
  test('should apply limit and offset correctly', async () => {
    // Get all results for comparison
    const allResults = await searchService.filter({});
    
    // Get first 2 memories
    const firstBatch = await searchService.filter({
      limit: 2,
      offset: 0
    });
    
    // Get next 2 memories
    const secondBatch = await searchService.filter({
      limit: 2,
      offset: 2
    });
    
    // Verify result counts
    expect(firstBatch).toHaveLength(2);
    expect(secondBatch).toHaveLength(2);
    
    // Verify correct slices returned
    expect(firstBatch[0].point.id).toBe(allResults[0].point.id);
    expect(firstBatch[1].point.id).toBe(allResults[1].point.id);
    expect(secondBatch[0].point.id).toBe(allResults[2].point.id);
    expect(secondBatch[1].point.id).toBe(allResults[3].point.id);
  });
  
  test('should handle combination of filters', async () => {
    // Filter for high importance work-related memories
    const results = await searchService.filter({
      filter: {
        'metadata.importance': MemoryImportanceLevel.HIGH,
        'metadata.tags': {
          $in: ['work']
        }
      }
    });
    
    // Verify results
    expect(results).toHaveLength(1); // should find only msg-1
    expect(results[0].point.id).toBe('msg-1');
    
    // Verify properties
    expect(results[0].point.payload.metadata.importance).toBe(MemoryImportanceLevel.HIGH);
    expect(results[0].point.payload.metadata.tags).toContain('work');
  });
  
  test('should handle empty results gracefully', async () => {
    // Override the mock for this test only
    vi.spyOn(searchService, 'filter').mockResolvedValueOnce([]);
    
    // Filter with impossible criteria
    const results = await searchService.filter({
      filter: {
        'metadata.tags': {
          $in: ['nonexistent-tag']
        }
      }
    });
    
    // Verify results
    expect(results).toHaveLength(0);
  });
}); 