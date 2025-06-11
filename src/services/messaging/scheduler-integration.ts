/**
 * Scheduler Integration for Agent Messaging
 * 
 * Integrates the ModularSchedulerManager with the agent messaging system to enable
 * task completion notifications. This bridges the existing scheduler with the new
 * messaging functionality without requiring changes to the core scheduler.
 */

import { 
  AgentMessagingService, 
  DefaultAgentMessagingService,
  ChatService,
  MemoryService,
  SchedulerManager as MessagingSchedulerManager
} from '../agent-messaging';
import { TaskExecutionResult as SchedulerTaskResult } from '../../lib/scheduler/models/TaskExecutionResult.model';
import { TaskExecutionResult as MessagingTaskResult } from './message-generator';
import { createMessagingLLMService } from './llm-adapter';
import { ulid } from 'ulid';

// ============================================================================
// Integration Configuration
// ============================================================================

export interface MessagingIntegrationConfig {
  readonly enableTaskCompletionMessages: boolean;
  readonly enableOpportunityMessages: boolean;
  readonly enableReflectionMessages: boolean;
  readonly messageThresholds: {
    readonly taskDurationMs: number; // Only message for tasks taking longer than this
    readonly taskImportance: 'low' | 'medium' | 'high'; // Only message for tasks above this importance
  };
  readonly rateLimiting: {
    readonly maxMessagesPerHour: number;
    readonly cooldownBetweenMessages: number; // seconds
  };
}

export const DEFAULT_MESSAGING_CONFIG: MessagingIntegrationConfig = {
  enableTaskCompletionMessages: true,
  enableOpportunityMessages: true,
  enableReflectionMessages: true,
  messageThresholds: {
    taskDurationMs: 5000, // 5 seconds - only message for substantial tasks
    taskImportance: 'medium'
  },
  rateLimiting: {
    maxMessagesPerHour: 10,
    cooldownBetweenMessages: 30 // 30 seconds between messages
  }
};

// ============================================================================
// Message Triggering Logic
// ============================================================================

export interface MessageDecisionContext {
  readonly taskResult: SchedulerTaskResult;
  readonly agentId?: string;
  readonly userId?: string;
  readonly recentMessageCount: number;
  readonly lastMessageTime?: Date;
}

export interface MessageDecision {
  readonly shouldMessage: boolean;
  readonly reason: string;
  readonly priority: 'low' | 'medium' | 'high';
  readonly messageType: 'task_completion' | 'opportunity' | 'reflection';
}

export class MessageDecisionEngine {
  constructor(private readonly config: MessagingIntegrationConfig) {}

  /**
   * Decide whether to send a message for a task completion
   */
  shouldMessageForTaskCompletion(context: MessageDecisionContext): MessageDecision {
    const { taskResult, recentMessageCount, lastMessageTime } = context;

    // Check if messaging is enabled
    if (!this.config.enableTaskCompletionMessages) {
      return {
        shouldMessage: false,
        reason: 'Task completion messaging disabled',
        priority: 'low',
        messageType: 'task_completion'
      };
    }

    // Rate limiting check
    if (this.isRateLimited(recentMessageCount, lastMessageTime)) {
      return {
        shouldMessage: false,
        reason: 'Rate limited - too many recent messages',
        priority: 'low',
        messageType: 'task_completion'
      };
    }

    // Duration threshold check
    if (taskResult.duration < this.config.messageThresholds.taskDurationMs) {
      return {
        shouldMessage: false,
        reason: `Task duration ${taskResult.duration}ms below threshold ${this.config.messageThresholds.taskDurationMs}ms`,
        priority: 'low',
        messageType: 'task_completion'
      };
    }

    // Failed tasks are usually worth messaging about
    if (!taskResult.successful) {
      return {
        shouldMessage: true,
        reason: 'Task failed - user should be notified',
        priority: 'high',
        messageType: 'task_completion'
      };
    }

    // Long-running successful tasks are worth messaging about
    if (taskResult.duration > 30000) { // 30 seconds
      return {
        shouldMessage: true,
        reason: 'Long-running task completed successfully',
        priority: 'medium',
        messageType: 'task_completion'
      };
    }

    // Tasks with significant results
    if (taskResult.result && this.hasSignificantResult(taskResult.result)) {
      return {
        shouldMessage: true,
        reason: 'Task produced significant results',
        priority: 'medium',
        messageType: 'task_completion'
      };
    }

    // Default: don't message for routine tasks
    return {
      shouldMessage: false,
      reason: 'Routine task completion - no message needed',
      priority: 'low',
      messageType: 'task_completion'
    };
  }

  /**
   * Check if messaging is rate limited
   */
  private isRateLimited(recentMessageCount: number, lastMessageTime?: Date): boolean {
    // Check hourly rate limit
    if (recentMessageCount >= this.config.rateLimiting.maxMessagesPerHour) {
      return true;
    }

    // Check cooldown between messages
    if (lastMessageTime) {
      const timeSinceLastMessage = Date.now() - lastMessageTime.getTime();
      const cooldownMs = this.config.rateLimiting.cooldownBetweenMessages * 1000;
      if (timeSinceLastMessage < cooldownMs) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine if task result is significant enough to message about
   */
  private hasSignificantResult(result: unknown): boolean {
    if (!result) return false;

    // Check for specific result patterns that indicate significance
    if (typeof result === 'object' && result !== null) {
      const resultObj = result as Record<string, unknown>;
      
      // Look for indicators of significant results
      if (resultObj.insights || resultObj.opportunities || resultObj.errors) {
        return true;
      }
      
      // Large result objects might be significant
      if (Object.keys(resultObj).length > 5) {
        return true;
      }
    }

    // Large string results might be significant
    if (typeof result === 'string' && result.length > 100) {
      return true;
    }

    return false;
  }
}

// ============================================================================
// Task Result Adapter
// ============================================================================

export class TaskResultAdapter {
  /**
   * Convert scheduler TaskExecutionResult to messaging TaskExecutionResult
   */
  static adapt(
    schedulerResult: SchedulerTaskResult,
    agentId: string,
    userId: string
  ): MessagingTaskResult {
    return {
      taskId: schedulerResult.taskId,
      agentId,
      userId,
      success: schedulerResult.successful,
      result: schedulerResult.result,
      error: schedulerResult.error?.message,
      duration: schedulerResult.duration,
      completedAt: schedulerResult.endTime,
      metadata: {
        ...schedulerResult.metadata,
        schedulerStatus: schedulerResult.status,
        wasRetry: schedulerResult.wasRetry,
        retryCount: schedulerResult.retryCount
      }
    };
  }
}

// ============================================================================
// Scheduler Messaging Integration Service
// ============================================================================

export class SchedulerMessagingIntegration {
  private readonly messagingService: AgentMessagingService;
  private readonly decisionEngine: MessageDecisionEngine;
  private readonly lastMessageTimes: Map<string, Date> = new Map();
  private readonly messageCounters: Map<string, { count: number; resetTime: Date }> = new Map();

  constructor(
    chatService: ChatService,
    memoryService: MemoryService,
    schedulerManager: MessagingSchedulerManager,
    config: MessagingIntegrationConfig = DEFAULT_MESSAGING_CONFIG
  ) {
    const llmService = createMessagingLLMService();
    this.messagingService = new DefaultAgentMessagingService(
      chatService,
      memoryService, 
      schedulerManager,
      llmService
    );
    this.decisionEngine = new MessageDecisionEngine(config);
  }

  /**
   * Process task execution results and potentially send messages
   */
  async processTaskResults(
    results: ReadonlyArray<SchedulerTaskResult>,
    agentId: string,
    userId: string
  ): Promise<void> {
    for (const result of results) {
      try {
        await this.processTaskResult(result, agentId, userId);
      } catch (error) {
        console.error('Error processing task result for messaging:', {
          taskId: result.taskId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Process a single task result
   */
  private async processTaskResult(
    result: SchedulerTaskResult,
    agentId: string,
    userId: string
  ): Promise<void> {
    const userKey = `${userId}:${agentId}`;
    
    // Get recent message stats for this user-agent pair
    const recentMessageCount = this.getRecentMessageCount(userKey);
    const lastMessageTime = this.lastMessageTimes.get(userKey);

    // Decide whether to send a message
    const decision = this.decisionEngine.shouldMessageForTaskCompletion({
      taskResult: result,
      agentId,
      userId,
      recentMessageCount,
      lastMessageTime
    });

    console.debug('Task messaging decision:', {
      taskId: result.taskId,
      shouldMessage: decision.shouldMessage,
      reason: decision.reason,
      priority: decision.priority
    });

    if (!decision.shouldMessage) {
      return;
    }

    // Convert to messaging format
    const messagingResult = TaskResultAdapter.adapt(result, agentId, userId);

    // Send the message
    try {
      const deliveryResult = await this.messagingService.sendTaskCompletionMessage(
        messagingResult,
        undefined, // TODO: Get agent persona from agent service
        undefined  // TODO: Get user preferences from user service
      );

      if (deliveryResult.success) {
        console.info('Task completion message sent successfully:', {
          taskId: result.taskId,
          messageId: deliveryResult.messageId,
          chatId: deliveryResult.chatId
        });

        // Update message tracking
        this.updateMessageTracking(userKey);
      } else {
        console.error('Failed to send task completion message:', {
          taskId: result.taskId,
          error: deliveryResult.error
        });
      }
    } catch (error) {
      console.error('Error sending task completion message:', {
        taskId: result.taskId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get recent message count for rate limiting
   */
  private getRecentMessageCount(userKey: string): number {
    const counter = this.messageCounters.get(userKey);
    if (!counter) return 0;

    // Reset counter if an hour has passed
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    if (counter.resetTime < hourAgo) {
      this.messageCounters.set(userKey, { count: 0, resetTime: now });
      return 0;
    }

    return counter.count;
  }

  /**
   * Update message tracking for rate limiting
   */
  private updateMessageTracking(userKey: string): void {
    const now = new Date();
    
    // Update last message time
    this.lastMessageTimes.set(userKey, now);

    // Update message counter
    const counter = this.messageCounters.get(userKey) || { count: 0, resetTime: now };
    counter.count += 1;
    this.messageCounters.set(userKey, counter);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSchedulerMessagingIntegration(
  chatService: ChatService,
  memoryService: MemoryService,
  schedulerManager: MessagingSchedulerManager,
  config?: Partial<MessagingIntegrationConfig>
): SchedulerMessagingIntegration {
  const finalConfig = { ...DEFAULT_MESSAGING_CONFIG, ...config };
  return new SchedulerMessagingIntegration(
    chatService,
    memoryService,
    schedulerManager,
    finalConfig
  );
} 