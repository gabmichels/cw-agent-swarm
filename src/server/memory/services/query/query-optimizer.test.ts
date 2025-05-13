/**
 * Query Optimizer Tests
 */

import { QueryOptimizer } from './query-optimizer';
import { QueryOptimizationStrategy, QueryParams, QueryResponse, QueryErrorCode, QueryResultItem } from './types';
import { AppError } from '../../../../lib/errors/base';
import { BaseMemorySchema } from '../../models/base-schema';
import { CacheManager } from '../cache/types';
import { StructuredId, IdGenerator } from '../../../../utils/ulid';
import { MemoryType } from '../../config';
import { MessageRole } from '../../../../agents/shared/types/MessageTypes';
import { BaseMetadata } from '../../../../types/metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IVectorDatabaseClient } from '../../services/base/types';
import { QdrantFilterBuilder } from '../../services/filters/filter-builder';

// Create mock functions with the proper typing that allows mock methods
const mockSearch = vi.fn();
const mockSearchPoints = vi.fn();
const mockGetPoints = vi.fn();
const mockAddPoint = vi.fn();
const mockUpdatePoint = vi.fn();
const mockDeletePoint = vi.fn();
const mockGetPointCount = vi.fn();
const mockCollectionExists = vi.fn();
const mockCreateCollection = vi.fn();
const mockScrollPoints = vi.fn();
const mockBuildFilters = vi.fn();
const mockBuild = vi.fn();

// Mock dependencies
// @ts-ignore - Mock object doesn't need to implement the full interface
const mockVectorDb = {
  search: vi.fn(),
  searchPoints: vi.fn(),
  getPoints: vi.fn(),
  addPoint: vi.fn(),
  updatePoint: vi.fn(),
  deletePoint: vi.fn(),
  getPointCount: vi.fn(),
  collectionExists: vi.fn(),
  createCollection: vi.fn(),
  scrollPoints: vi.fn()
};

// @ts-ignore - Mock object doesn't need to implement the full interface
const mockFilterBuilder = {
  buildFilters: vi.fn(),
  build: vi.fn()
};

const mockEmbeddingService = {
  embedText: vi.fn()
};

const mockCacheManager: CacheManager = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  has: vi.fn(),
  invalidateByTag: vi.fn(),
  getStats: vi.fn(),
  getTags: vi.fn()
};

describe('QueryOptimizer', () => {
  let optimizer: QueryOptimizer;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockVectorDb.search.mockResolvedValue({
      matches: [],
      totalCount: 0
    });
    
    mockFilterBuilder.buildFilters.mockReturnValue({});
    
    mockEmbeddingService.embedText.mockResolvedValue([0.1, 0.2, 0.3]);
    
    // @ts-ignore - Mock objects don't need to implement the full interfaces
    optimizer = new QueryOptimizer(
      mockVectorDb,
      mockFilterBuilder as unknown as QdrantFilterBuilder,
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
  
  describe('query execution', () => {
    const mockQueryParams: QueryParams = {
      collection: 'test-collection',
      query: 'test query',
      limit: 5,
      type: MemoryType.MESSAGE
    };
    
    const mockSearchResults = {
      matches: [
        {
          id: '01HXSAXEA79JBPHV5SR5G4ABPE',
          score: 0.9,
          payload: {
            id: '01HXSAXEA79JBPHV5SR5G4ABPE',
            text: 'Test result 1',
            timestamp: new Date().toISOString(),
            type: MemoryType.MESSAGE,
            metadata: {
              schemaVersion: '1.0.0',
              source: 'test',
              importance_score: 0.8,
              tags: ['test']
            }
          }
        }
      ],
      totalCount: 1
    };
    
    it('should execute a basic query successfully', async () => {
      mockVectorDb.search.mockResolvedValueOnce(mockSearchResults);
      
      const result = await optimizer.query(mockQueryParams);
      
      expect(result.results).toHaveLength(1);
      expect(result.totalMatches).toBe(1);
      expect(result.truncated).toBe(false);
      expect(mockVectorDb.search).toHaveBeenCalledWith(
        'test-collection',
        expect.any(Array),
        5,
        expect.any(Object),
        expect.any(Number)
      );
    });
    
    it('should handle query timeouts', async () => {
      mockVectorDb.search.mockImplementationOnce(() => new Promise(resolve => {
        setTimeout(() => resolve(mockSearchResults), 2000);
      }));
      
      await expect(optimizer.query(mockQueryParams)).rejects.toThrow(
        new AppError(QueryErrorCode.EXECUTION_TIMEOUT, expect.any(String))
      );
    }, 3000);
    
    it('should apply different optimization strategies', async () => {
      const strategies = [
        QueryOptimizationStrategy.HIGH_QUALITY,
        QueryOptimizationStrategy.HIGH_SPEED,
        QueryOptimizationStrategy.BALANCED,
        QueryOptimizationStrategy.CONTEXT_AWARE
      ];
      
      for (const strategy of strategies) {
        mockVectorDb.search.mockClear();
        await optimizer.query(mockQueryParams, strategy);
        
        expect(mockVectorDb.search).toHaveBeenCalled();
        const call = mockVectorDb.search.mock.calls[0];
        expect(call[2]).toBeDefined(); // limit
        expect(call[4]).toBeDefined(); // scoreThreshold
      }
    });
  });
  
  describe('caching', () => {
    const mockQueryParams: QueryParams = {
      collection: 'test-collection',
      query: 'cached query',
      limit: 5,
      type: MemoryType.MESSAGE
    };
    
    const mockCachedResults: QueryResponse<BaseMemorySchema> = {
      results: [{
        id: IdGenerator.parse('memory_01HXSAXEA79JBPHV5SR5G4ABPE')!,
        text: 'Cached result',
        score: 0.9,
        metadata: {
          id: '01HXSAXEA79JBPHV5SR5G4ABPE',
          text: 'Cached result',
          timestamp: new Date().toISOString(),
          type: MemoryType.MESSAGE,
          metadata: {
            schemaVersion: '1.0.0',
            source: 'test',
            importance_score: 0.8,
            tags: ['test']
          }
        }
      }],
      totalMatches: 1,
      truncated: false,
      executionTimeMs: 50
    };
    
    it('should return cached results when available', async () => {
      (mockCacheManager.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(mockCachedResults));
      
      const result = await optimizer.query(mockQueryParams);
      
      expect(result.results).toHaveLength(1);
      expect(result.totalMatches).toBe(1);
      expect(result.truncated).toBe(false);
      expect(mockVectorDb.search).not.toHaveBeenCalled();
    });
    
    it('should cache new query results', async () => {
      mockVectorDb.search.mockResolvedValueOnce({
        matches: [{
          id: '01HXSAXEA79JBPHV5SR5G4ABPE',
          score: 0.9,
          payload: {
            id: '01HXSAXEA79JBPHV5SR5G4ABPE',
            text: 'New result',
            timestamp: new Date().toISOString(),
            type: MemoryType.MESSAGE,
            metadata: {
              schemaVersion: '1.0.0',
              source: 'test',
              importance_score: 0.8,
              tags: ['test']
            }
          }
        }],
        totalCount: 1
      });
      
      await optimizer.query(mockQueryParams);
      
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
    
    it('should clear cache for specific collection', async () => {
      await optimizer.clearCache('test-collection');
      
      expect(mockCacheManager.delete).toHaveBeenCalled();
    });
  });
  
  describe('query analysis and optimization', () => {
    it('should determine appropriate strategy based on query pattern', () => {
      const testCases = [
        { query: 'who is the president', expected: QueryOptimizationStrategy.HIGH_QUALITY },
        { query: 'find all users', expected: QueryOptimizationStrategy.HIGH_SPEED },
        { query: '123e4567-e89b-12d3-a456-426614174000', expected: QueryOptimizationStrategy.HIGH_SPEED },
        { query: 'complex query with many words that should trigger balanced strategy', expected: QueryOptimizationStrategy.BALANCED }
      ];
      
      for (const { query, expected } of testCases) {
        const strategy = optimizer.analyzeQuery(query);
        expect(strategy).toBe(expected);
      }
    });
    
    it('should suggest queries based on partial input', async () => {
      mockVectorDb.search.mockResolvedValueOnce({
        matches: [
          {
            id: '01HXSAXEA79JBPHV5SR5G4ABPE',
            score: 0.9,
            payload: {
              originalQuery: 'suggested query 1'
            }
          },
          {
            id: '02HXSAXEA79JBPHV5SR5G4ABPE',
            score: 0.8,
            payload: {
              originalQuery: 'suggested query 2'
            }
          }
        ],
        totalCount: 2
      });
      
      const suggestions = await optimizer.suggestQueries('test', 'test-collection', 2);
      
      expect(suggestions).toHaveLength(2);
      expect(suggestions).toContain('suggested query 1');
      expect(suggestions).toContain('suggested query 2');
    });
  });
  
  describe('error handling', () => {
    const mockQueryParams: QueryParams = {
      collection: 'test-collection',
      query: 'error test',
      limit: 5,
      type: MemoryType.MESSAGE
    };
    
    it('should handle vector database errors', async () => {
      mockVectorDb.search.mockRejectedValueOnce(new Error('DB error'));
      
      await expect(optimizer.query(mockQueryParams)).rejects.toThrow(
        new AppError(QueryErrorCode.OPTIMIZATION_FAILED, expect.any(String))
      );
    });
    
    it('should handle embedding service errors', async () => {
      mockEmbeddingService.embedText.mockRejectedValueOnce(new Error('Embedding error'));
      
      await expect(optimizer.query(mockQueryParams)).rejects.toThrow(
        new AppError(QueryErrorCode.OPTIMIZATION_FAILED, expect.any(String))
      );
    });
    
    it('should handle invalid query parameters', async () => {
      const invalidParams = { ...mockQueryParams, limit: -1 };
      
      const result = await optimizer.query(invalidParams);
      expect(result.truncated).toBe(true);
      expect(result.results).toHaveLength(0);
    });
  });
  
  describe('performance monitoring', () => {
    const mockQueryParams: QueryParams = {
      collection: 'test-collection',
      query: 'performance test',
      limit: 5,
      type: MemoryType.MESSAGE
    };
    
    it('should record metrics for successful queries', async () => {
      mockVectorDb.search.mockResolvedValueOnce({
        matches: [{
          id: '01HXSAXEA79JBPHV5SR5G4ABPE',
          score: 0.9,
          payload: {
            id: '01HXSAXEA79JBPHV5SR5G4ABPE',
            text: 'Test result',
            timestamp: new Date().toISOString(),
            type: MemoryType.MESSAGE,
            metadata: {
              schemaVersion: '1.0.0',
              source: 'test',
              importance_score: 0.8,
              tags: ['test']
            }
          }
        }],
        totalCount: 1
      });
      
      const result = await optimizer.query(mockQueryParams);
      
      expect(result.executionTimeMs).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
    
    it('should record metrics for cached queries', async () => {
      (mockCacheManager.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify({
        results: [{
          id: IdGenerator.parse('memory_01HXSAXEA79JBPHV5SR5G4ABPE')!,
          text: 'Cached result',
          score: 0.9,
          metadata: {
            id: '01HXSAXEA79JBPHV5SR5G4ABPE',
            text: 'Cached result',
            timestamp: new Date().toISOString(),
            type: MemoryType.MESSAGE,
            metadata: {
              schemaVersion: '1.0.0',
              source: 'test',
              importance_score: 0.8,
              tags: ['test']
            }
          }
        }],
        totalMatches: 1,
        truncated: false,
        executionTimeMs: 50
      }));
      
      const result = await optimizer.query(mockQueryParams);
      
      expect(result.executionTimeMs).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
}); 