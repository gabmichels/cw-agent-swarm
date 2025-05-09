/**
 * Tool Manager Interface
 * 
 * This file defines the tool manager interface that provides tool registration,
 * discovery, and execution capabilities for agents.
 */

import type { BaseManager } from '../../../../agents/shared/base/managers/BaseManager';

/**
 * Configuration options for tool managers
 */
export interface ToolManagerConfig {
  /** Whether this manager is enabled */
  enabled: boolean;
  
  /** Whether to track tool performance metrics */
  trackToolPerformance?: boolean;
  
  /** Default tool execution timeout in milliseconds */
  defaultToolTimeoutMs?: number;
  
  /** Whether to use adaptive tool selection */
  useAdaptiveToolSelection?: boolean;
  
  /** Maximum number of retries for tool execution */
  maxToolRetries?: number;
}

/**
 * Tool interface
 */
export interface Tool {
  /** Unique tool identifier */
  id: string;
  
  /** Display name of the tool */
  name: string;
  
  /** Tool description */
  description: string;
  
  /** Tool categories/tags */
  categories?: string[];
  
  /** Whether the tool is enabled */
  enabled: boolean;
  
  /** Tool capabilities */
  capabilities?: string[];
  
  /** Tool version */
  version?: string;
  
  /** Function to execute the tool */
  execute: (params: unknown, context?: unknown) => Promise<unknown>;
  
  /** Tool-specific timeout in milliseconds */
  timeoutMs?: number;
  
  /** Whether the tool is in beta/experimental stage */
  experimental?: boolean;
  
  /** Cost per use (arbitrary units) */
  costPerUse?: number;
  
  /** Additional tool metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution result interface
 */
export interface ToolExecutionResult {
  /** Tool ID that was executed */
  toolId: string;
  
  /** Whether the execution was successful */
  success: boolean;
  
  /** Execution result data (if successful) */
  result?: unknown;
  
  /** Error information (if failed) */
  error?: {
    message: string;
    code?: string;
  };
  
  /** Execution duration in milliseconds */
  durationMs: number;
  
  /** Timestamp when execution started */
  startedAt: Date;
  
  /** Tool execution metrics */
  metrics?: {
    inputSize?: number;
    outputSize?: number;
    tokenUsage?: number;
    memoryUsage?: number;
  };
}

/**
 * Tool usage metrics interface
 */
export interface ToolUsageMetrics {
  /** Tool ID */
  toolId: string;
  
  /** Total number of executions */
  totalExecutions: number;
  
  /** Number of successful executions */
  successfulExecutions: number;
  
  /** Number of failed executions */
  failedExecutions: number;
  
  /** Average execution duration in milliseconds */
  avgDurationMs: number;
  
  /** Success rate percentage */
  successRate: number;
  
  /** Usage trend (executions per time period) */
  usageTrend?: Array<{
    timestamp: Date;
    count: number;
  }>;
}

/**
 * Tool fallback rule interface
 */
export interface ToolFallbackRule {
  /** Rule ID */
  id: string;
  
  /** Primary tool ID */
  primaryToolId: string;
  
  /** Fallback tool ID */
  fallbackToolId: string;
  
  /** Error patterns that trigger this fallback rule */
  errorPatterns?: string[];
  
  /** Whether this rule is enabled */
  enabled: boolean;
  
  /** Fallback condition function */
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
   * @returns Promise resolving to true if unregistered successfully
   */
  unregisterTool(toolId: string): Promise<boolean>;
  
  /**
   * Get a tool by ID
   * @param toolId The tool ID to retrieve
   * @returns Promise resolving to the tool or null if not found
   */
  getTool(toolId: string): Promise<Tool | null>;
  
  /**
   * Get all registered tools, optionally filtered
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
   * @param enabled Whether to enable or disable the tool
   * @returns Promise resolving to the updated tool
   */
  setToolEnabled(toolId: string, enabled: boolean): Promise<Tool>;
  
  /**
   * Execute a tool
   * @param toolId The tool ID to execute
   * @param params The parameters to pass to the tool
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
   * @param toolId Optional tool ID to get metrics for (all tools if omitted)
   * @returns Promise resolving to tool metrics
   */
  getToolMetrics(toolId?: string): Promise<ToolUsageMetrics[]>;
  
  /**
   * Reset tool metrics
   * @param toolId Optional tool ID to reset metrics for (all tools if omitted)
   * @returns Promise resolving to true if reset successfully
   */
  resetToolMetrics(toolId?: string): Promise<boolean>;
  
  /**
   * Find the best tool for a specific task
   * @param taskDescription Description of the task
   * @param context Additional context for tool selection
   * @returns Promise resolving to the recommended tool or null
   */
  findBestToolForTask(
    taskDescription: string,
    context?: unknown
  ): Promise<Tool | null>;
  
  /**
   * Register a fallback rule between tools
   * @param rule The fallback rule to register
   * @returns Promise resolving to the registered rule
   */
  registerFallbackRule(rule: Omit<ToolFallbackRule, 'id'>): Promise<ToolFallbackRule>;
  
  /**
   * Unregister a fallback rule
   * @param ruleId The rule ID to unregister
   * @returns Promise resolving to true if unregistered successfully
   */
  unregisterFallbackRule(ruleId: string): Promise<boolean>;
  
  /**
   * Get fallback rules, optionally filtered
   * @param filter Optional filter criteria
   * @returns Promise resolving to matching fallback rules
   */
  getFallbackRules(filter?: {
    primaryToolId?: string;
    fallbackToolId?: string;
    enabled?: boolean;
  }): Promise<ToolFallbackRule[]>;
  
  /**
   * Enable or disable a fallback rule
   * @param ruleId The rule ID to update
   * @param enabled Whether to enable or disable the rule
   * @returns Promise resolving to the updated rule
   */
  setFallbackRuleEnabled(ruleId: string, enabled: boolean): Promise<ToolFallbackRule>;
  
  /**
   * Get tool manager statistics
   * @returns Promise resolving to manager statistics
   */
  getStats(): Promise<{
    totalTools: number;
    enabledTools: number;
    disabledTools: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    overallSuccessRate: number;
    avgExecutionTimeMs: number;
    mostUsedTools: Array<{
      toolId: string;
      name: string;
      executionCount: number;
    }>;
    fallbackRules: number;
    fallbacksTriggered: number;
  }>;
} 