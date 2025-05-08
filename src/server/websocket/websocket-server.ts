import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import {
  WebSocketServer,
  ServerEvent,
  ClientEvent,
  AgentEventPayload,
  ChatEventPayload,
  CollectionEventPayload,
  SystemNotificationPayload
} from './types';
import { DefaultClientSubscriptionManager } from './client-subscription-manager';
import { DefaultEventHandlerRegistry } from './event-handler-registry';

/**
 * Implementation of the WebSocketServer interface for handling real-time updates
 */
export class SocketIOWebSocketServer implements WebSocketServer {
  private io: SocketIOServer | null = null;
  private subscriptionManager = new DefaultClientSubscriptionManager();
  private eventHandlerRegistry = new DefaultEventHandlerRegistry();
  
  /**
   * Initialize the WebSocket server with an HTTP server
   */
  initialize(httpServer: HTTPServer): void {
    // If already initialized, return
    if (this.io) {
      console.log('WebSocket server already initialized');
      return;
    }
    
    // Create Socket.IO server
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
      },
      path: '/api/ws'
    });
    
    console.log('WebSocket server initialized');
    
    // Set up connection handler
    this.io.on('connection', (socket: Socket) => this.handleConnection(socket));
  }
  
  /**
   * Handle a new WebSocket connection
   */
  private handleConnection(socket: Socket): void {
    console.log(`New client connected: ${socket.id}`);
    
    // Register default event handlers
    this.eventHandlerRegistry.registerDefaultHandlers(socket);
    
    // Set up event listeners for subscription events
    this.setupSubscriptionListeners(socket);
    
    // Set up event listeners for acknowledgement events
    this.setupAcknowledgementListeners(socket);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      this.handleDisconnect(socket);
    });
    
    // Handle client ready event
    socket.on(ClientEvent.CLIENT_READY, () => {
      const handler = this.eventHandlerRegistry.getHandler(ClientEvent.CLIENT_READY);
      if (handler) {
        handler(undefined, socket);
      }
    });
  }
  
  /**
   * Set up event listeners for subscription events
   */
  private setupSubscriptionListeners(socket: Socket): void {
    // Agent subscriptions
    socket.on(ClientEvent.SUBSCRIBE_AGENT, (agentId: string) => {
      console.log(`Client ${socket.id} subscribing to agent ${agentId}`);
      this.subscriptionManager.subscribeToAgent(socket.id, agentId);
      // Join room for the agent
      socket.join(`agent:${agentId}`);
    });
    
    socket.on(ClientEvent.UNSUBSCRIBE_AGENT, (agentId: string) => {
      console.log(`Client ${socket.id} unsubscribing from agent ${agentId}`);
      this.subscriptionManager.unsubscribeFromAgent(socket.id, agentId);
      // Leave room for the agent
      socket.leave(`agent:${agentId}`);
    });
    
    // Chat subscriptions
    socket.on(ClientEvent.SUBSCRIBE_CHAT, (chatId: string) => {
      console.log(`Client ${socket.id} subscribing to chat ${chatId}`);
      this.subscriptionManager.subscribeToChat(socket.id, chatId);
      // Join room for the chat
      socket.join(`chat:${chatId}`);
    });
    
    socket.on(ClientEvent.UNSUBSCRIBE_CHAT, (chatId: string) => {
      console.log(`Client ${socket.id} unsubscribing from chat ${chatId}`);
      this.subscriptionManager.unsubscribeFromChat(socket.id, chatId);
      // Leave room for the chat
      socket.leave(`chat:${chatId}`);
    });
    
    // Collection subscriptions
    socket.on(ClientEvent.SUBSCRIBE_COLLECTION, (collectionId: string) => {
      console.log(`Client ${socket.id} subscribing to collection ${collectionId}`);
      this.subscriptionManager.subscribeToCollection(socket.id, collectionId);
      // Join room for the collection
      socket.join(`collection:${collectionId}`);
    });
    
    socket.on(ClientEvent.UNSUBSCRIBE_COLLECTION, (collectionId: string) => {
      console.log(`Client ${socket.id} unsubscribing from collection ${collectionId}`);
      this.subscriptionManager.unsubscribeFromCollection(socket.id, collectionId);
      // Leave room for the collection
      socket.leave(`collection:${collectionId}`);
    });
  }
  
  /**
   * Set up event listeners for acknowledgement events
   */
  private setupAcknowledgementListeners(socket: Socket): void {
    socket.on(ClientEvent.MESSAGE_RECEIVED, (payload: { messageId: string }) => {
      const handler = this.eventHandlerRegistry.getHandler<{ messageId: string }>(
        ClientEvent.MESSAGE_RECEIVED
      );
      if (handler) {
        handler(payload, socket);
      }
    });
    
    socket.on(ClientEvent.MESSAGE_READ, (payload: { messageId: string }) => {
      const handler = this.eventHandlerRegistry.getHandler<{ messageId: string }>(
        ClientEvent.MESSAGE_READ
      );
      if (handler) {
        handler(payload, socket);
      }
    });
  }
  
  /**
   * Handle a client disconnection
   */
  private handleDisconnect(socket: Socket): void {
    // Clean up subscriptions
    this.subscriptionManager.removeAllSubscriptions(socket.id);
    
    // Trigger disconnect handler
    const handler = this.eventHandlerRegistry.getHandler(ClientEvent.CLIENT_DISCONNECT);
    if (handler) {
      handler(undefined, socket);
    }
  }
  
  /**
   * Emit an event to all connected clients or to specific rooms
   */
  emit<T>(event: ServerEvent, payload: T, rooms?: string[]): void {
    if (!this.io) {
      console.warn('WebSocket server not initialized');
      return;
    }
    
    if (rooms && rooms.length > 0) {
      // Emit to specific rooms
      for (const room of rooms) {
        this.io.to(room).emit(event, payload);
      }
    } else {
      // Emit to all connected clients
      this.io.emit(event, payload);
    }
  }
  
  /**
   * Emit an agent-related event
   */
  emitAgentEvent(event: ServerEvent, payload: AgentEventPayload): void {
    // Get subscribers for this agent
    const room = `agent:${payload.agentId}`;
    
    // Emit event to the agent room
    this.emit(event, payload, [room]);
  }
  
  /**
   * Emit a chat-related event
   */
  emitChatEvent(event: ServerEvent, payload: ChatEventPayload): void {
    // Get subscribers for this chat
    const room = `chat:${payload.chatId}`;
    
    // Emit event to the chat room
    this.emit(event, payload, [room]);
  }
  
  /**
   * Emit a collection-related event
   */
  emitCollectionEvent(event: ServerEvent, payload: CollectionEventPayload): void {
    // Get subscribers for this collection
    const room = `collection:${payload.collectionId}`;
    
    // Emit event to the collection room
    this.emit(event, payload, [room]);
  }
  
  /**
   * Emit a system notification
   */
  emitSystemNotification(payload: SystemNotificationPayload): void {
    // Emit to all connected clients
    this.emit(ServerEvent.SYSTEM_NOTIFICATION, payload);
  }
  
  /**
   * Get the Socket.IO server instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
} 