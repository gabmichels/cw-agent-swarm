/**
 * AgentErrors.ts - Custom error types for agent processing flow
 * 
 * This file contains error classes specific to agent operations, extending the base CustomError.
 */

import { CustomError, StandardErrorCodes } from '../../../lib/errors/CustomError';

// Agent-specific error codes
export const AgentErrorCodes = {
  // Thinking process errors
  THINKING_FAILED: 'THINKING_FAILED',
  INTENT_ANALYSIS_FAILED: 'INTENT_ANALYSIS_FAILED',
  MEMORY_CONTEXT_FAILED: 'MEMORY_CONTEXT_FAILED',
  
  // LLM response errors
  LLM_RESPONSE_FAILED: 'LLM_RESPONSE_FAILED',
  TOKEN_LIMIT_EXCEEDED: 'TOKEN_LIMIT_EXCEEDED',
  CONTENT_FILTER_BLOCKED: 'CONTENT_FILTER_BLOCKED',
  
  // Processing errors
  AGENT_NOT_INITIALIZED: 'AGENT_NOT_INITIALIZED',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Tool execution errors
  TOOL_EXECUTION_ERROR: 'TOOL_EXECUTION_ERROR',
  TOOL_TIMEOUT: 'TOOL_TIMEOUT',
  
  // Delegation errors
  DELEGATION_FAILED: 'DELEGATION_FAILED',
  DELEGATION_TIMEOUT: 'DELEGATION_TIMEOUT',
  
  // Vision processing errors
  VISION_PROCESSING_FAILED: 'VISION_PROCESSING_FAILED',
  IMAGE_PROCESSING_FAILED: 'IMAGE_PROCESSING_FAILED'
} as const;

/**
 * Base error class for all agent-related errors
 */
export class AgentError extends CustomError {
  constructor(
    message: string,
    code: string = StandardErrorCodes.UNKNOWN_ERROR,
    details?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, details, originalError);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, AgentError.prototype);
    
    this.name = this.constructor.name;
  }
}

/**
 * Error during agent's thinking process
 */
export class ThinkingError extends AgentError {
  constructor(
    message: string,
    code: string = AgentErrorCodes.THINKING_FAILED,
    details?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, details, originalError);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, ThinkingError.prototype);
  }
}

/**
 * Error during LLM response generation
 */
export class LLMResponseError extends AgentError {
  constructor(
    message: string,
    code: string = AgentErrorCodes.LLM_RESPONSE_FAILED,
    details?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, details, originalError);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, LLMResponseError.prototype);
  }
}

/**
 * Error in the overall processing of user input
 */
export class ProcessingError extends AgentError {
  constructor(
    message: string,
    code: string = AgentErrorCodes.PROCESSING_FAILED,
    details?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, details, originalError);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, ProcessingError.prototype);
  }
}

/**
 * Error when dealing with vision or image processing
 */
export class VisionProcessingError extends AgentError {
  constructor(
    message: string,
    code: string = AgentErrorCodes.VISION_PROCESSING_FAILED,
    details?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, details, originalError);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, VisionProcessingError.prototype);
  }
}

/**
 * Error when delegating to another agent
 */
export class DelegationError extends AgentError {
  constructor(
    message: string,
    code: string = AgentErrorCodes.DELEGATION_FAILED,
    details?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, details, originalError);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, DelegationError.prototype);
  }
}

/**
 * Error when agent is not properly initialized
 */
export class AgentInitializationError extends AgentError {
  constructor(
    message: string,
    details?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, AgentErrorCodes.AGENT_NOT_INITIALIZED, details, originalError);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, AgentInitializationError.prototype);
  }
} 