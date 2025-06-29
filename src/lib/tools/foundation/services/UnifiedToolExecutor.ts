/**
 * Unified Tool Executor - Implementation
 * 
 * Concrete implementation of the unified tool executor that handles
 * tool execution with comprehensive validation, error handling,
 * and security checks. Provides both synchronous and asynchronous
 * execution capabilities.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - NO fallback executors - proper error handling only
 * - Comprehensive security validation
 * - Structured error handling with context
 * - Performance optimization
 * - Timeout and retry logic
 */

import { IUnifiedToolExecutor } from '../interfaces/UnifiedToolExecutorInterface';
import { IUnifiedToolRegistry } from '../interfaces/UnifiedToolRegistryInterface';
import { IToolValidationService } from '../interfaces/ToolValidationServiceInterface';
import {
  ToolIdentifier,
  ToolParameters,
  ExecutionContext,
  ToolResult,
  ToolId,
  UnifiedTool,
  ValidationResult
} from '../types/FoundationTypes';
import {
  ToolExecutionError,
  ToolNotFoundError,
  ToolValidationError,
  ToolTimeoutError,
  ToolPermissionError
} from '../errors/ToolFoundationErrors';
import { IStructuredLogger } from '../../../logging/interfaces/IStructuredLogger';
import { createToolId } from '../utils/ToolIdUtils';
import { hasAllPermissions, hasAllCapabilities } from '../utils/ExecutionContextUtils';

/**
 * Active execution tracking
 */
interface ActiveExecution {
  readonly toolId: ToolId;
  readonly toolName: string;
  readonly startedAt: string;
  readonly context: ExecutionContext;
  readonly timeoutHandle?: NodeJS.Timeout;
}

/**
 * Execution statistics tracking
 */
interface ExecutionStats {
  executionCount: number;
  successCount: number;
  failureCount: number;
  totalExecutionTime: number;
  lastExecutedAt?: string;
}

/**
 * Retry policy configuration
 */
interface RetryPolicy extends Record<string, unknown> {
  enabled: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * Event callback type
 */
type EventCallback = (data: {
  readonly toolId: ToolId;
  readonly toolName: string;
  readonly context: ExecutionContext;
  readonly result?: ToolResult;
  readonly error?: Error;
  readonly executionTimeMs?: number;
}) => void;

/**
 * Concrete implementation of the unified tool executor
 */
export class UnifiedToolExecutor implements IUnifiedToolExecutor {
  private readonly activeExecutions = new Map<string, ActiveExecution>();
  private readonly executionStats = new Map<ToolId, ExecutionStats>();
  private readonly eventListeners = new Map<string, Set<EventCallback>>();

  private executionTimeout = 30000; // 30 seconds default
  private retryPolicy: RetryPolicy = {
    enabled: true,
    maxRetries: 3,
    retryDelayMs: 1000
  };

  private initialized = false;

  constructor(
    private readonly registry: IUnifiedToolRegistry,
    private readonly validationService: IToolValidationService,
    private readonly logger: IStructuredLogger
  ) { }

  // ==================== Core Execution ====================

  async execute(
    tool: UnifiedTool,
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const executionId = createToolId();
    const startTime = Date.now();

    try {
      this.logger.info('Starting tool execution', {
        toolId: tool.id,
        toolName: tool.name,
        executionId,
        traceId: context.traceId
      });

      // Validate tool is enabled
      if (!tool.enabled) {
        throw new ToolExecutionError(
          `Tool '${tool.name}' is disabled`,
          {
            toolId: tool.id,
            toolName: tool.name,
            parameters: params
          }
        );
      }

      // Validate parameters
      const paramValidation = await this.validateParameters(tool, params);
      if (!paramValidation.valid) {
        throw new ToolValidationError(
          `Invalid parameters for tool '${tool.name}': ${paramValidation.errors.join(', ')}`,
          {
            toolName: tool.name,
            validationErrors: paramValidation.errors,
            validationWarnings: paramValidation.warnings,
            invalidFields: Object.keys(params)
          }
        );
      }

      // Validate execution context
      const contextValidation = await this.validateContext(tool, context);
      if (!contextValidation.valid) {
        throw new ToolPermissionError(
          `Insufficient permissions for tool '${tool.name}': ${contextValidation.errors.join(', ')}`,
          {
            toolId: tool.id,
            toolName: tool.name,
            requiredPermissions: [], // Would be extracted from tool definition
            userPermissions: context.permissions || [],
            missingPermissions: contextValidation.errors
          }
        );
      }

      // Track active execution
      const activeExecution: ActiveExecution = {
        toolId: tool.id,
        toolName: tool.name,
        startedAt: new Date().toISOString(),
        context
      };

      this.activeExecutions.set(executionId, activeExecution);

      // Emit execution start event
      this.emitEvent('execution_start', {
        toolId: tool.id,
        toolName: tool.name,
        context
      });

      // Execute with timeout
      const result = await this.executeWithTimeout(tool, params, context, executionId);

      const executionTimeMs = Date.now() - startTime;

      // Record successful execution
      await this.recordExecution(tool.id, true, executionTimeMs);

      // Emit execution complete event
      this.emitEvent('execution_complete', {
        toolId: tool.id,
        toolName: tool.name,
        context,
        result,
        executionTimeMs
      });

      this.logger.info('Tool execution completed successfully', {
        toolId: tool.id,
        toolName: tool.name,
        executionId,
        executionTimeMs,
        traceId: context.traceId
      });

      return result;

    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      // Record failed execution
      await this.recordExecution(tool.id, false, executionTimeMs);

      // Emit execution error event
      this.emitEvent('execution_error', {
        toolId: tool.id,
        toolName: tool.name,
        context,
        error: error as Error,
        executionTimeMs
      });

      this.logger.error('Tool execution failed', {
        toolId: tool.id,
        toolName: tool.name,
        executionId,
        executionTimeMs,
        error: error instanceof Error ? error.message : 'Unknown error',
        traceId: context.traceId
      });

      // Re-throw the error (NO FALLBACK EXECUTORS)
      throw error;

    } finally {
      // Clean up active execution
      this.activeExecutions.delete(executionId);
    }
  }

  async executeById(
    toolId: ToolId,
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const tool = await this.registry.getTool(toolId);
    if (!tool) {
      // Get suggestions for similar tools
      const allToolNames = await this.registry.getAllToolNames();
      const suggestedTools = await this.registry.findSimilarTools(toolId, 3);

      throw new ToolNotFoundError(
        `Tool with ID '${toolId}' not found`,
        {
          identifier: toolId,
          availableTools: allToolNames,
          suggestedTools: suggestedTools.map(t => t.name)
        }
      );
    }

    return this.execute(tool, params, context);
  }

  async executeSequence(
    executions: readonly {
      tool: UnifiedTool;
      params: ToolParameters;
    }[],
    context: ExecutionContext
  ): Promise<readonly ToolResult[]> {
    const results: ToolResult[] = [];

    for (const execution of executions) {
      try {
        const result = await this.execute(execution.tool, execution.params, context);
        results.push(result);

        // If any execution fails, stop the sequence
        if (!result.success) {
          break;
        }
      } catch (error) {
        // Add error result and stop sequence
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            executionTimeMs: 0,
            toolId: execution.tool.id,
            toolName: execution.tool.name,
            timestamp: new Date().toISOString()
          }
        });
        break;
      }
    }

    return results;
  }

  async executeParallel(
    executions: readonly {
      tool: UnifiedTool;
      params: ToolParameters;
    }[],
    context: ExecutionContext
  ): Promise<readonly ToolResult[]> {
    const promises = executions.map(async (execution) => {
      try {
        return await this.execute(execution.tool, execution.params, context);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            executionTimeMs: 0,
            toolId: execution.tool.id,
            toolName: execution.tool.name,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    return Promise.all(promises);
  }

  // ==================== Validation ====================

  async validateParameters(tool: UnifiedTool, params: ToolParameters): Promise<{
    readonly valid: boolean;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
  }> {
    const result = await this.validationService.validateParameters(params, tool.parameters || { type: 'object', properties: {}, required: [] }, tool.name);
    return {
      valid: result.valid,
      errors: result.errors.map((e: any) => typeof e === 'string' ? e : e.error || JSON.stringify(e)),
      warnings: result.warnings.map((w: any) => typeof w === 'string' ? w : w.warning || JSON.stringify(w))
    };
  }

  async validateContext(tool: UnifiedTool, context: ExecutionContext): Promise<{
    readonly valid: boolean;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
  }> {
    const result = await this.validationService.validateExecutionContext(context, tool);
    return {
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings
    };
  }

  async canExecute(tool: UnifiedTool, context: ExecutionContext): Promise<boolean> {
    if (!tool.enabled) {
      return false;
    }

    const paramValidation = await this.validateContext(tool, context);
    return paramValidation.valid;
  }

  // ==================== Execution Control ====================

  setExecutionTimeout(timeoutMs: number): void {
    this.executionTimeout = timeoutMs;
    this.logger.info('Execution timeout updated', { timeoutMs });
  }

  getExecutionTimeout(): number {
    return this.executionTimeout;
  }

  setRetryPolicy(enabled: boolean, maxRetries = 3, retryDelayMs = 1000): void {
    this.retryPolicy = { enabled, maxRetries, retryDelayMs };
    this.logger.info('Retry policy updated', this.retryPolicy);
  }

  getRetryPolicy(): {
    readonly enabled: boolean;
    readonly maxRetries: number;
    readonly retryDelayMs: number;
  } {
    return { ...this.retryPolicy };
  }

  // ==================== Execution Monitoring ====================

  async getToolExecutionStats(toolId: ToolId): Promise<{
    readonly executionCount: number;
    readonly successCount: number;
    readonly failureCount: number;
    readonly successRate: number;
    readonly averageExecutionTime: number;
    readonly lastExecutedAt?: string;
  }> {
    const stats = this.executionStats.get(toolId);
    if (!stats) {
      return {
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        averageExecutionTime: 0
      };
    }

    return {
      executionCount: stats.executionCount,
      successCount: stats.successCount,
      failureCount: stats.failureCount,
      successRate: stats.executionCount > 0 ? stats.successCount / stats.executionCount : 0,
      averageExecutionTime: stats.executionCount > 0 ? stats.totalExecutionTime / stats.executionCount : 0,
      lastExecutedAt: stats.lastExecutedAt
    };
  }

  async getExecutionStats(): Promise<{
    readonly totalExecutions: number;
    readonly successfulExecutions: number;
    readonly failedExecutions: number;
    readonly averageExecutionTime: number;
    readonly topTools: readonly {
      readonly toolId: ToolId;
      readonly executionCount: number;
    }[];
  }> {
    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let totalExecutionTime = 0;

    const toolExecutions: Array<{ toolId: ToolId; executionCount: number }> = [];

    for (const [toolId, stats] of this.executionStats.entries()) {
      totalExecutions += stats.executionCount;
      successfulExecutions += stats.successCount;
      failedExecutions += stats.failureCount;
      totalExecutionTime += stats.totalExecutionTime;

      if (stats.executionCount > 0) {
        toolExecutions.push({ toolId, executionCount: stats.executionCount });
      }
    }

    toolExecutions.sort((a, b) => b.executionCount - a.executionCount);
    const topTools = toolExecutions.slice(0, 10);

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime: totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0,
      topTools
    };
  }

  async getActiveExecutions(): Promise<readonly {
    readonly toolId: ToolId;
    readonly toolName: string;
    readonly startedAt: string;
    readonly context: ExecutionContext;
  }[]> {
    return Array.from(this.activeExecutions.values()).map(execution => ({
      toolId: execution.toolId,
      toolName: execution.toolName,
      startedAt: execution.startedAt,
      context: execution.context
    }));
  }

  // ==================== Health and Status ====================

  async isHealthy(): Promise<boolean> {
    const healthStatus = await this.getHealthStatus();
    return healthStatus.healthy;
  }

  async getHealthStatus(): Promise<{
    readonly healthy: boolean;
    readonly activeExecutions: number;
    readonly queuedExecutions: number;
    readonly averageResponseTime: number;
    readonly errorRate: number;
    readonly issues: readonly string[];
  }> {
    const issues: string[] = [];
    const activeExecutions = this.activeExecutions.size;

    // Calculate overall error rate
    let totalExecutions = 0;
    let totalFailures = 0;
    let totalExecutionTime = 0;

    for (const stats of this.executionStats.values()) {
      totalExecutions += stats.executionCount;
      totalFailures += stats.failureCount;
      totalExecutionTime += stats.totalExecutionTime;
    }

    const errorRate = totalExecutions > 0 ? totalFailures / totalExecutions : 0;
    const averageResponseTime = totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0;

    // Check for issues
    if (activeExecutions > 100) {
      issues.push(`High number of active executions: ${activeExecutions}`);
    }

    if (errorRate > 0.1) {
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
    }

    if (averageResponseTime > 10000) {
      issues.push(`High average response time: ${averageResponseTime.toFixed(0)}ms`);
    }

    const healthy = issues.length === 0;

    return {
      healthy,
      activeExecutions,
      queuedExecutions: 0, // Not implemented in this version
      averageResponseTime,
      errorRate,
      issues
    };
  }

  async initialize(): Promise<boolean> {
    try {
      if (this.initialized) {
        return true;
      }

      this.logger.info('Initializing Unified Tool Executor');

      // Executor is ready to use
      this.initialized = true;

      this.logger.info('Unified Tool Executor initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize executor', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async shutdown(waitForActiveExecutions = true): Promise<boolean> {
    try {
      this.logger.info('Shutting down Unified Tool Executor', {
        activeExecutions: this.activeExecutions.size,
        waitForActiveExecutions
      });

      if (waitForActiveExecutions && this.activeExecutions.size > 0) {
        this.logger.info('Waiting for active executions to complete');

        // Wait for active executions to complete (with timeout)
        const maxWaitTime = 30000; // 30 seconds
        const startTime = Date.now();

        while (this.activeExecutions.size > 0 && (Date.now() - startTime) < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (this.activeExecutions.size > 0) {
          this.logger.warn('Shutdown timeout reached, some executions may be terminated', {
            remainingExecutions: this.activeExecutions.size
          });
        }
      }

      // Clear all data
      this.activeExecutions.clear();
      this.executionStats.clear();
      this.eventListeners.clear();

      this.initialized = false;

      this.logger.info('Unified Tool Executor shutdown complete');
      return true;
    } catch (error) {
      this.logger.error('Failed to shutdown executor', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // ==================== Event Handling ====================

  on(
    event: 'execution_start' | 'execution_complete' | 'execution_error' | 'execution_timeout',
    callback: EventCallback
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(
    event: 'execution_start' | 'execution_complete' | 'execution_error' | 'execution_timeout',
    callback: Function
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback as EventCallback);
    }
  }

  // ==================== Private Helper Methods ====================

  private async executeWithTimeout(
    tool: UnifiedTool,
    params: ToolParameters,
    context: ExecutionContext,
    executionId: string
  ): Promise<ToolResult> {
    return new Promise<ToolResult>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.emitEvent('execution_timeout', {
          toolId: tool.id,
          toolName: tool.name,
          context
        });

        reject(new ToolTimeoutError(
          `Tool '${tool.name}' execution timed out after ${this.executionTimeout}ms`,
          {
            toolId: tool.id,
            toolName: tool.name,
            timeoutMs: this.executionTimeout,
            executionTimeMs: this.executionTimeout
          }
        ));
      }, this.executionTimeout);

      // Update active execution with timeout handle
      const activeExecution = this.activeExecutions.get(executionId);
      if (activeExecution) {
        this.activeExecutions.set(executionId, {
          ...activeExecution,
          timeoutHandle
        });
      }

      // Execute the tool
      tool.executor(params, context)
        .then(result => {
          clearTimeout(timeoutHandle);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }

  private async recordExecution(toolId: ToolId, success: boolean, executionTimeMs: number): Promise<void> {
    // Update local stats
    let stats = this.executionStats.get(toolId);
    if (!stats) {
      stats = {
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        totalExecutionTime: 0
      };
      this.executionStats.set(toolId, stats);
    }

    stats.executionCount++;
    stats.totalExecutionTime += executionTimeMs;
    stats.lastExecutedAt = new Date().toISOString();

    if (success) {
      stats.successCount++;
    } else {
      stats.failureCount++;
    }

    // Update registry stats
    await this.registry.recordExecution(toolId, success, executionTimeMs);
  }

  private emitEvent(event: string, data: Parameters<EventCallback>[0]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          this.logger.error('Event listener error', {
            event,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  }
} 