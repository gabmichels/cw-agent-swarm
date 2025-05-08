# WebSocket Implementation for Multi-Agent System

This document outlines the implementation of WebSocket support for the multi-agent system, enabling real-time updates and notifications.

## Architecture Overview

The WebSocket implementation follows a clean, layer-based architecture:

1. **Server-Side Components**:
   - **WebSocketServer**: Core server implementation that manages connections and message distribution
   - **ClientSubscriptionManager**: Tracks client subscriptions to agents, chats, and collections
   - **EventHandlerRegistry**: Manages event handlers for client-to-server events
   - **WebSocketNotificationService**: Provides a simple API for sending notifications

2. **Client-Side Components**:
   - **useWebSocket** hook: React hook for connecting to and interacting with the WebSocket server
   - **WebSocketDemo**: Demo component showing how to use the WebSocket functionality

3. **Integration Components**:
   - Custom Next.js server with WebSocket support
   - API route handlers that emit WebSocket events

## Server Implementation

### WebSocket Server

The WebSocket server is implemented using Socket.IO and provides:

- Room-based subscriptions for targeted notifications
- Event-based communication for type safety
- Reconnection handling for reliability
- CORS support for security

### Client Subscription Manager

Tracks subscriptions using a bidirectional approach:

- Maps from entities (agents, chats, collections) to client IDs
- Maps from client IDs to subscribed entities
- Provides methods for subscribing, unsubscribing, and listing subscribers

### Event Handler Registry

Manages event handlers for client events:

- Registers, removes, and retrieves event handlers
- Provides type-safe event handling
- Includes default handlers for common events

### Notification Service

Provides a simple API for sending notifications:

- Agent-related events (created, updated, deleted, status changed)
- Chat-related events (created, updated, deleted, message created, participant joined/left)
- Collection-related events (created, updated, deleted)
- System notifications (info, warning, error, success)

## Client Implementation

### useWebSocket Hook

A React hook that provides:

- Connection management (connect, disconnect, reconnect)
- Subscription management (subscribe, unsubscribe)
- Event listening and callback registration
- Status tracking and last event access

### WebSocket Demo Component

A demo component that demonstrates:

- Connecting to the WebSocket server
- Subscribing to agents and chats
- Receiving and displaying real-time events
- Event history tracking

## Integration with Next.js

### Custom Server

The WebSocket server is integrated with Next.js using a custom server:

1. The custom server is created in `src/server/next-utils.ts`
2. A server.js file is added to start the server with WebSocket support
3. Build scripts are updated to support the custom server

### API Integration

API routes are updated to emit WebSocket events:

- Agent CRUD operations emit agent events
- Chat CRUD operations emit chat events
- Collection CRUD operations emit collection events

## Event Types

### Server-to-Client Events

These events are sent from the server to connected clients:

| Event | Description | Payload |
|-------|-------------|---------|
| `agent:created` | An agent was created | `{ agentId, agent, userId, timestamp }` |
| `agent:updated` | An agent was updated | `{ agentId, agent, userId, timestamp }` |
| `agent:deleted` | An agent was deleted | `{ agentId, userId, timestamp }` |
| `agent:statusChanged` | An agent's status changed | `{ agentId, agent, userId, timestamp }` |
| `chat:created` | A chat was created | `{ chatId, chat, userId, timestamp }` |
| `chat:updated` | A chat was updated | `{ chatId, chat, userId, timestamp }` |
| `chat:deleted` | A chat was deleted | `{ chatId, userId, timestamp }` |
| `chat:messageCreated` | A message was added to a chat | `{ chatId, messageId, userId, timestamp }` |
| `chat:participantJoined` | A participant joined a chat | `{ chatId, participantId, userId, timestamp }` |
| `chat:participantLeft` | A participant left a chat | `{ chatId, participantId, userId, timestamp }` |
| `collection:created` | A collection was created | `{ collectionId, metadata, userId, timestamp }` |
| `collection:updated` | A collection was updated | `{ collectionId, metadata, userId, timestamp }` |
| `collection:deleted` | A collection was deleted | `{ collectionId, userId, timestamp }` |
| `system:notification` | System notification | `{ type, message, details, timestamp }` |

### Client-to-Server Events

These events are sent from clients to the server:

| Event | Description | Payload |
|-------|-------------|---------|
| `subscribe:agent` | Subscribe to agent events | `agentId` |
| `unsubscribe:agent` | Unsubscribe from agent events | `agentId` |
| `subscribe:chat` | Subscribe to chat events | `chatId` |
| `unsubscribe:chat` | Unsubscribe from chat events | `chatId` |
| `subscribe:collection` | Subscribe to collection events | `collectionId` |
| `unsubscribe:collection` | Unsubscribe from collection events | `collectionId` |
| `client:ready` | Client is ready to receive events | - |
| `client:disconnect` | Client is disconnecting | - |
| `message:received` | Acknowledge message reception | `{ messageId }` |
| `message:read` | Acknowledge message read | `{ messageId }` |

## Usage Examples

### Server-Side: Sending Notifications

```typescript
// Import the notification service
import { WebSocketNotificationService } from '../server/websocket/notification-service';

// Send an agent created notification
WebSocketNotificationService.notifyAgentCreated(agent, userId);

// Send a chat updated notification
WebSocketNotificationService.notifyChatUpdated(chat, userId);

// Send a system notification
WebSocketNotificationService.sendSystemNotification(
  'info',
  'Collection backup completed',
  { collectionId: 'agents', backupId: 'backup-123' }
);
```

### Client-Side: Subscribing to Events

```tsx
// Use the WebSocket hook in a React component
const { 
  isConnected, 
  subscribeToEvent, 
  subscribeToAgent 
} = useWebSocket();

// Subscribe to an agent
subscribeToAgent('agent-123');

// Listen for agent status changes
useEffect(() => {
  const unsubscribe = subscribeToEvent(
    ServerEvent.AGENT_STATUS_CHANGED,
    (payload) => {
      console.log('Agent status changed:', payload);
      // Update UI
    }
  );
  
  return () => unsubscribe?.();
}, [subscribeToEvent]);
```

## Testing the Implementation

1. Start the server with WebSocket support:
   ```
   npm run build:ws
   npm run start:ws
   ```

2. Visit the WebSocket demo page:
   ```
   http://localhost:3000/api/multi-agent/demo/websocket
   ```

3. Use the demo interface to:
   - Connect to the WebSocket server
   - Subscribe to agents and chats
   - See real-time events when interacting with the API

## Conclusion

This WebSocket implementation provides a robust foundation for real-time communication in the multi-agent system. It enables agents to communicate with each other and with users in real-time, improving the responsiveness and interactivity of the system. 