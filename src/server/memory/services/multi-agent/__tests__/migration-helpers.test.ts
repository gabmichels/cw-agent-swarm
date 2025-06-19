/**
 * Migration Helpers Tests
 * 
 * Test suite for Enhanced Memory Service migration utilities
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ulid } from 'ulid';
import {
  EnhancedMemoryMigrationManager,
  createMigrationManager,
  migrateToEnhancedMemoryService,
  isEnhancedMemoryService,
  validateEnhancedMemoryService,
  DEFAULT_MIGRATION_CONFIG,
  MigrationConfig,
  MigrationResult
} from '../migration-helpers';
import { MemoryService } from '../../memory/memory-service';
import { EnhancedMemoryService } from '../enhanced-memory-service';
import { IMemoryClient } from '../../client/types';
import { EmbeddingService } from '../../client/embedding-service';
import { MemoryType } from '@/server/memory/config/types';
import { BaseMemorySchema, MemoryPoint } from '../../../models';
import { createUserId, createAgentId } from '../../../../../types/entity-identifier';

// Test constants
const TEST_EMBEDDING = [0.1, 0.2, 0.3, 0.4];
const TEST_TIMESTAMP = 1640995200000;

// Mock memory client
class MockMemoryClient implements IMemoryClient {
  private points: Map<string, MemoryPoint<BaseMemorySchema>> = new Map();
  private collections: Set<string> = new Set(['messages', 'documents', 'thoughts']);

  async initialize(): Promise<void> {}
  isInitialized(): boolean { return true; }
  async getStatus() { return { status: 'ok' as const }; }
  
  async createCollection(name: string): Promise<boolean> {
    this.collections.add(name);
    return true;
  }
  
  async collectionExists(name: string): Promise<boolean> {
    return this.collections.has(name);
  }
  
  async addPoint<T extends BaseMemorySchema>(
    collectionName: string, 
    point: MemoryPoint<T>
  ): Promise<string> {
    this.points.set(point.id, point as MemoryPoint<BaseMemorySchema>);
    return point.id;
  }
  
  async getPoints<T extends BaseMemorySchema>(
    collectionName: string, 
    ids: string[]
  ): Promise<MemoryPoint<T>[]> {
    return ids
      .map(id => this.points.get(id))
      .filter((point): point is MemoryPoint<T> => !!point);
  }
  
  async searchPoints<T extends BaseMemorySchema>(
    collectionName: string,
    vector: number[],
    options?: any
  ): Promise<Array<{ point: MemoryPoint<T>; score: number }>> {
    const allPoints = Array.from(this.points.values()) as MemoryPoint<T>[];
    return allPoints.map(point => ({ point, score: 0.9 }));
  }
  
  async updatePoint<T extends BaseMemorySchema>(
    collectionName: string,
    id: string,
    updates: Partial<MemoryPoint<T>>
  ): Promise<boolean> {
    const existing = this.points.get(id);
    if (existing) {
      this.points.set(id, { ...existing, ...updates });
      return true;
    }
    return false;
  }
  
  async deletePoint(collectionName: string, id: string): Promise<boolean> {
    return this.points.delete(id);
  }
  
  async addPoints<T extends BaseMemorySchema>(
    collectionName: string,
    points: MemoryPoint<T>[]
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const point of points) {
      await this.addPoint(collectionName, point);
      ids.push(point.id);
    }
    return ids;
  }
  
  async scrollPoints<T extends BaseMemorySchema>(
    collectionName: string,
    options?: any
  ): Promise<MemoryPoint<T>[]> {
    return Array.from(this.points.values()) as MemoryPoint<T>[];
  }
  
  async getPointCount(collectionName: string): Promise<number> {
    return this.points.size;
  }
  
  async getCollectionInfo(collectionName: string) {
    return {
      name: collectionName,
      dimensions: 1536,
      pointsCount: this.points.size,
      createdAt: new Date()
    };
  }

  // Test helpers
  clearPoints(): void {
    this.points.clear();
  }
  
  getAllPoints(): MemoryPoint<BaseMemorySchema>[] {
    return Array.from(this.points.values());
  }
}

// Mock embedding service
class MockEmbeddingService implements Pick<EmbeddingService, 'getEmbedding' | 'getBatchEmbeddings'> {
  async getEmbedding(text: string) {
    return { embedding: TEST_EMBEDDING };
  }
  
  async getBatchEmbeddings(texts: string[]) {
    return texts.map(() => ({ embedding: TEST_EMBEDDING }));
  }
}

describe('Migration Helpers', () => {
  let mockClient: MockMemoryClient;
  let mockEmbedding: MockEmbeddingService;
  let sourceService: MemoryService;
  let targetService: EnhancedMemoryService;
  
  beforeEach(() => {
    mockClient = new MockMemoryClient();
    mockEmbedding = new MockEmbeddingService();
    
    sourceService = new MemoryService(
      mockClient,
      mockEmbedding as unknown as EmbeddingService,
      { getTimestamp: () => TEST_TIMESTAMP }
    );
    
    targetService = new EnhancedMemoryService(
      mockClient,
      mockEmbedding as unknown as EmbeddingService,
      { getTimestamp: () => TEST_TIMESTAMP }
    );
  });
  
  afterEach(() => {
    mockClient.clearPoints();
  });

  describe('EnhancedMemoryMigrationManager', () => {
    it('should create migration manager with default config', () => {
      const manager = new EnhancedMemoryMigrationManager(sourceService, targetService);
      expect(manager).toBeDefined();
    });
    
    it('should create migration manager with custom config', () => {
      const customConfig: MigrationConfig = {
        ...DEFAULT_MIGRATION_CONFIG,
        batchSize: 50,
        preserveIds: true
      };
      
      const manager = new EnhancedMemoryMigrationManager(sourceService, targetService, customConfig);
      expect(manager).toBeDefined();
    });

    it('should migrate memories with ULID generation', async () => {
      // Add test data to source
      const testMemories = [
        {
          id: 'old-uuid-1',
          vector: TEST_EMBEDDING,
          payload: {
            id: 'old-uuid-1',
            text: 'Test message 1',
            type: MemoryType.MESSAGE,
            timestamp: TEST_TIMESTAMP.toString(),
            metadata: {
              userId: createUserId('test-user'),
              importance: 'high'
            }
          }
        },
        {
          id: 'old-uuid-2',
          vector: TEST_EMBEDDING,
          payload: {
            id: 'old-uuid-2',
            text: 'Test message 2',
            type: MemoryType.MESSAGE,
            timestamp: TEST_TIMESTAMP.toString(),
            metadata: {
              userId: createUserId('test-user'),
              importance: 'medium'
            }
          }
        }
      ];

      // Mock the source service search to return test data only for MESSAGE type, empty for others
      vi.spyOn(sourceService, 'searchMemories').mockImplementation(async (params) => {
        if (params.type === MemoryType.MESSAGE) {
          return testMemories;
        }
        return []; // Return empty for all other memory types
      });

      const manager = new EnhancedMemoryMigrationManager(sourceService, targetService);
      const result = await manager.migrateAllMemories();

      expect(result.totalProcessed).toBe(testMemories.length);
      expect(result.successfulMigrations).toBe(testMemories.length);
      expect(result.failedMigrations).toBe(0);
      expect(result.idMappings.size).toBe(testMemories.length);
      
      // Verify new IDs are ULIDs (26 characters)
      result.idMappings.forEach((newId, oldId) => {
        expect(newId.length).toBe(26);
        expect(oldId).toMatch(/^old-uuid-/);
      });
    });

    it('should preserve IDs when configured', async () => {
      const testMemory = {
        id: 'preserve-this-id',
        vector: TEST_EMBEDDING,
        payload: {
          id: 'preserve-this-id',
          text: 'Test message',
          type: MemoryType.MESSAGE,
          timestamp: TEST_TIMESTAMP.toString(),
          metadata: {}
        }
      };

      vi.spyOn(sourceService, 'searchMemories').mockImplementation(async (params) => {
        if (params.type === MemoryType.MESSAGE) {
          return [testMemory];
        }
        return [];
      });

      const config: MigrationConfig = {
        ...DEFAULT_MIGRATION_CONFIG,
        preserveIds: true
      };

      const manager = new EnhancedMemoryMigrationManager(sourceService, targetService, config);
      const result = await manager.migrateAllMemories();

      expect(result.successfulMigrations).toBe(1);
      expect(result.idMappings.size).toBe(0); // No ID changes when preserving
    });

    it('should handle validation errors', async () => {
      const invalidMemory = {
        id: 'invalid-memory',
        vector: [], // Invalid empty vector
        payload: {
          id: 'invalid-memory',
          text: '', // Invalid empty text
          type: MemoryType.MESSAGE,
          timestamp: TEST_TIMESTAMP.toString(),
          metadata: {}
        }
      };

      vi.spyOn(sourceService, 'searchMemories').mockImplementation(async (params) => {
        if (params.type === MemoryType.MESSAGE) {
          return [invalidMemory];
        }
        return [];
      });

      const manager = new EnhancedMemoryMigrationManager(sourceService, targetService);
      const result = await manager.migrateAllMemories();

      expect(result.totalProcessed).toBe(1);
      expect(result.failedMigrations).toBe(1);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0]).toContain('Missing memory text content');
    });

    it('should perform dry run without actual migration', async () => {
      const testMemory = {
        id: 'test-id',
        vector: TEST_EMBEDDING,
        payload: {
          id: 'test-id',
          text: 'Test message',
          type: MemoryType.MESSAGE,
          timestamp: TEST_TIMESTAMP.toString(),
          metadata: {}
        }
      };

      vi.spyOn(sourceService, 'searchMemories').mockImplementation(async (params) => {
        if (params.type === MemoryType.MESSAGE) {
          return [testMemory];
        }
        return [];
      });
      
      const addMemorySpy = vi.spyOn(targetService, 'addMemory');

      const config: MigrationConfig = {
        ...DEFAULT_MIGRATION_CONFIG,
        dryRun: true
      };

      const manager = new EnhancedMemoryMigrationManager(sourceService, targetService, config);
      const result = await manager.migrateAllMemories();

      expect(result.successfulMigrations).toBe(1);
      expect(addMemorySpy).not.toHaveBeenCalled(); // No actual migration in dry run
    });

    it('should process memories in batches', async () => {
      const testMemories = Array.from({ length: 250 }, (_, i) => ({
        id: `memory-${i}`,
        vector: TEST_EMBEDDING,
        payload: {
          id: `memory-${i}`,
          text: `Test message ${i}`,
          type: MemoryType.MESSAGE,
          timestamp: TEST_TIMESTAMP.toString(),
          metadata: {}
        }
      }));

      vi.spyOn(sourceService, 'searchMemories').mockImplementation(async (params) => {
        if (params.type === MemoryType.MESSAGE) {
          return testMemories;
        }
        return [];
      });

      const config: MigrationConfig = {
        ...DEFAULT_MIGRATION_CONFIG,
        batchSize: 100
      };

      const manager = new EnhancedMemoryMigrationManager(sourceService, targetService, config);
      const result = await manager.migrateAllMemories();

      expect(result.totalProcessed).toBe(250);
      expect(result.successfulMigrations).toBe(250);
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Factory Functions', () => {
    it('should create migration manager with factory', () => {
      const manager = createMigrationManager(sourceService, targetService);
      expect(manager).toBeInstanceOf(EnhancedMemoryMigrationManager);
    });

    it('should create migration manager with custom config', () => {
      const customConfig = { batchSize: 50 };
      const manager = createMigrationManager(sourceService, targetService, customConfig);
      expect(manager).toBeInstanceOf(EnhancedMemoryMigrationManager);
    });

    it('should migrate to enhanced memory service', async () => {
      const testMemory = {
        id: 'test-id',
        vector: TEST_EMBEDDING,
        payload: {
          id: 'test-id',
          text: 'Test message',
          type: MemoryType.MESSAGE,
          timestamp: TEST_TIMESTAMP.toString(),
          metadata: {}
        }
      };

      vi.spyOn(sourceService, 'searchMemories').mockImplementation(async (params) => {
        if (params.type === MemoryType.MESSAGE) {
          return [testMemory];
        }
        return [];
      });

      const result = await migrateToEnhancedMemoryService(
        sourceService,
        mockClient,
        mockEmbedding as unknown as EmbeddingService
      );

      expect(result.totalProcessed).toBe(1);
      expect(result.successfulMigrations).toBe(1);
    });
  });

  describe('Validation Functions', () => {
    it('should identify enhanced memory service', () => {
      expect(isEnhancedMemoryService(targetService)).toBe(true);
      expect(isEnhancedMemoryService(sourceService)).toBe(false);
    });

    it('should validate enhanced memory service', () => {
      const validation = validateEnhancedMemoryService(targetService);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid enhanced memory service', () => {
      const validation = validateEnhancedMemoryService(null as any);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Enhanced memory service is null or undefined');
    });
  });

  describe('Error Handling', () => {
    it('should handle migration errors gracefully', async () => {
      const testMemory = {
        id: 'test-id',
        vector: TEST_EMBEDDING,
        payload: {
          id: 'test-id',
          text: 'Test message',
          type: MemoryType.MESSAGE,
          timestamp: TEST_TIMESTAMP.toString(),
          metadata: {}
        }
      };

      vi.spyOn(sourceService, 'searchMemories').mockImplementation(async (params) => {
        if (params.type === MemoryType.MESSAGE) {
          return [testMemory];
        }
        return [];
      });
      
      vi.spyOn(targetService, 'addMemory').mockResolvedValue({
        success: false,
        error: { code: 'TEST_ERROR', message: 'Test error message' }
      });

      const manager = new EnhancedMemoryMigrationManager(sourceService, targetService);
      const result = await manager.migrateAllMemories();

      expect(result.totalProcessed).toBe(1);
      expect(result.failedMigrations).toBe(1);
      expect(result.validationErrors).toContain('Memory test-id: Test error message');
    });

    it('should handle service search errors', async () => {
      vi.spyOn(sourceService, 'searchMemories').mockRejectedValue(new Error('Search failed'));

      const manager = new EnhancedMemoryMigrationManager(sourceService, targetService);
      
      await expect(manager.migrateAllMemories()).rejects.toThrow('Search failed');
    });
  });

  describe('Performance Metrics', () => {
    it('should track processing time', async () => {
      const testMemory = {
        id: 'test-id',
        vector: TEST_EMBEDDING,
        payload: {
          id: 'test-id',
          text: 'Test message',
          type: MemoryType.MESSAGE,
          timestamp: TEST_TIMESTAMP.toString(),
          metadata: {}
        }
      };

      vi.spyOn(sourceService, 'searchMemories').mockImplementation(async (params) => {
        if (params.type === MemoryType.MESSAGE) {
          return [testMemory];
        }
        return [];
      });

      const manager = new EnhancedMemoryMigrationManager(sourceService, targetService);
      const result = await manager.migrateAllMemories();

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.processingTimeMs).toBe('number');
    });

    it('should provide detailed migration statistics', async () => {
      const testMemories = [
        {
          id: 'valid-memory',
          vector: TEST_EMBEDDING,
          payload: {
            id: 'valid-memory',
            text: 'Valid message',
            type: MemoryType.MESSAGE,
            timestamp: TEST_TIMESTAMP.toString(),
            metadata: {}
          }
        },
        {
          id: 'invalid-memory',
          vector: [],
          payload: {
            id: 'invalid-memory',
            text: '',
            type: MemoryType.MESSAGE,
            timestamp: TEST_TIMESTAMP.toString(),
            metadata: {}
          }
        }
      ];

      vi.spyOn(sourceService, 'searchMemories').mockImplementation(async (params) => {
        if (params.type === MemoryType.MESSAGE) {
          return testMemories;
        }
        return [];
      });

      const manager = new EnhancedMemoryMigrationManager(sourceService, targetService);
      const result = await manager.migrateAllMemories();

      expect(result.totalProcessed).toBe(2);
      expect(result.successfulMigrations).toBe(1);
      expect(result.failedMigrations).toBe(1);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.idMappings.size).toBe(1); // Only successful migration creates ID mapping
    });
  });
});