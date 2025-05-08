import { AgentRegistry } from '../lib/agents/registry';

export class AgentService {
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