/**
 * Unified Tool Executor Interface
 * 
 * Interface for executing tools with proper validation, error handling,
 * and security checks. Provides both synchronous and asynchronous execution
 * capabilities with comprehensive context management.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Strict security validation
 * - Performance optimization
 * - Comprehensive error handling
 * - Immutable execution contexts
 */

import {
  ToolIdentifier,
  ToolParameters,
  ExecutionContext,
  ToolResult,
  ToolId,
  ValidationResult
} from '../types/FoundationTypes';

/**
 * Interface for the unified tool executor
 * 
 * Handles tool execution with proper error handling, monitoring,
 * and NO fallback executors. Tools either succeed or fail with
 * proper error information.
 */
export interface IUnifiedToolExecutor {
  // ==================== Core Execution ====================

  /**
   * Execute a tool with parameters and context
   * 
   * NO FALLBACK EXECUTORS - If execution fails, throws proper error
   * with context and suggestions, but does not attempt fallbacks.
   * 
   * @param tool Tool to execute
   * @param params Parameters for execution
   * @param context Execution context with permissions and metadata
   * @returns Tool execution result
   * @throws ToolExecutionError if execution fails
   * @throws ToolParameterError if parameters are invalid
   * @throws ToolPermissionError if permissions are insufficient
   * @throws ToolTimeoutError if execution times out
   * @throws ToolDependencyError if dependencies are missing
   */
  execute(
    tool: UnifiedTool,
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult>;

  /**
   * Execute a tool by ID with parameters and context
   * @param toolId Tool ID to execute
   * @param params Parameters for execution
   * @param context Execution context
   * @returns Tool execution result
   * @throws ToolNotFoundError if tool is not found
   * @throws ToolExecutionError if execution fails
   */
  executeById(
    toolId: ToolId,
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult>;

  /**
   * Execute multiple tools in sequence
   * @param executions Array of tools and parameters to execute
   * @param context Shared execution context
   * @returns Array of execution results
   */
  executeSequence(
    executions: readonly {
      tool: UnifiedTool;
      params: ToolParameters;
    }[],
    context: ExecutionContext
  ): Promise<readonly ToolResult[]>;

  /**
   * Execute multiple tools in parallel
   * @param executions Array of tools and parameters to execute
   * @param context Shared execution context
   * @returns Array of execution results
   */
  executeParallel(
    executions: readonly {
      tool: UnifiedTool;
      params: ToolParameters;
    }[],
    context: ExecutionContext
  ): Promise<readonly ToolResult[]>;

  // ==================== Validation ====================

  /**
   * Validate tool parameters before execution
   * @param tool Tool to validate parameters for
   * @param params Parameters to validate
   * @returns Validation result with errors/warnings
   */
  validateParameters(tool: UnifiedTool, params: ToolParameters): Promise<{
    readonly valid: boolean;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
  }>;

  /**
   * Validate execution context for tool
   * @param tool Tool to validate context for
   * @param context Execution context to validate
   * @returns Validation result with errors/warnings
   */
  validateContext(tool: UnifiedTool, context: ExecutionContext): Promise<{
    readonly valid: boolean;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
  }>;

  /**
   * Check if tool can be executed with given context
   * @param tool Tool to check
   * @param context Execution context
   * @returns True if tool can be executed, false otherwise
   */
  canExecute(tool: UnifiedTool, context: ExecutionContext): Promise<boolean>;

  // ==================== Execution Control ====================

  /**
   * Set execution timeout for tools
   * @param timeoutMs Timeout in milliseconds
   */
  setExecutionTimeout(timeoutMs: number): void;

  /**
   * Get current execution timeout
   * @returns Timeout in milliseconds
   */
  getExecutionTimeout(): number;

  /**
   * Enable or disable retry logic for failed executions
   * @param enabled Whether to enable retry logic
   * @param maxRetries Maximum number of retry attempts
   * @param retryDelayMs Delay between retries in milliseconds
   */
  setRetryPolicy(enabled: boolean, maxRetries?: number, retryDelayMs?: number): void;

  /**
   * Get current retry policy
   * @returns Retry policy configuration
   */
  getRetryPolicy(): {
    readonly enabled: boolean;
    readonly maxRetries: number;
    readonly retryDelayMs: number;
  };

  // ==================== Execution Monitoring ====================

  /**
   * Get execution statistics for a specific tool
   * @param toolId Tool ID to get statistics for
   * @returns Execution statistics
   */
  getToolExecutionStats(toolId: ToolId): Promise<{
    readonly executionCount: number;
    readonly successCount: number;
    readonly failureCount: number;
    readonly successRate: number;
    readonly averageExecutionTime: number;
    readonly lastExecutedAt?: string;
  }>;

  /**
   * Get overall execution statistics
   * @returns System-wide execution statistics
   */
  getExecutionStats(): Promise<{
    readonly totalExecutions: number;
    readonly successfulExecutions: number;
    readonly failedExecutions: number;
    readonly averageExecutionTime: number;
    readonly topTools: readonly {
      readonly toolId: ToolId;
      readonly executionCount: number;
    }[];
  }>;

  /**
   * Get currently running executions
   * @returns Array of active executions
   */
  getActiveExecutions(): Promise<readonly {
    readonly toolId: ToolId;
    readonly toolName: string;
    readonly startedAt: string;
    readonly context: ExecutionContext;
  }[]>;

  // ==================== Health and Status ====================

  /**
   * Check if executor is healthy and operational
   * @returns True if executor is healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get executor health status
   * @returns Detailed health information
   */
  getHealthStatus(): Promise<{
    readonly healthy: boolean;
    readonly activeExecutions: number;
    readonly queuedExecutions: number;
    readonly averageResponseTime: number;
    readonly errorRate: number;
    readonly issues: readonly string[];
  }>;

  /**
   * Initialize the executor
   * @returns True if initialization was successful
   */
  initialize(): Promise<boolean>;

  /**
   * Shutdown the executor gracefully
   * @param waitForActiveExecutions Whether to wait for active executions to complete
   * @returns True if shutdown was successful
   */
  shutdown(waitForActiveExecutions?: boolean): Promise<boolean>;

  // ==================== Event Handling ====================

  /**
   * Register callback for execution events
   * @param event Event type to listen for
   * @param callback Callback function to execute
   */
  on(
    event: 'execution_start' | 'execution_complete' | 'execution_error' | 'execution_timeout',
    callback: (data: {
      readonly toolId: ToolId;
      readonly toolName: string;
      readonly context: ExecutionContext;
      readonly result?: ToolResult;
      readonly error?: Error;
      readonly executionTimeMs?: number;
    }) => void
  ): void;

  /**
   * Remove event callback
   * @param event Event type to remove callback for
   * @param callback Callback function to remove
   */
  off(
    event: 'execution_start' | 'execution_complete' | 'execution_error' | 'execution_timeout',
    callback: Function
  ): void;
} 