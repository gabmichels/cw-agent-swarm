/**
 * Test script for enhanced memory utilities
 * 
 * This script demonstrates:
 * 1. Hybrid memory scoring (vector + tag overlap)
 * 2. Usage tracking and scoring adjustment
 * 3. Memory decay and reinforcement
 * 4. System prompt injection
 */

import { initMemory, storeMemory, searchMemory, resetAllCollections } from '../../server/qdrant';
import { 
  extractTagsFromQuery,
  calculateTagScore,
  adjustScoreByUsage,
  applyHybridScoring,
  trackMemoryUsage,
  reinforceMemoryImportance,
  markMemoryAsCritical,
  decayMemoryImportance,
  getMemoriesForPromptInjection,
  formatMemoriesForPrompt,
  injectMemoriesIntoPrompt,
  ScoringDetails
} from './MemoryUtils';

async function main() {
  console.log("=== CHLOE MEMORY UTILITIES TEST ===");
  
  // Initialize memory system
  console.log("\nInitializing memory system...");
  await initMemory();
  await resetAllCollections();
  
  // TEST 1: Create test data
  console.log("\n=== TEST 1: CREATING TEST DATA ===");
  
  // Sample documents with tags
  const testDocs = [
    {
      content: "The company's marketing strategy focuses on engagement and digital growth for 2024.",
      tags: ["marketing", "strategy", "digital", "growth", "2024"],
      importance: 0.7
    },
    {
      content: "Product launch scheduled for Q2 with a full PR campaign and influencer outreach.",
      tags: ["product", "launch", "PR", "influencer", "Q2"],
      importance: 0.8
    },
    {
      content: "Customer research indicates a preference for mobile-first experiences with quick checkout.",
      tags: ["customer", "research", "mobile", "checkout", "experience"],
      importance: 0.6
    },
    {
      content: "Social media analytics show higher engagement on Instagram for our target demographic.",
      tags: ["social", "analytics", "instagram", "engagement", "demographic"],
      importance: 0.5
    }
  ];
  
  // Store test documents
  const docIds: string[] = [];
  for (const doc of testDocs) {
    const id = await storeMemory(
      doc.content,
      "document",
      "test",
      { tags: doc.tags },
      { importance_score: doc.importance }
    );
    docIds.push(id);
    console.log(`Stored: "${doc.content.substring(0, 40)}..." [ID: ${id}]`);
  }
  
  // Wait for indexing
  console.log("Waiting for documents to be indexed...");
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // TEST 2: Tag extraction and relevance
  console.log("\n=== TEST 2: TAG EXTRACTION AND SCORING ===");
  
  const testQueries = [
    "What's our marketing strategy for 2024?",
    "When is the product launch happening?",
    "Show me customer research about mobile experiences."
  ];
  
  for (const query of testQueries) {
    console.log(`\nQuery: "${query}"`);
    
    // Extract tags from query
    const queryTags = extractTagsFromQuery(query);
    console.log(`Extracted tags: ${queryTags.join(', ')}`);
    
    // Basic vector search
    const results = await searchMemory("document", query, { limit: 10 });
    console.log(`Vector search found ${results.length} results`);
    
    // Apply hybrid scoring
    const hybridResults = applyHybridScoring(results, query);
    
    // Display top results with scoring details
    console.log("Top results with hybrid scoring:");
    hybridResults.slice(0, 2).forEach((result, i) => {
      const details = result.metadata._scoringDetails as ScoringDetails | undefined;
      if (details) {
        console.log(`${i+1}. "${result.text.substring(0, 40)}..."`);
        console.log(`   Vector score: ${details.vectorScore.toFixed(3)}`);
        console.log(`   Tag score: ${details.tagScore.toFixed(3)}`);
        console.log(`   Hybrid score: ${details.hybridScore.toFixed(3)}`);
        console.log(`   Final score: ${details.adjustedScore.toFixed(3)}`);
        console.log(`   Matched tags: ${details.matchedTags.join(', ')}`);
      } else {
        console.log(`${i+1}. "${result.text.substring(0, 40)}..." (no scoring details available)`);
      }
    });
  }
  
  // TEST 3: Usage tracking and scoring adjustment
  console.log("\n=== TEST 3: USAGE TRACKING AND SCORING ===");
  
  // Track usage of the first document
  console.log("\nTracking usage of first document 3 times...");
  for (let i = 0; i < 3; i++) {
    await trackMemoryUsage(docIds[0]);
  }
  
  // Track usage of second document once
  console.log("Tracking usage of second document 1 time...");
  await trackMemoryUsage(docIds[1]);
  
  // Verify usage counts
  console.log("\nChecking usage counts:");
  for (let i = 0; i < docIds.length; i++) {
    const memory = await searchMemory(null, '', { filter: { id: docIds[i] }, limit: 1 });
    if (memory.length > 0) {
      console.log(`Document ${i+1}: Usage count = ${memory[0].metadata.usage_count || 0}`);
    }
  }
  
  // Test hybrid search again with usage impacts
  const usageQuery = "marketing strategy digital";
  console.log(`\nQuery with usage impact: "${usageQuery}"`);
  const usageResults = await searchMemory("document", usageQuery, { limit: 10 });
  const scoredUsageResults = applyHybridScoring(usageResults, usageQuery);
  
  console.log("Results with usage-adjusted scoring:");
  scoredUsageResults.slice(0, 2).forEach((result, i) => {
    const details = result.metadata._scoringDetails as ScoringDetails | undefined;
    if (details) {
      console.log(`${i+1}. "${result.text.substring(0, 40)}..."`);
      console.log(`   Base hybrid score: ${details.hybridScore.toFixed(3)}`);
      console.log(`   Usage count: ${details.usageCount}`);
      console.log(`   Usage boost: ${(details.adjustedScore / details.hybridScore).toFixed(2)}x`);
      console.log(`   Final score: ${details.adjustedScore.toFixed(3)}`);
    } else {
      console.log(`${i+1}. "${result.text.substring(0, 40)}..." (no scoring details available)`);
    }
  });
  
  // TEST 4: Reinforcement and critical memories
  console.log("\n=== TEST 4: REINFORCEMENT AND CRITICAL MEMORIES ===");
  
  // Reinforce first document
  console.log("\nReinforcing first document as important...");
  await reinforceMemoryImportance(docIds[0], "user_feedback_helpful");
  
  // Mark third document as critical
  console.log("Marking third document as critical...");
  await markMemoryAsCritical(docIds[2], true);
  
  // Check status after reinforcement and marking critical
  console.log("\nStatus after reinforcement and critical marking:");
  for (let i = 0; i < 3; i++) {
    const memory = await searchMemory(null, '', { filter: { id: docIds[i] }, limit: 1 });
    if (memory.length > 0) {
      const meta = memory[0].metadata;
      console.log(`Document ${i+1}:`);
      console.log(`   Importance score: ${meta.importance_score || 'N/A'}`);
      console.log(`   Reinforced: ${meta.reinforced || 0} times`);
      console.log(`   Critical: ${meta.critical || false}`);
    }
  }
  
  // TEST 5: Memory decay
  console.log("\n=== TEST 5: MEMORY DECAY ===");
  
  // Run decay simulation
  console.log("\nSimulating decay on unused memories...");
  const decayStats = await decayMemoryImportance({
    decayPercent: 5,
    olderThan: 0, // For testing, consider all memories without usage as "old"
    dryRun: false
  });
  
  console.log(`Decay results: Processed ${decayStats.processed}, Decayed ${decayStats.decayed}, Exempted ${decayStats.exempted}`);
  
  // Check importance scores after decay
  console.log("\nImportance scores after decay:");
  for (let i = 0; i < docIds.length; i++) {
    const memory = await searchMemory(null, '', { filter: { id: docIds[i] }, limit: 1 });
    if (memory.length > 0) {
      const meta = memory[0].metadata;
      console.log(`Document ${i+1}:`);
      console.log(`   Original importance: ${testDocs[i].importance}`);
      console.log(`   Current importance: ${meta.importance_score || 'N/A'}`);
      console.log(`   Last decayed at: ${meta.last_decayed_at || 'never'}`);
    }
  }
  
  // TEST 6: System prompt injection
  console.log("\n=== TEST 6: MEMORY INJECTION FOR SYSTEM PROMPT ===");
  
  const sampleSystemPrompt = `You are Chloe, a marketing AI assistant.
You help with marketing strategy, content creation, and campaign analysis.
You have access to various marketing tools and can analyze data.

When responding to users, be helpful, informative, and concise.`;
  
  const userMessage = "Can you help me update our marketing strategy for the next quarter?";
  
  console.log(`\nUser message: "${userMessage}"`);
  
  // Get memories for prompt injection
  const relevantMemories = await getMemoriesForPromptInjection(userMessage, {
    limit: 2,
    minConfidence: 0.7,
    trackUsage: true
  });
  
  console.log(`Found ${relevantMemories.length} relevant memories for injection`);
  
  // Format memories for prompt
  const formattedMemories = formatMemoriesForPrompt(relevantMemories);
  console.log("\nFormatted memories:");
  console.log(formattedMemories);
  
  // Inject into system prompt
  const enhancedPrompt = await injectMemoriesIntoPrompt(sampleSystemPrompt, userMessage);
  console.log("\nEnhanced system prompt:");
  console.log(enhancedPrompt);
  
  console.log("\n=== TEST COMPLETE ===");
}

// Run the test
main().catch(error => {
  console.error("Error running test:", error);
}); 