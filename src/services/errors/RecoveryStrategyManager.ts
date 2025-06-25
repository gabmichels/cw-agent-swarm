/**
 * Recovery Strategy Manager
 * 
 * Manages recovery strategies for different types of errors, including:
 * - Retry policies with exponential backoff
 * - Fallback strategies for failed operations
 * - Circuit breaker patterns for external services
 * - Graceful degradation patterns
 */

import { ILogger } from '../../lib/core/logger';
import {
  BaseError,
  ErrorSeverity,
  ErrorType,
  RetryStrategy
} from '../../lib/errors/types/BaseError';

/**
 * Recovery strategy configuration
 */
export interface RecoveryStrategyConfig {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly strategy: RetryStrategy;
  readonly circuitBreakerThreshold: number;
  readonly circuitBreakerWindow: number; // minutes
  readonly fallbackEnabled: boolean;
  readonly gracefulDegradation: boolean;
}

/**
 * Recovery attempt result
 */
export interface RecoveryAttemptResult {
  readonly success: boolean;
  readonly attemptNumber: number;
  readonly totalAttempts: number;
  readonly delayMs: number;
  readonly nextRetryAt?: Date;
  readonly fallbackUsed: boolean;
  readonly degradedMode: boolean;
  readonly errorMessage?: string;
  readonly recoveryMethod: 'retry' | 'fallback' | 'degradation' | 'escalation';
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  readonly isOpen: boolean;
  readonly failureCount: number;
  readonly lastFailureTime?: Date;
  readonly nextAttemptAt?: Date;
  readonly windowStart: Date;
}

/**
 * Recovery strategy interface
 */
export interface IRecoveryStrategyManager {
  getStrategyConfig(errorType: ErrorType): RecoveryStrategyConfig;
  calculateRetryDelay(attempt: number, config: RecoveryStrategyConfig): number;
  shouldRetry(error: BaseError, attemptNumber: number): Promise<boolean>;
  executeWithRecovery<T>(
    operation: () => Promise<T>,
    errorType: ErrorType,
    context: Record<string, unknown>
  ): Promise<T>;
  updateCircuitBreaker(errorType: ErrorType, success: boolean): Promise<void>;
  getCircuitBreakerState(errorType: ErrorType): Promise<CircuitBreakerState>;
}

/**
 * Default recovery strategy manager implementation
 */
export class DefaultRecoveryStrategyManager implements IRecoveryStrategyManager {
  private readonly strategyConfigs: Map<ErrorType, RecoveryStrategyConfig> = new Map();
  private readonly circuitBreakers: Map<ErrorType, CircuitBreakerState> = new Map();

  constructor(
    private readonly logger: ILogger
  ) {
    this.initializeDefaultStrategies();
  }

  /**
   * Get recovery strategy configuration for error type
   */
  getStrategyConfig(errorType: ErrorType): RecoveryStrategyConfig {
    return this.strategyConfigs.get(errorType) || this.getDefaultConfig();
  }

  /**
   * Calculate retry delay based on attempt number and strategy
   */
  calculateRetryDelay(attempt: number, config: RecoveryStrategyConfig): number {
    switch (config.strategy) {
      case RetryStrategy.IMMEDIATE:
        return 0;

      case RetryStrategy.LINEAR:
        return Math.min(
          config.baseDelayMs * attempt,
          config.maxDelayMs
        );

      case RetryStrategy.EXPONENTIAL_BACKOFF:
        const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
        return Math.min(delay, config.maxDelayMs);

      case RetryStrategy.NO_RETRY:
      default:
        return 0;
    }
  }

  /**
   * Determine if operation should be retried
   */
  async shouldRetry(error: BaseError, attemptNumber: number): Promise<boolean> {
    const config = this.getStrategyConfig(error.type);

    // Check if retries are enabled
    if (!error.retryable || config.strategy === RetryStrategy.NO_RETRY) {
      return false;
    }

    // Check attempt limits
    if (attemptNumber >= config.maxRetries) {
      this.logger.info('Max retries exceeded', {
        errorId: error.id,
        errorType: error.type,
        attemptNumber,
        maxRetries: config.maxRetries
      });
      return false;
    }

    // Check circuit breaker
    const circuitState = await this.getCircuitBreakerState(error.type);
    if (circuitState.isOpen) {
      this.logger.info('Circuit breaker is open, skipping retry', {
        errorId: error.id,
        errorType: error.type,
        nextAttemptAt: circuitState.nextAttemptAt
      });
      return false;
    }

    // Check error severity - don't retry critical errors immediately
    if (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.EMERGENCY) {
      this.logger.info('Critical error detected, escalating instead of retry', {
        errorId: error.id,
        severity: error.severity
      });
      return false;
    }

    return true;
  }

  /**
   * Execute operation with recovery strategies
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    errorType: ErrorType,
    context: Record<string, unknown>
  ): Promise<T> {
    const config = this.getStrategyConfig(errorType);
    let lastError: Error | undefined;
    let attemptNumber = 0;
    let fallbackUsed = false;
    let degradedMode = false;

    this.logger.info('Starting operation with recovery', {
      errorType,
      maxRetries: config.maxRetries,
      strategy: config.strategy,
      context
    });

    while (attemptNumber <= config.maxRetries) {
      attemptNumber++;

      try {
        const result = await operation();

        // Success - update circuit breaker
        await this.updateCircuitBreaker(errorType, true);

        this.logger.info('Operation succeeded', {
          errorType,
          attemptNumber,
          fallbackUsed,
          degradedMode
        });

        return result;
      } catch (error) {
        lastError = error as Error;

        this.logger.warn('Operation attempt failed', {
          errorType,
          attemptNumber,
          maxRetries: config.maxRetries,
          error: lastError.message
        });

        // Update circuit breaker
        await this.updateCircuitBreaker(errorType, false);

        // Check if we should retry
        if (attemptNumber < config.maxRetries) {
          const delay = this.calculateRetryDelay(attemptNumber, config);

          if (delay > 0) {
            this.logger.info('Waiting before retry', {
              errorType,
              attemptNumber,
              delayMs: delay
            });
            await this.sleep(delay);
          }

          continue;
        }

        // Max retries reached - try fallback strategies
        if (config.fallbackEnabled && !fallbackUsed) {
          this.logger.info('Attempting fallback strategy', {
            errorType,
            context
          });

          try {
            const fallbackResult = await this.executeFallbackStrategy(
              operation,
              errorType,
              context
            );
            fallbackUsed = true;
            return fallbackResult;
          } catch (fallbackError) {
            this.logger.warn('Fallback strategy failed', {
              errorType,
              error: (fallbackError as Error).message
            });
          }
        }

        // Try graceful degradation
        if (config.gracefulDegradation && !degradedMode) {
          this.logger.info('Attempting graceful degradation', {
            errorType,
            context
          });

          try {
            const degradedResult = await this.executeWithDegradation(
              operation,
              errorType,
              context
            );
            degradedMode = true;
            return degradedResult;
          } catch (degradationError) {
            this.logger.warn('Graceful degradation failed', {
              errorType,
              error: (degradationError as Error).message
            });
          }
        }
      }
    }

    // All recovery strategies failed
    this.logger.error('All recovery strategies exhausted', {
      errorType,
      attemptNumber,
      fallbackUsed,
      degradedMode,
      finalError: lastError?.message
    });

    throw lastError || new Error('Recovery strategies exhausted');
  }

  /**
   * Update circuit breaker state
   */
  async updateCircuitBreaker(errorType: ErrorType, success: boolean): Promise<void> {
    const config = this.getStrategyConfig(errorType);
    const currentState = this.circuitBreakers.get(errorType) || this.createInitialCircuitState();
    const now = new Date();

    // Check if we need to reset the window
    const windowElapsed = now.getTime() - currentState.windowStart.getTime();
    const windowMs = config.circuitBreakerWindow * 60 * 1000;

    let newState: CircuitBreakerState;

    if (windowElapsed > windowMs) {
      // Reset window
      newState = {
        isOpen: false,
        failureCount: success ? 0 : 1,
        lastFailureTime: success ? undefined : now,
        nextAttemptAt: undefined,
        windowStart: now
      };
    } else if (success) {
      // Success - reset failure count if circuit is closed
      newState = {
        ...currentState,
        failureCount: currentState.isOpen ? currentState.failureCount : 0,
        isOpen: false,
        nextAttemptAt: undefined
      };
    } else {
      // Failure - increment count
      const newFailureCount = currentState.failureCount + 1;
      const shouldOpen = newFailureCount >= config.circuitBreakerThreshold;

      newState = {
        ...currentState,
        failureCount: newFailureCount,
        lastFailureTime: now,
        isOpen: shouldOpen,
        nextAttemptAt: shouldOpen ?
          new Date(now.getTime() + (config.circuitBreakerWindow * 60 * 1000)) :
          undefined
      };

      if (shouldOpen) {
        this.logger.warn('Circuit breaker opened', {
          errorType,
          failureCount: newFailureCount,
          threshold: config.circuitBreakerThreshold,
          nextAttemptAt: newState.nextAttemptAt
        });
      }
    }

    this.circuitBreakers.set(errorType, newState);
  }

  /**
   * Get current circuit breaker state
   */
  async getCircuitBreakerState(errorType: ErrorType): Promise<CircuitBreakerState> {
    const state = this.circuitBreakers.get(errorType);
    if (!state) {
      const initialState = this.createInitialCircuitState();
      this.circuitBreakers.set(errorType, initialState);
      return initialState;
    }

    // Check if circuit should be half-open
    if (state.isOpen && state.nextAttemptAt && new Date() >= state.nextAttemptAt) {
      const halfOpenState: CircuitBreakerState = {
        ...state,
        isOpen: false,
        nextAttemptAt: undefined
      };
      this.circuitBreakers.set(errorType, halfOpenState);
      return halfOpenState;
    }

    return state;
  }

  /**
   * Execute fallback strategy for failed operations
   */
  private async executeFallbackStrategy<T>(
    operation: () => Promise<T>,
    errorType: ErrorType,
    context: Record<string, unknown>
  ): Promise<T> {
    // Implement type-specific fallback strategies
    switch (errorType) {
      case ErrorType.TOOL_EXECUTION:
        return this.executeToolFallback(operation, context);

      case ErrorType.API_FAILURE:
        return this.executeApiFallback(operation, context);

      case ErrorType.WORKSPACE_CONNECTION:
        return this.executeWorkspaceFallback(operation, context);

      default:
        throw new Error('No fallback strategy available');
    }
  }

  /**
   * Execute with graceful degradation
   */
  private async executeWithDegradation<T>(
    operation: () => Promise<T>,
    errorType: ErrorType,
    context: Record<string, unknown>
  ): Promise<T> {
    // Implement degraded mode execution
    this.logger.info('Executing in degraded mode', {
      errorType,
      context
    });

    // This would typically return a simplified or cached version of the operation
    // For now, we'll throw to indicate degradation is not implemented
    throw new Error('Graceful degradation not implemented for this operation');
  }

  /**
   * Tool execution fallback strategy
   */
  private async executeToolFallback<T>(
    operation: () => Promise<T>,
    context: Record<string, unknown>
  ): Promise<T> {
    // Try alternative tool or simplified operation
    this.logger.info('Attempting tool fallback', { context });

    // This would implement tool-specific fallback logic
    throw new Error('Tool fallback not implemented');
  }

  /**
   * API failure fallback strategy
   */
  private async executeApiFallback<T>(
    operation: () => Promise<T>,
    context: Record<string, unknown>
  ): Promise<T> {
    // Try cached data or alternative API
    this.logger.info('Attempting API fallback', { context });

    // This would implement API-specific fallback logic
    throw new Error('API fallback not implemented');
  }

  /**
   * Workspace connection fallback strategy
   */
  private async executeWorkspaceFallback<T>(
    operation: () => Promise<T>,
    context: Record<string, unknown>
  ): Promise<T> {
    // Try token refresh or alternative connection
    this.logger.info('Attempting workspace fallback', { context });

    // This would implement workspace-specific fallback logic
    throw new Error('Workspace fallback not implemented');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create initial circuit breaker state
   */
  private createInitialCircuitState(): CircuitBreakerState {
    return {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: undefined,
      nextAttemptAt: undefined,
      windowStart: new Date()
    };
  }

  /**
   * Get default recovery configuration
   */
  private getDefaultConfig(): RecoveryStrategyConfig {
    return {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      circuitBreakerThreshold: 5,
      circuitBreakerWindow: 5,
      fallbackEnabled: false,
      gracefulDegradation: false
    };
  }

  /**
   * Initialize default recovery strategies for different error types
   */
  private initializeDefaultStrategies(): void {
    const strategies: Array<[ErrorType, RecoveryStrategyConfig]> = [
      [ErrorType.TOOL_EXECUTION, {
        maxRetries: 3,
        baseDelayMs: 2000,
        maxDelayMs: 15000,
        backoffMultiplier: 2,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        circuitBreakerThreshold: 5,
        circuitBreakerWindow: 10,
        fallbackEnabled: true,
        gracefulDegradation: true
      }],

      [ErrorType.API_FAILURE, {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 1.5,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        circuitBreakerThreshold: 10,
        circuitBreakerWindow: 5,
        fallbackEnabled: true,
        gracefulDegradation: false
      }],

      [ErrorType.NETWORK_ERROR, {
        maxRetries: 4,
        baseDelayMs: 500,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        circuitBreakerThreshold: 8,
        circuitBreakerWindow: 3,
        fallbackEnabled: false,
        gracefulDegradation: false
      }],

      [ErrorType.RATE_LIMIT_ERROR, {
        maxRetries: 6,
        baseDelayMs: 5000,
        maxDelayMs: 60000,
        backoffMultiplier: 1.8,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        circuitBreakerThreshold: 3,
        circuitBreakerWindow: 15,
        fallbackEnabled: false,
        gracefulDegradation: true
      }],

      [ErrorType.WORKSPACE_CONNECTION, {
        maxRetries: 2,
        baseDelayMs: 3000,
        maxDelayMs: 20000,
        backoffMultiplier: 2.5,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        circuitBreakerThreshold: 3,
        circuitBreakerWindow: 10,
        fallbackEnabled: true,
        gracefulDegradation: false
      }],

      [ErrorType.PERMISSION_DENIED, {
        maxRetries: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
        backoffMultiplier: 1,
        strategy: RetryStrategy.NO_RETRY,
        circuitBreakerThreshold: 1,
        circuitBreakerWindow: 60,
        fallbackEnabled: false,
        gracefulDegradation: false
      }],

      [ErrorType.VALIDATION_ERROR, {
        maxRetries: 1,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 1,
        strategy: RetryStrategy.LINEAR,
        circuitBreakerThreshold: 10,
        circuitBreakerWindow: 5,
        fallbackEnabled: false,
        gracefulDegradation: false
      }],

      [ErrorType.DATABASE_ERROR, {
        maxRetries: 2,
        baseDelayMs: 2000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        circuitBreakerThreshold: 3,
        circuitBreakerWindow: 5,
        fallbackEnabled: false,
        gracefulDegradation: true
      }]
    ];

    for (const [errorType, config] of strategies) {
      this.strategyConfigs.set(errorType, config);
    }

    this.logger.info('Recovery strategies initialized', {
      strategyCount: strategies.length
    });
  }
} 