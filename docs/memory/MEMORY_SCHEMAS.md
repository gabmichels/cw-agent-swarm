# Memory Schemas

## Current Memory Types

The memory system currently uses the following memory types, corresponding to collections in Qdrant:

| Memory Type | Collection | Description |
|-------------|------------|-------------|
| `message` | `messages` | User and assistant messages in chat |
| `thought` | `thoughts` | Internal agent thoughts and reflections |
| `document` | `documents` | Stored documents, files, and knowledge |
| `task` | `tasks` | Tasks, goals, and objectives |
| `memory_edits` | `memory_edits` | History of memory changes |

## Base Memory Record Structure

All memory records share the following base structure:

```typescript
interface MemoryRecord {
  id: string;             // Unique identifier
  text: string;           // Primary content
  timestamp: string;      // Creation time ISO string
  type: QdrantMemoryType; // Type of memory
  metadata: Record<string, any>; // Additional data
  is_deleted?: boolean;   // Soft deletion flag
}
```

## Memory Type Specific Metadata

### Message Memory

```typescript
interface MessageMetadata {
  role: 'user' | 'assistant' | 'system'; // Message sender
  userId: string;         // User identifier
  messageType?: string;   // Type of message (e.g., 'text', 'image')
  importance?: string;    // Importance level
  importance_score?: number; // Numeric importance score
  isInternalMessage?: boolean; // Whether message is internal
  notForChat?: boolean;   // Whether to exclude from chat
  attachments?: any[];    // Message attachments
  visionResponseFor?: string; // For responses to vision input
  tags?: string[];        // Content tags
}
```

### Thought Memory

```typescript
interface ThoughtMetadata {
  messageType: 'thought' | 'reflection' | 'planning';
  importance?: string;    // Importance level
  importance_score?: number; // Numeric importance score
  isInternalMessage: boolean; // Always true for thoughts
  notForChat: boolean;    // Always true for thoughts
  agentId?: string;       // ID of the agent generating the thought
  relatedTo?: string[];   // IDs of related memories
  tags?: string[];        // Content tags
}
```

### Document Memory

```typescript
interface DocumentMetadata {
  title?: string;         // Document title
  source: string;         // Document source
  contentType?: string;   // MIME type
  fileType?: string;      // File extension
  importance?: string;    // Importance level
  importance_score?: number; // Numeric importance score
  tags?: string[];        // Content tags
  chunkIndex?: number;    // For chunked documents
  totalChunks?: number;   // Total chunks in document
}
```

### Task Memory

```typescript
interface TaskMetadata {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;       // Due date ISO string
  assignedTo?: string;    // Agent ID assigned to task
  completedAt?: string;   // Completion time ISO string
  importance?: string;    // Importance level
  importance_score?: number; // Numeric importance score
  tags?: string[];        // Content tags
}
```

### Memory Edit Record

```typescript
interface MemoryEditMetadata {
  original_memory_id: string; // ID of edited memory
  edit_type: 'create' | 'update' | 'delete';
  editor_type: 'human' | 'agent' | 'system';
  editor_id?: string;     // ID of editor
  diff_summary?: string;  // Summary of changes
  current: boolean;       // Is current version
  previous_version_id?: string; // Prior version
  original_type: QdrantMemoryType; // Type of original memory
  original_timestamp: string; // Original creation time
}
```

## Common Metadata Fields

Certain metadata fields are used across different memory types:

| Field | Type | Description |
|-------|------|-------------|
| `importance` | string | Importance level (`low`, `medium`, `high`, `critical`) |
| `importance_score` | number | Numeric score (0.0-1.0) representing importance |
| `tags` | string[] | Content tags extracted or assigned |
| `usage_count` | number | Number of times the memory has been used |
| `last_used` | string | ISO timestamp of last usage |
| `led_to` | object[] | Memories caused by this memory |
| `caused_by` | object | Memory that caused this memory |
| `critical` | boolean | Whether memory is exempt from decay |

## Inconsistencies and Issues

1. Inconsistent field naming (`isInternalMessage` vs `notForChat`)
2. Mixed use of camelCase and snake_case
3. Missing schema validation
4. Arbitrary metadata fields added without centralized schema
5. Redundant storage of data (e.g., timestamps in both record and metadata)
6. Ambiguous field purposes (e.g., `isInternalMessage` vs `messageType: 'thought'`) 