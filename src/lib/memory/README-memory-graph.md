# Memory Graph System for Chloe

This system enhances Chloe's memory capabilities by building a graph structure of interconnected memories, enabling more contextual and relationship-aware memory retrieval.

## Overview

The Memory Graph system connects related memories based on:
- Shared tags between memories
- Vector embedding similarity
- Temporal relationships
- Content-based relationships

This connected structure enables:
- More relevant memory retrieval with relationship context
- Discovery of implicit knowledge clusters
- Boosting of semantically related memories during search
- Enhanced prompt injection with interconnected knowledge

## Components

### Core Components

1. **MemoryGraph Class** (`MemoryGraph.ts`)
   - Manages connections between memories
   - Provides methods to traverse and query the graph
   - Implements boosting of related memories

2. **Memory Graph Integration** (`memory-graph-integration.ts`)
   - Extends the standard memory storage flow
   - Automatically connects new memories to the graph
   - Provides utilities to build the graph from existing memories

3. **Memory Utils Extensions** (`MemoryUtils.ts`)
   - Enhanced `getMemoriesForPromptInjection()` with graph boosting
   - Singleton graph instance management

### Auxiliary Components

1. **Vector Utilities** (`vector-utils.ts`)
   - Provides cosine similarity calculations for embeddings

2. **Knowledge Graph Backend** (`knowledge-graph.ts`)
   - Underlying graph storage and traversal infrastructure

## Integration Points

The Memory Graph system integrates with the existing memory system at these key points:

1. **Memory Storage**
   - When storing a new memory via `storeMemoryWithGraph()`
   - Automatically connects the memory to related memories

2. **Memory Retrieval**
   - Enhanced `getMemoriesForPromptInjection()` with graph-based boosting
   - More contextually relevant results for system prompt injection

3. **Memory Reinforcement**
   - When memories are reinforced, their connections are strengthened
   - Creates more robust knowledge networks over time

## How to Use

### Basic Usage

```typescript
// Import the enhanced memory storage function
import { storeMemoryWithGraph } from './memory-graph-integration';

// Store a memory with graph connections
const memoryId = await storeMemoryWithGraph(
  "Customer research shows users prefer dark mode in evening hours.",
  "document",
  "research",
  { tags: ["customer", "research", "dark mode", "preferences"] },
  { 
    importance_score: 0.8,
    connectToGraph: true // Enable graph connections
  }
);
```

### Advanced Memory Retrieval

```typescript
// Import the memory utilities
import { getMemoriesForPromptInjection } from './MemoryUtils';

// Retrieve memories with graph boosting
const relevantMemories = await getMemoriesForPromptInjection(
  "What do we know about user preferences for dark mode?",
  {
    limit: 3,
    minConfidence: 0.7,
    useGraphBoost: true // Enable graph-based boosting
  }
);
```

### Discovering Knowledge Clusters

```typescript
// Import the memory graph
import { getMemoryGraph } from './MemoryUtils';

// Get the graph instance
const memoryGraph = await getMemoryGraph();

// Discover knowledge clusters
const clusters = await memoryGraph.discoverKnowledgeClusters();

// Use the clusters
for (const cluster of clusters) {
  console.log(`Cluster: ${cluster.label}`);
  console.log(`Common tags: ${cluster.commonTags.join(', ')}`);
  console.log(`Members: ${cluster.members.length}`);
}
```

### Building the Graph for Existing Memories

```typescript
// Import the graph builder
import { buildMemoryGraph } from './memory-graph-integration';

// Build connections for existing memories
const stats = await buildMemoryGraph({
  batchSize: 100,
  maxMemories: 1000,
  minImportance: 0.3
});

console.log(`Built graph with ${stats.connected} connections`);
```

## How It Works

1. **Connection Creation**
   - When a memory is stored, it's compared to existing memories
   - Connections are made based on tag overlap and vector similarity
   - Edge weights reflect the strength of relationships

2. **Graph-Based Boosting**
   - During memory retrieval, the initial vector search results are augmented
   - Connected memories receive a score boost based on relationship strength
   - The boost formula: `boostedScore = baseScore * connectionStrength * boostFactor`

3. **Knowledge Clusters**
   - The system analyzes the graph to find densely connected regions
   - Common tags among cluster members become the cluster label
   - Clusters represent implicit knowledge domains

## Demo

Run the demonstration script to see the Memory Graph in action:

```bash
ts-node src/lib/memory/graph-memory-demo.ts
```

This will:
1. Create sample interconnected memories
2. Connect them in the graph
3. Compare regular search vs. graph-boosted search
4. Discover knowledge clusters

## Implementation Details

- The graph is implemented using the Knowledge Graph backend
- Connections are bidirectional by default
- Edge weights range from 0-1 based on relationship strength
- New memories are connected asynchronously to avoid blocking
- The system uses a singleton graph instance for efficiency 