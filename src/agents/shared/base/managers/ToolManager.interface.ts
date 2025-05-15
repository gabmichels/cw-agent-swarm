/**
 * ToolManager.interface.ts - Tool Manager Interface
 * 
 * This file defines the tool manager interface that provides tool management 
 * for agents. It extends the base manager interface with tool-specific functionality.
 */

import { BaseManager, ManagerConfig } from './BaseManager';

/**
 * Configuration options for tool managers
 */
export interface ToolManagerConfig extends ManagerConfig {
  /** Default timeout for tool execution in milliseconds */
  defaultToolTimeoutMs?: number;
  
  /** Maximum number of retries for tool execution */
  maxToolRetries?: number;
  
  /** Whether to track tool performance metrics */
  trackToolPerformance?: boolean;
  
  /** Whether to use adaptive tool selection based on performance */
  useAdaptiveToolSelection?: boolean;
}

/**
 * Tool definition structure
 */
export interface Tool {
  /** Unique identifier for this tool */
  id: string;
  
  /** Tool name */
  name: string;
  
  /** Tool description */
  description: string;
  
  /** Tool version */
  version: string;
  
  /** Tool categories */
  categories?: string[];
  
  /** Tool capabilities */
  capabilities?: string[];
  
  /** Whether the tool is enabled */
  enabled?: boolean;
  
  /** Whether the tool is experimental */
  experimental?: boolean;
  
  /** Cost per use (arbitrary units) */
  costPerUse?: number;
  
  /** Timeout for this tool in milliseconds */
  timeoutMs?: number;
  
  /** Additional tool metadata */
  metadata?: Record<string, unknown>;
  
  /** Tool execution function */
  execute: (params: unknown, context?: unknown) => Promise<unknown>;
}

/**
 * Result of tool execution
 */
export interface ToolExecutionResult {
  /** Tool identifier */
  toolId: string;
  
  /** Whether execution was successful */
  success: boolean;
  
  /** Execution result (if successful) */
  result?: unknown;
  
  /** Error details (if unsuccessful) */
  error?: {
    message: string;
    code?: string;
  };
  
  /** Duration of execution in milliseconds */
  durationMs: number;
  
  /** When execution started */
  startedAt: Date;
  
  /** Execution metrics */
  metrics?: {
    inputSize?: number;
    outputSize?: number;
    [key: string]: unknown;
  };
}

/**
 * Usage metrics for a tool
 */
export interface ToolUsageMetrics {
  /** Tool identifier */
  toolId: string;
  
  /** Total number of executions */
  totalExecutions: number;
  
  /** Number of successful executions */
  successfulExecutions: number;
  
  /** Number of failed executions */
  failedExecutions: number;
  
  /** Average execution duration in milliseconds */
  avgDurationMs: number;
  
  /** Success rate (0-1) */
  successRate: number;
  
  /** Usage trend over time */
  usageTrend?: Array<{
    timestamp: Date;
    count: number;
  }>;
}

/**
 * Fallback rule for tools
 */
export interface ToolFallbackRule {
  /** Rule identifier */
  id: string;
  
  /** Primary tool identifier */
  primaryToolId: string;
  
  /** Fallback tool identifier */
  fallbackToolId: string;
  
  /** Error patterns that trigger fallback */
  errorPatterns?: string[];
  
  /** Whether the rule is enabled */
  enabled?: boolean;
  
  /** Custom condition function for fallback */
  condition?: (error: unknown) => boolean;
}

/**
 * Tool manager interface
 */
export interface ToolManager extends BaseManager {
  /**
   * Register a new tool
   * @param tool The tool to register
   * @returns Promise resolving to the registered tool
   */
  registerTool(tool: Tool): Promise<Tool>;
  
  /**
   * Unregister a tool
   * @param toolId The tool ID to unregister
   * @returns Promise resolving to true if unregistered, false if not found
   */
  unregisterTool(toolId: string): Promise<boolean>;
  
  /**
   * Get a tool by ID
   * @param toolId The tool ID to retrieve
   * @returns Promise resolving to the tool or null if not found
   */
  getTool(toolId: string): Promise<Tool | null>;
  
  /**
   * Get all tools, optionally filtered
   * @param filter Optional filter criteria
   * @returns Promise resolving to matching tools
   */
  getTools(filter?: {
    enabled?: boolean;
    categories?: string[];
    capabilities?: string[];
    experimental?: boolean;
  }): Promise<Tool[]>;
  
  /**
   * Enable or disable a tool
   * @param toolId The tool ID to update
   * @param enabled Whether to enable or disable
   * @returns Promise resolving to the updated tool
   */
  setToolEnabled(toolId: string, enabled: boolean): Promise<Tool>;
  
  /**
   * Execute a tool
   * @param toolId The tool ID to execute
   * @param params Tool parameters
   * @param options Execution options
   * @returns Promise resolving to the execution result
   */
  executeTool(
    toolId: string,
    params: unknown,
    options?: {
      context?: unknown;
      timeoutMs?: number;
      retries?: number;
      useFallbacks?: boolean;
    }
  ): Promise<ToolExecutionResult>;
  
  /**
   * Get tool usage metrics
   * @param toolId Optional tool ID to filter metrics
   * @returns Promise resolving to matching metrics
   */
  getToolMetrics(toolId?: string): Promise<ToolUsageMetrics[]>;
  
  /**
   * Find the best tool for a task
   * @param taskDescription Description of the task
   * @param context Optional context for tool selection
   * @returns Promise resolving to the best matching tool or null if none found
   */
  findBestToolForTask(taskDescription: string, context?: unknown): Promise<Tool | null>;
} 