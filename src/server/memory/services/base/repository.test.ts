/**
 * BaseMemoryRepository Tests
 * 
 * Comprehensive tests for the newly implemented repository methods:
 * - filter()
 * - getAll() 
 * - count()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseMemoryRepository } from './repository';
import { BaseMemoryEntity, Schema } from '../../schema/types';
import { IVectorDatabaseClient, FilterConditions, FilterOptions, IEmbeddingService } from './types';
import { FilterOperator } from '../filters/types';

// Mock entity for testing
interface TestEntity extends BaseMemoryEntity {
  title: string;
  category: string;
  priority: number;
}

// Mock repository implementation
class TestRepository extends BaseMemoryRepository<TestEntity> {
  protected mapToEntity(record: any): TestEntity {
    return {
      id: record.id,
      content: record.payload.content,
      type: record.payload.type,
      createdAt: new Date(record.payload.createdAt),
      updatedAt: new Date(record.payload.updatedAt),
      schemaVersion: record.payload.schemaVersion,
      metadata: record.payload.metadata || {},
      title: record.payload.title,
      category: record.payload.category,
      priority: record.payload.priority
    };
  }
}

// Mock database client
const mockDatabaseClient: IVectorDatabaseClient = {
  addPoint: vi.fn(),
  getPoints: vi.fn(),
  search: vi.fn(),
  searchPoints: vi.fn(),
  updatePoint: vi.fn(),
  deletePoint: vi.fn()
};

// Mock embedding service
const mockEmbeddingService: IEmbeddingService = {
  getEmbedding: vi.fn().mockResolvedValue({ embedding: new Array(1536).fill(0.1) })
};

// Mock schema
const mockSchema: Schema<TestEntity> = {
  name: 'TestEntity',
  version: { major: 1, minor: 0, toString: () => 'v1.0', isNewerThan: () => false, isCompatibleWith: () => true },
  type: 'memory' as any,
  jsonSchema: {},
  validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  isValid: (data: unknown): data is TestEntity => true,
  getDefaults: vi.fn().mockReturnValue({}),
  create: vi.fn()
};

describe('BaseMemoryRepository', () => {
  let repository: TestRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TestRepository(
      'test-collection',
      mockSchema,
      mockDatabaseClient,
      mockEmbeddingService
    );
  });

  describe('filter()', () => {
    it('should filter entities by single condition', async () => {
      // Mock search response
      const mockSearchResponse = {
        matches: [
          {
            id: 'test-1',
            score: 0.9,
            payload: {
              id: 'test-1',
              content: 'Test content 1',
              type: 'test',
              title: 'Test Title 1',
              category: 'important',
              priority: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              schemaVersion: '1.0',
              metadata: {}
            }
          }
        ],
        totalCount: 1
      };

      (mockDatabaseClient.search as any).mockResolvedValue(mockSearchResponse);

      // Test filter conditions
      const conditions: FilterConditions<TestEntity> = {
        category: {
          operator: FilterOperator.EQUALS,
          value: 'important'
        }
      };

      const results = await repository.filter(conditions);

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('important');
      expect(mockDatabaseClient.search).toHaveBeenCalledWith(
        'test-collection',
        expect.any(Array), // zero vector
        1000, // default limit
        expect.any(Object), // qdrant filter
        0 // score threshold
      );
    });

    it('should filter entities by multiple conditions', async () => {
      const mockSearchResponse = {
        matches: [
          {
            id: 'test-2',
            score: 0.8,
            payload: {
              id: 'test-2',
              content: 'Test content 2',
              type: 'test',
              title: 'Test Title 2',
              category: 'important',
              priority: 2,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              schemaVersion: '1.0',
              metadata: {}
            }
          }
        ],
        totalCount: 1
      };

      (mockDatabaseClient.search as any).mockResolvedValue(mockSearchResponse);

      const conditions: FilterConditions<TestEntity> = {
        category: {
          operator: FilterOperator.EQUALS,
          value: 'important'
        },
        priority: {
          operator: FilterOperator.GREATER_THAN,
          value: 1
        }
      };

      const results = await repository.filter(conditions);

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('important');
      expect(results[0].priority).toBe(2);
    });

    it('should handle empty filter results', async () => {
      const mockSearchResponse = {
        matches: [],
        totalCount: 0
      };

      (mockDatabaseClient.search as any).mockResolvedValue(mockSearchResponse);

      const conditions: FilterConditions<TestEntity> = {
        category: {
          operator: FilterOperator.EQUALS,
          value: 'nonexistent'
        }
      };

      const results = await repository.filter(conditions);

      expect(results).toHaveLength(0);
    });

    it('should handle filter errors gracefully', async () => {
      (mockDatabaseClient.search as any).mockRejectedValue(new Error('Database error'));

      const conditions: FilterConditions<TestEntity> = {
        category: {
          operator: FilterOperator.EQUALS,
          value: 'test'
        }
      };

      await expect(repository.filter(conditions)).rejects.toThrow('Failed to filter entities');
    });
  });

  describe('getAll()', () => {
    it('should retrieve all entities', async () => {
      const mockSearchResponse = {
        matches: [
          {
            id: 'test-1',
            score: 0.9,
            payload: {
              id: 'test-1',
              content: 'Test content 1',
              type: 'test',
              title: 'Test Title 1',
              category: 'important',
              priority: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              schemaVersion: '1.0',
              metadata: {}
            }
          },
          {
            id: 'test-2',
            score: 0.8,
            payload: {
              id: 'test-2',
              content: 'Test content 2',
              type: 'test',
              title: 'Test Title 2',
              category: 'normal',
              priority: 2,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              schemaVersion: '1.0',
              metadata: {}
            }
          }
        ],
        totalCount: 2
      };

      (mockDatabaseClient.search as any).mockResolvedValue(mockSearchResponse);

      const results = await repository.getAll();

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('test-1');
      expect(results[1].id).toBe('test-2');
    });

    it('should respect limit option', async () => {
      const mockSearchResponse = {
        matches: [
          {
            id: 'test-1',
            score: 0.9,
            payload: {
              id: 'test-1',
              content: 'Test content 1',
              type: 'test',
              title: 'Test Title 1',
              category: 'important',
              priority: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              schemaVersion: '1.0',
              metadata: {}
            }
          }
        ],
        totalCount: 1
      };

      (mockDatabaseClient.search as any).mockResolvedValue(mockSearchResponse);

      const options: FilterOptions = { limit: 1 };
      const results = await repository.getAll(options);

      expect(results).toHaveLength(1);
      expect(mockDatabaseClient.search).toHaveBeenCalledWith(
        'test-collection',
        expect.any(Array),
        1, // specified limit
        expect.any(Object),
        0
      );
    });

    it('should handle empty collection', async () => {
      const mockSearchResponse = {
        matches: [],
        totalCount: 0
      };

      (mockDatabaseClient.search as any).mockResolvedValue(mockSearchResponse);

      const results = await repository.getAll();

      expect(results).toHaveLength(0);
    });
  });

  describe('count()', () => {
    it('should count all entities when no conditions provided', async () => {
      const mockSearchResponse = {
        matches: [],
        totalCount: 5
      };

      (mockDatabaseClient.search as any).mockResolvedValue(mockSearchResponse);

      const count = await repository.count();

      expect(count).toBe(5);
      expect(mockDatabaseClient.search).toHaveBeenCalledWith(
        'test-collection',
        expect.any(Array),
        0, // limit 0 for count only
        expect.any(Object),
        0
      );
    });

    it('should count entities matching conditions', async () => {
      const mockSearchResponse = {
        matches: [],
        totalCount: 3
      };

      (mockDatabaseClient.search as any).mockResolvedValue(mockSearchResponse);

      const conditions: FilterConditions<TestEntity> = {
        category: {
          operator: FilterOperator.EQUALS,
          value: 'important'
        }
      };

      const count = await repository.count(conditions);

      expect(count).toBe(3);
    });

    it('should return 0 for no matches', async () => {
      const mockSearchResponse = {
        matches: [],
        totalCount: 0
      };

      (mockDatabaseClient.search as any).mockResolvedValue(mockSearchResponse);

      const conditions: FilterConditions<TestEntity> = {
        category: {
          operator: FilterOperator.EQUALS,
          value: 'nonexistent'
        }
      };

      const count = await repository.count(conditions);

      expect(count).toBe(0);
    });

    it('should handle count errors gracefully', async () => {
      (mockDatabaseClient.search as any).mockRejectedValue(new Error('Database error'));

      await expect(repository.count()).rejects.toThrow('Failed to count entities');
    });
  });
}); 