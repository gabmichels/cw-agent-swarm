import { ChatOpenAI } from '@langchain/openai';
import { TaskLogger } from '../task-logger';
import { ChloeMemory } from '../memory';
import { SimpleTool } from '../../../lib/shared/types/agent';
import { createChloeTools } from '../tools';
import { IntentRouterTool } from '../tools/intentRouter';
import { ToolCreationSystem } from '../tools/integration';

/**
 * Interface for ToolManager options
 */
interface ToolManagerOptions {
  logger?: TaskLogger;
  model: ChatOpenAI;
  memory: ChloeMemory;
  agentId?: string;
}

/**
 * Interface for Tool Creation Results
 */
interface ToolCreationResult {
  success: boolean;
  tool?: {
    name: string;
    description: string;
    path?: string;
  };
  error?: string;
}

/**
 * ToolManager for handling Chloe's tool interactions
 */
export class ToolManager {
  private logger: TaskLogger;
  private model: ChatOpenAI;
  private memory: ChloeMemory;
  private agentId: string;
  private tools: Record<string, SimpleTool> = {};
  private toolCreationSystem: any; // Will be initialized dynamically
  private initialized: boolean = false;

  constructor(options: ToolManagerOptions) {
    this.logger = options.logger || new TaskLogger();
    this.model = options.model;
    this.memory = options.memory;
    this.agentId = options.agentId || 'chloe'; // Default to 'chloe' if not provided
  }

  /**
   * Initialize the tool manager
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing ToolManager...');

      // Dynamically import the ToolCreationSystem to avoid circular dependencies
      const { ToolCreationSystem } = await import('../tools/integration');
      
      // Initialize the tool creation system
      this.toolCreationSystem = new ToolCreationSystem({
        model: this.model,
        memory: this.memory,
        agentId: this.agentId
      });
      
      await this.toolCreationSystem.initialize();
      
      this.initialized = true;
      console.log('ToolManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ToolManager', error);
      throw error;
    }
  }

  /**
   * Check if the ToolManager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ToolManager is not initialized. Call initialize() first.');
    }
  }

  /**
   * Get a tool by name
   */
  async getTool(name: string): Promise<any> {
    this.ensureInitialized();
    
    try {
      const registry = this.toolCreationSystem.getRegistry();
      return await registry.getTool(name);
    } catch (error) {
      console.error(`Error getting tool ${name}:`, error);
      return null;
    }
  }

  /**
   * Execute a tool with parameters
   */
  async executeTool(name: string, params: any): Promise<any> {
    this.ensureInitialized();
    
    try {
      const tool = await this.getTool(name);
      
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }
      
      console.log(`Executing tool ${name} with params:`, params);
      return await tool.execute(params);
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      throw error;
    }
  }

  /**
   * Process a user intent to find and execute the right tool
   */
  async processIntent(intent: string, params: any): Promise<any> {
    this.ensureInitialized();
    
    try {
      // Find the best tool for the intent
      const tools = await this.getToolsForTask(intent);
      
      if (!tools || tools.length === 0) {
        return {
          success: false,
          error: `No suitable tool found for intent: ${intent}`
        };
      }
      
      // Use the first (best) tool
      const bestTool = tools[0];
      
      // Execute the tool
      return await this.executeTool(bestTool.name, params);
    } catch (error) {
      console.error(`Error processing intent ${intent}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create a new tool from a description
   */
  async createToolFromDescription(description: string): Promise<ToolCreationResult> {
    this.ensureInitialized();
    
    try {
      console.log(`Creating tool from description: ${description}`);
      
      // Call the tool creation system to create the tool
      const result = await this.toolCreationSystem.createToolFromDescription(description);
      
      if (result.success) {
        console.log(`Successfully created tool: ${result.tool.name}`);
      } else {
        console.warn(`Failed to create tool: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      console.error('Error creating tool:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Find tools that can help with a specific task
   */
  async getToolsForTask(task: string): Promise<any[]> {
    this.ensureInitialized();
    
    try {
      return await this.toolCreationSystem.getToolsForTask(task);
    } catch (error) {
      console.error(`Error finding tools for task ${task}:`, error);
      return [];
    }
  }

  /**
   * Register a new tool
   */
  async registerTool(toolDefinition: any): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      const registry = this.toolCreationSystem.getRegistry();
      await registry.registerTool(toolDefinition);
      return true;
    } catch (error) {
      console.error('Error registering tool:', error);
      return false;
    }
  }

  /**
   * Remove a tool
   */
  async removeTool(name: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      const registry = this.toolCreationSystem.getRegistry();
      await registry.removeTool(name);
      return true;
    } catch (error) {
      console.error(`Error removing tool ${name}:`, error);
      return false;
    }
  }
  
  /**
   * Schedule tool creation based on memory analysis
   */
  scheduleToolCreation(intervalHours: number = 24): NodeJS.Timeout {
    this.ensureInitialized();
    
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    console.log(`Scheduling tool creation every ${intervalHours} hours`);
    
    return setInterval(async () => {
      try {
        const result = await this.toolCreationSystem.createMissingTools();
        console.log(`Created ${result.toolsCreated} tools based on memory analysis`);
      } catch (error) {
        console.error('Error in scheduled tool creation:', error);
      }
    }, intervalMs);
  }
} 