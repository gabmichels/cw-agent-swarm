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
    try {
      this.logger.info(`Initializing scheduler manager at ${new Date().toISOString()}...`);
      
      // Load tasks from database
      this.logger.info(`About to load tasks from database at ${new Date().toISOString()}`);
      await this.loadTasksFromDatabase();
      this.logger.info(`Completed loading tasks from database at ${new Date().toISOString()}`);
      
      // Set up scheduling timer
      this.logger.info(`Setting up scheduling timer at ${new Date().toISOString()}`);
      this.setupSchedulingTimer();
      
      // Verify tasks were loaded
      this.logger.success(`Scheduler initialized with ${this.tasks.size} tasks in queue`);
      
      // Mark as initialized - CRITICAL
      this.initialized = true;
      
      return true;
    } catch (error) {
      // Format error for logger
      const errorObj = typeof error === 'object' && error !== null 
        ? error as Record<string, any>
        : { message: String(error) };
      
      this.logger.error('Error initializing scheduler manager', errorObj);
      return false;
    }
  }

  /**
   * Load tasks from the database into memory
   */
  async loadTasksFromDatabase(): Promise<boolean> {
    try {
      this.logger.info(`Loading tasks from database for agent ${this.agent.getAgentId()}...`);
      
      // Track existing tasks count
      const initialTaskCount = this.tasks.size;
      
      // Get memory manager reference
      const memoryManager = this.agent.getManager(ManagerType.MEMORY);
      this.logger.info(`DEBUG: Memory manager exists: ${!!memoryManager}, type: ${memoryManager?.managerType}`);
      
      if (!memoryManager) {
        this.logger.error('Cannot load tasks from database: Memory manager not available');
        return false;
      }
      
      // Query the memory service for scheduled tasks
      this.logger.info(`Querying memory service for scheduled tasks (status: pending, scheduled, in_progress)`);
      
      try {
        // Try direct access to memory client first (most efficient)
        const memoryAPI = memoryManager as any;
        
        // Log tasks that we find for debugging
        let foundTasks = 0;
        let newTasks = 0;
        
        // APPROACH 1: Use specialized method if available
        if (typeof memoryAPI.getTasksByStatus === 'function') {
          this.logger.info('Using dedicated getTasksByStatus method for efficient task loading');
          
          try {
            // Get all relevant task statuses
            const taskStatuses = ['pending', 'scheduled', 'in_progress'];
            const tasks = await memoryAPI.getTasksByStatus(taskStatuses);
            
            if (Array.isArray(tasks) && tasks.length > 0) {
              this.logger.success(`Found ${tasks.length} tasks via getTasksByStatus method`);
              foundTasks += tasks.length;
              
              // Process each task
              for (const task of tasks) {
                if (!task.id || this.tasks.has(task.id)) continue;
                
                // Ensure proper status
                let taskStatus: TaskStatus = 'pending';
                if (task.status === 'scheduled' || 
                    task.status === 'in_progress' || 
                    task.status === 'completed' || 
                    task.status === 'failed' || 
                    task.status === 'cancelled') {
                  taskStatus = task.status as TaskStatus;
                }
                
                // Create task object
                const taskData: ScheduledTask = {
                  id: task.id,
                  title: task.title || '',
                  description: task.description || '',
                  type: task.type || 'task',
                  status: taskStatus,
                  priority: task.priority || 0.5,
                  createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
                  updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date(),
                  retryAttempts: task.retryAttempts || 0,
                  dependencies: task.dependencies || [],
                  metadata: task.metadata || {}
                };
                
                // Add task to map
                this.tasks.set(taskData.id, taskData);
                newTasks++;
              }
            }
          } catch (taskError) {
            const errorObj = typeof taskError === 'object' && taskError !== null 
              ? taskError as Record<string, any>
              : { message: String(taskError) };
            
            this.logger.error('Error getting tasks via getTasksByStatus:', errorObj);
          }
        }
        
        // APPROACH 2: Try client approach
        if (this.tasks.size === 0 && typeof memoryAPI.getMemoryClient === 'function') {
          this.logger.info('Using direct memory client access for task loading');
          
          try {
            const memoryClient = await memoryAPI.getMemoryClient();
            
            if (memoryClient) {
              // If we have direct client access, do a diagnostic check for tasks
              await this.readTasksDirectly();
            } else {
              this.logger.warn('Memory client not found in memory service');
            }
          } catch (clientError) {
            const errorObj = typeof clientError === 'object' && clientError !== null 
              ? clientError as Record<string, any>
              : { message: String(clientError) };
            
            this.logger.error('Error accessing memory client:', errorObj);
          }
        }
        
        // APPROACH 3: Try search based methods as fallback
        if (this.tasks.size === 0) {
          this.logger.info('Falling back to standard memory search for tasks');
          
          try {
            if (typeof memoryAPI.searchMemories === 'function') {
              this.logger.info('Searching for all tasks');
              
              // Use empty string query to avoid the trim() error
              const searchResult = await memoryAPI.searchMemories("", {
                type: 'task',
                filter: {
                  type: 'task'
                },
                limit: 1000
              });
              
              if (searchResult?.success && searchResult?.data?.length > 0) {
                this.logger.success(`Found ${searchResult.data.length} tasks in general search`);
                foundTasks += searchResult.data.length;
                
                // Process tasks into our memory
                for (const item of searchResult.data) {
                  if (!item || !item.metadata) continue;
                  
                  // Extract task fields from metadata
                  const metadata = item.metadata;
                  
                  // If item has task ID and we don't already have it
                  if (metadata.id && !this.tasks.has(metadata.id)) {
                    // Build task object
                    const taskData: ScheduledTask = {
                      id: metadata.id,
                      title: metadata.title || '',
                      description: metadata.description || '',
                      type: metadata.type || 'task',
                      status: metadata.status as TaskStatus || 'pending',
                      priority: metadata.priority || 0.5,
                      createdAt: metadata.createdAt ? new Date(metadata.createdAt) : new Date(),
                      updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : new Date(),
                      retryAttempts: metadata.retryAttempts || 0,
                      dependencies: metadata.dependencies || [],
                      metadata: metadata
                    };
                    
                    // Add to task map
                    this.tasks.set(taskData.id, taskData);
                    newTasks++;
                  }
                }
              } else {
                this.logger.info(`General task search returned no results`);
              }
            }
          } catch (searchError) {
            const errorObj = typeof searchError === 'object' && searchError !== null 
              ? searchError as Record<string, any>
              : { message: String(searchError) };
            
            this.logger.error('Error in general task search:', errorObj);
          }
        }
        
        // Create test task if we still have no tasks
        if (this.tasks.size === 0) {
          this.logger.info(`No tasks found, creating test tasks...`);
          
          // Create test task
          const testTask = {
            id: `task-test-${Date.now()}`,
            title: 'Test Task',
            description: 'This is a test task',
            type: 'test',
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'pending' as TaskStatus,
            priority: 0.5,
            retryAttempts: 0,
            dependencies: [],
            metadata: {
              isTestTask: true
            }
          };
          
          // Add to local map
          this.tasks.set(testTask.id, testTask);
          
          // Store in database
          await this.storeTaskInMemory(testTask);
          
          this.logger.success(`Created test task: ${testTask.id}`);
          newTasks++;
        }
        
        // Final summary
        this.logger.info(`Task loading summary: Found ${foundTasks} tasks, added ${newTasks} new tasks`);
        this.logger.info(`Current task count: ${this.tasks.size} (started with ${initialTaskCount})`);
        
        // Return success if we have any tasks, otherwise follow-up with direct method
        return this.tasks.size > 0;
        
      } catch (error) {
        const errorObj = typeof error === 'object' && error !== null 
          ? error as Record<string, any>
          : { message: String(error) };
        
        this.logger.error('Error loading tasks:', errorObj);
        return false;
      }
    } catch (error) {
      const errorObj = typeof error === 'object' && error !== null 
        ? error as Record<string, any>
        : { message: String(error) };
      
      this.logger.error('Error in loadTasksFromDatabase:', errorObj);
      return false;
    }
  }

  /**
   * Process task results from memory search and add to local task registry
   * This version is enhanced to handle multiple task formats 
   */
  private processTaskResults(items: any[]): boolean {
    // Process returned items
    let loadedTasks = 0;
    const previousTaskCount = this.tasks.size;
    
    for (const item of items) {
      try {
        // Extract the task data from the memory item
        let taskData: ScheduledTask | undefined;
        
        // Check different possible locations where task might be stored
        if (item.metadata?.task) {
          // Case 1: Task is stored in metadata.task (new format)
          taskData = item.metadata.task as ScheduledTask;
        } else if (item.status && item.title) {
          // Case 2: Task data is at root level
          taskData = {
            id: item.id,
            title: item.title || '',
            description: item.description || '',
            type: item.type || 'default',
            createdAt: this.ensureDate(item.createdAt),
            updatedAt: this.ensureDate(item.updatedAt),
            status: item.status,
            priority: item.priority || 0.5,
            retryAttempts: item.retryAttempts || 0,
            dependencies: item.dependencies || [],
            metadata: item.metadata || {}
          };
        } else if (item.metadata?.status && item.metadata?.title) {
          // Case 3: All task fields are in metadata
          taskData = {
            id: item.id,
            title: item.metadata.title || '',
            description: item.metadata.description || '',
            type: item.metadata.taskType || 'default',
            createdAt: this.ensureDate(item.metadata.createdAt),
            updatedAt: this.ensureDate(item.metadata.updatedAt),
            status: item.metadata.status,
            priority: item.metadata.priority || 0.5,
            retryAttempts: item.metadata.retryAttempts || 0,
            dependencies: item.metadata.dependencies || [],
            metadata: item.metadata || {}
          };
        } else if (item.payload) {
          // Case 4: Task data is in payload (from direct client access)
          const payload = item.payload;
          taskData = {
            id: item.id || payload.id,
            title: payload.title || '',
            description: payload.description || '',
            type: payload.type || 'default',
            createdAt: this.ensureDate(payload.createdAt),
            updatedAt: this.ensureDate(payload.updatedAt),
            status: payload.status || 'pending',
            priority: payload.priority || 0.5,
            retryAttempts: payload.retryAttempts || 0,
            dependencies: payload.dependencies || [],
            metadata: payload.metadata || {}
          };
        }
        
        if (!taskData) {
          this.logger.warn(`Invalid task data found in database for item ${item.id}`);
          continue;
        }
        
        // Ensure task has valid dates
        if (!(taskData.createdAt instanceof Date)) {
          taskData.createdAt = this.ensureDate(taskData.createdAt);
        }
        
        if (!(taskData.updatedAt instanceof Date)) {
          taskData.updatedAt = this.ensureDate(taskData.updatedAt);
        }
        
        // Add to local task registry
        this.tasks.set(taskData.id, taskData);
        loadedTasks++;
      } catch (parseError) {
        this.logger.error(`Error parsing task data for ${item.id}:`, 
          typeof parseError === 'object' && parseError !== null
            ? parseError
            : { error: String(parseError) }
        );
      }
    }
    
    const totalNow = this.tasks.size;
    this.logger.info(`Loaded ${loadedTasks} tasks from database (${previousTaskCount} → ${totalNow} total tasks) for agent ${this.agent.getAgentId()}`);
    return loadedTasks > 0;
  }

  /**
   * Ensure the value is a Date object
   */
  private ensureDate(value: any): Date {
    if (value instanceof Date) {
      return value;
    }
    
    if (typeof value === 'string') {
      try {
        return new Date(value);
      } catch (e) {
        return new Date();
      }
    }
    
    if (typeof value === 'number') {
      return new Date(value);
    }
    
    return new Date();
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
   * Creates a new task with the specified options
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
      // Generate a unique task ID
      const taskId = this.generateTaskId();
      
      // Create task with provided options
      const task: ScheduledTask = {
        id: taskId,
        title: options.title,
        description: options.description || '',
        type: options.type || 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending',
        priority: options.priority !== undefined ? options.priority : 0.5,
        retryAttempts: 0,
        dependencies: options.dependencies || [],
        metadata: options.metadata || {}
      };
      
      // Add to local task registry first
      this.tasks.set(taskId, task);
      
      // Store in database using our optimized method
      await this.storeTaskInMemory(task);
      
      // After delay, try to load tasks from database to ensure we have all tasks
      // This helps synchronize multiple scheduler instances
      setTimeout(() => {
        this.logger.info(`[${this.agent.getAgentId()}] Attempting to load tasks from database after a delay...`);
        this.loadTasksFromDatabase()
          .then(success => {
            this.logger.success(`[${this.agent.getAgentId()}] Successfully loaded ${this.tasks.size} tasks after delay`);
          })
          .catch(err => {
            this.logger.error(`[${this.agent.getAgentId()}] Error loading tasks after delay:`, 
              typeof err === 'object' && err !== null ? err : { error: String(err) });
          });
      }, 1000);
      
      return {
        success: true,
        task
      };
    } catch (error) {
      this.logger.error('Error creating task:', 
        typeof error === 'object' && error !== null ? error : { error: String(error) });
      
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
        try {
          // Safely convert created date to string
          let createdAtStr = "invalid date";
          try {
            if (task.createdAt instanceof Date && !isNaN(task.createdAt.getTime())) {
              createdAtStr = task.createdAt.toISOString();
            } else {
              createdAtStr = String(task.createdAt);
            }
          } catch (dateError) {
            createdAtStr = "invalid date";
          }
          
          this.logger.debug(`[${agentId}] Task ${id}: status=${task.status}, created=${createdAtStr}, type=${task.type}, metadata=${JSON.stringify(task.metadata || {})}`);
        } catch (loggingError) {
          this.logger.error(`[${agentId}] Error logging task details for ${id}:`, { error: loggingError });
        }
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
          try {
            taskTime = new Date(scheduledTime);
            // Validate the date is valid
            if (isNaN(taskTime.getTime())) {
              this.logger.warn(`[${agentId}] Task ${task.id} has invalid scheduledTime string value`);
              return false;
            }
          } catch (e) {
            this.logger.warn(`[${agentId}] Task ${task.id} has invalid scheduledTime that couldn't be parsed`);
            return false;
          }
        } else if (typeof scheduledTime === 'number') {
          try {
            taskTime = new Date(scheduledTime);
            // Validate the date is valid
            if (isNaN(taskTime.getTime())) {
              this.logger.warn(`[${agentId}] Task ${task.id} has invalid scheduledTime number value`);
              return false;
            }
          } catch (e) {
            this.logger.warn(`[${agentId}] Task ${task.id} has invalid scheduledTime number that couldn't be parsed`);
            return false;
          }
        } else {
          this.logger.warn(`[${agentId}] Task ${task.id} has invalid scheduledTime format: ${typeof scheduledTime}`);
          return false; // Invalid scheduledTime format
        }
        
        // Compare with current time
        const isDue = taskTime <= now;
        
        // Safely get ISO string
        let taskTimeStr = "invalid date";
        let nowStr = now.toISOString();
        
        try {
          if (!isNaN(taskTime.getTime())) {
            taskTimeStr = taskTime.toISOString();
          }
        } catch (dateError) {
          taskTimeStr = "invalid date";
        }
        
        if (isDue) {
          this.logger.info(`[${agentId}] Scheduled task ${task.id} is due. Scheduled for: ${taskTimeStr}, Current time: ${nowStr}`);
        } else {
          this.logger.debug(`[${agentId}] Scheduled task ${task.id} is not yet due. Scheduled for: ${taskTimeStr}, Current time: ${nowStr}`);
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
          try {
            // Safely convert timestamps to ISO strings
            let createdAtStr = "invalid date";
            let lastExecutionStr = "invalid date";
            let shouldRunAtStr = "invalid date";
            const nowStr = now.toISOString();
            
            try { createdAtStr = new Date(createdAt).toISOString(); } catch (e) {}
            try { lastExecutionStr = new Date(lastExecution).toISOString(); } catch (e) {}
            try { shouldRunAtStr = new Date(shouldRunAt).toISOString(); } catch (e) {}
            
            this.logger.info(`[${agentId}] Interval task ${task.id} is due. Created at ${createdAtStr}, last execution at ${lastExecutionStr}, should run at ${shouldRunAtStr}, current time: ${nowStr}`);
          } catch (e) {
            // Fallback to basic logging without dates if formatting fails
            this.logger.info(`[${agentId}] Interval task ${task.id} is due (error formatting dates)`);
          }
        } else {
          try {
            // Safely convert timestamps to ISO strings
            let createdAtStr = "invalid date";
            let lastExecutionStr = "invalid date";
            let shouldRunAtStr = "invalid date";
            const nowStr = now.toISOString();
            
            try { createdAtStr = new Date(createdAt).toISOString(); } catch (e) {}
            try { lastExecutionStr = new Date(lastExecution).toISOString(); } catch (e) {}
            try { shouldRunAtStr = new Date(shouldRunAt).toISOString(); } catch (e) {}
            
            this.logger.debug(`[${agentId}] Interval task ${task.id} not yet due. Created at ${createdAtStr}, last execution at ${lastExecutionStr}, should run at ${shouldRunAtStr}, current time: ${nowStr}`);
          } catch (e) {
            // Fallback to basic logging without dates if formatting fails
            this.logger.debug(`[${agentId}] Interval task ${task.id} not yet due (error formatting dates)`);
          }
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
      // Properly stringify the error object to avoid empty objects in logs
      const errorObj = error instanceof Error 
        ? { message: error.message, name: error.name, stack: error.stack }
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error)
          : String(error);
          
      this.logger.error(`[${agentId}] Error polling for due tasks:`, { error: errorObj });
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

  /**
   * Setup method called during initialization
   */
  async setup(): Promise<boolean> {
    try {
      // Load tasks from database
      const loadSuccess = await this.loadTasksFromDatabase();
      
      // If no tasks were loaded or there was an error, try direct approach
      if (this.tasks.size === 0) {
        this.logger.info('No tasks loaded from standard method, trying direct access...');
        await this.readTasksDirectly();
      }
      
      // Create basic test task if still no tasks
      if (this.tasks.size === 0) {
        this.logger.info('Still no tasks found, creating test task...');
        await this.createTestTask();
      }
      
      // Create recurring timers for task processing
      this.setupSchedulingTimer();
      
      // Mark as initialized
      this.initialized = true;
      
      return true;
    } catch (error) {
      this.logger.error(`Error setting up scheduler manager: ${String(error)}`);
      return false;
    }
  }

  /**
   * Create a test task to verify scheduler is working
   */
  private async createTestTask(): Promise<void> {
    try {
      // Create a simple test task
      const taskId = `task-test-${Date.now()}`;
      const task: ScheduledTask = {
        id: taskId,
        title: 'Test Task',
        description: 'This is a test task created to verify scheduler functionality',
        type: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending' as TaskStatus,
        priority: 0.5,
        retryAttempts: 0,
        dependencies: [],
        metadata: {
          isTestTask: true,
          createdByMethod: 'createTestTask'
        }
      };
      
      // Add to local tasks map
      this.tasks.set(taskId, task);
      
      // Store in memory using our optimized method
      await this.storeTaskInMemory(task);
      
      this.logger.success(`Created test task with ID: ${taskId}`);
    } catch (error) {
      this.logger.error(`Error creating test task: ${String(error)}`);
    }
  }

  /**
   * Read tasks directly from the memory service collections
   * This method helps diagnose and fix task retrieval issues
   */
  private async readTasksDirectly(): Promise<void> {
    try {
      this.logger.info(`Attempting to read tasks directly from all collections...`);
      
      // Get memory manager
      const memoryManager = this.agent.getManager(ManagerType.MEMORY);
      if (!memoryManager) {
        this.logger.error('Memory manager not available');
        return;
      }
      
      // Cast to access memory client
      const memoryAPI = memoryManager as any;
      
      let memoryClient = null;
      // Try to get memory client
      if (typeof memoryAPI.getMemoryClient === 'function') {
        try {
          memoryClient = await memoryAPI.getMemoryClient();
          
          if (memoryClient) {
            this.logger.info(`Successfully retrieved memory client`);
            
            // Get all collections from client to search for tasks
            const clientStatus = await (memoryClient as any).getStatus?.() || { collectionsReady: [] };
            const collections = clientStatus.collectionsReady || [];
            
            this.logger.info(`Found ${collections.length} collections in memory service`);
            
            // Track how many tasks we find and add
            let foundTasksCount = 0;
            let addedTasksCount = 0;
            
            // Check specialized tasks collections first
            const taskCollections = collections.filter((c: string) => 
              c.includes('task') || c.includes('tasks') || c.includes('agent')
            );
            
            // If we have task collections, prioritize them
            const prioritizedCollections = [
              ...taskCollections,
              ...collections.filter((c: string) => !taskCollections.includes(c))
            ];
            
            for (const collection of prioritizedCollections) {
              try {
                this.logger.info(`Checking collection ${collection} for tasks...`);
                
                // Try using the getTasksByStatus method (specialized)
                if (typeof (memoryClient as any).getTasksByStatus === 'function') {
                  try {
                    const taskStatuses = ['pending', 'scheduled', 'in_progress'];
                    const tasks = await (memoryClient as any).getTasksByStatus(
                      collection,
                      taskStatuses
                    );
                    
                    if (tasks && tasks.length > 0) {
                      this.logger.success(`Found ${tasks.length} tasks in collection ${collection}`);
                      foundTasksCount += tasks.length;
                      
                      // Process tasks
                      for (const task of tasks) {
                        // Skip if we already have this task
                        if (!task.id || this.tasks.has(task.id)) continue;
                        
                        // Convert task status to proper type
                        let taskStatus: TaskStatus = 'pending';
                        if (task.status === 'scheduled' || 
                            task.status === 'in_progress' || 
                            task.status === 'completed' || 
                            task.status === 'failed' || 
                            task.status === 'cancelled') {
                          taskStatus = task.status as TaskStatus;
                        }
                        
                        // Create task object
                        const formattedTask: ScheduledTask = {
                          id: task.id,
                          title: task.title || '',
                          description: task.description || '',
                          type: task.type || 'task',
                          status: taskStatus,
                          priority: task.priority || 0.5,
                          createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
                          updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date(),
                          retryAttempts: task.retryAttempts || 0,
                          dependencies: task.dependencies || [],
                          metadata: task.metadata || {}
                        };
                        
                        // Add task to our map
                        this.tasks.set(formattedTask.id, formattedTask);
                        addedTasksCount++;
                      }
                    }
                  } catch (taskError) {
                    this.logger.warn(`Error getting tasks from ${collection}: ${String(taskError)}`);
                  }
                }
                
                // Try generic point filtering as fallback
                if (typeof (memoryClient as any).scrollPoints === 'function') {
                  try {
                    // Find all points with type=task
                    const filter = {
                      must: [
                        { key: "type", match: { value: "task" } }
                      ]
                    };
                    
                    const points = await (memoryClient as any).scrollPoints(
                      collection,
                      filter,
                      100
                    );
                    
                    if (points && points.length > 0) {
                      this.logger.success(`Found ${points.length} task points in ${collection}`);
                      foundTasksCount += points.length;
                      
                      for (const point of points) {
                        // Skip if no ID or we already have this task
                        if (!point.id || this.tasks.has(point.id)) continue;
                        
                        // Extract payload
                        const payload = point.payload || {};
                        
                        // Determine status
                        let status: TaskStatus = 'pending';
                        if (payload.status) {
                          if (payload.status === 'scheduled' || 
                              payload.status === 'in_progress' || 
                              payload.status === 'completed' || 
                              payload.status === 'failed' || 
                              payload.status === 'cancelled') {
                            status = payload.status as TaskStatus;
                          }
                        }
                        
                        // Create task object
                        const formattedTask: ScheduledTask = {
                          id: point.id,
                          title: payload.title || '',
                          description: payload.description || '',
                          type: payload.type || 'task',
                          status,
                          priority: payload.priority || 0.5,
                          createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
                          updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : new Date(),
                          retryAttempts: payload.retryAttempts || 0,
                          dependencies: payload.dependencies || [],
                          metadata: payload.metadata || {}
                        };
                        
                        // Add task to our map
                        this.tasks.set(formattedTask.id, formattedTask);
                        addedTasksCount++;
                      }
                    }
                  } catch (scrollError) {
                    this.logger.warn(`Error scrolling points in ${collection}: ${String(scrollError)}`);
                  }
                }
              } catch (collectionError) {
                this.logger.warn(`Error processing collection ${collection}: ${String(collectionError)}`);
              }
            }
            
            // Log summary of what we found
            this.logger.success(`Direct task reading found ${foundTasksCount} tasks across ${collections.length} collections`);
            this.logger.success(`Added ${addedTasksCount} new tasks to task registry`);
            this.logger.info(`Current task count: ${this.tasks.size}`);
          } else {
            this.logger.warn('Memory client is null');
          }
        } catch (clientError) {
          const errorObj = typeof clientError === 'object' && clientError !== null 
            ? clientError as Record<string, any>
            : { message: String(clientError) };
          
          this.logger.error(`Error accessing memory client:`, errorObj);
        }
      } else {
        this.logger.warn('Memory manager does not have getMemoryClient method');
      }
      
      // Log final tasks count
      this.logger.info(`Current task count after direct reading: ${this.tasks.size}`);
    } catch (error) {
      const errorObj = typeof error === 'object' && error !== null 
        ? error as Record<string, any>
        : { message: String(error) };
      
      this.logger.error(`Error in readTasksDirectly:`, errorObj);
    }
  }

  /**
   * Store a task in the memory service
   */
  private async storeTaskInMemory(task: ScheduledTask): Promise<boolean> {
    try {
      const memoryManager = this.agent.getManager(ManagerType.MEMORY);
      if (!memoryManager) {
        this.logger.error('Memory manager not available for task storage');
        return false;
      }
      
      // Cast to access memory manager methods
      const memoryAPI = memoryManager as any;
      
      // Use direct storeMemory method which is most reliable
      if (typeof memoryAPI.storeMemory === 'function') {
        this.logger.info(`Storing task ${task.id} in memory service`);
        
        // Ensure dates are properly formatted
        const createdAtStr = task.createdAt instanceof Date 
          ? task.createdAt.toISOString() 
          : String(task.createdAt);
          
        const updatedAtStr = task.updatedAt instanceof Date
          ? task.updatedAt.toISOString()
          : String(task.updatedAt);
        
        // Prepare task for storage with proper type marking
        const memoryResult = await memoryAPI.storeMemory(
          // Content field - can include basic description
          task.description || task.title,
          // Metadata - include ALL task fields for proper retrieval
          {
            // Mark explicitly as task type
            type: 'task',
            taskType: task.type,
            // Include all task fields directly in metadata
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            createdAt: createdAtStr,
            updatedAt: updatedAtStr,
            retryAttempts: task.retryAttempts,
            dependencies: task.dependencies,
            // Include original metadata
            ...(task.metadata || {}),
            // Make sure this entry is marked as a task for easy searching
            isTask: true
          },
          // Use any specified scope
          undefined,
          // Additional options for memory storage
          {
            // Set correct types for the memory store
            type: 'task',
            // Tag with agent ID for easier retrieval
            tags: ['task', `agent-${this.agent.getAgentId()}`]
          }
        );
        
        if (memoryResult && memoryResult.id) {
          this.logger.info(`Task ${task.id} stored in memory service with ID: ${memoryResult.id}`);
          return true;
        } else {
          this.logger.warn(`Task ${task.id} store operation didn't return a valid result`);
          return false;
        }
      }
      
      // Fallback if storeMemory not available
      this.logger.warn(`Memory manager does not have storeMemory method`);
      return false;
    } catch (error) {
      const errorObj = typeof error === 'object' && error !== null 
        ? error as Record<string, any>
        : { message: String(error) };
      
      this.logger.error(`Error storing task ${task.id} in memory:`, errorObj);
      return false;
    }
  }
} 