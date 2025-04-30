/**
 * Example usage of the multi-agent system
 * 
 * This file demonstrates how to set up and use the refactored multi-agent system.
 * It creates a coordinator (Chloe) and a sub-agent (ResearchAgent) and shows
 * how to perform task delegation.
 */

import { createAgent } from './shared';
import { ChloeCoordinator } from './chloe/ChloeCoordinator';
import { ResearchAgent } from './subagents/ResearchAgent';
import { AgentCapabilityLevel } from './shared/base/AgentBase';

/**
 * Set up the multi-agent system
 */
async function setupMultiAgentSystem() {
  console.log('Setting up multi-agent system...');
  
  // Create Chloe coordinator
  const chloe = new ChloeCoordinator({
    config: {
      agentId: 'chloe',
      name: 'Chloe',
      description: 'Coordinator agent that delegates tasks to specialized sub-agents',
      model: 'gpt-4',
      temperature: 0.7,
      coordinatorPrompt: 'You are Chloe, a coordinator agent who delegates tasks to specialized sub-agents.'
    }
  });
  
  // Initialize Chloe
  await chloe.initialize();
  console.log(`Chloe initialized with ID: ${chloe.getAgentId()}`);
  
  // Create research agent
  const researchAgent = new ResearchAgent({
    config: {
      agentId: 'research_agent',
      name: 'Research Agent',
      description: 'Specialized agent for research tasks',
      model: 'gpt-4',
      temperature: 0.7,
      researchPrompt: 'You are a specialized research agent focused on gathering accurate information.'
    }
  });
  
  // Initialize research agent
  await researchAgent.initialize();
  console.log(`Research agent initialized with ID: ${researchAgent.getAgentId()}`);
  
  // Get the agent coordinator from Chloe
  const coordinator = (chloe as any).coordinator;
  
  // Register the research agent with the coordinator
  coordinator.registerAgent(
    researchAgent,
    ['research', 'information_gathering', 'web_search'],
    'research'
  );
  
  console.log('Multi-agent system setup complete');
  console.log('Registered agents:', Object.keys(coordinator.getRegisteredAgents()));
  
  return { chloe, researchAgent, coordinator };
}

/**
 * Execute a task in the multi-agent system
 */
async function executeTask(chloe: ChloeCoordinator, task: string) {
  console.log(`\nExecuting task: ${task}`);
  
  // Process the task with Chloe
  const response = await chloe.processMessage(task);
  console.log(`\nResponse: ${response}`);
  
  // This would normally be handled asynchronously through the delegation system
  
  return response;
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Set up the system
    const { chloe, researchAgent } = await setupMultiAgentSystem();
    
    // Execute some example tasks
    await executeTask(chloe, 'What is the latest news about artificial intelligence?');
    await executeTask(chloe, 'Create a plan for our marketing campaign.');
    
    // Properly shut down all agents
    await researchAgent.shutdown();
    await chloe.shutdown();
    
    console.log('System shutdown complete');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for use in other files
export { setupMultiAgentSystem, executeTask }; 