/**
 * Memory Consolidation Test
 * 
 * This file demonstrates the usage of the memory consolidation feature
 * with structured memory types and memory schemas.
 */

import { AgentMemory } from '../lib/memory';
import { MemoryConsolidator } from '../lib/memory/src/MemoryConsolidator';
import { MemoryScope, MemoryKind } from '../lib/memory/src/memory';

/**
 * Test and demonstrate the memory consolidation system
 */
async function testMemoryConsolidation() {
  console.log('Starting memory consolidation test...');
  
  const agentId = 'chloe';
  
  // Create agent memory instance
  const memory = new AgentMemory({ namespace: agentId });
  await memory.initialize();
  
  // Create a set of short-term memories for testing
  console.log('\n--- Creating test short-term memories ---');
  
  // Task context for related memories
  const taskContextId = `task_${Date.now()}`;
  
  // Create 5 related short-term memories with different kinds
  await memory.write({
    agentId,
    content: 'User requested to create a summary of last week\'s customer feedback',
    scope: 'shortTerm' as MemoryScope,
    kind: 'task' as MemoryKind,
    timestamp: Date.now() - 5000,
    relevance: 0.8,
    contextId: taskContextId,
    tags: ['task', 'user-request']
  });
  
  await memory.write({
    agentId,
    content: 'Retrieved 24 customer feedback entries from database',
    scope: 'shortTerm' as MemoryScope,
    kind: 'fact' as MemoryKind,
    timestamp: Date.now() - 4000,
    relevance: 0.7,
    contextId: taskContextId,
    tags: ['data-retrieval', 'customer-feedback']
  });
  
  await memory.write({
    agentId,
    content: 'Most customers mentioned UI improvements as a priority',
    scope: 'shortTerm' as MemoryScope,
    kind: 'insight' as MemoryKind,
    timestamp: Date.now() - 3000,
    relevance: 0.9,
    contextId: taskContextId,
    tags: ['analysis', 'customer-feedback', 'ui']
  });
  
  await memory.write({
    agentId,
    content: 'Decided to organize feedback by category: UI, performance, features',
    scope: 'shortTerm' as MemoryScope,
    kind: 'decision' as MemoryKind,
    timestamp: Date.now() - 2000,
    relevance: 0.8,
    contextId: taskContextId,
    tags: ['decision', 'organization', 'categories']
  });
  
  await memory.write({
    agentId,
    content: 'Created a structured report with top 3 issues in each category',
    scope: 'shortTerm' as MemoryScope,
    kind: 'message' as MemoryKind,
    timestamp: Date.now() - 1000,
    relevance: 0.9,
    contextId: taskContextId,
    tags: ['output', 'report', 'complete']
  });
  
  // Also create some unrelated memories
  await memory.write({
    agentId,
    content: 'This is an unrelated memory about the weather',
    scope: 'shortTerm' as MemoryScope,
    kind: 'fact' as MemoryKind,
    timestamp: Date.now(),
    relevance: 0.3,
    tags: ['weather', 'irrelevant']
  });
  
  // Show all short-term memories
  console.log('\n--- All Short-Term Memories ---');
  const shortTermMemories = memory.getByScope(agentId, 'shortTerm');
  shortTermMemories.forEach(m => console.log(`[${m.kind}] ${m.content.substring(0, 50)}... (relevance: ${m.relevance})`));
  
  // Consolidate memories from our task context
  console.log('\n--- Consolidating Memories by Context ---');
  const consolidatedEntry = await MemoryConsolidator.consolidateByContext(
    agentId,
    taskContextId,
    {
      targetScope: 'reflections',
      defaultKind: 'insight'
    }
  );
  
  if (consolidatedEntry) {
    console.log(`\nCreated consolidated memory in '${consolidatedEntry.scope}' scope:`);
    console.log(`ID: ${consolidatedEntry.id}`);
    console.log(`Content: ${consolidatedEntry.content}`);
    console.log(`Kind: ${consolidatedEntry.kind}`);
    console.log(`Tags: ${consolidatedEntry.tags?.join(', ')}`);
    console.log(`Based on ${consolidatedEntry.summaryOf?.length} source memories`);
  } else {
    console.log('Consolidation did not produce a result.');
  }
  
  // Check reflections memory to see the consolidated entry
  console.log('\n--- Reflections After Consolidation ---');
  const reflections = memory.getByScope(agentId, 'reflections');
  reflections.forEach(m => console.log(`[${m.kind}] ${m.content}`));
  
  // Try consolidating by tags
  console.log('\n--- Consolidating Memories by Tags ---');
  
  // Add some memories with specific tags
  for (let i = 0; i < 3; i++) {
    await memory.write({
      agentId,
      content: `UI feedback item #${i+1}: ${['Buttons too small', 'Color scheme confusing', 'Navigation complex'][i]}`,
      scope: 'shortTerm' as MemoryScope,
      kind: 'feedback' as MemoryKind,
      timestamp: Date.now() - (1000 * i),
      relevance: 0.7,
      tags: ['feedback', 'ui-feedback']
    });
  }
  
  // Consolidate by tags
  const tagConsolidated = await MemoryConsolidator.consolidateByTags(
    agentId,
    ['ui-feedback'],
    {
      targetScope: 'longTerm',
      defaultKind: 'insight',
      additionalTags: ['ui-insights']
    }
  );
  
  if (tagConsolidated) {
    console.log(`\nCreated tag-based consolidated memory in '${tagConsolidated.scope}' scope:`);
    console.log(`Content: ${tagConsolidated.content}`);
    console.log(`Tags: ${tagConsolidated.tags?.join(', ')}`);
  }
  
  // Demonstrate memory kind filtering
  console.log('\n--- Filter Memories by Kind ---');
  const insights = memory.getByKind(agentId, 'insight');
  console.log(`Found ${insights.length} insight memories:`);
  insights.forEach(m => console.log(`[${m.scope}] ${m.content}`));
  
  // Complete test
  console.log('\n--- Memory consolidation test complete ---');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testMemoryConsolidation().catch(console.error);
}

export { testMemoryConsolidation }; 