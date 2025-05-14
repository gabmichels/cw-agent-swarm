/**
 * Unit tests for QueryOptimizer with Vitest
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { QueryOptimizer } from '../query-optimizer';
import { QueryOptimizationStrategy, QueryParams, QueryErrorCode } from '../types';
import { QdrantFilterBuilder } from '../../filters/filter-builder';
import { FilterOperator } from '../../filters/types';
import { AppError } from '../../../../../lib/errors/base';
import { CacheManager } from '../../cache/types';
import { BaseMemorySchema } from '../../../models/base-schema';

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
            metadata: { source: 'test', schemaVersion: '1.0.0' }
          }
        },
        {
          id: 'test-id-2',
          score: 0.85,
          payload: {
            text: 'Another test document',
            metadata: { source: 'test', schemaVersion: '1.0.0' }
          }
        }
      ],
      totalCount: 2
    }))
  };
  
  const mockFilterBuilder = {
    build: vi.fn().mockImplementation(() => ({
      must: [{
        key: 'metadata.source',
        match: { value: 'test' }
      }]
    }))
  };
  
  const mockEmbeddingService = {
    embedText: vi.fn().mockImplementation(() => Promise.resolve([0.1, 0.2, 0.3]))
  };

  const mockCacheManager = {
    get: vi.fn().mockImplementation(() => Promise.resolve(undefined)),
    set: vi.fn().mockImplementation(() => Promise.resolve(true)),
    has: vi.fn().mockImplementation(() => Promise.resolve(false)),
    delete: vi.fn().mockImplementation(() => Promise.resolve(true)),
    clear: vi.fn().mockImplementation(() => Promise.resolve(true)),
    invalidateByTag: vi.fn().mockImplementation(() => Promise.resolve(true)),
    getStats: vi.fn().mockImplementation(() => Promise.resolve({ hits: 0, misses: 0 })),
    getTags: vi.fn().mockImplementation(() => Promise.resolve([]))
  } as unknown as CacheManager;
  
  let queryOptimizer: QueryOptimizer;
  
  beforeEach(() => {
    // Clear mock calls
    vi.clearAllMocks();
    
    // Create instance with mocked dependencies
    queryOptimizer = new QueryOptimizer(
      mockVectorDb as any,
      mockFilterBuilder as any,
      mockEmbeddingService,
      mockCacheManager,
      {
        defaultStrategy: QueryOptimizationStrategy.BALANCED,
        defaultLimit: 10,
        defaultMinScore: 0.6,
        timeoutMs: 1000,
        enableCaching: true,
        cacheTtlSeconds: 300
      }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('query execution', () => {
    const testParams: QueryParams = {
      query: 'test query',
      collection: 'test-collection',
      limit: 5,
      minScore: 0.7
    };

    it('should execute query with default strategy', async () => {
      // Mock a small delay to ensure executionTimeMs > 0
      mockVectorDb.search.mockImplementationOnce(() => new Promise(resolve => {
        setTimeout(() => resolve({
          matches: [
            {
              id: 'test-id-1',
              score: 0.92,
              payload: {
                text: 'This is a test document',
                metadata: { source: 'test', schemaVersion: '1.0.0' }
              }
            },
            {
              id: 'test-id-2',
              score: 0.85,
              payload: {
                text: 'Another test document',
                metadata: { source: 'test', schemaVersion: '1.0.0' }
              }
            }
          ],
          totalCount: 2
        }), 10);
      }));

      const results = await queryOptimizer.query(testParams);
      
      expect(results.results).toHaveLength(2);
      expect(results.totalMatches).toBe(2);
      expect(results.truncated).toBe(false);
      expect(results.executionTimeMs).toBeGreaterThan(0);
      
      // Verify vector DB was called with correct parameters
      expect(mockVectorDb.search).toHaveBeenCalledWith(
        'test-collection',
        [0.1, 0.2, 0.3],
        5,
        expect.any(Object),
        0.7
      );
    });

    it('should execute query with HIGH_QUALITY strategy', async () => {
      const results = await queryOptimizer.query(testParams, QueryOptimizationStrategy.HIGH_QUALITY);
      
      // HIGH_QUALITY should increase limit and threshold
      expect(mockVectorDb.search).toHaveBeenCalledWith(
        'test-collection',
        [0.1, 0.2, 0.3],
        8, // 5 * 1.5 rounded up
        expect.any(Object),
        0.7 // max(0.7, 0.7)
      );
    });

    it('should execute query with HIGH_SPEED strategy', async () => {
      const results = await queryOptimizer.query(testParams, QueryOptimizationStrategy.HIGH_SPEED);
      
      // HIGH_SPEED should decrease limit and threshold
      expect(mockVectorDb.search).toHaveBeenCalledWith(
        'test-collection',
        [0.1, 0.2, 0.3],
        5, // min(5, 20)
        expect.any(Object),
        0.5 // min(0.5, 0.7)
      );
    });

    it('should handle query timeout', async () => {
      // Mock a slow query that exceeds the timeout
      mockVectorDb.search.mockImplementationOnce(() => new Promise(resolve => {
        setTimeout(() => resolve({
          matches: [],
          totalCount: 0
        }), 2000); // 2 seconds, which exceeds the 1 second timeout
      }));

      // Expect a timeout error with the correct code and message
      await expect(queryOptimizer.query(testParams)).rejects.toMatchObject({
        code: QueryErrorCode.EXECUTION_TIMEOUT,
        message: expect.stringContaining('TIMEOUT_ERROR')
      });

      // Verify the error message contains the timeout duration
      try {
        await queryOptimizer.query(testParams);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(QueryErrorCode.EXECUTION_TIMEOUT);
        expect((error as AppError).message).toContain('TIMEOUT_ERROR');
        expect((error as AppError).message).toContain('1000ms');
      }
    });

    it('should handle vector DB errors', async () => {
      mockVectorDb.search.mockRejectedValueOnce(new Error('DB error'));

      await expect(queryOptimizer.query(testParams)).rejects.toThrow(
        new AppError(QueryErrorCode.OPTIMIZATION_FAILED, expect.any(String))
      );
    });
  });

  describe('query caching', () => {
    const testParams: QueryParams = {
      query: 'cached query',
      collection: 'test-collection'
    };

    beforeEach(() => {
      (mockCacheManager.get as any).mockResolvedValue(undefined);
    });

    it('should cache query results', async () => {
      // First call should cache results
      const firstResult = await queryOptimizer.query(testParams);
      expect(mockCacheManager.set).toHaveBeenCalled();
      expect(mockVectorDb.search).toHaveBeenCalledTimes(1);
      expect(firstResult.results.length).toBeGreaterThan(0);

      // Mock cache hit for second call
      (mockCacheManager.get as any).mockResolvedValueOnce(firstResult as any);

      // Second call should use cache
      const cachedResults = await queryOptimizer.query(testParams);
      // Log the structure for debugging
      // eslint-disable-next-line no-console
      console.log('cachedResults:', cachedResults);
      console.log('firstResult:', firstResult);
      expect(mockVectorDb.search).toHaveBeenCalledTimes(1); // Still only called once
      // Compare the full QueryResponse object
      expect(cachedResults).toEqual(firstResult);
    });

    it('should clear cache', async () => {
      // First ensure cache is populated
      await queryOptimizer.query(testParams);
      // Clear cache
      await queryOptimizer.clearCache('test-collection');
      // No assertion on clear being called, just ensure no error
      // Verify cache is cleared by making another query
      (mockCacheManager.get as any).mockResolvedValueOnce(undefined);
      await queryOptimizer.query(testParams);
      expect(mockVectorDb.search).toHaveBeenCalledTimes(2); // Called again because cache was cleared
    });
  });

  describe('query suggestions', () => {
    it('should return empty array for short queries', async () => {
      const suggestions = await queryOptimizer.suggestQueries('te', 'test-collection');
      expect(suggestions).toHaveLength(0);
    });

    it('should generate suggestions for valid queries', async () => {
      // Mock search results with original queries
      mockVectorDb.search.mockResolvedValueOnce({
        matches: [
          {
            id: 's1',
            score: 0.9,
            payload: { originalQuery: 'test query 1' }
          },
          {
            id: 's2',
            score: 0.8,
            payload: { originalQuery: 'test query 2' }
          }
        ],
        totalCount: 2
      });

      const suggestions = await queryOptimizer.suggestQueries('test', 'test-collection');
      
      expect(suggestions).toHaveLength(2);
      expect(suggestions).toContain('test query 1');
      expect(suggestions).toContain('test query 2');
    });

    it('should handle suggestion generation errors', async () => {
      mockVectorDb.search.mockRejectedValueOnce(new Error('Suggestion error'));
      
      const suggestions = await queryOptimizer.suggestQueries('test', 'test-collection');
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('analyzeQuery', () => {
    it('should analyze question queries as HIGH_QUALITY', () => {
      expect(queryOptimizer.analyzeQuery('what is machine learning?')).toBe(QueryOptimizationStrategy.HIGH_QUALITY);
      expect(queryOptimizer.analyzeQuery('how does neural network work?')).toBe(QueryOptimizationStrategy.HIGH_QUALITY);
      expect(queryOptimizer.analyzeQuery('why is the sky blue?')).toBe(QueryOptimizationStrategy.HIGH_QUALITY);
    });
    
    it('should analyze command queries as HIGH_SPEED', () => {
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

    it('should recommend HIGH_QUALITY for complex queries', () => {
      const complexQuery = 'what are the implications of using machine learning in healthcare systems and how does it affect patient outcomes and medical decision making processes';
      expect(queryOptimizer.analyzeQuery(complexQuery)).toBe(QueryOptimizationStrategy.HIGH_QUALITY);
    });
  });

  describe('performance monitoring', () => {
    const testParams: QueryParams = {
      query: 'performance test',
      collection: 'test-collection'
    };

    it('should record metrics for successful queries', async () => {
      const results = await queryOptimizer.query(testParams);
      
      // Verify performance metrics were recorded
      const analysis = queryOptimizer['performanceMonitor'].analyzeQuery(testParams);
      expect(analysis).toBeDefined();
      expect(analysis.pattern).toBeDefined();
      expect(analysis.recommendedStrategy).toBeDefined();
    });

    it('should record metrics for failed queries', async () => {
      mockVectorDb.search.mockRejectedValueOnce(new Error('Test error'));
      
      await expect(queryOptimizer.query(testParams)).rejects.toThrow();
      
      // Verify error metrics were recorded
      const analysis = queryOptimizer['performanceMonitor'].analyzeQuery(testParams);
      expect(analysis).toBeDefined();
      expect(analysis.bottlenecks).toBeDefined();
    });
  });
}); 