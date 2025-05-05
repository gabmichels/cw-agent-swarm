/**
 * ToolFallbackManager
 * 
 * A system that provides alternative execution paths when tools fail, allowing Chloe
 * to automatically recover from failures through predefined fallback chains.
 */

import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { logger } from '../../../lib/logging';
import { ToolRegistry, RegisteredTool } from './registry';
import { ToolManager, ToolResult } from './toolManager';
import { getToolPerformanceTracker } from './toolPerformanceTracker';
import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType } from '../../../server/memory/config/types';

/**
 * Represents a specific type of failure that can occur during tool execution
 */
export enum FailureType {
  PERMISSION_ERROR = 'permission_error',
  NOT_FOUND_ERROR = 'not_found_error',
  TIMEOUT_ERROR = 'timeout_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  VALIDATION_ERROR = 'validation_error',
  NETWORK_ERROR = 'network_error',
  RESOURCE_ERROR = 'resource_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  INTERNAL_ERROR = 'internal_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Configuration for a fallback chain
 */
export interface FallbackChainConfig {
  primaryToolName: string;
  fallbacks: {
    toolName: string;
    forFailureTypes?: FailureType[];
    priority: number;
    parameterTransform?: (params: Record<string, any>) => Record<string, any>;
  }[];
}

/**
 * Result of a fallback chain execution
 */
export interface FallbackChainResult extends ToolResult {
  primaryToolName: string;
  fallbacksAttempted: string[];
  executionTrace: {
    toolName: string;
    success: boolean;
    executionTime: number;
    error?: string;
    failureType?: FailureType;
  }[];
}

/**
 * In-memory tracking of fallback chain performance
 */
interface FallbackPerformanceData {
  totalAttempts: number;
  successfulRecoveries: number;
  averageRecoveryTime: number;
  successByFallbackTool: Record<string, number>;
  successByFailureType: Record<string, number>;
}

/**
 * Manages tool fallback chains to automatically recover from failures
 */
export class ToolFallbackManager {
  private toolManager: ToolManager;
  private registry: ToolRegistry;
  private fallbackChains: Map<string, FallbackChainConfig> = new Map();
  private performanceData: Map<string, FallbackPerformanceData> = new Map();
  private toolSimilarityMatrix: Map<string, Map<string, number>> = new Map();
  private memory: ChloeMemory;
  private maxRetryCount: number = 3;

  constructor(toolManager: ToolManager, registry: ToolRegistry, memory: ChloeMemory) {
    this.toolManager = toolManager;
    this.registry = registry;
    this.memory = memory;
    this.initializeSimilarityMatrix();
  }

  /**
   * Categorize an error message into a specific failure type
   */
  public categorizeError(errorMessage: string): FailureType {
    const lowerCaseError = errorMessage.toLowerCase();

    if (lowerCaseError.includes('permission') || lowerCaseError.includes('forbidden') || lowerCaseError.includes('403')) {
      return FailureType.PERMISSION_ERROR;
    } else if (lowerCaseError.includes('not found') || lowerCaseError.includes('404')) {
      return FailureType.NOT_FOUND_ERROR;
    } else if (lowerCaseError.includes('timeout') || lowerCaseError.includes('timed out')) {
      return FailureType.TIMEOUT_ERROR;
    } else if (lowerCaseError.includes('rate limit') || lowerCaseError.includes('too many requests') || lowerCaseError.includes('429')) {
      return FailureType.RATE_LIMIT_ERROR;
    } else if (lowerCaseError.includes('validation') || lowerCaseError.includes('invalid')) {
      return FailureType.VALIDATION_ERROR;
    } else if (lowerCaseError.includes('network') || lowerCaseError.includes('connection')) {
      return FailureType.NETWORK_ERROR;
    } else if (lowerCaseError.includes('resource') || lowerCaseError.includes('capacity') || lowerCaseError.includes('quota')) {
      return FailureType.RESOURCE_ERROR;
    } else if (lowerCaseError.includes('auth') || lowerCaseError.includes('credential') || lowerCaseError.includes('token')) {
      return FailureType.AUTHENTICATION_ERROR;
    } else if (lowerCaseError.includes('internal') || lowerCaseError.includes('server error') || lowerCaseError.includes('500')) {
      return FailureType.INTERNAL_ERROR;
    } else {
      return FailureType.UNKNOWN_ERROR;
    }
  }

  /**
   * Initialize the similarity matrix between tools
   * This is used for automated fallback selection when no explicit fallbacks are defined
   */
  private initializeSimilarityMatrix(): void {
    // This is an expensive operation, so we'll build it lazily
    // or from a pre-computed cache in a real implementation
    logger.info('Initializing tool similarity matrix');
  }

  /**
   * Register a fallback chain configuration
   */
  public registerFallbackChain(config: FallbackChainConfig): void {
    this.fallbackChains.set(config.primaryToolName, config);
    
    // Initialize performance tracking
    if (!this.performanceData.has(config.primaryToolName)) {
      this.performanceData.set(config.primaryToolName, {
        totalAttempts: 0,
        successfulRecoveries: 0,
        averageRecoveryTime: 0,
        successByFallbackTool: {},
        successByFailureType: {}
      });
    }

    logger.info(`Registered fallback chain for ${config.primaryToolName} with ${config.fallbacks.length} fallbacks`);
  }

  /**
   * Load fallback chain configuration from JSON
   */
  public loadFallbackConfigFromJson(configJson: string): void {
    try {
      const configs = JSON.parse(configJson) as FallbackChainConfig[];
      
      for (const config of configs) {
        this.registerFallbackChain(config);
      }
      
      logger.info(`Loaded ${configs.length} fallback chain configurations`);
    } catch (error) {
      logger.error('Failed to load fallback configurations from JSON:', error);
      throw new Error(`Failed to load fallback configurations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Compute similarity between two tools
   * Higher value means tools are more similar (range 0-1)
   */
  private computeToolSimilarity(toolA: string, toolB: string): number {
    // Check if we already computed this similarity
    const similarityA = this.toolSimilarityMatrix.get(toolA);
    if (similarityA && similarityA.has(toolB)) {
      return similarityA.get(toolB) || 0;
    }

    // Get tools from registry
    const toolAInfo = this.registry.getTool(toolA);
    const toolBInfo = this.registry.getTool(toolB);

    if (!toolAInfo || !toolBInfo) {
      return 0; // Can't compute similarity for unknown tools
    }

    // In a real implementation we would use:
    // 1. Description similarity (via embeddings)
    // 2. Parameter schema similarity
    // 3. Historical usage patterns
    // 4. Success rate with similar parameters
    // For now return a placeholder similarity score
    const similarityScore = 0.5;

    // Cache the result
    if (!this.toolSimilarityMatrix.has(toolA)) {
      this.toolSimilarityMatrix.set(toolA, new Map());
    }
    this.toolSimilarityMatrix.get(toolA)!.set(toolB, similarityScore);

    return similarityScore;
  }

  /**
   * Find similar tools that can be used as fallbacks
   */
  public findSimilarTools(toolName: string, minSimilarity: number = 0.7, limit: number = 3): string[] {
    const allTools = this.registry.getAllTools()
      .filter((t: RegisteredTool) => t.metadata.name !== toolName) // Exclude the tool itself
      .map((t: RegisteredTool) => ({ 
        name: t.metadata.name,
        similarity: this.computeToolSimilarity(toolName, t.metadata.name)
      }))
      .filter((t: { name: string; similarity: number }) => t.similarity >= minSimilarity)
      .sort((a: { similarity: number }, b: { similarity: number }) => b.similarity - a.similarity)
      .slice(0, limit)
      .map((t: { name: string }) => t.name);

    return allTools;
  }

  /**
   * Get the appropriate fallback tools for a specific tool and failure type
   */
  private getFallbacksForTool(toolName: string, failureType: FailureType): string[] {
    // Check if we have explicitly configured fallbacks
    const chainConfig = this.fallbackChains.get(toolName);
    
    if (chainConfig) {
      // Filter fallbacks that are applicable to this failure type
      // and sort by priority (higher priority first)
      return chainConfig.fallbacks
        .filter(fb => !fb.forFailureTypes || fb.forFailureTypes.includes(failureType))
        .sort((a, b) => b.priority - a.priority)
        .map(fb => fb.toolName);
    }
    
    // No explicit configuration, use similarity-based fallbacks
    return this.findSimilarTools(toolName);
  }

  /**
   * Transform parameters for a fallback tool if needed
   */
  private transformParamsForFallback(
    primaryToolName: string,
    fallbackToolName: string,
    params: Record<string, any>
  ): Record<string, any> {
    // Check if we have an explicit transform function
    const chainConfig = this.fallbackChains.get(primaryToolName);
    if (chainConfig) {
      const fallbackConfig = chainConfig.fallbacks.find(fb => fb.toolName === fallbackToolName);
      if (fallbackConfig?.parameterTransform) {
        return fallbackConfig.parameterTransform(params);
      }
    }
    
    // No explicit transform function, use schema-based parameter mapping
    // This would analyze both tool schemas and map parameters intelligently
    // For now, just return the original params
    return { ...params };
  }

  /**
   * Execute a tool with fallback handling
   */
  public async executeWithFallbacks(
    toolName: string,
    params: Record<string, any>,
    taskId?: string
  ): Promise<FallbackChainResult> {
    const startTime = Date.now();
    const executionTrace: FallbackChainResult['executionTrace'] = [];
    const fallbacksAttempted: string[] = [];
    
    // Try the primary tool first
    logger.info(`Executing tool ${toolName} with fallback support`);
    
    try {
      const result = await this.toolManager.executeToolWithStandardErrorHandling(
        toolName,
        params,
        { logToMemory: true, taskId, allowRetry: true, maxRetries: this.maxRetryCount }
      );
      
      // Record in execution trace
      executionTrace.push({
        toolName,
        success: result.success,
        executionTime: result.executionTime || 0,
        error: result.error,
        failureType: result.error ? this.categorizeError(result.error) : undefined
      });
      
      // If successful, return immediately
      if (result.success) {
        return {
          ...result,
          primaryToolName: toolName,
          fallbacksAttempted,
          executionTrace
        };
      }
      
      // Tool failed, determine the failure type
      const failureType = result.error ? this.categorizeError(result.error) : FailureType.UNKNOWN_ERROR;
      
      // Get applicable fallbacks
      const fallbacks = this.getFallbacksForTool(toolName, failureType);
      
      // Update performance tracking
      const performanceRecord = this.performanceData.get(toolName) || {
        totalAttempts: 0,
        successfulRecoveries: 0,
        averageRecoveryTime: 0,
        successByFallbackTool: {},
        successByFailureType: {}
      };
      performanceRecord.totalAttempts++;
      this.performanceData.set(toolName, performanceRecord);
      
      // Try each fallback in order
      for (const fallbackToolName of fallbacks) {
        fallbacksAttempted.push(fallbackToolName);
        
        // Transform parameters for this fallback if needed
        const fallbackParams = this.transformParamsForFallback(toolName, fallbackToolName, params);
        
        try {
          logger.info(`Trying fallback tool ${fallbackToolName} for failed ${toolName}`);
          
          // Remember the fallback relationship in memory
          await this.logFallbackAttempt(toolName, fallbackToolName, params, failureType, taskId);
          
          // Execute the fallback
          const fallbackResult = await this.toolManager.executeToolWithStandardErrorHandling(
            fallbackToolName,
            fallbackParams,
            { logToMemory: true, taskId }
          );
          
          // Record in execution trace
          executionTrace.push({
            toolName: fallbackToolName,
            success: fallbackResult.success,
            executionTime: fallbackResult.executionTime || 0,
            error: fallbackResult.error,
            failureType: fallbackResult.error ? this.categorizeError(fallbackResult.error) : undefined
          });
          
          // If successful, update performance tracking and return
          if (fallbackResult.success) {
            performanceRecord.successfulRecoveries++;
            performanceRecord.successByFallbackTool[fallbackToolName] = 
              (performanceRecord.successByFallbackTool[fallbackToolName] || 0) + 1;
            performanceRecord.successByFailureType[failureType] = 
              (performanceRecord.successByFailureType[failureType] || 0) + 1;
            
            // Update average recovery time
            const recoveryTime = Date.now() - startTime;
            performanceRecord.averageRecoveryTime = 
              ((performanceRecord.averageRecoveryTime * (performanceRecord.successfulRecoveries - 1)) + recoveryTime) / 
              performanceRecord.successfulRecoveries;
            
            // Log successful recovery
            await this.logSuccessfulRecovery(toolName, fallbackToolName, taskId);
            
            return {
              ...fallbackResult,
              primaryToolName: toolName,
              fallbacksAttempted,
              executionTrace,
              fallbackUsed: true,
              fallbackToolName
            };
          }
        } catch (error) {
          // Fallback tool threw an exception, continue to next fallback
          logger.error(`Error in fallback tool ${fallbackToolName}:`, error);
          
          executionTrace.push({
            toolName: fallbackToolName,
            success: false,
            executionTime: 0,
            error: error instanceof Error ? error.message : String(error),
            failureType: this.categorizeError(error instanceof Error ? error.message : String(error))
          });
        }
      }
      
      // All fallbacks failed, return the original result
      return {
        ...result,
        primaryToolName: toolName,
        fallbacksAttempted,
        executionTrace
      };
    } catch (error) {
      // Something went wrong with the fallback system itself
      logger.error(`Error in fallback chain for ${toolName}:`, error);
      
      return {
        success: false,
        output: null,
        error: `Fallback chain error: ${error instanceof Error ? error.message : String(error)}`,
        toolName,
        primaryToolName: toolName,
        fallbacksAttempted,
        executionTrace
      };
    }
  }

  /**
   * Get performance statistics for a fallback chain
   */
  public getFallbackChainPerformance(toolName: string): FallbackPerformanceData | null {
    return this.performanceData.get(toolName) || null;
  }

  /**
   * Get the best performing fallbacks for a specific tool
   */
  public getBestPerformingFallbacks(toolName: string, limit: number = 3): { toolName: string, successRate: number }[] {
    const performanceData = this.performanceData.get(toolName);
    if (!performanceData) {
      return [];
    }
    
    const successByFallbackTool = performanceData.successByFallbackTool;
    
    // Convert to array of {toolName, successRate} objects
    const fallbackStats = Object.entries(successByFallbackTool)
      .map(([fbToolName, successes]) => ({
        toolName: fbToolName,
        // We don't track individual attempts for each fallback tool,
        // so we assume all fallbacks were tried equally often
        successRate: successes / performanceData.totalAttempts
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, limit);
    
    return fallbackStats;
  }

  /**
   * Log a fallback attempt to memory
   */
  private async logFallbackAttempt(
    primaryToolName: string,
    fallbackToolName: string,
    params: Record<string, any>,
    failureType: FailureType,
    taskId?: string
  ): Promise<void> {
    await this.memory.addMemory(
      `Attempted to use fallback tool "${fallbackToolName}" when primary tool "${primaryToolName}" failed with a ${failureType} error.`,
      MemoryType.TOOL_RESILIENCE,
      ImportanceLevel.MEDIUM,
      MemorySource.SYSTEM,
      undefined,
      ['fallback_attempt', 'tool_resilience', primaryToolName, fallbackToolName]
    );
  }

  /**
   * Log a successful recovery to memory
   */
  private async logSuccessfulRecovery(
    primaryToolName: string,
    fallbackToolName: string,
    taskId?: string
  ): Promise<void> {
    await this.memory.addMemory(
      `Successfully recovered from "${primaryToolName}" failure using fallback tool "${fallbackToolName}".`,
      MemoryType.TOOL_RESILIENCE,
      ImportanceLevel.HIGH,
      MemorySource.SYSTEM,
      undefined,
      ['successful_recovery', 'tool_resilience', primaryToolName, fallbackToolName]
    );
  }
}

// Singleton instance (to be initialized by the tool manager)
let fallbackManagerInstance: ToolFallbackManager | null = null;

/**
 * Get the fallback manager instance (singleton)
 */
export function getToolFallbackManager(): ToolFallbackManager {
  if (!fallbackManagerInstance) {
    throw new Error('ToolFallbackManager has not been initialized');
  }
  return fallbackManagerInstance;
}

/**
 * Initialize the fallback manager (called by the tool manager on startup)
 */
export function initializeToolFallbackManager(
  toolManager: ToolManager,
  registry: ToolRegistry,
  memory: ChloeMemory
): ToolFallbackManager {
  fallbackManagerInstance = new ToolFallbackManager(toolManager, registry, memory);
  return fallbackManagerInstance;
} 