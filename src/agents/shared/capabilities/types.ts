/**
 * Agent capability types
 */

/**
 * Capability level indicating how well an agent can perform a capability
 */
export enum CapabilityLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

/**
 * Capability type categories
 */
export enum CapabilityType {
  COMMUNICATION = 'communication',
  REASONING = 'reasoning',
  KNOWLEDGE = 'knowledge',
  TOOL_USE = 'tool_use',
  PERCEPTION = 'perception',
  CREATION = 'creation',
  COORDINATION = 'coordination',
  SPECIALIZED = 'specialized'
}

/**
 * Capability definition
 */
export interface Capability {
  id: string;
  name: string;
  description: string;
  type: CapabilityType;
  parameters?: Record<string, unknown>;
  requiredCapabilities?: string[];
  incompatibleWith?: string[];
}

/**
 * Capability implementation by an agent
 */
export interface AgentCapability {
  capabilityId: string;
  level: CapabilityLevel;
  parameters?: Record<string, unknown>;
  enabled: boolean;
  proficiency?: number; // 0.0 to 1.0
}

/**
 * Capability request parameters
 */
export interface CapabilityRequest {
  capabilityId: string;
  minimumLevel?: CapabilityLevel;
  minimumProficiency?: number;
  preferredAgentIds?: string[];
  requiredParameters?: string[];
}

/**
 * Capability registration result
 */
export interface CapabilityRegistration {
  agentId: string;
  capability: AgentCapability;
  registeredAt: number;
} 