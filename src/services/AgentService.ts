import { AgentRegistry } from '../lib/agents/registry';

// Helper function to construct proper API URLs
function getApiUrl(path: string): string {
  // Determine if we're running in a browser
  const isBrowser = typeof window !== 'undefined';
  
  // Get the base URL from the browser if available, otherwise use a default
  const baseUrl = isBrowser 
    ? `${window.location.protocol}//${window.location.host}`
    : 'http://localhost:3000'; // Default for server-side

  // Ensure path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${normalizedPath}`;
}

interface AgentProfile {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'unavailable' | 'maintenance';
  capabilities: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  parameters: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class AgentService {
  /**
   * Get an agent instance by ID using the API
   * @param agentId The agent ID to retrieve
   * @returns The agent profile or null if not found
   */
  static async getAgent(agentId: string): Promise<AgentProfile | null> {
    try {
      // First try the registry (for backward compatibility)
      try {
        const agent = await AgentRegistry.getAgent(agentId);
        if (agent) return agent;
      } catch (registryError) {
        console.warn(`Error checking agent registry for ${agentId}:`, registryError);
        // Continue to try the API
      }
      
      // If not in registry, try the API
      try {
        const response = await fetch(getApiUrl(`/api/multi-agent/agents/${agentId}`));
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log(`Agent ${agentId} not found`);
            return null;
          }
          
          console.warn(`API error for agent ${agentId}: ${response.status} ${response.statusText}`);
          return null;
        }
        
        const data = await response.json();
        return data.agent;
      } catch (apiError) {
        console.warn(`API fetch error for agent ${agentId}:`, apiError);
        return null;
      }
    } catch (error) {
      console.error(`Error retrieving agent ${agentId}:`, error);
      return null;
    }
  }
  
  /**
   * Get all registered agent IDs
   * @returns Array of agent profiles
   */
  static async getAgentIds(): Promise<string[]> {
    try {
      // Try to get agents from the API first
      const agents = await this.getAllAgents();
      if (agents.length > 0) {
        return agents.map(agent => agent.id);
      }
      
      // Fallback to registry for backward compatibility  
      try {
        return await AgentRegistry.getAgentIds();
      } catch (registryError) {
        console.warn('Error getting agent IDs from registry:', registryError);
        return [];
      }
    } catch (error) {
      console.error('Error retrieving agent IDs:', error);
      return [];
    }
  }
  
  /**
   * Get all registered agents
   * @returns Array of agent profiles
   */
  static async getAllAgents(): Promise<AgentProfile[]> {
    try {
      try {
        const response = await fetch(getApiUrl('/api/multi-agent/agents'));
        
        if (!response.ok) {
          console.warn(`API error for getAllAgents: ${response.status} ${response.statusText}`);
          return [];
        }
        
        const data = await response.json();
        return data.agents || [];
      } catch (apiError) {
        console.warn('API fetch error for getAllAgents:', apiError);
        return [];
      }
    } catch (error) {
      console.error('Error retrieving agents:', error);
      return [];
    }
  }
  
  /**
   * Get the default agent (first available agent)
   * @returns The default agent instance or null if no agents are available
   */
  static async getDefaultAgent(): Promise<any> {
    try {
      // Get all available agents
      const agents = await this.getAllAgents();
      
      // Return the first available agent, or null if none are found
      if (agents && agents.length > 0) {
        console.log(`Found default agent: ${agents[0].name || agents[0].id}`);
        return agents[0];
      }
      
      // No agents available
      console.log("No agents available");
      return null;
    } catch (error) {
      console.error("Error finding default agent:", error);
      return null;
    }
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
    
    // Use API to process message
    try {
      const response = await fetch(getApiUrl(`/api/multi-agent/agents/${agentId}/process`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          options
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to process message with agent ${agentId}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error processing message with agent ${agentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Register a new agent in the system
   * @param agentData The agent data to register
   */
  static async registerAgent(agentData: any): Promise<AgentProfile> {
    try {
      const response = await fetch(getApiUrl('/api/multi-agent/agents'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(agentData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to register agent');
      }
      
      const data = await response.json();
      return data.agent;
    } catch (error) {
      console.error('Error registering agent:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing agent
   * @param agentId The ID of the agent to update
   * @param updates The updates to apply
   */
  static async updateAgent(agentId: string, updates: any): Promise<AgentProfile> {
    try {
      const response = await fetch(getApiUrl(`/api/multi-agent/agents/${agentId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to update agent ${agentId}`);
      }
      
      const data = await response.json();
      return data.agent;
    } catch (error) {
      console.error(`Error updating agent ${agentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Deletes an agent and all associated data
   * @param agentId The unique identifier of the agent to delete
   */
  static async deleteAgent(agentId: string): Promise<void> {
    try {
      // Call the API to delete the agent
      const response = await fetch(getApiUrl(`/api/multi-agent/agents/${agentId}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to delete agent ${agentId}`);
      }
      
      console.log(`Successfully deleted agent: ${agentId}`);
    } catch (error) {
      console.error(`Failed to delete agent: ${error}`);
      throw error;
    }
  }
} 