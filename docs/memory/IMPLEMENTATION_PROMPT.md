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

After each implementation session, add notes here about:

1. What was implemented
2. Any challenges encountered
3. Design decisions made
4. Next steps

## Next Steps

1. Begin Phase 2 implementation:
   - Create directory structure for `/server/memory`
   - Implement configuration types and constants
   - Define base schemas for memory types

2. Update the tracker after each implementation session

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