/**
 * Agent Bootstrap Registry
 * 
 * This module provides a registry to track agent bootstrap status and prevent
 * duplicate agent initializations. It implements a locking mechanism and
 * status tracking to ensure agents are only bootstrapped once.
 */

import { AgentStatus } from '../memory/schema/agent';
import { logger } from '../../lib/logging';
import * as fs from 'fs';
import * as path from 'path';

// Registry file path
const REGISTRY_FILE = process.env.AGENT_REGISTRY_FILE || path.join(process.cwd(), '.agent-registry.json');

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
 * Information about agent bootstrap process
 */
export interface AgentBootstrapInfo {
  agentId: string;
  agentName: string;
  state: AgentBootstrapState;
  status: AgentStatus;
  locked: boolean;
  lockTimestamp?: Date;
  startTime?: Date;
  endTime?: Date;
  error?: Error;
  retries: number;
  metadata?: Record<string, any>;
}

/**
 * Class that manages agent bootstrap status and locking
 */
export class AgentBootstrapRegistry {
  private static instance: AgentBootstrapRegistry;
  private bootstrapRegistry: Map<string, AgentBootstrapInfo>;
  private locks: Map<string, boolean>;
  private maxRetries: number = 3;
  private maxLockDurationMs: number = 2 * 60 * 1000;
  private registryFile: string;
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.bootstrapRegistry = new Map();
    this.locks = new Map();
    this.registryFile = REGISTRY_FILE;
    
    // Try to load from disk if file exists
    this.loadFromDisk();
    
    logger.info('Agent Bootstrap Registry initialized');
    
    // Clear any stale locks on startup
    this.resetAllLocks();
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
   * Register a new agent for bootstrap tracking
   */
  public registerAgent(
    agentId: string,
    agentName: string,
    status: AgentStatus,
    metadata?: Record<string, any>
  ): void {
    // Check if already registered
    if (this.bootstrapRegistry.has(agentId)) {
      return;
    }
    
    logger.info(`Agent ${agentId} (${agentName}) registered in bootstrap registry`);
    
    // Create bootstrap info
    const info: AgentBootstrapInfo = {
      agentId,
      agentName,
      state: AgentBootstrapState.NOT_STARTED,
      status,
      locked: false,
      startTime: undefined,
      endTime: undefined,
      retries: 0,
      metadata: metadata || {}
    };
    
    // Store in registry
    this.bootstrapRegistry.set(agentId, info);
    
    // Save updated registry to disk
    this.saveToDisk();
  }
  
  /**
   * Update agent bootstrap state
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
    
    // Save updated registry to disk
    this.saveToDisk();
    
    return info;
  }
  
  /**
   * Check if a lock is stale (held for too long)
   */
  public isLockStale(agentId: string): boolean {
    const info = this.getAgentBootstrapInfo(agentId);
    
    if (!info) {
      return false;
    }
    
    // Check for stale locks (if locked with timestamp)
    if (info.locked && info.lockTimestamp) {
      const now = new Date();
      const lockDuration = now.getTime() - info.lockTimestamp.getTime();
      
      if (lockDuration > this.maxLockDurationMs) {
        return true;
      }
    }
    
    // Check for stale IN_PROGRESS states (stuck without locks)
    if (info.state === AgentBootstrapState.IN_PROGRESS && info.startTime) {
      const now = new Date();
      const stateDuration = now.getTime() - info.startTime.getTime();
      
      // If the agent has been in IN_PROGRESS state for more than the max duration
      // and is not currently locked, it's likely stale
      if (stateDuration > this.maxLockDurationMs && !info.locked) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if a bootstrap state is stale (agent stuck in IN_PROGRESS for too long)
   */
  public isBootstrapStateStale(agentId: string): boolean {
    const info = this.getAgentBootstrapInfo(agentId);
    
    if (!info || info.state !== AgentBootstrapState.IN_PROGRESS) {
      return false;
    }
    
    // If no start time but in IN_PROGRESS state, consider it stale
    if (!info.startTime) {
      logger.warn(`Agent ${agentId} in IN_PROGRESS state with no start time - considering stale`);
      return true;
    }
    
    // Check for corrupted timestamps (endTime before startTime)
    if (info.endTime && info.startTime && info.endTime.getTime() < info.startTime.getTime()) {
      logger.warn(`Agent ${agentId} has corrupted timestamps (endTime before startTime) - considering stale`);
      return true;
    }
    
    // Check if the agent has been in IN_PROGRESS state for too long
    const now = new Date();
    const stateDuration = now.getTime() - info.startTime.getTime();
    if (stateDuration > this.maxLockDurationMs) {
      logger.warn(`Agent ${agentId} stuck in IN_PROGRESS for ${Math.round(stateDuration / 1000)}s - considering stale`);
      return true;
    }
    
    // Also check for invalid/corrupted date values
    if (isNaN(info.startTime.getTime())) {
      logger.warn(`Agent ${agentId} has invalid start time - considering stale`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Force release a lock if it's stale
   */
  public forceReleaseStaleLock(agentId: string): boolean {
    if (!this.isLockStale(agentId)) {
      return false;
    }
    
    const info = this.getAgentBootstrapInfo(agentId);
    
    if (info) {
      // Reset lock state if it was locked
      if (info.locked) {
        info.locked = false;
        info.lockTimestamp = undefined;
        logger.warn(`Force released stale lock for agent ${agentId} (lock was held for too long)`);
      }
      
      // Reset bootstrap state if it's stale
      if (info.state === AgentBootstrapState.IN_PROGRESS && info.startTime) {
        const now = new Date();
        const stateDuration = now.getTime() - info.startTime.getTime();
        
        if (stateDuration > this.maxLockDurationMs) {
          info.state = AgentBootstrapState.NOT_STARTED;
          info.startTime = undefined;
          info.endTime = undefined;
          info.error = undefined;
          info.retries = 0;
          
          logger.warn(`Reset stale bootstrap state for agent ${agentId} (was stuck in IN_PROGRESS for ${Math.round(stateDuration / 1000)}s)`);
        }
      }
      
      // Save updated registry to disk
      this.saveToDisk();
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Reset all locks and stale states in the registry
   * Used on server startup to clear any stale locks or stuck bootstrap states
   */
  public resetAllLocks(): void {
    let resetCount = 0;
    const now = new Date();
    
    this.bootstrapRegistry.forEach((info, agentId) => {
      let wasModified = false;
      
      // Reset stale locks
      if (info.locked) {
        info.locked = false;
        info.lockTimestamp = undefined;
        logger.warn(`Reset lock for agent ${agentId} on startup`);
        resetCount++;
        wasModified = true;
      }
      
      // Reset stale IN_PROGRESS states
      if (info.state === AgentBootstrapState.IN_PROGRESS) {
        let shouldReset = false;
        let reason = '';
        
        // Check for corrupted or missing start time
        if (!info.startTime) {
          shouldReset = true;
          reason = 'no start time recorded';
        } else if (isNaN(info.startTime.getTime())) {
          shouldReset = true;
          reason = 'invalid start time';
        } else if (info.endTime && info.endTime.getTime() < info.startTime.getTime()) {
          shouldReset = true;
          reason = 'corrupted timestamps (endTime before startTime)';
        } else {
          // Check normal timeout
          const stateDuration = now.getTime() - info.startTime.getTime();
          if (stateDuration > this.maxLockDurationMs) {
            shouldReset = true;
            reason = `stuck for ${Math.round(stateDuration / 1000)}s`;
          }
        }
        
        if (shouldReset) {
          info.state = AgentBootstrapState.NOT_STARTED;
          info.startTime = undefined;
          info.endTime = undefined;
          info.error = undefined;
          info.retries = 0;
          
          logger.warn(`Reset stale bootstrap state for agent ${agentId} on startup (${reason})`);
          resetCount++;
          wasModified = true;
        }
      }
    });
    
    if (resetCount > 0) {
      logger.warn(`Reset ${resetCount} stale agent bootstrap locks/states on startup`);
      
      // Save updated registry to disk
      this.saveToDisk();
    }
  }
  
  /**
   * Acquire a lock for agent initialization
   */
  public acquireLock(agentId: string): boolean {
    if (!this.isAgentRegistered(agentId)) {
      return false;
    }
    
    const info = this.getAgentBootstrapInfo(agentId);
    
    if (!info) {
      return false;
    }
    
    // Check if lock is stale and force release if needed
    if (info.locked && this.isLockStale(agentId)) {
      this.forceReleaseStaleLock(agentId);
    }
    
    if (!info.locked) {
      info.locked = true;
      info.lockTimestamp = new Date();
      info.startTime = new Date();
      
      logger.info(`Lock acquired for agent ${agentId}`);
      
      // Save updated registry to disk
      this.saveToDisk();
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Release a lock for an agent
   */
  public releaseLock(agentId: string): boolean {
    // Check if agent is registered
    if (!this.isAgentRegistered(agentId)) {
      logger.warn(`Cannot release lock for agent ${agentId}, agent not registered`);
      return false;
    }
    
    const info = this.getAgentBootstrapInfo(agentId);
    
    // Check if locked
    if (!info || !info.locked) {
      logger.warn(`Cannot release lock for agent ${agentId}, not locked`);
      return false;
    }
    
    // Release the lock
    info.locked = false;
    info.lockTimestamp = undefined;
    logger.info(`Lock released for agent ${agentId}`);
    
    // Save updated registry to disk
    this.saveToDisk();
    
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
    
    return info.retries < this.maxRetries;
  }
  
  /**
   * Increment retry count for agent
   */
  public incrementRetryCount(agentId: string): number {
    if (!this.isAgentRegistered(agentId)) {
      return 0;
    }
    
    const info = this.getAgentBootstrapInfo(agentId);
    
    if (info) {
      info.retries += 1;
      return info.retries;
    }
    
    return 0;
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
  
  /**
   * Update agent metadata for tracking purposes
   * 
   * @param agentId The agent ID
   * @param metadata Metadata to update
   */
  public updateAgentMetadata(
    agentId: string,
    metadata: Record<string, any>
  ): void {
    if (!this.isAgentRegistered(agentId)) {
      logger.warn(`Attempted to update metadata for unregistered agent ${agentId}`);
      return;
    }
    
    const info = this.getAgentBootstrapInfo(agentId);
    if (info) {
      // Create metadata object if it doesn't exist
      if (!info.metadata) {
        info.metadata = {};
      }
      
      // Update metadata with new values
      Object.assign(info.metadata, metadata);
      
      // Save updated registry to disk
      this.saveToDisk();
    }
  }
  
  /**
   * Force reset a lock regardless of staleness
   * Use with caution as it could disrupt an ongoing initialization
   */
  public forceResetLock(agentId: string): boolean {
    if (!this.isAgentRegistered(agentId)) {
      logger.warn(`Cannot force reset lock for agent ${agentId}, agent not registered`);
      return false;
    }
    
    const info = this.getAgentBootstrapInfo(agentId);
    
    if (!info) {
      return false;
    }
    
    const wasLocked = info.locked;
    info.locked = false;
    info.lockTimestamp = undefined;
    
    if (wasLocked) {
      logger.warn(`Force reset lock for agent ${agentId}`);
    }
    
    return wasLocked;
  }
  
  /**
   * Save registry to disk
   */
  private saveToDisk(): void {
    try {
      // Convert Map to plain object for serialization
      const registryData = {
        agents: Object.fromEntries(
          Array.from(this.bootstrapRegistry.entries()).map(([id, info]) => {
            // Create a serializable version of the info
            const serializableInfo = {
              ...info,
              // Convert dates to ISO strings
              lockTimestamp: info.lockTimestamp?.toISOString(),
              startTime: info.startTime?.toISOString(),
              endTime: info.endTime?.toISOString(),
              // Convert error to string
              error: info.error ? info.error.message : undefined
            };
            return [id, serializableInfo];
          })
        ),
        lastUpdated: new Date().toISOString()
      };
      
      // Write to file
      fs.writeFileSync(this.registryFile, JSON.stringify(registryData, null, 2));
    } catch (error) {
      logger.error(`Error saving agent registry to disk:`, { error });
    }
  }
  
  /**
   * Load registry from disk
   */
  private loadFromDisk(): void {
    try {
      // Check if file exists
      if (fs.existsSync(this.registryFile)) {
        // Read and parse file
        const fileContent = fs.readFileSync(this.registryFile, 'utf8');
        const registryData = JSON.parse(fileContent);
        
        // Deserialize agents
        if (registryData && registryData.agents) {
          Object.entries(registryData.agents).forEach(([id, rawInfo]: [string, any]) => {
            // Convert back to proper AgentBootstrapInfo with Date objects
            const info: AgentBootstrapInfo = {
              ...rawInfo,
              // Convert ISO strings back to Date objects
              lockTimestamp: rawInfo.lockTimestamp ? new Date(rawInfo.lockTimestamp) : undefined,
              startTime: rawInfo.startTime ? new Date(rawInfo.startTime) : undefined,
              endTime: rawInfo.endTime ? new Date(rawInfo.endTime) : undefined,
              // Recreate error object if needed
              error: rawInfo.error ? new Error(rawInfo.error) : undefined
            };
            
            this.bootstrapRegistry.set(id, info);
          });
          
          logger.info(`Loaded ${this.bootstrapRegistry.size} agents from registry file`);
        }
      }
    } catch (error) {
      logger.error(`Error loading agent registry from disk:`, { error });
    }
  }
}

// Export singleton instance
export const agentBootstrapRegistry = AgentBootstrapRegistry.getInstance(); 