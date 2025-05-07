/**
 * Implementation of tool fallback orchestrator for coordinating tool execution with fallbacks
 */
import { 
  IToolFallbackOrchestrator, 
  IToolRegistry, 
  IFallbackStrategy, 
  IToolExecutor 
} from '../interfaces';

import { 
  Tool, 
  ToolExecutionOptions, 
  ToolExecutionResult, 
  FallbackStrategy
} from '../types';

import { StructuredId, IdGenerator } from '../../../utils/ulid';

interface FallbackResult extends ToolExecutionResult {
  fromFallback: boolean;
  originalToolId: string;
  fallbacksAttempted: number;
}

interface ExecutionHistoryEntry extends ToolExecutionResult {
  timestamp: number;
  fromFallback: boolean;
  originalToolId: string;
}

export class ToolFallbackOrchestrator implements IToolFallbackOrchestrator {
  /**
   * History of tool executions
   */
  private executionHistory: Map<string, ExecutionHistoryEntry[]> = new Map();
  
  /**
   * Maximum number of history entries to store per tool
   */
  private readonly MAX_HISTORY_ENTRIES = 100;
  
  /**
   * Constructor for ToolFallbackOrchestrator
   * @param toolRegistry Registry for tool lookup
   * @param fallbackStrategy Strategy for determining fallbacks
   * @param toolExecutor Executor for tool execution
   */
  constructor(
    private readonly toolRegistry: IToolRegistry,
    private readonly fallbackStrategy: IFallbackStrategy,
    private readonly toolExecutor: IToolExecutor
  ) {}
  
  /**
   * Get the registry used by this orchestrator
   */
  getToolRegistry(): IToolRegistry {
    return this.toolRegistry;
  }
  
  /**
   * Get the fallback strategy used by this orchestrator
   */
  getFallbackStrategy(): IFallbackStrategy {
    return this.fallbackStrategy;
  }
  
  /**
   * Get the executor used by this orchestrator
   */
  getToolExecutor(): IToolExecutor {
    return this.toolExecutor;
  }
  
  /**
   * Execute a tool with automatic fallback handling
   * @param toolId ID of the tool to execute
   * @param args Arguments for the tool execution
   * @param options Optional execution options
   * @returns Result of the tool execution (which may be from a fallback)
   */
  async executeWithFallback(
    toolId: string,
    args: Record<string, unknown>,
    options?: ToolExecutionOptions & {
      maxFallbacks?: number;
      fallbackStrategy?: FallbackStrategy;
      disableFallbacks?: boolean;
    }
  ): Promise<ToolExecutionResult & {
    fromFallback: boolean;
    originalToolId: string;
    fallbacksAttempted: number;
  }> {
    // Get the tool
    const tool = this.toolRegistry.getTool(toolId);
    if (!tool) {
      return this.createErrorResult(
        toolId,
        'TOOL_NOT_FOUND',
        `Tool with ID ${toolId} not found`,
        toolId
      );
    }
    
    // Execute the primary tool
    let result: ToolExecutionResult;
    try {
      result = await this.toolExecutor.executeTool(tool, args, options);
    } catch (error) {
      // Handle any unhandled error
      const message = error instanceof Error ? error.message : String(error);
      result = {
        id: IdGenerator.generate(`EXEC_${toolId}`),
        toolId,
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message
        },
        metrics: {
          startTime: Date.now(),
          endTime: Date.now(),
          durationMs: 0
        }
      };
    }
    
    // Record execution outcome for strategy learning
    this.fallbackStrategy.recordExecutionOutcome(tool, result);
    
    // Store in history
    this.recordToolExecution(toolId, {
      ...result,
      timestamp: Date.now(),
      fromFallback: false,
      originalToolId: toolId
    });
    
    // If successful or fallbacks disabled, return the result
    if (result.success || options?.disableFallbacks) {
      return {
        ...result,
        fromFallback: false,
        originalToolId: toolId,
        fallbacksAttempted: 0
      };
    }
    
    // Handle fallbacks
    return this.handleFallbacks(tool, result, args, options);
  }
  
  /**
   * Get the execution history for a tool
   * @param toolId ID of the tool to get history for
   * @param limit Maximum number of results to return
   * @returns Array of execution results
   */
  async getToolExecutionHistory(
    toolId: string,
    limit?: number
  ): Promise<ToolExecutionResult[]> {
    const history = this.executionHistory.get(toolId) || [];
    const maxResults = limit || Number.MAX_SAFE_INTEGER;
    return history.slice(0, maxResults);
  }
  
  /**
   * Get tool execution statistics
   * @returns Execution statistics by tool ID
   */
  async getExecutionStatistics(): Promise<Record<string, {
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    fallbackRate: number;
  }>> {
    const statistics: Record<string, {
      totalExecutions: number;
      successRate: number;
      averageDuration: number;
      fallbackRate: number;
      successCount: number;
      fallbackCount: number;
      totalDuration: number;
    }> = {};
    
    // Collect statistics from execution history
    // Convert Map to array of entries to avoid iterator compatibility issues
    const entries = Array.from(this.executionHistory.entries());
    
    for (const [toolId, executions] of entries) {
      if (!statistics[toolId]) {
        statistics[toolId] = {
          totalExecutions: 0,
          successCount: 0,
          successRate: 0,
          averageDuration: 0,
          fallbackRate: 0,
          fallbackCount: 0,
          totalDuration: 0
        };
      }
      
      const toolStats = statistics[toolId];
      
      // Update statistics with each execution
      for (const execution of executions) {
        toolStats.totalExecutions++;
        
        if (execution.success) {
          toolStats.successCount++;
        }
        
        if (execution.fromFallback) {
          toolStats.fallbackCount++;
        }
        
        toolStats.totalDuration += execution.metrics.durationMs;
      }
      
      // Calculate derived statistics
      toolStats.successRate = toolStats.successCount / toolStats.totalExecutions;
      toolStats.fallbackRate = toolStats.fallbackCount / toolStats.totalExecutions;
      toolStats.averageDuration = toolStats.totalDuration / toolStats.totalExecutions;
    }
    
    // Convert to output format
    return Object.fromEntries(
      Object.entries(statistics).map(([toolId, stats]) => [
        toolId,
        {
          totalExecutions: stats.totalExecutions,
          successRate: stats.successRate,
          averageDuration: stats.averageDuration,
          fallbackRate: stats.fallbackRate
        }
      ])
    );
  }
  
  /**
   * Handle fallbacks for a failed tool execution
   * @param originalTool The original tool that failed
   * @param originalResult The result of the failed execution
   * @param args The arguments for the tool execution
   * @param options Optional execution options
   * @returns Result of the tool execution with fallback info
   */
  private async handleFallbacks(
    originalTool: Tool,
    originalResult: ToolExecutionResult,
    args: Record<string, unknown>,
    options?: ToolExecutionOptions & {
      maxFallbacks?: number;
      fallbackStrategy?: FallbackStrategy;
    }
  ): Promise<FallbackResult> {
    // Set the strategy if specified
    const originalStrategy = this.fallbackStrategy.getActiveStrategy();
    if (options?.fallbackStrategy) {
      this.fallbackStrategy.setStrategy(options.fallbackStrategy);
    }
    
    // Get all available tools for fallback
    const availableTools = this.toolRegistry.getAllTools();
    
    // Determine fallbacks based on strategy
    let fallbackTools = this.fallbackStrategy.determineFallbacks(
      originalTool,
      originalResult,
      availableTools
    );
    
    // Limit the number of fallbacks if specified
    const maxFallbacks = options?.maxFallbacks ?? 3;
    if (fallbackTools.length > maxFallbacks) {
      fallbackTools = fallbackTools.slice(0, maxFallbacks);
    }
    
    // Try each fallback in order
    let fallbacksAttempted = 0;
    
    for (const fallbackTool of fallbackTools) {
      fallbacksAttempted++;
      
      try {
        // Execute the fallback tool
        const fallbackResult = await this.toolExecutor.executeTool(
          fallbackTool,
          args,
          options
        );
        
        // Record execution outcome for strategy learning
        this.fallbackStrategy.recordExecutionOutcome(fallbackTool, fallbackResult);
        
        // Store in history
        this.recordToolExecution(fallbackTool.id, {
          ...fallbackResult,
          timestamp: Date.now(),
          fromFallback: true,
          originalToolId: originalTool.id
        });
        
        // If successful, return the result
        if (fallbackResult.success) {
          return {
            ...fallbackResult,
            fromFallback: true,
            originalToolId: originalTool.id,
            fallbacksAttempted
          };
        }
      } catch (error) {
        // Ignore errors in fallbacks and continue to the next
        continue;
      }
    }
    
    // Restore original strategy
    if (options?.fallbackStrategy) {
      this.fallbackStrategy.setStrategy(originalStrategy);
    }
    
    // If all fallbacks failed, return the original result
    return {
      ...originalResult,
      fromFallback: false,
      originalToolId: originalTool.id,
      fallbacksAttempted
    };
  }
  
  /**
   * Record a tool execution in the history
   * @param toolId ID of the tool
   * @param execution The execution result to record
   */
  private recordToolExecution(toolId: string, execution: ExecutionHistoryEntry): void {
    const history = this.executionHistory.get(toolId) || [];
    
    // Add to history
    history.unshift(execution);
    
    // Limit history size
    if (history.length > this.MAX_HISTORY_ENTRIES) {
      history.pop();
    }
    
    // Update history map
    this.executionHistory.set(toolId, history);
  }
  
  /**
   * Create an error result
   * @param toolId ID of the tool
   * @param code Error code
   * @param message Error message
   * @param originalToolId Original tool ID if from fallback
   * @returns Error result with fallback info
   */
  private createErrorResult(
    toolId: string,
    code: string,
    message: string,
    originalToolId: string
  ): FallbackResult {
    const now = Date.now();
    return {
      id: IdGenerator.generate(`EXEC_${toolId}`),
      toolId,
      success: false,
      error: {
        code,
        message
      },
      metrics: {
        startTime: now,
        endTime: now,
        durationMs: 0
      },
      fromFallback: false,
      originalToolId,
      fallbacksAttempted: 0
    };
  }
} 