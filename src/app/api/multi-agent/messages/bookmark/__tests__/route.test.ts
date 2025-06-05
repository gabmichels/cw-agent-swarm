import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';
import { getMemoryServices } from '@/server/memory/services';
import { MemoryType } from '@/server/memory/config/types';
import { MetadataField } from '@/types/metadata';

// Mock dependencies
vi.mock('@/server/memory/services');
vi.mock('@/server/memory/config/types');

const mockGetMemoryServices = getMemoryServices as ReturnType<typeof vi.fn>;

describe('/api/multi-agent/messages/bookmark', () => {
  let mockMemoryService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockMemoryService = {
      searchMemories: vi.fn(),
      updateMemory: vi.fn()
    };

    (mockGetMemoryServices as any).mockResolvedValue({
      memoryService: mockMemoryService,
      embeddingService: {} as any,
      client: {} as any,
      searchService: {} as any,
      queryOptimizer: {} as any
    });
  });

  describe('POST /api/multi-agent/messages/bookmark', () => {
    const validRequestBody = {
      messageId: 'msg_123',
      timestamp: '2024-01-01T12:00:00.000Z',
      content: 'Test message content',
      isBookmarked: true
    };

    const createMockRequest = (body: any) => {
      return new NextRequest('http://localhost/api/multi-agent/messages/bookmark', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    };

    it('should successfully bookmark a message', async () => {
      const mockMemory = {
        id: 'memory_123',
        payload: {
          metadata: {
            [MetadataField.MESSAGE_ID]: 'msg_123',
            [MetadataField.ROLE]: 'user'
          },
          text: 'Test message content'
        }
      };

      mockMemoryService.searchMemories.mockResolvedValueOnce([mockMemory]);
      mockMemoryService.updateMemory.mockResolvedValueOnce(true);

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.messageId).toBe('msg_123');
      expect(data.data.isBookmarked).toBe(true);
      expect(data.data.bookmarkedAt).toBeDefined();

      expect(mockMemoryService.searchMemories).toHaveBeenCalledWith({
        query: 'Test message content',
        type: MemoryType.MESSAGE,
        limit: 100,
        minScore: 0.1
      });

      expect(mockMemoryService.updateMemory).toHaveBeenCalledWith({
        type: MemoryType.MESSAGE,
        id: 'memory_123',
        metadata: expect.objectContaining({
          [MetadataField.IS_BOOKMARK]: true,
          [MetadataField.BOOKMARKED_AT]: expect.any(String)
        })
      });
    });

    it('should successfully remove bookmark from a message', async () => {
      const unbookmarkRequest = {
        ...validRequestBody,
        isBookmarked: false
      };

      const mockMemory = {
        id: 'memory_123',
        payload: {
          metadata: {
            [MetadataField.MESSAGE_ID]: 'msg_123',
            [MetadataField.IS_BOOKMARK]: true,
            [MetadataField.BOOKMARKED_AT]: '2024-01-01T12:30:00.000Z'
          },
          text: 'Test message content'
        }
      };

      mockMemoryService.searchMemories.mockResolvedValueOnce([mockMemory]);
      mockMemoryService.updateMemory.mockResolvedValueOnce(true);

      const request = createMockRequest(unbookmarkRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isBookmarked).toBe(false);
      expect(data.data.bookmarkedAt).toBeUndefined();

      expect(mockMemoryService.updateMemory).toHaveBeenCalledWith({
        type: MemoryType.MESSAGE,
        id: 'memory_123',
        metadata: expect.objectContaining({
          [MetadataField.IS_BOOKMARK]: false,
          [MetadataField.BOOKMARKED_AT]: undefined
        })
      });
    });

    it('should return 400 when messageId is missing', async () => {
      const invalidRequest = {
        timestamp: '2024-01-01T12:00:00.000Z',
        content: 'Test message content',
        isBookmarked: true
      };

      const request = createMockRequest(invalidRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Message ID is required');
    });

    it('should return 404 when message is not found', async () => {
      mockMemoryService.searchMemories.mockResolvedValueOnce([]);

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Message not found in memory');
    });

    it('should find message by timestamp and content when messageId lookup fails', async () => {
      const mockMemory = {
        id: 'memory_123',
        payload: {
          metadata: {
            [MetadataField.TIMESTAMP]: '2024-01-01T12:00:00.000Z',
            [MetadataField.ROLE]: 'user'
          },
          text: 'Test message content'
        }
      };

      // First call returns empty (messageId not found), but findFn would find it by timestamp
      mockMemoryService.searchMemories.mockResolvedValueOnce([mockMemory]);
      mockMemoryService.updateMemory.mockResolvedValueOnce(true);

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 500 when memory update fails', async () => {
      const mockMemory = {
        id: 'memory_123',
        payload: {
          metadata: { [MetadataField.MESSAGE_ID]: 'msg_123' },
          text: 'Test message content'
        }
      };

      mockMemoryService.searchMemories.mockResolvedValueOnce([mockMemory]);
      mockMemoryService.updateMemory.mockResolvedValueOnce(false);

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to update bookmark status');
    });

    it('should handle memory service errors', async () => {
      mockMemoryService.searchMemories.mockRejectedValueOnce(new Error('Memory service error'));

      const request = createMockRequest(validRequestBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle empty content gracefully', async () => {
      const requestWithEmptyContent = {
        ...validRequestBody,
        content: ''
      };

      const mockMemory = {
        id: 'memory_123',
        payload: {
          metadata: { [MetadataField.MESSAGE_ID]: 'msg_123' },
          text: ''
        }
      };

      mockMemoryService.searchMemories.mockResolvedValueOnce([mockMemory]);
      mockMemoryService.updateMemory.mockResolvedValueOnce(true);

      const request = createMockRequest(requestWithEmptyContent);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/multi-agent/messages/bookmark', () => {
    const createMockRequest = (messageId: string) => {
      return new NextRequest(`http://localhost/api/multi-agent/messages/bookmark?messageId=${messageId}`, {
        method: 'GET'
      });
    };

    it('should return bookmark status for bookmarked message', async () => {
      const mockMemory = {
        id: 'memory_123',
        payload: {
          metadata: {
            [MetadataField.MESSAGE_ID]: 'msg_123',
            [MetadataField.IS_BOOKMARK]: true,
            [MetadataField.BOOKMARKED_AT]: '2024-01-01T12:30:00.000Z'
          }
        }
      };

      mockMemoryService.searchMemories.mockResolvedValueOnce([mockMemory]);

      const request = createMockRequest('msg_123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isBookmarked).toBe(true);
      expect(data.bookmarkedAt).toBe('2024-01-01T12:30:00.000Z');
    });

    it('should return false for non-bookmarked message', async () => {
      const mockMemory = {
        id: 'memory_123',
        payload: {
          metadata: {
            [MetadataField.MESSAGE_ID]: 'msg_123',
            [MetadataField.IS_BOOKMARK]: false
          }
        }
      };

      mockMemoryService.searchMemories.mockResolvedValueOnce([mockMemory]);

      const request = createMockRequest('msg_123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isBookmarked).toBe(false);
    });

    it('should return false when message is not found', async () => {
      mockMemoryService.searchMemories.mockResolvedValueOnce([]);

      const request = createMockRequest('nonexistent_msg');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isBookmarked).toBe(false);
    });

    it('should return 400 when messageId is missing', async () => {
      const request = new NextRequest('http://localhost/api/multi-agent/messages/bookmark', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Message ID is required');
    });

    it('should handle memory service errors', async () => {
      mockMemoryService.searchMemories.mockRejectedValueOnce(new Error('Memory service error'));

      const request = createMockRequest('msg_123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });

    it('should return false when bookmark metadata is undefined', async () => {
      const mockMemory = {
        id: 'memory_123',
        payload: {
          metadata: {
            [MetadataField.MESSAGE_ID]: 'msg_123'
            // No bookmark fields
          }
        }
      };

      mockMemoryService.searchMemories.mockResolvedValueOnce([mockMemory]);

      const request = createMockRequest('msg_123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isBookmarked).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle bookmark toggle workflow correctly', async () => {
      // Setup initial non-bookmarked message
      const mockMemory = {
        id: 'memory_123',
        payload: {
          metadata: {
            [MetadataField.MESSAGE_ID]: 'msg_123',
            [MetadataField.IS_BOOKMARK]: false
          },
          text: 'Test message'
        }
      };

      // Test 1: Bookmark the message
      mockMemoryService.searchMemories.mockResolvedValueOnce([mockMemory]);
      mockMemoryService.updateMemory.mockResolvedValueOnce(true);

      const bookmarkRequest = new NextRequest('http://localhost/api/multi-agent/messages/bookmark', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'msg_123',
          timestamp: '2024-01-01T12:00:00.000Z',
          content: 'Test message',
          isBookmarked: true
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const bookmarkResponse = await POST(bookmarkRequest);
      const bookmarkData = await bookmarkResponse.json();

      expect(bookmarkData.success).toBe(true);
      expect(bookmarkData.data.isBookmarked).toBe(true);

      // Test 2: Check bookmark status
      const updatedMemory = {
        ...mockMemory,
        payload: {
          ...mockMemory.payload,
          metadata: {
            ...mockMemory.payload.metadata,
            [MetadataField.IS_BOOKMARK]: true,
            [MetadataField.BOOKMARKED_AT]: '2024-01-01T12:30:00.000Z'
          }
        }
      };

      mockMemoryService.searchMemories.mockResolvedValueOnce([updatedMemory]);

      const statusRequest = new NextRequest('http://localhost/api/multi-agent/messages/bookmark?messageId=msg_123', {
        method: 'GET'
      });

      const statusResponse = await GET(statusRequest);
      const statusData = await statusResponse.json();

      expect(statusData.success).toBe(true);
      expect(statusData.isBookmarked).toBe(true);
      expect(statusData.bookmarkedAt).toBe('2024-01-01T12:30:00.000Z');
    });

    it('should handle performance with large message content', async () => {
      const largeContent = 'a'.repeat(50000); // 50KB message
      
      const mockMemory = {
        id: 'memory_123',
        payload: {
          metadata: { [MetadataField.MESSAGE_ID]: 'msg_123' },
          text: largeContent
        }
      };

      mockMemoryService.searchMemories.mockResolvedValueOnce([mockMemory]);
      mockMemoryService.updateMemory.mockResolvedValueOnce(true);

      const request = new NextRequest('http://localhost/api/multi-agent/messages/bookmark', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'msg_123',
          content: largeContent,
          isBookmarked: true
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const startTime = Date.now();
      const response = await POST(request);
      const endTime = Date.now();
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
}); 