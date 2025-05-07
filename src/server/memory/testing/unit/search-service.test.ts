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
}); 