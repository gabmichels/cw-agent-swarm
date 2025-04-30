import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { getToolManager, initializeToolManager } from './fixToolManagerSingleton';
import { ChloeMemory } from '../memory';
import { registerApifyTools } from './apifyToolAdapters';
import { categorizeQuery } from './apifyToolAdapters';
import { logger } from '../../../lib/logging';

/**
 * Example function showing how Chloe would use the adaptive tool system
 * to select and execute tools based on context
 */
async function handleQueryWithAdaptiveTools(
  query: string,
  memory: ChloeMemory
): Promise<string> {
  try {
    logger.info(`Processing query: "${query}"`);
    
    // Initialize tool manager if not already done
    initializeToolManager(memory);
    const toolManager = getToolManager();
    
    // Register Apify tools (if not already registered)
    registerApifyTools(memory);
    
    // Determine task type and context tags
    const contextTags = categorizeQuery(query);
    let taskType = 'search'; // Default
    
    // Set task type based on context
    if (contextTags.includes('web_scraping')) {
      taskType = 'web_scraping';
    } else if (contextTags.some(tag => ['reddit', 'twitter', 'instagram', 'tiktok'].includes(tag))) {
      taskType = 'social_media';
    } else if (contextTags.includes('youtube')) {
      taskType = 'video';
    }
    
    logger.info(`Query categorized as task type: ${taskType} with tags: ${contextTags.join(', ')}`);
    
    // Get the best tool for this task based on learning
    const bestTool = toolManager.getBestToolForTask(taskType, contextTags);
    
    if (!bestTool) {
      return `I'm sorry, I don't have any tools available to handle "${query}".`;
    }
    
    logger.info(`Selected tool: ${bestTool.name} for task`);
    
    // Execute the tool with the query
    const result = await bestTool.execute({ input: query });
    
    if (!result.success) {
      return `I encountered an error while processing your request: ${result.error || 'Unknown error'}`;
    }
    
    // Format the tool response
    const response = typeof result.response === 'string' 
      ? result.response 
      : typeof result.data === 'string' 
        ? result.data 
        : JSON.stringify(result.data || result);
    
    return response;
  } catch (error) {
    logger.error('Error handling query with adaptive tools:', error);
    return `I'm sorry, I encountered an error while processing your request.`;
  }
}

/**
 * Function that would be called from Chloe's main processing pipeline
 */
export async function processUserRequest(
  userInput: string,
  memory: ChloeMemory
): Promise<string> {
  // This would typically be part of Chloe's planning phase,
  // where she decides whether to use tools or just respond directly
  
  const needsToolExecution = isToolExecutionRequired(userInput);
  
  if (needsToolExecution) {
    return await handleQueryWithAdaptiveTools(userInput, memory);
  } else {
    return `I'd respond directly to your query about "${userInput}" without using tools.`;
  }
}

/**
 * Helper to determine if a query requires tool execution
 */
function isToolExecutionRequired(query: string): boolean {
  // Check if query contains indications that we need external data
  const externalDataIndicators = [
    /\b(search|find|look up|lookup|google|search for|research)\b/i,
    /\b(what is|who is|when is|where is|why is|how to)\b/i,
    /\b(reddit|twitter|youtube|instagram|tiktok)\b/i,
    /\b(latest|news|trending|recent)\b/i,
    /https?:\/\//i // URLs
  ];
  
  return externalDataIndicators.some(pattern => pattern.test(query));
}

// Example usage code
async function demonstrateAdaptiveTools(): Promise<void> {
  const memory = new ChloeMemory();
  
  // Example queries that would be processed by different tools
  const queries = [
    "What's trending on Reddit about AI?",
    "Search for recent tweets about climate change",
    "https://example.com/about - extract the main content",
    "Find popular TikTok videos about cooking",
    "Look up videos about quantum computing on YouTube"
  ];
  
  console.log("🤖 DEMONSTRATING ADAPTIVE TOOL SYSTEM\n");
  
  for (const query of queries) {
    console.log(`📝 QUERY: "${query}"`);
    const response = await processUserRequest(query, memory);
    console.log(`🔍 RESPONSE:\n${response}\n`);
    console.log("-".repeat(50));
  }
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateAdaptiveTools().catch(error => {
    console.error('Demonstration failed:', error);
  });
}

export { handleQueryWithAdaptiveTools }; 