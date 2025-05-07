/**
 * Base error classes for the application error handling framework
 */

/**
 * Base error class for all application errors
 */
export class AppError extends Error {
  /**
   * Unique error code
   */
  public readonly code: string;
  
  /**
   * Additional context information
   */
  public readonly context: Record<string, unknown>;
  
  /**
   * Error timestamp
   */
  public readonly timestamp: Date;
  
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    
    // Ensure proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
  
  /**
   * Clone error with additional context
   */
  withContext(additionalContext: Record<string, unknown>): AppError {
    return new AppError(
      this.message,
      this.code,
      {
        ...this.context,
        ...additionalContext
      }
    );
  }
}

/**
 * Represents a validation failure
 */
export interface ValidationFailure {
  /**
   * The field that failed validation
   */
  field: string;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Optional validation rule that failed
   */
  rule?: string;
  
  /**
   * Optional expected value or format
   */
  expected?: string;
  
  /**
   * Optional received value
   */
  received?: string;
}

/**
 * Generic result interface for operations that may fail
 */
export interface Result<T> {
  /**
   * Whether the operation succeeded
   */
  success: boolean;
  
  /**
   * The operation's result data (present if success is true)
   */
  data?: T;
  
  /**
   * Error information (present if success is false)
   */
  error?: AppError;
}

/**
 * Creates a successful result
 */
export function successResult<T>(data: T): Result<T> {
  return {
    success: true,
    data
  };
}

/**
 * Creates a failure result
 */
export function failureResult<T>(error: AppError): Result<T> {
  return {
    success: false,
    error
  };
} 