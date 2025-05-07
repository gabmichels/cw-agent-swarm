/**
 * ULID (Universally Unique Lexicographically Sortable Identifier) implementation
 * Replaces timestamp-based IDs with a robust, sortable, unique ID system
 */
import { ulid, decodeTime } from 'ulid';

/**
 * Interface for structured identifiers with prefix and ULID
 */
export interface StructuredId {
  // The complete ULID string (26 characters)
  id: string;
  
  // Namespace/type prefix (e.g., 'user', 'memory', 'chat')
  prefix: string;
  
  // Extracted timestamp from the ULID
  timestamp: Date;
  
  // String representation that combines prefix and ULID
  toString(): string;
  
  // Get raw ULID without prefix
  toULID(): string;
  
  // Get creation timestamp
  getTimestamp(): Date;
}

/**
 * Predefined prefix types for different entities
 */
export enum IdPrefix {
  USER = 'user',
  AGENT = 'agent',
  CHAT = 'chat',
  MESSAGE = 'msg',
  MEMORY = 'mem',
  KNOWLEDGE = 'know',
  DOCUMENT = 'doc',
  THOUGHT = 'thght',
  EMBEDDING = 'embd',
}

/**
 * Implementation of a structured ID
 */
class StructuredIdImpl implements StructuredId {
  constructor(
    public readonly id: string,
    public readonly prefix: string,
    public readonly timestamp: Date
  ) {}

  /**
   * Get the string representation (prefix_ulid)
   */
  toString(): string {
    return `${this.prefix}_${this.id}`;
  }

  /**
   * Get the raw ULID without prefix
   */
  toULID(): string {
    return this.id;
  }

  /**
   * Get the timestamp from the ULID
   */
  getTimestamp(): Date {
    return this.timestamp;
  }
}

/**
 * Generator for creating and parsing structured IDs
 */
export class IdGenerator {
  /**
   * Create a new ID with the given prefix
   * @param prefix The prefix to use (e.g., 'user', 'chat')
   * @returns A new structured ID
   */
  static generate(prefix: string): StructuredId {
    const timestamp = new Date();
    const id = ulid(timestamp.getTime());
    return new StructuredIdImpl(id, prefix, timestamp);
  }
  
  /**
   * Create an ID with the given prefix at a specific timestamp
   * @param prefix The prefix to use
   * @param timestamp The timestamp to use
   * @returns A new structured ID with the specified timestamp
   */
  static generateWithTimestamp(prefix: string, timestamp: Date): StructuredId {
    const id = ulid(timestamp.getTime());
    return new StructuredIdImpl(id, prefix, timestamp);
  }
  
  /**
   * Parse an existing ID string into a StructuredId object
   * @param idString The ID string to parse (format: prefix_ulid)
   * @returns The parsed StructuredId or null if invalid
   */
  static parse(idString: string): StructuredId | null {
    const parts = idString.split('_');
    if (parts.length !== 2) return null;
    
    const [prefix, id] = parts;
    
    // Validate that the ID part is a valid ULID
    if (!IdGenerator.isValid(id)) return null;
    
    const timestamp = IdGenerator.getTimestamp(id);
    return new StructuredIdImpl(id, prefix, timestamp);
  }
  
  /**
   * Check if a string is a valid ULID
   * @param idString The string to check
   * @returns True if valid ULID, false otherwise
   */
  static isValid(idString: string): boolean {
    // ULID is 26 characters in Crockford's Base32 (0-9, A-Z except I, L, O, U)
    return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(idString);
  }
  
  /**
   * Extract the timestamp from a ULID
   * @param ulidStr The ULID string
   * @returns The extracted timestamp
   */
  static getTimestamp(ulidStr: string): Date {
    // Use the decodeTime function from the ulid library to extract the timestamp
    const timestampMs = decodeTime(ulidStr);
    return new Date(timestampMs);
  }
}

// Helper factory functions for common types

/**
 * Create a new user ID
 * @returns A structured user ID
 */
export function createUserId(): StructuredId {
  return IdGenerator.generate(IdPrefix.USER);
}

/**
 * Create a new agent ID
 * @returns A structured agent ID
 */
export function createAgentId(): StructuredId {
  return IdGenerator.generate(IdPrefix.AGENT);
}

/**
 * Create a new chat ID
 * @returns A structured chat ID
 */
export function createChatId(): StructuredId {
  return IdGenerator.generate(IdPrefix.CHAT);
}

/**
 * Create a new message ID
 * @returns A structured message ID
 */
export function createMessageId(): StructuredId {
  return IdGenerator.generate(IdPrefix.MESSAGE);
}

/**
 * Create a new memory ID
 * @returns A structured memory ID
 */
export function createMemoryId(): StructuredId {
  return IdGenerator.generate(IdPrefix.MEMORY);
}

/**
 * Create a new knowledge ID
 * @returns A structured knowledge ID
 */
export function createKnowledgeId(): StructuredId {
  return IdGenerator.generate(IdPrefix.KNOWLEDGE);
}

/**
 * Create a new document ID
 * @returns A structured document ID
 */
export function createDocumentId(): StructuredId {
  return IdGenerator.generate(IdPrefix.DOCUMENT);
}

/**
 * Create a new thought ID
 * @returns A structured thought ID
 */
export function createThoughtId(): StructuredId {
  return IdGenerator.generate(IdPrefix.THOUGHT);
}

/**
 * Create a new embedding ID
 * @returns A structured embedding ID
 */
export function createEmbeddingId(): StructuredId {
  return IdGenerator.generate(IdPrefix.EMBEDDING);
} 