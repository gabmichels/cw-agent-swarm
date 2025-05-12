/**
 * Validation utilities for memory schemas
 */
import { ValidationResult, MemoryType } from '../config';
import { createValidationError } from './error-handler';
import { AddMemoryParams, DeleteMemoryParams, GetMemoryParams, UpdateMemoryParams } from '../services/memory/types';
import { EditorType } from '@/types/metadata';

/**
 * Validates that a value is not null or undefined
 * @param value Value to check
 * @param fieldName Name of the field for error reporting
 * @returns ValidationResult
 */
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): ValidationResult {
  if (value === null || value === undefined) {
    return {
      valid: false,
      errors: [{ field: fieldName, message: `${fieldName} is required` }]
    };
  }
  return { valid: true };
}

/**
 * Validates that a value is a non-empty string
 * @param value Value to check
 * @param fieldName Name of the field for error reporting
 * @returns ValidationResult
 */
export function validateString(
  value: unknown,
  fieldName: string
): ValidationResult {
  if (typeof value !== 'string') {
    return {
      valid: false,
      errors: [{ field: fieldName, message: `${fieldName} must be a string` }]
    };
  }
  
  if (value.trim().length === 0) {
    return {
      valid: false,
      errors: [{ field: fieldName, message: `${fieldName} cannot be empty` }]
    };
  }
  
  return { valid: true };
}

/**
 * Validates that a value is a valid MemoryType
 * @param value Value to check
 * @param fieldName Name of the field for error reporting
 * @returns ValidationResult
 */
export function validateMemoryType(
  value: unknown,
  fieldName: string = 'type'
): ValidationResult {
  if (typeof value !== 'string') {
    return {
      valid: false,
      errors: [{ field: fieldName, message: `${fieldName} must be a string` }]
    };
  }
  
  const validTypes = Object.values(MemoryType);
  if (!validTypes.includes(value as MemoryType)) {
    return {
      valid: false,
      errors: [{
        field: fieldName,
        message: `${fieldName} must be one of: ${validTypes.join(', ')}`
      }]
    };
  }
  
  return { valid: true };
}

/**
 * Validates that a value is a valid timestamp (ISO string or Date object)
 * @param value Value to check
 * @param fieldName Name of the field for error reporting
 * @returns ValidationResult
 */
export function validateTimestamp(
  value: unknown,
  fieldName: string = 'timestamp'
): ValidationResult {
  // Allow Date objects
  if (value instanceof Date) {
    return { valid: true };
  }
  
  // Allow ISO timestamp strings
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return { valid: true };
    }
  }
  
  return {
    valid: false,
    errors: [{
      field: fieldName,
      message: `${fieldName} must be a valid timestamp`
    }]
  };
}

/**
 * Type for validation function
 */
export type ValidatorFn = (value: unknown) => ValidationResult;

/**
 * Validates that an object has all required fields and optional fields match expected types
 * @param object Object to validate
 * @param requiredFields Fields that must be present
 * @param optionalFields Fields that may be present and their type validators
 * @returns ValidationResult
 */
export function validateObject<T>(
  object: unknown,
  requiredFields: Array<keyof T>,
  optionalFields: Partial<Record<keyof T, ValidatorFn>> = {}
): ValidationResult {
  // Check if object is actually an object
  if (!object || typeof object !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'object', message: 'Must be an object' }]
    };
  }
  
  const errors: Array<{ field: string; message: string }> = [];
  
  // Check required fields
  for (const field of requiredFields) {
    const fieldName = String(field);
    if (!(fieldName in object)) {
      errors.push({ field: fieldName, message: `Missing required field: ${fieldName}` });
    }
  }
  
  // Validate optional fields if present
  for (const [field, validator] of Object.entries(optionalFields)) {
    if (field in object) {
      // Type assertion required since TypeScript can't guarantee that the validator is a ValidatorFn
      const validatorFn = validator as ValidatorFn;
      const result = validatorFn((object as any)[field]);
      if (!result.valid && result.errors) {
        errors.push(...result.errors);
      }
    }
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Throws if validation fails
 * @param validationResult Result to check
 * @throws ValidationError if validation fails
 */
export function throwIfInvalid(validationResult: ValidationResult): void {
  if (!validationResult.valid) {
    const fields = validationResult.errors?.reduce(
      (acc, error) => ({ ...acc, [error.field]: error.message }),
      {}
    );
    
    throw createValidationError('Validation failed', fields);
  }
}

/**
 * Validates and throws on failure
 * @param object Object to validate
 * @param schema Schema to validate against
 * @throws ValidationError if validation fails
 */
export function validateSchema<T>(
  object: unknown,
  schema: {
    required: Array<keyof T>;
    optional?: Partial<Record<keyof T, ValidatorFn>>;
  }
): void {
  const result = validateObject<T>(
    object,
    schema.required,
    schema.optional || {}
  );
  
  throwIfInvalid(result);
}

/**
 * Validate parameters for adding a memory
 */
export function validateAddMemoryParams(params: AddMemoryParams<any>): ValidationResult {
  const errors = [];
  
  // Required fields
  if (!params.type) {
    errors.push({ field: 'type', message: 'Memory type is required' });
  }
  
  if (!params.content) {
    errors.push({ field: 'content', message: 'Content is required' });
  }
  
  // Type validation
  if (params.type && !Object.values(MemoryType).includes(params.type)) {
    errors.push({ field: 'type', message: `Invalid memory type: ${params.type}` });
  }
  
  // Embedding validation
  if (params.embedding && (!Array.isArray(params.embedding) || params.embedding.length === 0)) {
    errors.push({ field: 'embedding', message: 'Embedding must be a non-empty array' });
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validate parameters for getting a memory
 */
export function validateGetMemoryParams(params: GetMemoryParams): ValidationResult {
  const errors = [];
  
  // Required fields
  if (!params.type) {
    errors.push({ field: 'type', message: 'Memory type is required' });
  }
  
  if (!params.id) {
    errors.push({ field: 'id', message: 'Memory ID is required' });
  }
  
  // Type validation
  if (params.type && !Object.values(MemoryType).includes(params.type)) {
    errors.push({ field: 'type', message: `Invalid memory type: ${params.type}` });
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validate parameters for updating a memory
 */
export function validateUpdateMemoryParams(params: UpdateMemoryParams<any>): ValidationResult {
  const errors = [];
  
  // Required fields
  if (!params.type) {
    errors.push({ field: 'type', message: 'Memory type is required' });
  }
  
  if (!params.id) {
    errors.push({ field: 'id', message: 'Memory ID is required' });
  }
  
  // At least one update field should be provided
  if (!params.content && !params.payload && !params.metadata) {
    errors.push({ 
      field: 'updates', 
      message: 'At least one update field (content, payload, or metadata) is required' 
    });
  }
  
  // Type validation
  if (params.type && !Object.values(MemoryType).includes(params.type)) {
    errors.push({ field: 'type', message: `Invalid memory type: ${params.type}` });
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validate parameters for deleting a memory
 */
export function validateDeleteMemoryParams(params: DeleteMemoryParams): ValidationResult {
  const errors = [];
  
  // Required fields
  if (!params.type) {
    errors.push({ field: 'type', message: 'Memory type is required' });
  }
  
  if (!params.id) {
    errors.push({ field: 'id', message: 'Memory ID is required' });
  }
  
  // Type validation
  if (params.type && !Object.values(MemoryType).includes(params.type)) {
    errors.push({ field: 'type', message: `Invalid memory type: ${params.type}` });
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validate parameters for rolling back a memory
 */
export function validateRollbackMemoryParams(params: {
  id: string;
  versionId: string;
  type?: MemoryType;
  editorType?: EditorType;
  editorId?: string;
}): ValidationResult {
  const errors = [];
  
  // Required fields
  if (!params.id) {
    errors.push({ field: 'id', message: 'Memory ID is required' });
  }
  
  if (!params.versionId) {
    errors.push({ field: 'versionId', message: 'Version ID is required' });
  }
  
  // Type validation if provided
  if (params.type && !Object.values(MemoryType).includes(params.type)) {
    errors.push({ field: 'type', message: `Invalid memory type: ${params.type}` });
  }
  
  // Editor type validation if provided
  if (params.editorType && !['system', 'user', 'agent'].includes(params.editorType)) {
    errors.push({ field: 'editorType', message: `Invalid editor type: ${params.editorType}` });
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
} 