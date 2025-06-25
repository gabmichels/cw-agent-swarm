/**
 * Enhanced Memory Service Tests
 */
import { MemoryType } from '@/server/memory/config/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgentId, createChatId, createUserId } from '../../../../../types/entity-identifier';
import { EmbeddingResult, EmbeddingService } from '../../client/embedding-service';
import { IMemoryClient } from '../../client/types';
import { EnhancedMemoryService } from '../enhanced-memory-service';

// Mock data
const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
const mockTimestamp = 1633372800000; // 2021-10-05

// Mock clients
const mockMemoryClient: Record<keyof IMemoryClient, any> = {
  initialize: vi.fn().mockResolvedValue(undefined),
  isInitialized: vi.fn().mockReturnValue(true),
  getStatus: vi.fn().mockResolvedValue({ status: 'ok' }),
  createCollection: vi.fn().mockResolvedValue(true),
  collectionExists: vi.fn().mockResolvedValue(true),
  addPoint: vi.fn().mockResolvedValue('mock-id'),
  getPoints: vi.fn().mockResolvedValue([]),
  searchPoints: vi.fn().mockResolvedValue([]),
  updatePoint: vi.fn().mockResolvedValue(true),
  deletePoint: vi.fn().mockResolvedValue(true),
  addPoints: vi.fn().mockResolvedValue(['mock-id']),
  scrollPoints: vi.fn().mockResolvedValue([]),
  getPointCount: vi.fn().mockResolvedValue(0),
  getCollectionInfo: vi.fn().mockResolvedValue({
    name: 'test',
    dimensions: 1536,
    pointsCount: 0,
    createdAt: new Date()
  }),
};

// Create a mock that matches the actual service API
const mockEmbeddingService = {
  getEmbedding: vi.fn().mockResolvedValue({ embedding: mockEmbedding } as EmbeddingResult),
  getBatchEmbeddings: vi.fn().mockResolvedValue([{ embedding: mockEmbedding }] as EmbeddingResult[])
} as unknown as EmbeddingService;

describe('EnhancedMemoryService', () => {
  let service: EnhancedMemoryService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create service with mocked dependencies
    service = new EnhancedMemoryService(
      mockMemoryClient as unknown as IMemoryClient,
      mockEmbeddingService,
      { getTimestamp: () => mockTimestamp }
    );
  });

  describe('addMemory', () => {
    it('should add memory with enhanced fields in payload._indexableFields', async () => {
      // Create structured IDs for testing
      const userId = createUserId('test-user');
      const agentId = createAgentId('test-agent');
      const chatId = createChatId('test-chat');

      // Call service
      const result = await service.addMemory({
        type: MemoryType.MESSAGE,
        content: 'Test message',
        metadata: {
          userId,
          agentId,
          chatId,
          thread: { id: 'thread-1', position: 1 },
          messageType: 'text',
          importance: 'high'
        }
      });

      // Verify result
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();

      // Verify client called with enhanced point
      expect(mockMemoryClient.addPoint).toHaveBeenCalledTimes(1);

      // Get the first call arguments
      const callArgs = mockMemoryClient.addPoint.mock.calls[0];
      const collectionName = callArgs[0];
      const point = callArgs[1] as any; // Use any since we're testing the fixed structure

      // Verify collection name
      expect(collectionName).toBe('messages');

      // Verify Qdrant-compatible structure (only id, vector, payload at top level)
      expect(point.id).toBeDefined();
      expect(point.vector).toBeDefined();
      expect(point.payload).toBeDefined();

      // Enhanced fields should NOT be at top level (Qdrant-compatible)
      expect(point.userId).toBeUndefined();
      expect(point.agentId).toBeUndefined();
      expect(point.chatId).toBeUndefined();

      // Enhanced fields should be in payload._indexableFields
      expect(point.payload._indexableFields).toBeDefined();
      expect(point.payload._indexableFields.userId).toBeDefined();
      expect(point.payload._indexableFields.agentId).toBeDefined();
      expect(point.payload._indexableFields.chatId).toBeDefined();
      expect(point.payload._indexableFields.threadId).toBe('thread-1');
      expect(point.payload._indexableFields.messageType).toBe('text');
      expect(point.payload._indexableFields.importance).toBe('high');
      expect(point.payload._indexableFields.timestamp).toBe(mockTimestamp);

      // Verify payload metadata exists (just check it's there)
      expect(point.payload.metadata).toBeDefined();
      // Note: Using type assertion since the metadata structure is dynamic
      const metadata = point.payload.metadata as any;
      expect(metadata.userId).toEqual(userId);
      expect(metadata.agentId).toEqual(agentId);
      expect(metadata.chatId).toEqual(chatId);
    });
  });

  describe('searchMemories', () => {
    it('should optimize search with enhanced fields from _indexableFields', async () => {
      // Create structured ID for testing
      const agentId = createAgentId('test-agent');

      // Mock scrollPoints to return test data with _indexableFields
      const mockPoints = [{
        id: 'test-id',
        vector: mockEmbedding,
        payload: {
          id: 'test-id',
          text: 'Test message',
          type: MemoryType.MESSAGE,
          timestamp: mockTimestamp.toString(),
          metadata: { agentId },
          _indexableFields: {
            agentId: agentId.toString(),
            timestamp: mockTimestamp
          }
        }
      }];

      mockMemoryClient.scrollPoints.mockResolvedValue(mockPoints);

      // Call service
      const results = await service.searchMemories({
        type: MemoryType.MESSAGE,
        filter: { agentId }
      });

      // Verify scrollPoints was called with correct collection and filter
      expect(mockMemoryClient.scrollPoints).toHaveBeenCalledTimes(1);
      const scrollCall = mockMemoryClient.scrollPoints.mock.calls[0];
      expect(scrollCall[0]).toBe('messages'); // collection name
      expect(scrollCall[1]).toEqual({ must: expect.any(Array) }); // filter
      expect(scrollCall[2]).toBe(10); // limit
      expect(scrollCall[3]).toBe(0); // offset

      // Verify results are returned with enhanced fields at top level (for API compatibility)
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-id');
      expect(results[0].agentId).toBe(agentId.toString());
      expect(results[0].timestamp).toBe(mockTimestamp);
    });
  });
}); 