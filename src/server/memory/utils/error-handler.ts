/**
 * Error handling utilities for memory system
 */
import { MemoryError, MemoryErrorCode } from '../config';

/**
 * Creates a standardized memory error
 * @param error Original error to wrap
 * @param operation The operation that was being performed
 * @returns Standardized MemoryError
 */
export function handleMemoryError(error: unknown, operation: string): MemoryError {
  // If error is already a MemoryError, just return it
  if (error instanceof MemoryError) {
    return error;
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Map certain error patterns to specific error codes
    if (error.message.includes('not found') || error.message.includes('404')) {
      return new MemoryError(
        `Memory not found during ${operation}: ${error.message}`,
        MemoryErrorCode.NOT_FOUND,
        error
      );
    }
    
    if (error.message.includes('validation') || error.message.includes('schema')) {
      return new MemoryError(
        `Validation error during ${operation}: ${error.message}`,
        MemoryErrorCode.VALIDATION_ERROR,
        error
      );
    }
    
    if (error.message.includes('connection') || 
        error.message.includes('timeout') || 
        error.message.includes('connect')) {
      return new MemoryError(
        `Database connection error during ${operation}: ${error.message}`,
        MemoryErrorCode.DATABASE_ERROR,
        error
      );
    }
    
    if (error.message.includes('embedding')) {
      return new MemoryError(
        `Embedding error during ${operation}: ${error.message}`,
        MemoryErrorCode.EMBEDDING_ERROR,
        error
      );
    }
    
    // Generic error handling
    return new MemoryError(
      `Error during ${operation}: ${error.message}`,
      MemoryErrorCode.OPERATION_ERROR,
      error
    );
  }
  
  // Handle unknown error types (not Error instances)
  const errorMessage = typeof error === 'string' 
    ? error 
    : (error ? JSON.stringify(error) : 'Unknown error');
  
  return new MemoryError(
    `Unknown error during ${operation}: ${errorMessage}`,
    MemoryErrorCode.OPERATION_ERROR
  );
}

/**
 * Creates a standardized not found error
 * @param id ID of the memory that was not found
 * @param type Optional memory type
 * @returns MemoryError with NOT_FOUND code
 */
export function createNotFoundError(id: string, type?: string): MemoryError {
  const typeInfo = type ? ` of type "${type}"` : '';
  return new MemoryError(
    `Memory with ID "${id}"${typeInfo} not found`,
    MemoryErrorCode.NOT_FOUND
  );
}

/**
 * Creates a standardized validation error
 * @param message Validation error message
 * @param fields Optional fields that failed validation
 * @returns MemoryError with VALIDATION_ERROR code
 */
export function createValidationError(
  message: string, 
  fields?: Record<string, string>
): MemoryError {
  const fieldsInfo = fields ? ` Fields: ${JSON.stringify(fields)}` : '';
  return new MemoryError(
    `${message}${fieldsInfo}`,
    MemoryErrorCode.VALIDATION_ERROR
  );
}

/**
 * Throws if condition is not met
 * @param condition Condition to check
 * @param errorCode Error code to use if condition fails
 * @param message Error message to use if condition fails
 * @throws MemoryError if condition is not met
 */
export function assert(
  condition: any, 
  errorCode: MemoryErrorCode, 
  message: string
): void {
  if (!condition) {
    throw new MemoryError(message, errorCode);
  }
} 