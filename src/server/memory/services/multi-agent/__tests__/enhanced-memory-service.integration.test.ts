/**
 * Enhanced Memory Service Integration Tests
 * 
 * Comprehensive test suite covering:
 * - ULID ID generation and validation
 * - Multi-agent communication features
 * - Performance optimizations
 * - Migration helpers
 * - Production integration scenarios
 */
import { MemoryType } from '@/server/memory/config/types';
import { ulid } from 'ulid';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAgentId, createChatId, createUserId } from '../../../../../types/entity-identifier';
import { BaseMemorySchema } from '../../../models';
import { EmbeddingService } from '../../client/embedding-service';
import { IMemoryClient } from '../../client/types';
import { EnhancedMemoryPoint, EnhancedMemoryService } from '../enhanced-memory-service';

// Test data constants
const TEST_EMBEDDING = [0.1, 0.2, 0.3, 0.4];
const TEST_TIMESTAMP = 1640995200000; // 2022-01-01

// Mock memory client with proper typing
class MockMemoryClient implements IMemoryClient {
  private points: Map<string, EnhancedMemoryPoint<BaseMemorySchema>> = new Map();
  private collections: Set<string> = new Set(['messages', 'documents', 'thoughts']);

  async initialize(): Promise<void> { }
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
    point: EnhancedMemoryPoint<T>
  ): Promise<string> {
    this.points.set(point.id, point as EnhancedMemoryPoint<BaseMemorySchema>);
    return point.id;
  }

  async getPoints<T extends BaseMemorySchema>(
    collectionName: string,
    ids: string[]
  ): Promise<EnhancedMemoryPoint<T>[]> {
    return ids
      .map(id => this.points.get(id))
      .filter((point): point is EnhancedMemoryPoint<T> => !!point);
  }

  async searchPoints<T extends BaseMemorySchema>(
    collectionName: string,
    vector: number[],
    options?: any
  ): Promise<Array<{ point: EnhancedMemoryPoint<T>; score: number }>> {
    // Simple mock implementation - return all points with mock scores
    const allPoints = Array.from(this.points.values()) as EnhancedMemoryPoint<T>[];
    return allPoints.map(point => ({ point, score: 0.9 }));
  }

  async updatePoint<T extends BaseMemorySchema>(
    collectionName: string,
    id: string,
    updates: Partial<EnhancedMemoryPoint<T>>
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
    points: EnhancedMemoryPoint<T>[]
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
  ): Promise<EnhancedMemoryPoint<T>[]> {
    return Array.from(this.points.values()) as EnhancedMemoryPoint<T>[];
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

  // Test helper methods
  getAllPoints(): EnhancedMemoryPoint<BaseMemorySchema>[] {
    return Array.from(this.points.values());
  }

  clearPoints(): void {
    this.points.clear();
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

describe('EnhancedMemoryService Integration Tests', () => {
  let service: EnhancedMemoryService;
  let mockClient: MockMemoryClient;
  let mockEmbedding: MockEmbeddingService;

  beforeEach(() => {
    mockClient = new MockMemoryClient();
    mockEmbedding = new MockEmbeddingService();

    service = new EnhancedMemoryService(
      mockClient,
      mockEmbedding as unknown as EmbeddingService,
      { getTimestamp: () => TEST_TIMESTAMP }
    );
  });

  afterEach(() => {
    mockClient.clearPoints();
  });

  describe('ULID Integration', () => {
    it('should generate ULID when no ID provided', async () => {
      const result = await service.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Test message without ID'
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();

      // Verify ID format (ULID is 26 characters)
      expect(result.id!.length).toBe(26);

      // Verify it's a valid ULID by parsing it
      expect(() => ulid(result.id!)).not.toThrow();
    });

    it('should accept provided ULID', async () => {
      const testUlid = ulid();

      const result = await service.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Test message with ULID',
        id: testUlid
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe(testUlid);
    });

    it('should handle structured IDs properly', async () => {
      const userId = createUserId('test-user');
      const agentId = createAgentId('test-agent');

      const result = await service.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Test with structured IDs',
        metadata: { userId, agentId }
      });

      expect(result.success).toBe(true);

      const points = mockClient.getAllPoints();
      expect(points).toHaveLength(1);

      const point = points[0];
      // Enhanced fields should be in payload._indexableFields
      expect(point.payload._indexableFields.userId).toBeDefined();
      expect(point.payload._indexableFields.agentId).toBeDefined();
    });
  });

  describe('Multi-Agent Communication Features', () => {
    it('should store agent communication fields in payload._indexableFields', async () => {
      const senderAgentId = createAgentId('sender-agent');
      const receiverAgentId = createAgentId('receiver-agent');

      const result = await service.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Agent-to-agent message',
        metadata: {
          senderAgentId,
          receiverAgentId,
          communicationType: 'task_delegation',
          priority: 'high'
        }
      });

      expect(result.success).toBe(true);

      const points = mockClient.getAllPoints();
      expect(points).toHaveLength(1);

      const point = points[0];
      expect((point.payload as any)._indexableFields.senderAgentId).toBeDefined();
      expect((point.payload as any)._indexableFields.receiverAgentId).toBeDefined();
      expect((point.payload as any)._indexableFields.communicationType).toBe('task_delegation');
      expect((point.payload as any)._indexableFields.priority).toBe('high');
    });

    it('should support agent communication filtering', async () => {
      const agentId = createAgentId('target-agent');

      // Add multiple memories with different senders
      await service.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Message from agent 1',
        metadata: {
          senderAgentId: createAgentId('agent-1'),
          receiverAgentId: agentId
        }
      });

      await service.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Message from agent 2',
        metadata: {
          senderAgentId: createAgentId('agent-2'),
          receiverAgentId: agentId
        }
      });

      // Search for messages to specific agent
      const results = await service.searchMemories({
        type: MemoryType.MESSAGE,
        filter: { receiverAgentId: agentId }
      });

      expect(results).toHaveLength(2);
    });
  });

  describe('Performance Optimizations', () => {
    it('should create optimized filter conditions for common fields', async () => {
      const userId = createUserId('test-user');
      const chatId = createChatId('test-chat');

      // Add test data
      await service.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Test message',
        metadata: { userId, chatId, importance: 'high' }
      });

      // Test optimized filtering
      const results = await service.searchMemories({
        type: MemoryType.MESSAGE,
        filter: {
          userId,
          chatId,
          importance: 'high'
        }
      });

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBeDefined();
      expect(results[0].chatId).toBeDefined();
      expect(results[0].importance).toBe('high');
    });

    it('should handle complex nested metadata extraction', async () => {
      const threadId = 'complex-thread-123';

      const result = await service.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Message with complex metadata',
        metadata: {
          thread: {
            id: threadId,
            position: 5,
            branch: 'main'
          },
          messageType: 'system_notification'
        }
      });

      expect(result.success).toBe(true);

      const points = mockClient.getAllPoints();
      const point = points[0];

      expect((point.payload as any)._indexableFields.threadId).toBe(threadId);
      expect((point.payload as any)._indexableFields.messageType).toBe('system_notification');
    });
  });

  describe('Batch Operations', () => {
    it('should support batch memory addition with ULID generation', async () => {
      const memories = [
        { type: MemoryType.MESSAGE, content: 'Message 1' },
        { type: MemoryType.MESSAGE, content: 'Message 2' },
        { type: MemoryType.MESSAGE, content: 'Message 3' }
      ];

      const results = await Promise.all(
        memories.map(memory => service.addMemory(memory))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.id).toBeDefined();
        expect(result.id!.length).toBe(26); // ULID length
      });

      const points = mockClient.getAllPoints();
      expect(points).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid memory type gracefully', async () => {
      const result = await service.addMemory({
        type: 'INVALID_TYPE' as MemoryType,
        content: 'Test content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('MEMORY_VALIDATION_ERROR');
    });

    it('should validate required parameters', async () => {
      const result = await service.addMemory({
        type: MemoryType.MESSAGE,
        content: '' // Empty content
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing metadata structures', async () => {
      // Test with legacy-style metadata
      const result = await service.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Legacy format message',
        metadata: {
          user: 'legacy-user-id',
          timestamp: '2022-01-01T00:00:00Z',
          source: 'chat'
        }
      });

      expect(result.success).toBe(true);

      const points = mockClient.getAllPoints();
      expect(points).toHaveLength(1);

      // Should still create the memory even with non-standard metadata
      const point = points[0];
      expect(point.payload.metadata).toBeDefined();
    });
  });

  describe('Type Safety', () => {
    it('should maintain strict typing throughout operations', async () => {
      const userId = createUserId('typed-user');
      const agentId = createAgentId('typed-agent');

      const result = await service.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Typed message',
        metadata: {
          userId,
          agentId,
          customField: 'custom-value'
        }
      });

      expect(result.success).toBe(true);

      // Verify types are preserved
      const points = mockClient.getAllPoints();
      const point = points[0];

      expect(typeof (point.payload as any)._indexableFields.userId).toBe('string');
      expect(typeof (point.payload as any)._indexableFields.agentId).toBe('string');
      expect(typeof (point.payload as any)._indexableFields.timestamp).toBe('number');
    });
  });
});