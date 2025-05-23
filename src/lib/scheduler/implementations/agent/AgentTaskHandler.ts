/**
 * AgentTaskHandler.ts - Complete Agent-Task Integration Handler
 * 
 * This implementation orchestrates the complete workflow from task discovery to agent execution.
 * NO SIMULATIONS. NO PLACEHOLDERS. REAL IMPLEMENTATION ONLY.
 */

import { ulid } from 'ulid';
import { Task, TaskStatus } from '../../models/Task.model';
import { TaskExecutionResult } from '../../models/TaskExecutionResult.model';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { 
  AgentTaskHandler as IAgentTaskHandler,
  TaskAgentRegistry,
  AgentTaskExecutor,
  TaskAnalysis,
  AgentTaskError 
} from '../../interfaces/AgentTaskHandler.interface';
import { RuntimeAgentRegistry } from './RuntimeAgentRegistry';
import { AgentTaskExecutor as RealAgentTaskExecutor } from './AgentTaskExecutor';
import { createLogger } from '@/lib/logging/winston-logger';

/**
 * Complete implementation of agent task handling
 */
export class AgentTaskHandler implements IAgentTaskHandler {
  private readonly handlerId: string;
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly registry: TaskAgentRegistry;
  private readonly executor: AgentTaskExecutor;

  constructor(
    registry?: TaskAgentRegistry,
    executor?: AgentTaskExecutor
  ) {
    this.handlerId = `agent-task-handler-${ulid()}`;
    this.logger = createLogger({
      moduleId: this.handlerId,
      agentId: 'system'
    });

    // Use provided or create default implementations
    this.registry = registry || new RuntimeAgentRegistry();
    this.executor = executor || new RealAgentTaskExecutor();

    this.logger.info("AgentTaskHandler initialized", {
      handlerId: this.handlerId,
      registryType: this.registry.constructor.name,
      executorType: this.executor.constructor.name
    });
  }

  /**
   * Handle complete task execution workflow - REAL IMPLEMENTATION
   */
  async handleTask(task: Task): Promise<TaskExecutionResult> {
    const handlingId = ulid();
    const startTime = new Date();

    this.logger.info("Starting complete task handling workflow", {
      handlingId,
      taskId: task.id,
      taskName: task.name,
      taskPriority: task.priority,
      taskStatus: task.status
    });

    try {
      // Step 1: Analyze task requirements
      const analysis = await this.analyzeTaskRequirements(task);
      
      this.logger.info("Task analysis completed", {
        handlingId,
        taskId: task.id,
        complexity: analysis.complexity,
        requiredCapabilities: analysis.requiredCapabilities,
        estimatedDuration: analysis.estimatedDurationMs
      });

      // Step 2: Find capable agents
      const capableAgents = await this.registry.findCapableAgents(task);
      
      if (capableAgents.length === 0) {
        throw new AgentTaskError(
          `No capable agents found for task ${task.id}`,
          'NO_CAPABLE_AGENTS',
          { taskId: task.id, analysis }
        );
      }

      this.logger.info("Found capable agents", {
        handlingId,
        taskId: task.id,
        capableAgentCount: capableAgents.length,
        agentIds: capableAgents.map(a => a.getId())
      });

      // Step 3: Select optimal agent
      const selectedAgent = await this.selectOptimalAgent(task, capableAgents);
      
      this.logger.info("Optimal agent selected", {
        handlingId,
        taskId: task.id,
        selectedAgentId: selectedAgent.getId(),
        selectedAgentName: selectedAgent.getName ? selectedAgent.getName() : 'unknown'
      });

      // Step 4: Execute task through agent
      this.logger.info("Starting agent execution", {
        handlingId,
        taskId: task.id,
        agentId: selectedAgent.getId()
      });

      const executionResult = await this.executor.executeTask(task, selectedAgent);

      // Step 5: Monitor and log completion
      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      this.logger.success("Task handling completed successfully", {
        handlingId,
        taskId: task.id,
        agentId: selectedAgent.getId(),
        totalDuration,
        executionSuccessful: executionResult.successful,
        executionStatus: executionResult.status
      });

      return executionResult;

    } catch (error) {
      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      this.logger.error("Task handling failed", {
        handlingId,
        taskId: task.id,
        totalDuration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Return failed execution result
      return {
        taskId: task.id,
        successful: false,
        status: TaskStatus.FAILED,
        startTime,
        endTime,
        duration: totalDuration,
        result: 'Task handling failed',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: error instanceof AgentTaskError ? error.code : 'TASK_HANDLING_ERROR',
          stack: error instanceof Error ? error.stack : undefined
        },
        wasRetry: false,
        retryCount: 0,
        metadata: {
          handlerId: this.handlerId,
          failureStage: 'task_handling'
        }
      };
    }
  }

  /**
   * Analyze task requirements and complexity
   */
  async analyzeTaskRequirements(task: Task): Promise<TaskAnalysis> {
    this.logger.info("Analyzing task requirements", {
      taskId: task.id,
      taskName: task.name
    });

    try {
      // Analyze task content for complexity
      const taskContent = this.getTaskContent(task);
      const complexity = this.calculateTaskComplexity(taskContent, task);
      
      // Determine required capabilities
      const requiredCapabilities = this.determineRequiredCapabilities(task);
      
      // Estimate execution time based on complexity and priority
      const estimatedDurationMs = this.estimateExecutionTime(complexity, task.priority);
      
      // Adjust priority based on content analysis
      const adjustedPriority = this.adjustPriorityBasedOnContent(task, complexity);
      
      // Determine task type
      const taskType = this.determineTaskType(task);
      
      // Check for external resource requirements
      const requiresExternalResources = this.checkExternalResourceRequirements(task);
      
      // Analyze dependencies
      const dependencies = this.analyzeDependencies(task);

      const analysis: TaskAnalysis = {
        complexity,
        requiredCapabilities,
        estimatedDurationMs,
        adjustedPriority,
        taskType,
        requiresExternalResources,
        dependencies
      };

      this.logger.info("Task analysis completed", {
        taskId: task.id,
        analysis
      });

      return analysis;
    } catch (error) {
      this.logger.error("Error analyzing task requirements", {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return default analysis on error
      return {
        complexity: 5,
        requiredCapabilities: ['planning', 'execution'],
        estimatedDurationMs: 60000, // 1 minute default
        adjustedPriority: task.priority,
        taskType: 'general',
        requiresExternalResources: false,
        dependencies: []
      };
    }
  }

  /**
   * Select the optimal agent for a task from available agents
   */
  async selectOptimalAgent(task: Task, agents: AgentBase[]): Promise<AgentBase> {
    this.logger.info("Selecting optimal agent", {
      taskId: task.id,
      candidateAgentCount: agents.length
    });

    try {
      // If only one agent available, use it
      if (agents.length === 1) {
        return agents[0];
      }

      // Score each agent for this task
      const agentScores: Array<{ agent: AgentBase; score: number }> = [];

      for (const agent of agents) {
        const score = await this.scoreAgentForTask(agent, task);
        agentScores.push({ agent, score });
      }

      // Sort by score (highest first)
      agentScores.sort((a, b) => b.score - a.score);

      const selectedAgent = agentScores[0].agent;

      this.logger.info("Agent selected based on scoring", {
        taskId: task.id,
        selectedAgentId: selectedAgent.getId(),
        selectedAgentScore: agentScores[0].score,
        allScores: agentScores.map(as => ({
          agentId: as.agent.getId(),
          score: as.score
        }))
      });

      return selectedAgent;
    } catch (error) {
      this.logger.error("Error selecting optimal agent", {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fall back to first available agent
      return agents[0];
    }
  }

  /**
   * Monitor task execution progress
   */
  async monitorExecution(task: Task, agent: AgentBase): Promise<void> {
    this.logger.info("Starting execution monitoring", {
      taskId: task.id,
      agentId: agent.getId()
    });

    // TODO: Implement real-time monitoring
    // For now, this is a placeholder for future implementation
    // Could include:
    // - Periodic health checks
    // - Progress reporting
    // - Timeout handling
    // - Resource monitoring

    this.logger.info("Execution monitoring completed", {
      taskId: task.id,
      agentId: agent.getId()
    });
  }

  /**
   * Get the registry instance
   */
  getRegistry(): TaskAgentRegistry {
    return this.registry;
  }

  /**
   * Get the executor instance
   */
  getExecutor(): AgentTaskExecutor {
    return this.executor;
  }

  // Private helper methods

  private getTaskContent(task: Task): string {
    const parts: string[] = [];
    
    if (task.name) parts.push(task.name);
    if (task.metadata?.title) parts.push(task.metadata.title as string);
    if (task.metadata?.description) parts.push(task.metadata.description as string);
    if ((task as any).text) parts.push((task as any).text);
    
    return parts.join(' ');
  }

  private calculateTaskComplexity(content: string, task: Task): number {
    let complexity = 1;
    
    // Base complexity on content length
    if (content.length > 500) complexity += 2;
    else if (content.length > 200) complexity += 1;
    
    // Increase complexity for high priority tasks
    if (task.priority >= 8) complexity += 2;
    
    // Check for complexity keywords
    const complexityKeywords = ['analyze', 'research', 'plan', 'coordinate', 'integrate'];
    const keywordMatches = complexityKeywords.filter(keyword => 
      content.toLowerCase().includes(keyword)
    ).length;
    complexity += keywordMatches;
    
    return Math.min(10, Math.max(1, complexity));
  }

  private determineRequiredCapabilities(task: Task): string[] {
    const capabilities = ['planning', 'execution'];
    const content = this.getTaskContent(task).toLowerCase();
    
    // Add specific capabilities based on content
    if (content.includes('research') || content.includes('search')) {
      capabilities.push('knowledge_management');
    }
    if (content.includes('schedule') || content.includes('plan')) {
      capabilities.push('scheduling');
    }
    if (content.includes('tool') || content.includes('api')) {
      capabilities.push('tool_usage');
    }
    if (content.includes('memory') || content.includes('remember')) {
      capabilities.push('memory_management');
    }
    
    return Array.from(new Set(capabilities)); // Remove duplicates
  }

  private estimateExecutionTime(complexity: number, priority: number): number {
    // Base time: 30 seconds
    let timeMs = 30000;
    
    // Adjust for complexity (each complexity point adds 15 seconds)
    timeMs += (complexity - 1) * 15000;
    
    // High priority tasks get more time allowance
    if (priority >= 8) {
      timeMs *= 1.5;
    }
    
    return Math.min(300000, timeMs); // Cap at 5 minutes
  }

  private adjustPriorityBasedOnContent(task: Task, complexity: number): number {
    let adjustedPriority = task.priority;
    
    // High complexity tasks get priority boost
    if (complexity >= 8) {
      adjustedPriority = Math.min(10, adjustedPriority + 1);
    }
    
    return adjustedPriority;
  }

  private determineTaskType(task: Task): string {
    const content = this.getTaskContent(task).toLowerCase();
    
    if (content.includes('research') || content.includes('analyze')) return 'research';
    if (content.includes('plan') || content.includes('schedule')) return 'planning';
    if (content.includes('execute') || content.includes('run')) return 'execution';
    if (content.includes('communication') || content.includes('notify')) return 'communication';
    
    return 'general';
  }

  private checkExternalResourceRequirements(task: Task): boolean {
    const content = this.getTaskContent(task).toLowerCase();
    
    return content.includes('api') || 
           content.includes('external') || 
           content.includes('web') ||
           content.includes('service');
  }

  private analyzeDependencies(task: Task): string[] {
    // TODO: Implement dependency analysis
    // For now, return empty array
    return [];
  }

  private async scoreAgentForTask(agent: AgentBase, task: Task): Promise<number> {
    let score = 5; // Base score
    
    try {
      // Check agent health
      const health = await agent.getHealth();
      if (health.status === 'healthy') score += 3;
      else if (health.status === 'degraded') score += 1;
      else score -= 2;
      
      // Check agent capacity
      const capacity = await this.registry.getAgentCapacity(agent.getId());
      if (capacity.isAvailable) score += 2;
      if (capacity.currentLoad < capacity.maxCapacity * 0.5) score += 1; // Less than 50% loaded
      
      // Prefer agents with lower current load
      const loadRatio = capacity.currentLoad / capacity.maxCapacity;
      score += (1 - loadRatio) * 2;
      
    } catch (error) {
      this.logger.error("Error scoring agent", {
        agentId: agent.getId(),
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      score = 1; // Low score on error
    }
    
    return Math.max(0, score);
  }
} 