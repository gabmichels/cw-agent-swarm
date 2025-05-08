import { SocketIOWebSocketServer } from './websocket-server';
import { WebSocketServer, ServerEvent } from './types';
import { Server as HTTPServer } from 'http';

// Create a singleton WebSocket server instance
let webSocketServer: WebSocketServer | null = null;

/**
 * Get the WebSocket server instance, creating it if it doesn't exist
 */
export function getWebSocketServer(): WebSocketServer {
  if (!webSocketServer) {
    webSocketServer = new SocketIOWebSocketServer();
  }
  return webSocketServer;
}

/**
 * Initialize the WebSocket server with an HTTP server
 */
export function initializeWebSocketServer(httpServer: HTTPServer): void {
  const server = getWebSocketServer();
  server.initialize(httpServer);
  console.log('WebSocket server initialized successfully');
}

// Re-export types and events
export { ServerEvent };
export type { WebSocketServer };
export * from './types'; 