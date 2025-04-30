/**
 * Shared error handling utilities to ensure type safety
 * This file provides standardized error handling patterns to eliminate 'any' types
 */

import { logger } from '../core/logger';

/**
 * Safely extracts error message from unknown error type
 * @param error The unknown error object
 * @returns A string representation of the error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Safely extracts error stack from unknown error type
 * @param error The unknown error object
 * @returns The error stack trace or undefined if not available
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Formats an error for logging
 * @param error The unknown error object
 * @returns A formatted error object with message and optional stack
 */
export function formatError(error: unknown): { message: string; stack?: string } {
  return {
    message: getErrorMessage(error),
    stack: getErrorStack(error)
  };
}

/**
 * Safely logs an error with proper formatting
 * @param context Description of where the error occurred
 * @param error The unknown error object
 */
export function logError(context: string, error: unknown): void {
  const { message, stack } = formatError(error);
  logger.error(`${context}: ${message}`);
  if (stack) {
    logger.debug(stack);
  }
}

/**
 * Type-safe try-catch wrapper for async functions
 * @param fn The async function to execute
 * @param errorHandler Optional custom error handler
 * @returns A promise that resolves to the function result or rejects with properly typed error
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    if (errorHandler) {
      errorHandler(error);
    } else {
      logError('Error in async operation', error);
    }
    throw error;
  }
}

/**
 * Type guard to check if an object is an Error instance
 * @param error The unknown object to check
 * @returns True if the object is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Standard catch block handler for API routes
 * @param error The unknown error object
 * @param context Description of where the error occurred
 * @returns An object with error details for consistent API responses
 */
export function handleApiError(error: unknown, context: string): {
  error: string;
  details?: string;
  status: number;
} {
  logError(`API Error (${context})`, error);
  
  // Default error response
  const response: {
    error: string;
    details?: string;
    status: number;
  } = {
    error: getErrorMessage(error),
    status: 500
  };
  
  // Add more specific handling for known error types
  if (isError(error)) {
    // Check for custom error properties
    const anyError = error as any;
    if (anyError.statusCode) {
      response.status = anyError.statusCode;
    }
    
    // Add details for non-production environments
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      response.details = error.stack;
    }
  }
  
  return response;
} 