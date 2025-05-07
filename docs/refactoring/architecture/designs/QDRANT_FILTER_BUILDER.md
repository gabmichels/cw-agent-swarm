# Qdrant Filter Builder Design

## Overview

The Qdrant Filter Builder provides a type-safe, optimized way to construct filters for Qdrant vector database queries. It translates application-specific filter conditions into Qdrant's filter format, enforcing proper typing and validation at compile time.

## Current Issues with Legacy Approach

1. **Type Safety Issues**: The existing implementation uses `any` types extensively
2. **Limited Validation**: No runtime validation of filter values
3. **Implicit Knowledge Required**: Developers must know Qdrant's filter syntax
4. **Poor Extensibility**: Difficult to add new filter operations
5. **Redundant Code**: Similar filter logic repeated across codebase

## Design Goals

1. **Type Safety**: Use TypeScript's type system to ensure filters are correctly built
2. **Runtime Validation**: Validate filter values at runtime to prevent errors
3. **Abstracted Interface**: Hide Qdrant-specific details behind a clean interface
4. **Performance Optimization**: Optimize generated filters for Qdrant performance
5. **Reusability**: Create a centralized, consistent filter building approach

## Core Components

### Filter Condition Types

```typescript
export interface FilterCondition<T> {
  operator: FilterOperator;
  value: T | T[] | null;
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'notEquals',
  CONTAINS = 'contains',
  GREATER_THAN = 'greaterThan',
  // Additional operators...
}

export type FilterConditions<T> = {
  [K in keyof T]?: FilterCondition<T[K]>;
}
```

### Composite Filter Structure

```typescript
export interface CompositeFilter<T> {
  must?: Array<FilterConditions<T> | CompositeFilter<T>>;
  should?: Array<FilterConditions<T> | CompositeFilter<T>>;
  must_not?: Array<FilterConditions<T> | CompositeFilter<T>>;
}
```

### Qdrant-Specific Filter Types

```typescript
export interface QdrantFilter {
  must?: QdrantCondition[];
  should?: QdrantCondition[];
  must_not?: QdrantCondition[];
}

export type QdrantCondition = 
  | QdrantMatchCondition 
  | QdrantRangeCondition 
  | QdrantIsNullCondition 
  | QdrantIsEmptyCondition
  | QdrantFilter;
```

### Filter Builder Class

The `QdrantFilterBuilder` class provides methods to:

1. Build filters from application conditions
2. Convert between application filter format and Qdrant format
3. Optimize generated filters
4. Provide utility functions for common filter patterns

## Implementation Details

### Field Path Normalization

- Automatically prefixes fields with `metadata.` unless:
  - Field is a special field (e.g., `id`, `type`, `vector`)
  - Field already contains a dot notation path

### Filter Condition Translation

- Each filter operator is mapped to a corresponding Qdrant condition
- Complex operations are mapped to combinations of Qdrant conditions
- Type validation ensures proper value types for each operator

### Composite Filters

- Supports nested filters with `must`, `should`, and `must_not` clauses
- Allows complex logical conditions to be expressed

### Utility Functions

- `createNonDeletedFilter()`: Create a filter that excludes soft-deleted items
- `mergeFilters()`: Combine multiple filters with AND logic

## Usage Examples

### Simple Filters

```typescript
// Create a filter builder
const filterBuilder = new QdrantFilterBuilder();

// Build a simple equality filter
const conditions: FilterConditions<UserEntity> = {
  name: {
    operator: FilterOperator.EQUALS,
    value: 'John Doe'
  },
  age: {
    operator: FilterOperator.GREATER_THAN,
    value: 30
  }
};

// Convert to Qdrant filter
const qdrantFilter = filterBuilder.build(conditions);
```

### Composite Filters

```typescript
// Create a composite filter
const filter: CompositeFilter<UserEntity> = {
  must: [
    {
      isActive: {
        operator: FilterOperator.EQUALS,
        value: true
      }
    }
  ],
  should: [
    {
      role: {
        operator: FilterOperator.EQUALS,
        value: 'admin'
      }
    },
    {
      role: {
        operator: FilterOperator.EQUALS,
        value: 'manager'
      }
    }
  ]
};

// Convert to Qdrant filter
const qdrantFilter = filterBuilder.build(filter);
```

### Combining with Non-Deleted Filter

```typescript
// Create base filter
const baseFilter = filterBuilder.build(conditions);

// Combine with non-deleted filter
const combinedFilter = QdrantFilterBuilder.mergeFilters(
  baseFilter,
  QdrantFilterBuilder.createNonDeletedFilter()
);
```

## Benefits

1. **Type Safety**: Compiler catches filter errors at build time
2. **Self-Documenting**: Interface clearly shows available operations
3. **Maintainable**: Centralized filter building logic
4. **Testable**: Easy to write unit tests for filter building
5. **Optimized**: Generates efficient filters for Qdrant

## Migration Path

1. **Direct Replacement**: `buildQdrantFilter` method can be replaced with the filter builder
2. **Gradual Integration**: Can be used alongside existing code with adapters
3. **Encapsulation**: Higher-level components can encapsulate filter building details

## Performance Considerations

1. **Object Creation**: Minimal object creation during filter building
2. **Optimization**: Filters are optimized for Qdrant's query execution
3. **Caching**: Common filters (like non-deleted) can be cached

## Testing Strategy

1. **Unit Tests**: Comprehensive tests for all filter operations
2. **Integration Tests**: Test with actual Qdrant queries
3. **Performance Tests**: Benchmark complex filter operations 