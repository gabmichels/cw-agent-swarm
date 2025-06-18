/**
 * Multi-Agent Communication Protocols
 * 
 * This module defines the standard communication protocols for agent-to-agent
 * communication, including message formats, communication patterns, and protocol
 * standards for different interaction types.
 */

import { StructuredId } from '../../../../../types/entity-identifier';

/**
 * Communication protocol types supported by the system
 */
export enum CommunicationProtocol {
  REQUEST_RESPONSE = 'request_response',   // Simple request-response pattern
  NOTIFICATION = 'notification',           // One-way notification with no response expected
  BROADCAST = 'broadcast',                 // Message to multiple recipients
  STREAMING = 'streaming',                 // Chunked/streaming message delivery
  DELEGATION = 'delegation',               // Task delegation with result reporting
  COLLABORATION = 'collaboration',         // Multi-step collaborative exchange
  NEGOTIATION = 'negotiation',             // Negotiation with proposals and counterproposals
  QUERY = 'query',                         // Information query with structured response
  EVENT = 'event',                         // Event notification
  STATUS_UPDATE = 'status_update'          // Status or progress update
}

/**
 * Message format types for inter-agent communication
 */
export enum MessageFormat {
  TEXT = 'text',                  // Plain text content
  MARKDOWN = 'markdown',          // Markdown formatted content
  JSON = 'json',                  // JSON-structured data
  HTML = 'html',                  // HTML content
  STRUCTURED = 'structured'       // Custom structured format
}

/**
 * Priority levels for messages
 */
export enum MessagePriority {
  LOW = 'low',           // Background processing, no urgency
  NORMAL = 'normal',     // Standard priority
  HIGH = 'high',         // Prioritize over normal messages
  URGENT = 'urgent'      // Immediate attention required
}

/**
 * Delivery status for messages
 */
export enum DeliveryStatus {
  PENDING = 'pending',          // Not yet delivered
  DELIVERED = 'delivered',      // Successfully delivered to recipient
  READ = 'read',                // Confirmed read by recipient
  PROCESSED = 'processed',      // Recipient has processed the message
  RESPONDED = 'responded',      // Recipient has responded to the message
  FAILED = 'failed'             // Delivery failed
}

/**
 * Base message interface for all inter-agent communication
 */
export interface BaseMessage {
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

/**
 * Request message - requires a response
 */
export interface RequestMessage extends BaseMessage {
  protocol: CommunicationProtocol.REQUEST_RESPONSE;
  requiresResponse: true;
  requestType: string;
  responseFormat?: MessageFormat;
  timeoutMs?: number;
}

/**
 * Response message - in response to a request
 */
export interface ResponseMessage extends BaseMessage {
  protocol: CommunicationProtocol.REQUEST_RESPONSE;
  requiresResponse: false;
  responseToId: string;
  isSuccessful: boolean;
  errorMessage?: string;
}

/**
 * Notification message - no response required
 */
export interface NotificationMessage extends BaseMessage {
  protocol: CommunicationProtocol.NOTIFICATION;
  requiresResponse: false;
  notificationType: string;
  expirationTime?: number;
}

/**
 * Broadcast message - sent to multiple recipients
 */
export interface BroadcastMessage extends BaseMessage {
  protocol: CommunicationProtocol.BROADCAST;
  requiresResponse: boolean;
  recipients: string[];
  broadcastType: string;
  acknowledgmentRequired?: boolean;
}

/**
 * Delegation message - for task delegation
 */
export interface DelegationMessage extends BaseMessage {
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

/**
 * Collaboration message - for multi-step collaboration
 */
export interface CollaborationMessage extends BaseMessage {
  protocol: CommunicationProtocol.COLLABORATION;
  collaborationId: string;
  stage: string;
  role: string;
  contributionType: string;
  previousContributions?: string[];
}

/**
 * Negotiation message - for proposals and counterproposals
 */
export interface NegotiationMessage extends BaseMessage {
  protocol: CommunicationProtocol.NEGOTIATION;
  negotiationId: string;
  proposalType: string;
  proposalVersion: number;
  proposalContent: Record<string, unknown>;
  isCounterProposal: boolean;
  acceptanceStatus?: 'accepted' | 'rejected' | 'modified';
}

/**
 * Query message - for information requests
 */
export interface QueryMessage extends BaseMessage {
  protocol: CommunicationProtocol.QUERY;
  requiresResponse: true;
  queryType: string;
  queryParameters: Record<string, unknown>;
  responseFormat: MessageFormat;
}

/**
 * Event message - for event notifications
 */
export interface EventMessage extends BaseMessage {
  protocol: CommunicationProtocol.EVENT;
  requiresResponse: false;
  eventType: string;
  eventSource: string;
  eventData: Record<string, unknown>;
  eventTime: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Status update message - for progress reporting
 */
export interface StatusUpdateMessage extends BaseMessage {
  protocol: CommunicationProtocol.STATUS_UPDATE;
  requiresResponse: false;
  statusType: string;
  progress?: number;  // 0-100 percentage
  state: string;
  details?: Record<string, unknown>;
}

/**
 * Message utility functions
 */
export class MessageProtocolUtils {
  /**
   * Create a new request message
   */
  static createRequest(
    senderId: string,
    recipientId: string,
    conversationId: string,
    content: string | Record<string, unknown>,
    requestType: string,
    options: {
      contentFormat?: MessageFormat,
      priority?: MessagePriority,
      responseFormat?: MessageFormat,
      timeoutMs?: number,
      metadata?: Record<string, unknown>,
      parentMessageId?: string,
      threadId?: string,
      traceId?: string,
    } = {}
  ): RequestMessage {
    return {
      id: crypto.randomUUID(),
      conversationId,
      threadId: options.threadId,
      senderId,
      recipientId,
      content,
      contentFormat: options.contentFormat || MessageFormat.TEXT,
      timestamp: Date.now(),
      protocol: CommunicationProtocol.REQUEST_RESPONSE,
      priority: options.priority || MessagePriority.NORMAL,
      deliveryStatus: DeliveryStatus.PENDING,
      requiresResponse: true,
      requestType,
      responseFormat: options.responseFormat,
      timeoutMs: options.timeoutMs,
      parentMessageId: options.parentMessageId,
      traceId: options.traceId || crypto.randomUUID(),
      metadata: options.metadata
    };
  }

  /**
   * Create a response to a request
   */
  static createResponse(
    requestMessage: RequestMessage,
    content: string | Record<string, unknown>,
    isSuccessful: boolean,
    options: {
      contentFormat?: MessageFormat,
      errorMessage?: string,
      metadata?: Record<string, unknown>
    } = {}
  ): ResponseMessage {
    return {
      id: crypto.randomUUID(),
      conversationId: requestMessage.conversationId,
      threadId: requestMessage.threadId,
      senderId: requestMessage.recipientId!,
      recipientId: requestMessage.senderId,
      content,
      contentFormat: options.contentFormat || requestMessage.responseFormat || requestMessage.contentFormat,
      timestamp: Date.now(),
      protocol: CommunicationProtocol.REQUEST_RESPONSE,
      priority: requestMessage.priority,
      deliveryStatus: DeliveryStatus.PENDING,
      requiresResponse: false,
      responseToId: requestMessage.id,
      isSuccessful,
      errorMessage: options.errorMessage,
      correlationId: requestMessage.correlationId,
      traceId: requestMessage.traceId,
      metadata: options.metadata
    };
  }

  /**
   * Create a notification message
   */
  static createNotification(
    senderId: string,
    recipientId: string,
    conversationId: string,
    content: string | Record<string, unknown>,
    notificationType: string,
    options: {
      contentFormat?: MessageFormat,
      priority?: MessagePriority,
      expirationTime?: number,
      metadata?: Record<string, unknown>,
      threadId?: string,
      traceId?: string
    } = {}
  ): NotificationMessage {
    return {
      id: crypto.randomUUID(),
      conversationId,
      threadId: options.threadId,
      senderId,
      recipientId,
      content,
      contentFormat: options.contentFormat || MessageFormat.TEXT,
      timestamp: Date.now(),
      protocol: CommunicationProtocol.NOTIFICATION,
      priority: options.priority || MessagePriority.NORMAL,
      deliveryStatus: DeliveryStatus.PENDING,
      requiresResponse: false,
      notificationType,
      expirationTime: options.expirationTime,
      traceId: options.traceId || crypto.randomUUID(),
      metadata: options.metadata
    };
  }

  /**
   * Create a broadcast message
   */
  static createBroadcast(
    senderId: string,
    recipients: string[],
    conversationId: string,
    content: string | Record<string, unknown>,
    broadcastType: string,
    options: {
      contentFormat?: MessageFormat,
      priority?: MessagePriority,
      requiresResponse?: boolean,
      acknowledgmentRequired?: boolean,
      metadata?: Record<string, unknown>,
      threadId?: string,
      traceId?: string
    } = {}
  ): BroadcastMessage {
    return {
      id: crypto.randomUUID(),
      conversationId,
      threadId: options.threadId,
      senderId,
      recipients,
      content,
      contentFormat: options.contentFormat || MessageFormat.TEXT,
      timestamp: Date.now(),
      protocol: CommunicationProtocol.BROADCAST,
      priority: options.priority || MessagePriority.NORMAL,
      deliveryStatus: DeliveryStatus.PENDING,
      requiresResponse: options.requiresResponse || false,
      broadcastType,
      acknowledgmentRequired: options.acknowledgmentRequired,
      traceId: options.traceId || crypto.randomUUID(),
      metadata: options.metadata
    };
  }

  /**
   * Check if a message requires a response
   */
  static requiresResponse(message: BaseMessage): boolean {
    return message.requiresResponse;
  }

  /**
   * Check if a message has expired
   */
  static isExpired(message: BaseMessage): boolean {
    if (message.protocol === CommunicationProtocol.NOTIFICATION && (message as NotificationMessage).expirationTime) {
      return Date.now() > (message as NotificationMessage).expirationTime!;
    }
    
    if (message.responseDeadline) {
      return Date.now() > message.responseDeadline;
    }
    
    return false;
  }

  /**
   * Mark a message as delivered
   */
  static markAsDelivered(message: BaseMessage): BaseMessage {
    return {
      ...message,
      deliveryStatus: DeliveryStatus.DELIVERED
    };
  }

  /**
   * Mark a message as read
   */
  static markAsRead(message: BaseMessage): BaseMessage {
    return {
      ...message,
      deliveryStatus: DeliveryStatus.READ
    };
  }

  /**
   * Mark a message as processed
   */
  static markAsProcessed(message: BaseMessage): BaseMessage {
    return {
      ...message,
      deliveryStatus: DeliveryStatus.PROCESSED
    };
  }

  /**
   * Mark a message as responded to
   */
  static markAsResponded(message: BaseMessage): BaseMessage {
    return {
      ...message,
      deliveryStatus: DeliveryStatus.RESPONDED
    };
  }
} 