/**
 * Unit tests for QueryOptimizer with Vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryOptimizer } from '../query-optimizer';
import { QueryOptimizationStrategy, QueryParams } from '../types';
import { QdrantFilterBuilder } from '../../filters/filter-builder';
import { FilterOperator } from '../../filters/types';

describe('QueryOptimizer', () => {
  // Mock dependencies
  const mockVectorDb = {
    search: vi.fn().mockImplementation(() => ({
      matches: [
        {
          id: 'test-id-1',
          score: 0.92,
          payload: {
            text: 'This is a test document',
            metadata: { source: 'test' }
          }
        },
        {
          id: 'test-id-2',
          score: 0.85,
          payload: {
            text: 'Another test document',
            metadata: { source: 'test' }
          }
        }
      ],
      totalCount: 2
    }))
  };
  
  const mockFilterBuilder = {
    build: vi.fn().mockImplementation(() => ({}))
  };
  
  const mockEmbeddingService = {
    embedText: vi.fn().mockImplementation(() => Promise.resolve([0.1, 0.2, 0.3]))
  };
  
  let queryOptimizer: QueryOptimizer;
  
  beforeEach(() => {
    // Clear mock calls
    vi.clearAllMocks();
    
    // Create instance with mocked dependencies
    queryOptimizer = new QueryOptimizer(
      mockVectorDb as any,
      mockFilterBuilder as any,
      mockEmbeddingService
    );
  });
  
  describe('query', () => {
    it('should execute a query with default parameters', async () => {
      // Setup query params
      const params: QueryParams = {
        query: 'test query',
        collection: 'test-collection'
      };
      
      // Execute query
      const result = await queryOptimizer.query(params);
      
      // Verify embedding service called
      expect(mockEmbeddingService.embedText).toHaveBeenCalledWith('test query');
      
      // Verify search executed with correct parameters
      expect(mockVectorDb.search).toHaveBeenCalledWith(
        'test-collection',
        [0.1, 0.2, 0.3],
        10, // Default limit
        undefined, // No filter
        0.6 // Default score threshold
      );
      
      // Verify response structure
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('totalMatches', 2);
      expect(result).toHaveProperty('truncated', false);
      expect(result).toHaveProperty('executionTimeMs');
      expect(result.results).toHaveLength(2);
      
      // Verify result item structure
      const item = result.results[0];
      expect(item).toHaveProperty('id', 'test-id-1');
      expect(item).toHaveProperty('text', 'This is a test document');
      expect(item).toHaveProperty('score', 0.92);
      expect(item).toHaveProperty('metadata');
    });
    
    it('should throw error for invalid query parameter', async () => {
      // Setup invalid query params
      const params: QueryParams = {
        query: '',
        collection: 'test-collection'
      };
      
      // Execute and expect error
      await expect(queryOptimizer.query(params)).rejects.toThrow('Invalid query parameter');
    });
    
    it('should throw error for invalid collection parameter', async () => {
      // Setup invalid query params
      const params: QueryParams = {
        query: 'test query',
        collection: ''
      };
      
      // Execute and expect error
      await expect(queryOptimizer.query(params)).rejects.toThrow('Invalid collection parameter');
    });
    
    it('should apply HIGH_QUALITY strategy when specified', async () => {
      // Setup query params
      const params: QueryParams = {
        query: 'test query',
        collection: 'test-collection',
        limit: 10
      };
      
      // Execute query with HIGH_QUALITY strategy
      await queryOptimizer.query(params, QueryOptimizationStrategy.HIGH_QUALITY);
      
      // Verify search executed with adjusted parameters
      expect(mockVectorDb.search).toHaveBeenCalledWith(
        'test-collection',
        [0.1, 0.2, 0.3],
        15, // Increased from 10
        undefined, // No filter
        0.7 // Increased from default 0.6
      );
    });
    
    it('should apply HIGH_SPEED strategy when specified', async () => {
      // Setup query params
      const params: QueryParams = {
        query: 'test query',
        collection: 'test-collection',
        limit: 30,
        minScore: 0.7
      };
      
      // Execute query with HIGH_SPEED strategy
      await queryOptimizer.query(params, QueryOptimizationStrategy.HIGH_SPEED);
      
      // Verify search executed with adjusted parameters
      expect(mockVectorDb.search).toHaveBeenCalledWith(
        'test-collection',
        [0.1, 0.2, 0.3],
        20, // Capped at 20
        undefined, // No filter
        0.5 // Decreased from 0.7
      );
    });
    
    it('should apply filters when provided', async () => {
      // Setup query params with filter
      const params: QueryParams = {
        query: 'test query',
        collection: 'test-collection',
        filters: [{ operator: FilterOperator.EQUALS, value: 'test-value' }]
      };
      
      // Mock filter builder return value
      const mockFilter = { field: { match: { value: 'test-value' } } };
      mockFilterBuilder.build.mockReturnValueOnce(mockFilter);
      
      // Execute query
      await queryOptimizer.query(params);
      
      // Verify filter builder called
      expect(mockFilterBuilder.build).toHaveBeenCalledWith(params.filters);
      
      // Verify search executed with filter
      expect(mockVectorDb.search).toHaveBeenCalledWith(
        'test-collection',
        [0.1, 0.2, 0.3],
        10,
        mockFilter,
        0.6
      );
    });
  });
  
  describe('analyzeQuery', () => {
    it('should analyze question queries as HIGH_QUALITY', () => {
      // Test question formats
      expect(queryOptimizer.analyzeQuery('what is machine learning?')).toBe(QueryOptimizationStrategy.HIGH_QUALITY);
      expect(queryOptimizer.analyzeQuery('how does neural network work?')).toBe(QueryOptimizationStrategy.HIGH_QUALITY);
      expect(queryOptimizer.analyzeQuery('why is the sky blue?')).toBe(QueryOptimizationStrategy.HIGH_QUALITY);
    });
    
    it('should analyze command queries as HIGH_SPEED', () => {
      // Test command formats
      expect(queryOptimizer.analyzeQuery('find documents about ai')).toBe(QueryOptimizationStrategy.HIGH_SPEED);
      expect(queryOptimizer.analyzeQuery('search for machine learning')).toBe(QueryOptimizationStrategy.HIGH_SPEED);
      expect(queryOptimizer.analyzeQuery('list all python tutorials')).toBe(QueryOptimizationStrategy.HIGH_SPEED);
    });
    
    it('should analyze UUID-containing queries as HIGH_SPEED', () => {
      expect(queryOptimizer.analyzeQuery('related to 123e4567-e89b-12d3-a456-426614174000')).toBe(QueryOptimizationStrategy.HIGH_SPEED);
    });
    
    it('should use BALANCED for generic queries', () => {
      expect(queryOptimizer.analyzeQuery('machine learning')).toBe(QueryOptimizationStrategy.BALANCED);
      expect(queryOptimizer.analyzeQuery('artificial intelligence')).toBe(QueryOptimizationStrategy.BALANCED);
    });
    
    it('should recommend HIGH_SPEED for very short queries', () => {
      expect(queryOptimizer.analyzeQuery('ML')).toBe(QueryOptimizationStrategy.HIGH_SPEED);
    });
    
    it('should recommend HIGH_QUALITY for very long queries', () => {
      const longQuery = 'This is a very long query that contains many words and should be analyzed as a complex query that requires high quality search because it likely contains specific details and nuanced requirements that need careful consideration';
      expect(queryOptimizer.analyzeQuery(longQuery)).toBe(QueryOptimizationStrategy.HIGH_QUALITY);
    });
  });
  
  describe('suggestQueries', () => {
    it('should return suggestions based on partial query', async () => {
      // Mock search results for suggestions
      mockVectorDb.search.mockImplementationOnce(() => ({
        matches: [
          {
            id: 'sugg-1',
            score: 0.9,
            payload: {
              originalQuery: 'machine learning algorithms'
            }
          },
          {
            id: 'sugg-2',
            score: 0.8,
            payload: {
              originalQuery: 'machine learning frameworks'
            }
          }
        ],
        totalCount: 2
      }));
      
      const suggestions = await queryOptimizer.suggestQueries('mach', 'test-collection');
      
      expect(suggestions).toEqual([
        'machine learning algorithms',
        'machine learning frameworks'
      ]);
      
      expect(mockVectorDb.search).toHaveBeenCalledWith(
        'test-collection',
        [0.1, 0.2, 0.3],
        5,
        undefined,
        0.5
      );
    });
    
    it('should return empty array for short queries', async () => {
      const suggestions = await queryOptimizer.suggestQueries('m', 'test-collection');
      
      expect(suggestions).toEqual([]);
      expect(mockEmbeddingService.embedText).not.toHaveBeenCalled();
      expect(mockVectorDb.search).not.toHaveBeenCalled();
    });
  });
  
  describe('clearCache', () => {
    it('should clear cache for specific collection', async () => {
      // First query to populate cache
      await queryOptimizer.query({
        query: 'test query',
        collection: 'test-collection'
      });
      
      // Clear cache
      const result = await queryOptimizer.clearCache('test-collection');
      
      expect(result).toBe(true);
      
      // Query again - should hit database
      mockVectorDb.search.mockClear();
      await queryOptimizer.query({
        query: 'test query',
        collection: 'test-collection'
      });
      
      // Verify search was called again
      expect(mockVectorDb.search).toHaveBeenCalled();
    });
    
    it('should clear all cache when no collection specified', async () => {
      // Queries to populate cache
      await queryOptimizer.query({
        query: 'test query 1',
        collection: 'collection-1'
      });
      
      await queryOptimizer.query({
        query: 'test query 2',
        collection: 'collection-2'
      });
      
      // Clear all cache
      const result = await queryOptimizer.clearCache();
      
      expect(result).toBe(true);
      
      // Query again
      mockVectorDb.search.mockClear();
      await queryOptimizer.query({
        query: 'test query 1',
        collection: 'collection-1'
      });
      await queryOptimizer.query({
        query: 'test query 2',
        collection: 'collection-2'
      });
      
      // Verify search was called for both queries
      expect(mockVectorDb.search).toHaveBeenCalledTimes(2);
    });
  });
}); 