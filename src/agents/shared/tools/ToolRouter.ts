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
    
    // Get visualization context if available
    const visualization = agentContext.visualization;
    const visualizer = agentContext.visualizer;
    let toolSelectionNodeId: string | undefined;
    let toolExecutionNodeId: string | undefined;
    
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
      
      // Add tool selection visualization node if visualization is enabled
      if (visualization && visualizer) {
        try {
          // Create tool selection node
          toolSelectionNodeId = visualizer.addNode(
            visualization,
            'tool_selection',
            `Tool Selection: ${toolName}`,
            {
              toolName,
              timestamp: startTime,
              params: JSON.stringify(params).substring(0, 100),
              context: JSON.stringify(Object.keys(agentContext))
            },
            'in_progress'
          );
          
          // Create tool execution node
          toolExecutionNodeId = visualizer.addNode(
            visualization,
            'tool_execution',
            `Tool Execution: ${toolName}`,
            {
              toolName,
              timestamp: startTime,
              params: JSON.stringify(params).substring(0, 100),
              context: JSON.stringify(Object.keys(agentContext))
            },
            'in_progress'
          );
          
          // Connect the nodes if both were created
          if (toolSelectionNodeId && toolExecutionNodeId) {
            visualizer.addEdge(
              visualization,
              toolSelectionNodeId,
              toolExecutionNodeId,
              'next'
            );
          }
          
          // Connect to parent if specified
          if (agentContext.parentNodeId && toolSelectionNodeId) {
            visualizer.addEdge(
              visualization,
              agentContext.parentNodeId,
              toolSelectionNodeId,
              'child'
            );
          }
        } catch (error) {
          console.error('Error creating tool visualization:', error);
        }
      }
      
      // Get the tool from the registry
      const resolvedTool = this.tools.get(toolName);
      if (!resolvedTool) {
        const errorMessage = `Tool "${toolName}" not found in registry`;
        
        // Update visualization nodes with error if available
        if (visualization && visualizer) {
          if (toolSelectionNodeId) {
            visualizer.updateNode(
              visualization,
              toolSelectionNodeId,
              {
                status: 'error',
                data: {
                  error: errorMessage
                }
              }
            );
          }
          
          if (toolExecutionNodeId) {
            visualizer.updateNode(
              visualization,
              toolExecutionNodeId,
              {
                status: 'error',
                data: {
                  error: errorMessage
                }
              }
            );
          }
        }
        
        // Return error result
        return {
          success: false,
          error: errorMessage
        };
      }
      
      // Update tool selection node with resolved tool information
      if (visualization && visualizer && toolSelectionNodeId) {
        visualizer.updateNode(
          visualization,
          toolSelectionNodeId,
          {
            status: 'completed',
            data: {
              resolvedTool: resolvedTool.name,
              description: resolvedTool.description
            }
          }
        );
      }
      
      // Execute the tool
      try {
        const result = await resolvedTool.execute(params);
        const executionTime = Date.now() - startTime;
        
        // Update visualization nodes with success if available
        if (visualization && visualizer && toolExecutionNodeId) {
          visualizer.updateNode(
            visualization,
            toolExecutionNodeId,
            {
              status: 'completed',
              data: {
                success: true,
                executionTime,
                result: JSON.stringify(result.data).substring(0, 500) // Limit result size
              }
            }
          );
        }
        
        // Log tool completion
        AgentMonitor.log({
          agentId,
          taskId,
          toolUsed: toolName,
          eventType: 'tool_end',
          timestamp: Date.now(),
          durationMs: executionTime,
          status: 'success',
          metadata: {
            resultSize: JSON.stringify(result).length
          }
        });
        
        // Return success result
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const executionTime = Date.now() - startTime;
        
        // Update visualization nodes with error if available
        if (visualization && visualizer && toolExecutionNodeId) {
          visualizer.updateNode(
            visualization,
            toolExecutionNodeId,
            {
              status: 'error',
              data: {
                error: errorMessage,
                executionTime
              }
            }
          );
        }
        
        // Log tool error
        AgentMonitor.log({
          agentId,
          taskId,
          toolUsed: toolName,
          eventType: 'tool_end',
          timestamp: Date.now(),
          durationMs: executionTime,
          status: 'failure',
          errorMessage
        });
        
        // Return error result
        return {
          success: false,
          error: errorMessage
        };
      }
    } catch (error) {
      // Handle errors in the entire tool execution process
      const errorMessage = error instanceof Error ? error.message : String(error);
      const executionTime = Date.now() - startTime;
      
      // Update visualization nodes with error if available
      if (visualization && visualizer) {
        if (toolSelectionNodeId) {
          visualizer.updateNode(
            visualization,
            toolSelectionNodeId,
            {
              status: 'error',
              data: {
                error: errorMessage
              }
            }
          );
        }
        
        if (toolExecutionNodeId) {
          visualizer.updateNode(
            visualization,
            toolExecutionNodeId,
            {
              status: 'error',
              data: {
                error: errorMessage
              }
            }
          );
        }
      }
      
      // Log tool error
      AgentMonitor.log({
        agentId,
        taskId,
        toolUsed: toolName,
        eventType: 'tool_end',
        timestamp: Date.now(),
        durationMs: executionTime,
        status: 'failure',
        errorMessage
      });
      
      // Return error result
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