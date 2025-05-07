# Memory Service Base Classes

This module provides base classes and interfaces for memory services with enforced type safety, validation, and standardized error handling.

## Overview

The memory service base classes provide a foundation for implementing type-safe, schema-validated memory services. They follow a repository pattern with clear separation between:

1. **Repositories** - Handle data access and storage operations
2. **Services** - Provide business logic and error handling

## Key Components

### Base Repository

The `BaseMemoryRepository<T>` abstract class implements the `IMemoryRepository<T>` interface and provides:

- Type-safe CRUD operations for memory entities
- Schema validation on create and update operations
- Mapping between database records and domain entities
- Integration with embedding service for vector operations

```typescript
export abstract class BaseMemoryRepository<T extends BaseMemoryEntity> implements IMemoryRepository<T> {
  constructor(
    public readonly collectionName: string,
    public readonly schema: Schema<T>,
    protected readonly databaseClient: IVectorDatabaseClient,
    protected readonly embeddingService: IEmbeddingService
  ) {}
  
  // Implementation of CRUD operations
  
  // Abstract method that must be implemented by subclasses
  protected abstract mapToEntity(record: DatabaseRecord): T;
}
```

### Base Service

The `BaseMemoryService<T>` abstract class implements the `IMemoryService<T>` interface and provides:

- Business logic for memory operations
- Standardized error handling and result types
- Transaction support

```typescript
export abstract class BaseMemoryService<T extends BaseMemoryEntity> implements IMemoryService<T> {
  constructor(public readonly repository: IMemoryRepository<T>) {}
  
  // Implementation of service methods
  
  // Error handling utilities
  protected handleError<R>(
    error: unknown,
    defaultCode: MemoryErrorCode,
    context: Record<string, unknown> = {}
  ): Result<R> {
    // Error handling implementation
  }
}
```

## Type Safety

The implementation enforces type safety through:

1. Generic type parameters for entity types
2. Interface-first design
3. Type-safe filter conditions
4. Strong typing for all operations

## Usage

### Creating a Repository

To create a repository for a specific memory type:

1. Define the entity type that extends `BaseMemoryEntity`
2. Create a schema for validation
3. Extend `BaseMemoryRepository` and implement the `mapToEntity` method

```typescript
// 1. Define entity
interface ChatMemoryEntity extends BaseMemoryEntity {
  metadata: {
    chatId: string;
    role: 'user' | 'assistant' | 'system';
    // Additional fields
  }
}

// 2. Create schema
const chatMemorySchema = new SchemaImpl<ChatMemoryEntity>(/* schema details */);

// 3. Create repository
class ChatMemoryRepository extends BaseMemoryRepository<ChatMemoryEntity> {
  constructor(dbClient, embeddingService) {
    super('chat_memories', chatMemorySchema, dbClient, embeddingService);
  }
  
  protected mapToEntity(record: DatabaseRecord): ChatMemoryEntity {
    // Mapping implementation
  }
  
  // Additional methods specific to chat memories
}
```

### Creating a Service

To create a service for a specific memory type:

1. Extend `BaseMemoryService` with the entity type
2. Add domain-specific methods

```typescript
class ChatMemoryService extends BaseMemoryService<ChatMemoryEntity> {
  constructor(repository: IMemoryRepository<ChatMemoryEntity>) {
    super(repository);
  }
  
  // Domain-specific methods
  async getChatHistory(chatId: string): Promise<Result<ChatMemoryEntity[]>> {
    // Implementation
  }
}
```

## Examples

Check the `examples` directory for concrete implementations:

- `chat-memory-repository.ts` - Example repository for chat memories
- `chat-memory-service.ts` - Example service for chat memories
- `chat-memory-schema.ts` - Example schema for chat memories

## Error Handling

All operations return a `Result<T>` type that encapsulates either a successful result or an error:

```typescript
interface Result<T> {
  success: boolean;
  data?: T;
  error?: AppError;
}
```

This allows consumers to handle errors in a standardized way:

```typescript
const result = await chatMemoryService.getChatHistory(chatId);

if (result.success) {
  // Handle success case with result.data
} else {
  // Handle error case with result.error
}
``` 