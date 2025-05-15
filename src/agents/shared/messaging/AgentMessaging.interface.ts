/**
 * AgentMessaging.interface.ts - Interfaces for agent-to-agent messaging
 * 
 * This module defines the interfaces for secure agent-to-agent communication.
 * It supports various message types and security levels for inter-agent coordination.
 */

import { AgentBase } from '../base/AgentBase.interface';

/**
 * Message priority levels
 */
export enum MessagePriority {
  /**
   * Highest priority, for urgent communication
   */
  URGENT = 'urgent',
  
  /**
   * High priority, but not urgent
   */
  HIGH = 'high',
  
  /**
   * Normal priority (default)
   */
  NORMAL = 'normal',
  
  /**
   * Low priority, can be delayed if system is busy
   */
  LOW = 'low'
}

/**
 * Security levels for messages
 */
export enum MessageSecurityLevel {
  /**
   * Public messages can be read by any agent in the system
   */
  PUBLIC = 'public',
  
  /**
   * Protected messages can only be read by agents with specific permissions
   */
  PROTECTED = 'protected',
  
  /**
   * Private messages can only be read by the specified recipient
   */
  PRIVATE = 'private',
  
  /**
   * Encrypted messages are secured with additional encryption
   */
  ENCRYPTED = 'encrypted'
}

/**
 * Message types for different communication purposes
 */
export enum MessageType {
  /**
   * Regular text messages
   */
  TEXT = 'text',
  
  /**
   * Command messages that request an action
   */
  COMMAND = 'command',
  
  /**
   * Request messages that expect a response
   */
  REQUEST = 'request',
  
  /**
   * Response messages to previous requests
   */
  RESPONSE = 'response',
  
  /**
   * Event notifications about system events
   */
  EVENT = 'event',
  
  /**
   * Error messages
   */
  ERROR = 'error'
}

/**
 * Status of a message
 */
export enum MessageStatus {
  /**
   * Message is queued for delivery
   */
  QUEUED = 'queued',
  
  /**
   * Message is being sent
   */
  SENDING = 'sending',
  
  /**
   * Message has been delivered to the recipient
   */
  DELIVERED = 'delivered',
  
  /**
   * Message has been read by the recipient
   */
  READ = 'read',
  
  /**
   * Message delivery failed
   */
  FAILED = 'failed'
}

/**
 * Base message interface for all agent messages
 */
export interface AgentMessage {
  /**
   * Unique identifier for the message
   */
  id: string;
  
  /**
   * Agent ID of the sender
   */
  senderId: string;
  
  /**
   * Agent ID of the recipient
   */
  recipientId: string;
  
  /**
   * Type of message
   */
  type: MessageType;
  
  /**
   * Content of the message (appropriate to the message type)
   */
  content: unknown;
  
  /**
   * Priority of the message
   */
  priority: MessagePriority;
  
  /**
   * Security level of the message
   */
  securityLevel: MessageSecurityLevel;
  
  /**
   * Timestamp when the message was created
   */
  timestamp: Date;
  
  /**
   * Current status of the message
   */
  status: MessageStatus;
  
  /**
   * Reference to a previous message (for response chains or threading)
   */
  inReplyTo?: string;
  
  /**
   * Identifies thread this message belongs to (for threading)
   */
  threadId?: string;
  
  /**
   * Time-to-live in milliseconds (optional, for ephemeral messages)
   */
  ttl?: number;
  
  /**
   * Metadata for the message (extensible)
   */
  metadata?: Record<string, unknown>;
}

/**
 * Text message with string content
 */
export interface TextMessage extends AgentMessage {
  type: MessageType.TEXT;
  content: string;
}

/**
 * Command message that requests an action
 */
export interface CommandMessage extends AgentMessage {
  type: MessageType.COMMAND;
  content: {
    command: string;
    params?: Record<string, unknown>;
  };
}

/**
 * Request message that expects a response
 */
export interface RequestMessage extends AgentMessage {
  type: MessageType.REQUEST;
  content: {
    requestType: string;
    params?: Record<string, unknown>;
  };
}

/**
 * Response message to a previous request
 */
export interface ResponseMessage extends AgentMessage {
  type: MessageType.RESPONSE;
  content: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
  inReplyTo: string; // Required for responses
}

/**
 * Event notification message
 */
export interface EventMessage extends AgentMessage {
  type: MessageType.EVENT;
  content: {
    eventType: string;
    data?: unknown;
  };
}

/**
 * Error message
 */
export interface ErrorMessage extends AgentMessage {
  type: MessageType.ERROR;
  content: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Message filter for searching/filtering messages
 */
export interface MessageFilter {
  senderId?: string;
  recipientId?: string;
  type?: MessageType;
  priority?: MessagePriority;
  securityLevel?: MessageSecurityLevel;
  status?: MessageStatus;
  threadId?: string;
  inReplyTo?: string;
  startTime?: Date;
  endTime?: Date;
}

/**
 * Message handler function type
 */
export type MessageHandler = (message: AgentMessage) => Promise<void>;

/**
 * Message handler registration
 */
export interface MessageHandlerRegistration {
  /**
   * ID of the registration
   */
  id: string;
  
  /**
   * Filter for messages this handler should receive
   */
  filter: MessageFilter;
  
  /**
   * Handler function to process matching messages
   */
  handler: MessageHandler;
}

/**
 * Subscription to a message channel or topic
 */
export interface MessageSubscription {
  /**
   * ID of the subscription
   */
  id: string;
  
  /**
   * Topic or channel being subscribed to
   */
  topic: string;
  
  /**
   * Agent ID of the subscriber
   */
  subscriberId: string;
  
  /**
   * Filter for messages this subscription should receive
   */
  filter?: MessageFilter;
}

/**
 * Options for sending messages
 */
export interface SendMessageOptions {
  /**
   * Priority for the message
   */
  priority?: MessagePriority;
  
  /**
   * Security level for the message
   */
  securityLevel?: MessageSecurityLevel;
  
  /**
   * ID of an earlier message this is in reply to
   */
  inReplyTo?: string;
  
  /**
   * Thread ID for grouping related messages
   */
  threadId?: string;
  
  /**
   * Time-to-live in milliseconds
   */
  ttl?: number;
  
  /**
   * Additional metadata for the message
   */
  metadata?: Record<string, unknown>;

  /**
   * Timeout in milliseconds for request messages
   */
  timeout?: number;

  /**
   * Callback for successful response to request messages
   */
  onResponse?: (result: SendMessageResult) => void;

  /**
   * Callback for errors in request messages
   */
  onError?: (error: Error) => void;
}

/**
 * Result of a send message operation
 */
export interface SendMessageResult {
  /**
   * ID of the sent message
   */
  messageId: string;
  
  /**
   * Whether the message was sent successfully
   */
  success: boolean;
  
  /**
   * Error message if sending failed
   */
  error?: string;
  
  /**
   * Message as sent
   */
  message: AgentMessage;
  
  /**
   * Timestamp when the message was sent
   */
  sentAt: Date;
}

/**
 * Primary interface for agent messaging capabilities
 */
export interface AgentMessagingSystem {
  /**
   * Send a message to another agent
   * @param recipientId ID of the recipient agent
   * @param type Type of message to send
   * @param content Content of the message
   * @param options Additional options for the message
   * @returns Result of the send operation
   */
  sendMessage(
    recipientId: string,
    type: MessageType,
    content: unknown,
    options?: SendMessageOptions
  ): Promise<SendMessageResult>;
  
  /**
   * Send a text message to another agent
   * @param recipientId ID of the recipient agent
   * @param text Text content of the message
   * @param options Additional options for the message
   * @returns Result of the send operation
   */
  sendTextMessage(
    recipientId: string,
    text: string,
    options?: SendMessageOptions
  ): Promise<SendMessageResult>;
  
  /**
   * Send a command message to another agent
   * @param recipientId ID of the recipient agent
   * @param command Command to execute
   * @param params Parameters for the command
   * @param options Additional options for the message
   * @returns Result of the send operation
   */
  sendCommandMessage(
    recipientId: string,
    command: string,
    params?: Record<string, unknown>,
    options?: SendMessageOptions
  ): Promise<SendMessageResult>;
  
  /**
   * Send a request message to another agent
   * @param recipientId ID of the recipient agent
   * @param requestType Type of request
   * @param params Parameters for the request
   * @param options Additional options for the message
   * @returns Result of the send operation
   */
  sendRequestMessage(
    recipientId: string,
    requestType: string,
    params?: Record<string, unknown>,
    options?: SendMessageOptions
  ): Promise<SendMessageResult>;
  
  /**
   * Send a response message to another agent
   * @param recipientId ID of the recipient agent
   * @param inReplyTo ID of the original request message
   * @param success Whether the request was successful
   * @param data Optional response data
   * @param error Optional error message (if success is false)
   * @param options Additional options for the message
   * @returns Result of the send operation
   */
  sendResponseMessage(
    recipientId: string,
    inReplyTo: string,
    success: boolean,
    data?: unknown,
    error?: string,
    options?: SendMessageOptions
  ): Promise<SendMessageResult>;
  
  /**
   * Register a handler to process incoming messages
   * @param filter Filter for messages this handler should receive
   * @param handler Handler function to process matching messages
   * @returns ID of the registered handler
   */
  registerHandler(
    filter: MessageFilter,
    handler: MessageHandler
  ): Promise<string>;
  
  /**
   * Unregister a previously registered handler
   * @param handlerId ID of the handler to unregister
   * @returns Whether the handler was successfully unregistered
   */
  unregisterHandler(
    handlerId: string
  ): Promise<boolean>;
  
  /**
   * Get recent messages matching a filter
   * @param filter Filter to apply to messages
   * @param limit Maximum number of messages to return
   * @returns Matching messages
   */
  getMessages(
    filter: MessageFilter,
    limit?: number
  ): Promise<AgentMessage[]>;
  
  /**
   * Get the current status of a message
   * @param messageId ID of the message to check
   * @returns Status of the message
   */
  getMessageStatus(
    messageId: string
  ): Promise<MessageStatus>;
  
  /**
   * Subscribe to a topic or channel
   * @param topic Topic or channel to subscribe to
   * @param filter Optional filter for messages on this topic
   * @returns ID of the subscription
   */
  subscribe(
    topic: string,
    filter?: MessageFilter
  ): Promise<string>;
  
  /**
   * Unsubscribe from a topic or channel
   * @param subscriptionId ID of the subscription to cancel
   * @returns Whether the unsubscription was successful
   */
  unsubscribe(
    subscriptionId: string
  ): Promise<boolean>;
}

/**
 * Extension of the AgentBase interface to include messaging capabilities
 */
export interface MessagingAgent extends AgentBase {
  /**
   * Send a message to another agent
   * @param recipientId ID of the recipient agent
   * @param type Type of message to send
   * @param content Content of the message
   * @param options Additional options for the message
   * @returns Result of the send operation
   */
  sendMessage(
    recipientId: string,
    type: MessageType,
    content: unknown,
    options?: SendMessageOptions
  ): Promise<SendMessageResult>;
  
  /**
   * Process an incoming message
   * @param message Message to process
   * @returns Whether the message was processed successfully
   */
  processMessage(
    message: AgentMessage
  ): Promise<boolean>;
} 