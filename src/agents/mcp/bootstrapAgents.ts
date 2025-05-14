/**
 * bootstrapAgents.ts - Initialize and register agents with the MCP
 * 
 * This module is responsible for:
 * - Creating instances of all available agents
 * - Registering them with the Multi-Agent Control Plane
 * - Ensuring the agent ecosystem is ready for task routing
 */

import { MCPRuntime, SubAgent } from './MCPRuntime';
import { CapabilityLevel } from '../shared/coordination/CapabilityRegistry';

/**
 * Register all available sub-agents with the MCP
 * This function should be called at system startup
 */
export function registerSubAgents(): SubAgent[] {
  console.log("Bootstrapping agents for MCP registration...");
  
  const agents: SubAgent[] = [];
  
  // Register all agents with the MCP
  agents.forEach(agent => {
    MCPRuntime.registerAgent(agent);
  });
  
  console.log(`Registered ${agents.length} agents with the MCP`);
  return agents;
}

/**
 * Get list of registered agents
 */
export function getRegisteredAgents(): SubAgent[] {
  return MCPRuntime.getAllAgents();
}

/**
 * Bootstrap all agents - call this during system startup
 */
export async function bootstrapAgentSystem(): Promise<void> {
  try {
    // Register all agents
    const agents = registerSubAgents();
    
    // Initialize health checking
    // Note: The health checker is already initialized when registering agents
    
    console.log(`Agent system bootstrapped with ${agents.length} agents`);
  } catch (error) {
    console.error('Error bootstrapping agent system:', error);
    throw error;
  }
} 