/**
 * ModularSchedulerManager.ts - Modular Scheduler Manager Implementation
 * 
 * This file provides an implementation of the SchedulerManager interface that
 * orchestrates the various scheduler components in a modular fashion.
 */

import { ulid } from 'ulid';
import { AgentBase } from '../../../agents/shared/base/AgentBase.interface';
import { BaseManager, ManagerConfig } from '../../../agents/shared/base/managers/BaseManager';
import { ManagerHealth } from '../../../agents/shared/base/managers/ManagerHealth';
import { ManagerType } from '../../../agents/shared/base/managers/ManagerType';
import { createLogger } from '../../logging/winston-logger';
import { getSchedulerCoordinator } from '../coordination/SchedulerCoordinator';
import { SchedulerError } from '../errors/SchedulerError';
import { DateTimeProcessor } from '../interfaces/DateTimeProcessor.interface';
import { SchedulerManager } from '../interfaces/SchedulerManager.interface';
import { TaskExecutor } from '../interfaces/TaskExecutor.interface';
import { TaskRegistry } from '../interfaces/TaskRegistry.interface';
import { TaskScheduler } from '../interfaces/TaskScheduler.interface';
import { DEFAULT_SCHEDULER_CONFIG, SchedulerConfig } from '../models/SchedulerConfig.model';
import { SchedulerMetrics } from '../models/SchedulerMetrics.model';
import { Task, TaskScheduleType, TaskStatus, createTask } from '../models/Task.model';
import { TaskExecutionResult } from '../models/TaskExecutionResult.model';
import { TaskFilter } from '../models/TaskFilter.model';

/**
 * Implementation of the SchedulerManager interface that orchestrates
 * the TaskRegistry, TaskScheduler, and TaskExecutor components.
 */
export class ModularSchedulerManager implements SchedulerManager, BaseManager {
  private readonly id: string;
  private config: SchedulerConfig;
  private registry: TaskRegistry;
  private scheduler: TaskScheduler;
  private executor: TaskExecutor;
  private dateTimeProcessor: DateTimeProcessor;
  private schedulingTimer: NodeJS.Timeout | null = null;
  private running = false;
  private startTime: Date | null = null;
  private schedulingIterations = 0;
  private schedulingTimes: number[] = [];
  private metrics: Partial<SchedulerMetrics> = {};
  managerId: string;
  managerType: ManagerType;
  private agent!: AgentBase;
  private enabled = true;
  private logger: ReturnType<typeof createLogger>;

  // Cache for frequently accessed metrics to reduce database queries
  private metricsCache: {
    lastUpdate: Date;
    data: Partial<SchedulerMetrics>;
    ttlMs: number;
  } = {
      lastUpdate: new Date(0), // Initialize with epoch to force first update
      data: {},
      ttlMs: 30000 // Cache metrics for 30 seconds by default
    };

  /**
   * Create a new ModularSchedulerManager
   * 
   * @param registry - Task registry component
   * @param scheduler - Task scheduler component
   * @param executor - Task executor component
   * @param dateTimeProcessor - Date/time processing component
   * @param config - Optional configuration
   * @param agent - Optional agent
   */
  constructor(
    registry: TaskRegistry,
    scheduler: TaskScheduler,
    executor: TaskExecutor,
    dateTimeProcessor: DateTimeProcessor,
    config?: Partial<SchedulerConfig>,
    agent?: AgentBase
  ) {
    this.id = `scheduler-manager-${ulid()}`;
    this.managerId = this.id;
    this.managerType = ManagerType.SCHEDULER;
    this.registry = registry;
    this.scheduler = scheduler;
    this.executor = executor;
    this.dateTimeProcessor = dateTimeProcessor;
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    if (agent) {
      this.agent = agent;
    }

    // Initialize logger
    this.logger = createLogger({
      moduleId: this.id,
      agentId: agent?.getId() ?? ''
    });

    this.logger.info("ModularSchedulerManager constructor called", {
      managerId: this.id,
      agentId: agent?.getId(),
      config: this.config,
      enableAutoScheduling: this.config.enableAutoScheduling
    });
  }

  /**
   * Initialize the scheduler manager
   * 
   * @param configOrAgent - Optional configuration or AgentBase to override defaults
   * @returns true if initialization was successful
   * @throws {SchedulerError} If there's an error during initialization
   */
  async initialize(configOrAgent?: Partial<SchedulerConfig> | AgentBase): Promise<boolean> {
    this.logger.info("Initializing scheduler manager", {
      managerId: this.id
    });

    try {
      // Handle both agent and config parameters for compatibility with BaseManager
      if (configOrAgent instanceof Object && 'getAgentId' in configOrAgent) {
        // It's an AgentBase instance
        this.agent = configOrAgent as AgentBase;
        this.logger.info("Agent instance provided during initialization", {
          agentId: this.agent.getId()
        });
      } else if (configOrAgent) {
        // It's a config object
        this.config = { ...this.config, ...(configOrAgent as Partial<SchedulerConfig>) };
        this.logger.info("Configuration updated during initialization", {
          updatedConfig: configOrAgent
        });
      }

      // If auto-scheduling is enabled, start the scheduler
      if (this.config.enabled && this.config.enableAutoScheduling) {
        this.logger.info("Auto-scheduling enabled, starting scheduler");
        await this.startScheduler();
      }

      this.logger.info("Scheduler manager initialized successfully", {
        managerId: this.id,
        enabled: this.config.enabled,
        autoScheduling: this.config.enableAutoScheduling
      });

      return true;
    } catch (error) {
      this.logger.error("Failed to initialize scheduler manager", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to initialize scheduler manager: ${(error as Error).message}`,
        'INITIALIZATION_ERROR'
      );
    }
  }

  /**
   * Create a new task
   * 
   * @param task - The task to create
   * @returns The created task with generated metadata
   * @throws {SchedulerError} If the task cannot be created
   */
  async createTask(task: Task): Promise<Task> {
    this.logger.info("Creating new task", {
      taskName: task.name,
      taskId: task.id,
      scheduleType: task.scheduleType,
      priority: task.priority,
      scheduledTime: task.scheduledTime,
      hasAgent: !!this.agent
    });

    try {
      // If we have an agent, automatically scope the task to that agent
      if (this.agent) {
        const agentId = this.agent.getId();
        console.log(`🎯 createTask: Auto-scoping task to agent ${agentId}`);

        // Process the task normally first (handle vague temporal expressions, etc.)
        const processedTask = await this.processTaskForCreation(task);

        // Then create it for the specific agent
        return await this.createTaskForAgentInternal(processedTask, agentId);
      }

      // No agent, create task normally
      console.log(`🌐 createTask: No agent set, creating task without agent scope`);
      const result = await this.processTaskForCreation(task);
      console.log(`✅ createTask completed successfully, task ID: ${result.id}`);
      return result;

    } catch (error) {
      this.logger.error("Failed to create task", {
        taskId: task.id,
        taskName: task.name,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to create task: ${(error as Error).message}`,
        'TASK_CREATION_ERROR'
      );
    }
  }

  /**
   * Internal method to process a task for creation (handles vague temporal expressions, defaults, etc.)
   * This is the core task processing logic extracted from the original createTask method.
   */
  private async processTaskForCreation(task: Task): Promise<Task> {
    // Handle vague temporal expressions if present
    let scheduledTime = task.scheduledTime;
    let priority = task.priority ?? this.config.defaultPriority;

    if (task.scheduleType === TaskScheduleType.EXPLICIT &&
      typeof task.scheduledTime === 'string') {

      // 🔍 DEBUG: Add comprehensive time parsing logs
      const currentTime = new Date();
      this.logger.info("🔍 TIMING DEBUG: Starting scheduled time parsing", {
        taskId: task.id,
        originalScheduledTime: task.scheduledTime,
        currentTime: currentTime.toISOString(),
        currentTimeMs: currentTime.getTime()
      });

      this.logger.info("Processing vague temporal expression", {
        taskId: task.id,
        originalScheduledTime: task.scheduledTime
      });

      // Try to parse as vague temporal expression
      const vagueResult = this.dateTimeProcessor.translateVagueTerm(task.scheduledTime);

      if (vagueResult) {
        // Use the date and priority from the vague term
        if (vagueResult.date) {
          scheduledTime = vagueResult.date;
          this.logger.info("✅ TIMING DEBUG: Vague term translated to date", {
            taskId: task.id,
            originalTerm: task.scheduledTime,
            translatedDate: vagueResult.date.toISOString(),
            translatedDateMs: vagueResult.date.getTime(),
            priority: vagueResult.priority,
            timeDifferenceMs: vagueResult.date.getTime() - currentTime.getTime(),
            timeDifferenceMin: (vagueResult.date.getTime() - currentTime.getTime()) / 60000
          });
        }
        priority = vagueResult.priority;
      } else {
        this.logger.info("❌ TIMING DEBUG: Vague term parsing failed, trying natural language", {
          taskId: task.id,
          originalTerm: task.scheduledTime
        });

        // Try to parse as natural language date
        let parsedDate = this.dateTimeProcessor.parseNaturalLanguage(task.scheduledTime);

        // Handle both sync and async versions
        if (parsedDate instanceof Promise) {
          parsedDate = await parsedDate;
        }

        if (parsedDate) {
          scheduledTime = parsedDate;
          this.logger.info("✅ TIMING DEBUG: Natural language date parsed", {
            taskId: task.id,
            originalTerm: task.scheduledTime,
            parsedDate: parsedDate.toISOString(),
            parsedDateMs: parsedDate.getTime(),
            timeDifferenceMs: parsedDate.getTime() - currentTime.getTime(),
            timeDifferenceMin: (parsedDate.getTime() - currentTime.getTime()) / 60000
          });
        } else {
          this.logger.info("❌ TIMING DEBUG: Natural language parsing failed, trying interval", {
            taskId: task.id,
            originalTerm: task.scheduledTime
          });

          // Try to parse as interval (e.g. "2m", "5h", "1d")
          try {
            const intervalDate = this.dateTimeProcessor.calculateInterval(new Date(), task.scheduledTime);
            if (intervalDate) {
              scheduledTime = intervalDate;
              this.logger.info("✅ TIMING DEBUG: Interval expression parsed", {
                taskId: task.id,
                originalTerm: task.scheduledTime,
                calculatedDate: intervalDate.toISOString(),
                calculatedDateMs: intervalDate.getTime(),
                timeDifferenceMs: intervalDate.getTime() - currentTime.getTime(),
                timeDifferenceMin: (intervalDate.getTime() - currentTime.getTime()) / 60000
              });
            } else {
              this.logger.error("❌ TIMING DEBUG: Interval calculation returned null", {
                taskId: task.id,
                originalTerm: task.scheduledTime
              });
            }
          } catch (error) {
            this.logger.warn("❌ TIMING DEBUG: Failed to parse as interval", {
              taskId: task.id,
              originalTerm: task.scheduledTime,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      // 🔍 DEBUG: Final scheduled time summary
      this.logger.info("🎯 TIMING DEBUG: Final scheduled time result", {
        taskId: task.id,
        originalTerm: task.scheduledTime,
        finalScheduledTime: scheduledTime instanceof Date ? scheduledTime.toISOString() : scheduledTime,
        finalScheduledTimeMs: scheduledTime instanceof Date ? scheduledTime.getTime() : null,
        isInFuture: scheduledTime instanceof Date ? scheduledTime > currentTime : null,
        secondsFromNow: scheduledTime instanceof Date ? Math.round((scheduledTime.getTime() - currentTime.getTime()) / 1000) : null
      });
    }

    // Apply default values
    const taskWithDefaults = createTask({
      ...task,
      scheduledTime,
      priority
    });

    this.logger.info("Task processed with defaults", {
      taskId: taskWithDefaults.id,
      finalScheduledTime: taskWithDefaults.scheduledTime,
      finalPriority: taskWithDefaults.priority,
      hasMetadata: !!taskWithDefaults.metadata
    });

    // Store the task in the registry
    const storedTask = await this.registry.storeTask(taskWithDefaults);

    this.logger.success("Task created successfully", {
      taskId: storedTask.id,
      taskName: storedTask.name,
      status: storedTask.status,
      createdAt: storedTask.createdAt
    });

    return storedTask;
  }

  /**
   * Internal method to create a task for a specific agent (without the processing logic)
   * This calls the agent-scoped creation after processing.
   */
  private async createTaskForAgentInternal(task: Task, agentId: string): Promise<Task> {
    // Ensure metadata exists
    const metadata = task.metadata || {};

    // Set the agent ID in metadata
    const taskWithAgentId: Task = {
      ...task,
      metadata: {
        ...metadata,
        agentId: {
          namespace: 'agent',
          type: 'agent',
          id: agentId
        }
      }
    };

    this.logger.info("Task prepared with agent metadata", {
      taskId: task.id,
      agentId,
      metadataKeys: Object.keys(taskWithAgentId.metadata || {})
    });

    // Update the existing task with agent metadata instead of storing a new one
    const storedTask = await this.registry.updateTask(taskWithAgentId);

    this.logger.success("Task updated for agent successfully", {
      taskId: storedTask.id,
      agentId,
      status: storedTask.status
    });

    return storedTask;
  }

  /**
   * Update an existing task
   * 
   * @param task - The task with updated fields
   * @returns The updated task
   * @throws {SchedulerError} If the task cannot be updated
   */
  async updateTask(task: Task): Promise<Task> {
    this.logger.info("Updating task", {
      taskId: task.id,
      taskName: task.name,
      status: task.status,
      priority: task.priority
    });

    try {
      const updatedTask = await this.registry.updateTask(task);

      this.logger.success("Task updated successfully", {
        taskId: updatedTask.id,
        taskName: updatedTask.name,
        status: updatedTask.status,
        updatedAt: updatedTask.updatedAt
      });

      return updatedTask;
    } catch (error) {
      this.logger.error("Failed to update task", {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to update task: ${(error as Error).message}`,
        'TASK_UPDATE_ERROR'
      );
    }
  }

  /**
   * Delete a task
   * 
   * @param taskId - ID of the task to delete
   * @returns true if the task was deleted successfully
   * @throws {SchedulerError} If the task cannot be deleted
   */
  async deleteTask(taskId: string): Promise<boolean> {
    this.logger.info("Deleting task", { taskId });

    try {
      const result = await this.registry.deleteTask(taskId);

      if (result) {
        this.logger.success("Task deleted successfully", { taskId });
      } else {
        this.logger.warn("Task deletion returned false", { taskId });
      }

      return result;
    } catch (error) {
      this.logger.error("Failed to delete task", {
        taskId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to delete task: ${(error as Error).message}`,
        'TASK_DELETION_ERROR'
      );
    }
  }

  /**
   * Get a task by its ID
   * 
   * @param taskId - ID of the task to retrieve
   * @returns The task if found, null otherwise
   * @throws {SchedulerError} If there's an error retrieving the task
   */
  async getTask(taskId: string): Promise<Task | null> {
    this.logger.info("Retrieving task", { taskId });

    try {
      const task = await this.registry.getTaskById(taskId);

      if (task) {
        this.logger.info("Task retrieved successfully", {
          taskId,
          taskName: task.name,
          status: task.status
        });
      } else {
        this.logger.info("Task not found", { taskId });
      }

      return task;
    } catch (error) {
      this.logger.error("Failed to get task", {
        taskId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to get task: ${(error as Error).message}`,
        'TASK_RETRIEVAL_ERROR'
      );
    }
  }

  /**
   * Find tasks matching the specified criteria
   * 
   * @param filter - Filter criteria for tasks
   * @returns Array of matching tasks
   * @throws {SchedulerError} If there's an error querying for tasks
   */
  async findTasks(filter: TaskFilter): Promise<Task[]> {
    this.logger.info("Finding tasks with filter", {
      filter,
      filterKeys: Object.keys(filter),
      hasAgent: !!this.agent
    });

    try {
      // If we have an agent, automatically scope to that agent
      if (this.agent) {
        const agentId = this.agent.getId();
        console.log(`🎯 findTasks: Auto-scoping to agent ${agentId}`);
        return await this.findTasksForAgent(agentId, filter);
      }

      // No agent, find all tasks matching the filter
      console.log(`🌐 findTasks: No agent set, finding all tasks`);
      const tasks = await this.registry.findTasks(filter);

      this.logger.info("Tasks found", {
        taskCount: tasks.length,
        filter,
        taskIds: tasks.map(t => t.id).slice(0, 10) // Log first 10 task IDs
      });

      return tasks;
    } catch (error) {
      this.logger.error("Failed to find tasks", {
        filter,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to find tasks: ${(error as Error).message}`,
        'TASK_QUERY_ERROR'
      );
    }
  }

  /**
   * Find tasks for a specific agent
   * 
   * @param agentId - The ID of the agent
   * @param filter - Additional filter criteria
   * @returns Array of tasks for the specified agent
   * @throws {SchedulerError} If there's an error querying for tasks
   */
  async findTasksForAgent(agentId: string, filter: TaskFilter = {}): Promise<Task[]> {
    // Change frequent task checking log to debug level to reduce noise
    this.logger.debug(`Checking tasks for ${agentId}`);

    // Change detailed logging to debug level
    this.logger.debug("Finding tasks for agent", {
      agentId,
      additionalFilter: filter
    });

    try {
      const combinedFilter: TaskFilter = {
        ...filter,
        metadata: {
          ...filter.metadata,
          agentId: {
            id: agentId
          }
        }
      };

      const tasks = await this.registry.findTasks(combinedFilter);

      // Change detailed task results to debug level
      this.logger.debug("Agent tasks found", {
        agentId,
        taskCount: tasks.length,
        taskIds: tasks.map(t => t.id).slice(0, 5) // Log first 5 task IDs
      });

      return tasks;
    } catch (error) {
      this.logger.error("Error finding tasks for agent", {
        agentId,
        filter,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(`Error finding tasks for agent ${agentId}: ${error}`);
    }
  }

  /**
   * Create a task for a specific agent
   * 
   * @param task - The task to create
   * @param agentId - The ID of the agent
   * @returns The created task
   * @throws {SchedulerError} If there's an error creating the task
   */
  async createTaskForAgent(task: Task, agentId: string): Promise<Task> {
    this.logger.info("Creating task for agent", {
      taskId: task.id,
      taskName: task.name,
      agentId,
      scheduleType: task.scheduleType
    });

    try {
      // Process the task normally first (handle vague temporal expressions, etc.)
      const processedTask = await this.processTaskForCreation(task);

      // Then create it for the specific agent
      return await this.createTaskForAgentInternal(processedTask, agentId);

    } catch (error) {
      this.logger.error("Error creating task for agent", {
        taskId: task.id,
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(`Error creating task for agent ${agentId}: ${error}`);
    }
  }

  /**
   * Execute tasks that are due according to scheduling strategies
   * 
   * @returns Array of execution results for tasks that were executed
   * @throws {SchedulerError} If there's an error during scheduled execution
   */
  async executeDueTasks(): Promise<TaskExecutionResult[]> {
    const startTime = Date.now();
    this.logger.debug("Starting execution of due tasks", {
      schedulingIteration: this.schedulingIterations + 1
    });

    try {
      // Get all pending tasks
      const pendingTasks = await this.registry.findTasks({
        status: TaskStatus.PENDING
      });

      // Only log at info level when we actually have tasks to process
      if (pendingTasks.length > 0) {
        this.logger.info("Tasks fetched", {
          pendingTaskCount: pendingTasks.length
        });
      } else {
        this.logger.debug("No pending tasks found");
        return [];
      }

      // Determine which tasks are due
      const dueTasks = await this.scheduler.getDueTasks(pendingTasks);

      this.logger.info("Tasks ready for execution", {
        totalPending: pendingTasks.length,
        dueTaskCount: dueTasks.length
      });

      if (!dueTasks.length) {
        this.logger.debug("No tasks are due for execution");
        return [];
      }

      // Execute the due tasks
      this.logger.debug("Starting execution of due tasks", {
        taskCount: dueTasks.length,
        maxConcurrentTasks: this.config.maxConcurrentTasks
      });

      // CRITICAL FIX: Immediately mark tasks as RUNNING to prevent re-execution
      // This prevents race conditions where the same task gets picked up by multiple scheduler cycles
      this.logger.debug("Marking due tasks as RUNNING to prevent re-execution", {
        taskIds: dueTasks.map(t => t.id)
      });

      const runningTasks = dueTasks.map(task => ({
        ...task,
        status: TaskStatus.RUNNING,
        updatedAt: new Date()
      }));

      // Update tasks to RUNNING status immediately
      for (const task of runningTasks) {
        try {
          await this.registry.updateTask(task);
        } catch (error) {
          this.logger.error("Failed to mark task as running", {
            taskId: task.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Execute the due tasks (now marked as RUNNING)
      const results = await this.executor.executeTasks(
        runningTasks,
        this.config.maxConcurrentTasks
      );

      // Log task completion details
      results.forEach((result, index) => {
        const task = runningTasks[index];
        if (result.successful) {
          this.logger.info("Task completed successfully", {
            taskId: task.id,
            taskName: task.name,
            status: result.status,
            duration: result.duration,
            result: result.result
          });
        } else {
          this.logger.error("Task execution failed", {
            taskId: task.id,
            taskName: task.name,
            status: result.status,
            duration: result.duration,
            error: result.error
          });
        }
      });

      this.logger.info("Task execution completed", {
        executedTaskCount: results.length,
        successfulTasks: results.filter(r => r.successful).length,
        failedTasks: results.filter(r => !r.successful).length
      });

      // Prepare tasks for update
      const tasksToUpdate = runningTasks.map((task, i) => {
        const result = results[i];
        return {
          ...task,
          status: result.status,
          lastExecutedAt: result.endTime,
          updatedAt: new Date(),
          metadata: {
            ...task.metadata,
            executionTime: result.duration,
            result: result.result,
            output: result.result,
            retryCount: (task.metadata?.retryCount || 0) + (result.wasRetry ? 1 : 0),
            ...(result.successful ? {} : {
              errorInfo: result.error
            })
          },
          // Increment execution count for interval tasks
          interval: task.interval ? {
            ...task.interval,
            executionCount: task.interval.executionCount + 1
          } : undefined
        };
      });

      this.logger.info("Updating task statuses after execution", {
        tasksToUpdateCount: tasksToUpdate.length
      });

      // Check if registry supports batch updates
      if ('updateTasks' in this.registry && typeof this.registry.updateTasks === 'function') {
        // Use batch update for better performance
        this.logger.info("Using batch update for task statuses");
        await (this.registry as any).updateTasks(tasksToUpdate);
      } else {
        // Fall back to individual updates
        this.logger.info("Using individual updates for task statuses");
        for (const task of tasksToUpdate) {
          await this.registry.updateTask(task);
        }
      }

      // Update metrics
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      this.schedulingTimes.push(executionTime);
      this.schedulingIterations++;

      this.logger.success("Due task execution cycle completed", {
        executionTimeMs: executionTime,
        schedulingIteration: this.schedulingIterations,
        averageExecutionTimeMs: this.schedulingTimes.reduce((sum, time) => sum + time, 0) / this.schedulingTimes.length
      });

      return results;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error("Failed to execute due tasks", {
        executionTimeMs: executionTime,
        schedulingIteration: this.schedulingIterations + 1,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to execute due tasks: ${(error as Error).message}`,
        'TASK_EXECUTION_ERROR'
      );
    }
  }

  /**
   * Execute due tasks for a specific agent
   * 
   * @param agentId - The ID of the agent
   * @returns Array of execution results for tasks that were executed
   * @throws {SchedulerError} If there's an error executing tasks
   */
  async executeDueTasksForAgent(agentId: string): Promise<TaskExecutionResult[]> {
    this.logger.debug("Executing due tasks for specific agent", { agentId });

    try {
      // Find pending tasks for the agent
      const pendingTasks = await this.findTasksForAgent(agentId, {
        status: TaskStatus.PENDING
      });

      // Change task fetch results to debug level to reduce console noise
      this.logger.debug("Tasks fetched for agent", {
        agentId,
        pendingTaskCount: pendingTasks.length
      });

      // TEMPORARY DEBUG: Let's also check if there are ANY pending tasks (regardless of agent)
      if (pendingTasks.length === 0) {
        this.logger.debug("No tasks found for agent, checking all pending tasks", {
          agentId
        });
        const allPendingTasks = await this.registry.findTasks({
          status: TaskStatus.PENDING
        });
        this.logger.debug("All pending tasks in system", {
          totalPendingTasks: allPendingTasks.length,
          agentIds: allPendingTasks.map(t => {
            const agentIdMetadata = t.metadata?.agentId;
            if (agentIdMetadata && typeof agentIdMetadata === 'object' && 'id' in agentIdMetadata) {
              return (agentIdMetadata as { id: string }).id;
            }
            return agentIdMetadata;
          }).slice(0, 10),
          taskNames: allPendingTasks.map(t => t.name).slice(0, 5)
        });
      }

      if (!pendingTasks.length) {
        this.logger.debug("No pending tasks found for agent", { agentId });
        return [];
      }

      // Get due tasks from the pending tasks
      const dueTasks = await this.scheduler.getDueTasks(pendingTasks);

      this.logger.info("Tasks ready for execution", {
        agentId,
        totalPending: pendingTasks.length,
        dueTaskCount: dueTasks.length
      });

      if (!dueTasks.length) {
        this.logger.debug("No tasks are due for agent", { agentId });
        return [];
      }

      // SMART SCHEDULING: Order tasks by priority and limit by capacity
      const orderedTasks = this.orderTasksByPriority(dueTasks);
      const tasksToExecute = orderedTasks.slice(0, this.config.maxConcurrentTasks);

      this.logger.debug("Smart scheduling applied", {
        agentId,
        totalDueTasks: dueTasks.length,
        tasksSelectedForExecution: tasksToExecute.length,
        maxConcurrentTasks: this.config.maxConcurrentTasks
      });

      // CRITICAL FIX: Immediately mark tasks as RUNNING to prevent re-execution
      this.logger.debug("Marking due tasks as RUNNING to prevent re-execution", {
        agentId,
        taskIds: tasksToExecute.map(t => t.id)
      });

      const runningTasks = tasksToExecute.map(task => ({
        ...task,
        status: TaskStatus.RUNNING,
        updatedAt: new Date()
      }));

      // Update tasks to RUNNING status immediately
      for (const task of runningTasks) {
        try {
          await this.registry.updateTask(task);
        } catch (error) {
          this.logger.error("Failed to mark task as running", {
            taskId: task.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Execute the due tasks (now marked as RUNNING)
      const results = await this.executor.executeTasks(runningTasks, this.config.maxConcurrentTasks);

      // Log task completion details for each task
      results.forEach((result, index) => {
        const task = runningTasks[index];
        if (result.successful) {
          this.logger.info("Task completed successfully", {
            agentId,
            taskId: task.id,
            taskName: task.name,
            status: result.status,
            duration: result.duration,
            result: result.result
          });
        } else {
          this.logger.error("Task execution failed", {
            agentId,
            taskId: task.id,
            taskName: task.name,
            status: result.status,
            duration: result.duration,
            error: result.error
          });
        }
      });

      this.logger.info("Task execution completed for agent", {
        agentId,
        executedTaskCount: results.length,
        successfulTasks: results.filter(r => r.successful).length,
        failedTasks: results.filter(r => !r.successful).length
      });

      // Prepare tasks for update with execution results
      const tasksToUpdate = runningTasks.map((task, i) => {
        const result = results[i];
        return {
          ...task,
          status: result.status,
          lastExecutedAt: result.endTime,
          updatedAt: new Date(),
          metadata: {
            ...task.metadata,
            executionTime: result.duration,
            result: result.result,
            output: result.result,
            retryCount: (task.metadata?.retryCount || 0) + (result.wasRetry ? 1 : 0),
            ...(result.successful ? {} : {
              errorInfo: result.error
            })
          },
          // Increment execution count for interval tasks
          interval: task.interval ? {
            ...task.interval,
            executionCount: task.interval.executionCount + 1
          } : undefined
        };
      });

      this.logger.info("Updating task statuses after execution", {
        agentId,
        tasksToUpdateCount: tasksToUpdate.length
      });

      // Check if registry supports batch updates
      if ('updateTasks' in this.registry && typeof this.registry.updateTasks === 'function') {
        // Use batch update for better performance
        this.logger.info("Using batch update for task statuses");
        await (this.registry as any).updateTasks(tasksToUpdate);
      } else {
        // Fall back to individual updates
        this.logger.info("Using individual updates for task statuses");
        for (const task of tasksToUpdate) {
          await this.registry.updateTask(task);
        }
      }

      return results;
    } catch (error) {
      this.logger.error("Error executing due tasks for agent", {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(`Error executing due tasks for agent ${agentId}: ${error}`);
    }
  }

  /**
   * Execute a specific task immediately, regardless of scheduling
   * 
   * @param taskId - ID of the task to execute
   * @returns The execution result
   * @throws {SchedulerError} If the task cannot be executed
   */
  async executeTaskNow(taskId: string): Promise<TaskExecutionResult> {
    this.logger.info("Executing task immediately", { taskId });

    try {
      // Get the task
      const task = await this.registry.getTaskById(taskId);

      if (!task) {
        this.logger.error("Task not found for immediate execution", { taskId });
        throw new SchedulerError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
      }

      this.logger.info("Task retrieved for immediate execution", {
        taskId,
        taskName: task.name,
        taskStatus: task.status
      });

      // Execute the task
      const result = await this.executor.executeTask(task);

      this.logger.info("Immediate task execution completed", {
        taskId,
        taskName: task.name,
        successful: result.successful,
        duration: result.duration,
        status: result.status
      });

      // Update the task with execution result
      await this.registry.updateTask({
        ...task,
        status: result.status,
        lastExecutedAt: result.endTime,
        metadata: {
          ...task.metadata,
          executionTime: result.duration,
          result: result.result,
          output: result.result,
          retryCount: (task.metadata?.retryCount || 0) + (result.wasRetry ? 1 : 0),
          ...(result.successful ? {} : {
            errorInfo: result.error
          })
        },
        // Increment execution count for interval tasks
        interval: task.interval ? {
          ...task.interval,
          executionCount: task.interval.executionCount + 1
        } : undefined
      });

      this.logger.success("Task updated after immediate execution", {
        taskId,
        newStatus: result.status
      });

      return result;
    } catch (error) {
      this.logger.error("Failed to execute task immediately", {
        taskId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to execute task: ${(error as Error).message}`,
        'TASK_EXECUTION_ERROR'
      );
    }
  }

  /**
   * Start the scheduler to automatically execute due tasks at intervals
   * 
   * @returns true if the scheduler was started successfully
   * @throws {SchedulerError} If the scheduler cannot be started
   */
  async startScheduler(): Promise<boolean> {
    this.logger.info("Starting scheduler", {
      schedulingIntervalMs: this.config.schedulingIntervalMs,
      maxConcurrentTasks: this.config.maxConcurrentTasks
    });

    try {
      if (this.running) {
        this.logger.warn("Scheduler is already running");
        return false; // Already running
      }

      this.running = true;
      this.startTime = new Date();

      // FIXED: Register with the centralized coordinator instead of creating our own timer
      if (this.agent) {
        const coordinator = getSchedulerCoordinator();
        coordinator.registerScheduler(this.agent.getId(), this);

        this.logger.success("Scheduler registered with coordinator", {
          agentId: this.agent.getId(),
          startTime: this.startTime,
          schedulingIntervalMs: this.config.schedulingIntervalMs
        });
      } else {
        this.logger.warn("No agent set - cannot register with coordinator, falling back to individual timer");

        // Fallback to individual timer only if no agent is set
        const scheduleLoop = async () => {
          if (!this.running) {
            this.logger.info("Scheduler loop exiting - not running");
            return;
          }

          try {
            this.logger.debug("Executing scheduling loop");
            await this.executeDueTasks();
          } catch (error) {
            this.logger.error("Error in scheduling loop", {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            });
          }
        };

        // Set up the scheduling timer only as fallback
        this.schedulingTimer = setInterval(
          scheduleLoop,
          this.config.schedulingIntervalMs
        );

        this.logger.info("Fallback scheduler timer created");

        // Execute immediately on start
        scheduleLoop();
      }

      return true;
    } catch (error) {
      this.running = false;
      this.logger.error("Failed to start scheduler", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to start scheduler: ${(error as Error).message}`,
        'SCHEDULER_START_ERROR'
      );
    }
  }

  /**
   * Stop the scheduler from automatically executing tasks
   * 
   * @returns true if the scheduler was stopped successfully
   * @throws {SchedulerError} If the scheduler cannot be stopped
   */
  async stopScheduler(): Promise<boolean> {
    this.logger.info("Stopping scheduler");

    try {
      if (!this.running) {
        this.logger.warn("Scheduler is already stopped");
        return false; // Already stopped
      }

      this.running = false;

      // FIXED: Unregister from coordinator if we have an agent
      if (this.agent) {
        const coordinator = getSchedulerCoordinator();
        coordinator.unregisterScheduler(this.agent.getId());
        this.logger.info("Scheduler unregistered from coordinator", {
          agentId: this.agent.getId()
        });
      }

      // Clean up individual timer if it exists (fallback case)
      if (this.schedulingTimer) {
        clearInterval(this.schedulingTimer);
        this.schedulingTimer = null;
        this.logger.info("Individual scheduling timer cleared");
      }

      this.logger.success("Scheduler stopped successfully", {
        totalIterations: this.schedulingIterations,
        uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0
      });

      return true;
    } catch (error) {
      this.logger.error("Failed to stop scheduler", {
        error: error instanceof Error ? error.message : String(error)
      });

      throw new SchedulerError(
        `Failed to stop scheduler: ${(error as Error).message}`,
        'SCHEDULER_STOP_ERROR'
      );
    }
  }

  /**
   * Check if the scheduler is currently running
   * 
   * @returns true if the scheduler is running
   */
  isSchedulerRunning(): boolean {
    this.logger.debug("Checking scheduler running status", { running: this.running });
    return this.running;
  }

  /**
   * Get metrics about the scheduler's performance
   * 
   * @returns Metrics object with performance data
   * @throws {SchedulerError} If metrics cannot be collected
   */
  async getMetrics(): Promise<SchedulerMetrics> {
    this.logger.info("Collecting scheduler metrics");

    try {
      const now = new Date();

      // Check if cached metrics are still valid
      if ((now.getTime() - this.metricsCache.lastUpdate.getTime()) < this.metricsCache.ttlMs) {
        this.logger.info("Returning cached metrics", {
          cacheAge: now.getTime() - this.metricsCache.lastUpdate.getTime(),
          cacheTtl: this.metricsCache.ttlMs
        });

        return {
          ...this.metricsCache.data,
          timestamp: now, // Always use current timestamp
          isRunning: this.running // Always use current running state
        } as SchedulerMetrics;
      }

      this.logger.info("Cache expired, collecting fresh metrics");

      // Get counts of tasks by status
      const pendingCount = await this.registry.countTasks({ status: TaskStatus.PENDING });
      const runningCount = await this.registry.countTasks({ status: TaskStatus.RUNNING });
      const completedCount = await this.registry.countTasks({ status: TaskStatus.COMPLETED });
      const failedCount = await this.registry.countTasks({ status: TaskStatus.FAILED });
      const cancelledCount = await this.registry.countTasks({ status: TaskStatus.CANCELLED });
      const deferredCount = await this.registry.countTasks({ status: TaskStatus.DEFERRED });

      // Get counts by schedule type
      const explicitCount = await this.registry.countTasks({ scheduleType: TaskScheduleType.EXPLICIT });
      const intervalCount = await this.registry.countTasks({ scheduleType: TaskScheduleType.INTERVAL });
      const priorityCount = await this.registry.countTasks({ scheduleType: TaskScheduleType.PRIORITY });

      // Calculate averages
      const avgSchedulingTimeMs = this.schedulingTimes.length
        ? this.schedulingTimes.reduce((sum, time) => sum + time, 0) / this.schedulingTimes.length
        : 0;

      // Get running tasks
      const runningTasks = await this.executor.getRunningTasks();

      this.logger.info("Metrics collected successfully", {
        totalTasks: pendingCount + runningCount + completedCount + failedCount + cancelledCount + deferredCount,
        pendingCount,
        runningCount,
        completedCount,
        failedCount,
        avgSchedulingTimeMs,
        schedulingIterations: this.schedulingIterations
      });

      // Build metrics object
      const metrics: SchedulerMetrics = {
        timestamp: now,
        isRunning: this.running,
        uptime: this.startTime ? now.getTime() - this.startTime.getTime() : 0,
        totalTasks: pendingCount + runningCount + completedCount + failedCount + cancelledCount + deferredCount,
        taskStatusCounts: {
          pending: pendingCount,
          running: runningCount,
          completed: completedCount,
          failed: failedCount,
          cancelled: cancelledCount,
          deferred: deferredCount
        },
        executionStats: {
          totalExecutions: completedCount + failedCount,
          successfulExecutions: completedCount,
          failedExecutions: failedCount,
          cancelledExecutions: cancelledCount,
          retryAttempts: 0, // Would need additional tracking
          averageExecutionTimeMs: 0, // Would need to calculate from task metadata
          minExecutionTimeMs: 0, // Would need to calculate from task metadata
          maxExecutionTimeMs: 0, // Would need to calculate from task metadata
          averageWaitTimeMs: 0 // Would need to calculate from task metadata
        },
        currentResourceUtilization: {
          cpuUtilization: 0, // Would need system metrics
          memoryBytes: 0, // Would need system metrics
          tokensPerMinute: 0, // Would need token tracking
          apiCallsPerMinute: 0 // Would need API call tracking
        },
        schedulingIterations: this.schedulingIterations,
        averageSchedulingTimeMs: avgSchedulingTimeMs,
        priorityChanges: 0, // Would need additional tracking
        dependencyViolations: 0, // Would need additional tracking
        timeouts: 0, // Would need additional tracking
        averageLoopTimeMs: avgSchedulingTimeMs, // Using scheduling time as proxy
        queuedTasks: pendingCount,
        activeTasks: runningCount,
        scheduledTasksByType: {
          explicit: explicitCount,
          interval: intervalCount,
          priority: priorityCount
        },
        currentlyRunningTasks: runningTasks
      };

      // Update the cache
      this.metricsCache = {
        lastUpdate: now,
        data: metrics,
        ttlMs: this.metricsCache.ttlMs
      };

      this.logger.info("Metrics cache updated");

      return metrics;
    } catch (error) {
      this.logger.error("Failed to collect metrics", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to collect metrics: ${(error as Error).message}`,
        'METRICS_COLLECTION_ERROR'
      );
    }
  }

  /**
   * Reset the scheduler state, clearing all tasks
   * 
   * @returns true if the scheduler was reset successfully
   * @throws {SchedulerError} If the scheduler cannot be reset
   */
  async reset(): Promise<boolean> {
    this.logger.info("Resetting scheduler state");

    try {
      // Stop the scheduler
      if (this.running) {
        this.logger.info("Stopping scheduler before reset");
        await this.stopScheduler();
      }

      // Clear all tasks
      this.logger.info("Clearing all tasks from registry");
      await this.registry.clearAllTasks();

      // Reset the scheduler
      this.logger.info("Resetting scheduler component");
      await this.scheduler.reset();

      // Reset metrics
      this.schedulingIterations = 0;
      this.schedulingTimes = [];
      this.startTime = null;

      this.logger.success("Scheduler reset successfully", {
        managerId: this.id
      });

      return true;
    } catch (error) {
      this.logger.error("Failed to reset scheduler", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to reset scheduler: ${(error as Error).message}`,
        'RESET_ERROR'
      );
    }
  }

  /**
   * Set the agent that owns this manager
   */
  getAgent(): AgentBase {
    if (!this.agent) {
      throw new Error('Agent not set for ModularSchedulerManager');
    }
    return this.agent;
  }

  /**
   * Check if the manager is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable the manager
   */
  setEnabled(enabled: boolean): boolean {
    this.enabled = enabled;
    return this.enabled;
  }

  /**
   * Get the manager configuration
   */
  getConfig<T extends ManagerConfig>(): T {
    return this.config as unknown as T;
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    this.config = { ...this.config, ...config as unknown as Partial<SchedulerConfig> };
    return this.config as unknown as T;
  }

  /**
   * Get the manager health
   */
  async getHealth(): Promise<ManagerHealth> {
    const now = new Date();
    const status = this.enabled ? 'healthy' : 'degraded';

    return {
      status,
      message: this.enabled ? 'Scheduler is running normally' : 'Scheduler is disabled',
      metrics: {
        tasksManaged: await this.registry.countTasks({}),
        isRunning: this.running,
        schedulerIterations: this.schedulingIterations
      },
      details: {
        lastCheck: now,
        issues: this.enabled ? [] : [
          {
            severity: 'medium',
            message: 'Scheduler is disabled',
            detectedAt: now
          }
        ],
        metrics: {
          averageSchedulingTimeMs: this.schedulingTimes.length
            ? this.schedulingTimes.reduce((sum, time) => sum + time, 0) / this.schedulingTimes.length
            : 0
        }
      }
    };
  }

  /**
   * Get the manager status
   */
  getStatus(): { status: string; health?: { status: string; message?: string } } {
    return {
      status: this.isEnabled() ? 'available' : 'unavailable',
      health: {
        status: this.isEnabled() ? 'healthy' : 'degraded',
        message: this.isEnabled() ? undefined : 'Manager is disabled'
      }
    };
  }

  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    await this.stopScheduler();
  }

  /**
   * Set the Time-To-Live (TTL) for the metrics cache
   * 
   * @param ttlMs - The cache TTL in milliseconds
   */
  setMetricsCacheTTL(ttlMs: number): void {
    if (ttlMs < 0) {
      throw new Error('Cache TTL must be a non-negative value');
    }

    this.metricsCache.ttlMs = ttlMs;

    // Clear cache if TTL is set to 0 (disable caching)
    if (ttlMs === 0) {
      this.metricsCache.lastUpdate = new Date(0);
      this.metricsCache.data = {};
    }
  }

  /**
   * Order tasks by priority according to scheduling strategy:
   * 1. Time-based tasks (explicit schedule times) first, ordered by scheduled time
   * 2. Priority-based tasks ordered by priority (high to low)
   * 3. Other tasks
   * 
   * @param tasks - Array of tasks to order
   * @returns Ordered array of tasks
   */
  private orderTasksByPriority(tasks: Task[]): Task[] {
    const timeBased: Task[] = [];
    const priorityBased: Task[] = [];
    const other: Task[] = [];

    // Categorize tasks
    for (const task of tasks) {
      if (task.scheduleType === TaskScheduleType.EXPLICIT && task.scheduledTime) {
        timeBased.push(task);
      } else if (task.scheduleType === TaskScheduleType.PRIORITY) {
        priorityBased.push(task);
      } else {
        other.push(task);
      }
    }

    // Sort time-based tasks by scheduled time (earliest first)
    timeBased.sort((a, b) => {
      const timeA = a.scheduledTime ? a.scheduledTime.getTime() : Number.MAX_SAFE_INTEGER;
      const timeB = b.scheduledTime ? b.scheduledTime.getTime() : Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    });

    // Sort priority-based tasks by priority (highest first)
    priorityBased.sort((a, b) => b.priority - a.priority);

    // Sort other tasks by priority as well
    other.sort((a, b) => b.priority - a.priority);

    // Combine in order: time-based, priority-based, other
    const orderedTasks = [...timeBased, ...priorityBased, ...other];

    console.log("🎯 Task ordering applied:");
    console.log(`  📅 Time-based tasks: ${timeBased.length}`);
    console.log(`  🏆 Priority-based tasks: ${priorityBased.length}`);
    console.log(`  📝 Other tasks: ${other.length}`);
    console.log(`  🔀 Final order (first 10):`, orderedTasks.slice(0, 10).map(t =>
      `${t.name}(${t.scheduleType}:p${t.priority})`
    ));

    return orderedTasks;
  }
} 