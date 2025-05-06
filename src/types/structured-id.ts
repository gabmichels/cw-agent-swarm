/**
 * Structured ID system for consistent and informative identifiers
 */

// Prefix types for different entity types
export enum IdPrefix {
  MESSAGE = 'msg',
  THOUGHT = 'thght',
  CHAT = 'chat',
  AGENT = 'agnt',
  USER = 'user',
}

// Namespace enum for structured identifiers
export enum EntityNamespace {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system',
  CHAT = 'chat',
  MEMORY = 'memory'
}

// Entity type enum for structured identifiers
export enum EntityType {
  USER = 'user',
  AGENT = 'agent',
  CHAT = 'chat',
  MESSAGE = 'message',
  THOUGHT = 'thought',
  THREAD = 'thread'
}

// Export StructuredId interface
export interface StructuredId {
  namespace: string;
  type: string;
  id: string;
  version?: number;
}

// Interface for the structured ID components
export interface StructuredIdComponents {
  prefix: IdPrefix | string;
  timestamp: number;
  randomSuffix: string;
}

/**
 * Creates a structured ID with the namespace, type, id, and optional version
 * @param namespace The entity namespace
 * @param type The entity type
 * @param id The entity ID or name
 * @param version Optional version number
 * @returns A structured ID object
 */
export function createStructuredId(
  namespace: string, 
  type: string, 
  id: string, 
  version?: number
): StructuredId {
  const structuredId: StructuredId = {
    namespace,
    type,
    id
  };
  
  if (version !== undefined) {
    structuredId.version = version;
  }
  
  return structuredId;
}

/**
 * Creates a structured ID with enum values for namespace and type
 * @param namespace The entity namespace enum value
 * @param type The entity type enum value
 * @param id The entity ID or name
 * @param version Optional version number
 * @returns A structured ID object
 */
export function createEnumStructuredId(
  namespace: EntityNamespace,
  type: EntityType,
  id: string,
  version?: number
): StructuredId {
  return createStructuredId(namespace, type, id, version);
}

/**
 * Helper function to create a user ID
 * @param id The user ID or name
 * @param version Optional version number
 * @returns A structured user ID
 */
export function createUserId(id: string, version?: number): StructuredId {
  return createEnumStructuredId(EntityNamespace.USER, EntityType.USER, id, version);
}

/**
 * Helper function to create an agent ID
 * @param id The agent ID or name
 * @param version Optional version number
 * @returns A structured agent ID
 */
export function createAgentId(id: string, version?: number): StructuredId {
  return createEnumStructuredId(EntityNamespace.AGENT, EntityType.AGENT, id, version);
}

/**
 * Helper function to create a chat ID
 * @param id The chat ID or name
 * @param version Optional version number
 * @returns A structured chat ID
 */
export function createChatId(id: string, version?: number): StructuredId {
  return createEnumStructuredId(EntityNamespace.CHAT, EntityType.CHAT, id, version);
}

/**
 * Helper function to create a thread ID
 * @param id The thread ID or name
 * @param version Optional version number
 * @returns A structured thread ID
 */
export function createThreadId(id: string, version?: number): StructuredId {
  return createEnumStructuredId(EntityNamespace.CHAT, EntityType.THREAD, id, version);
}

/**
 * Helper function to create a system entity ID
 * @param type The entity type
 * @param id The entity ID or name
 * @param version Optional version number
 * @returns A structured system entity ID
 */
export function createSystemId(type: EntityType, id: string, version?: number): StructuredId {
  return createEnumStructuredId(EntityNamespace.SYSTEM, type, id, version);
}

/**
 * Parses a structured ID string into a StructuredId object
 * @param idString The structured ID string to parse (format: namespace:type:id[:version])
 * @returns The parsed StructuredId object or null if invalid
 */
export function parseStructuredId(idString: string): StructuredId | null {
  const parts = idString.split(':');
  if (parts.length < 3) return null;
  
  const namespace = parts[0];
  const type = parts[1];
  const id = parts[2];
  
  const structuredId: StructuredId = {
    namespace,
    type,
    id
  };
  
  // Parse version if it exists
  if (parts.length > 3) {
    const version = parseInt(parts[3], 10);
    if (!isNaN(version)) {
      structuredId.version = version;
    }
  }
  
  return structuredId;
}

/**
 * Converts a StructuredId object to a string
 * @param id The StructuredId object to convert
 * @returns A string representation (format: namespace:type:id[:version])
 */
export function structuredIdToString(id: StructuredId): string {
  let result = `${id.namespace}:${id.type}:${id.id}`;
  if (id.version !== undefined) {
    result += `:${id.version}`;
  }
  return result;
}

/**
 * Compares two StructuredId objects for equality
 * @param id1 The first StructuredId object
 * @param id2 The second StructuredId object
 * @returns True if the IDs are equal, false otherwise
 */
export function areStructuredIdsEqual(id1: StructuredId, id2: StructuredId): boolean {
  if (id1.namespace !== id2.namespace) return false;
  if (id1.type !== id2.type) return false;
  if (id1.id !== id2.id) return false;
  if (id1.version !== id2.version) return false;
  return true;
}

/**
 * Interface for agent identifier
 */
export interface AgentIdentifier {
  id: StructuredId;
  capabilities: string[];
  domain: string[];
  trustLevel: number;
  ownerUserId: StructuredId;
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
  ownerUserId: StructuredId
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

/**
 * Generates a random alphanumeric string
 * @param length The length of the string to generate
 * @returns A random alphanumeric string
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars.charAt(randomIndex);
  }
  return result;
} 