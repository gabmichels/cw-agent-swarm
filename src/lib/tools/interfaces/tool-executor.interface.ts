/**
 * Interface for Tool Executor - responsible for tool execution handling
 */
import { Tool, ToolExecutionOptions, ToolExecutionResult } from '../types';

export interface IToolExecutor {
  /**
   * Execute a tool with the given arguments
   * @param tool Tool to execute
   * @param args Arguments for the tool execution
   * @param options Optional execution options
   * @returns Result of the tool execution
   */
  executeTool(
    tool: Tool,
    args: Record<string, unknown>,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult>;
  
  /**
   * Validate arguments against the tool's schema
   * @param tool Tool to validate arguments for
   * @param args Arguments to validate
   * @returns Whether the arguments are valid, and validation errors if any
   */
  validateArguments(
    tool: Tool,
    args: Record<string, unknown>
  ): {
    valid: boolean;
    errors?: string[];
  };
  
  /**
   * Retry a failed tool execution
   * @param tool Tool to retry
   * @param args Arguments for the tool execution
   * @param previousResult Previous failed result
   * @param options Optional execution options
   * @returns Result of the retry execution
   */
  retryExecution(
    tool: Tool,
    args: Record<string, unknown>,
    previousResult: ToolExecutionResult,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult>;
  
  /**
   * Cancel an ongoing tool execution if possible
   * @param executionId ID of the execution to cancel
   * @returns Whether the execution was successfully canceled
   */
  cancelExecution(executionId: string): Promise<boolean>;
  
  /**
   * Check if a tool execution is still in progress
   * @param executionId ID of the execution to check
   * @returns Whether the execution is still in progress
   */
  isExecutionInProgress(executionId: string): boolean;
} 