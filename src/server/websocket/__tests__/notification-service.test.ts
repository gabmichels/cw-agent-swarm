import { describe, test, expect, vi, beforeEach } from 'vitest';
import { WebSocketNotificationService } from '../notification-service';
import { getWebSocketServer } from '../index';
import { ServerEvent } from '../types';
import { AgentMemoryEntity } from '../../memory/schema/agent';
import { ChatMemoryEntity } from '../../memory/schema/chat';

// Mock the WebSocket server
vi.mock('../index', () => ({
  getWebSocketServer: vi.fn().mockReturnValue({
    emitAgentEvent: vi.fn(),
    emitChatEvent: vi.fn(),
    emitCollectionEvent: vi.fn(),
    emitSystemNotification: vi.fn()
  })
}));

describe('WebSocketNotificationService', () => {
  let mockWebSocketServer: any;
  const mockDate = 1619098800000; // Fixed timestamp for testing
  
  beforeEach(() => {
    mockWebSocketServer = getWebSocketServer();
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock Date.now() to return a fixed timestamp
    vi.spyOn(Date, 'now').mockReturnValue(mockDate);
  });
  
  describe('Agent Notifications', () => {
    const mockAgent = {
      id: 'agent-1',
      name: 'Test Agent',
      description: 'Test Description'
    } as unknown as AgentMemoryEntity;
    
    const mockUserId = 'user-1';
    
    test('should emit agent created notification', () => {
      WebSocketNotificationService.notifyAgentCreated(mockAgent, mockUserId);
      
      expect(mockWebSocketServer.emitAgentEvent).toHaveBeenCalledWith(
        ServerEvent.AGENT_CREATED,
        {
          agentId: 'agent-1',
          agent: mockAgent,
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
    
    test('should emit agent updated notification', () => {
      WebSocketNotificationService.notifyAgentUpdated(mockAgent, mockUserId);
      
      expect(mockWebSocketServer.emitAgentEvent).toHaveBeenCalledWith(
        ServerEvent.AGENT_UPDATED,
        {
          agentId: 'agent-1',
          agent: mockAgent,
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
    
    test('should emit agent deleted notification', () => {
      WebSocketNotificationService.notifyAgentDeleted('agent-1', mockUserId);
      
      expect(mockWebSocketServer.emitAgentEvent).toHaveBeenCalledWith(
        ServerEvent.AGENT_DELETED,
        {
          agentId: 'agent-1',
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
    
    test('should emit agent status changed notification', () => {
      WebSocketNotificationService.notifyAgentStatusChanged(mockAgent, mockUserId);
      
      expect(mockWebSocketServer.emitAgentEvent).toHaveBeenCalledWith(
        ServerEvent.AGENT_STATUS_CHANGED,
        {
          agentId: 'agent-1',
          agent: mockAgent,
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
  });
  
  describe('Chat Notifications', () => {
    const mockChat = {
      id: 'chat-1',
      title: 'Test Chat'
    } as unknown as ChatMemoryEntity;
    
    const mockUserId = 'user-1';
    
    test('should emit chat created notification', () => {
      WebSocketNotificationService.notifyChatCreated(mockChat, mockUserId);
      
      expect(mockWebSocketServer.emitChatEvent).toHaveBeenCalledWith(
        ServerEvent.CHAT_CREATED,
        {
          chatId: 'chat-1',
          chat: mockChat,
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
    
    test('should emit chat updated notification', () => {
      WebSocketNotificationService.notifyChatUpdated(mockChat, mockUserId);
      
      expect(mockWebSocketServer.emitChatEvent).toHaveBeenCalledWith(
        ServerEvent.CHAT_UPDATED,
        {
          chatId: 'chat-1',
          chat: mockChat,
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
    
    test('should emit chat deleted notification', () => {
      WebSocketNotificationService.notifyChatDeleted('chat-1', mockUserId);
      
      expect(mockWebSocketServer.emitChatEvent).toHaveBeenCalledWith(
        ServerEvent.CHAT_DELETED,
        {
          chatId: 'chat-1',
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
    
    test('should emit message created notification', () => {
      WebSocketNotificationService.notifyMessageCreated('chat-1', 'message-1', mockUserId);
      
      expect(mockWebSocketServer.emitChatEvent).toHaveBeenCalledWith(
        ServerEvent.MESSAGE_CREATED,
        {
          chatId: 'chat-1',
          messageId: 'message-1',
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
    
    test('should emit participant joined notification', () => {
      WebSocketNotificationService.notifyParticipantJoined('chat-1', 'participant-1', mockUserId);
      
      expect(mockWebSocketServer.emitChatEvent).toHaveBeenCalledWith(
        ServerEvent.PARTICIPANT_JOINED,
        {
          chatId: 'chat-1',
          participantId: 'participant-1',
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
    
    test('should emit participant left notification', () => {
      WebSocketNotificationService.notifyParticipantLeft('chat-1', 'participant-1', mockUserId);
      
      expect(mockWebSocketServer.emitChatEvent).toHaveBeenCalledWith(
        ServerEvent.PARTICIPANT_LEFT,
        {
          chatId: 'chat-1',
          participantId: 'participant-1',
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
  });
  
  describe('Collection Notifications', () => {
    const mockCollectionId = 'collection-1';
    const mockMetadata = { name: 'Test Collection' };
    const mockUserId = 'user-1';
    
    test('should emit collection created notification', () => {
      WebSocketNotificationService.notifyCollectionCreated(mockCollectionId, mockMetadata, mockUserId);
      
      expect(mockWebSocketServer.emitCollectionEvent).toHaveBeenCalledWith(
        ServerEvent.COLLECTION_CREATED,
        {
          collectionId: mockCollectionId,
          metadata: mockMetadata,
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
    
    test('should emit collection updated notification', () => {
      WebSocketNotificationService.notifyCollectionUpdated(mockCollectionId, mockMetadata, mockUserId);
      
      expect(mockWebSocketServer.emitCollectionEvent).toHaveBeenCalledWith(
        ServerEvent.COLLECTION_UPDATED,
        {
          collectionId: mockCollectionId,
          metadata: mockMetadata,
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
    
    test('should emit collection deleted notification', () => {
      WebSocketNotificationService.notifyCollectionDeleted(mockCollectionId, mockUserId);
      
      expect(mockWebSocketServer.emitCollectionEvent).toHaveBeenCalledWith(
        ServerEvent.COLLECTION_DELETED,
        {
          collectionId: mockCollectionId,
          userId: mockUserId,
          timestamp: mockDate
        }
      );
    });
  });
  
  describe('System Notifications', () => {
    test('should emit system notification', () => {
      const message = 'Test notification';
      const details = { key: 'value' };
      
      WebSocketNotificationService.sendSystemNotification('info', message, details);
      
      expect(mockWebSocketServer.emitSystemNotification).toHaveBeenCalledWith(
        {
          type: 'info',
          message,
          details,
          timestamp: mockDate
        }
      );
    });
    
    test('should emit system notification without details', () => {
      const message = 'Test notification';
      
      WebSocketNotificationService.sendSystemNotification('warning', message);
      
      expect(mockWebSocketServer.emitSystemNotification).toHaveBeenCalledWith(
        {
          type: 'warning',
          message,
          timestamp: mockDate
        }
      );
    });
  });
}); 