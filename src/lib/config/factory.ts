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
  UpdateStrategy,
  VersionedConfigSchema,
  MigrationManager
} from './types';

import { 
  validateConfig, 
  validateValue 
} from './validators';

import {
  ConfigValidationError,
  ValidationError
} from './errors';

import { ConfigMigrationManager } from './migration';

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
 * Configuration factory implementation
 */
export class ConfigFactory<T extends Record<string, unknown>> implements ConfigValidator<T> {
  private defaultsProvider: DefaultsProvider<T>;
  private migrationManager?: MigrationManager<T>;
  private isVersioned: boolean = false;
  private currentVersion: string = '1.0.0';
  
  /**
   * Create a new configuration factory
   * @param schema Configuration schema
   * @param migrationManager Optional migration manager for versioned configs
   */
  constructor(
    private schema: ConfigSchema<T>,
    migrationManager?: MigrationManager<T>
  ) {
    this.defaultsProvider = new ConfigDefaultsProvider<T>(schema);
    this.migrationManager = migrationManager;
    
    // Check if this is a versioned schema
    const versionedSchema = schema as VersionedConfigSchema<T>;
    if (versionedSchema.version) {
      this.isVersioned = true;
      if (versionedSchema.version.default) {
        this.currentVersion = versionedSchema.version.default;
      }
      
      // Set latest version in migration manager if provided
      if (this.migrationManager && this.currentVersion) {
        this.migrationManager.setLatestVersion(this.currentVersion);
      }
    }
  }
  
  /**
   * Create a validated configuration
   */
  create(config: Partial<T> = {}, options: ValidationOptions = {}): T {
    // Apply defaults
    const withDefaults = this.applyDefaults(config);
    
    // Handle versioned configuration
    if (this.isVersioned && this.migrationManager) {
      const versionedConfig = withDefaults as Partial<T> & { version?: string };
      
      // If config has version and it's not current, migrate it
      if (versionedConfig.version && versionedConfig.version !== this.currentVersion) {
        const fromVersion = versionedConfig.version;
        const migrated = this.migrationManager.migrateConfig(
          versionedConfig,
          fromVersion,
          this.currentVersion
        );
        
        // Set current version
        (migrated as any).version = this.currentVersion;
        
        // Validate migrated config
        return this.validateAndFinalize(migrated, options);
      }
      
      // Ensure version is set
      if (!versionedConfig.version) {
        (versionedConfig as any).version = this.currentVersion;
      }
    }
    
    // Validate and return
    return this.validateAndFinalize(withDefaults, options);
  }
  
  /**
   * Validate a configuration
   */
  validate(config: Partial<T>, options: ValidationOptions = {}): ValidationResult {
    return validateConfig(config, this.schema, options);
  }
  
  /**
   * Apply defaults to a configuration
   */
  applyDefaults(config: Partial<T>): Partial<T> {
    return this.defaultsProvider.applyDefaults(config);
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
   * Serialize configuration to JSON string
   */
  serialize(config: T): string {
    return JSON.stringify(config);
  }
  
  /**
   * Deserialize configuration from JSON string
   */
  deserialize(json: string, options: ValidationOptions = {}): T {
    try {
      const parsed = JSON.parse(json);
      return this.create(parsed, options);
    } catch (error) {
      throw new Error(`Failed to deserialize configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Set the migration manager
   */
  setMigrationManager(migrationManager: MigrationManager<T>): void {
    this.migrationManager = migrationManager;
    
    // Set latest version
    if (this.isVersioned && this.currentVersion) {
      this.migrationManager.setLatestVersion(this.currentVersion);
    }
  }
  
  /**
   * Get the schema of this factory
   */
  getSchema(): ConfigSchema<T> {
    return this.schema;
  }
  
  /**
   * Get the current schema version
   */
  getCurrentVersion(): string | undefined {
    return this.isVersioned ? this.currentVersion : undefined;
  }
  
  /**
   * Validate and finalize a configuration
   * @private
   */
  private validateAndFinalize(config: Partial<T>, options: ValidationOptions = {}): T {
    const result = this.validate(config, {
      throwOnError: true,
      applyDefaults: true,
      ...options
    });
    
    if (!result.valid || !result.config) {
      throw new ConfigValidationError(
        'Configuration validation failed',
        result.errors as ValidationError[]
      );
    }
    
    return result.config as T;
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
 * Create a configuration factory
 * @param schema Configuration schema
 * @param migrationManager Optional migration manager
 * @returns Configuration factory
 */
export function createConfigFactory<T extends Record<string, unknown>>(
  schema: ConfigSchema<T>,
  migrationManager?: MigrationManager<T>
): ConfigFactory<T> {
  return new ConfigFactory<T>(schema, migrationManager);
} 