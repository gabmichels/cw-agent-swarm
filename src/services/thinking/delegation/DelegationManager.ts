import { IdGenerator } from '@/utils/ulid';

/**
 * Information about a specialized agent
 */
export interface AgentInfo {
  /**
   * Unique identifier for the agent
   */
  id: string;
  
  /**
   * Display name of the agent
   */
  name: string;
  
  /**
   * Agent capabilities
   */
  capabilities: string[];
  
  /**
   * Current load (0-1, where 0 is idle and 1 is fully loaded)
   */
  currentLoad: number;
  
  /**
   * Maximum capacity
   */
  maxCapacity: number;
  
  /**
   * Success rate (0-1)
   */
  successRate: number;
  
  /**
   * Average response time in milliseconds
   */
  avgResponseTime: number;
  
  /**
   * Whether the agent is currently available
   */
  isAvailable: boolean;
}

/**
 * Task to be delegated
 */
export interface DelegationTask {
  /**
   * Unique identifier for the task
   */
  id: string;
  
  /**
   * User who initiated the task
   */
  userId: string;
  
  /**
   * Original query from the user
   */
  query: string;
  
  /**
   * Required capabilities for this task
   */
  requiredCapabilities: string[];
  
  /**
   * Priority of the task (higher = more important)
   */
  priority: number;
  
  /**
   * Estimated complexity (0-1)
   */
  complexity: number;
  
  /**
   * When the task was created
   */
  createdAt: Date;
  
  /**
   * Task deadline, if any
   */
  deadline?: Date;
  
  /**
   * Whether this is a time-sensitive task
   */
  isUrgent: boolean;
  
  /**
   * Additional context for the task
   */
  context?: {
    entities?: any[];
    files?: any[];
    memories?: any[];
  };
}

/**
 * Result of a delegation operation
 */
export interface DelegationResult {
  /**
   * Whether delegation was successful
   */
  success: boolean;
  
  /**
   * ID of the assigned agent, if successful
   */
  agentId?: string;
  
  /**
   * Estimated time until task execution
   */
  estimatedWaitTime?: number;
  
  /**
   * Reason for delegation decision
   */
  reason: string;
  
  /**
   * Task ID
   */
  taskId: string;
}

/**
 * Feedback on delegation outcome
 */
export interface DelegationFeedback {
  /**
   * Task ID
   */
  taskId: string;
  
  /**
   * Agent ID
   */
  agentId: string;
  
  /**
   * Whether the task was completed successfully
   */
  wasSuccessful: boolean;
  
  /**
   * Execution time in milliseconds
   */
  executionTime: number;
  
  /**
   * User satisfaction score (0-1)
   */
  userSatisfaction?: number;
  
  /**
   * Feedback details
   */
  details?: string;
}

/**
 * Manages task delegation to specialized agents
 */
export class DelegationManager {
  /**
   * Registry of available agents
   */
  private agents: Map<string, AgentInfo> = new Map();
  
  /**
   * Queue of pending tasks
   */
  private taskQueue: DelegationTask[] = [];
  
  /**
   * History of task delegations
   */
  private delegationHistory: Map<string, {
    task: DelegationTask;
    assignedTo: string;
    timestamp: Date;
    result?: DelegationFeedback;
  }> = new Map();
  
  /**
   * Default agent information for demonstration purposes
   */
  constructor() {
    // Initialize with mock agents
    this.registerAgent({
      id: "research-agent",
      name: "Research Specialist",
      capabilities: ["research", "information_retrieval", "summarization"],
      currentLoad: 0.2,
      maxCapacity: 10,
      successRate: 0.95,
      avgResponseTime: 5000,
      isAvailable: true
    });
    
    this.registerAgent({
      id: "creative-agent",
      name: "Content Creator",
      capabilities: ["content_creation", "writing", "creative_tasks"],
      currentLoad: 0.3,
      maxCapacity: 8,
      successRate: 0.9,
      avgResponseTime: 8000,
      isAvailable: true
    });
    
    this.registerAgent({
      id: "coding-agent",
      name: "Code Developer",
      capabilities: ["coding", "debugging", "code_review"],
      currentLoad: 0.5,
      maxCapacity: 5,
      successRate: 0.85,
      avgResponseTime: 10000,
      isAvailable: true
    });
    
    this.registerAgent({
      id: "data-agent",
      name: "Data Analyst",
      capabilities: ["data_analysis", "visualization", "statistics"],
      currentLoad: 0.1,
      maxCapacity: 7,
      successRate: 0.92,
      avgResponseTime: 7000,
      isAvailable: true
    });
  }
  
  /**
   * Register a new agent
   */
  registerAgent(agent: AgentInfo): void {
    this.agents.set(agent.id, agent);
    console.log(`Registered agent: ${agent.name} (${agent.id})`);
  }
  
  /**
   * Update agent status
   */
  updateAgentStatus(
    agentId: string, 
    updates: Partial<AgentInfo>
  ): boolean {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      console.error(`Agent ${agentId} not found`);
      return false;
    }
    
    Object.assign(agent, updates);
    return true;
  }
  
  /**
   * Get all registered agents
   */
  getAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }
  
  /**
   * Find the best agent for a task based on capabilities and load
   */
  private findBestAgent(task: DelegationTask): AgentInfo | null {
    // Find agents with matching capabilities
    const candidateAgents = Array.from(this.agents.values()).filter(agent => {
      // Skip unavailable agents
      if (!agent.isAvailable) return false;
      
      // Check if agent has all required capabilities
      return task.requiredCapabilities.every(cap => 
        agent.capabilities.includes(cap)
      );
    });
    
    if (candidateAgents.length === 0) {
      return null;
    }
    
    // Calculate a score for each agent based on multiple factors
    const scoredAgents = candidateAgents.map(agent => {
      // Load factor (lower load is better)
      const loadFactor = 1 - (agent.currentLoad / agent.maxCapacity);
      
      // Success rate factor (higher success rate is better)
      const successFactor = agent.successRate;
      
      // Response time factor (lower response time is better)
      const responseTimeFactor = 1 - (agent.avgResponseTime / 30000); // Normalize to 30s max
      
      // Calculate overall score
      const score = (loadFactor * 0.4) + (successFactor * 0.4) + (responseTimeFactor * 0.2);
      
      return { agent, score };
    });
    
    // Sort by score (highest first)
    scoredAgents.sort((a, b) => b.score - a.score);
    
    // Return the highest scoring agent
    return scoredAgents[0]?.agent || null;
  }
  
  /**
   * Delegate a task to the most appropriate agent
   */
  delegateTask(task: Omit<DelegationTask, 'id' | 'createdAt'>): DelegationResult {
    try {
      // Create task with ID and timestamp
      const taskId = IdGenerator.generate("task");
      const fullTask: DelegationTask = {
        ...task,
        id: taskId.toString(),
        createdAt: new Date()
      };
      
      // Find the best agent for the task
      const bestAgent = this.findBestAgent(fullTask);
      
      if (!bestAgent) {
        // No suitable agent found, queue the task for later
        this.taskQueue.push(fullTask);
        
        return {
          success: false,
          reason: 'No suitable agent available. Task queued for later processing.',
          taskId: fullTask.id
        };
      }
      
      // Check if agent has capacity
      const currentTaskCount = bestAgent.currentLoad * bestAgent.maxCapacity;
      const isAtCapacity = currentTaskCount >= bestAgent.maxCapacity;
      
      // If urgent task and agent at capacity, try to prioritize
      if (fullTask.isUrgent && isAtCapacity) {
        // For urgent tasks, we might still assign if the agent isn't too overloaded
        if (bestAgent.currentLoad < 0.9) {
          // Can squeeze in the urgent task
          bestAgent.currentLoad = Math.min(1.0, bestAgent.currentLoad + (1 / bestAgent.maxCapacity));
        } else {
          // Even urgent tasks can't be accommodated
          this.taskQueue.push(fullTask);
          return {
            success: false,
            reason: 'All suitable agents are at full capacity. Urgent task queued with high priority.',
            taskId: fullTask.id
          };
        }
      } else if (isAtCapacity) {
        // Non-urgent task and agent at capacity
        this.taskQueue.push(fullTask);
        return {
          success: false,
          reason: 'Selected agent is at capacity. Task queued for later processing.',
          taskId: fullTask.id,
          estimatedWaitTime: this.estimateWaitTime(bestAgent)
        };
      }
      
      // Assign task to the agent
      bestAgent.currentLoad = Math.min(1.0, bestAgent.currentLoad + (1 / bestAgent.maxCapacity));
      
      // Record delegation in history
      this.delegationHistory.set(fullTask.id, {
        task: fullTask,
        assignedTo: bestAgent.id,
        timestamp: new Date()
      });
      
      // Calculate estimated wait time
      const estimatedWaitTime = this.estimateWaitTime(bestAgent);
      
      return {
        success: true,
        agentId: bestAgent.id,
        taskId: fullTask.id,
        estimatedWaitTime,
        reason: `Task delegated to ${bestAgent.name} based on capabilities and current load.`
      };
    } catch (error) {
      console.error('Error in delegateTask:', error);
      const fallbackId = IdGenerator.generate("task");
      return {
        success: false,
        reason: `Delegation failed: ${error instanceof Error ? error.message : String(error)}`,
        taskId: fallbackId.toString()
      };
    }
  }
  
  /**
   * Process the task queue
   */
  processQueue(): void {
    if (this.taskQueue.length === 0) {
      return;
    }
    
    console.log(`Processing delegation queue, ${this.taskQueue.length} tasks pending`);
    
    // Sort queue by priority and creation time
    this.taskQueue.sort((a, b) => {
      // First by urgency
      if (a.isUrgent !== b.isUrgent) {
        return a.isUrgent ? -1 : 1;
      }
      
      // Then by priority
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // Finally by creation time
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    
    // Try to process each task
    const remainingTasks: DelegationTask[] = [];
    
    for (const task of this.taskQueue) {
      const bestAgent = this.findBestAgent(task);
      
      if (!bestAgent || bestAgent.currentLoad * bestAgent.maxCapacity >= bestAgent.maxCapacity) {
        // Can't process this task now, keep it in the queue
        remainingTasks.push(task);
        continue;
      }
      
      // Assign task to the agent
      bestAgent.currentLoad = Math.min(1.0, bestAgent.currentLoad + (1 / bestAgent.maxCapacity));
      
      // Record delegation in history
      this.delegationHistory.set(task.id, {
        task,
        assignedTo: bestAgent.id,
        timestamp: new Date()
      });
      
      console.log(`Assigned queued task ${task.id} to ${bestAgent.name}`);
    }
    
    // Update queue with remaining tasks
    this.taskQueue = remainingTasks;
    console.log(`Delegation queue processing complete, ${this.taskQueue.length} tasks still pending`);
  }
  
  /**
   * Record feedback on a delegated task
   */
  recordFeedback(feedback: DelegationFeedback): boolean {
    const delegation = this.delegationHistory.get(feedback.taskId);
    
    if (!delegation) {
      console.error(`No delegation record found for task ${feedback.taskId}`);
      return false;
    }
    
    // Record feedback
    delegation.result = feedback;
    
    // Update agent statistics
    const agent = this.agents.get(feedback.agentId);
    
    if (agent) {
      // Decrease load
      agent.currentLoad = Math.max(0, agent.currentLoad - (1 / agent.maxCapacity));
      
      // Update success rate with exponential moving average
      const alpha = 0.1; // Weight for new data
      agent.successRate = (alpha * (feedback.wasSuccessful ? 1 : 0)) + ((1 - alpha) * agent.successRate);
      
      // Update response time with exponential moving average
      agent.avgResponseTime = (alpha * feedback.executionTime) + ((1 - alpha) * agent.avgResponseTime);
      
      console.log(`Updated agent ${agent.name} stats based on feedback. New success rate: ${agent.successRate.toFixed(2)}, avg response time: ${agent.avgResponseTime.toFixed(0)}ms`);
    }
    
    // Process queue after handling feedback
    this.processQueue();
    
    return true;
  }
  
  /**
   * Estimate wait time for a task based on agent load
   */
  private estimateWaitTime(agent: AgentInfo): number {
    // Simple estimation based on load and average response time
    const tasksAhead = Math.ceil(agent.currentLoad * agent.maxCapacity);
    return tasksAhead * agent.avgResponseTime;
  }
} 