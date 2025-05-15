import { vi } from 'vitest';
import { MemoryService } from '../../../services/memory/memory-service';
import { CacheManager } from '../../../services/cache/types';
import { QueryOptimizer } from '../../../services/query/query-optimizer';
import { MemoryType, ImportanceLevel } from '../../../config/types';
import { EmbeddingService } from '../../../services/client/embedding-service';
import { QueryOptimizationStrategy } from '../../../services/query/types';
import { IMemoryClient, SearchQuery } from '../../../services/client/types';
import { IVectorDatabaseClient } from '../../../services/base/types';
import { QdrantFilterBuilder } from '../../../services/filters/filter-builder';

// Basic test configuration
export const TEST_CONFIG = {
  collection: 'test-collection',
  defaultLimit: 10,
  timeoutMs: 1000
};

// Simple test memory type
export interface TestMemory {
  id: string;
  text: string;
  type: MemoryType;
  metadata: {
    importance: ImportanceLevel;
    tags: string[];
  };
}

// Simple test data generator
export function generateTestMemory(
  id: string,
  text: string,
  type: MemoryType,
  importance: ImportanceLevel
): TestMemory {
  return {
    id,
    text,
    type,
    metadata: {
      importance,
      tags: []
    }
  };
}

// Type guard for match condition
interface MatchCondition {
  key: string;
  match: { value: any; in?: any[] };
  range?: any;
}

function isMatchCondition(condition: any): condition is MatchCondition {
  return condition 
    && typeof condition === 'object' 
    && 'key' in condition 
    && 'match' in condition 
    && typeof condition.match === 'object'
    && 'value' in condition.match;
}

// Helper to safely get match value
function getMatchValue(condition: any): any | undefined {
  if (isMatchCondition(condition) && condition.match.value !== undefined) {
    return condition.match.value;
  }
  return undefined;
}

// MockMemoryClient implements IMemoryClient
class MockMemoryClient implements IMemoryClient {
  private store: Record<string, Map<string, any>> = {};
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getStatus() {
    return {
      initialized: this.initialized,
      connected: true,
      collectionsReady: [TEST_CONFIG.collection],
      usingFallback: false
    };
  }

  async createCollection(name: string, _dimensions: number): Promise<boolean> {
    if (!this.store[name]) {
      this.store[name] = new Map();
    }
    return true;
  }

  async collectionExists(name: string): Promise<boolean> {
    return this.store[name] !== undefined;
  }

  async addPoint<T>(collection: string, point: any): Promise<string> {
    if (!this.store[collection]) {
      this.store[collection] = new Map();
    }
    this.store[collection].set(point.id, point);
    return point.id;
  }

  async addPoints<T>(collection: string, points: any[]): Promise<string[]> {
    if (!this.store[collection]) {
      this.store[collection] = new Map();
    }
    points.forEach(point => this.store[collection].set(point.id, point));
    return points.map(p => p.id);
  }

  async getPoints<T>(collection: string, ids: string[]): Promise<any[]> {
    if (!this.store[collection]) return [];
    return ids
      .map(id => this.store[collection].get(id))
      .filter(Boolean);
  }

  async searchPointsByQuery<T>(collection: string, query: SearchQuery): Promise<any[]> {
    if (!this.store[collection]) return [];
    let points = Array.from(this.store[collection].values());
    if (query.query) {
      const searchText = query.query.toLowerCase();
      points = points.filter(point => point.text.toLowerCase().includes(searchText));
    }
    if (query.filter) {
      if (query.filter.must) {
        for (const condition of query.filter.must) {
          const matchValue = getMatchValue(condition);
          if (condition.key === 'type' && matchValue !== undefined) {
            points = points.filter(p => p.type === matchValue);
          }
          if (condition.key === 'metadata.importance' && matchValue !== undefined) {
            points = points.filter(p => p.metadata.importance === matchValue);
          }
        }
      }
    }
    return points.map(point => ({
      id: point.id,
      score: 0.99,
      payload: point
    }));
  }

  async updatePoint<T>(collection: string, id: string, updates: Partial<any>): Promise<boolean> {
    if (!this.store[collection] || !this.store[collection].has(id)) {
      return false;
    }
    const point = this.store[collection].get(id);
    this.store[collection].set(id, { ...point, ...updates });
    return true;
  }

  async deletePoint(collection: string, id: string, _options?: { hardDelete?: boolean }): Promise<boolean> {
    if (!this.store[collection] || !this.store[collection].has(id)) {
      return false;
    }
    this.store[collection].delete(id);
    return true;
  }

  async scrollPoints<T>(collection: string, _filter?: any, limit?: number, offset?: number): Promise<any[]> {
    if (!this.store[collection]) return [];
    const points = Array.from(this.store[collection].values());
    return points.slice(offset || 0, (offset || 0) + (limit || points.length));
  }

  async getPointCount(collection: string, _filter?: any): Promise<number> {
    if (!this.store[collection]) return 0;
    return this.store[collection].size;
  }

  async cleanup() {
    this.store = {};
    this.initialized = false;
  }

  async searchPoints<T>(collection: string, query: SearchQuery): Promise<any[]> {
    if (!this.store[collection]) return [];
    let points = Array.from(this.store[collection].values());
    if (query.query) {
      const searchText = query.query.toLowerCase();
      points = points.filter(point => point.text.toLowerCase().includes(searchText));
    }
    if (query.filter) {
      if (query.filter.must) {
        for (const condition of query.filter.must) {
          const matchValue = getMatchValue(condition);
          if (condition.key === 'type' && matchValue !== undefined) {
            points = points.filter(p => p.type === matchValue);
          }
          if (condition.key === 'metadata.importance' && matchValue !== undefined) {
            points = points.filter(p => p.metadata.importance === matchValue);
          }
        }
      }
    }
    return points.map(point => ({
      id: point.id,
      score: 0.99,
      payload: point
    }));
  }

  async searchPointsVector<T = any>(collectionName: string, vector: number[], options?: any): Promise<any[]> {
    // Stub for IVectorDatabaseClient compatibility
    return [];
  }

  async search<T = any>(collectionName: string, vector: number[], limit: number, filter?: Record<string, unknown>, scoreThreshold?: number): Promise<any> {
    // Stub for IVectorDatabaseClient compatibility
    return { matches: [], totalCount: 0 };
  }

  async getCollectionInfo(collectionName: string): Promise<{ name: string; dimensions: number; pointsCount: number; createdAt: Date } | null> {
    return Promise.resolve({
      name: collectionName,
      dimensions: 1536,
      pointsCount: 0,
      createdAt: new Date()
    });
  }
}

// Simple mock embedding service
class MockEmbeddingService extends EmbeddingService {
  constructor() {
    super({ useRandomFallback: true, dimensions: 1536 });
  }
  async getEmbedding(text: string) {
    return { embedding: Array(1536).fill(0) };
  }
  async embedText(text: string): Promise<number[]> {
    // Satisfy QueryOptimizer dependency
    return Array(1536).fill(0);
  }
}

// Basic test suite setup
export const setupTestSuite = () => {
  const mockMemoryClient = new MockMemoryClient();
  const mockCacheManager: CacheManager = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(true),
    has: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockResolvedValue(true),
    clear: vi.fn().mockResolvedValue(true)
  } as unknown as CacheManager;
  const mockEmbeddingService = new MockEmbeddingService();
  const memoryService = new MemoryService(mockMemoryClient as unknown as IMemoryClient, mockEmbeddingService);
  const queryOptimizer = new QueryOptimizer(
    mockMemoryClient as unknown as IVectorDatabaseClient,
    new QdrantFilterBuilder(),
    mockEmbeddingService,
    mockCacheManager,
    {
      defaultStrategy: QueryOptimizationStrategy.BALANCED,
      defaultLimit: TEST_CONFIG.defaultLimit,
      defaultMinScore: 0.6,
      timeoutMs: TEST_CONFIG.timeoutMs,
      enableCaching: false,
      cacheTtlSeconds: 60
    }
  );
  return {
    mockMemoryClient,
    memoryService,
    queryOptimizer
  };
}; 