# Memory Entity Relationships

This document visualizes the relationships between different memory entity types.

## Entity Relationship Diagram

```
+----------------+       +----------------+       +----------------+
|    Message     |       |    Thought     |       |    Document    |
+----------------+       +----------------+       +----------------+
| id: string     |       | id: string     |       | id: string     |
| text: string   |<----->| text: string   |<----->| text: string   |
| timestamp: str |       | timestamp: str |       | timestamp: str |
| metadata: obj  |       | metadata: obj  |       | metadata: obj  |
+----------------+       +----------------+       +----------------+
        ^                        ^                        ^
        |                        |                        |
        |                        |                        |
        v                        v                        v
+----------------+       +----------------+       +----------------+
|      Task      |       | Memory_Edits   |       |  Causal Link   |
+----------------+       +----------------+       +----------------+
| id: string     |       | id: string     |       | causeId: str   |
| text: string   |       | original_id: str|       | effectId: str |
| timestamp: str |       | edit_type: str |       | description: str|
| metadata: obj  |       | metadata: obj  |       | timestamp: str |
+----------------+       +----------------+       +----------------+
```

## Key Relationships

1. **Message → Thought**:
   - A message can trigger thoughts (reflection, planning, etc.)
   - A thought can reference messages as context

2. **Thought → Task**:
   - A thought can result in task creation
   - Tasks can reference thoughts that created them

3. **Document → Memory**:
   - Documents can be referenced by messages, thoughts, and tasks
   - Documents can be created from memory content

4. **Memory → Memory_Edits**:
   - Any memory can have a history of edits
   - Each edit references the original memory

5. **Memory → Memory (Causal)**:
   - Memories can have causal relationships
   - One memory can cause another (cause → effect)

## Relationship Implementations

### Referential Relationships

These relationships are implemented via ID references in metadata:

```typescript
// A thought referencing a message
{
  type: 'thought',
  text: 'Reflection on user query...',
  metadata: {
    relatedTo: ['message_12345'], // References message ID
    messageType: 'reflection'
  }
}
```

### Causal Relationships

Bidirectional links between cause and effect:

```typescript
// Cause memory
{
  id: 'memory_1',
  text: 'User asked about weather',
  metadata: {
    led_to: [
      {
        memoryId: 'memory_2',
        description: 'Triggered weather lookup',
        timestamp: '2023-05-01T12:00:00Z'
      }
    ]
  }
}

// Effect memory
{
  id: 'memory_2',
  text: 'Looking up weather for London',
  metadata: {
    caused_by: {
      memoryId: 'memory_1',
      description: 'Triggered by user question',
      timestamp: '2023-05-01T12:00:00Z'
    }
  }
}
```

### Version History

Edit history tracked in memory_edits collection:

```typescript
// Original memory
{
  id: 'memory_1',
  text: 'Original content',
  metadata: {
    current: true,
    previous_version_id: 'edit_2'
  }
}

// Edit record
{
  id: 'edit_1',
  original_memory_id: 'memory_1',
  text: 'Previous content',
  metadata: {
    edit_type: 'update',
    editor_type: 'system',
    current: false
  }
}
```

## Issues with Current Implementation

1. **Loose Coupling**: Relationships implemented via untyped metadata
2. **No Referential Integrity**: No enforcement of valid references
3. **Redundant Storage**: Same relationship stored in multiple places
4. **Temporal Complexity**: Time-based relationships not consistently implemented
5. **Missing Validation**: No schema enforcement for relationships
6. **No Cascading Operations**: No handling of related entities on delete/update 