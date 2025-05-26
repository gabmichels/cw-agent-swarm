/**
 * AgentConfigValidator.ts - Handles configuration validation and schema management
 * 
 * This component is responsible for:
 * - Configuration schema validation
 * - Configuration migration
 * - Environment-specific validation
 * - Default value management
 */

import { createLogger } from '../../../lib/logging/winston-logger';

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationErrorInfo[];
  warnings: ConfigValidationWarning[];
  normalizedConfig: Record<string, unknown>;
  migrationApplied: boolean;
}

/**
 * Configuration validation error info
 */
export interface ConfigValidationErrorInfo {
  path: string;
  message: string;
  code: string;
  severity: 'error' | 'critical';
  expectedType?: string;
  actualValue?: unknown;
}

/**
 * Configuration validation warning
 */
export interface ConfigValidationWarning {
  path: string;
  message: string;
  code: string;
  suggestion?: string;
}

/**
 * Configuration schema definition
 */
export interface ConfigSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  required?: boolean;
  default?: unknown;
  properties?: Record<string, ConfigSchema>;
  items?: ConfigSchema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  validator?: (value: unknown) => boolean;
  description?: string;
}

/**
 * Configuration migration rule
 */
export interface ConfigMigrationRule {
  version: string;
  description: string;
  migrate: (config: Record<string, unknown>) => Record<string, unknown>;
  validate?: (config: Record<string, unknown>) => boolean;
}

/**
 * Agent configuration validation options
 */
export interface ValidationOptions {
  strict: boolean;
  allowUnknownProperties: boolean;
  applyDefaults: boolean;
  performMigration: boolean;
  validateReferences: boolean;
}

/**
 * Error class for configuration validation errors
 */
export class ConfigValidationError extends Error {
  public readonly code: string;
  public readonly path: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, path: string, code = 'CONFIG_VALIDATION_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ConfigValidationError';
    this.code = code;
    this.path = path;
    this.context = context;
  }
}

/**
 * AgentConfigValidator class - Validates agent configuration and settings
 */
export class AgentConfigValidator {
  private logger: ReturnType<typeof createLogger>;
  private schemas: Map<string, ConfigSchema> = new Map();
  private migrationRules: Map<string, ConfigMigrationRule[]> = new Map();
  private defaultOptions: ValidationOptions;

  constructor(options: Partial<ValidationOptions> = {}) {
    this.logger = createLogger({
      moduleId: 'agent-config-validator',
    });
    
    // Set default validation options
    this.defaultOptions = {
      strict: true,
      allowUnknownProperties: false,
      applyDefaults: true,
      performMigration: true,
      validateReferences: true,
      ...options
    };

    // Initialize default schemas
    this.initializeDefaultSchemas();
  }

  /**
   * Validate configuration against schema
   */
  validateConfig(
    config: Record<string, unknown>,
    schemaName: string,
    options: Partial<ValidationOptions> = {}
  ): ConfigValidationResult {
    const validationOptions = { ...this.defaultOptions, ...options };
    
    try {
      this.logger.info(`Validating configuration with schema: ${schemaName}`);
      
      const result: ConfigValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        normalizedConfig: { ...config },
        migrationApplied: false
      };

      // Get schema
      const schema = this.schemas.get(schemaName);
      if (!schema) {
        result.valid = false;
        result.errors.push({
          path: '',
          message: `Schema '${schemaName}' not found`,
          code: 'SCHEMA_NOT_FOUND',
          severity: 'critical'
        });
        return result;
      }

      // Apply migrations if enabled
      if (validationOptions.performMigration) {
        const migrationResult = this.applyMigrations(result.normalizedConfig, schemaName);
        result.normalizedConfig = migrationResult.config;
        result.migrationApplied = migrationResult.applied;
        if (migrationResult.applied) {
          result.warnings.push({
            path: '',
            message: 'Configuration migration was applied',
            code: 'MIGRATION_APPLIED',
            suggestion: 'Update your configuration file to the latest format'
          });
        }
      }

      // Validate against schema
      const validationResult = this.validateValue(
        result.normalizedConfig,
        schema,
        '',
        validationOptions
      );
      
      result.errors.push(...validationResult.errors);
      result.warnings.push(...validationResult.warnings);
      result.normalizedConfig = validationResult.value as Record<string, unknown>;

      // Validate references if enabled
      if (validationOptions.validateReferences) {
        const referenceValidation = this.validateReferences(result.normalizedConfig, schemaName);
        result.errors.push(...referenceValidation.errors);
        result.warnings.push(...referenceValidation.warnings);
      }

      // Set overall validity
      result.valid = result.errors.filter(e => e.severity === 'error' || e.severity === 'critical').length === 0;

      this.logger.info(`Configuration validation completed. Valid: ${result.valid}, Errors: ${result.errors.length}, Warnings: ${result.warnings.length}`);
      
      return result;
      
    } catch (error) {
      this.logger.error('Error during configuration validation:', { error: error instanceof Error ? error.message : String(error) });
      
      return {
        valid: false,
        errors: [{
          path: '',
          message: `Validation failed: ${(error as Error).message}`,
          code: 'VALIDATION_FAILED',
          severity: 'critical'
        }],
        warnings: [],
        normalizedConfig: config,
        migrationApplied: false
      };
    }
  }

  /**
   * Validate value against schema
   */
  private validateValue(
    value: unknown,
    schema: ConfigSchema,
    path: string,
    options: ValidationOptions
  ): {
    value: unknown;
    errors: ConfigValidationErrorInfo[];
    warnings: ConfigValidationWarning[];
  } {
    const errors: ConfigValidationErrorInfo[] = [];
    const warnings: ConfigValidationWarning[] = [];
    let normalizedValue = value;

    // Handle undefined/null values
    if (value === undefined || value === null) {
      if (schema.required) {
        errors.push({
          path,
          message: `Required property is missing`,
          code: 'REQUIRED_PROPERTY_MISSING',
          severity: 'error',
          expectedType: schema.type
        });
        return { value: normalizedValue, errors, warnings };
      } else if (schema.default !== undefined && options.applyDefaults) {
        normalizedValue = this.cloneValue(schema.default);
        warnings.push({
          path,
          message: `Applied default value: ${JSON.stringify(schema.default)}`,
          code: 'DEFAULT_VALUE_APPLIED'
        });
      }
      return { value: normalizedValue, errors, warnings };
    }

    // Type validation
    const typeValidation = this.validateType(normalizedValue, schema, path);
    if (!typeValidation.valid) {
      errors.push(...typeValidation.errors);
      return { value: normalizedValue, errors, warnings };
    }

    // Specific type validations
    switch (schema.type) {
      case 'object':
        const objectValidation = this.validateObject(normalizedValue as Record<string, unknown>, schema, path, options);
        normalizedValue = objectValidation.value;
        errors.push(...objectValidation.errors);
        warnings.push(...objectValidation.warnings);
        break;

      case 'array':
        const arrayValidation = this.validateArray(normalizedValue as unknown[], schema, path, options);
        normalizedValue = arrayValidation.value;
        errors.push(...arrayValidation.errors);
        warnings.push(...arrayValidation.warnings);
        break;

      case 'string':
        const stringValidation = this.validateString(normalizedValue as string, schema, path);
        errors.push(...stringValidation.errors);
        warnings.push(...stringValidation.warnings);
        break;

      case 'number':
        const numberValidation = this.validateNumber(normalizedValue as number, schema, path);
        errors.push(...numberValidation.errors);
        warnings.push(...numberValidation.warnings);
        break;
    }

    // Custom validator
    if (schema.validator && !schema.validator(normalizedValue)) {
      errors.push({
        path,
        message: 'Custom validation failed',
        code: 'CUSTOM_VALIDATION_FAILED',
        severity: 'error',
        actualValue: normalizedValue
      });
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(normalizedValue)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        code: 'INVALID_ENUM_VALUE',
        severity: 'error',
        actualValue: normalizedValue
      });
    }

    return { value: normalizedValue, errors, warnings };
  }

  /**
   * Validate type
   */
  private validateType(
    value: unknown,
    schema: ConfigSchema,
    path: string
  ): { valid: boolean; errors: ConfigValidationErrorInfo[] } {
    const errors: ConfigValidationErrorInfo[] = [];
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (actualType !== schema.type) {
      errors.push({
        path,
        message: `Expected type '${schema.type}' but got '${actualType}'`,
        code: 'TYPE_MISMATCH',
        severity: 'error',
        expectedType: schema.type,
        actualValue: value
      });
      return { valid: false, errors };
    }

    return { valid: true, errors };
  }

  /**
   * Validate object
   */
  private validateObject(
    value: Record<string, unknown>,
    schema: ConfigSchema,
    path: string,
    options: ValidationOptions
  ): {
    value: Record<string, unknown>;
    errors: ConfigValidationErrorInfo[];
    warnings: ConfigValidationWarning[];
  } {
    const errors: ConfigValidationErrorInfo[] = [];
    const warnings: ConfigValidationWarning[] = [];
    const normalizedValue: Record<string, unknown> = { ...value };

    if (!schema.properties) {
      return { value: normalizedValue, errors, warnings };
    }

    // Validate known properties
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const propPath = path ? `${path}.${propName}` : propName;
      const propValidation = this.validateValue(
        normalizedValue[propName],
        propSchema,
        propPath,
        options
      );
      
      normalizedValue[propName] = propValidation.value;
      errors.push(...propValidation.errors);
      warnings.push(...propValidation.warnings);
    }

    // Check for unknown properties
    if (!options.allowUnknownProperties) {
      for (const propName of Object.keys(normalizedValue)) {
        if (!schema.properties[propName]) {
          if (options.strict) {
            errors.push({
              path: path ? `${path}.${propName}` : propName,
              message: `Unknown property '${propName}'`,
              code: 'UNKNOWN_PROPERTY',
              severity: 'error'
            });
          } else {
            warnings.push({
              path: path ? `${path}.${propName}` : propName,
              message: `Unknown property '${propName}' will be ignored`,
              code: 'UNKNOWN_PROPERTY_WARNING'
            });
          }
        }
      }
    }

    return { value: normalizedValue, errors, warnings };
  }

  /**
   * Validate array
   */
  private validateArray(
    value: unknown[],
    schema: ConfigSchema,
    path: string,
    options: ValidationOptions
  ): {
    value: unknown[];
    errors: ConfigValidationErrorInfo[];
    warnings: ConfigValidationWarning[];
  } {
    const errors: ConfigValidationErrorInfo[] = [];
    const warnings: ConfigValidationWarning[] = [];
    const normalizedValue: unknown[] = [];

    if (!schema.items) {
      return { value: value, errors, warnings };
    }

    // Validate each item
    for (let i = 0; i < value.length; i++) {
      const itemPath = `${path}[${i}]`;
      const itemValidation = this.validateValue(
        value[i],
        schema.items,
        itemPath,
        options
      );
      
      normalizedValue.push(itemValidation.value);
      errors.push(...itemValidation.errors);
      warnings.push(...itemValidation.warnings);
    }

    return { value: normalizedValue, errors, warnings };
  }

  /**
   * Validate string
   */
  private validateString(
    value: string,
    schema: ConfigSchema,
    path: string
  ): {
    errors: ConfigValidationErrorInfo[];
    warnings: ConfigValidationWarning[];
  } {
    const errors: ConfigValidationErrorInfo[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Length validation
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `String length must be at least ${schema.minLength} characters`,
        code: 'STRING_TOO_SHORT',
        severity: 'error',
        actualValue: value.length
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `String length must not exceed ${schema.maxLength} characters`,
        code: 'STRING_TOO_LONG',
        severity: 'error',
        actualValue: value.length
      });
    }

    // Pattern validation
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          path,
          message: `String does not match required pattern: ${schema.pattern}`,
          code: 'PATTERN_MISMATCH',
          severity: 'error',
          actualValue: value
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate number
   */
  private validateNumber(
    value: number,
    schema: ConfigSchema,
    path: string
  ): {
    errors: ConfigValidationErrorInfo[];
    warnings: ConfigValidationWarning[];
  } {
    const errors: ConfigValidationErrorInfo[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Range validation
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `Number must be at least ${schema.minimum}`,
        code: 'NUMBER_TOO_SMALL',
        severity: 'error',
        actualValue: value
      });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `Number must not exceed ${schema.maximum}`,
        code: 'NUMBER_TOO_LARGE',
        severity: 'error',
        actualValue: value
      });
    }

    return { errors, warnings };
  }

  /**
   * Apply configuration migrations
   */
  private applyMigrations(
    config: Record<string, unknown>,
    schemaName: string
  ): { config: Record<string, unknown>; applied: boolean } {
    const migrations = this.migrationRules.get(schemaName) || [];
    let currentConfig = { ...config };
    let applied = false;

    for (const migration of migrations) {
      try {
        if (!migration.validate || migration.validate(currentConfig)) {
          const migratedConfig = migration.migrate(currentConfig);
          if (JSON.stringify(migratedConfig) !== JSON.stringify(currentConfig)) {
            currentConfig = migratedConfig;
            applied = true;
            this.logger.info(`Applied migration: ${migration.description}`);
          }
        }
      } catch (error) {
        this.logger.warn(`Migration failed: ${migration.description}`, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    return { config: currentConfig, applied };
  }

  /**
   * Validate configuration references
   */
  private validateReferences(
    config: Record<string, unknown>,
    schemaName: string
  ): {
    errors: ConfigValidationErrorInfo[];
    warnings: ConfigValidationWarning[];
  } {
    const errors: ConfigValidationErrorInfo[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Example reference validation - manager ID references
    if (config.managerId && typeof config.managerId === 'string') {
      if (!config.managers || !Array.isArray(config.managers)) {
        errors.push({
          path: 'managerId',
          message: 'Referenced manager ID but no managers array found',
          code: 'INVALID_REFERENCE',
          severity: 'error'
        });
      } else {
        const managerExists = (config.managers as unknown[]).some(
          (manager: unknown) => 
            typeof manager === 'object' && 
            manager !== null && 
            'id' in manager && 
            (manager as { id: unknown }).id === config.managerId
        );
        
        if (!managerExists) {
          errors.push({
            path: 'managerId',
            message: `Referenced manager ID '${config.managerId}' not found in managers array`,
            code: 'REFERENCE_NOT_FOUND',
            severity: 'error'
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Clone value for default application
   */
  private cloneValue(value: unknown): unknown {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    if (Array.isArray(value)) {
      return value.map(item => this.cloneValue(item));
    }
    
    const cloned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      cloned[key] = this.cloneValue(val);
    }
    
    return cloned;
  }

  /**
   * Initialize default schemas
   */
  private initializeDefaultSchemas(): void {
    // Agent configuration schema
    this.addSchema('agent', {
      type: 'object',
      required: true,
      properties: {
        id: {
          type: 'string',
          required: true,
          minLength: 1,
          description: 'Unique agent identifier'
        },
        name: {
          type: 'string',
          required: true,
          minLength: 1,
          description: 'Agent display name'
        },
        type: {
          type: 'string',
          required: true,
          enum: ['default', 'specialized', 'coordinator'],
          description: 'Agent type'
        },
        enabled: {
          type: 'boolean',
          required: false,
          default: true,
          description: 'Whether the agent is enabled'
        },
        managers: {
          type: 'array',
          required: false,
          default: [],
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', required: true },
              type: { type: 'string', required: true },
              config: { type: 'object', required: false }
            }
          },
          description: 'Manager configurations'
        },
        settings: {
          type: 'object',
          required: false,
          default: {},
          properties: {
            maxConcurrentTasks: {
              type: 'number',
              required: false,
              default: 5,
              minimum: 1,
              maximum: 100
            },
            timeout: {
              type: 'number',
              required: false,
              default: 300000,
              minimum: 1000
            },
            retryAttempts: {
              type: 'number',
              required: false,
              default: 3,
              minimum: 0,
              maximum: 10
            }
          },
          description: 'Agent settings'
        }
      }
    });

    // Manager configuration schema
    this.addSchema('manager', {
      type: 'object',
      required: true,
      properties: {
        id: {
          type: 'string',
          required: true,
          minLength: 1
        },
        type: {
          type: 'string',
          required: true,
          enum: ['planning', 'memory', 'tool', 'reflection', 'knowledge']
        },
        enabled: {
          type: 'boolean',
          required: false,
          default: true
        },
        config: {
          type: 'object',
          required: false,
          default: {}
        }
      }
    });
  }

  /**
   * Add schema
   */
  addSchema(name: string, schema: ConfigSchema): void {
    this.schemas.set(name, schema);
    this.logger.info(`Added schema: ${name}`);
  }

  /**
   * Remove schema
   */
  removeSchema(name: string): boolean {
    const removed = this.schemas.delete(name);
    if (removed) {
      this.logger.info(`Removed schema: ${name}`);
    }
    return removed;
  }

  /**
   * Add migration rule
   */
  addMigrationRule(schemaName: string, rule: ConfigMigrationRule): void {
    if (!this.migrationRules.has(schemaName)) {
      this.migrationRules.set(schemaName, []);
    }
    
    const rules = this.migrationRules.get(schemaName)!;
    rules.push(rule);
    
    // Sort by version
    rules.sort((a, b) => a.version.localeCompare(b.version));
    
    this.logger.info(`Added migration rule for ${schemaName}: ${rule.description}`);
  }

  /**
   * Get available schemas
   */
  getSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Get schema by name
   */
  getSchema(name: string): ConfigSchema | undefined {
    return this.schemas.get(name);
  }

  /**
   * Validate configuration and return detailed report
   */
  validateWithReport(
    config: Record<string, unknown>,
    schemaName: string,
    options: Partial<ValidationOptions> = {}
  ): string {
    const result = this.validateConfig(config, schemaName, options);
    
    let report = `Configuration Validation Report\n`;
    report += `Schema: ${schemaName}\n`;
    report += `Valid: ${result.valid}\n`;
    report += `Migration Applied: ${result.migrationApplied}\n\n`;
    
    if (result.errors.length > 0) {
      report += `Errors (${result.errors.length}):\n`;
      for (const error of result.errors) {
        report += `  [${error.severity.toUpperCase()}] ${error.path || 'root'}: ${error.message} (${error.code})\n`;
      }
      report += '\n';
    }
    
    if (result.warnings.length > 0) {
      report += `Warnings (${result.warnings.length}):\n`;
      for (const warning of result.warnings) {
        report += `  [WARN] ${warning.path || 'root'}: ${warning.message} (${warning.code})\n`;
        if (warning.suggestion) {
          report += `    Suggestion: ${warning.suggestion}\n`;
        }
      }
      report += '\n';
    }
    
    return report;
  }
} 