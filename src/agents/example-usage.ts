/**
 * Example usage of the multi-agent system
 * 
 * This file demonstrates how to set up and use the refactored multi-agent system.
 * It creates a coordinator (Chloe) and a sub-agent (ResearchAgent) and shows
 * how to perform task delegation.
 * 
 * NOTE: This file is kept for reference only and is not used in the current implementation.
 * The imports have been commented out since we've removed the related components.
 */

/*
import { createAgent } from './shared';
import { ChloeCoordinator } from './chloe/ChloeCoordinator';
import { ResearchAgent } from './subagents/ResearchAgent';
import { AgentCapabilityLevel } from './shared/base/AgentBase';

/**
 * Set up the multi-agent system
 */
/*
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

  // Create Research Agent
  const researchAgent = new ResearchAgent({
    config: {
      agentId: 'researcher',
      name: 'Researcher',
      description: 'Specialized agent for information gathering and research tasks',
      model: 'gpt-4',
      temperature: 0.5,
      researchPrompt: 'You are a specialized research agent focused on gathering accurate information.',
      capabilities: {
        skills: { 
          research: AgentCapabilityLevel.ADVANCED, 
          information_gathering: AgentCapabilityLevel.ADVANCED 
        },
        domains: ['research', 'information'],
        roles: ['researcher']
      }
    }
  });

  // Initialize agents
  await chloe.initialize();
  await researchAgent.initialize();

  // Register research agent with Chloe
  await chloe.registerSubAgent(researchAgent);

  return {
    chloe,
    researchAgent
  };
}

/**
 * Example of delegating a task from Chloe to a specialized agent
 */
/*
async function runExample() {
  const { chloe, researchAgent } = await setupMultiAgentSystem();
  
  console.log('Running example task delegation...');
  
  // Here Chloe would determine which agent to use and delegate appropriately
  const researchQuery = "What were the key technological advancements in AI during 2023?";
  
  console.log(`Delegating research task: "${researchQuery}"`);
  
  // Chloe determines this should go to the research agent
  const delegationResult = await chloe.delegateTask({
    type: 'research',
    content: researchQuery,
    priority: 'medium'
  });
  
  console.log('Delegation result:', delegationResult);
  
  // Display research result
  console.log('Research result:', delegationResult.result);
  
  // Shutdown agents
  await researchAgent.shutdown();
  await chloe.shutdown();
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}
*/ 