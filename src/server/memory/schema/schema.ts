/**
 * Schema Implementation
 * 
 * This module implements the Schema interface for data validation.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { JSONSchema7 } from 'json-schema';
import { Schema, SchemaType, ValidationResult, ValidationError } from './types';
import { SchemaVersion } from './types';
import { SchemaDefinitionError, ValidationError as ValidationErrorClass } from './errors';
import { deepMerge } from '../utils/object-utils';

// Type for Ajv error object
interface AjvError {
  keyword: string;
  instancePath?: string;
  dataPath?: string;
  params?: Record<string, any>;
  message?: string;
}

/**
 * Schema implementation
 */
export class SchemaImpl<T> implements Schema<T> {
  /**
   * Compiled validator function
   */
  private validator: ReturnType<Ajv['compile']>;
  
  /**
   * Create a new schema
   * 
   * @param name Schema name
   * @param version Schema version
   * @param type Schema type
   * @param jsonSchema JSON Schema definition
   * @param defaultValues Default values for schema properties
   */
  constructor(
    public readonly name: string,
    public readonly version: SchemaVersion,
    public readonly type: SchemaType,
    public readonly jsonSchema: JSONSchema7,
    private readonly defaultValues: Partial<T> = {}
  ) {
    // Check if the schema is valid
    if (!jsonSchema || typeof jsonSchema !== 'object') {
      throw new SchemaDefinitionError('Invalid JSON Schema', { name, version: version.toString() });
    }
    
    // Initialize validator
    try {
      const ajv = new Ajv({
        allErrors: true,
        verbose: true
      });
      
      // Add additional formats
      addFormats(ajv);
      
      // Compile the schema
      this.validator = ajv.compile(jsonSchema);
    } catch (error) {
      throw new SchemaDefinitionError(
        `Failed to compile schema: ${error instanceof Error ? error.message : String(error)}`,
        { name, version: version.toString(), error }
      );
    }
  }
  
  /**
   * Validate data against this schema
   * 
   * @param data Data to validate
   * @returns Validation result
   */
  validate(data: unknown): ValidationResult {
    // Run validation
    const isValid = this.validator(data);
    
    // Return success if valid
    if (isValid) {
      return { valid: true };
    }
    
    // Extract errors
    const errors = (this.validator.errors || []).map((error: AjvError) => {
      // Different versions of Ajv use different property names
      const path = error.instancePath || error.dataPath || '';
      const field = path.replace(/^\//, '') || (error.params?.missingProperty as string) || '(root)';
      
      const validationError: ValidationError = {
        field: String(field),
        message: error.message || 'Invalid value',
        rule: error.keyword
      };
      
      // Add expected value if available based on error type
      if (error.params) {
        if (error.keyword === 'format' && 'format' in error.params) {
          validationError.expected = String(error.params.format);
        }
        else if (error.keyword === 'type' && 'type' in error.params) {
          validationError.expected = String(error.params.type);
        }
        else if (error.keyword === 'maximum' && 'limit' in error.params) {
          validationError.expected = `<= ${error.params.limit}`;
        }
        else if (error.keyword === 'minimum' && 'limit' in error.params) {
          validationError.expected = `>= ${error.params.limit}`;
        }
      }
      
      return validationError;
    });
    
    // Return failure with errors
    return {
      valid: false,
      errors
    };
  }
  
  /**
   * Check if data conforms to this schema (type guard)
   * 
   * @param data Data to check
   * @returns Type predicate indicating if data conforms to schema
   */
  isValid(data: unknown): data is T {
    return this.validate(data).valid;
  }
  
  /**
   * Get default values for this schema
   * 
   * @returns Default values
   */
  getDefaults(): Partial<T> {
    return { ...this.defaultValues };
  }
  
  /**
   * Create an entity with defaults filled in
   * 
   * @param data Initial data
   * @returns Entity with defaults
   * @throws ValidationError if the resulting entity is invalid
   */
  create(data: Partial<T>): T {
    // Get default values
    const defaults = this.getDefaults();
    
    // Merge defaults with provided data
    const entity = deepMerge(defaults, data) as T;
    
    // Add schema version if not present
    if (
      typeof entity === 'object' && 
      entity !== null && 
      !('schemaVersion' in entity)
    ) {
      (entity as unknown as { schemaVersion: string }).schemaVersion = this.version.toString();
    }
    
    // Validate the entity
    const validation = this.validate(entity);
    
    // Throw error if invalid
    if (!validation.valid) {
      throw new ValidationErrorClass(
        `Invalid ${this.name} entity`,
        validation.errors,
        { schema: this.name, version: this.version.toString() }
      );
    }
    
    return entity;
  }
} 