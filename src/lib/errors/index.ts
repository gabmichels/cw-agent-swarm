/**
 * Error handling framework
 * 
 * This module provides a comprehensive error handling framework for the application.
 * It includes standardized error types, error handling utilities, and error boundary patterns.
 */

// Re-export all items from base module
export * from './base';

// Re-export all items from types module 
export * from './types';

// Re-export all items from utils module
export * from './utils';

// Import AppError for assertion functions
import { AppError } from './base';

/**
 * Utility function to assert that a value is not undefined or null
 * @param value Value to check
 * @param message Error message if value is undefined or null
 * @param errorCode Custom error code
 * @param context Additional error context
 */
export function assertDefined<T>(
  value: T | null | undefined, 
  message = 'Value is required but was not provided', 
  errorCode = 'ASSERTION_ERROR',
  context: Record<string, unknown> = {}
): asserts value is T {
  if (value === null || value === undefined) {
    throw new AppError(message, errorCode, context);
  }
}

/**
 * Utility function to assert that a condition is true
 * @param condition Condition to check
 * @param message Error message if condition is false
 * @param errorCode Custom error code
 * @param context Additional error context
 */
export function assert(
  condition: boolean,
  message = 'Assertion failed',
  errorCode = 'ASSERTION_ERROR',
  context: Record<string, unknown> = {}
): asserts condition {
  if (!condition) {
    throw new AppError(message, errorCode, context);
  }
}

/**
 * Error system for the application
 * Provides standardized error handling, logging, and reporting
 */

// Import for use in this file
import { CustomError, StandardErrorCodes } from './CustomError';
import { MemoryError } from './MemoryError';
import { ApiError } from './ApiError';
import { handleError } from './errorHandler';

// Base error types
export { CustomError, StandardErrorCodes, type ErrorCode } from './CustomError';

// Error handling utilities
export { 
  createErrorHandler, 
  withErrorHandling,
  tryExec, 
  handleError,
  type ErrorHandlerOptions
} from './errorHandler';

// Specialized error types
export { MemoryError } from './MemoryError';
export { ApiError, ApiErrorCodes, type ApiErrorCode, type ApiErrorDetails } from './ApiError';

// Common error creation helpers
export function createNotFoundError(
  entity: string, 
  id: string | number, 
  details?: Record<string, any>
) {
  return new CustomError(
    `${entity} not found with ID: ${id}`,
    StandardErrorCodes.NOT_FOUND,
    details
  );
}

export function createValidationError(
  message: string,
  validationErrors: Record<string, string> = {},
  details?: Record<string, any>
) {
  return new CustomError(
    message,
    StandardErrorCodes.VALIDATION_ERROR,
    {
      ...details,
      validationErrors
    }
  );
}

export function createUnauthorizedError(
  message: string = 'Unauthorized', 
  details?: Record<string, any>
) {
  return new CustomError(
    message,
    StandardErrorCodes.UNAUTHORIZED,
    details
  );
}

export function createForbiddenError(
  message: string = 'Forbidden', 
  details?: Record<string, any>
) {
  return new CustomError(
    message,
    StandardErrorCodes.FORBIDDEN,
    details
  );
}

// Error checking utilities
export function isNotFoundError(error: unknown): boolean {
  return error instanceof CustomError && error.code === StandardErrorCodes.NOT_FOUND;
}

export function isValidationError(error: unknown): boolean {
  return error instanceof CustomError && error.code === StandardErrorCodes.VALIDATION_ERROR;
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof CustomError && error.code === StandardErrorCodes.UNAUTHORIZED;
}

export function isForbiddenError(error: unknown): boolean {
  return error instanceof CustomError && error.code === StandardErrorCodes.FORBIDDEN;
}

export function isMemoryError(error: unknown): boolean {
  return error instanceof MemoryError;
}

export function isApiError(error: unknown): boolean {
  return error instanceof ApiError;
}

// Default error handler
export default handleError; 