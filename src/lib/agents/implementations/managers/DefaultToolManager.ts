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
} from '../../../../agents/shared/base/managers/ToolManager.interface';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { AbstractBaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { createConfigFactory } from '../../../../agents/shared/config';
import { ToolManagerConfigSchema } from '../../../../agents/shared/tools/config/ToolManagerConfigSchema';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';

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
export class DefaultToolManager extends AbstractBaseManager implements ToolManager {
  private tools: Map<string, Tool> = new Map();
  private fallbackRules: Map<string, ToolFallbackRule> = new Map();
  private metrics: Map<string, ToolUsageMetrics> = new Map();
  private configFactory = createConfigFactory(ToolManagerConfigSchema);
  
  // Override config type to use ToolManagerConfig
  protected config!: ToolManagerConfig;

  /**
   * Type property accessor for compatibility with ToolManager
   */
  get type(): string {
    return this.managerType;
  }

  /**
   * Create a new DefaultToolManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<ToolManagerConfig> = {}) {
    const managerId = `tool-manager-${uuidv4()}`;
    const validatedConfig = createConfigFactory(ToolManagerConfigSchema).create({
      enabled: true,
      enableToolValidation: true,
      maxConcurrentTools: 5,
      ...config
    }) as ToolManagerConfig;

    super(
      managerId,
      ManagerType.TOOL,
      agent,
      validatedConfig
    );
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends ToolManagerConfig>(config: Partial<T>): T {
    // Validate and merge configuration
    const validatedConfig = this.configFactory.create({
      ...this._config, 
      ...config
    }) as ToolManagerConfig;
    
    this._config = validatedConfig;
    return validatedConfig as T;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
    
    const initialized = await super.initialize();
    if (!initialized) {
      return false;
    }
    
    // Initialize metrics for all registered tools
    const config = this.getConfig<ToolManagerConfig>();
    if (config.trackToolPerformance) {
      // Convert to array to avoid iteration issues
      const toolEntries = Array.from(this.tools.entries());
      for (const [toolId, tool] of toolEntries) {
        if (!this.metrics.has(toolId)) {
          this.initializeToolMetrics(toolId, tool.name);
        }
      }
    }
    
    return true;
  }

  /**
   * Shutdown the manager and release resources
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.managerId}] Shutting down ${this.managerType} manager`);
    this._initialized = false;
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
  async getHealth(): Promise<ManagerHealth> {
    if (!this._initialized) {
      return {
        status: 'degraded',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'high',
            message: 'Tool manager not initialized',
            detectedAt: new Date()
          }],
          metrics: {}
        }
      };
    }

    const stats = await this.getStats();
    
    if (!this.isEnabled()) {
      return {
        status: 'unhealthy',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'critical',
            message: 'Tool manager is disabled',
            detectedAt: new Date()
          }],
          metrics: stats
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: stats
      }
    };
  }

  /**
   * Register a new tool
   */
  async registerTool(tool: Tool): Promise<Tool> {
    if (!this._initialized) {
      throw new ToolError(
        'Tool manager not initialized',
        'NOT_INITIALIZED'
      );
    }

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
    const config = this.getConfig<ToolManagerConfig>();
    if (config.trackToolPerformance && !this.metrics.has(tool.id)) {
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

    try {
      // Execute the tool with timeout
      const timeoutMs = options?.timeoutMs || this.getConfig<ToolManagerConfig>().defaultToolTimeoutMs || 30000;
      
      const result = await this.executeWithTimeout(
        () => tool.execute(params, options?.context),
        timeoutMs
      ) as ToolExecutionResult;
      
      return result;
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any).code || (isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR');
      
      const executionResult: ToolExecutionResult = {
        toolId,
        success: false,
        result: undefined,
        error: {
          message: errorMessage,
          code: errorCode
        },
        durationMs: 0,
        startedAt: new Date(),
        metrics: {
          inputSize: JSON.stringify(params).length,
          outputSize: 0,
        }
      };
      
      // Update tool metrics
      const config = this.getConfig<ToolManagerConfig>();
      if (config.trackToolPerformance) {
        this.updateToolMetrics(toolId, executionResult);
      }
      
      return executionResult;
    }
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
    const config = this.getConfig<ToolManagerConfig>();
    if (!config.useAdaptiveToolSelection) {
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
   * Get tool manager statistics
   */
  async getStats(): Promise<{
    totalTools: number;
    toolsByType: Record<string, number>;
    avgToolHealth: number;
    lastHealthCheck?: Date;
  }> {
    const tools = Array.from(this.tools.values());
    const toolsByType = tools.reduce((acc, tool) => {
      const type = typeof tool;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average tool health based on metrics
    const avgToolHealth = await this.calculateAverageToolHealth();

    return {
      totalTools: tools.length,
      toolsByType,
      avgToolHealth,
      lastHealthCheck: new Date()
    };
  }

  /**
   * Calculate average tool health based on metrics and availability
   */
  private async calculateAverageToolHealth(): Promise<number> {
    const tools = Array.from(this.tools.values());
    
    if (tools.length === 0) {
      return 1.0; // Perfect health when no tools (no failures possible)
    }
    
    let totalHealthScore = 0;
    let toolsWithMetrics = 0;
    
    for (const tool of tools) {
      const healthScore = await this.calculateToolHealth(tool);
      totalHealthScore += healthScore;
      toolsWithMetrics++;
    }
    
    return toolsWithMetrics > 0 ? totalHealthScore / toolsWithMetrics : 1.0;
  }

  /**
   * Calculate health score for a specific tool
   */
  private async calculateToolHealth(tool: Tool): Promise<number> {
    const metrics = this.metrics.get(tool.id);
    
    // Base health factors
    let healthScore = 1.0;
    
    // Factor 1: Tool availability (enabled/disabled)
    if (!tool.enabled) {
      healthScore *= 0.5; // Disabled tools have reduced health
    }
    
    // Factor 2: Success rate (if we have execution data)
    if (metrics && metrics.totalExecutions > 0) {
      const successRate = metrics.successRate;
      
      // Success rate contributes 40% to health score
      const successFactor = successRate * 0.4;
      
      // Performance factor based on average duration (20% contribution)
      // Assume tools should complete within 5 seconds for optimal health
      const optimalDurationMs = 5000;
      const performanceFactor = Math.min(1.0, optimalDurationMs / Math.max(metrics.avgDurationMs, 1)) * 0.2;
      
      // Reliability factor based on recent usage trend (20% contribution)
      const reliabilityFactor = this.calculateReliabilityFactor(metrics) * 0.2;
      
      // Base factor for having metrics (20% contribution)
      const metricsFactor = 0.2;
      
      healthScore = successFactor + performanceFactor + reliabilityFactor + metricsFactor;
    } else {
      // No execution data - assume moderate health
      healthScore = 0.7;
    }
    
    // Factor 3: Tool configuration health
    const configHealth = this.assessToolConfiguration(tool);
    healthScore *= configHealth;
    
    // Ensure health score is between 0 and 1
    return Math.max(0, Math.min(1, healthScore));
  }

  /**
   * Calculate reliability factor based on usage trends
   */
  private calculateReliabilityFactor(metrics: ToolUsageMetrics): number {
    if (!metrics.usageTrend || metrics.usageTrend.length === 0) {
      return 0.5; // Moderate reliability when no trend data
    }
    
    // Check for consistent usage (reliability indicator)
    const recentTrend = metrics.usageTrend.slice(-6); // Last 6 data points
    
    if (recentTrend.length < 2) {
      return 0.5;
    }
    
    // Calculate variance in usage (lower variance = more reliable)
    const usageCounts = recentTrend.map(entry => entry.count);
    const avgUsage = usageCounts.reduce((sum, count) => sum + count, 0) / usageCounts.length;
    
    if (avgUsage === 0) {
      return 0.3; // Low reliability if not being used
    }
    
    const variance = usageCounts.reduce((sum, count) => sum + Math.pow(count - avgUsage, 2), 0) / usageCounts.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation relative to mean indicates more consistent usage
    const coefficientOfVariation = avgUsage > 0 ? standardDeviation / avgUsage : 1;
    
    // Convert to reliability score (lower variation = higher reliability)
    return Math.max(0.1, Math.min(1.0, 1 - (coefficientOfVariation * 0.5)));
  }

  /**
   * Assess tool configuration health
   */
  private assessToolConfiguration(tool: Tool): number {
    let configScore = 1.0;
    
    // Check if tool has required properties
    if (!tool.name || tool.name.trim().length === 0) {
      configScore *= 0.8; // Missing or empty name
    }
    
    if (!tool.description || tool.description.trim().length === 0) {
      configScore *= 0.9; // Missing or empty description
    }
    
    if (!tool.execute || typeof tool.execute !== 'function') {
      configScore *= 0.5; // Missing or invalid execute function
    }
    
    // Check for schema validation if available (using any to access potential schema property)
    const toolWithSchema = tool as any;
    if (toolWithSchema.schema) {
      try {
        // Basic schema validation - check if it's a valid object
        if (typeof toolWithSchema.schema !== 'object' || toolWithSchema.schema === null) {
          configScore *= 0.9;
        }
      } catch (error) {
        configScore *= 0.8; // Schema validation issues
      }
    }
    
    // Check for reasonable timeout configuration
    if (tool.timeoutMs !== undefined) {
      if (typeof tool.timeoutMs !== 'number' || tool.timeoutMs <= 0) {
        configScore *= 0.9; // Invalid timeout configuration
      } else if (tool.timeoutMs > 300000) { // More than 5 minutes
        configScore *= 0.95; // Very long timeout might indicate issues
      }
    }
    
    return configScore;
  }

  /**
   * Get detailed health information for a specific tool
   */
  async getToolHealth(toolId: string): Promise<{
    toolId: string;
    healthScore: number;
    factors: {
      availability: number;
      successRate: number;
      performance: number;
      reliability: number;
      configuration: number;
    };
    recommendations: string[];
  } | null> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return null;
    }
    
    const metrics = this.metrics.get(toolId);
    const recommendations: string[] = [];
    
    // Calculate individual factors
    const availability = tool.enabled ? 1.0 : 0.5;
    if (!tool.enabled) {
      recommendations.push('Enable the tool to improve availability');
    }
    
    let successRate = 0.7; // Default for tools without metrics
    let performance = 0.8; // Default performance score
    let reliability = 0.5; // Default reliability
    
    if (metrics && metrics.totalExecutions > 0) {
      successRate = metrics.successRate;
      if (successRate < 0.8) {
        recommendations.push('Investigate and fix frequent failures');
      }
      
      const optimalDurationMs = 5000;
      performance = Math.min(1.0, optimalDurationMs / Math.max(metrics.avgDurationMs, 1));
      if (performance < 0.6) {
        recommendations.push('Optimize tool performance to reduce execution time');
      }
      
      reliability = this.calculateReliabilityFactor(metrics);
      if (reliability < 0.6) {
        recommendations.push('Improve tool reliability and consistency');
      }
    } else {
      recommendations.push('Execute the tool to gather performance metrics');
    }
    
    const configuration = this.assessToolConfiguration(tool);
    if (configuration < 0.9) {
      recommendations.push('Review and improve tool configuration');
    }
    
    const healthScore = await this.calculateToolHealth(tool);
    
    return {
      toolId,
      healthScore,
      factors: {
        availability,
        successRate,
        performance,
        reliability,
        configuration
      },
      recommendations
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

  /**
   * Check if the manager is initialized
   */
  public isInitialized(): boolean {
    return this._initialized;
  }
} 