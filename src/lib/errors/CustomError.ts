/**
 * Base error class for all custom errors in the application
 * Provides consistent error structure with codes and optional details
 */

export type ErrorCode = string;

export const StandardErrorCodes = {
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TIMEOUT: 'TIMEOUT',
  
  // Memory-related errors
  MEMORY_INIT_FAILED: 'MEMORY_INIT_FAILED',
  MEMORY_RETRIEVAL_FAILED: 'MEMORY_RETRIEVAL_FAILED',
  MEMORY_STORAGE_FAILED: 'MEMORY_STORAGE_FAILED',
  
  // Tool-related errors
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  
  // Planning-related errors
  PLANNING_FAILED: 'PLANNING_FAILED',
  
  // API-related errors
  API_ERROR: 'API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  
  // Initialization errors
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED'
} as const;

export class CustomError extends Error {
  code: ErrorCode;
  details?: Record<string, any>;
  originalError?: Error;
  timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode = StandardErrorCodes.UNKNOWN_ERROR,
    details?: Record<string, any>,
    originalError?: Error
  ) {
    super(message);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, CustomError.prototype);
    
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.originalError = originalError;
    this.timestamp = new Date();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Gets a structured representation of the error
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack,
      timestamp: this.timestamp.toISOString(),
      originalError: this.originalError ? 
        (this.originalError instanceof CustomError ? 
          this.originalError.toJSON() : 
          {
            message: this.originalError.message,
            stack: this.originalError.stack
          }
        ) : undefined
    };
  }
  
  /**
   * Format error for logging
   */
  toString(): string {
    return `[${this.code}] ${this.name}: ${this.message}`;
  }
} 