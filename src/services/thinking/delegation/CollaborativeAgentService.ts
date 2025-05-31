import { IdGenerator } from '@/utils/ulid';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DelegatedTask, AgentStatus, DelegationResult, AgentCapability } from './DelegationManager';

/**
 * Sub-task assigned to an agent as part of a collaborative effort
 */
export interface CollaborativeSubTask {
  /**
   * Unique ID for the sub-task
   */
  id: string;
  
  /**
   * ID of the parent task
   */
  parentTaskId: string;
  
  /**
   * ID of the agent assigned to this sub-task
   */
  assignedAgentId: string;
  
  /**
   * Description of the sub-task
   */
  description: string;
  
  /**
   * Dependencies on other sub-tasks that must complete first
   */
  dependencies: string[];
  
  /**
   * Status of the sub-task
   */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  /**
   * Sub-task result
   */
  result?: any;
  
  /**
   * Error message if the sub-task failed
   */
  error?: string;
  
  /**
   * When the sub-task was created
   */
  createdAt: Date;
  
  /**
   * When the sub-task was started
   */
  startedAt?: Date;
  
  /**
   * When the sub-task was completed
   */
  completedAt?: Date;
}

/**
 * Collaborative task with multiple agents working together
 */
export interface CollaborativeTask {
  /**
   * Unique ID for the collaborative task
   */
  id: string;
  
  /**
   * Original delegation task that spawned this collaboration
   */
  originalTask: DelegatedTask;
  
  /**
   * Sub-tasks that make up this collaborative effort
   */
  subTasks: CollaborativeSubTask[];
  
  /**
   * Coordinator agent ID
   */
  coordinatorAgentId: string;
  
  /**
   * Status of the collaborative task
   */
  status: 'planning' | 'executing' | 'completed' | 'failed';
  
  /**
   * Progress (0-1)
   */
  progress: number;
  
  /**
   * Final result of the collaborative task
   */
  result?: any;
  
  /**
   * When the collaborative task was created
   */
  createdAt: Date;
  
  /**
   * When the collaborative task was completed
   */
  completedAt?: Date;
}

/**
 * Progress update for a collaborative task
 */
export interface CollaborativeTaskProgress {
  /**
   * Task ID
   */
  taskId: string;
  
  /**
   * Overall progress (0-1)
   */
  overallProgress: number;
  
  /**
   * Sub-task progress
   */
  subTaskProgress: Array<{
    id: string;
    description: string;
    status: string;
    progress: number;
    agentId: string;
    agentName: string;
  }>;
  
  /**
   * Current phase description
   */
  currentPhase: string;
  
  /**
   * Estimated time remaining in milliseconds
   */
  estimatedTimeRemaining?: number;
}

/**
 * Service for coordinating collaborative multi-agent problem solving
 */
export class CollaborativeAgentService {
  /**
   * Registry of collaborative tasks
   */
  private collaborativeTasks: Map<string, CollaborativeTask> = new Map();
  
  /**
   * Registry of sub-tasks
   */
  private subTasks: Map<string, CollaborativeSubTask> = new Map();
  
  /**
   * LLM for task decomposition and coordination
   */
  private llm: ChatOpenAI;
  
  /**
   * DelegationManager reference for agent allocation
   */
  private delegationManager: any;
  
  /**
   * Constructor
   */
  constructor(delegationManager: any) {
    this.delegationManager = delegationManager;
    this.llm = new ChatOpenAI({
      modelName: "gpt-4.1-2025-04-14",
      temperature: 0.2
    });
  }
  
  /**
   * Create a collaborative task from a complex task
   * @param task Complex task to decompose
   * @param availableAgents Agents available for collaboration
   * @returns Collaborative task structure with sub-tasks
   */
  async createCollaborativeTask(
    task: DelegatedTask,
    availableAgents: AgentStatus[]
  ): Promise<CollaborativeTask> {
    try {
      console.log(`Creating collaborative task for task: ${task.id}`);
      
      // Create collaborative task ID
      const collaborativeTaskId = IdGenerator.generate("collab-task").toString();
      
      // Create initial task structure
      const collaborativeTask: CollaborativeTask = {
        id: collaborativeTaskId,
        originalTask: task,
        subTasks: [],
        coordinatorAgentId: this.selectCoordinatorAgent(availableAgents),
        status: 'planning',
        progress: 0,
        createdAt: new Date()
      };
      
      // Decompose the task into sub-tasks using LLM
      const subTasks = await this.decomposeTask(task, availableAgents);
      
      // Add sub-tasks to collaborative task
      collaborativeTask.subTasks = subTasks;
      
      // Store in registry
      this.collaborativeTasks.set(collaborativeTaskId, collaborativeTask);
      
      // Store sub-tasks in registry
      for (const subTask of subTasks) {
        this.subTasks.set(subTask.id, subTask);
      }
      
      return collaborativeTask;
    } catch (error) {
      console.error('Error creating collaborative task:', error);
      throw error;
    }
  }
  
  /**
   * Select the best agent to coordinate the collaborative task
   * @param availableAgents Available agents for coordination
   * @returns Agent ID for coordinator
   */
  private selectCoordinatorAgent(availableAgents: AgentStatus[]): string {
    // Select agent with coordination capability if available
    const coordinationAgents = availableAgents.filter(
      agent => agent.capabilities.some(cap => cap.name === 'coordination')
    );
    
    if (coordinationAgents.length > 0) {
      // Select agent with highest success rate
      const bestAgent = coordinationAgents.reduce((best, current) => 
        current.performance.successRate > best.performance.successRate ? current : best
      );
      return bestAgent.id;
    }
    
    // If no coordination specialist, select agent with highest overall performance
    const bestAgent = availableAgents.reduce((best, current) => 
      current.performance.successRate > best.performance.successRate ? current : best
    );
    return bestAgent.id;
  }
  
  /**
   * Decompose a complex task into sub-tasks using LLM
   * @param task Task to decompose
   * @param availableAgents Available agents for assignment
   * @returns List of sub-tasks
   */
  private async decomposeTask(
    task: DelegatedTask,
    availableAgents: AgentStatus[]
  ): Promise<CollaborativeSubTask[]> {
    try {
      // Build decomposition prompt
      const systemPrompt = `You are an AI assistant that decomposes complex tasks into smaller sub-tasks.
Your task is to analyze the given task and break it down into logical sub-tasks that can be executed by different agents.

Available agent capabilities:
${availableAgents.map(agent => `
${agent.name}:
- Capabilities: ${agent.capabilities.map(c => c.name).join(', ')}
- Performance: ${Math.round(agent.performance.successRate * 100)}% success rate
`).join('\n')}

Respond in JSON format with an array of sub-tasks:
{
  "subTasks": [
  {
      "id": "subtask-1",
      "description": "Detailed description of the sub-task",
      "dependencies": ["subtask-id-1", "subtask-id-2"],
      "requiredCapabilities": ["capability1", "capability2"]
    }
  ]
}`;

      const humanMessage = `Task: ${task.intent.description}
Required capabilities: ${task.requiredCapabilities.join(', ')}
Context information: ${JSON.stringify(task.metadata || {})}

Please decompose this task into sub-tasks that can be executed by the available agents.`;

      // Call LLM for decomposition
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(humanMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse response
      const responseContent = response.content.toString();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Invalid LLM response format');
      }
      
      const data = JSON.parse(jsonMatch[0]);
      
      if (!data.subTasks || !Array.isArray(data.subTasks)) {
        throw new Error('Invalid sub-tasks data structure');
      }
      
      // Convert to CollaborativeSubTask format
      return data.subTasks.map((subTask: any, index: number) => ({
        id: `${task.id}_sub${index + 1}`,
        description: subTask.description,
        status: 'pending',
        dependencies: subTask.dependencies || []
      }));
      
    } catch (error) {
      console.error('Error decomposing task:', error);
      throw error;
    }
  }
  
  /**
   * Start execution of a collaborative task
   * @param taskId Collaborative task ID
   * @returns Whether execution was started successfully
   */
  async startExecution(taskId: string): Promise<boolean> {
    try {
      const task = this.collaborativeTasks.get(taskId);
      
      if (!task) {
        throw new Error(`Collaborative task ${taskId} not found`);
      }
      
      // Change status to executing
      task.status = 'executing';
      
      // Start initial sub-tasks (those with no dependencies)
      const initialSubTasks = task.subTasks.filter(subTask => 
        subTask.dependencies.length === 0
      );
      
      for (const subTask of initialSubTasks) {
        await this.startSubTask(subTask.id);
      }
      
      return true;
    } catch (error) {
      console.error(`Error starting execution of collaborative task ${taskId}:`, error);
      return false;
    }
  }
  
  /**
   * Start execution of a sub-task
   * @param subTaskId Sub-task ID
   * @returns Whether sub-task was started successfully
   */
  private async startSubTask(subTaskId: string): Promise<boolean> {
    try {
      const subTask = this.subTasks.get(subTaskId);
      
      if (!subTask) {
        throw new Error(`Sub-task ${subTaskId} not found`);
      }
      
      // Update sub-task status
      subTask.status = 'in_progress';
      subTask.startedAt = new Date();
      
      // Get assigned agent
      const agent = this.delegationManager.getAgent(subTask.assignedAgentId);
      
      if (!agent) {
        throw new Error(`Agent ${subTask.assignedAgentId} not found`);
      }
      
      // Delegate sub-task to agent asynchronously
      // This would be replaced with actual agent task execution
      this.executeSubTask(subTask, agent).catch(error => {
        console.error(`Error executing sub-task ${subTaskId}:`, error);
        
        // Update sub-task status on failure
        if (this.subTasks.has(subTaskId)) {
          const failedSubTask = this.subTasks.get(subTaskId)!;
          failedSubTask.status = 'failed';
          failedSubTask.error = error.message;
          this.subTasks.set(subTaskId, failedSubTask);
          
          // Update collaborative task status
          this.updateCollaborativeTaskProgress(failedSubTask.parentTaskId);
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Error starting sub-task ${subTaskId}:`, error);
      return false;
    }
  }
  
  /**
   * Execute a sub-task on an agent
   * @param subTask Sub-task to execute
   * @param agent Agent to execute the sub-task
   */
  private async executeSubTask(subTask: CollaborativeSubTask, agent: AgentStatus): Promise<void> {
    try {
      // This would be replaced with actual agent execution
      const estimatedTime = agent.performance.averageResponseTime * (0.5 + Math.random());
      await new Promise(resolve => setTimeout(resolve, estimatedTime));
      
      // Update sub-task status
      subTask.status = Math.random() > 0.1 ? 'completed' : 'failed';
      subTask.result = {
        output: `Simulated output for ${subTask.description}`,
        executionTime: estimatedTime
      };
      
      // Update progress
      this.updateCollaborativeTaskProgress(subTask.parentTaskId);
      
      // Check if new sub-tasks can be started
      await this.checkDependencies(subTask.parentTaskId);
    } catch (error) {
      console.error(`Error executing sub-task ${subTask.id}:`, error);
      subTask.status = 'failed';
      throw error;
    }
  }
  
  /**
   * Check if any sub-tasks have their dependencies met and can be started
   * @param collaborativeTaskId Collaborative task ID
   */
  private async checkDependencies(collaborativeTaskId: string): Promise<void> {
    try {
      const task = this.collaborativeTasks.get(collaborativeTaskId);
      
      if (!task) {
        throw new Error(`Collaborative task ${collaborativeTaskId} not found`);
      }
      
      // Find all completed sub-task IDs
      const completedSubTaskIds = new Set(
        task.subTasks
          .filter(subTask => subTask.status === 'completed')
          .map(subTask => subTask.id)
      );
      
      // Find pending sub-tasks whose dependencies are all completed
      const readySubTasks = task.subTasks.filter(subTask => 
        subTask.status === 'pending' && 
        subTask.dependencies.every(depId => completedSubTaskIds.has(depId))
      );
      
      // Start ready sub-tasks
      for (const subTask of readySubTasks) {
        await this.startSubTask(subTask.id);
      }
      
      // Check if all sub-tasks are completed
      const allCompleted = task.subTasks.every(
        subTask => subTask.status === 'completed' || subTask.status === 'failed'
      );
      
      if (allCompleted) {
        // If all tasks completed successfully, mark task as completed
        const allSuccessful = task.subTasks.every(
          subTask => subTask.status === 'completed'
        );
        
        task.status = allSuccessful ? 'completed' : 'failed';
        task.completedAt = new Date();
        
        // Aggregate results from all sub-tasks
        task.result = {
          overallStatus: task.status,
          subTaskResults: task.subTasks.map(subTask => ({
            id: subTask.id,
            description: subTask.description,
            status: subTask.status,
            result: subTask.result
          }))
        };
        
        // Update task in registry
        this.collaborativeTasks.set(collaborativeTaskId, task);
      }
    } catch (error) {
      console.error(`Error checking dependencies for task ${collaborativeTaskId}:`, error);
    }
  }
  
  /**
   * Update progress of a collaborative task
   * @param collaborativeTaskId Collaborative task ID
   */
  private updateCollaborativeTaskProgress(collaborativeTaskId: string): void {
    try {
      const task = this.collaborativeTasks.get(collaborativeTaskId);
      
      if (!task) {
        throw new Error(`Collaborative task ${collaborativeTaskId} not found`);
      }
      
      // Calculate progress based on sub-task status
      const totalSubTasks = task.subTasks.length;
      
      if (totalSubTasks === 0) {
        task.progress = 0;
        return;
      }
      
      // Count completed and in-progress sub-tasks
      const completedCount = task.subTasks.filter(
        subTask => subTask.status === 'completed'
      ).length;
      
      const inProgressCount = task.subTasks.filter(
        subTask => subTask.status === 'in_progress'
      ).length;
      
      // In-progress tasks count as 50% complete
      task.progress = (completedCount + (inProgressCount * 0.5)) / totalSubTasks;
      
      // Update task in registry
      this.collaborativeTasks.set(collaborativeTaskId, task);
    } catch (error) {
      console.error(`Error updating progress for task ${collaborativeTaskId}:`, error);
    }
  }
  
  /**
   * Get progress information for a collaborative task
   * @param taskId Collaborative task ID
   * @returns Progress information
   */
  async getTaskProgress(taskId: string): Promise<CollaborativeTaskProgress | null> {
    try {
      const task = this.collaborativeTasks.get(taskId);
      
      if (!task) {
        return null;
      }
      
      // Get agent information for sub-tasks
      const subTaskProgress = await Promise.all(
        task.subTasks.map(async subTask => {
          const agent = this.delegationManager.getAgent(subTask.assignedAgentId);
          
          return {
            id: subTask.id,
            description: subTask.description,
            status: subTask.status,
            progress: subTask.status === 'completed' ? 1 : 
                      subTask.status === 'in_progress' ? 0.5 : 0,
            agentId: subTask.assignedAgentId,
            agentName: agent?.name || 'Unknown Agent'
          };
        })
      );
      
      // Calculate current phase based on sub-task status
      let currentPhase = 'Planning';
      
      if (task.status === 'executing') {
        const inProgressTasks = task.subTasks.filter(t => t.status === 'in_progress');
        if (inProgressTasks.length > 0) {
          currentPhase = `Executing: ${inProgressTasks.map(t => t.description).join(', ')}`;
        }
      } else if (task.status === 'completed') {
        currentPhase = 'Completed';
      } else if (task.status === 'failed') {
        currentPhase = 'Failed';
      }
      
      // Estimate time remaining based on progress and elapsed time
      let estimatedTimeRemaining: number | undefined;
      
      if (task.progress > 0 && task.progress < 1) {
        const elapsedTime = new Date().getTime() - task.createdAt.getTime();
        estimatedTimeRemaining = (elapsedTime / task.progress) * (1 - task.progress);
      }
      
      return {
        taskId,
        overallProgress: task.progress,
        subTaskProgress,
        currentPhase,
        estimatedTimeRemaining
      };
    } catch (error) {
      console.error(`Error getting progress for task ${taskId}:`, error);
      return null;
    }
  }
} 