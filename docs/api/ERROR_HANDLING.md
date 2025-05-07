# Error Handling Framework

## Overview

The error handling framework provides a comprehensive approach to managing errors across the system. It standardizes error types, provides consistent error propagation patterns, and includes utilities for centralized error handling.

## Key Components

### Error Types

The framework includes a hierarchy of error types that extend from a base `AppError` class:

```typescript
// Base error for all application errors
AppError
  ├── MemoryError      // Memory-related errors
  ├── ToolError        // Tool/agent execution errors
  ├── ApiError         // API-related errors
  ├── InfrastructureError // Infrastructure errors
  └── ValidationError  // Validation errors
```

Each error type includes:
- A descriptive message
- A unique error code
- Contextual information for debugging
- Timestamp information
- Stack trace

### Error Codes

The framework includes predefined error codes for each domain:

- **Memory Error Codes**: `NOT_FOUND`, `INVALID_TYPE`, `DUPLICATE`, etc.
- **Tool Error Codes**: `EXECUTION_FAILED`, `TIMEOUT`, `INVALID_INPUT`, etc.
- **API Error Codes**: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, etc.
- **Infrastructure Error Codes**: `DATABASE_ERROR`, `NETWORK_ERROR`, etc.

### Result Type Pattern

The framework uses a `Result<T>` type to represent the outcome of operations that may fail:

```typescript
interface Result<T> {
  success: boolean;
  data?: T;
  error?: AppError;
}
```

This allows functions to return either successful data or error information in a type-safe way.

## Usage Examples

### Creating and Using Error Types

```typescript
// Creating a domain-specific error
import { MemoryError, MemoryErrorCode } from 'src/lib/errors';

const error = new MemoryError(
  'Document not found',
  MemoryErrorCode.NOT_FOUND,
  { documentId: '123' }
);

// Add additional context to an error
const errorWithContext = error.withContext({ userId: '456' });
```

### Using the Result Pattern

```typescript
import { handleAsyncError } from 'src/lib/errors';

async function getUserById(userId: string) {
  return handleAsyncError(async () => {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 'USER_NOT_FOUND', { userId });
    }
    return user;
  });
}

// Using the function
const result = await getUserById('123');
if (result.success) {
  console.log('User found:', result.data);
} else {
  console.error('Error fetching user:', result.error.message);
}
```

### Error Boundaries

```typescript
import { withErrorBoundary } from 'src/lib/errors';

// Create a function with built-in error handling
const getDocumentSafely = withErrorBoundary(
  async (documentId: string) => {
    const document = await documentService.getById(documentId);
    if (!document) {
      throw new MemoryError(
        'Document not found', 
        MemoryErrorCode.NOT_FOUND, 
        { documentId }
      );
    }
    return document;
  },
  { component: 'DocumentController' }
);

// Using the function
const result = await getDocumentSafely('doc-123');
if (result.success) {
  // Handle success case
} else {
  // Handle error case
}
```

### HTTP Error Handling

```typescript
import { errorToHttpResponse } from 'src/lib/errors';

app.get('/api/users/:id', async (req, res) => {
  const result = await userService.getUserById(req.params.id);
  
  if (result.success) {
    return res.status(200).json(result.data);
  }
  
  // Convert error to HTTP response
  const { statusCode, body } = errorToHttpResponse(result.error);
  return res.status(statusCode).json(body);
});
```

### Validation

```typescript
import { ValidationError, ValidationFailure } from 'src/lib/errors';

function validateUser(userData: unknown): User {
  const failures: ValidationFailure[] = [];
  
  // Validate required fields
  if (!userData || typeof userData !== 'object') {
    throw new ValidationError('User data must be an object', [
      { field: 'userData', message: 'Must be an object' }
    ]);
  }
  
  const { name, email } = userData as any;
  
  if (!name || typeof name !== 'string') {
    failures.push({ 
      field: 'name', 
      message: 'Name is required and must be a string',
      received: typeof name
    });
  }
  
  if (!email || typeof email !== 'string') {
    failures.push({ 
      field: 'email', 
      message: 'Email is required and must be a string',
      received: typeof email
    });
  }
  
  if (failures.length > 0) {
    throw new ValidationError('User validation failed', failures);
  }
  
  return userData as User;
}
```

## Best Practices

1. **Use Domain-Specific Error Types**: Choose the most specific error type for your scenario
2. **Include Detailed Context**: Add relevant context information to errors for debugging
3. **Use the Result Pattern**: Return `Result<T>` from functions that can fail
4. **Apply Error Boundaries**: Use `withErrorBoundary` for functions that interact with external systems
5. **Consistent HTTP Responses**: Use `errorToHttpResponse` to generate standardized HTTP error responses
6. **Descriptive Error Messages**: Provide clear, actionable error messages
7. **Standardized Error Codes**: Use predefined error codes for easier categorization and handling

## Error Logging

All errors are automatically logged with appropriate severity levels:
- Validation errors → WARN level
- Not found errors → INFO level
- All other errors → ERROR level

The logged error includes:
- Error name and message
- Error code
- Stack trace
- Contextual information
- Timestamp

## Integration with Other Systems

The error handling framework integrates with:

1. **HTTP API Layer**: Through the `errorToHttpResponse` utility
2. **Logging System**: Via the `logError` function
3. **Validation System**: Through the `ValidationError` type and associated utilities
4. **Service Layer**: Via the `Result<T>` pattern and error handling functions 