# Collection Management Guide

This document provides a comprehensive guide for managing memory collections in the multi-agent system.

## Overview

Collections are the fundamental storage units in the memory system. Each collection represents a specific type of data (agents, chats, messages, etc.) and provides vector-based search capabilities. The collection management system allows you to:

1. Create new collections with specified vector dimensions
2. List and filter existing collections
3. Update collection metadata
4. Monitor collection statistics and performance
5. Migrate data between collections
6. Delete collections when no longer needed

## API Endpoints

All collection management functionality is available through the REST API endpoints under:

```
/api/multi-agent/[agentType]/collections
```

See the [API Documentation](/docs/api/multi-agent/API_DOCUMENTATION.md) for detailed endpoint specifications.

## Collection Structure

Each collection in the memory system has the following structure:

```typescript
interface Collection {
  // Core identity
  name: string;                 // Collection name (used as identifier)
  vectorSize: number;           // Size of vector embeddings (typically 1536 for modern models)
  
  // Metadata
  metadata?: {
    description?: string;       // Human-readable description
    type?: string;              // Collection type (e.g., "agent", "chat", "message")
    createdAt?: string;         // ISO timestamp of creation
    createdBy?: string;         // Creator identifier
    updatedAt?: string;         // ISO timestamp of last update
    [key: string]: any;         // Additional custom metadata
  };
}
```

## Memory Points

Each item stored in a collection is a memory point with the following structure:

```typescript
interface MemoryPoint<T> {
  id: string;                   // Unique point identifier
  vector: number[];             // Vector embedding for similarity search
  payload: T;                   // Actual data payload
  
  // Optimized indexable fields (for EnhancedMemoryService)
  userId?: string;              // From payload.metadata.userId
  agentId?: string;             // From payload.metadata.agentId
  chatId?: string;              // From payload.metadata.chatId
  threadId?: string;            // From payload.metadata.thread?.id
  messageType?: string;         // From payload.metadata.messageType
  timestamp?: number;           // From payload.timestamp (as number)
  importance?: string;          // From payload.metadata.importance
  
  // Agent-to-agent communication fields
  senderAgentId?: string;       // From payload.metadata.senderAgentId
  receiverAgentId?: string;     // From payload.metadata.receiverAgentId
  communicationType?: string;   // From payload.metadata.communicationType
  priority?: string;            // From payload.metadata.priority
}
```

## Best Practices

### Collection Naming

Follow these guidelines for collection names:

- Use kebab-case for collection names (e.g., `agent-capabilities`)
- Make names descriptive but concise
- Include version in name if maintaining multiple versions (e.g., `agent-capabilities-v2`)
- Avoid special characters other than hyphens

### Collection Types

Standardized collection types used in the system:

| Type | Description | Example Collections |
|------|-------------|---------------------|
| `agent` | Agent definitions and configurations | `agents`, `agent-capabilities` |
| `chat` | Chat metadata and configurations | `chats`, `chat-participants` |
| `message` | Message content and metadata | `messages`, `system-messages` |
| `cognition` | Agent cognitive processes | `thoughts`, `reflections`, `insights` |
| `relationship` | Agent-to-agent relationships | `agent-relationships` |
| `task` | Task definitions and states | `tasks`, `task-assignments` |
| `system` | System configuration and metadata | `system-config`, `metrics` |

### Vector Sizes

Common vector sizes used in the system:

| Size | Purpose | Model Compatibility |
|------|---------|---------------------|
| 1536 | Default for most embeddings | OpenAI ada-002, text-embedding-3-small |
| 768 | Smaller alternatives | Various smaller embedding models |
| 3072 | High-dimensional embeddings | OpenAI text-embedding-3-large |

### Performance Optimization

Tips for optimal collection performance:

1. **Use Top-Level Fields**: Store frequently queried fields at the top level of memory points
2. **Index Critical Fields**: Create indices for fields used in frequent queries
3. **Limit Collection Size**: Keep individual collections under 100,000 points when possible
4. **Batch Operations**: Use batch operations for adding/updating multiple points
5. **Consider Archiving**: Move older data to archive collections for better performance

## Collection Management Workflow

### Creating Collections

Create a new collection when:

- Implementing a new feature requiring persistent storage
- Separating data types that were previously combined
- Creating a specialized subset of an existing collection
- Implementing a new version of an existing collection

Example collection creation:

```javascript
const response = await fetch('/api/multi-agent/system/collections', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'agent-insights',
    description: 'Collection for storing agent-generated insights',
    type: 'cognition',
    vectorSize: 1536
  })
});
```

### Monitoring Collections

Regularly monitor collection statistics to:

- Track growth over time
- Identify performance bottlenecks
- Understand usage patterns
- Plan for scaling needs

Example statistics monitoring:

```javascript
const response = await fetch('/api/multi-agent/system/collections/agent-insights/stats');
const { stats } = await response.json();
console.log(`Collection size: ${stats.pointCount} points (${stats.memoryUsage.formattedSize})`);
```

### Migrating Collections

Data migration is useful for:

- Moving data to a new collection structure
- Archiving old data
- Transforming data format
- Splitting or merging collections

Example data migration with transformation:

```javascript
const response = await fetch('/api/multi-agent/system/collections/migrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sourceCollectionId: 'old-thoughts',
    targetCollectionId: 'cognitive-processes',
    filter: {
      must: [
        { key: 'importance', match: { value: 'high' } }
      ]
    },
    transform: {
      type: 'moveField',
      options: {
        sourcePath: 'payload.content',
        targetPath: 'payload.thought.content'
      }
    }
  })
});
```

## Supported Transforms

The migration API supports the following transform operations:

### addField

Adds a new field to all points:

```json
{
  "type": "addField",
  "options": {
    "field": "migrated",
    "value": true
  }
}
```

### moveField

Moves a field from one location to another:

```json
{
  "type": "moveField",
  "options": {
    "sourcePath": "payload.metadata.importance",
    "targetPath": "importance"
  }
}
```

## Troubleshooting

Common issues and solutions:

### Collection Already Exists

**Issue**: Attempted to create a collection with a name that already exists.

**Solution**: List collections to verify existing names, then either use a different name or delete the existing collection if appropriate.

### Missing Vector Dimensions

**Issue**: Points cannot be added to a collection because vector dimensions don't match.

**Solution**: Check the `vectorSize` of the collection and ensure vectors being added match this dimension.

### Performance Degradation

**Issue**: Queries against a collection are becoming slower over time.

**Solution**: 
1. Check collection statistics to verify growth
2. Consider archiving older data
3. Ensure queries use indexed fields
4. Review vector search parameters (k values, etc.)

## Integration with Other Systems

### Memory Service Integration

The collection management API integrates with the EnhancedMemoryService, leveraging the dual-field approach for improved query performance. The service automatically duplicates critical fields at the top level of memory points for faster filtering and retrieval.

### Agent Capabilities Integration

Agent capabilities can be stored in dedicated collections, allowing for capability discovery and performance tracking. Use the collection management API to create specialized collections for capability tracking.

### Analytics Integration

Collection statistics can be integrated with the analytics system to track usage patterns, growth trends, and performance metrics. This data can inform scaling decisions and optimization efforts. 