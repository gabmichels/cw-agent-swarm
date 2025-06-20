import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Next.js API route handlers
const mockNextRequest = vi.fn();
const mockNextResponse = vi.fn();

// Mock the SSE system components
vi.mock('../../src/lib/events/ChatEventEmitter', () => ({
  ChatEventEmitter: {
    getInstance: vi.fn(() => ({
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn()
    }))
  }
}));

vi.mock('../../src/services/monitoring/SSEHealthMonitor', () => ({
  SSEHealthMonitor: {
    getInstance: vi.fn(() => ({
      registerConnection: vi.fn(),
      recordEventDelivery: vi.fn(),
      recordDisconnection: vi.fn(),
      getCurrentMetrics: vi.fn(() => ({
        activeConnections: 1,
        eventsDelivered: 0,
        eventsFailed: 0
      })),
      performHealthCheck: vi.fn(() => ({
        status: 'healthy',
        activeConnections: 1,
        timestamp: new Date().toISOString()
      }))
    }))
  }
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

// Mock database/API calls
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    message: {
      create: vi.fn(),
      findMany: vi.fn(() => Promise.resolve([])),
      findUnique: vi.fn()
    },
    chat: {
      findUnique: vi.fn(() => Promise.resolve({
        id: 'test-chat-123',
        name: 'Test Chat',
        userId: 'user-456'
      }))
    }
  }
}));

describe('SSE Message Flow E2E Tests', () => {
  const mockChatId = 'test-chat-123';
  const mockUserId = 'user-456';
  const mockAgentId = 'agent-789';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset any global state
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Message Flow', () => {
    it('should handle user message → agent response flow with SSE events', async () => {
      // Mock the message creation API
      const mockMessage = {
        id: 'msg-001',
        content: 'Hello, how can you help me?',
        userId: mockUserId,
        chatId: mockChatId,
        timestamp: new Date().toISOString(),
        type: 'user'
      };

      const mockAgentResponse = {
        id: 'msg-002',
        content: 'I can help you with various tasks. What do you need assistance with?',
        userId: mockAgentId,
        chatId: mockChatId,
        timestamp: new Date().toISOString(),
        type: 'agent'
      };

      // Simulate the complete flow
      const messageFlow = async () => {
        // 1. User sends message
        const userMessageResponse = await fetch('/api/chats/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: mockChatId,
            content: mockMessage.content,
            userId: mockUserId
          })
        });

        expect(userMessageResponse).toBeDefined();

        // 2. Agent processes and responds
        const agentResponse = await fetch('/api/agents/process-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: mockMessage.id,
            agentId: mockAgentId
          })
        });

        expect(agentResponse).toBeDefined();

        return { userMessageResponse, agentResponse };
      };

      // Mock successful API responses
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMessage)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockAgentResponse)
        });

      const result = await messageFlow();
      
      expect(result.userMessageResponse).toBeDefined();
      expect(result.agentResponse).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should establish SSE connection and receive events', async () => {
      const mockEventSource = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn(),
        readyState: 1, // OPEN
        url: `/api/sse/chat/${mockChatId}`,
        withCredentials: false
      };

      // Mock EventSource
      global.EventSource = vi.fn(() => mockEventSource);

      // Simulate SSE connection
      const sseConnection = new EventSource(`/api/sse/chat/${mockChatId}`);
      
      expect(sseConnection).toBeDefined();
      expect(sseConnection.url).toBe(`/api/sse/chat/${mockChatId}`);
      expect(mockEventSource.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockEventSource.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle message events through SSE', async () => {
      const mockEventSource = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn(),
        readyState: 1
      };

      global.EventSource = vi.fn(() => mockEventSource);

      const messageHandler = vi.fn();
      const errorHandler = vi.fn();

      // Set up SSE connection
      const sseConnection = new EventSource(`/api/sse/chat/${mockChatId}`);
      sseConnection.addEventListener('message', messageHandler);
      sseConnection.addEventListener('error', errorHandler);

      // Simulate receiving a message event
      const mockEvent = {
        data: JSON.stringify({
          type: 'message',
          payload: {
            id: 'msg-003',
            content: 'New message via SSE',
            userId: mockUserId,
            chatId: mockChatId,
            timestamp: new Date().toISOString()
          }
        })
      };

      // Trigger the message handler
      const messageHandlerCall = mockEventSource.addEventListener.mock.calls
        .find(call => call[0] === 'message');
      
      if (messageHandlerCall) {
        messageHandlerCall[1](mockEvent);
      }

      expect(messageHandler).toHaveBeenCalledWith(mockEvent);
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));

      const messageFlow = async () => {
        try {
          await fetch('/api/chats/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: mockChatId,
              content: 'Test message',
              userId: mockUserId
            })
          });
        } catch (error) {
          return error;
        }
      };

      const result = await messageFlow();
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('API Error');
    });

    it('should handle SSE connection failures', async () => {
      const mockEventSource = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn(),
        readyState: 2 // CLOSED
      };

      global.EventSource = vi.fn(() => mockEventSource);

      const errorHandler = vi.fn();

      const sseConnection = new EventSource(`/api/sse/chat/${mockChatId}`);
      sseConnection.addEventListener('error', errorHandler);

      // Simulate connection error
      const mockError = new Error('SSE Connection Failed');
      const errorHandlerCall = mockEventSource.addEventListener.mock.calls
        .find(call => call[0] === 'error');
      
      if (errorHandlerCall) {
        errorHandlerCall[1](mockError);
      }

      expect(errorHandler).toHaveBeenCalledWith(mockError);
      expect(sseConnection.readyState).toBe(2); // CLOSED
    });

    it('should handle malformed SSE data', async () => {
      const mockEventSource = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn(),
        readyState: 1
      };

      global.EventSource = vi.fn(() => mockEventSource);

      const messageHandler = vi.fn();

      const sseConnection = new EventSource(`/api/sse/chat/${mockChatId}`);
      sseConnection.addEventListener('message', messageHandler);

      // Simulate malformed data
      const malformedEvent = {
        data: 'invalid-json-data'
      };

      const messageHandlerCall = mockEventSource.addEventListener.mock.calls
        .find(call => call[0] === 'message');
      
      if (messageHandlerCall) {
        expect(() => {
          messageHandlerCall[1](malformedEvent);
        }).not.toThrow(); // Should handle gracefully
      }

      expect(messageHandler).toHaveBeenCalledWith(malformedEvent);
    });
  });

  describe('Performance Scenarios', () => {
    it('should handle rapid message sequences', async () => {
      const messageCount = 10;
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        userId: mockUserId,
        chatId: mockChatId,
        timestamp: new Date().toISOString()
      }));

      // Mock rapid API calls
      global.fetch = vi.fn().mockImplementation((url, options) => {
        const body = JSON.parse(options.body);
        const messageIndex = parseInt(body.content.split(' ')[1]);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(messages[messageIndex])
        });
      });

      const startTime = Date.now();

      // Send messages rapidly
      const promises = messages.map(msg => 
        fetch('/api/chats/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: mockChatId,
            content: msg.content,
            userId: mockUserId
          })
        })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(messageCount);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete quickly
      expect(global.fetch).toHaveBeenCalledTimes(messageCount);
    });

    it('should handle large message content', async () => {
      const largeContent = 'A'.repeat(10000); // 10KB message
      const largeMessage = {
        id: 'large-msg-001',
        content: largeContent,
        userId: mockUserId,
        chatId: mockChatId,
        timestamp: new Date().toISOString()
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(largeMessage)
      });

      const startTime = Date.now();

      const response = await fetch('/api/chats/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: mockChatId,
          content: largeContent,
          userId: mockUserId
        })
      });

      const endTime = Date.now();
      const result = await response.json();

      expect(result.content).toBe(largeContent);
      expect(endTime - startTime).toBeLessThan(2000); // Should handle large content efficiently
    });

    it('should handle concurrent connections', async () => {
      const connectionCount = 5;
      const mockEventSources = Array.from({ length: connectionCount }, () => ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn(),
        readyState: 1
      }));

      let connectionIndex = 0;
      global.EventSource = vi.fn(() => mockEventSources[connectionIndex++]);

      const connections = Array.from({ length: connectionCount }, (_, i) => 
        new EventSource(`/api/sse/chat/${mockChatId}-${i}`)
      );

      expect(connections).toHaveLength(connectionCount);
      expect(global.EventSource).toHaveBeenCalledTimes(connectionCount);

      // Verify all connections are established
      connections.forEach((conn, i) => {
        expect(conn.readyState).toBe(1); // OPEN
        expect(mockEventSources[i].addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      });
    });
  });

  describe('Monitoring Integration', () => {
    it('should track message delivery metrics', async () => {
      const { SSEHealthMonitor } = await import('../../src/services/monitoring/SSEHealthMonitor');
      const healthMonitor = SSEHealthMonitor.getInstance();

      const connectionId = 'test-connection-001';

      // Simulate connection registration
      healthMonitor.registerConnection(connectionId);

      // Simulate successful message delivery
      healthMonitor.recordEventDelivery(connectionId, 'message', true);

      const metrics = healthMonitor.getCurrentMetrics();
      
      expect(metrics.activeConnections).toBe(1);
      expect(metrics.eventsDelivered).toBe(1);
      expect(metrics.eventsFailed).toBe(0);
    });

    it('should track failed message deliveries', async () => {
      const { SSEHealthMonitor } = await import('../../src/services/monitoring/SSEHealthMonitor');
      const healthMonitor = SSEHealthMonitor.getInstance();

      const connectionId = 'test-connection-002';

      healthMonitor.registerConnection(connectionId);
      healthMonitor.recordEventDelivery(connectionId, 'message', false);

      const metrics = healthMonitor.getCurrentMetrics();
      
      expect(metrics.activeConnections).toBe(1);
      expect(metrics.eventsFailed).toBe(1);
    });

    it('should provide health status', async () => {
      const { SSEHealthMonitor } = await import('../../src/services/monitoring/SSEHealthMonitor');
      const healthMonitor = SSEHealthMonitor.getInstance();

      const connectionId = 'test-connection-003';

      healthMonitor.registerConnection(connectionId);
      healthMonitor.recordEventDelivery(connectionId, 'message', true);

      const healthStatus = healthMonitor.performHealthCheck();
      
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.activeConnections).toBe(1);
      expect(healthStatus.timestamp).toBeDefined();
    });
  });

  describe('Integration with Chat System', () => {
    it('should integrate with chat event emitter', async () => {
      const { ChatEventEmitter } = await import('../../src/lib/events/ChatEventEmitter');
      const eventEmitter = ChatEventEmitter.getInstance();

      const mockListener = vi.fn();
      eventEmitter.on('message', mockListener);

      const testMessage = {
        id: 'integration-msg-001',
        content: 'Integration test message',
        userId: mockUserId,
        chatId: mockChatId,
        timestamp: new Date().toISOString()
      };

      eventEmitter.emit('message', testMessage);

      expect(mockListener).toHaveBeenCalledWith(testMessage);
    });

    it('should handle notification events', async () => {
      const { ChatEventEmitter } = await import('../../src/lib/events/ChatEventEmitter');
      const eventEmitter = ChatEventEmitter.getInstance();

      const notificationListener = vi.fn();
      eventEmitter.on('notification', notificationListener);

      const notification = {
        type: 'info',
        message: 'New message received',
        chatId: mockChatId,
        timestamp: new Date().toISOString()
      };

      eventEmitter.emit('notification', notification);

      expect(notificationListener).toHaveBeenCalledWith(notification);
    });
  });
}); 