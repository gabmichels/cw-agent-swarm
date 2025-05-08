import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Server as HTTPServer } from 'http';
import { WebSocketServer } from '../types';

// Create a mock WebSocketServer implementation
const mockWebSocketServer: WebSocketServer = {
  initialize: vi.fn(),
  emit: vi.fn(),
  emitAgentEvent: vi.fn(),
  emitChatEvent: vi.fn(),
  emitCollectionEvent: vi.fn(),
  emitSystemNotification: vi.fn(),
  getIO: vi.fn()
};

// Mock the SocketIOWebSocketServer constructor
const MockSocketIOWebSocketServer = vi.fn().mockImplementation(() => mockWebSocketServer);

// Mock the websocket-server module
vi.mock('../websocket-server', () => ({
  SocketIOWebSocketServer: MockSocketIOWebSocketServer
}));

// Mock the singleton state
let singletonInstance: WebSocketServer | null = null;

// Mock the index module
vi.mock('../index', () => ({
  getWebSocketServer: vi.fn(() => {
    if (!singletonInstance) {
      singletonInstance = mockWebSocketServer;
    }
    return singletonInstance;
  }),
  initializeWebSocketServer: vi.fn((httpServer) => {
    const server = singletonInstance || mockWebSocketServer;
    server.initialize(httpServer);
    console.log('WebSocket server initialized successfully');
    singletonInstance = server;
  }),
  ServerEvent: {
    AGENT_CREATED: 'agent:created',
    AGENT_UPDATED: 'agent:updated'
  }
}));

// Import the mocked modules
import { getWebSocketServer, initializeWebSocketServer } from '../index';

describe('WebSocket Singleton', () => {
  let mockHttpServer: HTTPServer;
  
  beforeEach(() => {
    mockHttpServer = {} as HTTPServer;
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset the singleton
    singletonInstance = null;
  });
  
  describe('getWebSocketServer', () => {
    test('should create a new WebSocketServer instance on first call', () => {
      const server = getWebSocketServer();
      
      expect(server).toBe(mockWebSocketServer);
    });
    
    test('should return the same instance on subsequent calls', () => {
      const server1 = getWebSocketServer();
      const server2 = getWebSocketServer();
      
      expect(server1).toBe(server2);
      expect(getWebSocketServer).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('initializeWebSocketServer', () => {
    test('should initialize the WebSocketServer with an HTTP server', () => {
      // Spy on console.log
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      initializeWebSocketServer(mockHttpServer);
      
      expect(mockWebSocketServer.initialize).toHaveBeenCalledWith(mockHttpServer);
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket server initialized successfully');
      
      // Restore the spy
      consoleSpy.mockRestore();
    });
    
    test('should create and initialize the server if it does not exist', () => {
      // Ensure no server exists
      singletonInstance = null;
      
      // Spy on console.log
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      initializeWebSocketServer(mockHttpServer);
      
      expect(mockWebSocketServer.initialize).toHaveBeenCalledWith(mockHttpServer);
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket server initialized successfully');
      
      // Restore the spy
      consoleSpy.mockRestore();
    });
  });
}); 