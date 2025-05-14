/**
 * ToolDiscoveryService.ts - Service for tool discovery and registration
 * 
 * This file provides a service for discovering and registering tools with the agent
 * system. It bridges between our SharedToolRegistry and the agent's ToolManager.
 */

import { Tool as RegistryTool, ToolCategory } from '../../../../lib/tools/types';
import { ToolManager } from '../../../../lib/agents/base/managers/ToolManager';
import defaultRegistry from '../registry';
import { logger } from '../../../../lib/logging';
import { ApifyActorMetadata } from '../integrations/apify';
import { adaptRegistryToolToManagerTool } from '../adapters/ToolAdapter';

/**
 * Options for tool discovery
 */
export interface ToolDiscoveryOptions {
  /** Tool categories to include */
  categories?: ToolCategory[];
  
  /** Specific tools to include by ID pattern (glob-like) */
  includeTools?: string[];
  
  /** Specific tools to exclude by ID pattern (glob-like) */
  excludeTools?: string[];
  
  /** Whether to include custom tools */
  includeCustomTools?: boolean;
}

/**
 * Service for discovering and registering tools with the agent system
 */
export class ToolDiscoveryService {
  private toolManager: ToolManager;
  
  /**
   * Create a new tool discovery service
   * 
   * @param toolManager The tool manager to register tools with
   */
  constructor(toolManager: ToolManager) {
    this.toolManager = toolManager;
  }
  
  /**
   * Discover and register all tools from the shared registry
   * 
   * @param options Options for tool discovery
   * @returns Number of tools registered
   */
  discoverAndRegisterTools(options: ToolDiscoveryOptions = {}): number {
    const {
      categories = Object.values(ToolCategory),
      includeTools = [],
      excludeTools = [],
      includeCustomTools = true
    } = options;
    
    // Get all tools from the registry
    const allTools = defaultRegistry.getAllTools();
    
    // Filter tools based on options
    const filteredTools = allTools.filter(tool => {
      // Check if tool is enabled
      if (!tool.enabled) return false;
      
      // Check if tool's category is included
      if (!categories.includes(tool.category)) return false;
      
      // Check if tool is explicitly included/excluded
      const toolId = tool.id;
      
      // Check excludes first (they take precedence)
      for (const pattern of excludeTools) {
        if (this.matchesPattern(toolId, pattern)) return false;
      }
      
      // If includes are specified, tool must match at least one
      if (includeTools.length > 0) {
        let matched = false;
        for (const pattern of includeTools) {
          if (this.matchesPattern(toolId, pattern)) {
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      }
      
      // Check for custom tools
      if (tool.category === ToolCategory.CUSTOM && !includeCustomTools) {
        return false;
      }
      
      return true;
    });
    
    // Register filtered tools with the tool manager
    let registered = 0;
    for (const tool of filteredTools) {
      try {
        // Convert registry tool to manager tool format using the centralized adapter
        const managerTool = adaptRegistryToolToManagerTool(tool);
        
        // Register the adapted tool
        this.toolManager.registerTool(managerTool);
        registered++;
      } catch (error) {
        logger.warn(`Failed to register tool ${tool.id}:`, error);
      }
    }
    
    logger.info(`Registered ${registered} of ${filteredTools.length} available tools`);
    return registered;
  }
  
  /**
   * Discover and register Apify actors as tools
   * 
   * @param query Search query
   * @param count Maximum number of actors to register
   * @returns Number of actors registered
   */
  async discoverAndRegisterApifyActors(query: string, count = 5): Promise<number> {
    const actors = await defaultRegistry.discoverAndRegisterActors(query, count);
    
    if (actors > 0) {
      // Register newly added tools with the tool manager
      const apifyTools = defaultRegistry.findTools({
        category: ToolCategory.WEB
      }).filter(tool => tool.id.startsWith('apify-dynamic-'));
      
      for (const tool of apifyTools) {
        try {
          // Convert registry tool to manager tool format using the centralized adapter
          const managerTool = adaptRegistryToolToManagerTool(tool);
          
          // Register the adapted tool
          this.toolManager.registerTool(managerTool);
        } catch (error) {
          logger.warn(`Failed to register Apify actor ${tool.id}:`, error);
        }
      }
    }
    
    return actors;
  }
  
  /**
   * Register a specific Apify actor as a tool
   * 
   * @param actorMetadata Actor metadata
   * @returns Whether the actor was registered successfully
   */
  registerApifyActor(actorMetadata: ApifyActorMetadata): boolean {
    const tool = defaultRegistry.registerApifyActor(actorMetadata);
    
    if (tool) {
      try {
        // Convert registry tool to manager tool format using the centralized adapter
        const managerTool = adaptRegistryToolToManagerTool(tool);
        
        // Register the adapted tool
        this.toolManager.registerTool(managerTool);
        return true;
      } catch (error) {
        logger.warn(`Failed to register Apify actor ${actorMetadata.id}:`, error);
      }
    }
    
    return false;
  }
  
  /**
   * Check if a tool ID matches a pattern
   * 
   * @param toolId Tool ID
   * @param pattern Pattern (supports * wildcard)
   * @returns Whether the tool ID matches the pattern
   * @private
   */
  private matchesPattern(toolId: string, pattern: string): boolean {
    // Simple pattern matching with * wildcard
    if (pattern === '*') return true;
    
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(toolId);
    }
    
    return toolId === pattern;
  }
} 