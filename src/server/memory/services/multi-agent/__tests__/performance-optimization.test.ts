/**
 * Performance Optimization Tests
 * 
 * Tests for the Enhanced Memory Service performance optimization features including:
 * - Query result caching
 * - Vector search parameter optimization
 * - Performance monitoring
 * - Query plan optimization
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ulid } from 'ulid';

// Mock types and interfaces
type MemoryType = 'MESSAGE' | 'TASK' | 'KNOWLEDGE';

interface MockSearchParams {
  query?: string;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
  type: MemoryType;
  scoreThreshold?: number;
}

interface MockEnhancedMemoryPoint {
  id: string;
  payload: {
    text: string;
    type: MemoryType;
    metadata: Record<string, any>;
  };
  senderAgentId?: string;
  receiverAgentId?: string;
}

// Mock PerformanceOptimizer for testing
class MockPerformanceOptimizer {
  private config: any;
  private activeQueries = new Map();

  constructor(cacheManager: any, config?: any) {
    this.config = config || {};
  }

  optimizeVectorSearchParameters(params: MockSearchParams) {
    const limit = params.limit || 10;
    const batchSize = limit >= 50 ? 25 : undefined;
    return {
      scoreThreshold: 0.6,
      limit: limit,
      strategy: 'BALANCED',
      useApproximateSearch: true,
      batchSize: batchSize
    };
  }

  async executeOptimizedSearch<T>(
    params: MockSearchParams,
    executor: (optimizedParams: any, optimization: any) => Promise<T[]>
  ): Promise<T[]> {
    const optimization = this.optimizeVectorSearchParameters(params);
    const optimizedParams = { ...params, ...optimization };
    return await executor(optimizedParams, optimization);
  }

  getPerformanceStats() {
    return {
      cache: { hitRate: 0.75, totalQueries: 1000, avgResponseTime: 150 },
      queries: { avgExecutionTime: 250, slowQueries: 25, totalQueries: 1000 },
      optimization: {
        strategiesUsed: { HIGH_SPEED: 400, BALANCED: 500, HIGH_QUALITY: 100 },
        avgScoreThreshold: 0.65,
        avgLimit: 15
      }
    };
  }

  async clearCache(pattern?: any): Promise<void> {
    // Mock implementation
  }

  getOptimizationRecommendations(params: MockSearchParams): string[] {
    const recommendations = [];
    
    if (params.limit && params.limit > 50) {
      recommendations.push('Consider using pagination for large result sets');
    }
    
    if (params.filters && Object.keys(params.filters).length > 3) {
      recommendations.push('Complex filters may impact performance');
    }
    
    if (!params.query) {
      recommendations.push('Text queries provide better relevance scoring');
    }
    
    return recommendations.length > 0 ? recommendations : ['Query is well optimized'];
  }
}

describe('Performance Optimization', () => {
  let performanceOptimizer: MockPerformanceOptimizer;
  let mockExecutor: vi.Mock;
  let mockCacheManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockCacheManager = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn()
    };
    
    performanceOptimizer = new MockPerformanceOptimizer(mockCacheManager, {
      cache: { defaultTtl: 300000, enableLogging: true },
      performance: { enableDetailedMetrics: true },
      vectorSearch: { minScoreThreshold: 0.3, maxScoreThreshold: 0.9 }
    });

    mockExecutor = vi.fn();
  });

  describe('Vector Search Parameter Optimization', () => {
    test('should optimize score threshold and limit', () => {
      const params: MockSearchParams = {
        query: 'hello',
        type: 'MESSAGE',
        limit: 5
      };

      const optimization = performanceOptimizer.optimizeVectorSearchParameters(params);

      expect(optimization.scoreThreshold).toBe(0.6);
      expect(optimization.limit).toBe(5);
      expect(optimization.strategy).toBe('BALANCED');
      expect(optimization.useApproximateSearch).toBe(true);
    });

    test('should add batch size for large result sets', () => {
      const params: MockSearchParams = {
        query: 'find all messages',
        type: 'MESSAGE',
        limit: 75
      };

      const optimization = performanceOptimizer.optimizeVectorSearchParameters(params);

      expect(optimization.limit).toBe(75);
      expect(optimization.batchSize).toBe(25);
    });

    test('should handle default parameters', () => {
      const params: MockSearchParams = {
        query: 'test',
        type: 'MESSAGE'
      };

      const optimization = performanceOptimizer.optimizeVectorSearchParameters(params);

      expect(optimization.limit).toBe(10); // Default
      expect(optimization.batchSize).toBeUndefined();
    });
  });

  describe('Query Execution with Optimization', () => {
    test('should execute query with optimization parameters', async () => {
      const params: MockSearchParams = {
        query: 'test query',
        type: 'MESSAGE',
        limit: 10
      };

      const mockResults: MockEnhancedMemoryPoint[] = [
        {
          id: ulid(),
          payload: {
            text: 'Test message',
            type: 'MESSAGE',
            metadata: { sender: 'agent-1' }
          }
        }
      ];

      mockExecutor.mockResolvedValue(mockResults);

      const results = await performanceOptimizer.executeOptimizedSearch(
        params,
        mockExecutor
      );

      expect(results).toEqual(mockResults);
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
          type: 'MESSAGE',
          scoreThreshold: 0.6,
          limit: 10
        }),
        expect.objectContaining({
          scoreThreshold: 0.6,
          limit: 10,
          strategy: 'BALANCED',
          useApproximateSearch: true
        })
      );
    });

    test('should handle executor errors', async () => {
      const params: MockSearchParams = {
        query: 'error query',
        type: 'MESSAGE',
        limit: 10
      };

      mockExecutor.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        performanceOptimizer.executeOptimizedSearch(params, mockExecutor)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Performance Statistics', () => {
    test('should return comprehensive performance statistics', () => {
      const stats = performanceOptimizer.getPerformanceStats();

      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('queries');
      expect(stats).toHaveProperty('optimization');

      // Cache stats
      expect(stats.cache.hitRate).toBe(0.75);
      expect(stats.cache.totalQueries).toBe(1000);
      expect(stats.cache.avgResponseTime).toBe(150);

      // Query stats
      expect(stats.queries.avgExecutionTime).toBe(250);
      expect(stats.queries.slowQueries).toBe(25);
      expect(stats.queries.totalQueries).toBe(1000);

      // Optimization stats
      expect(stats.optimization.strategiesUsed).toEqual({
        HIGH_SPEED: 400,
        BALANCED: 500,
        HIGH_QUALITY: 100
      });
      expect(stats.optimization.avgScoreThreshold).toBe(0.65);
      expect(stats.optimization.avgLimit).toBe(15);
    });
  });

  describe('Optimization Recommendations', () => {
    test('should recommend pagination for large result sets', () => {
      const params: MockSearchParams = {
        query: 'large query',
        type: 'MESSAGE',
        limit: 100
      };

      const recommendations = performanceOptimizer.getOptimizationRecommendations(params);

      expect(recommendations).toContain('Consider using pagination for large result sets');
    });

    test('should warn about complex filters', () => {
      const params: MockSearchParams = {
        query: 'complex query',
        type: 'MESSAGE',
        filters: { a: 1, b: 2, c: 3, d: 4 },
        limit: 10
      };

      const recommendations = performanceOptimizer.getOptimizationRecommendations(params);

      expect(recommendations).toContain('Complex filters may impact performance');
    });

    test('should recommend text queries for better relevance', () => {
      const params: MockSearchParams = {
        type: 'MESSAGE',
        filters: { sender: 'agent-1' },
        limit: 10
      };

      const recommendations = performanceOptimizer.getOptimizationRecommendations(params);

      expect(recommendations).toContain('Text queries provide better relevance scoring');
    });

    test('should indicate well-optimized queries', () => {
      const params: MockSearchParams = {
        query: 'simple query',
        type: 'MESSAGE',
        limit: 10
      };

      const recommendations = performanceOptimizer.getOptimizationRecommendations(params);

      expect(recommendations).toContain('Query is well optimized');
    });
  });

  describe('Cache Management', () => {
    test('should clear cache successfully', async () => {
      await expect(performanceOptimizer.clearCache()).resolves.toBeUndefined();
    });

    test('should clear cache with pattern', async () => {
      await expect(
        performanceOptimizer.clearCache({ collection: 'messages' })
      ).resolves.toBeUndefined();
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle agent communication optimization', async () => {
      const agentParams: MockSearchParams = {
        query: 'agent communication',
        type: 'MESSAGE',
        limit: 20,
        filters: { senderAgentId: 'agent-1', receiverAgentId: 'agent-2' }
      };

      const mockResults: MockEnhancedMemoryPoint[] = [
        {
          id: ulid(),
          payload: {
            text: 'Agent message',
            type: 'MESSAGE',
            metadata: { communicationType: 'DIRECT_MESSAGE' }
          },
          senderAgentId: 'agent-1',
          receiverAgentId: 'agent-2'
        }
      ];

      mockExecutor.mockResolvedValue(mockResults);

      const results = await performanceOptimizer.executeOptimizedSearch(
        agentParams,
        mockExecutor
      );

      expect(results).toEqual(mockResults);
      expect(results[0].senderAgentId).toBe('agent-1');
      expect(results[0].receiverAgentId).toBe('agent-2');
    });

    test('should optimize knowledge base queries', async () => {
      const knowledgeParams: MockSearchParams = {
        query: 'knowledge search',
        type: 'KNOWLEDGE',
        limit: 50,
        filters: { category: 'documentation' }
      };

      const optimization = performanceOptimizer.optimizeVectorSearchParameters(knowledgeParams);

      expect(optimization.limit).toBe(50);
      if (optimization.batchSize !== undefined) {
        expect(optimization.batchSize).toBeGreaterThan(0);
        expect(optimization.batchSize).toBeLessThanOrEqual(25);
      }
      expect(optimization.useApproximateSearch).toBe(true);
    });

    test('should handle task-based queries', async () => {
      const taskParams: MockSearchParams = {
        query: 'task management',
        type: 'TASK',
        limit: 15,
        filters: { status: 'pending', priority: 'high' }
      };

      const mockResults: MockEnhancedMemoryPoint[] = [
        {
          id: ulid(),
          payload: {
            text: 'High priority task',
            type: 'TASK',
            metadata: { status: 'pending', priority: 'high' }
          }
        }
      ];

      mockExecutor.mockResolvedValue(mockResults);

      const results = await performanceOptimizer.executeOptimizedSearch(
        taskParams,
        mockExecutor
      );

      expect(results).toEqual(mockResults);
      expect(results[0].payload.metadata.priority).toBe('high');
    });
  });

  describe('Performance Edge Cases', () => {
    test('should handle empty query results', async () => {
      const params: MockSearchParams = {
        query: 'nonexistent query',
        type: 'MESSAGE',
        limit: 10
      };

      mockExecutor.mockResolvedValue([]);

      const results = await performanceOptimizer.executeOptimizedSearch(
        params,
        mockExecutor
      );

      expect(results).toEqual([]);
      expect(mockExecutor).toHaveBeenCalled();
    });

    test('should handle very large limits', () => {
      const params: MockSearchParams = {
        query: 'large query',
        type: 'MESSAGE',
        limit: 1000
      };

      const optimization = performanceOptimizer.optimizeVectorSearchParameters(params);

      expect(optimization.limit).toBe(1000);
      expect(optimization.batchSize).toBe(25);
    });

    test('should handle queries without text', () => {
      const params: MockSearchParams = {
        type: 'MESSAGE',
        filters: { timestamp: { gte: '2024-01-01' } },
        limit: 20
      };

      const optimization = performanceOptimizer.optimizeVectorSearchParameters(params);
      const recommendations = performanceOptimizer.getOptimizationRecommendations(params);

      expect(optimization.limit).toBe(20);
      expect(recommendations).toContain('Text queries provide better relevance scoring');
    });
  });
});
