import { NextApiRequest, NextApiResponse } from 'next';
import defaultApifyManager from '../../../agents/shared/tools/integrations/apify';
import { SharedToolRegistry } from '../../../agents/shared/tools/registry/SharedToolRegistry';
import { getAgentById } from '../../../server/agent/agent-service';
import { Tool as ManagerTool, ToolManager } from '../../../lib/agents/base/managers/ToolManager';
import { Tool as RegistryTool, ToolExecutionResult } from '../../../lib/tools/types';

// Initialize the shared tool registry
const sharedToolRegistry = new SharedToolRegistry({
  apifyManager: defaultApifyManager
});

/**
 * Adapter to convert between registry Tool and manager Tool interfaces
 * This handles the different execute method signatures
 */
function adaptRegistryToolToManagerTool(registryTool: RegistryTool): ManagerTool {
  return {
    id: registryTool.id,
    name: registryTool.name,
    description: registryTool.description,
    // Convert single category to array of categories for ManagerTool
    categories: registryTool.category ? [registryTool.category] : [],
    enabled: registryTool.enabled,
    // Add default values for properties that exist in ManagerTool but not in RegistryTool
    capabilities: [],
    version: '1.0.0',
    experimental: false,
    costPerUse: 1,
    timeoutMs: 30000,
    metadata: registryTool.metadata,
    
    // Adapt the execute method signature
    execute: async (params: unknown, context?: unknown): Promise<unknown> => {
      try {
        // Convert params to Record<string, unknown> as expected by registry tool
        const typedParams = params as Record<string, unknown>;
        
        // Call the original execute method
        const result = await registryTool.execute(typedParams);
        
        // Return the result data
        return result.data || result;
      } catch (error) {
        // Re-throw the error
        throw error;
      }
    }
  };
}

/**
 * API endpoint for discovering Apify actors
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { query, category, limit = 5, operation, actorId, agentId } = req.body;

    // Different operations based on the requested functionality
    switch (operation) {
      case 'discover':
        // Discover actors based on query or category
        if (!query && !category) {
          return res.status(400).json({ 
            success: false, 
            error: 'Either query or category is required for discovery' 
          });
        }

        const actors = await defaultApifyManager.discoverActors(query || '', {
          category,
          limit: Number(limit),
          minRating: 3.5,
          sortBy: 'popularity'
        });

        return res.status(200).json({ 
          success: true, 
          actors,
          count: actors.length
        });

      case 'get-actor-info':
        // Get detailed information about a specific actor
        if (!actorId) {
          return res.status(400).json({ 
            success: false, 
            error: 'Actor ID is required to get actor info' 
          });
        }

        const actorInfo = await defaultApifyManager.getActorInfo(actorId);
        
        return res.status(200).json({
          success: true,
          actor: actorInfo
        });

      case 'suggest-actors':
        // Suggest actors for a specific task
        if (!query) {
          return res.status(400).json({
            success: false,
            error: 'Task description is required to suggest actors'
          });
        }

        const suggestedActors = await defaultApifyManager.suggestActorsForTask(query, Number(limit) || 3);
        
        return res.status(200).json({
          success: true,
          actors: suggestedActors,
          count: suggestedActors.length
        });

      case 'register-actor':
        // Register an actor with the shared tool registry and agent
        if (!actorId) {
          return res.status(400).json({
            success: false,
            error: 'Actor ID is required to register an actor'
          });
        }

        // Get actor metadata
        const actorMetadata = await defaultApifyManager.getActorInfo(actorId);
        
        // Register with the shared tool registry
        const registeredTool = sharedToolRegistry.registerApifyActor(actorMetadata);
        
        // If an agent ID is provided, register with that agent's tool manager
        let agentRegistration = null;
        if (agentId && registeredTool) {
          const agent = await getAgentById(agentId);
          if (agent) {
            // Get the agent's tool manager using getManager method
            const toolManager = agent.getManager('tool') as ToolManager;
            
            if (toolManager) {
              try {
                // Convert registry tool to manager tool format
                const managerTool = adaptRegistryToolToManagerTool(registeredTool);
                
                // Register the adapted tool
                await toolManager.registerTool(managerTool);
                agentRegistration = {
                  success: true,
                  agentId,
                  toolId: registeredTool.id
                };
              } catch (error) {
                agentRegistration = {
                  success: false,
                  agentId,
                  error: error instanceof Error ? error.message : 'Unknown error registering tool with agent'
                };
              }
            } else {
              agentRegistration = {
                success: false,
                agentId,
                error: 'Agent does not have a tool manager'
              };
            }
          }
        }
        
        return res.status(200).json({
          success: !!registeredTool,
          actor: actorMetadata,
          toolId: registeredTool?.id,
          agentRegistration
        });

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown operation: ${operation}`
        });
    }
  } catch (error) {
    console.error('Error in Apify discovery API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error in Apify discovery API' 
    });
  }
} 