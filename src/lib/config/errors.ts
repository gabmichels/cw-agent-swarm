/**
 * Configuration System Error Types
 * 
 * This module defines error types used by the configuration system to provide
 * detailed information about validation and configuration issues.
 */

/**
 * Base error class for all configuration-related errors
 */
export class ConfigError extends Error {
  /** Error code for categorization */
  public readonly code: string;
  
  /** Additional context information */
  public readonly context: Record<string, unknown>;
  
  constructor(message: string, code = 'CONFIG_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    
    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

/**
 * Error for individual validation failures
 */
export class ValidationError extends ConfigError {
  /** The property path that failed validation */
  public readonly path: string;
  
  /** The expected type or format */
  public readonly expected?: string;
  
  /** The received value that caused the validation error */
  public readonly received?: unknown;
  
  constructor(
    message: string,
    path: string,
    expected?: string,
    received?: unknown,
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      { path, expected, received, ...context }
    );
    
    this.path = path;
    this.expected = expected;
    this.received = received;
    
    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown when configuration validation fails, containing multiple validation errors
 */
export class ConfigValidationError extends ConfigError {
  /** List of individual validation errors */
  public readonly errors: ValidationError[];
  
  constructor(message: string, errors: ValidationError[], context: Record<string, unknown> = {}) {
    super(
      message,
      'CONFIG_VALIDATION_ERROR',
      { errors, ...context }
    );
    
    this.errors = errors;
    
    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ConfigValidationError.prototype);
  }
  
  /**
   * Get a formatted message with all validation errors
   */
  getFormattedMessage(): string {
    return [
      this.message,
      '',
      ...this.errors.map(error => {
        let msg = `- ${error.path}: ${error.message}`;
        if (error.expected) {
          msg += ` (expected: ${error.expected}`;
          if (error.received !== undefined) {
            msg += `, received: ${JSON.stringify(error.received)})`;
          } else {
            msg += ')';
          }
        }
        return msg;
      })
    ].join('\n');
  }
}

/**
 * Error thrown when a required configuration property is missing
 */
export class ConfigMissingPropertyError extends ValidationError {
  constructor(propertyPath: string, context: Record<string, unknown> = {}) {
    super(
      `Required property '${propertyPath}' is missing`,
      propertyPath,
      'defined value',
      undefined,
      context
    );
    
    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ConfigMissingPropertyError.prototype);
  }
}

/**
 * Error thrown when a configuration property has the wrong type
 */
export class ConfigTypeError extends ValidationError {
  constructor(
    propertyPath: string,
    expectedType: string,
    receivedValue: unknown,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Property '${propertyPath}' must be of type '${expectedType}'`,
      propertyPath,
      expectedType,
      receivedValue,
      context
    );
    
    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ConfigTypeError.prototype);
  }
}

/**
 * Error thrown when a configuration property value is out of range
 */
export class ConfigRangeError extends ValidationError {
  constructor(
    propertyPath: string,
    min?: number,
    max?: number,
    receivedValue?: number,
    context: Record<string, unknown> = {}
  ) {
    let message = `Property '${propertyPath}' is out of range`;
    let expectedStr = '';
    
    if (min !== undefined && max !== undefined) {
      message = `Property '${propertyPath}' must be between ${min} and ${max}`;
      expectedStr = `between ${min} and ${max}`;
    } else if (min !== undefined) {
      message = `Property '${propertyPath}' must be at least ${min}`;
      expectedStr = `>= ${min}`;
    } else if (max !== undefined) {
      message = `Property '${propertyPath}' must be at most ${max}`;
      expectedStr = `<= ${max}`;
    }
    
    super(
      message,
      propertyPath,
      expectedStr,
      receivedValue,
      context
    );
    
    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ConfigRangeError.prototype);
  }
}

/**
 * Error thrown when a configuration property value does not match a pattern
 */
export class ConfigPatternError extends ValidationError {
  constructor(
    propertyPath: string,
    pattern: RegExp,
    receivedValue: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Property '${propertyPath}' must match pattern ${pattern}`,
      propertyPath,
      pattern.toString(),
      receivedValue,
      context
    );
    
    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ConfigPatternError.prototype);
  }
}

/**
 * Error thrown when a configuration value is not among allowed values
 */
export class ConfigEnumError extends ValidationError {
  constructor(
    propertyPath: string,
    allowedValues: unknown[],
    receivedValue: unknown,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Property '${propertyPath}' must be one of: ${allowedValues.join(', ')}`,
      propertyPath,
      `one of [${allowedValues.join(', ')}]`,
      receivedValue,
      context
    );
    
    // Ensures proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ConfigEnumError.prototype);
  }
}

/**
 * Error for cross-property dependency validation
 */
export class ConfigDependencyError extends ValidationError {
  /**
   * Create a new dependency error
   * @param message Error message
   * @param properties Properties involved in the dependency
   */
  constructor(
    message: string,
    public readonly properties: string
  ) {
    super(message, properties);
    this.name = 'ConfigDependencyError';
  }
} 