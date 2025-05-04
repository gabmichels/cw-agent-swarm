# Memory System Implementation Prompt

## Overview

This document serves as a self-prompt to maintain context about the memory system standardization project. It provides essential information about the project structure, current status, and key considerations.

## Project Summary

The memory system standardization project aims to refactor the existing monolithic memory management code (~3300 lines) into a modular, testable, and type-safe architecture. The project addresses issues with inconsistent collection naming, type inconsistencies, poor error handling, and lack of testing.

## Documentation Reference

The project is guided by the following documentation:

1. `MEMORY_ARCHITECTURE.md` - Overall system architecture
2. `MEMORY_SCHEMAS.md` - Memory data structures and schemas
3. `MEMORY_OPERATIONS.md` - API documentation for operations
4. `MEMORY_ERD.md` - Entity relationships between memories
5. `ACCESS_PATTERNS.md` - How memory is accessed in the application
6. `PROPOSED_SOLUTION.md` - Detailed plan for standardization
7. `IMPLEMENTATION_TRACKER.md` - Tracks implementation progress

## Current Status

Please refer to `IMPLEMENTATION_TRACKER.md` for the current status. Update this file after each implementation session to track progress.

## Implementation Guidelines

When implementing each phase:

### General Guidelines

1. **Incremental Approach**: Implement one component at a time with well-defined interfaces
2. **Backward Compatibility**: Ensure new code can coexist with current code
3. **Testing**: Add tests for each component as it's implemented
4. **Documentation**: Update documentation as implementation progresses
5. **Error Handling**: Use standardized error handling throughout

### Phase 2 Guidelines

1. **Directory Structure**: Create the module structure before implementation
2. **Type Safety**: Ensure strict typing for all interfaces
3. **Constants**: Define all constants in a centralized location
4. **Validation**: Implement schema validation from the start

### Phase 3 Guidelines

1. **Separation of Concerns**: Keep services focused on specific responsibilities
2. **Common Patterns**: Use consistent patterns across all services
3. **Interface First**: Define interfaces before implementation

### Phase 4 Guidelines

1. **Test Coverage**: Aim for high test coverage of critical paths
2. **Realistic Testing**: Create tests that reflect actual usage patterns
3. **Performance Testing**: Include performance benchmarks

### Phase 5 Guidelines

1. **Feature Flags**: Use feature flags to toggle between implementations
2. **Validation**: Verify outputs match between old and new implementations
3. **Documentation**: Update API documentation for consumers

## Key Interfaces

The primary interfaces to implement include:

```typescript
// Collection configuration
interface CollectionConfig<T> {
  name: string;
  schema: T;
  indices: string[];
  defaults: Partial<T>;
}

// Memory client for database operations
class MemoryClient {
  constructor(options: MemoryClientOptions);
  addPoint<T>(collection: string, point: MemoryPoint<T>): Promise<string>;
  searchPoints<T>(collection: string, query: SearchQuery): Promise<SearchResult<T>[]>;
  updatePoint<T>(collection: string, id: string, updates: Partial<MemoryPoint<T>>): Promise<boolean>;
  deletePoint(collection: string, id: string, options?: DeleteOptions): Promise<boolean>;
}

// Core memory service
class MemoryService {
  constructor(client: MemoryClient, embeddingService: EmbeddingService);
  addMemory<T>(params: AddMemoryParams<T>): Promise<MemoryResult>;
  getMemory<T>(params: GetMemoryParams): Promise<Memory<T> | null>;
  updateMemory<T>(params: UpdateMemoryParams<T>): Promise<boolean>;
  deleteMemory(params: DeleteMemoryParams): Promise<boolean>;
}
```

## Current Implementation Notes

### Phase 2 Implementation (Completed ✅)

Phase 2 of the memory system standardization project has been completed. This phase focused on establishing the core type system and schema definitions needed for a standardized memory interface.

#### Completed Items

**Configuration and Types (✅)**
- Created `/server/memory/config` directory with structured configuration files
- Implemented `CollectionConfig` interface for standardized collection definitions
- Defined consistent `MemoryType` enum to replace string literals across codebase
- Created standardized constants file with organized sections
- Defined error types and codes for consistent error handling
- Implemented collection configurations with proper typing

**Schema Definitions (✅)**
- Created `/server/memory/models` directory with well-structured schema interfaces
- Implemented `BaseMemorySchema` interface as the foundation for all memory types
- Defined specialized schemas for each memory type:
  - `MessageSchema` for user/assistant messages
  - `ThoughtSchema` for agent thoughts and reflections
  - `DocumentSchema` for stored files and knowledge
  - `TaskSchema` for agent tasks and goals
  - `MemoryEditSchema` for version history tracking
- Implemented schema validation utilities for runtime type safety

**Utility Functions (✅)**
- Created `/server/memory/utils` directory with core utilities
- Implemented standardized error handling with consistent error types
- Created validation utilities for schema validation

#### Key Improvements

1. **Type Safety**: Replaced string-based type definitions with proper TypeScript enums and interfaces
2. **Standardized Collections**: Created a consistent mapping from memory types to collection names
3. **Schema Validation**: Added utilities for validating data at runtime
4. **Error Handling**: Implemented consistent error handling patterns
5. **Documentation**: Added comprehensive JSDoc comments throughout the codebase

#### Files Created/Modified

**Configuration:**
- `src/server/memory/config/types.ts`
- `src/server/memory/config/constants.ts`
- `src/server/memory/config/collections.ts`
- `src/server/memory/config/index.ts`

**Models:**
- `src/server/memory/models/base-schema.ts`
- `src/server/memory/models/message-schema.ts`
- `src/server/memory/models/thought-schema.ts`
- `src/server/memory/models/document-schema.ts`
- `src/server/memory/models/task-schema.ts`
- `src/server/memory/models/memory-edit-schema.ts`
- `src/server/memory/models/index.ts`

**Utilities:**
- `src/server/memory/utils/error-handler.ts`
- `src/server/memory/utils/validation.ts`
- `src/server/memory/utils/index.ts`

#### Design Decisions

1. **Error Handling Strategy**: Implemented a centralized error handling approach with standardized error codes and messages to make debugging easier.
2. **Function vs Constants for Defaults**: Opted for a function to create default values for memory edits instead of constants to ensure required fields are provided.
3. **Type Assertions**: Used strategic type assertions to avoid excessive type checking at runtime while maintaining strong typing.
4. **Separation of Concerns**: Kept clear boundaries between configuration, models, and utilities to make the system more modular.

#### Challenges

1. **Import Circular Dependencies**: Resolved circular dependencies between files by properly organizing the exports and imports.
2. **Type Safety vs Runtime Flexibility**: Balanced strict typing for development with flexibility needed at runtime.
3. **Linter Errors**: Fixed linter errors related to imports and typings to ensure code quality.

## Next Steps

1. Begin Phase 3 implementation:
   - Create `/server/memory/services` directory structure
   - Implement memory client for database interaction
   - Develop core memory service for CRUD operations
   - Build search service with filtering capabilities

2. Follow Phase 3 guidelines:
   - Maintain separation of concerns in service implementations
   - Define interfaces before implementation
   - Use consistent patterns across all services

## Reference Snippets

### Collection Configuration Example

```typescript
export const COLLECTIONS: Record<MemoryType, CollectionConfig<any>> = {
  message: {
    name: 'messages',
    schema: MessageSchema,
    indices: ['timestamp', 'type', 'metadata.role'],
    defaults: { metadata: { importance: 'medium' } }
  },
  thought: {
    name: 'thoughts',
    schema: ThoughtSchema,
    indices: ['timestamp', 'type', 'metadata.messageType'],
    defaults: { metadata: { isInternalMessage: true, notForChat: true } }
  }
  // other collections...
};
```

### Error Handling Example

```typescript
try {
  // Operation code
} catch (error) {
  throw handleMemoryError(error, 'addMemory');
}
```

### Validation Example

```typescript
function validateMemoryParams<T extends MemoryType>(
  params: AddMemoryParams<T>
): ValidationResult {
  // Validation logic
  if (!params.type) {
    return {
      valid: false,
      errors: [{ field: 'type', message: 'Type is required' }]
    };
  }
  
  // More validation...
  
  return { valid: true };
}
```

Use this prompt as a reference when implementing the memory system to maintain context and consistency across sessions.