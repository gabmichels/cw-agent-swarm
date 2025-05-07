/**
 * Error handling utilities
 */
import { AppError, Result, successResult, failureResult } from './base';
import { ValidationError } from './types';

/**
 * Converts any error to an AppError
 */
export function convertToAppError(
  error: unknown,
  context: Record<string, unknown> = {}
): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    return error.withContext(context);
  }
  
  // Node.js built-in errors
  if (error instanceof TypeError) {
    return new AppError(
      error.message,
      'TYPE_ERROR',
      { ...context, stack: error.stack }
    );
  }
  
  if (error instanceof RangeError) {
    return new AppError(
      error.message,
      'RANGE_ERROR',
      { ...context, stack: error.stack }
    );
  }
  
  if (error instanceof SyntaxError) {
    return new AppError(
      error.message,
      'SYNTAX_ERROR',
      { ...context, stack: error.stack }
    );
  }
  
  // Standard Error
  if (error instanceof Error) {
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      { 
        ...context,
        stack: error.stack, 
        originalError: error.name,
        // Capture cause if available
        cause: (error as Error & { cause?: unknown }).cause
      }
    );
  }
  
  // Unknown type
  const errorMessage = typeof error === 'string' 
    ? error 
    : 'Unknown error occurred';
  
  return new AppError(
    errorMessage,
    'UNKNOWN_ERROR',
    { ...context, originalError: error }
  );
}

/**
 * Logs an error with appropriate severity
 */
export async function logError(error: AppError): Promise<void> {
  // Determine log level based on error type/code
  let level: 'error' | 'warn' | 'info' = 'error';
  
  // Validation errors are warnings
  if (error instanceof ValidationError) {
    level = 'warn';
  }
  
  // Not found errors are info
  if (error.code.includes('NOT_FOUND')) {
    level = 'info';
  }
  
  // Log the error with appropriate level
  const logData = {
    ...error.toJSON(),
    level
  };
  
  // Use structured logging
  console[level](JSON.stringify(logData, null, 2));
  
  // Additional logging to external systems can be added here
}

/**
 * Handles errors from synchronous operations
 */
export function handleSyncError<T>(
  operation: () => T,
  errorContext: Record<string, unknown> = {}
): Result<T> {
  try {
    const result = operation();
    return successResult(result);
  } catch (error) {
    const appError = convertToAppError(error, errorContext);
    logError(appError);
    
    return failureResult(appError);
  }
}

/**
 * Handles errors from asynchronous operations
 */
export async function handleAsyncError<T>(
  operation: () => Promise<T>,
  errorContext: Record<string, unknown> = {}
): Promise<Result<T>> {
  try {
    const result = await operation();
    return successResult(result);
  } catch (error) {
    const appError = convertToAppError(error, errorContext);
    await logError(appError);
    
    return failureResult(appError);
  }
}

/**
 * Higher-order function that adds error handling to any function
 */
export function withErrorBoundary<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  errorContext: Record<string, unknown> = {}
): (...args: Args) => Promise<Result<T>> {
  return async (...args: Args): Promise<Result<T>> => {
    try {
      const result = await fn(...args);
      return successResult(result);
    } catch (error) {
      const appError = convertToAppError(error, {
        ...errorContext,
        functionName: fn.name,
        args: args.map(arg => 
          typeof arg === 'object' 
            ? (arg === null ? 'null' : JSON.stringify(arg).substring(0, 1000)) 
            : String(arg)
        )
      });
      
      await logError(appError);
      
      return failureResult(appError);
    }
  };
}

/**
 * Converts an error to an HTTP response
 */
export function errorToHttpResponse(error: unknown): {
  statusCode: number;
  body: {
    error: {
      message: string;
      code: string;
      stack?: string;
      context?: Record<string, unknown>;
    }
  };
} {
  // Convert to AppError if needed
  const appError = error instanceof AppError 
    ? error 
    : convertToAppError(error);
  
  // Determine status code
  let statusCode = 500;
  
  if (appError instanceof ValidationError) {
    statusCode = 400;
  } else if (appError.code.includes('NOT_FOUND')) {
    statusCode = 404;
  } else if (appError.code.includes('UNAUTHORIZED')) {
    statusCode = 401;
  } else if (appError.code.includes('FORBIDDEN')) {
    statusCode = 403;
  } else if (appError.code.includes('RATE_LIMITED')) {
    statusCode = 429;
  }
  
  // Create response body
  const body = {
    error: {
      message: appError.message,
      code: appError.code,
      // Only include full details in development
      ...(process.env.NODE_ENV !== 'production' && {
        stack: appError.stack,
        context: appError.context
      })
    }
  };
  
  return { statusCode, body };
} 