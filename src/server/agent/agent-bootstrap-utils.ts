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
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000,    // 30 seconds
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
 * Initialize an agent with retry logic
 * 
 * @param agent The agent to initialize
 * @param config Retry configuration
 * @returns Promise resolving to initialization success
 */
export async function initializeAgentWithRetry(
  agent: AgentBase,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<boolean> {
  const agentId = agent.getAgentId();
  const agentName = agent instanceof Object ? (agent as any).name || 'Unknown Agent' : 'Unknown Agent';
  
  // Register agent in bootstrap registry if not already registered
  if (!agentBootstrapRegistry.isAgentRegistered(agentId)) {
    agentBootstrapRegistry.registerAgent(
      agentId,
      agentName,
      AgentStatus.OFFLINE,
      { bootstrapRequestId: uuidv4() }
    );
  }
  
  // Try to acquire lock for initialization
  if (!agentBootstrapRegistry.acquireLock(agentId)) {
    logger.warn(`Cannot initialize agent ${agentId}, another initialization is in progress`);
    return false;
  }
  
  // Update state to IN_PROGRESS
  agentBootstrapRegistry.updateAgentBootstrapState(agentId, AgentBootstrapState.IN_PROGRESS);
  
  let retryCount = 0;
  let success = false;
  let lastError: Error | undefined;
  
  while (retryCount <= config.maxRetries) {
    try {
      logger.info(`Initializing agent ${agentId} (attempt ${retryCount + 1}/${config.maxRetries + 1})...`);
      
      // Attempt initialization
      const result = await agent.initialize();
      
      if (result) {
        // Initialization succeeded
        success = true;
        logger.info(`Agent ${agentId} initialized successfully`);
        
        // Update registry with success state
        agentBootstrapRegistry.updateAgentBootstrapState(agentId, AgentBootstrapState.COMPLETED);
        break;
      } else {
        // Initialization returned false but didn't throw
        lastError = new Error(`Agent ${agentId} initialization returned false`);
        retryCount++;
        
        if (retryCount <= config.maxRetries) {
          const delay = calculateBackoffDelay(retryCount, config);
          logger.warn(`Agent ${agentId} initialization failed (attempt ${retryCount}/${config.maxRetries}). Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    } catch (error) {
      // Initialization threw an error
      lastError = error instanceof Error ? error : new Error(String(error));
      retryCount++;
      
      if (retryCount <= config.maxRetries) {
        const delay = calculateBackoffDelay(retryCount, config);
        logger.error(`Error initializing agent ${agentId} (attempt ${retryCount}/${config.maxRetries}): ${lastError.message}. Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  if (!success) {
    // All retries failed
    logger.error(`Agent ${agentId} initialization failed after ${config.maxRetries + 1} attempts`);
    agentBootstrapRegistry.updateAgentBootstrapState(agentId, AgentBootstrapState.FAILED, lastError);
  }
  
  return success;
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
 * Generate detailed logging information for agent initialization
 * 
 * @param agent The agent being initialized
 * @returns Structured log data
 */
export function generateAgentInitLogData(agent: AgentBase): Record<string, any> {
  const agentId = agent.getAgentId();
  const managers = 'getManagers' in agent ? (agent as any).getManagers() : [];
  
  return {
    agentId,
    managersCount: managers.length,
    managerTypes: managers.map((m: any) => m.managerType),
    timestamp: new Date().toISOString(),
    requestId: uuidv4()
  };
}

/**
 * Handle post-initialization agent setup
 * 
 * @param agent The initialized agent
 */
export function handlePostInitialization(agent: AgentBase): void {
  const agentId = agent.getAgentId();
  
  // Emit initialized event if the agent has an emit method
  if ('emit' in agent && typeof (agent as any).emit === 'function') {
    (agent as any).emit('initialized');
    logger.info(`Emitted 'initialized' event for agent ${agentId}`);
  }
  
  // Update registry status
  const info = agentBootstrapRegistry.getAgentBootstrapInfo(agentId);
  if (info) {
    info.status = AgentStatus.AVAILABLE;
    agentBootstrapRegistry.updateAgentBootstrapState(agentId, AgentBootstrapState.COMPLETED);
  }
} 