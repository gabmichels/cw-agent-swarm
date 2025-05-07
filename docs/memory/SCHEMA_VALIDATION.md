# Schema Validation System

## Overview

The Schema Validation System provides a comprehensive solution for data validation, schema evolution, and migration in the memory subsystem. It ensures type safety, data integrity, and provides a clear migration path for evolving schemas over time.

## Key Features

- **Type-Safe Validation**: Integration with TypeScript's type system for static type checking
- **JSON Schema**: Validation using JSON Schema standard for flexible validation rules
- **Schema Versioning**: Support for major and minor versioning to manage schema evolution
- **Schema Registry**: Central registry for managing schema definitions
- **Migration Framework**: System for transforming data between schema versions
- **Detailed Error Reporting**: Comprehensive error messages for validation failures

## Components

### 1. Schema Interface

The `Schema<T>` interface defines the core validation capabilities:

```typescript
interface Schema<T> {
  name: string;
  version: SchemaVersion;
  type: SchemaType;
  jsonSchema: JSONSchema7;
  validate(data: unknown): ValidationResult;
  isValid(data: unknown): data is T;
  getDefaults(): Partial<T>;
  create(data: Partial<T>): T;
}
```

### 2. Schema Registry

The `SchemaRegistry` manages registration and lookup of schemas:

```typescript
interface SchemaRegistry {
  register<T>(schema: Schema<T>): void;
  getSchema<T>(name: string, version?: SchemaVersion): Schema<T>;
  getLatestSchema<T>(name: string): Schema<T>;
  getSchemaVersions(name: string): Schema<unknown>[];
  hasSchema(name: string, version?: SchemaVersion): boolean;
}
```

### 3. Schema Migration

The `SchemaMigration` interface enables data transformation between schema versions:

```typescript
interface SchemaMigration<S, T> {
  sourceSchema: Schema<S>;
  targetSchema: Schema<T>;
  migrate(data: S): T;
  canMigrate(data: unknown): data is S;
}
```

## Usage

### Creating a Schema

```typescript
import { createSchema, SchemaType } from '../../server/memory/schema';
import { JSONSchema7 } from 'json-schema';

// Define TypeScript interface
interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  isActive: boolean;
}

// Define JSON Schema
const userSchema: JSONSchema7 = {
  type: 'object',
  required: ['id', 'name', 'email', 'isActive'],
  properties: {
    id: { type: 'string', pattern: '^user_[a-z0-9]+$' },
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', minimum: 0 },
    isActive: { type: 'boolean' }
  }
};

// Create schema with defaults
const userSchemaV1 = createSchema<User>(
  'user',         // name
  '1.0',          // version
  SchemaType.DTO, // type
  userSchema,     // JSON Schema
  {
    isActive: true // Default values
  }
);

// Register with registry
import { defaultSchemaRegistry } from '../../server/memory/schema';
defaultSchemaRegistry.register(userSchemaV1);
```

### Validating Data

```typescript
import { validateSchema, isValidSchema } from '../../server/memory/schema';

// Method 1: Get validation result
const validationResult = validateSchema<User>(userData, 'user');
if (validationResult.valid) {
  console.log('Data is valid!');
} else {
  console.error('Validation errors:', validationResult.errors);
}

// Method 2: Type guard
if (isValidSchema<User>(userData, 'user')) {
  // userData is typed as User here
  console.log(`User name: ${userData.name}`);
} else {
  console.error('Invalid user data');
}
```

### Creating Entities

```typescript
import { createEntity } from '../../server/memory/schema';

// Create entity with validation
const user = createEntity<User>({
  id: 'user_123',
  name: 'John Doe',
  email: 'john@example.com'
  // isActive will be set to true from defaults
}, 'user');
```

### Implementing Schema Migration

```typescript
import { SchemaMigration, defaultMigrationService } from '../../server/memory/schema';

// Define migration
class UserV1ToV2Migration implements SchemaMigration<UserV1, UserV2> {
  sourceSchema = userSchemaV1;
  targetSchema = userSchemaV2;
  
  canMigrate(data: unknown): data is UserV1 {
    return this.sourceSchema.isValid(data);
  }
  
  migrate(data: UserV1): UserV2 {
    return {
      ...data,
      fullName: data.name,  // renamed field
      verified: false,      // new field
      schemaVersion: 'v2.0'
    };
  }
}

// Register migration
const migration = new UserV1ToV2Migration();
defaultMigrationService.register(migration);

// Migrate data
const userV2 = defaultMigrationService.migrate(userV1Data, userSchemaV2);
```

## Schema Evolution Guidelines

### Major Version Change

Increment major version for breaking changes:
- Removing or renaming required fields
- Changing field types in a non-compatible way
- Restructuring data organization

### Minor Version Change

Increment minor version for backward-compatible changes:
- Adding new optional fields
- Making optional fields required with defaults
- Adding new enum values

## Running Tests

Run the schema validation tests using:

```bash
npx ts-node-dev --project tsconfig.node.json src/server/memory/schema/examples/validation-test.ts
```

## Related Documents

- [Schema Versioning Strategy](../refactoring/architecture/designs/SCHEMA_VERSIONING_STRATEGY.md) - Detailed design document for the schema versioning approach
- [Schema Validation README](../../src/server/memory/schema/README.md) - Implementation documentation with code examples 