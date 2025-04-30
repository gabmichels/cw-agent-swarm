import { CustomError, StandardErrorCodes } from './CustomError';

/**
 * Options for configuring the error handler
 */
export interface ErrorHandlerOptions {
  /** Whether to log errors to the console */
  enableConsoleLogging?: boolean;
  /** Custom logging function */
  logger?: (error: Error | CustomError) => void;
  /** Error transformation function */
  errorTransformer?: (error: Error) => CustomError;
  /** Global error callback */
  onError?: (error: CustomError) => void;
  /** Whether to include stack traces in error responses */
  includeStackTrace?: boolean;
  /** Default value to return in case of error (for tryExec) */
  defaultValue?: any;
}

/**
 * Default error handler options
 */
const defaultOptions: ErrorHandlerOptions = {
  enableConsoleLogging: true,
  includeStackTrace: process.env.NODE_ENV !== 'production',
};

/**
 * Default error transformer
 */
const defaultErrorTransformer = (error: Error): CustomError => {
  if (error instanceof CustomError) {
    return error;
  }
  
  return new CustomError(
    error.message || 'An unknown error occurred',
    StandardErrorCodes.UNKNOWN_ERROR,
    {},
    error
  );
};

/**
 * Creates an error handler function configured with the provided options
 */
export function createErrorHandler(options: ErrorHandlerOptions = {}) {
  const mergedOptions: ErrorHandlerOptions = { ...defaultOptions, ...options };
  const { 
    enableConsoleLogging, 
    logger, 
    errorTransformer = defaultErrorTransformer,
    onError
  } = mergedOptions;

  /**
   * Handles an error by transforming, logging, and optionally calling a global handler
   */
  return function handleError(error: Error | CustomError): CustomError {
    // Transform the error to a CustomError if it isn't one already
    const customError = errorTransformer(error);
    
    // Log the error if enabled
    if (enableConsoleLogging) {
      console.error(`${customError.toString()}${customError.stack ? '\n' + customError.stack : ''}`);
    }
    
    // Use custom logger if provided
    if (logger) {
      logger(customError);
    }
    
    // Call global error handler if provided
    if (onError) {
      onError(customError);
    }
    
    return customError;
  };
}

/**
 * Default error handler instance with default options
 */
export const handleError = createErrorHandler();

/**
 * Creates a wrapper that catches errors and processes them with the error handler
 * 
 * @example
 * const safeFunction = withErrorHandling(async () => {
 *   // async function that might throw
 * });
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler: ReturnType<typeof createErrorHandler> = handleError
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async function(...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    try {
      return await fn(...args);
    } catch (error) {
      throw errorHandler(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

/**
 * Try to execute a function and handle any errors
 * 
 * @example
 * const result = tryExec(() => riskyOperation(), { defaultValue: 'fallback' });
 */
export function tryExec<T>(
  fn: () => T,
  options: ErrorHandlerOptions = {}
): T | undefined {
  const errorHandler = createErrorHandler(options);
  try {
    return fn();
  } catch (error) {
    errorHandler(error instanceof Error ? error : new Error(String(error)));
    return options.defaultValue;
  }
}

/**
 * Utility to create a standardized error for network requests
 */
export function createNetworkError(
  message: string,
  response?: Response,
  cause?: Error
): CustomError {
  const details: Record<string, any> = {};
  
  if (response) {
    details.status = response.status;
    details.statusText = response.statusText;
    details.url = response.url;
    
    try {
      // Try to get response headers
      response.headers.forEach((value, key) => {
        details.headers = details.headers || {};
        details.headers[key] = value;
      });
    } catch (e) {
      // Ignore header errors
    }
  }
  
  return new CustomError(
    message,
    StandardErrorCodes.NETWORK_ERROR,
    details,
    cause
  );
} 