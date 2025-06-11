/**
 * Agent Tool for Scheduled Messages
 * 
 * Provides agents with a tool to schedule recurring messages based on user requests.
 * This enables users to ask agents to send them regular messages like reflections,
 * reminders, summaries, or any other recurring communication.
 */

import { z } from 'zod';
import { 
  AgentMessagingService, 
  DefaultAgentMessagingService,
  ChatService,
  MemoryService,
  SchedulerManager as MessagingSchedulerManager
} from '../agent-messaging';
import { createMessagingLLMService } from './llm-adapter';
import { ulid } from 'ulid';

// ============================================================================
// Tool Parameter Schema
// ============================================================================

const ScheduleMessageParamsSchema = z.object({
  messageType: z.enum(['daily_reflection', 'weekly_summary', 'goal_review', 'break_reminder', 'custom'])
    .describe('Type of message to schedule'),
  
  frequency: z.enum(['daily', 'weekly', 'monthly', 'custom'])
    .describe('How often to send the message'),
  
  scheduledTime: z.string()
    .describe('When to send messages (e.g., "6:00 PM", "Friday 3:00 PM", "1st of month 9:00 AM")'),
  
  content: z.string()
    .describe('Message content or template to send'),
  
  interactive: z.boolean().optional()
    .describe('Whether the message should collect user responses'),
  
  memoryCollectionName: z.string().optional()
    .describe('Name of memory collection to store responses in (if interactive)'),
  
  expirationDate: z.string().optional()
    .describe('When to stop sending messages (ISO date string)'),
  
  maxOccurrences: z.number().optional()
    .describe('Maximum number of messages to send'),
  
  timezone: z.string().optional()
    .describe('Timezone for scheduling (e.g., "America/New_York")')
});

export type ScheduleMessageParams = z.infer<typeof ScheduleMessageParamsSchema>;

// ============================================================================
// Tool Result Types
// ============================================================================

export interface ScheduleMessageResult {
  success: boolean;
  taskId?: string;
  scheduledAt?: Date;
  nextOccurrence?: Date;
  message?: string;
  error?: string;
}

// ============================================================================
// Scheduled Message Handler
// ============================================================================

export class ScheduledMessageHandler {
  constructor(
    private readonly messagingService: AgentMessagingService,
    private readonly chatService: ChatService,
    private readonly memoryService: MemoryService
  ) {}

  /**
   * Handle scheduled message execution
   */
  async executeScheduledMessage(
    params: ScheduleMessageParams,
    agentId: string,
    userId: string,
    chatId: string
  ): Promise<void> {
    try {
      // Generate message content if needed
      const messageContent = await this.generateMessageContent(params, agentId);

      // Send the message
      await this.chatService.addMessage({
        chatId,
        userId,
        agentId,
        content: messageContent,
        messageType: 'scheduled_message',
        metadata: {
          scheduledMessageType: params.messageType,
          frequency: params.frequency,
          interactive: params.interactive,
          memoryCollectionName: params.memoryCollectionName
        }
      });

      console.info('Scheduled message sent successfully:', {
        chatId,
        agentId,
        messageType: params.messageType
      });

    } catch (error) {
      console.error('Error executing scheduled message:', {
        error: error instanceof Error ? error.message : String(error),
        params,
        agentId,
        userId
      });
      throw error;
    }
  }

  /**
   * Generate message content based on parameters
   */
  private async generateMessageContent(
    params: ScheduleMessageParams,
    agentId: string
  ): Promise<string> {
    // If content is provided, use it directly
    if (params.content && params.messageType === 'custom') {
      return params.content;
    }

    // Generate contextual content based on message type
    switch (params.messageType) {
      case 'daily_reflection':
        return this.generateDailyReflectionMessage();
      
      case 'weekly_summary':
        return this.generateWeeklySummaryMessage();
      
      case 'goal_review':
        return this.generateGoalReviewMessage();
      
      case 'break_reminder':
        return this.generateBreakReminderMessage();
      
      case 'custom':
        return params.content || 'Scheduled message from your agent.';
      
      default:
        return params.content || 'Scheduled message from your agent.';
    }
  }

  /**
   * Generate daily reflection message
   */
  private generateDailyReflectionMessage(): string {
    return `🌅 **Daily Reflection Time**

Take a moment to reflect on your day:

1. What went well today?
2. What challenged you?
3. What did you learn?
4. What are you grateful for?
5. How can tomorrow be even better?

Feel free to share your thoughts - I'll remember them to help track your patterns and growth! 💭`;
  }

  /**
   * Generate weekly summary message
   */
  private generateWeeklySummaryMessage(): string {
    return `📋 **Weekly Summary & Review**

It's time for your weekly check-in! Let's review:

1. What were your biggest accomplishments this week?
2. Which goals did you make progress on?
3. What obstacles did you overcome?
4. What patterns do you notice in your work/life?
5. What are your priorities for next week?

I'm here to help you reflect and plan ahead! 🎯`;
  }

  /**
   * Generate goal review message
   */
  private generateGoalReviewMessage(): string {
    return `🎯 **Goal Review Session**

Time to check in on your goals:

1. Which goals are you actively working on?
2. What progress have you made recently?
3. Are there any goals that need adjustment?
4. What's helping you stay motivated?
5. What support do you need to reach your goals?

Let's keep you on track toward what matters most! 🚀`;
  }

  /**
   * Generate break reminder message
   */
  private generateBreakReminderMessage(): string {
    return `⏰ **Break Time Reminder**

Time to take a healthy break!

Consider:
- Step away from your screen for 5-10 minutes
- Do some stretches or light movement
- Take a few deep breaths
- Hydrate with some water
- Look at something in the distance

Your wellbeing matters! How are you feeling today? 🌟`;
  }
}

// ============================================================================
// Agent Tool Implementation
// ============================================================================

export class ScheduleMessageTool {
  private readonly handler: ScheduledMessageHandler;

  constructor(
    private readonly chatService: ChatService,
    private readonly memoryService: MemoryService,
    private readonly schedulerManager: MessagingSchedulerManager
  ) {
    const llmService = createMessagingLLMService();
    const messagingService = new DefaultAgentMessagingService(
      chatService,
      memoryService,
      schedulerManager,
      llmService
    );
    
    this.handler = new ScheduledMessageHandler(
      messagingService,
      chatService,
      memoryService
    );
  }

  /**
   * Tool metadata
   */
  static get metadata() {
    return {
      name: 'schedule_message',
      description: 'Schedule recurring messages to be sent to the user at specified times. Use this when users ask for regular reminders, reflections, summaries, or any recurring communication.',
      parameters: ScheduleMessageParamsSchema
    };
  }

  /**
   * Execute the schedule message tool
   */
  async execute(
    params: ScheduleMessageParams,
    context: {
      agentId: string;
      userId: string;
      chatId: string;
    }
  ): Promise<ScheduleMessageResult> {
    try {
      // Validate parameters
      const validatedParams = ScheduleMessageParamsSchema.parse(params);
      
      // Calculate next occurrence time
      const nextOccurrence = this.calculateNextOccurrence(
        validatedParams.scheduledTime,
        validatedParams.frequency,
        validatedParams.timezone
      );

      // Create scheduled task
      const scheduledTask = await this.schedulerManager.createTask({
        id: ulid(),
        name: `Scheduled Message: ${validatedParams.messageType}`,
        description: `Recurring ${validatedParams.frequency} message for user ${context.userId}`,
        scheduledTime: nextOccurrence,
        handler: async () => {
          await this.handler.executeScheduledMessage(
            validatedParams,
            context.agentId,
            context.userId,
            context.chatId
          );
          return { success: true };
        },
        status: 'pending',
        metadata: {
          messageParams: validatedParams,
          agentId: context.agentId,
          userId: context.userId,
          chatId: context.chatId,
          recurring: true,
          frequency: validatedParams.frequency,
          expirationDate: validatedParams.expirationDate,
          maxOccurrences: validatedParams.maxOccurrences,
          occurrenceCount: 0
        }
      });

      return {
        success: true,
        taskId: scheduledTask.id,
        scheduledAt: new Date(),
        nextOccurrence,
        message: `Successfully scheduled ${validatedParams.frequency} ${validatedParams.messageType} messages starting ${nextOccurrence.toLocaleString()}`
      };

    } catch (error) {
      console.error('Error scheduling message:', {
        error: error instanceof Error ? error.message : String(error),
        params,
        context
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Calculate next occurrence based on schedule
   */
  private calculateNextOccurrence(
    scheduledTime: string,
    frequency: string,
    timezone?: string
  ): Date {
    const now = new Date();
    
    // Parse time string (simplified parsing)
    let nextOccurrence = new Date();
    
    switch (frequency) {
      case 'daily':
        // Parse time like "6:00 PM"
        const dailyTime = this.parseTimeString(scheduledTime);
        nextOccurrence.setHours(dailyTime.hours, dailyTime.minutes, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (nextOccurrence <= now) {
          nextOccurrence.setDate(nextOccurrence.getDate() + 1);
        }
        break;
        
      case 'weekly':
        // Parse time like "Friday 3:00 PM"
        const weeklyTime = this.parseWeeklyTimeString(scheduledTime);
        nextOccurrence = this.getNextWeeklyOccurrence(weeklyTime.dayOfWeek, weeklyTime.hours, weeklyTime.minutes);
        break;
        
      case 'monthly':
        // Parse time like "1st 9:00 AM"
        const monthlyTime = this.parseMonthlyTimeString(scheduledTime);
        nextOccurrence = this.getNextMonthlyOccurrence(monthlyTime.dayOfMonth, monthlyTime.hours, monthlyTime.minutes);
        break;
        
      default:
        // Default to 1 hour from now
        nextOccurrence = new Date(now.getTime() + 60 * 60 * 1000);
    }
    
    return nextOccurrence;
  }

  /**
   * Parse time string like "6:00 PM"
   */
  private parseTimeString(timeStr: string): { hours: number; minutes: number } {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) {
      return { hours: 18, minutes: 0 }; // Default to 6 PM
    }
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const isPM = match[3]?.toUpperCase() === 'PM';
    
    if (isPM && hours !== 12) {
      hours += 12;
    } else if (!isPM && hours === 12) {
      hours = 0;
    }
    
    return { hours, minutes };
  }

  /**
   * Parse weekly time string like "Friday 3:00 PM"
   */
  private parseWeeklyTimeString(timeStr: string): { dayOfWeek: number; hours: number; minutes: number } {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayMatch = timeStr.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    
    const dayOfWeek = dayMatch ? days.indexOf(dayMatch[1].toLowerCase()) : 5; // Default to Friday
    const timeInfo = timeMatch ? this.parseTimeString(timeMatch[0]) : { hours: 15, minutes: 0 }; // Default to 3 PM
    
    return {
      dayOfWeek,
      hours: timeInfo.hours,
      minutes: timeInfo.minutes
    };
  }

  /**
   * Parse monthly time string like "1st 9:00 AM"
   */
  private parseMonthlyTimeString(timeStr: string): { dayOfMonth: number; hours: number; minutes: number } {
    const dayMatch = timeStr.match(/(\d{1,2})(st|nd|rd|th)?/i);
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    
    const dayOfMonth = dayMatch ? parseInt(dayMatch[1]) : 1; // Default to 1st
    const timeInfo = timeMatch ? this.parseTimeString(timeMatch[0]) : { hours: 9, minutes: 0 }; // Default to 9 AM
    
    return {
      dayOfMonth,
      hours: timeInfo.hours,
      minutes: timeInfo.minutes
    };
  }

  /**
   * Get next weekly occurrence
   */
  private getNextWeeklyOccurrence(dayOfWeek: number, hours: number, minutes: number): Date {
    const now = new Date();
    const nextOccurrence = new Date();
    
    nextOccurrence.setHours(hours, minutes, 0, 0);
    
    const currentDay = now.getDay();
    const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
    
    if (daysUntilTarget === 0 && nextOccurrence <= now) {
      // Same day but time has passed, schedule for next week
      nextOccurrence.setDate(nextOccurrence.getDate() + 7);
    } else {
      nextOccurrence.setDate(nextOccurrence.getDate() + daysUntilTarget);
    }
    
    return nextOccurrence;
  }

  /**
   * Get next monthly occurrence
   */
  private getNextMonthlyOccurrence(dayOfMonth: number, hours: number, minutes: number): Date {
    const now = new Date();
    const nextOccurrence = new Date();
    
    nextOccurrence.setDate(dayOfMonth);
    nextOccurrence.setHours(hours, minutes, 0, 0);
    
    // If this month's occurrence has passed, schedule for next month
    if (nextOccurrence <= now) {
      nextOccurrence.setMonth(nextOccurrence.getMonth() + 1);
    }
    
    return nextOccurrence;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createScheduleMessageTool(
  chatService: ChatService,
  memoryService: MemoryService,
  schedulerManager: MessagingSchedulerManager
): ScheduleMessageTool {
  return new ScheduleMessageTool(chatService, memoryService, schedulerManager);
} 