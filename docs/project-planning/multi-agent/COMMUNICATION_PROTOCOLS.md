# Multi-Agent Communication Protocols

This document provides an overview of the communication protocols implemented for the multi-agent system. These protocols define standard message formats, interaction patterns, and utilities for reliable agent-to-agent communication.

## Introduction

The communication protocols form a critical component of the multi-agent system, enabling diverse agents to communicate effectively regardless of their specific implementation details. The protocols provide a standardized way to exchange information, make requests, deliver notifications, and coordinate complex multi-step tasks.

## Protocol Types

The system supports the following communication protocol types:

| Protocol Type | Description | Use Cases |
|---------------|-------------|-----------|
| REQUEST_RESPONSE | Simple request-response pattern | Information queries, task delegation with results |
| NOTIFICATION | One-way notification with no response expected | Status updates, broadcasts, FYI messages |
| BROADCAST | Message to multiple recipients | Team announcements, system-wide alerts |
| STREAMING | Chunked/streaming message delivery | Long responses, real-time data feeds |
| DELEGATION | Task delegation with result reporting | Complex task assignment with progress tracking |
| COLLABORATION | Multi-step collaborative exchange | Joint problem-solving, iterative work |
| NEGOTIATION | Negotiation with proposals and counterproposals | Resource allocation, consensus building |
| QUERY | Information query with structured response | Database-like queries, complex information retrieval |
| EVENT | Event notification | System events, state changes |
| STATUS_UPDATE | Status or progress update | Task progress reports, health status |

## Message Formats

Messages can be exchanged in various formats to accommodate different agent capabilities and requirements:

| Format | Description | Best For |
|--------|-------------|----------|
| TEXT | Plain text content | Simple messages, human-readable content |
| MARKDOWN | Markdown formatted content | Structured content with formatting |
| JSON | JSON-structured data | Structured data exchange, API-like communication |
| HTML | HTML content | Rich content with layout and styling |
| STRUCTURED | Custom structured format | Domain-specific structured data |

## Message Priority Levels

Messages support different priority levels to indicate urgency and processing requirements:

| Priority | Description |
|----------|-------------|
| LOW | Background processing, no urgency |
| NORMAL | Standard priority |
| HIGH | Prioritize over normal messages |
| URGENT | Immediate attention required |

## Core Message Structure

All messages in the system share a common base structure that includes:

```typescript
interface BaseMessage {
  // Core identity
  id: string;
  conversationId: string;
  threadId?: string;
  
  // Participants
  senderId: string;
  recipientId?: string;
  recipients?: string[];
  
  // Message details
  content: string | Record<string, unknown>;
  contentFormat: MessageFormat;
  timestamp: number;
  
  // Protocol information
  protocol: CommunicationProtocol;
  priority: MessagePriority;
  deliveryStatus: DeliveryStatus;
  requiresResponse: boolean;
  responseDeadline?: number;
  
  // Context and tracking
  correlationId?: string;
  parentMessageId?: string;
  traceId?: string;
  
  // Additional metadata
  metadata?: Record<string, unknown>;
}
```

## Specialized Message Types

Each protocol has a specialized message type that extends the base message with protocol-specific fields:

### Request Message

```typescript
interface RequestMessage extends BaseMessage {
  protocol: CommunicationProtocol.REQUEST_RESPONSE;
  requiresResponse: true;
  requestType: string;
  responseFormat?: MessageFormat;
  timeoutMs?: number;
}
```

### Response Message

```typescript
interface ResponseMessage extends BaseMessage {
  protocol: CommunicationProtocol.REQUEST_RESPONSE;
  requiresResponse: false;
  responseToId: string;
  isSuccessful: boolean;
  errorMessage?: string;
}
```

### Notification Message

```typescript
interface NotificationMessage extends BaseMessage {
  protocol: CommunicationProtocol.NOTIFICATION;
  requiresResponse: false;
  notificationType: string;
  expirationTime?: number;
}
```

### Broadcast Message

```typescript
interface BroadcastMessage extends BaseMessage {
  protocol: CommunicationProtocol.BROADCAST;
  requiresResponse: boolean;
  recipients: string[];
  broadcastType: string;
  acknowledgmentRequired?: boolean;
}
```

### Delegation Message

```typescript
interface DelegationMessage extends BaseMessage {
  protocol: CommunicationProtocol.DELEGATION;
  requiresResponse: true;
  taskId: string;
  taskType: string;
  taskDescription: string;
  parameters: Record<string, unknown>;
  deadline?: number;
  priority: MessagePriority;
  requiredCapabilities?: string[];
}
```

## Message Lifecycle and Delivery Status

Messages have a lifecycle tracked by their delivery status:

| Status | Description |
|--------|-------------|
| PENDING | Not yet delivered |
| DELIVERED | Successfully delivered to recipient |
| READ | Confirmed read by recipient |
| PROCESSED | Recipient has processed the message |
| RESPONDED | Recipient has responded to the message |
| FAILED | Delivery failed |

## Utility Functions

The `MessageProtocolUtils` class provides utility functions for working with the communication protocols:

- **createRequest** - Create a new request message
- **createResponse** - Create a response to a request
- **createNotification** - Create a notification message
- **createBroadcast** - Create a broadcast message
- **requiresResponse** - Check if a message requires a response
- **isExpired** - Check if a message has expired
- **markAsDelivered** - Mark a message as delivered
- **markAsRead** - Mark a message as read
- **markAsProcessed** - Mark a message as processed
- **markAsResponded** - Mark a message as responded to

## Implementation Details

### Message Creation

To create a request message:

```typescript
const requestMsg = MessageProtocolUtils.createRequest(
  senderId,
  recipientId,
  conversationId,
  content,
  requestType,
  {
    contentFormat: MessageFormat.TEXT,
    priority: MessagePriority.NORMAL,
    responseFormat: MessageFormat.JSON,
    timeoutMs: 30000,
    metadata: { context: 'specific-context' }
  }
);
```

To create a response:

```typescript
const responseMsg = MessageProtocolUtils.createResponse(
  requestMessage,
  responseContent,
  true, // success
  {
    contentFormat: MessageFormat.JSON,
    metadata: { processingTime: 150 }
  }
);
```

### Message Routing

Messages are routed through the `MessageRouter` component, which uses the message content, protocol type, and recipient capabilities to determine the appropriate routing strategy:

```typescript
const recipientIds = await messageRouter.routeMessage({
  message: requestMessage,
  strategy: RoutingStrategy.CAPABILITY,
  requiredCapabilities: ['data_analysis'],
  context: { priority: 'normal' }
});
```

### Message Transformation

The `MessageTransformer` component allows for conversion between different message formats:

```typescript
const markdownMessage = await messageTransformer.transformMessageFormat(
  jsonMessage,
  MessageFormat.MARKDOWN
);
```

## Best Practices

1. **Use Explicit Protocol Types** - Always use the most specific protocol type for your communication needs
2. **Set Appropriate Timeouts** - Include timeouts for requests that require timely responses
3. **Include Correlation IDs** - For related messages, use the same correlation ID to track the conversation
4. **Prioritize Properly** - Only use HIGH and URGENT priorities when truly needed
5. **Use Structured Content** - For complex data exchange, prefer JSON or structured formats
6. **Handle Errors Gracefully** - Always include error handling for failed message delivery or processing
7. **Track Message Status** - Update the delivery status as messages progress through their lifecycle
8. **Include Context** - Provide sufficient context in message metadata for proper interpretation

## Security Considerations

- Messages should be validated before processing
- Agents should only process messages from trusted sources
- Sensitive information should be handled according to system security policies
- Authentication and authorization should be implemented for all message handlers
- All message exchanges should be logged for audit purposes

## Future Enhancements

- Add support for encrypted message content
- Implement digital signatures for message authentication
- Add schema validation for structured message content
- Create adapters for external communication protocols
- Implement advanced error handling and retry mechanisms
- Add support for prioritized message queuing 