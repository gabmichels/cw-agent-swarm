/**
 * Test script for enhanced memory utilities
 * 
 * This script demonstrates:
 * 1. Hybrid memory scoring (vector + tag overlap)
 * 2. Usage tracking and scoring adjustment
 * 3. Memory decay and reinforcement
 * 4. System prompt injection
 */

import { getMemoryServices } from '../../server/memory/services';
import { MemoryType } from '../../server/memory/config/types';
import { MemoryImportanceLevel, ImportanceLevel } from '../../constants/memory';

// Scoring details interface
interface ScoringDetails {
  vectorScore: number;
  tagScore: number;
  hybridScore: number;
  adjustedScore: number;
  usageCount: number;
  matchedTags: string[];
}

/**
 * Extract potential tags from a query
 */
function extractTagsFromQuery(query: string): string[] {
  // Simple implementation - extract words longer than 3 characters
  const words = query.toLowerCase().split(/\s+/);
  return words
    .filter(word => word.length > 3)
    .filter(word => !['what', 'when', 'where', 'which', 'about', 'show', 'tell'].includes(word));
}

/**
 * Calculate tag overlap score between query tags and memory tags
 */
function calculateTagScore(queryTags: string[], memoryTags: string[]): {
  score: number;
  matchedTags: string[];
} {
  if (!memoryTags || memoryTags.length === 0 || queryTags.length === 0) {
    return { score: 0, matchedTags: [] };
  }
  
  // Normalize memory tags to lowercase
  const normalizedMemoryTags = memoryTags.map(tag => tag.toLowerCase());
  
  // Find matching tags
  const matchedTags = queryTags.filter(tag => 
    normalizedMemoryTags.some(memTag => memTag.includes(tag) || tag.includes(memTag))
  );
  
  // Calculate score based on percentage of query tags matched
  const score = matchedTags.length / queryTags.length;
  
  return { score, matchedTags };
}

/**
 * Adjust score based on usage data
 */
function adjustScoreByUsage(score: number, usageCount: number): number {
  if (usageCount <= 0) return score;
  
  // Apply logarithmic boost based on usage count
  // More uses = higher score, but with diminishing returns
  const usageBoost = 1 + Math.log10(usageCount + 1) * 0.2; // +20% per log10 of usage count
  
  return score * usageBoost;
}

/**
 * Apply hybrid scoring to search results
 */
async function applyHybridScoring(
  searchResults: any[],
  query: string,
  options: {
    vectorWeight?: number;
    tagWeight?: number;
    useUsageData?: boolean;
  } = {}
) {
  // Default weights
  const vectorWeight = options.vectorWeight ?? 0.7;
  const tagWeight = options.tagWeight ?? 0.3;
  const useUsageData = options.useUsageData !== false;
  
  // Extract query tags
  const queryTags = extractTagsFromQuery(query);
  
  // Process each result
  const scoredResults = searchResults.map(result => {
    // Get base vector score (normalize to 0-1 if needed)
    const vectorScore = result.score;
    
    // Get memory tags
    const memoryTags = result.point.payload?.metadata?.tags || [];
    
    // Calculate tag score
    const { score: tagScore, matchedTags } = calculateTagScore(queryTags, memoryTags);
    
    // Calculate hybrid score
    let hybridScore = (vectorScore * vectorWeight) + (tagScore * tagWeight);
    
    // Get usage count if available
    const usageCount = result.point.payload?.metadata?.usageCount || 0;
    
    // Apply usage adjustment if enabled
    let adjustedScore = hybridScore;
    if (useUsageData) {
      adjustedScore = adjustScoreByUsage(hybridScore, usageCount);
    }
    
    // Store scoring details in result
    const scoringDetails: ScoringDetails = {
      vectorScore,
      tagScore,
      hybridScore,
      adjustedScore,
      usageCount,
      matchedTags
    };
    
    // Return result with updated score and details
    return {
      ...result,
      score: adjustedScore,
      scoringDetails
    };
  });
  
  // Sort by adjusted score
  return scoredResults.sort((a, b) => b.score - a.score);
}

/**
 * Track usage of a memory
 */
async function trackMemoryUsage(memoryId: string) {
  try {
    const { memoryService } = await getMemoryServices();
    
    // Update memory to increment usage count
    await memoryService.updateMemory({
      id: memoryId,
      type: MemoryType.DOCUMENT,
      metadata: {
        usageCount: 1, // Will be added to existing count
        lastUsed: new Date().toISOString()
      }
    });
    
    return true;
  } catch (error) {
    console.error(`Error tracking memory usage for ${memoryId}:`, error);
    return false;
  }
}

/**
 * Reinforce memory importance
 */
async function reinforceMemoryImportance(memoryId: string, reason?: string) {
  try {
    const { memoryService } = await getMemoryServices();
    
    // Update memory to increase importance
    await memoryService.updateMemory({
      id: memoryId,
      type: MemoryType.DOCUMENT,
      metadata: {
        importance: MemoryImportanceLevel.HIGH,
        reinforced: 1, // Will be added to existing count
        reinforcedAt: new Date().toISOString(),
        reinforceReason: reason || 'manual_reinforcement'
      }
    });
    
    return true;
  } catch (error) {
    console.error(`Error reinforcing memory ${memoryId}:`, error);
    return false;
  }
}

/**
 * Mark memory as critical (exempt from decay)
 */
async function markMemoryAsCritical(memoryId: string, isCritical: boolean = true) {
  try {
    const { memoryService } = await getMemoryServices();
    
    // Update memory to mark as critical
    await memoryService.updateMemory({
      id: memoryId,
      type: MemoryType.DOCUMENT,
      metadata: {
        critical: isCritical,
        markedCriticalAt: isCritical ? new Date().toISOString() : undefined
      }
    });
    
    return true;
  } catch (error) {
    console.error(`Error marking memory ${memoryId} as critical:`, error);
    return false;
  }
}

/**
 * Apply decay to old, unused memories
 */
async function decayMemoryImportance(options: {
  decayPercent?: number;
  olderThan?: number; // In hours
  dryRun?: boolean;
} = {}) {
  try {
    const { searchService, memoryService } = await getMemoryServices();
    
    // Default options
    const decayPercent = options.decayPercent ?? 5; // Default 5% decay
    const olderThan = options.olderThan ?? 168; // Default 7 days
    const dryRun = options.dryRun ?? false;
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThan);
    
    // Find memories that haven't been used recently
    const filter: Record<string, any> = {
      'metadata.critical': { $ne: true } // Exclude critical memories
    };
    
    // Add date filter if olderThan is specified
    if (olderThan > 0) {
      filter['metadata.lastUsed'] = { $lt: cutoffDate.toISOString() };
    }
    
    // Get memories to decay
    const searchResults = await searchService.search('', { 
      filter,
      types: [MemoryType.DOCUMENT],
      limit: 100
    });
    
    console.log(`Found ${searchResults.length} memories eligible for decay`);
    
    // Track stats
    const stats = {
      processed: searchResults.length,
      decayed: 0,
      exempted: 0
    };
    
    // Process each memory
    for (const result of searchResults) {
      const memory = result.point;
      const metadata = memory.payload?.metadata || {};
      
      // Get current importance
      const currentImportance = metadata.importance || MemoryImportanceLevel.MEDIUM;
      
      // Skip HIGH importance memories - use string comparison instead of enum comparison to avoid type issues
      if (String(currentImportance) === String(MemoryImportanceLevel.HIGH)) {
        stats.exempted++;
        continue;
      }
      
      // Calculate decay
      const decayFactor = 1 - (decayPercent / 100);
      
      // Skip if it's a dry run
      if (dryRun) {
        stats.decayed++;
        continue;
      }
      
      // Apply decay
      await memoryService.updateMemory({
        id: memory.id,
        type: MemoryType.DOCUMENT,
        metadata: {
          importance: MemoryImportanceLevel.LOW,
          decayed: 1, // Increment decay count
          decayedAt: new Date().toISOString()
        }
      });
      
      stats.decayed++;
    }
    
    return stats;
  } catch (error) {
    console.error('Error applying memory decay:', error);
    return { processed: 0, decayed: 0, exempted: 0 };
  }
}

/**
 * Get memories for prompt injection
 */
async function getMemoriesForPromptInjection(
  query: string,
  options: {
    limit?: number;
    minConfidence?: number;
    trackUsage?: boolean;
  } = {}
) {
  try {
    // Default options
    const limit = options.limit || 3;
    const minConfidence = options.minConfidence || 0.75;
    const trackUsage = options.trackUsage !== false;
    
    // Get memory services
    const { searchService } = await getMemoryServices();
    
    // Search for relevant memories
    const searchResults = await searchService.search(query, {
      limit: limit * 2, // Get more results to filter by confidence
      types: [MemoryType.DOCUMENT]
    });
    
    // Apply hybrid scoring
    const scoredResults = await applyHybridScoring(searchResults, query, {
      useUsageData: true
    });
    
    // Filter by confidence and limit results
    const relevantMemories = scoredResults
      .filter(result => result.score >= minConfidence)
      .slice(0, limit)
      .map(result => ({
        id: result.point.id,
        text: result.point.payload?.text || '',
        score: result.score,
        tags: result.point.payload?.metadata?.tags || []
      }));
    
    // Track usage if enabled
    if (trackUsage && relevantMemories.length > 0) {
      for (const memory of relevantMemories) {
        await trackMemoryUsage(memory.id);
      }
    }
    
    return relevantMemories;
  } catch (error) {
    console.error('Error getting memories for prompt injection:', error);
    return [];
  }
}

/**
 * Format memories for prompt injection
 */
function formatMemoriesForPrompt(memories: any[]): string {
  if (!memories || memories.length === 0) {
    return '';
  }
  
  return memories
    .map((memory, index) => {
      // Format tags if available
      const tags = memory.tags && memory.tags.length > 0
        ? ` [${memory.tags.join(', ')}]`
        : '';
      
      return `${index + 1}. ${memory.text}${tags}`;
    })
    .join('\n');
}

/**
 * Inject memories into prompt
 */
async function injectMemoriesIntoPrompt(
  basePrompt: string,
  query: string,
  options: {
    limit?: number;
    minConfidence?: number;
    trackUsage?: boolean;
  } = {}
): Promise<string> {
  try {
    // Get relevant memories
    const memories = await getMemoriesForPromptInjection(query, options);
    
    if (memories.length === 0) {
      return basePrompt;
    }
    
    // Format memories
    const memoryText = formatMemoriesForPrompt(memories);
    
    // Create injection text
    const injectionText = `
RELEVANT INFORMATION FROM YOUR MEMORY:
${memoryText}

Use the above information where relevant to answer the user's question.
`;
    
    // Inject into prompt
    return `${basePrompt}\n${injectionText}`;
  } catch (error) {
    console.error('Error injecting memories into prompt:', error);
    return basePrompt;
  }
}

async function main() {
  console.log("=== MEMORY UTILITIES TEST ===");
  
  // Initialize memory services
  console.log("\nInitializing memory system...");
  const { client, memoryService, searchService } = await getMemoryServices();
  
  // Ensure memory system is initialized
  const status = await client.getStatus();
  if (!status.initialized) {
    await client.initialize();
  }
  
  // TEST 1: Create test data
  console.log("\n=== TEST 1: CREATING TEST DATA ===");
  
  // Sample documents with tags
  const testDocs = [
    {
      content: "The company's marketing strategy focuses on engagement and digital growth for 2024.",
      tags: ["marketing", "strategy", "digital", "growth", "2024"],
      importance: MemoryImportanceLevel.MEDIUM
    },
    {
      content: "Product launch scheduled for Q2 with a full PR campaign and influencer outreach.",
      tags: ["product", "launch", "PR", "influencer", "Q2"],
      importance: MemoryImportanceLevel.HIGH
    },
    {
      content: "Customer research indicates a preference for mobile-first experiences with quick checkout.",
      tags: ["customer", "research", "mobile", "checkout", "experience"],
      importance: MemoryImportanceLevel.MEDIUM
    },
    {
      content: "Social media analytics show higher engagement on Instagram for our target demographic.",
      tags: ["social", "analytics", "instagram", "engagement", "demographic"],
      importance: MemoryImportanceLevel.LOW
    }
  ];
  
  // Store test documents
  const docIds: string[] = [];
  for (const doc of testDocs) {
    const result = await memoryService.addMemory({
      type: MemoryType.DOCUMENT,
      content: doc.content,
      metadata: {
        category: "test",
        tags: doc.tags,
        importance: doc.importance
      }
    });
    
    if (result.success && result.id) {
      docIds.push(result.id);
      console.log(`Stored: "${doc.content.substring(0, 40)}..." [ID: ${result.id}]`);
    }
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
    const results = await searchService.search(query, { 
      limit: 10,
      types: [MemoryType.DOCUMENT]
    });
    console.log(`Vector search found ${results.length} results`);
    
    // Apply hybrid scoring
    const hybridResults = await applyHybridScoring(results, query);
    
    // Display top results with scoring details
    console.log("Top results with hybrid scoring:");
    hybridResults.slice(0, 2).forEach((result, i) => {
      const details = result.scoringDetails;
      if (details) {
        console.log(`${i+1}. "${result.point.payload?.text?.substring(0, 40)}..."`);
        console.log(`   Vector score: ${details.vectorScore.toFixed(3)}`);
        console.log(`   Tag score: ${details.tagScore.toFixed(3)}`);
        console.log(`   Hybrid score: ${details.hybridScore.toFixed(3)}`);
        console.log(`   Final score: ${details.adjustedScore.toFixed(3)}`);
        console.log(`   Matched tags: ${details.matchedTags.join(', ')}`);
      } else {
        console.log(`${i+1}. "${result.point.payload?.text?.substring(0, 40)}..." (no scoring details available)`);
      }
    });
  }
  
  // TEST 3: Usage tracking and scoring adjustment
  console.log("\n=== TEST 3: USAGE TRACKING AND SCORING ===");
  
  // Track usage of the first document
  console.log("\nTracking usage of first document 3 times...");
  if (docIds.length > 0) {
    for (let i = 0; i < 3; i++) {
      await trackMemoryUsage(docIds[0]);
    }
  }
  
  // Track usage of second document once
  console.log("Tracking usage of second document 1 time...");
  if (docIds.length > 1) {
    await trackMemoryUsage(docIds[1]);
  }
  
  // Verify usage counts
  console.log("\nChecking usage counts:");
  for (let i = 0; i < docIds.length; i++) {
    const searchResults = await searchService.search('', {
      filter: { id: docIds[i] },
      limit: 1
    });
    
    if (searchResults.length > 0) {
      const usageCount = searchResults[0].point.payload?.metadata?.usageCount || 0;
      console.log(`Document ${i+1}: Usage count = ${usageCount}`);
    }
  }
  
  // Test hybrid search again with usage impacts
  const usageQuery = "marketing strategy digital";
  console.log(`\nQuery with usage impact: "${usageQuery}"`);
  const usageResults = await searchService.search(usageQuery, { 
    limit: 10,
    types: [MemoryType.DOCUMENT]
  });
  const scoredUsageResults = await applyHybridScoring(usageResults, usageQuery, { useUsageData: true });
  
  console.log("Results with usage-adjusted scoring:");
  scoredUsageResults.slice(0, 2).forEach((result, i) => {
    const details = result.scoringDetails;
    if (details) {
      console.log(`${i+1}. "${result.point.payload?.text?.substring(0, 40)}..."`);
      console.log(`   Base hybrid score: ${details.hybridScore.toFixed(3)}`);
      console.log(`   Usage count: ${details.usageCount}`);
      console.log(`   Usage boost: ${(details.adjustedScore / details.hybridScore).toFixed(2)}x`);
      console.log(`   Final score: ${details.adjustedScore.toFixed(3)}`);
    } else {
      console.log(`${i+1}. "${result.point.payload?.text?.substring(0, 40)}..." (no scoring details available)`);
    }
  });
  
  // TEST 4: Reinforcement and critical memories
  console.log("\n=== TEST 4: REINFORCEMENT AND CRITICAL MEMORIES ===");
  
  // Reinforce first document
  console.log("\nReinforcing first document as important...");
  if (docIds.length > 0) {
    await reinforceMemoryImportance(docIds[0], "user_feedback_helpful");
  }
  
  // Mark third document as critical
  console.log("Marking third document as critical...");
  if (docIds.length > 2) {
    await markMemoryAsCritical(docIds[2], true);
  }
  
  // Check status after reinforcement and marking critical
  console.log("\nStatus after reinforcement and critical marking:");
  for (let i = 0; i < Math.min(3, docIds.length); i++) {
    const searchResults = await searchService.search('', {
      filter: { id: docIds[i] },
      limit: 1
    });
    
    if (searchResults.length > 0) {
      const metadata = searchResults[0].point.payload?.metadata || {};
      console.log(`Document ${i+1}:`);
      console.log(`   Importance: ${metadata.importance || 'N/A'}`);
      console.log(`   Reinforced: ${metadata.reinforced || 0} times`);
      console.log(`   Critical: ${metadata.critical || false}`);
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
  for (let i = 0; i < Math.min(4, docIds.length); i++) {
    const searchResults = await searchService.search('', {
      filter: { id: docIds[i] },
      limit: 1
    });
    
    if (searchResults.length > 0) {
      const metadata = searchResults[0].point.payload?.metadata || {};
      console.log(`Document ${i+1}:`);
      console.log(`   Importance: ${metadata.importance || 'N/A'}`);
      console.log(`   Decayed: ${metadata.decayed || 0} times`);
    }
  }
  
  // TEST 6: Prompt injection
  console.log("\n=== TEST 6: PROMPT INJECTION ===");
  const basePrompt = "You are an AI assistant named Chloe. Answer the question based on what you know.";
  const promptQuery = "What is our marketing strategy for 2024?";
  
  console.log(`\nQuery for prompt injection: "${promptQuery}"`);
  console.log("\nBase prompt:");
  console.log(basePrompt);
  
  const enhancedPrompt = await injectMemoriesIntoPrompt(basePrompt, promptQuery, {
    limit: 2,
    minConfidence: 0.5
  });
  
  console.log("\nEnhanced prompt with memory injection:");
  console.log(enhancedPrompt);
  
  console.log("\n=== TEST COMPLETE ===");
}

// Run the test if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error("Error running tests:", error);
  });
}

// Export functions for testing
export {
  extractTagsFromQuery,
  calculateTagScore,
  adjustScoreByUsage,
  trackMemoryUsage,
  reinforceMemoryImportance,
  markMemoryAsCritical,
  decayMemoryImportance,
  getMemoriesForPromptInjection,
  formatMemoriesForPrompt,
  injectMemoriesIntoPrompt
}; 