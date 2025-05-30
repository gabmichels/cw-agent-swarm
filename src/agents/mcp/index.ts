/**
 * MCP (Multi-Agent Control Plane) Main Module
 * 
 * This exports the main components of the MCP:
 * - MCPRuntime for task routing and agent management
 * - Agent registration utilities
 * - Types for MCP integration
 */

// Export values
export { MCPRuntime } from './MCPRuntime';
export { registerSubAgents, getRegisteredAgents, bootstrapAgentSystem } from './bootstrapAgents';
export { loadAndRegisterAgents, registerNewAgent, updateAgentRegistration, deregisterAgent } from './databaseAgentRegistration';

// Export types
export type { SubAgent, PlannedTask, TaskResult, AgentRegistration } from './MCPRuntime';
export type { AgentHealthStatus } from '../shared/coordination/AgentHealthChecker';

// Import here to use in the exported function below
import { MCPRuntime } from './MCPRuntime';

// Re-export convenience function for MCP execution
export const executeMCPTask = MCPRuntime.executeViaMCP;

/**
 * Initialize the Multi-Agent Control Plane
 * This is the main entry point for MCP setup
 */
export async function initializeMCP(): Promise<void> {
  try {
    console.log('Initializing Multi-Agent Control Plane (MCP)...');
    
    // Bootstrap the agent system - register all agents
    const { bootstrapAgentSystem } = await import('./bootstrapAgents');
    await bootstrapAgentSystem();
    
    // Load and register agents from the database
    const { loadAndRegisterAgents } = await import('./databaseAgentRegistration');
    await loadAndRegisterAgents();
    
    console.log('MCP initialization complete.');
  } catch (error) {
    console.error('Error initializing MCP:', error);
    throw error;
  }
} 