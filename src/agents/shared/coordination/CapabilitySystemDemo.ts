/**
 * CapabilitySystemDemo.ts - Example usage of the capability system
 * 
 * This module demonstrates:
 * - Initializing the capability registry
 * - Configuring agents with capabilities
 * - Using capability-based delegation and discovery
 */

import { AgentBase, AgentBaseConfig, AgentCapabilityLevel } from '../base/AgentBase';
import { AgentCoordinator } from './AgentCoordinator';
import { CapabilityRegistry, CapabilityLevel } from './CapabilityRegistry';
import { registerPredefinedCapabilities, SkillCapabilities, RoleCapabilities, DomainCapabilities } from './CapabilityDefinitions';

/**
 * Example agent implementation with specialized capabilities
 */
class SpecializedAgent extends AgentBase {
  constructor(
    id: string, 
    capabilities: Record<string, CapabilityLevel>,
    domains: string[] = [],
    roles: string[] = []
  ) {
    const config: AgentBaseConfig = {
      agentId: id,
      name: `${id.charAt(0).toUpperCase()}${id.slice(1)}`,
      description: `Specialized agent for ${roles.join(', ')}`,
      capabilities: {
        skills: capabilities,
        domains: domains,
        roles: roles
      },
      quota: 3
    };
    
    super({ config });
  }
  
  // Override planAndExecute to provide implementation
  async planAndExecute(goal: string, options?: any): Promise<any> {
    console.log(`[${this.agentId}] Executing goal: ${goal}`);
    
    // Implementation would be here
    return {
      success: true,
      message: `${this.agentId} completed: ${goal}`
    };
  }
}

/**
 * Demo function to run a capability-based agent system
 */
export async function runCapabilityDemo() {
  console.log('Starting capability system demo...');
  
  // 1. Initialize the capability registry with predefined capabilities
  const registry = CapabilityRegistry.getInstance();
  registerPredefinedCapabilities(registry);
  
  // 2. Create an agent coordinator with capability matching enabled
  const coordinator = new AgentCoordinator({
    enableCapabilityMatching: true,
    enableLoadBalancing: true
  });
  
  await coordinator.initialize();
  
  // 3. Create specialized agents with different capabilities
  
  // Research agent with research and text analysis capabilities
  const researchAgent = new SpecializedAgent(
    'researchAgent',
    {
      'skill.research': CapabilityLevel.EXPERT,
      'skill.text_analysis': CapabilityLevel.ADVANCED,
      'skill.data_analysis': CapabilityLevel.INTERMEDIATE
    },
    ['domain.general', 'domain.science'],
    ['role.researcher']
  );
  
  // Developer agent with code-related capabilities
  const developerAgent = new SpecializedAgent(
    'developerAgent',
    {
      'skill.code_generation': CapabilityLevel.EXPERT,
      'skill.code_review': CapabilityLevel.ADVANCED,
      'skill.planning': CapabilityLevel.INTERMEDIATE
    },
    ['domain.software'],
    ['role.developer']
  );
  
  // Coordinator agent with coordination capabilities
  const coordinatorAgent = new SpecializedAgent(
    'coordinatorAgent',
    {
      'skill.coordination': CapabilityLevel.EXPERT,
      'skill.decision_making': CapabilityLevel.ADVANCED,
      'skill.planning': CapabilityLevel.ADVANCED
    },
    ['domain.general', 'domain.business'],
    ['role.coordinator', 'role.planner']
  );
  
  // Creative agent with creative capabilities
  const creativeAgent = new SpecializedAgent(
    'creativeAgent',
    {
      'skill.creativity': CapabilityLevel.EXPERT,
      'skill.text_analysis': CapabilityLevel.INTERMEDIATE
    },
    ['domain.general'],
    ['role.creative']
  );
  
  // 4. Initialize all agents
  await researchAgent.initialize();
  await developerAgent.initialize();
  await coordinatorAgent.initialize();
  await creativeAgent.initialize();
  
  // 5. Register agents with the coordinator
  coordinator.registerAgent(
    researchAgent, 
    ['research', 'information_retrieval', 'data_analysis'], 
    'research'
  );
  
  coordinator.registerAgent(
    developerAgent, 
    ['code_generation', 'code_review', 'debugging'], 
    'development'
  );
  
  coordinator.registerAgent(
    coordinatorAgent, 
    ['coordination', 'planning', 'delegation'], 
    'management'
  );
  
  coordinator.registerAgent(
    creativeAgent, 
    ['creative_writing', 'idea_generation', 'content_creation'], 
    'content'
  );
  
  // 6. Demo capability-based delegation
  
  // Example 1: Delegate a research task
  console.log('\n=== Example 1: Research Task ===');
  const researchResult = await coordinator.delegateTask({
    taskId: 'task-research-1',
    goal: 'Research the impact of AI on healthcare',
    requiredCapabilities: ['skill.research'],
    preferredDomain: 'domain.healthcare',
    requestingAgentId: 'user'
  });
  
  console.log(`Task delegated to: ${researchResult.assignedAgentId}`);
  console.log(`Task status: ${researchResult.status}`);
  
  // Example 2: Delegate a code generation task
  console.log('\n=== Example 2: Code Generation Task ===');
  const codeResult = await coordinator.delegateTask({
    taskId: 'task-code-1',
    goal: 'Generate a React component for a login form',
    requiredCapabilities: ['skill.code_generation'],
    requiredCapabilityLevels: {
      'skill.code_generation': CapabilityLevel.EXPERT
    },
    preferredDomain: 'domain.software',
    requestingAgentId: 'user'
  });
  
  console.log(`Task delegated to: ${codeResult.assignedAgentId}`);
  console.log(`Task status: ${codeResult.status}`);
  
  // Example 3: Delegate a task with multiple capability requirements
  console.log('\n=== Example 3: Multi-capability Task ===');
  const complexResult = await coordinator.delegateTask({
    taskId: 'task-complex-1',
    goal: 'Analyze user feedback data and create a report',
    requiredCapabilities: ['skill.data_analysis', 'skill.text_analysis'],
    preferredCapabilities: ['skill.research'],
    requestingAgentId: 'user'
  });
  
  console.log(`Task delegated to: ${complexResult.assignedAgentId}`);
  console.log(`Task status: ${complexResult.status}`);
  
  // Example 4: Delegate to unavailable agent (should find fallback)
  console.log('\n=== Example 4: Fallback Routing ===');
  
  // Manually mark the research agent as busy
  const researchEntry = (coordinator as any).agents.get('researchAgent');
  if (researchEntry) {
    researchEntry.status = 'busy';
  }
  
  const fallbackResult = await coordinator.delegateTask({
    taskId: 'task-fallback-1',
    goal: 'Analyze recent scientific papers on climate change',
    requiredCapabilities: ['skill.research', 'skill.text_analysis'],
    requestingAgentId: 'user'
  });
  
  console.log(`Task delegated to: ${fallbackResult.assignedAgentId}`);
  console.log(`Task status: ${fallbackResult.status}`);
  
  // 7. Demo capability discovery
  
  console.log('\n=== Capability Discovery ===');
  
  // Find agents with research capability
  const researchAgents = coordinator.getAgentsWithCapability('skill.research');
  console.log(`Agents with research capability: ${researchAgents.join(', ')}`);
  
  // Get all registered capabilities
  const allCapabilities = coordinator.getAllCapabilities();
  console.log(`Total registered capabilities: ${allCapabilities.length}`);
  
  // Get capabilities for an agent
  const developerCapabilities = coordinator.getAgentCapabilities('developerAgent');
  console.log(`Developer agent capabilities: ${Object.keys(developerCapabilities).join(', ')}`);
  
  // 8. Clean up
  await researchAgent.shutdown();
  await developerAgent.shutdown();
  await coordinatorAgent.shutdown();
  await creativeAgent.shutdown();
  await coordinator.shutdown();
  
  console.log('\nCapability system demo completed');
}

// Run the demo if executed directly
if (require.main === module) {
  runCapabilityDemo().catch(console.error);
} 