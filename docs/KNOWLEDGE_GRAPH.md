# Knowledge Graph System

## Overview

The Knowledge Graph system provides a structured representation of knowledge with nodes and edges, enabling sophisticated knowledge operations like traversal, path-finding, and knowledge extraction.

## Key Components

1. **KnowledgeGraph Interface**
   - Core contract for all knowledge graph implementations
   - Supports comprehensive node and edge operations
   - Provides advanced graph traversal and path-finding capabilities

2. **DefaultKnowledgeGraph**
   - In-memory implementation of the KnowledgeGraph interface
   - Efficient indexing for fast lookups by type and tag
   - Robust traversal algorithms with configurable strategies

3. **KnowledgeExtractor**
   - Analyzes content to extract knowledge nodes and edges
   - Assigns confidence scores to extracted information
   - Supports structured knowledge acquisition from various sources

## Graph Traversal Capabilities

The knowledge graph system implements three traversal strategies:

1. **Breadth-First Search (BFS)**
   - Explores all nodes at the current depth before moving deeper
   - Best for finding the shortest path in terms of node count
   - Useful for exploring the immediate neighborhood of a concept

2. **Depth-First Search (DFS)**
   - Explores as far as possible along a branch before backtracking
   - Efficient for exploring specific branches of knowledge
   - Useful for deep exploration of sub-topics

3. **Best-First Search**
   - Prioritizes edges with higher strength values
   - Follows the most certain or important relationships first
   - Useful for finding the most reliable connections between concepts

Each traversal strategy can be configured with:
- Maximum depth to limit exploration
- Node and edge type filters for targeted traversal
- Minimum edge strength thresholds for reliability
- Direction constraints (outgoing, incoming, or both)

## Path Finding Capabilities

The knowledge graph supports finding paths between nodes using various algorithms:

1. **Shortest Path**
   - Finds the path with the fewest edges between two nodes
   - Uses optimized breadth-first search for efficiency
   - Ideal for finding the most direct relationship between concepts

2. **Strongest Path**
   - Finds the path with the highest cumulative strength
   - Prioritizes more certain or important relationships
   - Useful for finding the most reliable connection between concepts

3. **All Paths**
   - Finds all valid paths between two nodes (up to a specified limit)
   - Can be constrained by maximum path length
   - Useful for comprehensive analysis of relationships

Path finding supports additional options:
- Maximum path length to limit exploration
- Edge type filters to follow specific relationship types
- Minimum strength thresholds for reliability
- Maximum number of paths to return

## Knowledge Graph Metrics

The knowledge graph provides comprehensive statistics for analysis:

- Node and edge counts by type
- Graph density and average degree
- Most connected nodes
- Overall graph structure analysis

## Visualization Support

The knowledge graph includes visualization support through a standardized API that returns nodes and edges in a format suitable for rendering with various visualization libraries.

## Integration with Other Systems

The knowledge graph integrates with:

1. **Memory System**
   - Converts memories into knowledge nodes
   - Creates relationships between related memories
   - Provides context through related knowledge retrieval

2. **Planning System**
   - Uses knowledge for goal-oriented planning
   - Generates insights to inform plan creation
   - Identifies knowledge gaps relevant to planning tasks

3. **Learning System**
   - Expands knowledge through discovery and inference
   - Updates knowledge confidence based on new information
   - Prioritizes knowledge acquisition based on identified gaps

## Example Usage

```typescript
// Initialize the knowledge graph
const graph = new DefaultKnowledgeGraph();
await graph.initialize();

// Add knowledge nodes
const aiNodeId = await graph.addNode({
  label: 'Artificial Intelligence',
  type: KnowledgeNodeType.CONCEPT,
  description: 'The simulation of human intelligence in machines',
  tags: ['technology', 'computer science']
});

const mlNodeId = await graph.addNode({
  label: 'Machine Learning',
  type: KnowledgeNodeType.CONCEPT,
  description: 'A subset of AI focused on data and algorithms',
  tags: ['ai', 'data science']
});

// Create relationships
await graph.addEdge({
  from: aiNodeId,
  to: mlNodeId,
  type: KnowledgeEdgeType.PART_OF,
  strength: 0.9
});

// Traverse the graph
const result = await graph.traverse({
  startNodeId: aiNodeId,
  maxDepth: 3,
  strategy: 'breadth-first'
});

// Find paths between nodes
const paths = await graph.findPaths({
  startNodeId: userQueryNodeId,
  targetNodeId: relevantNodeId,
  algorithm: 'strongest'
});

// Extract knowledge from content
const extractionResult = await graph.extractKnowledge({
  content: documentText,
  source: 'research-paper',
  minConfidence: 0.7
});
```

## Implementation Notes

The knowledge graph system is implemented with a focus on:

1. **Type Safety**
   - Comprehensive TypeScript interfaces
   - Strict typing for all operations
   - Well-defined error types

2. **Performance**
   - Efficient indexing for fast lookups
   - Optimized traversal and path-finding algorithms
   - Careful memory management

3. **Extensibility**
   - Interface-first design
   - Pluggable components for knowledge extraction and validation
   - Customizable scoring and prioritization

4. **Testing**
   - 600+ lines of tests
   - Comprehensive coverage of all operations
   - Edge case testing for robustness 