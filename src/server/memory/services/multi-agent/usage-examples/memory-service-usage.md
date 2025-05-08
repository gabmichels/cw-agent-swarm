# Memory Service Usage Patterns

This document provides examples of how to properly use the memory service wrappers with EnhancedMemoryService.

## Known Issues

When migrating code to use the memory service wrappers, you might encounter the following issues:

1. **ImportanceLevel Type Conflicts**: There are multiple `ImportanceLevel` definitions in the codebase that can cause type conflicts:
   - `src/server/memory/config/types.ts` defines `ImportanceLevel` as a string enum
   - `src/constants/memory.ts` defines `MemoryImportanceLevel` (aliased as `ImportanceLevel`) with different values
   - Method signatures in various files might expect different enum types

2. **Solution Options**:
   - Use string literals ('low', 'medium', 'high', 'critical') instead of enum values when possible
   - Cast the value to the expected type, e.g., `importance: 'medium' as ImportanceLevel`
   - Omit the importance parameter if not critical for your use case

## Correct Usage Examples

### Adding a Message

```typescript
import { addMessageMemory } from '../../memory/services/memory/memory-service-wrappers';
import { createUserId, createAgentId, createChatId } from '../../../types/structured-id';

// Create structured IDs
const userStructuredId = createUserId('user-123');
const agentStructuredId = createAgentId('agent-456');
const chatStructuredId = createChatId('chat-789');

// Get thread info
const { getOrCreateThreadInfo } = await import('../../../app/api/chat/thread/helper');
const threadInfo = getOrCreateThreadInfo(chatId, 'user');

// Add message using the wrapper
await addMessageMemory(
  memoryService,
  'Message content',
  'user', // MessageRole.USER if using the enum
  userStructuredId,
  agentStructuredId,
  chatStructuredId,
  threadInfo,
  {
    messageType: 'chat',
    // Option 1: Use string literal
    // importance: 'medium',
    // Option 2: Omit importance completely
    metadata: {
      timestamp: new Date().toISOString(),
      // Additional metadata
    }
  }
);
```

### Searching Messages

```typescript
import { searchMessages } from '../../memory/services/memory/memory-service-wrappers';

// Search for messages
const messages = await searchMessages(
  memoryService,
  {
    userId: 'user-123',
    chatId: 'chat-789',
    // Omit importance to avoid type conflicts
  },
  {
    limit: 10,
    query: 'search term'
  }
);
```

### Agent-to-Agent Communication

```typescript
import { sendAgentToAgentMessage } from '../../memory/services/memory/memory-service-wrappers';
import { createAgentId, createChatId } from '../../../types/structured-id';

// Create structured IDs
const senderAgentId = createAgentId('agent-123');
const receiverAgentId = createAgentId('agent-456');
const chatStructuredId = createChatId('chat-789');

// Send message
await sendAgentToAgentMessage(
  memoryService,
  'Message from one agent to another',
  senderAgentId,
  receiverAgentId,
  chatStructuredId,
  {
    communicationType: 'request',
    priority: 'high',
    requiresResponse: true
  }
);
```

## Performance Benefits

Using `EnhancedMemoryService` with these wrapper functions provides several performance benefits:

1. **Top-level field optimization**: Fields like `userId`, `agentId`, and `chatId` are directly queryable
2. **Reduced query complexity**: No need to traverse nested metadata structures
3. **Improved filtering**: More efficient filter operations especially for common fields
4. **Type safety**: Ensures metadata is created with all required fields

## Best Practices

1. Always use the wrapper functions rather than direct `addMemory` calls
2. Import structured ID creation utilities to create proper IDs
3. Use the query optimization capabilities by filtering on top-level fields when using EnhancedMemoryService
4. Handle ImportanceLevel carefully to avoid type conflicts
5. Check the return type of factory functions to ensure proper typing 