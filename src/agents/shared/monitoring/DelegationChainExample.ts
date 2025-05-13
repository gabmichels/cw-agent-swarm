/**
 * DelegationChainExample.ts - Example of delegation chain tracking
 * 
 * This file demonstrates how delegation chains are tracked and visualized
 * across multiple agents using common delegationContextId and parentTaskId.
 */

import { AgentMonitor } from './AgentMonitor';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

/**
 * Run an example showing delegation chains
 */
async function runDelegationChainExample() {
  console.log('Starting delegation chain tracking example...');
  
  // Clear any existing logs
  AgentMonitor.clear();
  
  // Create a delegation chain: Coordinator -> Researcher -> FactChecker
  const delegationContextId = `delegation_${crypto.randomUUID()}`;
  
  // Step 1: Coordinator creates a task
  const coordinatorTaskId = `task_coordinator_${Date.now()}`;
  AgentMonitor.log({
    agentId: 'coordinator',
    taskId: coordinatorTaskId,
    eventType: 'task_start',
    timestamp: Date.now(),
    delegationContextId,
    metadata: {
      goal: 'Research quantum computing advances in 2023'
    }
  });
  
  // Wait for 100ms to simulate time passing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Step 2: Coordinator delegates to Researcher
  const researcherTaskId = `task_researcher_${Date.now()}`;
  AgentMonitor.log({
    agentId: 'coordinator',
    taskId: coordinatorTaskId,
    eventType: 'delegation',
    timestamp: Date.now(),
    delegationContextId,
    metadata: {
      toAgent: 'researcher',
      subtask: 'Find top 3 quantum computing breakthroughs in 2023'
    }
  });
  
  // Step 3: Researcher starts its task
  AgentMonitor.log({
    agentId: 'researcher',
    taskId: researcherTaskId,
    parentTaskId: coordinatorTaskId,
    eventType: 'task_start',
    timestamp: Date.now(),
    delegationContextId,
    metadata: {
      goal: 'Find top 3 quantum computing breakthroughs in 2023'
    }
  });
  
  // Wait for 100ms to simulate time passing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Step 4: Researcher delegates to FactChecker
  const factCheckerTaskId = `task_factchecker_${Date.now()}`;
  AgentMonitor.log({
    agentId: 'researcher',
    taskId: researcherTaskId,
    eventType: 'delegation',
    timestamp: Date.now(),
    delegationContextId,
    metadata: {
      toAgent: 'factchecker',
      subtask: 'Verify IBM quantum computing breakthrough claims'
    }
  });
  
  // Step 5: FactChecker starts its task
  AgentMonitor.log({
    agentId: 'factchecker',
    taskId: factCheckerTaskId,
    parentTaskId: researcherTaskId,
    eventType: 'task_start',
    timestamp: Date.now(),
    delegationContextId,
    metadata: {
      goal: 'Verify IBM quantum computing breakthrough claims'
    }
  });
  
  // Wait for 100ms to simulate time passing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Step 6: FactChecker completes its task
  AgentMonitor.log({
    agentId: 'factchecker',
    taskId: factCheckerTaskId,
    parentTaskId: researcherTaskId,
    eventType: 'task_end',
    status: 'success',
    timestamp: Date.now(),
    durationMs: 100,
    delegationContextId,
    metadata: {
      result: 'IBM claims verified: 127-qubit Eagle processor confirmed'
    }
  });
  
  // Step 7: Researcher uses the results and completes its task
  AgentMonitor.log({
    agentId: 'researcher',
    taskId: researcherTaskId,
    parentTaskId: coordinatorTaskId,
    eventType: 'task_end',
    status: 'success',
    timestamp: Date.now(),
    durationMs: 200,
    delegationContextId,
    metadata: {
      result: 'Top 3 breakthroughs: IBM Eagle processor, Google error correction, QuEra neutral atom'
    }
  });
  
  // Step 8: Coordinator completes the original task
  AgentMonitor.log({
    agentId: 'coordinator',
    taskId: coordinatorTaskId,
    eventType: 'task_end',
    status: 'success',
    timestamp: Date.now(),
    durationMs: 300,
    delegationContextId,
    metadata: {
      result: 'Comprehensive report on quantum computing advances completed'
    }
  });
  
  // Retrieve the delegation chain
  const delegationChain = AgentMonitor.getDelegationChain({ delegationContextId });
  console.log('Delegation Chain:');
  console.log(JSON.stringify(delegationChain, null, 2));
  
  // Generate Mermaid flowchart
  const flowchart = AgentMonitor.generateDelegationFlowchart({ delegationContextId });
  console.log('\nMermaid Flowchart:');
  console.log(flowchart);
  
  // Write flowchart to file
  await fs.writeFile('./delegation_flowchart.md', `# Delegation Flowchart\n\n\`\`\`mermaid\n${flowchart}\n\`\`\``, 'utf8');
  console.log('\nFlowchart written to delegation_flowchart.md');
  
  console.log('\nDelegation chain example completed');
}

// Run the example if this file is executed directly
if (require.main === module) {
  runDelegationChainExample().catch(console.error);
}

export { runDelegationChainExample }; 