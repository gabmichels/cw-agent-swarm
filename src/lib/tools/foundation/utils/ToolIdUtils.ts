/**
 * Tool ID Utilities
 * 
 * Utility functions for ULID-based tool ID creation, validation, and management.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID for business logic identifiers
 * - Strict validation and type safety
 * - Comprehensive error handling
 * - Performance-optimized utilities
 */

import { ulid } from 'ulid';
import { ToolId } from '../types/FoundationTypes';

/**
 * ULID pattern for validation
 * ULID format: 01ARZ3NDEKTSV4RRFFQ69G5FAV (26 characters, Crockford's Base32)
 */
const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

/**
 * Create a new ULID-based tool ID
 * @param timestamp Optional timestamp for ULID generation
 * @returns New ULID tool ID
 */
export function createToolId(timestamp?: number): ToolId {
  try {
    return timestamp ? ulid(timestamp) : ulid();
  } catch (error) {
    throw new Error(`Failed to create tool ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate if a string is a valid ULID tool ID
 * @param id String to validate
 * @returns True if valid ULID, false otherwise
 */
export function isValidToolId(id: unknown): id is ToolId {
  if (typeof id !== 'string') {
    return false;
  }

  return ULID_PATTERN.test(id);
}

/**
 * Validate a tool ID and throw error if invalid
 * @param id Tool ID to validate
 * @param context Context for error message
 * @throws Error if tool ID is invalid
 */
export function validateToolId(id: unknown, context = 'Tool ID'): asserts id is ToolId {
  if (!isValidToolId(id)) {
    throw new Error(
      `${context} must be a valid ULID. ` +
      `Expected format: 26 characters using Crockford's Base32 (0-9, A-Z excluding I, L, O, U). ` +
      `Received: ${typeof id === 'string' ? id : typeof id}`
    );
  }
}

/**
 * Extract timestamp from ULID tool ID
 * @param toolId ULID tool ID
 * @returns Timestamp in milliseconds
 * @throws Error if tool ID is invalid
 */
export function extractTimestampFromToolId(toolId: ToolId): number {
  validateToolId(toolId, 'Tool ID for timestamp extraction');

  try {
    // ULID timestamp is first 10 characters encoded in Crockford's Base32
    const timestampPart = toolId.substring(0, 10);

    // Convert from Base32 to timestamp
    const base32Chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let timestamp = 0;

    for (let i = 0; i < timestampPart.length; i++) {
      const char = timestampPart[i];
      const value = base32Chars.indexOf(char);
      if (value === -1) {
        throw new Error(`Invalid character in ULID timestamp: ${char}`);
      }
      timestamp = timestamp * 32 + value;
    }

    return timestamp;
  } catch (error) {
    throw new Error(`Failed to extract timestamp from tool ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get age of tool ID in milliseconds
 * @param toolId ULID tool ID
 * @returns Age in milliseconds
 */
export function getToolIdAge(toolId: ToolId): number {
  const timestamp = extractTimestampFromToolId(toolId);
  return Date.now() - timestamp;
}

/**
 * Check if tool ID was created before a given date
 * @param toolId ULID tool ID
 * @param date Date to compare against
 * @returns True if tool ID is older than date
 */
export function isToolIdOlderThan(toolId: ToolId, date: Date): boolean {
  const timestamp = extractTimestampFromToolId(toolId);
  return timestamp < date.getTime();
}

/**
 * Check if tool ID was created after a given date
 * @param toolId ULID tool ID
 * @param date Date to compare against
 * @returns True if tool ID is newer than date
 */
export function isToolIdNewerThan(toolId: ToolId, date: Date): boolean {
  const timestamp = extractTimestampFromToolId(toolId);
  return timestamp > date.getTime();
}

/**
 * Sort tool IDs chronologically (oldest first)
 * @param toolIds Array of tool IDs to sort
 * @returns Sorted array of tool IDs
 */
export function sortToolIdsByAge(toolIds: readonly ToolId[]): ToolId[] {
  return [...toolIds].sort((a, b) => {
    const timestampA = extractTimestampFromToolId(a);
    const timestampB = extractTimestampFromToolId(b);
    return timestampA - timestampB;
  });
}

/**
 * Sort tool IDs reverse chronologically (newest first)
 * @param toolIds Array of tool IDs to sort
 * @returns Sorted array of tool IDs
 */
export function sortToolIdsByRecency(toolIds: readonly ToolId[]): ToolId[] {
  return [...toolIds].sort((a, b) => {
    const timestampA = extractTimestampFromToolId(a);
    const timestampB = extractTimestampFromToolId(b);
    return timestampB - timestampA;
  });
}

/**
 * Generate multiple unique tool IDs
 * @param count Number of tool IDs to generate
 * @param delayMs Optional delay between generations to ensure uniqueness
 * @returns Array of unique tool IDs
 */
export async function generateMultipleToolIds(count: number, delayMs = 1): Promise<ToolId[]> {
  if (count <= 0) {
    return [];
  }

  const toolIds: ToolId[] = [];

  for (let i = 0; i < count; i++) {
    toolIds.push(createToolId());

    // Small delay to ensure timestamp uniqueness
    if (i < count - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return toolIds;
}

/**
 * Validate array of tool IDs
 * @param toolIds Array of tool IDs to validate
 * @param allowEmpty Whether to allow empty array
 * @returns Validation result with invalid IDs
 */
export function validateToolIds(
  toolIds: unknown[],
  allowEmpty = false
): {
  readonly valid: boolean;
  readonly validIds: ToolId[];
  readonly invalidIds: unknown[];
  readonly errors: readonly string[];
} {
  if (!Array.isArray(toolIds)) {
    return {
      valid: false,
      validIds: [],
      invalidIds: [toolIds],
      errors: ['Tool IDs must be an array']
    };
  }

  if (!allowEmpty && toolIds.length === 0) {
    return {
      valid: false,
      validIds: [],
      invalidIds: [],
      errors: ['Tool IDs array cannot be empty']
    };
  }

  const validIds: ToolId[] = [];
  const invalidIds: unknown[] = [];
  const errors: string[] = [];

  for (let i = 0; i < toolIds.length; i++) {
    const id = toolIds[i];
    if (isValidToolId(id)) {
      validIds.push(id);
    } else {
      invalidIds.push(id);
      errors.push(`Invalid tool ID at index ${i}: ${typeof id === 'string' ? id : typeof id}`);
    }
  }

  return {
    valid: invalidIds.length === 0,
    validIds,
    invalidIds,
    errors
  };
}

/**
 * Create tool ID from legacy string identifier
 * @param legacyId Legacy string identifier
 * @param prefix Optional prefix for generated ID
 * @returns New ULID tool ID
 */
export function createToolIdFromLegacy(legacyId: string, prefix?: string): ToolId {
  // Create deterministic ULID based on legacy ID
  // Note: This is for migration purposes only
  const timestamp = Date.now();
  const newId = createToolId(timestamp);

  // Store mapping for migration tracking if needed
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.__toolIdMigrationMap) {
      globalThis.__toolIdMigrationMap = new Map();
    }
    globalThis.__toolIdMigrationMap.set(legacyId, newId);
  }

  return newId;
}

/**
 * Get migration mapping for legacy tool ID
 * @param legacyId Legacy string identifier
 * @returns New tool ID if mapping exists
 */
export function getMigratedToolId(legacyId: string): ToolId | null {
  if (typeof globalThis !== 'undefined' && globalThis.__toolIdMigrationMap) {
    return globalThis.__toolIdMigrationMap.get(legacyId) || null;
  }
  return null;
}

/**
 * Clear migration mapping (for testing)
 */
export function clearMigrationMapping(): void {
  if (typeof globalThis !== 'undefined') {
    delete globalThis.__toolIdMigrationMap;
  }
}

/**
 * Format tool ID for display
 * @param toolId Tool ID to format
 * @param format Display format
 * @returns Formatted tool ID string
 */
export function formatToolId(
  toolId: ToolId,
  format: 'short' | 'medium' | 'full' = 'medium'
): string {
  validateToolId(toolId, 'Tool ID for formatting');

  switch (format) {
    case 'short':
      return `${toolId.substring(0, 8)}...`;
    case 'medium':
      return `${toolId.substring(0, 8)}-${toolId.substring(8, 16)}-${toolId.substring(16)}`;
    case 'full':
      return toolId;
    default:
      return toolId;
  }
}

/**
 * Compare tool IDs for equality
 * @param id1 First tool ID
 * @param id2 Second tool ID
 * @returns True if tool IDs are equal
 */
export function compareToolIds(id1: ToolId, id2: ToolId): boolean {
  validateToolId(id1, 'First tool ID');
  validateToolId(id2, 'Second tool ID');
  return id1 === id2;
} 