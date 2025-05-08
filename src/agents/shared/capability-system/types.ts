/**
 * Capability System - Core Types
 * 
 * This module defines the core types for the agent capability system,
 * providing a standardized approach to capability registration and discovery.
 */

/**
 * Capability types supported by the system
 */
export enum CapabilityType {
  SKILL = 'skill',    // Specific technical ability
  ROLE = 'role',      // Functional role the agent can perform
  DOMAIN = 'domain',  // Knowledge domain
  TAG = 'tag'         // General purpose tag
}

/**
 * Capability proficiency levels
 */
export enum CapabilityLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

/**
 * Structure of a capability ID
 * Format: [type].[name] (e.g., "skill.marketing_strategy")
 */
export interface CapabilityId {
  type: CapabilityType;
  name: string;
  toString(): string;
}

/**
 * Core capability definition
 */
export interface Capability {
  /**
   * Unique identifier for the capability
   * Format: [type].[name] (e.g., "skill.marketing_strategy")
   */
  id: string;
  
  /**
   * Type of capability
   */
  type: CapabilityType;
  
  /**
   * Display name for the capability
   */
  name: string;
  
  /**
   * Optional description of what this capability enables
   */
  description?: string;
  
  /**
   * Optional version of the capability
   */
  version?: string;
  
  /**
   * Optional tags for categorization
   */
  tags?: string[];
}

/**
 * Agent capability with proficiency level
 */
export interface AgentCapability extends Capability {
  /**
   * Proficiency level for this capability
   */
  level: CapabilityLevel;
}

/**
 * Agent capability set - the complete capability configuration for an agent
 */
export interface AgentCapabilitySet {
  /**
   * Key-value pairs of capability IDs and their proficiency levels
   */
  skills: Record<string, CapabilityLevel>;
  
  /**
   * Knowledge domains the agent specializes in
   */
  domains: string[];
  
  /**
   * Functional roles the agent can perform
   */
  roles: string[];
  
  /**
   * General purpose tags
   */
  tags?: string[];
}

/**
 * Configuration for the agent's capability level
 */
export interface CapabilityConfig {
  /**
   * Default capability level for the agent if not specified
   */
  defaultLevel?: CapabilityLevel;
  
  /**
   * Specific capabilities with their levels
   */
  capabilities: AgentCapabilitySet;
}

/**
 * Options for capability discovery
 */
export interface CapabilityQueryOptions {
  /**
   * Minimum proficiency level required
   */
  minLevel?: CapabilityLevel;
  
  /**
   * Filter by capability type
   */
  type?: CapabilityType | CapabilityType[];
  
  /**
   * Filter by tags
   */
  tags?: string[];
  
  /**
   * Maximum number of results to return
   */
  limit?: number;
}

/**
 * Agent capability registry service interface
 */
export interface ICapabilityRegistry {
  /**
   * Register a capability definition
   */
  registerCapability(capability: Capability): Promise<void>;
  
  /**
   * Register an agent's capabilities
   */
  registerAgentCapabilities(
    agentId: string,
    capabilities: Record<string, CapabilityLevel>,
    options?: {
      preferredDomains?: string[],
      primaryRoles?: string[]
    }
  ): Promise<void>;
  
  /**
   * Get capabilities for a specific agent
   */
  getAgentCapabilities(agentId: string): Promise<Record<string, CapabilityLevel> | null>;
  
  /**
   * Check if an agent has a specific capability
   */
  hasCapability(agentId: string, capabilityId: string): Promise<boolean>;
  
  /**
   * Find agents with specific capabilities
   */
  findAgentsWithCapability(
    capabilityId: string,
    options?: CapabilityQueryOptions
  ): Promise<string[]>;
  
  /**
   * Get a capability definition
   */
  getCapability(capabilityId: string): Promise<Capability | null>;
}

/**
 * Helper function to create a capability ID
 */
export function createCapabilityId(type: CapabilityType, name: string): CapabilityId {
  return {
    type,
    name,
    toString: () => `${type}.${name}`
  };
}

/**
 * Helper function to parse a capability ID string
 */
export function parseCapabilityId(id: string): CapabilityId {
  const [type, ...nameParts] = id.split('.');
  const name = nameParts.join('.');
  
  if (!type || !name || !Object.values(CapabilityType).includes(type as CapabilityType)) {
    throw new Error(`Invalid capability ID: ${id}. Expected format: [type].[name]`);
  }
  
  return {
    type: type as CapabilityType,
    name,
    toString: () => id
  };
} 