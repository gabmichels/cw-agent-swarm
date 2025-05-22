/**
 * ModularSchedulerManager.ts - Modular Scheduler Manager Implementation
 * 
 * This file provides an implementation of the SchedulerManager interface that
 * orchestrates the various scheduler components in a modular fashion.
 */

import { ulid } from 'ulid';
import { Task, TaskStatus, TaskScheduleType, createTask } from '../models/Task.model';
import { TaskExecutionResult } from '../models/TaskExecutionResult.model';
import { TaskFilter } from '../models/TaskFilter.model';
import { SchedulerManager } from '../interfaces/SchedulerManager.interface';
import { TaskRegistry } from '../interfaces/TaskRegistry.interface';
import { TaskScheduler } from '../interfaces/TaskScheduler.interface';
import { TaskExecutor } from '../interfaces/TaskExecutor.interface';
import { DateTimeProcessor } from '../interfaces/DateTimeProcessor.interface';
import { SchedulerConfig, DEFAULT_SCHEDULER_CONFIG } from '../models/SchedulerConfig.model';
import { SchedulerMetrics } from '../models/SchedulerMetrics.model';
import { SchedulerError } from '../errors/SchedulerError';

/**
 * Implementation of the SchedulerManager interface that orchestrates
 * the TaskRegistry, TaskScheduler, and TaskExecutor components.
 */
export class ModularSchedulerManager implements SchedulerManager {
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

  /**
   * Create a new ModularSchedulerManager
   * 
   * @param registry - Task registry component
   * @param scheduler - Task scheduler component
   * @param executor - Task executor component
   * @param dateTimeProcessor - Date/time processing component
   * @param config - Optional configuration
   */
  constructor(
    registry: TaskRegistry,
    scheduler: TaskScheduler,
    executor: TaskExecutor,
    dateTimeProcessor: DateTimeProcessor,
    config?: Partial<SchedulerConfig>
  ) {
    this.id = `scheduler-manager-${ulid()}`;
    this.registry = registry;
    this.scheduler = scheduler;
    this.executor = executor;
    this.dateTimeProcessor = dateTimeProcessor;
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  }

  /**
   * Initialize the scheduler manager
   * 
   * @param config - Optional configuration to override defaults
   * @returns true if initialization was successful
   * @throws {SchedulerError} If there's an error during initialization
   */
  async initialize(config?: Partial<SchedulerConfig>): Promise<boolean> {
    try {
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // If auto-scheduling is enabled, start the scheduler
      if (this.config.enabled && this.config.enableAutoScheduling) {
        await this.startScheduler();
      }

      return true;
    } catch (error) {
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
    try {
      // Handle vague temporal expressions if present
      let scheduledTime = task.scheduledTime;
      let priority = task.priority ?? this.config.defaultPriority;
      
      if (task.scheduleType === TaskScheduleType.EXPLICIT && 
          typeof task.scheduledTime === 'string') {
        // Try to parse as vague temporal expression
        const vagueResult = this.dateTimeProcessor.translateVagueTerm(task.scheduledTime);
        
        if (vagueResult) {
          // Use the date and priority from the vague term
          if (vagueResult.date) {
            scheduledTime = vagueResult.date;
          }
          priority = vagueResult.priority;
        } else {
          // Try to parse as natural language date
          const parsedDate = this.dateTimeProcessor.parseNaturalLanguage(task.scheduledTime);
          if (parsedDate) {
            scheduledTime = parsedDate;
          }
        }
      }

      // Apply default values
      const taskWithDefaults = createTask({
        ...task,
        scheduledTime,
        priority
      });
      
      // Store the task in the registry
      return await this.registry.storeTask(taskWithDefaults);
    } catch (error) {
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
   * Update an existing task
   * 
   * @param task - The task with updated fields
   * @returns The updated task
   * @throws {SchedulerError} If the task cannot be updated
   */
  async updateTask(task: Task): Promise<Task> {
    try {
      return await this.registry.updateTask(task);
    } catch (error) {
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
    try {
      return await this.registry.deleteTask(taskId);
    } catch (error) {
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
    try {
      return await this.registry.getTaskById(taskId);
    } catch (error) {
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
    try {
      return await this.registry.findTasks(filter);
    } catch (error) {
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
   * Execute tasks that are due according to scheduling strategies
   * 
   * @returns Array of execution results for tasks that were executed
   * @throws {SchedulerError} If there's an error during scheduled execution
   */
  async executeDueTasks(): Promise<TaskExecutionResult[]> {
    try {
      const startTime = Date.now();

      // Get all pending tasks
      const pendingTasks = await this.registry.findTasks({
        status: TaskStatus.PENDING
      });

      if (!pendingTasks.length) {
        return [];
      }

      // Determine which tasks are due
      const dueTasks = await this.scheduler.getDueTasks(pendingTasks);

      if (!dueTasks.length) {
        return [];
      }

      // Execute the due tasks
      const results = await this.executor.executeTasks(
        dueTasks,
        this.config.maxConcurrentTasks
      );

      // Update tasks with execution results
      for (let i = 0; i < dueTasks.length; i++) {
        const task = dueTasks[i];
        const result = results[i];

        // Update task with execution result
        await this.registry.updateTask({
          ...task,
          status: result.status,
          lastExecutedAt: result.endTime,
          metadata: {
            ...task.metadata,
            executionTime: result.duration,
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
      }

      // Update metrics
      const endTime = Date.now();
      this.schedulingTimes.push(endTime - startTime);
      this.schedulingIterations++;

      return results;
    } catch (error) {
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
   * Execute a specific task immediately, regardless of scheduling
   * 
   * @param taskId - ID of the task to execute
   * @returns The execution result
   * @throws {SchedulerError} If the task cannot be executed
   */
  async executeTaskNow(taskId: string): Promise<TaskExecutionResult> {
    try {
      // Get the task
      const task = await this.registry.getTaskById(taskId);
      
      if (!task) {
        throw new SchedulerError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
      }

      // Execute the task
      const result = await this.executor.executeTask(task);

      // Update the task with execution result
      await this.registry.updateTask({
        ...task,
        status: result.status,
        lastExecutedAt: result.endTime,
        metadata: {
          ...task.metadata,
          executionTime: result.duration,
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

      return result;
    } catch (error) {
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
    try {
      if (this.running) {
        return false; // Already running
      }

      this.running = true;
      this.startTime = new Date();

      // Execute the scheduling loop
      const scheduleLoop = async () => {
        if (!this.running) {
          return;
        }

        try {
          await this.executeDueTasks();
        } catch (error) {
          console.error('Error executing due tasks:', error);
        }
      };

      // Set up the scheduling timer
      this.schedulingTimer = setInterval(
        scheduleLoop,
        this.config.schedulingIntervalMs
      );

      // Execute immediately on start
      scheduleLoop();

      return true;
    } catch (error) {
      this.running = false;
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
    try {
      if (!this.running) {
        return false; // Already stopped
      }

      this.running = false;

      if (this.schedulingTimer) {
        clearInterval(this.schedulingTimer);
        this.schedulingTimer = null;
      }

      return true;
    } catch (error) {
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
    return this.running;
  }

  /**
   * Get metrics about the scheduler's performance
   * 
   * @returns Metrics object with performance data
   * @throws {SchedulerError} If metrics cannot be collected
   */
  async getMetrics(): Promise<SchedulerMetrics> {
    try {
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

      // Build metrics object
      const now = new Date();
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
        scheduleTypeCounts: {
          explicit: explicitCount,
          interval: intervalCount,
          priority: priorityCount
        },
        executionsByHour: Array(24).fill(0), // Would need additional tracking
        custom: {} // For custom metrics
      };

      return metrics;
    } catch (error) {
      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to get metrics: ${(error as Error).message}`,
        'METRICS_ERROR'
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
    try {
      // Stop the scheduler
      if (this.running) {
        await this.stopScheduler();
      }

      // Clear all tasks
      await this.registry.clearAllTasks();

      // Reset the scheduler
      await this.scheduler.reset();

      // Reset metrics
      this.schedulingIterations = 0;
      this.schedulingTimes = [];
      this.startTime = null;

      return true;
    } catch (error) {
      if (error instanceof SchedulerError) {
        throw error;
      }
      throw new SchedulerError(
        `Failed to reset scheduler: ${(error as Error).message}`,
        'RESET_ERROR'
      );
    }
  }
} 