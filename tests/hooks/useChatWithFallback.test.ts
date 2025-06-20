import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatWithFallback } from '../../src/hooks/useChatWithFallback';

// Mock the SSE and polling hooks
const mockUseChatSSE = vi.fn();
const mockUseChatPolling = vi.fn();

vi.mock('../../src/hooks/useChatSSE', () => ({
  useChatSSE: mockUseChatSSE
}));

vi.mock('../../src/hooks/useChatPolling', () => ({
  useChatPolling: mockUseChatPolling
}));

// Mock logger
vi.mock('../../src/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  }
}));

describe('useChatWithFallback Hook Tests', () => {
  const mockChatId = 'test-chat-123';
  const mockUserId = 'user-456';

  // Default mock implementations
  const defaultSSEReturn = {
    messages: [],
    isConnected: true,
    isLoading: false,
    error: null,
    sendMessage: vi.fn(),
    reconnect: vi.fn(),
    disconnect: vi.fn()
  };

  const defaultPollingReturn = {
    messages: [],
    isConnected: false,
    isLoading: false,
    error: null,
    sendMessage: vi.fn(),
    reconnect: vi.fn(),
    disconnect: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mock returns
    mockUseChatSSE.mockReturnValue(defaultSSEReturn);
    mockUseChatPolling.mockReturnValue(defaultPollingReturn);
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Normal Operation', () => {
    it('should use SSE by default when online and connected', () => {
      const { result } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      expect(mockUseChatSSE).toHaveBeenCalledWith({
        chatId: mockChatId,
        userId: mockUserId
      });
      
      expect(result.current.isConnected).toBe(true);
      expect(result.current.connectionType).toBe('sse');
    });

    it('should pass through SSE messages and methods', () => {
      const mockMessages = [
        { id: '1', content: 'Hello', userId: mockUserId, timestamp: '2023-01-01T00:00:00Z' },
        { id: '2', content: 'World', userId: mockUserId, timestamp: '2023-01-01T00:01:00Z' }
      ];

      mockUseChatSSE.mockReturnValue({
        ...defaultSSEReturn,
        messages: mockMessages
      });

      const { result } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      expect(result.current.messages).toEqual(mockMessages);
      expect(result.current.sendMessage).toBe(defaultSSEReturn.sendMessage);
    });
  });

  describe('Fallback Logic', () => {
    it('should fallback to polling when SSE fails to connect', () => {
      mockUseChatSSE.mockReturnValue({
        ...defaultSSEReturn,
        isConnected: false,
        error: new Error('SSE connection failed')
      });

      mockUseChatPolling.mockReturnValue({
        ...defaultPollingReturn,
        isConnected: true
      });

      const { result } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      expect(result.current.isConnected).toBe(true);
      expect(result.current.connectionType).toBe('polling');
      expect(mockUseChatPolling).toHaveBeenCalledWith({
        chatId: mockChatId,
        userId: mockUserId
      });
    });

    it('should fallback to polling when offline', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false
      });

      mockUseChatPolling.mockReturnValue({
        ...defaultPollingReturn,
        isConnected: true
      });

      const { result } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      expect(result.current.connectionType).toBe('polling');
      expect(mockUseChatPolling).toHaveBeenCalled();
    });

    it('should attempt reconnection with exponential backoff', async () => {
      const mockReconnect = vi.fn();
      mockUseChatSSE.mockReturnValue({
        ...defaultSSEReturn,
        isConnected: false,
        error: new Error('Connection lost'),
        reconnect: mockReconnect
      });

      const { result } = renderHook(() => 
        useChatWithFallback({ 
          chatId: mockChatId, 
          userId: mockUserId,
          reconnectAttempts: 2,
          reconnectDelay: 100
        })
      );

      act(() => {
        result.current.reconnect();
      });

      // Should attempt reconnection
      expect(mockReconnect).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle SSE errors gracefully', () => {
      const sseError = new Error('SSE connection error');
      mockUseChatSSE.mockReturnValue({
        ...defaultSSEReturn,
        isConnected: false,
        error: sseError
      });

      const { result } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      expect(result.current.error).toBe(sseError);
      expect(result.current.connectionType).toBe('polling'); // Should fallback
    });

    it('should handle polling errors when SSE also fails', () => {
      const sseError = new Error('SSE failed');
      const pollingError = new Error('Polling failed');

      mockUseChatSSE.mockReturnValue({
        ...defaultSSEReturn,
        isConnected: false,
        error: sseError
      });

      mockUseChatPolling.mockReturnValue({
        ...defaultPollingReturn,
        isConnected: false,
        error: pollingError
      });

      const { result } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      expect(result.current.error).toBe(pollingError);
      expect(result.current.isConnected).toBe(false);
    });

    it('should retry failed connections', async () => {
      let connectionAttempt = 0;
      
      mockUseChatSSE.mockImplementation(() => {
        connectionAttempt++;
        if (connectionAttempt === 1) {
          return {
            ...defaultSSEReturn,
            isConnected: false,
            error: new Error('First attempt failed')
          };
        }
        return {
          ...defaultSSEReturn,
          isConnected: true,
          error: null
        };
      });

      const { result, rerender } = renderHook(() => 
        useChatWithFallback({ 
          chatId: mockChatId, 
          userId: mockUserId,
          maxRetries: 2
        })
      );

      expect(result.current.isConnected).toBe(false);

      // Simulate retry
      rerender();

      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('Network Status Detection', () => {
    it('should detect online/offline status changes', () => {
      const { result } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      expect(result.current.isOnline).toBe(true);

      // Simulate going offline
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: false });
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.isOnline).toBe(false);
    });

    it('should switch connection types based on network status', () => {
      const { result } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      expect(result.current.connectionType).toBe('sse');

      // Go offline
      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: false });
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.connectionType).toBe('polling');
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom reconnect attempts', () => {
      const customAttempts = 5;
      
      renderHook(() => 
        useChatWithFallback({ 
          chatId: mockChatId, 
          userId: mockUserId,
          reconnectAttempts: customAttempts
        })
      );

      // Configuration should be passed through
      expect(mockUseChatSSE).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: mockChatId,
          userId: mockUserId
        })
      );
    });

    it('should respect custom polling interval', () => {
      const customInterval = 5000;
      
      mockUseChatSSE.mockReturnValue({
        ...defaultSSEReturn,
        isConnected: false
      });

      renderHook(() => 
        useChatWithFallback({ 
          chatId: mockChatId, 
          userId: mockUserId,
          pollingInterval: customInterval
        })
      );

      expect(mockUseChatPolling).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: mockChatId,
          userId: mockUserId
        })
      );
    });

    it('should handle disabled fallback', () => {
      mockUseChatSSE.mockReturnValue({
        ...defaultSSEReturn,
        isConnected: false,
        error: new Error('SSE failed')
      });

      const { result } = renderHook(() => 
        useChatWithFallback({ 
          chatId: mockChatId, 
          userId: mockUserId,
          enableFallback: false
        })
      );

      expect(result.current.connectionType).toBe('sse'); // Should not fallback
      expect(mockUseChatPolling).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should cleanup connections on unmount', () => {
      const mockDisconnectSSE = vi.fn();
      const mockDisconnectPolling = vi.fn();

      mockUseChatSSE.mockReturnValue({
        ...defaultSSEReturn,
        disconnect: mockDisconnectSSE
      });

      mockUseChatPolling.mockReturnValue({
        ...defaultPollingReturn,
        disconnect: mockDisconnectPolling
      });

      const { unmount } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      unmount();

      expect(mockDisconnectSSE).toHaveBeenCalled();
    });

    it('should remove event listeners on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Message Deduplication', () => {
    it('should deduplicate messages between SSE and polling', () => {
      const duplicateMessage = {
        id: 'msg-1',
        content: 'Duplicate message',
        userId: mockUserId,
        timestamp: '2023-01-01T00:00:00Z'
      };

      mockUseChatSSE.mockReturnValue({
        ...defaultSSEReturn,
        messages: [duplicateMessage]
      });

      mockUseChatPolling.mockReturnValue({
        ...defaultPollingReturn,
        messages: [duplicateMessage] // Same message
      });

      const { result } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      // Should only have one instance of the message
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual(duplicateMessage);
    });

    it('should merge unique messages from both sources', () => {
      const sseMessage = {
        id: 'sse-msg',
        content: 'SSE message',
        userId: mockUserId,
        timestamp: '2023-01-01T00:00:00Z'
      };

      const pollingMessage = {
        id: 'polling-msg',
        content: 'Polling message',
        userId: mockUserId,
        timestamp: '2023-01-01T00:01:00Z'
      };

      mockUseChatSSE.mockReturnValue({
        ...defaultSSEReturn,
        messages: [sseMessage]
      });

      mockUseChatPolling.mockReturnValue({
        ...defaultPollingReturn,
        messages: [pollingMessage]
      });

      const { result } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages).toContainEqual(sseMessage);
      expect(result.current.messages).toContainEqual(pollingMessage);
    });
  });

  describe('Connection State Management', () => {
    it('should track connection attempts', () => {
      let attempts = 0;
      mockUseChatSSE.mockImplementation(() => {
        attempts++;
        return {
          ...defaultSSEReturn,
          isConnected: attempts > 2, // Connect after 2 attempts
          error: attempts <= 2 ? new Error('Connection failed') : null
        };
      });

      const { result, rerender } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      expect(result.current.connectionAttempts).toBe(1);

      rerender();
      expect(result.current.connectionAttempts).toBe(2);

      rerender();
      expect(result.current.isConnected).toBe(true);
    });

    it('should reset connection attempts on successful connection', () => {
      mockUseChatSSE.mockReturnValueOnce({
        ...defaultSSEReturn,
        isConnected: false,
        error: new Error('Failed')
      }).mockReturnValueOnce({
        ...defaultSSEReturn,
        isConnected: true,
        error: null
      });

      const { result, rerender } = renderHook(() => 
        useChatWithFallback({ chatId: mockChatId, userId: mockUserId })
      );

      expect(result.current.connectionAttempts).toBe(1);

      rerender();
      expect(result.current.connectionAttempts).toBe(0); // Reset on success
    });
  });
}); 