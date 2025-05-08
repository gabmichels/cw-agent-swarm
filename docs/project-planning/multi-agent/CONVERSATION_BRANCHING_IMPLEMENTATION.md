# Conversation Branching Implementation

## Overview

This document outlines the implementation of conversation branching support for the multi-agent system. Conversation branching enables the creation and management of parallel conversation threads, alternative scenarios, and variant explorations within multi-agent conversations.

## Core Concepts

### Branch Types

Branches can be created for different purposes, defined by the `BranchType` enum:

- **Alternative**: Represents an alternative approach or solution
- **Exploration**: Used for exploring a particular idea or concept
- **Hypothetical**: Contains hypothetical scenarios or what-if situations
- **Private**: Private communication between specific participants
- **Specialized**: Focused on a specific topic or capability
- **Parallel**: Run a parallel conversation thread
- **Debugging**: For debugging or troubleshooting
- **Planning**: For planning and coordination
- **Archive**: For archived/completed conversation paths

### Branch Status

Branches have a lifecycle status tracked through the `BranchStatus` enum:

- **Active**: Currently active branch
- **Paused**: Temporarily paused branch
- **Completed**: Branch with completed conversation
- **Merged**: Branch that has been merged into another branch
- **Abandoned**: Branch that was abandoned without completion

### Branch Relationships

Branches can have relationships with other branches:

- **Parent**: Branch from which this branch was created
- **Child**: Branch created from this branch
- **Merged From**: Branch merged from
- **Merged Into**: Branch merged into

### Merge Strategies

When merging branches, different strategies can be applied:

- **Replace**: Replace target with source content
- **Append**: Append source content to target
- **Selective**: Selectively merge specific messages
- **Summarize**: Create a summary of the source branch
- **Interleave**: Interleave messages by timestamp

## Data Model

### ConversationBranch
```typescript
interface ConversationBranch {
  id: string;
  conversationId: string;
  name: string;
  description?: string;
  branchType: BranchType;
  status: BranchStatus;
  parentBranchId?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  participants: string[];  // Participant IDs
  messageCount: number;
  firstMessageId?: string;
  lastMessageId?: string;
  relationships: BranchRelationship[];
  relatedBranches: Array<{
    branchId: string;
    relationship: BranchRelationship;
  }>;
  metadata?: Record<string, unknown>;
}
```

### BranchMessage
```typescript
interface BranchMessage {
  id: string;
  branchId: string;
  conversationId: string;
  senderId: string;
  recipientId?: string;
  content: string | Record<string, unknown>;
  format: string;
  timestamp: number;
  referencedMessageIds?: string[];
  isVisibleToAll: boolean;
  visibleToParticipantIds?: string[];
  metadata?: Record<string, unknown>;
}
```

## Features

### Branch Creation

Create new branches from existing conversations or other branches:

```typescript
const newBranch = await branchingService.createBranch(
  'conversation-123',
  {
    name: 'Alternative Solution',
    description: 'Exploring an alternative approach',
    branchType: BranchType.ALTERNATIVE,
    parentBranchId: 'branch-456',
    initialParticipants: ['agent-1', 'agent-2', 'user-1'],
    initialMessage: {
      senderId: 'agent-1',
      content: 'Let\'s explore an alternative approach',
      format: 'text'
    }
  }
);
```

### Message Management

Add and retrieve messages within branches:

```typescript
// Add a message to a branch
const message = await branchingService.addMessage(
  'branch-123',
  {
    conversationId: 'conversation-456',
    senderId: 'agent-1',
    content: 'This is a message in the branch',
    format: 'text',
    isVisibleToAll: true
  }
);

// Get messages from a branch
const messages = await branchingService.getMessages(
  'branch-123',
  {
    limit: 50,
    offset: 0,
    sortDirection: 'asc'
  }
);
```

### Branch Merging

Merge branches using different strategies:

```typescript
const mergeResult = await branchingService.mergeBranches({
  sourceBranchId: 'branch-123',
  targetBranchId: 'branch-456',
  strategy: MergeStrategy.SELECTIVE,
  messageIds: ['msg-1', 'msg-2', 'msg-3'],
  mergeReason: 'Incorporating key insights'
});

if (mergeResult.success) {
  console.log(`Merged ${mergeResult.mergedMessageIds.length} messages`);
} else {
  console.error('Merge failed:', mergeResult.errors);
}
```

### Branch Comparison

Compare branches to identify commonalities and differences:

```typescript
const comparison = await branchingService.compareBranches(
  'branch-123',
  'branch-456'
);

console.log(`Common messages: ${comparison.commonMessages.length}`);
console.log(`Unique to first branch: ${comparison.uniqueToFirst.length}`);
console.log(`Unique to second branch: ${comparison.uniqueToSecond.length}`);

if (comparison.divergencePoint) {
  console.log(`Branches diverged at message: ${comparison.divergencePoint}`);
}
```

### Finding Common Ancestors

Identify the common ancestor of two branches:

```typescript
const commonAncestor = await branchingService.findCommonAncestor(
  'branch-123',
  'branch-456'
);

if (commonAncestor) {
  console.log(`Common ancestor branch: ${commonAncestor.name}`);
} else {
  console.log('No common ancestor found');
}
```

## Implementation Details

The conversation branching support is implemented as a service:

- Located in `src/server/memory/services/multi-agent/messaging/conversation-branching/`
- Interfaces defined in `branching-interface.ts`
- Implementation in `branching-service.ts`
- Integrated with the messaging factory for system-wide access
- Uses memory service for persistent storage of branches and messages
- Follows the project's architecture guidelines

## Memory Types

The implementation uses two custom memory types:

- `conversation_branch`: Stores branch metadata and relationships
- `branch_message`: Stores messages within branches

## Practical Use Cases

### Scenario Exploration

Create alternative branches to explore different approaches to a problem:

1. Start with a main conversation
2. Create branches for each alternative approach
3. Develop each approach in its branch
4. Compare the branches to evaluate solutions
5. Merge the best solution back to the main branch

### Private Discussions

Create private branches for discussions between specific participants:

1. Start with a main conversation with all participants
2. Create a private branch with a subset of participants
3. Discuss sensitive topics in the private branch
4. Summarize the discussion and merge back to the main branch

### Parallel Workflows

Run parallel workflows within a conversation:

1. Start with a main planning conversation
2. Create specialized branches for different tasks
3. Work on tasks in parallel in separate branches
4. Merge completed tasks back to the main branch
5. Track overall progress in the main branch

## Best Practices

1. **Clear Naming**: Use descriptive names and descriptions for branches
2. **Purpose-Driven Branching**: Select appropriate branch types for the intended purpose
3. **Participant Management**: Include relevant participants in specialized branches
4. **Selective Merging**: Use selective merge strategy to avoid noise in the target branch
5. **Branch Cleanup**: Mark completed branches as COMPLETED or MERGED
6. **Context Preservation**: Include sufficient context when creating a branch
7. **Metadata Utilization**: Use metadata to store additional branch information 