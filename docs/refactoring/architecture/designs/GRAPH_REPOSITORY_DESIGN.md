# Graph Repository Design

## Overview

This document outlines the design for the Graph Repository, a component that provides data access and persistence for the Knowledge Graph. The implementation follows the interface-first approach and clean break principles outlined in the refactoring guidelines.

## Current Issues

1. **Limited Type Safety**: Current implementation lacks proper type safety with extensive use of `any` types
2. **Timestamp-Based IDs**: Uses legacy timestamp-based IDs instead of ULIDs
3. **Poor Querying Capabilities**: Limited ability to filter and search nodes and relationships
4. **Insufficient Error Handling**: No standardized error handling
5. **No Validation**: No validation of node and relationship properties

## Design Goals

1. **Strong Type Safety**: Use proper interfaces and eliminate `any` types
2. **Advanced Querying**: Implement sophisticated filtering and search capabilities
3. **Comprehensive Error Handling**: Use standardized error handling
4. **Proper Validation**: Validate all operations against defined constraints
5. **Efficient Data Access**: Optimize for performance and memory usage

## Interface Design

The repository follows the Repository pattern, providing a clean, data-source-agnostic interface for graph operations.

```typescript
/**
 * Graph Repository Interface
 */
export interface IGraphRepository {
  /**
   * Adds a node to the graph
   */
  addNode(node: Omit<IGraphNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<IGraphNode>;
  
  /**
   * Gets a node by ID
   */
  getNodeById(id: StructuredId): Promise<IGraphNode | null>;
  
  /**
   * Updates a node
   */
  updateNode(id: StructuredId, updates: Partial<IGraphNode>): Promise<IGraphNode | null>;
  
  /**
   * Deletes a node
   */
  deleteNode(id: StructuredId): Promise<boolean>;
  
  /**
   * Adds a relationship to the graph
   */
  addRelationship(relationship: Omit<IGraphRelationship, 'id' | 'createdAt' | 'updatedAt'>): Promise<IGraphRelationship>;
  
  /**
   * Gets a relationship by ID
   */
  getRelationshipById(id: StructuredId): Promise<IGraphRelationship | null>;
  
  /**
   * Updates a relationship
   */
  updateRelationship(id: StructuredId, updates: Partial<IGraphRelationship>): Promise<IGraphRelationship | null>;
  
  /**
   * Deletes a relationship
   */
  deleteRelationship(id: StructuredId): Promise<boolean>;
  
  /**
   * Finds relationships between two nodes
   */
  findRelationships(sourceId: StructuredId, targetId: StructuredId): Promise<IGraphRelationship[]>;
  
  /**
   * Gets all nodes related to a node
   */
  getRelatedNodes(nodeId: StructuredId, options?: RelatedNodesOptions): Promise<IGraphNode[]>;
  
  /**
   * Finds nodes by query
   */
  findNodes(query: NodeQuery): Promise<IGraphNode[]>;
  
  /**
   * Finds relationships by query
   */
  findRelationshipsByQuery(query: RelationshipQuery): Promise<IGraphRelationship[]>;
}
```

### Query Types

```typescript
/**
 * Options for retrieving related nodes
 */
export interface RelatedNodesOptions {
  relationshipTypes?: GraphRelationshipType[];
  nodeTypes?: GraphNodeType[];
  direction?: 'outgoing' | 'incoming' | 'both';
  maxDepth?: number;
  limit?: number;
}

/**
 * Node query parameters
 */
export interface NodeQuery {
  types?: GraphNodeType[];
  tags?: string[];
  labelContains?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Relationship query parameters
 */
export interface RelationshipQuery {
  types?: GraphRelationshipType[];
  sourceNodeId?: StructuredId;
  targetNodeId?: StructuredId;
  minStrength?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}
```

## Implementation Approach

### In-Memory Implementation

Initially, we will implement an in-memory repository for development and testing:

```typescript
export class InMemoryGraphRepository implements IGraphRepository {
  private nodes: Map<string, IGraphNode> = new Map();
  private relationships: Map<string, IGraphRelationship> = new Map();
  
  constructor(private readonly idGenerator: IdGenerator) {}
  
  // Implementation details...
}
```

### Persistent Storage Implementation

Later, we will implement a database-backed repository:

```typescript
export class DatabaseGraphRepository implements IGraphRepository {
  constructor(
    private readonly databaseClient: IDatabaseClient,
    private readonly idGenerator: IdGenerator
  ) {}
  
  // Implementation details...
}
```

## Key Capabilities

### Relationship Traversal

The repository supports efficient graph traversal with configurable depth and direction:

```typescript
async getRelatedNodes(
  nodeId: StructuredId, 
  options: RelatedNodesOptions = {}
): Promise<IGraphNode[]> {
  // Breadth-first search implementation
}
```

### Filtering and Queries

The repository provides rich filtering capabilities:

```typescript
async findNodes(query: NodeQuery): Promise<IGraphNode[]> {
  // Filter by type, tags, label, creation date, etc.
}

async findRelationshipsByQuery(query: RelationshipQuery): Promise<IGraphRelationship[]> {
  // Filter by type, nodes, strength, creation date, etc.
}
```

### Error Handling

The implementation uses standardized error handling:

```typescript
if (!this.nodes.has(relationship.sourceId.toString())) {
  throw new GraphRelationshipError(
    'Source node does not exist',
    relationship.sourceId.toString(),
    relationship.targetId.toString(),
    { sourceId: relationship.sourceId.toString() }
  );
}
```

### ID Generation

All entities use the ULID-based ID generation system:

```typescript
const id = this.idGenerator.generate('node');
```

## Testing Approach

1. **Unit Tests**:
   - Test CRUD operations for nodes and relationships
   - Test query and filtering capabilities
   - Test error handling

2. **Integration Tests**:
   - Test interaction with GraphIntelligenceEngine
   - Test with realistic data volumes

3. **Performance Tests**:
   - Benchmark repository operations
   - Test with large graph datasets

## Future Enhancements

1. **Indexing**: Add indexing for faster node and relationship lookups
2. **Transaction Support**: Add support for transactional operations
3. **Caching**: Implement caching for frequently accessed nodes and relationships
4. **Vector Similarity**: Add support for semantic search using vector similarity
5. **Graph Algorithms**: Add support for common graph algorithms (PageRank, community detection, etc.)

## Conclusion

This design provides a robust, type-safe repository for graph operations with rich querying capabilities and proper error handling. The interface-first approach ensures that different implementations can be swapped without affecting clients. 