/**
 * Conversation Manager
 * 
 * This component coordinates multi-agent conversations, including participant management,
 * message sequencing, and conversation flow control. It serves as the orchestration layer
 * for agent communications.
 */

import { v4 as uuidv4 } from 'uuid';
import { StructuredId } from '../../../../../utils/ulid';
import { AnyMemoryService } from '../../memory/memory-service-wrappers';
import { MemoryType } from '../../../config';
import { MessageRouter, RoutingStrategy, MessagePriority, RoutingParams, DeliveryStatus } from './message-router';
import { MessageTransformer, MessageFormat, EnrichmentType, TransformableMessage } from './message-transformer';

// Ensure type compatibility with MemoryType enum
const MEMORY_TYPE = {
  MESSAGE: MemoryType.MESSAGE,
  CONVERSATION: 'conversation' as MemoryType
};

/**
 * Conversation state types
 */
export enum ConversationState {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Participant type in a conversation
 */
export enum ParticipantType {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system'
}

/**
 * Participant role in a conversation
 */
export enum ParticipantRole {
  OWNER = 'owner',
  MODERATOR = 'moderator',
  MEMBER = 'member',
  OBSERVER = 'observer'
}

/**
 * Message flow control type
 */
export enum FlowControlType {
  ROUND_ROBIN = 'round_robin',
  FREE_FORM = 'free_form',
  MODERATOR_CONTROLLED = 'moderator_controlled',
  THRESHOLD_BASED = 'threshold_based'
}

/**
 * Conversation participant
 */
export interface Participant {
  id: string;
  name: string;
  type: ParticipantType;
  role: ParticipantRole;
  capabilities?: string[];
  joinedAt: number;
  lastActiveAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: number;
  format: MessageFormat;
  metadata?: Record<string, unknown>;
  referencedMessageIds?: string[];
  isVisibleToAll: boolean;
  visibleToParticipantIds?: string[];
}

/**
 * Conversation configuration
 */
export interface ConversationConfig {
  id?: string;
  name: string;
  description?: string;
  initialParticipants: Participant[];
  flowControl: FlowControlType;
  maxParticipants?: number;
  maxMessages?: number;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Conversation data structure
 */
export interface Conversation {
  id: string;
  name: string;
  description?: string;
  state: ConversationState;
  participants: Participant[];
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
  flowControl: FlowControlType;
  metadata?: Record<string, unknown>;
}

/**
 * Message submission parameters
 */
export interface SubmitMessageParams {
  senderId: string;
  content: string;
  format: MessageFormat;
  referencedMessageIds?: string[];
  isVisibleToAll?: boolean;
  visibleToParticipantIds?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Interface for conversation management components
 */
export interface IConversationManager {
  /**
   * Create a new conversation
   */
  createConversation(config: ConversationConfig): Promise<Conversation>;
  
  /**
   * Get a conversation by ID
   */
  getConversation(conversationId: string): Promise<Conversation>;
  
  /**
   * Add a participant to a conversation
   */
  addParticipant(
    conversationId: string,
    participant: Omit<Participant, 'joinedAt' | 'lastActiveAt'>
  ): Promise<Conversation>;
  
  /**
   * Remove a participant from a conversation
   */
  removeParticipant(conversationId: string, participantId: string): Promise<Conversation>;
  
  /**
   * Submit a message to the conversation
   */
  submitMessage(
    conversationId: string,
    params: SubmitMessageParams
  ): Promise<ConversationMessage>;
  
  /**
   * Get messages for a participant
   */
  getMessagesForParticipant(
    conversationId: string,
    participantId: string,
    options?: {
      limit?: number;
      beforeTimestamp?: number;
      afterTimestamp?: number;
    }
  ): Promise<ConversationMessage[]>;
  
  /**
   * Update conversation state
   */
  updateConversationState(
    conversationId: string,
    state: ConversationState
  ): Promise<Conversation>;
}

/**
 * Conversation Manager implementation
 */
export class ConversationManager implements IConversationManager {
  /**
   * Create a new conversation manager
   */
  constructor(
    private readonly memoryService: AnyMemoryService,
    private readonly messageRouter: MessageRouter,
    private readonly messageTransformer: MessageTransformer
  ) {}
  
  /**
   * Create a new conversation
   */
  async createConversation(config: ConversationConfig): Promise<Conversation> {
    try {
      const timestamp = Date.now();
      
      // Generate conversation ID if not provided
      const conversationId = config.id || uuidv4();
      
      // Set join timestamp for all participants
      const participants = config.initialParticipants.map(participant => ({
        ...participant,
        joinedAt: timestamp,
        lastActiveAt: timestamp
      }));
      
      // Create the conversation object
      const conversation: Conversation = {
        id: conversationId,
        name: config.name,
        description: config.description,
        state: ConversationState.INITIALIZING,
        participants,
        messages: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        flowControl: config.flowControl,
        metadata: {
          ...config.metadata,
          maxParticipants: config.maxParticipants,
          maxMessages: config.maxMessages,
          timeoutMs: config.timeoutMs
        }
      };
      
      // Store in memory service
      await this.memoryService.addMemory({
        type: MEMORY_TYPE.CONVERSATION,
        content: config.name,
        metadata: {
          ...conversation,
          messageCount: 0
        }
      });
      
      // Notify participants about the new conversation
      await this.notifyParticipantsOfConversationCreation(conversation);
      
      // Update state to active
      return this.updateConversationState(conversationId, ConversationState.ACTIVE);
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }
  
  /**
   * Get a conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation> {
    try {
      // Search for the conversation
      const conversations = await this.memoryService.searchMemories({
        type: MEMORY_TYPE.CONVERSATION,
        filter: { id: conversationId }
      });
      
      if (conversations.length === 0) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
      
      // Get the conversation data
      const conversation = conversations[0];
      const metadata = conversation.payload.metadata || {};
      const metadataObj = metadata as unknown as Record<string, unknown>;
      
      // Get messages for this conversation
      const messages = await this.getConversationMessages(conversationId);
      
      // Reconstruct the conversation object
      return {
        id: conversationId,
        name: metadataObj.name as string || '',
        description: metadataObj.description as string,
        state: metadataObj.state as ConversationState || ConversationState.ACTIVE,
        participants: metadataObj.participants as Participant[] || [],
        messages,
        createdAt: metadataObj.createdAt as number || 0,
        updatedAt: metadataObj.updatedAt as number || 0,
        flowControl: metadataObj.flowControl as FlowControlType || FlowControlType.FREE_FORM,
        metadata: metadataObj.metadata as Record<string, unknown>
      };
    } catch (error) {
      console.error(`Error getting conversation ${conversationId}:`, error);
      throw error;
    }
  }
  
  /**
   * Add a participant to a conversation
   */
  async addParticipant(
    conversationId: string,
    participant: Omit<Participant, 'joinedAt' | 'lastActiveAt'>
  ): Promise<Conversation> {
    try {
      // Get the conversation
      const conversation = await this.getConversation(conversationId);
      
      // Check if participant already exists
      if (conversation.participants.some(p => p.id === participant.id)) {
        throw new Error(`Participant ${participant.id} already exists in conversation ${conversationId}`);
      }
      
      // Check max participants limit
      const maxParticipants = conversation.metadata?.maxParticipants as number;
      if (maxParticipants && conversation.participants.length >= maxParticipants) {
        throw new Error(`Maximum number of participants (${maxParticipants}) reached for conversation ${conversationId}`);
      }
      
      const timestamp = Date.now();
      
      // Add the new participant
      const updatedParticipants = [
        ...conversation.participants,
        {
          ...participant,
          joinedAt: timestamp,
          lastActiveAt: timestamp
        }
      ];
      
      // Update conversation in memory
      await this.memoryService.updateMemory({
        type: MEMORY_TYPE.CONVERSATION,
        id: conversationId,
        metadata: {
          participants: updatedParticipants,
          updatedAt: timestamp
        }
      });
      
      // Notify other participants about the new member
      await this.notifyParticipantJoined(conversation, participant.id);
      
      // Return updated conversation
      return this.getConversation(conversationId);
    } catch (error) {
      console.error(`Error adding participant to conversation ${conversationId}:`, error);
      throw error;
    }
  }
  
  /**
   * Remove a participant from a conversation
   */
  async removeParticipant(conversationId: string, participantId: string): Promise<Conversation> {
    try {
      // Get the conversation
      const conversation = await this.getConversation(conversationId);
      
      // Check if participant exists
      const participantIndex = conversation.participants.findIndex(p => p.id === participantId);
      if (participantIndex === -1) {
        throw new Error(`Participant ${participantId} not found in conversation ${conversationId}`);
      }
      
      // Remove the participant
      const updatedParticipants = [...conversation.participants];
      updatedParticipants.splice(participantIndex, 1);
      
      const timestamp = Date.now();
      
      // Update conversation in memory
      await this.memoryService.updateMemory({
        type: MEMORY_TYPE.CONVERSATION,
        id: conversationId,
        metadata: {
          participants: updatedParticipants,
          updatedAt: timestamp
        }
      });
      
      // Notify remaining participants
      await this.notifyParticipantLeft(conversation, participantId);
      
      // Return updated conversation
      return this.getConversation(conversationId);
    } catch (error) {
      console.error(`Error removing participant from conversation ${conversationId}:`, error);
      throw error;
    }
  }
  
  /**
   * Submit a message to the conversation
   */
  async submitMessage(
    conversationId: string,
    params: SubmitMessageParams
  ): Promise<ConversationMessage> {
    try {
      // Get the conversation
      const conversation = await this.getConversation(conversationId);
      
      // Check if conversation is active
      if (conversation.state !== ConversationState.ACTIVE) {
        throw new Error(`Cannot submit message to conversation in ${conversation.state} state`);
      }
      
      // Check if sender is a participant
      const sender = conversation.participants.find(p => p.id === params.senderId);
      if (!sender) {
        throw new Error(`Sender ${params.senderId} is not a participant in conversation ${conversationId}`);
      }
      
      const timestamp = Date.now();
      const messageId = uuidv4();
      
      // Create the message
      const message: ConversationMessage = {
        id: messageId,
        conversationId,
        senderId: params.senderId,
        content: params.content,
        timestamp,
        format: params.format,
        metadata: params.metadata,
        referencedMessageIds: params.referencedMessageIds,
        isVisibleToAll: params.isVisibleToAll !== false, // default to true
        visibleToParticipantIds: !params.isVisibleToAll ? params.visibleToParticipantIds : undefined
      };
      
      // Store the message in memory
      await this.memoryService.addMemory({
        type: MEMORY_TYPE.MESSAGE,
        content: params.content,
        metadata: {
          ...message,
          messageType: 'conversation',
          participantType: sender.type
        }
      });
      
      // Update conversation metadata
      await this.memoryService.updateMemory({
        type: MEMORY_TYPE.CONVERSATION,
        id: conversationId,
        metadata: {
          updatedAt: timestamp,
          messageCount: (conversation.messages.length + 1)
        }
      });
      
      // Update sender's last active timestamp
      await this.updateParticipantActivity(conversationId, params.senderId);
      
      // Determine recipients and route the message
      await this.routeMessageToRecipients(conversation, message);
      
      return message;
    } catch (error) {
      console.error(`Error submitting message to conversation ${conversationId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get messages for a participant
   */
  async getMessagesForParticipant(
    conversationId: string,
    participantId: string,
    options: {
      limit?: number;
      beforeTimestamp?: number;
      afterTimestamp?: number;
    } = {}
  ): Promise<ConversationMessage[]> {
    try {
      // Get the conversation to verify participant
      const conversation = await this.getConversation(conversationId);
      
      // Check if participant exists
      const participant = conversation.participants.find(p => p.id === participantId);
      if (!participant) {
        throw new Error(`Participant ${participantId} not found in conversation ${conversationId}`);
      }
      
      // Build filter for the query
      const filter: Record<string, unknown> = {
        conversationId,
        $or: [
          { isVisibleToAll: true },
          { visibleToParticipantIds: participantId },
          { senderId: participantId }
        ]
      };
      
      // Add timestamp filters if provided
      if (options.beforeTimestamp) {
        filter.timestamp = { $lt: options.beforeTimestamp };
      }
      
      if (options.afterTimestamp) {
        filter.timestamp = { ...filter.timestamp as Record<string, unknown>, $gt: options.afterTimestamp };
      }
      
      // Get messages
      const messages = await this.memoryService.searchMemories({
        type: MEMORY_TYPE.MESSAGE,
        filter: {
          'metadata.conversationId': conversationId,
          // Additional filters would be applied here in a real implementation
        },
        limit: options.limit || 100
      });
      
      // Transform to conversation messages
      const result = messages
        .map(message => {
          if (!message.payload.metadata) {
            return null;
          }
          
          const metadata = message.payload.metadata as unknown as Record<string, unknown>;
          
          // Only include messages visible to this participant
          if (!this.isMessageVisibleToParticipant(metadata, participantId)) {
            return null;
          }
          
          const convoMessage: ConversationMessage = {
            id: message.id,
            conversationId: metadata.conversationId as string || '',
            senderId: metadata.senderId as string || '',
            content: message.payload.text || '',
            timestamp: (message as any).timestamp || 0,
            format: metadata.format as MessageFormat || MessageFormat.TEXT,
            metadata: metadata.metadata as Record<string, unknown>,
            referencedMessageIds: metadata.referencedMessageIds as string[] || [],
            isVisibleToAll: metadata.isVisibleToAll as boolean || true,
            visibleToParticipantIds: metadata.visibleToParticipantIds as string[] || []
          };
          
          return convoMessage;
        })
        .filter((message): message is ConversationMessage => message !== null);
        
      // Sort by timestamp
      return result.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error(`Error getting messages for participant ${participantId} in conversation ${conversationId}:`, error);
      return [];
    }
  }
  
  /**
   * Update conversation state
   */
  async updateConversationState(
    conversationId: string,
    state: ConversationState
  ): Promise<Conversation> {
    try {
      const timestamp = Date.now();
      
      // Update conversation state in memory
      await this.memoryService.updateMemory({
        type: MEMORY_TYPE.CONVERSATION,
        id: conversationId,
        metadata: {
          state,
          updatedAt: timestamp
        }
      });
      
      // If conversation is completed or failed, perform cleanup
      if (state === ConversationState.COMPLETED || state === ConversationState.FAILED) {
        await this.handleConversationEnded(conversationId, state);
      }
      
      // Return updated conversation
      return this.getConversation(conversationId);
    } catch (error) {
      console.error(`Error updating conversation state for ${conversationId}:`, error);
      throw error;
    }
  }
  
  /**
   * Private: Get all messages for a conversation
   */
  private async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    try {
      // Get messages
      const messages = await this.memoryService.searchMemories({
        type: MEMORY_TYPE.MESSAGE,
        filter: {
          'metadata.conversationId': conversationId
        },
        limit: 1000 // Use pagination in a real implementation
      });
      
      // Transform to conversation messages
      return messages
        .filter(message => message.payload.metadata)
        .map(message => {
          const metadata = message.payload.metadata as unknown as Record<string, unknown>;
          
          return {
            id: message.id,
            conversationId: metadata.conversationId as string || '',
            senderId: metadata.senderId as string || '',
            content: message.payload.text || '',
            timestamp: (message as any).timestamp || 0,
            format: metadata.format as MessageFormat || MessageFormat.TEXT,
            metadata: metadata.metadata as Record<string, unknown>,
            referencedMessageIds: metadata.referencedMessageIds as string[] || [],
            isVisibleToAll: metadata.isVisibleToAll as boolean || true,
            visibleToParticipantIds: metadata.visibleToParticipantIds as string[] || []
          };
        });
    } catch (error) {
      console.error(`Error getting messages for conversation ${conversationId}:`, error);
      return [];
    }
  }
  
  /**
   * Private: Notify participants of conversation creation
   */
  private async notifyParticipantsOfConversationCreation(conversation: Conversation): Promise<void> {
    try {
      // Only notify agent participants (not users)
      const agentParticipants = conversation.participants.filter(
        p => p.type === ParticipantType.AGENT
      );
      
      for (const participant of agentParticipants) {
        // Create a notification message
        const content = `You have been added to conversation "${conversation.name}"`;
        
        // Create a system message
        await this.memoryService.addMemory({
          type: MEMORY_TYPE.MESSAGE,
          content,
          metadata: {
            conversationId: conversation.id,
            senderId: 'system',
            recipientId: participant.id,
            timestamp: Date.now(),
            messageType: 'system_notification',
            format: MessageFormat.TEXT,
            isVisibleToAll: false,
            visibleToParticipantIds: [participant.id]
          }
        });
      }
    } catch (error) {
      console.error(`Error notifying participants of conversation creation ${conversation.id}:`, error);
      // Don't throw, just log the error
    }
  }
  
  /**
   * Private: Notify participants of new member
   */
  private async notifyParticipantJoined(conversation: Conversation, participantId: string): Promise<void> {
    try {
      // Find the participant
      const participant = conversation.participants.find(p => p.id === participantId);
      if (!participant) {
        return;
      }
      
      // Create a notification message
      const content = `${participant.name} (${participant.type}) has joined the conversation`;
      
      // Create a system message visible to all
      await this.memoryService.addMemory({
        type: MEMORY_TYPE.MESSAGE,
        content,
        metadata: {
          conversationId: conversation.id,
          senderId: 'system',
          timestamp: Date.now(),
          messageType: 'system_notification',
          format: MessageFormat.TEXT,
          isVisibleToAll: true
        }
      });
    } catch (error) {
      console.error(`Error notifying about participant joining ${conversation.id}:`, error);
      // Don't throw, just log the error
    }
  }
  
  /**
   * Private: Notify participants when a member leaves
   */
  private async notifyParticipantLeft(conversation: Conversation, participantId: string): Promise<void> {
    try {
      // Find the participant
      const participant = conversation.participants.find(p => p.id === participantId);
      if (!participant) {
        return;
      }
      
      // Create a notification message
      const content = `${participant.name} (${participant.type}) has left the conversation`;
      
      // Create a system message visible to all
      await this.memoryService.addMemory({
        type: MEMORY_TYPE.MESSAGE,
        content,
        metadata: {
          conversationId: conversation.id,
          senderId: 'system',
          timestamp: Date.now(),
          messageType: 'system_notification',
          format: MessageFormat.TEXT,
          isVisibleToAll: true
        }
      });
    } catch (error) {
      console.error(`Error notifying about participant leaving ${conversation.id}:`, error);
      // Don't throw, just log the error
    }
  }
  
  /**
   * Private: Update participant's last active timestamp
   */
  private async updateParticipantActivity(conversationId: string, participantId: string): Promise<void> {
    try {
      // Get the conversation
      const conversation = await this.getConversation(conversationId);
      
      // Find the participant
      const participantIndex = conversation.participants.findIndex(p => p.id === participantId);
      if (participantIndex === -1) {
        return;
      }
      
      // Update the participant's last active timestamp
      const updatedParticipants = [...conversation.participants];
      updatedParticipants[participantIndex] = {
        ...updatedParticipants[participantIndex],
        lastActiveAt: Date.now()
      };
      
      // Update conversation in memory
      await this.memoryService.updateMemory({
        type: MEMORY_TYPE.CONVERSATION,
        id: conversationId,
        metadata: {
          participants: updatedParticipants
        }
      });
    } catch (error) {
      console.error(`Error updating participant activity for ${participantId} in ${conversationId}:`, error);
      // Don't throw, just log the error
    }
  }
  
  /**
   * Private: Route a message to appropriate recipients
   */
  private async routeMessageToRecipients(
    conversation: Conversation,
    message: ConversationMessage
  ): Promise<void> {
    try {
      // Determine recipients based on visibility settings
      let recipientIds: string[] = [];
      
      if (message.isVisibleToAll) {
        // Message is visible to all participants except the sender
        recipientIds = conversation.participants
          .filter(p => p.id !== message.senderId && p.type === ParticipantType.AGENT)
          .map(p => p.id);
      } else if (message.visibleToParticipantIds && message.visibleToParticipantIds.length > 0) {
        // Message is only visible to specific participants
        recipientIds = message.visibleToParticipantIds.filter(
          id => id !== message.senderId && 
          conversation.participants.some(p => p.id === id && p.type === ParticipantType.AGENT)
        );
      }
      
      if (recipientIds.length === 0) {
        return; // No recipients to route to
      }
      
      // Transform message for agent consumption
      const transformableMessage: TransformableMessage = {
        id: message.id,
        senderId: message.senderId,
        recipientId: '', // Will be set for each recipient
        content: message.content,
        format: message.format,
        metadata: {
          ...message.metadata,
          conversationId: message.conversationId
        }
      };
      
      // Route to each recipient
      for (const recipientId of recipientIds) {
        try {
          // Set recipient ID for this specific routing
          transformableMessage.recipientId = recipientId;
          
          // Get recipient's preferred format
          const recipient = conversation.participants.find(p => p.id === recipientId);
          let preferredFormat = MessageFormat.TEXT;
          
          if (recipient?.metadata) {
            const metadataObj = recipient.metadata as Record<string, unknown>;
            preferredFormat = metadataObj.preferredFormat as MessageFormat || MessageFormat.TEXT;
          }
          
          // Transform message if needed
          let messageToRoute = transformableMessage;
          
          if (message.format !== preferredFormat) {
            // Transform the message to the recipient's preferred format
            const transformResult = await this.messageTransformer.transformMessage(
              transformableMessage,
              {
                sourceFormat: message.format,
                targetFormat: preferredFormat,
                includeMetadata: true,
                enrichments: [EnrichmentType.CONTEXT, EnrichmentType.HISTORY]
              }
            );
            
            if (transformResult.success) { 
              messageToRoute = transformResult.transformedMessage;
            }
          }
          
          // Route the message
          const routingParams: RoutingParams = {
            message: {
              id: messageToRoute.id,
              senderId: messageToRoute.senderId,
              recipientId: messageToRoute.recipientId,
              chatId: message.conversationId,
              content: messageToRoute.content,
              timestamp: Date.now(),
              priority: MessagePriority.NORMAL,
              routingStrategy: RoutingStrategy.DIRECT,
              deliveryStatus: DeliveryStatus.PENDING
            },
            strategy: RoutingStrategy.DIRECT
          };
          
          await this.messageRouter.routeMessage(routingParams);
        } catch (error) {
          console.error(`Error routing message to recipient ${recipientId}:`, error);
          // Continue with next recipient
        }
      }
    } catch (error) {
      console.error(`Error routing message in conversation ${conversation.id}:`, error);
      // Don't throw, just log the error
    }
  }
  
  /**
   * Private: Check if a message is visible to a participant
   */
  private isMessageVisibleToParticipant(
    messageMetadata: Record<string, unknown>,
    participantId: string
  ): boolean {
    // Message is visible if:
    // 1. It's visible to all, or
    // 2. The participant is the sender, or
    // 3. The participant is in the visibleToParticipantIds list
    
    // Sender can always see their own messages
    if (messageMetadata.senderId === participantId) {
      return true;
    }
    
    // Check if visible to all
    if (messageMetadata.isVisibleToAll === true) {
      return true;
    }
    
    // Check if in visible to list
    const visibleTo = messageMetadata.visibleToParticipantIds as string[] || [];
    return visibleTo.includes(participantId);
  }
  
  /**
   * Private: Handle conversation end (completed or failed)
   */
  private async handleConversationEnded(
    conversationId: string,
    state: ConversationState
  ): Promise<void> {
    try {
      // Get the conversation
      const conversation = await this.getConversation(conversationId);
      
      // Create a notification message
      const content = `Conversation "${conversation.name}" has ${state === ConversationState.COMPLETED ? 'completed' : 'failed'}`;
      
      // Send notification to all participants
      await this.memoryService.addMemory({
        type: MEMORY_TYPE.MESSAGE,
        content,
        metadata: {
          conversationId,
          senderId: 'system',
          timestamp: Date.now(),
          messageType: 'system_notification',
          format: MessageFormat.TEXT,
          isVisibleToAll: true
        }
      });
      
      // Perform any necessary cleanup here
      // In a real implementation, this might include releasing resources,
      // updating participant statistics, storing conversation summaries, etc.
    } catch (error) {
      console.error(`Error handling conversation end for ${conversationId}:`, error);
      // Don't throw, just log the error
    }
  }
} 