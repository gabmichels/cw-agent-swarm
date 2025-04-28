import { CustomError, ErrorCode, StandardErrorCodes } from './CustomError';

/**
 * Memory-related errors
 */
export class MemoryError extends CustomError {
  constructor(
    message: string,
    code: ErrorCode = StandardErrorCodes.MEMORY_RETRIEVAL_FAILED,
    details?: Record<string, any>,
    cause?: Error
  ) {
    super(message, code, details, cause);
  }
}

/**
 * Planning-related errors
 */
export class PlanningError extends CustomError {
  constructor(
    message: string,
    code: ErrorCode = StandardErrorCodes.PLANNING_FAILED,
    details?: Record<string, any>,
    cause?: Error
  ) {
    super(message, code, details, cause);
  }
}

/**
 * Tool-related errors
 */
export class ToolError extends CustomError {
  constructor(
    message: string,
    code: ErrorCode = StandardErrorCodes.TOOL_EXECUTION_FAILED,
    details?: Record<string, any>,
    cause?: Error
  ) {
    super(message, code, details, cause);
  }
}

/**
 * Error for missing or not found resources
 */
export class NotFoundError extends CustomError {
  constructor(
    message: string,
    resourceType?: string,
    resourceId?: string,
    cause?: Error
  ) {
    super(
      message,
      StandardErrorCodes.NOT_FOUND,
      { resourceType, resourceId },
      cause
    );
  }
}

/**
 * Error for invalid input validation
 */
export class ValidationError extends CustomError {
  constructor(
    message: string,
    validationErrors?: Record<string, string[]>,
    cause?: Error
  ) {
    super(
      message,
      StandardErrorCodes.VALIDATION_ERROR,
      { validationErrors },
      cause
    );
  }
}

/**
 * Error for API-related failures
 */
export class ApiError extends CustomError {
  constructor(
    message: string,
    code: ErrorCode = StandardErrorCodes.API_ERROR,
    details?: Record<string, any>,
    cause?: Error
  ) {
    super(message, code, details, cause);
  }
}

/**
 * Error for authentication or authorization failures
 */
export class AuthError extends CustomError {
  constructor(
    message: string,
    details?: Record<string, any>,
    cause?: Error
  ) {
    super(
      message,
      StandardErrorCodes.FORBIDDEN,
      details,
      cause
    );
  }
}

/**
 * Error for initialization failures
 */
export class InitializationError extends CustomError {
  constructor(
    message: string,
    componentName: string,
    cause?: Error
  ) {
    super(
      message,
      StandardErrorCodes.INITIALIZATION_FAILED,
      { componentName },
      cause
    );
  }
}

/**
 * Error for timeout or performance issues
 */
export class TimeoutError extends CustomError {
  constructor(
    message: string,
    operationName: string,
    timeoutMs: number,
    cause?: Error
  ) {
    super(
      message,
      StandardErrorCodes.TIMEOUT,
      { operationName, timeoutMs },
      cause
    );
  }
} 