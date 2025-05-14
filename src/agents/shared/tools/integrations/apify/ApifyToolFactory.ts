/**
 * ApifyToolFactory.ts - Factory for creating Apify tools
 * 
 * This file provides a factory function for creating Apify tools that can be
 * registered with the agent tool system.
 */

import { logger } from '../../../../../lib/logging';
import { IApifyManager, ApifyActorMetadata } from './ApifyManager.interface';
import { z } from 'zod';

// Import necessary types for tool creation
interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType<any, any>;
  func: (args: any) => Promise<any>;
  costEstimate?: 'low' | 'medium' | 'high';
  usageLimit?: number;
}

/**
 * Create a set of Apify tools that can be registered with the tool system
 * 
 * @param apifyManager An instance of IApifyManager
 * @returns An object containing the Apify tools
 */
export function createApifyTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    'apify-reddit-search': {
      name: 'apify-reddit-search',
      description: 'Search Reddit for posts related to a keyword or topic. Default limit: 10 posts (use "bypass X items" for more posts with approval)',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      schema: z.object({
        keyword: z.string().min(1).describe('The search keyword or topic'),
        limit: z.number().min(1).max(100).optional().describe('Maximum number of results'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { keyword: string; limit?: number; dryRun?: boolean }): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = args.dryRun || false;
          const maxItems = args.limit || 10;
          
          // Check if the limit is too high
          if (maxItems > 25) {
            return `I need your permission to fetch ${maxItems} posts from Reddit, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${maxItems} for reddit search" or modify your request to stay within limits.`;
          }
          
          const result = await apifyManager.runRedditSearch(args.keyword, isDryRun, maxItems);
          
          if (!result.success || !result.output) {
            return `Failed to search Reddit for "${args.keyword}"`;
          }
          
          // Format the results
          const posts = result.output;
          const formattedResult = posts.slice(0, 5).map((post: any, index: number) => {
            return `[${index + 1}] ${post.title || 'Untitled'}\n   Subreddit: ${post.community || 'unknown'}\n   Score: ${post.score || 'N/A'}\n   URL: ${post.url || 'N/A'}\n`;
          }).join('\n');
          
          return `Reddit search results for "${args.keyword}":\n\n${formattedResult}\n\nTotal results: ${posts.length}`;
        } catch (error) {
          logger.error('Error in apify-reddit-search tool:', error);
          return `Error searching Reddit: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },
    
    'apify-twitter-search': {
      name: 'apify-twitter-search',
      description: 'Search Twitter for tweets related to a keyword or topic. Default limit: 10 tweets (use "bypass X items" for more tweets with approval)',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      schema: z.object({
        keyword: z.string().min(1).describe('The search keyword or topic'),
        limit: z.number().min(1).max(100).optional().describe('Maximum number of results'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { keyword: string; limit?: number; dryRun?: boolean }): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = args.dryRun || false;
          const maxItems = args.limit || 10;
          
          // Check if the limit is too high
          if (maxItems > 25) {
            return `I need your permission to fetch ${maxItems} tweets, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${maxItems} for twitter search" or modify your request to stay within limits.`;
          }
          
          const result = await apifyManager.runTwitterSearch(args.keyword, isDryRun, maxItems);
          
          if (!result.success || !result.output) {
            return `Failed to search Twitter for "${args.keyword}"`;
          }
          
          // Format the results
          const tweets = result.output;
          const formattedResult = tweets.slice(0, 5).map((tweet: any, index: number) => {
            return `[${index + 1}] @${tweet.username || 'unknown'}: ${tweet.text || 'No content'}\n   Likes: ${tweet.likeCount || 0}, Retweets: ${tweet.retweetCount || 0}\n   Date: ${tweet.date || 'N/A'}\n`;
          }).join('\n');
          
          return `Twitter search results for "${args.keyword}":\n\n${formattedResult}\n\nTotal results: ${tweets.length}`;
        } catch (error) {
          logger.error('Error in apify-twitter-search tool:', error);
          return `Error searching Twitter: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },
    
    'apify-website-crawler': {
      name: 'apify-website-crawler',
      description: 'Crawl a website to extract content and information. Default limits: 10 pages, depth 1.',
      costEstimate: 'high',
      usageLimit: 10, // max allowed runs/day
      schema: z.object({
        url: z.string().url().describe('The URL to crawl'),
        maxPages: z.number().min(1).max(50).optional().describe('Maximum number of pages to crawl'),
        maxDepth: z.number().min(1).max(3).optional().describe('Maximum depth to crawl'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { url: string; maxPages?: number; maxDepth?: number; dryRun?: boolean }): Promise<string> {
        try {
          // Check if this is a dry run request
          const isDryRun = args.dryRun || false;
          const maxPages = args.maxPages || 10;
          const maxDepth = args.maxDepth || 1;
          
          // Check if the limits are too high
          if (maxPages > 25) {
            return `I need your permission to crawl ${maxPages} pages, which exceeds our default limit of 25 to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${maxPages} pages for website crawler" or modify your request to stay within limits.`;
          }
          
          if (maxDepth > 2) {
            return `I need your permission to crawl to a depth of ${maxDepth}, which exceeds our default limit of 2 to prevent excessive API usage. Deeper crawls can increase costs exponentially.\n\nTo approve, please reply with: "approve depth ${maxDepth} for website crawler" or modify your request to stay within limits.`;
          }
          
          const result = await apifyManager.runWebsiteCrawler(args.url, isDryRun, maxPages, maxDepth);
          
          if (!result.success || !result.output) {
            return `Failed to crawl website "${args.url}"`;
          }
          
          // Format the results
          const pages = result.output;
          let summary = `Crawled ${pages.length} pages from ${args.url}\n\n`;
          
          // Summarize found pages
          if (pages.length > 0) {
            summary += 'Pages crawled:\n';
            summary += pages.slice(0, 5).map((page: any, index: number) => {
              return `[${index + 1}] ${page.title || 'Untitled'}\n   URL: ${page.url || 'N/A'}\n   Word count: ${page.text ? page.text.split(/\s+/).length : 'N/A'}\n`;
            }).join('\n');
            
            if (pages.length > 5) {
              summary += `\n... and ${pages.length - 5} more pages`;
            }
          }
          
          return summary;
        } catch (error) {
          logger.error('Error in apify-website-crawler tool:', error);
          return `Error crawling website: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'apify-actor-discovery': {
      name: 'apify-actor-discovery',
      description: 'Discover Apify actors based on a search query or task description',
      costEstimate: 'low',
      usageLimit: 50, // Higher limit as this is just discovery
      schema: z.object({
        query: z.string().min(1).describe('The search query or task description'),
        category: z.string().optional().describe('Optional category to filter by'),
        limit: z.number().min(1).max(20).optional().describe('Maximum number of results to return'),
        usageTier: z.enum(['free', 'paid', 'both']).optional().describe('Filter by pricing tier')
      }),
      async func(args: { 
        query: string; 
        category?: string;
        limit?: number;
        usageTier?: 'free' | 'paid' | 'both'
      }): Promise<string> {
        try {
          const actors = await apifyManager.discoverActors(args.query, {
            category: args.category,
            limit: args.limit || 5,
            usageTier: args.usageTier || 'both',
            sortBy: 'relevance',
            minRating: 3.5
          });
          
          if (actors.length === 0) {
            return `No actors found matching "${args.query}". Try a different search term or category.`;
          }
          
          // Format the results
          let result = `Found ${actors.length} Apify actors matching "${args.query}":\n\n`;
          
          actors.forEach((actor, index) => {
            result += `[${index + 1}] ${actor.name} (${actor.id})\n`;
            result += `   Description: ${actor.description.substring(0, 150)}${actor.description.length > 150 ? '...' : ''}\n`;
            result += `   Categories: ${actor.categories.join(', ')}\n`;
            result += `   Rating: ${actor.rating ? actor.rating.toFixed(1) + '/5' : 'N/A'}\n`;
            result += `   Cost: ${actor.costEstimate}, Tier: ${actor.usageTier}\n\n`;
          });
          
          result += `To run a discovered actor, use the "apify-dynamic-run" tool with the actor ID.`;
          
          return result;
        } catch (error) {
          logger.error('Error in apify-actor-discovery tool:', error);
          return `Error discovering actors: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'apify-suggest-actors': {
      name: 'apify-suggest-actors',
      description: 'Suggest Apify actors for a specific task based on task description',
      costEstimate: 'low',
      usageLimit: 50, // Higher limit as this is just suggestion
      schema: z.object({
        taskDescription: z.string().min(10).describe('Description of the task you want to accomplish'),
        count: z.number().min(1).max(10).optional().describe('Number of suggestions to return')
      }),
      async func(args: { 
        taskDescription: string; 
        count?: number;
      }): Promise<string> {
        try {
          const actors = await apifyManager.suggestActorsForTask(args.taskDescription, args.count || 3);
          
          if (actors.length === 0) {
            return `No suitable actors found for the task: "${args.taskDescription}". Try describing the task differently or use the apify-actor-discovery tool to search manually.`;
          }
          
          // Format the results
          let result = `Suggested actors for task: "${args.taskDescription}":\n\n`;
          
          actors.forEach((actor, index) => {
            result += `[${index + 1}] ${actor.name} (${actor.id})\n`;
            result += `   Description: ${actor.description.substring(0, 150)}${actor.description.length > 150 ? '...' : ''}\n`;
            result += `   Rating: ${actor.rating ? actor.rating.toFixed(1) + '/5' : 'N/A'}\n`;
            result += `   Cost: ${actor.costEstimate}, Tier: ${actor.usageTier}\n\n`;
            
            if (actor.examples && actor.examples.length > 0) {
              result += `   Example use case: ${actor.examples[0]}\n\n`;
            }
          });
          
          result += `To run a suggested actor, use the "apify-dynamic-run" tool with the actor ID.`;
          
          return result;
        } catch (error) {
          logger.error('Error in apify-suggest-actors tool:', error);
          return `Error suggesting actors: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'apify-dynamic-run': {
      name: 'apify-dynamic-run',
      description: 'Run any Apify actor by ID with custom input parameters',
      costEstimate: 'high',
      usageLimit: 5, // Lower limit due to potential cost
      schema: z.object({
        actorId: z.string().min(1).describe('The ID of the Apify actor to run'),
        input: z.record(z.any()).describe('The input parameters for the actor (depends on the actor)'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { 
        actorId: string; 
        input: Record<string, any>;
        dryRun?: boolean;
      }): Promise<string> {
        try {
          // First, get actor information to provide context
          const actorInfo = await apifyManager.getActorInfo(args.actorId);
          
          // Check if this is a dry run
          const isDryRun = args.dryRun || false;
          
          if (isDryRun) {
            return `[DRY RUN] Would run Apify actor: ${actorInfo.name} (${args.actorId})\nInput: ${JSON.stringify(args.input, null, 2)}\n\nThis is a dry run - no actual API call was made.`;
          }
          
          // Validate with the user for paid actors
          if (actorInfo.usageTier === 'paid' && !args.dryRun) {
            return `I need your explicit approval to run the paid actor "${actorInfo.name}" (${args.actorId}). This may incur costs.\n\nTo approve, please reply with: "approve run for ${args.actorId}" or try with dryRun: true first.`;
          }
          
          // Run the actor
          const result = await apifyManager.dynamicRunActor(args.actorId, args.input, {
            label: `Dynamic run: ${actorInfo.name}`,
            dryRun: isDryRun
          });
          
          if (!result.success || !result.output) {
            return `Failed to run actor "${actorInfo.name}" (${args.actorId}): ${result.error || 'Unknown error'}`;
          }
          
          // Format results - this is generic since we don't know the output format
          let outputSummary: string;
          
          if (Array.isArray(result.output)) {
            // Try to detect the type of output and format accordingly
            if (result.output.length === 0) {
              outputSummary = "The actor ran successfully but returned no data.";
            } else {
              // Take first 5 items max
              const items = result.output.slice(0, 5);
              
              // Generic formatting of the first few items
              outputSummary = items.map((item: any, index: number) => {
                if (typeof item === 'object') {
                  // Format object properties (up to 5 properties)
                  const properties = Object.entries(item).slice(0, 5).map(([key, value]) => {
                    // Format the value based on its type
                    let formattedValue: string;
                    if (typeof value === 'object') {
                      formattedValue = 'complex object';
                    } else {
                      formattedValue = String(value).substring(0, 100);
                      if (String(value).length > 100) formattedValue += '...';
                    }
                    return `${key}: ${formattedValue}`;
                  }).join('\n      ');
                  
                  return `[${index + 1}] Item:\n      ${properties}`;
                } else {
                  // Simple value
                  return `[${index + 1}] ${String(item).substring(0, 500)}`;
                }
              }).join('\n\n');
              
              if (result.output.length > 5) {
                outputSummary += `\n\n... and ${result.output.length - 5} more items`;
              }
            }
          } else {
            outputSummary = "The actor returned non-array data. Unable to format results.";
          }
          
          return `Results from running "${actorInfo.name}" (${args.actorId}):\n\n${outputSummary}`;
        } catch (error) {
          logger.error('Error in apify-dynamic-run tool:', error);
          return `Error running actor: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },
    
    'apify-actor-info': {
      name: 'apify-actor-info',
      description: 'Get detailed information about a specific Apify actor',
      costEstimate: 'low',
      usageLimit: 50, // Higher limit as this is just information
      schema: z.object({
        actorId: z.string().min(1).describe('The ID of the Apify actor to get information about')
      }),
      async func(args: { actorId: string }): Promise<string> {
        try {
          const actor = await apifyManager.getActorInfo(args.actorId);
          
          // Format the detailed information
          let result = `Actor Information: ${actor.name} (${actor.id})\n\n`;
          result += `Description: ${actor.description}\n\n`;
          result += `Categories: ${actor.categories.join(', ')}\n`;
          result += `Author: ${actor.author || 'Unknown'}\n`;
          result += `Rating: ${actor.rating ? actor.rating.toFixed(1) + '/5' : 'N/A'}\n`;
          result += `Popularity: ${actor.popularity || 0} runs in the last 30 days\n`;
          result += `Cost: ${actor.costEstimate}, Tier: ${actor.usageTier}\n`;
          result += `Last Updated: ${actor.lastUpdated || 'Unknown'}\n\n`;
          
          // Add examples if available
          if (actor.examples && actor.examples.length > 0) {
            result += `Example Uses:\n`;
            actor.examples.slice(0, 3).forEach((example, index) => {
              result += `[${index + 1}] ${example}\n`;
            });
            result += '\n';
          }
          
          // Add input schema info if available
          if (actor.inputSchema) {
            try {
              let inputFields: string[] = [];
              
              // Basic attempt to extract fields from schema - this will vary by actor
              if (typeof actor.inputSchema === 'object' && actor.inputSchema.properties) {
                inputFields = Object.keys(actor.inputSchema.properties);
              } else if (typeof actor.inputSchema === 'string') {
                const parsed = JSON.parse(actor.inputSchema);
                if (parsed.properties) {
                  inputFields = Object.keys(parsed.properties);
                }
              }
              
              if (inputFields.length > 0) {
                result += `Input Parameters: ${inputFields.join(', ')}\n\n`;
              }
            } catch (e) {
              // Ignore schema parsing errors
            }
          }
          
          result += `To run this actor, use the "apify-dynamic-run" tool with the actor ID "${actor.id}".`;
          
          return result;
        } catch (error) {
          logger.error('Error in apify-actor-info tool:', error);
          return `Error getting actor information: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  };
}

/**
 * Create a dynamic Apify tool from actor metadata
 * 
 * @param apifyManager An instance of IApifyManager
 * @param actorMetadata Metadata for the actor
 * @returns A tool definition for the actor
 */
export function createDynamicApifyTool(
  apifyManager: IApifyManager,
  actorMetadata: ApifyActorMetadata
): ToolDefinition {
  // Try to build schema from metadata input schema
  let schema: z.ZodType<any, any>;
  
  try {
    schema = buildSchemaFromMetadata(actorMetadata.inputSchema);
  } catch (error) {
    // Fallback to generic record if schema building fails
    schema = z.object({
      input: z.record(z.any()).describe('Input parameters for the actor'),
      dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
    });
  }
  
  return {
    name: `apify-dynamic-${actorMetadata.id.replace(/\//g, '-')}`,
    description: `${actorMetadata.description} (${actorMetadata.id})`,
    costEstimate: actorMetadata.costEstimate,
    usageLimit: actorMetadata.usageTier === 'free' ? 20 : 5,
    schema,
    async func(args: any): Promise<string> {
      try {
        const result = await apifyManager.dynamicRunActor(
          actorMetadata.id,
          args,
          { label: `Dynamic run: ${actorMetadata.name}` }
        );
        
        if (!result.success) {
          return `Failed to run ${actorMetadata.name}: ${result.error}`;
        }
        
        return formatDynamicActorResult(result.output, actorMetadata);
      } catch (error) {
        logger.error(`Error in dynamic Apify tool for ${actorMetadata.id}:`, error);
        return `Error running ${actorMetadata.name}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  };
}

/**
 * Build a zod schema from actor metadata input schema
 * 
 * @param inputSchema Input schema from actor metadata
 * @returns A zod schema for the actor input
 */
function buildSchemaFromMetadata(inputSchema: any): z.ZodType<any, any> {
  // Basic implementation - would need more sophisticated parsing for complex schemas
  if (!inputSchema) {
    return z.object({
      input: z.record(z.any()).describe('Input parameters for the actor'),
      dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
    });
  }
  
  try {
    // Parse if it's a string
    const schema = typeof inputSchema === 'string' ? JSON.parse(inputSchema) : inputSchema;
    
    if (schema.properties) {
      // Convert JSON Schema to Zod schema (simplified)
      const zodSchema: Record<string, z.ZodType<any, any>> = {};
      
      Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
        let fieldSchema: z.ZodType<any, any>;
        
        switch (value.type) {
          case 'string':
            fieldSchema = z.string();
            break;
          case 'number':
            fieldSchema = z.number();
            break;
          case 'boolean':
            fieldSchema = z.boolean();
            break;
          case 'array':
            fieldSchema = z.array(z.any());
            break;
          case 'object':
            fieldSchema = z.record(z.any());
            break;
          default:
            fieldSchema = z.any();
        }
        
        if (value.description) {
          fieldSchema = fieldSchema.describe(value.description);
        }
        
        zodSchema[key] = fieldSchema;
      });
      
      return z.object(zodSchema);
    }
  } catch (error) {
    logger.warn(`Error parsing input schema: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Fallback
  return z.object({
    input: z.record(z.any()).describe('Input parameters for the actor'),
    dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
  });
}

/**
 * Format the result of a dynamic actor run
 * 
 * @param output Output from the actor run
 * @param actorMetadata Metadata for the actor
 * @returns Formatted result string
 */
function formatDynamicActorResult(output: any, actorMetadata: ApifyActorMetadata): string {
  if (!output || (Array.isArray(output) && output.length === 0)) {
    return `The actor ${actorMetadata.name} ran successfully but returned no data.`;
  }
  
  try {
    if (Array.isArray(output)) {
      // Take first 5 items max
      const items = output.slice(0, 5);
      
      // Format based on the output structure
      let formattedResult: string;
      
      if (typeof items[0] === 'object') {
        formattedResult = items.map((item, index) => {
          // Format object properties (up to 5 properties)
          const properties = Object.entries(item).slice(0, 5).map(([key, value]) => {
            // Format the value based on its type
            let formattedValue: string;
            if (typeof value === 'object') {
              formattedValue = 'complex object';
            } else {
              formattedValue = String(value).substring(0, 100);
              if (String(value).length > 100) formattedValue += '...';
            }
            return `${key}: ${formattedValue}`;
          }).join('\n      ');
          
          return `[${index + 1}] Item:\n      ${properties}`;
        }).join('\n\n');
      } else {
        // Simple values
        formattedResult = items.map((item, index) => {
          return `[${index + 1}] ${String(item).substring(0, 500)}`;
        }).join('\n\n');
      }
      
      if (output.length > 5) {
        formattedResult += `\n\n... and ${output.length - 5} more items`;
      }
      
      return `Results from running "${actorMetadata.name}":\n\n${formattedResult}`;
    } else {
      // Non-array output
      return `Results from running "${actorMetadata.name}":\n\n${JSON.stringify(output, null, 2).substring(0, 1000)}`;
    }
  } catch (error) {
    logger.error(`Error formatting result for ${actorMetadata.id}:`, error);
    return `Results from running "${actorMetadata.name}" (unable to format properly): ${String(output).substring(0, 500)}`;
  }
} 