import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { chatEventEmitter, SSEEvent, NewMessageEvent, TypingEvent, SystemNotificationEvent, ChatEventType } from '../../../../../lib/events/ChatEventEmitter';

// Types for SSE connection management
interface SSEConnection {
  readonly id: string;
  readonly chatId: string;
  readonly userId: string;
  readonly connectedAt: number;
  lastActivity: number;
}

// Connection tracking for monitoring
const connections = new Map<string, SSEConnection>();

/**
 * Pure function to validate chat access
 * TODO: Implement proper authentication/authorization
 */
async function validateChatAccess(chatId: string, userId?: string): Promise<boolean> {
  // For now, allow access - implement proper validation later
  // This should check if user has access to the chat
  return true;
}

/**
 * Pure function to create SSE data format
 */
function formatSSEData(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Pure function to create keepalive message
 */
function createKeepalive(): string {
  return `: keepalive ${Date.now()}\n\n`;
}

/**
 * GET /api/chat/[chatId]/stream
 * Server-Sent Events endpoint for real-time chat updates
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
): Promise<Response> {
  const { chatId } = params;
  
  // Extract user ID from headers or auth (simplified for now)
  const userId = request.headers.get('x-user-id') || 'anonymous';
  
  // Validate chat access
  const hasAccess = await validateChatAccess(chatId, userId);
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Unauthorized access to chat' }, 
      { status: 403 }
    );
  }

  // Generate unique connection ID
  const connectionId = ulid();
  
  const encoder = new TextEncoder();
  
  // Create readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Track connection for monitoring
      const connection: SSEConnection = Object.freeze({
        id: connectionId,
        chatId,
        userId,
        connectedAt: Date.now(),
        lastActivity: Date.now()
      });
      connections.set(connectionId, connection);

      console.log(`SSE connection opened: ${connectionId} for chat: ${chatId}`);

      // Send initial connection confirmation
      const initEvent: SystemNotificationEvent = {
        id: ulid(),
        type: ChatEventType.SYSTEM_NOTIFICATION,
        timestamp: Date.now(),
        notification: {
          level: 'info' as const,
          title: 'Connected',
          message: 'Real-time chat enabled'
        }
      };
      controller.enqueue(encoder.encode(formatSSEData(initEvent)));

      // Event handlers for different event types
      const messageUnsubscribe = chatEventEmitter.onNewMessage(
        chatId,
        (event: NewMessageEvent) => {
          try {
            controller.enqueue(encoder.encode(formatSSEData(event)));
            // Update activity timestamp
            const conn = connections.get(connectionId);
            if (conn) {
              connections.set(connectionId, { ...conn, lastActivity: Date.now() });
            }
          } catch (error) {
            console.error('Error sending message event:', error);
          }
        }
      );

      const typingUnsubscribe = chatEventEmitter.onTypingEvent(
        chatId,
        (event: TypingEvent) => {
          try {
            // Don't send typing events back to the same user
            if (event.userId !== userId) {
              controller.enqueue(encoder.encode(formatSSEData(event)));
            }
          } catch (error) {
            console.error('Error sending typing event:', error);
          }
        }
      );

      // Keepalive mechanism - ping every 30 seconds
      const keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(createKeepalive()));
          // Update activity timestamp
          const conn = connections.get(connectionId);
          if (conn) {
            connections.set(connectionId, { ...conn, lastActivity: Date.now() });
          }
        } catch (error) {
          console.error('Error sending keepalive:', error);
          clearInterval(keepaliveInterval);
        }
      }, 30000);

      // Connection timeout check - close inactive connections after 5 minutes
      const timeoutInterval = setInterval(() => {
        const conn = connections.get(connectionId);
        if (conn) {
          const inactiveTime = Date.now() - conn.lastActivity;
          if (inactiveTime > 5 * 60 * 1000) { // 5 minutes
            console.log(`Closing inactive SSE connection: ${connectionId}`);
            controller.close();
          }
        }
      }, 60000); // Check every minute

      // Cleanup function for when connection closes
      const cleanup = () => {
        console.log(`SSE connection closed: ${connectionId}`);
        
        // Unsubscribe from events
        messageUnsubscribe();
        typingUnsubscribe();
        
        // Clear intervals
        clearInterval(keepaliveInterval);
        clearInterval(timeoutInterval);
        
        // Remove from connection tracking
        connections.delete(connectionId);
      };

      // Handle client disconnect
      request.signal.addEventListener('abort', cleanup);
      
      // Handle stream errors
      controller.error = cleanup;
    },

    cancel() {
      // This is called when the stream is cancelled
      console.log(`SSE stream cancelled for connection: ${connectionId}`);
      connections.delete(connectionId);
    }
  });

  // Return SSE response with proper headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, X-User-Id',
      'Access-Control-Allow-Methods': 'GET',
      // Prevent buffering in nginx/proxies
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, X-User-Id',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}

/**
 * Get connection statistics for monitoring
 * This could be moved to a separate monitoring endpoint
 */
export function getConnectionStats() {
  const stats = {
    totalConnections: connections.size,
    connectionsByChat: {} as Record<string, number>,
    oldestConnection: null as SSEConnection | null,
    averageConnectionTime: 0
  };

  let totalConnectionTime = 0;
  let oldestTime = Date.now();

  for (const connection of connections.values()) {
    // Count by chat
    stats.connectionsByChat[connection.chatId] = 
      (stats.connectionsByChat[connection.chatId] || 0) + 1;

    // Track oldest connection
    if (connection.connectedAt < oldestTime) {
      oldestTime = connection.connectedAt;
      stats.oldestConnection = connection;
    }

    // Calculate total connection time
    totalConnectionTime += Date.now() - connection.connectedAt;
  }

  if (connections.size > 0) {
    stats.averageConnectionTime = totalConnectionTime / connections.size;
  }

  return stats;
} 