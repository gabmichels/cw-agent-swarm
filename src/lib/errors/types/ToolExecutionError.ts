/**
 * Tool Execution Error Implementation
 * 
 * Specialized error type for tool execution failures
 * Following IMPLEMENTATION_GUIDELINES.md patterns
 */

import {
  BaseError,
  BaseErrorContext,
  ErrorMetadata,
  ErrorSeverity,
  ErrorType,
  RetryStrategy,
  UserImpactLevel
} from './BaseError';

/**
 * Tool execution specific context
 */
export interface ToolExecutionContext extends BaseErrorContext {
  readonly toolId: string;
  readonly toolName?: string;
  readonly operation: string;
  readonly parameters?: Record<string, unknown>;
  readonly executionStartTime?: Date;
  readonly executionDuration?: number; // milliseconds
  readonly toolVersion?: string;
  readonly registryId?: string;
}

/**
 * Tool execution error metadata
 */
export interface ToolExecutionMetadata extends ErrorMetadata {
  readonly toolRegistered: boolean;
  readonly permissionsGranted: boolean;
  readonly inputValidated: boolean;
  readonly timeoutOccurred: boolean;
  readonly resourcesAvailable: boolean;
  readonly dependenciesMet: boolean;
  readonly fallbackAvailable: boolean;
  readonly previousSuccessCount: number;
  readonly previousFailureCount: number;
  readonly lastSuccessAt?: string; // ISO string
}

/**
 * Tool execution specific error codes
 */
export enum ToolExecutionErrorCode {
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_NOT_REGISTERED = 'TOOL_NOT_REGISTERED',
  PERMISSIONS_INSUFFICIENT = 'PERMISSIONS_INSUFFICIENT',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  EXECUTION_TIMEOUT = 'EXECUTION_TIMEOUT',
  RESOURCE_UNAVAILABLE = 'RESOURCE_UNAVAILABLE',
  DEPENDENCY_FAILURE = 'DEPENDENCY_FAILURE',
  EXECUTOR_FAILURE = 'EXECUTOR_FAILURE',
  FALLBACK_FAILED = 'FALLBACK_FAILED',
  OUTPUT_VALIDATION_FAILED = 'OUTPUT_VALIDATION_FAILED'
}

/**
 * Tool execution error interface
 */
export interface ToolExecutionError extends BaseError {
  readonly type: ErrorType.TOOL_EXECUTION;
  readonly context: ToolExecutionContext;
  readonly metadata: ToolExecutionMetadata;
  readonly errorCode: ToolExecutionErrorCode;
}

/**
 * Tool execution error input
 */
export interface ToolExecutionErrorInput {
  readonly toolId: string;
  readonly toolName?: string;
  readonly operation: string;
  readonly message: string;
  readonly userMessage?: string;
  readonly errorCode: ToolExecutionErrorCode;
  readonly stackTrace?: string;
  readonly parameters?: Record<string, unknown>;
  readonly context: Partial<BaseErrorContext>;
  readonly metadata?: Partial<ToolExecutionMetadata>;
  readonly severity?: ErrorSeverity;
  readonly userImpact?: UserImpactLevel;
  readonly executionStartTime?: Date;
  readonly executionDuration?: number;
}

/**
 * Factory for creating tool execution errors
 */
export class ToolExecutionErrorFactory {
  /**
   * Create a tool execution error
   */
  static create(input: ToolExecutionErrorInput): ToolExecutionError {
    const now = new Date();

    const context: ToolExecutionContext = {
      ...input.context,
      toolId: input.toolId,
      toolName: input.toolName,
      operation: input.operation,
      parameters: input.parameters,
      executionStartTime: input.executionStartTime,
      executionDuration: input.executionDuration,
      timestamp: now
    };

    const metadata: ToolExecutionMetadata = {
      toolRegistered: true,
      permissionsGranted: true,
      inputValidated: true,
      timeoutOccurred: false,
      resourcesAvailable: true,
      dependenciesMet: true,
      fallbackAvailable: false,
      previousSuccessCount: 0,
      previousFailureCount: 0,
      ...input.metadata
    };

    return {
      id: require('ulid').ulid(),
      type: ErrorType.TOOL_EXECUTION,
      category: this.getCategoryForCode(input.errorCode),
      severity: input.severity ?? this.getSeverityForCode(input.errorCode),
      status: require('./BaseError').ErrorStatus.NEW,
      message: input.message,
      userMessage: input.userMessage ?? this.generateUserMessage(input.errorCode, input.toolName),
      errorCode: input.errorCode,
      stackTrace: input.stackTrace,
      context,
      metadata,
      timestamp: now,
      retryable: this.isRetryableCode(input.errorCode),
      retryAttempt: 0,
      maxRetries: this.getMaxRetriesForCode(input.errorCode),
      retryStrategy: this.getRetryStrategyForCode(input.errorCode),
      userImpact: input.userImpact ?? this.getUserImpactForCode(input.errorCode),
      parentErrorId: undefined,
      rootCauseErrorId: undefined,
      estimatedImpact: undefined
    };
  }

  /**
   * Get error category for error code
   */
  private static getCategoryForCode(code: ToolExecutionErrorCode): import('./BaseError').ErrorCategory {
    const { ErrorCategory } = require('./BaseError');

    switch (code) {
      case ToolExecutionErrorCode.TOOL_NOT_FOUND:
      case ToolExecutionErrorCode.TOOL_NOT_REGISTERED:
      case ToolExecutionErrorCode.EXECUTOR_FAILURE:
        return ErrorCategory.INTERNAL;

      case ToolExecutionErrorCode.PERMISSIONS_INSUFFICIENT:
      case ToolExecutionErrorCode.INVALID_PARAMETERS:
        return ErrorCategory.USER_ACTION;

      case ToolExecutionErrorCode.EXECUTION_TIMEOUT:
      case ToolExecutionErrorCode.RESOURCE_UNAVAILABLE:
      case ToolExecutionErrorCode.DEPENDENCY_FAILURE:
        return ErrorCategory.SYSTEM;

      case ToolExecutionErrorCode.FALLBACK_FAILED:
      case ToolExecutionErrorCode.OUTPUT_VALIDATION_FAILED:
        return ErrorCategory.EXTERNAL;

      default:
        return ErrorCategory.INTERNAL;
    }
  }

  /**
   * Get severity for error code
   */
  private static getSeverityForCode(code: ToolExecutionErrorCode): ErrorSeverity {
    switch (code) {
      case ToolExecutionErrorCode.EXECUTOR_FAILURE:
      case ToolExecutionErrorCode.FALLBACK_FAILED:
        return ErrorSeverity.CRITICAL;

      case ToolExecutionErrorCode.TOOL_NOT_FOUND:
      case ToolExecutionErrorCode.TOOL_NOT_REGISTERED:
      case ToolExecutionErrorCode.DEPENDENCY_FAILURE:
        return ErrorSeverity.HIGH;

      case ToolExecutionErrorCode.PERMISSIONS_INSUFFICIENT:
      case ToolExecutionErrorCode.EXECUTION_TIMEOUT:
      case ToolExecutionErrorCode.RESOURCE_UNAVAILABLE:
        return ErrorSeverity.MEDIUM;

      case ToolExecutionErrorCode.INVALID_PARAMETERS:
      case ToolExecutionErrorCode.OUTPUT_VALIDATION_FAILED:
        return ErrorSeverity.LOW;

      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Check if error code is retryable
   */
  private static isRetryableCode(code: ToolExecutionErrorCode): boolean {
    switch (code) {
      case ToolExecutionErrorCode.EXECUTION_TIMEOUT:
      case ToolExecutionErrorCode.RESOURCE_UNAVAILABLE:
      case ToolExecutionErrorCode.DEPENDENCY_FAILURE:
      case ToolExecutionErrorCode.EXECUTOR_FAILURE:
        return true;

      case ToolExecutionErrorCode.TOOL_NOT_FOUND:
      case ToolExecutionErrorCode.TOOL_NOT_REGISTERED:
      case ToolExecutionErrorCode.PERMISSIONS_INSUFFICIENT:
      case ToolExecutionErrorCode.INVALID_PARAMETERS:
      case ToolExecutionErrorCode.OUTPUT_VALIDATION_FAILED:
        return false;

      case ToolExecutionErrorCode.FALLBACK_FAILED:
        return false; // Already tried fallback

      default:
        return true;
    }
  }

  /**
   * Get max retries for error code
   */
  private static getMaxRetriesForCode(code: ToolExecutionErrorCode): number {
    switch (code) {
      case ToolExecutionErrorCode.EXECUTION_TIMEOUT:
      case ToolExecutionErrorCode.RESOURCE_UNAVAILABLE:
        return 3;

      case ToolExecutionErrorCode.DEPENDENCY_FAILURE:
      case ToolExecutionErrorCode.EXECUTOR_FAILURE:
        return 2;

      default:
        return 0; // Non-retryable or special cases
    }
  }

  /**
   * Get retry strategy for error code
   */
  private static getRetryStrategyForCode(code: ToolExecutionErrorCode): RetryStrategy {
    switch (code) {
      case ToolExecutionErrorCode.EXECUTION_TIMEOUT:
      case ToolExecutionErrorCode.RESOURCE_UNAVAILABLE:
        return RetryStrategy.EXPONENTIAL_BACKOFF;

      case ToolExecutionErrorCode.DEPENDENCY_FAILURE:
        return RetryStrategy.LINEAR;

      case ToolExecutionErrorCode.EXECUTOR_FAILURE:
        return RetryStrategy.IMMEDIATE;

      default:
        return RetryStrategy.NO_RETRY;
    }
  }

  /**
   * Get user impact for error code
   */
  private static getUserImpactForCode(code: ToolExecutionErrorCode): UserImpactLevel {
    switch (code) {
      case ToolExecutionErrorCode.EXECUTOR_FAILURE:
      case ToolExecutionErrorCode.FALLBACK_FAILED:
        return UserImpactLevel.CRITICAL;

      case ToolExecutionErrorCode.TOOL_NOT_FOUND:
      case ToolExecutionErrorCode.TOOL_NOT_REGISTERED:
      case ToolExecutionErrorCode.DEPENDENCY_FAILURE:
        return UserImpactLevel.HIGH;

      case ToolExecutionErrorCode.PERMISSIONS_INSUFFICIENT:
      case ToolExecutionErrorCode.EXECUTION_TIMEOUT:
      case ToolExecutionErrorCode.RESOURCE_UNAVAILABLE:
        return UserImpactLevel.MEDIUM;

      case ToolExecutionErrorCode.INVALID_PARAMETERS:
      case ToolExecutionErrorCode.OUTPUT_VALIDATION_FAILED:
        return UserImpactLevel.LOW;

      default:
        return UserImpactLevel.MEDIUM;
    }
  }

  /**
   * Generate user-friendly message for error code
   */
  private static generateUserMessage(code: ToolExecutionErrorCode, toolName?: string): string {
    const tool = toolName ? `the ${toolName} tool` : 'the requested tool';

    switch (code) {
      case ToolExecutionErrorCode.TOOL_NOT_FOUND:
        return `I couldn't find ${tool}. This might be a configuration issue.`;

      case ToolExecutionErrorCode.TOOL_NOT_REGISTERED:
        return `${tool} isn't properly registered in the system. Please contact support.`;

      case ToolExecutionErrorCode.PERMISSIONS_INSUFFICIENT:
        return `I don't have permission to use ${tool}. You may need to grant additional permissions.`;

      case ToolExecutionErrorCode.INVALID_PARAMETERS:
        return `The parameters provided to ${tool} were invalid. Please check your request.`;

      case ToolExecutionErrorCode.EXECUTION_TIMEOUT:
        return `${tool} took too long to respond. I'll try again.`;

      case ToolExecutionErrorCode.RESOURCE_UNAVAILABLE:
        return `The resources needed for ${tool} are currently unavailable. Retrying...`;

      case ToolExecutionErrorCode.DEPENDENCY_FAILURE:
        return `A service that ${tool} depends on is having issues. I'm attempting to retry.`;

      case ToolExecutionErrorCode.EXECUTOR_FAILURE:
        return `There was an internal error executing ${tool}. I'm working to resolve this.`;

      case ToolExecutionErrorCode.FALLBACK_FAILED:
        return `Both the primary method and backup for ${tool} failed. This issue requires manual attention.`;

      case ToolExecutionErrorCode.OUTPUT_VALIDATION_FAILED:
        return `${tool} returned invalid results. This might indicate a temporary issue.`;

      default:
        return `An error occurred while using ${tool}. I'm investigating the issue.`;
    }
  }
}

/**
 * Type guards for tool execution errors
 */
export class ToolExecutionErrorGuards {
  static isToolExecutionError(error: BaseError): error is ToolExecutionError {
    return error.type === ErrorType.TOOL_EXECUTION;
  }

  static isPermissionError(error: ToolExecutionError): boolean {
    return error.errorCode === ToolExecutionErrorCode.PERMISSIONS_INSUFFICIENT;
  }

  static isTimeoutError(error: ToolExecutionError): boolean {
    return error.errorCode === ToolExecutionErrorCode.EXECUTION_TIMEOUT;
  }

  static isResourceError(error: ToolExecutionError): boolean {
    return error.errorCode === ToolExecutionErrorCode.RESOURCE_UNAVAILABLE;
  }

  static requiresImmediateRetry(error: ToolExecutionError): boolean {
    return error.errorCode === ToolExecutionErrorCode.EXECUTOR_FAILURE &&
      error.retryAttempt < error.maxRetries;
  }
} 