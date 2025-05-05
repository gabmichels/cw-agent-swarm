/**
 * AdaptiveToolWrapper
 * 
 * A system that allows tools to self-adjust parameters during execution
 * for enhanced resilience and optimal performance.
 */

import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { logger } from '../../../lib/logging';
import { ToolRegistry } from './registry';
import { ToolManager, ToolResult } from './toolManager';
import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType } from '../../../server/memory/config/types';

/**
 * Represents a parameter adjustment strategy
 */
export interface ParameterAdjustmentStrategy {
  parameterName: string;
  strategy: 'numeric_scaling' | 'categorical_substitution' | 'timeout_adjustment' | 'query_reformulation';
  minValue?: number;
  maxValue?: number;
  step?: number;
  options?: string[];
  condition: (result: any, params: Record<string, any>) => boolean;
  adjustment: (currentValue: any, params: Record<string, any>, result: any) => any;
}

/**
 * Configuration for an adaptive tool
 */
export interface AdaptiveToolConfig {
  toolName: string;
  maxAdjustmentAttempts: number;
  parameterSensitivity: Record<string, number>; // 0-1 scale, higher means more sensitive
  adjustmentStrategies: ParameterAdjustmentStrategy[];
  successEvaluator: (result: any) => { success: boolean; quality: number; reason?: string };
}

/**
 * Result of an adaptive tool execution
 */
export interface AdaptiveToolResult extends ToolResult {
  initialParameters: Record<string, any>;
  finalParameters: Record<string, any>;
  parametersAdjusted: boolean;
  adjustmentTrace: {
    attemptNumber: number;
    adjustedParameter: string;
    previousValue: any;
    newValue: any;
    result: any;
    success: boolean;
    quality: number;
  }[];
}

/**
 * Stored adjustment pattern that was successful
 */
interface SuccessfulAdjustmentPattern {
  toolName: string;
  initialParams: Record<string, any>;
  adjustments: {
    parameterName: string;
    initialValue: any;
    finalValue: any;
  }[];
  resultQuality: number;
  usageCount: number;
  lastUsed: Date;
}

/**
 * Wraps tools with adaptive parameter adjustment capabilities
 */
export class AdaptiveToolWrapper {
  private toolManager: ToolManager;
  private registry: ToolRegistry;
  private memory: ChloeMemory;
  private configurations: Map<string, AdaptiveToolConfig> = new Map();
  private successfulPatterns: SuccessfulAdjustmentPattern[] = [];
  
  constructor(toolManager: ToolManager, registry: ToolRegistry, memory: ChloeMemory) {
    this.toolManager = toolManager;
    this.registry = registry;
    this.memory = memory;
  }
  
  /**
   * Register a tool configuration with adaptive capabilities
   */
  public registerAdaptiveTool(config: AdaptiveToolConfig): void {
    this.configurations.set(config.toolName, config);
    logger.info(`Registered adaptive configuration for tool ${config.toolName} with ${config.adjustmentStrategies.length} adjustment strategies`);
  }
  
  /**
   * Find a matching adjustment pattern from historical successful patterns
   */
  private findMatchingPattern(
    toolName: string,
    params: Record<string, any>
  ): SuccessfulAdjustmentPattern | null {
    // Get configs for this tool
    const config = this.configurations.get(toolName);
    if (!config) return null;
    
    // Find patterns for this tool
    const toolPatterns = this.successfulPatterns.filter(p => p.toolName === toolName);
    if (toolPatterns.length === 0) return null;
    
    // Calculate similarity between current params and saved patterns
    const patternMatches = toolPatterns.map(pattern => {
      let similarityScore = 0;
      let totalWeight = 0;
      
      // Compare each parameter
      for (const [paramName, paramValue] of Object.entries(params)) {
        // Skip if parameter isn't in the pattern
        if (!(paramName in pattern.initialParams)) continue;
        
        // Get sensitivity weight for this parameter (default 0.5)
        const sensitivity = config.parameterSensitivity[paramName] || 0.5;
        totalWeight += sensitivity;
        
        // Calculate similarity based on parameter type
        const patternValue = pattern.initialParams[paramName];
        
        if (paramValue === patternValue) {
          // Exact match
          similarityScore += sensitivity;
        } else if (typeof paramValue === 'number' && typeof patternValue === 'number') {
          // Numeric comparison - closer values are more similar
          const range = Math.max(paramValue, patternValue) - Math.min(paramValue, patternValue);
          const normalizedRange = range / Math.max(Math.abs(paramValue), Math.abs(patternValue), 1);
          const paramSimilarity = Math.max(0, 1 - normalizedRange);
          similarityScore += sensitivity * paramSimilarity;
        } else if (typeof paramValue === 'string' && typeof patternValue === 'string') {
          // String comparison - partial matches count
          if (paramValue.includes(patternValue) || patternValue.includes(paramValue)) {
            similarityScore += sensitivity * 0.7; // Partial match
          }
        }
      }
      
      // Normalize similarity score
      const normalizedScore = totalWeight > 0 ? similarityScore / totalWeight : 0;
      
      return {
        pattern,
        similarityScore: normalizedScore
      };
    });
    
    // Sort by similarity score and get the best match
    patternMatches.sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Return the best pattern if it's similar enough
    return patternMatches[0]?.similarityScore > 0.8 ? patternMatches[0].pattern : null;
  }
  
  /**
   * Store a successful adjustment pattern
   */
  private storeSuccessfulPattern(
    toolName: string,
    initialParams: Record<string, any>,
    finalParams: Record<string, any>,
    adjustmentTrace: AdaptiveToolResult['adjustmentTrace'],
    quality: number
  ): void {
    // Only store if parameters were actually adjusted
    if (JSON.stringify(initialParams) === JSON.stringify(finalParams)) {
      return;
    }
    
    // Extract the adjustments
    const adjustments = adjustmentTrace.map(adj => ({
      parameterName: adj.adjustedParameter,
      initialValue: adj.previousValue,
      finalValue: adj.newValue
    }));
    
    // Create the pattern
    const pattern: SuccessfulAdjustmentPattern = {
      toolName,
      initialParams,
      adjustments,
      resultQuality: quality,
      usageCount: 1,
      lastUsed: new Date()
    };
    
    // Store the pattern
    this.successfulPatterns.push(pattern);
    
    // Limit the number of stored patterns (keep the most recent ones)
    if (this.successfulPatterns.length > 100) {
      this.successfulPatterns.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
      this.successfulPatterns = this.successfulPatterns.slice(0, 100);
    }
    
    logger.info(`Stored successful adjustment pattern for tool ${toolName} with quality ${quality}`);
  }
  
  /**
   * Apply a known successful pattern to parameters
   */
  private applyPattern(
    params: Record<string, any>,
    pattern: SuccessfulAdjustmentPattern
  ): Record<string, any> {
    const adjustedParams = { ...params };
    
    // Apply each adjustment from the pattern
    for (const adjustment of pattern.adjustments) {
      // Only apply if the parameter exists and has the same initial value
      if (
        params[adjustment.parameterName] !== undefined &&
        this.areValuesComparable(params[adjustment.parameterName], adjustment.initialValue)
      ) {
        adjustedParams[adjustment.parameterName] = adjustment.finalValue;
      }
    }
    
    // Update pattern usage statistics
    pattern.usageCount++;
    pattern.lastUsed = new Date();
    
    return adjustedParams;
  }
  
  /**
   * Compare two values to see if they're similar enough for pattern matching
   */
  private areValuesComparable(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (typeof a === 'number' && typeof b === 'number') {
      // For numbers, consider them comparable if they're within 10% of each other
      const larger = Math.max(Math.abs(a), Math.abs(b));
      const smaller = Math.min(Math.abs(a), Math.abs(b));
      return larger === 0 || (larger - smaller) / larger < 0.1;
    }
    
    if (typeof a === 'string' && typeof b === 'string') {
      // For strings, consider them comparable if one contains the other
      return a.includes(b) || b.includes(a);
    }
    
    return false;
  }
  
  /**
   * Execute a tool with adaptive parameter adjustments
   */
  public async executeWithAdaptation(
    toolName: string,
    params: Record<string, any>,
    taskId?: string
  ): Promise<AdaptiveToolResult> {
    const config = this.configurations.get(toolName);
    
    // If no config is available, just execute normally
    if (!config) {
      logger.info(`No adaptive configuration for tool ${toolName}, executing normally`);
      const result = await this.toolManager.executeToolWithStandardErrorHandling(toolName, params, { taskId });
      return {
        ...result,
        initialParameters: params,
        finalParameters: params,
        parametersAdjusted: false,
        adjustmentTrace: []
      };
    }
    
    // Check if we have a matching pattern from previous successful executions
    const matchingPattern = this.findMatchingPattern(toolName, params);
    
    // If we have a matching pattern, apply it immediately
    let currentParams = params;
    if (matchingPattern) {
      logger.info(`Found matching adjustment pattern for tool ${toolName}, applying adjustments`);
      currentParams = this.applyPattern(params, matchingPattern);
      
      // Execute with the adjusted parameters
      const result = await this.toolManager.executeToolWithStandardErrorHandling(toolName, currentParams, { taskId });
      
      // Evaluate the result
      const evaluation = config.successEvaluator(result);
      
      // If successful, return immediately with the pattern-adjusted result
      if (evaluation.success) {
        return {
          ...result,
          initialParameters: params,
          finalParameters: currentParams,
          parametersAdjusted: true,
          adjustmentTrace: [{
            attemptNumber: 1,
            adjustedParameter: 'pattern_applied',
            previousValue: JSON.stringify(params),
            newValue: JSON.stringify(currentParams),
            result,
            success: evaluation.success,
            quality: evaluation.quality
          }]
        };
      }
      
      // If not successful, continue with regular adaptation
      logger.info(`Pattern adjustment for tool ${toolName} was not successful, trying dynamic adjustments`);
    }
    
    // Start with the initial parameters (or the pattern-adjusted ones if they failed)
    let adjustedParams = { ...currentParams };
    const adjustmentTrace: AdaptiveToolResult['adjustmentTrace'] = [];
    
    // Execute the tool with the initial parameters
    let result = await this.toolManager.executeToolWithStandardErrorHandling(toolName, adjustedParams, { taskId });
    
    // Evaluate the result
    let evaluation = config.successEvaluator(result);
    adjustmentTrace.push({
      attemptNumber: 0,
      adjustedParameter: 'initial',
      previousValue: null,
      newValue: JSON.stringify(adjustedParams),
      result,
      success: evaluation.success,
      quality: evaluation.quality
    });
    
    // If initial execution was successful, return immediately
    if (evaluation.success && evaluation.quality > 0.8) {
      return {
        ...result,
        initialParameters: params,
        finalParameters: adjustedParams,
        parametersAdjusted: JSON.stringify(params) !== JSON.stringify(adjustedParams),
        adjustmentTrace
      };
    }
    
    // Perform adjustments up to the maximum attempts
    for (let attempt = 1; attempt <= config.maxAdjustmentAttempts; attempt++) {
      // Find an applicable adjustment strategy
      const applicableStrategy = this.findApplicableStrategy(config, result, adjustedParams);
      
      // If no applicable strategy, break out of the loop
      if (!applicableStrategy) {
        logger.info(`No applicable adjustment strategy found for tool ${toolName} after attempt ${attempt}`);
        break;
      }
      
      // Apply the strategy
      const paramName = applicableStrategy.parameterName;
      const currentValue = adjustedParams[paramName];
      const newValue = applicableStrategy.adjustment(currentValue, adjustedParams, result);
      
      // Skip if the adjustment didn't change the value
      if (this.areValuesEqual(currentValue, newValue)) {
        logger.info(`Adjustment for parameter ${paramName} didn't change the value, skipping`);
        continue;
      }
      
      // Create new parameters with the adjustment
      const newParams = { ...adjustedParams, [paramName]: newValue };
      
      logger.info(`Adjusting parameter ${paramName} from ${currentValue} to ${newValue} for tool ${toolName} (attempt ${attempt})`);
      
      // Execute with the adjusted parameters
      result = await this.toolManager.executeToolWithStandardErrorHandling(toolName, newParams, { taskId });
      
      // Evaluate the result
      evaluation = config.successEvaluator(result);
      
      // Record the adjustment
      adjustmentTrace.push({
        attemptNumber: attempt,
        adjustedParameter: paramName,
        previousValue: currentValue,
        newValue,
        result,
        success: evaluation.success,
        quality: evaluation.quality
      });
      
      // If successful, update the parameters and break
      if (evaluation.success) {
        adjustedParams = newParams;
        break;
      }
      
      // If better quality but not success, keep the adjustment
      if (evaluation.quality > adjustmentTrace[adjustmentTrace.length - 2].quality) {
        adjustedParams = newParams;
      }
    }
    
    // If we ended with a successful execution, store the pattern
    if (evaluation.success && evaluation.quality > 0.7) {
      this.storeSuccessfulPattern(
        toolName,
        params,
        adjustedParams,
        adjustmentTrace,
        evaluation.quality
      );
      
      // Log the successful adaptation
      await this.logSuccessfulAdaptation(toolName, params, adjustedParams, evaluation.quality, taskId);
    } else if (adjustmentTrace.length > 1) {
      // Log the adaptation attempt (even if unsuccessful)
      await this.logAdaptationAttempt(toolName, params, adjustedParams, adjustmentTrace.length - 1, taskId);
    }
    
    // Return the final result
    return {
      ...result,
      initialParameters: params,
      finalParameters: adjustedParams,
      parametersAdjusted: JSON.stringify(params) !== JSON.stringify(adjustedParams),
      adjustmentTrace
    };
  }
  
  /**
   * Check if two values are equal (handles objects)
   */
  private areValuesEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    
    return false;
  }
  
  /**
   * Find an applicable adjustment strategy for the current situation
   */
  private findApplicableStrategy(
    config: AdaptiveToolConfig,
    result: any,
    params: Record<string, any>
  ): ParameterAdjustmentStrategy | null {
    // Filter strategies where the condition is met
    const applicableStrategies = config.adjustmentStrategies
      .filter(strategy => {
        // Skip if parameter doesn't exist in current params
        if (!(strategy.parameterName in params)) return false;
        
        // Check if the condition is met
        return strategy.condition(result, params);
      });
    
    // If no applicable strategies, return null
    if (applicableStrategies.length === 0) return null;
    
    // Choose a strategy (for now, just take the first applicable one)
    // In a more sophisticated implementation, we could prioritize strategies
    // based on historical success rates
    return applicableStrategies[0];
  }
  
  /**
   * Log a successful adaptation to memory
   */
  private async logSuccessfulAdaptation(
    toolName: string,
    initialParams: Record<string, any>,
    finalParams: Record<string, any>,
    quality: number,
    taskId?: string
  ): Promise<void> {
    // Find the parameters that changed
    const changedParams: string[] = [];
    for (const [key, value] of Object.entries(finalParams)) {
      if (initialParams[key] !== undefined && !this.areValuesEqual(initialParams[key], value)) {
        changedParams.push(key);
      }
    }
    
    if (changedParams.length === 0) return;
    
    await this.memory.addMemory(
      `Successfully adapted parameters ${changedParams.join(', ')} for tool "${toolName}" resulting in quality score of ${quality.toFixed(2)}.`,
      MemoryType.PARAMETER_ADAPTATION,
      ImportanceLevel.MEDIUM,
      MemorySource.SYSTEM,
      undefined,
      ['parameter_adaptation', 'tool_resilience', toolName, ...changedParams]
    );
  }
  
  /**
   * Log an adaptation attempt to memory
   */
  private async logAdaptationAttempt(
    toolName: string,
    initialParams: Record<string, any>,
    finalParams: Record<string, any>,
    attemptCount: number,
    taskId?: string
  ): Promise<void> {
    // Find the parameters that changed
    const changedParams: string[] = [];
    for (const [key, value] of Object.entries(finalParams)) {
      if (initialParams[key] !== undefined && !this.areValuesEqual(initialParams[key], value)) {
        changedParams.push(key);
      }
    }
    
    if (changedParams.length === 0) return;
    
    await this.memory.addMemory(
      `Attempted to adapt parameters ${changedParams.join(', ')} for tool "${toolName}" with ${attemptCount} adjustment attempts but without success.`,
      MemoryType.PARAMETER_ADAPTATION_ATTEMPT,
      ImportanceLevel.LOW,
      MemorySource.SYSTEM,
      undefined,
      ['parameter_adaptation_attempt', 'tool_resilience', toolName, ...changedParams]
    );
  }
  
  /**
   * Create standard adjustment strategies for common cases
   */
  public static createTimeoutAdjustmentStrategy(
    parameterName: string,
    minValue: number = 1000,
    maxValue: number = 60000,
    step: number = 1000
  ): ParameterAdjustmentStrategy {
    return {
      parameterName,
      strategy: 'timeout_adjustment',
      minValue,
      maxValue,
      step,
      condition: (result, params) => {
        // Check for timeout-related errors
        return result?.error?.toLowerCase().includes('timeout') || 
               result?.error?.toLowerCase().includes('timed out');
      },
      adjustment: (currentValue, params, result) => {
        // Increase timeout by the step amount
        const newValue = Math.min(
          (typeof currentValue === 'number' ? currentValue : minValue) + step,
          maxValue
        );
        return newValue;
      }
    };
  }
  
  /**
   * Create a batch size adjustment strategy
   */
  public static createBatchSizeAdjustmentStrategy(
    parameterName: string,
    minValue: number = 1,
    maxValue: number = 100
  ): ParameterAdjustmentStrategy {
    return {
      parameterName,
      strategy: 'numeric_scaling',
      minValue,
      maxValue,
      condition: (result, params) => {
        // Check for rate limit or resource errors
        return result?.error?.toLowerCase().includes('rate limit') || 
               result?.error?.toLowerCase().includes('too many requests') ||
               result?.error?.toLowerCase().includes('resource');
      },
      adjustment: (currentValue, params, result) => {
        // Decrease batch size by 50%
        const newValue = Math.max(
          Math.floor((typeof currentValue === 'number' ? currentValue : maxValue) * 0.5),
          minValue
        );
        return newValue;
      }
    };
  }
  
  /**
   * Create a query reformulation strategy
   */
  public static createQueryReformulationStrategy(
    parameterName: string
  ): ParameterAdjustmentStrategy {
    return {
      parameterName,
      strategy: 'query_reformulation',
      condition: (result, params) => {
        // Check for no results or insufficient results
        return !result?.error && 
               (result?.success === false || 
                (Array.isArray(result?.output) && result.output.length === 0));
      },
      adjustment: (currentValue, params, result) => {
        // In a real implementation, this would use an LLM to reformulate the query
        // For now, just add "expanded " prefix to broaden search
        if (typeof currentValue === 'string') {
          return `expanded ${currentValue}`;
        }
        return currentValue;
      }
    };
  }
}

// Singleton instance (to be initialized by the tool manager)
let adaptiveWrapperInstance: AdaptiveToolWrapper | null = null;

/**
 * Get the adaptive wrapper instance (singleton)
 */
export function getAdaptiveToolWrapper(): AdaptiveToolWrapper {
  if (!adaptiveWrapperInstance) {
    throw new Error('AdaptiveToolWrapper has not been initialized');
  }
  return adaptiveWrapperInstance;
}

/**
 * Initialize the adaptive wrapper (called by the tool manager on startup)
 */
export function initializeAdaptiveToolWrapper(
  toolManager: ToolManager,
  registry: ToolRegistry,
  memory: ChloeMemory
): AdaptiveToolWrapper {
  adaptiveWrapperInstance = new AdaptiveToolWrapper(toolManager, registry, memory);
  return adaptiveWrapperInstance;
} 