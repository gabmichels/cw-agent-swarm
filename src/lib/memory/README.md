# Chloe Enhanced Memory System

The Enhanced Memory System is a core component that enables Chloe to store, retrieve, and learn from interactions over time. This system is designed to provide the foundation for autonomous behavior by creating connections between user inputs, agent actions, and stored knowledge.

## Key Features

### 1. Natural Language Understanding
- **Date Extraction:** Automatically parses dates from expressions like "by Friday", "in 3 days", etc.
- **Priority Detection:** Identifies urgency signals from phrases like "crucial", "important", "ASAP"
- **Parameter Extraction:** Extracts relevant parameters from natural language input

### 2. Memory Integration
- **Unified Storage:** All subsystems store information in a consistent format
- **Cross-collection Search:** Search for relevant information across all memory types
- **Semantic Retrieval:** Find memories based on meaning, not just keywords

### 3. Feedback Loops
- **Memory Importance Tracking:** Records which memories are most frequently accessed
- **Intent Pattern Learning:** Learns and improves intent recognition over time
- **Self-improvement:** Uses past interactions to better understand new requests

### 4. Intent Learning and Pattern Recognition
- **Pattern Storage:** Remembers successful intent classifications
- **Usage Tracking:** Records which patterns were most useful
- **Continuous Improvement:** Gets better at understanding over time

## Architecture

The memory system is built on Qdrant vector database with collections for:
- **Messages:** User inputs and agent responses
- **Thoughts:** Internal reasoning and reflections
- **Documents:** Knowledge sources and summaries
- **Tasks:** Actions to be taken by the agent

Each memory entry includes:
- **Content:** The actual information
- **Metadata:** Tags, importance rating, source, timestamp
- **Usage data:** How often retrieved, last accessed
- **Relationships:** Connections to other memories

## How It Works

1. **Memory Storage:**
   - When Chloe receives user input, it's analyzed for importance
   - Natural language is processed to extract dates, priorities, and parameters
   - Information is stored with appropriate metadata

2. **Memory Retrieval:**
   - When processing a request, Chloe searches for relevant memories
   - Memories are ranked by relevance, recency, and importance
   - Retrieved memories inform the response generation

3. **Learning Loop:**
   - Successful intent matches are stored for future reference
   - Memory usage patterns improve retrieval relevance
   - Natural language understanding improves over time

## Implementation

The core classes are:
- `EnhancedMemory`: Main class for memory operations
- `DATE_PATTERNS`: Regular expressions for date extraction
- `PRIORITY_PATTERNS`: Patterns for identifying urgency levels
- `IntentRouterTool`: Uses memory to enhance intent understanding

## Usage Example

```typescript
// Initialize memory
const memory = createEnhancedMemory();

// Add a memory
await memory.addMemory(
  "I need to create a report by Friday",
  { category: "task", importance: "high" },
  "message"
);

// Extract date from text
const date = memory.extractDateFromText("I need this done by Friday");
// Returns Date object for next Friday

// Extract priority
const priority = memory.extractPriority("This is crucial and urgent");
// Returns "high"
```

This enhanced memory system replaces the legacy Python-based memory systems and provides a foundation for true agent autonomy by enabling learning and adaptation over time.

# Memory System: Tag Extraction and Importance Calculation

This directory contains the core utilities for memory management in the agent system, including tag extraction and importance calculation.

## Tag Extraction System

The new `TagExtractor` utility provides sophisticated keyword/tag extraction from content using multiple algorithms:

### Features

- **Multiple Algorithms**: 
  - TF-IDF: Best for longer documents, considers term frequency and rarity
  - RAKE: Optimized for shorter texts, extracts multi-word phrases
  - Basic: Simple frequency-based extraction

- **Normalization Pipeline**:
  - Stemming to handle word variations
  - Stopword filtering with domain-specific additions
  - Text cleaning and normalization

- **Corpus-Aware Processing**:
  - Maintains global term statistics across documents
  - Improves extraction quality over time as more content is processed
  - Calculates inverse document frequency for better significance estimation

- **Confidence Scoring**:
  - Each tag has a confidence score indicating extraction reliability
  - Used in retrieval and importance calculations

- **Tag Management**:
  - Support for manually approved vs. automatically generated tags
  - Tag merging from multiple sources with prioritization
  - Calculation of tag overlap for boosting search results

## Importance Calculation

The `ImportanceCalculator` determines the importance of memory items based on multiple factors:

### Features

- **Multi-Factor Scoring**:
  - Document length (longer content often has more value)
  - Tag quality and confidence
  - Source type (markdown gets higher scores)
  - Embedding centrality
  - Keyword presence
  - Recency

- **Consistent Scoring**:
  - Centralized calculation for all memory types
  - Normalized scores between 0 and 1
  - Mapping to traditional importance levels (CRITICAL, HIGH, etc.)

- **Tag Integration**:
  - Uses tag confidence in importance calculation
  - Higher quality tags increase importance
  - Adjustable weights per factor

- **Search Enhancement**:
  - Tag overlap boosts search relevance
  - Importance scores influence retrieval ranking

## Memory Storage and Retrieval

The memory storage system has been enhanced to:

1. Automatically extract tags during memory ingestion
2. Calculate importance scores based on multiple factors
3. Store tags and importance scores with memories
4. Boost search results based on tag overlap with queries

## Usage

### Tag Extraction

```typescript
import { TagExtractor, TagAlgorithm } from '../lib/memory/TagExtractor';

// Extract tags from content
const tags = TagExtractor.extractTags(content, {
  algorithm: TagAlgorithm.TFIDF,
  maxTags: 10,
  minConfidence: 0.2
});

// Use the tags
const tagStrings = tags.map(tag => tag.text);
console.log("Extracted tags:", tagStrings);
```

### Importance Calculation

```typescript
import { ImportanceCalculator } from '../lib/memory/ImportanceCalculator';

// Calculate importance score
const importanceScore = ImportanceCalculator.calculateImportanceScore({
  content: documentContent,
  source: MemorySource.FILE,
  type: ChloeMemoryType.KNOWLEDGE,
  tags: extractedTags,
  tagConfidence: 0.85,
  embedding: contentEmbedding
});

// Map to traditional importance level
const importanceLevel = ImportanceCalculator.scoreToImportanceLevel(importanceScore);
```

### Tag-Based Search Boosting

When searching memories, results are automatically boosted based on tag overlap with the query:

```typescript
// This happens automatically in the searchMemory function
const results = await searchMemory(type, query, options);
// Results are boosted based on tag overlap with query
```

## Memory Retrieval

Memory retrieval uses a combination of:

1. **Vector similarity search** - Content is converted to embeddings which are searched using cosine similarity
2. **Filtering options** - Results can be filtered by type, source, importance, etc.
3. **Hybrid scoring** - A combination of vector similarity and tag matching 
4. **Usage-based boosting** - Frequently used memories get higher scores over time

### Hybrid Search Approach

The search functionality implements a hybrid scoring algorithm that combines:

- **Vector similarity (70%)** - Traditional embedding-based similarity search
- **Tag overlap (30%)** - Boosting based on shared tags between query and memory
- **Usage tracking** - Further adjustment based on how often a memory has been useful

This hybrid approach improves search relevance by:

- Emphasizing content with matching tags/keywords
- Maintaining semantic similarity as the primary ranking factor
- Learning which memories are most useful over time
- Providing interpretable results with diagnostic information

The implementation:
1. Retrieves the top 20 results from vector search
2. Extracts tags from the query
3. Calculates tag overlap between query and memory tags
4. Computes a combined score with 70/30 weighting
5. Adjusts scores based on usage history: `adjusted_score = hybrid_score * (1 + log(usage_count))`
6. Logs which tags contributed to matches

To use the hybrid search, simply use the regular `searchMemory` function, which now implements this approach automatically.

### Usage Tracking

The system now tracks how frequently each memory is used through a feedback mechanism:

1. When a memory is successfully used to answer a query, call `trackMemoryUsage(memoryId)`
2. This increments the `usage_count` in the memory's metadata
3. Future retrievals will boost this memory proportionally to its usage count
4. The logarithmic scaling ensures diminishing returns for very frequently used items

This creates a reinforcement learning loop where memories that prove useful get prioritized in future searches.

## Memory Lifecycle Management

The enhanced memory system now supports a complete lifecycle management approach that mimics human memory:

### Memory Reinforcement

Memories can be explicitly reinforced when they prove valuable:

- When a user says "that was helpful" or provides positive feedback
- When a memory is successfully used in task execution
- Through explicit agent decisions to reinforce important information

The reinforcement mechanism:
1. Increases the memory's importance score by 20%
2. Tracks a `last_reinforced_at` timestamp to prevent over-reinforcement
3. Counts how many times a memory has been reinforced
4. Stores the reason for reinforcement

### Memory Decay

To prevent memory overload and maintain freshness, the system includes temporal decay:

- Reduces importance scores by 5% weekly for memories that haven't been accessed
- Critical memories (marked with `critical=true`) are exempt from decay
- A minimum importance floor prevents valuable memories from decaying too far
- Decay isn't applied to recently used memories

### Critical Memory Protection

Some memories should be retained regardless of usage:

- Mark memories as critical with `markMemoryAsCritical(memoryId)`
- Critical memories are exempt from decay but still participate in importance-based retrieval
- Example critical memories: user preferences, important facts, agent instructions

### Feedback Loop Integration

The memory lifecycle creates a complete feedback loop:

1. **Storage**: Memories are stored with initial importance based on content
2. **Retrieval**: Memories are retrieved based on relevance and importance
3. **Usage**: Successful usage increases memory usage count
4. **Reinforcement**: Explicit feedback increases importance
5. **Decay**: Unused memories gradually lose importance
6. **Protection**: Critical memories are preserved regardless of usage

This cycle ensures the memory system continuously improves and adapts to the user's needs. 