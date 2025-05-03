/**
 * Demo script showing how to inject relevant memories into system prompts
 * 
 * This demonstrates:
 * 1. Retrieving relevant memories based on user query
 * 2. Only including high-confidence memories (above 0.75 threshold)
 * 3. Tracking which memories are used in responses
 * 4. Injecting memory summaries into the system prompt
 */

import { initMemory, storeMemory, searchMemory, resetAllCollections, updateMemoryMetadata } from '../../server/qdrant';
import { 
  getMemoriesForPromptInjection,
  injectMemoriesIntoPrompt,
  markMemoryAsCritical
} from './MemoryUtils';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { SYSTEM_PROMPTS } from '../../lib/shared/constants';
import { ImportanceLevel } from '../../constants/memory';

// Sample knowledge to store in memory
const sampleKnowledge = [
  {
    content: "Our Q1 performance showed 15% increase in customer engagement with a focus on Instagram and TikTok.",
    tags: ["performance", "Q1", "customer", "engagement", "instagram", "tiktok"],
    importance: 0.8
  },
  {
    content: "Brand guidelines specify using blue (#1E3A8A) and green (#10B981) as primary colors with sans-serif typography.",
    tags: ["brand", "guidelines", "colors", "typography", "design"],
    importance: 0.9
  },
  {
    content: "Customer demographic analysis shows our target audience is primarily 25-34 year old urban professionals.",
    tags: ["demographic", "analysis", "audience", "target", "professionals"],
    importance: 0.7
  },
  {
    content: "The new marketing strategy focuses on sustainability and eco-friendly messaging across all channels.",
    tags: ["strategy", "sustainability", "eco-friendly", "messaging"],
    importance: 0.85
  }
];

/**
 * Generate a response with memory-augmented prompting
 */
async function generateMemoryAugmentedResponse(
  userMessage: string,
  memoryEnabled: boolean = true,
  trackUsage: boolean = true
): Promise<string> {
  try {
    console.log(`Generating ${memoryEnabled ? 'memory-augmented' : 'standard'} response...`);
    
    // Get base system prompt
    let systemPrompt = SYSTEM_PROMPTS.CHLOE;
    
    // If memory is enabled, enhance the system prompt
    if (memoryEnabled) {
      console.log("Retrieving relevant memories for: " + userMessage);
      systemPrompt = await injectMemoriesIntoPrompt(systemPrompt, userMessage);
    }
    
    // Initialize the LLM
    const model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.7
    });
    
    // Generate response (proper message format with string[] workaround for type compatibility)
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage)
    ];
    
    // @ts-ignore - Using invoke directly with message format
    const response = await model.invoke(messages);
    
    return response.content;
  } catch (error) {
    console.error("Error generating response:", error);
    return "Sorry, I encountered an error while processing your request.";
  }
}

/**
 * Main demonstration function
 */
async function main() {
  console.log("=== MEMORY PROMPT INJECTION DEMO ===");
  
  // Initialize memory
  console.log("\nInitializing memory system...");
  await initMemory();
  await resetAllCollections();
  
  // Store sample knowledge
  console.log("\nStoring sample knowledge in memory...");
  for (const item of sampleKnowledge) {
    await storeMemory(
      item.content,
      "document",
      "knowledge",
      { tags: item.tags },
      { 
        importance_score: item.importance,
        importance: ImportanceLevel.HIGH
      }
    );
    
    // After storing, mark the memory as critical to protect from decay
    // This is done separately to work around the metadata type restrictions
    const searchResults = await searchMemory("document", item.content, { limit: 1 });
    if (searchResults.length > 0) {
      const memoryId = searchResults[0].id;
      await markMemoryAsCritical(memoryId, true);
      console.log(`Stored and marked as critical: ${item.content.substring(0, 40)}...`);
    }
  }
  
  // Wait for indexing
  console.log("\nWaiting for documents to be indexed...");
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test queries to demonstrate memory-augmented responses
  const testQueries = [
    "What colors should I use in our marketing materials?",
    "Who is our target audience?",
    "What was our performance like last quarter?"
  ];
  
  // Process each query
  for (const query of testQueries) {
    console.log("\n========================================");
    console.log(`USER QUERY: "${query}"`);
    console.log("========================================");
    
    // First, show which memories would be injected
    console.log("\nRELEVANT MEMORIES:");
    const relevantMemories = await getMemoriesForPromptInjection(query, {
      limit: 3,
      minConfidence: 0.75,
      trackUsage: false // Don't track usage yet, just for display
    });
    
    if (relevantMemories.length > 0) {
      relevantMemories.forEach((mem, i) => {
        console.log(`${i+1}. [Score: ${mem.score.toFixed(2)}] ${mem.text}`);
      });
    } else {
      console.log("No memories met the confidence threshold.");
    }
    
    // Generate response without memory
    console.log("\nSTANDARD RESPONSE (WITHOUT MEMORY):");
    const standardResponse = await generateMemoryAugmentedResponse(query, false);
    console.log(standardResponse);
    
    // Generate response with memory
    console.log("\nMEMORY-AUGMENTED RESPONSE:");
    const augmentedResponse = await generateMemoryAugmentedResponse(query, true);
    console.log(augmentedResponse);
    
    console.log("\n----------------------------------------");
  }
  
  console.log("\n=== DEMO COMPLETE ===");
}

// Run the demo if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error("Error running demo:", error);
  });
}

// Export for testing
export { generateMemoryAugmentedResponse }; 