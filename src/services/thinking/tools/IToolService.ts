/**
 * Represents a tool that can be used by the agent
 */
export interface Tool {
  /**
   * Unique identifier for the tool
   */
  id: string;
  
  /**
   * Display name of the tool
   */
  name: string;
  
  /**
   * Description of what the tool does
   */
  description: string;
  
  /**
   * Categories that this tool belongs to
   */
  categories: string[];
  
  /**
   * Capabilities required to use this tool
   */
  requiredCapabilities: string[];
  
  /**
   * Parameters that the tool accepts
   */
  parameters: ToolParameter[];
  
  /**
   * Is this tool available for use
   */
  isEnabled: boolean;
  
  /**
   * Version of the tool
   */
  version: string;
}

/**
 * Parameter for a tool
 */
export interface ToolParameter {
  /**
   * Name of the parameter
   */
  name: string;
  
  /**
   * Description of the parameter
   */
  description: string;
  
  /**
   * Type of the parameter
   */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  
  /**
   * Is this parameter required
   */
  required: boolean;
  
  /**
   * Default value for the parameter
   */
  defaultValue?: any;
  
  /**
   * Validation schema for the parameter
   */
  schema?: any;
}

/**
 * Result of executing a tool
 */
export interface ToolExecutionResult {
  /**
   * Whether the execution was successful
   */
  success: boolean;
  
  /**
   * Result data
   */
  data?: any;
  
  /**
   * Error message if the execution failed
   */
  error?: string;
  
  /**
   * Execution time in milliseconds
   */
  executionTime: number;
}

/**
 * Parameters for tool discovery
 */
export interface ToolDiscoveryOptions {
  /**
   * Intent to find tools for
   */
  intent: string;
  
  /**
   * Categories to filter by
   */
  categories?: string[];
  
  /**
   * Only include tools with these capabilities
   */
  requiredCapabilities?: string[];
  
  /**
   * Maximum number of tools to return
   */
  limit?: number;
}

/**
 * Tool execution parameters
 */
export interface ToolExecutionOptions {
  /**
   * Tool ID to execute
   */
  toolId: string;
  
  /**
   * Parameters for the tool
   */
  parameters: Record<string, any>;
  
  /**
   * Context for the execution
   */
  context?: any;
  
  /**
   * Should the execution be traced
   */
  trace?: boolean;
}

/**
 * Feedback on tool execution
 */
export interface ToolFeedback {
  /**
   * Tool ID that was executed
   */
  toolId: string;
  
  /**
   * User ID that requested the execution
   */
  userId: string;
  
  /**
   * Intent that led to tool selection
   */
  intent: string;
  
  /**
   * Whether the tool execution was successful
   */
  wasSuccessful: boolean;
  
  /**
   * Whether the result was useful for the user's query
   */
  wasUseful: boolean;
  
  /**
   * Execution time in milliseconds
   */
  executionTime: number;
  
  /**
   * Parameters that were used
   */
  parameters: Record<string, any>;
  
  /**
   * Additional notes about the execution
   */
  notes?: string;
}

/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
  /**
   * Total number of times this tool was used
   */
  totalExecutions: number;
  
  /**
   * Number of successful executions
   */
  successfulExecutions: number;
  
  /**
   * Number of useful executions (result was helpful)
   */
  usefulExecutions: number;
  
  /**
   * Average execution time in milliseconds
   */
  avgExecutionTime: number;
  
  /**
   * Top intents that used this tool
   */
  topIntents: Array<{intent: string, count: number}>;
  
  /**
   * Common parameters used with this tool
   */
  commonParameters: Record<string, any[]>;
}

/**
 * Service for discovering and executing tools
 */
export interface IToolService {
  /**
   * Get all available tools
   * @returns List of available tools
   */
  getAllTools(): Promise<Tool[]>;
  
  /**
   * Find tools suitable for an intent
   * @param options Tool discovery options
   * @returns List of suitable tools
   */
  discoverTools(options: ToolDiscoveryOptions): Promise<Tool[]>;
  
  /**
   * Execute a tool
   * @param options Tool execution options
   * @returns Result of the execution
   */
  executeTool(options: ToolExecutionOptions): Promise<ToolExecutionResult>;
  
  /**
   * Create a chain of tools for a complex operation
   * @param toolIds List of tool IDs to chain
   * @param contextMapping How to map outputs to inputs between tools
   * @returns A composite tool
   */
  createToolChain(
    toolIds: string[],
    contextMapping: Record<string, string>
  ): Promise<Tool>;
  
  /**
   * Register a new tool
   * @param tool Tool to register
   * @returns ID of the registered tool
   */
  registerTool(tool: Omit<Tool, 'id'>): Promise<string>;
  
  /**
   * Get a tool by ID
   * @param toolId ID of the tool
   * @returns The tool if found
   */
  getToolById(toolId: string): Promise<Tool | null>;
  
  /**
   * Record feedback about a tool execution
   * @param feedback Feedback about the tool execution
   * @returns Whether the feedback was successfully recorded
   */
  recordToolFeedback(feedback: ToolFeedback): Promise<boolean>;
  
  /**
   * Get usage statistics for a tool
   * @param toolId ID of the tool
   * @returns Usage statistics for the tool
   */
  getToolUsageStats(toolId: string): Promise<ToolUsageStats | null>;
  
  /**
   * Get recommended tools for an intent based on past usage
   * @param intent Intent to get recommendations for
   * @param limit Maximum number of recommendations
   * @returns List of recommended tools with scores
   */
  getRecommendedTools(intent: string, limit?: number): Promise<Array<{tool: Tool, score: number}>>;
} 