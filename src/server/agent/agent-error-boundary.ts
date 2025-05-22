/**
 * Agent Error Boundary
 * 
 * This module provides error boundary mechanisms for agent operations, allowing
 * for safe execution of agent code with proper error handling and recovery.
 */

import { AgentBase } from '../../agents/shared/base/AgentBase.interface';
import { logger } from '../../lib/logging';
import { AgentBootstrapError, createAgentBootstrapError } from './agent-bootstrap-errors';
import { agentBootstrapRegistry, AgentBootstrapState } from './agent-bootstrap-registry';
import { v4 as uuidv4 } from 'uuid';

/**
 * Type for a function that can be wrapped in an error boundary
 */
export type ErrorBoundaryFunction<T> = () => Promise<T>;

/**
 * Result of an operation executed within an error boundary
 */
export interface ErrorBoundaryResult<T> {
  success: boolean;
  value?: T;
  error?: AgentBootstrapError;
  operationId: string;
  timings: {
    startTime: Date;
    endTime: Date;
    durationMs: number;
  };
  metadata: Record<string, any>;
}

/**
 * Options for executing a function within an error boundary
 */
export interface ErrorBoundaryOptions {
  operationName: string;
  agentId: string;
  timeoutMs?: number;
  metadata?: Record<string, any>;
  onError?: (error: AgentBootstrapError) => Promise<void>;
  retryOnError?: boolean;
}

/**
 * Execute a function within an error boundary that safely handles errors
 * 
 * @param fn The function to execute
 * @param options Error boundary options
 * @returns Promise resolving to the result of the operation
 */
export async function executeWithErrorBoundary<T>(
  fn: ErrorBoundaryFunction<T>,
  options: ErrorBoundaryOptions
): Promise<ErrorBoundaryResult<T>> {
  const {
    operationName,
    agentId,
    timeoutMs = 30000,
    metadata = {},
    onError,
    retryOnError = false
  } = options;
  
  const operationId = uuidv4();
  const startTime = new Date();
  
  logger.info(`Starting operation "${operationName}" for agent ${agentId}`, {
    operationId,
    agentId,
    operationName,
    startTime: startTime.toISOString(),
    metadata
  });
  
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation "${operationName}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    // Race between the actual operation and the timeout
    const result = await Promise.race([fn(), timeoutPromise]);
    
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    
    logger.info(`Successfully completed operation "${operationName}" for agent ${agentId}`, {
      operationId,
      agentId,
      operationName,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs,
      metadata
    });
    
    return {
      success: true,
      value: result,
      operationId,
      timings: {
        startTime,
        endTime,
        durationMs
      },
      metadata
    };
    
  } catch (error) {
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    
    // Convert to AgentBootstrapError if it isn't already
    const bootstrapError = error instanceof AgentBootstrapError
      ? error
      : createAgentBootstrapError(
          error instanceof Error ? error : new Error(String(error)),
          agentId,
          {
            operationId,
            operationName,
            durationMs,
            ...metadata
          }
        );
    
    logger.error(`Error in operation "${operationName}" for agent ${agentId}: ${bootstrapError.message}`, {
      error: bootstrapError,
      operationId,
      agentId,
      operationName,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs,
      metadata
    });
    
    // Call error handler if provided
    if (onError) {
      try {
        await onError(bootstrapError);
      } catch (handlerError) {
        logger.error(`Error in error handler for operation "${operationName}": ${String(handlerError)}`, {
          originalError: bootstrapError,
          handlerError,
          operationId,
          agentId
        });
      }
    }
    
    // If the agent is registered, update its bootstrap state
    if (agentId && agentBootstrapRegistry.isAgentRegistered(agentId)) {
      agentBootstrapRegistry.updateAgentBootstrapState(
        agentId,
        AgentBootstrapState.FAILED,
        bootstrapError
      );
    }
    
    return {
      success: false,
      error: bootstrapError,
      operationId,
      timings: {
        startTime,
        endTime,
        durationMs
      },
      metadata
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Safely initialize an agent with proper error handling
 * 
 * @param agent The agent to initialize
 * @param options Additional options for the initialization
 * @returns Promise resolving to the result of the initialization
 */
export async function safelyInitializeAgent(
  agent: AgentBase,
  options: Partial<Omit<ErrorBoundaryOptions, 'agentId'>> & { 
    fallbackOnError?: boolean 
  } = {}
): Promise<ErrorBoundaryResult<boolean>> {
  const agentId = agent.getAgentId();
  const { fallbackOnError = false, onError, ...boundaryOptions } = options;
  
  return executeWithErrorBoundary(
    async () => {
      const result = await agent.initialize();
      return result;
    },
    {
      operationName: 'agent_initialization',
      agentId,
      ...boundaryOptions,
      onError: async (error) => {
        logger.error(`Agent initialization failed for ${agentId}`, {
          error,
          agentId
        });
        
        // Call the original onError if provided
        if (onError) {
          await onError(error);
        }
        
        if (fallbackOnError) {
          logger.info(`Attempting to create fallback agent for ${agentId}`);
          // Logic to create a minimal fallback agent could be implemented here
        }
      }
    }
  );
}

/**
 * Safely execute an agent operation with proper error handling
 * 
 * @param agent The agent to use
 * @param operation The operation to execute
 * @param options Additional options for the operation
 * @returns Promise resolving to the result of the operation
 */
export async function safelyExecuteAgentOperation<T>(
  agent: AgentBase,
  operation: (agent: AgentBase) => Promise<T>,
  options: Partial<Omit<ErrorBoundaryOptions, 'agentId'>> = {}
): Promise<ErrorBoundaryResult<T>> {
  const agentId = agent.getAgentId();
  const { operationName = 'agent_operation', ...otherOptions } = options;
  
  return executeWithErrorBoundary(
    async () => {
      const result = await operation(agent);
      return result;
    },
    {
      operationName,
      agentId,
      ...otherOptions
    }
  );
} 