/**
 * Unified Tool Foundation Interface
 * 
 * Main interface for the unified tool foundation system that provides
 * a single entry point for all tool operations across specialized systems.
 * This interface consolidates functionality while maintaining the integrity
 * of individual tool systems.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Interface-first design
 * - Dependency injection support
 * - Comprehensive error handling
 * - Performance optimization
 * - Immutable data structures
 */

import {
  UnifiedToolDefinition,
  ToolIdentifier,
  ToolParameters,
  ExecutionContext,
  ToolResult,
  ToolId,
  UnifiedTool,
  ToolDiscoveryCriteria,
  SearchContext,
  ToolHealthStatus,
  ToolMetrics,
  ValidationResult,
  ToolRegistrationResult,
  ToolSearchResult,
  ToolExecutionStats
} from '../types/FoundationTypes';

/**
 * Core interface for the unified tool foundation
 * 
 * This interface provides the main contract for tool management,
 * discovery, and execution across all specialized systems.
 * 
 * NO FALLBACK EXECUTORS - Tools either exist or throw proper errors
 */
export interface IUnifiedToolFoundation {
  // ==================== Tool Lifecycle Management ====================

  /**
   * Register a tool with the foundation
   * @param definition Complete tool definition with executor
   * @returns Registration result with tool ID or error
   * @throws ToolRegistrationError if registration fails
   */
  registerTool(definition: UnifiedToolDefinition): Promise<ToolRegistrationResult>;

  /**
   * Unregister a tool from the foundation
   * @param identifier Tool ID or name to unregister
   * @returns True if tool was unregistered, false if not found
   * @throws ToolFoundationError if unregistration fails
   */
  unregisterTool(identifier: ToolIdentifier): Promise<boolean>;

  /**
   * Update an existing tool definition
   * @param identifier Tool ID or name to update
   * @param definition Updated tool definition
   * @returns True if tool was updated, false if not found
   * @throws ToolValidationError if definition is invalid
   */
  updateTool(identifier: ToolIdentifier, definition: Partial<UnifiedToolDefinition>): Promise<boolean>;

  // ==================== Tool Discovery ====================

  /**
   * Find a specific tool by identifier
   * @param identifier Tool ID or name to find
   * @returns Tool if found, null if not found
   */
  findTool(identifier: ToolIdentifier): Promise<UnifiedTool | null>;

  /**
   * Discover tools based on criteria
   * @param criteria Search criteria for tool discovery
   * @returns Array of matching tools
   */
  discoverTools(criteria: ToolDiscoveryCriteria): Promise<readonly UnifiedTool[]>;

  /**
   * Search tools using natural language query
   * @param query Natural language query for tool search
   * @param context Optional search context for better results
   * @returns Array of search results with relevance scores
   */
  searchTools(query: string, context?: SearchContext): Promise<readonly ToolSearchResult[]>;

  /**
   * Get all available tool names (for error messages and suggestions)
   * @returns Array of all registered tool names
   */
  getAllToolNames(): Promise<readonly string[]>;

  /**
   * Find similar tools to a given tool (for suggestions)
   * @param identifier Tool ID or name to find similar tools for
   * @param limit Maximum number of similar tools to return
   * @returns Array of similar tools
   */
  findSimilarTools(identifier: ToolIdentifier, limit?: number): Promise<readonly UnifiedTool[]>;

  // ==================== Tool Execution ====================

  /**
   * Execute a tool with parameters and context
   * 
   * NO FALLBACK EXECUTORS - If tool is not found, throws ToolNotFoundError
   * with suggestions for similar tools.
   * 
   * @param identifier Tool ID or name to execute
   * @param params Parameters for tool execution
   * @param context Execution context with permissions and metadata
   * @returns Tool execution result
   * @throws ToolNotFoundError if tool is not found
   * @throws ToolExecutionError if execution fails
   * @throws ToolValidationError if parameters are invalid
   */
  executeTool(
    identifier: ToolIdentifier,
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult>;

  /**
   * Execute multiple tools in sequence
   * @param executions Array of tool executions to perform
   * @param context Shared execution context
   * @returns Array of execution results
   */
  executeToolChain(
    executions: readonly {
      identifier: ToolIdentifier;
      params: ToolParameters;
    }[],
    context: ExecutionContext
  ): Promise<readonly ToolResult[]>;

  /**
   * Execute multiple tools in parallel
   * @param executions Array of tool executions to perform
   * @param context Shared execution context
   * @returns Array of execution results
   */
  executeToolsParallel(
    executions: readonly {
      identifier: ToolIdentifier;
      params: ToolParameters;
    }[],
    context: ExecutionContext
  ): Promise<readonly ToolResult[]>;

  // ==================== Tool Management ====================

  /**
   * Get health status of a tool
   * @param toolId Tool ID to check health for
   * @returns Health status information
   */
  getToolHealth(toolId: ToolId): Promise<ToolHealthStatus>;

  /**
   * Get execution metrics for a tool
   * @param toolId Tool ID to get metrics for
   * @returns Tool execution metrics
   */
  getToolMetrics(toolId: ToolId): Promise<ToolMetrics>;

  /**
   * Validate a tool definition
   * @param definition Tool definition to validate
   * @returns Validation result with errors/warnings
   */
  validateTool(definition: UnifiedToolDefinition): Promise<ValidationResult>;

  /**
   * Enable or disable a tool
   * @param identifier Tool ID or name to enable/disable
   * @param enabled True to enable, false to disable
   * @returns True if tool status was changed, false if not found
   */
  setToolEnabled(identifier: ToolIdentifier, enabled: boolean): Promise<boolean>;

  /**
   * Get overall tool execution statistics
   * @returns System-wide tool execution statistics
   */
  getExecutionStats(): Promise<ToolExecutionStats>;

  // ==================== System Management ====================

  /**
   * Initialize the foundation system
   * @returns True if initialization was successful
   */
  initialize(): Promise<boolean>;

  /**
   * Shutdown the foundation system gracefully
   * @returns True if shutdown was successful
   */
  shutdown(): Promise<boolean>;

  /**
   * Check if the foundation system is healthy
   * @returns True if system is healthy and operational
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get system-wide health status
   * @returns Detailed health status of the foundation
   */
  getSystemHealth(): Promise<{
    readonly healthy: boolean;
    readonly totalTools: number;
    readonly enabledTools: number;
    readonly unhealthyTools: number;
    readonly issues: readonly string[];
  }>;
} 