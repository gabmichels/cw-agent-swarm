/**
 * Tool Integration Service - Connects SharedToolRegistry with Agent ToolManager
 * 
 * This service handles the integration between the shared tool registry and
 * individual agent tool managers, facilitating tool discovery and registration.
 */

import { AgentBase } from '../../agents/shared/base/AgentBase.interface';
import { ToolDiscoveryService, ToolDiscoveryOptions } from '../../agents/shared/tools/discovery/ToolDiscoveryService';
import { SharedToolRegistry } from '../../agents/shared/tools/registry/SharedToolRegistry';
import defaultRegistry from '../../agents/shared/tools/registry';
import { logger } from '../../lib/logging';
import { getAgentById } from './agent-service';
import { ToolCategory } from '../../lib/tools/types';
import { ApifyActorMetadata } from '../../agents/shared/tools/integrations/apify';
import { ToolManager } from '../../lib/agents/base/managers/ToolManager';

/**
 * Connect an agent to the shared tool registry
 * 
 * @param agentId ID of the agent to connect
 * @param options Tool discovery options
 * @returns Number of tools registered with the agent
 */
export async function connectAgentToSharedTools(
  agentId: string,
  options: ToolDiscoveryOptions = {}
): Promise<number> {
  const agent = getAgentById(agentId);
  
  if (!agent) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }
  
  // Get the agent's tool manager
  const toolManager = agent.getManager('tool') as ToolManager;
  
  if (!toolManager) {
    throw new Error(`Agent ${agentId} does not have a tool manager`);
  }
  
  // Create discovery service for this agent
  const discoveryService = new ToolDiscoveryService(toolManager);
  
  // Register tools with the agent
  const registeredCount = discoveryService.discoverAndRegisterTools(options);
  
  logger.info(`Connected agent ${agentId} to shared tools, registered ${registeredCount} tools`);
  
  return registeredCount;
}

/**
 * Register an Apify actor with an agent
 * 
 * @param agentId ID of the agent to register the actor with
 * @param actorMetadata Metadata for the actor to register
 * @returns Whether the actor was successfully registered
 */
export async function registerApifyActorWithAgent(
  agentId: string,
  actorMetadata: ApifyActorMetadata
): Promise<boolean> {
  const agent = getAgentById(agentId);
  
  if (!agent) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }
  
  // Get the agent's tool manager
  const toolManager = agent.getManager('tool') as ToolManager;
  
  if (!toolManager) {
    throw new Error(`Agent ${agentId} does not have a tool manager`);
  }
  
  // Create discovery service for this agent
  const discoveryService = new ToolDiscoveryService(toolManager);
  
  // Register the actor
  const success = discoveryService.registerApifyActor(actorMetadata);
  
  if (success) {
    logger.info(`Registered Apify actor ${actorMetadata.id} with agent ${agentId}`);
  } else {
    logger.warn(`Failed to register Apify actor ${actorMetadata.id} with agent ${agentId}`);
  }
  
  return success;
}

/**
 * Discover and register Apify actors for an agent
 * 
 * @param agentId ID of the agent to register actors with
 * @param query Search query for actors
 * @param count Maximum number of actors to register
 * @returns Number of actors registered
 */
export async function discoverApifyActorsForAgent(
  agentId: string,
  query: string,
  count = 5
): Promise<number> {
  const agent = getAgentById(agentId);
  
  if (!agent) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }
  
  // Get the agent's tool manager
  const toolManager = agent.getManager('tool') as ToolManager;
  
  if (!toolManager) {
    throw new Error(`Agent ${agentId} does not have a tool manager`);
  }
  
  // Create discovery service for this agent
  const discoveryService = new ToolDiscoveryService(toolManager);
  
  // Discover and register actors
  const registeredCount = await discoveryService.discoverAndRegisterApifyActors(query, count);
  
  logger.info(`Discovered and registered ${registeredCount} Apify actors for agent ${agentId}`);
  
  return registeredCount;
}

/**
 * Connect all registered agents to the shared tool registry
 * 
 * @param registry Optional custom registry to use
 * @param options Tool discovery options
 * @returns Map of agent IDs to number of tools registered
 */
export async function connectAllAgentsToSharedTools(
  registry?: SharedToolRegistry,
  options: ToolDiscoveryOptions = {}
): Promise<Map<string, number>> {
  // Use the specified registry or the default
  const toolRegistry = registry || defaultRegistry;
  
  // Get all agents from the agent service
  const agents = await import('./agent-service').then(service => service.getAllAgents());
  
  const results = new Map<string, number>();
  
  for (const agent of agents) {
    const agentId = agent.getAgentId();
    try {
      // Get the agent's tool manager
      const toolManager = agent.getManager('tool') as ToolManager;
      
      if (!toolManager) {
        logger.warn(`Agent ${agentId} does not have a tool manager, skipping`);
        results.set(agentId, 0);
        continue;
      }
      
      // Create discovery service for this agent
      const discoveryService = new ToolDiscoveryService(toolManager);
      
      // Register tools with the agent
      const registeredCount = discoveryService.discoverAndRegisterTools(options);
      
      results.set(agentId, registeredCount);
      
      logger.info(`Connected agent ${agentId} to shared tools, registered ${registeredCount} tools`);
    } catch (error) {
      logger.error(`Error connecting agent ${agentId} to shared tools:`, error);
      results.set(agentId, 0);
    }
  }
  
  return results;
} 