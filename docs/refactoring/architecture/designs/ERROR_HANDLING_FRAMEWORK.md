# Error Handling Framework Design

## Overview

This document outlines the design for a comprehensive error handling framework that will be implemented across the system. The framework will provide standardized error types, consistent error propagation patterns, and centralized error handling utilities.

## Current Issues

1. **Inconsistent Error Handling**: Different parts of the codebase handle errors in different ways
2. **Poor Error Context**: Errors often lack sufficient context to diagnose issues
3. **Ambiguous Error Types**: Unclear error hierarchies make error handling unpredictable
4. **Lack of Internationalization**: Error messages are not designed for internationalization
5. **Insufficient Logging**: Error logging is inconsistent and often missing key details

## Design Goals

1. **Consistent Error Types**: Create a clear hierarchy of error types
2. **Rich Error Context**: Ensure errors include sufficient context for debugging
3. **Standardized Propagation**: Define clear patterns for error propagation
4. **Centralized Handling**: Provide utilities for common error handling scenarios
5. **Improved Logging**: Integrate errors with the logging system
6. **Internationalization Support**: Design for future message translation

## Error Hierarchy

### Base Error Types

```typescript
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
  
  /**
   * Stack trace
   */
  public readonly stack: string;
  
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
```

### Domain-Specific Error Types

```typescript
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
```

### Error Codes

```typescript
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
```

## Error Handling Patterns

### For Synchronous Operations

```typescript
/**
 * Handles errors from synchronous operations
 */
export function handleSyncError<T>(
  operation: () => T,
  errorContext: Record<string, unknown> = {}
): Result<T> {
  try {
    const result = operation();
    return {
      success: true,
      data: result
    };
  } catch (error) {
    const appError = convertToAppError(error, errorContext);
    logError(appError);
    
    return {
      success: false,
      error: appError
    };
  }
}
```

### For Asynchronous Operations

```typescript
/**
 * Handles errors from asynchronous operations
 */
export async function handleAsyncError<T>(
  operation: () => Promise<T>,
  errorContext: Record<string, unknown> = {}
): Promise<Result<T>> {
  try {
    const result = await operation();
    return {
      success: true,
      data: result
    };
  } catch (error) {
    const appError = convertToAppError(error, errorContext);
    await logError(appError);
    
    return {
      success: false,
      error: appError
    };
  }
}
```

## Result Type Pattern

### Generic Result Interface

```typescript
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
```

### Creating Results

```typescript
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
```

## Error Conversion Utilities

```typescript
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
      { ...context, stack: error.stack, originalError: error.name }
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
```

## Logging Integration

```typescript
/**
 * Logs an error with appropriate severity
 */
export async function logError(error: AppError): Promise<void> {
  // Determine log level based on error type/code
  let level = 'error';
  
  // Validation errors are warnings
  if (error instanceof ValidationError) {
    level = 'warn';
  }
  
  // Not found errors are info
  if (error.code.includes('NOT_FOUND')) {
    level = 'info';
  }
  
  // Log the error
  const logData = {
    ...error.toJSON(),
    level
  };
  
  // Use structured logging
  console[level](JSON.stringify(logData));
  
  // Additional logging to external systems can be added here
}
```

## HTTP Error Handling

```typescript
/**
 * Converts an error to an HTTP response
 */
export function errorToHttpResponse(error: unknown): {
  statusCode: number;
  body: Record<string, unknown>;
} {
  // Convert to AppError if needed
  const appError = error instanceof AppError 
    ? error 
    : convertToAppError(error);
  
  // Determine status code
  let statusCode = 500;
  
  if (appError instanceof ApiError) {
    statusCode = appError.statusCode;
  } else if (appError instanceof ValidationError) {
    statusCode = 400;
  } else if (appError.code.includes('NOT_FOUND')) {
    statusCode = 404;
  } else if (appError.code.includes('UNAUTHORIZED')) {
    statusCode = 401;
  } else if (appError.code.includes('FORBIDDEN')) {
    statusCode = 403;
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
```

## Error Boundary Pattern

```typescript
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
      return {
        success: true,
        data: result
      };
    } catch (error) {
      const appError = convertToAppError(error, {
        ...errorContext,
        functionName: fn.name,
        args: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        )
      });
      
      await logError(appError);
      
      return {
        success: false,
        error: appError
      };
    }
  };
}
```

## Validation Error Handling

```typescript
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
 * Validates data against a schema and throws ValidationError if invalid
 */
export function validateOrThrow<T>(
  data: unknown,
  schema: Schema,
  errorMessage = 'Validation failed'
): asserts data is T {
  const result = validateSchema(schema, data);
  
  if (!result.valid) {
    throw new ValidationError(
      errorMessage,
      result.failures || [],
      { schema: schema.name || 'unknown' }
    );
  }
}
```

## Implementation Plan

1. **Create Error Base Classes**: Implement the base error hierarchy
2. **Define Error Codes**: Create enums for all error codes
3. **Implement Result Type**: Create the result interface and helper functions
4. **Build Conversion Utilities**: Create functions to standardize error conversion
5. **Integrate with Logging**: Connect error handling to the logging system
6. **Create Error Boundaries**: Implement higher-order error handling functions
7. **HTTP Integration**: Add utilities for HTTP error responses
8. **Documentation**: Create comprehensive documentation for the framework

## Usage Examples

### Service Layer Example

```typescript
class UserService {
  async createUser(userData: UserData): Promise<Result<User>> {
    return handleAsyncError(async () => {
      // Validate input
      validateOrThrow<UserData>(userData, userSchema, 'Invalid user data');
      
      // Create user
      const user = await this.userRepository.create(userData);
      
      // Send verification email
      await this.emailService.sendVerificationEmail(user.email);
      
      return user;
    }, { operation: 'createUser' });
  }
}
```

### API Layer Example

```typescript
app.post('/api/users', async (req, res) => {
  const result = await userService.createUser(req.body);
  
  if (result.success) {
    return res.status(201).json(result.data);
  }
  
  const { statusCode, body } = errorToHttpResponse(result.error);
  return res.status(statusCode).json(body);
});
```

### Using Error Boundary Pattern

```typescript
// Create a function with error handling
const getUserDetails = withErrorBoundary(
  async (userId: string): Promise<UserDetails> => {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 'USER_NOT_FOUND', { userId });
    }
    return mapToUserDetails(user);
  },
  { component: 'UserController' }
);

// Use the function
const result = await getUserDetails('user-123');
if (result.success) {
  console.log('User details:', result.data);
} else {
  console.error('Error:', result.error.message);
}
```

## Testing Strategy

1. **Unit Testing**: Test each error class and utility function
2. **Integration Testing**: Verify error propagation through layers
3. **Boundary Testing**: Test error handling at system boundaries
4. **Logging Verification**: Ensure errors are properly logged
5. **HTTP Response Testing**: Verify correct HTTP status codes and bodies

## Conclusion

This error handling framework provides a comprehensive approach to managing errors across the system. By standardizing error types, propagation patterns, and handling utilities, we can ensure consistent, informative, and maintainable error handling throughout the application. 