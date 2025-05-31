/**
 * CommunicationManager.interface.ts - Communication Manager Interface
 * 
 * This file defines the communication manager interface that handles multi-agent
 * communication, messaging protocols, and delegation workflows.
 */

import { BaseManager, ManagerConfig } from './BaseManager';

/**
 * Configuration for the communication manager
 */
export interface CommunicationManagerConfig extends ManagerConfig {
  /** Whether to enable message routing */
  enableMessageRouting?: boolean;
  
  /** Whether to enable delegation protocols */
  enableDelegation?: boolean;
  
  /** Default message timeout in milliseconds */
  defaultMessageTimeout?: number;
  
  /** Maximum retry attempts for failed messages */
  maxRetryAttempts?: number;
  
  /** Supported communication protocols */
  supportedProtocols?: string[];
  
  /** Message routing configuration */
  routingConfig?: {
    /** Default routing strategy */
    defaultStrategy?: 'direct' | 'capability_based' | 'load_balanced';
    
    /** Whether to enable message persistence */
    enablePersistence?: boolean;
    
    /** Message retention period in hours */
    retentionHours?: number;
  };
}

/**
 * Message types for agent communication
 */
export enum MessageType {
  UPDATE = 'update',
  HANDOFF = 'handoff',
  ASK = 'ask',
  LOG = 'log',
  RESULT = 'result',
  REQUEST = 'request',
  RESPONSE = 'response',
  NOTIFICATION = 'notification',
  DELEGATION = 'delegation',
  STATUS = 'status'
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical'
}

/**
 * Communication protocol types
 */
export enum CommunicationProtocol {
  REQUEST_RESPONSE = 'request_response',
  NOTIFICATION = 'notification',
  BROADCAST = 'broadcast',
  STREAMING = 'streaming',
  DELEGATION = 'delegation',
  COLLABORATION = 'collaboration',
  NEGOTIATION = 'negotiation',
  QUERY = 'query',
  EVENT = 'event',
  STATUS_UPDATE = 'status_update'
}

/**
 * Agent message interface
 */
export interface AgentMessage {
  /** Message ID */
  id: string;
  
  /** Sender agent ID */
  fromAgentId: string;
  
  /** Recipient agent ID */
  toAgentId: string;
  
  /** Message type */
  type: MessageType;
  
  /** Message protocol */
  protocol: CommunicationProtocol;
  
  /** Message priority */
  priority: MessagePriority;
  
  /** Message content */
  content: string;
  
  /** Message payload */
  payload?: Record<string, unknown>;
  
  /** Message timestamp */
  timestamp: Date;
  
  /** Correlation ID for related messages */
  correlationId?: string;
  
  /** Delegation context ID */
  delegationContextId?: string;
  
  /** Whether response is required */
  requiresResponse: boolean;
  
  /** Response timeout in milliseconds */
  responseTimeout?: number;
  
  /** Message metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message response interface
 */
export interface MessageResponse {
  /** Response ID */
  id: string;
  
  /** Original message ID being responded to */
  responseToId: string;
  
  /** Whether the response indicates success */
  success: boolean;
  
  /** Response content */
  content?: string;
  
  /** Response payload */
  payload?: Record<string, unknown>;
  
  /** Error message (if unsuccessful) */
  error?: string;
  
  /** Response timestamp */
  timestamp: Date;
  
  /** Response metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Delegation request interface
 */
export interface DelegationRequest {
  /** Delegation ID */
  id: string;
  
  /** Task to delegate */
  task: {
    id: string;
    type: string;
    description: string;
    parameters: Record<string, unknown>;
    priority: MessagePriority;
    deadline?: Date;
  };
  
  /** Target agent ID (if specific) */
  targetAgentId?: string;
  
  /** Required capabilities */
  requiredCapabilities?: string[];
  
  /** Delegation context */
  context: {
    originalAgentId: string;
    reason: string;
    expectedOutcome: string;
  };
  
  /** Delegation metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Delegation result interface
 */
export interface DelegationResult {
  /** Delegation ID */
  delegationId: string;
  
  /** Task ID */
  taskId: string;
  
  /** Assigned agent ID */
  assignedAgentId: string;
  
  /** Result status */
  status: 'accepted' | 'rejected' | 'completed' | 'failed' | 'in_progress';
  
  /** Result content */
  result?: unknown;
  
  /** Error information (if failed) */
  error?: string;
  
  /** Completion timestamp */
  completedAt?: Date;
  
  /** Result metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  /** Message priority */
  priority?: MessagePriority;
  
  /** Communication protocol */
  protocol?: CommunicationProtocol;
  
  /** Whether response is required */
  requiresResponse?: boolean;
  
  /** Response timeout in milliseconds */
  responseTimeout?: number;
  
  /** Correlation ID */
  correlationId?: string;
  
  /** Delegation context ID */
  delegationContextId?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Communication manager interface
 */
export interface CommunicationManager extends BaseManager {
  /**
   * Send a message to another agent
   * 
   * @param toAgentId Target agent ID
   * @param type Message type
   * @param content Message content
   * @param payload Optional message payload
   * @param options Send options
   * @returns Promise resolving to message response
   */
  sendMessage(
    toAgentId: string,
    type: MessageType,
    content: string,
    payload?: Record<string, unknown>,
    options?: SendMessageOptions
  ): Promise<MessageResponse>;
  
  /**
   * Broadcast a message to multiple agents
   * 
   * @param toAgentIds Target agent IDs
   * @param type Message type
   * @param content Message content
   * @param payload Optional message payload
   * @param options Send options
   * @returns Promise resolving to map of agent ID to response
   */
  broadcastMessage(
    toAgentIds: string[],
    type: MessageType,
    content: string,
    payload?: Record<string, unknown>,
    options?: SendMessageOptions
  ): Promise<Record<string, MessageResponse>>;
  
  /**
   * Delegate a task to another agent
   * 
   * @param delegationRequest Delegation request details
   * @returns Promise resolving to delegation result
   */
  delegateTask(delegationRequest: DelegationRequest): Promise<DelegationResult>;
  
  /**
   * Process an incoming message
   * 
   * @param message Incoming message
   * @returns Promise resolving to message response
   */
  processIncomingMessage(message: AgentMessage): Promise<MessageResponse>;
  
  /**
   * Register a message handler for a specific message type
   * 
   * @param messageType Message type to handle
   * @param handler Handler function
   * @returns Promise resolving to success status
   */
  registerMessageHandler(
    messageType: MessageType,
    handler: (message: AgentMessage) => Promise<MessageResponse>
  ): Promise<boolean>;
  
  /**
   * Unregister a message handler
   * 
   * @param messageType Message type to unregister
   * @returns Promise resolving to success status
   */
  unregisterMessageHandler(messageType: MessageType): Promise<boolean>;
  
  /**
   * Get message history
   * 
   * @param options Filter options
   * @returns Promise resolving to message history
   */
  getMessageHistory(options?: {
    agentId?: string;
    messageType?: MessageType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AgentMessage[]>;
  
  /**
   * Get pending messages
   * 
   * @param agentId Optional agent ID to filter by
   * @returns Promise resolving to pending messages
   */
  getPendingMessages(agentId?: string): Promise<AgentMessage[]>;
  
  /**
   * Get delegation history
   * 
   * @param options Filter options
   * @returns Promise resolving to delegation history
   */
  getDelegationHistory(options?: {
    agentId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<DelegationResult[]>;
  
  /**
   * Get available agents for delegation
   * 
   * @param requiredCapabilities Required capabilities
   * @returns Promise resolving to available agent IDs
   */
  getAvailableAgents(requiredCapabilities?: string[]): Promise<string[]>;
  
  /**
   * Check agent availability
   * 
   * @param agentId Agent ID to check
   * @returns Promise resolving to availability status
   */
  checkAgentAvailability(agentId: string): Promise<{
    available: boolean;
    status: string;
    capabilities: string[];
    currentLoad: number;
  }>;
} 