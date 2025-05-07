/**
 * Migration utilities for converting timestamp-based IDs to ULID format
 */
import { IdGenerator, IdPrefix } from './ulid';

/**
 * Options for migrating timestamp-based IDs to ULID format
 */
export interface MigrationOptions {
  // Whether to preserve the original timestamp in the generated ULID
  preserveTimestamp?: boolean;
}

/**
 * Convert a timestamp-based ID to a structured ULID
 * @param legacyId The legacy timestamp-based ID to convert
 * @param prefix The prefix to use for the new ID
 * @param options Migration options
 * @returns A structured ID in the new format
 */
export function migrateTimestampId(
  legacyId: string,
  prefix: IdPrefix | string,
  options: MigrationOptions = {}
) {
  // Extract timestamp if it appears to be a timestamp-based ID
  let timestamp = new Date();
  
  // If we want to preserve the timestamp and the legacy ID is timestamp-based
  if (options.preserveTimestamp && /^\d+/.test(legacyId)) {
    const timestampMatch = legacyId.match(/^(\d+)/);
    if (timestampMatch) {
      const timestampStr = timestampMatch[1];
      // Handle both milliseconds and seconds timestamps
      const parsedTimestamp = parseInt(timestampStr, 10);
      if (parsedTimestamp < 10000000000) { // If seconds (before 2286)
        timestamp = new Date(parsedTimestamp * 1000);
      } else { // If milliseconds
        timestamp = new Date(parsedTimestamp);
      }
    }
  }
  
  // Generate a new ULID with the extracted timestamp
  return IdGenerator.generateWithTimestamp(prefix, timestamp);
}

/**
 * Batch migrate an array of objects containing timestamp-based IDs
 * @param items Array of objects with IDs to migrate
 * @param idField The field name containing the ID to migrate
 * @param targetPrefix The prefix to use for the new IDs
 * @param options Migration options
 * @returns Array of objects with migrated IDs
 */
export function batchMigrateIds<T extends Record<string, any>>(
  items: T[],
  idField: keyof T,
  targetPrefix: IdPrefix | string,
  options: MigrationOptions = {}
): T[] {
  return items.map(item => {
    const legacyId = item[idField] as string;
    const newId = migrateTimestampId(legacyId, targetPrefix, options);
    
    // Create a new object with the migrated ID
    return {
      ...item,
      [idField]: newId.toString(),
      // Optional: store the legacy ID if needed for reference
      // legacyId: item[idField]
    };
  });
}

/**
 * Extract a date from a timestamp-based legacy ID
 * This is useful for data analysis during migration
 * @param legacyId The legacy timestamp-based ID
 * @returns The extracted date or null if not a timestamp
 */
export function extractDateFromLegacyId(legacyId: string): Date | null {
  if (!/^\d+/.test(legacyId)) return null;
  
  const timestampMatch = legacyId.match(/^(\d+)/);
  if (!timestampMatch) return null;
  
  const timestampStr = timestampMatch[1];
  const parsedTimestamp = parseInt(timestampStr, 10);
  
  // Handle both milliseconds and seconds timestamps
  if (parsedTimestamp < 10000000000) { // If seconds (before 2286)
    return new Date(parsedTimestamp * 1000);
  } else { // If milliseconds
    return new Date(parsedTimestamp);
  }
} 