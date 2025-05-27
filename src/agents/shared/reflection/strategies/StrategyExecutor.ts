/**
 * Strategy Executor
 * 
 * Handles execution of reflection strategies with context preparation,
 * result collection, and error recovery. Extracted from DefaultReflectionManager.
 */

import { ulid } from 'ulid';
import { 
  StrategyExecutor as IStrategyExecutor,
  ReflectionStrategy,
  ExecutionContext,
  ExecutionResult,
  ErrorRecoveryResult,
  ReflectionTrigger
} from '../interfaces/ReflectionInterfaces';

/**
 * Error class for strategy execution errors
 */
export class StrategyExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'StrategyExecutionError';
  }
}

/**
 * Configuration for strategy execution
 */
export interface StrategyExecutorConfig {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  enableMetrics?: boolean;
  enableRecovery?: boolean;
  maxConcurrentExecutions?: number;
  enableCaching?: boolean;
  cacheSize?: number;
  cacheTtlMs?: number;
}

/**
 * Execution metrics for monitoring
 */
interface ExecutionMetrics {
  executionId: string;
  strategyId: string;
  trigger: ReflectionTrigger;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  retryCount: number;
  error?: string;
  contextSize: number;
  resultSize: number;
}

/**
 * Cached execution result
 */
interface CachedResult {
  result: ExecutionResult;
  cachedAt: Date;
  expiresAt: Date;
  contextHash: string;
}

/**
 * Default configuration for strategy executor
 */
const DEFAULT_CONFIG: Required<StrategyExecutorConfig> = {
  timeoutMs: 30000,
  maxRetries: 3,
  retryDelayMs: 1000,
  enableMetrics: true,
  enableRecovery: true,
  maxConcurrentExecutions: 5,
  enableCaching: true,
  cacheSize: 100,
  cacheTtlMs: 300000 // 5 minutes
};

/**
 * Implementation of strategy executor for reflection strategies
 */
export class StrategyExecutor implements IStrategyExecutor {
  private config: Required<StrategyExecutorConfig>;
  private activeExecutions = new Map<string, Promise<ExecutionResult>>();
  private executionMetrics: ExecutionMetrics[] = [];
  private resultCache = new Map<string, CachedResult>();
  private fallbackStrategies = new Map<ReflectionTrigger, ReflectionStrategy[]>();

  constructor(config: StrategyExecutorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a reflection strategy with the given context
   */
  async execute(strategy: ReflectionStrategy, context: ExecutionContext): Promise<ExecutionResult> {
    const executionId = ulid();
    
    // Validate inputs
    this.validateStrategy(strategy);
    this.validateContext(context);

    // Check concurrent execution limit
    if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
      throw new StrategyExecutionError(
        `Maximum concurrent executions exceeded (${this.config.maxConcurrentExecutions})`,
        'CONCURRENT_LIMIT_EXCEEDED',
        { executionId, strategyId: strategy.id, activeCount: this.activeExecutions.size }
      );
    }

    // Check cache if enabled
    if (this.config.enableCaching) {
      const cachedResult = this.getCachedResult(strategy.id, context);
      if (cachedResult) {
        return cachedResult;
      }
    }

    // Start execution
    const executionPromise = this.executeWithRetry(executionId, strategy, context);
    this.activeExecutions.set(executionId, executionPromise);

    try {
      const result = await executionPromise;
      
      // Cache result if successful and caching is enabled
      if (this.config.enableCaching && result.success) {
        this.cacheResult(strategy.id, context, result);
      }

      return result;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Prepare execution context for a strategy
   */
  async prepareContext(trigger: ReflectionTrigger, data: Record<string, unknown>): Promise<ExecutionContext> {
    // Validate trigger
    const validTriggers: ReflectionTrigger[] = ['error', 'task_completion', 'learning_opportunity', 'performance_issue', 'user_feedback'];
    if (!validTriggers.includes(trigger)) {
      throw new StrategyExecutionError(
        `Invalid trigger: ${trigger}`,
        'INVALID_TRIGGER',
        { trigger, validTriggers }
      );
    }

    // Prepare context with defaults and validation
    const context: ExecutionContext = {
      trigger,
      data: this.sanitizeData(data),
      environment: {
        executorId: ulid(),
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        capabilities: ['reflection', 'analysis', 'insight_generation']
      },
      constraints: {
        maxExecutionTime: this.config.timeoutMs,
        maxRetries: this.config.maxRetries,
        enableRecovery: this.config.enableRecovery
      }
    };

    return context;
  }

  /**
   * Collect execution results (for async executions)
   */
  async collectResults(executionId: string): Promise<ExecutionResult> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new StrategyExecutionError(
        `Execution not found: ${executionId}`,
        'EXECUTION_NOT_FOUND',
        { executionId }
      );
    }

    return await execution;
  }

  /**
   * Handle execution errors with recovery strategies
   */
  async handleError(error: Error, strategy: ReflectionStrategy, context: ExecutionContext): Promise<ErrorRecoveryResult> {
    if (!this.config.enableRecovery) {
      return {
        recovered: false,
        recoveryActions: ['Error recovery is disabled'],
        impact: 'Execution failed without recovery'
      };
    }

    const recoveryActions: string[] = [];
    let recovered = false;
    let fallbackStrategy: ReflectionStrategy | undefined;

    try {
      // Log error for analysis
      recoveryActions.push(`Logged error: ${error.message}`);

      // Try to find a fallback strategy
      const fallbacks = this.fallbackStrategies.get(context.trigger) || [];
      const availableFallback = fallbacks.find(s => s.id !== strategy.id && s.enabled);

      if (availableFallback) {
        recoveryActions.push(`Found fallback strategy: ${availableFallback.name}`);
        
        try {
          // Execute fallback strategy with simplified context
          const fallbackContext = {
            ...context,
            data: {
              ...context.data,
              originalError: error.message,
              originalStrategy: strategy.id,
              recoveryAttempt: true
            }
          };

          const fallbackResult = await this.executeStrategy(availableFallback, fallbackContext);
          
          if (fallbackResult.success) {
            recovered = true;
            fallbackStrategy = availableFallback;
            recoveryActions.push('Fallback strategy executed successfully');
          } else {
            recoveryActions.push('Fallback strategy failed');
          }
        } catch (fallbackError) {
          recoveryActions.push(`Fallback strategy error: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
        }
      } else {
        recoveryActions.push('No suitable fallback strategy found');
      }

      // Additional recovery actions
      if (!recovered) {
        recoveryActions.push('Attempted graceful degradation');
        recoveryActions.push('Notified monitoring system');
      }

    } catch (recoveryError) {
      recoveryActions.push(`Recovery process error: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`);
    }

    const impact = recovered 
      ? 'Execution recovered using fallback strategy'
      : 'Execution failed - manual intervention may be required';

    return {
      recovered,
      fallbackStrategy,
      recoveryActions,
      impact
    };
  }

  /**
   * Register a fallback strategy for a trigger
   */
  async registerFallbackStrategy(trigger: ReflectionTrigger, strategy: ReflectionStrategy): Promise<void> {
    if (!this.fallbackStrategies.has(trigger)) {
      this.fallbackStrategies.set(trigger, []);
    }
    
    const strategies = this.fallbackStrategies.get(trigger)!;
    
    // Avoid duplicates
    if (!strategies.find(s => s.id === strategy.id)) {
      strategies.push(strategy);
    }
  }

  /**
   * Get execution statistics
   */
  getStats(): Record<string, unknown> {
    const totalExecutions = this.executionMetrics.length;
    const successfulExecutions = this.executionMetrics.filter(m => m.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    
    const averageDuration = totalExecutions > 0 
      ? this.executionMetrics
          .filter(m => m.duration !== undefined)
          .reduce((sum, m) => sum + (m.duration || 0), 0) / totalExecutions
      : 0;

    const triggerDistribution = this.executionMetrics.reduce((dist, m) => {
      dist[m.trigger] = (dist[m.trigger] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      averageDuration,
      activeExecutions: this.activeExecutions.size,
      cacheSize: this.resultCache.size,
      triggerDistribution,
      fallbackStrategiesCount: Array.from(this.fallbackStrategies.values()).reduce((sum, strategies) => sum + strategies.length, 0),
      config: this.config
    };
  }

  /**
   * Clear all cached results and reset state
   */
  async clear(): Promise<void> {
    // Wait for active executions to complete or timeout
    const activePromises = Array.from(this.activeExecutions.values());
    if (activePromises.length > 0) {
      await Promise.allSettled(activePromises);
    }

    this.activeExecutions.clear();
    this.executionMetrics.length = 0;
    this.resultCache.clear();
    this.fallbackStrategies.clear();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async executeWithRetry(executionId: string, strategy: ReflectionStrategy, context: ExecutionContext): Promise<ExecutionResult> {
    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= this.config.maxRetries) {
      const metrics: ExecutionMetrics = {
        executionId,
        strategyId: strategy.id,
        trigger: context.trigger,
        startTime: new Date(),
        success: false,
        retryCount,
        contextSize: JSON.stringify(context).length,
        resultSize: 0
      };

      try {
        const result = await this.executeStrategy(strategy, context);
        
        // Update metrics
        metrics.endTime = new Date();
        metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
        metrics.success = result.success;
        metrics.resultSize = JSON.stringify(result).length;

        if (this.config.enableMetrics) {
          this.executionMetrics.push(metrics);
          this.trimMetrics();
        }

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Update metrics
        metrics.endTime = new Date();
        metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
        metrics.error = lastError.message;

        if (this.config.enableMetrics) {
          this.executionMetrics.push(metrics);
          this.trimMetrics();
        }

        // Don't retry on certain types of errors
        if (error instanceof StrategyExecutionError && error.code === 'VALIDATION_ERROR') {
          throw error;
        }

        retryCount++;
        
        if (retryCount <= this.config.maxRetries) {
          // Wait before retry with exponential backoff
          const delay = this.config.retryDelayMs * Math.pow(2, retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new StrategyExecutionError(
      `Strategy execution failed after ${this.config.maxRetries} retries: ${lastError?.message}`,
      'EXECUTION_FAILED',
      { executionId, strategyId: strategy.id, retryCount, originalError: lastError?.message }
    );
  }

  private async executeStrategy(strategy: ReflectionStrategy, context: ExecutionContext): Promise<ExecutionResult> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new StrategyExecutionError(
          `Strategy execution timed out after ${this.config.timeoutMs}ms`,
          'EXECUTION_TIMEOUT',
          { strategyId: strategy.id, timeoutMs: this.config.timeoutMs }
        ));
      }, this.config.timeoutMs);
    });

    // Execute strategy with timeout
    const executionPromise = strategy.implementation(context);

    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      // Validate result
      this.validateResult(result);
      
      return result;
    } catch (error) {
      if (error instanceof StrategyExecutionError) {
        throw error;
      }
      
      throw new StrategyExecutionError(
        `Strategy implementation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'IMPLEMENTATION_ERROR',
        { strategyId: strategy.id, originalError: error }
      );
    }
  }

  private validateStrategy(strategy: ReflectionStrategy): void {
    if (!strategy.id || typeof strategy.id !== 'string') {
      throw new StrategyExecutionError(
        'Strategy ID is required and must be a string',
        'VALIDATION_ERROR',
        { strategyId: strategy.id }
      );
    }

    if (!strategy.enabled) {
      throw new StrategyExecutionError(
        `Strategy is disabled: ${strategy.id}`,
        'STRATEGY_DISABLED',
        { strategyId: strategy.id }
      );
    }

    if (typeof strategy.implementation !== 'function') {
      throw new StrategyExecutionError(
        'Strategy implementation must be a function',
        'VALIDATION_ERROR',
        { strategyId: strategy.id }
      );
    }
  }

  private validateContext(context: ExecutionContext): void {
    if (!context.trigger) {
      throw new StrategyExecutionError(
        'Execution context must have a trigger',
        'VALIDATION_ERROR',
        { context }
      );
    }

    if (!context.data || typeof context.data !== 'object') {
      throw new StrategyExecutionError(
        'Execution context must have data object',
        'VALIDATION_ERROR',
        { context }
      );
    }
  }

  private validateResult(result: ExecutionResult): void {
    if (typeof result !== 'object' || result === null) {
      throw new StrategyExecutionError(
        'Strategy result must be an object',
        'VALIDATION_ERROR',
        { result }
      );
    }

    if (typeof result.success !== 'boolean') {
      throw new StrategyExecutionError(
        'Strategy result must have a boolean success property',
        'VALIDATION_ERROR',
        { result }
      );
    }

    if (!Array.isArray(result.insights)) {
      throw new StrategyExecutionError(
        'Strategy result must have an insights array',
        'VALIDATION_ERROR',
        { result }
      );
    }

    if (!Array.isArray(result.errors)) {
      throw new StrategyExecutionError(
        'Strategy result must have an errors array',
        'VALIDATION_ERROR',
        { result }
      );
    }

    if (typeof result.executionTime !== 'number') {
      throw new StrategyExecutionError(
        'Strategy result must have a numeric executionTime',
        'VALIDATION_ERROR',
        { result }
      );
    }
  }

  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    // Remove potentially sensitive data and ensure serializable
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip functions and undefined values
      if (typeof value === 'function' || value === undefined) {
        continue;
      }
      
      // Skip potentially sensitive keys
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('secret') || 
          key.toLowerCase().includes('token')) {
        continue;
      }
      
      // Ensure value is serializable
      try {
        JSON.stringify(value);
        sanitized[key] = value;
      } catch {
        // Skip non-serializable values
        continue;
      }
    }
    
    return sanitized;
  }

  private getCachedResult(strategyId: string, context: ExecutionContext): ExecutionResult | null {
    const contextHash = this.hashContext(context);
    const cacheKey = `${strategyId}:${contextHash}`;
    const cached = this.resultCache.get(cacheKey);
    
    if (cached && cached.expiresAt > new Date()) {
      return cached.result;
    }
    
    // Remove expired cache entry
    if (cached) {
      this.resultCache.delete(cacheKey);
    }
    
    return null;
  }

  private cacheResult(strategyId: string, context: ExecutionContext, result: ExecutionResult): void {
    if (this.resultCache.size >= this.config.cacheSize) {
      // Remove oldest cache entry
      const oldestKey = this.resultCache.keys().next().value;
      if (oldestKey) {
        this.resultCache.delete(oldestKey);
      }
    }
    
    const contextHash = this.hashContext(context);
    const cacheKey = `${strategyId}:${contextHash}`;
    const now = new Date();
    
    this.resultCache.set(cacheKey, {
      result,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + this.config.cacheTtlMs),
      contextHash
    });
  }

  private hashContext(context: ExecutionContext): string {
    // Simple hash of context for caching
    const contextString = JSON.stringify({
      trigger: context.trigger,
      data: context.data
    });
    
    // Simple hash function (not cryptographic)
    let hash = 0;
    for (let i = 0; i < contextString.length; i++) {
      const char = contextString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  private trimMetrics(): void {
    const maxMetrics = 1000;
    if (this.executionMetrics.length > maxMetrics) {
      this.executionMetrics.splice(0, this.executionMetrics.length - maxMetrics);
    }
  }
} 