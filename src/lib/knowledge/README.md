# Domain Knowledge Graph Framework

This module provides a flexible framework for creating, managing, and utilizing domain-specific knowledge graphs for agent systems. The framework is designed to be extensible and adaptable to any domain of knowledge.

## Core Components

### KnowledgeGraph

The `KnowledgeGraph` class serves as the base implementation for domain-specific knowledge graphs. It provides:

- Storage and retrieval of domain concepts, principles, relationships, frameworks and research
- Methods for querying and navigating the knowledge graph
- Persistence through JSON storage
- Relationship tracking between concepts

### KnowledgeBootstrapper

The `KnowledgeBootstrapper` abstract class provides functionality to initialize a knowledge graph with domain-specific information, including:

- Processing knowledge sources using LLMs
- Extracting concepts, principles and frameworks from content
- Creating structured knowledge from unstructured sources

## Creating a Domain-Specific Knowledge Graph

To create a knowledge graph for a new domain (e.g., Finance, Sales, Product Management):

1. Create a domain-specific knowledge graph class:

```typescript
import { KnowledgeGraph } from '../../lib/knowledge';

export class FinanceKnowledgeGraph extends KnowledgeGraph {
  constructor(dataDir?: string) {
    super('finance', dataDir);
  }
  
  // Add domain-specific methods
  getFinancialRatios() {
    return this.getConceptsByCategory('financial-ratios');
  }
}
```

2. Create a domain-specific bootstrapper:

```typescript
import { KnowledgeBootstrapper, KnowledgeBootstrapSource } from '../../lib/knowledge';
import { FinanceKnowledgeGraph } from './FinanceKnowledgeGraph';

export class FinanceKnowledgeBootstrapper extends KnowledgeBootstrapper {
  constructor(knowledgeGraph: FinanceKnowledgeGraph) {
    super(knowledgeGraph);
  }
  
  protected getDefaultSources(): KnowledgeBootstrapSource[] {
    return [
      {
        id: 'finance-fundamentals',
        name: 'Finance Fundamentals',
        type: 'textbook',
        category: 'finance-basics',
        content: `...finance content...`
      },
      // Add more sources
    ];
  }
}
```

3. Use the knowledge graph in an agent:

```typescript
import { FinanceKnowledgeGraph, FinanceKnowledgeBootstrapper } from './knowledge';

// Initialize the knowledge graph
const graph = new FinanceKnowledgeGraph();
await graph.load();

// Bootstrap if needed
if (graph.getAllConcepts().length === 0) {
  const bootstrapper = new FinanceKnowledgeBootstrapper(graph);
  await bootstrapper.bootstrap();
}

// Use the knowledge
const financialRatios = graph.getFinancialRatios();
```

## Knowledge Graph Structure

Each knowledge graph consists of:

- **Concepts**: Core ideas or entities in the domain
- **Principles**: Rules or guidelines within the domain
- **Relationships**: Connections between concepts
- **Frameworks**: Structured methodologies or approaches
- **Research**: Evidence, case studies or research findings

## Best Practices

1. **Organization**: Organize your knowledge into meaningful categories
2. **Modularity**: Create separate knowledge graphs for distinct domains
3. **Integration**: Use knowledge graphs for decision-making in agent systems
4. **Bootstrapping**: Provide high-quality initial sources for bootstrapping
5. **Extension**: Extend base classes with domain-specific functionality 