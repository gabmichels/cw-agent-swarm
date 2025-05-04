/**
 * Memory Context Injection Test
 * 
 * This file demonstrates how memory context is injected into the planning process
 * to create more informed plans based on agent memories.
 */

import { getMemoryServices } from '../server/memory/services';
import { MemoryType } from '../server/memory/config';
import { Planner, PlanningContext, Plan } from './shared/planning/Planner';
import { MemoryPoint, BaseMemorySchema } from '../server/memory/models';

/**
 * Test and demonstrate memory context injection during planning
 */
async function testMemoryInjection() {
  console.log('Starting memory context injection test...');
  
  const agentId = 'chloe';
  
  // Get memory services
  const { memoryService, searchService } = await getMemoryServices();
  
  // Create memories that will be relevant to our planning task
  console.log('\n--- Creating test memories for planning context ---');
  
  // Add memories with various types and metadata
  
  // Add thought with insight
  await memoryService.addMemory({
    type: MemoryType.THOUGHT,
    content: 'When analyzing user data, privacy and security concerns should be prioritized',
    metadata: {
      agentId,
      category: 'insight',
      timestamp: Date.now() - (7 * 24 * 60 * 60 * 1000), // 7 days ago
      relevance: 0.9,
      tags: ['data-analysis', 'privacy', 'best-practice']
    }
  });
  
  // Add fact as a document
  await memoryService.addMemory({
    type: MemoryType.DOCUMENT,
    content: 'Previously implemented data processing pipeline required 4 steps: collection, cleaning, analysis, visualization',
    metadata: {
      agentId,
      category: 'fact',
      timestamp: Date.now() - (5 * 24 * 60 * 60 * 1000), // 5 days ago
      relevance: 0.8,
      tags: ['data-analysis', 'pipeline', 'process']
    }
  });
  
  // Add a decision as a thought
  await memoryService.addMemory({
    type: MemoryType.THOUGHT,
    content: 'Using Python with pandas for data analysis provides the best balance of speed and readability',
    metadata: {
      agentId,
      category: 'decision',
      timestamp: Date.now() - (3 * 24 * 60 * 60 * 1000), // 3 days ago
      relevance: 0.9,
      tags: ['data-analysis', 'tools', 'python', 'pandas']
    }
  });
  
  // Add a user feedback as a message
  await memoryService.addMemory({
    type: MemoryType.MESSAGE,
    content: 'User recently mentioned issues with outliers in their data set',
    metadata: {
      agentId,
      category: 'feedback',
      timestamp: Date.now() - (1 * 24 * 60 * 60 * 1000), // 1 day ago
      relevance: 0.7,
      tags: ['data-analysis', 'outliers', 'user-feedback']
    }
  });
  
  // Add a task that is unrelated
  await memoryService.addMemory({
    type: MemoryType.TASK,
    content: 'Remember to check system logs for errors',
    metadata: {
      agentId,
      category: 'task',
      timestamp: Date.now() - (1 * 60 * 60 * 1000), // 1 hour ago
      relevance: 0.5,
      tags: ['system', 'logs', 'maintenance']
    }
  });
  
  // Create a planning task with a goal that should match some of our memories
  const goalWithRelevantMemories = 'Create a data analysis plan for processing user survey data';
  const tagsWithRelevantMemories = ['data-analysis', 'user-data'];
  
  // Create a planning task with a goal that shouldn't match our memories
  const goalWithoutRelevantMemories = 'Schedule a meeting for next week';
  const tagsWithoutRelevantMemories = ['scheduling', 'meeting'];
  
  // Test 1: Planning with relevant memories
  console.log('\n--- Test 1: Planning with relevant memories ---');
  console.log(`Goal: ${goalWithRelevantMemories}`);
  console.log(`Tags: ${tagsWithRelevantMemories.join(', ')}`);
  
  // Get relevant memories for this goal
  const relevantMemories = await searchService.search(goalWithRelevantMemories, {
    types: [MemoryType.THOUGHT, MemoryType.DOCUMENT, MemoryType.MESSAGE, MemoryType.TASK],
    limit: 10,
    filter: {
      tags: tagsWithRelevantMemories,
      metadata: {
        agentId
      }
    }
  });
  
  console.log(`\nFound ${relevantMemories.length} relevant memories:`);
  relevantMemories.forEach(memory => {
    console.log(`[${memory.point.payload.type}] ${memory.point.payload.text.substring(0, 50)}...`);
  });
  
  // Convert search results to memory points for the planner
  const memoryPoints = relevantMemories.map(result => result.point);
  
  // Format memories for prompt
  const formattedMemories = Planner.formatMemoriesForPrompt(memoryPoints);
  console.log('\nFormatted memories for prompt:');
  console.log(formattedMemories);
  
  // Create planning context and generate plan
  const planningContext1: PlanningContext = {
    goal: goalWithRelevantMemories,
    tags: tagsWithRelevantMemories,
    agentId,
    memoryContext: memoryPoints
  };
  
  const plan1 = await Planner.plan(planningContext1);
  
  console.log('\nGenerated plan with memory context:');
  console.log(`Title: ${plan1.title}`);
  console.log(`Steps: ${plan1.steps.length}`);
  console.log('Steps:');
  plan1.steps.forEach((step, index) => {
    console.log(`${index + 1}. ${step.description}`);
  });
  console.log(`Reasoning: ${plan1.reasoning}`);
  
  // Test 2: Planning without relevant memories
  console.log('\n--- Test 2: Planning without relevant memories ---');
  console.log(`Goal: ${goalWithoutRelevantMemories}`);
  console.log(`Tags: ${tagsWithoutRelevantMemories.join(', ')}`);
  
  // Get relevant memories for this goal (should be few or none)
  const irrelevantMemories = await searchService.search(goalWithoutRelevantMemories, {
    types: [MemoryType.THOUGHT, MemoryType.DOCUMENT, MemoryType.MESSAGE, MemoryType.TASK],
    limit: 10,
    filter: {
      tags: tagsWithoutRelevantMemories,
      metadata: {
        agentId
      }
    }
  });
  
  console.log(`\nFound ${irrelevantMemories.length} relevant memories:`);
  irrelevantMemories.forEach(memory => {
    console.log(`[${memory.point.payload.type}] ${memory.point.payload.text}`);
  });
  
  // Convert search results to memory points for the planner
  const irrelevantMemoryPoints = irrelevantMemories.map(result => result.point);
  
  // Create planning context and generate plan
  const planningContext2: PlanningContext = {
    goal: goalWithoutRelevantMemories,
    tags: tagsWithoutRelevantMemories,
    agentId,
    memoryContext: irrelevantMemoryPoints
  };
  
  const plan2 = await Planner.plan(planningContext2);
  
  console.log('\nGenerated plan without memory context:');
  console.log(`Title: ${plan2.title}`);
  console.log(`Steps: ${plan2.steps.length}`);
  console.log('Steps:');
  plan2.steps.forEach((step, index) => {
    console.log(`${index + 1}. ${step.description}`);
  });
  console.log(`Reasoning: ${plan2.reasoning}`);
  
  // Test 3: Compare plans with and without memory injection
  console.log('\n--- Test 3: Compare plans with and without memory injection ---');
  
  // Create the same plan but without memory context
  const planningContextWithoutMemory: PlanningContext = {
    goal: goalWithRelevantMemories,
    tags: tagsWithRelevantMemories,
    agentId,
    memoryContext: [] // Empty context
  };
  
  const planWithoutMemory = await Planner.plan(planningContextWithoutMemory);
  
  console.log('\nDifference in plans:');
  console.log('With memory context:');
  console.log(`- Steps: ${plan1.steps.length}`);
  console.log(`- Total time estimate: ${plan1.estimatedTotalTimeMinutes} minutes`);
  console.log(`- Reasoning: ${plan1.reasoning.substring(0, 100)}...`);
  
  console.log('\nWithout memory context:');
  console.log(`- Steps: ${planWithoutMemory.steps.length}`);
  console.log(`- Total time estimate: ${planWithoutMemory.estimatedTotalTimeMinutes} minutes`);
  console.log(`- Reasoning: ${planWithoutMemory.reasoning.substring(0, 100)}...`);
  
  // Complete test
  console.log('\n--- Memory context injection test complete ---');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testMemoryInjection().catch(console.error);
}

export { testMemoryInjection }; 