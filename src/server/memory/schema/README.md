# Schema Validation System

This module provides a robust schema validation system for ensuring data integrity throughout the application. It follows the schema versioning strategy outlined in the architecture design documents.

## Core Components

### 1. Schema Interface

The `Schema` interface provides validation and type safety for data structures:

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

The `SchemaRegistry` manages schema registration and lookup:

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

The migration system handles schema evolution:

```typescript
interface SchemaMigration<S, T> {
  sourceSchema: Schema<S>;
  targetSchema: Schema<T>;
  migrate(data: S): T;
  canMigrate(data: unknown): data is S;
}
```

## Usage Examples

### Creating a Schema

```typescript
import { createSchema, SchemaType } from '../schema';
import { JSONSchema7 } from 'json-schema';

// Define TypeScript interface
interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
}

// Define JSON Schema
const userSchema: JSONSchema7 = {
  type: 'object',
  required: ['id', 'name', 'email'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', minimum: 0 }
  }
};

// Create schema
const userSchemaV1 = createSchema<User>(
  'user',         // name
  '1.0',          // version
  SchemaType.DTO, // type
  userSchema,     // JSON Schema
  { age: 18 }     // default values
);

// Register schema
import { defaultSchemaRegistry } from '../schema';
defaultSchemaRegistry.register(userSchemaV1);
```

### Validating Data

```typescript
import { validateSchema, isValidSchema } from '../schema';

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
import { createEntity } from '../schema';

// Create entity with validation
const user = createEntity<User>({
  id: 'user_123',
  name: 'John Doe',
  email: 'john@example.com'
}, 'user');

// Age will be set to 18 from defaults
console.log(user.age); // 18
```

### Schema Migration

```typescript
import { SchemaMigration, defaultMigrationService } from '../schema';

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

// Use migration
const userV2 = defaultMigrationService.migrate(userV1Data, userSchemaV2);
```

## Best Practices

1. **Explicit Versioning**: Always include explicit schema versions
2. **Strict Validation**: Validate data at boundaries (API, database)
3. **Migration Path**: Provide migration paths for all schema changes
4. **Type Safety**: Leverage TypeScript interfaces with schemas
5. **Single Source of Truth**: Centralize schema definitions
6. **Documentation**: Document schema changes and migration strategies

## Schema Evolution Guidelines

### Major Version Changes

Increment major version for breaking changes:
- Removing or renaming required fields
- Changing field types in a non-compatible way
- Restructuring data organization

### Minor Version Changes

Increment minor version for backward-compatible changes:
- Adding new optional fields
- Making optional fields required with defaults
- Adding new enum values 