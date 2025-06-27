/**
 * Base Error Type System
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - Strict TypeScript typing (no any types)
 * - ULID IDs for all error records
 * - Immutable data patterns
 * - Interface-first design
 */

import { ulid } from 'ulid';

/**
 * Error type categories for classification
 */
export enum ErrorCategory {
  SYSTEM = 'SYSTEM',
  USER_ACTION = 'USER_ACTION',
  EXTERNAL = 'EXTERNAL',
  INTERNAL = 'INTERNAL'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY'
}

/**
 * Error status enumeration
 */
export enum ErrorStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  RETRYING = 'RETRYING',
  RESOLVED = 'RESOLVED',
  IGNORED = 'IGNORED',
  ESCALATED = 'ESCALATED',
  FAILED_PERMANENTLY = 'FAILED_PERMANENTLY'
}

/**
 * Error types enumeration
 */
export enum ErrorType {
  TOOL_EXECUTION = 'TOOL_EXECUTION',
  API_FAILURE = 'API_FAILURE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  WORKSPACE_CONNECTION = 'WORKSPACE_CONNECTION',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR'
}

/**
 * Retry strategy enumeration
 */
export enum RetryStrategy {
  EXPONENTIAL_BACKOFF = 'EXPONENTIAL_BACKOFF',
  LINEAR = 'LINEAR',
  IMMEDIATE = 'IMMEDIATE',
  NO_RETRY = 'NO_RETRY'
}

/**
 * Resolution method enumeration
 */
export enum ResolutionMethod {
  AUTO_RETRY = 'AUTO_RETRY',
  MANUAL_FIX = 'MANUAL_FIX',
  USER_ACTION = 'USER_ACTION',
  IGNORE = 'IGNORE',
  SYSTEM_RECOVERY = 'SYSTEM_RECOVERY'
}

/**
 * User impact level enumeration
 */
export enum UserImpactLevel {
  NONE = 'NONE',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Base error context interface
 */
export interface BaseErrorContext {
  readonly agentId?: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly conversationId?: string;
  readonly requestId?: string;
  readonly timestamp: Date;
  readonly environment?: string;
  readonly serverInstance?: string;
  readonly version?: string;
  readonly operation?: string;
}

/**
 * Error metadata interface for additional information
 */
export interface ErrorMetadata {
  readonly [key: string]: unknown;
}

/**
 * Base error interface - all errors must implement this
 */
export interface BaseError {
  readonly id: string; // ULID
  readonly type: ErrorType;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly status: ErrorStatus;
  readonly message: string;
  readonly userMessage?: string;
  readonly errorCode?: string;
  readonly stackTrace?: string;
  readonly context: BaseErrorContext;
  readonly metadata?: ErrorMetadata;
  readonly timestamp: Date;
  readonly retryable: boolean;

  // Retry information
  readonly retryAttempt: number;
  readonly maxRetries: number;
  readonly retryStrategy?: RetryStrategy;

  // Hierarchy
  readonly parentErrorId?: string;
  readonly rootCauseErrorId?: string;

  // Impact assessment
  readonly userImpact: UserImpactLevel;
  readonly estimatedImpact?: string;
}

/**
 * Error creation input interface
 */
export interface ErrorInput {
  readonly type: ErrorType;
  readonly message: string;
  readonly userMessage?: string;
  readonly errorCode?: string;
  readonly stackTrace?: string;
  readonly context: Partial<BaseErrorContext>;
  readonly metadata?: ErrorMetadata;
  readonly severity?: ErrorSeverity;
  readonly retryable?: boolean;
  readonly maxRetries?: number;
  readonly retryStrategy?: RetryStrategy;
  readonly parentErrorId?: string;
  readonly userImpact?: UserImpactLevel;
}

/**
 * Error classification result interface
 */
export interface ErrorClassification {
  readonly type: ErrorType;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly userImpact: UserImpactLevel;
  readonly autoRetry: boolean;
  readonly requiresUserNotification: boolean;
  readonly requiresEscalation: boolean;
  readonly estimatedResolutionTime?: number; // minutes
}

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  readonly maxRetries: number;
  readonly retryDelay: number; // milliseconds
  readonly backoffMultiplier: number;
  readonly strategy: RetryStrategy;
  readonly fallbackActions: readonly string[];
  readonly escalationThreshold: number; // minutes
  readonly timeoutMs?: number;
}

/**
 * Error creation utility class
 */
export class ErrorFactory {
  /**
   * Create a new error instance with ULID
   */
  static createError(input: ErrorInput): BaseError {
    const now = new Date();
    const context: BaseErrorContext = {
      ...input.context,
      timestamp: now
    };

    return {
      id: ulid(),
      type: input.type,
      category: ErrorFactory.getCategoryForType(input.type),
      severity: input.severity ?? ErrorFactory.getDefaultSeverity(input.type),
      status: ErrorStatus.NEW,
      message: input.message,
      userMessage: input.userMessage,
      errorCode: input.errorCode,
      stackTrace: input.stackTrace,
      context,
      metadata: input.metadata,
      timestamp: now,
      retryable: input.retryable ?? ErrorFactory.isRetryableByDefault(input.type),
      retryAttempt: 0,
      maxRetries: input.maxRetries ?? 3,
      retryStrategy: input.retryStrategy,
      parentErrorId: input.parentErrorId,
      rootCauseErrorId: input.parentErrorId, // Initially same as parent
      userImpact: input.userImpact ?? ErrorFactory.getDefaultUserImpact(input.type),
      estimatedImpact: undefined
    };
  }

  /**
   * Get error category for error type
   */
  private static getCategoryForType(type: ErrorType): ErrorCategory {
    switch (type) {
      case ErrorType.TOOL_EXECUTION:
      case ErrorType.DATABASE_ERROR:
        return ErrorCategory.INTERNAL;

      case ErrorType.API_FAILURE:
      case ErrorType.NETWORK_ERROR:
      case ErrorType.EXTERNAL_SERVICE_ERROR:
      case ErrorType.RATE_LIMIT_ERROR:
        return ErrorCategory.EXTERNAL;

      case ErrorType.PERMISSION_DENIED:
      case ErrorType.AUTHENTICATION_ERROR:
      case ErrorType.VALIDATION_ERROR:
        return ErrorCategory.USER_ACTION;

      case ErrorType.WORKSPACE_CONNECTION:
        return ErrorCategory.SYSTEM;

      default:
        return ErrorCategory.SYSTEM;
    }
  }

  /**
   * Get default severity for error type
   */
  private static getDefaultSeverity(type: ErrorType): ErrorSeverity {
    switch (type) {
      case ErrorType.DATABASE_ERROR:
      case ErrorType.AUTHENTICATION_ERROR:
        return ErrorSeverity.CRITICAL;

      case ErrorType.TOOL_EXECUTION:
      case ErrorType.WORKSPACE_CONNECTION:
      case ErrorType.API_FAILURE:
        return ErrorSeverity.HIGH;

      case ErrorType.PERMISSION_DENIED:
      case ErrorType.RATE_LIMIT_ERROR:
        return ErrorSeverity.MEDIUM;

      case ErrorType.VALIDATION_ERROR:
      case ErrorType.NETWORK_ERROR:
        return ErrorSeverity.LOW;

      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Check if error type is retryable by default
   */
  private static isRetryableByDefault(type: ErrorType): boolean {
    switch (type) {
      case ErrorType.NETWORK_ERROR:
      case ErrorType.API_FAILURE:
      case ErrorType.RATE_LIMIT_ERROR:
      case ErrorType.EXTERNAL_SERVICE_ERROR:
      case ErrorType.WORKSPACE_CONNECTION:
        return true;

      case ErrorType.AUTHENTICATION_ERROR:
      case ErrorType.PERMISSION_DENIED:
      case ErrorType.VALIDATION_ERROR:
        return false;

      case ErrorType.TOOL_EXECUTION:
      case ErrorType.DATABASE_ERROR:
        return true; // May succeed on retry

      default:
        return false;
    }
  }

  /**
   * Get default user impact for error type
   */
  private static getDefaultUserImpact(type: ErrorType): UserImpactLevel {
    switch (type) {
      case ErrorType.DATABASE_ERROR:
      case ErrorType.AUTHENTICATION_ERROR:
        return UserImpactLevel.CRITICAL;

      case ErrorType.TOOL_EXECUTION:
      case ErrorType.WORKSPACE_CONNECTION:
        return UserImpactLevel.HIGH;

      case ErrorType.API_FAILURE:
      case ErrorType.PERMISSION_DENIED:
        return UserImpactLevel.MEDIUM;

      case ErrorType.VALIDATION_ERROR:
      case ErrorType.RATE_LIMIT_ERROR:
      case ErrorType.NETWORK_ERROR:
        return UserImpactLevel.LOW;

      default:
        return UserImpactLevel.MEDIUM;
    }
  }

  /**
   * Create a tool execution error
   */
  static createToolExecutionError(input: Omit<ErrorInput, 'type'>): BaseError {
    return ErrorFactory.createError({
      ...input,
      type: ErrorType.TOOL_EXECUTION
    });
  }

  /**
   * Create a workspace permission error
   */
  static createWorkspacePermissionError(input: Omit<ErrorInput, 'type'>): BaseError {
    return ErrorFactory.createError({
      ...input,
      type: ErrorType.PERMISSION_DENIED
    });
  }

  /**
   * Create an API failure error
   */
  static createApiFailureError(input: Omit<ErrorInput, 'type'>): BaseError {
    return ErrorFactory.createError({
      ...input,
      type: ErrorType.API_FAILURE
    });
  }

  /**
   * Create a network error
   */
  static createNetworkError(input: Omit<ErrorInput, 'type'>): BaseError {
    return ErrorFactory.createError({
      ...input,
      type: ErrorType.NETWORK_ERROR
    });
  }
}

/**
 * Type guard utilities
 */
export class ErrorTypeGuards {
  static isRetryableError(error: BaseError): boolean {
    return error.retryable && error.retryAttempt < error.maxRetries;
  }

  static isEscalationRequired(error: BaseError, thresholdMinutes: number = 30): boolean {
    const elapsedMinutes = (Date.now() - error.timestamp.getTime()) / (1000 * 60);
    return error.severity === ErrorSeverity.CRITICAL ||
      error.severity === ErrorSeverity.EMERGENCY ||
      elapsedMinutes > thresholdMinutes;
  }

  static isFinalStatus(status: ErrorStatus): boolean {
    return status === ErrorStatus.RESOLVED ||
      status === ErrorStatus.IGNORED ||
      status === ErrorStatus.FAILED_PERMANENTLY;
  }

  static requiresUserNotification(error: BaseError): boolean {
    return error.userImpact !== UserImpactLevel.NONE &&
      error.severity !== ErrorSeverity.LOW;
  }
} 