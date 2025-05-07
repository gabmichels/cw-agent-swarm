/**
 * Interface for tool fallback strategy - responsible for determining fallbacks when tools fail
 */
import { Tool, ToolExecutionResult, FallbackStrategy } from '../types';

export interface IFallbackStrategy {
  /**
   * Get the current active fallback strategy
   */
  getActiveStrategy(): FallbackStrategy;
  
  /**
   * Set the fallback strategy to use
   * @param strategy The strategy to use for fallbacks
   */
  setStrategy(strategy: FallbackStrategy): void;
  
  /**
   * Determine fallback tools when a tool execution fails
   * @param failedTool The tool that failed
   * @param executionResult The result of the failed execution
   * @param availableTools All available tools for fallback
   * @returns Ordered array of fallback tools to try
   */
  determineFallbacks(
    failedTool: Tool,
    executionResult: ToolExecutionResult,
    availableTools: Tool[]
  ): Tool[];
  
  /**
   * Record tool execution outcome for future fallback decisions
   * @param tool The tool that was executed
   * @param result The result of the execution
   */
  recordExecutionOutcome(tool: Tool, result: ToolExecutionResult): void;
  
  /**
   * Get success rate statistics for a tool
   * @param toolId ID of the tool to get statistics for
   * @returns Success rate as a number between 0 and 1, or null if no data
   */
  getToolSuccessRate(toolId: string): number | null;
  
  /**
   * Calculate similarity between tools for fallback recommendations
   * @param sourceToolId Source tool ID to compare from
   * @param targetToolId Target tool ID to compare with
   * @returns Similarity score between 0 and 1
   */
  calculateToolSimilarity(sourceToolId: string, targetToolId: string): number;
} 