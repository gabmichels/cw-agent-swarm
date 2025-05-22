/**
 * Agent Bootstrap Errors
 * 
 * This module defines custom error types for agent initialization failures
 * to provide better error handling and reporting.
 */

/**
 * Base class for all agent bootstrap errors
 */
export class AgentBootstrapError extends Error {
  public readonly agentId: string;
  public readonly errorCode: string;
  public readonly timestamp: Date;
  public readonly metadata: Record<string, any>;
  
  constructor(
    message: string,
    agentId: string,
    errorCode: string,
    metadata: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'AgentBootstrapError';
    this.agentId = agentId;
    this.errorCode = errorCode;
    this.timestamp = new Date();
    this.metadata = metadata;
    
    // Maintain proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Convert error to a structured object for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      agentId: this.agentId,
      errorCode: this.errorCode,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata,
      stack: this.stack
    };
  }
}

/**
 * Error thrown when agent validation fails
 */
export class AgentValidationError extends AgentBootstrapError {
  public readonly validationErrors: string[];
  
  constructor(
    message: string,
    agentId: string,
    validationErrors: string[],
    metadata: Record<string, any> = {}
  ) {
    super(message, agentId, 'VALIDATION_ERROR', metadata);
    this.name = 'AgentValidationError';
    this.validationErrors = validationErrors;
  }
  
  override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors
    };
  }
}

/**
 * Error thrown when there's a conflict during initialization
 */
export class AgentInitializationConflictError extends AgentBootstrapError {
  public readonly conflictReason: string;
  
  constructor(
    message: string,
    agentId: string,
    conflictReason: string,
    metadata: Record<string, any> = {}
  ) {
    super(message, agentId, 'INITIALIZATION_CONFLICT', metadata);
    this.name = 'AgentInitializationConflictError';
    this.conflictReason = conflictReason;
  }
  
  override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      conflictReason: this.conflictReason
    };
  }
}

/**
 * Error thrown when initialization times out
 */
export class AgentInitializationTimeoutError extends AgentBootstrapError {
  public readonly timeoutMs: number;
  
  constructor(
    message: string,
    agentId: string,
    timeoutMs: number,
    metadata: Record<string, any> = {}
  ) {
    super(message, agentId, 'INITIALIZATION_TIMEOUT', metadata);
    this.name = 'AgentInitializationTimeoutError';
    this.timeoutMs = timeoutMs;
  }
  
  override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      timeoutMs: this.timeoutMs
    };
  }
}

/**
 * Error thrown when a required manager fails to initialize
 */
export class ManagerInitializationError extends AgentBootstrapError {
  public readonly managerId: string;
  public readonly managerType: string;
  
  constructor(
    message: string,
    agentId: string,
    managerId: string,
    managerType: string,
    metadata: Record<string, any> = {}
  ) {
    super(message, agentId, 'MANAGER_INITIALIZATION_ERROR', metadata);
    this.name = 'ManagerInitializationError';
    this.managerId = managerId;
    this.managerType = managerType;
  }
  
  override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      managerId: this.managerId,
      managerType: this.managerType
    };
  }
}

/**
 * Error thrown when initialization retry limit is reached
 */
export class AgentInitializationRetryLimitError extends AgentBootstrapError {
  public readonly maxRetries: number;
  public readonly attempts: number;
  public readonly lastAttemptError?: Error;
  
  constructor(
    message: string,
    agentId: string,
    maxRetries: number,
    attempts: number,
    lastAttemptError?: Error,
    metadata: Record<string, any> = {}
  ) {
    super(message, agentId, 'RETRY_LIMIT_EXCEEDED', metadata);
    this.name = 'AgentInitializationRetryLimitError';
    this.maxRetries = maxRetries;
    this.attempts = attempts;
    this.lastAttemptError = lastAttemptError;
  }
  
  override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      maxRetries: this.maxRetries,
      attempts: this.attempts,
      lastAttemptError: this.lastAttemptError ? {
        message: this.lastAttemptError.message,
        stack: this.lastAttemptError.stack
      } : undefined
    };
  }
}

/**
 * Factory function to create appropriate error type from generic error
 */
export function createAgentBootstrapError(
  error: Error,
  agentId: string,
  metadata: Record<string, any> = {}
): AgentBootstrapError {
  // Return original error if it's already an AgentBootstrapError
  if (error instanceof AgentBootstrapError) {
    return error;
  }
  
  // Create generic bootstrap error
  return new AgentBootstrapError(
    error.message,
    agentId,
    'UNKNOWN_ERROR',
    {
      originalError: error.name,
      originalStack: error.stack,
      ...metadata
    }
  );
} 