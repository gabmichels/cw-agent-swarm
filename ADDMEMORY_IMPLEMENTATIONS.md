# `addMemory` Implementations in the Codebase

This document provides a comprehensive overview of the `addMemory` implementations throughout the codebase, their purposes, parameters, and how they integrate with the metadata system.

## Core Memory Service Implementation

### 1. Memory Service Base Implementation

**Location**: `src/server/memory/services/memory/memory-service.ts`

```typescript
async addMemory<T extends BaseMemorySchema>(params: AddMemoryParams<T>): Promise<MemoryResult> {
  // Validate parameters
  const validation = validateAddMemoryParams(params);
  if (!validation.valid) {
    throw new MemoryError(...);
  }
  
  // Add memory to storage and return result
  // ...implementation details
}
```

This is the foundational implementation that all other `addMemory` functions ultimately call. It's responsible for validating parameters and storing memory in the underlying storage system.

## Wrapper Functions

### 2. Memory Service Wrappers 

**Location**: `src/server/memory/services/memory/memory-service-wrappers.ts`

These functions provide strongly-typed ways to add different types of memories with proper metadata:

#### 2.1 `addMessageMemory`

```typescript
export async function addMessageMemory(
  memoryService: MemoryService,
  content: string,
  role: MessageRole,
  userId: StructuredId,
  agentId: StructuredId,
  chatId: StructuredId,
  threadInfo: ThreadInfo,
  options: {
    messageType?: string;
    attachments?: Array<{ ... }>;
    importance?: ImportanceLevel;
    metadata?: Partial<MessageMetadata>;
  } = {}
): Promise<MemoryResult>
```

Adds message-type memories with appropriate metadata structure.

#### 2.2 `addCognitiveProcessMemory`

```typescript
export async function addCognitiveProcessMemory(
  memoryService: MemoryService,
  content: string,
  processType: CognitiveProcessType,
  agentId: StructuredId,
  options: {
    contextId?: string;
    relatedTo?: string[];
    influences?: string[];
    influencedBy?: string[];
    importance?: ImportanceLevel;
    metadata?: Partial<CognitiveProcessMetadata>;
  } = {}
): Promise<MemoryResult>
```

Stores cognitive processes (thoughts, reflections, insights, etc.) with appropriate metadata.

#### 2.3 `addDocumentMemory`

```typescript
export async function addDocumentMemory(
  memoryService: MemoryService,
  content: string,
  source: DocumentSource,
  options: {
    title?: string;
    contentType?: string;
    fileType?: string;
    // ...more options
    importance?: ImportanceLevel;
    metadata?: Partial<DocumentMetadata>;
  } = {}
): Promise<MemoryResult>
```

Adds document-type memories with proper metadata.

#### 2.4 `addTaskMemory`

```typescript
export async function addTaskMemory(
  memoryService: MemoryService,
  content: string,
  title: string,
  status: TaskStatus,
  priority: TaskPriority,
  createdBy: StructuredId,
  options: {
    description?: string;
    assignedTo?: StructuredId;
    // ...more options
    importance?: ImportanceLevel;
    metadata?: Partial<TaskMetadata>;
  } = {}
): Promise<MemoryResult>
```

Adds task-type memories with appropriate metadata.

## Agent-Specific Implementations

### 3. ChloeMemory Implementation

**Location**: `src/agents/chloe/memory.ts`

```typescript
async addMemory(
  content: string,
  type: MemoryType,
  importance: ImportanceLevel = ImportanceLevel.MEDIUM,
  source: MemorySource = MemorySource.AGENT,
  category: string = '',
  tags: string[] = [],
  metadata: Record<string, any> = {}
): Promise<MemoryEntry | null>
```

This implementation:
- Handles deduplication of messages by checking for similar content
- Creates structured IDs for users, agents, and chats
- Creates appropriate standardized metadata based on memory type
- Uses the memory service to store the memory
- Returns a standardized `MemoryEntry` object

### 4. MemoryManager Implementation

**Location**: `src/agents/chloe/core/memoryManager.ts`

```typescript
async addMemory(
  content: string,
  category: string,
  importance: ImportanceLevel = ImportanceLevel.MEDIUM,
  source: MemorySource = MemorySource.SYSTEM,
  context?: string,
  tags?: string[],
  metadata?: Record<string, any>
): Promise<any>
```

This implementation:
- Maps the category string to a valid `StandardMemoryType`
- Prepares combined metadata from the parameters
- Delegates to the `ChloeMemory.addMemory` method

## Specialized Memory Functions

### 5. Internal Message Storage

**Location**: `src/lib/memory/storeInternalMessageToMemory.ts`

```typescript
export async function storeInternalMessageToMemory(
  message: string,
  type: MessageType.THOUGHT | MessageType.REFLECTION | MessageType.SYSTEM | MessageType.TOOL_LOG | MessageType.MEMORY_LOG,
  memoryService: any,
  metadata: {
    originTaskId?: string,
    toolUsed?: string,
    importance?: ImportanceLevel,
    agentId?: string | StructuredId,
    userId?: string | StructuredId,
    chatId?: string | StructuredId,
    threadId?: string,
    [key: string]: any
  } = {}
)
```

This function:
- Ensures proper routing of internal messages 
- Maps message types to appropriate memory types
- Uses appropriate wrapper functions based on message type
- Handles structured IDs
- Adds appropriate tags and metadata

### 6. Planning Manager Implementation 

**Location**: `src/agents/chloe/core/planningManager.ts`

The planning manager uses `addMemory` to store:
1. Task plans
2. Execution results
3. Daily tasks execution results

Each use includes appropriate metadata with the `TaskStatus` enum from the metadata types module, ensuring consistency with the metadata system.

### 7. Knowledge Gaps Manager Implementation

**Location**: `src/agents/chloe/core/knowledgeGapsManager.ts`

Uses `addMemory` to store:
1. Knowledge gap analysis results
2. Specific knowledge gaps that need to be addressed

Proper metadata is created using the document metadata helper functions.

### 8. Market Scanner Implementation

**Location**: `src/agents/chloe/tools/marketScanner.ts`

```typescript
private async saveSignalToMemory(signal: MarketSignal, summary: string) {
  try {
    const { memoryService } = await getMemoryServices();
    
    // Format content for storage
    const content = `
Market Signal: ${signal.title}
Category: ${signal.category}
Theme: ${signal.theme}
Source: ${signal.source} (${signal.sourceType})
Published: ${signal.published.toISOString()}
URL: ${signal.url}

${summary || signal.content}
    `.trim();
    
    // Add to memory using memory service directly
    await memoryService.addMemory({
      id: `market_signal_${Date.now()}`,
      type: StandardMemoryType.DOCUMENT,
      content: content,
      metadata: {
        type: 'market_signal',
        title: signal.title,
        category: signal.category,
        theme: signal.theme,
        source: signal.source,
        sourceType: signal.sourceType,
        published: signal.published.toISOString(),
        url: signal.url,
        importance: 'medium'
      }
    });
  } catch (error) {
    logger.error('Error saving market signal to memory:', error);
  }
}
```

This implementation:
- Formats market signals with structured content
- Uses direct memory service access rather than going through ChloeMemory
- Provides proper metadata with signal details

### 9. Market Scanner Manager Implementation

**Location**: `src/agents/chloe/core/marketScannerManager.ts`

The Market Scanner Manager uses `addMemory` to store:
1. Market scan results
2. Trend summaries
3. Strategic insights derived from market trends

Example implementation:

```typescript
private async addStrategicInsight(
  insight: string, 
  tags: string[], 
  category: string = 'general'
): Promise<boolean> {
  try {
    // Format content for better readability and context
    const formattedInsight = `${category.toUpperCase()} INSIGHT: ${insight}`;
    
    // Add to memory with appropriate importance level
    await this.memory.addMemory(
      formattedInsight,
      StandardMemoryType.DOCUMENT,
      ImportanceLevel.HIGH,
      MemorySource.SYSTEM,
      `Strategic insight from market trends analysis in category: ${category}`,
      tags,
      {
        type: 'strategic_insight',
        category,
        tags,
        source: 'market_scanner',
        generated: new Date().toISOString()
      }
    );
    
    return true;
  } catch (error) {
    return false;
  }
}
```

### 10. Autonomous Scheduler Implementation

**Location**: `src/agents/chloe/self-initiation/autonomousScheduler.ts`

The Autonomous Scheduler uses `addMemory` for:
1. Recording scheduled tasks in memory
2. Logging autonomous activities

Example implementation:

```typescript
private async recordTaskInMemory(task: ScheduledAutonomousTask): Promise<void> {
  if (!this.memory) return;
  
  const memoryContent = `
Autonomous Task Scheduled:
Title: ${task.title}
Description: ${task.description}
Scheduled Time: ${task.scheduledTime.toISOString()}
Estimated Duration: ${task.estimatedDuration} minutes
Priority: ${task.priority}
Status: ${task.status}
`;

  await this.memory.addMemory(
    memoryContent,
    MemoryType.AUTONOMOUS_TASK,
    ImportanceLevel.MEDIUM,
    MemorySource.SYSTEM,
    `Autonomously scheduled task: ${task.title}`,
    ['scheduled_task', 'autonomous', ...task.tags]
  );
}
```

## Integration Points

### 11. Enhanced Memory Systems

Several enhanced memory systems also use `addMemory`:

- `EnhancedMemory.addMemory`
- `CognitiveMemory.addMemory` 
- `Self-improvement` mechanisms
- `FeedbackLoop` systems

Each implementation ensures proper metadata and memory type based on the system's specific needs.

### 12. React Hooks for Memory

Several React hooks provide `addMemory` functions to components:

- `useMemory.addMemory`
- `useMemoryAddition.addMemory`
- `useToolsMemory.addMemory`
- `useKnowledgeMemory.addMemory`

These hooks ensure proper metadata validation and integration with the memory service.

## Verification

All implementations of `addMemory` have been checked for:

1. ✅ Proper usage of standardized metadata types
2. ✅ Correct factory function usage for creating metadata
3. ✅ Appropriate enum values (e.g., `TaskStatus`, `ImportanceLevel`)
4. ✅ Structured ID creation
5. ✅ Error handling

This completes the comprehensive documentation of `addMemory` implementations throughout the codebase. 