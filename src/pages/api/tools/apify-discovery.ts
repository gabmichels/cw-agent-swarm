import { NextApiRequest, NextApiResponse } from 'next';
import defaultApifyManager from '../../../agents/shared/tools/integrations/apify';
import { SharedToolRegistry } from '../../../agents/shared/tools/registry/SharedToolRegistry';
import { getAgentById } from '../../../server/agent/agent-service';
import { ToolManager } from '../../../lib/agents/base/managers/ToolManager';
import { Tool as RegistryTool } from '../../../lib/tools/types';
import { adaptRegistryToolToManagerTool, getAgentToolManager } from '../../../agents/shared/tools/adapters/ToolAdapter';

// Initialize the shared tool registry
const sharedToolRegistry = new SharedToolRegistry({
  apifyManager: defaultApifyManager
});

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
          try {
            const agent = await getAgentById(agentId);
            
            if (!agent) {
              throw new Error(`Agent with ID ${agentId} not found`);
            }
            
            // Get the agent's tool manager using the centralized adapter
            const toolManager = getAgentToolManager(agent, `Agent ${agentId} does not have a tool manager`);
            
            // Convert registry tool to manager tool format using the centralized adapter
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