import { ChatOpenAI } from '@langchain/openai';
import { TaskLogger } from '../task-logger';
import { ChloeMemory } from '../memory';
import { 
  BaseTool, 
  SimpleTool, 
  ToolManagerOptions,
  ToolExecutionResult,
  IManager
} from '../../../lib/shared/types/agentTypes';
import { createChloeTools } from '../tools';
import { ToolCreationSystem } from '../tools/integration';

/**
 * ToolManager for handling Chloe's tool interactions
 */
export class ToolManager implements IManager {
  private logger: TaskLogger;
  private model: ChatOpenAI;
  private memory: ChloeMemory;
  private agentId: string;
  private tools: Record<string, BaseTool> = {};
  private toolCreationSystem: ToolCreationSystem | null = null;
  private initialized: boolean = false;

  constructor(options: ToolManagerOptions) {
    this.logger = options.logger || new TaskLogger();
    this.model = options.model;
    this.memory = options.memory;
    this.agentId = options.agentId;
  }

  /**
   * Get the agent ID this manager belongs to
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Log an action performed by this manager
   */
  logAction(action: string, metadata?: Record<string, unknown>): void {
    this.logger.logAction(`ToolManager: ${action}`, metadata);
  }

  /**
   * Initialize the tool manager and load default tools
   */
  async initialize(): Promise<void> {
    try {
      this.logAction('Initializing ToolManager');

      // Register default tools - add discord webhook URL if needed later
      const defaultTools = createChloeTools(this.memory, this.model);
      
      // Register each tool
      for (const toolName in defaultTools) {
        const tool = defaultTools[toolName];
        this.registerTool(tool);
      }

      // Log the initialization
      this.logAction('ToolManager initialized', {
        toolCount: Object.keys(this.tools).length,
        toolNames: Object.keys(this.tools)
      });
      
      this.initialized = true;
      console.log(`ToolManager initialized with ${Object.keys(this.tools).length} tools`);
    } catch (error) {
      this.logAction('Error initializing ToolManager', { error: String(error) });
      throw error;
    }
  }

  /**
   * Shutdown and cleanup resources
   */
  async shutdown(): Promise<void> {
    try {
      this.logAction('Shutting down ToolManager');
      
      // Perform any necessary cleanup
      // For example, unregister tools that need cleanup
      for (const toolName in this.tools) {
        const tool = this.tools[toolName];
        if (typeof (tool as unknown as { cleanup?: () => Promise<void> }).cleanup === 'function') {
          await (tool as unknown as { cleanup: () => Promise<void> }).cleanup();
        }
      }
      
      this.logAction('ToolManager shutdown complete');
    } catch (error) {
      this.logAction('Error during ToolManager shutdown', { error: String(error) });
      throw error;
    }
  }

  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Register a tool with the manager
   */
  registerTool(tool: BaseTool | SimpleTool): void {
    if (this.tools[tool.name]) {
      console.warn(`Tool ${tool.name} already exists and will be overwritten`);
    }
    
    this.tools[tool.name] = tool as BaseTool;
    console.log(`Registered tool: ${tool.name}`);
  }

  /**
   * Get a tool by name
   */
  async getTool(name: string): Promise<BaseTool | null> {
    // If the tool exists, return it
    if (this.tools[name]) {
      return this.tools[name];
    }
    
    // Log that the tool wasn't found
    console.log(`Tool ${name} not found`);
    return null;
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    try {
      // Get the tool
      const tool = await this.getTool(name);
      
      // If tool doesn't exist, return error
      if (!tool) {
        return {
          success: false,
          error: `Tool ${name} not found`
        };
      }
      
      // Log the tool execution
      this.logAction('Executing tool', {
        tool: name,
        params: JSON.stringify(params)
      });
      
      // Execute the tool
      const result = await tool.execute(params);
      
      // Log the result
      this.logAction('Tool execution result', {
        tool: name,
        success: result.success,
        response: result.response ? result.response.substring(0, 100) : undefined,
        error: result.error
      });
      
      return result;
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      return {
        success: false,
        error: `Error executing tool ${name}: ${error}`
      };
    }
  }

  /**
   * Process a user message to identify and execute the appropriate tool
   */
  async processIntent(message: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    try {
      // Get the intent router tool
      const intentRouter = await this.getTool('intent_router');
      
      // If the intent router doesn't exist, return error
      if (!intentRouter) {
        return {
          success: false,
          error: 'Intent router tool not found'
        };
      }
      
      console.log('Intent Router found, routing message:', message.substring(0, 50));
      
      // Process the intent based on the available method
      try {
        // First try to use the execute method (BaseTool)
        if (typeof intentRouter.execute === 'function') {
          console.log('Calling execute method on intent router');
          return await intentRouter.execute({ input: message, ...params });
        } 
        // Fall back to _call method (SimpleTool)
        else if (typeof (intentRouter as any)._call === 'function') {
          console.log('Calling _call method on intent router');
          const result = await (intentRouter as any)._call(message);
          return {
            success: true,
            response: result,
            data: { rawOutput: result }
          };
        }
        else {
          throw new Error('No executable method found on intent router tool');
        }
      } catch (callError) {
        console.error('Error executing intent router tool:', callError);
        return {
          success: false,
          error: `Error executing intent router: ${callError instanceof Error ? callError.message : String(callError)}`
        };
      }
    } catch (error) {
      console.error('Error processing intent:', error);
      return {
        success: false,
        error: `Error processing intent: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Create a new tool from a description
   */
  async createToolFromDescription(description: string): Promise<ToolExecutionResult> {
    try {
      // Dynamically import the ToolCreationSystem to avoid circular dependencies
      if (!this.toolCreationSystem) {
        // The ToolCreationSystem needs to be imported and instantiated with the right parameters
        const systemImport = await import('../tools/integration');
        this.toolCreationSystem = new systemImport.ToolCreationSystem({
          model: this.model,
          memory: this.memory,
          agentId: this.agentId
        });
        await this.toolCreationSystem.initialize();
      }
      
      // Create the tool
      const result = await this.toolCreationSystem.createToolFromDescription(description);
      
      // If the tool was created successfully, register it
      if (result.success && result.data) {
        this.registerTool(result.data);
      }
      
      return result;
    } catch (error) {
      console.error('Error creating tool from description:', error);
      return {
        success: false,
        error: `Error creating tool from description: ${error}`
      };
    }
  }

  /**
   * Get tools that can be used for a specific task
   */
  async getToolsForTask(task: string): Promise<BaseTool[]> {
    try {
      // Get all tools
      const allTools = Object.values(this.tools);
      
      // Use the model to rank tools by relevance
      const prompt = `Task: ${task}
      
Available tools:
${allTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

List the top 3 tools that would be most useful for this task, in order of relevance. Return just the tool names, one per line.`;
      
      // Get the response from the model
      const response = await this.model.invoke(prompt);
      const content = response.content.toString();
      
      // Parse the tool names from the response
      const toolNames = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          // Extract the tool name (remove any numbers, dashes, or other formatting)
          const match = line.match(/[a-zA-Z_]+/);
          return match ? match[0] : null;
        })
        .filter(name => name !== null) as string[];
      
      // Get the tools by name
      const tools: BaseTool[] = [];
      for (const name of toolNames) {
        const tool = await this.getTool(name);
        if (tool) {
          tools.push(tool);
        }
      }
      
      return tools;
    } catch (error) {
      console.error('Error getting tools for task:', error);
      // Return an empty array if there's an error
      return [];
    }
  }

  /**
   * Remove a tool by name
   */
  removeTool(name: string): boolean {
    if (this.tools[name]) {
      delete this.tools[name];
      console.log(`Removed tool: ${name}`);
      return true;
    }
    
    console.log(`Tool ${name} not found for removal`);
    return false;
  }

  /**
   * Get all available tools
   */
  getAllTools(): BaseTool[] {
    return Object.values(this.tools);
  }
  
  /**
   * Schedule the creation of a tool
   */
  async scheduleToolCreation(
    description: string,
    delayMs: number = 0
  ): Promise<boolean> {
    try {
      // Log the scheduled creation
      this.logAction('Scheduling tool creation', {
        description,
        delay: delayMs
      });
      
      // Schedule the creation
      setTimeout(async () => {
        try {
          await this.createToolFromDescription(description);
        } catch (error) {
          console.error(`Error in scheduled tool creation: ${error}`);
        }
      }, delayMs);
      
      return true;
    } catch (error) {
      console.error('Error scheduling tool creation:', error);
      return false;
    }
  }
} 