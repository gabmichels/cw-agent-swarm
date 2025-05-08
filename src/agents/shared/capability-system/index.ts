/**
 * Capability System - Main Exports
 * 
 * This module provides a standardized system for agent capabilities,
 * allowing for capability registration, discovery, and level-based proficiency.
 */

// Re-export types from their original files
export * from './types';
export * from './helpers';

// Named export of the registry
export { CapabilityRegistry } from './CapabilityRegistry';

// Import for default capabilities
import { CapabilityLevel } from './types';

/**
 * Default capabilities for common agent types
 */
export const defaultCapabilities = {
  marketingAgent: {
    skills: {
      'skill.marketing_strategy': CapabilityLevel.ADVANCED,
      'skill.content_creation': CapabilityLevel.INTERMEDIATE,
      'skill.social_media': CapabilityLevel.ADVANCED,
      'skill.growth_hacking': CapabilityLevel.INTERMEDIATE,
      'skill.seo': CapabilityLevel.INTERMEDIATE
    },
    domains: ['marketing', 'social_media', 'content'],
    roles: ['marketer', 'advisor']
  },
  
  developerAgent: {
    skills: {
      'skill.programming': CapabilityLevel.EXPERT,
      'skill.debugging': CapabilityLevel.ADVANCED,
      'skill.code_review': CapabilityLevel.ADVANCED,
      'skill.system_design': CapabilityLevel.INTERMEDIATE
    },
    domains: ['software_development', 'programming'],
    roles: ['developer', 'engineer']
  },
  
  researchAgent: {
    skills: {
      'skill.information_gathering': CapabilityLevel.EXPERT,
      'skill.data_analysis': CapabilityLevel.ADVANCED,
      'skill.report_writing': CapabilityLevel.ADVANCED,
      'skill.literature_review': CapabilityLevel.ADVANCED
    },
    domains: ['research', 'analysis'],
    roles: ['researcher', 'analyst']
  }
};

/**
 * Capability System - Index exports
 * 
 * This module provides exports for the capability system components,
 * making it easy to import and use the capability system from any agent.
 */

// Export types from coordination module
export { 
  CapabilityType,
  CapabilityLevel as CoordinationCapabilityLevel,
  type Capability,
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

// Import from helpers.ts
import {
  getAgentCapabilities,
  getAgentCapabilitiesByType,
  findAgentsWithCapability,
  createCapability,
  createAgentCapability,
  formatCapabilityId,
  getCapabilityLevelDisplay,
  parseCapabilityLevel,
  getCapabilityLevelPercentage
} from './helpers';

// Re-export everything
export {
  // Helper functions
  getAgentCapabilities,
  getAgentCapabilitiesByType,
  findAgentsWithCapability,
  createCapability,
  createAgentCapability,
  formatCapabilityId,
  getCapabilityLevelDisplay,
  parseCapabilityLevel,
  getCapabilityLevelPercentage
}; 