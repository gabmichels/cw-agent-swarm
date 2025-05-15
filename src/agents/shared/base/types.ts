/**
 * types.ts - Core types for agent base implementation
 * 
 * This file defines the core types and interfaces for the agent base system.
 */

import type { AgentStatus, AgentMemoryEntity } from '../../../server/memory/schema/agent';

// Export types from schema
export type { AgentStatus };
export type AgentBaseConfig = AgentMemoryEntity;

// Local type definitions
export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version: string;
  metadata?: Record<string, unknown>;
}

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

// Additional types that extend or complement the base types
export interface AgentParameters {
  [key: string]: unknown;
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version: string;
  execute: (params: unknown) => Promise<unknown>;
}

export interface AgentMetadata {
  [key: string]: unknown;
} 