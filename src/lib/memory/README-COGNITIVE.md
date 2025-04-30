# Chloe Cognitive Memory System

The Cognitive Memory System extends Chloe's capabilities with human-like memory processing, including episodic memory, memory consolidation, knowledge graphs, and emotional context. This architecture aims to provide Chloe with more natural and effective reasoning capabilities.

## Architecture Components

### 1. Cognitive Memory

The `CognitiveMemory` class extends the base `EnhancedMemory` with:

- **Episodic Memory:** Stores event sequences with temporal relationships
- **Working Memory:** Maintains a limited set of currently active thoughts (Miller's Law: 7±2 items)
- **Memory Consolidation:** Regularly processes memories, strengthening important ones and discarding less relevant ones
- **Emotional Context:** Tags memories with emotional valence for more nuanced retrieval
- **Importance Calculation:** Dynamically assesses memory importance based on content and context
- **Decay Mechanisms:** Simulates human forgetting curves for less important information

### 2. Knowledge Graph

The `KnowledgeGraph` class implements:

- **Semantic Network:** Represents concepts, entities, and their relationships
- **Inference Engine:** Discovers implicit connections between concepts
- **Path Finding:** Identifies connections between seemingly unrelated ideas
- **Relationship Types:** Models various relationship types (causes, partOf, contradicts, etc.)
- **Confidence Scoring:** Assigns confidence levels to relationships and inferences

### 3. Integration with Agent

The cognitive systems integrate with the `ChloeAgent` through:

- **Working Memory Access:** Agent can access currently active thoughts
- **Episodic Storage:** Agent automatically stores important interactions
- **Knowledge Enrichment:** Inferred relationships enhance agent understanding
- **Emotion-aware Responses:** Memory emotional context influences responses

## Memory Types

1. **Episodic Memory**
   - Autobiographical events with temporal sequence
   - Tagged with emotions and importance
   - Subject to forgetting processes

2. **Semantic Memory**
   - Facts, concepts, and meanings
   - Organized in knowledge graph
   - More resistant to decay than episodic memories

3. **Working Memory**
   - Currently active thoughts and information
   - Limited capacity (7±2 items)
   - Prioritized by importance and recency

## Memory Processes

### 1. Memory Formation

When new information arrives:
- It's analyzed for emotional content and importance
- High-importance memories enter working memory
- All memories are stored in episodic memory
- Relevant concepts are added to knowledge graph

### 2. Memory Consolidation

A scheduled process that:
- Strengthens frequently accessed memories
- Reduces importance of unused memories
- Removes low-importance memories that decay below threshold
- Infers new relationships in the knowledge graph

### 3. Memory Retrieval

When accessing memories:
- Working memory is checked first (fast access)
- Then episodic memory is searched semantically
- Knowledge graph connections enhance relevance
- Emotional context improves response appropriateness

### 4. Memory Reconsolidation

When existing memories are accessed:
- Their decay factor is reduced (strengthened)
- New information may update or contradict them
- Contradictions trigger special handling to reconcile differences

## Usage

### Basic Cognitive Memory Operations

```typescript
// Create cognitive memory instance
const cognitiveMemory = new CognitiveMemory({ 
  namespace: 'chloe',
  workingMemoryCapacity: 9
});

// Add episodic memory with emotions
await cognitiveMemory.addEpisodicMemory(
  "User was frustrated about the delayed project timeline",
  { category: 'interaction', source: 'chat' },
  ['frustration', 'negative']
);

// Get working memory contents
const workingMemory = cognitiveMemory.getWorkingMemory();

// Get memories with specific emotion
const frustrationMemories = await cognitiveMemory.getMemoriesByEmotion('frustration', 3);
```

### Knowledge Graph Operations

```typescript
// Create knowledge graph
const knowledgeGraph = new KnowledgeGraph('chloe');

// Add concept nodes
const projectNodeId = await knowledgeGraph.addNode(
  'Project Alpha', 
  'concept',
  { field: 'work' }
);

const deadlineNodeId = await knowledgeGraph.addNode(
  'Deadline Extension',
  'concept',
  { field: 'work' }
);

// Connect concepts
await knowledgeGraph.addEdge(
  deadlineNodeId,
  projectNodeId,
  'relatedTo',
  0.8
);

// Find path between concepts
const path = await knowledgeGraph.findPath(conceptAId, conceptBId);

// Infer new connections
const inferences = await knowledgeGraph.inferNewEdges(conceptAId);
```

## Maintenance

The memory system includes a maintenance script that should be run regularly:

```bash
npm run memory:consolidate
```

This script performs:
- Memory decay processing
- Removal of low-importance memories
- Inference of new knowledge connections
- System health checks

## Limitations

1. The current implementation simulates true episodic memory but has limitations in:
   - Temporal sequencing of complex event chains
   - Autobiographical narrative construction
   - Source confusion resolution

2. Knowledge graph inference is based on simple rules rather than deep causal understanding

3. Emotional context detection uses pattern matching rather than true sentiment analysis

## Future Enhancements

1. **Procedural Memory:** Add storage for learned procedures and skills
2. **Prospective Memory:** Implement "remember to remember" functionality
3. **Autobiographical Timeline:** Create coherent life narrative
4. **Source Attribution:** Improve tracking of information sources
5. **Counterfactual Reasoning:** Enable reasoning about hypothetical scenarios 