/**
 * Agent Bootstrap Utilities
 * 
 * This module provides utility functions for agent bootstrapping,
 * including retry logic, backoff strategy, and initialization helpers.
 */

import { AgentBase } from '../../agents/shared/base/AgentBase.interface';
import { AgentMemoryEntity, AgentStatus } from '../memory/schema/agent';
import { logger } from '../../lib/logging';
import { agentBootstrapRegistry, AgentBootstrapState } from './agent-bootstrap-registry';
import { v4 as uuidv4 } from 'uuid';

/**
 * Configuration for initialization retry
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000,    // 10 seconds
  backoffFactor: 2      // Exponential backoff
};

/**
 * Calculate delay for next retry attempt with exponential backoff
 */
export function calculateBackoffDelay(retryCount: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffFactor, retryCount);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for the specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Initialize an agent with retry logic and exponential backoff
 * 
 * @param agent The agent to initialize
 * @param config Retry configuration
 * @returns Promise resolving to initialization success
 */
export async function initializeAgentWithRetry(
  agent: AgentBase,
  config: Partial<RetryConfig> = {}
): Promise<boolean> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffFactor = 2
  } = config;
  
  const agentId = agent.getAgentId();
  let attempt = 0;
  let delayMs = initialDelayMs;
  
  // Update registry state
  agentBootstrapRegistry.updateAgentBootstrapState(agentId, AgentBootstrapState.IN_PROGRESS);
  
  while (attempt < maxAttempts) {
    attempt++;
    
    try {
      // Log initialization attempt
      logger.info(`Initializing agent ${agentId} (attempt ${attempt}/${maxAttempts})`, {
        agentId,
        attempt,
        maxAttempts
      });
      
      // Log initialization stage
      logAgentInitializationStage(agent, 'initialization_started', {
        attempt,
        maxAttempts,
        timestamp: new Date().toISOString()
      });
      
      // Attempt to initialize
      const success = await agent.initialize();
      
      if (success) {
        logger.info(`Successfully initialized agent ${agentId} on attempt ${attempt}/${maxAttempts}`, {
          agentId,
          attempt,
          maxAttempts
        });
        
        // Log successful initialization
        logAgentInitializationStage(agent, 'initialization_completed', {
          attempt,
          success: true,
          timestamp: new Date().toISOString()
        });
        
        return true;
      }
      
      logger.warn(`Agent ${agentId} initialization returned false on attempt ${attempt}/${maxAttempts}`, {
        agentId,
        attempt,
        maxAttempts
      });
      
      // Log failed initialization
      logAgentInitializationStage(agent, 'initialization_failed', {
        attempt,
        success: false,
        reason: 'Initialization returned false',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error(`Error initializing agent ${agentId} on attempt ${attempt}/${maxAttempts}: ${errorMessage}`, {
        agentId,
        attempt,
        maxAttempts,
        error
      });
      
      // Log initialization error
      logAgentInitializationStage(agent, 'initialization_error', {
        attempt,
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if we should retry
    if (attempt < maxAttempts) {
      logger.info(`Retrying agent ${agentId} initialization after ${delayMs}ms`, {
        agentId,
        attempt,
        maxAttempts,
        delayMs
      });
      
      // Log retry
      logAgentInitializationStage(agent, 'initialization_retry', {
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        timestamp: new Date().toISOString()
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      // Increase delay with exponential backoff, but cap at maxDelayMs
      delayMs = Math.min(delayMs * backoffFactor, maxDelayMs);
      
    } else {
      logger.error(`Failed to initialize agent ${agentId} after ${maxAttempts} attempts`, {
        agentId,
        attempts: maxAttempts
      });
      
      // Log final failure
      logAgentInitializationStage(agent, 'initialization_failed_final', {
        attempts: maxAttempts,
        success: false,
        timestamp: new Date().toISOString()
      });
      
      // Update registry with failure state
      agentBootstrapRegistry.updateAgentBootstrapState(
        agentId, 
        AgentBootstrapState.FAILED, 
        new Error(`Failed after ${maxAttempts} attempts`)
      );
    }
  }
  
  return false;
}

/**
 * Pre-validate agent before initialization to catch errors early
 * 
 * @param agentEntity The agent entity to validate
 * @returns Object with validation result and any errors
 */
export function validateAgentPreInitialization(
  agentEntity: AgentMemoryEntity
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate required fields
  if (!agentEntity.id) {
    errors.push('Agent ID is missing');
  }
  
  if (!agentEntity.name) {
    errors.push('Agent name is missing');
  }
  
  // Validate capabilities
  if (!agentEntity.capabilities || !Array.isArray(agentEntity.capabilities) || agentEntity.capabilities.length === 0) {
    errors.push('Agent must have at least one capability');
  }
  
  // Validate parameters
  if (!agentEntity.parameters) {
    errors.push('Agent parameters are missing');
  } else {
    // Validate required parameters
    if (!agentEntity.parameters.model) {
      errors.push('Agent parameter "model" is missing');
    }
    
    if (agentEntity.parameters.temperature === undefined) {
      errors.push('Agent parameter "temperature" is missing');
    } else if (agentEntity.parameters.temperature < 0 || agentEntity.parameters.temperature > 1) {
      errors.push('Agent parameter "temperature" must be between 0 and 1');
    }
    
    if (!agentEntity.parameters.maxTokens) {
      errors.push('Agent parameter "maxTokens" is missing');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate structured log data for agent initialization
 * 
 * @param agent The agent being initialized
 * @param additionalData Additional data to include in log
 * @returns Structured log data
 */
export function generateAgentInitLogData(agent: AgentBase, additionalData: Record<string, any> = {}): Record<string, any> {
  const agentId = agent.getAgentId();
  const agentName = agent.getName ? agent.getName() : 'Unknown';
  const agentType = agent.getType ? agent.getType() : 'Unknown';
  
  return {
    agentId,
    agentName,
    agentType,
    timestamp: new Date().toISOString(),
    requestId: uuidv4(),
    ...additionalData
  };
}

/**
 * Log a specific initialization stage with structured data
 * 
 * @param agent The agent being initialized
 * @param stage The initialization stage
 * @param data Additional data for the log
 */
export function logAgentInitializationStage(
  agent: AgentBase,
  stage: string,
  data: Record<string, any> = {}
): void {
  const agentId = agent.getAgentId();
  const agentName = agent.getName ? agent.getName() : 'Unknown';
  
  const logData = {
    agentId,
    agentName,
    stage,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  // Use the appropriate log level based on the stage
  if (stage.includes('error') || stage.includes('failed')) {
    logger.error(`Agent initialization stage [${stage}] for ${agentName} (${agentId})`, logData);
  } else if (stage.includes('retry') || stage.includes('warning')) {
    logger.warn(`Agent initialization stage [${stage}] for ${agentName} (${agentId})`, logData);
  } else if (stage.includes('completed') || stage.includes('success')) {
    logger.info(`Agent initialization stage [${stage}] for ${agentName} (${agentId})`, logData);
  } else {
    logger.debug(`Agent initialization stage [${stage}] for ${agentName} (${agentId})`, logData);
  }
  
  // Update the agent bootstrap registry with the current stage
  if (agentBootstrapRegistry.isAgentRegistered(agentId)) {
    const currentState = agentBootstrapRegistry.getAgentBootstrapInfo(agentId)?.state;
    
    // Update state based on stage
    if (stage === 'initialization_completed' && currentState !== AgentBootstrapState.COMPLETED) {
      agentBootstrapRegistry.updateAgentBootstrapState(agentId, AgentBootstrapState.COMPLETED);
    } else if (stage.includes('failed_final') && currentState !== AgentBootstrapState.FAILED) {
      agentBootstrapRegistry.updateAgentBootstrapState(agentId, AgentBootstrapState.FAILED);
    }
    
    // Store the stage in the agent's metadata
    agentBootstrapRegistry.updateAgentMetadata(agentId, {
      lastInitializationStage: stage,
      lastInitializationTimestamp: data.timestamp || new Date().toISOString()
    });
  }
}

/**
 * Record detailed initialization performance metrics
 * 
 * @param agent The agent being initialized
 * @param stage The initialization stage
 * @param metrics Performance metrics to record
 */
export function recordInitializationMetrics(
  agent: AgentBase,
  stage: string,
  metrics: {
    startTime?: Date;
    endTime?: Date;
    durationMs?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    [key: string]: any;
  }
): void {
  const agentId = agent.getAgentId();
  
  // Create structured metrics data
  const metricsData = {
    agentId,
    agentName: agent.getName ? agent.getName() : 'Unknown',
    stage,
    timestamp: new Date().toISOString(),
    ...metrics
  };
  
  // Log metrics at debug level
  logger.debug(`Agent initialization metrics for stage [${stage}]`, metricsData);
  
  // Store metrics in agent bootstrap registry
  if (agentBootstrapRegistry.isAgentRegistered(agentId)) {
    agentBootstrapRegistry.updateAgentMetadata(agentId, {
      [`metrics_${stage}`]: metricsData
    });
  }
}

/**
 * Handle post-initialization agent setup
 * 
 * @param agent The initialized agent
 */
export function handlePostInitialization(agent: AgentBase): void {
  const agentId = agent.getAgentId();
  
  // Log post-initialization
  logger.info(`Emitted 'initialized' event for agent ${agentId}`);
  
  // Release the initialization lock
  agentBootstrapRegistry.releaseLock(agentId);
  
  // Update the agent bootstrap state
  agentBootstrapRegistry.updateAgentBootstrapState(agentId, AgentBootstrapState.COMPLETED);
  
  // Emit initialized event
  if (typeof (agent as any).emit === 'function') {
    (agent as any).emit('initialized', { agentId });
  }
}

/**
 * Reset bootstrap locks for all agents or a specific agent
 * 
 * This is useful to recover from a situation where locks are stuck
 * due to a server crash or other error.
 * 
 * @param agentId Optional specific agent ID to reset, or all if not provided
 * @returns Object containing reset results
 */
export function resetBootstrapLocks(agentId?: string): { 
  success: boolean; 
  resetCount: number; 
  agentIds: string[] 
} {
  try {
    if (agentId) {
      // Reset specific agent lock
      const wasReset = agentBootstrapRegistry.forceResetLock(agentId);
      
      logger.warn(`Force reset bootstrap lock for agent ${agentId}`, {
        agentId,
        wasReset
      });
      
      return {
        success: true,
        resetCount: wasReset ? 1 : 0,
        agentIds: wasReset ? [agentId] : []
      };
    } else {
      // Reset all locks
      const before = new Date();
      agentBootstrapRegistry.resetAllLocks();
      const after = new Date();
      
      // Get all registered agents to report reset status
      const allAgentIds = agentBootstrapRegistry.getAllRegisteredAgentIds();
      
      logger.warn(`Reset all bootstrap locks`, {
        agentCount: allAgentIds.length,
        durationMs: after.getTime() - before.getTime()
      });
      
      return {
        success: true,
        resetCount: allAgentIds.length,
        agentIds: allAgentIds
      };
    }
  } catch (error) {
    logger.error(`Error resetting bootstrap locks`, {
      error,
      agentId
    });
    
    return {
      success: false,
      resetCount: 0,
      agentIds: []
    };
  }
} 