# Memory Context API

## Overview

The Memory Context API provides a structured way to retrieve and organize related memories. A memory context contains groups of memories organized by topic, time, type, or custom categories to provide relevant context for various use cases such as planning, reasoning, and tool execution.

## Core Concepts

### Memory Context

A `MemoryContext` is a container that holds groups of related memories with additional metadata and summary information. It includes:

- **Context ID**: A unique identifier for the context
- **Timestamp**: When the context was created
- **Groups**: Collections of related memories organized by relevance or relationship
- **Summary**: Optional overall context summary
- **Metadata**: Additional information about the context

### Memory Context Group

A `MemoryContextGroup` represents a collection of related memories within a context:

- **Name**: Descriptive name for the group
- **Description**: Brief explanation of what the group represents
- **Memories**: Array of memory search results
- **Relevance**: Relevance score for the group (0-1)

### Grouping Strategies

The API supports multiple grouping strategies:

1. **Topic-Based** (`topic`): Groups memories by semantic similarity (default)
2. **Time-Based** (`time`): Groups memories by recency (Recent, Past Week, Past Month, Older)
3. **Type-Based** (`type`): Groups memories by their memory type (Message, Thought, Document, etc.)
4. **Custom** (`custom`): Groups memories by user-defined categories

## API Endpoints

### GET /api/memory/context

Retrieves a memory context based on query parameters.

**Query Parameters:**

- `query` (string): Search query to find relevant memories
- `types` (array): Memory types to include
- `maxMemoriesPerGroup` (number, default: 5): Maximum memories per group
- `maxTotalMemories` (number, default: 20): Maximum total memories
- `includeSummary` (boolean, default: false): Whether to generate a summary
- `minScore` (number, default: 0.6): Minimum similarity score
- `timeWeighted` (boolean, default: false): Apply time-based weighting to scores
- `numGroups` (number, default: 3): Number of groups to create
- `groupingStrategy` (string, default: 'topic'): Strategy for grouping memories
- Filter parameters can be specified with the `filter.` prefix (e.g., `filter.metadata.userId=123`)

**Response:**

```json
{
  "context": {
    "contextId": "ctx_1620000000000_abc123",
    "timestamp": 1620000000000,
    "groups": [
      {
        "name": "Recent Conversations",
        "description": "Recent chat messages about the project",
        "memories": [...],
        "relevance": 0.95
      },
      ...
    ],
    "summary": "Found 20 memories related to project planning spanning from May 1 to May 15",
    "metadata": {
      "query": "project planning",
      "totalMemoriesFound": 45,
      "strategy": "topic"
    }
  },
  "success": true
}
```

### POST /api/memory/context

Creates a memory context with more complex filters.

**Request Body:**

```json
{
  "query": "project planning",
  "filter": {
    "metadata.projectId": "project-123",
    "timestamp": { "$gte": 1620000000000 }
  },
  "types": ["MESSAGE", "THOUGHT", "DOCUMENT"],
  "maxMemoriesPerGroup": 5,
  "maxTotalMemories": 20,
  "includeSummary": true,
  "minScore": 0.6,
  "timeWeighted": true,
  "numGroups": 3,
  "includedGroups": ["design", "implementation", "testing"],
  "groupingStrategy": "custom"
}
```

**Response:**

Same format as the GET endpoint.

## Usage Examples

### Getting Topic-Based Context

```javascript
// Example: Get memories related to "project planning" grouped by topic
const response = await fetch('/api/memory/context?query=project planning&includeSummary=true');
const data = await response.json();

if (data.success) {
  // Process the memory context groups
  data.context.groups.forEach(group => {
    console.log(`Group: ${group.name} - ${group.description}`);
    group.memories.forEach(memory => {
      console.log(`- ${memory.point.payload.text}`);
    });
  });
  
  // Display the context summary
  if (data.context.summary) {
    console.log(`Summary: ${data.context.summary}`);
  }
}
```

### Getting Time-Based Context

```javascript
// Example: Get time-weighted memories related to "user feedback" grouped by time periods
const response = await fetch('/api/memory/context?query=user feedback&groupingStrategy=time&timeWeighted=true');
const data = await response.json();

if (data.success) {
  // Process the memory context groups (e.g., Recent, Past Week, Past Month, Older)
  data.context.groups.forEach(group => {
    console.log(`Time Period: ${group.name}`);
    group.memories.forEach(memory => {
      console.log(`- ${memory.point.payload.text}`);
    });
  });
}
```

### Using Complex Filters with POST

```javascript
// Example: Get memories with complex filtering and custom grouping
const response = await fetch('/api/memory/context', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "refactoring",
    filter: {
      "metadata.tags": { "$contains": "architecture" },
      "timestamp": { "$gte": Date.now() - 30 * 24 * 60 * 60 * 1000 } // Last 30 days
    },
    types: ["THOUGHT", "DOCUMENT", "REFLECTION"],
    groupingStrategy: "custom",
    includedGroups: ["design", "implementation", "testing"]
  })
});

const data = await response.json();

if (data.success) {
  // Process the memory context with custom groups
  console.log(`Found ${data.context.groups.length} custom groups`);
}
```

## Implementation Details

### Time-Weighted Relevance

When `timeWeighted` is set to `true`, memory scores are adjusted based on recency:

- Recent memories get a score boost
- The weighting formula balances original relevance score with time factor
- Default time weight is 30% of the final score

### Topic-Based Grouping

The default `topic` grouping strategy:

1. Uses a simple clustering approach based on text similarity
2. Identifies central "topics" from the most relevant memories
3. Assigns remaining memories to their closest topic group
4. Extracts topic names and descriptions from memory content

## Error Handling

The API returns appropriate error codes and messages:

- `400 Bad Request`: Invalid parameters (missing query/filter)
- `500 Internal Server Error`: Database errors or context creation failures

Error responses include a descriptive message and error code:

```json
{
  "error": "Either query or filter must be provided",
  "success": false
}
```

## Best Practices

1. **Query Optimization**:
   - Be specific with queries for more relevant results
   - Use filter parameters to narrow down the search space

2. **Memory Group Size**:
   - Adjust `maxMemoriesPerGroup` based on your UI needs
   - Lower values (3-5) are better for immediate context display
   - Higher values provide more comprehensive context

3. **Grouping Strategy Selection**:
   - Use `topic` for semantic understanding of memories
   - Use `time` when chronology is important
   - Use `type` when different memory types serve distinct purposes
   - Use `custom` when you need specific categorization 