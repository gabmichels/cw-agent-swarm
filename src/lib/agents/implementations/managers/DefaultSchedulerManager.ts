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
import { MemoryManager } from '../../base/managers/MemoryManager';
import { MemoryService } from './DefaultMemoryManager';
import { getManagerLogger } from '../../../logging/winston-logger';

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
  logSchedulingActivity?: boolean;
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
  private logger: ReturnType<typeof getManagerLogger>;

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
      schedulingIntervalMs: config.schedulingIntervalMs ?? 30000,
      enableTaskPrioritization: config.enableTaskPrioritization ?? true,
      enableVisualization: config.enableVisualization ?? true,
      logSchedulingActivity: config.logSchedulingActivity ?? true,
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
    
    // Initialize the winston logger
    this.logger = getManagerLogger(this.managerId, agent.getAgentId());
    
    this.logger.info(`Scheduler manager created with ID: ${this.managerId}`);
    this.logger.debug(`Scheduler config: ${JSON.stringify(this.config)}`);
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
    this.logger.info(`Initializing scheduler manager at ${new Date().toISOString()}...`);
    if (this.initialized) {
      return true;
    }

    try {
      // Load any existing tasks from database
      this.logger.info(`About to load tasks from database at ${new Date().toISOString()}`);
      
      // Try to load tasks but don't fail initialization if it fails
      // The reason is that memory manager might not be ready yet during bootstrapping
      try {
        await this.loadTasksFromDatabase();
        this.logger.info(`Completed loading tasks from database at ${new Date().toISOString()}`);
      } catch (loadError) {
        this.logger.warn(`Could not load tasks during initialization (memory manager might not be ready)`, { error: loadError });
        this.logger.info(`Will retry loading tasks in 5 seconds`);
        
        // Schedule a retry after a short delay (memory manager might be ready then)
        setTimeout(() => {
          this.logger.info(`Retrying loadTasksFromDatabase after initialization delay...`);
          this.loadTasksFromDatabase().catch(err => {
            this.logger.error(`Error in delayed loadTasksFromDatabase:`, { error: err });
          });
        }, 5000);
      }
      
      // Initialize any resources needed
      this.initialized = true;
      
      // Set up the scheduling timer if auto-scheduling is enabled
      if (this.config.enableAutoScheduling) {
        this.logger.info(`Setting up scheduling timer at ${new Date().toISOString()}`);
        this.setupSchedulingTimer();
        this.logger.success(`Autonomous scheduling initialized with interval ${this.config.schedulingIntervalMs}ms`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error initializing scheduler manager:`, { error });
      return false;
    }
  }

  /**
   * Load tasks from database
   */
  private async loadTasksFromDatabase(): Promise<void> {
    try {
      const agent = this.getAgent();
      const agentId = agent.getAgentId();
      
      // Get memory manager if it exists
      const memoryManager = agent.getManager(ManagerType.MEMORY);
      
      // Debug the memory manager to see if it exists
      this.logger.info(`DEBUG: Memory manager exists: ${Boolean(memoryManager)}, type: ${memoryManager ? memoryManager.managerType : 'none'}`);
      
      // Check if it's the expected type
      if (memoryManager) {
        this.logger.debug(`Memory manager methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(memoryManager)).join(', ')}`);
      }
      
      if (!memoryManager) {
        this.logger.warn(`No memory manager available for agent ${agentId}, cannot load tasks from database`);
        return;
      }
      
      // Check if the memory manager appears to be fully initialized
      const isMemoryManagerInitialized = 'getMemoryService' in memoryManager && 
          typeof (memoryManager as any).getMemoryService === 'function';
      
      if (!isMemoryManagerInitialized) {
        this.logger.warn(`Memory manager found for agent ${agentId} but it doesn't seem to be fully initialized yet. Will retry later.`);
        
        // Schedule a retry in 5 seconds
        setTimeout(() => {
          this.logger.info(`Retrying loadTasksFromDatabase after delay for agent ${agentId}...`);
          this.loadTasksFromDatabase().catch(err => {
            this.logger.error(`Error in delayed loadTasksFromDatabase for agent ${agentId}:`, { error: err });
          });
        }, 5000);
        
        return;
      }

      this.logger.info(`Loading tasks from database for agent ${agentId}...`);
      
      // Try to load tasks from memory service
      try {
        // Cast the memory manager to include the getMemoryService method
        const memoryServiceProvider = memoryManager as unknown as { getMemoryService(): Promise<MemoryService> };
        
        this.logger.debug(`Attempting to call getMemoryService method for agent ${agentId}`);
        
        // Wrap in a timeout promise to avoid hanging if the memory service is not ready
        const memoryServicePromise = Promise.race([
          memoryServiceProvider.getMemoryService(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('getMemoryService timed out after 3 seconds')), 3000);
          })
        ]);
        
        const memoryService = await memoryServicePromise;
        this.logger.debug(`MemoryService obtained successfully for agent ${agentId}`);
        
        this.logger.info(`Querying memory service for scheduled tasks (status: pending, scheduled, in_progress)`);
        
        const result = await memoryService.searchMemories({
          type: 'task',
          filter: {
            status: ['pending', 'scheduled', 'in_progress']
          },
          limit: 1000
        });
        
        this.logger.debug(`Search result success: ${result.success}, data length: ${result.data?.length || 0}`);
        
        if (result.success && result.data && result.data.length > 0) {
          this.logger.success(`Found ${result.data.length} tasks in database to load for agent ${agentId}`);
          
          // Convert database items to scheduler tasks
          const convertedTasks = this.convertMemoryItemsToTasks(result.data);
          
          // Add tasks to local store
          for (const task of convertedTasks) {
            this.tasks.set(task.id, task);
            this.logger.info(`Loaded task: ${task.id} - ${task.title} (${task.status})`);
          }
          
          this.logger.success(`✅ Successfully loaded ${convertedTasks.length} tasks from database for agent ${agentId}`);
          return;
        } else {
          this.logger.info(`No pending tasks found in database for agent ${agentId} ${result.error ? `(Error: ${result.error})` : ''}`);
        }
      } catch (error) {
        // Check if it's a timeout error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('timed out')) {
          this.logger.warn(`Memory service not ready yet for agent ${agentId}: ${errorMessage}`);
          
          // Schedule another retry
          setTimeout(() => {
            this.logger.info(`Retrying loadTasksFromDatabase after timeout for agent ${agentId}...`);
            this.loadTasksFromDatabase().catch(err => {
              this.logger.error(`Error in retry after timeout for agent ${agentId}:`, { error: err });
            });
          }, 5000);
          
          return;
        }
        
        this.logger.error(`Error querying memory service for agent ${agentId}:`, { error });
        throw error; // Re-throw to allow caller to handle it
      }
      
      this.logger.info(`No tasks loaded from database for agent ${agentId}`);
    } catch (error) {
      this.logger.error(`Error loading tasks from database:`, { error });
      throw error; // Re-throw to allow caller to handle it
    }
  }
  
  /**
   * Convert memory items to scheduler tasks
   */
  private convertMemoryItemsToTasks(memoryItems: Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  }>): ScheduledTask[] {
    return memoryItems.map(item => {
      const metadata = item.metadata || {};
      
      // Parse dates safely
      const createdAt = this.parseDateSafely(item.createdAt);
      const updatedAt = this.parseDateSafely(item.updatedAt);
      
      return {
        id: item.id,
        title: typeof metadata.title === 'string' ? metadata.title : item.content.substring(0, 100),
        description: typeof metadata.description === 'string' ? metadata.description : item.content,
        type: typeof metadata.type === 'string' ? metadata.type : 'system',
        createdAt,
        updatedAt,
        status: typeof metadata.status === 'string' ? metadata.status as TaskStatus : 'pending',
        priority: typeof metadata.priority === 'number' ? metadata.priority : 0.5,
        retryAttempts: typeof metadata.retryAttempts === 'number' ? metadata.retryAttempts : 0,
        dependencies: Array.isArray(metadata.dependencies) ? metadata.dependencies as string[] : [],
        metadata
      };
    });
  }
  
  /**
   * Safely parse a date value
   */
  private parseDateSafely(dateValue: unknown): Date {
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    if (typeof dateValue === 'string') {
      try {
        return new Date(dateValue);
      } catch (e) {
        // Fall back to current time if parsing fails
        return new Date();
      }
    }
    
    if (typeof dateValue === 'number') {
      return new Date(dateValue);
    }
    
    // Default to current time if no valid date
    return new Date();
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
      this.logger.error(`Cannot execute task ${taskId}: scheduler manager is not initialized`);
      return {
        success: false,
        taskId,
        error: 'Scheduler manager is not initialized'
      };
    }

    if (!this.config.enabled) {
      this.logger.error(`Cannot execute task ${taskId}: scheduler manager is disabled`);
      return {
        success: false,
        taskId,
        error: 'Scheduler manager is disabled'
      };
    }

    this.logger.info(`Attempting to execute task ${taskId}...`);

    const task = await this.getTask(taskId);
    if (!task) {
      this.logger.error(`Task ${taskId} not found for execution`);
      return {
        success: false,
        taskId,
        error: `Task ${taskId} not found`
      };
    }

    this.logger.info(`Executing task ${taskId}: "${task.title}" with status ${task.status}`);
    this.logger.debug(`Task metadata: ${JSON.stringify(task.metadata || {})}`);

    if (task.status === 'running') {
      this.logger.warn(`Task ${taskId} is already running`);
      return {
        success: false,
        taskId,
        error: `Task ${taskId} is already running`
      };
    }

    if (task.status === 'completed') {
      this.logger.warn(`Task ${taskId} is already completed`);
      return {
        success: false,
        taskId,
        error: `Task ${taskId} is already completed`
      };
    }

    if (task.status === 'cancelled') {
      this.logger.warn(`Task ${taskId} is cancelled`);
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
        this.logger.error('Error creating scheduled task visualization:', { error });
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
          this.logger.error(`Error updating scheduled task visualization:`, { error });
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
            lastExecutionTime: endTime,
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
          this.logger.error('Error updating task visualization with error:', { error: vizError });
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

    const agentId = this.getAgent().getAgentId();
    const now = new Date();
    const nowTime = now.getTime();

    this.logger.info(`[${agentId}] Checking for due tasks at ${now.toISOString()}, epoch: ${nowTime}`);
    this.logger.info(`[${agentId}] Total tasks in queue: ${this.tasks.size}`);
    
    // Debug: list all task status
    if (this.tasks.size > 0) {
      this.logger.debug(`[${agentId}] Current tasks status:`);
      Array.from(this.tasks.entries()).forEach(([id, task]) => {
        this.logger.debug(`[${agentId}] Task ${id}: status=${task.status}, created=${task.createdAt.toISOString()}, type=${task.type}, metadata=${JSON.stringify(task.metadata || {})}`);
      });
    } else {
      this.logger.info(`[${agentId}] No tasks in queue to check`);
    }

    const dueTasks = Array.from(this.tasks.values()).filter(task => {
      // Check if task is pending or scheduled
      if (task.status !== 'pending' && task.status !== 'scheduled') {
        return false;
      }

      // Method 1: Check for scheduledTime (explicit scheduled time)
      const scheduledTime = task.metadata?.scheduledTime;
      if (scheduledTime) {
        // Parse the scheduled time (handle both Date objects and ISO strings)
        let taskTime: Date;
        
        if (scheduledTime instanceof Date) {
          taskTime = scheduledTime;
        } else if (typeof scheduledTime === 'string') {
          taskTime = new Date(scheduledTime);
        } else if (typeof scheduledTime === 'number') {
          taskTime = new Date(scheduledTime);
        } else {
          this.logger.warn(`[${agentId}] Task ${task.id} has invalid scheduledTime format: ${typeof scheduledTime}`);
          return false; // Invalid scheduledTime format
        }
        
        // Compare with current time
        const isDue = taskTime <= now;
        
        if (isDue) {
          this.logger.info(`[${agentId}] Scheduled task ${task.id} is due. Scheduled for: ${taskTime.toISOString()}, Current time: ${now.toISOString()}`);
        } else {
          this.logger.debug(`[${agentId}] Scheduled task ${task.id} is not yet due. Scheduled for: ${taskTime.toISOString()}, Current time: ${now.toISOString()}`);
        }
        
        return isDue;
      }
      
      // Method 2: Check for interval-based scheduling
      const metadata = task.metadata || {};
      const scheduleType = metadata.scheduleType;
      
      if (scheduleType === 'interval') {
        if (!task.createdAt) {
          this.logger.error(`[${agentId}] Task ${task.id} missing createdAt timestamp`);
          return false;
        }
        
        // Handle date/time more safely
        let createdAt: number;
        try {
          createdAt = task.createdAt instanceof Date ? task.createdAt.getTime() : new Date(task.createdAt).getTime();
        } catch (e) {
          this.logger.error(`[${agentId}] Error parsing createdAt for task ${task.id}:`, { error: e });
          return false;
        }
        
        const startAfterMs = typeof metadata.startAfterMs === 'number' ? metadata.startAfterMs : 0;
        const intervalMs = typeof metadata.intervalMs === 'number' ? metadata.intervalMs : 0;
        
        if (intervalMs <= 0) {
          this.logger.warn(`[${agentId}] Task ${task.id} has invalid interval: ${intervalMs}ms`);
          return false; // Invalid interval
        }
        
        // Get the last execution time, or the creation time + startAfter if never executed
        let lastExecution: number;
        if (metadata.lastExecutionTime) {
          if (typeof metadata.lastExecutionTime === 'number') {
            lastExecution = metadata.lastExecutionTime;
          } else if (typeof metadata.lastExecutionTime === 'string') {
            try {
              lastExecution = new Date(metadata.lastExecutionTime).getTime();
            } catch (e) {
              this.logger.error(`[${agentId}] Error parsing lastExecutionTime string for task ${task.id}:`, { error: e });
              lastExecution = createdAt + startAfterMs;
            }
          } else if (metadata.lastExecutionTime instanceof Date) {
            lastExecution = metadata.lastExecutionTime.getTime();
          } else {
            lastExecution = createdAt + startAfterMs;
          }
        } else {
          lastExecution = createdAt + startAfterMs;
        }
        
        // Check if it's time to run again based on the interval
        const shouldRunAt = lastExecution + intervalMs;
        const isDue = nowTime >= shouldRunAt;
        
        // Always log interval task status for debug purposes
        if (isDue) {
          this.logger.info(`[${agentId}] Interval task ${task.id} is due. Created at ${new Date(createdAt).toISOString()}, last execution at ${new Date(lastExecution).toISOString()}, should run at ${new Date(shouldRunAt).toISOString()}, current time: ${now.toISOString()}`);
        } else {
          this.logger.debug(`[${agentId}] Interval task ${task.id} not yet due. Created at ${new Date(createdAt).toISOString()}, last execution at ${new Date(lastExecution).toISOString()}, should run at ${new Date(shouldRunAt).toISOString()}, current time: ${now.toISOString()}`);
        }
        
        return isDue;
      }
      
      this.logger.debug(`[${agentId}] Task ${task.id} has no recognized scheduling method`);
      
      // Not scheduled by any recognized method
      return false;
    });
    
    if (dueTasks.length > 0) {
      this.logger.success(`[${agentId}] Found ${dueTasks.length} due tasks out of ${this.tasks.size} total tasks`);
    } else {
      this.logger.info(`[${agentId}] No due tasks found among ${this.tasks.size} total tasks`);
    }
    
    return dueTasks;
  }

  /**
   * Set up the scheduling timer to periodically check for tasks
   */
  private setupSchedulingTimer(): void {
    const agentId = this.getAgent().getAgentId();
    this.logger.info(`[${agentId}] Setting up scheduling timer...`);
    
    if (this.schedulingTimer) {
      this.logger.info(`[${agentId}] Clearing existing timer before setting up a new one`);
      clearInterval(this.schedulingTimer);
      this.schedulingTimer = null;
    }

    if (!this.config.enableAutoScheduling) {
      this.logger.info(`[${agentId}] Auto-scheduling is disabled, not setting up timer`);
      return;
    }

    const intervalMs = this.config.schedulingIntervalMs || 60000;
    
    this.logger.info(`[${agentId}] Setting up scheduling timer with interval ${intervalMs}ms`);
    this.logger.info(`[${agentId}] Autonomous scheduling initialized with interval ${intervalMs}ms at ${new Date().toISOString()}`);
    
    // Log the current tasks count for debugging
    const totalTasks = this.tasks.size;
    if (totalTasks > 0) {
      this.logger.success(`[${agentId}] Agent has ${totalTasks} tasks loaded and ready for scheduling`);
      // Log task IDs for easier tracking
      const taskIds = Array.from(this.tasks.keys()).join(', ');
      this.logger.debug(`[${agentId}] Task IDs: ${taskIds}`);
    } else {
      this.logger.info(`[${agentId}] Agent has no tasks loaded yet`);
      
      // If we have no tasks, try to load them again after a delay (memory manager might be ready by then)
      this.logger.info(`[${agentId}] Scheduling a delayed task loading attempt in 10 seconds`);
      setTimeout(() => {
        this.logger.info(`[${agentId}] Attempting to load tasks from database after a delay...`);
        this.loadTasksFromDatabase()
          .then(result => {
            const newTaskCount = this.tasks.size;
            if (newTaskCount > 0) {
              this.logger.success(`[${agentId}] Successfully loaded ${newTaskCount} tasks after delay`);
            } else {
              this.logger.warn(`[${agentId}] Still no tasks loaded after delay`);
            }
          })
          .catch(error => {
            this.logger.error(`[${agentId}] Error loading tasks from database after delay:`, { error });
          });
      }, 10000); // 10 second delay
    }
    
    // Run immediately to check for any tasks that are already due
    this.logger.info(`[${agentId}] Scheduling initial task check in 5 seconds`);
    setTimeout(async () => {
      try {
        this.logger.info(`[${agentId}] Running initial task check at ${new Date().toISOString()}...`);
        const dueTaskCount = await this.pollForDueTasks();
        
        if (dueTaskCount > 0) {
          this.logger.success(`[${agentId}] Initial task check found ${dueTaskCount} due tasks`);
        } else {
          this.logger.info(`[${agentId}] Initial task check found no due tasks`);
        }
      } catch (error) {
        this.logger.error(`[${agentId}] Error in initial scheduled task check:`, { error });
      }
    }, 5000); // Run 5 seconds after initialization to ensure everything is ready
    
    // Set up regular interval check
    this.logger.info(`[${agentId}] Setting up recurring task check every ${intervalMs}ms`);
      this.schedulingTimer = setInterval(async () => {
        try {
        this.logger.info(`[${agentId}] Running scheduled task check at ${new Date().toISOString()}...`);
          const dueTaskCount = await this.pollForDueTasks();
          
          if (dueTaskCount > 0) {
          this.logger.success(`[${agentId}] Found and processed ${dueTaskCount} due tasks`);
          } else if (this.config.logSchedulingActivity) {
          this.logger.info(`[${agentId}] No due tasks found during scheduled check`);
          }
        } catch (error) {
        this.logger.error(`[${agentId}] Error in scheduled task processing:`, { error });
        }
      }, intervalMs);
    
    this.logger.success(`[${agentId}] Scheduling timer successfully set up at ${new Date().toISOString()}`);
  }

  /**
   * Poll for due tasks and execute them
   */
  async pollForDueTasks(): Promise<number> {
    const agentId = this.getAgent().getAgentId();
    
    if (!this.initialized || !this.config.enabled) {
      this.logger.warn(`Scheduler for agent ${agentId} not initialized or disabled. Cannot poll for tasks.`);
      return 0;
    }

    try {
      // Log the polling attempt with more context
      this.logger.info(`[${agentId}] Checking for scheduled tasks to execute at ${new Date().toISOString()}...`);
      
      // Get tasks that are due for execution
      const dueTasks = await this.getDueTasks();
      
      this.logger.info(`[${agentId}] Found ${dueTasks.length} executable scheduled tasks`);

      if (dueTasks.length === 0) {
        // Log task count if none are due
        const totalTasks = this.tasks.size;
        this.logger.debug(`[${agentId}] No executable tasks among ${totalTasks} total tasks`);
        return 0;
      }
      
      // Log the IDs of due tasks
      const taskIds = dueTasks.map(task => task.id).join(', ');
      this.logger.debug(`[${agentId}] Due task IDs: ${taskIds}`);

      // Check if we can execute more tasks
      const runningTasks = await this.getRunningTasks();
      const maxConcurrent = this.config.maxConcurrentTasks || 5;
      
      if (runningTasks.length >= maxConcurrent) {
        this.logger.info(`[${agentId}] Maximum concurrent tasks (${maxConcurrent}) reached. Currently running: ${runningTasks.length}`);
        return 0;
      }

      // Sort by priority if enabled
      let tasksToExecute = dueTasks;
      if (this.config.enableTaskPrioritization) {
        tasksToExecute = dueTasks.sort((a, b) => b.priority - a.priority);
        this.logger.debug(`[${agentId}] Tasks sorted by priority`);
      }

      // Limit to available slots
      const availableSlots = maxConcurrent - runningTasks.length;
      tasksToExecute = tasksToExecute.slice(0, availableSlots);
      this.logger.info(`[${agentId}] Executing ${tasksToExecute.length} tasks (${availableSlots} slots available)`);

      // Execute due tasks
      let executedCount = 0;
      for (const task of tasksToExecute) {
        // Update status to running
        await this.updateTask(task.id, { status: 'running' });
        
        // Log task execution with more details
        this.logger.info(`[${agentId}] Executing task ${task.id}: "${task.title}" (type: ${task.type}, priority: ${task.priority})`);
        
        // Execute in background to not block the scheduling loop
        this.executeTask(task.id)
          .then(result => {
            if (result.success) {
              this.logger.success(`[${agentId}] Task ${task.id} executed successfully in ${result.durationMs}ms`);
            } else {
              this.logger.error(`[${agentId}] Task ${task.id} execution failed: ${result.error}`);
            }
          })
          .catch(error => {
            this.logger.error(`[${agentId}] Unexpected error executing task ${task.id}:`, { error });
          });
        
        executedCount++;
      }

      return executedCount;
    } catch (error) {
      this.logger.error(`[${agentId}] Error polling for due tasks:`, { error });
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

  /**
   * Get all tasks (used internally and to implement the SchedulerManager interface)
   */
  async getTasks(): Promise<ScheduledTask[]> {
    return Array.from(this.tasks.values());
  }

  /**
   * Generate a unique task ID
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

  /**
   * Helper method for enabled state
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Helper method for setting enabled state
   */
  setEnabled(enabled: boolean): boolean {
    this.config.enabled = enabled;
    return enabled;
  }

  /**
   * Helper method for checking initialization state
   */
  isInitialized(): boolean {
    return this.initialized;
  }
} 