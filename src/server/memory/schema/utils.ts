/**
 * Schema Validation Utilities
 * 
 * This module provides utility functions for working with schemas.
 */

import { JSONSchema7 } from 'json-schema';
import { Schema, SchemaType, SchemaVersion, ValidationResult } from './types';
import { SchemaImpl } from './schema';
import { SchemaVersionImpl } from './version';
import { defaultSchemaRegistry } from './registry';
import { SchemaValidationError } from './index';

/**
 * Create a schema with specified options
 * 
 * @param name Schema name
 * @param version Schema version (major.minor or SchemaVersion object)
 * @param type Schema type
 * @param jsonSchema JSON Schema definition
 * @param defaultValues Default values
 * @returns Schema instance
 */
export function createSchema<T>(
  name: string,
  version: string | [number, number] | SchemaVersion,
  type: SchemaType,
  jsonSchema: JSONSchema7,
  defaultValues: Partial<T> = {}
): Schema<T> {
  // Parse version
  let schemaVersion: SchemaVersion;
  
  if (typeof version === 'string') {
    schemaVersion = SchemaVersionImpl.parse(version);
  } else if (Array.isArray(version)) {
    schemaVersion = SchemaVersionImpl.create(version[0], version[1]);
  } else {
    schemaVersion = version;
  }
  
  // Create and return schema
  return new SchemaImpl<T>(name, schemaVersion, type, jsonSchema, defaultValues);
}

/**
 * Validate data against a schema
 * 
 * @param data Data to validate
 * @param schemaName Schema name to validate against
 * @param version Optional schema version (defaults to latest)
 * @param throwOnError Whether to throw on validation error
 * @returns Validation result
 */
export function validateSchema<T>(
  data: unknown, 
  schemaName: string, 
  version?: string | SchemaVersion,
  throwOnError = true
): ValidationResult {
  // Parse version if string
  let schemaVersion: SchemaVersion | undefined;
  if (typeof version === 'string') {
    schemaVersion = SchemaVersionImpl.parse(version);
  } else {
    schemaVersion = version;
  }
  
  // Get schema from registry
  const schema = defaultSchemaRegistry.getSchema<T>(schemaName, schemaVersion);
  
  // Validate data
  const result = schema.validate(data);
  
  // Throw if needed
  if (throwOnError && !result.valid) {
    throw new SchemaValidationError(
      `Invalid ${schemaName} data`,
      result.errors || [],
      { schema: schemaName, version: schema.version.toString() }
    );
  }
  
  return result;
}

/**
 * Check if data conforms to a schema (type guard)
 * 
 * @param data Data to check
 * @param schemaName Schema name to validate against
 * @param version Optional schema version (defaults to latest)
 * @returns Type predicate indicating if data conforms to schema
 */
export function isValidSchema<T>(
  data: unknown, 
  schemaName: string, 
  version?: string | SchemaVersion
): data is T {
  try {
    const result = validateSchema<T>(data, schemaName, version, false);
    return result.valid;
  } catch (error) {
    // Schema not found or other registry error
    return false;
  }
}

/**
 * Create an entity from a schema
 * 
 * @param data Initial data
 * @param schemaName Schema name to use
 * @param version Optional schema version (defaults to latest)
 * @returns Entity with defaults and validation
 */
export function createEntity<T>(
  data: Partial<T>, 
  schemaName: string, 
  version?: string | SchemaVersion
): T {
  // Parse version if string
  let schemaVersion: SchemaVersion | undefined;
  if (typeof version === 'string') {
    schemaVersion = SchemaVersionImpl.parse(version);
  } else {
    schemaVersion = version;
  }
  
  // Get schema from registry
  const schema = defaultSchemaRegistry.getSchema<T>(schemaName, schemaVersion);
  
  // Create entity
  return schema.create(data);
} 