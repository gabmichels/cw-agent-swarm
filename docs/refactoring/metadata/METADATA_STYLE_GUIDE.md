# Metadata Style Guide

## Overview

This document provides guidelines, best practices, and patterns for working with the standardized metadata system. Following these conventions ensures consistency across the codebase and helps maintain a reliable and type-safe memory architecture.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Structured Identifiers](#entity-identifierentifiers)
3. [Metadata Creation](#metadata-creation)
4. [Thread Handling](#thread-handling)
5. [Cognitive Process Metadata](#cognitive-process-metadata)
6. [Memory Service Integration](#memory-service-integration)
7. [Common Patterns and Examples](#common-patterns-and-examples)
8. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

## Core Principles

1. **Strong Typing**: Always use strongly-typed interfaces without resorting to `any` or `Record<string, any>`.
2. **Factory Functions**: Use the centralized factory functions for creating all metadata.
3. **Structured Identifiers**: Use structured IDs for all entity references.
4. **Thread Consistency**: Maintain thread relationships with the ThreadInfo object.
5. **Validation**: Validate metadata before storage to ensure consistency.
6. **Type Safety**: Leverage TypeScript's type system to catch errors at compile time.
7. **Enum Reuse**: Import and reuse existing enums rather than creating duplicates.

## Structured Identifiers

### Structured ID Format

Every entity reference must use the StructuredId format:

```typescript
interface StructuredId {
  namespace: string;     // Organization or system namespace
  type: string;          // Entity type (user, agent, chat, etc.)
  id: string;            // Unique identifier 
  version?: number;      // Optional version
}
```

### Helper Functions

Always use the helper functions to create structured identifiers:

```typescript
// CORRECT
import { createUserId, createAgentId, createChatId } from '../../types/entity-identifier';

const userId = createUserId('user123');
const agentId = createAgentId('assistant');
const chatId = createChatId('chat456');

// INCORRECT - Don't create structured IDs manually
const badUserId = { 
  namespace: 'org', 
  type: 'user', 
  id: 'user123' 
}; // Missing standard namespace
```

### Parsing Structured IDs

When you receive a structured ID as a string, parse it properly:

```typescript
import { parseStructuredId } from '../../types/entity-identifier';

// Parse from string format
const structuredId = parseStructuredId('user:user:123');
```

## Metadata Creation

### Using Factory Functions

Always use factory functions from `metadata-helpers.ts` to create metadata:

```typescript
// CORRECT
import { 
  createMessageMetadata, 
  createThreadInfo 
} from '../../server/memory/services/helpers/metadata-helpers';
import { createUserId, createAgentId, createChatId } from '../../types/entity-identifier';

const userId = createUserId('user123');
const agentId = createAgentId('assistant');
const chatId = createChatId('chat456');
const threadInfo = createThreadInfo('thread789', 0);

const metadata = createMessageMetadata(
  'user',
  userId,
  agentId,
  chatId,
  threadInfo,
  {
    messageType: 'standard',
    importance: ImportanceLevel.MEDIUM
  }
);

// INCORRECT - Don't create metadata objects directly
const badMetadata = {
  role: 'user',
  userId: 'user123', // Not a structured ID
  agentId: 'assistant', // Not a structured ID
  importance: 'medium' // Not using ImportanceLevel enum
};
```

### Required Fields

Ensure all required fields are provided:

- For `MessageMetadata`: role, userId, agentId, chatId, thread
- For `CognitiveProcessMetadata`: processType, agentId
- For `TaskMetadata`: title, status, priority, agentId
- For `DocumentMetadata`: source, agentId

### Schema Version

Always include the schema version in metadata:

```typescript
const metadata = createMessageMetadata(
  'user',
  userId,
  agentId,
  chatId,
  threadInfo,
  {
    schemaVersion: '1.0.0',
    // other fields...
  }
);
```

## Thread Handling

### Creating Thread Info

Thread information is required for all message metadata:

```typescript
import { createThreadInfo } from '../../server/memory/services/helpers/metadata-helpers';

// For a new thread
const threadInfo = createThreadInfo(
  `thread_${Date.now()}`, // Generate a unique ID
  0 // Position 0 for first message
);

// For a reply in an existing thread
const replyThreadInfo = createThreadInfo(
  existingThreadId,
  existingThreadPosition + 1,
  parentMessageId // Optional reference to parent message
);
```

### Thread Relationships

Use the thread ID to query related messages:

```typescript
// Find all messages in a thread
const messagesInThread = await searchMessages(memoryService, {
  threadId: 'thread123'
});

// Find messages that respond to a specific message
const responses = await searchMessages(memoryService, {
  threadId: 'thread123',
  // In a real implementation, you'd need more specific filtering
});
```

## Cognitive Process Metadata

### Using Process-Specific Types

Use the specific cognitive process types for better type safety:

```typescript
// CORRECT
import { 
  createThoughtMetadata,
  createReflectionMetadata,
  createInsightMetadata
} from '../../server/memory/services/helpers/metadata-helpers';
import { createAgentId } from '../../types/entity-identifier';
import { CognitiveProcessType } from '../../types/metadata';

const agentId = createAgentId('assistant');

// For a thought
const thoughtMetadata = createThoughtMetadata(
  agentId,
  {
    contextId: 'task123',
    intention: 'Problem analysis'
  }
);

// For a reflection
const reflectionMetadata = createReflectionMetadata(
  agentId,
  {
    reflectionType: 'performance',
    timeScope: 'short-term'
  }
);

// INCORRECT - Using generic cognitive process type
const genericMetadata = {
  processType: 'thought',
  agentId: 'assistant', // Not a structured ID
  // Missing schemaVersion
};
```

### Memory Service Wrapper

Use the addCognitiveProcessMemory wrapper:

```typescript
import { addCognitiveProcessMemory } from '../../server/memory/services/memory/memory-service-wrappers';
import { CognitiveProcessType } from '../../types/metadata';
import { createAgentId } from '../../types/entity-identifier';

const agentId = createAgentId('assistant');

await addCognitiveProcessMemory(
  memoryService,
  'I should check if the user has provided all necessary information.',
  CognitiveProcessType.THOUGHT,
  agentId,
  {
    contextId: 'conversation123',
    importance: ImportanceLevel.MEDIUM
  }
);
```

## Memory Service Integration

### Using Service Wrappers

Always use the memory service wrapper functions instead of calling the memory service directly:

```typescript
// CORRECT
import { 
  addMessageMemory,
  addCognitiveProcessMemory,
  addDocumentMemory,
  addTaskMemory
} from '../../server/memory/services/memory/memory-service-wrappers';

// Add a message
await addMessageMemory(
  memoryService,
  'Hello, how can I help you?',
  'assistant',
  userId,
  agentId,
  chatId,
  threadInfo
);

// INCORRECT - Direct memory service call without validation
await memoryService.addMemory({
  type: MemoryType.MESSAGE,
  content: 'Hello, how can I help you?',
  metadata: {
    role: 'assistant',
    userId: 'user123', // Not a structured ID
    // Missing required fields
  }
});
```

### Search Operations

Use type-safe search functions:

```typescript
import { 
  searchMessages,
  searchCognitiveProcesses
} from '../../server/memory/services/memory/memory-service-wrappers';

// Search for messages
const messages = await searchMessages(memoryService, {
  userId: userId,
  chatId: chatId
});

// Search for cognitive processes
const thoughts = await searchCognitiveProcesses(memoryService, {
  agentId: agentId,
  processType: CognitiveProcessType.THOUGHT
});
```

## Common Patterns and Examples

### Handling User Messages

```typescript
import { 
  addMessageMemory 
} from '../../server/memory/services/memory/memory-service-wrappers';
import { 
  createMessageMetadata, 
  createThreadInfo 
} from '../../server/memory/services/helpers/metadata-helpers';
import { 
  createUserId, 
  createAgentId, 
  createChatId 
} from '../../types/entity-identifier';
import { MessageRole } from '../../agents/chloe/types/state';

// Create structured IDs
const userId = createUserId(userIdString);
const agentId = createAgentId('assistant');
const chatId = createChatId(chatIdString);

// Create thread info
const threadInfo = createThreadInfo(`thread_${Date.now()}`, 0);

// Add user message to memory
await addMessageMemory(
  memoryService,
  userMessage,
  MessageRole.USER,
  userId,
  agentId,
  chatId,
  threadInfo,
  {
    attachments: messageAttachments
  }
);

// Add agent response to the same thread
const responseThreadInfo = createThreadInfo(
  threadInfo.id,
  threadInfo.position + 1,
  // no parentId needed as it's a direct response
);

await addMessageMemory(
  memoryService,
  agentResponse,
  MessageRole.ASSISTANT,
  userId,
  agentId,
  chatId,
  responseThreadInfo
);
```

### Internal Agent Thoughts

```typescript
import { 
  addCognitiveProcessMemory 
} from '../../server/memory/services/memory/memory-service-wrappers';
import { createAgentId } from '../../types/entity-identifier';
import { CognitiveProcessType } from '../../types/metadata';
import { ImportanceLevel } from '../../constants/memory';

const agentId = createAgentId('agent123');

// Add a thought
await addCognitiveProcessMemory(
  memoryService,
  'This question requires domain knowledge about machine learning.',
  CognitiveProcessType.THOUGHT,
  agentId,
  {
    contextId: 'conversation456',
    importance: ImportanceLevel.MEDIUM,
    metadata: {
      category: 'analysis',
      tags: ['machine-learning', 'context-analysis']
    }
  }
);
```

### Document Storage

```typescript
import { 
  addDocumentMemory 
} from '../../server/memory/services/memory/memory-service-wrappers';
import { createAgentId } from '../../types/entity-identifier';
import { DocumentSource } from '../../types/metadata';

const agentId = createAgentId('agent123');

// Store a document
await addDocumentMemory(
  memoryService,
  documentContent,
  DocumentSource.USER_UPLOAD,
  {
    title: 'Project Requirements',
    contentType: 'text/markdown',
    agentId: agentId,
    url: 'https://example.com/doc'
  }
);
```

## Anti-Patterns to Avoid

1. **Avoiding Factory Functions**

   ```typescript
   // INCORRECT
   const metadata = {
     role: 'user',
     userId: 'user123',
     // Missing required fields, not using structured IDs
   };
   ```

2. **Manual Schema Creation**

   ```typescript
   // INCORRECT
   const schema = {
     type: MemoryType.MESSAGE,
     content: messageText,
     metadata: {
       // Directly creating metadata object without validation
     }
   };
   ```

3. **Using String IDs Instead of Structured IDs**

   ```typescript
   // INCORRECT
   const metadata = createMessageMetadata(
     'user',
     'user123', // Should be a structured ID
     'agent456', // Should be a structured ID
     'chat789', // Should be a structured ID
     threadInfo
   );
   ```

4. **Skipping ThreadInfo**

   ```typescript
   // INCORRECT
   const metadata = {
     role: 'user',
     userId: createUserId('user123'),
     agentId: createAgentId('agent456'),
     chatId: createChatId('chat789'),
     // Missing thread information
   };
   ```

5. **Using any Types**

   ```typescript
   // INCORRECT
   function processMetadata(metadata: any) {
     // Working with untyped data
   }
   ```

6. **Direct Memory Service Calls**

   ```typescript
   // INCORRECT
   await memoryService.addMemory({
     type: MemoryType.MESSAGE,
     content: messageText,
     metadata: {
       // Bypassing validation and wrapper functions
     }
   });
   ```

7. **Creating Duplicate Enum Definitions**

   ```typescript
   // INCORRECT
   // Defining enums that already exist elsewhere
   enum Importance {
     LOW = 'low',
     MEDIUM = 'medium',
     HIGH = 'high'
   }
   
   // Should import existing enums
   import { ImportanceLevel } from '../../constants/memory';
   ```

8. **Ignoring Schema Versions**

   ```typescript
   // INCORRECT
   const metadata = createMessageMetadata(
     'user',
     userId,
     agentId,
     chatId,
     threadInfo
     // Missing schemaVersion
   );
   ```

By following these guidelines and patterns, we ensure consistent, type-safe, and maintainable metadata handling across the entire codebase. 