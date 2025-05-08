/**
 * Capability System - Index exports
 * 
 * This module provides exports for the capability system components,
 * making it easy to import and use the capability system from any agent.
 */

// Export core registry and types
export { 
  CapabilityRegistry,
  CapabilityType,
  CapabilityLevel,
  type Capability,
  type AgentCapabilityEntry,
  type CapabilityMatch,
  type CapabilitySearchOptions
} from '../coordination/CapabilityRegistry';

// Export predefined capability definitions
export {
  SkillCapabilities,
  RoleCapabilities,
  DomainCapabilities,
  AllCapabilities,
  registerPredefinedCapabilities
} from '../coordination/CapabilityDefinitions';

// Helper functions for capability registration
export const registerAgentCapability = (
  agentId: string, 
  capabilityId: string, 
  level: string,
  registry?: any
): void => {
  const reg = registry || require('../coordination/CapabilityRegistry').CapabilityRegistry.getInstance();
  const capabilities = { [capabilityId]: level };
  reg.registerAgentCapabilities(agentId, capabilities);
};

export const registerAgentCapabilities = (
  agentId: string,
  capabilities: Record<string, string>,
  options: { preferredDomains?: string[], primaryRoles?: string[] } = {},
  registry?: any
): void => {
  const reg = registry || require('../coordination/CapabilityRegistry').CapabilityRegistry.getInstance();
  reg.registerAgentCapabilities(agentId, capabilities, options);
};

/**
 * Find the best agent for a task based on required capabilities
 */
export const findAgentForTask = (
  requiredCapabilities: string[],
  options: {
    preferredCapabilities?: string[],
    requiredLevels?: Record<string, string>,
    preferredDomain?: string,
    requiredRoles?: string[],
    minMatchScore?: number
  } = {},
  registry?: any
): string | null => {
  const reg = registry || require('../coordination/CapabilityRegistry').CapabilityRegistry.getInstance();
  return reg.findBestAgentForTask({
    requiredCapabilities,
    preferredCapabilities: options.preferredCapabilities,
    requiredLevels: options.requiredLevels,
    preferredDomain: options.preferredDomain,
    requiredRoles: options.requiredRoles,
    minMatchScore: options.minMatchScore
  });
};

/**
 * Get all agents with a specific capability
 */
export const getAgentsWithCapability = (
  capabilityId: string,
  registry?: any
): string[] => {
  const reg = registry || require('../coordination/CapabilityRegistry').CapabilityRegistry.getInstance();
  return reg.getAgentsWithCapability(capabilityId);
};

/**
 * Check if an agent has a specific capability
 */
export const hasCapability = (
  agentId: string,
  capabilityId: string,
  registry?: any
): boolean => {
  const reg = registry || require('../coordination/CapabilityRegistry').CapabilityRegistry.getInstance();
  return reg.hasCapability(agentId, capabilityId);
}; 