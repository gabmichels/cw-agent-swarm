/**
 * Schema Validation Test
 * 
 * This module tests the schema validation system with a simple example.
 */

import { JSONSchema7 } from 'json-schema';
import { SchemaType } from '../types';
import { SchemaImpl } from '../schema';
import { SchemaVersionImpl } from '../version';
import { defaultSchemaRegistry } from '../registry';
import { createSchema, validateSchema, isValidSchema } from '../utils';

/**
 * Define a simple user interface
 */
interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  isActive: boolean;
}

/**
 * Create a JSON Schema for the user
 */
const userSchema: JSONSchema7 = {
  type: 'object',
  required: ['id', 'name', 'email', 'isActive'],
  properties: {
    id: { type: 'string', pattern: '^user_[a-z0-9]+$' },
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', minimum: 0, maximum: 120 },
    isActive: { type: 'boolean' }
  }
};

/**
 * Create and register the user schema
 */
const userSchemaV1 = createSchema<User>(
  'user',
  '1.0',
  SchemaType.DTO,
  userSchema,
  {
    isActive: true // Default to active
  }
);

// Register with the registry
defaultSchemaRegistry.register(userSchemaV1);

/**
 * Valid user example
 */
const validUser = {
  id: 'user_123abc',
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  isActive: true
};

/**
 * Invalid user example (invalid email and missing required field)
 */
const invalidUser = {
  id: 'user_456def',
  name: 'Jane Smith',
  email: 'invalid-email', // Invalid email
  // Missing isActive field
};

/**
 * Test the schema validation
 */
export function runValidationTest(): void {
  console.log('------- Schema Validation Test -------');
  
  // Test schema registration
  console.log('Schema registered:', defaultSchemaRegistry.hasSchema('user'));
  
  // Test valid user
  console.log('\nValidating valid user:');
  const validResult = validateSchema<User>(validUser, 'user', undefined, false);
  console.log('Valid user result:', validResult.valid);
  if (!validResult.valid && validResult.errors) {
    console.log('Errors:', validResult.errors);
  }
  
  // Test invalid user
  console.log('\nValidating invalid user:');
  const invalidResult = validateSchema<User>(invalidUser, 'user', undefined, false);
  console.log('Invalid user result:', invalidResult.valid);
  if (!invalidResult.valid && invalidResult.errors) {
    console.log('Errors:');
    invalidResult.errors.forEach(error => {
      console.log(`- ${error.field}: ${error.message}`);
    });
  }
  
  // Test type guard
  console.log('\nTesting type guard:');
  if (isValidSchema<User>(validUser, 'user')) {
    console.log(`User ${validUser.name} is valid with email ${validUser.email}`);
  }
  
  if (!isValidSchema<User>(invalidUser, 'user')) {
    console.log('Invalid user detected by type guard');
  }
  
  // Test creating entity with defaults
  console.log('\nCreating user with defaults:');
  try {
    const newUser = userSchemaV1.create({
      id: 'user_new',
      name: 'New User',
      email: 'new@example.com'
      // isActive will be set to true from defaults
    });
    
    console.log('Created user:', newUser);
    console.log('Default isActive value:', newUser.isActive);
  } catch (error) {
    console.error('Error creating user:', error);
  }
  
  console.log('------- Test Complete -------');
}

// Run the test when this module is executed directly
if (require.main === module) {
  runValidationTest();
} 