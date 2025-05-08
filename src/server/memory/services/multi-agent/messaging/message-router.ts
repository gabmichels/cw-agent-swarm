/**
 * Message Router
 * 
 * This component is responsible for routing messages between agents based on their
 * capabilities, context, and message content. It implements smart routing logic and
 * delivers messages to appropriate recipients.
 */

import { v4 as uuidv4 } from 'uuid';
import { StructuredId } from '../../../../../utils/ulid';
import { AnyMemoryService } from '../../memory/memory-service-wrappers';
import { MemoryType } from '../../../config/types';
import { CapabilityRegistry } from '../../../../../agents/shared/capabilities/capability-registry';
import { CapabilityLevel, CapabilityType } from '../../../../../agents/shared/capabilities/types';

/**
 * Message routing priority levels
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Message routing strategies
 */
export enum RoutingStrategy {
  DIRECT = 'direct',          // Directly to specified agent
  CAPABILITY = 'capability',  // Based on agent capabilities
  BROADCAST = 'broadcast',    // To all agents in a group
  LOAD_BALANCED = 'load_balanced', // Based on agent availability
  CONTEXTUAL = 'contextual'   // Based on conversation context
}

/**
 * Message delivery status
 */
export enum DeliveryStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
  PROCESSING = 'processing',
  COMPLETED = 'completed'
}

/**
 * Routing metrics for an agent
 */
export interface AgentRoutingMetrics {
  agentId: string;
  activeTaskCount: number;
  averageResponseTime: number; // in milliseconds
  successRate: number; // 0.0 to 1.0
  lastActiveTimestamp: number;
}

/**
 * Message to be routed between agents
 */
export interface AgentMessage {
  id: string;
  senderId: string;
  recipientId?: string;
  chatId: string;
  content: string;
  timestamp: number;
  priority: MessagePriority;
  requiredCapabilities?: string[];
  routingStrategy: RoutingStrategy;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  deliveryStatus: DeliveryStatus;
  traceId?: string;
}

/**
 * Parameters for routing a message
 */
export interface RoutingParams {
  message: AgentMessage;
  strategy: RoutingStrategy;
  requiredCapabilities?: string[];
  preferredAgentIds?: string[];
  excludedAgentIds?: string[];
  priority?: MessagePriority;
  context?: Record<string, unknown>;
}

/**
 * Result of a routing operation
 */
export interface RoutingResult {
  success: boolean;
  messageId: string;
  recipientIds: string[];
  failedRecipientIds?: string[];
  errors?: Array<{
    code: string;
    message: string;
    agentId?: string;
  }>;
  traceId: string;
}

/**
 * Interface for message routing components
 */
export interface IMessageRouter {
  routeMessage(params: RoutingParams): Promise<RoutingResult>;
  
  getMessageStatus(messageId: string): Promise<DeliveryStatus>;
  
  getAgentQueue(agentId: string): Promise<AgentMessage[]>;
  
  retryFailedDelivery(messageId: string): Promise<RoutingResult>;
  
  getRoutingMetrics(agentId?: string): Promise<AgentRoutingMetrics[]>;
}

/**
 * Extended search memory params with sort option
 */
interface ExtendedSearchMemoryParams {
  type: MemoryType;
  filter?: Record<string, unknown>;
  limit?: number;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Message Router implementation
 */
export class MessageRouter implements IMessageRouter {
  // Define memory type constants for consistency
  private readonly MEMORY_TYPE_AGENT = 'agent' as MemoryType;
  private readonly MEMORY_TYPE_AGENT_ACTIVITY = 'agent_activity' as MemoryType;
  
  /**
   * Create a new message router
   */
  constructor(
    private readonly memoryService: AnyMemoryService,
    private readonly capabilityRegistry: CapabilityRegistry
  ) {}
  
  /**
   * Route a message to appropriate recipients based on strategy
   */
  async routeMessage(params: RoutingParams): Promise<RoutingResult> {
    try {
      // Generate unique message ID and trace ID if not provided
      const messageId = params.message.id || uuidv4();
      const traceId = params.message.traceId || uuidv4();
      
      // Create standardized message
      const message: AgentMessage = {
        ...params.message,
        id: messageId,
        priority: params.priority || MessagePriority.NORMAL,
        routingStrategy: params.strategy,
        requiredCapabilities: params.requiredCapabilities,
        context: params.context || {},
        timestamp: Date.now(),
        deliveryStatus: DeliveryStatus.PENDING,
        traceId
      };
      
      // Determine recipient agents based on strategy
      const recipientIds = await this.determineRecipients(params);
      
      if (recipientIds.length === 0) {
        return {
          success: false,
          messageId,
          recipientIds: [],
          errors: [{
            code: 'NO_RECIPIENTS',
            message: 'No suitable recipients found for the message'
          }],
          traceId
        };
      }
      
      // Deliver message to each recipient
      const deliveryResults = await Promise.all(
        recipientIds.map(recipientId => this.deliverMessage(message, recipientId))
      );
      
      // Aggregate delivery results
      const successfulDeliveries = deliveryResults.filter(result => result.success);
      const failedDeliveries = deliveryResults.filter(result => !result.success);
      
      return {
        success: successfulDeliveries.length > 0,
        messageId,
        recipientIds: successfulDeliveries.map(result => result.recipientId),
        failedRecipientIds: failedDeliveries.map(result => result.recipientId),
        errors: failedDeliveries.map(result => ({
          code: result.errorCode || 'DELIVERY_FAILED',
          message: result.errorMessage || 'Failed to deliver message',
          agentId: result.recipientId
        })),
        traceId
      };
    } catch (error) {
      console.error('Error routing message:', error);
      return {
        success: false,
        messageId: params.message.id || 'unknown',
        recipientIds: [],
        errors: [{
          code: 'ROUTING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown routing error'
        }],
        traceId: params.message.traceId || 'unknown'
      };
    }
  }
  
  /**
   * Get the current status of a message
   */
  async getMessageStatus(messageId: string): Promise<DeliveryStatus> {
    try {
      // Search for the message
      const messages = await this.memoryService.searchMemories({
        type: MemoryType.MESSAGE,
        filter: { id: messageId }
      });
      
      if (messages.length === 0) {
        throw new Error(`Message not found: ${messageId}`);
      }
      
      // Extract status from message metadata
      const message = messages[0];
      const metadata = message.payload.metadata as unknown as Record<string, unknown>;
      return (metadata.deliveryStatus as DeliveryStatus) || DeliveryStatus.PENDING;
    } catch (error) {
      console.error(`Error getting message status for ${messageId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get the current message queue for an agent
   */
  async getAgentQueue(agentId: string): Promise<AgentMessage[]> {
    try {
      // Search for pending messages for the agent
      const messages = await this.memoryService.searchMemories({
        type: MemoryType.MESSAGE,
        filter: {
          recipientId: agentId,
          'metadata.deliveryStatus': DeliveryStatus.PENDING
        },
        sort: { field: 'timestamp', direction: 'asc' }
      } as ExtendedSearchMemoryParams);
      
      // Convert to AgentMessage format
      return messages.map(message => {
        const metadata = message.payload.metadata as unknown as Record<string, unknown>;
        return {
          id: message.id,
          senderId: metadata.senderId as string || '',
          recipientId: metadata.recipientId as string || '',
          chatId: metadata.chatId as string || '',
          content: message.payload.text || '',
          timestamp: (message as any).timestamp || Date.now(),
          priority: metadata.priority as MessagePriority || MessagePriority.NORMAL,
          requiredCapabilities: metadata.requiredCapabilities as string[] || [],
          routingStrategy: metadata.routingStrategy as RoutingStrategy || RoutingStrategy.DIRECT,
          context: metadata.context as Record<string, unknown> || {},
          metadata: metadata as unknown as Record<string, unknown>,
          deliveryStatus: metadata.deliveryStatus as DeliveryStatus || DeliveryStatus.PENDING,
          traceId: metadata.traceId as string || ''
        };
      });
    } catch (error) {
      console.error(`Error getting agent queue for ${agentId}:`, error);
      return [];
    }
  }
  
  /**
   * Retry delivery for a failed message
   */
  async retryFailedDelivery(messageId: string): Promise<RoutingResult> {
    try {
      // Get the message
      const messages = await this.memoryService.searchMemories({
        type: MemoryType.MESSAGE,
        filter: { id: messageId }
      });
      
      if (messages.length === 0) {
        throw new Error(`Message not found: ${messageId}`);
      }
      
      const message = messages[0];
      const metadata = message.payload.metadata as unknown as Record<string, unknown>;
      
      // Only retry failed messages
      if (metadata.deliveryStatus !== DeliveryStatus.FAILED) {
        throw new Error(`Cannot retry message with status: ${metadata.deliveryStatus}`);
      }
      
      // Convert to AgentMessage format
      const agentMessage: AgentMessage = {
        id: message.id,
        senderId: metadata.senderId as string || '',
        recipientId: metadata.recipientId as string || '',
        chatId: metadata.chatId as string || '',
        content: message.payload.text || '',
        timestamp: Date.now(), // Update timestamp for retry
        priority: metadata.priority as MessagePriority || MessagePriority.NORMAL,
        requiredCapabilities: metadata.requiredCapabilities as string[] || [],
        routingStrategy: metadata.routingStrategy as RoutingStrategy || RoutingStrategy.DIRECT,
        context: metadata.context as Record<string, unknown> || {},
        metadata: metadata as unknown as Record<string, unknown>,
        deliveryStatus: DeliveryStatus.PENDING, // Reset status
        traceId: metadata.traceId as string || ''
      };
      
      // Re-route the message
      return this.routeMessage({
        message: agentMessage,
        strategy: agentMessage.routingStrategy,
        requiredCapabilities: agentMessage.requiredCapabilities,
        context: agentMessage.context
      });
    } catch (error) {
      console.error(`Error retrying failed delivery for ${messageId}:`, error);
      return {
        success: false,
        messageId,
        recipientIds: [],
        errors: [{
          code: 'RETRY_FAILED',
          message: error instanceof Error ? error.message : 'Unknown retry error'
        }],
        traceId: 'unknown'
      };
    }
  }
  
  /**
   * Get routing metrics for agents
   */
  async getRoutingMetrics(agentId?: string): Promise<AgentRoutingMetrics[]> {
    try {
      // If agentId is provided, get metrics for specific agent
      if (agentId) {
        return [await this.getAgentMetrics(agentId)];
      }
      
      // Otherwise, get all active agents and their metrics
      const activeAgents = await this.getActiveAgents();
      const metrics = await Promise.all(
        activeAgents.map(agent => this.getAgentMetrics(agent))
      );
      
      return metrics;
    } catch (error) {
      console.error('Error getting routing metrics:', error);
      return [];
    }
  }
  
  /**
   * Private: Determine recipients based on routing strategy
   */
  private async determineRecipients(params: RoutingParams): Promise<string[]> {
    const { strategy, message, requiredCapabilities, preferredAgentIds, excludedAgentIds } = params;
    
    switch (strategy) {
      case RoutingStrategy.DIRECT:
        // Direct routing to specified recipient
        if (!message.recipientId) {
          throw new Error('Recipient ID is required for direct routing');
        }
        return [message.recipientId];
        
      case RoutingStrategy.CAPABILITY:
        // Route based on agent capabilities
        if (!requiredCapabilities || requiredCapabilities.length === 0) {
          throw new Error('Required capabilities must be specified for capability-based routing');
        }
        return this.findAgentsByCapabilities(
          requiredCapabilities, 
          preferredAgentIds, 
          excludedAgentIds
        );
        
      case RoutingStrategy.BROADCAST:
        // Broadcast to all agents in the chat
        const chatParticipants = await this.getChatParticipants(message.chatId);
        return chatParticipants.filter(id => 
          id !== message.senderId && // Don't send to self
          (!excludedAgentIds || !excludedAgentIds.includes(id)) // Respect exclusions
        );
        
      case RoutingStrategy.LOAD_BALANCED:
        // Route based on agent load and availability
        return this.findLeastLoadedAgents(
          requiredCapabilities, 
          preferredAgentIds, 
          excludedAgentIds
        );
        
      case RoutingStrategy.CONTEXTUAL:
        // Route based on conversation context and history
        return this.findAgentsByContext(
          message.chatId,
          message.context || {},
          requiredCapabilities,
          preferredAgentIds,
          excludedAgentIds
        );
        
      default:
        throw new Error(`Unsupported routing strategy: ${strategy}`);
    }
  }
  
  /**
   * Private: Deliver message to a specific recipient
   */
  private async deliverMessage(
    message: AgentMessage, 
    recipientId: string
  ): Promise<{
    success: boolean;
    recipientId: string;
    errorCode?: string;
    errorMessage?: string;
  }> {
    try {
      // Create a copy of the message with the specific recipient
      const deliveryMessage: AgentMessage = {
        ...message,
        recipientId
      };
      
      // Store in memory system
      await this.memoryService.addMemory({
        type: MemoryType.MESSAGE,
        content: message.content,
        metadata: {
          ...deliveryMessage,
          messageType: 'agent-communication'
        }
      });
      
      // In a real implementation, this would notify the agent
      // For now, we'll just mark it as delivered
      
      return {
        success: true,
        recipientId
      };
    } catch (error) {
      console.error(`Error delivering message to ${recipientId}:`, error);
      return {
        success: false,
        recipientId,
        errorCode: 'DELIVERY_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown delivery error'
      };
    }
  }
  
  /**
   * Private: Find agents with specific capabilities
   */
  private async findAgentsByCapabilities(
    capabilities: string[], 
    preferredAgents?: string[],
    excludedAgents?: string[]
  ): Promise<string[]> {
    // Get all agents with required capabilities
    const qualifiedAgents: string[] = [];
    
    // For each capability, find agents that have it
    for (const capability of capabilities) {
      const agents = await this.capabilityRegistry.findProviders(capability);
      
      // First time, just add all agents
      if (qualifiedAgents.length === 0) {
        qualifiedAgents.push(...agents);
      } else {
        // Only keep agents that have all required capabilities
        for (let i = qualifiedAgents.length - 1; i >= 0; i--) {
          if (!agents.includes(qualifiedAgents[i])) {
            qualifiedAgents.splice(i, 1);
          }
        }
      }
    }
    
    // Apply filters for preferred and excluded agents
    return this.filterAgentList(qualifiedAgents, preferredAgents, excludedAgents);
  }
  
  /**
   * Private: Find least loaded agents that match capabilities
   */
  private async findLeastLoadedAgents(
    capabilities?: string[],
    preferredAgents?: string[],
    excludedAgents?: string[]
  ): Promise<string[]> {
    // First find agents with required capabilities (if any)
    let candidateAgents: string[];
    
    if (capabilities && capabilities.length > 0) {
      candidateAgents = await this.findAgentsByCapabilities(
        capabilities, preferredAgents, excludedAgents
      );
    } else {
      // Get all active agents
      candidateAgents = await this.getActiveAgents();
      
      // Apply filters
      candidateAgents = this.filterAgentList(
        candidateAgents, preferredAgents, excludedAgents
      );
    }
    
    // If no candidates, return empty list
    if (candidateAgents.length === 0) {
      return [];
    }
    
    // Get metrics for candidate agents
    const metrics = await Promise.all(
      candidateAgents.map(agentId => this.getAgentMetrics(agentId))
    );
    
    // Sort by load (active task count and response time)
    metrics.sort((a, b) => {
      // Primary sort by task count
      if (a.activeTaskCount !== b.activeTaskCount) {
        return a.activeTaskCount - b.activeTaskCount;
      }
      // Secondary sort by response time
      return a.averageResponseTime - b.averageResponseTime;
    });
    
    // Return agent IDs in order of load
    return metrics.map(m => m.agentId);
  }
  
  /**
   * Private: Find agents based on conversation context
   */
  private async findAgentsByContext(
    chatId: string,
    context: Record<string, unknown>,
    requiredCapabilities?: string[],
    preferredAgents?: string[],
    excludedAgents?: string[]
  ): Promise<string[]> {
    // First, get participants who are already in the chat
    const participants = await this.getChatParticipants(chatId);
    
    // Filter out excluded agents
    let candidateAgents = this.filterAgentList(
      participants, preferredAgents, excludedAgents
    );
    
    // If we have capabilities, filter by those as well
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      const capableAgents = await this.findAgentsByCapabilities(
        requiredCapabilities, preferredAgents, excludedAgents
      );
      
      // Intersection of participants and capable agents
      candidateAgents = candidateAgents.filter(id => capableAgents.includes(id));
    }
    
    // If we have candidates from the chat, use those
    if (candidateAgents.length > 0) {
      return candidateAgents;
    }
    
    // Otherwise, fall back to capability-based routing
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      return this.findAgentsByCapabilities(
        requiredCapabilities, preferredAgents, excludedAgents
      );
    }
    
    // Last resort: find least loaded agents
    return this.findLeastLoadedAgents(
      undefined, preferredAgents, excludedAgents
    );
  }
  
  /**
   * Private: Get metrics for a specific agent
   */
  private async getAgentMetrics(agentId: string): Promise<AgentRoutingMetrics> {
    try {
      // Count active tasks
      const activeTaskCount = await this.countActiveTasks(agentId);
      
      // Calculate average response time (last 10 messages)
      const responseTime = await this.calculateAverageResponseTime(agentId);
      
      // Calculate success rate (last 20 tasks)
      const successRate = await this.calculateSuccessRate(agentId);
      
      // Get last active timestamp
      const lastActiveTimestamp = await this.getLastActiveTimestamp(agentId);
      
      return {
        agentId,
        activeTaskCount,
        averageResponseTime: responseTime,
        successRate,
        lastActiveTimestamp
      };
    } catch (error) {
      console.error(`Error getting agent metrics for ${agentId}:`, error);
      
      // Return default metrics if error
      return {
        agentId,
        activeTaskCount: 0,
        averageResponseTime: 0,
        successRate: 0,
        lastActiveTimestamp: 0
      };
    }
  }
  
  /**
   * Private: Get all active agents
   */
  private async getActiveAgents(): Promise<string[]> {
    try {
      // Search for active agents
      const agents = await this.memoryService.searchMemories({
        type: this.MEMORY_TYPE_AGENT,
        filter: {
          'metadata.status': 'available'
        }
      });
      
      // Extract agent IDs
      return agents.map(agent => agent.id);
    } catch (error) {
      console.error('Error getting active agents:', error);
      return [];
    }
  }
  
  /**
   * Private: Get participants in a chat
   */
  private async getChatParticipants(chatId: string): Promise<string[]> {
    try {
      // Search for the chat
      const chats = await this.memoryService.searchMemories({
        type: MemoryType.CHAT,
        filter: { id: chatId }
      });
      
      if (chats.length === 0) {
        return [];
      }
      
      // Extract participant IDs (agents only)
      const chat = chats[0];
      const metadata = chat.payload.metadata as unknown as Record<string, unknown>;
      const participants = metadata.participants as Array<{type: string, id: string}> || [];
      
      return participants
        .filter(p => p.type === 'agent')
        .map(p => p.id);
    } catch (error) {
      console.error(`Error getting chat participants for ${chatId}:`, error);
      return [];
    }
  }
  
  /**
   * Private: Filter agent list by preferences and exclusions
   */
  private filterAgentList(
    agents: string[],
    preferredAgents?: string[],
    excludedAgents?: string[]
  ): string[] {
    // Remove excluded agents
    let filteredAgents = excludedAgents && excludedAgents.length > 0
      ? agents.filter(id => !excludedAgents.includes(id))
      : [...agents];
    
    // Prioritize preferred agents
    if (preferredAgents && preferredAgents.length > 0) {
      // First add preferred agents that are in the list
      const preferred = filteredAgents.filter(id => preferredAgents.includes(id));
      
      // Then add the rest
      const others = filteredAgents.filter(id => !preferredAgents.includes(id));
      
      filteredAgents = [...preferred, ...others];
    }
    
    return filteredAgents;
  }
  
  /**
   * Private: Count active tasks for an agent
   */
  private async countActiveTasks(agentId: string): Promise<number> {
    try {
      // Search for active tasks assigned to the agent
      const tasks = await this.memoryService.searchMemories({
        type: MemoryType.TASK,
        filter: {
          'metadata.assignedTo.id': agentId,
          'metadata.status': { $in: ['in_progress', 'pending'] }
        }
      });
      
      return tasks.length;
    } catch (error) {
      console.error(`Error counting active tasks for ${agentId}:`, error);
      return 0;
    }
  }
  
  /**
   * Private: Calculate average response time for an agent
   */
  private async calculateAverageResponseTime(agentId: string): Promise<number> {
    try {
      // For now, return a mock value
      // In a real implementation, this would analyze message timestamps
      return Math.floor(Math.random() * 5000) + 500;
    } catch (error) {
      console.error(`Error calculating response time for ${agentId}:`, error);
      return 0;
    }
  }
  
  /**
   * Private: Calculate success rate for an agent
   */
  private async calculateSuccessRate(agentId: string): Promise<number> {
    try {
      // For now, return a mock value between 0.7 and 1.0
      // In a real implementation, this would analyze task completion status
      return 0.7 + Math.random() * 0.3;
    } catch (error) {
      console.error(`Error calculating success rate for ${agentId}:`, error);
      return 0;
    }
  }
  
  /**
   * Private: Get last active timestamp for an agent
   */
  private async getLastActiveTimestamp(agentId: string): Promise<number> {
    try {
      // Search for the most recent activity
      const activities = await this.memoryService.searchMemories({
        type: this.MEMORY_TYPE_AGENT_ACTIVITY,
        filter: { agentId },
        sort: { field: 'timestamp', direction: 'desc' },
        limit: 1
      } as ExtendedSearchMemoryParams);
      
      if (activities.length > 0) {
        return (activities[0] as any).timestamp || Date.now();
      }
      
      // If no activities found, return current time
      return Date.now();
    } catch (error) {
      console.error(`Error getting last active timestamp for ${agentId}:`, error);
      return Date.now();
    }
  }
} 