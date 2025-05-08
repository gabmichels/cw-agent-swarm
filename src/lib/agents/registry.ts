/**
 * A mock agent registry for managing agent instances
 */
export class AgentRegistry {
  private static agents: Record<string, any> = {};

  /**
   * Get an agent by ID
   * @param agentId The unique identifier of the agent
   * @returns The agent instance or null if not found
   */
  static async getAgent(agentId: string): Promise<any> {
    return this.agents[agentId] || null;
  }

  /**
   * Register a new agent in the registry
   * @param agentId The unique identifier of the agent
   * @param agent The agent instance
   */
  static async registerAgent(agentId: string, agent: any): Promise<void> {
    this.agents[agentId] = agent;
    console.log(`Agent ${agentId} registered successfully`);
  }

  /**
   * Remove an agent from the registry
   * @param agentId The unique identifier of the agent to remove
   * @returns true if the agent was removed, false if not found
   */
  static async removeAgent(agentId: string): Promise<boolean> {
    if (this.agents[agentId]) {
      delete this.agents[agentId];
      console.log(`Agent ${agentId} removed from registry`);
      return true;
    }
    return false;
  }

  /**
   * Get all registered agent IDs
   * @returns Array of agent IDs
   */
  static async getAgentIds(): Promise<string[]> {
    return Object.keys(this.agents);
  }
} 