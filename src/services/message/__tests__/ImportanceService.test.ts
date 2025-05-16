import { ImportanceService } from '../ImportanceService';
import { MessageImportance } from '../MessageActionService';

// Mock fetch globally
global.fetch = jest.fn();

describe('ImportanceService', () => {
  let service: ImportanceService;
  const mockMessage = {
    id: 'test-message-id',
    content: 'Test message content',
    timestamp: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('without listeners', () => {
    beforeEach(() => {
      service = new ImportanceService();
    });

    it('should flag message importance', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await service.flagImportance({
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

      const result = await service.flagImportance({
        messageId: mockMessage.id,
        timestamp: mockMessage.timestamp,
        content: mockMessage.content,
        importance: MessageImportance.HIGH
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });

    it('should get message importance', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ importance: MessageImportance.HIGH })
      });

      const importance = await service.getMessageImportance(mockMessage.id);

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/multi-agent/messages/${mockMessage.id}/importance`
      );
      expect(importance).toBe(MessageImportance.HIGH);
    });

    it('should return default importance on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const importance = await service.getMessageImportance(mockMessage.id);

      expect(importance).toBe(MessageImportance.MEDIUM);
    });
  });

  describe('with listeners', () => {
    const mockOnImportanceChange = jest.fn();

    beforeEach(() => {
      service = new ImportanceService({
        onImportanceChange: mockOnImportanceChange
      });
    });

    it('should notify listeners when importance changes', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      await service.flagImportance({
        messageId: mockMessage.id,
        timestamp: mockMessage.timestamp,
        content: mockMessage.content,
        importance: MessageImportance.HIGH
      });

      expect(mockOnImportanceChange).toHaveBeenCalledWith(
        mockMessage.id,
        MessageImportance.HIGH
      );
    });

    it('should not notify listeners on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'API error' })
      });

      await service.flagImportance({
        messageId: mockMessage.id,
        timestamp: mockMessage.timestamp,
        content: mockMessage.content,
        importance: MessageImportance.HIGH
      });

      expect(mockOnImportanceChange).not.toHaveBeenCalled();
    });
  });
}); 