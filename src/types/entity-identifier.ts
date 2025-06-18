/**
 * Entity Identifier system for consistent and informative identifiers
 */

// Prefix types for different entity types
export enum IdPrefix {
  MESSAGE = 'msg',
  THOUGHT = 'thght',
  CHAT = 'chat',
  AGENT = 'agnt',
  USER = 'user',
}

// Namespace enum for entity identifiers
export enum EntityNamespace {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system',
  CHAT = 'chat',
  MEMORY = 'memory'
}

// Entity type enum for entity identifiers
export enum EntityType {
  USER = 'user',
  AGENT = 'agent',
  CHAT = 'chat',
  MESSAGE = 'message',
  THOUGHT = 'thought',
  THREAD = 'thread'
}

// Export EntityIdentifier interface (renamed from StructuredId)
export interface EntityIdentifier {
  // New properties
  namespace: string;
  type: string;
  id: string;
  version?: number;

  // Legacy properties for backward compatibility
  prefix?: string;
  timestamp?: Date;

  // Methods
  toString(): string;
  toULID?(): string;
  getTimestamp?(): Date;
}

// Interface for the entity identifier components
export interface EntityIdentifierComponents {
  prefix: IdPrefix | string;
  timestamp: number;
  randomSuffix: string;
}

/**
 * Creates an entity identifier with the namespace, type, id, and optional version
 * @param namespace The entity namespace
 * @param type The entity type
 * @param id The entity ID or name
 * @param version Optional version number
 * @returns An EntityIdentifier object
 */
export function createEntityIdentifier(
  namespace: string, 
  type: string, 
  id: string, 
  version?: number
): EntityIdentifier {
  const entityIdentifier: EntityIdentifier = {
    namespace,
    type,
    id
  };
  
  if (version !== undefined) {
    entityIdentifier.version = version;
  }
  
  return entityIdentifier;
}

/**
 * Creates an entity identifier with enum values for namespace and type
 * @param namespace The entity namespace enum value
 * @param type The entity type enum value
 * @param id The entity ID or name
 * @param version Optional version number
 * @returns An EntityIdentifier object
 */
export function createEnumEntityIdentifier(
  namespace: EntityNamespace,
  type: EntityType,
  id: string,
  version?: number
): EntityIdentifier {
  return createEntityIdentifier(namespace, type, id, version);
}

/**
 * Helper function to create a user ID
 * @param id The user ID or name
 * @param version Optional version number
 * @returns An EntityIdentifier for a user
 */
export function createUserId(id: string, version?: number): EntityIdentifier {
  return createEnumEntityIdentifier(EntityNamespace.USER, EntityType.USER, id, version);
}

/**
 * Helper function to create an agent ID
 * @param id The agent ID or name
 * @param version Optional version number
 * @returns An EntityIdentifier for an agent
 */
export function createAgentId(id: string, version?: number): EntityIdentifier {
  return createEnumEntityIdentifier(EntityNamespace.AGENT, EntityType.AGENT, id, version);
}

/**
 * Helper function to create a chat ID
 * @param id The chat ID or name
 * @param version Optional version number
 * @returns An EntityIdentifier for a chat
 */
export function createChatId(id: string, version?: number): EntityIdentifier {
  return createEnumEntityIdentifier(EntityNamespace.CHAT, EntityType.CHAT, id, version);
}

/**
 * Helper function to create a thread ID
 * @param id The thread ID or name
 * @param version Optional version number
 * @returns An EntityIdentifier for a thread
 */
export function createThreadId(id: string, version?: number): EntityIdentifier {
  return createEnumEntityIdentifier(EntityNamespace.CHAT, EntityType.THREAD, id, version);
}

/**
 * Helper function to create a system entity ID
 * @param type The entity type
 * @param id The entity ID or name
 * @param version Optional version number
 * @returns An EntityIdentifier for a system entity
 */
export function createSystemId(type: EntityType, id: string, version?: number): EntityIdentifier {
  return createEnumEntityIdentifier(EntityNamespace.SYSTEM, type, id, version);
}

/**
 * Parses an entity identifier string into an EntityIdentifier object
 * @param idString The entity identifier string to parse (format: namespace:type:id[:version])
 * @returns The parsed EntityIdentifier object or null if invalid
 */
export function parseEntityIdentifier(idString: string): EntityIdentifier | null {
  const parts = idString.split(':');
  if (parts.length < 3) return null;
  
  const namespace = parts[0];
  const type = parts[1];
  const id = parts[2];
  
  const entityIdentifier: EntityIdentifier = {
    namespace,
    type,
    id
  };
  
  // Parse version if it exists
  if (parts.length > 3) {
    const version = parseInt(parts[3], 10);
    if (!isNaN(version)) {
      entityIdentifier.version = version;
    }
  }
  
  return entityIdentifier;
}

/**
 * Converts an EntityIdentifier object to a string
 * @param id The EntityIdentifier object to convert
 * @returns A string representation (format: namespace:type:id[:version])
 */
export function entityIdentifierToString(id: EntityIdentifier): string {
  let result = `${id.namespace}:${id.type}:${id.id}`;
  if (id.version !== undefined) {
    result += `:${id.version}`;
  }
  return result;
}

/**
 * Compares two EntityIdentifier objects for equality
 * @param id1 The first EntityIdentifier object
 * @param id2 The second EntityIdentifier object
 * @returns True if the IDs are equal, false otherwise
 */
export function areEntityIdentifiersEqual(id1: EntityIdentifier, id2: EntityIdentifier): boolean {
  return id1.namespace === id2.namespace &&
         id1.type === id2.type &&
         id1.id === id2.id &&
         id1.version === id2.version;
}

/**
 * Interface for agent identifier
 */
export interface AgentIdentifier {
  id: EntityIdentifier;
  capabilities: string[];
  domain: string[];
  trustLevel: number;
  ownerUserId: EntityIdentifier;
}

/**
 * Creates an agent identifier
 * @param id The agent ID or name
 * @param capabilities List of agent capabilities
 * @param domain List of domains the agent specializes in
 * @param trustLevel Trust level (0.0 to 1.0)
 * @param ownerUserId Owner's user ID
 * @returns An AgentIdentifier object
 */
export function createAgentIdentifier(
  id: string,
  capabilities: string[],
  domain: string[],
  trustLevel: number,
  ownerUserId: EntityIdentifier
): AgentIdentifier {
  // Validate trust level
  if (trustLevel < 0.0 || trustLevel > 1.0) {
    throw new Error('Trust level must be between 0.0 and 1.0');
  }
  
  return {
    id: createAgentId(id),
    capabilities,
    domain,
    trustLevel,
    ownerUserId
  };
}

// Legacy compatibility exports (deprecated)
export type StructuredId = EntityIdentifier;
export const createStructuredId = createEntityIdentifier;
export const createEnumStructuredId = createEnumEntityIdentifier;
export const parseStructuredId = parseEntityIdentifier;
export const structuredIdToString = entityIdentifierToString;
export const areStructuredIdsEqual = areEntityIdentifiersEqual;

function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
} 