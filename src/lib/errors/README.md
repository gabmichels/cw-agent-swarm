# Error Handling System

This directory contains a comprehensive error handling system for the application. It provides standardized error types, error creation utilities, and error handling mechanisms.

## Overview

The error system is designed with these key goals:

- **Standardized Error Format**: All errors follow a consistent structure with error codes, details, and metadata
- **Domain-Specific Error Types**: Custom error classes for different domains (API, Memory, etc.)
- **Consistent Error Handling**: Utilities for catching, logging, and responding to errors
- **Type Safety**: Full TypeScript support for all error types and utilities
- **Contextual Information**: Errors capture important context like timestamps and call stacks

## Core Components

### Base Error Types

- `CustomError`: The base error class that all application errors extend
- `StandardErrorCodes`: Common error codes that are used throughout the application

### Domain-Specific Error Types

- `ApiError`: For API-related errors, with HTTP status code mapping
- `MemoryError`: For memory system errors (retrieval, storage, etc.)

### Error Handling Utilities

- `handleError`: Process errors with logging and optional callbacks
- `createErrorHandler`: Create a customized error handler
- `withErrorHandling`: HOF to wrap functions with error handling
- `tryExec`: Execute a function with error handling and a fallback value

### Error Creation Helpers

- `createNotFoundError`: Create standardized "not found" errors
- `createValidationError`: Create standardized validation errors
- `createUnauthorizedError`: Create standardized auth errors
- `createForbiddenError`: Create standardized permission errors

## Usage Examples

### Basic Error Handling

```typescript
import { handleError } from '../lib/errors';

try {
  // Some operation that might fail
  const result = await riskyOperation();
  return result;
} catch (error) {
  // Will log the error and provide consistent handling
  handleError(error);
  throw error; // Re-throw if needed
}
```

### Using WithErrorHandling

```typescript
import { withErrorHandling } from '../lib/errors';

// Original function
async function fetchData(id: string) {
  // Implementation...
}

// Wrapped with error handling
const safeFetchData = withErrorHandling(fetchData);

// Using the wrapped function
try {
  const data = await safeFetchData('123');
} catch (error) {
  // Error has already been processed by the handler
}
```

### Creating Domain-Specific Errors

```typescript
import { MemoryError } from '../lib/errors';

try {
  // Trying to fetch memory
  const memory = await memorySystem.fetch(id);
  return memory;
} catch (error) {
  // Wrap the original error with domain context
  throw MemoryError.retrievalFailed(
    `Failed to retrieve memory ${id}`,
    { id, userId },
    error
  );
}
```

### Creating Custom Error Types

```typescript
import { CustomError } from '../lib/errors';

class PaymentError extends CustomError {
  amount: number;
  
  constructor(message: string, amount: number, details?: Record<string, any>, originalError?: Error) {
    super(message, 'PAYMENT_ERROR', details, originalError);
    this.name = 'PaymentError';
    this.amount = amount;
  }
  
  static insufficientFunds(amount: number, availableBalance: number): PaymentError {
    return new PaymentError(
      `Insufficient funds for payment of ${amount}`,
      amount,
      { availableBalance, shortfall: amount - availableBalance }
    );
  }
}
```

## Error Handling Best Practices

1. **Use Specific Error Types**: Always use the most specific error type available for the error you're handling
2. **Include Contextual Details**: Pass relevant context data in the error's details object
3. **Preserve Original Errors**: When wrapping errors, always include the original error
4. **Consistent Error Codes**: Use standard error codes from `StandardErrorCodes` whenever possible
5. **Descriptive Messages**: Write clear error messages that explain what happened and why
6. **Selective Re-throwing**: Only re-throw errors when the caller needs to handle them
7. **Fallback Values**: Use `tryExec` with fallback values for non-critical operations

## Integration with Other Systems

The error handling system can integrate with:

- **Logging Systems**: Errors are formatted for easy logging
- **Monitoring Tools**: Error details can be sent to monitoring services
- **API Responses**: API errors map to HTTP status codes
- **UI Error Boundaries**: Frontend can interpret error codes for user messages
- **Internationalization**: Error messages can be translated using error codes

See `example.ts` for more comprehensive usage examples. 