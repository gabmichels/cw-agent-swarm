/**
 * Configuration System Validators
 * 
 * This module provides functions for validating configuration values
 * against defined schemas and types.
 */

import {
  ConfigTypeError,
  ConfigRangeError,
  ConfigPatternError,
  ConfigEnumError,
  ConfigMissingPropertyError,
  ValidationError
} from './errors';
import {
  ConfigPropertySchema,
  ConfigSchema,
  ValidationOptions,
  ValidationResult
} from './types';

/**
 * Validate a string value
 */
export function validateString(
  value: unknown,
  schema: ConfigPropertySchema<string>,
  path: string
): ValidationError | null {
  // Type check
  if (typeof value !== 'string') {
    return new ConfigTypeError(path, 'string', value);
  }
  
  // Pattern check if specified
  if (schema.pattern && !schema.pattern.test(value)) {
    return new ConfigPatternError(path, schema.pattern, value);
  }
  
  // Length check if specified
  if (schema.min !== undefined && value.length < schema.min) {
    return new ConfigRangeError(
      path,
      schema.min,
      undefined,
      value.length,
      { context: 'string length' }
    );
  }
  
  if (schema.max !== undefined && value.length > schema.max) {
    return new ConfigRangeError(
      path,
      undefined,
      schema.max,
      value.length,
      { context: 'string length' }
    );
  }
  
  // Custom validation if specified
  if (schema.validate) {
    const result = schema.validate(value, path);
    if (typeof result === 'boolean') {
      if (!result) {
        return new ValidationError(`Failed custom validation`, path);
      }
    } else if (!result.valid) {
      return new ValidationError(
        result.error || 'Failed custom validation',
        path
      );
    }
  }
  
  return null;
}

/**
 * Validate a number value
 */
export function validateNumber(
  value: unknown,
  schema: ConfigPropertySchema<number>,
  path: string
): ValidationError | null {
  // Type check
  if (typeof value !== 'number' || isNaN(value)) {
    return new ConfigTypeError(path, 'number', value);
  }
  
  // Range check if specified
  if (schema.min !== undefined && value < schema.min) {
    return new ConfigRangeError(path, schema.min, undefined, value);
  }
  
  if (schema.max !== undefined && value > schema.max) {
    return new ConfigRangeError(path, undefined, schema.max, value);
  }
  
  // Custom validation if specified
  if (schema.validate) {
    const result = schema.validate(value, path);
    if (typeof result === 'boolean') {
      if (!result) {
        return new ValidationError(`Failed custom validation`, path);
      }
    } else if (!result.valid) {
      return new ValidationError(
        result.error || 'Failed custom validation',
        path
      );
    }
  }
  
  return null;
}

/**
 * Validate a boolean value
 */
export function validateBoolean(
  value: unknown,
  schema: ConfigPropertySchema<boolean>,
  path: string
): ValidationError | null {
  // Type check
  if (typeof value !== 'boolean') {
    return new ConfigTypeError(path, 'boolean', value);
  }
  
  // Custom validation if specified
  if (schema.validate) {
    const result = schema.validate(value, path);
    if (typeof result === 'boolean') {
      if (!result) {
        return new ValidationError(`Failed custom validation`, path);
      }
    } else if (!result.valid) {
      return new ValidationError(
        result.error || 'Failed custom validation',
        path
      );
    }
  }
  
  return null;
}

/**
 * Validate an array value
 */
export function validateArray(
  value: unknown,
  schema: ConfigPropertySchema<unknown[]>,
  path: string
): ValidationError | null {
  // Type check
  if (!Array.isArray(value)) {
    return new ConfigTypeError(path, 'array', value);
  }
  
  // Length check if specified
  if (schema.min !== undefined && value.length < schema.min) {
    return new ConfigRangeError(
      path,
      schema.min,
      undefined,
      value.length,
      { context: 'array length' }
    );
  }
  
  if (schema.max !== undefined && value.length > schema.max) {
    return new ConfigRangeError(
      path,
      undefined,
      schema.max,
      value.length,
      { context: 'array length' }
    );
  }
  
  // Validate array items if item schema specified
  if (schema.items) {
    const errors: ValidationError[] = [];
    for (let i = 0; i < value.length; i++) {
      const itemPath = `${path}[${i}]`;
      const error = validateValue(value[i], schema.items, itemPath);
      if (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      // Return only the first error to avoid overwhelming the error output
      return errors[0];
    }
  }
  
  // Custom validation if specified
  if (schema.validate) {
    const result = schema.validate(value, path);
    if (typeof result === 'boolean') {
      if (!result) {
        return new ValidationError(`Failed custom validation`, path);
      }
    } else if (!result.valid) {
      return new ValidationError(
        result.error || 'Failed custom validation',
        path
      );
    }
  }
  
  return null;
}

/**
 * Validate an object value
 */
export function validateObject(
  value: unknown,
  schema: ConfigPropertySchema<Record<string, unknown>>,
  path: string
): ValidationError | null {
  // Type check
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return new ConfigTypeError(path, 'object', value);
  }
  
  // Validate properties if schema properties specified
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const propPath = path ? `${path}.${propName}` : propName;
      const propValue = (value as Record<string, unknown>)[propName];
      
      // Check if property is required but missing
      if (propSchema.required && (propValue === undefined || propValue === null)) {
        return new ConfigMissingPropertyError(propPath);
      }
      
      // Skip validation if property is not required and undefined
      if (propValue === undefined && !propSchema.required) {
        continue;
      }
      
      // Validate property value
      if (propValue !== undefined) {
        const error = validateValue(propValue, propSchema, propPath);
        if (error) {
          return error;
        }
      }
    }
  }
  
  // Custom validation if specified
  if (schema.validate) {
    const result = schema.validate(value, path);
    if (typeof result === 'boolean') {
      if (!result) {
        return new ValidationError(`Failed custom validation`, path);
      }
    } else if (!result.valid) {
      return new ValidationError(
        result.error || 'Failed custom validation',
        path
      );
    }
  }
  
  return null;
}

/**
 * Validate an enum value
 */
export function validateEnum(
  value: unknown,
  schema: ConfigPropertySchema<unknown>,
  path: string
): ValidationError | null {
  // Enum values check
  if (schema.enum && !schema.enum.includes(value)) {
    return new ConfigEnumError(path, schema.enum, value);
  }
  
  // Custom validation if specified
  if (schema.validate) {
    const result = schema.validate(value, path);
    if (typeof result === 'boolean') {
      if (!result) {
        return new ValidationError(`Failed custom validation`, path);
      }
    } else if (!result.valid) {
      return new ValidationError(
        result.error || 'Failed custom validation',
        path
      );
    }
  }
  
  return null;
}

/**
 * Validate any value based on its schema type
 */
export function validateValue(
  value: unknown,
  schema: ConfigPropertySchema,
  path: string
): ValidationError | null {
  // Skip if value is undefined and property is not required
  if (value === undefined && !schema.required) {
    return null;
  }
  
  // Check if value is required but missing
  if (schema.required && (value === undefined || value === null)) {
    return new ConfigMissingPropertyError(path);
  }
  
  // Skip validation if value is undefined
  if (value === undefined) {
    return null;
  }
  
  // Type-specific validation
  switch (schema.type) {
    case 'string':
      return validateString(value, schema as ConfigPropertySchema<string>, path);
    case 'number':
      return validateNumber(value, schema as ConfigPropertySchema<number>, path);
    case 'boolean':
      return validateBoolean(value, schema as ConfigPropertySchema<boolean>, path);
    case 'array':
      return validateArray(value, schema as ConfigPropertySchema<unknown[]>, path);
    case 'object':
      return validateObject(value, schema as ConfigPropertySchema<Record<string, unknown>>, path);
    case 'enum':
      return validateEnum(value, schema, path);
    case 'any':
      // No type checking for 'any', but run custom validation if specified
      if (schema.validate) {
        const result = schema.validate(value, path);
        if (typeof result === 'boolean') {
          if (!result) {
            return new ValidationError(`Failed custom validation`, path);
          }
        } else if (!result.valid) {
          return new ValidationError(
            result.error || 'Failed custom validation',
            path
          );
        }
      }
      return null;
    default:
      return new ValidationError(`Unsupported schema type: ${schema.type}`, path);
  }
}

/**
 * Validate a configuration object against a schema
 */
export function validateConfig<T extends Record<string, unknown>>(
  config: Partial<T>,
  schema: ConfigSchema<T>,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const validatedConfig = { ...config };
  
  // Validate each property against its schema
  for (const [propName, propSchema] of Object.entries(schema)) {
    const propPath = propName;
    const propValue = config[propName];
    
    // Apply default if property is missing and defaults are enabled
    if ((propValue === undefined || propValue === null) && 
        propSchema.default !== undefined && 
        options.applyDefaults !== false) {
      (validatedConfig as Record<string, unknown>)[propName] = propSchema.default;
      continue;
    }
    
    // Check if property is required but missing
    if (propSchema.required && (propValue === undefined || propValue === null)) {
      errors.push(new ConfigMissingPropertyError(propPath));
      continue;
    }
    
    // Skip validation if property is not required and undefined
    if (propValue === undefined && !propSchema.required) {
      continue;
    }
    
    // Validate property value
    if (propValue !== undefined) {
      const error = validateValue(propValue, propSchema, propPath);
      if (error) {
        errors.push(error);
      }
    }
  }
  
  // Remove additional properties if specified
  if (options.removeAdditional) {
    for (const propName of Object.keys(config)) {
      if (!(propName in schema)) {
        delete validatedConfig[propName as keyof T];
      }
    }
  }
  
  // Return validation result
  const valid = errors.length === 0;
  if (!valid && options.throwOnError) {
    throw new Error(`Configuration validation failed: ${errors.map(e => e.message).join(', ')}`);
  }
  
  return {
    valid,
    errors: errors.length > 0 ? errors : undefined,
    config: valid ? validatedConfig : undefined
  };
} 