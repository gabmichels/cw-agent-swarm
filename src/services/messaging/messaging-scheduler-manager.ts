/**
 * Messaging-Enabled Scheduler Manager
 * 
 * Wraps the existing ModularSchedulerManager to add agent messaging functionality.
 * This allows task completion notifications without modifying the core scheduler.
 */

import { ModularSchedulerManager } from '../../lib/scheduler/implementations/ModularSchedulerManager';
import { TaskExecutionResult as SchedulerTaskResult } from '../../lib/scheduler/models/TaskExecutionResult.model';
import { Task } from '../../lib/scheduler/models/Task.model';
import { 
  SchedulerMessagingIntegration, 
  createSchedulerMessagingIntegration,
  MessagingIntegrationConfig 
} from './scheduler-integration';
import { 
  ChatService, 
  MemoryService, 
  SchedulerManager as MessagingSchedulerManager,
  ScheduledTask
} from '../agent-messaging';
import { ulid } from 'ulid';

// ============================================================================
// Task Adapter for Interface Compatibility
// ============================================================================

class TaskAdapter {
  /**
   * Convert Task to ScheduledTask for messaging interface
   */
  static toScheduledTask(task: Task): ScheduledTask {
    return {
      id: task.id || ulid(),
      name: task.name,
      description: task.description || '',
      scheduledTime: task.scheduledTime instanceof Date ? task.scheduledTime : new Date(),
      handler: async () => ({ success: true }), // Placeholder handler
      status: 'pending',
      metadata: task.metadata || {}
    };
  }

  /**
   * Convert ScheduledTask to Task for scheduler interface
   */
  static toTask(scheduledTask: ScheduledTask): Task {
    return {
      id: scheduledTask.id,
      name: scheduledTask.name,
      description: scheduledTask.description,
      scheduleType: 'explicit' as any, // Simplified for interface compatibility
      handler: scheduledTask.handler,
      status: 'pending' as any,
      priority: 5,
      scheduledTime: scheduledTask.scheduledTime,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: scheduledTask.metadata || {}
    };
  }
}

// ============================================================================
// Scheduler Manager Interface Adapter
// ============================================================================

class SchedulerManagerAdapter implements MessagingSchedulerManager {
  constructor(private scheduler: ModularSchedulerManager) {}

  async createTask(task: ScheduledTask): Promise<ScheduledTask> {
    const schedulerTask = TaskAdapter.toTask(task);
    const result = await this.scheduler.createTask(schedulerTask);
    return TaskAdapter.toScheduledTask(result);
  }

  async cancelTask(taskId: string): Promise<boolean> {
    return await this.scheduler.deleteTask(taskId);
  }

  async getTasks(filter?: Record<string, unknown>): Promise<ReadonlyArray<ScheduledTask>> {
    // Convert filter to TaskFilter format if needed
    const taskFilter = filter || {};
    const tasks = await this.scheduler.findTasks(taskFilter as any);
    return tasks.map(task => TaskAdapter.toScheduledTask(task));
  }
}

// ============================================================================
// Messaging-Enabled Scheduler Manager
// ============================================================================

export class MessagingEnabledSchedulerManager extends ModularSchedulerManager {
  private messagingIntegration?: SchedulerMessagingIntegration;

  /**
   * Initialize messaging integration
   */
  initializeMessaging(
    chatService: ChatService,
    memoryService: MemoryService,
    config?: Partial<MessagingIntegrationConfig>
  ): void {
    // Create adapter for interface compatibility
    const schedulerAdapter = new SchedulerManagerAdapter(this);

    this.messagingIntegration = createSchedulerMessagingIntegration(
      chatService,
      memoryService,
      schedulerAdapter,
      config
    );

    console.info('Messaging integration initialized for scheduler manager');
  }

  /**
   * Execute due tasks with messaging integration
   */
  async executeDueTasks(): Promise<SchedulerTaskResult[]> {
    // Execute tasks using parent implementation
    const results = await super.executeDueTasks();

    // Process results for messaging if integration is enabled
    if (this.messagingIntegration && results.length > 0) {
      try {
        // For now, we need to determine agentId and userId from task metadata
        // In a real implementation, this would be properly integrated with the agent system
        await this.processTaskResultsForMessaging(results);
      } catch (error) {
        console.error('Error processing task results for messaging:', {
          error: error instanceof Error ? error.message : String(error),
          taskCount: results.length
        });
      }
    }

    return results;
  }

  /**
   * Execute due tasks for a specific agent with messaging integration
   */
  async executeDueTasksForAgent(agentId: string): Promise<SchedulerTaskResult[]> {
    // Execute tasks using parent implementation
    const results = await super.executeDueTasksForAgent(agentId);

    // Process results for messaging if integration is enabled
    if (this.messagingIntegration && results.length > 0) {
      try {
        await this.processTaskResultsForMessaging(results, agentId);
      } catch (error) {
        console.error('Error processing agent task results for messaging:', {
          agentId,
          error: error instanceof Error ? error.message : String(error),
          taskCount: results.length
        });
      }
    }

    return results;
  }

  /**
   * Process task results for messaging
   */
  private async processTaskResultsForMessaging(
    results: SchedulerTaskResult[],
    knownAgentId?: string
  ): Promise<void> {
    if (!this.messagingIntegration) {
      return;
    }

    // Group results by agent-user pairs
    const resultsByAgent = new Map<string, { agentId: string; userId: string; results: SchedulerTaskResult[] }>();

    for (const result of results) {
      // Extract agentId and userId from task metadata
      const agentId = knownAgentId || this.extractAgentIdFromResult(result);
      const userId = this.extractUserIdFromResult(result);

      if (!agentId || !userId) {
        console.debug('Skipping messaging for task without agent/user info:', {
          taskId: result.taskId,
          hasAgentId: !!agentId,
          hasUserId: !!userId
        });
        continue;
      }

      const key = `${agentId}:${userId}`;
      if (!resultsByAgent.has(key)) {
        resultsByAgent.set(key, { agentId, userId, results: [] });
      }
      resultsByAgent.get(key)!.results.push(result);
    }

    // Process each agent-user pair
    for (const { agentId, userId, results: agentResults } of resultsByAgent.values()) {
      try {
        await this.messagingIntegration.processTaskResults(agentResults, agentId, userId);
      } catch (error) {
        console.error('Error processing task results for agent messaging:', {
          agentId,
          userId,
          taskCount: agentResults.length,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Extract agent ID from task result metadata
   */
  private extractAgentIdFromResult(result: SchedulerTaskResult): string | undefined {
    // Check common metadata patterns for agent ID
    const metadata = result.metadata || {};
    
    if (metadata.agentId) {
      return String(metadata.agentId);
    }
    
    if (metadata.agent && typeof metadata.agent === 'object' && 'id' in metadata.agent) {
      return String((metadata.agent as { id: unknown }).id);
    }

    // Check if the task ID contains agent info (common pattern)
    if (result.taskId.includes('agent_')) {
      const match = result.taskId.match(/agent_([a-zA-Z0-9_-]+)/);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Extract user ID from task result metadata
   */
  private extractUserIdFromResult(result: SchedulerTaskResult): string | undefined {
    // Check common metadata patterns for user ID
    const metadata = result.metadata || {};
    
    if (metadata.userId) {
      return String(metadata.userId);
    }

    if (metadata.user && typeof metadata.user === 'object' && 'id' in metadata.user) {
      return String((metadata.user as { id: unknown }).id);
    }

    // Check if the task ID contains user info (common pattern)
    if (result.taskId.includes('user_')) {
      const match = result.taskId.match(/user_([a-zA-Z0-9_-]+)/);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Disable messaging integration
   */
  disableMessaging(): void {
    this.messagingIntegration = undefined;
    console.info('Messaging integration disabled for scheduler manager');
  }

  /**
   * Check if messaging is enabled
   */
  isMessagingEnabled(): boolean {
    return !!this.messagingIntegration;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a messaging-enabled scheduler manager instance
 */
export function createMessagingEnabledSchedulerManager(
  ...args: ConstructorParameters<typeof ModularSchedulerManager>
): MessagingEnabledSchedulerManager {
  return new MessagingEnabledSchedulerManager(...args);
} 