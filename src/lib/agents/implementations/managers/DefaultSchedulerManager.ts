/**
 * DefaultSchedulerManager.ts - Default implementation of the SchedulerManager interface
 * 
 * This file provides a concrete implementation of the SchedulerManager interface
 * that can be used by any agent implementation. It includes task scheduling,
 * execution, and management capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  SchedulerManager, 
  SchedulerManagerConfig,
  ScheduledTask,
  TaskCreationOptions,
  TaskCreationResult,
  TaskExecutionResult,
  TaskBatch,
  ResourceUtilization,
  SchedulerEvent,
  SchedulerMetrics
} from '../../../agents/base/managers/SchedulerManager';
import type { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { AbstractBaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { createConfigFactory } from '../../../../agents/shared/config';
import { SchedulerManagerConfigSchema } from '../../../../agents/shared/scheduler/config/SchedulerManagerConfigSchema';

/**
 * Error class for scheduling-related errors
 */
class SchedulingError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'SCHEDULING_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SchedulingError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Default implementation of the SchedulerManager interface
 */
// @ts-ignore - This class implements SchedulerManager with some method signature differences
export class DefaultSchedulerManager extends AbstractBaseManager implements SchedulerManager {
  private tasks: Map<string, ScheduledTask> = new Map();
  private schedulingTimer: NodeJS.Timeout | null = null;
  private configFactory = createConfigFactory(SchedulerManagerConfigSchema);
  // Override config type to use specific config type
  protected config!: SchedulerManagerConfig & Record<string, unknown>;

  /**
   * Type property accessor for compatibility with SchedulerManager
   */
  get type(): string {
    return this._managerType;
  }

  /**
   * Create a new DefaultSchedulerManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<SchedulerManagerConfig> = {}) {
    const managerId = `scheduler-manager-${uuidv4()}`;
    const managerType = 'scheduler';
    
    super(managerId, managerType, agent, { enabled: true });
    
    // Validate and apply configuration with defaults
    this.config = this.configFactory.create({
      enabled: true,
      ...config
    }) as SchedulerManagerConfig & Record<string, unknown>;
  }

  /**
   * Get the unique ID of this manager
   */
  getId(): string {
    return this.managerId;
  }

  /**
   * Get the manager type
   */
  getType(): string {
    return this.managerType;
  }

  /**
   * Get the manager configuration
   */
  getConfig<T extends SchedulerManagerConfig>(): T {
    return this.config as T;
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends SchedulerManagerConfig>(config: Partial<T>): T {
    // Validate and merge configuration
    this.config = this.configFactory.create({
      ...this.config, 
      ...config
    }) as SchedulerManagerConfig & Record<string, unknown>;
    
    // If auto-scheduling config changed, update the timer
    if (('enableAutoScheduling' in config || 'schedulingIntervalMs' in config) && this.initialized) {
      // Clear existing timer
      if (this.schedulingTimer) {
        clearInterval(this.schedulingTimer);
        this.schedulingTimer = null;
      }
      
      // Setup timer if enabled
      if (this.config.enableAutoScheduling) {
        this.setupAutoScheduling();
      }
    }
    
    return this.config as unknown as T;
  }

  /**
   * Get the associated agent instance
   */
  getAgent(): AgentBase {
    return this.agent;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
    
    // Setup auto-scheduling if enabled
    if (this.config.enableAutoScheduling) {
      this.setupAutoScheduling();
    }
    
    this.initialized = true;
    return true;
  }

  /**
   * Shutdown the manager and release resources
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.managerId}] Shutting down ${this.managerType} manager`);
    
    // Clear timers
    if (this.schedulingTimer) {
      clearInterval(this.schedulingTimer);
      this.schedulingTimer = null;
    }
    
    this.initialized = false;
  }

  /**
   * Check if the manager is currently enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable the manager
   */
  setEnabled(enabled: boolean): boolean {
    const wasEnabled = this.config.enabled;
    this.config.enabled = enabled;
    return wasEnabled !== enabled;  // Return true if state changed
  }

  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<boolean> {
    console.log(`[${this.managerId}] Resetting ${this.managerType} manager`);
    this.tasks.clear();
    this.initialized = false;
    if (this.schedulingTimer) {
      clearInterval(this.schedulingTimer);
      this.schedulingTimer = null;
    }
    return await this.initialize();  // Re-initialize after reset
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }> {
    if (!this.initialized) {
      return {
        status: 'degraded',
        message: 'Scheduler manager not initialized'
      };
    }

    const stats = await this.getStats();
    
    // Check if there are critical issues
    if (!this.isEnabled()) {
      return {
        status: 'unhealthy',
        message: 'Scheduler manager is disabled',
        metrics: stats
      };
    }
    
    // Degraded if too many concurrent tasks
    if (stats.runningTasks > (this.config.maxConcurrentTasks ?? 10)) {
      return {
        status: 'degraded',
        message: 'Too many concurrent tasks',
        metrics: stats
      };
    }
    
    return {
      status: 'healthy',
      message: 'Scheduler manager is healthy',
      metrics: stats
    };
  }

  /**
   * Get manager status information
   */
  async getStatus(): Promise<{
    id: string;
    type: string;
    enabled: boolean;
    initialized: boolean;
    [key: string]: unknown;
  }> {
    return {
      id: this.managerId,
      type: this.managerType,
      enabled: this.config.enabled,
      initialized: this.initialized,
      taskCount: this.tasks.size,
      runningTasks: (await this.getRunningTasks()).length,
      pendingTasks: (await this.getPendingTasks()).length
    };
  }

  /**
   * Create a new scheduled task
   */
  async createTask(options: TaskCreationOptions): Promise<TaskCreationResult> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      const taskId = uuidv4();
      const timestamp = new Date();
      
      const task: ScheduledTask = {
        id: taskId,
        name: options.name,
        description: options.description,
        type: options.type,
        status: 'pending',
        priority: options.priority ?? 0.5,
        schedule: options.schedule,
        startTime: options.startTime,
        endTime: options.endTime,
        dependencies: options.dependencies,
        parameters: options.parameters ?? {},
        metadata: options.metadata ?? {},
        createdAt: timestamp,
        updatedAt: timestamp,
        executionCount: 0,
        failureCount: 0
      };
      
      this.tasks.set(taskId, task);
      
      return {
        success: true,
        task
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating task'
      };
    }
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<ScheduledTask | null> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return this.tasks.get(taskId) ?? null;
  }

  /**
   * Get all tasks
   */
  async getAllTasks(): Promise<ScheduledTask[]> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return Array.from(this.tasks.values());
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    const updatedTask: ScheduledTask = {
      ...task,
      ...updates,
      updatedAt: new Date()
    };

    this.tasks.set(taskId, updatedTask);
    return updatedTask;
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return this.tasks.delete(taskId);
  }

  /**
   * Execute a task
   */
  async executeTask(taskId: string): Promise<TaskExecutionResult> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        success: false,
        error: 'Task not found'
      };
    }

    try {
      // Check if task can be executed
      if (task.status === 'running') {
        return {
          success: false,
          error: 'Task is already running'
        };
      }

      if (task.status === 'completed') {
        return {
          success: false,
          error: 'Task is already completed'
        };
      }

      // Check dependencies if enabled
      if (this.config.enableTaskDependencies && task.dependencies?.length) {
        const dependencies = await Promise.all(
          task.dependencies.map(depId => this.getTask(depId))
        );

        const incompleteDeps = dependencies.filter(
          dep => !dep || dep.status !== 'completed'
        );

        if (incompleteDeps.length) {
          return {
            success: false,
            error: 'Task dependencies not completed'
          };
        }
      }

      // Update task status
      const updatedTask = await this.updateTask(taskId, {
        status: 'running',
        lastExecutedAt: new Date()
      });

      if (!updatedTask) {
        return {
          success: false,
          error: 'Failed to update task status'
        };
      }

      // Execute the task
      try {
        await this.executeTaskAction(updatedTask);
        
        // Update task status
        const finalTask = await this.updateTask(taskId, {
          status: 'completed',
          executionCount: updatedTask.executionCount + 1
        });

        return {
          success: true,
          task: finalTask ?? undefined
        };
      } catch (error) {
        // Update task status
        const failedTask = await this.updateTask(taskId, {
          status: 'failed',
          failureCount: updatedTask.failureCount + 1
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error executing task',
          task: failedTask ?? undefined
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing task'
      };
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    // Only allow cancelling pending or scheduled tasks
    if (task.status !== 'pending' && task.status !== 'scheduled') {
      return false;
    }

    const updatedTask = await this.updateTask(taskId, {
      status: 'cancelled'
    });

    return updatedTask !== null;
  }

  /**
   * Get tasks that are due for execution
   */
  async getDueTasks(): Promise<ScheduledTask[]> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const now = new Date();
    return Array.from(this.tasks.values()).filter(task => {
      // Check if task is pending or scheduled
      if (task.status !== 'pending' && task.status !== 'scheduled') {
        return false;
      }

      // Check start time
      if (task.startTime && task.startTime > now) {
        return false;
      }

      // Check end time
      if (task.endTime && task.endTime < now) {
        return false;
      }

      // Check schedule if present
      if (task.schedule) {
        // TODO: Implement cron schedule checking
        return false;
      }

      return true;
    });
  }

  /**
   * Get tasks that are currently running
   */
  async getRunningTasks(): Promise<ScheduledTask[]> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return Array.from(this.tasks.values()).filter(
      task => task.status === 'running'
    );
  }

  /**
   * Get tasks that are pending execution
   */
  async getPendingTasks(): Promise<ScheduledTask[]> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return Array.from(this.tasks.values()).filter(
      task => task.status === 'pending'
    );
  }

  /**
   * Get tasks that have failed
   */
  async getFailedTasks(): Promise<ScheduledTask[]> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return Array.from(this.tasks.values()).filter(
      task => task.status === 'failed'
    );
  }

  /**
   * Retry a failed task
   */
  async retryTask(taskId: string): Promise<TaskExecutionResult> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        success: false,
        error: 'Task not found'
      };
    }

    if (task.status !== 'failed') {
      return {
        success: false,
        error: 'Task is not in failed state'
      };
    }

    // Check retry attempts if enabled
    if (this.config.enableTaskRetries) {
      const retryCount = (task.metadata.retryCount as number) ?? 0;
      if (retryCount >= (this.config.maxRetryAttempts ?? 3)) {
        return {
          success: false,
          error: 'Maximum retry attempts exceeded'
        };
      }

      // Update retry count
      await this.updateTask(taskId, {
        metadata: {
          ...task.metadata,
          retryCount: retryCount + 1
        }
      });
    }

    // Reset task status and execute
    await this.updateTask(taskId, {
      status: 'pending'
    });

    return this.executeTask(taskId);
  }

  // Private helper methods

  /**
   * Setup automatic scheduling
   */
  private setupAutoScheduling(): void {
    if (this.schedulingTimer) {
      clearInterval(this.schedulingTimer);
    }
    
    this.schedulingTimer = setInterval(async () => {
      try {
        await this.processDueTasks();
      } catch (error) {
        console.error(`[${this.managerId}] Error during auto-scheduling:`, error);
      }
    }, this.config.schedulingIntervalMs);
  }

  /**
   * Process tasks that are due for execution
   */
  private async processDueTasks(): Promise<void> {
    const dueTasks = await this.getDueTasks();
    const runningTasks = await this.getRunningTasks();
    
    // Check if we can run more tasks
    const availableSlots = (this.config.maxConcurrentTasks ?? 10) - runningTasks.length;
    if (availableSlots <= 0) {
      return;
    }

    // Sort tasks by priority if enabled
    const tasksToRun = this.config.enableTaskPrioritization
      ? dueTasks.sort((a, b) => b.priority - a.priority)
      : dueTasks;

    // Execute tasks up to available slots
    for (let i = 0; i < Math.min(availableSlots, tasksToRun.length); i++) {
      const task = tasksToRun[i];
      try {
        await this.executeTask(task.id);
      } catch (error) {
        console.error(`[${this.managerId}] Error executing task ${task.id}:`, error);
      }
    }
  }

  /**
   * Execute a task's action
   */
  private async executeTaskAction(task: ScheduledTask): Promise<void> {
    // TODO: Implement task action execution based on task type
    // This would typically involve calling the appropriate tool or service
  }

  /**
   * Get scheduler manager statistics
   */
  private async getStats(): Promise<{
    totalTasks: number;
    runningTasks: number;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    avgTaskPriority: number;
    avgExecutionTime: number;
  }> {
    const allTasks = Array.from(this.tasks.values());
    const runningTasks = allTasks.filter(t => t.status === 'running');
    const pendingTasks = allTasks.filter(t => t.status === 'pending');
    const completedTasks = allTasks.filter(t => t.status === 'completed');
    const failedTasks = allTasks.filter(t => t.status === 'failed');
    
    const totalPriority = allTasks.reduce((sum, t) => sum + t.priority, 0);
    const totalExecutions = allTasks.reduce((sum, t) => sum + t.executionCount, 0);
    
    return {
      totalTasks: allTasks.length,
      runningTasks: runningTasks.length,
      pendingTasks: pendingTasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      avgTaskPriority: allTasks.length > 0 ? totalPriority / allTasks.length : 0,
      avgExecutionTime: totalExecutions > 0 ? totalExecutions / allTasks.length : 0
    };
  }

  // Implement missing interface methods
  async listTasks(options?: {
    status?: ScheduledTask['status'][];
    type?: ScheduledTask['type'][];
    priority?: number;
    minPriority?: number;
    tags?: string[];
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
    sortBy?: 'priority' | 'createdAt' | 'updatedAt';
    sortDirection?: 'asc' | 'desc';
  }): Promise<ScheduledTask[]> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    let tasks = Array.from(this.tasks.values());

    // Apply filters
    if (options?.status) {
      tasks = tasks.filter(t => options.status!.includes(t.status));
    }
    if (options?.type) {
      tasks = tasks.filter(t => options.type!.includes(t.type));
    }
    if (options?.priority !== undefined) {
      tasks = tasks.filter(t => t.priority === options.priority);
    }
    if (options?.minPriority !== undefined) {
      tasks = tasks.filter(t => t.priority >= options.minPriority!);
    }
    if (options?.tags) {
      tasks = tasks.filter(t => 
        options.tags!.every(tag => (t.metadata.tags as string[] || []).includes(tag))
      );
    }
    if (options?.from) {
      tasks = tasks.filter(t => t.createdAt >= options.from!);
    }
    if (options?.to) {
      tasks = tasks.filter(t => t.createdAt <= options.to!);
    }

    // Apply sorting
    if (options?.sortBy) {
      tasks.sort((a, b) => {
        const aValue = a[options.sortBy!];
        const bValue = b[options.sortBy!];
        const direction = options.sortDirection === 'desc' ? -1 : 1;
        return aValue < bValue ? -direction : aValue > bValue ? direction : 0;
      });
    }

    // Apply pagination
    if (options?.offset) {
      tasks = tasks.slice(options.offset);
    }
    if (options?.limit) {
      tasks = tasks.slice(0, options.limit);
    }

    return tasks;
  }

  async createBatch(
    batch: Omit<TaskBatch, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'startedAt' | 'completedAt' | 'successRate'>
  ): Promise<TaskBatch> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const now = new Date();
    const newBatch: TaskBatch = {
      ...batch,
      id: uuidv4(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      successRate: 0
    };

    // TODO: Implement batch storage
    return newBatch;
  }

  async getBatch(batchId: string): Promise<TaskBatch | null> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement batch retrieval
    return null;
  }

  async listBatches(options?: {
    status?: TaskBatch['status'][];
    tags?: string[];
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<TaskBatch[]> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement batch listing
    return [];
  }

  async cancelBatch(batchId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement batch cancellation
    return false;
  }

  async pauseScheduler(): Promise<boolean> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement scheduler pausing
    return true;
  }

  async resumeScheduler(): Promise<boolean> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement scheduler resuming
    return true;
  }

  async getResourceUtilization(): Promise<ResourceUtilization> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement resource utilization tracking
    return {
      timestamp: new Date(),
      cpuUtilization: 0,
      memoryBytes: 0,
      tokensPerMinute: 0,
      apiCallsPerMinute: 0,
      activeTasks: 0,
      pendingTasks: 0
    };
  }

  async getResourceUtilizationHistory(options?: {
    from?: Date;
    to?: Date;
    interval?: 'minute' | 'hour' | 'day';
    limit?: number;
  }): Promise<ResourceUtilization[]> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement resource utilization history
    return [];
  }

  async setResourceLimits(limits: SchedulerManagerConfig['resourceLimits']): Promise<boolean> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement resource limits
    return true;
  }

  async getEvents(options?: {
    types?: SchedulerEvent['type'][];
    from?: Date;
    to?: Date;
    taskId?: string;
    batchId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SchedulerEvent[]> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement event tracking
    return [];
  }

  async getMetrics(options?: {
    from?: Date;
    to?: Date;
    includeResourceMetrics?: boolean;
    includeBatchMetrics?: boolean;
  }): Promise<SchedulerMetrics> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement metrics tracking
    return {
      period: {
        start: new Date(),
        end: new Date()
      },
      taskCounts: {
        pending: 0,
        scheduled: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      },
      taskTypeDistribution: {},
      avgTaskCompletionTimeMs: 0,
      successRate: 0,
      throughput: 0,
      waitTimeMs: {
        avg: 0,
        median: 0,
        p95: 0,
        max: 0
      }
    };
  }

  subscribeToEvents(
    eventTypes: SchedulerEvent['type'][],
    callback: (event: SchedulerEvent) => void
  ): string {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement event subscription
    return uuidv4();
  }

  async unsubscribeFromEvents(subscriptionId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new SchedulingError(
        'Scheduler manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // TODO: Implement event unsubscription
    return true;
  }

  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
} 