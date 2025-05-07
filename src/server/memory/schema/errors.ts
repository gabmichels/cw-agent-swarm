/**
 * Schema Validation Errors
 * 
 * This module defines the error types used by the schema validation system.
 */

import { AppError } from '../../../lib/errors/base';
import { ValidationError as ValidationErrorType } from './types';

/**
 * Base error class for schema-related errors
 */
export class SchemaError extends AppError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `SCHEMA_${code}`, context);
    this.name = 'SchemaError';
  }
}

/**
 * Error thrown when a schema validation fails
 */
export class ValidationError extends SchemaError {
  /**
   * Validation failures
   */
  public readonly failures: ValidationErrorType[];
  
  constructor(
    message: string,
    failures: ValidationErrorType[] = [],
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      { ...context, failures }
    );
    this.name = 'ValidationError';
    this.failures = failures;
  }
  
  /**
   * Get a string representation of the validation errors
   */
  formatErrors(): string {
    if (this.failures.length === 0) {
      return 'No validation errors';
    }
    
    return this.failures.map(failure => {
      const { field, message, expected, received } = failure;
      
      let errorMsg = `${field}: ${message}`;
      
      if (expected !== undefined) {
        errorMsg += `, expected: ${expected}`;
      }
      
      if (received !== undefined) {
        errorMsg += `, received: ${received}`;
      }
      
      return errorMsg;
    }).join('\n');
  }
}

/**
 * Error thrown when a schema is not found
 */
export class SchemaNotFoundError extends SchemaError {
  constructor(
    schemaName: string,
    version?: string,
    context: Record<string, unknown> = {}
  ) {
    const versionText = version ? ` version ${version}` : '';
    super(
      `Schema ${schemaName}${versionText} not found`,
      'NOT_FOUND',
      { ...context, schemaName, version }
    );
    this.name = 'SchemaNotFoundError';
  }
}

/**
 * Error thrown when there's a schema version conflict
 */
export class SchemaVersionError extends SchemaError {
  constructor(
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'VERSION_ERROR',
      context
    );
    this.name = 'SchemaVersionError';
  }
}

/**
 * Error thrown when there's an error in the schema definition
 */
export class SchemaDefinitionError extends SchemaError {
  constructor(
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'DEFINITION_ERROR',
      context
    );
    this.name = 'SchemaDefinitionError';
  }
} 