# Metadata Style Guide

## Introduction

This document provides guidelines and best practices for working with the memory metadata system. Following these conventions ensures consistent metadata handling across the codebase and proper integration with the memory services.

## Core Principles

1. **Use Factory Functions**: Always create metadata through factory functions rather than direct object creation.
2. **Structured Identifiers**: Use structured IDs for all entity references (users, agents, chats).
3. **Type Safety**: Leverage TypeScript's type system to catch metadata errors at compile time.
4. **Thread Awareness**: Always include thread information in message metadata.
5. **Avoid Any Types**: Never use `any` types for metadata fields or parameters.
6. **Proper Imports**: Always place imports at the top of the file, never inline.

## Import Best Practices

Always import dependencies at the top of your file:

```typescript
// Import all dependencies at the top of the file
import { 
  createUserId, 
  createAgentId, 
  createChatId, 
  createThreadId,
  parseStructuredId
} from '../../types/structured-id';
import { 
  createMessageMetadata, 
  createThreadInfo,
  createThoughtMetadata,
  createReflectionMetadata,
  createInsightMetadata,
  createDocumentMetadata,
  createTaskMetadata
} from '../../server/memory/services/helpers/metadata-helpers';
import { MessageRole } from '../../agents/chloe/types/state';
import { CognitiveProcessType, DocumentSource } from '../../types/metadata';
import { ImportanceLevel } from '../../constants/memory';
import { TaskStatus, TaskPriority } from '../../types/metadata';
import { 
  addMessageMemory,
  addCognitiveProcessMemory,
  addDocumentMemory,
  addTaskMemory,
  searchMessages,
  searchCognitiveProcesses,
  searchDocuments,
  searchTasks,
  sendAgentToAgentMessage
} from '../../server/memory/services/memory/memory-service-wrappers';
import { storeInternalMessageToMemory } from '../../lib/memory/storeInternalMessageToMemory';
import { MessageType } from '../../constants/message';

// Never do inline imports in the middle of your code
```

## Structured Identifiers

### What are Structured Identifiers?

Structured identifiers are standardized identifiers with a consistent format:
```namespace:type:id[:version]
```

For example: `user:user:john-doe` or `agent:agent:assistant:1`

### Creating Structured IDs

Use the helper functions in `src/types/structured-id.ts`:

```typescript
// Imports at top of file
import { 
  createUserId, 
  createAgentId, 
  createChatId, 
  createThreadId 
} from '../../types/structured-id';

// Usage in code
const userId = createUserId('john-doe');
const agentId = createAgentId('assistant');
const chatId = createChatId('general-chat');
const threadId = createThreadId('conversation-12345');
```

### Parsing Structured IDs

```typescript
// Imports at top of file
import { parseStructuredId } from '../../types/structured-id';

// Usage in code
const idString = 'user:user:john-doe';
const parsedId = parseStructuredId(idString);

if (parsedId) {
  console.log(parsedId.namespace); // 'user'
  console.log(parsedId.type);      // 'user'
  console.log(parsedId.id);        // 'john-doe'
}
```

## Creating Metadata

### Message Metadata

Always use the `createMessageMetadata` factory function:

```typescript
// Imports at top of file
import { createMessageMetadata, createThreadInfo } from '../../server/memory/services/helpers/metadata-helpers';
import { MessageRole } from '../../agents/chloe/types/state';

// Usage in code
const threadInfo = createThreadInfo(threadId, position);

const metadata = createMessageMetadata(
  MessageRole.USER,
  userId,
  agentId,
  chatId,
  threadInfo,
  {
    messageType: 'chat',
    tags: ['important', 'question']
  }
);
```

### Cognitive Process Metadata

For thoughts, reflections, insights, and other cognitive processes:

```typescript
// Imports at top of file
import { 
  createThoughtMetadata,
  createReflectionMetadata,
  createInsightMetadata
} from '../../server/memory/services/helpers/metadata-helpers';
import { CognitiveProcessType } from '../../types/metadata';
import { ImportanceLevel } from '../../constants/memory';

// Usage in code
const thoughtMetadata = createThoughtMetadata(
  agentId,
  {
    contextId: taskId,
    importance: ImportanceLevel.MEDIUM,
    intention: 'Problem solving'
  }
);

const reflectionMetadata = createReflectionMetadata(
  agentId,
  {
    contextId: taskId,
    reflectionType: 'performance',
    timeScope: 'short-term'
  }
);
```

### Document Metadata

```typescript
// Imports at top of file
import { createDocumentMetadata } from '../../server/memory/services/helpers/metadata-helpers';
import { DocumentSource } from '../../types/metadata';

// Usage in code
const documentMetadata = createDocumentMetadata(
  DocumentSource.FILE,
  {
    title: 'Project Requirements',
    contentType: 'text/plain',
    fileName: 'requirements.txt',
    userId: userId
  }
);
```

### Task Metadata

```typescript
// Imports at top of file
import { createTaskMetadata } from '../../server/memory/services/helpers/metadata-helpers';
import { TaskStatus, TaskPriority } from '../../types/metadata';

// Usage in code
const taskMetadata = createTaskMetadata(
  'Implement Feature X',
  TaskStatus.PENDING,
  TaskPriority.HIGH,
  creatorAgentId,
  {
    description: 'Implement new feature X with following requirements...',
    assignedTo: assignedAgentId,
    dueDate: '2023-07-15T00:00:00Z'
  }
);
```

## Memory Operations

### Adding to Memory

Always use the wrapper functions for memory operations:

```typescript
// Imports at top of file
import { 
  addMessageMemory,
  addCognitiveProcessMemory,
  addDocumentMemory,
  addTaskMemory
} from '../../server/memory/services/memory/memory-service-wrappers';
import { ImportanceLevel } from '../../constants/memory';
import { MessageRole } from '../../agents/chloe/types/state';
import { CognitiveProcessType } from '../../types/metadata';

// Usage in code
// Add a message to memory
await addMessageMemory(
  memoryService,
  content,
  MessageRole.USER,
  userId,
  agentId,
  chatId,
  threadInfo,
  {
    messageType: 'chat',
    importance: ImportanceLevel.MEDIUM
  }
);

// Add a thought to memory
await addCognitiveProcessMemory(
  memoryService,
  content,
  CognitiveProcessType.THOUGHT,
  agentId,
  {
    contextId: taskId,
    importance: ImportanceLevel.HIGH
  }
);
```

### Searching Memory

Use the strongly-typed search functions:

```typescript
// Imports at top of file
import { 
  searchMessages,
  searchCognitiveProcesses,
  searchDocuments,
  searchTasks
} from '../../server/memory/services/memory/memory-service-wrappers';
import { MessageRole } from '../../agents/chloe/types/state';
import { CognitiveProcessType } from '../../types/metadata';

// Usage in code
// Search messages
const messages = await searchMessages(
  memoryService,
  {
    userId: userId,
    role: MessageRole.USER
  },
  {
    query: 'search term',
    limit: 10
  }
);

// Search cognitive processes
const thoughts = await searchCognitiveProcesses(
  memoryService,
  {
    agentId: agentId,
    processType: CognitiveProcessType.THOUGHT
  },
  {
    limit: 5
  }
);
```

## Thread Handling

### Creating Thread Info

```typescript
// Imports at top of file
import { createThreadInfo } from '../../server/memory/services/helpers/metadata-helpers';

// Usage in code
// Create thread info for a new thread
const threadInfo = createThreadInfo(
  `thread_${Date.now()}`, // Generate a new thread ID
  0                      // Position 0 for first message
);

// Create thread info for a reply
const replyThreadInfo = createThreadInfo(
  existingThreadId,     // Use same thread ID
  existingPosition + 1  // Increment position
);
```

### Thread Relationships

To establish parent-child relationships between threads:

```typescript
// Imports at top of file
import { createThreadInfo } from '../../server/memory/services/helpers/metadata-helpers';

// Usage in code
const childThreadInfo = createThreadInfo(
  `thread_${Date.now()}`,
  0,
  parentThreadId       // Reference parent thread
);
```

## Best Practices

1. **Validate User Input**: Never directly pass user input to metadata creation functions without validation.

2. **Consistent Identifiers**: Maintain consistent entity identifiers across related operations.

3. **Importance Levels**: Use the ImportanceLevel enum for consistent importance labeling:
   ```typescript
   // Imports at top of file
   import { ImportanceLevel } from '../../constants/memory';
   
   // Usage in code
   metadata.importance = ImportanceLevel.HIGH;
   ```

4. **Tagged Memory**: Use tags for efficient categorization and filtering:
   ```typescript
   metadata.tags = ['important', 'followup', 'user-feedback'];
   ```

5. **Contextual Relationships**: Use the contextId, relatedTo, influences, and influencedBy fields to establish relationships between memory items.

6. **Error Handling**: Always handle errors from metadata operations, especially during creation and validation.

## Common Patterns

### Agent Internal Message Storage

```typescript
// Imports at top of file
import { storeInternalMessageToMemory } from '../../lib/memory/storeInternalMessageToMemory';
import { MessageType } from '../../constants/message';
import { ImportanceLevel } from '../../constants/memory';

// Usage in code
// Store an internal thought
await storeInternalMessageToMemory(
  'I should check the user's history before responding',
  MessageType.THOUGHT,
  memoryService,
  {
    agentId: this.agentId,
    importance: ImportanceLevel.MEDIUM
  }
);
```

### Message Thread Creation

```typescript
// Imports at top of file
import { createThreadInfo } from '../../server/memory/services/helpers/metadata-helpers';
import { 
  addMessageMemory
} from '../../server/memory/services/memory/memory-service-wrappers';
import { MessageRole } from '../../agents/chloe/types/state';

// Usage in code
// Create a new thread for a user message
const userThreadInfo = createThreadInfo(`thread_${Date.now()}`, 0);

// Store the user message
await addMessageMemory(
  memoryService,
  userMessage,
  MessageRole.USER,
  userId,
  agentId,
  chatId,
  userThreadInfo
);

// Create a reply in the same thread
const assistantThreadInfo = createThreadInfo(userThreadInfo.id, 1);

// Store the assistant's reply
await addMessageMemory(
  memoryService,
  assistantMessage,
  MessageRole.ASSISTANT,
  userId,
  agentId,
  chatId,
  assistantThreadInfo
);
```

### Multi-Agent Communication

```typescript
// Imports at top of file
import { sendAgentToAgentMessage } from '../../server/memory/services/memory/memory-service-wrappers';

// Usage in code
// Send a message from one agent to another
await sendAgentToAgentMessage(
  memoryService,
  'Can you help me with this task?',
  senderAgentId,
  receiverAgentId,
  chatId,
  {
    priority: 'high',
    requiresResponse: true,
    conversationContext: {
      taskId: 'task-123',
      purpose: 'Task delegation',
      sharedContext: { key: 'value' }
    }
  }
);
```

## Migration Reference

### Legacy Pattern vs New Pattern

**Legacy Pattern (Do Not Use):**
```typescript
await memoryService.addMemory({
  type: 'message',
  content: message,
  metadata: {
    userId: 'john',
    role: 'user',
    notForChat: false,
    // Inconsistent naming and structure
  }
});
```

**New Pattern (Use This):**
```typescript
// Imports at top of file
import { addMessageMemory } from '../../server/memory/services/memory/memory-service-wrappers';
import { MessageRole } from '../../agents/chloe/types/state';
import { 
  createUserId, 
  createAgentId, 
  createChatId 
} from '../../types/structured-id';
import { createThreadInfo } from '../../server/memory/services/helpers/metadata-helpers';

// Usage in code
await addMessageMemory(
  memoryService,
  message,
  MessageRole.USER,
  createUserId('john'),
  createAgentId('assistant'),
  createChatId('general'),
  createThreadInfo('thread-123', 0)
);
```

## Further Resources

- [Metadata Types Reference](src/types/metadata.ts)
- [Structured ID System](src/types/structured-id.ts)
- [Memory Service Wrappers](src/server/memory/services/memory/memory-service-wrappers.ts)
- [Metadata Helpers](src/server/memory/services/helpers/metadata-helpers.ts) 