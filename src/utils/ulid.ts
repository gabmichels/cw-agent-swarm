/**
 * ULID (Universally Unique Lexicographically Sortable Identifier) implementation
 * Replaces timestamp-based IDs with a robust, sortable, unique ID system
 */
import { ulid, decodeTime } from 'ulid';

/**
 * @deprecated Use string IDs directly instead of StructuredId objects. 
 * This interface will be removed in a future version.
 */
export interface StructuredId {
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
  EMBEDDING = 'embd'
}

// Add logging utility
function logDeprecatedUsage(functionName: string) {
  console.warn(
    `[DEPRECATED] ${functionName} using StructuredId is deprecated and will be removed in a future version. ` +
    'Use string IDs directly instead.'
  );
  // Log stack trace to help identify usage locations
  console.warn(new Error().stack);
}

/**
 * @deprecated Use IdGenerator.generate(prefix).toString() directly instead
 */
class StructuredIdImpl implements StructuredId {
  public readonly namespace: string;
  public readonly type: string;
  public readonly id: string;
  public readonly version?: number;

  constructor(id: string, prefix: string, timestamp: Date) {
    logDeprecatedUsage('StructuredIdImpl constructor');
    this.id = id;
    this.namespace = prefix;
    this.type = prefix;
  }

  /**
   * Get the string representation (prefix_ulid)
   */
  toString(): string {
    return `${this.namespace}_${this.id}`;
  }

  /**
   * Get the raw ULID
   */
  toULID(): string {
    return this.id;
  }

  /**
   * Get the timestamp from the ULID
   */
  getTimestamp(): Date {
    return new Date(this.id);
  }
}

/**
 * Generator for creating and parsing structured IDs
 */
export class IdGenerator {
  /**
   * @deprecated Use generate(prefix).toString() directly instead
   */
  static parse(idString: string): StructuredId | null {
    logDeprecatedUsage('IdGenerator.parse');
    const parts = idString.split('_');
    if (parts.length !== 2) return null;
    
    const [prefix, id] = parts;
    
    // Validate that the ID part is a valid ULID
    if (!IdGenerator.isValid(id)) return null;
    
    const timestamp = IdGenerator.getTimestamp(id);
    return IdGenerator.generate(prefix);
  }
  
  /**
   * Generate a new ID with the given prefix
   * @param prefix The prefix to use for the ID
   * @returns A StructuredId object
   */
  static generate(prefix: string): StructuredId {
    const timestamp = new Date();
    const id = ulid(timestamp.getTime());
    return {
      // New properties
      namespace: prefix,
      type: prefix,
      id: id,

      // Legacy properties
      prefix: prefix,
      timestamp: timestamp,

      // Methods
      toString() {
        return `${prefix}_${id}`;
      },
      toULID() {
        return id;
      },
      getTimestamp() {
        return timestamp;
      }
    };
  }
  
  /**
   * @deprecated Use generate(prefix) directly instead
   */
  static generateWithTimestamp(prefix: string, timestamp: Date): StructuredId {
    logDeprecatedUsage('IdGenerator.generateWithTimestamp');
    const id = ulid(timestamp.getTime());
    return {
      // New properties
      namespace: prefix,
      type: prefix,
      id: id,

      // Legacy properties
      prefix: prefix,
      timestamp: timestamp,

      // Methods
      toString() {
        return `${prefix}_${id}`;
      },
      toULID() {
        return id;
      },
      getTimestamp() {
        return timestamp;
      }
    };
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

/**
 * @deprecated Use IdGenerator.generate('user').toString() directly
 */
export function createUserId(): string {
  logDeprecatedUsage('createUserId');
  return IdGenerator.generate('user').toString();
}

/**
 * @deprecated Use IdGenerator.generate('agent').toString() directly
 */
export function createAgentId(): string {
  logDeprecatedUsage('createAgentId');
  return IdGenerator.generate('agent').toString();
}

/**
 * @deprecated Use IdGenerator.generate('chat').toString() directly
 */
export function createChatId(): string {
  logDeprecatedUsage('createChatId');
  return IdGenerator.generate('chat').toString();
}

/**
 * @deprecated Use IdGenerator.generate('message').toString() directly
 */
export function createMessageId(): string {
  logDeprecatedUsage('createMessageId');
  return IdGenerator.generate('message').toString();
}

/**
 * @deprecated Use IdGenerator.generate('memory').toString() directly
 */
export function createMemoryId(): string {
  logDeprecatedUsage('createMemoryId');
  return IdGenerator.generate('memory').toString();
}

/**
 * @deprecated Use IdGenerator.generate('knowledge').toString() directly
 */
export function createKnowledgeId(): string {
  logDeprecatedUsage('createKnowledgeId');
  return IdGenerator.generate('knowledge').toString();
}

/**
 * @deprecated Use IdGenerator.generate('document').toString() directly
 */
export function createDocumentId(): string {
  logDeprecatedUsage('createDocumentId');
  return IdGenerator.generate('document').toString();
}

/**
 * @deprecated Use IdGenerator.generate('thought').toString() directly
 */
export function createThoughtId(): string {
  logDeprecatedUsage('createThoughtId');
  return IdGenerator.generate('thought').toString();
}

/**
 * @deprecated Use IdGenerator.generate('embedding').toString() directly
 */
export function createEmbeddingId(): string {
  logDeprecatedUsage('createEmbeddingId');
  return IdGenerator.generate('embedding').toString();
} 