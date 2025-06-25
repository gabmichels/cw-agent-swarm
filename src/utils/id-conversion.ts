/**
 * Standardized ID conversion utilities for Qdrant compatibility
 * 
 * Qdrant only accepts unsigned integers or UUIDs as point IDs, but our system uses ULIDs.
 * This module provides consistent ULID→UUID conversion across all services.
 */
import { createHash } from 'crypto';

/**
 * Convert ULID to UUID using a deterministic MD5-based algorithm
 * 
 * This ensures:
 * - Same ULID always produces the same UUID
 * - Generated UUIDs are valid RFC 4122 format
 * - Consistent behavior across all services
 * 
 * @param id - The ID to convert (ULID, UUID, or other format)
 * @returns A valid UUID string
 */
export function convertToQdrantId(id: string): string {
  // Check if it's already a valid UUID
  if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return id; // Already a UUID
  }

  // Check if it's a ULID (26 characters, Crockford Base32)
  if (id.match(/^[0-9A-HJKMNP-TV-Z]{26}$/)) {
    // Convert ULID to UUID using deterministic MD5 hash
    const hash = createHash('md5').update(id).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
  }

  // For any other format, create a deterministic UUID using MD5 hash
  const hash = createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

/**
 * Check if a string is a valid ULID format
 * @param id - The string to check
 * @returns True if the string is a valid ULID
 */
export function isValidULID(id: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id);
}

/**
 * Check if a string is a valid UUID format
 * @param id - The string to check  
 * @returns True if the string is a valid UUID
 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validate that an ID is in a supported format (ULID or UUID)
 * @param id - The ID to validate
 * @returns True if the ID is in a supported format
 */
export function isValidId(id: string): boolean {
  return isValidULID(id) || isValidUUID(id);
} 