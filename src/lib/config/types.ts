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
 * Options for configuration validation
 */
export interface ValidationOptions {
  /** Whether to throw on validation error */
  throwOnError?: boolean;
  
  /** Whether to apply defaults for missing properties */
  applyDefaults?: boolean;
  
  /** Whether to remove additional properties not in schema */
  removeAdditional?: boolean;
  
  /** Whether to allow undefined values for non-required properties */
  allowUndefined?: boolean;
  
  /** Whether to show trace in errors for easier debugging */
  showTrace?: boolean;
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