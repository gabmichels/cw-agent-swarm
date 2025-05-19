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
import { getAgentById, getAllAgents } from '../../server/agent/agent-service';
import { logger } from '../../lib/logging';

/**
 * Register all available sub-agents with the MCP
 * This function should be called at system startup
 */
export function registerSubAgents(): SubAgent[] {
  console.log("🤖 Bootstrapping agents for MCP registration...");
  
  const agents: SubAgent[] = [];
  
  // Register all agents with the MCP
  agents.forEach(agent => {
    MCPRuntime.registerAgent(agent);
    console.log(`✅ Registered hardcoded agent ${agent.id} (${agent.name}) with MCP`);
  });
  
  console.log(`📋 Registered ${agents.length} hardcoded agents with the MCP`);
  return agents;
}

/**
 * Get list of registered agents
 */
export function getRegisteredAgents(): SubAgent[] {
  return MCPRuntime.getAllAgents();
}

/**
 * Register runtime agents with the MCP
 * This integrates agents that were bootstrapped from the database
 */
export function registerRuntimeAgentsWithMCP(): number {
  try {
    // Get all runtime agents from agent-service
    const runtimeAgents = getAllAgents();
    let registeredCount = 0;
    
    console.log(`🔍 Found ${runtimeAgents.length} runtime agents to register with MCP`);
    
    // Log all available runtime agents
    console.log('📝 Runtime agents available:');
    runtimeAgents.forEach(agent => {
      console.log(`   - Agent ID: ${agent.getAgentId()}, Name: ${agent.getName()}`);
    });
    
    for (const agent of runtimeAgents) {
      const agentId = agent.getAgentId();
      
      // Skip agents already registered with MCP
      if (MCPRuntime.getAgent(agentId)) {
        console.log(`⏩ Agent ${agentId} (${agent.getName()}) already registered with MCP, skipping`);
        continue;
      }
      
      // Create a SubAgent wrapper for the runtime agent
      const subAgent: SubAgent = {
        id: agentId,
        name: agent.getName(),
        description: agent.getDescription(),
        capabilities: [],
        tags: [],
        execute: async (task) => {
          try {
            // Convert PlannedTask to format expected by agent
            const result = await agent.executeTask(task.id);
            return {
              success: true,
              data: { result },
              message: `Task ${task.id} completed successfully`
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Task ${task.id} failed`
            };
          }
        }
      };
      
      // Get capabilities
      agent.getCapabilities().then(capabilities => {
        subAgent.capabilities = capabilities;
        console.log(`ℹ️ Agent ${agentId} (${agent.getName()}) has capabilities: ${capabilities.join(', ') || 'none'}`);
      }).catch(error => {
        logger.error(`Failed to get capabilities for agent ${agentId}:`, error);
      });
      
      // Register with MCP
      MCPRuntime.registerAgent(subAgent);
      console.log(`✅ Registered runtime agent ${agentId} (${agent.getName()}) with MCP`);
      registeredCount++;
    }
    
    logger.info(`Registered ${registeredCount} runtime agents with the MCP`);
    console.log(`🚀 Successfully registered ${registeredCount} runtime agents with the MCP`);
    return registeredCount;
  } catch (error) {
    logger.error('Error registering runtime agents with MCP:', error);
    console.error('❌ Error registering runtime agents with MCP:', error);
    return 0;
  }
}

/**
 * Bootstrap all agents - call this during system startup
 */
export async function bootstrapAgentSystem(): Promise<void> {
  try {
    console.log('🔄 Starting MCP agent system bootstrap...');
    
    // Register hardcoded agents
    const agents = registerSubAgents();
    
    // Register agents that were bootstrapped from the database
    const runtimeAgentsCount = registerRuntimeAgentsWithMCP();
    
    // Initialize health checking
    // Note: The health checker is already initialized when registering agents
    
    logger.info(`Agent system bootstrapped with ${agents.length} hardcoded agents and ${runtimeAgentsCount} runtime agents`);
    console.log(`🎉 Agent system bootstrapped with ${agents.length} hardcoded agents and ${runtimeAgentsCount} runtime agents`);
  } catch (error) {
    logger.error('Error bootstrapping agent system:', error);
    console.error('❌ Error bootstrapping agent system:', error);
    throw error;
  }
} 