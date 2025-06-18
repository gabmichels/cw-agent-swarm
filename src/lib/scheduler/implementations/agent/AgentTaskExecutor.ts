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
import { PlanAndExecuteOptions } from '../../../../lib/shared/types/agentTypes';
import { PlanningState } from '../../../../app/debug/graph/types';
import { PlanExecutionResult } from '../../../../agents/shared/base/managers/PlanningManager.interface';
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

      // Check if agent has planAndExecute method
      if ((agent as any).planAndExecute && typeof (agent as any).planAndExecute === 'function') {
        this.logger.info("Using agent.planAndExecute() method", {
          executionId,
          taskId: task.id,
          agentId: agent.getId()
        });

        // Determine agent type and call the appropriate planAndExecute method
        let agentResult: PlanningState | PlanExecutionResult;
        
        // For DefaultAgent: planAndExecute(goal: string, options?: Record<string, unknown>)
        // For Chloe agents: planAndExecute(options: PlanAndExecuteOptions)
        try {
          // Try DefaultAgent format first (most common)
          const goalPrompt = this.extractGoalFromTask(task);
          const executeOptions = {
            priority: task.priority,
            autonomyMode: task.priority >= 8,
            requireApproval: task.priority < 7,
            metadata: task.metadata || {}
          };
          
          this.logger.info("Calling DefaultAgent.planAndExecute()", {
            executionId,
            taskId: task.id,
            agentId: agent.getId(),
            goalPrompt,
            options: executeOptions
          });

          agentResult = await (agent as any).planAndExecute(goalPrompt, executeOptions);
          
          this.logger.info("DefaultAgent planAndExecute completed", {
            executionId,
            taskId: task.id,
            agentId: agent.getId(),
            resultType: typeof agentResult,
            success: (agentResult as PlanExecutionResult).success,
            hasError: Boolean((agentResult as PlanExecutionResult).error)
          });

        } catch (defaultAgentError) {
          this.logger.warn("DefaultAgent format failed, trying Chloe agent format", {
            executionId,
            taskId: task.id,
            agentId: agent.getId(),
            error: defaultAgentError instanceof Error ? defaultAgentError.message : String(defaultAgentError)
          });

          // Try Chloe agent format as fallback
          const planAndExecuteOptions = this.createPlanAndExecuteOptions(task);
          agentResult = await (agent as any).planAndExecute(planAndExecuteOptions);
          
          this.logger.info("Chloe agent planAndExecute completed", {
            executionId,
            taskId: task.id,
            agentId: agent.getId(),
            resultKeys: Object.keys(agentResult || {}),
            finalResult: (agentResult as PlanningState)?.finalResult
          });
        }

        // Map agent result to task execution result
        const taskResult = this.mapAgentResult(agentResult, task);

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
   * Create plan-and-execute options from a task (for Chloe agents)
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
   * Map agent execution result to task execution result (unified for both agent types)
   */
  mapAgentResult(agentResult: PlanningState | PlanExecutionResult, task: Task): TaskExecutionResult {
    this.logger.info("Mapping agent result to task result", {
      taskId: task.id,
      resultType: typeof agentResult,
      hasSuccess: 'success' in agentResult ? agentResult.success : undefined,
      hasError: 'error' in agentResult ? Boolean(agentResult.error) : undefined
    });

    try {
      // Handle DefaultAgent PlanExecutionResult
      if ('success' in agentResult && typeof agentResult.success === 'boolean') {
        const planResult = agentResult as PlanExecutionResult;
        
        this.logger.info("Processing DefaultAgent PlanExecutionResult", {
          taskId: task.id,
          success: planResult.success,
          hasError: Boolean(planResult.error),
          hasPlan: Boolean(planResult.plan)
        });

        const successful = planResult.success && !planResult.error;
        const status = successful ? TaskStatus.COMPLETED : TaskStatus.FAILED;
        
        // Extract actual results from plan steps instead of generic message
        let result = 'Task execution completed';
        let toolResults: any[] = [];
        let toolSuccessInfo: Record<string, boolean> = {};
        
        if (planResult.plan && planResult.plan.steps) {
          const stepResults: string[] = [];
          
          planResult.plan.steps.forEach((step: any) => {
            if (step.actions) {
              step.actions.forEach((action: any) => {
                if (action.type === 'tool_execution' && action.result) {
                  const toolName = action.parameters?.toolName || 'unknown_tool';
                  const toolSuccess = action.result.success || false;
                  
                  // Track tool success for satisfaction scoring
                  toolSuccessInfo[toolName] = toolSuccess;
                  
                  if (toolSuccess && action.result.data) {
                    // Extract meaningful data from successful tool executions
                    let toolData = action.result.data;
                    if (typeof toolData === 'string') {
                      stepResults.push(`${toolName}: ${toolData.substring(0, 500)}${toolData.length > 500 ? '...' : ''}`);
                    } else {
                      stepResults.push(`${toolName}: ${JSON.stringify(toolData).substring(0, 500)}...`);
                    }
                    toolResults.push({
                      tool: toolName,
                      success: true,
                      data: toolData
                    });
                  } else {
                    // Handle failed tool executions
                    const errorMsg = action.result.error || 'Tool execution failed';
                    stepResults.push(`${toolName}: FAILED - ${errorMsg}`);
                    toolResults.push({
                      tool: toolName,
                      success: false,
                      error: errorMsg
                    });
                  }
                } else if (action.type === 'analysis' || action.type === 'llm_query') {
                  // Extract LLM results
                  if (action.result && action.result.success && action.result.data) {
                    let llmData = action.result.data;
                    if (typeof llmData === 'string') {
                      stepResults.push(`LLM Analysis: ${llmData.substring(0, 300)}${llmData.length > 300 ? '...' : ''}`);
                    }
                  }
                }
              });
            }
          });
          
          if (stepResults.length > 0) {
            result = stepResults.join('\n\n');
          } else {
            result = `Plan execution completed. Plan ID: ${planResult.plan.id}`;
          }
        }
        
        const error = planResult.error ? {
          message: planResult.error,
          code: 'PLAN_EXECUTION_ERROR'
        } : undefined;

        return {
          taskId: task.id,
          successful,
          status,
          result,
          error,
          wasRetry: false,
          retryCount: 0,
          startTime: new Date(),
          endTime: new Date(),
          duration: 0, // Will be overridden by caller
          metadata: {
            planResult: planResult,
            toolResults: toolResults,
            toolSuccessInfo: toolSuccessInfo,
            executedBy: 'AgentTaskExecutor',
            executionMethod: 'planAndExecute',
            agentType: 'DefaultAgent'
          }
        };
      }
      
      // Handle Chloe agent PlanningState (fallback)
      else {
        const planningState = agentResult as PlanningState;
        
        this.logger.info("Processing Chloe agent PlanningState", {
          taskId: task.id,
          taskStatus: planningState?.task?.status,
          finalResult: planningState?.finalResult
        });

        return this.mapExecutionResult(planningState, task);
      }

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
   * Map Chloe agent execution result to task execution result (legacy method)
   */
  mapExecutionResult(agentResult: PlanningState, task: Task): TaskExecutionResult {
    this.logger.info("Mapping Chloe agent result to task result", {
      taskId: task.id,
      agentResultStatus: agentResult?.task?.status,
      finalResult: agentResult?.finalResult
    });

    try {
      // Determine if execution was successful
      const successful = agentResult?.task?.status === 'completed' || Boolean(agentResult?.finalResult);
      
      // Map agent status to task status
      let status: TaskStatus;
      if (agentResult?.task?.status === 'completed') {
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
          executionMethod: 'planAndExecute',
          agentType: 'Chloe'
        }
      };

      this.logger.info("Chloe agent result mapped successfully", {
        taskId: task.id,
        successful,
        status,
        hasResult: Boolean(result),
        hasError: Boolean(error)
      });

      return taskResult;
    } catch (error) {
      this.logger.error("Error mapping Chloe agent result", {
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
    // Use description as the main goal
    let goal = task.description || task.name || 'Complete the assigned task';
    
    // Add any additional context from metadata
    if (task.metadata?.context) {
      goal += `\n\nContext: ${task.metadata.context}`;
    }
    
    if (task.metadata?.requirements) {
      goal += `\n\nRequirements: ${task.metadata.requirements}`;
    }
    
    return goal;
  }

  /**
   * Extract tags from task metadata
   */
  private extractTagsFromTask(task: Task): string[] {
    const tags: string[] = [];
    
    // Add task name as tag
    if (task.name) {
      tags.push(task.name.toLowerCase().replace(/\s+/g, '_'));
    }
    
    // Add metadata tags if they exist
    if (task.metadata?.tags && Array.isArray(task.metadata.tags)) {
      tags.push(...task.metadata.tags);
    }
    
    // Add priority-based tag
    if (task.priority >= 9) {
      tags.push('urgent');
    } else if (task.priority >= 7) {
      tags.push('high_priority');
    } else if (task.priority <= 3) {
      tags.push('low_priority');
    }
    
    return tags;
  }
} 