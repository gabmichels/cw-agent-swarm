import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SocketIOWebSocketServer } from '../websocket-server';
import { ServerEvent, AgentEventPayload, ChatEventPayload, CollectionEventPayload, SystemNotificationPayload } from '../types';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Mock the Socket.IO server
vi.mock('socket.io', () => {
  const mockOn = vi.fn();
  const mockTo = vi.fn().mockReturnThis();
  const mockEmit = vi.fn();
  
  return {
    Server: vi.fn().mockImplementation(() => ({
      on: mockOn,
      to: mockTo,
      emit: mockEmit,
    })),
  };
});

describe('SocketIOWebSocketServer', () => {
  let webSocketServer: SocketIOWebSocketServer;
  let mockHttpServer: HTTPServer;
  
  beforeEach(() => {
    webSocketServer = new SocketIOWebSocketServer();
    mockHttpServer = {} as HTTPServer;
    
    // Reset the mock implementations
    vi.clearAllMocks();
  });
  
  describe('Initialization', () => {
    test('should initialize with an HTTP server', () => {
      webSocketServer.initialize(mockHttpServer);
      
      expect(SocketIOServer).toHaveBeenCalledWith(mockHttpServer, expect.any(Object));
      expect(webSocketServer.getIO()).not.toBeNull();
    });
    
    test('should not reinitialize if already initialized', () => {
      // Spy on console.log
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      webSocketServer.initialize(mockHttpServer);
      webSocketServer.initialize(mockHttpServer);
      
      expect(SocketIOServer).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket server already initialized');
      
      // Restore the spy
      consoleSpy.mockRestore();
    });
  });
  
  describe('Event Emission', () => {
    beforeEach(() => {
      webSocketServer.initialize(mockHttpServer);
    });
    
    test('should emit events to all clients when no rooms specified', () => {
      const payload = { test: 'data' };
      webSocketServer.emit(ServerEvent.SYSTEM_NOTIFICATION, payload);
      
      const io = webSocketServer.getIO() as any;
      expect(io.emit).toHaveBeenCalledWith(ServerEvent.SYSTEM_NOTIFICATION, payload);
    });
    
    test('should emit events to specific rooms when rooms specified', () => {
      const payload = { test: 'data' };
      const rooms = ['room1', 'room2'];
      webSocketServer.emit(ServerEvent.SYSTEM_NOTIFICATION, payload, rooms);
      
      const io = webSocketServer.getIO() as any;
      expect(io.to).toHaveBeenCalledWith('room1');
      expect(io.to).toHaveBeenCalledWith('room2');
      expect(io.emit).toHaveBeenCalledWith(ServerEvent.SYSTEM_NOTIFICATION, payload);
    });
    
    test('should log warning when emitting event without initialization', () => {
      // Create a new server that's not initialized
      const uninitializedServer = new SocketIOWebSocketServer();
      
      // Spy on console.warn
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      uninitializedServer.emit(ServerEvent.SYSTEM_NOTIFICATION, { test: 'data' });
      
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket server not initialized');
      
      // Restore the spy
      consoleSpy.mockRestore();
    });
  });
  
  describe('Specialized Event Emission', () => {
    beforeEach(() => {
      webSocketServer.initialize(mockHttpServer);
    });
    
    test('should emit agent events to the agent room', () => {
      const payload: AgentEventPayload = {
        agentId: 'agent-1',
        timestamp: Date.now()
      };
      
      webSocketServer.emitAgentEvent(ServerEvent.AGENT_CREATED, payload);
      
      const io = webSocketServer.getIO() as any;
      expect(io.to).toHaveBeenCalledWith('agent:agent-1');
      expect(io.emit).toHaveBeenCalledWith(ServerEvent.AGENT_CREATED, payload);
    });
    
    test('should emit chat events to the chat room', () => {
      const payload: ChatEventPayload = {
        chatId: 'chat-1',
        timestamp: Date.now()
      };
      
      webSocketServer.emitChatEvent(ServerEvent.CHAT_CREATED, payload);
      
      const io = webSocketServer.getIO() as any;
      expect(io.to).toHaveBeenCalledWith('chat:chat-1');
      expect(io.emit).toHaveBeenCalledWith(ServerEvent.CHAT_CREATED, payload);
    });
    
    test('should emit collection events to the collection room', () => {
      const payload: CollectionEventPayload = {
        collectionId: 'collection-1',
        timestamp: Date.now()
      };
      
      webSocketServer.emitCollectionEvent(ServerEvent.COLLECTION_CREATED, payload);
      
      const io = webSocketServer.getIO() as any;
      expect(io.to).toHaveBeenCalledWith('collection:collection-1');
      expect(io.emit).toHaveBeenCalledWith(ServerEvent.COLLECTION_CREATED, payload);
    });
    
    test('should emit system notifications to all clients', () => {
      const payload: SystemNotificationPayload = {
        type: 'info',
        message: 'Test notification',
        timestamp: Date.now()
      };
      
      webSocketServer.emitSystemNotification(payload);
      
      const io = webSocketServer.getIO() as any;
      expect(io.emit).toHaveBeenCalledWith(ServerEvent.SYSTEM_NOTIFICATION, payload);
    });
  });
}); 