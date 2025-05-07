/**
 * Interface for Tool Fallback Orchestrator - coordinates tool execution with fallback strategies
 */
import { 
  Tool, 
  ToolExecutionOptions, 
  ToolExecutionResult,
  FallbackStrategy
} from '../types';

import { IToolRegistry } from './tool-registry.interface';
import { IFallbackStrategy } from './fallback-strategy.interface';
import { IToolExecutor } from './tool-executor.interface';

export interface IToolFallbackOrchestrator {
  /**
   * Get the registry used by this orchestrator
   */
  getToolRegistry(): IToolRegistry;
  
  /**
   * Get the fallback strategy used by this orchestrator
   */
  getFallbackStrategy(): IFallbackStrategy;
  
  /**
   * Get the executor used by this orchestrator
   */
  getToolExecutor(): IToolExecutor;
  
  /**
   * Execute a tool with automatic fallback handling
   * @param toolId ID of the tool to execute
   * @param args Arguments for the tool execution
   * @param options Optional execution options
   * @returns Result of the tool execution (which may be from a fallback)
   */
  executeWithFallback(
    toolId: string,
    args: Record<string, unknown>,
    options?: ToolExecutionOptions & {
      /**
       * Maximum number of fallbacks to attempt
       */
      maxFallbacks?: number;
      
      /**
       * Override the default fallback strategy
       */
      fallbackStrategy?: FallbackStrategy;
      
      /**
       * Whether to disable fallbacks entirely
       */
      disableFallbacks?: boolean;
    }
  ): Promise<ToolExecutionResult & {
    /**
     * Whether this result came from a fallback tool
     */
    fromFallback: boolean;
    
    /**
     * ID of the original tool that was requested
     */
    originalToolId: string;
    
    /**
     * Number of fallbacks attempted before success
     */
    fallbacksAttempted: number;
  }>;
  
  /**
   * Get the execution history for a tool
   * @param toolId ID of the tool to get history for
   * @param limit Maximum number of results to return
   * @returns Array of execution results
   */
  getToolExecutionHistory(
    toolId: string,
    limit?: number
  ): Promise<ToolExecutionResult[]>;
  
  /**
   * Get tool execution statistics
   * @returns Execution statistics by tool ID
   */
  getExecutionStatistics(): Promise<Record<string, {
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    fallbackRate: number;
  }>>;
} 