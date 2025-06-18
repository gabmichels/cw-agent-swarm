/**
 * Clean ULID-based ID generation utilities
 * Generates string IDs in the format: namespace:type:id
 * 
 * This replaces the StructuredId system with direct string generation
 * following the arch-refactor-guidelines for ULID, strict typing, and pure functions.
 */
import { ulid } from 'ulid';

/**
 * Generate a formatted ID string in the pattern: namespace:type:id
 * @param namespace The entity namespace (user, agent, system, chat, memory)
 * @param type The entity type (user, agent, chat, message, thought, thread)
 * @param id Optional specific ID, if not provided generates a ULID
 * @returns A formatted ID string
 */
export function generateId(namespace: string, type: string, id?: string): string {
  const actualId = id || ulid();
  return `${namespace}:${type}:${actualId}`;
}

// User ID generators
export function generateUserId(id?: string): string {
  return generateId('user', 'user', id);
}

export function generateSystemUserId(id?: string): string {
  return generateId('system', 'user', id);
}

// Agent ID generators  
export function generateAgentId(id?: string): string {
  return generateId('agent', 'agent', id);
}

export function generateSystemAgentId(id?: string): string {
  return generateId('system', 'agent', id);
}

// Chat ID generators
export function generateChatId(id?: string): string {
  return generateId('chat', 'chat', id);
}

export function generateSystemChatId(id?: string): string {
  return generateId('system', 'chat', id);
}

// Message ID generators
export function generateMessageId(id?: string): string {
  return generateId('memory', 'message', id);
}

// Thread ID generators
export function generateThreadId(id?: string): string {
  return generateId('chat', 'thread', id);
}

// Thought ID generators
export function generateThoughtId(id?: string): string {
  return generateId('memory', 'thought', id);
}

// Task ID generators
export function generateTaskId(id?: string): string {
  return generateId('system', 'task', id);
}

// Cognitive Process ID generators
export function generateCognitiveProcessId(id?: string): string {
  return generateId('system', 'cognitive-process', id);
}

/**
 * Generate a raw ULID string without formatting
 * @returns A raw ULID string
 */
export function generateULID(): string {
  return ulid();
}

/**
 * Check if a string is a valid ULID
 * @param id The string to check
 * @returns True if valid ULID, false otherwise
 */
export function isValidULID(id: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id);
}

/**
 * Parse a formatted ID string to extract components
 * @param idString The formatted ID string (namespace:type:id)
 * @returns Object with namespace, type, and id components, or null if invalid
 */
export function parseId(idString: string): { namespace: string; type: string; id: string } | null {
  const parts = idString.split(':');
  if (parts.length !== 3) return null;
  
  return {
    namespace: parts[0],
    type: parts[1], 
    id: parts[2]
  };
} 