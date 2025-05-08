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
import { COLLECTION_NAMES, MemoryType } from '../../config';
import { generateMemoryPoint } from '../utils/test-data-generator';
import { BaseMemorySchema } from '../../models';

describe('SearchService - Basic Functions', () => {
  // Test setup
  let mockClient: MockMemoryClient;
  let mockEmbeddingService: MockEmbeddingService;
  let memoryService: MemoryService;
  let searchService: SearchService;
  
  beforeEach(() => {
    // Create mocks
    mockClient = new MockMemoryClient();
    mockEmbeddingService = new MockEmbeddingService();
    
    // Mock collection existence check to avoid failures
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
    const mockMemories = [
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
              schemaVersion: '1.0',
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
              schemaVersion: '1.0',
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
            text: 'Architectural design documents need review',
            timestamp: '1625270400000', // 2021-07-03
            type: MemoryType.DOCUMENT,
            metadata: { 
              schemaVersion: '1.0',
              tags: ['architecture', 'design'] 
            }
          }
        },
        score: 0.85,
        type: MemoryType.DOCUMENT,
        collection: COLLECTION_NAMES[MemoryType.DOCUMENT] || 'document_collection'
      },
      {
        point: {
          id: 'memory4',
          vector: [],
          payload: {
            id: 'memory4',
            text: 'Performance testing shows bottlenecks in database queries',
            timestamp: '1625356800000', // 2021-07-04
            type: MemoryType.REFLECTION,
            metadata: { 
              schemaVersion: '1.0',
              tags: ['performance', 'testing'] 
            }
          }
        },
        score: 0.8,
        type: MemoryType.REFLECTION,
        collection: COLLECTION_NAMES[MemoryType.REFLECTION] || 'reflection_collection'
      },
      {
        point: {
          id: 'memory5',
          vector: [],
          payload: {
            id: 'memory5',
            text: 'Need to optimize database indexing for better query performance',
            timestamp: '1625443200000', // 2021-07-05
            type: MemoryType.TASK,
            metadata: { 
              schemaVersion: '1.0',
              tags: ['database', 'optimization'] 
            }
          }
        },
        score: 0.75,
        type: MemoryType.TASK,
        collection: COLLECTION_NAMES[MemoryType.TASK] || 'task_collection'
      }
    ];

    beforeEach(() => {
      // Mock the search method to return our test memories
      vi.spyOn(searchService, 'search').mockResolvedValue(mockMemories as any);
      
      // Mock the filter method to return our test memories
      vi.spyOn(searchService, 'filter').mockResolvedValue(mockMemories as any);
    });

    test('should throw error when neither query nor filter is provided', async () => {
      // Call the function with empty options
      const promise = searchService.getMemoryContext({});
      
      // Expect it to throw an error
      await expect(promise).rejects.toThrow(/Either query or filter must be provided/);
    });

    test('should create memory context with topic-based grouping', async () => {
      // Get memory context with topic grouping (default)
      const result = await searchService.getMemoryContext({
        query: 'project planning',
        maxMemoriesPerGroup: 2,
        numGroups: 3
      });
      
      // Assertions
      expect(result).toHaveProperty('contextId');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('groups');
      expect(result.groups.length).toBeGreaterThan(0);
      expect(result.groups[0]).toHaveProperty('name');
      expect(result.groups[0]).toHaveProperty('description');
      expect(result.groups[0]).toHaveProperty('memories');
      expect(result.groups[0]).toHaveProperty('relevance');
      expect(result.groups[0].memories.length).toBeLessThanOrEqual(2);
    });

    test('should create memory context with type-based grouping', async () => {
      // Get memory context with type grouping
      const result = await searchService.getMemoryContext({
        query: 'project planning',
        groupingStrategy: 'type'
      });
      
      // Assertions for type-based grouping
      expect(result.groups.length).toBeGreaterThan(0);
      
      // Check that group names match memory types
      const groupNames = result.groups.map(g => g.name);
      expect(groupNames).toEqual(expect.arrayContaining([
        MemoryType.MESSAGE.toString(),
        MemoryType.THOUGHT.toString(),
        MemoryType.DOCUMENT.toString(),
        MemoryType.REFLECTION.toString(),
        MemoryType.TASK.toString()
      ]));
      
      // Each group should only contain memories of its type
      for (const group of result.groups) {
        const memoryTypes = new Set(group.memories.map(m => m.type));
        expect(memoryTypes.size).toBe(1);
      }
    });

    test('should create memory context with time-based grouping', async () => {
      // Get memory context with time grouping
      const result = await searchService.getMemoryContext({
        query: 'project planning',
        groupingStrategy: 'time'
      });
      
      // Assertions for time-based grouping
      expect(result.groups.length).toBeGreaterThan(0);
      
      // Check for time-related group names (exact names may vary)
      const groupNames = result.groups.map(g => g.name.toLowerCase());
      
      // Time-based groups should have at least one of these typical time labels
      const hasTimeLabels = groupNames.some(name => 
        name.includes('recent') || 
        name.includes('past') || 
        name.includes('week') || 
        name.includes('month') || 
        name.includes('older')
      );
      
      expect(hasTimeLabels).toBe(true);
    });

    test('should create memory context with custom categories grouping', async () => {
      // Setup custom categories that match our test data
      const categories = ['planning', 'architecture', 'performance'];
      
      // Get memory context with custom grouping
      const result = await searchService.getMemoryContext({
        query: 'project planning',
        groupingStrategy: 'custom',
        includedGroups: categories
      });
      
      // Assertions for custom grouping
      expect(result.groups.length).toBeGreaterThan(0);
      
      // At least some of our categories should be represented in the groups
      const groupNames = result.groups.map(g => g.name.toLowerCase());
      
      // Find overlap between our categories and group names
      const foundCategories = categories.filter(category => 
        groupNames.some(name => name.includes(category.toLowerCase()))
      );
      
      // We should have at least one matching category, or an "Other" category
      expect(foundCategories.length || groupNames.includes('other')).toBeTruthy();
    });

    test('should generate summary when includeSummary is true', async () => {
      // Get memory context with summary
      const result = await searchService.getMemoryContext({
        query: 'project planning',
        includeSummary: true
      });
      
      // Assertions
      expect(result).toHaveProperty('summary');
      expect(typeof result.summary).toBe('string');
      // Only check length if summary is defined
      if (result.summary) {
        expect(result.summary.length).toBeGreaterThan(0);
      }
    });

    test('should apply time weighting when timeWeighted is true', async () => {
      // Mock implementation of applyTimeWeighting
      const applySpy = vi.spyOn(searchService as any, 'applyTimeWeighting');
      
      // Get memory context with time weighting
      await searchService.getMemoryContext({
        query: 'project planning',
        timeWeighted: true
      });
      
      // Assertions
      expect(applySpy).toHaveBeenCalled();
    });

    test('should respect maxMemoriesPerGroup limit', async () => {
      const maxMemories = 2;
      
      // Get memory context with limited memories per group
      const result = await searchService.getMemoryContext({
        query: 'project planning',
        maxMemoriesPerGroup: maxMemories
      });
      
      // Assertions - each group should have at most maxMemories
      for (const group of result.groups) {
        expect(group.memories.length).toBeLessThanOrEqual(maxMemories);
      }
    });

    test('should use filter instead of query when only filter is provided', async () => {
      // Mock the methods
      const searchSpy = vi.spyOn(searchService, 'search');
      const filterSpy = vi.spyOn(searchService, 'filter');
      
      // Get memory context with filter only
      await searchService.getMemoryContext({
        filter: { 'metadata.tags': 'planning' }
      });
      
      // Assertions
      expect(searchSpy).not.toHaveBeenCalled();
      expect(filterSpy).toHaveBeenCalled();
    });

    test('should return empty context when no memories are found', async () => {
      // Mock empty search results
      vi.spyOn(searchService, 'search').mockResolvedValueOnce([]);
      
      // Get memory context
      const result = await searchService.getMemoryContext({
        query: 'nonexistent query'
      });
      
      // Assertions
      expect(result.groups).toEqual([]);
      expect(result).toHaveProperty('contextId');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('Helper Methods', () => {
    test('calculateTextSimilarity should compute Jaccard similarity correctly', () => {
      // Access the private method for testing
      const calculateSimilarity = (searchService as any).calculateTextSimilarity.bind(searchService);
      
      // Test with identical texts
      const similarityIdentical = calculateSimilarity('word1 word2 word3', 'word1 word2 word3');
      expect(similarityIdentical).toBe(1.0);
      
      // Test with no overlap
      const similarityNone = calculateSimilarity('word1 word2 word3', 'word4 word5 word6');
      expect(similarityNone).toBe(0);
      
      // Test with partial overlap
      const similarityPartial = calculateSimilarity('word1 word2 word3', 'word1 word2 word4');
      expect(similarityPartial).toBeCloseTo(0.5, 1); // 2 common out of 4 unique
      
      // Test with empty strings
      const similarityEmpty = calculateSimilarity('', '');
      expect(similarityEmpty).toBe(0);
      
      // Test with one empty string
      const similarityOneEmpty = calculateSimilarity('word1 word2', '');
      expect(similarityOneEmpty).toBe(0);
    });
    
    test('extractTopicName should generate reasonable topic names', () => {
      // Access the private method for testing
      const extractTopicName = (searchService as any).extractTopicName.bind(searchService);
      
      // Test with normal text
      const topic1 = extractTopicName('Project planning meeting notes', 'Fallback');
      expect(topic1).toBe('Project Planning Meeting');
      
      // Test with short text
      const topic2 = extractTopicName('Database optimization', 'Fallback');
      expect(topic2).toBe('Database Optimization');
      
      // Test with very short text
      const topic3 = extractTopicName('Testing', 'Fallback');
      expect(topic3).toBe('Fallback');
      
      // Test with empty text
      const topic4 = extractTopicName('', 'Fallback');
      expect(topic4).toBe('Fallback');
    });
    
    test('generateTopicDescription should create appropriate descriptions', () => {
      // Access the private method for testing
      const generateDescription = (searchService as any).generateTopicDescription.bind(searchService);
      
      // Test with normal text
      const desc1 = generateDescription('This is a test description for a topic. It should be truncated.');
      expect(desc1).toContain('Memories related to:');
      expect(desc1).toContain('This is a test description for a topic');
      
      // Test with empty text
      const desc2 = generateDescription('');
      expect(desc2).toBe('Group of related memories');
      
      // Test with long text
      const longText = 'A'.repeat(150);
      const desc3 = generateDescription(longText);
      expect(desc3.length).toBeLessThan(longText.length);
      expect(desc3).toContain('...');
    });
  });
}); 