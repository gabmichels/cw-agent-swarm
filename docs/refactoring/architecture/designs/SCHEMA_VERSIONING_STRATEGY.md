# Schema Versioning Strategy

## Overview

This document outlines the design for a schema versioning strategy that enables safe evolution of data schemas while maintaining data integrity. The approach follows the clean break principle from the refactoring guidelines and emphasizes forward compatibility without legacy support.

## Current Issues

1. **Implicit Schema Changes**: Schema changes are often made without explicit versioning
2. **Mixed Schema Data**: Different schema versions exist in the same collections without clear differentiation
3. **No Migration Path**: Lack of structured migration approach for schema changes
4. **Inconsistent Validation**: Validation varies across the system
5. **Brittle Field Access**: Direct field access makes schema changes error-prone

## Design Goals

1. **Explicit Versioning**: Add clear version identifiers to all schemas
2. **Schema Validation**: Enforce strict validation for all operations
3. **Type Safety**: Use TypeScript to ensure type safety with schema changes
4. **Single Source of Truth**: Centralize schema definitions
5. **Clean Migration**: Provide one-time migration tools rather than maintaining backward compatibility
6. **Forward Compatibility**: Design for easy forward evolution

## Core Schema Versioning Approach

### Schema Version Interface

```typescript
export interface SchemaVersion {
  // Major version for breaking changes
  major: number;
  
  // Minor version for backward-compatible additions
  minor: number;
  
  // String representation (vMAJOR.MINOR)
  toString(): string;
  
  // Check if this version is newer than another
  isNewerThan(other: SchemaVersion): boolean;
  
  // Check if this version is compatible with another
  isCompatibleWith(other: SchemaVersion): boolean;
}
```

### Base Schema Interface

```typescript
export interface BaseSchema<T> {
  // Schema name (e.g., "chat_memory")
  name: string;
  
  // Schema version
  version: SchemaVersion;
  
  // Schema type
  type: SchemaType;
  
  // JSON Schema definition
  jsonSchema: JSONSchema7;
  
  // Validate data against this schema
  validate(data: unknown): ValidationResult;
  
  // Check if data conforms to this schema
  isValid(data: unknown): data is T;
  
  // Get default values for this schema
  getDefaults(): Partial<T>;
}
```

### Schema Registry

```typescript
export interface SchemaRegistry {
  // Register a schema
  register<T>(schema: BaseSchema<T>): void;
  
  // Get a schema by name and version
  getSchema<T>(name: string, version?: SchemaVersion): BaseSchema<T>;
  
  // Get the latest schema for a name
  getLatestSchema<T>(name: string): BaseSchema<T>;
  
  // Get all versions of a schema
  getSchemaVersions(name: string): BaseSchema<unknown>[];
  
  // Check if a schema exists
  hasSchema(name: string, version?: SchemaVersion): boolean;
}
```

## Implementation Details

### Schema Version Implementation

```typescript
export class SchemaVersionImpl implements SchemaVersion {
  constructor(
    public readonly major: number,
    public readonly minor: number
  ) {
    if (major < 0 || minor < 0) {
      throw new Error('Version numbers cannot be negative');
    }
  }
  
  toString(): string {
    return `v${this.major}.${this.minor}`;
  }
  
  isNewerThan(other: SchemaVersion): boolean {
    if (this.major > other.major) return true;
    if (this.major === other.major && this.minor > other.minor) return true;
    return false;
  }
  
  isCompatibleWith(other: SchemaVersion): boolean {
    // Only compatible if major versions match
    return this.major === other.major;
  }
  
  static parse(versionString: string): SchemaVersion {
    // Parse from string like "v1.2" or "1.2"
    const matches = versionString.match(/^v?(\d+)\.(\d+)$/);
    if (!matches) {
      throw new Error(`Invalid version string: ${versionString}`);
    }
    
    const major = parseInt(matches[1], 10);
    const minor = parseInt(matches[2], 10);
    
    return new SchemaVersionImpl(major, minor);
  }
}
```

### Schema Implementation

```typescript
export class SchemaImpl<T> implements BaseSchema<T> {
  constructor(
    public readonly name: string,
    public readonly version: SchemaVersion,
    public readonly type: SchemaType,
    public readonly jsonSchema: JSONSchema7,
    private readonly defaultValues: Partial<T> = {}
  ) {}
  
  validate(data: unknown): ValidationResult {
    const validator = new Ajv();
    const isValid = validator.validate(this.jsonSchema, data);
    
    if (isValid) {
      return { valid: true };
    }
    
    return {
      valid: false,
      errors: validator.errors?.map(error => ({
        field: error.dataPath.replace(/^\./, ''),
        message: error.message || 'Invalid value',
        rule: error.keyword
      })) || []
    };
  }
  
  isValid(data: unknown): data is T {
    return this.validate(data).valid;
  }
  
  getDefaults(): Partial<T> {
    return { ...this.defaultValues };
  }
}
```

### Schema Registry Implementation

```typescript
export class SchemaRegistryImpl implements SchemaRegistry {
  private schemas: Map<string, Map<string, BaseSchema<unknown>>> = new Map();
  
  register<T>(schema: BaseSchema<T>): void {
    const { name, version } = schema;
    const versionString = version.toString();
    
    // Create map for schema name if it doesn't exist
    if (!this.schemas.has(name)) {
      this.schemas.set(name, new Map());
    }
    
    // Add schema to version map
    const versionMap = this.schemas.get(name)!;
    if (versionMap.has(versionString)) {
      throw new Error(`Schema ${name} ${versionString} is already registered`);
    }
    
    versionMap.set(versionString, schema);
  }
  
  getSchema<T>(name: string, version?: SchemaVersion): BaseSchema<T> {
    // Get version map for schema name
    const versionMap = this.schemas.get(name);
    if (!versionMap) {
      throw new Error(`No schemas registered for ${name}`);
    }
    
    // If version is not specified, get the latest version
    if (!version) {
      return this.getLatestSchema<T>(name);
    }
    
    // Get schema for specific version
    const versionString = version.toString();
    const schema = versionMap.get(versionString);
    if (!schema) {
      throw new Error(`Schema ${name} ${versionString} not found`);
    }
    
    return schema as BaseSchema<T>;
  }
  
  getLatestSchema<T>(name: string): BaseSchema<T> {
    // Get version map for schema name
    const versionMap = this.schemas.get(name);
    if (!versionMap || versionMap.size === 0) {
      throw new Error(`No schemas registered for ${name}`);
    }
    
    // Find the latest version
    let latestSchema: BaseSchema<unknown> | undefined;
    let latestVersion: SchemaVersion | undefined;
    
    for (const schema of versionMap.values()) {
      if (!latestVersion || schema.version.isNewerThan(latestVersion)) {
        latestVersion = schema.version;
        latestSchema = schema;
      }
    }
    
    return latestSchema as BaseSchema<T>;
  }
  
  getSchemaVersions(name: string): BaseSchema<unknown>[] {
    // Get version map for schema name
    const versionMap = this.schemas.get(name);
    if (!versionMap) {
      return [];
    }
    
    // Convert to array and sort by version
    return Array.from(versionMap.values())
      .sort((a, b) => 
        a.version.isNewerThan(b.version) ? 1 : 
        b.version.isNewerThan(a.version) ? -1 : 0
      );
  }
  
  hasSchema(name: string, version?: SchemaVersion): boolean {
    const versionMap = this.schemas.get(name);
    if (!versionMap) {
      return false;
    }
    
    if (!version) {
      return true;
    }
    
    return versionMap.has(version.toString());
  }
}
```

## Schema Definition Approach

### Memory Schema Example

```typescript
// Define TypeScript interface
export interface ChatMemoryEntityV1 {
  id: StructuredId;
  content: string;
  type: MemoryType.CHAT;
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    chatId: StructuredId;
    messageId?: StructuredId;
    role: 'user' | 'assistant' | 'system';
    sentiment?: number;
  }
}

// Create JSON Schema
const chatMemorySchemaV1: JSONSchema7 = {
  $id: 'chat_memory_v1.0',
  type: 'object',
  required: ['id', 'content', 'type', 'createdAt', 'updatedAt', 'metadata'],
  properties: {
    id: { type: 'object', required: ['id', 'prefix', 'timestamp'] },
    content: { type: 'string' },
    type: { type: 'string', enum: [MemoryType.CHAT] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    metadata: {
      type: 'object',
      required: ['chatId', 'role'],
      properties: {
        chatId: { type: 'object' },
        messageId: { type: 'object' },
        role: { type: 'string', enum: ['user', 'assistant', 'system'] },
        sentiment: { type: 'number', minimum: -1, maximum: 1 }
      }
    }
  }
};

// Register schema
export const chatMemorySchema = new SchemaImpl<ChatMemoryEntityV1>(
  'chat_memory',
  new SchemaVersionImpl(1, 0),
  SchemaType.ENTITY,
  chatMemorySchemaV1,
  {
    // Default values
    metadata: {
      sentiment: 0
    }
  }
);

// Register with central registry
schemaRegistry.register(chatMemorySchema);
```

## Version Migration Strategy

### One-Time Migration Approach

Instead of maintaining backward compatibility in the code, we will implement one-time migration utilities for each schema change:

```typescript
export interface SchemaMigration<S, T> {
  // Source schema
  sourceSchema: BaseSchema<S>;
  
  // Target schema
  targetSchema: BaseSchema<T>;
  
  // Migrate data from source to target schema
  migrate(data: S): T;
  
  // Check if this migration can handle the source data
  canMigrate(data: unknown): data is S;
}
```

### Migration Example

```typescript
export class ChatMemoryV1ToV2Migration implements SchemaMigration<ChatMemoryEntityV1, ChatMemoryEntityV2> {
  sourceSchema = chatMemorySchemaV1;
  targetSchema = chatMemorySchemaV2;
  
  canMigrate(data: unknown): data is ChatMemoryEntityV1 {
    return this.sourceSchema.isValid(data);
  }
  
  migrate(data: ChatMemoryEntityV1): ChatMemoryEntityV2 {
    // Create new entity with updated schema
    return {
      ...data,
      // Example: New field added in V2
      metadata: {
        ...data.metadata,
        // Add the new required field in V2
        languageCode: 'en',
        // Migrate the sentiment field format (-1 to 1 scale to 0 to 100 scale)
        sentiment: data.metadata.sentiment !== undefined 
          ? Math.round((data.metadata.sentiment + 1) * 50) 
          : 50
      }
    };
  }
}
```

## Migration Execution

### Batch Migration Utility

```typescript
export class MigrationService {
  constructor(
    private readonly migrations: SchemaMigration<any, any>[],
    private readonly repository: IMemoryRepository<any>
  ) {}
  
  /**
   * Migrate all data in a collection to the latest schema
   */
  async migrateCollection<T>(
    collectionName: string, 
    targetSchema: BaseSchema<T>
  ): Promise<MigrationResult> {
    // Query all records in the collection
    const records = await this.repository.queryAll(collectionName);
    
    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const record of records) {
      try {
        // Find migration path
        const migrations = this.findMigrationPath(record, targetSchema);
        
        if (migrations.length === 0) {
          // Already in target schema or no migration path
          skipped++;
          continue;
        }
        
        // Apply migrations in sequence
        let migratedData = record;
        for (const migration of migrations) {
          migratedData = migration.migrate(migratedData);
        }
        
        // Validate final result
        if (!targetSchema.isValid(migratedData)) {
          throw new Error('Migration result is invalid');
        }
        
        // Save migrated data
        await this.repository.update(collectionName, record.id, migratedData);
        migrated++;
      } catch (error) {
        failed++;
        console.error(`Migration failed for ${record.id}:`, error);
      }
    }
    
    return { migrated, skipped, failed };
  }
  
  /**
   * Find migration path from source data to target schema
   */
  private findMigrationPath<T>(
    data: unknown, 
    targetSchema: BaseSchema<T>
  ): SchemaMigration<any, any>[] {
    // Already in target schema
    if (targetSchema.isValid(data)) {
      return [];
    }
    
    // Find direct migration
    const directMigration = this.migrations.find(m => 
      m.canMigrate(data) && m.targetSchema.name === targetSchema.name
    );
    
    if (directMigration) {
      return [directMigration];
    }
    
    // No migration path found
    throw new Error(`No migration path found to target schema ${targetSchema.name}`);
  }
}
```

## Version Storage in Documents

All stored documents will include their schema version:

```typescript
{
  "id": "user_01FGW4ZQVSX7AAY1BSXDQ8S4Z7",
  "content": "Hello, how can I help you today?",
  "type": "chat",
  "createdAt": "2023-05-12T14:32:10.123Z",
  "updatedAt": "2023-05-12T14:32:10.123Z",
  "schemaVersion": "v1.0",
  "metadata": {
    "chatId": "chat_01FGW4ZQVSX7AAY1BSXDQ8S4Z8",
    "role": "assistant",
    "sentiment": 0
  }
}
```

## Schema Evolution Guidelines

### Versioning Rules

1. **Major Version Change When**:
   - Removing or renaming required fields
   - Changing field types in a non-compatible way
   - Restructuring data organization

2. **Minor Version Change When**:
   - Adding new optional fields
   - Making optional fields required with defaults
   - Adding new enum values

### Schema Update Process

1. Create a new schema version
2. Register the new schema in the schema registry
3. Implement a migration from previous version
4. Register the migration with the migration service
5. Run one-time migration for existing data

## Integration with Domain Components

### Repository Layer Integration

```typescript
export class TypedMemoryRepository<T> implements IMemoryRepository<T> {
  constructor(
    private readonly client: IVectorDatabaseClient,
    private readonly collectionName: string,
    private readonly schema: BaseSchema<T>,
    private readonly schemaRegistry: SchemaRegistry
  ) {}
  
  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    // Create new entity with defaults and schema version
    const newEntity = {
      ...this.schema.getDefaults(),
      ...entity,
      id: createStructuredId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: this.schema.version.toString()
    } as unknown as T;
    
    // Validate against schema
    const validationResult = this.schema.validate(newEntity);
    if (!validationResult.valid) {
      throw new ValidationError(
        'Entity validation failed',
        validationResult.errors || []
      );
    }
    
    // Save to database
    await this.client.addPoint(this.collectionName, this.mapToRecord(newEntity));
    
    return newEntity;
  }
  
  async getById(id: StructuredId): Promise<T | null> {
    // Get from database
    const record = await this.client.getPoint(this.collectionName, id.toString());
    if (!record) {
      return null;
    }
    
    // Convert to entity
    const entity = this.mapToEntity(record);
    
    // Ensure entity matches current schema
    return this.ensureCurrentSchema(entity);
  }
  
  // Additional repository methods
  
  /**
   * Ensure entity conforms to current schema
   */
  private async ensureCurrentSchema(entity: any): Promise<T> {
    // Check if schema version matches current
    const entityVersion = entity.schemaVersion 
      ? SchemaVersionImpl.parse(entity.schemaVersion) 
      : new SchemaVersionImpl(0, 0);
    
    // Already current schema
    if (this.schema.version.toString() === entityVersion.toString()) {
      return entity as T;
    }
    
    // Get migration service
    const migrationService = new MigrationService(
      // Lookup registered migrations
      this.getMigrationsForEntity(entity),
      this
    );
    
    // Migrate to current schema
    return migrationService.migrateEntity(entity, this.schema);
  }
}
```

## Schema Validation Integration

### Service Layer Integration

```typescript
export class TypedMemoryService<T> implements IMemoryService<T> {
  constructor(
    public readonly repository: IMemoryRepository<T>,
    private readonly schema: BaseSchema<T>
  ) {}
  
  async create(params: CreateParams<T>): Promise<Result<T>> {
    try {
      // Validate input against schema
      const validationResult = this.schema.validate(params);
      if (!validationResult.valid) {
        throw new ValidationError(
          'Invalid entity data',
          validationResult.errors || []
        );
      }
      
      // Create entity
      const entity = await this.repository.create(params);
      
      return {
        success: true,
        data: entity
      };
    } catch (error) {
      // Handle error
      return {
        success: false,
        error: convertToAppError(error)
      };
    }
  }
  
  // Additional service methods
}
```

## Testing Strategy

1. **Schema Validation Tests**: Ensure schemas properly validate data
2. **Migration Tests**: Verify migrations correctly transform data
3. **Version Compatibility Tests**: Test compatibility between versions
4. **Edge Case Tests**: Test boundary conditions and error cases
5. **Performance Tests**: Verify schema validation and migration performance

## Implementation Plan

1. **Define Schema Interfaces**: Create interfaces for schema versioning
2. **Implement Schema Registry**: Build the central schema registry
3. **Create Base Schemas**: Implement initial schemas for all entity types
4. **Build Migration Framework**: Create the migration infrastructure
5. **Update Repositories**: Integrate schema versioning with repositories
6. **Create Validation Helpers**: Build validation utilities
7. **One-Time Migration Tool**: Implement the migration execution tool

## Conclusion

This schema versioning strategy provides a robust approach to managing schema evolution over time. By embracing the clean break principle and focusing on one-time migrations rather than backwards compatibility, we can maintain a clean codebase while safely evolving our data schemas. 