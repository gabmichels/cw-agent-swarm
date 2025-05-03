/**
 * Memory Graph Demonstration
 * 
 * This file demonstrates how the Memory Graph system enhances memory retrieval:
 * 1. Creates a set of related memories
 * 2. Connects them in the memory graph
 * 3. Shows how graph-based boosting improves search results
 * 4. Demonstrates discovering knowledge clusters
 */

import { initMemory, resetAllCollections } from '../../server/qdrant';
import { storeMemoryWithGraph, buildMemoryGraph } from './memory-graph-integration';
import { applyHybridScoring, getMemoriesForPromptInjection } from './MemoryUtils';
import { getMemoryGraph } from './MemoryUtils';
import { ImportanceLevel } from '../../constants/memory';

// Sample knowledge to store in memory - interconnected concepts
const sampleMemories = [
  // Marketing concepts
  {
    content: "Our Q1 marketing strategy focuses on personalized email campaigns and retargeting ads to increase engagement with existing customers.",
    tags: ["marketing", "strategy", "Q1", "email", "retargeting", "engagement"],
    importance: 0.8
  },
  {
    content: "Customer research shows 64% of users prefer mobile notifications for flash sales but email for weekly promotions.",
    tags: ["customer", "research", "mobile", "notifications", "email", "preferences"],
    importance: 0.7
  },
  {
    content: "Email open rates increased 23% after implementing personalized subject lines based on browsing history.",
    tags: ["email", "open rates", "personalization", "subject lines", "metrics"],
    importance: 0.75
  },
  
  // Product concepts
  {
    content: "The new dashboard feature allows users to customize their analytics view with drag-and-drop widgets.",
    tags: ["product", "dashboard", "analytics", "customization", "widgets"],
    importance: 0.85
  },
  {
    content: "User testing revealed that 78% of participants found the new dashboard interface more intuitive than the previous version.",
    tags: ["user testing", "dashboard", "interface", "usability", "feedback"],
    importance: 0.8
  },
  {
    content: "Mobile app analytics show that users engage with the dashboard for an average of 4.5 minutes per session.",
    tags: ["mobile", "analytics", "dashboard", "engagement", "metrics"],
    importance: 0.7
  },
  
  // Company objectives
  {
    content: "Q2 objectives include increasing mobile app retention by 15% and reducing customer support tickets by 20%.",
    tags: ["objectives", "Q2", "mobile", "retention", "customer support"],
    importance: 0.9
  },
  {
    content: "The product roadmap for 2024 prioritizes AI-powered features and deeper analytics integration.",
    tags: ["roadmap", "2024", "AI", "analytics", "product"],
    importance: 0.85
  }
];

/**
 * Main demonstration function
 */
async function main() {
  console.log("=== MEMORY GRAPH DEMONSTRATION ===");
  
  // Initialize memory
  console.log("\nInitializing memory system...");
  await initMemory();
  await resetAllCollections();
  
  // Store sample memories
  console.log("\nStoring sample memories...");
  const memoryIds: string[] = [];
  
  for (const memory of sampleMemories) {
    const id = await storeMemoryWithGraph(
      memory.content,
      "document",
      "demo",
      { tags: memory.tags },
      { 
        importance_score: memory.importance,
        importance: ImportanceLevel.HIGH,
        connectToGraph: true // Enable graph connections
      }
    );
    
    memoryIds.push(id);
    console.log(`Stored memory: "${memory.content.substring(0, 40)}..." [ID: ${id}]`);
  }
  
  // Wait for indexing and graph connections
  console.log("\nWaiting for memories to be indexed and connected...");
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Run queries with and without graph boosting
  const testQueries = [
    "What did the mobile app user testing show?",
    "What are our Q2 objectives?",
    "How can we improve email open rates?"
  ];
  
  // Test each query
  for (const query of testQueries) {
    console.log("\n========================================");
    console.log(`QUERY: "${query}"`);
    console.log("========================================");
    
    // Test regular search with hybrid scoring
    console.log("\nRESULTS WITHOUT GRAPH BOOSTING:");
    const regularResults = await getMemoriesForPromptInjection(query, {
      limit: 3,
      minConfidence: 0.6,
      useGraphBoost: false
    });
    
    console.log(`Found ${regularResults.length} memories.`);
    regularResults.forEach((result, i) => {
      console.log(`${i+1}. [Score: ${result.score.toFixed(2)}] "${result.text.substring(0, 100)}..."`);
    });
    
    // Test search with graph boosting
    console.log("\nRESULTS WITH GRAPH BOOSTING:");
    const boostedResults = await getMemoriesForPromptInjection(query, {
      limit: 3,
      minConfidence: 0.6,
      useGraphBoost: true
    });
    
    console.log(`Found ${boostedResults.length} memories.`);
    boostedResults.forEach((result, i) => {
      // Show if this was boosted by the graph
      const boostedLabel = result.metadata._boosted_by_graph ? " [GRAPH BOOSTED]" : "";
      console.log(`${i+1}. [Score: ${result.score.toFixed(2)}]${boostedLabel} "${result.text.substring(0, 100)}..."`);
    });
  }
  
  // Demonstrate knowledge clusters
  console.log("\n=== KNOWLEDGE CLUSTER DISCOVERY ===");
  
  // Get memory graph instance
  const memoryGraph = await getMemoryGraph();
  
  // Discover clusters
  const clusters = await memoryGraph.discoverKnowledgeClusters();
  
  console.log(`\nDiscovered ${clusters.length} knowledge clusters:`);
  clusters.forEach((cluster, i) => {
    console.log(`\nCluster ${i+1}: ${cluster.label}`);
    console.log(`Common tags: ${cluster.commonTags.join(', ')}`);
    console.log(`Members: ${cluster.members.length}`);
    
    // Show top 2 members of each cluster
    cluster.members.slice(0, 2).forEach((member, j) => {
      console.log(`  ${j+1}. "${member.text.substring(0, 70)}..."`);
    });
  });
  
  console.log("\n=== DEMONSTRATION COMPLETE ===");
}

// Run the demo
if (require.main === module) {
  main().catch(error => {
    console.error("Error running memory graph demo:", error);
  });
}

// Export for testing
export { main as runMemoryGraphDemo }; 