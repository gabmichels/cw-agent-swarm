import { 
  CustomError, 
  MemoryError, 
  ApiError, 
  ApiErrorCodes,
  handleError,
  withErrorHandling,
  tryExec,
  createNotFoundError,
  createValidationError 
} from './index';

/**
 * Example of handling errors with specific error types
 */
async function fetchUserData(userId: string) {
  try {
    // Simulating an API call that might fail
    const response = await fetch(`/api/users/${userId}`);
    
    if (!response.ok) {
      // Using ApiError for HTTP-related errors
      throw ApiError.fromResponse(response, undefined, `Failed to fetch user ${userId}`);
    }
    
    return await response.json();
  } catch (error) {
    // Using the error handler to process the error
    handleError(error instanceof Error ? error : new Error(String(error)));
    
    // Rethrow to allow caller to handle it
    throw error;
  }
}

/**
 * Example of using withErrorHandling wrapper
 */
const safeFetchUserData = withErrorHandling(fetchUserData);

/**
 * Example of using error types for specific scenarios
 */
function getUserMemory(userId: string, memoryId: string) {
  // Validation example
  if (!userId) {
    throw createValidationError('User ID is required', {
      userId: 'User ID must be provided'
    });
  }
  
  // Not found example
  const userExists = false; // Just for example
  if (!userExists) {
    throw createNotFoundError('User', userId);
  }
  
  try {
    // Memory-related operation that might fail
    throw new Error('Memory system is offline');
  } catch (error) {
    // Wrap in a domain-specific error
    throw MemoryError.retrievalFailed(
      `Failed to retrieve memory ${memoryId} for user ${userId}`,
      { userId, memoryId },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Example of using tryExec for operations where we want a fallback value
 */
function getUserPreference(userId: string, key: string, defaultValue: string): string {
  return tryExec(
    () => {
      // Simulate getting preferences that might fail
      if (Math.random() > 0.5) {
        throw new Error('Failed to get preference');
      }
      return 'actual-value';
    },
    { defaultValue }
  ) as string; // We know the type is always string due to defaultValue
}

/**
 * Example of handling different error types
 */
async function handleUserRequest(userId: string) {
  try {
    const userData = await safeFetchUserData(userId);
    return userData;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === ApiErrorCodes.NOT_FOUND) {
        console.log('User not found, creating new user profile');
        // Handle not found specific way
      } else if (error.code === ApiErrorCodes.UNAUTHORIZED) {
        console.log('Authentication required');
        // Redirect to login
      } else {
        console.log('API error occurred:', error.message);
      }
    } else if (error instanceof MemoryError) {
      console.log('Memory system error:', error.message);
      // Maybe try alternative storage
    } else if (error instanceof CustomError) {
      console.log('Application error:', error.code, error.message);
    } else {
      console.log('Unknown error:', error);
    }
    
    // Return fallback data or rethrow as needed
    return { id: userId, name: 'Unknown User', isPlaceholder: true };
  }
}

/**
 * Example of creating custom error subclass for a specific domain
 */
class PaymentError extends CustomError {
  amount: number;
  
  constructor(message: string, amount: number, details?: Record<string, any>, originalError?: Error) {
    super(message, 'PAYMENT_ERROR', details, originalError);
    Object.setPrototypeOf(this, PaymentError.prototype);
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

// Export for demonstration
export {
  fetchUserData,
  safeFetchUserData,
  getUserMemory,
  getUserPreference,
  handleUserRequest,
  PaymentError
}; 