import { IDelegationService } from './IDelegationService';
import { DelegationManager, DelegationResult, TaskPriority, AgentStatus, DelegationFeedback } from './DelegationManager';
import { ExtractedEntity, EntityType } from '../memory/EntityExtractor';
import { IdGenerator } from '@/utils/ulid';

/**
 * Implementation of the delegation service using DelegationManager
 */
export class DelegationService implements IDelegationService {
  private delegationManager: DelegationManager;
  
  /**
   * Create a new delegation service
   */
  constructor() {
    this.delegationManager = new DelegationManager();
  }
  
  /**
   * Delegate a task to the most appropriate agent
   */
  async delegateTask(
    userId: string,
    query: string,
    requiredCapabilities: string[],
    priority: number = 5,
    isUrgent: boolean = false,
    context?: any
  ): Promise<DelegationResult> {
    console.log(`Delegating task for user ${userId} with capabilities: ${requiredCapabilities.join(', ')}`);
    
    // Create intent from query
    const intent = {
      id: IdGenerator.generate('intent').toString(),
      name: 'user_task',
      description: query,
      confidence: 1.0,
      parameters: {
        capabilities: requiredCapabilities,
        priority: isUrgent ? TaskPriority.URGENT : TaskPriority.MEDIUM,
        userId
      },
      childIntents: [],
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'user_request',
        context: context ? JSON.stringify(context) : undefined
      }
    };

    // Create entities from context
    const entities: ExtractedEntity[] = context ? [{
      id: IdGenerator.generate('entity').toString(),
      type: EntityType.CUSTOM,
      value: JSON.stringify(context),
      confidence: 1.0,
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'user_context'
      },
      timestamp: new Date().toISOString()
    }] : [];
    
    // Delegate the task
    return this.delegationManager.delegateTask(intent, entities, 
      isUrgent ? TaskPriority.URGENT : TaskPriority.MEDIUM);
  }
  
  /**
   * Get available agents with their capabilities and current load
   */
  async getAvailableAgents(): Promise<Array<{
    id: string;
    name: string;
    capabilities: string[];
    currentLoad: number;
  }>> {
    // Get all registered agents
    const agents = await this.getRegisteredAgents();
    
    // Filter to only available agents and map to required format
    return agents
      .filter((agent: AgentStatus) => agent.health.isAvailable)
      .map((agent: AgentStatus) => ({
        id: agent.id,
        name: agent.name,
        capabilities: agent.capabilities.map((cap) => cap.name),
        currentLoad: agent.currentLoad
      }));
  }
  
  /**
   * Check if capabilities are available in the system
   */
  async hasCapabilities(capabilities: string[]): Promise<boolean> {
    // Get all registered agents
    const agents = await this.getRegisteredAgents();
    
    // Check if all required capabilities are covered by at least one agent
    return capabilities.every(capability => 
      agents.some((agent: AgentStatus) => 
        agent.health.isAvailable && 
        agent.capabilities.some((cap) => cap.name === capability)
      )
    );
  }

  /**
   * Get all registered agents from the delegation manager
   */
  private async getRegisteredAgents(): Promise<AgentStatus[]> {
    // For now, return an empty array since we don't have access to the internal agents
    // This should be replaced with proper agent retrieval once the API is available
    return [];
  }

  /**
   * Record feedback for a delegated task
   */
  async recordFeedback(feedback: DelegationFeedback): Promise<boolean> {
    try {
      // Update agent metrics based on feedback
      const agent = await this.delegationManager.getAgentStatus(feedback.agentId);
      if (!agent) {
        console.error(`Agent ${feedback.agentId} not found for feedback`);
        return false;
      }

      // Update success rate
      const totalTasks = agent.performance.taskHistory.length;
      const successfulTasks = agent.performance.taskHistory.filter((t: { success: boolean }) => t.success).length;
      agent.performance.successRate = (successfulTasks + (feedback.wasSuccessful ? 1 : 0)) / (totalTasks + 1);

      // Update average response time
      const totalTime = agent.performance.taskHistory.reduce((sum: number, t: { duration: number }) => sum + t.duration, 0);
      agent.performance.averageResponseTime = (totalTime + feedback.executionTime) / (totalTasks + 1);

      // Add to task history
      agent.performance.taskHistory.push({
        taskId: feedback.taskId,
        success: feedback.wasSuccessful,
        duration: feedback.executionTime
      });

      // Update total tasks handled
      agent.metadata.totalTasksHandled++;

      // Update last task info
      agent.metadata.lastAssignedTask = feedback.taskId;
      agent.metadata.updatedAt = new Date().toISOString();

      return true;
    } catch (error) {
      console.error('Error recording feedback:', error);
      return false;
    }
  }
} 