/**
 * AgentAwareTaskExecutor.ts - Agent-Aware Task Executor
 * 
 * This executor bridges the gap between the generic TaskExecutor interface 
 * and the agent-specific AgentTaskExecutor implementation.
 */

import { Task, TaskStatus } from '../../models/Task.model';
import { TaskExecutionResult } from '../../models/TaskExecutionResult.model';
import { TaskExecutor } from '../../interfaces/TaskExecutor.interface';
import { AgentTaskExecutor } from '../agent/AgentTaskExecutor';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { createLogger } from '@/lib/logging/winston-logger';

/**
 * Agent-aware implementation of TaskExecutor that uses real agent planAndExecute
 */
export class AgentAwareTaskExecutor implements TaskExecutor {
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly agentTaskExecutor: AgentTaskExecutor;
  private readonly agent: AgentBase;
  private readonly runningTasks: Map<string, Promise<TaskExecutionResult>> = new Map();
  private paused = false;
  private readonly maxConcurrentTasks: number;

  constructor(agent: AgentBase, maxConcurrentTasks: number = 10) {
    this.agent = agent;
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.agentTaskExecutor = new AgentTaskExecutor();
    this.logger = createLogger({
      moduleId: 'agent-aware-task-executor',
      agentId: agent.getId()
    });

    this.logger.info("AgentAwareTaskExecutor initialized", {
      agentId: agent.getId(),
      maxConcurrentTasks
    });
  }

  /**
   * Execute a single task using the agent's planAndExecute method
   */
  async executeTask(task: Task): Promise<TaskExecutionResult> {
    this.logger.info("Executing task with real agent", {
      taskId: task.id,
      taskName: task.name,
      agentId: this.agent.getId()
    });

    try {
      // Check if execution is paused
      if (this.paused) {
        const now = new Date();
        return {
          taskId: task.id,
          status: TaskStatus.FAILED,
          startTime: now,
          endTime: now,
          duration: 0,
          successful: false,
          error: {
            message: 'Task execution is paused',
            code: 'EXECUTION_PAUSED'
          },
          wasRetry: false,
          retryCount: 0
        };
      }

      // Check concurrency limit
      if (this.runningTasks.size >= this.maxConcurrentTasks) {
        const now = new Date();
        return {
          taskId: task.id,
          status: TaskStatus.FAILED,
          startTime: now,
          endTime: now,
          duration: 0,
          successful: false,
          error: {
            message: `Maximum concurrent tasks limit (${this.maxConcurrentTasks}) reached`,
            code: 'CONCURRENCY_LIMIT'
          },
          wasRetry: false,
          retryCount: 0
        };
      }

      // Create execution promise
      const executionPromise = this.agentTaskExecutor.executeTask(task, this.agent);
      
      // Track the running task
      this.runningTasks.set(task.id, executionPromise);
      
      try {
        // Execute with the real agent
        const result = await executionPromise;
        
        this.logger.success("Real agent task execution completed", {
          taskId: task.id,
          agentId: this.agent.getId(),
          successful: result.successful,
          duration: result.duration,
          status: result.status
        });

        return result;
      } finally {
        // Always remove from running tasks
        this.runningTasks.delete(task.id);
      }
    } catch (error) {
      this.logger.error("Error executing task with agent", {
        taskId: task.id,
        agentId: this.agent.getId(),
        error: error instanceof Error ? error.message : String(error)
      });

      const now = new Date();
      return {
        taskId: task.id,
        status: TaskStatus.FAILED,
        startTime: now,
        endTime: now,
        duration: 0,
        successful: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'AGENT_EXECUTION_ERROR'
        },
        wasRetry: false,
        retryCount: 0
      };
    }
  }

  /**
   * Execute multiple tasks concurrently using the agent
   */
  async executeTasks(tasks: Task[], maxConcurrent?: number): Promise<TaskExecutionResult[]> {
    this.logger.info("Executing multiple tasks with real agent", {
      taskCount: tasks.length,
      agentId: this.agent.getId(),
      maxConcurrent: maxConcurrent || this.maxConcurrentTasks
    });

    if (!tasks.length) {
      return [];
    }

    // Check if execution is paused
    if (this.paused) {
      const now = new Date();
      return tasks.map(task => ({
        taskId: task.id,
        status: TaskStatus.FAILED,
        startTime: now,
        endTime: now,
        duration: 0,
        successful: false,
        error: {
          message: 'Task execution is paused',
          code: 'EXECUTION_PAUSED'
        },
        wasRetry: false,
        retryCount: 0
      }));
    }

    const concurrencyLimit = maxConcurrent || this.maxConcurrentTasks;
    const results: TaskExecutionResult[] = [];
    const tasksCopy = [...tasks];

    // Process tasks in batches
    while (tasksCopy.length > 0) {
      const batch = tasksCopy.splice(0, concurrencyLimit);
      
      const batchResults = await Promise.all(
        batch.map(task => 
          this.executeTask(task).catch(error => {
            this.logger.error("Task execution failed in batch", {
              taskId: task.id,
              error: error instanceof Error ? error.message : String(error)
            });

            const now = new Date();
            return {
              taskId: task.id,
              status: TaskStatus.FAILED,
              startTime: now,
              endTime: now,
              duration: 0,
              successful: false,
              error: {
                message: error instanceof Error ? error.message : String(error),
                code: 'BATCH_EXECUTION_ERROR'
              },
              wasRetry: false,
              retryCount: 0
            };
          })
        )
      );
      
      results.push(...batchResults);
    }

    this.logger.info("Batch execution completed", {
      totalTasks: tasks.length,
      successfulTasks: results.filter(r => r.successful).length,
      failedTasks: results.filter(r => !r.successful).length,
      agentId: this.agent.getId()
    });

    return results;
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    this.logger.info("Canceling task", { taskId, agentId: this.agent.getId() });
    
    const runningPromise = this.runningTasks.get(taskId);
    if (runningPromise) {
      this.runningTasks.delete(taskId);
      this.logger.info("Task canceled", { taskId });
      return true;
    }
    
    this.logger.warn("Task not found for cancellation", { taskId });
    return false;
  }

  /**
   * Get list of currently running tasks
   */
  async getRunningTasks(): Promise<Task[]> {
    // For now, return empty array as we don't store full task objects
    // This could be enhanced to track full task data if needed
    return [];
  }

  /**
   * Check if a specific task is running
   */
  async isTaskRunning(taskId: string): Promise<boolean> {
    return this.runningTasks.has(taskId);
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      runningTaskCount: this.runningTasks.size,
      maxConcurrentTasks: this.maxConcurrentTasks,
      isPaused: this.paused,
      agentId: this.agent.getId()
    };
  }

  /**
   * Pause task execution
   */
  async pauseExecution(): Promise<boolean> {
    this.logger.info("Pausing task execution", { agentId: this.agent.getId() });
    this.paused = true;
    return true;
  }

  /**
   * Resume task execution
   */
  async resumeExecution(): Promise<boolean> {
    this.logger.info("Resuming task execution", { agentId: this.agent.getId() });
    this.paused = false;
    return true;
  }
} 