/**
 * DefaultAgentMessagingSystem.ts - Default implementation of the AgentMessagingSystem interface
 * 
 * This module provides a complete implementation of secure agent-to-agent messaging
 * with support for different message types, security levels, and message handling.
 */

import { v4 as uuidv4 } from 'uuid';
// Import AbstractBaseManager from the correct path
import { AbstractBaseManager, ManagerConfig } from '../base/managers/BaseManager';
import { 
  AgentMessage, 
  AgentMessagingSystem,
  CommandMessage,
  ErrorMessage, 
  EventMessage,
  MessageFilter,
  MessageHandler,
  MessageHandlerRegistration,
  MessagePriority,
  MessageSecurityLevel,
  MessageStatus,
  MessageSubscription,
  MessageType,
  RequestMessage,
  ResponseMessage,
  SendMessageOptions,
  SendMessageResult,
  TextMessage
} from './AgentMessaging.interface';

// Define a monitor interface for messaging systems
interface AgentEventMonitor {
  log(event: {
    agentId: string;
    taskId?: string;
    eventType: string;
    status?: string;
    timestamp: number;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): void;
}

// Simple monitor implementation
const AgentMonitor: AgentEventMonitor = {
  log: (event) => {
    console.log(`[AGENT MONITOR] ${event.agentId} - ${event.eventType} at ${new Date(event.timestamp).toISOString()}`);
  }
};

/**
 * Messaging-specific configuration excluding base manager config
 */
interface MessagingConfig {
  /**
   * ID of the agent this messaging system belongs to
   */
  agentId: string;

  /**
   * Default TTL for messages in milliseconds (default: 24 hours)
   */
  defaultTtl: number;

  /**
   * Default security level for messages
   */
  defaultSecurityLevel: MessageSecurityLevel;

  /**
   * Maximum number of messages to keep in memory
   */
  maxMessageHistory: number;

  /**
   * Whether to log message activity to the monitor
   */
  enableMonitoring: boolean;

  /**
   * Enable message encryption for secure messages
   */
  enableEncryption: boolean;
}

/**
 * Configuration for the DefaultAgentMessagingSystem
 * Extends ManagerConfig to include messaging-specific properties
 */
export interface MessagingSystemConfig extends ManagerConfig {
  /**
   * ID of the agent this messaging system belongs to
   */
  agentId: string;

  /**
   * Default TTL for messages in milliseconds (default: 24 hours)
   */
  defaultTtl?: number;

  /**
   * Default security level for messages
   */
  defaultSecurityLevel?: MessageSecurityLevel;

  /**
   * Maximum number of messages to keep in memory
   */
  maxMessageHistory?: number;

  /**
   * Whether to log message activity to the monitor
   */
  enableMonitoring?: boolean;

  /**
   * Enable message encryption for secure messages
   */
  enableEncryption?: boolean;
}

/**
 * Default implementation of the AgentMessagingSystem interface
 */
export class DefaultAgentMessagingSystem extends AbstractBaseManager implements AgentMessagingSystem {
  /**
   * Registry of message handlers by agent ID and handler ID
   */
  private static handlerRegistry: Record<string, Record<string, MessageHandlerRegistration>> = {};

  /**
   * Registry of message subscriptions by topic
   */
  private static subscriptions: Record<string, MessageSubscription[]> = {};

  /**
   * Message store by agent ID
   */
  private static messageStore: Record<string, AgentMessage[]> = {};

  /**
   * Central message log for all agents
   */
  private static centralMessageLog: AgentMessage[] = [];

  /**
   * Map of pending requests waiting for responses
   */
  private pendingRequests: Map<string, {
    resolve: (value: SendMessageResult) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  /**
   * Messaging-specific configuration
   */
  private messagingConfig: MessagingConfig;

  /**
   * Create a new DefaultAgentMessagingSystem
   */
  constructor(config: MessagingSystemConfig) {
    // Call parent constructor with required parameters
    super(
      `messaging-${config.agentId}`, 
      'messaging',
      null as any, // Agent will be set later through setAgent
      config
    );

    // Set messaging-specific configuration values
    this.messagingConfig = {
      agentId: config.agentId,
      defaultTtl: config.defaultTtl ?? 24 * 60 * 60 * 1000, // 24 hours
      defaultSecurityLevel: config.defaultSecurityLevel ?? MessageSecurityLevel.PRIVATE,
      maxMessageHistory: config.maxMessageHistory ?? 1000,
      enableMonitoring: config.enableMonitoring ?? true,
      enableEncryption: config.enableEncryption ?? false
    };

    // Initialize message store for this agent if not exists
    if (!DefaultAgentMessagingSystem.messageStore[this.messagingConfig.agentId]) {
      DefaultAgentMessagingSystem.messageStore[this.messagingConfig.agentId] = [];
    }

    // Initialize handler registry for this agent if not exists
    if (!DefaultAgentMessagingSystem.handlerRegistry[this.messagingConfig.agentId]) {
      DefaultAgentMessagingSystem.handlerRegistry[this.messagingConfig.agentId] = {};
    }
  }
  
  /**
   * Initialize the messaging system
   */
  async initialize(): Promise<boolean> {
    try {
      // Register default handlers
      await this.registerDefaultHandlers();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`Error initializing messaging system: ${error}`);
      return false;
    }
  }

  /**
   * Shutdown the messaging system
   */
  async shutdown(): Promise<void> {
    // Clear all timeouts for pending requests
    const pendingRequestEntries = Array.from(this.pendingRequests.entries());
    for (const [_, pendingRequest] of pendingRequestEntries) {
      clearTimeout(pendingRequest.timeout);
    }
    this.pendingRequests.clear();
    this.initialized = false;
  }

  /**
   * Register default handlers for this messaging system
   */
  private async registerDefaultHandlers(): Promise<void> {
    // Register handler for response messages to resolve pending promises
    await this.registerHandler(
      { type: MessageType.RESPONSE, recipientId: this.messagingConfig.agentId },
      async (message: AgentMessage) => {
        if (!message.inReplyTo) return;
        
        const pendingRequest = this.pendingRequests.get(message.inReplyTo);
        if (pendingRequest) {
          // Clear timeout
          clearTimeout(pendingRequest.timeout);
          
          // Create send message result
          const result: SendMessageResult = {
            messageId: message.id,
            success: true,
            message: message,
            sentAt: message.timestamp
          };
          
          // Resolve pending promise
          pendingRequest.resolve(result);
          
          // Remove from pending requests
          this.pendingRequests.delete(message.inReplyTo);
        }
      }
    );
  }

  /**
   * Create a new message with default values
   */
  private createMessage<T extends AgentMessage>(
    recipientId: string,
    type: MessageType,
    content: unknown,
    options?: SendMessageOptions
  ): T {
    const messageId = uuidv4();
    const timestamp = new Date();
    
    const message = {
      id: messageId,
      senderId: this.messagingConfig.agentId,
      recipientId,
      type,
      content,
      priority: options?.priority ?? MessagePriority.NORMAL,
      securityLevel: options?.securityLevel ?? this.messagingConfig.defaultSecurityLevel,
      timestamp,
      status: MessageStatus.QUEUED,
      inReplyTo: options?.inReplyTo,
      threadId: options?.threadId ?? options?.inReplyTo ?? messageId,
      ttl: options?.ttl ?? this.messagingConfig.defaultTtl,
      metadata: options?.metadata ?? {}
    } as T;

    // Apply encryption if enabled and required by security level
    if (this.messagingConfig.enableEncryption && message.securityLevel === MessageSecurityLevel.ENCRYPTED) {
      // In a real implementation, we would encrypt the content here
      message.metadata!.encrypted = true;
    }

    return message;
  }

  /**
   * Send a message to another agent
   */
  async sendMessage(
    recipientId: string,
    type: MessageType,
    content: unknown,
    options?: SendMessageOptions
  ): Promise<SendMessageResult> {
    try {
      // Create the message
      const message = this.createMessage<AgentMessage>(recipientId, type, content, options);
      
      // Log the message in the store
      DefaultAgentMessagingSystem.messageStore[this.messagingConfig.agentId].push(message);
      DefaultAgentMessagingSystem.centralMessageLog.push(message);
      
      // Trim message history if needed
      if (DefaultAgentMessagingSystem.messageStore[this.messagingConfig.agentId].length > this.messagingConfig.maxMessageHistory) {
        DefaultAgentMessagingSystem.messageStore[this.messagingConfig.agentId].shift();
      }
      
      // Monitor the message if enabled
      if (this.messagingConfig.enableMonitoring) {
        AgentMonitor.log({
          agentId: this.messagingConfig.agentId,
          taskId: message.threadId || undefined,
          eventType: 'message',
          timestamp: Date.now(),
          metadata: {
            messageId: message.id,
            messageType: message.type,
            recipientId: message.recipientId,
            securityLevel: message.securityLevel,
            priority: message.priority
          }
        });
      }
      
      // Update message status
      message.status = MessageStatus.SENDING;
      
      // Find handlers for this message
      await this.deliverMessage(message);
      
      // Update message status
      message.status = MessageStatus.DELIVERED;
      
      // Create result
      const result: SendMessageResult = {
        messageId: message.id,
        success: true,
        message,
        sentAt: message.timestamp
      };
      
      return result;
    } catch (error) {
      // Create error result
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Monitor the error if enabled
      if (this.messagingConfig.enableMonitoring) {
        AgentMonitor.log({
          agentId: this.messagingConfig.agentId,
          eventType: 'error',
          status: 'failure',
          timestamp: Date.now(),
          errorMessage,
          metadata: {
            messageType: type,
            recipientId
          }
        });
      }
      
      return {
        messageId: uuidv4(),
        success: false,
        error: errorMessage,
        message: this.createMessage(recipientId, type, content, options),
        sentAt: new Date()
      };
    }
  }

  /**
   * Deliver a message to the appropriate handlers
   */
  private async deliverMessage(message: AgentMessage): Promise<void> {
    // Get handlers for recipient
    const recipientHandlers = DefaultAgentMessagingSystem.handlerRegistry[message.recipientId] || {};
    
    // Find matching handlers
    const matchingHandlers = Object.values(recipientHandlers).filter(registration => {
      const filter = registration.filter;
      
      // Check filter criteria
      if (filter.type && filter.type !== message.type) return false;
      if (filter.senderId && filter.senderId !== message.senderId) return false;
      if (filter.priority && filter.priority !== message.priority) return false;
      if (filter.securityLevel && filter.securityLevel !== message.securityLevel) return false;
      if (filter.status && filter.status !== message.status) return false;
      if (filter.threadId && filter.threadId !== message.threadId) return false;
      if (filter.inReplyTo && filter.inReplyTo !== message.inReplyTo) return false;
      
      return true;
    });
    
    // Deliver message to matching handlers
    const deliveries = matchingHandlers.map(registration => registration.handler(message));
    
    // Wait for all handlers to process
    await Promise.all(deliveries);
    
    // Find matching topic subscriptions
    if (message.metadata && typeof message.metadata.topic === 'string') {
      const topic = message.metadata.topic as string;
      const topicSubscriptions = DefaultAgentMessagingSystem.subscriptions[topic] || [];
      
      // Filter subscriptions by recipient
      const matchingSubscriptions = topicSubscriptions.filter(subscription => {
        // Must be for this recipient
        if (subscription.subscriberId !== message.recipientId) return false;
        
        // Check filter if exists
        if (subscription.filter) {
          if (subscription.filter.type && subscription.filter.type !== message.type) return false;
          if (subscription.filter.senderId && subscription.filter.senderId !== message.senderId) return false;
        }
        
        return true;
      });
      
      // Get recipient handlers for this topic
      const subscriptionHandlers = matchingSubscriptions.map(subscription => {
        return recipientHandlers[subscription.id]?.handler;
      }).filter(Boolean);
      
      // Deliver to subscription handlers
      const subscriptionDeliveries = subscriptionHandlers.map(handler => handler(message));
      await Promise.all(subscriptionDeliveries);
    }
  }

  /**
   * Send a text message to another agent
   */
  async sendTextMessage(
    recipientId: string,
    text: string,
    options?: SendMessageOptions
  ): Promise<SendMessageResult> {
    return this.sendMessage(recipientId, MessageType.TEXT, text, options);
  }

  /**
   * Send a command message to another agent
   */
  async sendCommandMessage(
    recipientId: string,
    command: string,
    params?: Record<string, unknown>,
    options?: SendMessageOptions
  ): Promise<SendMessageResult> {
    return this.sendMessage(
      recipientId,
      MessageType.COMMAND,
      {
        command,
        params
      },
      options
    );
  }

  /**
   * Send a request message to another agent
   */
  async sendRequestMessage(
    recipientId: string,
    requestType: string,
    params?: Record<string, unknown>,
    options?: SendMessageOptions
  ): Promise<SendMessageResult> {
    const content = {
      requestType,
      params
    };
    
    // Create message
    const message = this.createMessage<RequestMessage>(
      recipientId,
      MessageType.REQUEST,
      content,
      options
    );
    
    // Create a promise that will be resolved when a response is received
    return new Promise<SendMessageResult>((resolve, reject) => {
      // Set timeout for request
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Request timed out after ${options?.ttl ?? this.messagingConfig.defaultTtl}ms`));
      }, options?.ttl ?? this.messagingConfig.defaultTtl);
      
      // Store the promise resolvers
      this.pendingRequests.set(message.id, {
        resolve,
        reject,
        timeout
      });
      
      // Send the message
      this.sendMessage(recipientId, MessageType.REQUEST, content, options)
        .then(result => {
          // If sending fails, reject the promise
          if (!result.success) {
            clearTimeout(timeout);
            this.pendingRequests.delete(message.id);
            reject(new Error(result.error));
          }
        })
        .catch(error => {
          clearTimeout(timeout);
          this.pendingRequests.delete(message.id);
          reject(error);
        });
    });
  }

  /**
   * Send a response message to another agent
   */
  async sendResponseMessage(
    recipientId: string,
    inReplyTo: string,
    success: boolean,
    data?: unknown,
    error?: string,
    options?: SendMessageOptions
  ): Promise<SendMessageResult> {
    // Create response content
    const content = {
      success,
      data,
      error
    };
    
    // Make sure inReplyTo is set in options
    const responseOptions: SendMessageOptions = {
      ...options,
      inReplyTo,
    };
    
    // Send the response
    return this.sendMessage(recipientId, MessageType.RESPONSE, content, responseOptions);
  }

  /**
   * Register a handler to process incoming messages
   */
  async registerHandler(
    filter: MessageFilter,
    handler: MessageHandler
  ): Promise<string> {
    // Create handler ID
    const handlerId = uuidv4();
    
    // Store the handler registration
    if (!DefaultAgentMessagingSystem.handlerRegistry[this.messagingConfig.agentId]) {
      DefaultAgentMessagingSystem.handlerRegistry[this.messagingConfig.agentId] = {};
    }
    
    DefaultAgentMessagingSystem.handlerRegistry[this.messagingConfig.agentId][handlerId] = {
      id: handlerId,
      filter,
      handler
    };
    
    return handlerId;
  }

  /**
   * Unregister a previously registered handler
   */
  async unregisterHandler(handlerId: string): Promise<boolean> {
    // Check if handler exists
    if (
      !DefaultAgentMessagingSystem.handlerRegistry[this.messagingConfig.agentId] ||
      !DefaultAgentMessagingSystem.handlerRegistry[this.messagingConfig.agentId][handlerId]
    ) {
      return false;
    }
    
    // Remove the handler
    delete DefaultAgentMessagingSystem.handlerRegistry[this.messagingConfig.agentId][handlerId];
    return true;
  }

  /**
   * Get recent messages matching a filter
   */
  async getMessages(
    filter: MessageFilter,
    limit?: number
  ): Promise<AgentMessage[]> {
    // Get messages for this agent
    const agentMessages = DefaultAgentMessagingSystem.messageStore[this.messagingConfig.agentId] || [];
    
    // Filter messages
    const filteredMessages = agentMessages.filter(message => {
      if (filter.senderId && filter.senderId !== message.senderId) return false;
      if (filter.recipientId && filter.recipientId !== message.recipientId) return false;
      if (filter.type && filter.type !== message.type) return false;
      if (filter.priority && filter.priority !== message.priority) return false;
      if (filter.securityLevel && filter.securityLevel !== message.securityLevel) return false;
      if (filter.status && filter.status !== message.status) return false;
      if (filter.threadId && filter.threadId !== message.threadId) return false;
      if (filter.inReplyTo && filter.inReplyTo !== message.inReplyTo) return false;
      if (filter.startTime && message.timestamp < filter.startTime) return false;
      if (filter.endTime && message.timestamp > filter.endTime) return false;
      
      return true;
    });
    
    // Sort by timestamp (newest first)
    const sortedMessages = filteredMessages.sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
    
    // Apply limit if specified
    return limit ? sortedMessages.slice(0, limit) : sortedMessages;
  }

  /**
   * Get the current status of a message
   */
  async getMessageStatus(messageId: string): Promise<MessageStatus> {
    // Find the message in the store
    const allMessages = DefaultAgentMessagingSystem.centralMessageLog;
    const message = allMessages.find(msg => msg.id === messageId);
    
    if (!message) {
      throw new Error(`Message with ID ${messageId} not found`);
    }
    
    return message.status;
  }

  /**
   * Subscribe to a topic or channel
   */
  async subscribe(
    topic: string,
    filter?: MessageFilter
  ): Promise<string> {
    // Create subscription ID
    const subscriptionId = uuidv4();
    
    // Create subscription
    const subscription: MessageSubscription = {
      id: subscriptionId,
      topic,
      subscriberId: this.messagingConfig.agentId,
      filter
    };
    
    // Initialize topic if not exists
    if (!DefaultAgentMessagingSystem.subscriptions[topic]) {
      DefaultAgentMessagingSystem.subscriptions[topic] = [];
    }
    
    // Add subscription
    DefaultAgentMessagingSystem.subscriptions[topic].push(subscription);
    
    // Register handler for this subscription
    await this.registerHandler(
      { ...(filter || {}), recipientId: this.messagingConfig.agentId },
      async (message: AgentMessage) => {
        // Handler will be called for messages matching this filter
      }
    );
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from a topic or channel
   */
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    // Find the subscription
    let found = false;
    
    // Check all topics
    for (const topic in DefaultAgentMessagingSystem.subscriptions) {
      const subscriptions = DefaultAgentMessagingSystem.subscriptions[topic];
      const index = subscriptions.findIndex(sub => 
        sub.id === subscriptionId && sub.subscriberId === this.messagingConfig.agentId
      );
      
      if (index >= 0) {
        // Remove the subscription
        subscriptions.splice(index, 1);
        found = true;
        break;
      }
    }
    
    return found;
  }

  /**
   * Get all message threads for this agent
   */
  async getMessageThreads(limit?: number): Promise<Record<string, AgentMessage[]>> {
    // Get all messages for this agent
    const agentMessages = DefaultAgentMessagingSystem.messageStore[this.messagingConfig.agentId] || [];
    
    // Group by thread ID
    const threads: Record<string, AgentMessage[]> = {};
    
    for (const message of agentMessages) {
      if (!message.threadId) continue;
      
      if (!threads[message.threadId]) {
        threads[message.threadId] = [];
      }
      
      threads[message.threadId].push(message);
    }
    
    // Sort messages in each thread
    for (const threadId in threads) {
      threads[threadId].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    
    // Get thread IDs sorted by latest message
    const threadIds = Object.keys(threads).sort((a, b) => {
      const lastMessageA = threads[a][threads[a].length - 1];
      const lastMessageB = threads[b][threads[b].length - 1];
      return lastMessageB.timestamp.getTime() - lastMessageA.timestamp.getTime();
    });
    
    // Apply limit if specified
    const limitedThreadIds = limit ? threadIds.slice(0, limit) : threadIds;
    
    // Create result with limited threads
    const result: Record<string, AgentMessage[]> = {};
    for (const threadId of limitedThreadIds) {
      result[threadId] = threads[threadId];
    }
    
    return result;
  }
} 