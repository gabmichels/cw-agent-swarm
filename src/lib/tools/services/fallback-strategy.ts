/**
 * Implementation of fallback strategy for tool execution
 */
import { IFallbackStrategy } from '../interfaces/fallback-strategy.interface';
import { 
  Tool, 
  ToolExecutionResult, 
  FallbackStrategy as FallbackStrategyType 
} from '../types';

interface ToolExecutionStats {
  totalExecutions: number;
  successCount: number;
  successRate: number;
  averageDuration: number;
  recentExecutions: Array<{
    timestamp: number;
    success: boolean;
    durationMs: number;
  }>;
}

export class FallbackStrategy implements IFallbackStrategy {
  /**
   * The currently active fallback strategy
   */
  private strategy: FallbackStrategyType = FallbackStrategyType.SEQUENTIAL;
  
  /**
   * Tool execution statistics for success rate calculation
   */
  private toolStats: Map<string, ToolExecutionStats> = new Map();
  
  /**
   * Cache of tool similarity scores
   */
  private similarityCache: Map<string, Map<string, number>> = new Map();
  
  /**
   * Maximum number of recent executions to store per tool
   */
  private readonly MAX_RECENT_EXECUTIONS = 100;
  
  /**
   * Constructor for FallbackStrategy
   * @param initialStrategy Initial fallback strategy to use
   */
  constructor(initialStrategy?: FallbackStrategyType) {
    if (initialStrategy) {
      this.strategy = initialStrategy;
    }
  }
  
  /**
   * Get the current active fallback strategy
   */
  getActiveStrategy(): FallbackStrategyType {
    return this.strategy;
  }
  
  /**
   * Set the fallback strategy to use
   * @param strategy The strategy to use for fallbacks
   */
  setStrategy(strategy: FallbackStrategyType): void {
    this.strategy = strategy;
  }
  
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
  ): Tool[] {
    // Filter out the failed tool and disabled tools
    const eligibleTools = availableTools.filter(tool => 
      tool.id !== failedTool.id && tool.enabled
    );
    
    if (eligibleTools.length === 0) {
      return [];
    }
    
    // Apply the current strategy to determine fallbacks
    switch (this.strategy) {
      case FallbackStrategyType.SEQUENTIAL:
        // Simply use the available tools in their existing order
        return eligibleTools;
        
      case FallbackStrategyType.SIMILARITY:
        // Sort by similarity to the failed tool
        return this.getSimilarTools(failedTool, eligibleTools);
        
      case FallbackStrategyType.PERFORMANCE:
        // Sort by success rate
        return this.getHighPerformingTools(eligibleTools);
        
      case FallbackStrategyType.NONE:
        // No fallbacks
        return [];
        
      default:
        // Default to sequential
        return eligibleTools;
    }
  }
  
  /**
   * Record tool execution outcome for future fallback decisions
   * @param tool The tool that was executed
   * @param result The result of the execution
   */
  recordExecutionOutcome(tool: Tool, result: ToolExecutionResult): void {
    const toolId = tool.id;
    const stats = this.toolStats.get(toolId) || {
      totalExecutions: 0,
      successCount: 0,
      successRate: 0,
      averageDuration: 0,
      recentExecutions: []
    };
    
    // Calculate duration
    const durationMs = result.metrics.durationMs;
    
    // Update statistics
    stats.totalExecutions++;
    if (result.success) {
      stats.successCount++;
    }
    stats.successRate = stats.successCount / stats.totalExecutions;
    
    // Update average duration using a weighted approach
    stats.averageDuration = stats.averageDuration === 0
      ? durationMs
      : (stats.averageDuration * 0.9) + (durationMs * 0.1); // Weighted average giving more weight to recent executions
    
    // Add to recent executions
    stats.recentExecutions.push({
      timestamp: Date.now(),
      success: result.success,
      durationMs
    });
    
    // Keep only the most recent executions
    if (stats.recentExecutions.length > this.MAX_RECENT_EXECUTIONS) {
      stats.recentExecutions.shift();
    }
    
    // Update the map
    this.toolStats.set(toolId, stats);
  }
  
  /**
   * Get success rate statistics for a tool
   * @param toolId ID of the tool to get statistics for
   * @returns Success rate as a number between 0 and 1, or null if no data
   */
  getToolSuccessRate(toolId: string): number | null {
    const stats = this.toolStats.get(toolId);
    if (!stats || stats.totalExecutions === 0) {
      return null;
    }
    return stats.successRate;
  }
  
  /**
   * Calculate similarity between tools for fallback recommendations
   * @param sourceToolId Source tool ID to compare from
   * @param targetToolId Target tool ID to compare with
   * @returns Similarity score between 0 and 1
   */
  calculateToolSimilarity(sourceToolId: string, targetToolId: string): number {
    // Check cache first
    const sourceCache = this.similarityCache.get(sourceToolId);
    if (sourceCache?.has(targetToolId)) {
      return sourceCache.get(targetToolId) || 0;
    }
    
    // For now, use a simple random similarity score
    // In a real implementation, this would use tool descriptions, categories, schema, etc.
    const similarity = Math.random();
    
    // Update cache
    if (!this.similarityCache.has(sourceToolId)) {
      this.similarityCache.set(sourceToolId, new Map());
    }
    this.similarityCache.get(sourceToolId)?.set(targetToolId, similarity);
    
    return similarity;
  }
  
  /**
   * Get tools similar to the given tool
   * @param sourceTool Source tool to find similar tools for
   * @param availableTools Available tools to choose from
   * @returns Tools ordered by similarity
   */
  private getSimilarTools(sourceTool: Tool, availableTools: Tool[]): Tool[] {
    return [...availableTools].sort((a, b) => {
      const similarityA = this.calculateToolSimilarity(sourceTool.id, a.id);
      const similarityB = this.calculateToolSimilarity(sourceTool.id, b.id);
      return similarityB - similarityA; // Descending order
    });
  }
  
  /**
   * Get tools ordered by performance (success rate)
   * @param availableTools Available tools to choose from
   * @returns Tools ordered by success rate
   */
  private getHighPerformingTools(availableTools: Tool[]): Tool[] {
    return [...availableTools].sort((a, b) => {
      const rateA = this.getToolSuccessRate(a.id) || 0;
      const rateB = this.getToolSuccessRate(b.id) || 0;
      return rateB - rateA; // Descending order
    });
  }
} 