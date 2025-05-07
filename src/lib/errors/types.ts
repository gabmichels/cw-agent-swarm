/**
 * Domain-specific error types and error codes
 */
import { AppError, ValidationFailure } from './base';

/**
 * Memory error codes
 */
export enum MemoryErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  INVALID_TYPE = 'INVALID_TYPE',
  DUPLICATE = 'DUPLICATE',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Tool error codes
 */
export enum ToolErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_DEPENDENCY = 'MISSING_DEPENDENCY',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN = 'UNKNOWN'
}

/**
 * API error codes
 */
export enum ApiErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

/**
 * Infrastructure error codes
 */
export enum InfrastructureErrorCode {
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Memory-related errors
 */
export class MemoryError extends AppError {
  constructor(
    message: string,
    code: MemoryErrorCode,
    context: Record<string, unknown> = {}
  ) {
    super(message, `MEMORY_${code}`, context);
    this.name = 'MemoryError';
  }
}

/**
 * Tool/agent execution errors
 */
export class ToolError extends AppError {
  constructor(
    message: string,
    code: ToolErrorCode,
    context: Record<string, unknown> = {}
  ) {
    super(message, `TOOL_${code}`, context);
    this.name = 'ToolError';
  }
}

/**
 * API-related errors
 */
export class ApiError extends AppError {
  /**
   * HTTP status code
   */
  public readonly statusCode: number;
  
  constructor(
    message: string,
    code: ApiErrorCode,
    statusCode: number,
    context: Record<string, unknown> = {}
  ) {
    super(message, `API_${code}`, context);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Infrastructure errors (database, external services)
 */
export class InfrastructureError extends AppError {
  constructor(
    message: string,
    code: InfrastructureErrorCode,
    context: Record<string, unknown> = {}
  ) {
    super(message, `INFRA_${code}`, context);
    this.name = 'InfrastructureError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  /**
   * Validation failures
   */
  public readonly failures: ValidationFailure[];
  
  constructor(
    message: string,
    failures: ValidationFailure[] = [],
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      { ...context, failures }
    );
    this.name = 'ValidationError';
    this.failures = failures;
  }
} 