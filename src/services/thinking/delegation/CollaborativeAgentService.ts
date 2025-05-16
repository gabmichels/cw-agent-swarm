import { IdGenerator } from '@/utils/ulid';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DelegationTask, AgentInfo, DelegationResult } from './DelegationManager';

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
  originalTask: DelegationTask;
  
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
      modelName: "gpt-3.5-turbo",
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
    task: DelegationTask,
    availableAgents: AgentInfo[]
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
  private selectCoordinatorAgent(availableAgents: AgentInfo[]): string {
    // Select agent with coordination capability if available
    const coordinationAgents = availableAgents.filter(
      agent => agent.capabilities.includes('coordination')
    );
    
    if (coordinationAgents.length > 0) {
      // Select the coordination agent with the lowest load
      coordinationAgents.sort((a, b) => a.currentLoad - b.currentLoad);
      return coordinationAgents[0].id;
    }
    
    // Otherwise select the agent with the lowest load
    availableAgents.sort((a, b) => a.currentLoad - b.currentLoad);
    return availableAgents[0].id;
  }
  
  /**
   * Decompose a complex task into sub-tasks using LLM
   * @param task Task to decompose
   * @param availableAgents Available agents for assignment
   * @returns List of sub-tasks
   */
  private async decomposeTask(
    task: DelegationTask,
    availableAgents: AgentInfo[]
  ): Promise<CollaborativeSubTask[]> {
    try {
      // Generate prompt for task decomposition
      const systemPrompt = `You are an AI task coordinator that decomposes complex tasks into smaller sub-tasks.
      
For the given task, break it down into 3-7 logical sub-tasks that can be executed by different specialized agents.
Consider dependencies between sub-tasks and assign them to the most appropriate agents based on their capabilities.

Available agents and their capabilities:
${availableAgents.map(agent => `- ${agent.name} (ID: ${agent.id}): ${agent.capabilities.join(', ')}`).join('\n')}

Respond with a JSON array of sub-tasks in the following format:
[
  {
    "description": "Sub-task description",
    "requiredCapabilities": ["capability1", "capability2"],
    "assignedAgentId": "agent-id",
    "dependencies": [] // IDs of sub-tasks that must complete before this one starts
  }
]`;

      const humanMessage = `Task: ${task.query}
      
Required capabilities: ${task.requiredCapabilities.join(', ')}
Context information: ${JSON.stringify(task.context || {})}
Complexity: ${task.complexity}
Priority: ${task.priority}

Please decompose this task into appropriate sub-tasks.`;

      // Call LLM for decomposition
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(humanMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse the response
      const responseText = response.content.toString();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        throw new Error('Failed to parse task decomposition response');
      }
      
      const decomposedTasks = JSON.parse(jsonMatch[0]);
      
      // Create sub-tasks from decomposition
      const subTasks: CollaborativeSubTask[] = decomposedTasks.map((task: any, index: number) => {
        const subTaskId = IdGenerator.generate("subtask").toString();
        
        return {
          id: subTaskId,
          parentTaskId: task.id,
          assignedAgentId: task.assignedAgentId,
          description: task.description,
          dependencies: task.dependencies || [],
          status: 'pending',
          createdAt: new Date()
        };
      });
      
      // Resolve dependencies by replacing indices/descriptions with actual IDs
      for (const subtask of subTasks) {
        // If dependencies are indices or descriptions, resolve to IDs
        subtask.dependencies = subtask.dependencies.map((dep: any) => {
          if (typeof dep === 'number' && dep >= 0 && dep < subTasks.length) {
            // Index-based dependency
            return subTasks[dep].id;
          } else if (typeof dep === 'string' && !dep.startsWith('subtask')) {
            // Description-based dependency - find by matching description
            const matchingTask = subTasks.find(t => t.description.includes(dep));
            return matchingTask ? matchingTask.id : '';
          }
          return dep;
        }).filter(Boolean); // Remove any empty dependencies
      }
      
      return subTasks;
    } catch (error) {
      console.error('Error decomposing task:', error);
      return [];
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
  private async executeSubTask(subTask: CollaborativeSubTask, agent: AgentInfo): Promise<void> {
    try {
      // This would be replaced with actual agent execution
      // For now, simulate execution with a delay based on agent response time
      
      // Get collaborative task for context
      const collaborativeTask = this.collaborativeTasks.get(subTask.parentTaskId);
      
      if (!collaborativeTask) {
        throw new Error(`Collaborative task ${subTask.parentTaskId} not found`);
      }
      
      // Simulate execution time (replace with actual agent execution)
      const executionTime = agent.avgResponseTime * (0.5 + Math.random());
      
      await new Promise(resolve => setTimeout(resolve, executionTime));
      
      // Simulated result (in a real implementation, this would be the agent's response)
      const result = {
        content: `Completed sub-task: ${subTask.description}`,
        metadata: {
          executionTime,
          agentId: agent.id,
          agentName: agent.name
        }
      };
      
      // Update sub-task
      subTask.status = 'completed';
      subTask.result = result;
      subTask.completedAt = new Date();
      
      // Update progress
      this.updateCollaborativeTaskProgress(subTask.parentTaskId);
      
      // Check if new sub-tasks can be started
      await this.checkDependencies(subTask.parentTaskId);
    } catch (error) {
      console.error(`Error executing sub-task ${subTask.id}:`, error);
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