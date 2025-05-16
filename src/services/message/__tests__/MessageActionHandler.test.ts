import { MessageActionHandler } from '../MessageActionHandler';
import { MessageImportance, MessageReliability } from '../MessageActionService';

// Mock fetch globally
global.fetch = jest.fn();

describe('MessageActionHandler', () => {
  let handler: MessageActionHandler;
  const mockMessage = {
    id: 'test-message-id',
    content: 'Test message content',
    timestamp: new Date()
  };

  beforeEach(() => {
    handler = new MessageActionHandler();
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('copyMessage', () => {
    beforeEach(() => {
      // Mock clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: jest.fn()
        },
        writable: true
      });
    });

    it('should copy message content to clipboard', async () => {
      const result = await handler.copyMessage({
        content: mockMessage.content
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockMessage.content);
      expect(result.success).toBe(true);
    });

    it('should handle clipboard errors', async () => {
      const error = new Error('Clipboard error');
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(error);

      const result = await handler.copyMessage({
        content: mockMessage.content
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clipboard error');
    });
  });

  describe('flagImportance', () => {
    it('should flag message importance', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await handler.flagImportance({
        messageId: mockMessage.id,
        timestamp: mockMessage.timestamp,
        content: mockMessage.content,
        importance: MessageImportance.HIGH
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/multi-agent/messages/flag-importance',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String)
        })
      );
      expect(result.success).toBe(true);
    });

    it('should handle API errors', async () => {
      const error = { error: 'API error' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(error)
      });

      const result = await handler.flagImportance({
        messageId: mockMessage.id,
        timestamp: mockMessage.timestamp,
        content: mockMessage.content,
        importance: MessageImportance.HIGH
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('flagReliability', () => {
    it('should flag message reliability', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await handler.flagReliability({
        messageId: mockMessage.id,
        timestamp: mockMessage.timestamp,
        content: mockMessage.content,
        reliability: MessageReliability.UNRELIABLE
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/multi-agent/messages/flag-reliability',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String)
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('addToKnowledge', () => {
    it('should add message to knowledge base', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await handler.addToKnowledge({
        messageId: mockMessage.id,
        timestamp: mockMessage.timestamp,
        content: mockMessage.content,
        tags: ['test'],
        category: 'test'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/multi-agent/knowledge/add',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String)
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('regenerateMessage', () => {
    it('should regenerate message', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await handler.regenerateMessage({
        messageId: mockMessage.id,
        timestamp: mockMessage.timestamp,
        content: mockMessage.content,
        avoidContent: 'avoid this',
        instructions: 'be more specific'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/multi-agent/messages/regenerate',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String)
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('exportToCoda', () => {
    it('should export message to Coda', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await handler.exportToCoda({
        messageId: mockMessage.id,
        timestamp: mockMessage.timestamp,
        content: mockMessage.content,
        title: 'Test Export',
        format: 'markdown'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/multi-agent/export/coda',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String)
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('deleteMessage', () => {
    it('should delete message', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await handler.deleteMessage({
        messageId: mockMessage.id,
        timestamp: mockMessage.timestamp
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/multi-agent/messages/${mockMessage.id}`,
        expect.objectContaining({
          method: 'DELETE',
          body: expect.any(String)
        })
      );
      expect(result.success).toBe(true);
    });
  });
}); 