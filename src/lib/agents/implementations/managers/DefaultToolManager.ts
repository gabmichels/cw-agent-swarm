/**
 * DefaultToolManager.ts - Default implementation of the ToolManager interface
 * 
 * This file provides a concrete implementation of the ToolManager interface
 * that can be used by any agent implementation. It includes tool registration,
 * execution, metrics tracking, and fallback handling.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  ToolManager, 
  Tool, 
  ToolExecutionResult, 
  ToolManagerConfig,
  ToolUsageMetrics,
  ToolFallbackRule
} from '../../base/managers/ToolManager';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { AbstractBaseManager, ManagerConfig } from '../../../../agents/shared/base/managers/BaseManager';
import { createConfigFactory } from '../../../../agents/shared/config';
import { ToolManagerConfigSchema } from '../../../../agents/shared/tools/config/ToolManagerConfigSchema';

/**
 * Error class for tool-related errors
 */
class ToolError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'TOOL_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Default implementation of the ToolManager interface
 */
// @ts-ignore - This class implements ToolManager with some method signature differences
export class DefaultToolManager extends AbstractBaseManager implements ToolManager {
  private tools: Map<string, Tool> = new Map();
  private fallbackRules: Map<string, ToolFallbackRule> = new Map();
  private metrics: Map<string, ToolUsageMetrics> = new Map();
  private configFactory = createConfigFactory(ToolManagerConfigSchema);
  // Override config type to use ToolManagerConfig
  protected config!: ToolManagerConfig & Record<string, unknown>;

  /**
   * Type property accessor for compatibility with ToolManager
   */
  // @ts-ignore - Override parent class property with accessor
  get type(): string {
    return this.getType();
  }

  /**
   * Create a new DefaultToolManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<ToolManagerConfig> = {}) {
    super(
      `tool-manager-${uuidv4()}`,
      'tool',
      agent,
      { enabled: true }
    );
    
    // Validate and apply configuration with defaults
    this.config = this.configFactory.create({
      enabled: true,
      ...config
    }) as ToolManagerConfig & Record<string, unknown>;
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends ToolManagerConfig>(config: Partial<T>): T {
    // Validate and merge configuration
    this.config = this.configFactory.create({
      ...this.config, 
      ...config
    }) as ToolManagerConfig & Record<string, unknown>;
    
    return this.config as unknown as T;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
    
    // Initialize metrics for all registered tools
    if (this.config.trackToolPerformance) {
      // Convert to array to avoid iteration issues
      const toolEntries = Array.from(this.tools.entries());
      for (const [toolId, tool] of toolEntries) {
        if (!this.metrics.has(toolId)) {
          this.initializeToolMetrics(toolId, tool.name);
        }
      }
    }
    
    this.initialized = true;
    return true;
  }

  /**
   * Shutdown the manager and release resources
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.managerId}] Shutting down ${this.managerType} manager`);
    this.initialized = false;
  }

  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<boolean> {
    console.log(`[${this.managerId}] Resetting ${this.managerType} manager`);
    this.tools.clear();
    this.fallbackRules.clear();
    this.metrics.clear();
    return true;
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }> {
    if (!this.initialized) {
      return {
        status: 'degraded',
        message: 'Tool manager not initialized'
      };
    }

    const enabledTools = Array.from(this.tools.values()).filter(tool => tool.enabled).length;
    const totalTools = this.tools.size;
    
    const stats = await this.getStats();
    
    // Check if there are critical issues
    if (!this.isEnabled()) {
      return {
        status: 'unhealthy',
        message: 'Tool manager is disabled',
        metrics: {
          totalTools,
          enabledTools,
          successRate: stats.overallSuccessRate,
          executionStats: {
            totalExecutions: stats.totalExecutions,
            successfulExecutions: stats.successfulExecutions,
            failedExecutions: stats.failedExecutions
          }
        }
      };
    }
    
    // Degraded if less than 50% success rate
    if (stats.overallSuccessRate < 0.5 && stats.totalExecutions > 10) {
      return {
        status: 'degraded',
        message: 'Tool execution success rate is low',
        metrics: {
          totalTools,
          enabledTools,
          successRate: stats.overallSuccessRate,
          executionStats: {
            totalExecutions: stats.totalExecutions,
            successfulExecutions: stats.successfulExecutions,
            failedExecutions: stats.failedExecutions
          }
        }
      };
    }
    
    return {
      status: 'healthy',
      message: 'Tool manager is healthy',
      metrics: {
        totalTools,
        enabledTools,
        successRate: stats.overallSuccessRate,
        executionStats: {
          totalExecutions: stats.totalExecutions,
          successfulExecutions: stats.successfulExecutions,
          failedExecutions: stats.failedExecutions
        }
      }
    };
  }

  /**
   * Register a new tool
   */
  async registerTool(tool: Tool): Promise<Tool> {
    if (this.tools.has(tool.id)) {
      throw new ToolError(
        `Tool with ID ${tool.id} already exists`,
        'DUPLICATE_TOOL',
        { toolId: tool.id }
      );
    }
    
    // Ensure tool has required properties
    const validatedTool: Tool = {
      ...tool,
      enabled: tool.enabled ?? true,
      categories: tool.categories ?? [],
      capabilities: tool.capabilities ?? [],
      version: tool.version ?? '1.0.0',
      experimental: tool.experimental ?? false,
      costPerUse: tool.costPerUse ?? 1
    };
    
    this.tools.set(tool.id, validatedTool);
    
    // Initialize metrics for this tool
    if (this.config.trackToolPerformance && !this.metrics.has(tool.id)) {
      this.initializeToolMetrics(tool.id, tool.name);
    }
    
    return validatedTool;
  }

  /**
   * Unregister a tool
   */
  async unregisterTool(toolId: string): Promise<boolean> {
    const result = this.tools.delete(toolId);
    
    // Remove any fallback rules involving this tool
    // Convert to array to avoid iteration issues
    const ruleEntries = Array.from(this.fallbackRules.entries());
    for (const [ruleId, rule] of ruleEntries) {
      if (rule.primaryToolId === toolId || rule.fallbackToolId === toolId) {
        this.fallbackRules.delete(ruleId);
      }
    }
    
    return result;
  }

  /**
   * Get a tool by ID
   */
  async getTool(toolId: string): Promise<Tool | null> {
    return this.tools.get(toolId) || null;
  }

  /**
   * Get all registered tools, optionally filtered
   */
  async getTools(filter?: {
    enabled?: boolean;
    categories?: string[];
    capabilities?: string[];
    experimental?: boolean;
  }): Promise<Tool[]> {
    let tools = Array.from(this.tools.values());
    
    if (filter) {
      if (filter.enabled !== undefined) {
        tools = tools.filter(tool => tool.enabled === filter.enabled);
      }
      
      if (filter.categories && filter.categories.length > 0) {
        tools = tools.filter(tool => 
          tool.categories && 
          filter.categories?.some(category => tool.categories?.includes(category))
        );
      }
      
      if (filter.capabilities && filter.capabilities.length > 0) {
        tools = tools.filter(tool => 
          tool.capabilities && 
          filter.capabilities?.some(capability => tool.capabilities?.includes(capability))
        );
      }
      
      if (filter.experimental !== undefined) {
        tools = tools.filter(tool => tool.experimental === filter.experimental);
      }
    }
    
    return tools;
  }

  /**
   * Enable or disable a tool
   */
  async setToolEnabled(toolId: string, enabled: boolean): Promise<Tool> {
    const tool = await this.getTool(toolId);
    
    if (!tool) {
      throw new ToolError(
        `Tool with ID ${toolId} not found`,
        'TOOL_NOT_FOUND',
        { toolId }
      );
    }
    
    const updatedTool = {
      ...tool,
      enabled
    };
    
    this.tools.set(toolId, updatedTool);
    return updatedTool;
  }

  /**
   * Execute a tool
   */
  async executeTool(
    toolId: string,
    params: unknown,
    options?: {
      context?: unknown;
      timeoutMs?: number;
      retries?: number;
      useFallbacks?: boolean;
    }
  ): Promise<ToolExecutionResult> {
    const tool = await this.getTool(toolId);
    
    if (!tool) {
      throw new ToolError(
        `Tool with ID ${toolId} not found`,
        'TOOL_NOT_FOUND',
        { toolId }
      );
    }
    
    if (!tool.enabled) {
      throw new ToolError(
        `Tool with ID ${toolId} is disabled`,
        'TOOL_DISABLED',
        { toolId }
      );
    }
    
    const startTime = new Date();
    const startedAt = new Date(startTime);
    let result: unknown;
    let success = false;
    let error: { message: string; code?: string } | undefined;
    
    // Apply timeout if specified
    const timeoutMs = options?.timeoutMs ?? tool.timeoutMs ?? this.config.defaultToolTimeoutMs ?? 30000;
    const maxRetries = options?.retries ?? this.config.maxToolRetries ?? 0;
    
    try {
      // Execute the tool with timeout
      result = await this.executeWithTimeout(
        tool.execute.bind(null, params, options?.context),
        timeoutMs
      );
      success = true;
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorCode = (err as any).code || (isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR');
      
      error = {
        message: errorMessage,
        code: errorCode
      };
      
      // Try fallbacks if enabled and available
      if (options?.useFallbacks !== false) {
        const fallbackResult = await this.tryFallback(tool, err, params, options);
        if (fallbackResult) {
          return fallbackResult;
        }
      }
      
      // Try retry logic if retries are available
      if (maxRetries > 0) {
        try {
          const retryResult = await this.executeWithRetries(
            tool,
            params,
            maxRetries,
            options
          );
          
          if (retryResult) {
            return retryResult;
          }
        } catch (retryErr) {
          // If retry also fails, continue with original error
          console.log(`Retry failed for tool ${toolId}: ${retryErr}`);
        }
      }
    }
    
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    
    const executionResult: ToolExecutionResult = {
      toolId,
      success,
      result: success ? result : undefined,
      error,
      durationMs,
      startedAt,
      metrics: {
        // Simple metrics for now
        inputSize: JSON.stringify(params).length,
        outputSize: success ? JSON.stringify(result).length : 0,
      }
    };
    
    // Update tool metrics
    if (this.config.trackToolPerformance) {
      this.updateToolMetrics(toolId, executionResult);
    }
    
    return executionResult;
  }

  /**
   * Get tool usage metrics
   */
  async getToolMetrics(toolId?: string): Promise<ToolUsageMetrics[]> {
    if (toolId) {
      const metrics = this.metrics.get(toolId);
      if (!metrics) {
        return [];
      }
      return [metrics];
    }
    
    return Array.from(this.metrics.values());
  }

  /**
   * Reset tool metrics
   */
  async resetToolMetrics(toolId?: string): Promise<boolean> {
    if (toolId) {
      const tool = await this.getTool(toolId);
      if (!tool) {
        return false;
      }
      
      this.initializeToolMetrics(toolId, tool.name);
      return true;
    }
    
    // Reset all tool metrics
    for (const [toolId, tool] of Array.from(this.tools.entries())) {
      this.initializeToolMetrics(toolId, tool.name);
    }
    
    return true;
  }

  /**
   * Find the best tool for a specific task
   */
  async findBestToolForTask(
    taskDescription: string,
    context?: unknown
  ): Promise<Tool | null> {
    // Simple implementation - in a real system this would use 
    // semantic matching, machine learning, or other intelligent selection
    
    // Get all enabled tools
    const enabledTools = await this.getTools({ enabled: true });
    
    if (enabledTools.length === 0) {
      return null;
    }
    
    // If adaptive tool selection is disabled, return a random tool
    if (!this.config.useAdaptiveToolSelection) {
      return enabledTools[Math.floor(Math.random() * enabledTools.length)];
    }
    
    // Simple word matching for demonstration
    // In a real implementation, this would use embeddings or ML
    const toolScores = enabledTools.map(tool => {
      // Calculate a simple score based on description match
      const descriptionWords = tool.description.toLowerCase().split(/\s+/);
      const nameWords = tool.name.toLowerCase().split(/\s+/);
      const taskWords = taskDescription.toLowerCase().split(/\s+/);
      
      // Count matching words
      const matchingDescriptionWords = descriptionWords.filter(word => 
        taskWords.includes(word)
      ).length;
      
      const matchingNameWords = nameWords.filter(word => 
        taskWords.includes(word)
      ).length;
      
      // Weight name matches higher than description matches
      const score = (matchingNameWords * 2) + matchingDescriptionWords;
      
      // Include success rate from metrics if available
      let adjustedScore = score;
      const metrics = this.metrics.get(tool.id);
      if (metrics && metrics.totalExecutions > 0) {
        // Adjust score by success rate
        adjustedScore = score * (0.5 + (metrics.successRate * 0.5));
      }
      
      return {
        tool,
        score: adjustedScore
      };
    });
    
    // Sort by score (highest first)
    toolScores.sort((a, b) => b.score - a.score);
    
    // Return the highest scoring tool, or null if no tools matched
    return toolScores.length > 0 && toolScores[0].score > 0 
      ? toolScores[0].tool 
      : null;
  }

  /**
   * Register a fallback rule between tools
   */
  async registerFallbackRule(rule: Omit<ToolFallbackRule, 'id'>): Promise<ToolFallbackRule> {
    // Check that both tools exist
    const primaryTool = await this.getTool(rule.primaryToolId);
    const fallbackTool = await this.getTool(rule.fallbackToolId);
    
    if (!primaryTool) {
      throw new ToolError(
        `Primary tool with ID ${rule.primaryToolId} not found`,
        'PRIMARY_TOOL_NOT_FOUND',
        { toolId: rule.primaryToolId }
      );
    }
    
    if (!fallbackTool) {
      throw new ToolError(
        `Fallback tool with ID ${rule.fallbackToolId} not found`,
        'FALLBACK_TOOL_NOT_FOUND',
        { toolId: rule.fallbackToolId }
      );
    }
    
    const ruleId = uuidv4();
    const fullRule: ToolFallbackRule = {
      id: ruleId,
      primaryToolId: rule.primaryToolId,
      fallbackToolId: rule.fallbackToolId,
      errorPatterns: rule.errorPatterns ?? [],
      enabled: rule.enabled ?? true,
      condition: rule.condition
    };
    
    this.fallbackRules.set(ruleId, fullRule);
    return fullRule;
  }

  /**
   * Unregister a fallback rule
   */
  async unregisterFallbackRule(ruleId: string): Promise<boolean> {
    return this.fallbackRules.delete(ruleId);
  }

  /**
   * Get fallback rules, optionally filtered
   */
  async getFallbackRules(filter?: {
    primaryToolId?: string;
    fallbackToolId?: string;
    enabled?: boolean;
  }): Promise<ToolFallbackRule[]> {
    let rules = Array.from(this.fallbackRules.values());
    
    if (filter) {
      if (filter.primaryToolId) {
        rules = rules.filter(rule => rule.primaryToolId === filter.primaryToolId);
      }
      
      if (filter.fallbackToolId) {
        rules = rules.filter(rule => rule.fallbackToolId === filter.fallbackToolId);
      }
      
      if (filter.enabled !== undefined) {
        rules = rules.filter(rule => rule.enabled === filter.enabled);
      }
    }
    
    return rules;
  }

  /**
   * Enable or disable a fallback rule
   */
  async setFallbackRuleEnabled(ruleId: string, enabled: boolean): Promise<ToolFallbackRule> {
    const rule = this.fallbackRules.get(ruleId);
    
    if (!rule) {
      throw new ToolError(
        `Fallback rule with ID ${ruleId} not found`,
        'FALLBACK_RULE_NOT_FOUND',
        { ruleId }
      );
    }
    
    const updatedRule = {
      ...rule,
      enabled
    };
    
    this.fallbackRules.set(ruleId, updatedRule);
    return updatedRule;
  }

  /**
   * Get tool manager statistics
   */
  async getStats(): Promise<{
    totalTools: number;
    enabledTools: number;
    disabledTools: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    overallSuccessRate: number;
    avgExecutionTimeMs: number;
    mostUsedTools: Array<{
      toolId: string;
      name: string;
      executionCount: number;
    }>;
    fallbackRules: number;
    fallbacksTriggered: number;
  }> {
    const allTools = Array.from(this.tools.values());
    const enabledTools = allTools.filter(tool => tool.enabled).length;
    const disabledTools = allTools.length - enabledTools;
    
    let totalExecutions = 0;
    let successfulExecutions = 0;
    let totalExecutionTime = 0;
    const executionCounts: Array<{ toolId: string; name: string; executionCount: number }> = [];
    
    for (const [toolId, metrics] of Array.from(this.metrics.entries())) {
      totalExecutions += metrics.totalExecutions;
      successfulExecutions += metrics.successfulExecutions;
      totalExecutionTime += metrics.avgDurationMs * metrics.totalExecutions;
      
      const tool = this.tools.get(toolId);
      if (tool && metrics.totalExecutions > 0) {
        executionCounts.push({
          toolId,
          name: tool.name,
          executionCount: metrics.totalExecutions
        });
      }
    }
    
    // Sort by execution count, descending
    executionCounts.sort((a, b) => b.executionCount - a.executionCount);
    
    const failedExecutions = totalExecutions - successfulExecutions;
    const overallSuccessRate = totalExecutions > 0 
      ? successfulExecutions / totalExecutions 
      : 0;
    const avgExecutionTimeMs = totalExecutions > 0 
      ? totalExecutionTime / totalExecutions 
      : 0;
    
    return {
      totalTools: allTools.length,
      enabledTools,
      disabledTools,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      overallSuccessRate,
      avgExecutionTimeMs,
      mostUsedTools: executionCounts.slice(0, 5), // Top 5 most used tools
      fallbackRules: this.fallbackRules.size,
      fallbacksTriggered: 0 // To be implemented with fallback tracking
    };
  }

  // Private helper methods

  /**
   * Initialize metrics for a tool
   */
  private initializeToolMetrics(toolId: string, toolName: string): void {
    this.metrics.set(toolId, {
      toolId,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgDurationMs: 0,
      successRate: 0,
      usageTrend: []
    });
  }

  /**
   * Update metrics for a tool after execution
   */
  private updateToolMetrics(toolId: string, result: ToolExecutionResult): void {
    const metrics = this.metrics.get(toolId);
    
    if (!metrics) {
      console.warn(`No metrics found for tool ${toolId}`);
      return;
    }
    
    // Update metrics
    metrics.totalExecutions += 1;
    
    if (result.success) {
      metrics.successfulExecutions += 1;
    } else {
      metrics.failedExecutions += 1;
    }
    
    // Update average duration - weighted calculation
    const oldWeight = (metrics.totalExecutions - 1) / metrics.totalExecutions;
    const newWeight = 1 / metrics.totalExecutions;
    metrics.avgDurationMs = (metrics.avgDurationMs * oldWeight) + (result.durationMs * newWeight);
    
    // Update success rate
    metrics.successRate = metrics.successfulExecutions / metrics.totalExecutions;
    
    // Update usage trend
    const now = new Date();
    if (!metrics.usageTrend) {
      metrics.usageTrend = [];
    }
    
    // Add to trend or update last entry if it's from the same hour
    if (metrics.usageTrend.length > 0) {
      const lastEntry = metrics.usageTrend[metrics.usageTrend.length - 1];
      const sameHour = 
        lastEntry.timestamp.getFullYear() === now.getFullYear() &&
        lastEntry.timestamp.getMonth() === now.getMonth() &&
        lastEntry.timestamp.getDate() === now.getDate() &&
        lastEntry.timestamp.getHours() === now.getHours();
      
      if (sameHour) {
        lastEntry.count += 1;
      } else {
        metrics.usageTrend.push({ timestamp: now, count: 1 });
      }
      
      // Keep only the last 24 data points
      if (metrics.usageTrend.length > 24) {
        metrics.usageTrend = metrics.usageTrend.slice(-24);
      }
    } else {
      metrics.usageTrend.push({ timestamp: now, count: 1 });
    }
  }

  /**
   * Execute a function with a timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Tool execution timed out after ${timeoutMs}ms`);
        error.name = 'TimeoutError';
        reject(error);
      }, timeoutMs);
      
      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Try to execute a fallback tool if available
   */
  private async tryFallback(
    originalTool: Tool,
    error: unknown,
    params: unknown,
    options?: {
      context?: unknown;
      timeoutMs?: number;
      retries?: number;
    }
  ): Promise<ToolExecutionResult | null> {
    // Find applicable fallback rules
    const fallbackRules = await this.getFallbackRules({
      primaryToolId: originalTool.id,
      enabled: true
    });
    
    if (fallbackRules.length === 0) {
      return null;
    }
    
    // Check each rule to see if it applies
    for (const rule of fallbackRules) {
      // Check error patterns
      const errorString = error instanceof Error ? error.message : String(error);
      
      // Check if any error pattern matches
      const patternMatches = rule.errorPatterns?.some(pattern => 
        errorString.includes(pattern)
      );
      
      // Check custom condition if provided
      const conditionMatches = rule.condition 
        ? rule.condition(error) 
        : false;
      
      if (patternMatches || conditionMatches) {
        // Rule matches, try the fallback tool
        try {
          return await this.executeTool(
            rule.fallbackToolId,
            params,
            {
              ...options,
              // Don't use fallbacks when executing the fallback tool
              // to avoid infinite loops
              useFallbacks: false
            }
          );
        } catch (fallbackError) {
          console.error(`Fallback tool ${rule.fallbackToolId} also failed:`, fallbackError);
        }
      }
    }
    
    return null;
  }

  /**
   * Execute a tool with retries
   */
  private async executeWithRetries(
    tool: Tool,
    params: unknown,
    maxRetries: number,
    options?: {
      context?: unknown;
      timeoutMs?: number;
    }
  ): Promise<ToolExecutionResult | null> {
    let lastError: unknown = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Add increasing backoff delay
        const backoffMs = Math.min(100 * Math.pow(2, attempt), 2000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        
        return await this.executeTool(
          tool.id,
          params,
          {
            ...options,
            // Don't retry or use fallbacks to avoid loops
            retries: 0,
            useFallbacks: false
          }
        );
      } catch (err) {
        lastError = err;
        console.log(`Retry ${attempt + 1}/${maxRetries} failed for tool ${tool.id}: ${err}`);
      }
    }
    
    return null;
  }
} 