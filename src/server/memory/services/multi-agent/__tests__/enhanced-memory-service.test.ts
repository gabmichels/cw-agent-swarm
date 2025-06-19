/**
 * Enhanced Memory Service Tests
 */
import { describe, it, expect, beforeEach, vi, SpyInstance } from 'vitest';
import { EnhancedMemoryService, EnhancedMemoryPoint } from '../enhanced-memory-service';
import { BaseMemorySchema, MemoryPoint } from '../../../models';
import { IMemoryClient } from '../../client/types';
import { EmbeddingService, EmbeddingResult } from '../../client/embedding-service';
import { MemoryType } from '@/server/memory/config/types';
import { StructuredId } from '../../../../../utils/ulid';
import { createAgentId, createChatId, createUserId } from '../../../../../types/entity-identifier';
import { MemoryService } from '../../memory/memory-service';

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
    it('should add memory with top-level indexable fields', async () => {
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
      const point = callArgs[1] as EnhancedMemoryPoint<BaseMemorySchema>;
      
      // Verify collection name
      expect(collectionName).toBe('messages');
      
      // Verify point has top-level indexable fields
      expect(point.userId).toBeDefined();
      expect(point.agentId).toBeDefined();
      expect(point.chatId).toBeDefined();
      expect(point.threadId).toBe('thread-1');
      expect(point.messageType).toBe('text');
      expect(point.importance).toBe('high');
      expect(point.timestamp).toBe(mockTimestamp);
      
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
    it('should optimize search with top-level fields', async () => {
      // Create structured ID for testing
      const agentId = createAgentId('test-agent');
      
      // Mock scrollPoints to return test data
      const mockPoints = [{
        id: 'test-id',
        vector: mockEmbedding,
        payload: {
          id: 'test-id',
          text: 'Test message',
          type: MemoryType.MESSAGE,
          timestamp: mockTimestamp.toString(),
          metadata: { agentId }
        },
        agentId: agentId.toString(),
        timestamp: mockTimestamp
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
      
      // Verify results are returned
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-id');
    });
  });
}); 