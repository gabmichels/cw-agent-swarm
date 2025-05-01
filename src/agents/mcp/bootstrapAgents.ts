/**
 * bootstrapAgents.ts - Initialize and register agents with the MCP
 * 
 * This module is responsible for:
 * - Creating instances of all available agents
 * - Registering them with the Multi-Agent Control Plane
 * - Ensuring the agent ecosystem is ready for task routing
 */

import { ResearchAgent } from '../subagents/ResearchAgent';
import { MCPRuntime, SubAgent } from './MCPRuntime';
import { CapabilityLevel } from '../shared/coordination/CapabilityRegistry';

/**
 * Register all available sub-agents with the MCP
 * This function should be called at system startup
 */
export function registerSubAgents(): SubAgent[] {
  console.log("Bootstrapping agents for MCP registration...");
  
  const agents: SubAgent[] = [];
  
  // Create Research Agent
  const researchAgent = new ResearchAgent({
    config: {
      agentId: 'research-agent-1',
      name: 'Research Specialist',
      description: 'Specialized agent for information gathering and research tasks',
      model: 'gpt-4',
      temperature: 0.5,
      researchPrompt: 'You are a specialized research agent focused on gathering accurate information.',
      capabilities: {
        skills: { 
          research: CapabilityLevel.EXPERT, 
          information_gathering: CapabilityLevel.ADVANCED 
        },
        domains: ['research', 'information'],
        roles: ['researcher']
      }
    }
  });
  
  // Convert AgentBase to SubAgent interface
  const researchSubAgent: SubAgent = {
    id: researchAgent.getAgentId(),
    name: 'Research Specialist',
    description: 'Specialized agent for information gathering and research tasks',
    capabilities: ['research', 'web_search', 'information_gathering'],
    roles: ['researcher'],
    tags: ['research', 'information'],
    execute: async (task) => {
      // Adapt the task to whatever the research agent expects
      return await researchAgent.processMessage(task.description, {
        taskId: task.id,
        priority: task.priority
      }).then(result => ({
        success: true,
        data: { result },
        message: result
      })).catch(error => ({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'Research task failed'
      }));
    }
  };
  
  agents.push(researchSubAgent);
  
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