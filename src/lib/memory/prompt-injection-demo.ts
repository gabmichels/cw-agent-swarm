/**
 * Demo script showing how to inject relevant memories into system prompts
 * 
 * This demonstrates:
 * 1. Retrieving relevant memories based on user query
 * 2. Only including high-confidence memories (above 0.75 threshold)
 * 3. Tracking which memories are used in responses
 * 4. Injecting memory summaries into the system prompt
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { ImportanceLevel } from '../../constants/memory';
import { SYSTEM_PROMPTS } from '../../lib/shared/constants';
import { MemoryType } from '../../server/memory/config';
import { getMemoryServices } from '../../server/memory/services';

// Sample knowledge to store in memory
const sampleKnowledge = [
  {
    content: "Our Q1 performance showed 15% increase in customer engagement with a focus on Instagram and TikTok.",
    tags: ["performance", "Q1", "customer", "engagement", "instagram", "tiktok"],
    importance: ImportanceLevel.HIGH
  },
  {
    content: "Brand guidelines specify using blue (#1E3A8A) and green (#10B981) as primary colors with sans-serif typography.",
    tags: ["brand", "guidelines", "colors", "typography", "design"],
    importance: ImportanceLevel.HIGH
  },
  {
    content: "Customer demographic analysis shows our target audience is primarily 25-34 year old urban professionals.",
    tags: ["demographic", "analysis", "audience", "target", "professionals"],
    importance: ImportanceLevel.MEDIUM
  },
  {
    content: "The new marketing strategy focuses on sustainability and eco-friendly messaging across all channels.",
    tags: ["strategy", "sustainability", "eco-friendly", "messaging"],
    importance: ImportanceLevel.HIGH
  }
];

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
  // Default options
  const limit = options.limit || 3;
  const minConfidence = options.minConfidence || 0.75;
  const trackUsage = options.trackUsage !== false;

  // Get memory services
  const { searchService, memoryService } = await getMemoryServices();

  // Search for relevant memories
  const searchResults = await searchService.search(query, {
    limit: limit * 2, // Get more results to filter by confidence
    types: [MemoryType.DOCUMENT]
  });

  // Filter and format results
  const relevantMemories = searchResults
    .filter((result: any) => result.score >= minConfidence)
    .slice(0, limit)
    .map((result: any) => ({
      id: result.point.id,
      text: result.point.payload?.text || '',
      score: result.score,
      tags: result.point.payload?.metadata?.tags || []
    }));

  // Track memory usage if enabled
  if (trackUsage && relevantMemories.length > 0) {
    for (const memory of relevantMemories) {
      try {
        await memoryService.updateMemory({
          id: memory.id,
          type: MemoryType.DOCUMENT,
          metadata: {
            usageCount: 1, // Increment by 1 (this is additive in the service)
            lastUsed: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error(`Error tracking memory usage for ${memory.id}:`, error);
      }
    }
  }

  return relevantMemories;
}

/**
 * Inject memories into prompt
 */
async function injectMemoriesIntoPrompt(
  basePrompt: string,
  userQuery: string
): Promise<string> {
  // Get relevant memories
  const memories = await getMemoriesForPromptInjection(userQuery);

  if (memories.length === 0) {
    return basePrompt;
  }

  // Format memories for injection
  const memoryText = memories
    .map((mem: any, i: number) => {
      const tags = mem.tags.length > 0 ? `[${mem.tags.join(', ')}]` : '';
      return `${i + 1}. ${mem.text} ${tags}`;
    })
    .join('\n');

  // Inject memories into prompt
  const memoryInjection = `
RELEVANT INFORMATION FROM YOUR MEMORY:
${memoryText}

Please use the above information where relevant to answer the user's question.
`;

  return `${basePrompt}\n${memoryInjection}`;
}

/**
 * Mark a memory as critical
 */
async function markMemoryAsCritical(memoryId: string, isCritical: boolean = true) {
  const { memoryService } = await getMemoryServices();

  await memoryService.updateMemory({
    id: memoryId,
    type: MemoryType.DOCUMENT,
    metadata: {
      isCritical: isCritical,
      importance: ImportanceLevel.HIGH
    }
  });
}

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
      modelName: process.env.OPENAI_MODEL_NAME,
      temperature: 0.7
    });

    // Generate response (proper message format with string[] workaround for type compatibility)
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage)
    ];

    // @ts-ignore - Using invoke directly with message format
    const response = await model.invoke(messages);

    return response.content || "No response content was generated.";
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

  // Initialize memory services
  console.log("\nInitializing memory system...");
  const { client, memoryService } = await getMemoryServices();

  // Ensure memory system is initialized
  const status = await client.getStatus();
  if (!status.initialized) {
    await client.initialize();
  }

  // Store sample knowledge
  console.log("\nStoring sample knowledge in memory...");
  for (const item of sampleKnowledge) {
    const result = await memoryService.addMemory({
      type: MemoryType.DOCUMENT,
      content: item.content,
      metadata: {
        category: "knowledge",
        tags: item.tags,
        importance: item.importance,
        confidence: 0.9
      }
    });

    // After storing, mark the memory as critical to protect from decay
    if (result.success && result.id) {
      await markMemoryAsCritical(result.id);
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
      relevantMemories.forEach((mem: any, i: number) => {
        console.log(`${i + 1}. [Score: ${mem.score.toFixed(2)}] ${mem.text}`);
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

