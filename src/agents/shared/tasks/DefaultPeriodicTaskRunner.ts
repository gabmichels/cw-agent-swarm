/**
 * Default Periodic Task Runner Implementation
 * 
 * This file implements the default periodic task runner
 * that can be used to run scheduled tasks for agents.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PeriodicTaskRunner,
  PeriodicTask,
  PeriodicTaskType,
  PeriodicTaskStatus,
  PeriodicTaskResult
} from './PeriodicTaskRunner.interface';

/**
 * Error class for periodic task errors
 */
class PeriodicTaskError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'TASK_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PeriodicTaskError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Default implementation of the PeriodicTaskRunner interface
 */
export class DefaultPeriodicTaskRunner implements PeriodicTaskRunner {
  private tasks: Map<string, PeriodicTask> = new Map();
  private taskHistory: Map<string, PeriodicTaskResult[]> = new Map();
  private taskRunners: Map<string, () => Promise<string | Record<string, unknown>>> = new Map();
  private taskCheckInterval: NodeJS.Timeout | null = null;
  private logger: any;
  
  /**
   * Create a new DefaultPeriodicTaskRunner
   * 
   * @param options - Configuration options
   */
  constructor(options: {
    checkIntervalMs?: number;
    logger?: any;
    initialTasks?: Omit<PeriodicTask, 'id' | 'createdAt' | 'updatedAt' | 'status'>[];
  } = {}) {
    this.logger = options.logger || console;
    
    // Register initial tasks if provided
    if (options.initialTasks && options.initialTasks.length > 0) {
      Promise.all(
        options.initialTasks.map(task => this.registerPeriodicTask(task))
      ).catch(error => {
        this.logger.error('Error registering initial tasks:', error);
      });
    }
    
    // Set up task check interval
    const checkIntervalMs = options.checkIntervalMs || 60000; // Default: 1 minute
    this.startTaskChecker(checkIntervalMs);
  }
  
  /**
   * Register a task runner function
   * This allows the task runner to execute custom task logic
   * 
   * @param taskId ID of the task
   * @param runner Function to execute the task
   */
  registerTaskRunner(
    taskId: string, 
    runner: () => Promise<string | Record<string, unknown>>
  ): void {
    this.taskRunners.set(taskId, runner);
  }
  
  /**
   * Start the periodic task checker
   * 
   * @param intervalMs Check interval in milliseconds
   */
  private startTaskChecker(intervalMs: number): void {
    // Clear any existing interval
    if (this.taskCheckInterval) {
      clearInterval(this.taskCheckInterval);
    }
    
    // Set up new interval
    this.taskCheckInterval = setInterval(() => {
      this.checkAndRunDueTasks().catch(error => {
        this.logger.error('Error checking and running due tasks:', error);
      });
    }, intervalMs);
    
    this.logger.debug(`Started periodic task checker with interval ${intervalMs}ms`);
  }
  
  /**
   * Stop the periodic task checker
   */
  stop(): void {
    if (this.taskCheckInterval) {
      clearInterval(this.taskCheckInterval);
      this.taskCheckInterval = null;
      this.logger.debug('Stopped periodic task checker');
    }
  }
  
  /**
   * Check for and run due tasks
   */
  private async checkAndRunDueTasks(): Promise<void> {
    const dueTasks = await this.getDuePeriodicTasks();
    
    if (dueTasks.length === 0) {
      return;
    }
    
    this.logger.debug(`Found ${dueTasks.length} due tasks`);
    
    // Run each due task
    await Promise.all(
      dueTasks.map(task => 
        this.runPeriodicTask(task.id).catch(error => {
          this.logger.error(`Error running due task ${task.id}:`, error);
        })
      )
    );
  }
  
  /**
   * Calculate next run time based on task type
   * 
   * @param task Task to calculate next run time for
   * @returns Next run time
   */
  private calculateNextRunTime(task: PeriodicTask): Date {
    const now = new Date();
    let nextRunTime = new Date(now);
    
    if (task.cronExpression) {
      // Calculate next run time based on cron expression
      // In a real implementation, this would use a cron parser library
      // For now, add 1 day as a placeholder
      nextRunTime.setDate(nextRunTime.getDate() + 1);
      return nextRunTime;
    }
    
    // Calculate based on task type
    switch (task.type) {
      case PeriodicTaskType.DAILY:
        nextRunTime.setDate(nextRunTime.getDate() + 1);
        break;
      case PeriodicTaskType.WEEKLY:
        nextRunTime.setDate(nextRunTime.getDate() + 7);
        break;
      case PeriodicTaskType.MONTHLY:
        nextRunTime.setMonth(nextRunTime.getMonth() + 1);
        break;
      case PeriodicTaskType.QUARTERLY:
        nextRunTime.setMonth(nextRunTime.getMonth() + 3);
        break;
      case PeriodicTaskType.YEARLY:
        nextRunTime.setFullYear(nextRunTime.getFullYear() + 1);
        break;
      case PeriodicTaskType.CUSTOM:
        // Default to daily if no cron expression for custom type
        nextRunTime.setDate(nextRunTime.getDate() + 1);
        break;
    }
    
    return nextRunTime;
  }
  
  /**
   * Register a periodic task
   */
  async registerPeriodicTask(
    task: Omit<PeriodicTask, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ): Promise<PeriodicTask> {
    const id = uuidv4();
    const now = new Date();
    
    // Set next run time if not provided
    const nextRunTime = task.nextRunTime || now;
    
    const newTask: PeriodicTask = {
      ...task,
      id,
      status: PeriodicTaskStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      nextRunTime
    };
    
    this.tasks.set(id, newTask);
    this.taskHistory.set(id, []);
    
    this.logger.debug(`Registered periodic task ${id} (${task.name})`);
    return newTask;
  }
  
  /**
   * Get a task by ID
   */
  async getPeriodicTask(taskId: string): Promise<PeriodicTask | null> {
    return this.tasks.get(taskId) || null;
  }
  
  /**
   * Update a task
   */
  async updatePeriodicTask(
    taskId: string,
    updates: Partial<Omit<PeriodicTask, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<PeriodicTask> {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      throw new PeriodicTaskError(`Task ${taskId} not found`, 'TASK_NOT_FOUND');
    }
    
    const updatedTask: PeriodicTask = {
      ...task,
      ...updates,
      id: task.id, // Ensure ID doesn't change
      createdAt: task.createdAt, // Ensure creation time doesn't change
      updatedAt: new Date() // Update the updatedAt time
    };
    
    this.tasks.set(taskId, updatedTask);
    this.logger.debug(`Updated periodic task ${taskId}`);
    
    return updatedTask;
  }
  
  /**
   * List tasks with optional filtering
   */
  async listPeriodicTasks(options: {
    type?: PeriodicTaskType[];
    status?: PeriodicTaskStatus[];
    enabled?: boolean;
    targetId?: string;
    sortBy?: 'nextRunTime' | 'lastRunTime' | 'createdAt' | 'name';
    sortDirection?: 'asc' | 'desc';
  } = {}): Promise<PeriodicTask[]> {
    let tasks = Array.from(this.tasks.values());
    
    // Apply filters
    if (options.type && options.type.length > 0) {
      tasks = tasks.filter(task => options.type?.includes(task.type));
    }
    
    if (options.status && options.status.length > 0) {
      tasks = tasks.filter(task => options.status?.includes(task.status));
    }
    
    if (options.enabled !== undefined) {
      tasks = tasks.filter(task => task.enabled === options.enabled);
    }
    
    if (options.targetId) {
      tasks = tasks.filter(task => task.targetId === options.targetId);
    }
    
    // Apply sorting
    if (options.sortBy) {
      tasks = tasks.sort((a, b) => {
        const sortDirection = options.sortDirection === 'desc' ? -1 : 1;
        
        switch (options.sortBy) {
          case 'nextRunTime':
            return sortDirection * (a.nextRunTime.getTime() - b.nextRunTime.getTime());
          case 'lastRunTime':
            // Handle undefined lastRunTime values
            if (!a.lastRunTime && !b.lastRunTime) return 0;
            if (!a.lastRunTime) return sortDirection * 1;
            if (!b.lastRunTime) return sortDirection * -1;
            return sortDirection * (a.lastRunTime.getTime() - b.lastRunTime.getTime());
          case 'createdAt':
            return sortDirection * (a.createdAt.getTime() - b.createdAt.getTime());
          case 'name':
            return sortDirection * a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });
    }
    
    return tasks;
  }
  
  /**
   * Run a task immediately
   */
  async runPeriodicTask(
    taskId: string,
    options: {
      parameters?: Record<string, unknown>;
      updateNextRunTime?: boolean;
    } = {}
  ): Promise<PeriodicTaskResult> {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      throw new PeriodicTaskError(`Task ${taskId} not found`, 'TASK_NOT_FOUND');
    }
    
    if (!task.enabled) {
      throw new PeriodicTaskError(`Task ${taskId} is disabled`, 'TASK_DISABLED');
    }
    
    // Update task status to running
    let runningTask = await this.updatePeriodicTask(taskId, {
      status: PeriodicTaskStatus.RUNNING,
      parameters: options.parameters || task.parameters
    });
    
    const executionId = uuidv4();
    const startTime = new Date();
    
    try {
      this.logger.debug(`Running periodic task ${taskId} (${task.name})`);
      
      // Get the task runner
      const runner = this.taskRunners.get(taskId);
      
      let result: string | Record<string, unknown>;
      
      if (runner) {
        // Run the registered task function
        result = await runner();
      } else {
        // No runner registered, return a placeholder result
        result = `Task ${taskId} executed without a registered runner`;
      }
      
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      
      // Update next run time if requested
      const nextRunTime = options.updateNextRunTime !== false
        ? this.calculateNextRunTime(task)
        : task.nextRunTime;
      
      // Update task with successful completion
      const updatedTask = await this.updatePeriodicTask(taskId, {
        status: PeriodicTaskStatus.COMPLETED,
        lastRunTime: endTime,
        nextRunTime,
        lastResult: typeof result === 'string' ? result : JSON.stringify(result),
        lastError: undefined
      });
      
      // Create task result
      const taskResult: PeriodicTaskResult = {
        taskId,
        executionId,
        success: true,
        result,
        startTime,
        endTime,
        durationMs,
        updatedTask
      };
      
      // Add to task history
      this.addToTaskHistory(taskId, taskResult);
      
      return taskResult;
    } catch (error) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update task with failure
      const updatedTask = await this.updatePeriodicTask(taskId, {
        status: PeriodicTaskStatus.FAILED,
        lastRunTime: endTime,
        lastError: errorMessage
      });
      
      // Create task result
      const taskResult: PeriodicTaskResult = {
        taskId,
        executionId,
        success: false,
        error: errorMessage,
        startTime,
        endTime,
        durationMs,
        updatedTask
      };
      
      // Add to task history
      this.addToTaskHistory(taskId, taskResult);
      
      return taskResult;
    }
  }
  
  /**
   * Add execution result to task history
   */
  private addToTaskHistory(taskId: string, result: PeriodicTaskResult): void {
    let history = this.taskHistory.get(taskId) || [];
    
    // Add to history (with a max of 100 entries)
    history = [result, ...history].slice(0, 100);
    
    this.taskHistory.set(taskId, history);
  }
  
  /**
   * Enable or disable a task
   */
  async setPeriodicTaskEnabled(
    taskId: string,
    enabled: boolean
  ): Promise<PeriodicTask> {
    return this.updatePeriodicTask(taskId, { enabled });
  }
  
  /**
   * Delete a task
   */
  async deletePeriodicTask(taskId: string): Promise<boolean> {
    const exists = this.tasks.has(taskId);
    
    if (!exists) {
      return false;
    }
    
    this.tasks.delete(taskId);
    this.taskHistory.delete(taskId);
    this.taskRunners.delete(taskId);
    
    this.logger.debug(`Deleted periodic task ${taskId}`);
    return true;
  }
  
  /**
   * Get due tasks
   */
  async getDuePeriodicTasks(): Promise<PeriodicTask[]> {
    const now = new Date();
    
    return Array.from(this.tasks.values()).filter(task => 
      task.enabled && 
      task.status !== PeriodicTaskStatus.RUNNING &&
      task.nextRunTime <= now
    );
  }
  
  /**
   * Get execution history for a task
   */
  async getTaskExecutionHistory(
    taskId: string,
    options: {
      limit?: number;
      offset?: number;
      sortDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<PeriodicTaskResult[]> {
    const history = this.taskHistory.get(taskId) || [];
    
    // Sort by start time
    const sortedHistory = options.sortDirection === 'asc'
      ? [...history].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      : history; // Default is already desc
    
    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || sortedHistory.length;
    
    return sortedHistory.slice(offset, offset + limit);
  }
} 