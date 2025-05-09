import { AgentRegistry } from '../lib/agents/registry';

export class AgentService {
  /**
   * Get an agent instance by ID
   * @param agentId The agent ID to retrieve
   * @returns The agent instance or null if not found
   */
  static async getAgent(agentId: string): Promise<any> {
    try {
      return await AgentRegistry.getAgent(agentId);
    } catch (error) {
      console.error(`Error retrieving agent ${agentId}:`, error);
      return null;
    }
  }
  
  /**
   * Get all registered agent IDs
   * @returns Array of agent IDs
   */
  static async getAgentIds(): Promise<string[]> {
    try {
      return await AgentRegistry.getAgentIds();
    } catch (error) {
      console.error('Error retrieving agent IDs:', error);
      return [];
    }
  }
  
  /**
   * Get the default agent (currently chloe)
   * @returns The default agent instance
   */
  static async getDefaultAgent(): Promise<any> {
    // This is a temporary solution during migration
    // Eventually this should be configurable or based on user preferences
    return this.getAgent('chloe');
  }
  
  /**
   * Process a message using the specified agent
   * @param agentId The agent ID to use
   * @param message The message to process
   * @param options Additional options for processing
   */
  static async processMessage(agentId: string, message: string, options?: any): Promise<any> {
    const agent = await this.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    
    // Ensure agent is initialized
    if (!agent.initialized && typeof agent.initialize === 'function') {
      console.log(`Initializing agent ${agentId} on first message processing`);
      await agent.initialize();
    }
    
    return agent.processMessage(message, options);
  }
  
  /**
   * Register a new agent in the system
   * @param agentId The unique identifier for the agent
   * @param agent The agent instance to register
   */
  static async registerAgent(agentId: string, agent: any): Promise<void> {
    await AgentRegistry.registerAgent(agentId, agent);
  }
  
  /**
   * Deletes an agent and all associated data
   * @param agentId The unique identifier of the agent to delete
   */
  static async deleteAgent(agentId: string): Promise<void> {
    try {
      // 1. Get reference to the agent to be deleted
      const agent = await AgentRegistry.getAgent(agentId);
      
      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }
      
      // 2. Delete agent-related data
      
      // 2.1 Delete agent chat history
      await this.deleteAgentChatHistory(agentId);
      
      // 2.2 Delete agent memories
      await this.deleteAgentMemories(agentId);
      
      // 2.3 Delete agent knowledge
      await this.deleteAgentKnowledge(agentId);
      
      // 3. Remove agent from registry
      await AgentRegistry.removeAgent(agentId);
      
      console.log(`Successfully deleted agent: ${agentId}`);
    } catch (error) {
      console.error(`Failed to delete agent: ${error}`);
      throw error;
    }
  }
  
  /**
   * Deletes all chat history associated with an agent
   */
  private static async deleteAgentChatHistory(agentId: string): Promise<void> {
    console.log(`Deleting chat history for agent: ${agentId}`);
    // Implement based on your chat history storage system
    // This might involve database operations or file system operations
    
    // For example:
    // await db.collection('messages').where('agentId', '==', agentId).delete();
  }
  
  /**
   * Deletes all memories associated with an agent
   */
  private static async deleteAgentMemories(agentId: string): Promise<void> {
    console.log(`Deleting memories for agent: ${agentId}`);
    // Implement based on your memory storage system
    
    // For example:
    // await db.collection('memories').where('agentId', '==', agentId).delete();
    // Or, if the agent has a memory manager:
    // await agent.memoryManager.clearAllMemories();
  }
  
  /**
   * Deletes all knowledge files associated with an agent
   */
  private static async deleteAgentKnowledge(agentId: string): Promise<void> {
    console.log(`Deleting knowledge for agent: ${agentId}`);
    // Implement based on your knowledge storage system
    
    // For example:
    // Delete all files in the agent's knowledge directory
    // await fs.rm(`data/knowledge/agents/${agentId}`, { recursive: true, force: true });
  }
} 