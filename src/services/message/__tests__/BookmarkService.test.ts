import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookmarkService, BookmarkServiceOptions } from '../BookmarkService';
import { MessageActionResult } from '../MessageActionService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BookmarkService', () => {
  let bookmarkService: BookmarkService;
  let mockOnBookmarkChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnBookmarkChange = vi.fn();
    
    const options: BookmarkServiceOptions = {
      onBookmarkChange: mockOnBookmarkChange
    };
    
    bookmarkService = new BookmarkService(options);
  });

  describe('constructor', () => {
    it('should create instance without options', () => {
      const service = new BookmarkService();
      expect(service).toBeInstanceOf(BookmarkService);
    });

    it('should create instance with options', () => {
      const options: BookmarkServiceOptions = {
        onBookmarkChange: vi.fn()
      };
      const service = new BookmarkService(options);
      expect(service).toBeInstanceOf(BookmarkService);
    });
  });

  describe('toggleBookmark', () => {
    const validOptions = {
      messageId: 'msg_123',
      timestamp: new Date('2024-01-01'),
      content: 'Test message content',
      isBookmarked: true
    };

    it('should successfully bookmark a message', async () => {
      const mockResponse = {
        success: true,
        data: {
          messageId: 'msg_123',
          isBookmarked: true,
          bookmarkedAt: '2024-01-01T12:00:00.000Z'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await bookmarkService.toggleBookmark(validOptions);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/multi-agent/messages/bookmark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: 'msg_123',
          timestamp: validOptions.timestamp,
          content: 'Test message content',
          isBookmarked: true
        }),
      });

      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });

      expect(mockOnBookmarkChange).toHaveBeenCalledTimes(1);
      expect(mockOnBookmarkChange).toHaveBeenCalledWith('msg_123', true);
    });

    it('should successfully remove bookmark from a message', async () => {
      const unbookmarkOptions = {
        ...validOptions,
        isBookmarked: false
      };

      const mockResponse = {
        success: true,
        data: {
          messageId: 'msg_123',
          isBookmarked: false,
          bookmarkedAt: null
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await bookmarkService.toggleBookmark(unbookmarkOptions);

      expect(result).toEqual({
        success: true,
        data: mockResponse.data
      });

      expect(mockOnBookmarkChange).toHaveBeenCalledTimes(1);
      expect(mockOnBookmarkChange).toHaveBeenCalledWith('msg_123', false);
    });

    it('should handle API error response', async () => {
      const mockErrorResponse = {
        success: false,
        error: 'Message not found'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => mockErrorResponse
      });

      const result = await bookmarkService.toggleBookmark(validOptions);

      expect(result).toEqual({
        success: false,
        error: 'Message not found'
      });

      expect(mockOnBookmarkChange).not.toHaveBeenCalled();
    });

    it('should handle network error', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(networkError);

      const result = await bookmarkService.toggleBookmark(validOptions);

      expect(result).toEqual({
        success: false,
        error: 'Network error'
      });

      expect(mockOnBookmarkChange).not.toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValueOnce('String error');

      const result = await bookmarkService.toggleBookmark(validOptions);

      expect(result).toEqual({
        success: false,
        error: 'Unknown error occurred'
      });

      expect(mockOnBookmarkChange).not.toHaveBeenCalled();
    });

    it('should not call onBookmarkChange if not provided', async () => {
      const serviceWithoutCallback = new BookmarkService();
      
      const mockResponse = {
        success: true,
        data: { messageId: 'msg_123', isBookmarked: true }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await serviceWithoutCallback.toggleBookmark(validOptions);

      expect(result.success).toBe(true);
      expect(mockOnBookmarkChange).not.toHaveBeenCalled();
    });
  });

  describe('getMessageBookmarkStatus', () => {
    it('should return bookmark status for existing bookmarked message', async () => {
      const mockResponse = {
        success: true,
        isBookmarked: true,
        bookmarkedAt: '2024-01-01T12:00:00.000Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await bookmarkService.getMessageBookmarkStatus('msg_123');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/multi-agent/messages/bookmark?messageId=msg_123');
      expect(result).toBe(true);
    });

    it('should return false for non-bookmarked message', async () => {
      const mockResponse = {
        success: true,
        isBookmarked: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await bookmarkService.getMessageBookmarkStatus('msg_123');

      expect(result).toBe(false);
    });

    it('should return false when API returns error', async () => {
      const mockResponse = {
        success: false,
        error: 'Message not found'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => mockResponse
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await bookmarkService.getMessageBookmarkStatus('msg_123');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error getting bookmark status:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should return false when network error occurs', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await bookmarkService.getMessageBookmarkStatus('msg_123');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error getting bookmark status:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getBookmarkedMessages', () => {
    it('should return bookmarked messages successfully', async () => {
      const mockMessages = [
        {
          id: 'mem_1',
          messageId: 'msg_1',
          content: 'First bookmarked message',
          timestamp: '2024-01-01T12:00:00.000Z',
          bookmarkedAt: '2024-01-01T12:30:00.000Z',
          role: 'user'
        },
        {
          id: 'mem_2',
          messageId: 'msg_2',
          content: 'Second bookmarked message',
          timestamp: '2024-01-01T13:00:00.000Z',
          bookmarkedAt: '2024-01-01T13:30:00.000Z',
          role: 'assistant'
        }
      ];

      const mockResponse = {
        success: true,
        messages: mockMessages,
        pagination: {
          total: 2,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await bookmarkService.getBookmarkedMessages();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/multi-agent/messages/bookmarks');
      
      expect(result).toEqual({
        success: true,
        data: mockMessages
      });
    });

    it('should handle empty bookmarks list', async () => {
      const mockResponse = {
        success: true,
        messages: [],
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await bookmarkService.getBookmarkedMessages();

      expect(result).toEqual({
        success: true,
        data: []
      });
    });

    it('should handle API error response', async () => {
      const mockResponse = {
        success: false,
        error: 'Internal server error'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => mockResponse
      });

      const result = await bookmarkService.getBookmarkedMessages();

      expect(result).toEqual({
        success: false,
        error: 'Internal server error'
      });
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      const result = await bookmarkService.getBookmarkedMessages();

      expect(result).toEqual({
        success: false,
        error: 'Network connection failed'
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValueOnce('Unexpected error');

      const result = await bookmarkService.getBookmarkedMessages();

      expect(result).toEqual({
        success: false,
        error: 'Unknown error occurred'
      });
    });

    it('should handle missing messages array in response', async () => {
      const mockResponse = {
        success: true,
        // messages array is missing
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await bookmarkService.getBookmarkedMessages();

      expect(result).toEqual({
        success: true,
        data: []
      });
    });
  });

  describe('edge cases and performance', () => {
    it('should handle very long message content', async () => {
      const longContent = 'a'.repeat(10000);
      const options = {
        messageId: 'msg_123',
        timestamp: new Date(),
        content: longContent,
        isBookmarked: true
      };

      const mockResponse = { success: true, data: {} };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await bookmarkService.toggleBookmark(options);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/multi-agent/messages/bookmark',
        expect.objectContaining({
          body: expect.stringContaining(longContent)
        })
      );
    });

    it('should handle special characters in message content', async () => {
      const specialContent = 'Test with "quotes", \'apostrophes\', and 🚀 emojis & symbols <>';
      const options = {
        messageId: 'msg_123',
        timestamp: new Date(),
        content: specialContent,
        isBookmarked: true
      };

      const mockResponse = { success: true, data: {} };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await bookmarkService.toggleBookmark(options);

      expect(result.success).toBe(true);
    });

    it('should handle concurrent bookmark operations', async () => {
      const mockResponse = { success: true, data: {} };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const options1 = {
        messageId: 'msg_1',
        timestamp: new Date(),
        content: 'Message 1',
        isBookmarked: true
      };

      const options2 = {
        messageId: 'msg_2',
        timestamp: new Date(),
        content: 'Message 2',
        isBookmarked: false
      };

      const [result1, result2] = await Promise.all([
        bookmarkService.toggleBookmark(options1),
        bookmarkService.toggleBookmark(options2)
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
}); 