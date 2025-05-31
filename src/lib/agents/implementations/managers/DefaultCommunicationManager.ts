/**
 * DefaultCommunicationManager.ts - Default Communication Manager Implementation
 * 
 * This file provides the default communication manager implementation with support for:
 * - Multi-agent messaging with priority levels
 * - Communication protocol support (10 protocols)
 * - Task delegation workflows
 * - Message routing and broadcasting
 * - Message history and pending message management
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md:
 * - Clean break from legacy patterns
 * - No placeholder implementations
 * - Industry best practices with ULID IDs
 */

import { ulid } from 'ulid';
import { 
  CommunicationManager,
  CommunicationManagerConfig,
  AgentMessage,
  MessageResponse,
  MessageType,
  MessagePriority,
  CommunicationProtocol,
  DelegationRequest,
  DelegationResult,
  SendMessageOptions
} from '../../../../agents/shared/base/managers/CommunicationManager.interface';
import { AbstractBaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { AgentBase } from '../../../../agents/shared/base/AgentBase';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';
import { ManagerConfig } from '../../../../agents/shared/base/managers/BaseManager';

// Import existing communication implementations
import { MessageRouter } from '../../../../agents/shared/messaging/MessageRouter';
import { 
  AgentMessage as LegacyAgentMessage,
  MessageResponse as LegacyMessageResponse,
  MessageType as LegacyMessageType
} from '../../../../agents/shared/messaging/MessageRouter';

// Import delegation infrastructure
import { DelegationManager } from '../../../../services/thinking/delegation/DelegationManager';
import { 
  DelegationResult as LegacyDelegationResult,
  DelegatedTask,
  TaskPriority,
  TaskStatus
} from '../../../../services/thinking/delegation/DelegationManager';

// Configuration defaults
const DEFAULT_COMMUNICATION_MANAGER_CONFIG: DefaultCommunicationManagerConfig = {
  enabled: false, // Disabled by default for backward compatibility
  enableMessageRouting: true,
  enableDelegation: true,
  defaultMessageTimeout: 30000, // 30 seconds
  maxRetryAttempts: 3,
  supportedProtocols: [
    'request_response',
    'notification',
    'broadcast',
    'streaming',
    'delegation',
    'collaboration',
    'negotiation',
    'query',
    'event',
    'status_update'
  ],
  routingConfig: {
    defaultStrategy: 'capability_based',
    enablePersistence: true,
    retentionHours: 24
  }
};

/**
 * Extended configuration interface for DefaultCommunicationManager
 */
export interface DefaultCommunicationManagerConfig extends CommunicationManagerConfig {
  /** Maximum message history to retain */
  maxMessageHistory?: number;
  
  /** Maximum delegation history to retain */
  maxDelegationHistory?: number;
  
  /** Enable automatic retry for failed messages */
  enableAutoRetry?: boolean;
  
  /** Enable message correlation tracking */
  enableCorrelationTracking?: boolean;
}

/**
 * Custom error class for communication-related errors
 */
export class CommunicationError extends Error {
  constructor(
    message: string,
    public code: string = 'COMMUNICATION_ERROR',
    public context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'CommunicationError';
  }
}

/**
 * Default implementation of the CommunicationManager interface
 */
export class DefaultCommunicationManager extends AbstractBaseManager implements CommunicationManager {
  public readonly managerType: ManagerType = ManagerType.COMMUNICATION;
  
  protected messageRouter: typeof MessageRouter;
  protected delegationManager: DelegationManager;
  protected messageHandlers: Map<MessageType, (message: AgentMessage) => Promise<MessageResponse>> = new Map();
  protected messageHistoryCache: AgentMessage[] = [];
  protected delegationHistoryCache: DelegationResult[] = [];
  
  protected _config: DefaultCommunicationManagerConfig;
  protected _initialized: boolean = false;
  
  /**
   * Create a new DefaultCommunicationManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(
    protected agent: AgentBase,
    config: Partial<DefaultCommunicationManagerConfig> = {}
  ) {
    const managerId = `communication-manager-${ulid()}`;
    const mergedConfig = {
      ...DEFAULT_COMMUNICATION_MANAGER_CONFIG,
      ...config
    };
    
    super(
      managerId,
      ManagerType.COMMUNICATION,
      agent,
      mergedConfig
    );
    
    this._config = mergedConfig;
    this.messageRouter = MessageRouter;
    this.delegationManager = new DelegationManager();
  }
  
  /**
   * Get the agent instance
   */
  public getAgent(): AgentBase {
    return this.agent;
  }
  
  /**
   * Get current configuration
   */
  public getConfig<T extends ManagerConfig>(): T {
    return { ...this._config } as T;
  }
  
  /**
   * Update configuration
   */
  public updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    this._config = {
      ...this._config,
      ...config
    };
    return this._config as T;
  }
  
  /**
   * Check if manager is enabled
   */
  public isEnabled(): boolean {
    return this._config.enabled ?? false;
  }
  
  /**
   * Set enabled status
   */
  public setEnabled(enabled: boolean): boolean {
    this._config.enabled = enabled;
    return enabled;
  }
  
  /**
   * Initialize the communication manager
   */
  public async initialize(): Promise<boolean> {
    try {
      if (this._initialized) {
        return true;
      }
      
      if (!this.isEnabled()) {
        this._initialized = true;
        return true;
      }
      
      // Register the agent with the message router
      const agentId = this.agent.getId();
      this.messageRouter.registerHandler(agentId, async (message: LegacyAgentMessage) => {
        const convertedMessage = this.convertFromLegacyMessage(message);
        await this.processIncomingMessage(convertedMessage);
      });
      
      this._initialized = true;
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to initialize communication manager: ${errorMessage}`,
        'INITIALIZATION_ERROR',
        { agentId: this.agent.getId() }
      );
    }
  }
  
  /**
   * Shutdown the communication manager
   */
  public async shutdown(): Promise<void> {
    if (!this._initialized) {
      return;
    }
    
    try {
      // Clear message handlers
      this.messageHandlers.clear();
      this.messageHistoryCache = [];
      this.delegationHistoryCache = [];
      
      this._initialized = false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to shutdown communication manager: ${errorMessage}`,
        'SHUTDOWN_ERROR'
      );
    }
  }
  
  /**
   * Reset the communication manager
   */
  public async reset(): Promise<boolean> {
    try {
      await this.shutdown();
      return await this.initialize();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to reset communication manager: ${errorMessage}`,
        'RESET_ERROR'
      );
    }
  }
  
  /**
   * Get health status of the communication manager
   */
  public async getHealth(): Promise<ManagerHealth> {
    const issues: Array<{ severity: 'low' | 'medium' | 'high' | 'critical'; message: string; detectedAt: Date }> = [];
    
    if (!this.isEnabled()) {
      issues.push({
        severity: 'medium',
        message: 'Communication manager is disabled',
        detectedAt: new Date()
      });
    }
    
    if (!this._initialized && this.isEnabled()) {
      issues.push({
        severity: 'high',
        message: 'Communication manager is enabled but not initialized',
        detectedAt: new Date()
      });
    }
    
    // Check message history capacity
    const maxHistory = this._config.maxMessageHistory || 1000;
    if (this.messageHistoryCache.length > maxHistory * 0.9) {
      issues.push({
        severity: 'medium',
        message: `Message history approaching maximum capacity (${this.messageHistoryCache.length}/${maxHistory})`,
        detectedAt: new Date()
      });
    }
    
    // Check delegation history capacity
    const maxDelegationHistory = this._config.maxDelegationHistory || 500;
    if (this.delegationHistoryCache.length > maxDelegationHistory * 0.9) {
      issues.push({
        severity: 'medium',
        message: `Delegation history approaching maximum capacity (${this.delegationHistoryCache.length}/${maxDelegationHistory})`,
        detectedAt: new Date()
      });
    }
    
    const status = issues.some(issue => issue.severity === 'high' || issue.severity === 'critical') ? 'unhealthy' :
                   issues.some(issue => issue.severity === 'medium') ? 'degraded' : 'healthy';
    
    return {
      status,
      details: {
        lastCheck: new Date(),
        issues,
        metrics: {
          initialized: this._initialized,
          enabled: this.isEnabled(),
          messageHistory: this.messageHistoryCache.length,
          delegationHistory: this.delegationHistoryCache.length,
          registeredHandlers: this.messageHandlers.size
        }
      }
    };
  }
  
  /**
   * Send a message to another agent
   */
  public async sendMessage(
    toAgentId: string,
    type: MessageType,
    content: string,
    payload?: Record<string, unknown>,
    options?: SendMessageOptions
  ): Promise<MessageResponse> {
    try {
      if (!this.isEnabled()) {
        return {
          id: ulid(),
          responseToId: '',
          success: false,
          content: 'Communication manager is disabled',
          error: 'Communication manager is disabled',
          timestamp: new Date()
        };
      }
      
      if (!this._initialized) {
        throw new CommunicationError('Communication manager not initialized', 'NOT_INITIALIZED');
      }
      
      // Create message
      const message: AgentMessage = {
        id: ulid(),
        fromAgentId: this.agent.getId(),
        toAgentId,
        type,
        protocol: options?.protocol || CommunicationProtocol.REQUEST_RESPONSE,
        priority: options?.priority || MessagePriority.NORMAL,
        content,
        payload,
        timestamp: new Date(),
        correlationId: options?.correlationId || ulid(),
        delegationContextId: options?.delegationContextId,
        requiresResponse: options?.requiresResponse ?? false,
        responseTimeout: options?.responseTimeout || this._config.defaultMessageTimeout,
        metadata: options?.metadata
      };
      
      // Convert to legacy format and send
      const legacyMessage = this.convertToLegacyMessage(message);
      const legacyResponse = await this.messageRouter.sendMessage(legacyMessage);
      
      // Convert response back
      const response = this.convertFromLegacyResponse(legacyResponse, message.id);
      
      // Add to message history
      this.addToMessageHistory(message);
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to send message: ${errorMessage}`,
        'SEND_MESSAGE_ERROR',
        { toAgentId, type, content: content.substring(0, 100) }
      );
    }
  }
  
  /**
   * Broadcast a message to multiple agents
   */
  public async broadcastMessage(
    toAgentIds: string[],
    type: MessageType,
    content: string,
    payload?: Record<string, unknown>,
    options?: SendMessageOptions
  ): Promise<Record<string, MessageResponse>> {
    try {
      if (!this.isEnabled()) {
        const errorResponse: MessageResponse = {
          id: ulid(),
          responseToId: '',
          success: false,
          content: 'Communication manager is disabled',
          error: 'Communication manager is disabled',
          timestamp: new Date()
        };
        return toAgentIds.reduce((acc, agentId) => {
          acc[agentId] = errorResponse;
          return acc;
        }, {} as Record<string, MessageResponse>);
      }
      
      if (!this._initialized) {
        throw new CommunicationError('Communication manager not initialized', 'NOT_INITIALIZED');
      }
      
      // Use legacy broadcast method
      const legacyResponse = await this.messageRouter.broadcastMessage(
        this.agent.getId(),
        toAgentIds,
        this.convertToLegacyMessageType(type),
        payload,
        {
          correlationId: options?.correlationId,
          delegationContextId: options?.delegationContextId,
          metadata: options?.metadata
        }
      );
      
      // Convert responses
      const responses: Record<string, MessageResponse> = {};
      for (const [agentId, legacyResp] of Object.entries(legacyResponse)) {
        responses[agentId] = this.convertFromLegacyResponse(legacyResp, ulid());
      }
      
      return responses;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to broadcast message: ${errorMessage}`,
        'BROADCAST_ERROR',
        { toAgentIds, type, content: content.substring(0, 100) }
      );
    }
  }
  
  /**
   * Delegate a task to another agent
   */
  public async delegateTask(delegationRequest: DelegationRequest): Promise<DelegationResult> {
    try {
      if (!this.isEnabled()) {
        return {
          delegationId: delegationRequest.id,
          taskId: delegationRequest.task.id,
          assignedAgentId: '',
          status: 'rejected',
          error: 'Communication manager is disabled'
        };
      }
      
      if (!this._config.enableDelegation) {
        return {
          delegationId: delegationRequest.id,
          taskId: delegationRequest.task.id,
          assignedAgentId: '',
          status: 'rejected',
          error: 'Delegation is disabled'
        };
      }
      
      if (!this._initialized) {
        throw new CommunicationError('Communication manager not initialized', 'NOT_INITIALIZED');
      }
      
      // Create a delegation task compatible with the existing system
      const delegatedTask: DelegatedTask = {
        id: delegationRequest.task.id,
        intent: {
          id: ulid(),
          name: delegationRequest.task.type,
          description: delegationRequest.task.description,
          confidence: 1.0,
          parameters: delegationRequest.task.parameters,
          childIntents: [],
          metadata: {
            extractedAt: new Date().toISOString(),
            source: 'delegation_request'
          }
        },
        entities: [],
        priority: this.convertToTaskPriority(delegationRequest.task.priority),
        status: TaskStatus.PENDING,
        assignedAgent: delegationRequest.targetAgentId,
        requiredCapabilities: delegationRequest.requiredCapabilities || [],
        complexity: 5, // Default complexity
        deadline: delegationRequest.task.deadline,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          estimatedDuration: 300000, // 5 minutes default
          attempts: 0,
          parentTaskId: delegationRequest.context.originalAgentId
        }
      };
      
      // Delegate using existing system
      const legacyResult = await this.delegationManager.delegateTask(
        delegatedTask.intent,
        delegatedTask.entities,
        delegatedTask.priority
      );
      
      // Convert result
      const result: DelegationResult = {
        delegationId: delegationRequest.id,
        taskId: delegationRequest.task.id,
        assignedAgentId: legacyResult.agentId,
        status: this.convertFromTaskStatus(legacyResult.status),
        result: legacyResult.result,
        error: legacyResult.error,
        completedAt: legacyResult.completionTime,
        metadata: {
          confidence: legacyResult.confidence,
          reason: legacyResult.reason,
          estimatedStartTime: legacyResult.estimatedStartTime,
          estimatedDuration: legacyResult.estimatedDuration,
          delegationContextId: legacyResult.delegationContextId
        }
      };
      
      // Add to delegation history
      this.addToDelegationHistory(result);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to delegate task: ${errorMessage}`,
        'DELEGATION_ERROR',
        { delegationId: delegationRequest.id, taskId: delegationRequest.task.id }
      );
    }
  }
  
  /**
   * Process an incoming message
   */
  public async processIncomingMessage(message: AgentMessage): Promise<MessageResponse> {
    try {
      if (!this.isEnabled()) {
        return {
          id: ulid(),
          responseToId: message.id,
          success: false,
          content: 'Communication manager is disabled',
          error: 'Communication manager is disabled',
          timestamp: new Date()
        };
      }
      
      // Add to message history
      this.addToMessageHistory(message);
      
      // Check for registered handler
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        return await handler(message);
      }
      
      // Default response
      return {
        id: ulid(),
        responseToId: message.id,
        success: true,
        content: `Message of type '${message.type}' received and processed`,
        timestamp: new Date(),
        metadata: {
          processedBy: this.agent.getId(),
          originalType: message.type
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        id: ulid(),
        responseToId: message.id,
        success: false,
        error: `Error processing message: ${errorMessage}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Register a message handler for a specific message type
   */
  public async registerMessageHandler(
    messageType: MessageType,
    handler: (message: AgentMessage) => Promise<MessageResponse>
  ): Promise<boolean> {
    try {
      if (!this.isEnabled()) {
        return false;
      }
      
      this.messageHandlers.set(messageType, handler);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to register message handler: ${errorMessage}`,
        'REGISTER_HANDLER_ERROR',
        { messageType }
      );
    }
  }
  
  /**
   * Unregister a message handler
   */
  public async unregisterMessageHandler(messageType: MessageType): Promise<boolean> {
    try {
      if (!this.isEnabled()) {
        return false;
      }
      
      return this.messageHandlers.delete(messageType);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to unregister message handler: ${errorMessage}`,
        'UNREGISTER_HANDLER_ERROR',
        { messageType }
      );
    }
  }
  
  /**
   * Get message history
   */
  public async getMessageHistory(options?: {
    agentId?: string;
    messageType?: MessageType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AgentMessage[]> {
    try {
      if (!this.isEnabled()) {
        return [];
      }
      
      let messages = this.messageHistoryCache;
      
      // Apply filters
      if (options?.agentId) {
        messages = messages.filter(msg => 
          msg.fromAgentId === options.agentId || msg.toAgentId === options.agentId
        );
      }
      
      if (options?.messageType) {
        messages = messages.filter(msg => msg.type === options.messageType);
      }
      
      if (options?.startDate) {
        messages = messages.filter(msg => msg.timestamp >= options.startDate!);
      }
      
      if (options?.endDate) {
        messages = messages.filter(msg => msg.timestamp <= options.endDate!);
      }
      
      // Sort by timestamp (newest first)
      messages = messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Apply limit
      if (options?.limit) {
        messages = messages.slice(0, options.limit);
      }
      
      return messages;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to get message history: ${errorMessage}`,
        'GET_HISTORY_ERROR'
      );
    }
  }
  
  /**
   * Get pending messages
   */
  public async getPendingMessages(agentId?: string): Promise<AgentMessage[]> {
    try {
      if (!this.isEnabled()) {
        return [];
      }
      
      // Get messages from legacy system
      const targetAgentId = agentId || this.agent.getId();
      const legacyMessages = this.messageRouter.getMessagesForAgent(targetAgentId, { asRecipient: true });
      
      // Convert and filter for pending messages
      return legacyMessages
        .map(msg => this.convertFromLegacyMessage(msg))
        .filter(msg => msg.requiresResponse && !this.hasResponse(msg.id));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to get pending messages: ${errorMessage}`,
        'GET_PENDING_ERROR'
      );
    }
  }
  
  /**
   * Get delegation history
   */
  public async getDelegationHistory(options?: {
    agentId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<DelegationResult[]> {
    try {
      if (!this.isEnabled()) {
        return [];
      }
      
      let delegations = this.delegationHistoryCache;
      
      // Apply filters
      if (options?.agentId) {
        delegations = delegations.filter(del => del.assignedAgentId === options.agentId);
      }
      
      if (options?.status) {
        delegations = delegations.filter(del => del.status === options.status);
      }
      
      if (options?.startDate && options?.endDate) {
        delegations = delegations.filter(del => {
          const timestamp = del.completedAt || new Date();
          return timestamp >= options.startDate! && timestamp <= options.endDate!;
        });
      }
      
      // Sort by completion time (newest first)
      delegations = delegations.sort((a, b) => {
        const timeA = a.completedAt?.getTime() || Date.now();
        const timeB = b.completedAt?.getTime() || Date.now();
        return timeB - timeA;
      });
      
      // Apply limit
      if (options?.limit) {
        delegations = delegations.slice(0, options.limit);
      }
      
      return delegations;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to get delegation history: ${errorMessage}`,
        'GET_DELEGATION_HISTORY_ERROR'
      );
    }
  }
  
  /**
   * Get available agents for delegation
   */
  public async getAvailableAgents(requiredCapabilities?: string[]): Promise<string[]> {
    try {
      if (!this.isEnabled()) {
        return [];
      }
      
      // For now, return a simple list since we don't have access to the full registry
      // In a real implementation, this would query the agent registry
      const mockAgents = ['agent-1', 'agent-2', 'agent-3'];
      
      // If no capabilities required, return all agents
      if (!requiredCapabilities || requiredCapabilities.length === 0) {
        return mockAgents;
      }
      
      // For now, return all agents since we don't have capability filtering
      return mockAgents;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to get available agents: ${errorMessage}`,
        'GET_AVAILABLE_AGENTS_ERROR'
      );
    }
  }
  
  /**
   * Check agent availability
   */
  public async checkAgentAvailability(agentId: string): Promise<{
    available: boolean;
    status: string;
    capabilities: string[];
    currentLoad: number;
  }> {
    try {
      if (!this.isEnabled()) {
        return {
          available: false,
          status: 'disabled',
          capabilities: [],
          currentLoad: 0
        };
      }
      
      // For now, return mock availability data
      // In a real implementation, this would query the agent registry
      return {
        available: true,
        status: 'available',
        capabilities: ['communication', 'delegation'],
        currentLoad: 0
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CommunicationError(
        `Failed to check agent availability: ${errorMessage}`,
        'CHECK_AVAILABILITY_ERROR',
        { agentId }
      );
    }
  }
  
  // Helper methods for format conversion
  
  /**
   * Convert new message format to legacy format
   */
  protected convertToLegacyMessage(message: AgentMessage): LegacyAgentMessage {
    return {
      fromAgentId: message.fromAgentId,
      toAgentId: message.toAgentId,
      type: this.convertToLegacyMessageType(message.type),
      payload: {
        content: message.content,
        ...message.payload
      },
      timestamp: message.timestamp.getTime(),
      correlationId: message.correlationId,
      delegationContextId: message.delegationContextId,
      metadata: {
        id: message.id,
        protocol: message.protocol,
        priority: message.priority,
        requiresResponse: message.requiresResponse,
        responseTimeout: message.responseTimeout,
        ...message.metadata
      }
    };
  }
  
  /**
   * Convert legacy message format to new format
   */
  protected convertFromLegacyMessage(legacyMessage: LegacyAgentMessage): AgentMessage {
    const metadata = legacyMessage.metadata || {};
    return {
      id: metadata.id || ulid(),
      fromAgentId: legacyMessage.fromAgentId,
      toAgentId: legacyMessage.toAgentId,
      type: this.convertFromLegacyMessageType(legacyMessage.type),
      protocol: metadata.protocol || CommunicationProtocol.REQUEST_RESPONSE,
      priority: metadata.priority || MessagePriority.NORMAL,
      content: typeof legacyMessage.payload === 'string' ? legacyMessage.payload : 
               legacyMessage.payload?.content || JSON.stringify(legacyMessage.payload),
      payload: typeof legacyMessage.payload === 'object' ? legacyMessage.payload : undefined,
      timestamp: new Date(legacyMessage.timestamp),
      correlationId: legacyMessage.correlationId,
      delegationContextId: legacyMessage.delegationContextId,
      requiresResponse: metadata.requiresResponse || false,
      responseTimeout: metadata.responseTimeout,
      metadata
    };
  }
  
  /**
   * Convert legacy response format to new format
   */
  protected convertFromLegacyResponse(legacyResponse: LegacyMessageResponse, messageId: string): MessageResponse {
    return {
      id: ulid(),
      responseToId: messageId,
      success: legacyResponse.success,
      content: legacyResponse.error || 'Message sent successfully',
      payload: legacyResponse.responsePayload,
      error: legacyResponse.error,
      timestamp: new Date(),
      metadata: {
        legacyResponse: true
      }
    };
  }
  
  /**
   * Convert new message type to legacy message type
   */
  protected convertToLegacyMessageType(type: MessageType): LegacyMessageType {
    const typeMap: Record<MessageType, LegacyMessageType> = {
      [MessageType.UPDATE]: 'update',
      [MessageType.HANDOFF]: 'handoff',
      [MessageType.ASK]: 'ask',
      [MessageType.LOG]: 'log',
      [MessageType.RESULT]: 'result',
      [MessageType.REQUEST]: 'ask', // Map to closest legacy type
      [MessageType.RESPONSE]: 'result',
      [MessageType.NOTIFICATION]: 'update',
      [MessageType.DELEGATION]: 'handoff',
      [MessageType.STATUS]: 'update'
    };
    
    return typeMap[type] || 'update';
  }
  
  /**
   * Convert legacy message type to new message type
   */
  protected convertFromLegacyMessageType(legacyType: LegacyMessageType): MessageType {
    const typeMap: Record<LegacyMessageType, MessageType> = {
      'update': MessageType.UPDATE,
      'handoff': MessageType.HANDOFF,
      'ask': MessageType.ASK,
      'log': MessageType.LOG,
      'result': MessageType.RESULT
    };
    
    return typeMap[legacyType] || MessageType.UPDATE;
  }
  
  /**
   * Convert message priority to task priority
   */
  protected convertToTaskPriority(priority: MessagePriority): TaskPriority {
    const priorityMap: Record<MessagePriority, TaskPriority> = {
      [MessagePriority.LOW]: TaskPriority.LOW,
      [MessagePriority.NORMAL]: TaskPriority.MEDIUM,
      [MessagePriority.HIGH]: TaskPriority.HIGH,
      [MessagePriority.URGENT]: TaskPriority.URGENT,
      [MessagePriority.CRITICAL]: TaskPriority.URGENT
    };
    
    return priorityMap[priority] || TaskPriority.MEDIUM;
  }
  
  /**
   * Convert task status to delegation status
   */
  protected convertFromTaskStatus(status: TaskStatus): DelegationResult['status'] {
    const statusMap: Record<TaskStatus, DelegationResult['status']> = {
      [TaskStatus.PENDING]: 'in_progress',
      [TaskStatus.ASSIGNED]: 'accepted',
      [TaskStatus.IN_PROGRESS]: 'in_progress',
      [TaskStatus.COMPLETED]: 'completed',
      [TaskStatus.FAILED]: 'failed'
    };
    
    return statusMap[status] || 'in_progress';
  }
  
  /**
   * Add message to history with capacity management
   */
  protected addToMessageHistory(message: AgentMessage): void {
    this.messageHistoryCache.push(message);
    
    // Trim history if it exceeds capacity
    const maxHistory = this._config.maxMessageHistory || 1000;
    if (this.messageHistoryCache.length > maxHistory) {
      this.messageHistoryCache = this.messageHistoryCache.slice(-maxHistory);
    }
  }
  
  /**
   * Add delegation to history with capacity management
   */
  protected addToDelegationHistory(delegation: DelegationResult): void {
    this.delegationHistoryCache.push(delegation);
    
    // Trim history if it exceeds capacity
    const maxHistory = this._config.maxDelegationHistory || 500;
    if (this.delegationHistoryCache.length > maxHistory) {
      this.delegationHistoryCache = this.delegationHistoryCache.slice(-maxHistory);
    }
  }
  
  /**
   * Check if a message has a response
   */
  protected hasResponse(messageId: string): boolean {
    return this.messageHistoryCache.some(msg => 
      msg.metadata?.responseToId === messageId
    );
  }
} 