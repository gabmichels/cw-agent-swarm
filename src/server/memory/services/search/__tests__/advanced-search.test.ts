/**
 * Advanced Search Service Tests
 * 
 * Basic test suite for advanced search features
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedSearchService, AdvancedSearchParams } from '../advanced-search-service';
import { SearchService } from '../search-service';
import { EnhancedMemoryService } from '../../multi-agent/enhanced-memory-service';
import { EmbeddingService } from '../../client/embedding-service';
import { IMemoryClient } from '../../client/types';
import { MemoryType } from '../../../config/types';
import { BaseMemorySchema } from '../../../models/base-schema';

// Mock implementations
const mockSearchService = {
  search: vi.fn(),
  hybridSearch: vi.fn()
} as unknown as SearchService;

const mockEnhancedMemoryService = {
  searchMemories: vi.fn()
} as unknown as EnhancedMemoryService;

const mockEmbeddingService = {
  getEmbedding: vi.fn()
} as unknown as EmbeddingService;

const mockMemoryClient = {
  searchPoints: vi.fn(),
  scrollPoints: vi.fn()
} as unknown as IMemoryClient;

// Test data interfaces
interface TestMemorySchema extends BaseMemorySchema {
  text: string;
  title?: string;
  tags?: string[];
  importance?: 'low' | 'medium' | 'high';
  timestamp: string;
}

// Sample test data
const sampleSearchResults = [
  {
    point: {
      id: 'test-id-1',
      vector: [],
      payload: {
        text: 'This is a test document about machine learning algorithms',
        title: 'ML Algorithms Guide',
        tags: ['machine-learning', 'algorithms'],
        importance: 'high',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago as string
      }
    },
    score: 0.9,
    type: MemoryType.DOCUMENT,
    collection: 'documents'
  }
];

const sampleEnhancedMemoryResults = [
  {
    id: 'enhanced-1',
    vector: [],
    payload: {
      text: 'Advanced search techniques for information retrieval',
      title: 'Search Techniques',
      importance: 'high',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago as string
    }
  }
];

describe('AdvancedSearchService', () => {
  let advancedSearchService: AdvancedSearchService;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create service instance
    advancedSearchService = new AdvancedSearchService(
      mockSearchService,
      mockEnhancedMemoryService,
      mockEmbeddingService,
      mockMemoryClient
    );
  });

  describe('Basic Search Functionality', () => {
    it('should create advanced search service instance', () => {
      expect(advancedSearchService).toBeDefined();
      expect(typeof advancedSearchService.search).toBe('function');
      expect(typeof advancedSearchService.getSuggestions).toBe('function');
      expect(typeof advancedSearchService.getSearchAnalytics).toBe('function');
    });

    it('should perform advanced search with multiple strategies', async () => {
      // Setup mocks
      (mockSearchService.search as any).mockResolvedValue(sampleSearchResults);
      (mockSearchService.hybridSearch as any).mockResolvedValue(sampleSearchResults);
      (mockEnhancedMemoryService.searchMemories as any).mockResolvedValue(sampleEnhancedMemoryResults);

      const params: AdvancedSearchParams = {
        query: 'machine learning algorithms',
        types: [MemoryType.DOCUMENT],
        limit: 10,
        enableSuggestions: true,
        enableRanking: true
      };

      const result = await advancedSearchService.search<TestMemorySchema>(params);

      // Verify search was executed
      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.analytics).toBeDefined();
      
      // Verify multiple search strategies were called
      expect(mockSearchService.search).toHaveBeenCalled();
      expect(mockSearchService.hybridSearch).toHaveBeenCalled();
      expect(mockEnhancedMemoryService.searchMemories).toHaveBeenCalled();
    });

    it('should handle search failures gracefully with fallback', async () => {
      // Setup mocks to fail initially
      (mockSearchService.search as any)
        .mockRejectedValueOnce(new Error('Search failed'))
        .mockResolvedValueOnce(sampleSearchResults.slice(0, 1)); // Fallback succeeds
      (mockSearchService.hybridSearch as any).mockRejectedValue(new Error('Hybrid search failed'));
      (mockEnhancedMemoryService.searchMemories as any).mockRejectedValue(new Error('Enhanced search failed'));

      const params: AdvancedSearchParams = {
        query: 'test query',
        types: [MemoryType.DOCUMENT]
      };

      const result = await advancedSearchService.search<TestMemorySchema>(params);

      // Should still return results from fallback
      expect(result.results).toBeDefined();
      expect(result.analytics.searchType).toBe('advanced');
    });
  });

  describe('Search Suggestions', () => {
    it('should generate search suggestions', async () => {
      const suggestions = await advancedSearchService.getSuggestions('how');

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      
      // Should include completion suggestions
      const completionSuggestions = suggestions.filter(s => s.type === 'completion');
      expect(completionSuggestions.length).toBeGreaterThan(0);
      
      // Should be sorted by confidence
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i].confidence).toBeLessThanOrEqual(suggestions[i - 1].confidence);
      }
    });

    it('should generate typo corrections', async () => {
      const suggestions = await advancedSearchService.getSuggestions('teh machine');

      expect(suggestions).toBeDefined();
      
      // Should include correction suggestions
      const correctionSuggestions = suggestions.filter(s => s.type === 'correction');
      if (correctionSuggestions.length > 0) {
        expect(correctionSuggestions[0].query).toBe('the machine');
      }
    });
  });

  describe('Search Analytics', () => {
    it('should record search analytics', async () => {
      (mockSearchService.search as any).mockResolvedValue(sampleSearchResults);
      (mockSearchService.hybridSearch as any).mockResolvedValue([]);
      (mockEnhancedMemoryService.searchMemories as any).mockResolvedValue([]);

      const params: AdvancedSearchParams = {
        query: 'analytics test query',
        userId: 'test-user-123',
        includeAnalytics: true
      };

      const result = await advancedSearchService.search<TestMemorySchema>(params);

      expect(result.analytics).toBeDefined();
      expect(result.analytics.query).toBe(params.query);
      expect(result.analytics.userId).toBe(params.userId);
      expect(result.analytics.searchType).toBe('advanced');
      expect(result.analytics.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.analytics.timestamp).toBeGreaterThan(0);
    });

    it('should provide search analytics summary', async () => {
      const analytics = advancedSearchService.getSearchAnalytics('test-user');

      expect(analytics).toBeDefined();
      expect(typeof analytics.totalSearches).toBe('number');
      expect(typeof analytics.avgExecutionTime).toBe('number');
      expect(Array.isArray(analytics.topQueries)).toBe(true);
      expect(Array.isArray(analytics.searchPatterns)).toBe(true);
    });
  });
}); 