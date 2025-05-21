/**
 * Request utilities for generating and managing request IDs.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique request ID
 * @returns A new unique request ID
 */
export function generateRequestId(): string {
  return `req-${uuidv4()}`;
}

/**
 * Check if a string is a valid request ID
 * @param id The ID to check
 * @returns True if the ID is a valid request ID
 */
export function isValidRequestId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('req-') && id.length > 10;
} 