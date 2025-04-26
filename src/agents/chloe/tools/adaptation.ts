import { ChatOpenAI } from '@langchain/openai';
import { ToolRegistry } from './registry';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Interface for tool usage statistics
 */
export interface ToolUsageStats {
  toolName: string;
  usageCount: number;
  successRate: number;
  averageExecutionTime: number;
  parameterDistributions: Record<string, any>;
  lastUsed: Date;
  performanceByParameter: Record<string, any>;
  errorTypes: Record<string, number>;
}

/**
 * Interface for parameter optimization
 */
export interface ParameterOptimization {
  parameterName: string;
  originalValue: any;
  optimizedValue: any;
  confidenceScore: number;
  reasoning: string;
}

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult {
  success: boolean;
  result: any;
  executionTime: number;
  error?: string;
  parameters: Record<string, any>;
}

/**
 * The ToolAdaptation class enables dynamic modification of tools
 * for new use cases and optimizes parameters based on historical performance.
 */
export class ToolAdaptation {
  private registry: ToolRegistry;
  private model: ChatOpenAI;
  private usageStatistics: Map<string, ToolUsageStats> = new Map();
  private optimizationHistory: Map<string, ParameterOptimization[]> = new Map();
  private executionHistory: Map<string, ToolExecutionResult[]> = new Map();
  
  constructor(registry: ToolRegistry, model: ChatOpenAI) {
    this.registry = registry;
    this.model = model;
  }
  
  /**
   * Record a tool execution result
   */
  recordExecution(toolName: string, result: ToolExecutionResult): void {
    // Get existing history or create new entry
    const history = this.executionHistory.get(toolName) || [];
    history.push(result);
    
    // Keep only the last 100 executions for memory efficiency
    if (history.length > 100) {
      history.shift();
    }
    
    this.executionHistory.set(toolName, history);
    
    // Update usage statistics
    this.updateStatistics(toolName, result);
  }
  
  /**
   * Update tool usage statistics based on execution results
   */
  private updateStatistics(toolName: string, result: ToolExecutionResult): void {
    // Get existing stats or create new entry
    const stats = this.usageStatistics.get(toolName) || {
      toolName,
      usageCount: 0,
      successRate: 0,
      averageExecutionTime: 0,
      parameterDistributions: {},
      lastUsed: new Date(),
      performanceByParameter: {},
      errorTypes: {}
    };
    
    // Update basic stats
    stats.usageCount += 1;
    stats.lastUsed = new Date();
    
    // Calculate success rate
    const successCount = stats.successRate * (stats.usageCount - 1) + (result.success ? 1 : 0);
    stats.successRate = successCount / stats.usageCount;
    
    // Calculate average execution time with weighted average
    stats.averageExecutionTime = 
      (stats.averageExecutionTime * (stats.usageCount - 1) + result.executionTime) / stats.usageCount;
    
    // Update parameter distributions and performance
    for (const [param, value] of Object.entries(result.parameters)) {
      // Initialize parameter tracking if it doesn't exist
      if (!stats.parameterDistributions[param]) {
        stats.parameterDistributions[param] = {};
      }
      
      // Convert value to string for use as a key
      const valueKey = String(value);
      
      // Initialize tracking for this parameter value
      if (!stats.parameterDistributions[param][valueKey]) {
        stats.parameterDistributions[param][valueKey] = {
          count: 0,
          successCount: 0,
          avgExecutionTime: 0
        };
      }
      
      // Update parameter value statistics
      const valueStats = stats.parameterDistributions[param][valueKey];
      valueStats.count += 1;
      if (result.success) {
        valueStats.successCount += 1;
      }
      valueStats.avgExecutionTime = 
        (valueStats.avgExecutionTime * (valueStats.count - 1) + result.executionTime) / valueStats.count;
    }
    
    // Track error types
    if (!result.success && result.error) {
      const errorType = this.categorizeError(result.error);
      stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;
    }
    
    // Save updated statistics
    this.usageStatistics.set(toolName, stats);
  }
  
  /**
   * Categorize an error message into a general error type
   */
  private categorizeError(errorMessage: string): string {
    if (errorMessage.toLowerCase().includes('permission') || 
        errorMessage.toLowerCase().includes('access')) {
      return 'permission_error';
    } else if (errorMessage.toLowerCase().includes('not found') || 
               errorMessage.toLowerCase().includes('404')) {
      return 'not_found_error';
    } else if (errorMessage.toLowerCase().includes('timeout') || 
               errorMessage.toLowerCase().includes('timed out')) {
      return 'timeout_error';
    } else if (errorMessage.toLowerCase().includes('rate limit') || 
               errorMessage.toLowerCase().includes('too many requests')) {
      return 'rate_limit_error';
    } else if (errorMessage.toLowerCase().includes('validation') || 
               errorMessage.toLowerCase().includes('invalid')) {
      return 'validation_error';
    } else if (errorMessage.toLowerCase().includes('network') || 
               errorMessage.toLowerCase().includes('connection')) {
      return 'network_error';
    } else {
      return 'other_error';
    }
  }
  
  /**
   * Optimize parameters for a specific tool based on historical performance
   */
  async optimizeParameters(
    toolName: string, 
    baseParameters: Record<string, any>
  ): Promise<Record<string, any>> {
    const stats = this.usageStatistics.get(toolName);
    
    // If we don't have enough data, return the original parameters
    if (!stats || stats.usageCount < 10) {
      return baseParameters;
    }
    
    // Get the tool schema
    const toolInfo = this.registry.getTool(toolName);
    if (!toolInfo || !toolInfo.tool) {
      return baseParameters;
    }
    
    const optimized: Record<string, any> = { ...baseParameters };
    const optimizations: ParameterOptimization[] = [];
    
    // For each parameter, determine if optimization is needed
    for (const [param, value] of Object.entries(baseParameters)) {
      // Skip if we don't have distribution data for this parameter
      if (!stats.parameterDistributions[param]) {
        continue;
      }
      
      // Find the best performing value for this parameter
      let bestValue = value;
      let bestSuccessRate = 0;
      
      for (const [paramValue, valueStats] of Object.entries(stats.parameterDistributions[param])) {
        // Only consider values with sufficient samples
        const typedValueStats = valueStats as { 
          count: number;
          successCount: number;
          avgExecutionTime: number;
        };
        
        if (typedValueStats.count >= 3) {
          const successRate = typedValueStats.successCount / typedValueStats.count;
          
          // If this value performs better than what we've seen so far
          if (successRate > bestSuccessRate) {
            bestSuccessRate = successRate;
            // Convert string back to original type if possible
            bestValue = this.convertToAppropriateType(paramValue, value);
          }
        }
      }
      
      // If we found a better value, update the parameter
      if (bestValue !== value && bestSuccessRate > 0.6) {
        optimized[param] = bestValue;
        
        // Record the optimization
        optimizations.push({
          parameterName: param,
          originalValue: value,
          optimizedValue: bestValue,
          confidenceScore: bestSuccessRate,
          reasoning: `Observed ${bestSuccessRate.toFixed(2)} success rate with this value`
        });
      }
    }
    
    // Store optimization history
    if (optimizations.length > 0) {
      const history = this.optimizationHistory.get(toolName) || [];
      this.optimizationHistory.set(toolName, [...history, ...optimizations]);
    }
    
    return optimized;
  }
  
  /**
   * Convert a string to the appropriate type based on a reference value
   */
  private convertToAppropriateType(value: string, reference: any): any {
    if (typeof reference === 'number') {
      return parseFloat(value);
    } else if (typeof reference === 'boolean') {
      return value.toLowerCase() === 'true';
    } else if (Array.isArray(reference)) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } else {
      return value;
    }
  }
  
  /**
   * Adapt an existing tool for a new use case
   */
  async adaptToolForNewUseCase(
    originalToolName: string, 
    newUseCase: string,
    newParameters: string[] = []
  ): Promise<StructuredTool | null> {
    // Get the original tool
    const toolInfo = this.registry.getTool(originalToolName);
    if (!toolInfo || !toolInfo.tool) {
      console.error(`Tool ${originalToolName} not found in registry`);
      return null;
    }
    
    const originalTool = toolInfo.tool;
    const originalMetadata = toolInfo.metadata;
    
    try {
      // Construct a prompt for the LLM to generate the adaptation
      const prompt = `
You need to adapt an existing tool for a new use case.

Original tool: ${originalToolName}
Original description: ${(originalTool as any).description || originalMetadata.description}
New use case: ${newUseCase}
Additional parameters to support: ${newParameters.join(', ')}

Please create a new StructuredTool implementation that wraps the original tool, adding the following:
1. Logic to handle the new use case
2. Support for any additional parameters
3. Appropriate data transformation between the new and original interfaces

Return the complete code as valid TypeScript that extends StructuredTool.
`;

      const response = await this.model.invoke(prompt);
      
      // Extract code from the model's response
      const codeMatch = response.content.match(/```typescript\n([\s\S]*?)\n```/) || 
                        response.content.match(/```ts\n([\s\S]*?)\n```/) || 
                        [null, response.content];
      
      const code = codeMatch[1];
      
      if (!code) {
        console.error('Failed to extract code from model response');
        return null;
      }
      
      // Create a temporary file with the code
      // In a production system, you'd use more sophisticated evaluation
      // like a sandboxed environment or compilation step
      
      // For now, let's create a synthetic tool that wraps the original
      const newToolName = `${originalToolName}_adapted_for_${newUseCase.replace(/\s+/g, '_').toLowerCase()}`;
      
      // Create a new tool that wraps the original
      const newTool = new StructuredTool({
        name: newToolName,
        description: `Adapted version of ${originalToolName} for ${newUseCase}`,
        schema: z.object({
          ...this.getZodSchemaForTool(originalTool),
          // Add new parameters with unknown type for now
          ...Object.fromEntries(newParameters.map(param => [param, z.any().describe(`New parameter: ${param}`)]))
        }),
        func: async (input: Record<string, any>) => {
          // Separate original params from new ones
          const originalParams: Record<string, any> = {};
          const newParams: Record<string, any> = {};
          
          for (const [key, value] of Object.entries(input)) {
            if (newParameters.includes(key)) {
              newParams[key] = value;
            } else {
              originalParams[key] = value;
            }
          }
          
          try {
            // Pre-process with the new parameters if needed
            // This is where the actual adaptation logic would go
            // For now, we'll just pass through to the original tool
            
            // Call the original tool
            const result = await (originalTool as any).invoke(originalParams);
            
            // Record execution for future optimization
            this.recordExecution(newToolName, {
              success: true,
              result,
              executionTime: 0, // We're not measuring here
              parameters: input
            });
            
            return result;
          } catch (error) {
            this.recordExecution(newToolName, {
              success: false,
              result: null,
              executionTime: 0,
              error: error instanceof Error ? error.message : String(error),
              parameters: input
            });
            
            throw error;
          }
        }
      });
      
      // Register the new tool with the registry
      this.registry.registerTool(newTool, {
        ...originalMetadata,
        name: newToolName,
        description: `Adapted version of ${originalToolName} for ${newUseCase}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        author: 'ToolAdaptation',
        status: 'experimental'
      });
      
      return newTool;
    } catch (error) {
      console.error('Error adapting tool:', error);
      return null;
    }
  }
  
  /**
   * Get the Zod schema for a tool based on its parameters
   */
  private getZodSchemaForTool(tool: StructuredTool): Record<string, z.ZodTypeAny> {
    // This is a simplified implementation that would need to be
    // expanded with proper schema parsing in a production system
    return {};
  }
  
  /**
   * Get usage statistics for a specific tool
   */
  getToolStatistics(toolName: string): ToolUsageStats | null {
    return this.usageStatistics.get(toolName) || null;
  }
  
  /**
   * Get all tool usage statistics
   */
  getAllToolStatistics(): ToolUsageStats[] {
    return Array.from(this.usageStatistics.values());
  }
  
  /**
   * Get optimization history for a specific tool
   */
  getOptimizationHistory(toolName: string): ParameterOptimization[] {
    return this.optimizationHistory.get(toolName) || [];
  }
  
  /**
   * Find similar tools based on usage patterns
   */
  findSimilarTools(toolName: string, minSimilarity: number = 0.7): string[] {
    const targetStats = this.usageStatistics.get(toolName);
    if (!targetStats) {
      return [];
    }
    
    const similarities: [string, number][] = [];
    
    // Compare with all other tools
    Array.from(this.usageStatistics.entries()).forEach(([otherName, otherStats]) => {
      if (otherName === toolName) {
        return;
      }
      
      // Calculate similarity based on usage patterns
      // This is a simple implementation - production would use more sophisticated metrics
      const similarityScore = this.calculateToolSimilarity(targetStats, otherStats);
      
      if (similarityScore >= minSimilarity) {
        similarities.push([otherName, similarityScore]);
      }
    });
    
    // Sort by similarity score descending
    similarities.sort((a, b) => b[1] - a[1]);
    
    // Return just the tool names
    return similarities.map(([name]) => name);
  }
  
  /**
   * Calculate similarity between two tools based on usage patterns
   */
  private calculateToolSimilarity(toolA: ToolUsageStats, toolB: ToolUsageStats): number {
    // This is a simple example using success rate and execution time
    // A production system would use more sophisticated metrics
    
    const successRateDiff = Math.abs(toolA.successRate - toolB.successRate);
    const executionTimeDiff = Math.abs(
      toolA.averageExecutionTime - toolB.averageExecutionTime
    ) / Math.max(toolA.averageExecutionTime, toolB.averageExecutionTime);
    
    // Error type similarity (Jaccard similarity)
    const allErrorTypes = new Set([
      ...Object.keys(toolA.errorTypes),
      ...Object.keys(toolB.errorTypes)
    ]);
    
    const commonErrorTypes = Object.keys(toolA.errorTypes).filter(
      type => Object.keys(toolB.errorTypes).includes(type)
    ).length;
    
    const errorTypeSimilarity = allErrorTypes.size > 0 
      ? commonErrorTypes / allErrorTypes.size 
      : 1.0;
    
    // Weight the different factors
    const successRateWeight = 0.4;
    const executionTimeWeight = 0.3;
    const errorTypeWeight = 0.3;
    
    // Calculate weighted similarity (higher is more similar)
    const similarity = (
      (1 - successRateDiff) * successRateWeight +
      (1 - executionTimeDiff) * executionTimeWeight +
      errorTypeSimilarity * errorTypeWeight
    );
    
    return similarity;
  }
  
  /**
   * Suggest tool improvements based on usage statistics
   */
  async suggestToolImprovements(toolName: string): Promise<string> {
    const stats = this.usageStatistics.get(toolName);
    if (!stats || stats.usageCount < 10) {
      return "Insufficient usage data to suggest improvements.";
    }
    
    const toolInfo = this.registry.getTool(toolName);
    if (!toolInfo || !toolInfo.tool) {
      return `Tool ${toolName} not found in registry.`;
    }
    
    // Format error types for the prompt
    const errorTypes = Object.entries(stats.errorTypes)
      .map(([type, count]) => `${type}: ${count} occurrences (${(count/stats.usageCount*100).toFixed(1)}%)`)
      .join('\n');
    
    // Format parameter performance for the prompt
    let paramPerformance = '';
    for (const [param, distributions] of Object.entries(stats.parameterDistributions)) {
      paramPerformance += `\nParameter "${param}":\n`;
      
      for (const [value, valueStats] of Object.entries(distributions)) {
        // Fix for valueStats being unknown
        const typedValueStats = valueStats as { 
          count: number;
          successCount: number;
          avgExecutionTime: number;
        };
        
        const successRate = typedValueStats.successCount / typedValueStats.count;
        paramPerformance += `  Value "${value}": ${typedValueStats.count} uses, ${(successRate*100).toFixed(1)}% success rate\n`;
      }
    }
    
    const prompt = `
Analyze the usage statistics for tool "${toolName}" and suggest concrete improvements.

Tool description: ${(toolInfo.tool as any).description || toolInfo.metadata.description}
Usage count: ${stats.usageCount}
Success rate: ${(stats.successRate*100).toFixed(1)}%
Average execution time: ${stats.averageExecutionTime.toFixed(2)}ms
Last used: ${stats.lastUsed.toISOString()}

Error types:
${errorTypes}

Parameter performance:
${paramPerformance}

Based on this data, please suggest specific improvements for this tool:
1. What error handling could be improved?
2. Which parameters should be optimized and how?
3. Are there any usage patterns that indicate a need for new features?
4. Is there any performance optimization potential?

Provide detailed, actionable suggestions.
`;

    try {
      const response = await this.model.invoke(prompt);
      return response.content;
    } catch (error) {
      console.error('Error suggesting tool improvements:', error);
      return "Error generating improvement suggestions.";
    }
  }
} 