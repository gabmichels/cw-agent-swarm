/**
 * Test script for memory usage tracking and scoring adjustment
 * 
 * This script demonstrates how the memory system tracks usage counts
 * and adjusts scores based on how frequently a memory is used.
 */

import { 
  initMemory, 
  storeMemory, 
  searchMemory, 
  resetAllCollections 
} from './index';
import { markMemoryAsUsed } from './memory-utils';

async function main() {
  console.log("Starting memory usage tracking test...");
  
  // Initialize memory system
  await initMemory();
  
  // Reset collections to start fresh
  await resetAllCollections();
  
  // Create test documents
  const testDocs = [
    {
      content: "JavaScript is a programming language commonly used for web development.",
      type: "document",
      source: "test"
    },
    {
      content: "Python is a versatile programming language used for data science and AI.",
      type: "document",
      source: "test"
    },
    {
      content: "TypeScript is a statically typed superset of JavaScript.",
      type: "document",
      source: "test"
    }
  ];
  
  console.log("Storing test documents...");
  const docIds: string[] = [];
  
  // Store the test documents and collect their IDs
  for (const doc of testDocs) {
    const id = await storeMemory(
      doc.content,
      doc.type,
      doc.source
    );
    docIds.push(id);
    console.log(`Stored document with ID: ${id}`);
  }
  
  // Wait for documents to be indexed
  console.log("Waiting for documents to be indexed...");
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log("\n----- Initial Search -----");
  // Search for programming languages
  let results = await searchMemory('document', "programming language", { limit: 3 });
  
  // Print initial results
  console.log("\nInitial search results (before any usage):");
  results.forEach((result, index) => {
    console.log(`${index + 1}. [ID: ${result.id}] "${result.text}" (Score: ${result.metadata._scoringDetails.adjustedScore.toFixed(3)})`);
  });
  
  // Simulate using the second document multiple times
  console.log("\n----- Simulating Usage -----");
  console.log("Marking document 2 (Python) as used 5 times");
  
  for (let i = 0; i < 5; i++) {
    await markMemoryAsUsed(results[1].id, `Simulation ${i+1}`);
  }
  
  console.log("Marking document 1 (JavaScript) as used 2 times");
  await markMemoryAsUsed(results[0].id, "Simulation 1");
  await markMemoryAsUsed(results[0].id, "Simulation 2");
  
  // Wait a moment for the updates to be processed
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log("\n----- Search After Usage -----");
  // Search for programming languages again
  results = await searchMemory('document', "programming language", { limit: 3 });
  
  // Print results after usage tracking
  console.log("\nSearch results after usage tracking:");
  results.forEach((result, index) => {
    const details = result.metadata._scoringDetails;
    console.log(
      `${index + 1}. [ID: ${result.id}] "${result.text}"\n` +
      `   Hybrid score: ${details.hybridScore.toFixed(3)}, ` +
      `Usage count: ${details.usageCount}, ` + 
      `Boost: ${(details.adjustedScore / details.hybridScore).toFixed(2)}x, ` +
      `Final score: ${details.adjustedScore.toFixed(3)}`
    );
  });
  
  console.log("\nMemory usage tracking test completed!");
}

// Run the test
main().catch(error => {
  console.error("Error running memory usage test:", error);
}); 