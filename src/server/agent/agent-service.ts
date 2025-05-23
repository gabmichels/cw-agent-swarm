/**
 * Agent Service - Provides methods for agent retrieval and management
 */

import { AgentBase } from '../../agents/shared/base/AgentBase.interface';
import { logger } from '../../lib/logging';

// Map of agent instances by ID
const agentRegistry: Map<string, AgentBase> = new Map();

/**
 * Register an agent with the registry
 * 
 * @param agent The agent to register
 * @returns The registered agent
 */
export function registerAgent(agent: AgentBase): AgentBase {
  const agentId = agent.getAgentId();
  if (!agentId) {
    throw new Error('Agent must have an ID to be registered');
  }
  
  agentRegistry.set(agentId, agent);
  logger.info(`Agent registered: ${agentId}`, {
    agentId,
    agentType: agent.constructor.name,
    totalAgents: agentRegistry.size,
    hasGetId: typeof agent.getId === 'function',
    hasGetHealth: typeof agent.getHealth === 'function',
    hasPlanAndExecute: typeof (agent as any).planAndExecute === 'function'
  });
  
  console.log(`✅ Agent registered in runtime registry: ${agentId} (${agent.constructor.name})`);
  console.log(`📊 Total agents in registry: ${agentRegistry.size}`);
  
  return agent;
}

/**
 * Get an agent by ID
 * 
 * @param agentId The ID of the agent to retrieve
 * @returns The agent instance or null if not found
 */
export function getAgentById(agentId: string): AgentBase | null {
  return agentRegistry.get(agentId) || null;
}

/**
 * Get all registered agents
 * 
 * @returns Array of all registered agents
 */
export function getAllAgents(): AgentBase[] {
  const agents = Array.from(agentRegistry.values());
  
  // Add debugging information
  logger.info('getAllAgents called', {
    totalAgents: agents.length,
    registrySize: agentRegistry.size,
    agentIds: agents.map(a => {
      try {
        return a.getId ? a.getId() : a.getAgentId();
      } catch (e) {
        return 'error-getting-id';
      }
    })
  });
  
  if (agents.length === 0) {
    console.warn('⚠️ getAllAgents(): No agents found in registry!');
    console.log('🔍 Registry debug info:');
    console.log(`   - Registry size: ${agentRegistry.size}`);
    console.log(`   - Registry keys: [${Array.from(agentRegistry.keys()).join(', ')}]`);
  }
  
  return agents;
}

/**
 * Unregister an agent
 * 
 * @param agentId The ID of the agent to unregister
 * @returns Whether the agent was successfully unregistered
 */
export function unregisterAgent(agentId: string): boolean {
  const removed = agentRegistry.delete(agentId);
  if (removed) {
    logger.info(`Agent unregistered: ${agentId}`);
  }
  return removed;
}

/**
 * Get the default agent (first registered)
 * 
 * @returns The default agent or null if none are registered
 */
export function getDefaultAgent(): AgentBase | null {
  const agents = getAllAgents();
  return agents.length > 0 ? agents[0] : null;
}

/**
 * Get registry statistics
 * 
 * @returns Registry statistics
 */
export function getRegistryStats() {
  return {
    totalAgents: agentRegistry.size,
    agentIds: Array.from(agentRegistry.keys()),
    agentTypes: Array.from(agentRegistry.values()).map(a => a.constructor.name)
  };
}

/**
 * Debug function to manually verify agent registration
 * Call this to check what agents are available
 */
export function debugAgentRegistry() {
  const stats = getRegistryStats();
  
  console.log('🔍 Agent Registry Debug Information:');
  console.log(`   - Total Agents: ${stats.totalAgents}`);
  console.log(`   - Agent IDs: [${stats.agentIds.join(', ')}]`);
  console.log(`   - Agent Types: [${stats.agentTypes.join(', ')}]`);
  
  // Test each agent's required methods
  for (const [agentId, agent] of Array.from(agentRegistry.entries())) {
    try {
      console.log(`   📋 Agent ${agentId}:`);
      console.log(`      - Type: ${agent.constructor.name}`);
      console.log(`      - Has getId(): ${typeof agent.getId === 'function'}`);
      console.log(`      - Has getHealth(): ${typeof agent.getHealth === 'function'}`);
      console.log(`      - Has planAndExecute(): ${typeof (agent as any).planAndExecute === 'function'}`);
      
      // Test getId method
      try {
        const id = agent.getId ? agent.getId() : 'no-getId-method';
        console.log(`      - getId() result: ${id}`);
      } catch (e) {
        console.log(`      - getId() error: ${e}`);
      }
      
    } catch (e) {
      console.log(`      - Error examining agent: ${e}`);
    }
  }
  
  return stats;
} 