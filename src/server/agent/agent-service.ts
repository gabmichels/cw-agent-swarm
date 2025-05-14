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
  logger.info(`Agent registered: ${agentId}`);
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
  return Array.from(agentRegistry.values());
}

/**
 * Unregister an agent
 * 
 * @param agentId The ID of the agent to unregister
 * @returns Whether the agent was successfully unregistered
 */
export function unregisterAgent(agentId: string): boolean {
  return agentRegistry.delete(agentId);
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