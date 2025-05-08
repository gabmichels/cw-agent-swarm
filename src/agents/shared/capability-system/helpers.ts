/**
 * Capability System Helper Functions
 * 
 * Utility functions for working with the capability system.
 */

import { 
  AgentCapability, 
  Capability, 
  CapabilityId, 
  CapabilityLevel, 
  CapabilityType,
  createCapabilityId,
  parseCapabilityId 
} from './types';
import { CapabilityRegistry } from './CapabilityRegistry';

/**
 * Register a capability for an agent
 */
export const registerAgentCapability = async (
  agentId: string,
  capabilityId: string,
  level: CapabilityLevel
): Promise<void> => {
  const registry = CapabilityRegistry.getInstance();
  await registry.registerAgentCapabilities(agentId, { [capabilityId]: level });
};

/**
 * Register multiple capabilities for an agent
 */
export const registerAgentCapabilities = async (
  agentId: string,
  capabilities: Record<string, CapabilityLevel>,
  options?: { 
    preferredDomains?: string[], 
    primaryRoles?: string[] 
  }
): Promise<void> => {
  const registry = CapabilityRegistry.getInstance();
  await registry.registerAgentCapabilities(agentId, capabilities, options);
};

/**
 * Check if an agent has a specific capability
 */
export const hasCapability = async (
  agentId: string,
  capabilityId: string
): Promise<boolean> => {
  const registry = CapabilityRegistry.getInstance();
  return registry.hasCapability(agentId, capabilityId);
};

/**
 * Get all capabilities for an agent
 */
export const getAgentCapabilities = async (
  agentId: string
): Promise<Record<string, CapabilityLevel> | null> => {
  const registry = CapabilityRegistry.getInstance();
  return registry.getAgentCapabilities(agentId);
};

/**
 * Get all capabilities for an agent grouped by type
 */
export const getAgentCapabilitiesByType = async (
  agentId: string
): Promise<Record<CapabilityType, Capability[]>> => {
  const registry = CapabilityRegistry.getInstance();
  return registry.getAgentCapabilitiesByType(agentId);
};

/**
 * Find agents with a specific capability
 */
export const findAgentsWithCapability = async (
  capabilityId: string,
  minLevel?: CapabilityLevel
): Promise<string[]> => {
  const registry = CapabilityRegistry.getInstance();
  return registry.findAgentsWithCapability(capabilityId, { minLevel });
};

/**
 * Create a full capability definition
 */
export const createCapability = (
  type: CapabilityType,
  name: string,
  description?: string,
  version?: string,
  tags?: string[]
): Capability => {
  const id = createCapabilityId(type, name);
  return {
    id: id.toString(),
    type,
    name,
    description,
    version,
    tags
  };
};

/**
 * Create a capability with level (for agent capabilities)
 */
export const createAgentCapability = (
  type: CapabilityType,
  name: string,
  level: CapabilityLevel = CapabilityLevel.INTERMEDIATE,
  description?: string,
  version?: string,
  tags?: string[]
): AgentCapability => {
  return {
    ...createCapability(type, name, description, version, tags),
    level
  };
};

/**
 * Convert a capability ID string to proper format
 */
export const formatCapabilityId = (
  typeOrId: string | CapabilityType,
  name?: string
): string => {
  if (name) {
    // Type and name provided separately
    return `${typeOrId}.${name}`;
  }
  
  try {
    // Try to parse as an existing ID
    const parsed = parseCapabilityId(typeOrId as string);
    return parsed.toString();
  } catch (error) {
    // Not a valid ID format, assume it's just a name and default to skill type
    return `${CapabilityType.SKILL}.${typeOrId}`;
  }
};

/**
 * Get the display name for a capability level
 */
export const getCapabilityLevelDisplay = (level: CapabilityLevel): string => {
  const displayMap: Record<CapabilityLevel, string> = {
    [CapabilityLevel.BASIC]: 'Basic',
    [CapabilityLevel.INTERMEDIATE]: 'Intermediate',
    [CapabilityLevel.ADVANCED]: 'Advanced',
    [CapabilityLevel.EXPERT]: 'Expert'
  };
  return displayMap[level] || 'Unknown';
};

/**
 * Convert a friendly capability level name to the enum value
 */
export const parseCapabilityLevel = (levelString: string): CapabilityLevel => {
  const normalizedLevel = levelString.toLowerCase().trim();
  
  switch (normalizedLevel) {
    case 'basic':
    case 'beginner':
    case 'novice':
      return CapabilityLevel.BASIC;
      
    case 'intermediate':
    case 'competent':
    case 'moderate':
      return CapabilityLevel.INTERMEDIATE;
      
    case 'advanced':
    case 'proficient':
      return CapabilityLevel.ADVANCED;
      
    case 'expert':
    case 'master':
      return CapabilityLevel.EXPERT;
      
    default:
      // Default to intermediate for unknown values
      console.warn(`Unknown capability level: "${levelString}", defaulting to intermediate`);
      return CapabilityLevel.INTERMEDIATE;
  }
};

/**
 * Convert capability level to percentage for UI display
 */
export const getCapabilityLevelPercentage = (level: CapabilityLevel): number => {
  const percentageMap: Record<CapabilityLevel, number> = {
    [CapabilityLevel.BASIC]: 25,
    [CapabilityLevel.INTERMEDIATE]: 50,
    [CapabilityLevel.ADVANCED]: 75,
    [CapabilityLevel.EXPERT]: 100
  };
  return percentageMap[level] || 0;
}; 