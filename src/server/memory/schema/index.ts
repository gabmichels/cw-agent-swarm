/**
 * Schema Validation System - Entry Point
 * 
 * This module exports all components of the schema validation system.
 */

// Export types
export * from './types';

// Export schema implementation
export { SchemaImpl } from './schema';

// Export version implementation
export { SchemaVersionImpl } from './version';

// Export errors
export { 
  SchemaError,
  SchemaNotFoundError,
  SchemaVersionError,
  SchemaDefinitionError,
  // Export ValidationError with a different name to avoid naming conflict
  ValidationError as SchemaValidationError
} from './errors';

// Export registry
export { 
  SchemaRegistryImpl, 
  createSchemaRegistry, 
  defaultSchemaRegistry 
} from './registry';

// Export migration
export { 
  SchemaMigrationService,
  createMigrationService,
  defaultMigrationService
} from './migration';

// Re-export type for SchemaMigration
export type { SchemaMigration } from './migration';

// Export utility functions
export {
  createSchema,
  validateSchema,
  isValidSchema,
  createEntity
} from './utils'; 