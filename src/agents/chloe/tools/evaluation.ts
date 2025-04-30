import { ChatOpenAI } from '@langchain/openai';
import { ToolRegistry } from './registry';
import { ToolAdaptation, ToolUsageStats, ToolExecutionResult } from './adaptation';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ItemStatus } from '../../../constants/status';
import { ReflectionType } from '../../../constants/reflection';

/**
 * Interface for an A/B test definition
 */
export interface ABTest {
  id: string;
  name: string;
  description: string;
  toolA: string; // Original tool
  toolB: string; // Variant tool
  startDate: Date;
  endDate?: Date;
  status: ItemStatus;
  totalExecutions: number;
  variantDistribution: number; // 0.5 means 50/50 split
  metrics: {
    successRateA: number;
    successRateB: number;
    avgExecutionTimeA: number;
    avgExecutionTimeB: number;
    userFeedbackScoreA: number;
    userFeedbackScoreB: number;
  };
  conclusion?: string;
}

/**
 * Interface for performance analysis result
 */
export interface PerformanceAnalysis {
  toolName: string;
  period: ReflectionType;
  usageCount: number;
  successRate: number;
  avgExecutionTime: number;
  errorRate: number;
  topErrors: Array<{type: string, count: number, percentage: number}>;
  parameterPerformance: Record<string, {
    bestValue: string;
    worstValue: string;
    valueDistribution: Record<string, number>;
  }>;
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  recommendations: string[];
}

/**
 * Interface for user feedback on tool execution
 */
export interface ToolFeedback {
  toolName: string;
  executionId: string;
  rating: number; // 1-5 scale
  comment?: string;
  timestamp: Date;
  parameters?: Record<string, any>;
  result?: any;
}

/**
 * The ToolEvaluation class implements A/B testing, performance analytics,
 * and a feedback loop for continuous improvement of tools.
 */
export class ToolEvaluation {
  private registry: ToolRegistry;
  private adaptation: ToolAdaptation;
  private model: ChatOpenAI;
  private abTests: Map<string, ABTest> = new Map();
  private feedback: Map<string, ToolFeedback[]> = new Map();
  private historicalData: Map<string, ToolExecutionResult[]> = new Map();
  private analysisCache: Map<string, PerformanceAnalysis> = new Map();
  private analysisCacheExpiry: Map<string, Date> = new Map();
  
  constructor(registry: ToolRegistry, adaptation: ToolAdaptation, model: ChatOpenAI) {
    this.registry = registry;
    this.adaptation = adaptation;
    this.model = model;
  }
  
  /**
   * Create a new A/B test for two tool variants
   */
  createABTest(
    name: string,
    description: string,
    toolA: string,
    toolB: string,
    variantDistribution: number = 0.5
  ): ABTest | null {
    // Validate the tools exist
    const toolAInfo = this.registry.getTool(toolA);
    const toolBInfo = this.registry.getTool(toolB);
    
    if (!toolAInfo || !toolBInfo) {
      console.error(`Cannot create A/B test: One or both tools (${toolA}, ${toolB}) not found`);
      return null;
    }
    
    const id = `abtest_${Date.now()}_${toolA}_${toolB}`;
    
    const test: ABTest = {
      id,
      name,
      description,
      toolA,
      toolB,
      startDate: new Date(),
      status: ItemStatus.ACTIVE,
      totalExecutions: 0,
      variantDistribution,
      metrics: {
        successRateA: 0,
        successRateB: 0,
        avgExecutionTimeA: 0,
        avgExecutionTimeB: 0,
        userFeedbackScoreA: 0,
        userFeedbackScoreB: 0
      }
    };
    
    this.abTests.set(id, test);
    return test;
  }
  
  /**
   * Select the appropriate tool variant for an A/B test
   */
  selectToolVariant(testId: string): string | null {
    const test = this.abTests.get(testId);
    if (!test || test.status !== ItemStatus.ACTIVE) {
      return null;
    }
    
    // Increment total executions
    test.totalExecutions += 1;
    
    // Determine which variant to use based on distribution
    const useVariantB = Math.random() < test.variantDistribution;
    
    return useVariantB ? test.toolB : test.toolA;
  }
  
  /**
   * Record execution result for an A/B test
   */
  recordTestExecution(
    testId: string, 
    toolName: string,
    result: ToolExecutionResult
  ): void {
    const test = this.abTests.get(testId);
    if (!test) {
      return;
    }
    
    // Update metrics based on which variant was used
    const isToolA = toolName === test.toolA;
    const isToolB = toolName === test.toolB;
    
    if (!isToolA && !isToolB) {
      console.error(`Tool ${toolName} is not part of A/B test ${testId}`);
      return;
    }
    
    // Update success rates
    if (isToolA) {
      const currentSuccesses = test.metrics.successRateA * (test.totalExecutions - 1);
      const newSuccesses = currentSuccesses + (result.success ? 1 : 0);
      test.metrics.successRateA = newSuccesses / test.totalExecutions;
      
      // Update execution time using weighted average
      test.metrics.avgExecutionTimeA = 
        (test.metrics.avgExecutionTimeA * (test.totalExecutions - 1) + result.executionTime) / 
        test.totalExecutions;
    } else {
      const currentSuccesses = test.metrics.successRateB * (test.totalExecutions - 1);
      const newSuccesses = currentSuccesses + (result.success ? 1 : 0);
      test.metrics.successRateB = newSuccesses / test.totalExecutions;
      
      // Update execution time using weighted average
      test.metrics.avgExecutionTimeB = 
        (test.metrics.avgExecutionTimeB * (test.totalExecutions - 1) + result.executionTime) / 
        test.totalExecutions;
    }
    
    // Save the updated test
    this.abTests.set(testId, test);
    
    // Also record the execution for general analytics
    this.recordExecution(toolName, result);
  }
  
  /**
   * Complete an A/B test and determine the winner
   */
  async completeABTest(testId: string): Promise<ABTest | null> {
    const test = this.abTests.get(testId);
    if (!test) {
      return null;
    }
    
    // Mark the test as completed
    test.status = ItemStatus.COMPLETED;
    test.endDate = new Date();
    
    // Determine the conclusion based on metrics
    let conclusions: string[] = [];
    
    // Compare success rates
    if (test.metrics.successRateA > test.metrics.successRateB) {
      conclusions.push(`Tool A (${test.toolA}) has a higher success rate (${(test.metrics.successRateA * 100).toFixed(1)}% vs ${(test.metrics.successRateB * 100).toFixed(1)}%).`);
    } else if (test.metrics.successRateB > test.metrics.successRateA) {
      conclusions.push(`Tool B (${test.toolB}) has a higher success rate (${(test.metrics.successRateB * 100).toFixed(1)}% vs ${(test.metrics.successRateA * 100).toFixed(1)}%).`);
    } else {
      conclusions.push(`Both tools have identical success rates (${(test.metrics.successRateA * 100).toFixed(1)}%).`);
    }
    
    // Compare execution times
    if (test.metrics.avgExecutionTimeA < test.metrics.avgExecutionTimeB) {
      conclusions.push(`Tool A (${test.toolA}) is faster (${test.metrics.avgExecutionTimeA.toFixed(2)}ms vs ${test.metrics.avgExecutionTimeB.toFixed(2)}ms).`);
    } else if (test.metrics.avgExecutionTimeB < test.metrics.avgExecutionTimeA) {
      conclusions.push(`Tool B (${test.toolB}) is faster (${test.metrics.avgExecutionTimeB.toFixed(2)}ms vs ${test.metrics.avgExecutionTimeA.toFixed(2)}ms).`);
    } else {
      conclusions.push(`Both tools have similar execution times (${test.metrics.avgExecutionTimeA.toFixed(2)}ms).`);
    }
    
    // Compare user feedback if available
    if (test.metrics.userFeedbackScoreA > 0 || test.metrics.userFeedbackScoreB > 0) {
      if (test.metrics.userFeedbackScoreA > test.metrics.userFeedbackScoreB) {
        conclusions.push(`Tool A (${test.toolA}) has better user feedback (${test.metrics.userFeedbackScoreA.toFixed(1)} vs ${test.metrics.userFeedbackScoreB.toFixed(1)}).`);
      } else if (test.metrics.userFeedbackScoreB > test.metrics.userFeedbackScoreA) {
        conclusions.push(`Tool B (${test.toolB}) has better user feedback (${test.metrics.userFeedbackScoreB.toFixed(1)} vs ${test.metrics.userFeedbackScoreA.toFixed(1)}).`);
      } else {
        conclusions.push(`Both tools have similar user feedback scores (${test.metrics.userFeedbackScoreA.toFixed(1)}).`);
      }
    }
    
    // Use the LLM to analyze the results and provide a recommendation
    try {
      const prompt = `
You are analyzing the results of an A/B test between two tool variants.

Test: ${test.name}
Description: ${test.description}
Tool A: ${test.toolA}
Tool B: ${test.toolB}
Total executions: ${test.totalExecutions}

Metrics:
- Success Rate A: ${(test.metrics.successRateA * 100).toFixed(1)}%
- Success Rate B: ${(test.metrics.successRateB * 100).toFixed(1)}%
- Avg Execution Time A: ${test.metrics.avgExecutionTimeA.toFixed(2)}ms
- Avg Execution Time B: ${test.metrics.avgExecutionTimeB.toFixed(2)}ms
${test.metrics.userFeedbackScoreA > 0 ? `- User Feedback A: ${test.metrics.userFeedbackScoreA.toFixed(1)}/5` : ''}
${test.metrics.userFeedbackScoreB > 0 ? `- User Feedback B: ${test.metrics.userFeedbackScoreB.toFixed(1)}/5` : ''}

Initial observations:
${conclusions.join('\n')}

Based on the above data, please:
1. Determine which tool variant performed better overall
2. Explain the key factors that led to the difference in performance
3. Recommend which variant should be used going forward
4. Suggest what features or improvements from the better variant could be incorporated into future tools

Provide a concise, data-driven conclusion.
`;

      const response = await this.model.invoke(prompt);
      test.conclusion = response.content;
    } catch (error) {
      console.error('Error generating A/B test conclusion:', error);
      test.conclusion = conclusions.join(' ') + ' No detailed analysis available.';
    }
    
    // Update the test in storage
    this.abTests.set(testId, test);
    
    return test;
  }
  
  /**
   * Record a tool execution for analytics
   */
  recordExecution(toolName: string, result: ToolExecutionResult): void {
    // Record in the adaptation system for parameter optimization
    this.adaptation.recordExecution(toolName, result);
    
    // Store for historical analysis
    const history = this.historicalData.get(toolName) || [];
    history.push(result);
    
    // Keep only the last 1000 executions for memory efficiency
    if (history.length > 1000) {
      history.shift();
    }
    
    this.historicalData.set(toolName, history);
    
    // Invalidate cached analysis for this tool
    this.invalidateAnalysisCache(toolName);
  }
  
  /**
   * Invalidate the cached analysis for a tool
   */
  private invalidateAnalysisCache(toolName: string): void {
    const cacheKeys = Array.from(this.analysisCache.keys())
      .filter(key => key.startsWith(`${toolName}:`));
    
    for (const key of cacheKeys) {
      this.analysisCache.delete(key);
      this.analysisCacheExpiry.delete(key);
    }
  }
  
  /**
   * Record user feedback for a tool execution
   */
  recordFeedback(feedback: ToolFeedback): void {
    // Ensure feedback has a timestamp
    feedback.timestamp = feedback.timestamp || new Date();
    
    // Store the feedback
    const toolFeedback = this.feedback.get(feedback.toolName) || [];
    toolFeedback.push(feedback);
    this.feedback.set(feedback.toolName, toolFeedback);
    
    // Update A/B test metrics if this tool is part of an active test
    Array.from(this.abTests.entries()).forEach(([testId, test]) => {
      if (test.status !== ItemStatus.ACTIVE) return;
      
      if (feedback.toolName === test.toolA) {
        // Update Tool A feedback score (simple average for now)
        const feedbackA = this.feedback.get(test.toolA) || [];
        const scoreSum = feedbackA.reduce((sum, fb) => sum + fb.rating, 0);
        test.metrics.userFeedbackScoreA = scoreSum / feedbackA.length;
      } else if (feedback.toolName === test.toolB) {
        // Update Tool B feedback score
        const feedbackB = this.feedback.get(test.toolB) || [];
        const scoreSum = feedbackB.reduce((sum, fb) => sum + fb.rating, 0);
        test.metrics.userFeedbackScoreB = scoreSum / feedbackB.length;
      }
    });
    
    // Invalidate cached analysis
    this.invalidateAnalysisCache(feedback.toolName);
  }
  
  /**
   * Analyze tool performance over a specific period
   */
  async analyzeToolPerformance(
    toolName: string,
    period: ReflectionType = ReflectionType.WEEKLY
  ): Promise<PerformanceAnalysis | null> {
    // Check if we have a valid cached analysis
    const cacheKey = `${toolName}:${period}`;
    const cachedAnalysis = this.analysisCache.get(cacheKey);
    const expiry = this.analysisCacheExpiry.get(cacheKey);
    
    // Use cached analysis if still valid (less than 1 hour old)
    if (cachedAnalysis && expiry && expiry > new Date()) {
      return cachedAnalysis;
    }
    
    // Get tool info from registry
    const toolInfo = this.registry.getTool(toolName);
    if (!toolInfo || !toolInfo.tool) {
      return null;
    }
    
    // Get historical data
    const history = this.historicalData.get(toolName) || [];
    if (history.length === 0) {
      return null;
    }
    
    // Filter data based on period
    const filteredData = this.filterDataByPeriod(history, period);
    if (filteredData.length === 0) {
      return null;
    }
    
    // Calculate basic metrics
    const usageCount = filteredData.length;
    const successCount = filteredData.filter(result => result.success).length;
    const successRate = successCount / usageCount;
    const avgExecutionTime = filteredData.reduce(
      (sum, result) => sum + result.executionTime, 0
    ) / usageCount;
    const errorRate = 1 - successRate;
    
    // Analyze error types
    const errorTypes: Record<string, number> = {};
    filteredData.forEach(result => {
      if (!result.success && result.error) {
        const errorType = this.categorizeError(result.error);
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      }
    });
    
    // Get top errors
    const topErrors = Object.entries(errorTypes)
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / usageCount) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    // Analyze parameter performance
    const parameterPerformance: Record<string, any> = {};
    
    // Get unique parameters across all executions
    const allParameters = new Set<string>();
    filteredData.forEach(result => {
      Object.keys(result.parameters).forEach(param => allParameters.add(param));
    });
    
    // Analyze each parameter - fix for iterating through Set
    Array.from(allParameters).forEach(param => {
      const valuePerformance: Record<string, { count: number, successCount: number }> = {};
      
      // Group by parameter value
      filteredData.forEach(result => {
        if (param in result.parameters) {
          const valueKey = String(result.parameters[param]);
          
          if (!valuePerformance[valueKey]) {
            valuePerformance[valueKey] = { count: 0, successCount: 0 };
          }
          
          valuePerformance[valueKey].count += 1;
          if (result.success) {
            valuePerformance[valueKey].successCount += 1;
          }
        }
      });
      
      // Find best and worst performing values
      let bestValue = '';
      let worstValue = '';
      let bestSuccessRate = -1;
      let worstSuccessRate = 2;
      
      Object.entries(valuePerformance).forEach(([value, stats]) => {
        if (stats.count >= 3) { // Only consider values with sufficient data
          const valueSuccessRate = stats.successCount / stats.count;
          
          if (valueSuccessRate > bestSuccessRate) {
            bestSuccessRate = valueSuccessRate;
            bestValue = value;
          }
          
          if (valueSuccessRate < worstSuccessRate) {
            worstSuccessRate = valueSuccessRate;
            worstValue = value;
          }
        }
      });
      
      // Create value distribution
      const valueDistribution: Record<string, number> = {};
      Object.entries(valuePerformance).forEach(([value, stats]) => {
        valueDistribution[value] = stats.count / usageCount;
      });
      
      parameterPerformance[param] = {
        bestValue,
        worstValue,
        valueDistribution
      };
    });
    
    // Determine performance trend
    let trend: 'improving' | 'stable' | 'declining' | 'insufficient_data' = 'insufficient_data';
    
    if (filteredData.length >= 10) {
      // Split data into two halves to compare
      const midpoint = Math.floor(filteredData.length / 2);
      const firstHalf = filteredData.slice(0, midpoint);
      const secondHalf = filteredData.slice(midpoint);
      
      const firstHalfSuccess = firstHalf.filter(r => r.success).length / firstHalf.length;
      const secondHalfSuccess = secondHalf.filter(r => r.success).length / secondHalf.length;
      
      const successRateDifference = secondHalfSuccess - firstHalfSuccess;
      
      if (Math.abs(successRateDifference) < 0.05) {
        trend = 'stable';
      } else if (successRateDifference > 0) {
        trend = 'improving';
      } else {
        trend = 'declining';
      }
    }
    
    // Generate recommendations using LLM
    let recommendations: string[] = [];
    try {
      const errorSummary = topErrors.map(
        e => `${e.type}: ${e.count} occurrences (${e.percentage.toFixed(1)}%)`
      ).join('\n');
      
      let parameterSummary = '';
      Object.entries(parameterPerformance).forEach(([param, performance]) => {
        if (performance.bestValue) {
          parameterSummary += `\nParameter "${param}":\n`;
          parameterSummary += `  Best value: "${performance.bestValue}"\n`;
          parameterSummary += `  Worst value: "${performance.worstValue}"\n`;
        }
      });
      
      const prompt = `
You are analyzing the performance of the tool "${toolName}" over the past ${period}.

Performance metrics:
- Usage count: ${usageCount}
- Success rate: ${(successRate * 100).toFixed(1)}%
- Error rate: ${(errorRate * 100).toFixed(1)}%
- Average execution time: ${avgExecutionTime.toFixed(2)}ms
- Performance trend: ${trend}

Top error types:
${errorSummary}

Parameter performance:
${parameterSummary}

Based on this data, provide 3-5 actionable recommendations to improve the tool's performance.
Focus on:
1. Addressing common error types
2. Optimizing parameter values
3. Improving success rates
4. Enhancing performance

Keep recommendations specific, technical, and actionable.
`;

      const response = await this.model.invoke(prompt);
      
      // Parse bulleted list from response
      const bulletsMatch = response.content.match(/[•\-\*]\s+(.*?)(?=\n[•\-\*]|\n\n|$)/g);
      if (bulletsMatch) {
        recommendations = bulletsMatch.map(b => 
          b.replace(/^[•\-\*]\s+/, '').trim()
        );
      } else {
        // If no bullet points found, split by newlines and filter empty lines
        recommendations = response.content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 10);
      }
    } catch (error) {
      console.error('Error generating performance recommendations:', error);
      recommendations = ["Could not generate recommendations due to an error."];
    }
    
    // Create the analysis result
    const analysis: PerformanceAnalysis = {
      toolName,
      period,
      usageCount,
      successRate,
      avgExecutionTime,
      errorRate,
      topErrors,
      parameterPerformance,
      trend,
      recommendations
    };
    
    // Cache the result for 1 hour
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 1);
    
    this.analysisCache.set(cacheKey, analysis);
    this.analysisCacheExpiry.set(cacheKey, expiryTime);
    
    return analysis;
  }
  
  /**
   * Filter data by time period
   */
  private filterDataByPeriod(
    data: ToolExecutionResult[],
    period: ReflectionType
  ): ToolExecutionResult[] {
    if (period === ReflectionType.ALL) {
      return data;
    }
    
    // Since ToolExecutionResult doesn't have a timestamp field,
    // we'll use a simpler approach for filtering based on period
    const now = new Date();
    
    // Calculate how many items to return based on period
    let itemCount = data.length;
    switch (period) {
      case ReflectionType.DAILY:
        itemCount = Math.min(data.length, 50);  // Last ~50 items for daily
        break;
      case ReflectionType.WEEKLY:
        itemCount = Math.min(data.length, 200); // Last ~200 items for weekly
        break;
      case ReflectionType.MONTHLY:
        itemCount = Math.min(data.length, 500); // Last ~500 items for monthly
        break;
      default:
        itemCount = Math.min(data.length, 100); // Default to a reasonable amount
        break;
    }
    
    // Return the most recent 'itemCount' items
    return data.slice(-itemCount);
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
   * Get all active A/B tests
   */
  getActiveABTests(): ABTest[] {
    return Array.from(this.abTests.values())
      .filter(test => test.status === ItemStatus.ACTIVE);
  }
  
  /**
   * Get a specific A/B test by ID
   */
  getABTest(testId: string): ABTest | null {
    return this.abTests.get(testId) || null;
  }
  
  /**
   * Get feedback for a specific tool
   */
  getToolFeedback(toolName: string): ToolFeedback[] {
    return this.feedback.get(toolName) || [];
  }
  
  /**
   * Create a variant of a tool for A/B testing
   */
  async createToolVariant(
    originalToolName: string,
    variantName: string,
    modifications: {
      description?: string;
      parameters?: Record<string, any>;
      implementation?: string;
    }
  ): Promise<StructuredTool | null> {
    const toolInfo = this.registry.getTool(originalToolName);
    if (!toolInfo || !toolInfo.tool) {
      console.error(`Original tool ${originalToolName} not found`);
      return null;
    }
    
    try {
      // Create a variant with modified properties
      const originalTool = toolInfo.tool;
      const originalMetadata = toolInfo.metadata;
      
      // Get any tool schema
      const schemaDefinition = (originalTool as any).schema || z.object({});
      
      // Create variant tool
      const variantTool = new StructuredTool({
        name: variantName,
        description: modifications.description || (originalTool as any).description || originalMetadata.description,
        schema: schemaDefinition,
        func: async (input: Record<string, any>) => {
          try {
            // Modified parameters if specified
            const modifiedInput = { ...input };
            
            if (modifications.parameters) {
              Object.entries(modifications.parameters).forEach(([key, value]) => {
                if (typeof value === 'function') {
                  // If the value is a function, call it with the original parameter
                  modifiedInput[key] = value(input[key]);
                } else {
                  // Otherwise use the static value
                  modifiedInput[key] = value;
                }
              });
            }
            
            // Use the original implementation if no custom one provided
            if (!modifications.implementation) {
              // Fix for invoke not existing on StructuredTool
              const result = await (originalTool as any).invoke(modifiedInput);
              return result;
            } else {
              // For a real implementation, you'd need to dynamically evaluate
              // the new implementation code. This is simplified.
              console.log(`Would execute custom implementation for ${variantName}`);
              // Fix for invoke not existing on StructuredTool
              return await (originalTool as any).invoke(modifiedInput);
            }
          } catch (error) {
            console.error(`Error in variant tool ${variantName}:`, error);
            throw error;
          }
        }
      });
      
      // Register the variant
      this.registry.registerTool(variantTool, {
        ...originalMetadata,
        name: variantName,
        description: modifications.description || originalMetadata.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: `${originalMetadata.version}-variant`,
        author: 'ToolEvaluation',
        status: 'experimental'
      });
      
      return variantTool;
    } catch (error) {
      console.error(`Error creating tool variant:`, error);
      return null;
    }
  }
} 