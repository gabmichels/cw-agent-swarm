# Memory System Standardization - Proposed Solution

Based on the audit of the current memory system, this document outlines a standardized approach to memory operations.

## Core Principles

1. **Standardized Interfaces**: Consistent parameter and return types for all operations
2. **Strict Typing**: Type-safe operations with schema validation
3. **Separation of Concerns**: Clear boundaries between different responsibilities
4. **Error Handling**: Consistent error handling throughout
5. **Testability**: Designed for comprehensive testing
6. **Modularity**: Breaking the monolithic design into cohesive modules

## Architecture Overview

```
/src
  /server
    /memory
      /config         - Configuration constants and types
      /models         - Schema definitions for all memory types
      /client         - Database client wrapper (QdrantClient)
      /services       - Higher level services
        /memory       - Core memory operations
        /search       - Search functionality
        /importance   - Importance calculation and management
        /causal       - Causal relationship management
        /history      - Version history tracking
      /utils          - Utility functions
      /embedding      - Embedding generation
      /testing        - Test utilities and mocks
      index.ts        - Public API facade
```

## Key Components

### 1. Standardized Collection Configuration

```typescript
// Collection configuration with types, schema, and indices
export interface CollectionConfig<T extends MemorySchema> {
  name: string;        // Collection name in Qdrant
  schema: T;           // Schema type for this collection
  indices: string[];   // Fields to index
  defaults: Partial<T>; // Default values
}

export const COLLECTIONS: Record<MemoryType, CollectionConfig<any>> = {
  message: {
    name: 'messages',
    schema: MessageSchema,
    indices: ['timestamp', 'type', 'metadata.role'],
    defaults: { metadata: { importance: 'medium' } }
  },
  // Other collections...
};
```

### 2. Memory Client

```typescript
export class MemoryClient {
  constructor(options: MemoryClientOptions) {
    // Initialize Qdrant client with proper error handling
  }

  // Core CRUD operations
  async addPoint<T extends MemorySchema>(
    collection: string,
    point: MemoryPoint<T>
  ): Promise<string>;

  async searchPoints<T extends MemorySchema>(
    collection: string,
    query: SearchQuery
  ): Promise<SearchResult<T>[]>;

  async updatePoint<T extends MemorySchema>(
    collection: string,
    id: string,
    updates: Partial<MemoryPoint<T>>
  ): Promise<boolean>;

  async deletePoint(
    collection: string,
    id: string,
    options?: DeleteOptions
  ): Promise<boolean>;

  // Collection management
  async ensureCollection(
    collection: string,
    config: CollectionConfig
  ): Promise<void>;

  async resetCollection(
    collection: string
  ): Promise<boolean>;
}
```

### 3. Memory Service

```typescript
export class MemoryService {
  constructor(
    private client: MemoryClient,
    private embeddingService: EmbeddingService
  ) {}

  // Core memory operations
  async addMemory<T extends MemoryType>(
    params: AddMemoryParams<T>
  ): Promise<MemoryResult>;

  async getMemory<T extends MemoryType>(
    params: GetMemoryParams
  ): Promise<Memory<T> | null>;

  async updateMemory<T extends MemoryType>(
    params: UpdateMemoryParams<T>
  ): Promise<boolean>;

  async deleteMemory(
    params: DeleteMemoryParams
  ): Promise<boolean>;

  // Higher-level operations
  async searchMemories<T extends MemoryType>(
    params: SearchMemoryParams<T>
  ): Promise<SearchMemoryResult<T>[]>;

  async getRecentMemories<T extends MemoryType>(
    params: GetRecentMemoriesParams<T>
  ): Promise<Memory<T>[]>;
}
```

### 4. Schema Validation

```typescript
// Base memory schema with required fields
export interface BaseMemorySchema {
  id: string;
  text: string;
  timestamp: string;
  type: MemoryType;
  is_deleted?: boolean;
}

// Message-specific schema
export interface MessageSchema extends BaseMemorySchema {
  type: 'message';
  metadata: {
    role: 'user' | 'assistant' | 'system';
    userId: string;
    messageType?: string;
    importance?: ImportanceLevel;
    importance_score?: number;
    // Other message-specific fields...
  };
}

// Schema validation function
export function validateSchema<T extends MemorySchema>(
  data: unknown,
  schema: SchemaType<T>
): ValidationResult;
```

### 5. Standard Error Handling

```typescript
// Memory-specific error types
export class MemoryError extends Error {
  constructor(message: string, public code: MemoryErrorCode) {
    super(message);
  }
}

export enum MemoryErrorCode {
  NOT_FOUND = 'MEMORY_NOT_FOUND',
  VALIDATION_ERROR = 'MEMORY_VALIDATION_ERROR',
  DATABASE_ERROR = 'MEMORY_DATABASE_ERROR',
  EMBEDDING_ERROR = 'MEMORY_EMBEDDING_ERROR',
  // Other error codes...
}

// Error handler
export function handleMemoryError(
  error: unknown,
  operation: string
): MemoryError;
```

## Standardized Query Format

All memory queries will use a consistent format:

```typescript
export interface MemoryQuery<T extends MemoryType> {
  type?: T | T[];             // Memory type(s) to query
  filter?: MemoryFilter;      // Filter conditions
  vector?: number[];          // Vector for semantic search
  query?: string;             // Text query to convert to vector
  limit?: number;             // Maximum results
  offset?: number;            // Pagination offset
  includeDeleted?: boolean;   // Include soft-deleted
  sortBy?: SortOptions;       // Sort options
}

export interface MemoryFilter {
  // Simple field matching
  [key: string]: any;
  
  // Complex conditions
  must?: MemoryCondition[];
  should?: MemoryCondition[];
  must_not?: MemoryCondition[];
  
  // Range conditions
  range?: {
    [key: string]: {
      gt?: any;
      gte?: any;
      lt?: any;
      lte?: any;
    }
  };
}
```

## Memory Operation Lifecycle

All memory operations will follow a consistent lifecycle:

1. **Validation**: Input parameters validated against schemas
2. **Preprocessing**: Preparation of data (e.g., embedding generation)
3. **Database Operation**: Interaction with Qdrant
4. **Postprocessing**: Transformation of results
5. **Error Handling**: Standardized error response

## Testing Strategy

1. **Unit Tests**: For each module and service
2. **Integration Tests**: For database interactions
3. **Mock Testing**: Using in-memory storage for speed
4. **Snapshot Testing**: For schema validation
5. **Performance Testing**: For search operations

## Migration Path

1. **Side-by-Side Implementation**: Build new system alongside existing code
2. **Adapter Layer**: Create adapters for old → new and new → old
3. **Feature Flags**: Toggle between implementations
4. **Incremental Adoption**: Migrate one endpoint at a time
5. **Validation**: Compare results between old and new implementations

## Next Steps (For Phase 2)

1. Implement the standardized collection configuration
2. Create the memory client with proper error handling
3. Define strict schemas for all memory types
4. Implement the core memory service
5. Add comprehensive tests

This approach addresses the core issues in the current implementation while providing a clear path for incremental improvement. 