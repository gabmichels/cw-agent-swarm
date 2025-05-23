/**
 * AgentTaskExecutor.ts - Real Agent Task Execution
 * 
 * This implementation executes tasks through real agent planning and execution systems.
 * NO SIMULATIONS. NO PLACEHOLDERS. REAL IMPLEMENTATION ONLY.
 */

import { ulid } from 'ulid';
import { Task, TaskStatus } from '../../models/Task.model';
import { TaskExecutionResult } from '../../models/TaskExecutionResult.model';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { 
  AgentTaskExecutor as IAgentTaskExecutor, 
  AgentTaskError 
} from '../../interfaces/AgentTaskHandler.interface';
import { PlanAndExecuteOptions } from '../../../../agents/chloe/planAndExecute';
import { PlanningState } from '../../../../agents/chloe/graph/nodes/types';
import { createLogger } from '@/lib/logging/winston-logger';

/**
 * Real implementation of agent task executor
 */
export class AgentTaskExecutor implements IAgentTaskExecutor {
  private readonly executorId: string;
  private readonly logger: ReturnType<typeof createLogger>;

  constructor() {
    this.executorId = `agent-task-executor-${ulid()}`;
    this.logger = createLogger({
      moduleId: this.executorId,
      agentId: 'system'
    });

    this.logger.info("AgentTaskExecutor initialized", {
      executorId: this.executorId
    });
  }

  /**
   * Execute a task using a specific agent - REAL IMPLEMENTATION
   */
  async executeTask(task: Task, agent: AgentBase): Promise<TaskExecutionResult> {
    const startTime = new Date();
    const executionId = ulid();

    this.logger.info("Starting real agent task execution", {
      executionId,
      taskId: task.id,
      taskName: task.name,
      agentId: agent.getId(),
      agentName: agent.getName ? agent.getName() : 'unknown'
    });

    try {
      // Validate task-agent compatibility
      if (!this.validateTaskForAgent(task, agent)) {
        throw new AgentTaskError(
          `Task ${task.id} is not compatible with agent ${agent.getId()}`,
          'TASK_AGENT_INCOMPATIBLE',
          { taskId: task.id, agentId: agent.getId() }
        );
      }

      // Create plan-and-execute options
      const planAndExecuteOptions = this.createPlanAndExecuteOptions(task);

      this.logger.info("Calling agent.planAndExecute() - REAL EXECUTION", {
        executionId,
        taskId: task.id,
        agentId: agent.getId(),
        options: {
          goalPrompt: planAndExecuteOptions.goalPrompt,
          autonomyMode: planAndExecuteOptions.autonomyMode,
          requireApproval: planAndExecuteOptions.requireApproval,
          tags: planAndExecuteOptions.tags
        }
      });

      // **REAL AGENT EXECUTION - NO SIMULATION**
      let agentResult: PlanningState;
      
      // Check if agent has planAndExecute method (for Chloe agents)
      if ((agent as any).planAndExecute && typeof (agent as any).planAndExecute === 'function') {
        this.logger.info("Using agent.planAndExecute() method", {
          executionId,
          taskId: task.id,
          agentId: agent.getId()
        });

        agentResult = await (agent as any).planAndExecute(planAndExecuteOptions);
      } else {
        this.logger.error("Agent does not have planAndExecute method", {
          executionId,
          taskId: task.id,
          agentId: agent.getId(),
          availableMethods: Object.getOwnPropertyNames(agent).filter(prop => typeof (agent as any)[prop] === 'function')
        });

        throw new AgentTaskError(
          `Agent ${agent.getId()} does not support planAndExecute method`,
          'AGENT_METHOD_NOT_SUPPORTED',
          { 
            taskId: task.id, 
            agentId: agent.getId(),
            requiredMethod: 'planAndExecute'
          }
        );
      }

      this.logger.info("Agent execution completed", {
        executionId,
        taskId: task.id,
        agentId: agent.getId(),
        agentResultKeys: Object.keys(agentResult || {}),
        finalResult: agentResult?.finalResult,
        taskStatus: agentResult?.task?.status
      });

      // Map agent result to task execution result
      const taskResult = this.mapExecutionResult(agentResult, task);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.success("Task execution completed successfully", {
        executionId,
        taskId: task.id,
        agentId: agent.getId(),
        duration,
        successful: taskResult.successful,
        status: taskResult.status
      });

      return {
        ...taskResult,
        startTime,
        endTime,
        duration
      };

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.error("Task execution failed", {
        executionId,
        taskId: task.id,
        agentId: agent.getId(),
        duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Create failed execution result
      return {
        taskId: task.id,
        successful: false,
        status: TaskStatus.FAILED,
        startTime,
        endTime,
        duration,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        wasRetry: false,
        retryCount: 0
      };
    }
  }

  /**
   * Validate that a task can be executed by a specific agent
   */
  validateTaskForAgent(task: Task, agent: AgentBase): boolean {
    this.logger.info("Validating task for agent", {
      taskId: task.id,
      agentId: agent.getId()
    });

    try {
      // Basic validation checks
      const hasId = Boolean(agent.getId && typeof agent.getId === 'function');
      const hasHealth = Boolean(agent.getHealth && typeof agent.getHealth === 'function');
      const hasPlanAndExecute = Boolean((agent as any).planAndExecute && typeof (agent as any).planAndExecute === 'function');

      const isValid = hasId && hasHealth && hasPlanAndExecute;

      this.logger.info("Task-agent validation result", {
        taskId: task.id,
        agentId: agent.getId(),
        hasId,
        hasHealth,
        hasPlanAndExecute,
        isValid
      });

      return isValid;
    } catch (error) {
      this.logger.error("Error validating task for agent", {
        taskId: task.id,
        agentId: agent.getId ? agent.getId() : 'unknown',
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Create plan-and-execute options from a task
   */
  createPlanAndExecuteOptions(task: Task): PlanAndExecuteOptions {
    this.logger.info("Creating plan-and-execute options", {
      taskId: task.id,
      taskName: task.name
    });

    // Extract goal from task
    const goalPrompt = this.extractGoalFromTask(task);
    
    // Determine autonomy mode based on task priority (should be boolean, not string)
    const autonomyMode = task.priority >= 8; // true for autonomous, false for collaborative
    
    // High priority tasks don't require approval
    const requireApproval = task.priority < 7;
    
    // Extract tags from task metadata
    const tags = this.extractTagsFromTask(task);

    const options: PlanAndExecuteOptions = {
      goalPrompt,
      autonomyMode,
      requireApproval,
      tags
    };

    this.logger.info("Plan-and-execute options created", {
      taskId: task.id,
      options
    });

    return options;
  }

  /**
   * Map agent execution result to task execution result
   */
  mapExecutionResult(agentResult: PlanningState, task: Task): TaskExecutionResult {
    this.logger.info("Mapping agent result to task result", {
      taskId: task.id,
      agentResultStatus: agentResult?.task?.status,
      finalResult: agentResult?.finalResult
    });

    try {
      // Determine if execution was successful
      const successful = agentResult?.task?.status === 'complete' || Boolean(agentResult?.finalResult);
      
      // Map agent status to task status
      let status: TaskStatus;
      if (agentResult?.task?.status === 'complete') {
        status = TaskStatus.COMPLETED;
      } else if (agentResult?.task?.status === 'failed') {
        status = TaskStatus.FAILED;
      } else if (agentResult?.error) {
        status = TaskStatus.FAILED;
      } else if (successful) {
        status = TaskStatus.COMPLETED;
      } else {
        status = TaskStatus.FAILED;
      }

      // Extract result data
      const result = agentResult?.finalResult || 
                   agentResult?.task?.subGoals?.map(sg => sg.result)?.join(', ') || 
                   'Task execution completed';

      // Extract error information
      const error = agentResult?.error ? {
        message: typeof agentResult.error === 'string' ? agentResult.error : JSON.stringify(agentResult.error),
        code: 'AGENT_EXECUTION_ERROR'
      } : (!successful ? {
        message: 'Task execution failed without specific error',
        code: 'UNKNOWN_FAILURE'
      } : undefined);

      // Create timestamps for the result
      const now = new Date();
      const estimatedDuration = 30000; // Default 30 seconds if no timing info available

      const taskResult: TaskExecutionResult = {
        taskId: task.id,
        successful,
        status,
        startTime: new Date(now.getTime() - estimatedDuration), // Estimate start time
        endTime: now,
        duration: estimatedDuration,
        result: typeof result === 'string' ? result : JSON.stringify(result),
        error,
        wasRetry: false, // TODO: Track retry attempts
        retryCount: 0,
        metadata: {
          agentResult: agentResult,
          executedBy: 'AgentTaskExecutor',
          executionMethod: 'planAndExecute'
        }
      };

      this.logger.info("Agent result mapped successfully", {
        taskId: task.id,
        successful,
        status,
        hasResult: Boolean(result),
        hasError: Boolean(error)
      });

      return taskResult;
    } catch (error) {
      this.logger.error("Error mapping agent result", {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return failed result on mapping error
      const now = new Date();
      return {
        taskId: task.id,
        successful: false,
        status: TaskStatus.FAILED,
        startTime: now,
        endTime: now,
        duration: 0,
        result: 'Failed to map agent execution result',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'RESULT_MAPPING_ERROR'
        },
        wasRetry: false,
        retryCount: 0
      };
    }
  }

  /**
   * Extract goal prompt from task
   */
  private extractGoalFromTask(task: Task): string {
    // Try different sources for the goal prompt
    const title = task.metadata?.title as string;
    const description = task.metadata?.description as string;
    const text = (task as any).text as string;
    
    // Build comprehensive goal prompt
    let goalPrompt = task.name;
    
    if (title && title !== task.name) {
      goalPrompt = title;
    }
    
    if (description) {
      goalPrompt += `\n\nDescription: ${description}`;
    }
    
    if (text && text !== title && text !== task.name) {
      goalPrompt += `\n\nAdditional context: ${text}`;
    }

    // Add priority context
    if (task.priority >= 8) {
      goalPrompt += `\n\nNOTE: This is a HIGH PRIORITY task (priority ${task.priority}/10).`;
    }

    this.logger.info("Goal extracted from task", {
      taskId: task.id,
      goalLength: goalPrompt.length,
      hasTitle: Boolean(title),
      hasDescription: Boolean(description),
      hasText: Boolean(text)
    });

    return goalPrompt;
  }

  /**
   * Extract tags from task metadata
   */
  private extractTagsFromTask(task: Task): string[] {
    const tags: string[] = ['scheduled-task'];
    
    // Add priority-based tags
    if (task.priority >= 8) {
      tags.push('high-priority');
    } else if (task.priority >= 6) {
      tags.push('medium-priority');
    } else {
      tags.push('low-priority');
    }
    
    // Add schedule type tag
    tags.push(`schedule-${task.scheduleType}`);
    
    // Add metadata tags if available
    if (task.metadata?.tags && Array.isArray(task.metadata.tags)) {
      tags.push(...task.metadata.tags);
    }

    return tags;
  }
} 