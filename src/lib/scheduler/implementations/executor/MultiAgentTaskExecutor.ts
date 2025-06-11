/**
 * MultiAgentTaskExecutor.ts - Multi-Agent Task Executor
 * 
 * This executor can handle tasks for multiple agents by looking up the specific agent
 * from the runtime registry based on the task's metadata.agentId.
 */

import { Task, TaskStatus } from '../../models/Task.model';
import { TaskExecutionResult } from '../../models/TaskExecutionResult.model';
import { TaskExecutor } from '../../interfaces/TaskExecutor.interface';
import { AgentTaskExecutor } from '../agent/AgentTaskExecutor';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { createLogger } from '@/lib/logging/winston-logger';

/**
 * Multi-agent implementation of TaskExecutor that executes tasks using appropriate agents
 */
export class MultiAgentTaskExecutor implements TaskExecutor {
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly agentTaskExecutor: AgentTaskExecutor;
  private readonly runningTasks: Map<string, Promise<TaskExecutionResult>> = new Map();
  private paused = false;
  private readonly maxConcurrentTasks: number;

  constructor(maxConcurrentTasks: number = 20) {
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.agentTaskExecutor = new AgentTaskExecutor();
    this.logger = createLogger({
      moduleId: 'multi-agent-task-executor'
    });

    this.logger.info("MultiAgentTaskExecutor initialized", {
      maxConcurrentTasks
    });
  }

  /**
   * Get agent by ID from runtime registry
   */
  private async getAgent(agentId: string): Promise<AgentBase | null> {
    try {
      // Import the agent service to access the runtime registry
      const { getAgentById } = await import('../../../../server/agent/agent-service');
      return getAgentById(agentId);
    } catch (error) {
      this.logger.error("Failed to get agent from registry", {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get a fallback agent when no specific agent is identified
   */
  private async getFallbackAgent(): Promise<AgentBase | null> {
    try {
      // Import the agent service to access the runtime registry
      const { getAllAgents } = await import('../../../../server/agent/agent-service');
      const agents = getAllAgents();
      
      // Return the first available agent as fallback
      if (agents.length > 0) {
        this.logger.info("Found fallback agent", {
          fallbackAgentId: agents[0].getId(),
          totalAgents: agents.length
        });
        return agents[0];
      }
      
      this.logger.warn("No agents available for fallback");
      return null;
    } catch (error) {
      this.logger.error("Failed to get fallback agent from registry", {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Extract agent ID from task metadata
   */
  private extractAgentId(task: Task): string | null {
    const agentIdMetadata = task.metadata?.agentId;
    
    if (!agentIdMetadata) {
      return null;
    }
    
    // Handle different formats of agentId in metadata
    if (typeof agentIdMetadata === 'string') {
      return agentIdMetadata;
    }
    
    if (typeof agentIdMetadata === 'object' && 'id' in agentIdMetadata) {
      return (agentIdMetadata as { id: string }).id;
    }
    
    return null;
  }

  /**
   * Execute a single task using the appropriate agent
   */
  async executeTask(task: Task): Promise<TaskExecutionResult> {
    const agentId = this.extractAgentId(task);
    
    this.logger.info("Executing task with multi-agent executor", {
      taskId: task.id,
      taskName: task.name,
      agentId: agentId || 'unknown'
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

      // Get the agent for this task
      if (!agentId) {
        // Try to find a fallback agent if no agentId is specified
        const fallbackAgent = await this.getFallbackAgent();
        if (!fallbackAgent) {
          const now = new Date();
          return {
            taskId: task.id,
            status: TaskStatus.FAILED,
            startTime: now,
            endTime: now,
            duration: 0,
            successful: false,
            error: {
              message: 'No agent ID found in task metadata and no fallback agent available',
              code: 'NO_AGENT_ID'
            },
            wasRetry: false,
            retryCount: 0
          };
        }
        
        this.logger.info("Using fallback agent for task without agentId", {
          taskId: task.id,
          fallbackAgentId: fallbackAgent.getId()
        });
        
        // Execute with fallback agent
        const executionPromise = this.agentTaskExecutor.executeTask(task, fallbackAgent);
        this.runningTasks.set(task.id, executionPromise);
        
        try {
          const result = await executionPromise;
          this.logger.success("Multi-agent task execution completed with fallback agent", {
            taskId: task.id,
            fallbackAgentId: fallbackAgent.getId(),
            successful: result.successful,
            duration: result.duration,
            status: result.status
          });
          return result;
        } finally {
          this.runningTasks.delete(task.id);
        }
      }

      const agent = await this.getAgent(agentId);
      if (!agent) {
        const now = new Date();
        return {
          taskId: task.id,
          status: TaskStatus.FAILED,
          startTime: now,
          endTime: now,
          duration: 0,
          successful: false,
          error: {
            message: `Agent not found in runtime registry: ${agentId}`,
            code: 'AGENT_NOT_FOUND'
          },
          wasRetry: false,
          retryCount: 0
        };
      }

      // Create execution promise
      const executionPromise = this.agentTaskExecutor.executeTask(task, agent);
      
      // Track the running task
      this.runningTasks.set(task.id, executionPromise);
      
      try {
        // Execute with the real agent
        const result = await executionPromise;
        
        this.logger.success("Multi-agent task execution completed", {
          taskId: task.id,
          agentId,
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
      this.logger.error("Error executing task with multi-agent executor", {
        taskId: task.id,
        agentId,
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
          code: 'MULTI_AGENT_EXECUTION_ERROR'
        },
        wasRetry: false,
        retryCount: 0
      };
    }
  }

  /**
   * Execute multiple tasks concurrently using appropriate agents
   */
  async executeTasks(tasks: Task[], maxConcurrent?: number): Promise<TaskExecutionResult[]> {
    this.logger.info("Executing multiple tasks with multi-agent executor", {
      taskCount: tasks.length,
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

    return results;
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const runningTask = this.runningTasks.get(taskId);
    if (!runningTask) {
      return false;
    }

    // Remove from running tasks to prevent further execution
    this.runningTasks.delete(taskId);
    
    this.logger.info("Task cancelled", { taskId });
    return true;
  }

  /**
   * Get all currently running tasks
   */
  async getRunningTasks(): Promise<Task[]> {
    // This would require storing task objects, but for now return empty array
    return [];
  }

  /**
   * Check if a specific task is currently running
   */
  async isTaskRunning(taskId: string): Promise<boolean> {
    return this.runningTasks.has(taskId);
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      runningTaskCount: this.runningTasks.size,
      maxConcurrentTasks: this.maxConcurrentTasks,
      isPaused: this.paused
    };
  }

  /**
   * Pause task execution
   */
  async pauseExecution(): Promise<boolean> {
    this.paused = true;
    this.logger.info("Task execution paused");
    return true;
  }

  /**
   * Resume task execution
   */
  async resumeExecution(): Promise<boolean> {
    this.paused = false;
    this.logger.info("Task execution resumed");
    return true;
  }
} 