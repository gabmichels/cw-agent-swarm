/**
 * Core Apify Tools - Discovery, dynamic execution, and actor information tools
 */

import { z } from 'zod';
import { logger } from '../../../../../../lib/logging';
import { IApifyManager } from '../ApifyManager.interface';
import { ToolDefinition } from '../types';

export function createCoreApifyTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
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
            return `No actors found matching "${args.query}". This could be due to:
1. No matching actors in the Apify Store for your search term
2. API rate limiting or temporary service issues
3. Network connectivity problems

The search was performed using the official Apify Store API endpoint.
Try a different search term or check the Apify Store directly at https://apify.com/store?search=${encodeURIComponent(args.query)}`;
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
          
          // Provide helpful error message based on error type
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
            return `Actor discovery failed: Invalid or missing Apify API key. Please check your APIFY_API_KEY environment variable.`;
          } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
            return `Actor discovery failed: API rate limit exceeded. Please try again later or reduce the frequency of requests.`;
          } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            return `Actor discovery failed: Network connectivity issue. Please check your internet connection and try again.`;
          } else {
            return `Actor discovery failed: ${errorMessage}. You can browse actors manually at https://apify.com/store`;
          }
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