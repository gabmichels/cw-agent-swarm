/**
 * Agent Error Integration Interface
 * 
 * Defines how agents integrate with the error management system.
 * This is Phase 5 of the error communication implementation.
 */

import { BaseError } from '../../../lib/errors/types/BaseError';
import { IAgent } from '../../../services/thinking/graph/types';

/**
 * Agent error context for error tracking
 */
export interface AgentErrorContext {
  readonly agentId: string;
  readonly userId: string;
  readonly conversationId: string;
  readonly sessionId?: string;
  readonly operation: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Agent error handling configuration
 */
export interface AgentErrorConfig {
  readonly enableErrorRecovery: boolean;
  readonly enableUserNotifications: boolean;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly escalateAfterFailures: number;
}

/**
 * Agent error handling result
 */
export interface AgentErrorResult {
  readonly success: boolean;
  readonly errorId?: string;
  readonly userMessage?: string;
  readonly retryScheduled: boolean;
  readonly retryIn?: number; // seconds
  readonly actionableSuggestions?: readonly string[];
}

/**
 * Interface for integrating error management into agents
 */
export interface IAgentErrorIntegration {
  /**
   * Initialize error management for an agent
   */
  initializeAgentErrorHandling(agent: IAgent, config?: Partial<AgentErrorConfig>): Promise<void>;

  /**
   * Handle an error that occurred during agent execution
   */
  handleAgentError(
    error: Error | BaseError,
    context: AgentErrorContext
  ): Promise<AgentErrorResult>;

  /**
   * Track agent operation start
   */
  trackOperationStart(context: AgentErrorContext): string; // Returns operation ID

  /**
   * Track agent operation success
   */
  trackOperationSuccess(operationId: string, result?: unknown): Promise<void>;

  /**
   * Track agent operation failure
   */
  trackOperationFailure(
    operationId: string,
    error: Error | BaseError,
    context: AgentErrorContext
  ): Promise<AgentErrorResult>;

  /**
   * Get agent error statistics
   */
  getAgentErrorStats(agentId: string, timeRange?: { from: Date; to: Date }): Promise<{
    totalErrors: number;
    resolvedErrors: number;
    errorRate: number;
    averageResolutionTime: number;
    topErrorTypes: Array<{ type: string; count: number }>;
  }>;

  /**
   * Check if agent should be throttled due to error rate
   */
  shouldThrottleAgent(agentId: string): Promise<boolean>;

  /**
   * Enable/disable error handling for an agent
   */
  setAgentErrorHandling(agentId: string, enabled: boolean): Promise<void>;
}

/**
 * Default configuration for agent error handling
 */
export const DEFAULT_AGENT_ERROR_CONFIG: AgentErrorConfig = {
  enableErrorRecovery: true,
  enableUserNotifications: true,
  maxRetries: 3,
  timeoutMs: 30000,
  escalateAfterFailures: 5
}; 