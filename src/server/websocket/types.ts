import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { AgentMemoryEntity } from '../memory/schema/agent';
import { ChatMemoryEntity } from '../memory/schema/chat';

/**
 * Defines the events that can be emitted by the server
 */
export enum ServerEvent {
  // Agent events
  AGENT_CREATED = 'agent:created',
  AGENT_UPDATED = 'agent:updated',
  AGENT_DELETED = 'agent:deleted',
  AGENT_STATUS_CHANGED = 'agent:statusChanged',
  
  // Chat events
  CHAT_CREATED = 'chat:created',
  CHAT_UPDATED = 'chat:updated',
  CHAT_DELETED = 'chat:deleted',
  MESSAGE_CREATED = 'chat:messageCreated',
  PARTICIPANT_JOINED = 'chat:participantJoined',
  PARTICIPANT_LEFT = 'chat:participantLeft',
  
  // Collection events
  COLLECTION_CREATED = 'collection:created',
  COLLECTION_UPDATED = 'collection:updated',
  COLLECTION_DELETED = 'collection:deleted',
  
  // System events
  SYSTEM_NOTIFICATION = 'system:notification',
  ERROR = 'error'
}

/**
 * Defines the events that the server can listen to from clients
 */
export enum ClientEvent {
  // Subscription events
  SUBSCRIBE_AGENT = 'subscribe:agent',
  UNSUBSCRIBE_AGENT = 'unsubscribe:agent',
  SUBSCRIBE_CHAT = 'subscribe:chat',
  UNSUBSCRIBE_CHAT = 'unsubscribe:chat',
  SUBSCRIBE_COLLECTION = 'subscribe:collection',
  UNSUBSCRIBE_COLLECTION = 'unsubscribe:collection',
  
  // Presence events
  CLIENT_READY = 'client:ready',
  CLIENT_DISCONNECT = 'client:disconnect',
  
  // Acknowledgement events
  MESSAGE_RECEIVED = 'message:received',
  MESSAGE_READ = 'message:read'
}

/**
 * Payload for agent-related events
 */
export interface AgentEventPayload {
  agentId: string;
  agent?: AgentMemoryEntity;
  userId?: string;
  timestamp: number;
}

/**
 * Payload for chat-related events
 */
export interface ChatEventPayload {
  chatId: string;
  chat?: ChatMemoryEntity;
  messageId?: string;
  participantId?: string;
  userId?: string;
  timestamp: number;
}

/**
 * Payload for collection-related events
 */
export interface CollectionEventPayload {
  collectionId: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  timestamp: number;
}

/**
 * Payload for system notification events
 */
export interface SystemNotificationPayload {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Interface for the WebSocket server
 */
export interface WebSocketServer {
  /**
   * Initialize the WebSocket server with an HTTP server
   */
  initialize(httpServer: HTTPServer): void;
  
  /**
   * Emit an event to all connected clients or to specific rooms
   */
  emit<T>(event: ServerEvent, payload: T, rooms?: string[]): void;
  
  /**
   * Emit an agent-related event
   */
  emitAgentEvent(event: ServerEvent, payload: AgentEventPayload): void;
  
  /**
   * Emit a chat-related event
   */
  emitChatEvent(event: ServerEvent, payload: ChatEventPayload): void;
  
  /**
   * Emit a collection-related event
   */
  emitCollectionEvent(event: ServerEvent, payload: CollectionEventPayload): void;
  
  /**
   * Emit a system notification
   */
  emitSystemNotification(payload: SystemNotificationPayload): void;
  
  /**
   * Get the Socket.IO server instance
   */
  getIO(): SocketIOServer | null;
}

/**
 * Interface for tracking client subscriptions
 */
export interface ClientSubscriptionManager {
  /**
   * Add a client subscription to an agent
   */
  subscribeToAgent(socketId: string, agentId: string): void;
  
  /**
   * Remove a client subscription from an agent
   */
  unsubscribeFromAgent(socketId: string, agentId: string): void;
  
  /**
   * Add a client subscription to a chat
   */
  subscribeToChat(socketId: string, chatId: string): void;
  
  /**
   * Remove a client subscription from a chat
   */
  unsubscribeFromChat(socketId: string, chatId: string): void;
  
  /**
   * Add a client subscription to a collection
   */
  subscribeToCollection(socketId: string, collectionId: string): void;
  
  /**
   * Remove a client subscription from a collection
   */
  unsubscribeFromCollection(socketId: string, collectionId: string): void;
  
  /**
   * Get all clients subscribed to an agent
   */
  getAgentSubscribers(agentId: string): string[];
  
  /**
   * Get all clients subscribed to a chat
   */
  getChatSubscribers(chatId: string): string[];
  
  /**
   * Get all clients subscribed to a collection
   */
  getCollectionSubscribers(collectionId: string): string[];
  
  /**
   * Remove all subscriptions for a client (on disconnect)
   */
  removeAllSubscriptions(socketId: string): void;
}

/**
 * Type for event handlers
 */
export type EventHandler<T> = (payload: T, socket: Socket) => void | Promise<void>;

/**
 * Interface for the event handler registry
 */
export interface EventHandlerRegistry {
  /**
   * Register a handler for a client event
   */
  registerHandler<T>(event: ClientEvent, handler: EventHandler<T>): void;
  
  /**
   * Get the handler for a client event
   */
  getHandler<T>(event: ClientEvent): EventHandler<T> | null;
  
  /**
   * Remove a handler for a client event
   */
  removeHandler(event: ClientEvent): void;
} 