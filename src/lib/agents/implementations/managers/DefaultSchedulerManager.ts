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
  TaskCreationOptions,
  TaskCreationResult,
  ScheduledTask,
  TaskExecutionResult,
  ResourceUtilization,
  SchedulerEvent,
  SchedulerMetrics,
  TaskBatch,
  TaskStatus
} from '../../../../agents/shared/base/managers/SchedulerManager.interface';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';
import type { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { MessageProcessingOptions } from '../../../../agents/shared/base/AgentBase.interface';
import { AbstractBaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { createConfigFactory } from '../../../../agents/shared/config';
import { SchedulerManagerConfigSchema } from '../../../../agents/shared/scheduler/config/SchedulerManagerConfigSchema';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ResourceUtilizationTracker } from '../../../../agents/shared/scheduler/ResourceUtilization';
import { ThinkingVisualization, VisualizationService } from '../../../../services/thinking/visualization/types';
import { generateRequestId } from '../../../../utils/request-utils';

/**
 * Task metadata interface
 */
interface TaskMetadata {
  tags?: string[];
  executionTime?: number;
  waitTime?: number;
  [key: string]: unknown;
}

/**
 * Extended scheduler manager config with visualization support
 */
export interface ExtendedSchedulerManagerConfig extends SchedulerManagerConfig {
  enableVisualization?: boolean;
}

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
 * Default Scheduler Manager implementation
 */
export class DefaultSchedulerManager extends AbstractBaseManager implements SchedulerManager {
  public readonly managerId: string;
  public readonly managerType = ManagerType.SCHEDULER;
  protected tasks: Map<string, ScheduledTask> = new Map();
  private schedulingTimer: NodeJS.Timeout | null = null;
  private configFactory = createConfigFactory(SchedulerManagerConfigSchema);
  protected readonly config: ExtendedSchedulerManagerConfig;
  protected initialized = false;
  private batches: Map<string, TaskBatch> = new Map();
  private resourceTracker: ResourceUtilizationTracker;
  private events: SchedulerEvent[] = [];

  /**
   * Create a new DefaultSchedulerManager instance
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<ExtendedSchedulerManagerConfig>) {
    const defaultConfig = {
      enabled: true,
      maxConcurrentTasks: config.maxConcurrentTasks ?? 5,
      maxRetryAttempts: config.maxRetryAttempts ?? 3,
      defaultTaskTimeoutMs: config.defaultTaskTimeoutMs ?? 30000,
      enableAutoScheduling: config.enableAutoScheduling ?? true,
      schedulingIntervalMs: config.schedulingIntervalMs ?? 60000,
      enableTaskPrioritization: config.enableTaskPrioritization ?? true,
      enableVisualization: config.enableVisualization ?? true,
      ...config
    } as ExtendedSchedulerManagerConfig;

    super(
      agent.getAgentId() + '-scheduler-manager', 
      ManagerType.SCHEDULER, 
      agent,
      defaultConfig
    );

    this.managerId = `scheduler-manager-${uuidv4()}`;
    this.config = defaultConfig;
    
    // Initialize resource tracker
    this.resourceTracker = new ResourceUtilizationTracker({
      samplingIntervalMs: 10000,
      maxHistorySamples: 60,
      defaultLimits: {
        cpuUtilization: 0.8,
        memoryBytes: 1024 * 1024 * 512,
        tokensPerMinute: 50000,
        apiCallsPerMinute: 100
      },
      enforceResourceLimits: true,
      limitWarningBuffer: 0.2,
      trackPerTaskUtilization: true
    });
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends SchedulerManagerConfig>(config: Partial<T>): T {
    // Validate and merge configuration
    const validatedConfig = this.configFactory.create({
      ...this.config, 
      ...config
    }) as SchedulerManagerConfig;
    
    Object.assign(this.config, validatedConfig);
    return validatedConfig as T;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      // Initialize any resources needed
      this.initialized = true;
      
      // Set up the scheduling timer if auto-scheduling is enabled
      if (this.config.enableAutoScheduling) {
        this.setupSchedulingTimer();
        console.log(`[${this.managerId}] Autonomous scheduling initialized with interval ${this.config.schedulingIntervalMs}ms`);
      }
      
      return true;
    } catch (error) {
      console.error(`[${this.managerId}] Error initializing scheduler manager:`, error);
      return false;
    }
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    try {
      const tasks = await this.getTasks();
      const runningTasks = tasks.filter(task => task.status === 'running').length;
      const failedTasks = tasks.filter(task => task.status === 'failed').length;

      const status = runningTasks < (this.config.maxConcurrentTasks ?? 5) ? 'healthy' : 'degraded';
      const metrics = {
        totalTasks: tasks.length,
        runningTasks,
        failedTasks,
        availableSlots: Math.max(0, (this.config.maxConcurrentTasks ?? 5) - runningTasks)
      };

      return {
        status,
        message: `Scheduler manager is ${status}`,
        metrics,
        details: {
          lastCheck: new Date(),
          issues: failedTasks > 0 ? [{
            severity: 'medium',
            message: `${failedTasks} tasks have failed`,
            detectedAt: new Date()
          }] : []
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Failed to get scheduler health: ${error}`,
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'critical',
            message: error instanceof Error ? error.message : String(error),
            detectedAt: new Date()
          }]
        }
      };
    }
  }

  /**
   * Get active tasks
   */
  async getActiveTasks(): Promise<ScheduledTask[]> {
    return Array.from(this.tasks.values()).filter(task => 
      task.status === 'running' || task.status === 'pending'
    );
  }

  /**
   * Reset the manager state
   */
  async reset(): Promise<boolean> {
    this.tasks.clear();
    if (this.schedulingTimer) {
      clearInterval(this.schedulingTimer);
      this.schedulingTimer = null;
    }
    return super.reset();
  }

  /**
   * Shutdown the manager and release resources
   */
  async shutdown(): Promise<void> {
    if (this.schedulingTimer) {
      clearInterval(this.schedulingTimer);
      this.schedulingTimer = null;
    }
    await super.shutdown();
  }

  /**
   * Create a new scheduled task
   */
  async createTask(options: TaskCreationOptions): Promise<TaskCreationResult> {
    const failedTask: ScheduledTask = {
      id: '',
      title: '',
      description: '',
      type: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'failed',
      priority: 0,
      retryAttempts: 0,
      dependencies: [],
      metadata: {}
    };

    if (!this.initialized) {
      return {
        success: false,
        task: failedTask
      };
    }

    if (!this.config.enabled) {
      return {
        success: false,
        task: failedTask
      };
    }

    try {
      const task: ScheduledTask = {
        id: this.generateTaskId(),
        title: options.title,
        description: options.description,
        type: options.type,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending',
        priority: options.priority ?? 0.5,
        retryAttempts: 0,
        dependencies: options.dependencies ?? [],
        metadata: options.metadata ?? {}
      };
      
      this.tasks.set(task.id, task);
      
      return {
        success: true,
        task
      };
    } catch (error) {
      return {
        success: false,
        task: failedTask
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
   * Execute a task with visualization support
   */
  async executeTask(
    taskId: string, 
    visualizationContext?: {
      visualization: ThinkingVisualization,
      visualizer: VisualizationService,
      parentNodeId?: string
    }
  ): Promise<TaskExecutionResult> {
    if (!this.initialized) {
      return {
        success: false,
        taskId,
        error: 'Scheduler manager is not initialized'
      };
    }

    if (!this.config.enabled) {
      return {
        success: false,
        taskId,
        error: 'Scheduler manager is disabled'
      };
    }

    const task = await this.getTask(taskId);
    if (!task) {
      return {
        success: false,
        taskId,
        error: `Task ${taskId} not found`
      };
    }

    if (task.status === 'running') {
      return {
        success: false,
        taskId,
        error: `Task ${taskId} is already running`
      };
    }

    if (task.status === 'completed') {
      return {
        success: false,
        taskId,
        error: `Task ${taskId} is already completed`
      };
    }

    if (task.status === 'cancelled') {
      return {
        success: false,
        taskId,
        error: `Task ${taskId} is cancelled`
      };
    }

    // Create or use existing visualization context
    const useVisualization = Boolean(this.config.enableVisualization) && 
      visualizationContext && 
      visualizationContext.visualization && 
      visualizationContext.visualizer;
    
    // Generate new requestId for the task execution
    const requestId = generateRequestId();
    
    // Create visualization node for scheduled execution
    let taskNodeId: string | undefined;
    
    if (useVisualization) {
      try {
        // Create scheduled execution visualization node
        taskNodeId = visualizationContext!.visualizer.addNode(
          visualizationContext!.visualization,
          'scheduled_execution',
          `Scheduled Task: ${task.title}`,
          {
            taskId,
            title: task.title,
            description: task.description,
            type: task.type,
            priority: task.priority,
            status: 'running',
            requestId,
            timestamp: Date.now(),
            metadata: task.metadata
          },
          'in_progress'
        );
        
        // Connect to parent node if specified
        if (visualizationContext!.parentNodeId && taskNodeId) {
          visualizationContext!.visualizer.addEdge(
            visualizationContext!.visualization,
            visualizationContext!.parentNodeId,
            taskNodeId,
            'scheduled_from'
          );
        }
      } catch (error) {
        console.error('Error creating scheduled task visualization:', error);
      }
    }

    try {
      // Update task status to running
      await this.updateTask(taskId, { status: 'running' });

      const startTime = Date.now();

      // Execute the task based on task type or metadata
      let success = false;
      let result: Record<string, unknown> | null = null;
      let errorMsg: string | null = null;

      try {
        // Check for action in metadata
        const action = task.metadata?.action;
        if (action && typeof action === 'string') {
          const agent = this.getAgent();
          const parameters = (task.metadata?.parameters || {}) as { message?: string };

          if (action === 'processUserInput' && 
              parameters.message && 
              typeof parameters.message === 'string') {
            // Execute the action
            const response = await agent.processUserInput(parameters.message, {
              // Pass request ID and visualization context
              requestId,
              enableVisualization: useVisualization,
              visualizationContext: useVisualization ? {
                visualization: visualizationContext!.visualization,
                visualizer: visualizationContext!.visualizer,
                parentNodeId: taskNodeId
              } : undefined
            } as MessageProcessingOptions);
            success = true;
            // Convert response to record to ensure type safety
            result = {
              content: response.content,
              ...(response.metadata ? { metadata: response.metadata } : {}),
              ...(response.thoughts ? { thoughts: response.thoughts } : {})
            };
          } else {
            // Unknown action
            success = false;
            errorMsg = `Unknown action: ${action}`;
          }
        } else {
          // No action specified
          success = false;
          errorMsg = 'No action specified in task metadata';
        }
      } catch (execError) {
        success = false;
        errorMsg = execError instanceof Error 
          ? execError.message 
          : `Execution error: ${String(execError)}`;
      }

      const endTime = Date.now();
      const durationMs = endTime - startTime;

      // Update visualization if enabled
      if (useVisualization && taskNodeId) {
        try {
          visualizationContext!.visualizer.updateNode(
            visualizationContext!.visualization,
            taskNodeId,
            {
              status: success ? 'completed' : 'error',
              data: {
                taskId,
                title: task.title,
                status: success ? 'completed' : 'failed',
                executionTime: durationMs,
                result: success ? result : null,
                error: success ? null : errorMsg,
                timestamp: endTime
              }
            }
          );
          
          // If successful, create result node
          if (success && result) {
            const resultNodeId = visualizationContext!.visualizer.addNode(
              visualizationContext!.visualization,
              'task_result',
              `Task Result: ${task.title}`,
              {
                taskId,
                result,
                executionTime: durationMs,
                timestamp: endTime
              },
              'completed'
            );
            
            // Link result to task node
            if (resultNodeId) {
              visualizationContext!.visualizer.addEdge(
                visualizationContext!.visualization,
                taskNodeId,
                resultNodeId,
                'result'
              );
            }
          }
        } catch (error) {
          console.error('Error updating scheduled task visualization:', error);
        }
      }

      // Update task
      if (success) {
        await this.updateTask(taskId, { 
          status: 'completed', 
          updatedAt: new Date(),
          metadata: {
            ...task.metadata,
            executionTime: durationMs,
            result
          }
        });

        return {
          success: true,
          taskId,
          durationMs
        };
      } else {
        // Task failed, increment retry attempts
        const retryAttempts = (task.retryAttempts || 0) + 1;
        
        await this.updateTask(taskId, { 
          status: 'failed', 
          retryAttempts,
          updatedAt: new Date(),
          metadata: {
            ...task.metadata,
            executionTime: durationMs,
            lastError: errorMsg
          }
        });

        return {
          success: false,
          taskId,
          error: errorMsg || 'Task execution failed',
          durationMs
        };
      }
    } catch (error) {
      // Update visualization with error if enabled
      if (useVisualization && taskNodeId) {
        try {
          visualizationContext!.visualizer.updateNode(
            visualizationContext!.visualization,
            taskNodeId,
            {
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : String(error),
                timestamp: Date.now()
              }
            }
          );
        } catch (vizError) {
          console.error('Error updating task visualization with error:', vizError);
        }
      }
      
      return {
        success: false,
        taskId,
        error: error instanceof Error ? error.message : String(error)
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

    const task = await this.getTask(taskId);
    if (!task) {
      return false;
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }

    await this.updateTask(taskId, { status: 'cancelled' });
    return true;
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

      // Check if task has a scheduled time
      const scheduledTime = task.metadata?.scheduledTime;
      if (!scheduledTime) {
        return false;
      }
      
      // Parse the scheduled time (handle both Date objects and ISO strings)
      let taskTime: Date;
      
      if (scheduledTime instanceof Date) {
        taskTime = scheduledTime;
      } else if (typeof scheduledTime === 'string') {
        taskTime = new Date(scheduledTime);
      } else if (typeof scheduledTime === 'number') {
        taskTime = new Date(scheduledTime);
      } else {
        return false; // Invalid scheduledTime format
      }
      
      // Compare with current time
      return taskTime <= now;
    });
  }

  /**
   * Poll for tasks that are due and execute them
   * @returns Number of tasks executed
   */
  async pollForDueTasks(): Promise<number> {
    if (!this.initialized || !this.config.enabled) {
      return 0;
    }
    
    try {
      // Get all tasks that are due
      const dueTasks = await this.getDueTasks();
      
      // Initialize execution counter
      let executedCount = 0;
      
      // Execute each due task
      for (const task of dueTasks) {
        try {
          const result = await this.executeTask(task.id);
          if (result.success) {
            executedCount++;
            console.log(`[${this.managerId}] Successfully executed task ${task.id}: ${task.title}`);
          } else {
            console.error(`[${this.managerId}] Failed to execute task ${task.id}: ${result.error}`);
          }
        } catch (error) {
          console.error(`[${this.managerId}] Error executing task ${task.id}:`, error);
        }
      }
      
      // Return the number of tasks executed
      return executedCount;
    } catch (error) {
      console.error(`[${this.managerId}] Error polling for due tasks:`, error);
      return 0;
    }
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
      return {
        success: false,
        taskId,
        error: 'Scheduler manager is not initialized'
      };
    }

    if (!this.config.enabled) {
      return {
        success: false,
        taskId,
        error: 'Scheduler manager is disabled'
      };
    }

    const task = await this.getTask(taskId);
    if (!task) {
      return {
        success: false,
        taskId,
        error: `Task ${taskId} not found`
      };
    }

    if (task.status !== 'failed') {
      return {
        success: false,
        taskId,
        error: `Task ${taskId} is not in failed status`
      };
    }

    if (task.retryAttempts >= (this.config.maxRetryAttempts ?? 3)) {
      return {
        success: false,
        taskId,
        error: `Task ${taskId} has exceeded retry limit`
      };
    }

    return this.executeTask(taskId);
  }

  // Private helper methods

  /**
   * Setup the scheduling timer
   */
  private setupSchedulingTimer(): void {
    // Clear existing timer if any
    if (this.schedulingTimer) {
      clearInterval(this.schedulingTimer);
      this.schedulingTimer = null;
    }
    
    // Setup new timer
    this.schedulingTimer = setInterval(async () => {
      try {
        const executedCount = await this.pollForDueTasks();
        if (executedCount > 0) {
          console.log(`[${this.managerId}] Scheduling timer executed ${executedCount} due tasks`);
        }
      } catch (error) {
        console.error(`[${this.managerId}] Error in scheduling timer:`, error);
      }
    }, this.config.schedulingIntervalMs ?? 60000); // Use 1 minute as fallback
    
    // Don't keep the Node.js process running just for this timer
    if (this.schedulingTimer.unref) {
      this.schedulingTimer.unref();
    }
    
    console.log(`[${this.managerId}] Scheduling timer set up with interval ${this.config.schedulingIntervalMs ?? 60000}ms`);
  }

  async getTasks(): Promise<ScheduledTask[]> {
    return Array.from(this.tasks.values());
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getAgent(): AgentBase {
    return super.getAgent();
  }

  getConfig<T>(): T {
    return this.config as unknown as T;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): boolean {
    this.config.enabled = enabled;
    return enabled;
  }

  /**
   * Get scheduler status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    activeTasks: number;
    pendingTasks: number;
    resourceUtilization: ResourceUtilization;
  }> {
    const activeTasks = await this.getActiveTasks();
    const pendingTasks = await this.getPendingTasks();
    const resourceUtilization = this.resourceTracker.getCurrentUtilization();

    return {
      isRunning: this.isEnabled() && this.isInitialized(),
      activeTasks: activeTasks.length,
      pendingTasks: pendingTasks.length,
      resourceUtilization
    };
  }

  /**
   * List tasks with filtering
   */
  async listTasks(options: {
    status?: TaskStatus[];
    type?: string[];
    priority?: number;
    minPriority?: number;
    tags?: string[];
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
    sortBy?: 'priority' | 'createdAt' | 'updatedAt';
    sortDirection?: 'asc' | 'desc';
  } = {}): Promise<ScheduledTask[]> {
    let tasks = Array.from(this.tasks.values());

    // Apply filters
    if (options.status) {
      tasks = tasks.filter(task => options.status?.includes(task.status));
    }

    if (options.type) {
      tasks = tasks.filter(task => options.type?.includes(task.type));
    }

    if (options.priority !== undefined) {
      tasks = tasks.filter(task => task.priority === options.priority);
    }

    if (options.minPriority !== undefined) {
      tasks = tasks.filter(task => task.priority >= options.minPriority!);
    }

    if (options.tags) {
      tasks = tasks.filter(task => {
        const metadata = task.metadata as TaskMetadata;
        return options.tags?.some(tag => metadata.tags?.includes(tag));
      });
    }

    if (options.from) {
      tasks = tasks.filter(task => task.createdAt >= options.from!);
    }

    if (options.to) {
      tasks = tasks.filter(task => task.createdAt <= options.to!);
    }

    // Sort tasks
    if (options.sortBy) {
      const direction = options.sortDirection === 'desc' ? -1 : 1;
      tasks.sort((a, b) => {
        switch (options.sortBy) {
          case 'priority':
            return (b.priority - a.priority) * direction;
          case 'createdAt':
            return (b.createdAt.getTime() - a.createdAt.getTime()) * direction;
          case 'updatedAt':
            return (b.updatedAt.getTime() - a.updatedAt.getTime()) * direction;
          default:
            return 0;
        }
      });
    }

    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const offset = options.offset ?? 0;
      const limit = options.limit ?? tasks.length;
      tasks = tasks.slice(offset, offset + limit);
    }

    return tasks;
  }

  /**
   * Create a task batch
   */
  async createBatch(options: {
    tasks: TaskCreationOptions[];
    metadata?: Record<string, unknown>;
  }): Promise<TaskBatch> {
    const batch: TaskBatch = {
      id: uuidv4(),
      tasks: [],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: options.metadata
    };

    // Create all tasks
    for (const taskOptions of options.tasks) {
      const result = await this.createTask(taskOptions);
      if (result.success && result.task) {
        batch.tasks.push(result.task);
      }
    }

    // Store batch
    this.batches.set(batch.id, batch);

    // Log event
    this.logEvent({
      id: uuidv4(),
      type: 'batch_created',
      timestamp: new Date(),
      batchId: batch.id,
      details: {
        taskCount: batch.tasks.length
      }
    });

    return batch;
  }

  /**
   * List task batches
   */
  async listBatches(options: {
    status?: ('pending' | 'in_progress' | 'completed' | 'failed')[];
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<TaskBatch[]> {
    let batches = Array.from(this.batches.values());

    // Apply filters
    if (options.status) {
      batches = batches.filter(batch => options.status?.includes(batch.status));
    }

    if (options.from) {
      batches = batches.filter(batch => batch.createdAt >= options.from!);
    }

    if (options.to) {
      batches = batches.filter(batch => batch.createdAt <= options.to!);
    }

    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const offset = options.offset ?? 0;
      const limit = options.limit ?? batches.length;
      batches = batches.slice(offset, offset + limit);
    }

    return batches;
  }

  /**
   * Get a task batch
   */
  async getBatch(batchId: string): Promise<TaskBatch | null> {
    return this.batches.get(batchId) ?? null;
  }

  /**
   * Cancel a task batch
   */
  async cancelBatch(batchId: string): Promise<boolean> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return false;
    }

    // Cancel all tasks in the batch
    for (const task of batch.tasks) {
      await this.cancelTask(task.id);
    }

    // Update batch status
    batch.status = 'failed';
    batch.updatedAt = new Date();
    this.batches.set(batchId, batch);

    // Log event
    this.logEvent({
      id: uuidv4(),
      type: 'batch_failed',
      timestamp: new Date(),
      batchId,
      details: {
        reason: 'cancelled'
      }
    });

    return true;
  }

  /**
   * Pause the scheduler
   */
  async pauseScheduler(): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    this.setEnabled(false);
    if (this.schedulingTimer) {
      clearInterval(this.schedulingTimer);
      this.schedulingTimer = null;
    }

    // Log event
    this.logEvent({
      id: uuidv4(),
      type: 'scheduler_paused',
      timestamp: new Date(),
      details: {}
    });

    return true;
  }

  /**
   * Resume the scheduler
   */
  async resumeScheduler(): Promise<boolean> {
    if (this.isEnabled()) {
      return false;
    }

    this.setEnabled(true);
    this.setupSchedulingTimer();

    // Log event
    this.logEvent({
      id: uuidv4(),
      type: 'scheduler_resumed',
      timestamp: new Date(),
      details: {}
    });

    return true;
  }

  /**
   * Get current resource utilization
   */
  async getResourceUtilization(): Promise<ResourceUtilization> {
    return this.resourceTracker.getCurrentUtilization();
  }

  /**
   * Get resource utilization history
   */
  async getResourceUtilizationHistory(options?: {
    from?: Date;
    to?: Date;
    interval?: 'minute' | 'hour' | 'day';
  }): Promise<ResourceUtilization[]> {
    return this.resourceTracker.getUtilizationHistory(options);
  }

  /**
   * Set resource limits
   */
  async setResourceLimits(limits: {
    cpuUtilization?: number;
    memoryBytes?: number;
    tokensPerMinute?: number;
    apiCallsPerMinute?: number;
  }): Promise<boolean> {
    this.resourceTracker.setLimits(limits);
    return true;
  }

  /**
   * Get scheduler metrics
   */
  async getMetrics(options?: {
    from?: Date;
    to?: Date;
  }): Promise<SchedulerMetrics> {
    const tasks = await this.getTasks();
    const now = new Date();
    const period = {
      start: options?.from ?? new Date(now.getTime() - 24 * 60 * 60 * 1000), // Default to last 24 hours
      end: options?.to ?? now
    };

    // Filter tasks by period
    const periodTasks = tasks.filter(task => 
      task.createdAt >= period.start && task.createdAt <= period.end
    );

    // Calculate task metrics
    const completedTasks = periodTasks.filter(task => task.status === 'completed');
    const failedTasks = periodTasks.filter(task => task.status === 'failed');

    const taskMetrics = {
      totalTasks: periodTasks.length,
      tasksCreated: periodTasks.length,
      tasksCompleted: completedTasks.length,
      tasksFailed: failedTasks.length,
      successRate: periodTasks.length > 0 
        ? completedTasks.length / periodTasks.length 
        : 0,
      avgExecutionTime: completedTasks.length > 0
        ? completedTasks.reduce((sum, task) => {
            const metadata = task.metadata as TaskMetadata;
            return sum + (metadata.executionTime ?? 0);
          }, 0) / completedTasks.length
        : 0,
      avgWaitTime: periodTasks.length > 0
        ? periodTasks.reduce((sum, task) => {
            const metadata = task.metadata as TaskMetadata;
            return sum + (metadata.waitTime ?? 0);
          }, 0) / periodTasks.length
        : 0
    };

    // Get resource metrics
    const resourceHistory = await this.getResourceUtilizationHistory(options);
    const resourceMetrics = {
      avgCpuUtilization: resourceHistory.reduce((sum, sample) => 
        sum + sample.cpuUtilization, 0) / resourceHistory.length,
      peakCpuUtilization: Math.max(...resourceHistory.map(sample => 
        sample.cpuUtilization)),
      avgMemoryUsage: resourceHistory.reduce((sum, sample) => 
        sum + sample.memoryBytes, 0) / resourceHistory.length,
      peakMemoryUsage: Math.max(...resourceHistory.map(sample => 
        sample.memoryBytes)),
      totalTokensConsumed: resourceHistory.reduce((sum, sample) => 
        sum + sample.tokensPerMinute, 0),
      totalApiCalls: resourceHistory.reduce((sum, sample) => 
        sum + sample.apiCallsPerMinute, 0)
    };

    return {
      period,
      taskMetrics,
      resourceMetrics
    };
  }

  /**
   * Get scheduler events
   */
  async getEvents(options?: {
    type?: SchedulerEvent['type'][];
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<SchedulerEvent[]> {
    let events = [...this.events];

    // Apply filters
    if (options?.type) {
      events = events.filter(event => options.type?.includes(event.type));
    }

    if (options?.from) {
      events = events.filter(event => event.timestamp >= options.from!);
    }

    if (options?.to) {
      events = events.filter(event => event.timestamp <= options.to!);
    }

    // Apply pagination
    if (options?.offset !== undefined || options?.limit !== undefined) {
      const offset = options.offset ?? 0;
      const limit = options.limit ?? events.length;
      events = events.slice(offset, offset + limit);
    }

    return events;
  }

  /**
   * Log a scheduler event
   */
  private logEvent(event: SchedulerEvent): void {
    this.events.push(event);

    // Keep only the last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }
} 