import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import {
  chatEventEmitter,
  SSEEvent,
  TaskCompletedEvent,
  AgentStatusChangedEvent,
  SystemNotificationEvent,
  FileProcessedEvent,
  ChatEventType
} from '../../../../../lib/events/ChatEventEmitter';

// Types for user notification connection management
interface UserNotificationConnection {
  readonly id: string;
  readonly userId: string;
  readonly connectedAt: number;
  lastActivity: number;
}

// Connection tracking for monitoring
const userConnections = new Map<string, UserNotificationConnection>();

/**
 * Pure function to validate user access
 * TODO: Implement proper authentication/authorization
 */
async function validateUserAccess(userId: string, requestUserId?: string): Promise<boolean> {
  // For now, allow access - implement proper validation later
  // This should check if the requesting user has access to notifications for this userId
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
 * Pure function to check if event should be sent to user
 */
function shouldSendEventToUser(event: SSEEvent, userId: string): boolean {
  // Check if event is relevant to this user
  switch (event.type) {
    case 'TASK_COMPLETED':
    case 'FILE_PROCESSED':
      return event.userId === userId;

    case 'AGENT_STATUS_CHANGED':
    case 'SYSTEM_NOTIFICATION':
      return true; // Global events for all users

    default:
      return false;
  }
}

/**
 * GET /api/notifications/[userId]/stream
 * Server-Sent Events endpoint for user-specific notifications
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
): Promise<Response> {
  const { userId } = await params;

  // Extract requesting user ID from headers or auth (simplified for now)
  const requestingUserId = request.headers.get('x-user-id') || userId;

  // Validate user access
  const hasAccess = await validateUserAccess(userId, requestingUserId);
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Unauthorized access to user notifications' },
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
      const connection: UserNotificationConnection = Object.freeze({
        id: connectionId,
        userId,
        connectedAt: Date.now(),
        lastActivity: Date.now()
      });
      userConnections.set(connectionId, connection);

      console.log(`User notification SSE connection opened: ${connectionId} for user: ${userId}`);

      // Send initial connection confirmation
      const initEvent: SystemNotificationEvent = {
        id: ulid(),
        type: ChatEventType.SYSTEM_NOTIFICATION,
        timestamp: Date.now(),
        notification: {
          level: 'info' as const,
          title: 'Notifications Connected',
          message: 'Real-time notifications enabled'
        }
      };
      controller.enqueue(encoder.encode(formatSSEData(initEvent)));

      // Event handlers for different notification types
      const taskUnsubscribe = chatEventEmitter.onTaskCompleted(
        userId,
        (event: TaskCompletedEvent) => {
          try {
            if (shouldSendEventToUser(event, userId)) {
              controller.enqueue(encoder.encode(formatSSEData(event)));
              // Update activity timestamp
              const conn = userConnections.get(connectionId);
              if (conn) {
                userConnections.set(connectionId, { ...conn, lastActivity: Date.now() });
              }
            }
          } catch (error) {
            console.error('Error sending task completion event:', error);
          }
        }
      );

      const agentStatusUnsubscribe = chatEventEmitter.onAgentStatusChanged(
        (event: AgentStatusChangedEvent) => {
          try {
            if (shouldSendEventToUser(event, userId)) {
              controller.enqueue(encoder.encode(formatSSEData(event)));
              // Update activity timestamp
              const conn = userConnections.get(connectionId);
              if (conn) {
                userConnections.set(connectionId, { ...conn, lastActivity: Date.now() });
              }
            }
          } catch (error) {
            console.error('Error sending agent status event:', error);
          }
        }
      );

      const systemNotificationUnsubscribe = chatEventEmitter.onSystemNotification(
        (event: SystemNotificationEvent) => {
          try {
            if (shouldSendEventToUser(event, userId)) {
              controller.enqueue(encoder.encode(formatSSEData(event)));
              // Update activity timestamp
              const conn = userConnections.get(connectionId);
              if (conn) {
                userConnections.set(connectionId, { ...conn, lastActivity: Date.now() });
              }
            }
          } catch (error) {
            console.error('Error sending system notification event:', error);
          }
        }
      );

      const fileProcessedUnsubscribe = chatEventEmitter.onFileProcessed(
        userId,
        (event: FileProcessedEvent) => {
          try {
            if (shouldSendEventToUser(event, userId)) {
              controller.enqueue(encoder.encode(formatSSEData(event)));
              // Update activity timestamp
              const conn = userConnections.get(connectionId);
              if (conn) {
                userConnections.set(connectionId, { ...conn, lastActivity: Date.now() });
              }
            }
          } catch (error) {
            console.error('Error sending file processed event:', error);
          }
        }
      );

      // Keepalive mechanism - ping every 30 seconds
      const keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(createKeepalive()));
          // Update activity timestamp
          const conn = userConnections.get(connectionId);
          if (conn) {
            userConnections.set(connectionId, { ...conn, lastActivity: Date.now() });
          }
        } catch (error) {
          console.error('Error sending keepalive:', error);
          clearInterval(keepaliveInterval);
        }
      }, 30000);

      // Connection timeout check - close inactive connections after 10 minutes
      const timeoutInterval = setInterval(() => {
        const conn = userConnections.get(connectionId);
        if (conn) {
          const inactiveTime = Date.now() - conn.lastActivity;
          if (inactiveTime > 10 * 60 * 1000) { // 10 minutes
            console.log(`Closing inactive user notification SSE connection: ${connectionId}`);
            controller.close();
          }
        }
      }, 60000); // Check every minute

      // Cleanup function for when connection closes
      const cleanup = () => {
        console.log(`User notification SSE connection closed: ${connectionId}`);

        // Unsubscribe from events
        taskUnsubscribe();
        agentStatusUnsubscribe();
        systemNotificationUnsubscribe();
        fileProcessedUnsubscribe();

        // Clear intervals
        clearInterval(keepaliveInterval);
        clearInterval(timeoutInterval);

        // Remove from connection tracking
        userConnections.delete(connectionId);
      };

      // Handle client disconnect
      request.signal.addEventListener('abort', cleanup);

      // Handle stream errors
      controller.error = cleanup;
    },

    cancel() {
      // This is called when the stream is cancelled
      console.log(`User notification SSE stream cancelled for connection: ${connectionId}`);
      userConnections.delete(connectionId);
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
 * Get user notification connection statistics for monitoring
 */
export function getUserNotificationStats() {
  const stats = {
    totalConnections: userConnections.size,
    connectionsByUser: {} as Record<string, number>,
    oldestConnection: null as UserNotificationConnection | null,
    averageConnectionTime: 0
  };

  let totalConnectionTime = 0;
  let oldestTime = Date.now();

  for (const connection of userConnections.values()) {
    // Count by user
    stats.connectionsByUser[connection.userId] =
      (stats.connectionsByUser[connection.userId] || 0) + 1;

    // Track oldest connection
    if (connection.connectedAt < oldestTime) {
      oldestTime = connection.connectedAt;
      stats.oldestConnection = connection;
    }

    // Calculate total connection time
    totalConnectionTime += Date.now() - connection.connectedAt;
  }

  if (userConnections.size > 0) {
    stats.averageConnectionTime = totalConnectionTime / userConnections.size;
  }

  return stats;
} 