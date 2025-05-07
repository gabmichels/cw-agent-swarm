# Memory Service Design

## Overview

This document outlines the design for the memory service layer that will replace the existing implementation. The memory service provides a standardized interface for working with different types of memory collections while enforcing type safety, validation, and proper error handling.

## Current Issues

1. **Inconsistent Type Safety**: Many operations use `any` types or loose typings
2. **Limited Validation**: Inconsistent validation across different operations
3. **Poor Error Handling**: Errors are not consistently handled or propagated
4. **Limited Abstraction**: Direct database access in many places without proper abstraction
5. **Timestamp-based IDs**: Unsafe ID generation approach

## Design Goals

1. **Strict Type Safety**: Eliminate all `any` types and enforce proper interfaces
2. **Interface-First Design**: Define clear interfaces for all components
3. **Centralized Validation**: Consistent validation across all operations
4. **Standardized Error Handling**: Proper error propagation and handling
5. **ULID-Based Identification**: Use ULID for all identifiers
6. **Repository Pattern**: Implement clean separation between data access and business logic

## Core Interfaces

### Base Memory Entity

All memory entities will implement this interface:

```typescript
export interface BaseMemoryEntity {
  // ULID identifier
  id: StructuredId;
  
  // Content (text or structured data)
  content: string;
  
  // Type of memory
  type: MemoryType;
  
  // Creation timestamp
  createdAt: Date;
  
  // Last update timestamp
  updatedAt: Date;
  
  // Metadata object (typed by entity type)
  metadata: Record<string, unknown>;
}
```

### Memory Repository Interface

The base repository interface for all memory operations:

```typescript
export interface IMemoryRepository<T extends BaseMemoryEntity> {
  // Create a new memory entity
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  
  // Get a memory entity by ID
  getById(id: StructuredId): Promise<T | null>;
  
  // Update a memory entity
  update(id: StructuredId, updates: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T | null>;
  
  // Delete a memory entity
  delete(id: StructuredId, options?: { hardDelete?: boolean }): Promise<boolean>;
  
  // Search for memory entities by vector similarity
  search(query: string, options?: SearchOptions): Promise<T[]>;
  
  // Search by vector directly
  searchByVector(vector: number[], options?: SearchOptions): Promise<T[]>;
  
  // Filter by metadata conditions
  filter(conditions: FilterConditions<T>, options?: FilterOptions): Promise<T[]>;
}
```

### Memory Service Interface

The service layer that adds business logic on top of repositories:

```typescript
export interface IMemoryService<T extends BaseMemoryEntity> {
  // Repository this service uses
  repository: IMemoryRepository<T>;
  
  // Create a new memory entity
  create(params: CreateParams<T>): Promise<Result<T>>;
  
  // Get a memory entity by ID
  getById(id: StructuredId): Promise<Result<T | null>>;
  
  // Update a memory entity
  update(id: StructuredId, updates: UpdateParams<T>): Promise<Result<T | null>>;
  
  // Delete a memory entity
  delete(id: StructuredId, options?: DeleteOptions): Promise<Result<boolean>>;
  
  // Search for memory entities
  search(params: SearchParams): Promise<Result<T[]>>;
  
  // Execute custom operations with transaction support
  withTransaction<R>(operation: (repo: IMemoryRepository<T>) => Promise<R>): Promise<Result<R>>;
}
```

## Type Safety Approach

### Type-Safe Collections

Each memory collection will have its own entity type:

```typescript
// Chat memory specific entity
export interface ChatMemoryEntity extends BaseMemoryEntity {
  metadata: {
    chatId: StructuredId;
    messageId?: StructuredId;
    role: 'user' | 'assistant' | 'system';
    sentiment?: number;
    // Additional chat-specific metadata
  }
}

// Knowledge memory specific entity
export interface KnowledgeMemoryEntity extends BaseMemoryEntity {
  metadata: {
    source: string;
    confidence: number;
    category: string;
    tags: string[];
    // Additional knowledge-specific metadata
  }
}
```

### Type-Safe Filter Conditions

```typescript
export type FilterOperator = 
  | 'equals' 
  | 'notEquals' 
  | 'contains' 
  | 'greaterThan' 
  | 'lessThan' 
  | 'in' 
  | 'exists';

// Type-safe filter conditions that ensure property names match entity type
export type FilterConditions<T> = {
  [K in keyof T]?: FilterCondition<T[K]>;
};

export interface FilterCondition<T> {
  operator: FilterOperator;
  value: T | T[] | null;
}
```

## Implementation Structure

### Abstract Base Repository

```typescript
export abstract class BaseMemoryRepository<T extends BaseMemoryEntity> implements IMemoryRepository<T> {
  constructor(
    protected readonly client: IVectorDatabaseClient, 
    protected readonly collectionName: string,
    protected readonly validator: SchemaValidator<T>,
    protected readonly embeddingService: EmbeddingService
  ) {}
  
  // Implementation of IMemoryRepository interface methods
  
  // Abstract methods that must be implemented by derived classes
  protected abstract mapToEntity(record: DatabaseRecord): T;
  protected abstract mapFromEntity(entity: T): DatabaseRecord;
}
```

### Collection-Specific Repositories

```typescript
export class ChatMemoryRepository extends BaseMemoryRepository<ChatMemoryEntity> {
  constructor(
    client: IVectorDatabaseClient,
    embeddingService: EmbeddingService,
  ) {
    super(
      client,
      'chat_memories',
      new SchemaValidator<ChatMemoryEntity>(chatMemorySchema),
      embeddingService
    );
  }
  
  // Implement abstract methods with chat-specific mapping logic
  protected mapToEntity(record: DatabaseRecord): ChatMemoryEntity {
    // Chat-specific mapping implementation
  }
  
  protected mapFromEntity(entity: ChatMemoryEntity): DatabaseRecord {
    // Chat-specific mapping implementation
  }
  
  // Add chat-specific methods
  async getByChatId(chatId: StructuredId): Promise<ChatMemoryEntity[]> {
    // Implement chat-specific retrieval
  }
}
```

### Memory Service Base Class

```typescript
export abstract class BaseMemoryService<T extends BaseMemoryEntity> implements IMemoryService<T> {
  constructor(public readonly repository: IMemoryRepository<T>) {}
  
  // Implementation of IMemoryService interface methods with:
  // - Input validation
  // - Error handling
  // - Logging
  // - Performance monitoring
  
  // Example implementation
  async create(params: CreateParams<T>): Promise<Result<T>> {
    try {
      // Validate input
      this.validateCreateParams(params);
      
      // Create entity
      const entity = await this.repository.create(params);
      
      // Return success result
      return {
        success: true,
        data: entity
      };
    } catch (error) {
      // Convert to standardized error
      const memoryError = this.handleError(error, 'create');
      
      // Return error result
      return {
        success: false,
        error: memoryError
      };
    }
  }
  
  // Additional implementations of interface methods
  
  // Abstract methods for validation
  protected abstract validateCreateParams(params: CreateParams<T>): void;
  protected abstract validateUpdateParams(params: UpdateParams<T>): void;
}
```

### Collection-Specific Services

```typescript
export class ChatMemoryService extends BaseMemoryService<ChatMemoryEntity> {
  constructor(repository: IMemoryRepository<ChatMemoryEntity>) {
    super(repository);
  }
  
  // Implement abstract validation methods
  protected validateCreateParams(params: CreateParams<ChatMemoryEntity>): void {
    // Chat-specific validation logic
  }
  
  protected validateUpdateParams(params: UpdateParams<ChatMemoryEntity>): void {
    // Chat-specific validation logic
  }
  
  // Add chat-specific methods
  async getChatHistory(chatId: StructuredId): Promise<Result<ChatMemoryEntity[]>> {
    // Chat-specific implementation
  }
}
```

## Error Handling

### Standard Result Type

```typescript
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: MemoryError;
}

export class MemoryError extends AppError {
  constructor(
    code: MemoryErrorCode,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, `MEMORY_${code}`, context);
    this.name = 'MemoryError';
  }
}

export enum MemoryErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EMBEDDING_ERROR = 'EMBEDDING_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  // Additional error codes
}
```

### Error Handling Pattern

```typescript
protected handleError(error: unknown, operation: string): MemoryError {
  // Already a MemoryError
  if (error instanceof MemoryError) {
    return error;
  }
  
  // Known error types
  if (error instanceof ValidationError) {
    return new MemoryError(
      MemoryErrorCode.VALIDATION_ERROR,
      error.message,
      { operation, validationErrors: error.errors }
    );
  }
  
  if (error instanceof DatabaseError) {
    return new MemoryError(
      MemoryErrorCode.DATABASE_ERROR,
      `Database error during ${operation}: ${error.message}`,
      { operation, databaseError: error.details }
    );
  }
  
  // Generic error handling
  const message = error instanceof Error ? error.message : String(error);
  return new MemoryError(
    MemoryErrorCode.UNKNOWN_ERROR,
    `Error during ${operation}: ${message}`,
    { operation }
  );
}
```

## Schema Validation

### Schema Validator

```typescript
export class SchemaValidator<T> {
  private schema: Schema;
  
  constructor(schema: Schema) {
    this.schema = schema;
  }
  
  validate(data: unknown): asserts data is T {
    const result = validateSchema(this.schema, data);
    if (!result.valid) {
      throw new ValidationError(
        'Schema validation failed',
        result.errors || []
      );
    }
  }
  
  isValid(data: unknown): data is T {
    const result = validateSchema(this.schema, data);
    return result.valid;
  }
}
```

## Implementation Approach

1. **Define Interfaces First**: Complete all interfaces before implementation
2. **Create Abstract Base Classes**: Implement shared functionality
3. **Implement Collection-Specific Classes**: Add specialized functionality for each collection
4. **Add Validation Logic**: Implement schema validation for all entity types
5. **Implement Error Handling**: Create standardized error handling across all services
6. **Create Migration Utilities**: Build one-time migration tools for existing data

## Testing Strategy

1. **Interface Compliance Tests**: Ensure all implementations adhere to interfaces
2. **Unit Tests**: Test each service and repository in isolation
3. **Integration Tests**: Test interactions between services and repositories
4. **Schema Validation Tests**: Verify validation catches invalid data
5. **Error Handling Tests**: Verify errors are properly caught and handled
6. **Performance Tests**: Measure and optimize critical operations

## Example Usage

```typescript
// Create a chat memory service
const chatMemoryRepository = new ChatMemoryRepository(
  vectorDatabaseClient,
  embeddingService
);
const chatMemoryService = new ChatMemoryService(chatMemoryRepository);

// Create a new chat memory
const result = await chatMemoryService.create({
  content: "Hello, how can I help you today?",
  type: MemoryType.CHAT,
  metadata: {
    chatId: createChatId(),
    role: 'assistant'
  }
});

if (result.success) {
  console.log("Created memory:", result.data.id.toString());
} else {
  console.error("Failed to create memory:", result.error.message);
}

// Search chat history
const searchResult = await chatMemoryService.search({
  query: "help",
  filter: {
    metadata: {
      chatId: {
        operator: 'equals',
        value: chatId
      }
    }
  },
  limit: 10
});

if (searchResult.success) {
  console.log(`Found ${searchResult.data.length} memories`);
} else {
  console.error("Search failed:", searchResult.error.message);
}
```

## Conclusion

This memory service design provides a robust, type-safe, and maintainable approach to memory management. By focusing on clear interfaces, strict type safety, and standardized error handling, we can ensure consistency across the system while maintaining high performance and reliability. 