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