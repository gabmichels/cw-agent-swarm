/**
 * types.ts - Core types for agent base implementation
 * 
 * This file defines the core types and interfaces for the agent base system.
 */

// Canonical agent config and related types (imported from schema)
export { AgentStatus } from '../../../server/memory/schema/agent';
export type { 
  AgentCapability, 
  AgentParameters, 
  AgentTool, 
  AgentMetadata, 
  AgentMemoryEntity as AgentBaseConfig 
} from '../../../server/memory/schema/agent';

import type { AgentMemoryEntity as AgentBaseConfig } from '../../../server/memory/schema/agent';

/**
 * Capability levels for agents
 */
export enum AgentCapabilityLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

/**
 * Base interface for all agents
 */
export interface AgentBase {
  /**
   * Get the agent's ID
   */
  getAgentId(): string;

  /**
   * Get the agent's name
   */
  getName(): string;

  /**
   * Get the agent's configuration
   */
  getConfig(): AgentBaseConfig;

  /**
   * Update the agent's configuration
   */
  updateConfig(config: Partial<AgentBaseConfig>): void;

  /**
   * Initialize the agent
   */
  initialize(): Promise<boolean>;

  /**
   * Shutdown the agent
   */
  shutdown(): Promise<void>;

  /**
   * Get a manager by type
   */
  getManager(type: string): any;

  /**
   * Get all managers
   */
  getManagers(): Record<string, any>;

  /**
   * Add a manager
   */
  addManager(type: string, manager: any): void;

  /**
   * Remove a manager
   */
  removeManager(type: string): void;

  /**
   * Check if a capability is enabled
   */
  hasCapability(capability: string): boolean;

  /**
   * Enable a capability
   */
  enableCapability(capability: string): void;

  /**
   * Disable a capability
   */
  disableCapability(capability: string): void;
} 