/**
 * Structured identifier system for reliable entity references
 * 
 * This module provides types and utilities for creating structured identifiers
 * that include namespace, type, and unique ID information to ensure reliable
 * references in multi-agent scenarios.
 */

/**
 * Entity namespace enum
 * Namespaces help segregate entity IDs by domain/organization
 */
export enum EntityNamespace {
  SYSTEM = 'system',
  USER = 'user',
  AGENT = 'agent',
  MEMORY = 'memory',
  CHAT = 'chat',
  TASK = 'task',
  DOCUMENT = 'document',
  TENANT = 'tenant',
  CUSTOM = 'custom'
}

/**
 * Entity type enum
 * Types categorize entities within a namespace
 */
export enum EntityType {
  // User-related types
  USER = 'user',
  USER_PROFILE = 'user_profile',
  USER_SETTINGS = 'user_settings',
  USER_PREFERENCE = 'user_preference',
  
  // Agent-related types
  AGENT = 'agent',
  AGENT_CONFIG = 'agent_config',
  AGENT_STATE = 'agent_state',
  
  // Memory-related types
  MESSAGE = 'message',
  THOUGHT = 'thought',
  REFLECTION = 'reflection',
  INSIGHT = 'insight',
  PLAN = 'plan',
  DOCUMENT = 'document',
  FILE = 'file',
  
  // Interaction-related types
  CHAT = 'chat',
  THREAD = 'thread',
  CONVERSATION = 'conversation',
  
  // Task-related types
  TASK = 'task',
  GOAL = 'goal',
  
  // Multi-tenancy types
  TENANT = 'tenant',
  ORGANIZATION = 'organization',
  
  // Custom type
  CUSTOM = 'custom'
}

/**
 * Structured identifier interface
 * Provides reliable entity references with namespace, type and unique ID
 */
export interface StructuredId {
  namespace: string;     // Organization, system or context namespace
  type: string;          // Entity type
  id: string;            // UUID or other unique identifier
  version?: number;      // Optional version for versioned entities
}

/**
 * Create a structured identifier
 * 
 * @param namespace The namespace for this entity
 * @param type The entity type
 * @param id The unique identifier
 * @param version Optional version number
 * @returns A structured identifier
 */
export function createStructuredId(
  namespace: string,
  type: string,
  id: string,
  version?: number
): StructuredId {
  return {
    namespace,
    type,
    id,
    version
  };
}

/**
 * Create a structured identifier with enum values
 * 
 * @param namespace The namespace enum value
 * @param type The entity type enum value
 * @param id The unique identifier
 * @param version Optional version number
 * @returns A structured identifier
 */
export function createEnumStructuredId(
  namespace: EntityNamespace,
  type: EntityType,
  id: string,
  version?: number
): StructuredId {
  return {
    namespace,
    type,
    id,
    version
  };
}

/**
 * Create a user identifier
 * 
 * @param userId The unique user ID
 * @param version Optional version number
 * @returns A structured identifier for a user
 */
export function createUserId(userId: string, version?: number): StructuredId {
  return createEnumStructuredId(
    EntityNamespace.USER,
    EntityType.USER,
    userId,
    version
  );
}

/**
 * Create an agent identifier
 * 
 * @param agentId The unique agent ID
 * @param version Optional version number
 * @returns A structured identifier for an agent
 */
export function createAgentId(agentId: string, version?: number): StructuredId {
  return createEnumStructuredId(
    EntityNamespace.AGENT,
    EntityType.AGENT,
    agentId,
    version
  );
}

/**
 * Create a chat identifier
 * 
 * @param chatId The unique chat ID
 * @param version Optional version number
 * @returns A structured identifier for a chat
 */
export function createChatId(chatId: string, version?: number): StructuredId {
  return createEnumStructuredId(
    EntityNamespace.CHAT,
    EntityType.CHAT,
    chatId,
    version
  );
}

/**
 * Create a thread identifier
 * 
 * @param threadId The unique thread ID
 * @param version Optional version number
 * @returns A structured identifier for a thread
 */
export function createThreadId(threadId: string, version?: number): StructuredId {
  return createEnumStructuredId(
    EntityNamespace.CHAT,
    EntityType.THREAD,
    threadId,
    version
  );
}

/**
 * Parse a string representation of a structured ID
 * Expected format: "namespace:type:id[:version]"
 * 
 * @param structuredIdString The string representation
 * @returns A structured identifier
 */
export function parseStructuredId(structuredIdString: string): StructuredId | null {
  const parts = structuredIdString.split(':');
  
  if (parts.length < 3) {
    return null;
  }
  
  const [namespace, type, id, versionStr] = parts;
  const version = versionStr ? parseInt(versionStr, 10) : undefined;
  
  return createStructuredId(namespace, type, id, version);
}

/**
 * Convert a structured ID to a string
 * Format: "namespace:type:id[:version]"
 * 
 * @param structuredId The structured identifier
 * @returns A string representation
 */
export function structuredIdToString(structuredId: StructuredId): string {
  const { namespace, type, id, version } = structuredId;
  
  if (version !== undefined) {
    return `${namespace}:${type}:${id}:${version}`;
  }
  
  return `${namespace}:${type}:${id}`;
}

/**
 * Check if two structured IDs are equal
 * 
 * @param id1 First structured ID
 * @param id2 Second structured ID
 * @returns True if the IDs are equal
 */
export function areStructuredIdsEqual(id1: StructuredId, id2: StructuredId): boolean {
  return (
    id1.namespace === id2.namespace &&
    id1.type === id2.type &&
    id1.id === id2.id &&
    id1.version === id2.version
  );
}

/**
 * Create a system-defined structured identifier
 * 
 * @param type The entity type
 * @param id The unique identifier
 * @param version Optional version number
 * @returns A structured identifier
 */
export function createSystemId(
  type: EntityType,
  id: string,
  version?: number
): StructuredId {
  return createEnumStructuredId(
    EntityNamespace.SYSTEM,
    type,
    id,
    version
  );
}

/**
 * Enhanced agent identifier with capabilities metadata
 */
export interface AgentIdentifier {
  id: StructuredId;
  capabilities: string[];  // What this agent can do
  domain: string[];        // Knowledge domains
  trustLevel: number;      // 0-1 trust score
  ownerUserId: StructuredId; // User who owns/created this agent
}

/**
 * Create an agent identifier with capability information
 * 
 * @param agentId The unique agent ID
 * @param capabilities Array of agent capabilities
 * @param domain Array of knowledge domains
 * @param trustLevel Trust score (0-1)
 * @param ownerUserId Owner user ID
 * @returns An enhanced agent identifier
 * @throws Error if trustLevel is outside valid range (0-1)
 */
export function createAgentIdentifier(
  agentId: string,
  capabilities: string[],
  domain: string[],
  trustLevel: number,
  ownerUserId: StructuredId
): AgentIdentifier {
  // Validate trust level is within range
  if (trustLevel < 0 || trustLevel > 1) {
    throw new Error(`Trust level must be between 0 and 1, got ${trustLevel}`);
  }
  
  return {
    id: createAgentId(agentId),
    capabilities,
    domain,
    trustLevel,
    ownerUserId
  };
} 