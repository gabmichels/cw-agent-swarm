import { IDelegationService } from './IDelegationService';
import { DelegationManager, DelegationResult, DelegationFeedback } from './DelegationManager';

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
    priority: number = 5, // Default medium priority
    isUrgent: boolean = false,
    context?: any
  ): Promise<DelegationResult> {
    console.log(`Delegating task for user ${userId} with capabilities: ${requiredCapabilities.join(', ')}`);
    
    // Create task object for delegation
    const task = {
      userId,
      query,
      requiredCapabilities,
      priority,
      isUrgent,
      complexity: 0.5, // Default medium complexity
      context
    };
    
    // Delegate the task
    return this.delegationManager.delegateTask(task);
  }
  
  /**
   * Record feedback on a delegated task
   */
  async recordFeedback(feedback: DelegationFeedback): Promise<boolean> {
    return this.delegationManager.recordFeedback(feedback);
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
    const agents = this.delegationManager.getAgents();
    
    // Filter to only available agents and map to required format
    return agents
      .filter(agent => agent.isAvailable)
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        capabilities: agent.capabilities,
        currentLoad: agent.currentLoad
      }));
  }
  
  /**
   * Check if capabilities are available in the system
   */
  async hasCapabilities(capabilities: string[]): Promise<boolean> {
    const agents = this.delegationManager.getAgents();
    
    // Check if all required capabilities are covered by at least one agent
    return capabilities.every(capability => 
      agents.some(agent => 
        agent.isAvailable && agent.capabilities.includes(capability)
      )
    );
  }
} 