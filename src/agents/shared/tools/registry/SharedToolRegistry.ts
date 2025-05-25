/**
 * SharedToolRegistry.ts - Central registry for shared tools
 * 
 * This file provides a central registry for all shared tool implementations,
 * allowing for discovery and registration with the agent tool system.
 */

import { Tool, ToolCategory, ToolExecutionResult } from '../../../../lib/tools/types';
import { IToolRegistry } from '../../../../lib/tools/interfaces/tool-registry.interface';
import { IdGenerator, StructuredId } from '../../../../utils/ulid';
import { logger } from '../../../../lib/logging';

// Import tool factories
import { createApifyTools, createDynamicApifyTool } from '../integrations/apify/ApifyToolFactory';
import defaultApifyManager, { IApifyManager, ApifyActorMetadata } from '../integrations/apify';

/**
 * Configuration for the shared tool registry
 */
export interface SharedToolRegistryConfig {
  /** Whether to enable all tools by default */
  enableAllTools?: boolean;
  
  /** Tool categories to include */
  enabledCategories?: ToolCategory[];
  
  /** Specific tools to enable by ID */
  enabledTools?: string[];
  
  /** Specific tools to disable by ID */
  disabledTools?: string[];
  
  /** Custom apify manager implementation */
  apifyManager?: IApifyManager;
}

/**
 * Central registry for all shared tool implementations
 */
export class SharedToolRegistry implements IToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private config: SharedToolRegistryConfig;
  private apifyManager: IApifyManager;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  
  /**
   * Create a new shared tool registry
   * 
   * @param config Configuration options
   */
  constructor(config: SharedToolRegistryConfig = {}) {
    this.config = {
      enableAllTools: true,
      enabledCategories: Object.values(ToolCategory),
      enabledTools: [],
      disabledTools: [],
      ...config
    };
    
    this.apifyManager = config.apifyManager || defaultApifyManager;
    
    // Start initialization but don't wait for it in constructor
    this.initializationPromise = this.initialize();
  }
  
  /**
   * Initialize the registry and register all default tools
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.registerDefaultTools();
      this.initialized = true;
      logger.info('SharedToolRegistry initialized successfully');
    } catch (error) {
      logger.error('Error initializing SharedToolRegistry:', error);
      throw error;
    }
  }
  
  /**
   * Ensure the registry is initialized before use
   */
  async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }
  
  /**
   * Register a tool with the registry
   * 
   * @param tool Tool to register
   */
  registerTool(tool: Tool): void {
    // Apply configuration-based enabling/disabling
    const enabled = this.shouldEnableTool(tool);
    
    // Create a proper copy that preserves the execute function
    const toolWithConfig: Tool = {
      ...tool,
      enabled,
      // Explicitly preserve the execute function
      execute: tool.execute
    };
    
    this.tools.set(tool.id, toolWithConfig);
    logger.info(`Registered tool: ${tool.id} (${enabled ? 'enabled' : 'disabled'})`);
  }
  
  /**
   * Register multiple tools at once
   * 
   * @param tools Array of tools to register
   */
  registerTools(tools: Tool[]): void {
    tools.forEach(tool => this.registerTool(tool));
  }
  
  /**
   * Get a tool by its ID
   * 
   * @param toolId Unique identifier of the tool
   * @returns The tool if found, null otherwise
   */
  getTool(toolId: string): Tool | null {
    return this.tools.get(toolId) || null;
  }
  
  /**
   * Get all registered tools
   * 
   * @returns Array of all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Find tools matching specific criteria
   * 
   * @param criteria Search criteria for tools
   * @returns Array of matching tools
   */
  findTools(criteria: Partial<Tool>): Tool[] {
    return this.getAllTools().filter(tool => {
      for (const [key, value] of Object.entries(criteria)) {
        if (tool[key as keyof Tool] !== value) {
          return false;
        }
      }
      return true;
    });
  }
  
  /**
   * Check if a tool with given ID exists
   * 
   * @param toolId Unique identifier of the tool
   * @returns True if tool exists, false otherwise
   */
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }
  
  /**
   * Remove a tool from the registry
   * 
   * @param toolId Unique identifier of the tool to remove
   * @returns True if tool was removed, false if not found
   */
  removeTool(toolId: string): boolean {
    return this.tools.delete(toolId);
  }
  
  /**
   * Register a dynamic Apify actor as a tool
   * 
   * @param actorMetadata Metadata for the actor
   * @returns The created tool
   */
  registerApifyActor(actorMetadata: ApifyActorMetadata): Tool | null {
    try {
      const toolDef = createDynamicApifyTool(this.apifyManager, actorMetadata);
      
      // Convert tool definition to Tool interface
      const tool: Tool = {
        id: toolDef.name,
        name: toolDef.name,
        description: toolDef.description,
        category: ToolCategory.WEB,
        enabled: true,
        schema: {
          type: 'object',
          properties: toolDef.schema,
        },
        metadata: {
          costEstimate: toolDef.costEstimate,
          usageLimit: toolDef.usageLimit,
          actorMetadata
        },
        execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            const result = await toolDef.func(args);
            const endTime = Date.now();
            
            return {
              id: IdGenerator.generate('trun'),
              toolId: toolDef.name,
              success: true,
              data: result,
              metrics: {
                startTime,
                endTime,
                durationMs: endTime - startTime
              }
            };
          } catch (error) {
            const endTime = Date.now();
            return {
              id: IdGenerator.generate('trun'),
              toolId: toolDef.name,
              success: false,
              error: {
                message: error instanceof Error ? error.message : String(error),
                code: 'EXECUTION_ERROR',
                details: error
              },
              metrics: {
                startTime,
                endTime,
                durationMs: endTime - startTime
              }
            };
          }
        }
      };
      
      this.registerTool(tool);
      return tool;
    } catch (error) {
      logger.error(`Error registering Apify actor ${actorMetadata.id}:`, error);
      return null;
    }
  }
  
  /**
   * Discover and register Apify actors matching a search query
   * 
   * @param query Search query
   * @param count Maximum number of actors to register
   * @returns Number of actors registered
   */
  async discoverAndRegisterActors(query: string, count = 5): Promise<number> {
    try {
      const actors = await this.apifyManager.discoverActors(query, {
        limit: count,
        minRating: 3.5,
        sortBy: 'popularity'
      });
      
      let registered = 0;
      for (const actor of actors) {
        const tool = this.registerApifyActor(actor);
        if (tool) registered++;
      }
      
      return registered;
    } catch (error) {
      logger.error('Error discovering and registering actors:', error);
      return 0;
    }
  }
  
  /**
   * Register default tools from all integrated systems
   * 
   * @private
   */
  private async registerDefaultTools(): Promise<void> {
    // Register Apify tools
    const apifyTools = createApifyTools(this.apifyManager);
    
    // Convert to Tool interface
    for (const [id, toolDef] of Object.entries(apifyTools)) {
      const tool: Tool = {
        id,
        name: toolDef.name,
        description: toolDef.description,
        category: ToolCategory.WEB,
        enabled: true,
        schema: {
          type: 'object',
          properties: toolDef.schema,
        },
        metadata: {
          costEstimate: toolDef.costEstimate,
          usageLimit: toolDef.usageLimit
        },
        execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            const result = await toolDef.func(args);
            const endTime = Date.now();
            
            return {
              id: IdGenerator.generate('trun'),
              toolId: id,
              success: true,
              data: result,
              metrics: {
                startTime,
                endTime,
                durationMs: endTime - startTime
              }
            };
          } catch (error) {
            const endTime = Date.now();
            return {
              id: IdGenerator.generate('trun'),
              toolId: id,
              success: false,
              error: {
                message: error instanceof Error ? error.message : String(error),
                code: 'EXECUTION_ERROR',
                details: error
              },
              metrics: {
                startTime,
                endTime,
                durationMs: endTime - startTime
              }
            };
          }
        }
      };
      
      this.registerTool(tool);
    }
    
    // Register web search tool
    try {
      const { createWebSearchTool } = await import('../web');
      const webSearchTool = createWebSearchTool();
      this.registerTool(webSearchTool);
      logger.info(`[INFO] Registered tool: ${webSearchTool.id} (enabled)`);
    } catch (error) {
      logger.warn('Could not register web search tool:', error);
    }
    
    // TODO: Register other shared tools here as they are implemented
  }
  
  /**
   * Determine if a tool should be enabled based on configuration
   * 
   * @param tool Tool to check
   * @returns Whether the tool should be enabled
   * @private
   */
  private shouldEnableTool(tool: Tool): boolean {
    // Check if tool is explicitly disabled
    if (this.config.disabledTools?.includes(tool.id)) {
      return false;
    }
    
    // Check if tool is explicitly enabled
    if (this.config.enabledTools?.includes(tool.id)) {
      return true;
    }
    
    // Check if category is enabled
    if (this.config.enabledCategories?.includes(tool.category)) {
      return this.config.enableAllTools === true;
    }
    
    return false;
  }
} 