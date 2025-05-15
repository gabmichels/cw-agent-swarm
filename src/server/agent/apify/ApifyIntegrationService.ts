/**
 * ApifyIntegrationService - Handles Apify actor integration with agents
 */

import { AgentBase } from '../../../agents/shared/base/AgentBase.interface';
import { ToolDiscoveryService } from '../../../agents/shared/tools/discovery/ToolDiscoveryService';
import { ApifyActorMetadata } from '../../../agents/shared/tools/integrations/apify';
import { ToolManager } from '../../../agents/shared/base/managers/ToolManager.interface';
import { ManagerType } from '../../../agents/shared/base/managers/ManagerType';
import { logger } from '../../../lib/logging';

/**
 * Service for integrating Apify actors with agents
 */
export class ApifyIntegrationService {
  /**
   * Register an Apify actor with an agent
   * 
   * @param agent The agent to register the actor with
   * @param actorMetadata Metadata for the actor to register
   * @returns Whether the actor was successfully registered
   */
  async registerActor(agent: AgentBase, actorMetadata: ApifyActorMetadata): Promise<boolean> {
    try {
      logger.debug(`Registering Apify actor ${actorMetadata.id} with agent ${agent.getAgentId()}`);
      
      // Get the tool manager
      const toolManager = agent.getManager<ToolManager>(ManagerType.TOOL);
      
      if (!toolManager) {
        throw new Error(`Agent ${agent.getAgentId()} does not have a tool manager`);
      }
      
      // Create discovery service for this agent
      const discoveryService = new ToolDiscoveryService(toolManager);
      
      // Register the actor
      const success = discoveryService.registerApifyActor(actorMetadata);
      
      if (success) {
        logger.info(`Registered Apify actor ${actorMetadata.id} with agent ${agent.getAgentId()}`);
      } else {
        logger.warn(`Failed to register Apify actor ${actorMetadata.id} with agent ${agent.getAgentId()}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`Failed to register Apify actor ${actorMetadata.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Discover and register Apify actors for an agent
   * 
   * @param agent The agent to register actors with
   * @param query Search query for actors
   * @param count Maximum number of actors to register
   * @returns Number of actors registered
   */
  async discoverActors(agent: AgentBase, query: string, count = 5): Promise<number> {
    try {
      logger.debug(`Discovering Apify actors for agent ${agent.getAgentId()}`);
      
      // Get the tool manager
      const toolManager = agent.getManager<ToolManager>(ManagerType.TOOL);
      
      if (!toolManager) {
        throw new Error(`Agent ${agent.getAgentId()} does not have a tool manager`);
      }
      
      // Create discovery service for this agent
      const discoveryService = new ToolDiscoveryService(toolManager);
      
      // Discover and register actors
      const registeredCount = await discoveryService.discoverAndRegisterApifyActors(query, count);
      
      logger.info(`Discovered and registered ${registeredCount} Apify actors for agent ${agent.getAgentId()}`);
      
      return registeredCount;
    } catch (error) {
      logger.error(`Failed to discover Apify actors:`, error);
      throw error;
    }
  }
} 