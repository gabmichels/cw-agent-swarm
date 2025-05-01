/**
 * Memory System Test
 * 
 * This file demonstrates the usage of the new tiered memory system with pruning.
 */

import { AgentMemory } from '../lib/memory';
import { MemoryPruner } from '../lib/memory/src/MemoryPruner';

/**
 * Test and demonstrate the new memory system
 */
async function testMemorySystem() {
  console.log('Starting memory system test...');
  
  // Create agent memory instances
  const chloeMemory = new AgentMemory({ namespace: 'chloe' });
  const helperMemory = new AgentMemory({ namespace: 'helper' });
  
  await chloeMemory.initialize();
  await helperMemory.initialize();
  
  console.log('\n--- Writing memories with different scopes ---');
  
  // Add memories for Chloe with different scopes
  await chloeMemory.write({
    content: 'This is a short-term memory that will expire soon',
    scope: 'shortTerm',
    timestamp: Date.now(),
    relevance: 0.3,
    expiresAt: Date.now() + (5 * 60 * 1000), // expires in 5 minutes
    tags: ['test', 'short-term']
  });
  
  await chloeMemory.write({
    content: 'This is a long-term strategy insight',
    scope: 'longTerm',
    timestamp: Date.now(),
    relevance: 0.9,
    tags: ['strategy', 'insight', 'important']
  });
  
  await chloeMemory.write({
    content: 'Helper agent sent a status update',
    scope: 'inbox',
    timestamp: Date.now(),
    relevance: 0.6,
    sourceAgent: 'helper',
    tags: ['update', 'helper']
  });
  
  await chloeMemory.write({
    content: 'I observed that delegating this task type is inefficient',
    scope: 'reflections',
    timestamp: Date.now(),
    relevance: 0.8,
    tags: ['delegation', 'observation']
  });
  
  // Add some helper memories
  await helperMemory.write({
    content: 'Completed analysis of user request',
    scope: 'shortTerm',
    timestamp: Date.now(),
    relevance: 0.5,
    tags: ['analysis', 'user-request']
  });
  
  // Show all memories
  console.log('\n--- Chloe All Memories ---');
  const chloeMemories = chloeMemory.getAll('chloe');
  chloeMemories.forEach(m => console.log(`[${m.scope}] ${m.content} (relevance: ${m.relevance})`));
  
  console.log('\n--- Helper All Memories ---');
  const helperMemories = helperMemory.getAll('helper');
  helperMemories.forEach(m => console.log(`[${m.scope}] ${m.content} (relevance: ${m.relevance})`));
  
  // Query by scope
  console.log('\n--- Chloe Long-Term Memories ---');
  const chloeLongTerm = chloeMemory.getByScope('chloe', 'longTerm');
  chloeLongTerm.forEach(m => console.log(`${m.content} (relevance: ${m.relevance})`));
  
  // Query by relevance
  console.log('\n--- Chloe High Relevance Memories ---');
  const chloeHighRelevance = chloeMemory.getRelevant('chloe', { minRelevance: 0.7 });
  chloeHighRelevance.forEach(m => console.log(`[${m.scope}] ${m.content} (relevance: ${m.relevance})`));
  
  // Demonstrate semantic search (if available)
  console.log('\n--- Semantic Search ---');
  try {
    const searchResults = await chloeMemory.searchMemory('delegation efficiency', { limit: 2 });
    searchResults.forEach(m => console.log(`[${m.scope}] ${m.content} (relevance: ${m.relevance})`));
  } catch (error) {
    console.log('Semantic search not available in test environment');
  }
  
  // Test pruning
  console.log('\n--- Testing Memory Pruning ---');
  console.log('Before pruning:', chloeMemories.length, 'memories');
  
  // Mark some memories as expired
  const expiredMemory = chloeMemories[0];
  expiredMemory.expiresAt = Date.now() - 1000; // already expired
  chloeMemory.replaceAll('chloe', chloeMemories);
  
  // Add a low relevance memory
  await chloeMemory.write({
    content: 'This is low relevance memory that should be pruned',
    scope: 'shortTerm',
    timestamp: Date.now(),
    relevance: 0.1, // Below threshold
    tags: ['test', 'low-relevance']
  });
  
  // Prune memories
  const pruneResult = await MemoryPruner.prune('chloe', {
    relevanceThreshold: 0.2,
    currentTime: Date.now()
  });
  
  console.log(`Pruned ${pruneResult.pruned} memories, ${pruneResult.retained} remaining`);
  
  // Verify pruning worked
  const afterPruning = chloeMemory.getAll('chloe');
  console.log('After pruning:', afterPruning.length, 'memories');
  
  console.log('\n--- Memory system test complete ---');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testMemorySystem().catch(console.error);
}

export { testMemorySystem }; 