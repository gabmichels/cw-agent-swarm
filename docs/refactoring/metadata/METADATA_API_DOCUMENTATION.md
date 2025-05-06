# Memory Metadata API Documentation

## Overview

This document provides reference documentation for the memory metadata API, outlining the main interfaces, factory functions, and wrapper methods available when working with the memory system.

## Core Types

### StructuredId

Represents a reliable entity identifier with standard format.

```typescript
interface StructuredId {
  namespace: string;  // Organization or system namespace
  type: string;       // Entity type (user, agent, chat, etc.)
  id: string;         // Unique identifier
  version?: number;   // Optional version for versioned entities
}
```

### BaseMetadata

Base interface for all metadata types with common fields.

```typescript
interface BaseMetadata {
  importance?: ImportanceLevel;
  importance_score?: number;
  tags?: string[];
  is_deleted?: boolean;
  deletion_time?: string;
  schemaVersion: string; // Semantic versioning string
}
```

### ThreadInfo

Thread information for message threading and relationships.

```typescript
interface ThreadInfo {
  id: string;         // Thread identifier
  position: number;   // Position in the thread (0-based)
  parentId?: string;  // Optional parent thread ID
}
```

### MessageMetadata

Metadata for message memories.

```typescript
interface MessageMetadata extends BaseMetadata {
  role: MessageRole;
  userId: StructuredId;
  agentId: StructuredId;
  chatId: StructuredId;
  messageType?: string;
  thread: ThreadInfo;  // Required, not optional
  attachments?: MessageAttachment[];
  source?: string;
  category?: string;
  
  // Enhanced fields for multi-agent communication
  senderAgentId?: StructuredId;
  receiverAgentId?: StructuredId;
  communicationType?: 'request' | 'response' | 'notification' | 'broadcast';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  requiresResponse?: boolean;
}
```

### CognitiveProcessMetadata

Base metadata for all cognitive processes.

```typescript
interface CognitiveProcessMetadata extends BaseMetadata {
  processType: CognitiveProcessType;
  agentId: StructuredId;
  contextId?: string;
  relatedTo?: string | string[];
  influences?: string | string[];
  influencedBy?: string | string[];
  relevance?: number;
  source?: string;
  category?: string;
}
```

### DocumentMetadata

Metadata for document memories.

```typescript
interface DocumentMetadata extends BaseMetadata {
  source: DocumentSource;
  title?: string;
  url?: string;
  contentType?: string;
  fileName?: string;
  fileSize?: number;
  creationDate?: string;
  lastModified?: string;
  authors?: string[];
  userId?: StructuredId;
  agentId: StructuredId;
}
```

### TaskMetadata

Metadata for task memories.

```typescript
interface TaskMetadata extends BaseMetadata {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  agentId: StructuredId;
  description?: string;
  assignedTo?: StructuredId;
  dueDate?: string;
  completedDate?: string;
  parentTaskId?: string;
  progress?: number;
  estimatedDuration?: number;
  actualDuration?: number;
  attemptCount?: number;
}
```

## Factory Functions

### Structured ID Creation

```typescript
// Create a user ID
function createUserId(id: string): StructuredId;

// Create an agent ID
function createAgentId(id: string): StructuredId;

// Create a chat ID
function createChatId(id: string): StructuredId;

// Create a thread ID
function createThreadId(id: string): StructuredId;

// Create a system entity ID
function createSystemId(entityType: EntityType, id: string): StructuredId;

// Parse a structured ID from string format
function parseStructuredId(idString: string): StructuredId | null;
```

### Thread Info Creation

```typescript
// Create thread information
function createThreadInfo(
  threadId: string,
  position: number,
  parentId?: string
): ThreadInfo;
```

### Metadata Creation

```typescript
// Create message metadata
function createMessageMetadata(
  role: MessageRole | string,
  userId: StructuredId,
  agentId: StructuredId,
  chatId: StructuredId,
  thread: ThreadInfo,
  options?: Partial<MessageMetadata>
): MessageMetadata;

// Create thought metadata (specific cognitive process)
function createThoughtMetadata(
  agentId: StructuredId,
  options?: Partial<Omit<CognitiveProcessMetadata, 'processType' | 'agentId'>>
): CognitiveProcessMetadata;

// Create reflection metadata (specific cognitive process)
function createReflectionMetadata(
  agentId: StructuredId,
  options?: Partial<Omit<CognitiveProcessMetadata, 'processType' | 'agentId'>>
): CognitiveProcessMetadata;

// Create document metadata
function createDocumentMetadata(
  source: DocumentSource,
  options: Partial<Omit<DocumentMetadata, 'source'>> & { agentId: StructuredId }
): DocumentMetadata;

// Create task metadata
function createTaskMetadata(
  title: string,
  status: TaskStatus,
  priority: TaskPriority,
  agentId: StructuredId,
  options?: Partial<Omit<TaskMetadata, 'title' | 'status' | 'priority' | 'agentId'>>
): TaskMetadata;
```

## Memory Service Wrappers

### Message Memory

```typescript
// Add a message to memory
async function addMessageMemory(
  memoryService: any,
  content: string,
  role: MessageRole | string,
  userId: StructuredId,
  agentId: StructuredId,
  chatId: StructuredId,
  thread: ThreadInfo,
  options?: {
    messageType?: string;
    importance?: ImportanceLevel;
    attachments?: MessageAttachment[];
    metadata?: Record<string, any>;
  }
): Promise<any>;

// Search for messages
async function searchMessages(
  memoryService: any,
  criteria: {
    userId?: StructuredId;
    agentId?: StructuredId;
    chatId?: StructuredId;
    role?: MessageRole | string;
    threadId?: string;
    messageType?: string;
  },
  options?: {
    query?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }
): Promise<any[]>;
```

### Cognitive Process Memory

```typescript
// Add a cognitive process to memory
async function addCognitiveProcessMemory(
  memoryService: any,
  content: string,
  processType: CognitiveProcessType,
  agentId: StructuredId,
  options?: {
    contextId?: string;
    relatedTo?: string | string[];
    importance?: ImportanceLevel;
    metadata?: Record<string, any>;
  }
): Promise<any>;

// Search for cognitive processes
async function searchCognitiveProcesses(
  memoryService: any,
  criteria: {
    agentId?: StructuredId;
    processType?: CognitiveProcessType;
    contextId?: string;
    relatedTo?: string;
  },
  options?: {
    query?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }
): Promise<any[]>;
```

### Document Memory

```typescript
// Add a document to memory
async function addDocumentMemory(
  memoryService: any,
  content: string,
  source: DocumentSource,
  options?: {
    title?: string;
    contentType?: string;
    url?: string;
    fileName?: string;
    agentId: StructuredId;
    userId?: StructuredId;
    importance?: ImportanceLevel;
    metadata?: Record<string, any>;
  }
): Promise<any>;

// Search for documents
async function searchDocuments(
  memoryService: any,
  criteria: {
    source?: DocumentSource;
    agentId?: StructuredId;
    userId?: StructuredId;
    title?: string;
    contentType?: string;
  },
  options?: {
    query?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }
): Promise<any[]>;
```

### Task Memory

```typescript
// Add a task to memory
async function addTaskMemory(
  memoryService: any,
  content: string,
  title: string,
  status: TaskStatus,
  priority: TaskPriority,
  agentId: StructuredId,
  options?: {
    description?: string;
    assignedTo?: StructuredId;
    dueDate?: string;
    parentTaskId?: string;
    importance?: ImportanceLevel;
    metadata?: Record<string, any>;
  }
): Promise<any>;

// Search for tasks
async function searchTasks(
  memoryService: any,
  criteria: {
    agentId?: StructuredId;
    assignedTo?: StructuredId;
    status?: TaskStatus;
    priority?: TaskPriority;
    parentTaskId?: string;
  },
  options?: {
    query?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }
): Promise<any[]>;
```

## Usage Examples

### Creating and Storing a Message

```typescript
import { 
  createUserId, 
  createAgentId, 
  createChatId 
} from '../../types/structured-id';
import { 
  createThreadInfo 
} from '../../server/memory/services/helpers/metadata-helpers';
import { 
  addMessageMemory 
} from '../../server/memory/services/memory/memory-service-wrappers';
import { MessageRole } from '../../agents/chloe/types/state';
import { ImportanceLevel } from '../../constants/memory';

// Create structured IDs
const userId = createUserId('john-doe');
const agentId = createAgentId('assistant');
const chatId = createChatId('general');

// Create thread info for a new thread
const threadInfo = createThreadInfo(`thread_${Date.now()}`, 0);

// Add the message to memory
await addMessageMemory(
  memoryService,
  'Hello, how can I help you today?',
  MessageRole.ASSISTANT,
  userId,
  agentId,
  chatId,
  threadInfo,
  {
    importance: ImportanceLevel.MEDIUM,
    messageType: 'greeting',
    metadata: {
      tags: ['initial-contact', 'greeting']
    }
  }
);
```

### Creating and Storing a Thought

```typescript
import { 
  createAgentId 
} from '../../types/structured-id';
import {
  addCognitiveProcessMemory
} from '../../server/memory/services/memory/memory-service-wrappers';
import { CognitiveProcessType } from '../../types/metadata';
import { ImportanceLevel } from '../../constants/memory';

// Create structured ID
const agentId = createAgentId('assistant');

// Add the thought to memory
await addCognitiveProcessMemory(
  memoryService,
  'The user seems to be asking about machine learning concepts. I should provide a clear explanation with examples.',
  CognitiveProcessType.THOUGHT,
  agentId,
  {
    contextId: 'conversation-123',
    importance: ImportanceLevel.MEDIUM,
    metadata: {
      category: 'reasoning',
      tags: ['machine-learning', 'explanation-planning']
    }
  }
);
```

### Searching for Related Messages

```typescript
import { 
  searchMessages 
} from '../../server/memory/services/memory/memory-service-wrappers';

// Search for all messages in a specific thread
const messagesInThread = await searchMessages(
  memoryService,
  {
    threadId: 'thread-123'
  },
  {
    limit: 10,
    sortBy: 'thread.position',
    sortDirection: 'asc'
  }
);

// Process the messages
messagesInThread.forEach(message => {
  console.log(`[${message.metadata.role}]: ${message.content}`);
});
```

## Best Practices

1. **Always use factory functions** to create metadata instances.
2. **Validate all input** before passing to factory functions.
3. **Use structured IDs consistently** for all entity references.
4. **Include thread information** for all message metadata.
5. **Use explicit enum values** rather than string literals.
6. **Provide schema versions** for all metadata.
7. **Use memory service wrappers** instead of direct service calls.
8. **Handle errors** from all memory operations.

## Migration Guide

When migrating from the old patterns to the new metadata system:

1. Replace string IDs with structured IDs using the appropriate factory functions.
2. Convert thread handling from `inResponseTo` and `isPartOfThread` to ThreadInfo.
3. Use factory functions instead of direct object creation.
4. Use wrapper methods instead of direct memory service calls.
5. Replace role strings with MessageRole enum values.
6. Add missing required fields like agentId and chatId.
7. Add schema version to all metadata.

## Schema Version Support

The current schema version is `1.0.0`. All metadata should include this version in the `schemaVersion` field. Future versions will follow semantic versioning (MAJOR.MINOR.PATCH).

## Further Resources

- [METADATA_STYLE_GUIDE.md](METADATA_STYLE_GUIDE.md) - Best practices and patterns
- [src/types/metadata.ts](src/types/metadata.ts) - Core type definitions
- [src/types/structured-id.ts](src/types/structured-id.ts) - Structured identifier system
- [src/server/memory/services/helpers/metadata-helpers.ts](src/server/memory/services/helpers/metadata-helpers.ts) - Factory functions
- [src/server/memory/services/memory/memory-service-wrappers.ts](src/server/memory/services/memory/memory-service-wrappers.ts) - Memory service wrappers 