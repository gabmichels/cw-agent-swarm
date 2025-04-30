import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { createApifyTools } from './apifyManager';
import { ToolManager } from './toolManager';
import { initializeToolManager, getToolManager } from './fixToolManagerSingleton';
import { logger } from '../../../lib/logging';
import { ChloeMemory } from '../memory';

/**
 * Adapter class that converts Apify tools to BaseTool format
 * for use with the adaptive tool system
 */
class ApifyToolAdapter extends BaseTool {
  private originalTool: any;
  
  constructor(name: string, description: string, originalTool: any) {
    super(
      name,
      description,
      {
        input: {
          type: 'string',
          description: 'The input for the tool (keyword, URL, username, etc.)'
        }
      }
    );
    this.originalTool = originalTool;
  }
  
  async execute(params: Record<string, any>): Promise<any> {
    try {
      // Extract input parameter
      const input = params.input;
      
      if (!input) {
        return {
          success: false,
          error: 'No input provided for Apify tool'
        };
      }
      
      // Call the original _call method from the Apify tool
      const result = await this.originalTool._call(input);
      
      // Check if the result indicates an error
      if (result.startsWith('Error') || result.startsWith('Failed')) {
        return {
          success: false,
          error: result,
          message: result
        };
      }
      
      return {
        success: true,
        response: result,
        data: result
      };
    } catch (error) {
      logger.error(`Error executing Apify tool ${this.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: `Failed to execute Apify tool: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

/**
 * Maps Apify tool names to appropriate task types
 */
function getTaskTypesForApifyTool(toolName: string): string[] {
  const toolTypeMap: Record<string, string[]> = {
    'apify-reddit-search': ['search', 'social_media', 'reddit'],
    'apify-twitter-search': ['search', 'social_media', 'twitter'],
    'apify-website-crawler': ['web_scraping', 'content_extraction'],
    'apify-youtube-search': ['search', 'video', 'youtube'],
    'apify-instagram-scraper': ['social_media', 'instagram', 'profile_analysis'],
    'apify-tiktok-scraper': ['social_media', 'tiktok', 'trend_analysis']
  };
  
  return toolTypeMap[toolName] || ['search'];
}

/**
 * Creates and registers all Apify tools with the ToolManager
 * @param memory Chloe's memory instance
 */
export function registerApifyTools(memory: ChloeMemory): void {
  try {
    // Get the original Apify tools
    const apifyTools = createApifyTools();
    
    // Initialize the tool manager with memory
    initializeToolManager(memory);
    const toolManager = getToolManager();
    
    // Register each Apify tool with the tool manager
    for (const [name, tool] of Object.entries(apifyTools)) {
      // Create adapter for the tool
      const adapter = new ApifyToolAdapter(name, tool.description, tool);
      
      // Get appropriate task types for this tool
      const taskTypes = getTaskTypesForApifyTool(name);
      
      // Register the tool with the manager
      toolManager.registerTool(adapter, taskTypes);
      logger.info(`Registered Apify tool: ${name} for task types: ${taskTypes.join(', ')}`);
    }
    
    logger.info(`Successfully registered ${Object.keys(apifyTools).length} Apify tools`);
  } catch (error) {
    logger.error('Error registering Apify tools:', error);
  }
}

// Apify tool task categorization helper
export function categorizeQuery(query: string): string[] {
  const contextTags: string[] = [];
  
  // Check for social media indicators
  if (query.includes('@') || /\b(profile|user|account)\b/i.test(query)) {
    contextTags.push('profile_analysis');
  }
  
  if (/\b(reddit|subreddit|r\/)\b/i.test(query)) {
    contextTags.push('reddit');
  }
  
  if (/\b(twitter|tweet|x\.com)\b/i.test(query)) {
    contextTags.push('twitter');
  }
  
  if (/\b(instagram|ig)\b/i.test(query)) {
    contextTags.push('instagram');
  }
  
  if (/\b(tiktok|tik tok)\b/i.test(query)) {
    contextTags.push('tiktok');
  }
  
  if (/\b(youtube|video|yt)\b/i.test(query)) {
    contextTags.push('youtube', 'video');
  }
  
  // Check for website content extraction
  if (/https?:\/\//i.test(query) || /\b(website|webpage|site|crawl|extract)\b/i.test(query)) {
    contextTags.push('web_scraping');
  }
  
  // Check for trend analysis
  if (/\b(trend|trending|popular|viral)\b/i.test(query)) {
    contextTags.push('trend_analysis');
  }
  
  // Default to search if no specific categories identified
  if (contextTags.length === 0) {
    contextTags.push('search');
  }
  
  return contextTags;
} 