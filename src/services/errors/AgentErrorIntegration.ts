/**
 * Agent Error Integration Service
 * 
 * Phase 5: Agent Integration
 * Connects agents with the comprehensive error management system.
 * Provides agent-specific error handling, tracking, and recovery.
 */

import { ulid } from 'ulid';
import { BaseError, ErrorFactory, ErrorType } from '../../lib/errors/types/BaseError';
import { IAgent } from '../../services/thinking/graph/types';
import { IErrorClassificationEngine } from './ErrorClassificationEngine';
import { IErrorNotificationService } from './ErrorNotificationService';
import {
  AgentErrorConfig,
  AgentErrorContext,
  AgentErrorResult,
  DEFAULT_AGENT_ERROR_CONFIG,
  IAgentErrorIntegration
} from './interfaces/IAgentErrorIntegration';
import { IErrorManagementService } from './interfaces/IErrorManagementService';
import { IRecoveryStrategyManager } from './RecoveryStrategyManager';

/**
 * Logger interface
 */
interface ILogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  debug(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Agent operation tracking
 */
interface AgentOperation {
  readonly id: string;
  readonly agentId: string;
  readonly operation: string;
  readonly startTime: Date;
  readonly context: AgentErrorContext;
}

/**
 * Agent error integration service implementation
 */
export class AgentErrorIntegration implements IAgentErrorIntegration {
  private readonly integratedAgents: Map<string, AgentErrorConfig> = new Map();
  private readonly activeOperations: Map<string, AgentOperation> = new Map();
  private readonly agentErrorCounts: Map<string, number> = new Map();
  private readonly agentThrottling: Map<string, Date> = new Map();

  constructor(
    private readonly logger: ILogger,
    private readonly errorManagementService: IErrorManagementService,
    private readonly classificationEngine: IErrorClassificationEngine,
    private readonly recoveryStrategyManager: IRecoveryStrategyManager,
    private readonly notificationService: IErrorNotificationService
  ) { }

  /**
   * Initialize error management for an agent
   */
  async initializeAgentErrorHandling(
    agent: IAgent,
    config: Partial<AgentErrorConfig> = {}
  ): Promise<void> {
    const agentId = agent.getId();
    const fullConfig = { ...DEFAULT_AGENT_ERROR_CONFIG, ...config };

    this.integratedAgents.set(agentId, fullConfig);
    this.agentErrorCounts.set(agentId, 0);

    this.logger.info('Initialized error handling for agent', {
      agentId,
      config: fullConfig
    });
  }

  /**
   * Handle an error that occurred during agent execution
   */
  async handleAgentError(
    error: Error | BaseError,
    context: AgentErrorContext
  ): Promise<AgentErrorResult> {
    const agentConfig = this.integratedAgents.get(context.agentId);
    if (!agentConfig) {
      // Agent not integrated with error management
      return {
        success: false,
        userMessage: 'An error occurred',
        retryScheduled: false
      };
    }

    try {
      // Convert Error to BaseError if needed
      const baseError = this.ensureBaseError(error, context);

      // Log the error
      const logResult = await this.errorManagementService.logError({
        type: baseError.type,
        message: baseError.message,
        context: {
          agentId: context.agentId,
          userId: context.userId,
          timestamp: context.timestamp
        },
        stackTrace: baseError.stackTrace,
        metadata: {
          conversationId: context.conversationId,
          sessionId: context.sessionId,
          ...context.metadata
        }
      });

      // Classify the error
      const classification = await this.classificationEngine.classifyError(baseError);

      // Update agent error count
      this.incrementAgentErrorCount(context.agentId);

      // Determine if retry should be scheduled
      const shouldRetry = classification.retryable &&
        baseError.retryAttempt < baseError.maxRetries &&
        agentConfig.enableErrorRecovery;

      let retryIn: number | undefined;
      if (shouldRetry) {
        const recoveryStrategy = await this.recoveryStrategyManager.getStrategyConfig(baseError.type);
        retryIn = this.calculateRetryDelay(baseError.retryAttempt, recoveryStrategy.baseDelayMs, recoveryStrategy.backoffMultiplier);

        // Schedule retry (in a real implementation, this would use a job queue)
        this.logger.info('Scheduling error retry', {
          errorId: logResult.errorId,
          retryIn,
          attempt: baseError.retryAttempt + 1,
          maxRetries: baseError.maxRetries
        });
      }

      // Send user notification if enabled
      if (agentConfig.enableUserNotifications && classification.retryable) {
        await this.notificationService.sendErrorNotification(baseError);

        if (shouldRetry) {
          await this.notificationService.sendRetryNotification(
            baseError,
            baseError.retryAttempt + 1,
            baseError.maxRetries,
            retryIn
          );
        }
      }

      // Check if agent should be throttled
      await this.checkAgentThrottling(context.agentId, agentConfig);

      return {
        success: false,
        errorId: logResult.errorId,
        userMessage: baseError.userMessage || 'An error occurred',
        retryScheduled: shouldRetry,
        retryIn
      };

    } catch (handlingError) {
      this.logger.error('Failed to handle agent error', {
        agentId: context.agentId,
        operation: context.operation,
        originalError: error.message,
        handlingError: handlingError instanceof Error ? handlingError.message : String(handlingError)
      });

      return {
        success: false,
        userMessage: 'An unexpected error occurred',
        retryScheduled: false
      };
    }
  }

  /**
   * Track agent operation start
   */
  trackOperationStart(context: AgentErrorContext): string {
    const operationId = ulid();
    const operation: AgentOperation = {
      id: operationId,
      agentId: context.agentId,
      operation: context.operation,
      startTime: new Date(),
      context
    };

    this.activeOperations.set(operationId, operation);

    this.logger.debug('Started tracking operation', {
      operationId,
      agentId: context.agentId,
      operation: context.operation
    });

    return operationId;
  }

  /**
   * Track successful operation completion
   */
  async trackOperationSuccess(operationId: string, result?: unknown): Promise<void> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.logger.warn('Attempted to track success for unknown operation', { operationId });
      return;
    }

    this.activeOperations.delete(operationId);

    this.logger.debug('Operation completed successfully', {
      operationId,
      agentId: operation.agentId,
      operation: operation.operation,
      duration: Date.now() - operation.startTime.getTime(),
      result: result ? 'provided' : 'none'
    });
  }

  /**
   * Track failed operation
   */
  async trackOperationFailure(
    operationId: string,
    error: Error | BaseError,
    context: AgentErrorContext
  ): Promise<AgentErrorResult> {
    const operation = this.activeOperations.get(operationId);
    if (operation) {
      this.activeOperations.delete(operationId);
    }

    this.logger.debug('Operation failed', {
      operationId,
      agentId: context.agentId,
      operation: context.operation,
      error: error.message
    });

    return this.handleAgentError(error, context);
  }

  /**
   * Get error statistics for an agent
   */
  async getAgentErrorStats(
    agentId: string,
    timeRange?: { from: Date; to: Date }
  ): Promise<{
    totalErrors: number;
    resolvedErrors: number;
    errorRate: number;
    averageResolutionTime: number;
    topErrorTypes: Array<{ type: string; count: number }>;
  }> {
    try {
      const stats = await this.errorManagementService.getErrorStatistics({
        agentId,
        ...timeRange
      });

      return {
        totalErrors: stats.totalErrors || 0,
        resolvedErrors: 0,
        errorRate: 0,
        averageResolutionTime: stats.averageResolutionTime || 0,
        topErrorTypes: []
      };
    } catch (error) {
      this.logger.error('Failed to get agent error statistics', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        totalErrors: 0,
        resolvedErrors: 0,
        errorRate: 0,
        averageResolutionTime: 0,
        topErrorTypes: []
      };
    }
  }

  /**
   * Check if agent should be throttled
   */
  async shouldThrottleAgent(agentId: string): Promise<boolean> {
    const throttleUntil = this.agentThrottling.get(agentId);
    if (!throttleUntil) {
      return false;
    }

    if (Date.now() > throttleUntil.getTime()) {
      // Throttle period has expired
      this.agentThrottling.delete(agentId);
      return false;
    }

    return true;
  }

  /**
   * Enable or disable error handling for an agent
   */
  async setAgentErrorHandling(agentId: string, enabled: boolean): Promise<void> {
    const config = this.integratedAgents.get(agentId);
    if (!config) {
      throw new Error(`Agent ${agentId} is not integrated with error management`);
    }

    const updatedConfig = { ...config, enableErrorRecovery: enabled };
    this.integratedAgents.set(agentId, updatedConfig);

    this.logger.info('Updated agent error handling setting', {
      agentId,
      enabled
    });
  }

  /**
   * Convert Error to BaseError if needed
   */
  private ensureBaseError(error: Error | BaseError, context: AgentErrorContext): BaseError {
    // Check if it's already a BaseError (duck typing since BaseError is interface)
    if ('id' in error && 'type' in error && 'category' in error) {
      return error as BaseError;
    }

    // Convert regular Error to BaseError
    return ErrorFactory.createError({
      type: ErrorType.TOOL_EXECUTION,
      message: error.message,
      userMessage: 'An unexpected error occurred',
      stackTrace: 'stack' in error ? error.stack : undefined,
      context: {
        agentId: context.agentId,
        userId: context.userId,
        timestamp: context.timestamp
      },
      metadata: {
        originalErrorName: 'name' in error ? error.name : 'Unknown',
        operation: context.operation,
        ...context.metadata
      }
    });
  }

  /**
   * Increment error count for agent
   */
  private incrementAgentErrorCount(agentId: string): void {
    const currentCount = this.agentErrorCounts.get(agentId) || 0;
    this.agentErrorCounts.set(agentId, currentCount + 1);
  }

  /**
   * Check if agent should be throttled based on error rate
   */
  private async checkAgentThrottling(agentId: string, config: AgentErrorConfig): Promise<void> {
    const errorCount = this.agentErrorCounts.get(agentId) || 0;

    if (errorCount >= config.escalateAfterFailures) {
      const throttleUntil = new Date(Date.now() + (5 * 60 * 1000)); // 5 minutes
      this.agentThrottling.set(agentId, throttleUntil);

      const escalationError = ErrorFactory.createError({
        type: ErrorType.TOOL_EXECUTION,
        message: `Agent ${agentId} throttled due to excessive errors`,
        context: {
          agentId,
          timestamp: new Date()
        },
        metadata: {
          errorCount,
          maxErrors: config.escalateAfterFailures,
          throttleUntil: throttleUntil.toISOString()
        }
      });

      await this.notificationService.sendEscalationNotification(
        escalationError,
        `High error rate: ${errorCount} failures exceeded threshold of ${config.escalateAfterFailures}`
      );

      this.logger.warn('Agent throttled due to excessive errors', {
        agentId,
        errorCount,
        maxErrors: config.escalateAfterFailures,
        throttleUntil
      });
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(
    attempt: number,
    baseDelay: number,
    backoffMultiplier: number
  ): number {
    return Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), 300000); // Cap at 5 minutes
  }
}



