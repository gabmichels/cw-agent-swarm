# Architecture Refactoring Implementation Guidelines

## Introduction

This document provides detailed guidelines for implementing the architecture refactoring project. It covers coding standards, testing requirements, documentation practices, and specific implementation approaches for each key component.

## General Implementation Principles

### 1. Clean Break from Legacy Code

- **REPLACE, DON'T EXTEND**: When encountering legacy code patterns, replace them entirely rather than extending or adapting them
- **NO BACKWARD COMPATIBILITY LAYERS**: Do not create compatibility layers to support old patterns
- **ELIMINATE ANTI-PATTERNS COMPLETELY**: Fully remove timestamp-based IDs, any types, and other flawed implementations
- **ONE-WAY MIGRATION**: Create one-time migration utilities for data, but don't maintain dual-support
- **DELETE AGGRESSIVELY**: Remove outdated code rather than commenting it out or conditionally executing it

### 2. Test-Driven Development

- Write tests before implementing changes
- Create both unit tests and integration tests for all components
- Ensure tests cover both happy paths and error scenarios
- Aim for >95% code coverage for refactored components
- Create performance tests for critical operations

### 3. Industry Best Practices

- **ULID/UUID FOR IDS**: Use ULID (Universally Unique Lexicographically Sortable Identifier) for all identifiers
- **STRICT TYPE SAFETY**: Never use 'any' type in TypeScript; create proper interfaces for all data structures
- **DEPENDENCY INJECTION**: Use constructor injection for all dependencies
- **INTERFACE-FIRST DESIGN**: Define interfaces before implementing classes
- **IMMUTABLE DATA**: Use immutable data patterns whenever possible
- **PURE FUNCTIONS**: Create pure functions without side effects
- **ERROR HANDLING**: Use proper error handling with custom error types

### 4. Performance Consciousness

- Optimize query patterns for Qdrant
- Implement efficient data structures for high-volume operations
- Use appropriate caching strategies
- Minimize database round-trips
- Consider memory usage and garbage collection

### 5. Don't overengineer

- Keep it simple
- Stick to the defined scope

## Component-Specific Guidelines

### Memory System Implementation

#### ID Generation (ULID)

```typescript
// Example ULID implementation approach
import { ulid } from 'ulid';
import { StructuredId } from '../types/structured-id';

export class IdGenerator {
  static generate(prefix: string): StructuredId {
    const timestamp = new Date();
    const id = ulid(timestamp.getTime());
    return {
      id,
      prefix,
      timestamp,
      toString: () => `${prefix}_${id}`
    };
  }
  
  static parse(structuredId: string): StructuredId {
    // Parse implementation that handles the new format only
  }
}
```

#### Memory Service Wrappers

- Create abstract base classes for memory services
- Implement strong typing for all operations
- Add validation before all write operations
- Include comprehensive error handling
- Optimize query patterns for performance

```typescript
// Example memory service base class
export abstract class BaseMemoryService<T extends BaseEntity> {
  constructor(
    protected readonly collectionName: string,
    protected readonly memoryClient: QdrantClient,
    protected readonly validator: SchemaValidator<T>
  ) {}

  protected abstract mapToEntity(record: QdrantRecord): T;
  protected abstract mapFromEntity(entity: T): QdrantRecord;

  async create(entity: T): Promise<T> {
    this.validator.validate(entity);
    // Implementation
  }
  
  // Additional methods
}
```

### Error Handling Framework

- Create a hierarchy of custom error types
- Include context information in all errors
- Standardize error handling across the system
- Implement proper logging with structured data
- Add telemetry for error patterns

```typescript
// Example error hierarchy
export class AppError extends Error {
  constructor(
    message: string, 
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class MemoryError extends AppError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `MEMORY_${code}`, context);
    this.name = 'MemoryError';
  }
}

// Additional error types
```

### Knowledge Graph Implementation

- Implement clean interfaces for graph operations
- Use strong typing for nodes and relationships
- Include validation for graph integrity
- Optimize traversal algorithms for performance
- Implement quantitative relationship scoring

```typescript
// Example graph interface
export interface GraphIntelligenceEngine {
  addNode(node: GraphNode): Promise<GraphNode>;
  addRelationship(relationship: GraphRelationship): Promise<GraphRelationship>;
  findPath(startNodeId: string, endNodeId: string, options: PathOptions): Promise<GraphPath[]>;
  discoverRelationships(nodeId: string, depth: number): Promise<GraphRelationship[]>;
  extractInsights(subjectIds: string[]): Promise<GraphInsight[]>;
}
```

### Modularization Approach

- Break down large classes into focused components
- Create clear interfaces between modules
- Use dependency injection for all components
- Minimize shared state
- Apply the Single Responsibility Principle

```typescript
// Example of decomposing a large class
// Instead of:
class ToolFallbackManager {
  // 500+ lines with multiple responsibilities
}

// Create focused classes:
class ToolRegistry {
  // Tool registration and lookup
}

class FallbackStrategy {
  // Fallback decision logic
}

class ToolExecutor {
  // Tool execution handling
}

class ToolFallbackOrchestrator {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly strategy: FallbackStrategy,
    private readonly executor: ToolExecutor
  ) {}
  
  // Orchestration logic
}
```

## Testing Requirements

### Unit Testing

- Test each class and function in isolation
- Use dependency injection to mock dependencies
- Test all error scenarios and edge cases
- Verify type constraints at compile time
- Test performance for critical operations

```typescript
// Example unit test
describe('IdGenerator', () => {
  it('should generate a valid ULID', () => {
    const id = IdGenerator.generate('TEST');
    expect(id.prefix).toBe('TEST');
    expect(id.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
    expect(id.timestamp).toBeInstanceOf(Date);
    expect(id.toString()).toBe(`TEST_${id.id}`);
  });
  
  // Additional tests
});
```

### Integration Testing

- Test interactions between components
- Verify proper data flow through the system
- Test error propagation and handling
- Ensure components work together correctly
- Test with real dependencies when appropriate

### Performance Testing

- Create baseline performance metrics
- Implement automated performance tests
- Test with realistic data volumes
- Measure and optimize critical paths
- Verify performance improvements

## Documentation Requirements

### API Documentation

- Document all public APIs with TypeScript docstrings
- Include examples for common operations
- Document error scenarios and handling
- Specify performance characteristics
- Keep documentation in sync with implementation

```typescript
/**
 * Adds a new relationship between two nodes in the knowledge graph
 * 
 * @param relationship - The relationship to add
 * @returns The created relationship with populated metadata
 * @throws {GraphError} If either node doesn't exist or the relationship is invalid
 * 
 * @example
 * ```
 * const relationship = await graphEngine.addRelationship({
 *   sourceId: 'node1',
 *   targetId: 'node2', 
 *   type: 'DEPENDS_ON',
 *   weight: 0.8,
 *   metadata: { reason: 'explicit dependency' }
 * });
 * ```
 */
addRelationship(relationship: GraphRelationship): Promise<GraphRelationship>;
```

### Architecture Documentation

- Create component diagrams for all modules
- Document interactions between components
- Explain design decisions with rationales
- Include performance considerations
- Document optimization strategies

## Implementation Process

1. **Design First**: Create detailed designs with interfaces before implementation
2. **Test Second**: Write tests that verify requirements
3. **Implement Third**: Create the implementation according to the guidelines
4. **Validate Last**: Verify the implementation meets all requirements

Each component should be implemented in isolation, validated, and then integrated with the system. The refactoring should proceed component by component, prioritizing the highest impact areas first. 