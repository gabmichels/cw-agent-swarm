import { IdGenerator } from '@/utils/ulid';
import { Tool, ToolParameter, ToolExecutionResult } from './IToolService';
import { ToolRegistry } from './ToolRegistry';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { glob } from 'glob';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Plugin interface for external tools
 */
export interface Plugin {
  /**
   * Unique ID for the plugin
   */
  id: string;
  
  /**
   * Name of the plugin
   */
  name: string;
  
  /**
   * Description of the plugin
   */
  description: string;
  
  /**
   * Version of the plugin
   */
  version: string;
  
  /**
   * Author of the plugin
   */
  author: string;
  
  /**
   * Homepage or documentation URL
   */
  homepage?: string;
  
  /**
   * Tools provided by this plugin
   */
  tools: Array<Tool>;
  
  /**
   * List of other plugins this plugin depends on
   */
  dependencies?: Array<string>;
  
  /**
   * Required environment variables
   */
  requiredEnvVars?: Array<string>;
  
  /**
   * Callback to initialize the plugin
   */
  initialize?: () => Promise<boolean>;
  
  /**
   * Callback to execute a tool
   */
  executeTool: (
    toolId: string,
    parameters: Record<string, any>,
    context?: any
  ) => Promise<ToolExecutionResult>;
  
  /**
   * Callback to clean up resources when the plugin is unloaded
   */
  cleanup?: () => Promise<void>;
  
  /**
   * Metadata for the plugin
   */
  metadata?: Record<string, any>;
}

/**
 * Plugin installation status
 */
export type PluginStatus = 
  | 'installed'
  | 'active'
  | 'inactive'
  | 'error'
  | 'missing_dependencies'
  | 'incompatible';

/**
 * Plugin manifest file structure
 */
export interface PluginManifest {
  /**
   * Name of the plugin
   */
  name: string;
  
  /**
   * Description of the plugin
   */
  description: string;
  
  /**
   * Version of the plugin
   */
  version: string;
  
  /**
   * Author of the plugin
   */
  author: string;
  
  /**
   * Homepage or documentation URL
   */
  homepage?: string;
  
  /**
   * Main entry point for the plugin
   */
  main: string;
  
  /**
   * List of other plugins this plugin depends on
   */
  dependencies?: Array<string>;
  
  /**
   * Required environment variables
   */
  requiredEnvVars?: Array<string>;
  
  /**
   * Minimum supported agent version
   */
  minAgentVersion?: string;
  
  /**
   * Maximum supported agent version
   */
  maxAgentVersion?: string;
}

/**
 * Plugin system for external tool integration
 */
export class PluginSystem {
  /**
   * Registry of loaded plugins
   */
  private plugins: Map<string, Plugin> = new Map();
  
  /**
   * Plugin statuses
   */
  private pluginStatus: Map<string, PluginStatus> = new Map();
  
  /**
   * Registry of available tools
   */
  private toolRegistry: ToolRegistry;
  
  /**
   * LLM for tool wrapping/marshaling
   */
  private llm: ChatOpenAI;
  
  /**
   * Plugin directory paths
   */
  private pluginDirs: string[] = [];
  
  /**
   * Constructor
   * @param toolRegistry Tool registry to register plugin tools with
   */
  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
    this.llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.1
    });
  }
  
  /**
   * Add a plugin directory to search for plugins
   * @param dir Directory path
   */
  addPluginDirectory(dir: string): void {
    if (!this.pluginDirs.includes(dir)) {
      this.pluginDirs.push(dir);
    }
  }
  
  /**
   * Discover plugins in the registered directories
   * @returns List of discovered plugin IDs
   */
  async discoverPlugins(): Promise<string[]> {
    try {
      const discoveredPlugins: string[] = [];
      
      // Search each directory
      for (const dir of this.pluginDirs) {
        // Look for plugin.json files
        const pluginPaths = await glob(`${dir}/**/plugin.json`, { nodir: true });
        
        for (const manifestPath of pluginPaths) {
          try {
            // Load the manifest
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            const manifest: PluginManifest = JSON.parse(manifestContent);
            
            // Generate an ID for the plugin
            const pluginId = IdGenerator.generate('plugin').toString();
            
            // Store the plugin ID
            discoveredPlugins.push(pluginId);
            
            console.log(`Discovered plugin: ${manifest.name} (${pluginId})`);
          } catch (error) {
            console.error(`Error loading plugin manifest at ${manifestPath}:`, error);
          }
        }
      }
      
      return discoveredPlugins;
    } catch (error) {
      console.error('Error discovering plugins:', error);
      return [];
    }
  }
  
  /**
   * Load a plugin from a manifest file
   * @param manifestPath Path to the plugin manifest
   * @returns ID of the loaded plugin
   */
  async loadPluginFromManifest(manifestPath: string): Promise<string | null> {
    try {
      console.log(`Loading plugin from ${manifestPath}`);
      
      // Read and parse the manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);
      
      // Generate an ID for the plugin
      const pluginId = IdGenerator.generate('plugin').toString();
      
      // Get directory containing the manifest
      const pluginDir = path.dirname(manifestPath);
      
      // Get the plugin main file
      const mainFile = path.join(pluginDir, manifest.main);
      
      // Check if the main file exists
      try {
        await fs.access(mainFile);
      } catch {
        console.error(`Plugin main file not found: ${mainFile}`);
        return null;
      }
      
      // Load the plugin module
      // In a real implementation, this would use dynamic imports or require
      // For safety in this example, we'll just mock a successful load
      
      // Create the plugin object (mock implementation)
      const plugin: Plugin = {
        id: pluginId,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        author: manifest.author,
        homepage: manifest.homepage,
        dependencies: manifest.dependencies || [],
        requiredEnvVars: manifest.requiredEnvVars || [],
        tools: [], // Will be populated during initialization
        
        // Mock execution function
        async executeTool(toolId, parameters, context) {
          const startTime = new Date().toISOString();
          try {
            // Mock execution result
            const result = { message: 'Tool executed successfully (mock)' };
            const endTime = new Date().toISOString();
            return {
              success: true,
              data: result,
              executionTime: Date.now() - new Date(startTime).getTime(),
              metadata: {
                toolId,
                startTime,
                endTime,
                parameters
              }
            };
          } catch (error) {
            const endTime = new Date().toISOString();
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              executionTime: Date.now() - new Date(startTime).getTime(),
              metadata: {
                toolId,
                startTime,
                endTime,
                parameters
              }
            };
          }
        }
      };
      
      // Register the plugin
      this.plugins.set(pluginId, plugin);
      this.pluginStatus.set(pluginId, 'installed');
      
      console.log(`Loaded plugin: ${manifest.name} (${pluginId})`);
      
      return pluginId;
    } catch (error) {
      console.error(`Error loading plugin from ${manifestPath}:`, error);
      return null;
    }
  }
  
  /**
   * Register a plugin manually
   * @param plugin Plugin to register
   * @returns ID of the registered plugin
   */
  registerPlugin(plugin: Omit<Plugin, 'id'>): string {
    try {
      // Generate an ID for the plugin
      const pluginId = IdGenerator.generate('plugin').toString();
      
      // Create the full plugin object
      const fullPlugin: Plugin = {
        ...plugin,
        id: pluginId
      };
      
      // Register the plugin
      this.plugins.set(pluginId, fullPlugin);
      this.pluginStatus.set(pluginId, 'installed');
      
      console.log(`Registered plugin: ${plugin.name} (${pluginId})`);
      
      return pluginId;
    } catch (error) {
      console.error(`Error registering plugin ${plugin.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Initialize a plugin
   * @param pluginId Plugin ID
   * @returns Whether initialization was successful
   */
  async initializePlugin(pluginId: string): Promise<boolean> {
    try {
      // Check if plugin exists
      if (!this.plugins.has(pluginId)) {
        console.error(`Plugin ${pluginId} not found`);
        return false;
      }
      
      const plugin = this.plugins.get(pluginId)!;
      
      // Check dependencies
      if (plugin.dependencies && plugin.dependencies.length > 0) {
        for (const dependency of plugin.dependencies) {
          if (!this.plugins.has(dependency) || this.pluginStatus.get(dependency) !== 'active') {
            console.error(`Plugin ${pluginId} depends on ${dependency}, which is not active`);
            this.pluginStatus.set(pluginId, 'missing_dependencies');
            return false;
          }
        }
      }
      
      // Check required environment variables
      if (plugin.requiredEnvVars && plugin.requiredEnvVars.length > 0) {
        for (const envVar of plugin.requiredEnvVars) {
          if (!process.env[envVar]) {
            console.error(`Plugin ${pluginId} requires environment variable ${envVar}`);
            this.pluginStatus.set(pluginId, 'error');
            return false;
          }
        }
      }
      
      // Initialize the plugin
      if (plugin.initialize) {
        const success = await plugin.initialize();
        
        if (!success) {
          console.error(`Plugin ${pluginId} initialization failed`);
          this.pluginStatus.set(pluginId, 'error');
          return false;
        }
      }
      
      // Register the plugin's tools
      for (const tool of plugin.tools) {
        try {
          // Register the tool with the ToolRegistry
          this.toolRegistry.registerTool({
            ...tool,
            // Add plugin information to the description
            description: `[Plugin: ${plugin.name}] ${tool.description}`
          });
          
          console.log(`Registered tool ${tool.name} from plugin ${plugin.name}`);
        } catch (error) {
          console.error(`Error registering tool ${tool.name} from plugin ${plugin.name}:`, error);
        }
      }
      
      // Mark the plugin as active
      this.pluginStatus.set(pluginId, 'active');
      
      console.log(`Initialized plugin: ${plugin.name} (${pluginId})`);
      
      return true;
    } catch (error) {
      console.error(`Error initializing plugin ${pluginId}:`, error);
      this.pluginStatus.set(pluginId, 'error');
      return false;
    }
  }
  
  /**
   * Execute a tool from a plugin
   * @param pluginId Plugin ID
   * @param toolId Tool ID
   * @param parameters Tool parameters
   * @param context Execution context
   * @returns Tool execution result
   */
  async executePluginTool(
    pluginId: string,
    toolId: string,
    parameters: Record<string, any>,
    context?: any
  ): Promise<ToolExecutionResult> {
    try {
      // Check if plugin exists
      if (!this.plugins.has(pluginId)) {
        throw new Error(`Plugin ${pluginId} not found`);
      }
      
      // Check if plugin is active
      if (this.pluginStatus.get(pluginId) !== 'active') {
        throw new Error(`Plugin ${pluginId} is not active`);
      }
      
      const plugin = this.plugins.get(pluginId)!;
      
      // Execute the tool
      const result = await plugin.executeTool(toolId, parameters, context);
      
      return result;
    } catch (error) {
      console.error(`Error executing tool ${toolId} from plugin ${pluginId}:`, error);
      
      const startTime = new Date().toISOString();
      const endTime = new Date().toISOString();
      return {
        success: false,
        error: 'Plugin not found',
        executionTime: 0,
        metadata: {
          toolId,
          startTime,
          endTime,
          parameters: {}
        }
      };
    }
  }
  
  /**
   * Deactivate a plugin
   * @param pluginId Plugin ID
   * @returns Whether deactivation was successful
   */
  async deactivatePlugin(pluginId: string): Promise<boolean> {
    try {
      // Check if plugin exists
      if (!this.plugins.has(pluginId)) {
        console.error(`Plugin ${pluginId} not found`);
        return false;
      }
      
      const plugin = this.plugins.get(pluginId)!;
      
      // Check if plugin is active
      if (this.pluginStatus.get(pluginId) !== 'active') {
        console.warn(`Plugin ${pluginId} is not active`);
        return true;
      }
      
      // Run cleanup if available
      if (plugin.cleanup) {
        await plugin.cleanup();
      }
      
      // Mark the plugin as inactive
      this.pluginStatus.set(pluginId, 'inactive');
      
      console.log(`Deactivated plugin: ${plugin.name} (${pluginId})`);
      
      return true;
    } catch (error) {
      console.error(`Error deactivating plugin ${pluginId}:`, error);
      return false;
    }
  }
  
  /**
   * Uninstall a plugin
   * @param pluginId Plugin ID
   * @returns Whether uninstallation was successful
   */
  async uninstallPlugin(pluginId: string): Promise<boolean> {
    try {
      // Check if plugin exists
      if (!this.plugins.has(pluginId)) {
        console.error(`Plugin ${pluginId} not found`);
        return false;
      }
      
      // Deactivate the plugin if active
      if (this.pluginStatus.get(pluginId) === 'active') {
        await this.deactivatePlugin(pluginId);
      }
      
      // Remove the plugin
      this.plugins.delete(pluginId);
      this.pluginStatus.delete(pluginId);
      
      console.log(`Uninstalled plugin: ${pluginId}`);
      
      return true;
    } catch (error) {
      console.error(`Error uninstalling plugin ${pluginId}:`, error);
      return false;
    }
  }
  
  /**
   * Get all plugins
   * @param filterByStatus Filter plugins by status
   * @returns List of plugins
   */
  getPlugins(filterByStatus?: PluginStatus): Plugin[] {
    try {
      // Get all plugins
      const allPlugins = Array.from(this.plugins.values());
      
      // Filter by status if requested
      if (filterByStatus) {
        return allPlugins.filter(
          plugin => this.pluginStatus.get(plugin.id) === filterByStatus
        );
      }
      
      return allPlugins;
    } catch (error) {
      console.error('Error getting plugins:', error);
      return [];
    }
  }
  
  /**
   * Get plugin status
   * @param pluginId Plugin ID
   * @returns Plugin status
   */
  getPluginStatus(pluginId: string): PluginStatus | null {
    try {
      // Check if plugin exists
      if (!this.plugins.has(pluginId)) {
        return null;
      }
      
      return this.pluginStatus.get(pluginId) || null;
    } catch (error) {
      console.error(`Error getting status for plugin ${pluginId}:`, error);
      return null;
    }
  }
  
  /**
   * Create a sandbox for plugin tool execution
   * @param plugin Plugin
   * @param toolId Tool ID
   * @returns Sandboxed execution function
   */
  private createSandboxedExecutor(
    plugin: Plugin,
    toolId: string
  ): (parameters: Record<string, any>, context?: any) => Promise<ToolExecutionResult> {
    // In a real implementation, this would create a sandboxed environment
    // For this example, we'll just wrap the plugin's executeTool method
    
    return (parameters: Record<string, any>, context?: any) => {
      console.log(`Executing sandboxed tool ${toolId} from plugin ${plugin.id}`);
      return plugin.executeTool(toolId, parameters, context);
    };
  }

  // Update the error case in handlePluginError
  private handlePluginError(error: Error, toolId: string, parameters: Record<string, any>): ToolExecutionResult {
    const startTime = new Date().toISOString();
    const endTime = new Date().toISOString();
    return {
      success: false,
      error: `Plugin error: ${error.message}`,
      executionTime: 0,
      metadata: {
        toolId,
        startTime,
        endTime,
        parameters
      }
    };
  }
} 