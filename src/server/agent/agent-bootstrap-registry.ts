/**
 * Agent Bootstrap Registry
 * 
 * This module provides a registry to track agent bootstrap status and prevent
 * duplicate agent initializations. It implements a locking mechanism and
 * status tracking to ensure agents are only bootstrapped once.
 */

import { AgentStatus } from '../memory/schema/agent';
import { logger } from '../../lib/logging';

/**
 * Represents the bootstrap state of an agent
 */
export enum AgentBootstrapState {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Represents detailed information about the bootstrap process
 */
export interface AgentBootstrapInfo {
  agentId: string;
  state: AgentBootstrapState;
  startTime: Date | null;
  endTime: Date | null;
  error?: Error;
  retryCount: number;
  status: AgentStatus;
  agentName: string;
  metadata: {
    version?: string;
    bootstrapRequestId?: string;
    [key: string]: any;
  };
}

/**
 * Class that manages agent bootstrap status and locking
 */
export class AgentBootstrapRegistry {
  private static instance: AgentBootstrapRegistry;
  private bootstrapRegistry: Map<string, AgentBootstrapInfo>;
  private locks: Map<string, boolean>;
  private maxRetries: number = 3;
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.bootstrapRegistry = new Map();
    this.locks = new Map();
    
    logger.info('Agent Bootstrap Registry initialized');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): AgentBootstrapRegistry {
    if (!AgentBootstrapRegistry.instance) {
      AgentBootstrapRegistry.instance = new AgentBootstrapRegistry();
    }
    return AgentBootstrapRegistry.instance;
  }
  
  /**
   * Check if an agent is already registered
   */
  public isAgentRegistered(agentId: string): boolean {
    return this.bootstrapRegistry.has(agentId);
  }
  
  /**
   * Get the bootstrap info for an agent
   */
  public getAgentBootstrapInfo(agentId: string): AgentBootstrapInfo | undefined {
    return this.bootstrapRegistry.get(agentId);
  }
  
  /**
   * Register an agent with initial bootstrap state
   */
  public registerAgent(
    agentId: string, 
    agentName: string, 
    status: AgentStatus = AgentStatus.OFFLINE,
    metadata: Record<string, any> = {}
  ): AgentBootstrapInfo {
    if (this.isAgentRegistered(agentId)) {
      return this.getAgentBootstrapInfo(agentId)!;
    }
    
    const bootstrapInfo: AgentBootstrapInfo = {
      agentId,
      state: AgentBootstrapState.NOT_STARTED,
      startTime: null,
      endTime: null,
      retryCount: 0,
      status,
      agentName,
      metadata
    };
    
    this.bootstrapRegistry.set(agentId, bootstrapInfo);
    logger.info(`Agent ${agentId} (${agentName}) registered in bootstrap registry`);
    
    return bootstrapInfo;
  }
  
  /**
   * Update the bootstrap state of an agent
   */
  public updateAgentBootstrapState(
    agentId: string, 
    state: AgentBootstrapState, 
    error?: Error
  ): AgentBootstrapInfo | undefined {
    const info = this.getAgentBootstrapInfo(agentId);
    if (!info) {
      logger.warn(`Attempted to update state for unregistered agent ${agentId}`);
      return undefined;
    }
    
    info.state = state;
    
    // Update timestamps
    if (state === AgentBootstrapState.IN_PROGRESS && !info.startTime) {
      info.startTime = new Date();
    }
    
    if (state === AgentBootstrapState.COMPLETED || state === AgentBootstrapState.FAILED) {
      info.endTime = new Date();
      
      // Release the lock when done
      this.releaseLock(agentId);
    }
    
    // Store error if provided
    if (error) {
      info.error = error;
    }
    
    this.bootstrapRegistry.set(agentId, info);
    logger.info(`Agent ${agentId} bootstrap state updated to ${state}`);
    
    return info;
  }
  
  /**
   * Try to acquire a lock for bootstrapping an agent
   */
  public acquireLock(agentId: string): boolean {
    // Check if already locked
    if (this.locks.get(agentId)) {
      logger.warn(`Cannot acquire lock for agent ${agentId}, already locked`);
      return false;
    }
    
    // Set the lock
    this.locks.set(agentId, true);
    logger.info(`Lock acquired for agent ${agentId}`);
    return true;
  }
  
  /**
   * Release a lock for an agent
   */
  public releaseLock(agentId: string): boolean {
    // Check if locked
    if (!this.locks.get(agentId)) {
      logger.warn(`Cannot release lock for agent ${agentId}, not locked`);
      return false;
    }
    
    // Release the lock
    this.locks.set(agentId, false);
    logger.info(`Lock released for agent ${agentId}`);
    return true;
  }
  
  /**
   * Check if a retry should be attempted based on count and max retries
   */
  public shouldRetry(agentId: string): boolean {
    const info = this.getAgentBootstrapInfo(agentId);
    if (!info) {
      return false;
    }
    
    return info.retryCount < this.maxRetries;
  }
  
  /**
   * Increment the retry counter for an agent
   */
  public incrementRetryCount(agentId: string): number {
    const info = this.getAgentBootstrapInfo(agentId);
    if (!info) {
      return 0;
    }
    
    info.retryCount += 1;
    this.bootstrapRegistry.set(agentId, info);
    
    return info.retryCount;
  }
  
  /**
   * Get all registered agent IDs
   */
  public getAllRegisteredAgentIds(): string[] {
    return Array.from(this.bootstrapRegistry.keys());
  }
  
  /**
   * Get all agents in a particular bootstrap state
   */
  public getAgentsByState(state: AgentBootstrapState): AgentBootstrapInfo[] {
    const result: AgentBootstrapInfo[] = [];
    
    this.bootstrapRegistry.forEach((info) => {
      if (info.state === state) {
        result.push(info);
      }
    });
    
    return result;
  }
  
  /**
   * Clear registry (mainly for testing)
   */
  public clear(): void {
    this.bootstrapRegistry.clear();
    this.locks.clear();
    logger.info('Agent Bootstrap Registry cleared');
  }
}

// Export singleton instance
export const agentBootstrapRegistry = AgentBootstrapRegistry.getInstance(); 