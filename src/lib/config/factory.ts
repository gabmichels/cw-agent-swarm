/**
 * Configuration Factory
 * 
 * This module provides a factory class for creating validated configurations
 * from schemas with support for defaults, validation, and inheritance.
 */

import { 
  ConfigPropertySchema,
  ConfigSchema,
  ValidationOptions,
  ValidationResult,
  ConfigValidator,
  DefaultsProvider,
  UpdateStrategy
} from './types';

import { 
  validateConfig, 
  validateValue 
} from './validators';

import {
  ConfigValidationError,
  ValidationError
} from './errors';

/**
 * Default provider implementation
 */
export class ConfigDefaultsProvider<T extends Record<string, unknown>> implements DefaultsProvider<T> {
  constructor(private schema: ConfigSchema<T>) {}

  /**
   * Apply defaults to a configuration
   */
  applyDefaults(config: Partial<T>): Partial<T> {
    const result = { ...config };
    
    for (const [key, schema] of Object.entries(this.schema)) {
      if (result[key as keyof T] === undefined && schema.default !== undefined) {
        result[key as keyof T] = schema.default as any;
      }
    }
    
    return result;
  }
  
  /**
   * Get the default value for a property
   */
  getDefaultValue<K extends keyof T>(propertyPath: K): T[K] | undefined {
    const schema = this.schema[propertyPath];
    return schema?.default as T[K];
  }
  
  /**
   * Check if a property has a default value
   */
  hasDefaultValue<K extends keyof T>(propertyPath: K): boolean {
    const schema = this.schema[propertyPath];
    return schema?.default !== undefined;
  }
}

/**
 * Configuration factory for creating validated configurations
 */
export class ConfigFactory<T extends Record<string, unknown>> implements ConfigValidator<T> {
  private defaultsProvider: DefaultsProvider<T>;
  
  constructor(private schema: ConfigSchema<T>) {
    this.defaultsProvider = new ConfigDefaultsProvider<T>(schema);
  }
  
  /**
   * Set a custom defaults provider
   */
  setDefaultsProvider(provider: DefaultsProvider<T>): void {
    this.defaultsProvider = provider;
  }
  
  /**
   * Get the defaults provider
   */
  getDefaultsProvider(): DefaultsProvider<T> {
    return this.defaultsProvider;
  }
  
  /**
   * Get the schema
   */
  getSchema(): ConfigSchema<T> {
    return this.schema;
  }
  
  /**
   * Create a new configuration
   */
  create(config: Partial<T>, options: ValidationOptions = {}): T {
    // Apply defaults first
    const withDefaults = this.applyDefaults(config);
    
    // Validate
    const result = this.validate(withDefaults, options);
    
    if (!result.valid) {
      if (options.throwOnError !== false) {
        throw new ConfigValidationError(
          'Configuration validation failed',
          result.errors as ValidationError[]
        );
      }
      
      // Return partial config if validation failed but throwing is disabled
      return withDefaults as T;
    }
    
    return result.config as T;
  }
  
  /**
   * Update an existing configuration
   */
  update(
    current: T, 
    updates: Partial<T>, 
    strategy: UpdateStrategy = UpdateStrategy.MERGE,
    options: ValidationOptions = {}
  ): T {
    let merged: Partial<T>;
    
    // Apply update strategy
    switch (strategy) {
      case UpdateStrategy.REPLACE:
        // Complete replacement with defaults for missing values
        merged = this.applyDefaults(updates);
        break;
      
      case UpdateStrategy.MERGE:
        // Simple merge
        merged = { ...current, ...updates };
        break;
      
      case UpdateStrategy.DEEP_MERGE:
        // Deep merge
        merged = this.deepMerge(current, updates);
        break;
      
      default:
        throw new Error(`Unsupported update strategy: ${strategy}`);
    }
    
    // Validate
    const result = this.validate(merged, options);
    
    if (!result.valid) {
      if (options.throwOnError !== false) {
        throw new ConfigValidationError(
          'Configuration update validation failed',
          result.errors as ValidationError[]
        );
      }
      
      // Return unmodified config if validation failed but throwing is disabled
      return current;
    }
    
    return result.config as T;
  }
  
  /**
   * Validate a configuration
   */
  validate(config: Partial<T>, options: ValidationOptions = {}): ValidationResult {
    return validateConfig<T>(config, this.schema, options);
  }
  
  /**
   * Apply defaults to a configuration
   */
  applyDefaults(config: Partial<T>): Partial<T> {
    return this.defaultsProvider.applyDefaults(config);
  }
  
  /**
   * Deep merge two objects
   */
  private deepMerge<U extends Record<string, unknown>>(target: U, source: Partial<U>): U {
    const output = { ...target };
    
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = target[key];
        
        if (
          sourceValue !== null &&
          targetValue !== null &&
          typeof sourceValue === 'object' &&
          typeof targetValue === 'object' &&
          !Array.isArray(sourceValue) &&
          !Array.isArray(targetValue)
        ) {
          // Recursively merge objects
          output[key] = this.deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>
          ) as any;
        } else {
          // Direct assignment for other types
          output[key] = sourceValue as any;
        }
      }
    }
    
    return output;
  }
}

/**
 * Create a new configuration factory
 */
export function createConfigFactory<T extends Record<string, unknown>>(
  schema: ConfigSchema<T>
): ConfigFactory<T> {
  return new ConfigFactory<T>(schema);
} 