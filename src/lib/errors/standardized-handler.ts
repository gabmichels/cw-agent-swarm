/**
 * Standardized Error Handling System
 * 
 * Provides unified error handling patterns across all services with proper logging,
 * context management, and recovery strategies following IMPLEMENTATION_GUIDELINES.md.
 */

import { logger } from '../logging';
import { AppError, failureResult, Result, successResult } from './base';
import {
  ApiError,
  ApiErrorCode,
  InfrastructureError,
  InfrastructureErrorCode,
  MemoryError,
  ToolError,
  ValidationError
} from './types';

/**
 * Error severity levels for proper handling and alerting
 */
export enum ErrorSeverity {
  LOW = 'low',           // Minor issues, expected errors
  MEDIUM = 'medium',     // Important but recoverable errors
  HIGH = 'high',         // Serious errors requiring attention
  CRITICAL = 'critical'  // System-level errors requiring immediate action
}

/**
 * Error context for enhanced debugging and monitoring
 */
export interface ErrorContext {
  /** Service or component where error occurred */
  service: string;
  /** Operation being performed when error occurred */
  operation: string;
  /** User ID if applicable */
  userId?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Error severity */
  severity?: ErrorSeverity;
  /** Whether error is retryable */
  retryable?: boolean;
  /** Suggested recovery actions */
  recoveryActions?: string[];
  /** Current retry attempt number */
  attempt?: number;
  /** Total number of retry attempts */
  totalRetries?: number;
  /** Whether this is the final attempt */
  finalAttempt?: boolean;
  /** Total number of attempts made */
  totalAttempts?: number;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  /** Whether to log errors automatically */
  autoLog: boolean;
  /** Whether to include stack traces in logs */
  includeStack: boolean;
  /** Maximum retry attempts for retryable errors */
  maxRetries: number;
  /** Base delay for retry attempts (ms) */
  retryDelayMs: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
}

/**
 * Default error handling configuration
 */
const DEFAULT_ERROR_CONFIG: ErrorHandlingConfig = {
  autoLog: true,
  includeStack: process.env.NODE_ENV !== 'production',
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
};

/**
 * Standardized error handler
 */
export class StandardizedErrorHandler {
  private static instance: StandardizedErrorHandler | null = null;
  private config: ErrorHandlingConfig;

  private constructor(config: Partial<ErrorHandlingConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_CONFIG, ...config };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ErrorHandlingConfig>): StandardizedErrorHandler {
    if (!StandardizedErrorHandler.instance) {
      StandardizedErrorHandler.instance = new StandardizedErrorHandler(config);
    }
    return StandardizedErrorHandler.instance;
  }

  /**
   * Handle errors from synchronous operations
   */
  handleSyncError<T>(
    operation: () => T,
    context: ErrorContext
  ): Result<T> {
    try {
      const result = operation();
      return successResult(result);
    } catch (error) {
      const appError = this.convertToAppError(error, context);

      if (this.config.autoLog) {
        this.logError(appError, context);
      }

      return failureResult(appError);
    }
  }

  /**
   * Handle errors from asynchronous operations
   */
  async handleAsyncError<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<Result<T>> {
    try {
      const result = await operation();
      return successResult(result);
    } catch (error) {
      const appError = this.convertToAppError(error, context);

      if (this.config.autoLog) {
        this.logError(appError, context);
      }

      return failureResult(appError);
    }
  }

  /**
   * Handle errors with retry logic
   */
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxRetries?: number
  ): Promise<Result<T>> {
    const retries = maxRetries ?? this.config.maxRetries;
    let lastError: AppError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await operation();

        // Log successful retry if this wasn't the first attempt
        if (attempt > 0) {
          logger.info('Operation succeeded after retry', {
            ...context,
            attempt,
            totalRetries: retries,
          });
        }

        return successResult(result);
      } catch (error) {
        const appError = this.convertToAppError(error, {
          ...context,
          attempt,
          totalRetries: retries,
        });

        lastError = appError;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(appError) && context.retryable !== false;

        if (!isRetryable || attempt === retries) {
          if (this.config.autoLog) {
            this.logError(appError, {
              ...context,
              finalAttempt: true,
              totalAttempts: attempt + 1,
            });
          }
          break;
        }

        // Log retry attempt
        if (this.config.autoLog) {
          logger.warn('Operation failed, retrying', {
            ...context,
            attempt: attempt + 1,
            maxRetries: retries,
            error: appError.message,
            retryDelay: this.calculateRetryDelay(attempt),
          });
        }

        // Wait before retry
        await this.delay(this.calculateRetryDelay(attempt));
      }
    }

    return failureResult(lastError!);
  }

  /**
   * Convert any error to standardized AppError
   */
  private convertToAppError(error: unknown, context: ErrorContext): AppError {
    // Already an AppError - add context and return
    if (error instanceof AppError) {
      return error.withContext({
        service: context.service,
        operation: context.operation,
        userId: context.userId,
        requestId: context.requestId,
        severity: context.severity || this.determineSeverity(error),
        ...context.metadata,
      });
    }

    // Network/HTTP errors
    if (this.isNetworkError(error)) {
      return new InfrastructureError(
        error instanceof Error ? error.message : 'Network error occurred',
        InfrastructureErrorCode.NETWORK_ERROR,
        {
          service: context.service,
          operation: context.operation,
          severity: ErrorSeverity.MEDIUM,
          retryable: true,
          ...context.metadata,
        }
      );
    }

    // Database errors
    if (this.isDatabaseError(error)) {
      return new InfrastructureError(
        error instanceof Error ? error.message : 'Database error occurred',
        InfrastructureErrorCode.DATABASE_ERROR,
        {
          service: context.service,
          operation: context.operation,
          severity: ErrorSeverity.HIGH,
          retryable: false,
          ...context.metadata,
        }
      );
    }

    // Validation errors
    if (this.isValidationError(error)) {
      return new ValidationError(
        error instanceof Error ? error.message : 'Validation failed',
        [],
        {
          service: context.service,
          operation: context.operation,
          severity: ErrorSeverity.LOW,
          retryable: false,
          ...context.metadata,
        }
      );
    }

    // OAuth/Authentication errors
    if (this.isAuthError(error)) {
      return new ApiError(
        error instanceof Error ? error.message : 'Authentication failed',
        ApiErrorCode.UNAUTHORIZED,
        401,
        {
          service: context.service,
          operation: context.operation,
          severity: ErrorSeverity.MEDIUM,
          retryable: false,
          recoveryActions: ['Refresh tokens', 'Re-authenticate user'],
          ...context.metadata,
        }
      );
    }

    // Generic errors
    const message = error instanceof Error ? error.message : String(error);
    return new AppError(
      message,
      'UNKNOWN_ERROR',
      {
        service: context.service,
        operation: context.operation,
        severity: context.severity || ErrorSeverity.MEDIUM,
        originalError: error,
        stack: error instanceof Error ? error.stack : undefined,
        ...context.metadata,
      }
    );
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(error: AppError, context: ErrorContext): void {
    const severity = context.severity || this.determineSeverity(error);
    const logLevel = this.getLogLevel(severity);

    const logData = {
      ...error.toJSON(),
      service: context.service,
      operation: context.operation,
      userId: context.userId,
      requestId: context.requestId,
      severity,
      recoveryActions: context.recoveryActions,
      ...(this.config.includeStack && { stack: error.stack }),
    };

    logger[logLevel](`Error in ${context.service}.${context.operation}`, logData);

    // Alert for critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      this.alertCriticalError(error, context);
    }
  }

  /**
   * Determine error severity based on error type and context
   */
  private determineSeverity(error: AppError): ErrorSeverity {
    // Critical: Infrastructure failures, security issues
    if (error instanceof InfrastructureError &&
      error.code.includes('DATABASE') || error.code.includes('SERVICE_UNAVAILABLE')) {
      return ErrorSeverity.CRITICAL;
    }

    // High: Authentication failures, API errors
    if (error instanceof ApiError && error.statusCode >= 500) {
      return ErrorSeverity.HIGH;
    }

    // Medium: Tool failures, memory errors
    if (error instanceof ToolError || error instanceof MemoryError) {
      return ErrorSeverity.MEDIUM;
    }

    // Low: Validation errors, client errors
    if (error instanceof ValidationError ||
      (error instanceof ApiError && error.statusCode < 500)) {
      return ErrorSeverity.LOW;
    }

    return ErrorSeverity.MEDIUM;
  }

  /**
   * Get appropriate log level for error severity
   */
  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'warn';
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: AppError): boolean {
    // Network errors are generally retryable
    if (error instanceof InfrastructureError &&
      error.code.includes('NETWORK') || error.code.includes('SERVICE_UNAVAILABLE')) {
      return true;
    }

    // Rate limiting is retryable
    if (error instanceof ApiError && error.statusCode === 429) {
      return true;
    }

    // Server errors (5xx) are retryable
    if (error instanceof ApiError && error.statusCode >= 500) {
      return true;
    }

    // Tool timeouts are retryable
    if (error instanceof ToolError && error.code.includes('TIMEOUT')) {
      return true;
    }

    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    if (!this.config.exponentialBackoff) {
      return this.config.retryDelayMs;
    }

    // Exponential backoff: baseDelay * (2^attempt) with jitter
    const delay = this.config.retryDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * delay; // 10% jitter
    return Math.min(delay + jitter, 30000); // Max 30 seconds
  }

  /**
   * Sleep for specified duration
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('network') ||
        message.includes('timeout') ||
        message.includes('fetch') ||
        message.includes('econnreset') ||
        message.includes('enotfound');
    }
    return false;
  }

  /**
   * Check if error is a database error
   */
  private isDatabaseError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('database') ||
        message.includes('prisma') ||
        message.includes('sql') ||
        message.includes('connection');
    }
    return false;
  }

  /**
   * Check if error is a validation error
   */
  private isValidationError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('validation') ||
        message.includes('invalid') ||
        message.includes('required') ||
        message.includes('schema');
    }
    return false;
  }

  /**
   * Check if error is an authentication error
   */
  private isAuthError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('unauthorized') ||
        message.includes('authentication') ||
        message.includes('token') ||
        message.includes('oauth') ||
        message.includes('expired');
    }
    return false;
  }

  /**
   * Alert for critical errors (placeholder for monitoring integration)
   */
  private alertCriticalError(error: AppError, context: ErrorContext): void {
    // This would integrate with monitoring/alerting systems
    // For now, just log with CRITICAL tag
    logger.error('CRITICAL ERROR ALERT', {
      error: error.toJSON(),
      context,
      timestamp: new Date().toISOString(),
      alertLevel: 'CRITICAL',
    });
  }
}

/**
 * Singleton instance
 */
export const errorHandler = StandardizedErrorHandler.getInstance();

/**
 * Convenience functions for common error handling patterns
 */

/**
 * Handle sync operation with standardized error handling
 */
export function handleSync<T>(
  operation: () => T,
  context: ErrorContext
): Result<T> {
  return errorHandler.handleSyncError(operation, context);
}

/**
 * Handle async operation with standardized error handling
 */
export async function handleAsync<T>(
  operation: () => Promise<T>,
  context: ErrorContext
): Promise<Result<T>> {
  return errorHandler.handleAsyncError(operation, context);
}

/**
 * Handle async operation with retry logic
 */
export async function handleWithRetry<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  maxRetries?: number
): Promise<Result<T>> {
  return errorHandler.handleWithRetry(operation, context, maxRetries);
}

/**
 * Create error context for service operations
 */
export function createErrorContext(
  service: string,
  operation: string,
  additional: Partial<ErrorContext> = {}
): ErrorContext {
  return {
    service,
    operation,
    ...additional,
  };
} 