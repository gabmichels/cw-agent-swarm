import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { IdGenerator } from '@/utils/ulid';
import { ClassifiedIntent } from '../intent/IntentClassifier';
import { ExtractedEntity } from '../memory/EntityExtractor';

/**
 * Agent capability definition
 */
export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  skills: string[];
  performance: {
    successRate: number;
    averageResponseTime: number;
    lastNTasks: number;
  };
  constraints: {
    maxConcurrentTasks: number;
    maxTaskComplexity: number;
    specializations: string[];
  };
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Task status
 */
export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Task definition
 */
export interface DelegatedTask {
  id: string;
  intent: ClassifiedIntent;
  entities: ExtractedEntity[];
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgent?: string;
  requiredCapabilities: string[];
  complexity: number;
  deadline?: Date;
  metadata: {
    createdAt: string;
    updatedAt: string;
    estimatedDuration: number;
    actualDuration?: number;
    attempts: number;
    parentTaskId?: string;
  };
}

/**
 * Agent status and metrics
 */
export interface AgentStatus {
  id: string;
  name: string;
  capabilities: AgentCapability[];
  currentLoad: number;
  activeTasks: string[];
  performance: {
    successRate: number;
    averageResponseTime: number;
    taskHistory: Array<{
      taskId: string;
      success: boolean;
      duration: number;
    }>;
  };
  health: {
    isAvailable: boolean;
    lastHeartbeat: string;
    errorRate: number;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    lastAssignedTask?: string;
    totalTasksHandled: number;
  };
}

/**
 * Delegation result
 */
export interface DelegationResult {
  /**
   * Whether the delegation was successful
   */
  success: boolean;

  /**
   * ID of the task that was delegated
   */
  taskId: string;

  /**
   * ID of the agent the task was assigned to
   */
  agentId: string;

  /**
   * Confidence score for the delegation decision (0-1)
   */
  confidence: number;

  /**
   * Reason for the delegation decision
   */
  reason: string;

  /**
   * Estimated time when the task will start
   */
  estimatedStartTime?: Date;

  /**
   * Estimated duration in milliseconds
   */
  estimatedDuration?: number;

  /**
   * Current status of the delegated task
   */
  status: TaskStatus;

  /**
   * Result data if task is completed
   */
  result?: any;

  /**
   * Error message if task failed
   */
  error?: string;

  /**
   * When the task started executing
   */
  startTime?: Date;

  /**
   * When the task completed
   */
  completionTime?: Date;

  /**
   * ID for tracking related delegations
   */
  delegationContextId?: string;

  /**
   * ID of the parent task if this is a subtask
   */
  parentTaskId?: string;

  /**
   * ID of the original agent that initiated the delegation chain
   */
  originAgentId?: string;
}

/**
 * Feedback for a delegated task
 */
export interface DelegationFeedback {
  /**
   * ID of the task that was delegated
   */
  taskId: string;

  /**
   * ID of the agent that handled the task
   */
  agentId: string;

  /**
   * Whether the task was successful
   */
  wasSuccessful: boolean;

  /**
   * Time taken to execute the task in milliseconds
   */
  executionTime: number;

  /**
   * User satisfaction score (0-1)
   */
  userSatisfaction?: number;

  /**
   * Additional details about the feedback
   */
  details?: string;
}

/**
 * Service for managing task delegation to specialized agents
 */
export class DelegationManager {
  private llm: ChatOpenAI;
  private agents: Map<string, AgentStatus>;
  private tasks: Map<string, DelegatedTask>;
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: "gpt-4.1-2025-04-14",
      temperature: 0.2
    });
    this.agents = new Map();
    this.tasks = new Map();
  }
  
  /**
   * Register a new agent with its capabilities
   */
  registerAgent(agent: AgentStatus): void {
    this.agents.set(agent.id, agent);
  }
  
  /**
   * Update agent status and metrics
   */
  updateAgentStatus(
    agentId: string,
    update: Partial<AgentStatus>
  ): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      Object.assign(agent, update);
      agent.metadata = {
        ...agent.metadata,
        updatedAt: new Date().toISOString()
      };
    }
  }
  
  /**
   * Evaluate if a task should be delegated
   */
  async shouldDelegate(
    intent: ClassifiedIntent,
    entities: ExtractedEntity[]
  ): Promise<{
    shouldDelegate: boolean;
    confidence: number;
    requiredCapabilities: string[];
    reason: string;
  }> {
    try {
      // Build evaluation prompt
      const systemPrompt = `You are an AI assistant that evaluates whether tasks should be delegated to specialized agents.
Your task is to analyze the user's intent and entities to determine:
1. If the task requires specialized capabilities
2. What specific capabilities are needed
3. How confident you are in the delegation decision

Available agent capabilities:
${Array.from(this.agents.values()).map(agent => `
${agent.name}:
- Capabilities: ${agent.capabilities.map(c => c.name).join(', ')}
- Specializations: ${agent.capabilities.flatMap(c => c.constraints.specializations).join(', ')}
`).join('\n')}

Respond in JSON format:
{
  "shouldDelegate": true/false,
  "confidence": 0.9,
  "requiredCapabilities": ["capability1", "capability2"],
  "reason": "Detailed explanation of the decision"
}`;

      // Call LLM for evaluation
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Evaluate delegation for:
Intent: ${intent.name} (${intent.description})
Entities: ${entities.map(e => `${e.type}:${e.value}`).join(', ')}`)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse response
      const responseContent = response.content.toString();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Invalid evaluation response format');
      }
      
      return JSON.parse(jsonMatch[0]);
      
    } catch (error) {
      console.error('Error evaluating delegation:', error);
      return {
        shouldDelegate: false,
        confidence: 0,
        requiredCapabilities: [],
        reason: 'Error during evaluation'
      };
    }
  }
  
  /**
   * Find the best agent for a task
   */
  async findBestAgent(
    task: DelegatedTask
  ): Promise<{
    agentId?: string;
    confidence: number;
    reason: string;
  }> {
    try {
      // Filter agents by required capabilities
      const eligibleAgents = Array.from(this.agents.values()).filter(agent => {
        // Check if agent has all required capabilities
        const hasCapabilities = task.requiredCapabilities.every(required =>
          agent.capabilities.some(cap => 
            cap.skills.includes(required) || 
            cap.constraints.specializations.includes(required)
          )
        );
        
        // Check if agent has capacity
        const hasCapacity = agent.currentLoad < 
          agent.capabilities.reduce((max, cap) => 
            Math.max(max, cap.constraints.maxConcurrentTasks), 0);
            
        // Check if agent can handle task complexity
        const canHandleComplexity = agent.capabilities.some(cap =>
          cap.constraints.maxTaskComplexity >= task.complexity
        );
        
        return hasCapabilities && hasCapacity && canHandleComplexity;
      });
      
      if (eligibleAgents.length === 0) {
        return {
          confidence: 0,
          reason: 'No eligible agents found'
        };
      }
      
      // Build agent selection prompt
      const systemPrompt = `You are an AI assistant that selects the best agent for a task.
Your task is to analyze the eligible agents and select the most suitable one based on:
1. Capability match
2. Current load
3. Performance history
4. Task requirements

Task details:
${JSON.stringify(task, null, 2)}

Eligible agents:
${eligibleAgents.map(agent => JSON.stringify(agent, null, 2)).join('\n\n')}

Respond in JSON format:
{
  "selectedAgentId": "agent_id",
  "confidence": 0.9,
  "reason": "Detailed explanation of the selection"
}`;

      // Call LLM for selection
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage('Select the best agent for this task.')
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse response
      const responseContent = response.content.toString();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Invalid selection response format');
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      return {
        agentId: result.selectedAgentId,
        confidence: result.confidence,
        reason: result.reason
      };
      
    } catch (error) {
      console.error('Error finding best agent:', error);
      return {
        confidence: 0,
        reason: 'Error during agent selection'
      };
    }
  }
  
  /**
   * Delegate a task to an agent
   */
  async delegateTask(
    intent: ClassifiedIntent,
    entities: ExtractedEntity[],
    priority: TaskPriority = TaskPriority.MEDIUM
  ): Promise<DelegationResult> {
    try {
      // Check if task should be delegated
      const delegationCheck = await this.shouldDelegate(intent, entities);
      
      if (!delegationCheck.shouldDelegate) {
        return {
          success: false,
          taskId: '',
          agentId: '',
          confidence: delegationCheck.confidence,
          reason: delegationCheck.reason,
          status: TaskStatus.FAILED,
          estimatedStartTime: undefined,
          estimatedDuration: undefined,
          delegationContextId: undefined,
          parentTaskId: undefined,
          originAgentId: undefined
        };
      }
      
      // Create task
      const task: DelegatedTask = {
        id: String(IdGenerator.generate('task')),
        intent,
        entities,
        priority,
        status: TaskStatus.PENDING,
        requiredCapabilities: delegationCheck.requiredCapabilities,
        complexity: this.calculateTaskComplexity(intent, entities),
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          estimatedDuration: this.estimateTaskDuration(intent, entities),
          attempts: 0
        }
      };
      
      // Find best agent
      const agentSelection = await this.findBestAgent(task);
      
      if (!agentSelection.agentId) {
        return {
          success: false,
          taskId: '',
          agentId: '',
          confidence: agentSelection.confidence,
          reason: agentSelection.reason,
          status: TaskStatus.FAILED,
          estimatedStartTime: undefined,
          estimatedDuration: undefined,
          delegationContextId: undefined,
          parentTaskId: undefined,
          originAgentId: undefined
        };
      }
      
      // Assign task to agent
      task.assignedAgent = agentSelection.agentId;
      task.status = TaskStatus.ASSIGNED;
      this.tasks.set(task.id, task);
      
      // Update agent status
      const agent = this.agents.get(agentSelection.agentId);
      if (agent) {
        agent.currentLoad++;
        agent.activeTasks.push(task.id);
        this.updateAgentStatus(agent.id, agent);
      }
      
      return {
        success: true,
        taskId: task.id,
        agentId: agentSelection.agentId,
        confidence: agentSelection.confidence,
        reason: agentSelection.reason,
        status: TaskStatus.ASSIGNED,
        estimatedStartTime: new Date(),
        estimatedDuration: task.metadata.estimatedDuration,
        delegationContextId: undefined,
        parentTaskId: undefined,
        originAgentId: undefined
      };
      
    } catch (error) {
      console.error('Error delegating task:', error);
      return {
        success: false,
        taskId: '',
        agentId: '',
        confidence: 0,
        reason: 'Error during delegation',
        status: TaskStatus.FAILED,
        estimatedStartTime: undefined,
        estimatedDuration: undefined,
        delegationContextId: undefined,
        parentTaskId: undefined,
        originAgentId: undefined
      };
    }
  }
  
  /**
   * Calculate task complexity score
   */
  private calculateTaskComplexity(
    intent: ClassifiedIntent,
    entities: ExtractedEntity[]
  ): number {
    // Base complexity from intent
    let complexity = 0.5;
    
    // Adjust based on intent parameters
    complexity += 0.1 * Object.keys(intent.parameters).length;
    
    // Adjust based on entities
    complexity += 0.05 * entities.length;
    
    // Adjust based on relationships between entities
    const relatedEntities = entities.filter(e => e.relatedEntities && e.relatedEntities.length > 0);
    complexity += 0.1 * relatedEntities.length;
    
    return Math.min(1, complexity);
  }
  
  /**
   * Estimate task duration in milliseconds
   */
  private estimateTaskDuration(
    intent: ClassifiedIntent,
    entities: ExtractedEntity[]
  ): number {
    // Base duration of 1 minute
    let duration = 60000;
    
    // Adjust based on intent type
    switch (intent.name) {
      case 'create_task':
      case 'update_task':
        duration += 30000;
        break;
      case 'write_code':
      case 'debug_code':
        duration += 300000;
        break;
      case 'research':
        duration += 600000;
        break;
    }
    
    // Adjust based on complexity
    const complexity = this.calculateTaskComplexity(intent, entities);
    duration *= (1 + complexity);
    
    return duration;
  }

  /**
   * Get agent status by ID
   */
  async getAgentStatus(agentId: string): Promise<AgentStatus | null> {
    try {
      // This is a placeholder implementation
      // In a real system, this would fetch agent status from a database or registry
      return {
        id: agentId,
        name: `Agent-${agentId}`,
        capabilities: [],
        currentLoad: 0,
        activeTasks: [],
        performance: {
          successRate: 0,
          averageResponseTime: 0,
          taskHistory: []
        },
        health: {
          isAvailable: true,
          lastHeartbeat: new Date().toISOString(),
          errorRate: 0
        },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          totalTasksHandled: 0
        }
      };
    } catch (error) {
      console.error(`Error getting agent status for ${agentId}:`, error);
      return null;
    }
  }
} 