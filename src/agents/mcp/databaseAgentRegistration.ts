/**
 * databaseAgentRegistration.ts
 * 
 * Service for loading agents from the database and registering them with the MCP
 */

import { MCPRuntime, SubAgent, PlannedTask, TaskResult } from './MCPRuntime';
import { AgentService } from '../../services/AgentService';
import { AgentFactory } from '../shared/AgentFactory';

/**
 * Load all agents from the database and register them with MCP
 */
export async function loadAndRegisterAgents(): Promise<void> {
  try {
    console.log('Loading agents from database and registering with MCP...');
    
    // 1. Load agents from the database
    const agents = await AgentService.getAllAgents();
    
    if (!agents || agents.length === 0) {
      console.log('No agents found in database to register with MCP');
      return;
    }
    
    console.log(`Found ${agents.length} agents in database`);
    
    // 2. Register each agent with MCP
    for (const agentConfig of agents) {
      try {
        // Create an adapter that implements the SubAgent interface expected by MCP
        const mcpAgent = createMCPAgentAdapter(agentConfig);
        
        // Register with MCP
        MCPRuntime.registerAgent(mcpAgent);
        
        console.log(`Registered agent ${agentConfig.name} (${agentConfig.id}) with MCP`);
      } catch (error) {
        console.error(`Error registering agent ${agentConfig.id} with MCP:`, error);
      }
    }
    
    console.log('Completed registration of database agents with MCP');
  } catch (error) {
    console.error('Error loading and registering database agents:', error);
  }
}

/**
 * Create an MCP adapter for a database agent
 */
function createMCPAgentAdapter(agentConfig: any): SubAgent {
  // Extract capabilities as array of strings
  const capabilities = extractCapabilities(agentConfig);
  
  // Extract roles (specializations) from the agent
  const roles = extractRoles(agentConfig);
  
  // Extract tags from the agent's metadata
  const tags = extractTags(agentConfig);
  
  return {
    id: agentConfig.id,
    name: agentConfig.name,
    description: agentConfig.description || '',
    capabilities,
    roles,
    tags,
    execute: async (task: PlannedTask): Promise<TaskResult> => {
      try {
        // Get the agent instance from AgentFactory or similar mechanism
        // This is a lazy loading approach - only initialize the agent when needed
        const agentFactory = new AgentFactory();
        const agent = await agentFactory.createAgent(agentConfig);
        
        if (!agent) {
          throw new Error(`Failed to get or create agent instance for ${agentConfig.id}`);
        }
        
        // Use a dynamic approach to call the agent's methods
        // This avoids TypeScript errors since we're dealing with potentially different agent interfaces
        const anyAgent = agent as any;
        let result;
        
        if (typeof anyAgent.processTask === 'function') {
          result = await anyAgent.processTask({
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            metadata: {
              capabilities: task.capabilities,
              roles: task.roles,
              tags: task.tags
            }
          });
        } else if (typeof anyAgent.processMessage === 'function') {
          result = await anyAgent.processMessage(task.description, {
            taskId: task.id,
            title: task.title,
            priority: task.priority
          });
        } else if (typeof anyAgent.execute === 'function') {
          result = await anyAgent.execute(task.description);
        } else {
          // As a last resort, try to use the agent's config to determine how to process
          console.log(`Agent ${agentConfig.id} has no standard execution method, using fallback`);
          result = `Task ${task.id} (${task.title}) was received but the agent has no execution method.`;
        }
        
        // Convert the agent's result to MCP's TaskResult format
        return {
          success: true,
          data: result,
          message: `Task ${task.title} completed successfully`
        };
      } catch (error) {
        console.error(`Error executing task for agent ${agentConfig.id}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          message: `Task ${task.title} failed`
        };
      }
    }
  };
}

/**
 * Extract capabilities from an agent config
 */
function extractCapabilities(agentConfig: any): string[] {
  if (!agentConfig.capabilities) {
    return [];
  }
  
  // Handle different capability formats
  if (Array.isArray(agentConfig.capabilities)) {
    // If capabilities is already an array of strings
    if (typeof agentConfig.capabilities[0] === 'string') {
      return agentConfig.capabilities;
    }
    
    // If capabilities is an array of objects with name property
    if (agentConfig.capabilities[0] && typeof agentConfig.capabilities[0].name === 'string') {
      return agentConfig.capabilities.map((cap: any) => cap.name);
    }
  }
  
  // Handle object format (from agent parameters)
  if (agentConfig.parameters?.capabilities?.skills) {
    return Object.keys(agentConfig.parameters.capabilities.skills);
  }
  
  return [];
}

/**
 * Extract roles from an agent config
 */
function extractRoles(agentConfig: any): string[] {
  // Try different locations where roles might be stored
  if (Array.isArray(agentConfig.roles)) {
    return agentConfig.roles;
  }
  
  if (agentConfig.metadata?.specialization) {
    return Array.isArray(agentConfig.metadata.specialization) 
      ? agentConfig.metadata.specialization 
      : [agentConfig.metadata.specialization];
  }
  
  if (agentConfig.parameters?.capabilities?.roles) {
    return Array.isArray(agentConfig.parameters.capabilities.roles)
      ? agentConfig.parameters.capabilities.roles
      : [agentConfig.parameters.capabilities.roles];
  }
  
  return [];
}

/**
 * Extract tags from an agent config
 */
function extractTags(agentConfig: any): string[] {
  // Try different locations where tags might be stored
  if (Array.isArray(agentConfig.tags)) {
    return agentConfig.tags;
  }
  
  if (agentConfig.metadata?.tags) {
    return Array.isArray(agentConfig.metadata.tags)
      ? agentConfig.metadata.tags
      : [agentConfig.metadata.tags];
  }
  
  if (agentConfig.parameters?.capabilities?.domains) {
    return Array.isArray(agentConfig.parameters.capabilities.domains)
      ? agentConfig.parameters.capabilities.domains
      : [agentConfig.parameters.capabilities.domains];
  }
  
  return [];
}

/**
 * Register a newly created agent with MCP
 */
export function registerNewAgent(agentConfig: any): void {
  try {
    const mcpAgent = createMCPAgentAdapter(agentConfig);
    MCPRuntime.registerAgent(mcpAgent);
    console.log(`Registered new agent ${agentConfig.name} (${agentConfig.id}) with MCP`);
  } catch (error) {
    console.error(`Error registering new agent ${agentConfig.id} with MCP:`, error);
  }
}

/**
 * Update an existing agent's registration with MCP
 */
export function updateAgentRegistration(agentConfig: any): void {
  try {
    // Deregister the old version
    MCPRuntime.deregisterAgent(agentConfig.id);
    
    // Register the updated version
    const mcpAgent = createMCPAgentAdapter(agentConfig);
    MCPRuntime.registerAgent(mcpAgent);
    
    console.log(`Updated agent ${agentConfig.name} (${agentConfig.id}) registration with MCP`);
  } catch (error) {
    console.error(`Error updating agent ${agentConfig.id} registration with MCP:`, error);
  }
}

/**
 * Deregister an agent from MCP
 */
export function deregisterAgent(agentId: string): void {
  try {
    MCPRuntime.deregisterAgent(agentId);
    console.log(`Deregistered agent ${agentId} from MCP`);
  } catch (error) {
    console.error(`Error deregistering agent ${agentId} from MCP:`, error);
  }
} 