/**
 * AgentExecutionEngine.ts - Handles task execution coordination and manager orchestration
 * 
 * This component is responsible for:
 * - Task execution coordination
 * - Manager orchestration
 * - Execution flow control
 * - Performance monitoring
 */

import { AgentBase } from '../base/AgentBase.interface';
import { AgentResponse, MessageProcessingOptions } from '../base/AgentBase.interface';
import { BaseManager } from '../base/managers/BaseManager';
import { ManagerType } from '../base/managers/ManagerType';
import { ModularSchedulerManager } from '../../../lib/scheduler/implementations/ModularSchedulerManager';
import { OpportunityManager } from '../../../lib/opportunity';
import { createLogger } from '../../../lib/logging/winston-logger';

/**
 * Task execution status
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

/**
 * Task execution priority
 */
export enum ExecutionPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Execution task definition
 */
export interface ExecutionTask {
  id: string;
  type: string;
  priority: ExecutionPriority;
  status: ExecutionStatus;
  input: string;
  options: MessageProcessingOptions;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  result?: AgentResponse;
  error?: Error;
  metadata: Record<string, unknown>;
}

/**
 * Execution context for task processing
 */
export interface ExecutionContext {
  taskId: string;
  agentId: string;
  sessionId?: string;
  userId?: string;
  managers: Map<ManagerType, BaseManager>;
  schedulerManager?: ModularSchedulerManager;
  opportunityManager?: OpportunityManager;
  startTime: Date;
  timeout?: number;
  metadata: Record<string, unknown>;
}

/**
 * Execution performance metrics
 */
export interface ExecutionMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  currentLoad: number;
  memoryUsage: number;
  managerUtilization: Record<string, number>;
  throughputPerMinute: number;
}

/**
 * Execution configuration
 */
export interface ExecutionConfig {
  maxConcurrentTasks: number;
  defaultTimeout: number;
  enablePerformanceMonitoring: boolean;
  enableTaskQueuing: boolean;
  retryFailedTasks: boolean;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Error class for execution-related errors
 */
export class ExecutionError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'EXECUTION_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ExecutionError';
    this.code = code;
    this.context = context;
  }
}

/**
 * AgentExecutionEngine class - Handles task execution coordination and manager orchestration
 */
export class AgentExecutionEngine {
  private logger: ReturnType<typeof createLogger>;
  private agent: AgentBase;
  private config: ExecutionConfig;
  private activeTasks: Map<string, ExecutionTask> = new Map();
  private taskQueue: ExecutionTask[] = [];
  private metrics: ExecutionMetrics;
  private performanceInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(agent: AgentBase, config: Partial<ExecutionConfig> = {}) {
    this.agent = agent;
    this.logger = createLogger({
      moduleId: 'agent-execution-engine',
    });
    
    // Set default configuration
    this.config = {
      maxConcurrentTasks: 5,
      defaultTimeout: 300000, // 5 minutes
      enablePerformanceMonitoring: true,
      enableTaskQueuing: true,
      retryFailedTasks: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };

    // Initialize metrics
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0,
      currentLoad: 0,
      memoryUsage: 0,
      managerUtilization: {},
      throughputPerMinute: 0
    };

    // Start performance monitoring if enabled
    if (this.config.enablePerformanceMonitoring) {
      this.startPerformanceMonitoring();
    }
  }

  /**
   * Execute a task with the given input and options
   */
  async executeTask(
    input: string,
    options: MessageProcessingOptions = {}
  ): Promise<AgentResponse> {
    const taskId = this.generateTaskId();
    
    try {
      this.logger.info(`Starting task execution: ${taskId}`);
      
      // Create execution task
      const task: ExecutionTask = {
        id: taskId,
        type: (options.type as string) || 'user_input',
        priority: this.determinePriority(options),
        status: ExecutionStatus.PENDING,
        input,
        options,
        metadata: Object.assign(
          {},
          options.metadata || {},
          { createdAt: new Date().toISOString() }
        )
      };

      // Check if we can execute immediately or need to queue
      if (this.canExecuteImmediately()) {
        return await this.executeTaskImmediately(task);
      } else if (this.config.enableTaskQueuing) {
        return await this.queueTask(task);
      } else {
        throw new ExecutionError(
          'Maximum concurrent tasks reached and queuing is disabled',
          'CAPACITY_EXCEEDED'
        );
      }
      
    } catch (error) {
      this.logger.error(`Error executing task ${taskId}:`, { error: error instanceof Error ? error.message : String(error) });
      this.metrics.failedTasks++;
      
      return {
        content: `Task execution failed: ${(error as Error).message}`,
        metadata: {
          error: true,
          taskId,
          errorCode: (error as ExecutionError).code || 'UNKNOWN_ERROR',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Execute task immediately
   */
  private async executeTaskImmediately(task: ExecutionTask): Promise<AgentResponse> {
    const context = this.createExecutionContext(task);
    
    try {
      // Update task status
      task.status = ExecutionStatus.RUNNING;
      task.startTime = new Date();
      this.activeTasks.set(task.id, task);
      this.metrics.totalTasks++;
      
      this.logger.info(`Executing task ${task.id} immediately`);
      
      // Execute the task through the orchestration flow
      const result = await this.orchestrateExecution(task, context);
      
      // Update task completion
      task.status = ExecutionStatus.COMPLETED;
      task.endTime = new Date();
      task.duration = task.endTime.getTime() - task.startTime!.getTime();
      task.result = result;
      
      this.metrics.completedTasks++;
      this.updateAverageExecutionTime(task.duration);
      
      this.logger.info(`Task ${task.id} completed successfully in ${task.duration}ms`);
      
      return result;
      
    } catch (error) {
      // Handle task failure
      task.status = ExecutionStatus.FAILED;
      task.endTime = new Date();
      task.error = error as Error;
      
      this.metrics.failedTasks++;
      
      // Retry if configured
      if (this.config.retryFailedTasks && this.shouldRetryTask(task)) {
        this.logger.info(`Retrying failed task ${task.id}`);
        return await this.retryTask(task);
      }
      
      throw error;
      
    } finally {
      // Clean up active task
      this.activeTasks.delete(task.id);
      this.processTaskQueue();
    }
  }

  /**
   * Queue task for later execution
   */
  private async queueTask(task: ExecutionTask): Promise<AgentResponse> {
    this.logger.info(`Queueing task ${task.id} for later execution`);
    
    this.taskQueue.push(task);
    this.sortTaskQueue();
    
    return {
      content: 'Task queued for execution',
      metadata: {
        taskId: task.id,
        queued: true,
        queuePosition: this.taskQueue.length,
        estimatedWaitTime: this.estimateWaitTime(),
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Orchestrate task execution through managers
   */
  private async orchestrateExecution(
    task: ExecutionTask,
    context: ExecutionContext
  ): Promise<AgentResponse> {
    this.logger.info(`Orchestrating execution for task ${task.id}`);
    
    // Set up timeout if configured
    const timeoutPromise = this.createTimeoutPromise(task, context);
    
    // Execute the main processing logic
    const executionPromise = this.executeMainProcessing(task, context);
    
    // Race between execution and timeout
    const result = await Promise.race([executionPromise, timeoutPromise]);
    
    // Process opportunities if available
    await this.processOpportunities(task, context, result);
    
    return result;
  }

  /**
   * Execute main processing logic
   */
  private async executeMainProcessing(
    task: ExecutionTask,
    context: ExecutionContext
  ): Promise<AgentResponse> {
    try {
      // Pre-execution hooks
      await this.executePreProcessingHooks(task, context);
      
      // Main agent processing
      const result = await this.agent.processUserInput(task.input, task.options);
      
      // Post-execution hooks
      await this.executePostProcessingHooks(task, context, result);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Error in main processing for task ${task.id}:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Execute pre-processing hooks
   */
  private async executePreProcessingHooks(
    task: ExecutionTask,
    context: ExecutionContext
  ): Promise<void> {
    try {
      // Update manager utilization metrics
      this.updateManagerUtilization(context.managers);
      
      // Notify managers of task start if they support it
      for (const [managerType, manager] of Array.from(context.managers.entries())) {
        if (typeof (manager as any).onTaskStart === 'function') {
          try {
            await (manager as any).onTaskStart(task.id, task.type);
          } catch (error) {
            this.logger.warn(`Manager ${managerType} onTaskStart failed:`, { error: error instanceof Error ? error.message : String(error) });
          }
        }
      }
      
    } catch (error) {
      this.logger.error('Error in pre-processing hooks:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Execute post-processing hooks
   */
  private async executePostProcessingHooks(
    task: ExecutionTask,
    context: ExecutionContext,
    result: AgentResponse
  ): Promise<void> {
    try {
      // Notify managers of task completion if they support it
      for (const [managerType, manager] of Array.from(context.managers.entries())) {
        if (typeof (manager as any).onTaskComplete === 'function') {
          try {
            await (manager as any).onTaskComplete(task.id, task.type, result);
          } catch (error) {
            this.logger.warn(`Manager ${managerType} onTaskComplete failed:`, { error: error instanceof Error ? error.message : String(error) });
          }
        }
      }
      
    } catch (error) {
      this.logger.error('Error in post-processing hooks:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Process opportunities after task execution
   */
  private async processOpportunities(
    task: ExecutionTask,
    context: ExecutionContext,
    result: AgentResponse
  ): Promise<void> {
    try {
      if (context.opportunityManager) {
        // Create opportunity from task execution
        const opportunity = {
          id: `opp_${task.id}`,
          type: 'task_execution',
          description: `Opportunity from task ${task.id}`,
          context: {
            taskId: task.id,
            taskType: task.type,
            input: task.input,
            result: result.content,
            duration: task.duration
          },
          priority: task.priority === ExecutionPriority.HIGH ? 'high' : 'normal',
          metadata: Object.assign(
            {},
            task.metadata,
            { executionTime: new Date().toISOString() }
          )
        };
        
        // Note: addOpportunity method may not exist on all OpportunityManager implementations
        if (typeof (context.opportunityManager as any).addOpportunity === 'function') {
          await (context.opportunityManager as any).addOpportunity(opportunity);
          this.logger.info(`Created opportunity ${opportunity.id} from task ${task.id}`);
        }
      }
      
    } catch (error) {
      this.logger.warn('Error processing opportunities:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Create timeout promise for task execution
   */
  private createTimeoutPromise(
    task: ExecutionTask,
    context: ExecutionContext
  ): Promise<AgentResponse> {
    const timeout = context.timeout || this.config.defaultTimeout;
    
    return new Promise((_, reject) => {
      setTimeout(() => {
        task.status = ExecutionStatus.TIMEOUT;
        reject(new ExecutionError(
          `Task ${task.id} timed out after ${timeout}ms`,
          'EXECUTION_TIMEOUT',
          { taskId: task.id, timeout }
        ));
      }, timeout);
    });
  }

  /**
   * Create execution context for task
   */
  private createExecutionContext(task: ExecutionTask): ExecutionContext {
    const managers = (this.agent as any).getManagers?.() || new Map();
    const schedulerManager = (this.agent as any).getSchedulerManager?.();
    const opportunityManager = (this.agent as any).getOpportunityManager?.();
    
    return {
      taskId: task.id,
      agentId: this.agent.getId(),
      sessionId: task.options.sessionId as string,
      userId: task.options.userId as string,
      managers,
      schedulerManager,
      opportunityManager,
      startTime: new Date(),
      timeout: this.config.defaultTimeout,
      metadata: task.metadata
    };
  }

  /**
   * Determine task priority from options
   */
  private determinePriority(options: MessageProcessingOptions): ExecutionPriority {
    if (options.priority) {
      return options.priority as ExecutionPriority;
    }
    
    // Default priority logic
    if (options.type === 'command') {
      return ExecutionPriority.HIGH;
    } else if (options.type === 'system') {
      return ExecutionPriority.URGENT;
    }
    
    return ExecutionPriority.NORMAL;
  }

  /**
   * Check if task can be executed immediately
   */
  private canExecuteImmediately(): boolean {
    return this.activeTasks.size < this.config.maxConcurrentTasks && !this.isShuttingDown;
  }

  /**
   * Process task queue
   */
  private processTaskQueue(): void {
    if (this.taskQueue.length === 0 || !this.canExecuteImmediately()) {
      return;
    }
    
    // Get next task from queue
    const nextTask = this.taskQueue.shift();
    if (nextTask) {
      this.logger.info(`Processing queued task ${nextTask.id}`);
      
      // Execute task asynchronously
      this.executeTaskImmediately(nextTask).catch(error => {
        this.logger.error(`Error executing queued task ${nextTask.id}:`, error);
      });
    }
  }

  /**
   * Sort task queue by priority
   */
  private sortTaskQueue(): void {
    this.taskQueue.sort((a, b) => {
      const priorityOrder = {
        [ExecutionPriority.URGENT]: 4,
        [ExecutionPriority.HIGH]: 3,
        [ExecutionPriority.NORMAL]: 2,
        [ExecutionPriority.LOW]: 1
      };
      
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Retry failed task
   */
  private async retryTask(task: ExecutionTask): Promise<AgentResponse> {
    const retryCount = (task.metadata.retryCount as number) || 0;
    
    if (retryCount >= this.config.maxRetries) {
      throw new ExecutionError(
        `Task ${task.id} failed after ${this.config.maxRetries} retries`,
        'MAX_RETRIES_EXCEEDED'
      );
    }
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
    
    // Update retry metadata
    task.metadata.retryCount = retryCount + 1;
    task.status = ExecutionStatus.PENDING;
    task.error = undefined;
    
    this.logger.info(`Retrying task ${task.id} (attempt ${retryCount + 1})`);
    
    return await this.executeTaskImmediately(task);
  }

  /**
   * Check if task should be retried
   */
  private shouldRetryTask(task: ExecutionTask): boolean {
    const retryCount = (task.metadata.retryCount as number) || 0;
    return retryCount < this.config.maxRetries;
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate wait time for queued tasks
   */
  private estimateWaitTime(): number {
    const averageTime = this.metrics.averageExecutionTime || 30000; // Default 30s
    const queuePosition = this.taskQueue.length;
    const availableSlots = Math.max(0, this.config.maxConcurrentTasks - this.activeTasks.size);
    
    if (availableSlots > 0) {
      return 0;
    }
    
    return Math.ceil(queuePosition / this.config.maxConcurrentTasks) * averageTime;
  }

  /**
   * Update average execution time
   */
  private updateAverageExecutionTime(duration: number): void {
    const totalCompleted = this.metrics.completedTasks;
    const currentAverage = this.metrics.averageExecutionTime;
    
    this.metrics.averageExecutionTime = 
      ((currentAverage * (totalCompleted - 1)) + duration) / totalCompleted;
  }

  /**
   * Update manager utilization metrics
   */
  private updateManagerUtilization(managers: Map<ManagerType, BaseManager>): void {
    for (const [managerType, manager] of Array.from(managers.entries())) {
      try {
        // Get manager utilization if available
        if (typeof (manager as any).getUtilization === 'function') {
          const utilization = (manager as any).getUtilization();
          this.metrics.managerUtilization[managerType.toString()] = utilization;
        }
      } catch (error) {
        this.logger.warn(`Error getting utilization for manager ${managerType}:`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.performanceInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 60000); // Update every minute
    
    this.logger.info('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  private stopPerformanceMonitoring(): void {
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
      this.performanceInterval = null;
      this.logger.info('Performance monitoring stopped');
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    // Update current load
    this.metrics.currentLoad = (this.activeTasks.size / this.config.maxConcurrentTasks) * 100;
    
    // Update memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    // Calculate throughput (simplified)
    this.metrics.throughputPerMinute = this.metrics.completedTasks; // Would be more sophisticated in real implementation
  }

  /**
   * Get current execution metrics
   */
  getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): ExecutionTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get queued tasks
   */
  getQueuedTasks(): ExecutionTask[] {
    return [...this.taskQueue];
  }

  /**
   * Cancel task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    // Cancel active task
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      activeTask.status = ExecutionStatus.CANCELLED;
      this.activeTasks.delete(taskId);
      this.logger.info(`Cancelled active task ${taskId}`);
      return true;
    }
    
    // Cancel queued task
    const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
      this.logger.info(`Cancelled queued task ${taskId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Shutdown execution engine
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down execution engine');
    this.isShuttingDown = true;
    
    // Stop performance monitoring
    this.stopPerformanceMonitoring();
    
    // Wait for active tasks to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeTasks.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Cancel remaining tasks
    for (const task of Array.from(this.activeTasks.values())) {
      task.status = ExecutionStatus.CANCELLED;
    }
    
    this.activeTasks.clear();
    this.taskQueue = [];
    
    this.logger.info('Execution engine shutdown completed');
  }

  /**
   * Get current configuration
   */
  getConfig(): ExecutionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Execution engine configuration updated');
  }
} 