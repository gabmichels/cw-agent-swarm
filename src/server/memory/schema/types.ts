/**
 * Schema Validation System - Type Definitions
 * 
 * This module provides type definitions for the schema validation system.
 * It follows the schema versioning strategy and ensures type safety.
 */

import { JSONSchema7 } from 'json-schema';
import { StructuredId } from '../../../utils/ulid';

/**
 * Schema validation result
 */
export interface ValidationResult {
  /**
   * Whether the data is valid
   */
  valid: boolean;
  
  /**
   * Validation errors (if any)
   */
  errors?: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  /**
   * The field that has the error
   */
  field: string;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Validation rule that failed
   */
  rule?: string;
  
  /**
   * Expected value or format
   */
  expected?: string;
  
  /**
   * Received value
   */
  received?: string;
}

/**
 * Schema version
 */
export interface SchemaVersion {
  /**
   * Major version for breaking changes
   */
  major: number;
  
  /**
   * Minor version for backward-compatible additions
   */
  minor: number;
  
  /**
   * String representation (vMAJOR.MINOR)
   */
  toString(): string;
  
  /**
   * Check if this version is newer than another
   */
  isNewerThan(other: SchemaVersion): boolean;
  
  /**
   * Check if this version is compatible with another
   */
  isCompatibleWith(other: SchemaVersion): boolean;
}

/**
 * Schema type enum
 */
export enum SchemaType {
  /**
   * Entity schema (for database records)
   */
  ENTITY = 'entity',
  
  /**
   * DTO schema (for API requests/responses)
   */
  DTO = 'dto',
  
  /**
   * Config schema (for configuration)
   */
  CONFIG = 'config'
}

/**
 * Base schema interface
 */
export interface Schema<T> {
  /**
   * Schema name (e.g., "chat_memory")
   */
  name: string;
  
  /**
   * Schema version
   */
  version: SchemaVersion;
  
  /**
   * Schema type
   */
  type: SchemaType;
  
  /**
   * JSON Schema definition
   */
  jsonSchema: JSONSchema7;
  
  /**
   * Validate data against this schema
   */
  validate(data: unknown): ValidationResult;
  
  /**
   * Check if data conforms to this schema (type guard)
   */
  isValid(data: unknown): data is T;
  
  /**
   * Get default values for this schema
   */
  getDefaults(): Partial<T>;
  
  /**
   * Create an entity with defaults filled in
   */
  create(data: Partial<T>): T;
}

/**
 * Schema registry interface
 */
export interface SchemaRegistry {
  /**
   * Register a schema
   */
  register<T>(schema: Schema<T>): void;
  
  /**
   * Get a schema by name and version
   */
  getSchema<T>(name: string, version?: SchemaVersion): Schema<T>;
  
  /**
   * Get the latest schema for a name
   */
  getLatestSchema<T>(name: string): Schema<T>;
  
  /**
   * Get all versions of a schema
   */
  getSchemaVersions(name: string): Schema<unknown>[];
  
  /**
   * Check if a schema exists
   */
  hasSchema(name: string, version?: SchemaVersion): boolean;
}

/**
 * Base memory entity interface that all memory entities should implement
 */
export interface BaseMemoryEntity {
  /**
   * Entity ID
   */
  id: string;
  
  /**
   * Entity content
   */
  content: string;
  
  /**
   * Memory type
   */
  type: string;
  
  /**
   * Creation timestamp
   */
  createdAt: Date;
  
  /**
   * Last update timestamp
   */
  updatedAt: Date;
  
  /**
   * Entity metadata
   */
  metadata: Record<string, unknown>;
  
  /**
   * Schema version
   */
  schemaVersion: string;
}

/**
 * Schema validator configuration
 */
export interface SchemaValidatorOptions {
  /**
   * Whether to throw an error on validation failure
   * @default true
   */
  throwOnError?: boolean;
  
  /**
   * Whether to apply defaults to missing fields
   * @default true
   */
  applyDefaults?: boolean;
  
  /**
   * Whether to remove additional properties not in the schema
   * @default true
   */
  removeAdditional?: boolean;
  
  /**
   * Whether to coerce types (e.g., string -> number)
   * @default true
   */
  coerceTypes?: boolean;
} 