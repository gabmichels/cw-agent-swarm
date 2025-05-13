/**
 * Configuration System Types
 * 
 * This module defines the core types and interfaces for the configuration system,
 * including schema definitions and validation options.
 */

/**
 * Basic types supported by the configuration schema
 */
export type ConfigPropertyType = 
  'string' | 
  'number' | 
  'boolean' | 
  'object' | 
  'array' | 
  'enum' | 
  'any';

/**
 * Schema for a configuration property
 */
export interface ConfigPropertySchema<T = unknown> {
  /** The type of the property */
  type: ConfigPropertyType;
  
  /** Whether the property is required */
  required?: boolean;
  
  /** Default value for the property if not specified */
  default?: T;
  
  /** Description of the property for documentation */
  description?: string;
  
  /** For number types: minimum value */
  min?: number;
  
  /** For number types: maximum value */
  max?: number;
  
  /** For string types: regex pattern to match */
  pattern?: RegExp;
  
  /** For enum types: allowed values */
  enum?: unknown[];
  
  /** For array types: item schema */
  items?: ConfigPropertySchema;
  
  /** For object types: property schemas */
  properties?: ConfigSchema<Record<string, unknown>>;
  
  /** Custom validation function */
  validate?: (value: unknown, path: string) => boolean | { valid: boolean; error?: string };
}

/**
 * Schema for a configuration object
 */
export type ConfigSchema<T extends Record<string, unknown>> = {
  [K in keyof T]: ConfigPropertySchema<T[K]>;
};

/**
 * Cross-property validation definition
 */
export interface CrossPropertyValidation<T extends Record<string, unknown>> {
  /** Properties involved in this validation */
  properties: Array<keyof T>;
  
  /** Validation function that checks the relationship between properties */
  validate: (config: Partial<T>) => boolean;
  
  /** Error message to display when validation fails */
  message?: string;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Whether to throw an error if validation fails */
  throwOnError?: boolean;
  
  /** Whether to apply default values to missing properties */
  applyDefaults?: boolean;
  
  /** Whether to remove properties not defined in the schema */
  removeAdditional?: boolean;
  
  /** Cross-property validations to run */
  crossValidations?: CrossPropertyValidation<any>[];
}

/**
 * Result of configuration validation
 */
export interface ValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  
  /** Any validation errors */
  errors?: Error[];
  
  /** Validated and possibly transformed configuration */
  config?: Record<string, unknown>;
}

/**
 * Configuration validator interface
 */
export interface ConfigValidator<T extends Record<string, unknown>> {
  /**
   * Validate a configuration against a schema
   * @param config The configuration to validate
   * @param options Validation options
   * @returns Validation result
   */
  validate(config: Partial<T>, options?: ValidationOptions): ValidationResult;
  
  /**
   * Apply defaults to a configuration
   * @param config The configuration to apply defaults to
   * @returns Configuration with defaults applied
   */
  applyDefaults(config: Partial<T>): Partial<T>;
}

/**
 * Default provider interface
 */
export interface DefaultsProvider<T extends Record<string, unknown>> {
  /**
   * Apply defaults to a configuration
   * @param config The configuration to apply defaults to
   * @returns Configuration with defaults applied
   */
  applyDefaults(config: Partial<T>): Partial<T>;
  
  /**
   * Get the default value for a property
   * @param propertyPath The property path
   * @returns The default value
   */
  getDefaultValue<K extends keyof T>(propertyPath: K): T[K] | undefined;
  
  /**
   * Check if a property has a default value
   * @param propertyPath The property path
   * @returns Whether the property has a default value
   */
  hasDefaultValue<K extends keyof T>(propertyPath: K): boolean;
}

/**
 * Configuration update strategy
 */
export enum UpdateStrategy {
  /** Replace the configuration entirely */
  REPLACE = 'replace',
  
  /** Merge the new configuration into the existing one */
  MERGE = 'merge',
  
  /** Deep merge the new configuration into the existing one */
  DEEP_MERGE = 'deep_merge'
}

/**
 * Configuration preset provider interface
 */
export interface PresetProvider<T extends Record<string, unknown>> {
  /**
   * Get a configuration preset by name
   * @param presetName The preset name
   * @returns The preset configuration
   */
  getPreset(presetName: string): Partial<T>;
  
  /**
   * Get all available preset names
   * @returns Array of preset names
   */
  getAvailablePresets(): string[];
  
  /**
   * Check if a preset exists
   * @param presetName The preset name to check
   * @returns Whether the preset exists
   */
  hasPreset(presetName: string): boolean;
}

/**
 * Configuration schema with version information
 */
export type VersionedConfigSchema<T extends Record<string, unknown>> = ConfigSchema<T> & {
  /** Version of this schema */
  version: {
    type: 'string';
    required: true;
    default?: string;
    description: string;
  };
}

/**
 * Configuration migration function
 */
export type MigrationFunction<T extends Record<string, unknown>> = (
  config: Partial<T>, 
  fromVersion: string, 
  toVersion: string
) => Partial<T>;

/**
 * Configuration migration definition
 */
export interface ConfigMigration<T extends Record<string, unknown>> {
  /** From version */
  fromVersion: string;
  
  /** To version */
  toVersion: string;
  
  /** Migration function */
  migrate: MigrationFunction<T>;
  
  /** Optional description of the migration */
  description?: string;
}

/**
 * Migration manager interface
 */
export interface MigrationManager<T extends Record<string, unknown>> {
  /**
   * Register a migration
   * @param migration Migration to register
   * @returns The migration manager
   */
  registerMigration(migration: ConfigMigration<T>): MigrationManager<T>;
  
  /**
   * Get available migrations
   * @returns Array of registered migrations
   */
  getMigrations(): ConfigMigration<T>[];
  
  /**
   * Migrate a configuration from one version to another
   * @param config Configuration to migrate
   * @param fromVersion Source version
   * @param toVersion Target version (defaults to latest)
   * @returns Migrated configuration
   */
  migrateConfig(
    config: Partial<T>, 
    fromVersion: string, 
    toVersion?: string
  ): Partial<T>;
  
  /**
   * Check if a migration path exists
   * @param fromVersion Source version
   * @param toVersion Target version
   * @returns Whether a migration path exists
   */
  canMigrate(fromVersion: string, toVersion: string): boolean;
  
  /**
   * Get the latest schema version
   * @returns The latest version
   */
  getLatestVersion(): string;
  
  /**
   * Set the latest schema version
   * @param version The new latest version
   */
  setLatestVersion(version: string): void;
} 