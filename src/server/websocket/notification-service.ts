import { getWebSocketServer } from './index';
import { ServerEvent, AgentEventPayload, ChatEventPayload, CollectionEventPayload, SystemNotificationPayload } from './types';
import { AgentMemoryEntity } from '../memory/schema/agent';
import { ChatMemoryEntity } from '../memory/schema/chat';

/**
 * A service for sending WebSocket notifications for multi-agent system events
 */
export class WebSocketNotificationService {
  /**
   * Notify when an agent is created
   */
  static notifyAgentCreated(agent: AgentMemoryEntity, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: AgentEventPayload = {
      agentId: agent.id.toString(),
      agent,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitAgentEvent(ServerEvent.AGENT_CREATED, payload);
  }
  
  /**
   * Notify when an agent is updated
   */
  static notifyAgentUpdated(agent: AgentMemoryEntity, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: AgentEventPayload = {
      agentId: agent.id.toString(),
      agent,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitAgentEvent(ServerEvent.AGENT_UPDATED, payload);
  }
  
  /**
   * Notify when an agent is deleted
   */
  static notifyAgentDeleted(agentId: string, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: AgentEventPayload = {
      agentId,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitAgentEvent(ServerEvent.AGENT_DELETED, payload);
  }
  
  /**
   * Notify when an agent's status changes
   */
  static notifyAgentStatusChanged(agent: AgentMemoryEntity, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: AgentEventPayload = {
      agentId: agent.id.toString(),
      agent,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitAgentEvent(ServerEvent.AGENT_STATUS_CHANGED, payload);
  }
  
  /**
   * Notify when a chat is created
   */
  static notifyChatCreated(chat: ChatMemoryEntity, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: ChatEventPayload = {
      chatId: chat.id.toString(),
      chat,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitChatEvent(ServerEvent.CHAT_CREATED, payload);
  }
  
  /**
   * Notify when a chat is updated
   */
  static notifyChatUpdated(chat: ChatMemoryEntity, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: ChatEventPayload = {
      chatId: chat.id.toString(),
      chat,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitChatEvent(ServerEvent.CHAT_UPDATED, payload);
  }
  
  /**
   * Notify when a chat is deleted
   */
  static notifyChatDeleted(chatId: string, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: ChatEventPayload = {
      chatId,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitChatEvent(ServerEvent.CHAT_DELETED, payload);
  }
  
  /**
   * Notify when a message is created in a chat
   */
  static notifyMessageCreated(chatId: string, messageId: string, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: ChatEventPayload = {
      chatId,
      messageId,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitChatEvent(ServerEvent.MESSAGE_CREATED, payload);
  }
  
  /**
   * Notify when a participant joins a chat
   */
  static notifyParticipantJoined(chatId: string, participantId: string, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: ChatEventPayload = {
      chatId,
      participantId,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitChatEvent(ServerEvent.PARTICIPANT_JOINED, payload);
  }
  
  /**
   * Notify when a participant leaves a chat
   */
  static notifyParticipantLeft(chatId: string, participantId: string, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: ChatEventPayload = {
      chatId,
      participantId,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitChatEvent(ServerEvent.PARTICIPANT_LEFT, payload);
  }
  
  /**
   * Notify when a collection is created
   */
  static notifyCollectionCreated(collectionId: string, metadata?: Record<string, unknown>, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: CollectionEventPayload = {
      collectionId,
      metadata,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitCollectionEvent(ServerEvent.COLLECTION_CREATED, payload);
  }
  
  /**
   * Notify when a collection is updated
   */
  static notifyCollectionUpdated(collectionId: string, metadata?: Record<string, unknown>, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: CollectionEventPayload = {
      collectionId,
      metadata,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitCollectionEvent(ServerEvent.COLLECTION_UPDATED, payload);
  }
  
  /**
   * Notify when a collection is deleted
   */
  static notifyCollectionDeleted(collectionId: string, userId?: string): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: CollectionEventPayload = {
      collectionId,
      userId,
      timestamp: Date.now()
    };
    
    webSocketServer.emitCollectionEvent(ServerEvent.COLLECTION_DELETED, payload);
  }
  
  /**
   * Send a system notification
   */
  static sendSystemNotification(type: 'info' | 'warning' | 'error' | 'success', message: string, details?: Record<string, unknown>): void {
    const webSocketServer = getWebSocketServer();
    
    const payload: SystemNotificationPayload = {
      type,
      message,
      details,
      timestamp: Date.now()
    };
    
    webSocketServer.emitSystemNotification(payload);
  }
} 