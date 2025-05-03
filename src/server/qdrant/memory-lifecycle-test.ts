/**
 * Test script for memory lifecycle management: usage tracking, reinforcement, and decay
 * 
 * This script demonstrates how memories evolve over time through:
 * 1. Initial storage with basic importance
 * 2. Usage tracking (increasing usage count)
 * 3. Explicit reinforcement (increasing importance)
 * 4. Decay for unused memories (decreasing importance)
 * 5. Protection of critical memories from decay
 */

import { 
  initMemory, 
  storeMemory, 
  searchMemory, 
  resetAllCollections 
} from './index';
import { 
  markMemoryAsUsed, 
  reinforceMemoryImportance,
  markMemoryCritical,
  runMemoryDecay
} from './memory-utils';

async function main() {
  console.log("Starting memory lifecycle test...");
  
  // Initialize memory system
  await initMemory();
  
  // Reset collections to start fresh
  await resetAllCollections();
  
  // Create test documents with different importance
  const testDocs = [
    {
      content: "Document A: This is important information that should be retained.",
      type: "document",
      source: "test",
      importance_score: 0.7
    },
    {
      content: "Document B: This is standard information with average importance.",
      type: "document",
      source: "test",
      importance_score: 0.5
    },
    {
      content: "Document C: This is less important information that could decay if unused.",
      type: "document",
      source: "test",
      importance_score: 0.3
    }
  ];
  
  console.log("Storing test documents...");
  const docIds: string[] = [];
  
  // Store the test documents
  for (const doc of testDocs) {
    const id = await storeMemory(
      doc.content,
      doc.type,
      doc.source,
      {},
      { importance_score: doc.importance_score }
    );
    docIds.push(id);
    console.log(`Stored document with ID: ${id} (importance: ${doc.importance_score})`);
  }
  
  // Wait for documents to be indexed
  console.log("Waiting for documents to be indexed...");
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Print initial memory states
  console.log("\n----- Initial Memory States -----");
  for (const id of docIds) {
    const memories = await searchMemory(null, '', { filter: { id }, limit: 1 });
    if (memories.length > 0) {
      const memory = memories[0];
      console.log(`Memory ${id}: ${memory.text.substring(0, 30)}...`);
      console.log(`  Importance: ${memory.metadata.importance_score}`);
      console.log(`  Usage count: ${memory.metadata.usage_count || 0}`);
      console.log(`  Critical: ${memory.metadata.critical || false}`);
    }
  }
  
  // Simulate usage tracking for document A and B
  console.log("\n----- Simulating Usage -----");
  console.log("Using document A twice");
  await markMemoryAsUsed(docIds[0], "First use");
  await markMemoryAsUsed(docIds[0], "Second use");
  
  console.log("Using document B once");
  await markMemoryAsUsed(docIds[1], "First use");
  
  // Document C is not used at all
  
  // Reinforce document A (explicitly mark as helpful)
  console.log("\n----- Simulating Reinforcement -----");
  console.log("Reinforcing document A as being helpful");
  await reinforceMemoryImportance(docIds[0], "user_feedback_helpful");
  
  // Mark document C as critical (to protect from decay)
  console.log("Marking document C as critical despite low importance");
  await markMemoryCritical(docIds[2], true);
  
  // Print memory states after usage and reinforcement
  console.log("\n----- Memory States After Usage & Reinforcement -----");
  for (const id of docIds) {
    const memories = await searchMemory(null, '', { filter: { id }, limit: 1 });
    if (memories.length > 0) {
      const memory = memories[0];
      console.log(`Memory ${id}: ${memory.text.substring(0, 30)}...`);
      console.log(`  Importance: ${memory.metadata.importance_score}`);
      console.log(`  Usage count: ${memory.metadata.usage_count || 0}`);
      console.log(`  Last used: ${memory.metadata.last_used || 'never'}`);
      console.log(`  Reinforced: ${memory.metadata.reinforced || 0} times`);
      console.log(`  Critical: ${memory.metadata.critical || false}`);
    }
  }
  
  // Run decay process
  console.log("\n----- Simulating Memory Decay -----");
  console.log("Running decay process with 5% reduction for unused memories");
  
  // For testing purposes, we'll consider "unused" to be any memory that hasn't been
  // explicitly marked as used in this test run - normally this would be a week or more
  const decayStats = await runMemoryDecay({
    decayPercent: 5,
    olderThan: 0, // For testing, consider all memories without usage as "old"
  });
  
  console.log(`Decay complete. Results: Processed ${decayStats.processed}, Decayed ${decayStats.decayed}, Exempted ${decayStats.exempted}`);
  
  // Print final memory states after decay
  console.log("\n----- Final Memory States After Decay -----");
  for (const id of docIds) {
    const memories = await searchMemory(null, '', { filter: { id }, limit: 1 });
    if (memories.length > 0) {
      const memory = memories[0];
      console.log(`Memory ${id}: ${memory.text.substring(0, 30)}...`);
      console.log(`  Importance: ${memory.metadata.importance_score}`);
      console.log(`  Usage count: ${memory.metadata.usage_count || 0}`);
      console.log(`  Critical: ${memory.metadata.critical || false}`);
      console.log(`  Last decayed: ${memory.metadata.last_decayed_at || 'never'}`);
    }
  }
  
  console.log("\nMemory lifecycle test completed!");
}

// Run the test
main().catch(error => {
  console.error("Error running memory lifecycle test:", error);
}); 