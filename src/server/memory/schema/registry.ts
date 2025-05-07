/**
 * Schema Registry Implementation
 * 
 * This module implements the SchemaRegistry interface for managing schema definitions.
 */

import { Schema, SchemaRegistry, SchemaVersion } from './types';
import { SchemaNotFoundError, SchemaVersionError } from './errors';

/**
 * Implementation of the SchemaRegistry interface
 */
export class SchemaRegistryImpl implements SchemaRegistry {
  /**
   * Schemas organized by name and version
   * Map<SchemaName, Map<VersionString, Schema>>
   */
  private schemas: Map<string, Map<string, Schema<unknown>>> = new Map();
  
  /**
   * Register a schema
   * 
   * @param schema The schema to register
   * @throws SchemaVersionError if a schema with the same name and version already exists
   */
  register<T>(schema: Schema<T>): void {
    const { name, version } = schema;
    const versionString = version.toString();
    
    // Create map for schema name if it doesn't exist
    if (!this.schemas.has(name)) {
      this.schemas.set(name, new Map());
    }
    
    // Add schema to version map
    const versionMap = this.schemas.get(name)!;
    if (versionMap.has(versionString)) {
      throw new SchemaVersionError(
        `Schema ${name} ${versionString} is already registered`,
        { name, version: versionString }
      );
    }
    
    versionMap.set(versionString, schema as Schema<unknown>);
  }
  
  /**
   * Get a schema by name and version
   * 
   * @param name Schema name
   * @param version Optional schema version (defaults to latest)
   * @returns The requested schema
   * @throws SchemaNotFoundError if no matching schema is found
   */
  getSchema<T>(name: string, version?: SchemaVersion): Schema<T> {
    // Get version map for schema name
    const versionMap = this.schemas.get(name);
    if (!versionMap) {
      throw new SchemaNotFoundError(name);
    }
    
    // If version is not specified, get the latest version
    if (!version) {
      return this.getLatestSchema<T>(name);
    }
    
    // Get schema for specific version
    const versionString = version.toString();
    const schema = versionMap.get(versionString);
    if (!schema) {
      throw new SchemaNotFoundError(name, versionString);
    }
    
    return schema as Schema<T>;
  }
  
  /**
   * Get the latest schema for a name
   * 
   * @param name Schema name
   * @returns The latest version of the schema
   * @throws SchemaNotFoundError if no schema with the given name exists
   */
  getLatestSchema<T>(name: string): Schema<T> {
    // Get version map for schema name
    const versionMap = this.schemas.get(name);
    if (!versionMap || versionMap.size === 0) {
      throw new SchemaNotFoundError(name);
    }
    
    // Find the latest version
    let latestSchema: Schema<unknown> | undefined;
    let latestVersion: SchemaVersion | undefined;
    
    // Convert the map values to an array first to avoid iteration issues
    const schemas = Array.from(versionMap.values());
    
    for (const schema of schemas) {
      if (!latestVersion || schema.version.isNewerThan(latestVersion)) {
        latestVersion = schema.version;
        latestSchema = schema;
      }
    }
    
    return latestSchema as Schema<T>;
  }
  
  /**
   * Get all versions of a schema
   * 
   * @param name Schema name
   * @returns Array of schema versions, sorted from oldest to newest
   */
  getSchemaVersions(name: string): Schema<unknown>[] {
    // Get version map for schema name
    const versionMap = this.schemas.get(name);
    if (!versionMap) {
      return [];
    }
    
    // Convert to array and sort by version
    return Array.from(versionMap.values())
      .sort((a, b) => 
        a.version.isNewerThan(b.version) ? 1 : 
        b.version.isNewerThan(a.version) ? -1 : 0
      );
  }
  
  /**
   * Check if a schema exists
   * 
   * @param name Schema name
   * @param version Optional schema version
   * @returns True if the schema exists
   */
  hasSchema(name: string, version?: SchemaVersion): boolean {
    const versionMap = this.schemas.get(name);
    if (!versionMap) {
      return false;
    }
    
    if (!version) {
      return true;
    }
    
    return versionMap.has(version.toString());
  }
}

/**
 * Create a new schema registry
 */
export function createSchemaRegistry(): SchemaRegistry {
  return new SchemaRegistryImpl();
}

/**
 * Global default schema registry instance
 */
export const defaultSchemaRegistry = createSchemaRegistry(); 