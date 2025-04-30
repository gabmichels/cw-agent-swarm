import { CustomError, StandardErrorCodes } from './CustomError';

/**
 * Specialized error class for memory-related errors
 */
export class MemoryError extends CustomError {
  /**
   * Create a new memory error
   * @param message Error message
   * @param code Error code (defaults to MEMORY_RETRIEVAL_FAILED)
   * @param details Additional details about the error
   * @param originalError Underlying error that caused this error
   */
  constructor(
    message: string,
    code: string = StandardErrorCodes.MEMORY_RETRIEVAL_FAILED,
    details?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, details, originalError);
    Object.setPrototypeOf(this, MemoryError.prototype);
    this.name = 'MemoryError';
  }

  /**
   * Create an error for memory initialization failures
   */
  static initFailed(message: string, details?: Record<string, any>, originalError?: Error): MemoryError {
    return new MemoryError(
      message || 'Failed to initialize memory system',
      StandardErrorCodes.MEMORY_INIT_FAILED,
      details,
      originalError
    );
  }

  /**
   * Create an error for memory retrieval failures
   */
  static retrievalFailed(message: string, details?: Record<string, any>, originalError?: Error): MemoryError {
    return new MemoryError(
      message || 'Failed to retrieve memory',
      StandardErrorCodes.MEMORY_RETRIEVAL_FAILED,
      details,
      originalError
    );
  }

  /**
   * Create an error for memory storage failures
   */
  static storageFailed(message: string, details?: Record<string, any>, originalError?: Error): MemoryError {
    return new MemoryError(
      message || 'Failed to store memory',
      StandardErrorCodes.MEMORY_STORAGE_FAILED,
      details,
      originalError
    );
  }

  /**
   * Create an error for exceeding memory capacity
   */
  static capacityExceeded(message: string, details?: Record<string, any>): MemoryError {
    return new MemoryError(
      message || 'Memory capacity exceeded',
      'MEMORY_CAPACITY_EXCEEDED',
      details
    );
  }

  /**
   * Create an error for invalid memory operations
   */
  static invalidOperation(message: string, details?: Record<string, any>): MemoryError {
    return new MemoryError(
      message || 'Invalid memory operation',
      'MEMORY_INVALID_OPERATION',
      details
    );
  }
} 