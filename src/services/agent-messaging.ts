/**
 * Agent Messaging Service
 * 
 * Main service that orchestrates agent-independent messaging using existing infrastructure.
 * Connects LLM-powered message generation with chat persistence, memory storage, and 
 * task scheduling without rebuilding existing systems.
 */

import { ulid } from 'ulid';
import {
  MessageGenerator,
  LLMMessageGenerator,
  MessageGenerationContext,
  MessageTrigger,
  TaskExecutionResult,
  DetectedOpportunity,
  ReflectionResult,
  MessagingPreferences,
  RecentMessage,
  GeneratedMessage,
  MessageGenerationError,
  AgentLLMService
} from './messaging/message-generator';

// ============================================================================
// Service Dependencies - Existing Infrastructure
// ============================================================================

export interface ChatService {
  addMessage(params: AddMessageParams): Promise<ChatMessage>;
  findActiveChat(userId: string, agentId: string): Promise<ChatTarget | null>;
  createChat(userId: string, agentId: string): Promise<ChatTarget>;
}

export interface AddMessageParams {
  readonly chatId: string;
  readonly userId: string;
  readonly agentId: string;
  readonly content: string;
  readonly messageType: 'agent_message' | 'user_message' | 'scheduled_message';
  readonly metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  readonly id: string;
  readonly chatId: string;
  readonly userId: string;
  readonly agentId: string;
  readonly content: string;
  readonly timestamp: Date;
  readonly messageType: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ChatTarget {
  readonly chatId: string;
  readonly userId: string;
  readonly isActive: boolean;
  readonly conversationId?: string;
}

export interface MemoryService {
  addMemory(params: AddMemoryParams): Promise<MemoryEntry>;
  searchMemories(params: SearchMemoryParams): Promise<ReadonlyArray<MemoryEntry>>;
}

export interface AddMemoryParams {
  readonly type: string; // MemoryType.MESSAGE
  readonly content: string;
  readonly metadata: Record<string, unknown>;
}

export interface SearchMemoryParams {
  readonly type: string;
  readonly filter?: Record<string, unknown>;
  readonly limit?: number;
}

export interface MemoryEntry {
  readonly id: string;
  readonly type: string;
  readonly payload: {
    readonly text: string;
    readonly metadata: Record<string, unknown>;
  };
}

export interface SchedulerManager {
  createTask(task: ScheduledTask): Promise<ScheduledTask>;
  cancelTask(taskId: string): Promise<boolean>;
  getTasks(filter?: Record<string, unknown>): Promise<ReadonlyArray<ScheduledTask>>;
}

export interface ScheduledTask {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly scheduledTime: Date;
  readonly handler: () => Promise<unknown>;
  readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// Agent Messaging Service Types
// ============================================================================

export interface MessageDeliveryResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly chatId?: string;
  readonly deliveredAt?: Date;
  readonly error?: string;
  readonly rateLimited?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface ScheduleMessageParams {
  readonly messageType: string;
  readonly schedule: ScheduleConfig;
  readonly userId: string;
  readonly agentId: string;
  readonly interactiveOptions?: InteractiveOptions;
  readonly expirationOptions?: ExpirationOptions;
}

export interface ScheduleConfig {
  readonly type: 'daily' | 'weekly' | 'monthly' | 'cron';
  readonly time: string; // "18:00"
  readonly days?: ReadonlyArray<string>; // ["monday", "tuesday"]
  readonly timezone?: string;
}

export interface InteractiveOptions {
  readonly expectsResponse?: boolean;
  readonly memoryCollection?: string;
  readonly followUpQuestions?: ReadonlyArray<string>;
  readonly responseTimeout?: number; // minutes
}

export interface ExpirationOptions {
  readonly endDate?: Date;
  readonly maxOccurrences?: number;
}

export interface AgentPersona {
  readonly name: string;
  readonly description: string;
  readonly background: string;
  readonly personality: string;
  readonly communicationStyle: string;
  readonly preferences: string;
}

// ============================================================================
// Agent Messaging Service Error Types
// ============================================================================

export class AgentMessagingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'AgentMessagingError';
  }
}

// ============================================================================
// Agent Messaging Service Interface
// ============================================================================

export interface AgentMessagingService {
  // Core messaging functionality
  sendTaskCompletionMessage(
    taskResult: TaskExecutionResult,
    agentPersona?: AgentPersona,
    userPreferences?: MessagingPreferences
  ): Promise<MessageDeliveryResult>;

  sendOpportunityMessage(
    opportunity: DetectedOpportunity,
    agentId: string,
    userId: string,
    agentPersona?: AgentPersona,
    userPreferences?: MessagingPreferences
  ): Promise<MessageDeliveryResult>;

  sendReflectionMessage(
    reflection: ReflectionResult,
    userId: string,
    agentPersona?: AgentPersona,
    userPreferences?: MessagingPreferences
  ): Promise<MessageDeliveryResult>;

  // Scheduled messaging (tool-based)
  scheduleRecurringMessage(params: ScheduleMessageParams): Promise<MessageDeliveryResult>;
  cancelScheduledMessage(taskId: string): Promise<boolean>;
  getUserScheduledMessages(userId: string): Promise<ReadonlyArray<ScheduledTask>>;

  // Context-aware message generation
  generateContextualMessage(
    agentId: string,
    trigger: MessageTrigger,
    context: MessageGenerationContext
  ): Promise<GeneratedMessage>;

  // User preferences and chat management
  findOrCreateUserChat(userId: string, agentId: string): Promise<ChatTarget>;
  getRecentConversation(userId: string, agentId: string, limit?: number): Promise<ReadonlyArray<RecentMessage>>;
}

// ============================================================================
// Default Agent Messaging Service Implementation
// ============================================================================

export class DefaultAgentMessagingService implements AgentMessagingService {
  private readonly chatService: ChatService;
  private readonly memoryService: MemoryService;
  private readonly schedulerManager: SchedulerManager;
  private readonly messageGenerator: MessageGenerator;

  constructor(
    chatService: ChatService,
    memoryService: MemoryService,
    schedulerManager: SchedulerManager,
    llmService: AgentLLMService
  ) {
    this.chatService = chatService;
    this.memoryService = memoryService;
    this.schedulerManager = schedulerManager;
    this.messageGenerator = new LLMMessageGenerator(llmService);
  }

  /**
   * Send task completion message using LLM generation and existing chat system
   */
  async sendTaskCompletionMessage(
    taskResult: TaskExecutionResult,
    agentPersona?: AgentPersona,
    userPreferences?: MessagingPreferences
  ): Promise<MessageDeliveryResult> {
    try {
      // Get recent conversation context
      const recentConversation = await this.getRecentConversation(
        taskResult.userId, 
        taskResult.agentId, 
        5
      );

      // Build generation context
      const context: MessageGenerationContext = {
        agentId: taskResult.agentId,
        userId: taskResult.userId,
        agentPersona,
        trigger: {
          type: 'task_completion',
          source: taskResult.taskId,
          priority: 'medium',
          context: { taskResult }
        },
        taskResult,
        userPreferences,
        recentConversation
      };

      // Generate message using LLM
      const generatedMessage = await this.messageGenerator.generateTaskCompletionMessage(context);

      // Deliver via existing chat system
      return await this.deliverMessage(generatedMessage, taskResult.userId, taskResult.agentId);

    } catch (error) {
      return this.createErrorResult(error, 'TASK_COMPLETION_MESSAGE_ERROR', {
        taskId: taskResult.taskId,
        agentId: taskResult.agentId,
        userId: taskResult.userId
      });
    }
  }

  /**
   * Send opportunity notification message
   */
  async sendOpportunityMessage(
    opportunity: DetectedOpportunity,
    agentId: string,
    userId: string,
    agentPersona?: AgentPersona,
    userPreferences?: MessagingPreferences
  ): Promise<MessageDeliveryResult> {
    try {
      const recentConversation = await this.getRecentConversation(userId, agentId, 5);

      const context: MessageGenerationContext = {
        agentId,
        userId,
        agentPersona,
        trigger: {
          type: 'opportunity',
          source: opportunity.id,
          priority: opportunity.urgency === 'high' ? 'high' : 'medium',
          context: { opportunity }
        },
        opportunity,
        userPreferences,
        recentConversation
      };

      const generatedMessage = await this.messageGenerator.generateOpportunityMessage(context);
      return await this.deliverMessage(generatedMessage, userId, agentId);

    } catch (error) {
      return this.createErrorResult(error, 'OPPORTUNITY_MESSAGE_ERROR', {
        opportunityId: opportunity.id,
        agentId,
        userId
      });
    }
  }

  /**
   * Send reflection/insight message
   */
  async sendReflectionMessage(
    reflection: ReflectionResult,
    userId: string,
    agentPersona?: AgentPersona,
    userPreferences?: MessagingPreferences
  ): Promise<MessageDeliveryResult> {
    try {
      const recentConversation = await this.getRecentConversation(userId, reflection.agentId, 5);

      const context: MessageGenerationContext = {
        agentId: reflection.agentId,
        userId,
        agentPersona,
        trigger: {
          type: 'reflection',
          source: reflection.id,
          priority: reflection.significantInsights ? 'medium' : 'low',
          context: { reflection }
        },
        reflection,
        userPreferences,
        recentConversation
      };

      const generatedMessage = await this.messageGenerator.generateReflectionMessage(context);
      return await this.deliverMessage(generatedMessage, userId, reflection.agentId);

    } catch (error) {
      return this.createErrorResult(error, 'REFLECTION_MESSAGE_ERROR', {
        reflectionId: reflection.id,
        agentId: reflection.agentId,
        userId
      });
    }
  }

  /**
   * Schedule recurring messages using existing scheduler
   */
  async scheduleRecurringMessage(params: ScheduleMessageParams): Promise<MessageDeliveryResult> {
    try {
      const taskId = ulid();
      const scheduledTime = this.parseScheduleTime(params.schedule);

      // Create task that generates and sends messages
      const task: ScheduledTask = {
        id: taskId,
        name: `Scheduled ${params.messageType} Message`,
        description: `Recurring ${params.messageType} message for user ${params.userId}`,
        scheduledTime,
        handler: async () => {
          return await this.executeScheduledMessage(params);
        },
        status: 'pending',
        metadata: {
          messageType: params.messageType,
          userId: params.userId,
          agentId: params.agentId,
          schedule: params.schedule,
          interactiveOptions: params.interactiveOptions,
          expirationOptions: params.expirationOptions,
          isRecurringMessage: true
        }
      };

      await this.schedulerManager.createTask(task);

      return {
        success: true,
        messageId: taskId,
        deliveredAt: new Date(),
        metadata: {
          taskId,
          nextScheduledAt: scheduledTime.toISOString(),
          messageType: params.messageType
        }
      };

    } catch (error) {
      return this.createErrorResult(error, 'SCHEDULE_MESSAGE_ERROR', {
        messageType: params.messageType,
        userId: params.userId,
        agentId: params.agentId
      });
    }
  }

  /**
   * Cancel scheduled message
   */
  async cancelScheduledMessage(taskId: string): Promise<boolean> {
    try {
      return await this.schedulerManager.cancelTask(taskId);
    } catch (error) {
      console.error('Error cancelling scheduled message:', error);
      return false;
    }
  }

  /**
   * Get user's scheduled messages
   */
  async getUserScheduledMessages(userId: string): Promise<ReadonlyArray<ScheduledTask>> {
    try {
      const tasks = await this.schedulerManager.getTasks({
        'metadata.userId': userId,
        'metadata.isRecurringMessage': true
      });

      return tasks;
    } catch (error) {
      console.error('Error getting user scheduled messages:', error);
      return [];
    }
  }

  /**
   * Generate contextual message using LLM
   */
  async generateContextualMessage(
    agentId: string,
    trigger: MessageTrigger,
    context: MessageGenerationContext
  ): Promise<GeneratedMessage> {
    try {
      switch (trigger.type) {
        case 'task_completion':
          return await this.messageGenerator.generateTaskCompletionMessage(context);
        case 'opportunity':
          return await this.messageGenerator.generateOpportunityMessage(context);
        case 'reflection':
          return await this.messageGenerator.generateReflectionMessage(context);
        case 'scheduled':
          return await this.messageGenerator.generateScheduledMessage(context, 'daily_reflection');
        case 'follow_up':
          return await this.messageGenerator.generateFollowUpMessage(context);
        default:
          throw new AgentMessagingError(
            `Unsupported message trigger type: ${trigger.type}`,
            'UNSUPPORTED_TRIGGER_TYPE',
            { trigger }
          );
      }
    } catch (error) {
      throw new AgentMessagingError(
        `Failed to generate contextual message: ${error instanceof Error ? error.message : String(error)}`,
        'CONTEXTUAL_MESSAGE_GENERATION_ERROR',
        { agentId, trigger, error: String(error) }
      );
    }
  }

  /**
   * Find or create chat for user-agent pair
   */
  async findOrCreateUserChat(userId: string, agentId: string): Promise<ChatTarget> {
    try {
      let chat = await this.chatService.findActiveChat(userId, agentId);
      
      if (!chat) {
        chat = await this.chatService.createChat(userId, agentId);
      }

      return chat;
    } catch (error) {
      throw new AgentMessagingError(
        `Failed to find or create chat: ${error instanceof Error ? error.message : String(error)}`,
        'CHAT_CREATION_ERROR',
        { userId, agentId, error: String(error) }
      );
    }
  }

  /**
   * Get recent conversation for context
   */
  async getRecentConversation(
    userId: string, 
    agentId: string, 
    limit: number = 10
  ): Promise<ReadonlyArray<RecentMessage>> {
    try {
      const memories = await this.memoryService.searchMemories({
        type: 'MESSAGE', // MemoryType.MESSAGE
        filter: {
          'metadata.userId': userId,
          'metadata.agentId': agentId
        },
        limit
      });

      return memories.map(memory => {
        const role = memory.payload.metadata.role as string;
        const sender: 'user' | 'agent' = role === 'user' ? 'user' : 'agent';
        
        return {
          id: memory.id,
          content: memory.payload.text,
          sender,
          timestamp: new Date(memory.payload.metadata.timestamp as string),
          messageType: memory.payload.metadata.messageType as string
        };
      }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    } catch (error) {
      console.error('Error getting recent conversation:', error);
      return [];
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Deliver generated message via existing chat system
   */
  private async deliverMessage(
    generatedMessage: GeneratedMessage,
    userId: string,
    agentId: string
  ): Promise<MessageDeliveryResult> {
    try {
      // Find or create chat
      const chat = await this.findOrCreateUserChat(userId, agentId);

      // Add message to chat using existing system
      const chatMessage = await this.chatService.addMessage({
        chatId: chat.chatId,
        userId,
        agentId,
        content: generatedMessage.content,
        messageType: 'agent_message',
        metadata: {
          generatedMessageId: generatedMessage.id,
          messageType: generatedMessage.messageType,
          priority: generatedMessage.priority,
          requiresResponse: generatedMessage.requiresResponse,
          trigger: generatedMessage.metadata.trigger,
          generationMethod: 'llm',
          deliveredAt: new Date().toISOString()
        }
      });

      return {
        success: true,
        messageId: chatMessage.id,
        chatId: chat.chatId,
        deliveredAt: chatMessage.timestamp,
        rateLimited: false,
        metadata: {
          generatedMessageId: generatedMessage.id,
          messageType: generatedMessage.messageType,
          deliveryMethod: 'existing_chat_system'
        }
      };

    } catch (error) {
      throw new AgentMessagingError(
        `Failed to deliver message: ${error instanceof Error ? error.message : String(error)}`,
        'MESSAGE_DELIVERY_ERROR',
        { 
          generatedMessageId: generatedMessage.id,
          userId,
          agentId,
          error: String(error)
        }
      );
    }
  }

  /**
   * Execute scheduled message by generating and delivering it
   */
  private async executeScheduledMessage(params: ScheduleMessageParams): Promise<unknown> {
    try {
      // Get agent persona (would be fetched from agent service in real implementation)
      const agentPersona = await this.getAgentPersona(params.agentId);
      
      // Get user preferences (would be fetched from user service in real implementation)
      const userPreferences = await this.getUserPreferences(params.userId);

      // Build context for scheduled message
      const context: MessageGenerationContext = {
        agentId: params.agentId,
        userId: params.userId,
        agentPersona,
        trigger: {
          type: 'scheduled',
          source: `scheduled_${params.messageType}`,
          priority: 'medium',
          context: { schedule: params.schedule }
        },
        userPreferences
      };

      // Generate message
      const generatedMessage = await this.messageGenerator.generateScheduledMessage(
        context, 
        params.messageType
      );

      // Deliver message
      const result = await this.deliverMessage(
        generatedMessage, 
        params.userId, 
        params.agentId
      );

      // If interactive, set up response tracking
      if (params.interactiveOptions?.expectsResponse && params.interactiveOptions.memoryCollection) {
        // TODO: Implement response tracking using existing memory system
        // This would store pending response expectations in memory
      }

      return result;

    } catch (error) {
      console.error('Error executing scheduled message:', error);
      throw error;
    }
  }

  /**
   * Parse schedule configuration into next execution time
   */
  private parseScheduleTime(schedule: ScheduleConfig): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    const scheduledTime = new Date(now);
    scheduledTime.setHours(hours, minutes, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    return scheduledTime;
  }

  /**
   * Get agent persona (placeholder - would integrate with agent service)
   */
  private async getAgentPersona(agentId: string): Promise<AgentPersona | undefined> {
    // TODO: Integrate with existing agent service to get persona
    // For now, return undefined - LLM will use default behavior
    return undefined;
  }

  /**
   * Get user preferences (placeholder - would integrate with user service)
   */
  private async getUserPreferences(userId: string): Promise<MessagingPreferences | undefined> {
    // TODO: Integrate with existing user preference service
    // For now, return default preferences
    return {
      enableTaskNotifications: true,
      enableOpportunityAlerts: true,
      enableReflectionInsights: true,
      enableScheduledSummaries: true,
      preferredTone: 'professional',
      maxMessagesPerHour: 10
    };
  }

  /**
   * Create standardized error result
   */
  private createErrorResult(
    error: unknown,
    code: string,
    context: Record<string, unknown>
  ): MessageDeliveryResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      error: errorMessage,
      rateLimited: false,
      metadata: {
        errorCode: code,
        errorTime: new Date().toISOString(),
        context
      }
    };
  }
} 