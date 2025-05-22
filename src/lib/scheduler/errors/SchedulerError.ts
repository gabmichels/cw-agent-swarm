/**
 * SchedulerError.ts - Base Scheduler Error
 * 
 * This file defines the base error class for the scheduler system.
 */

/**
 * Base class for all scheduler-related errors
 */
export class SchedulerError extends Error {
  /**
   * Error code
   */
  public readonly code: string;
  
  /**
   * Error context information
   */
  public readonly context: Record<string, unknown>;
  
  /**
   * Create a new SchedulerError
   * 
   * @param message - Error message
   * @param code - Error code
   * @param context - Additional context information
   */
  constructor(
    message: string,
    code: string = 'SCHEDULER_ERROR',
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'SchedulerError';
    this.code = code;
    this.context = context;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Get a string representation of the error including context
   * 
   * @returns String representation of the error
   */
  toString(): string {
    return `${this.name} [${this.code}]: ${this.message}${
      Object.keys(this.context).length > 0
        ? `\nContext: ${JSON.stringify(this.context, null, 2)}`
        : ''
    }`;
  }
} 