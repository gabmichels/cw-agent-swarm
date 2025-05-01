/**
 * ToolRouter.ts - Shared tool routing and access control
 * 
 * This module provides:
 * - Tool registry for all available tools
 * - Agent-specific tool access control
 * - Tool execution with proper agent context
 * - Tool discovery and capability matching
 */

import { AgentMonitor } from '../monitoring/AgentMonitor';
import { enforceEthics } from '../ethics/EthicsMiddleware';

// Base tool interface
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  requiredParams: string[];
  execute: (params: Record<string, any>, agentContext?: Record<string, any>) => Promise<ToolResult>;
  category?: string;
  requiredCapabilityLevel?: string;
}

// Tool execution result
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// Tool access control options
export interface ToolAccessOptions {
  enforceCapabilityLevel: boolean;
  allowAccessToHigherCapability: boolean;
  trackToolUsage: boolean;
  maxActiveTools: number;
}

// Tool router options
export interface ToolRouterOptions {
  accessOptions?: Partial<ToolAccessOptions>;
  ethicsOptions?: {
    enableEthicsCheck: boolean;
    blockUnethicalOutput: boolean;
  };
}

/**
 * Tool router for managing tool access and execution
 */
export class ToolRouter {
  private tools: Map<string, ToolDefinition> = new Map();
  private agentToolPermissions: Map<string, Set<string>> = new Map();
  private toolUsageStats: Map<string, Map<string, number>> = new Map();
  private accessOptions: ToolAccessOptions;
  private ethicsOptions: {
    enableEthicsCheck: boolean;
    blockUnethicalOutput: boolean;
  };
  private initialized: boolean = false;
  
  constructor(options: ToolRouterOptions = {}) {
    this.accessOptions = {
      enforceCapabilityLevel: true,
      allowAccessToHigherCapability: false,
      trackToolUsage: true,
      maxActiveTools: 10,
      ...options.accessOptions
    };
    
    this.ethicsOptions = {
      enableEthicsCheck: true,
      blockUnethicalOutput: false,
      ...options.ethicsOptions
    };
  }
  
  /**
   * Initialize the tool router
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing ToolRouter...');
      
      // Initialization logic will be added here
      
      this.initialized = true;
      console.log('ToolRouter initialized successfully');
    } catch (error) {
      console.error('Error initializing ToolRouter:', error);
      throw error;
    }
  }
  
  /**
   * Register a tool with the router
   */
  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} already exists and will be overwritten`);
    }
    
    this.tools.set(tool.name, tool);
    console.log(`Registered tool: ${tool.name}`);
  }
  
  /**
   * Set tool permissions for an agent
   */
  setAgentToolPermissions(agentId: string, toolNames: string[]): void {
    const toolSet = new Set<string>(toolNames);
    this.agentToolPermissions.set(agentId, toolSet);
    console.log(`Set tool permissions for agent ${agentId}: ${Array.from(toolSet).join(', ')}`);
  }
  
  /**
   * Check if an agent has permission to use a tool
   */
  hasToolPermission(agentId: string, toolName: string): boolean {
    // Check if the agent has permissions set
    const permissions = this.agentToolPermissions.get(agentId);
    if (!permissions) {
      console.warn(`Agent ${agentId} has no tool permissions registered`);
      return false;
    }
    
    // Check if the tool exists
    if (!this.tools.has(toolName)) {
      console.warn(`Tool ${toolName} does not exist`);
      return false;
    }
    
    // Check if the agent has permission for this specific tool
    return permissions.has(toolName);
  }
  
  /**
   * Execute a tool with proper agent context
   */
  async executeTool(
    agentId: string,
    toolName: string,
    params: Record<string, any>,
    agentContext: Record<string, any> = {}
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const taskId = `tool_${toolName}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    try {
      // Log tool execution start
      AgentMonitor.log({
        agentId,
        taskId,
        toolUsed: toolName,
        eventType: 'tool_start',
        timestamp: startTime,
        metadata: {
          params: JSON.stringify(params).substring(0, 100),
          contextType: Object.keys(agentContext)
        }
      });
      
      // Check permission
      if (!this.hasToolPermission(agentId, toolName)) {
        const errorMessage = `Agent ${agentId} does not have permission to use tool ${toolName}`;
        
        // Log permission error
        AgentMonitor.log({
          agentId,
          taskId,
          toolUsed: toolName,
          eventType: 'tool_end',
          status: 'failure',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
          errorMessage
        });
        
        return {
          success: false,
          error: errorMessage
        };
      }
      
      // Get the tool
      const tool = this.tools.get(toolName);
      if (!tool) {
        const errorMessage = `Tool ${toolName} not found`;
        
        // Log tool not found error
        AgentMonitor.log({
          agentId,
          taskId,
          toolUsed: toolName,
          eventType: 'tool_end',
          status: 'failure',
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
          errorMessage
        });
        
        return {
          success: false,
          error: errorMessage
        };
      }
      
      // Check required parameters
      for (const requiredParam of tool.requiredParams) {
        if (!(requiredParam in params)) {
          const errorMessage = `Missing required parameter: ${requiredParam}`;
          
          // Log missing parameter error
          AgentMonitor.log({
            agentId,
            taskId,
            toolUsed: toolName,
            eventType: 'tool_end',
            status: 'failure',
            timestamp: Date.now(),
            durationMs: Date.now() - startTime,
            errorMessage
          });
          
          return {
            success: false,
            error: errorMessage
          };
        }
      }
      
      // Execute the tool
      const result = await tool.execute(params, agentContext);
      
      // Track usage if enabled
      if (this.accessOptions.trackToolUsage) {
        this.trackToolUsage(agentId, toolName);
      }
      
      // Apply ethics check on tool output if enabled
      if (this.ethicsOptions.enableEthicsCheck && result.success && result.message) {
        const ethicsResult = await enforceEthics({
          agentId,
          taskId,
          output: result.message,
          options: {
            blockOutput: this.ethicsOptions.blockUnethicalOutput
          }
        });
        
        // If violations were found and output is blocked
        if (ethicsResult.wasBlocked) {
          // Log ethics violation blocking
          AgentMonitor.log({
            agentId,
            taskId,
            toolUsed: toolName,
            eventType: 'tool_end',
            status: 'failure',
            timestamp: Date.now(),
            durationMs: Date.now() - startTime,
            errorMessage: 'Output blocked due to ethics violation',
            metadata: {
              violations: ethicsResult.violations
            }
          });
          
          return {
            success: false,
            error: 'Output blocked due to ethics violation',
            data: result.data,
            message: 'This output was blocked due to potential ethical concerns'
          };
        }
        
        // If the output was modified to fix violations
        if (ethicsResult.wasModified) {
          result.message = ethicsResult.output;
        }
      }
      
      // Log tool execution result
      AgentMonitor.log({
        agentId,
        taskId,
        toolUsed: toolName,
        eventType: 'tool_end',
        status: result.success ? 'success' : 'failure',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        errorMessage: result.error,
        metadata: {
          resultMessage: result.message,
          resultData: result.data ? JSON.stringify(result.data).substring(0, 100) : undefined
        }
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log execution error
      AgentMonitor.log({
        agentId,
        taskId,
        toolUsed: toolName,
        eventType: 'error',
        status: 'failure',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        errorMessage
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Track tool usage statistics
   */
  private trackToolUsage(agentId: string, toolName: string): void {
    if (!this.toolUsageStats.has(agentId)) {
      this.toolUsageStats.set(agentId, new Map<string, number>());
    }
    
    const agentStats = this.toolUsageStats.get(agentId)!;
    agentStats.set(toolName, (agentStats.get(toolName) || 0) + 1);
  }
  
  /**
   * Get all tools available to an agent
   */
  getAvailableTools(agentId: string): ToolDefinition[] {
    const permissions = this.agentToolPermissions.get(agentId);
    if (!permissions) {
      return [];
    }
    
    return Array.from(permissions)
      .map(toolName => this.tools.get(toolName))
      .filter((tool): tool is ToolDefinition => !!tool);
  }
  
  /**
   * Get usage statistics for an agent
   */
  getToolUsageStats(agentId: string): Record<string, number> {
    const stats: Record<string, number> = {};
    
    const agentStats = this.toolUsageStats.get(agentId);
    if (agentStats) {
      // Convert to array first to avoid MapIterator issues
      Array.from(agentStats.entries()).forEach(([toolName, count]) => {
        stats[toolName] = count;
      });
    }
    
    return stats;
  }
  
  /**
   * Check if router is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Shut down the router
   */
  async shutdown(): Promise<void> {
    // Cleanup logic would go here
    this.initialized = false;
  }
} 