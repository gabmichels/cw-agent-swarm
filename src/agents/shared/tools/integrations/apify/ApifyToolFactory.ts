/**
 * ApifyToolFactory.ts - Factory for creating Apify tools
 * 
 * This file provides a factory function for creating Apify tools that can be
 * registered with the agent tool system.
 */

import { logger } from '../../../../../lib/logging';
import { IApifyManager, ApifyActorMetadata } from './ApifyManager.interface';
import { z } from 'zod';

// Import tool modules
import { 
  createCoreApifyTools,
  createInstagramTools,
  createFacebookTools,
  createYouTubeTools,
  createLinkedInTools,
  createTwitterTools,
  createRedditTools,
  createWebScrapingTools,
  ToolDefinition
} from './tools';

/**
 * Create a set of Apify tools that can be registered with the tool system
 * 
 * @param apifyManager An instance of IApifyManager
 * @returns An object containing the Apify tools
 */
export function createApifyTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    // Core Apify tools (discovery, dynamic execution, actor info)
    ...createCoreApifyTools(apifyManager),
    
    // Social media platform tools
    ...createInstagramTools(apifyManager),
    ...createFacebookTools(apifyManager),
    ...createYouTubeTools(apifyManager),
    ...createLinkedInTools(apifyManager),
    ...createTwitterTools(apifyManager),
    ...createRedditTools(apifyManager),
    
    // Web scraping tools
    ...createWebScrapingTools(apifyManager)
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