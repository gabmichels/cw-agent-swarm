# Memory Operations

This document outlines the current memory operations and their interfaces.

## Core Operations

### Initialization

```typescript
// Initialize the memory system
async function initMemory(options?: {
  qdrantUrl?: string;
  qdrantApiKey?: string;
  useOpenAI?: boolean;
  forceReinit?: boolean;
  connectionTimeout?: number;
}): Promise<void>

// Check if memory system is initialized
function isInitialized(): boolean
```

### Adding Memories

```typescript
// Add a basic memory
async function addMemory(
  type: QdrantMemoryType,
  content: string,
  metadata: Record<string, any> = {}
): Promise<string>

// Store a memory with importance calculation
async function storeMemory(
  content: string, 
  type: string, 
  source: string, 
  metadata: Record<string, any> = {},
  options: {
    importance?: ImportanceLevel;
    importance_score?: number;
    existingEmbedding?: number[];
    tags?: Array<string | Tag>;
    tagConfidence?: number;
    editor_type?: 'human' | 'agent' | 'system';
    editor_id?: string;
  } = {}
): Promise<string>
```

### Retrieving Memories

```typescript
// Search memories with vector similarity
async function searchMemory(
  type: QdrantMemoryType | null,
  query: string,
  options: MemorySearchOptions = {}
): Promise<MemoryRecord[]>

// Get a memory by ID
async function getMemoryById(memoryId: string): Promise<MemoryRecord | null>

// Get recent memories of a type
async function getRecentMemories(
  type: QdrantMemoryType,
  limit: number = 10
): Promise<MemoryRecord[]>

// Get all memories of a type
async function getAllMemories(
  type: QdrantMemoryType | null, 
  limit: number = 100
): Promise<MemoryRecord[]>

// Get memories by importance level
async function getMemoriesByImportance(
  importance: ImportanceLevel, 
  limit: number = 200
): Promise<MemoryRecord[]>

// Get recent chat messages
async function getRecentChatMessages(options: {
  userId?: string;
  limit?: number;
  since?: Date;
  until?: Date;
  roles?: string[];
}): Promise<Message[]>
```

### Updating Memories

```typescript
// Update memory metadata
async function updateMemoryMetadata(
  memoryId: string,
  metadata: Record<string, any>
): Promise<boolean>

// Update memory content and metadata
async function updateMemory(
  id: string,
  updates: {
    content?: string;
    type?: string;
    source?: string;
    metadata?: Record<string, any>;
    importance?: ImportanceLevel;
    importance_score?: number;
    editor_type?: 'human' | 'agent' | 'system';
    editor_id?: string;
  }
): Promise<boolean>

// Update memory tags
async function updateMemoryTags(
  memoryId: string,
  tags: string[],
  approved: boolean = false
): Promise<boolean>
```

### Deleting Memories

```typescript
// Delete a memory (soft or hard)
async function deleteMemory(
  type: QdrantMemoryType,
  id: string,
  options: {
    hardDelete?: boolean;
    editor_type?: 'human' | 'agent' | 'system';
    editor_id?: string;
  } = {}
): Promise<boolean>

// Reset a collection
async function resetCollection(
  type: QdrantMemoryType
): Promise<boolean>

// Reset all collections
async function resetAllCollections(): Promise<boolean>

// Clear memories by source
async function clearMemoriesBySource(
  source: string
): Promise<{ success: boolean; count: number }>
```

### Memory Management

```typescript
// Track memory usage
async function trackMemoryUsage(memoryId: string): Promise<boolean>

// Increase memory importance
async function reinforceMemory(
  memoryId: string,
  reinforcementReason: string = ''
): Promise<boolean>

// Reduce importance of unused memories
async function decayMemoryImportance(options: {
  decayPercent?: number;
  olderThan?: number;
  maxMemories?: number;
  dryRun?: boolean;
  memoryTypes?: QdrantMemoryType[];
} = {}): Promise<{
  processed: number;
  decayed: number;
  exempted: number;
  errors: number;
  dryRun: boolean;
}>

// Mark memory as critical (exempt from decay)
async function markMemoryAsCritical(
  memoryId: string, 
  isCritical: boolean = true
): Promise<boolean>
```

### Causal Relationships

```typescript
// Link two memories causally
async function establishCausalLink(
  causeId: string,
  effectId: string,
  description: string = ''
): Promise<boolean>

// Get causal chain for a memory
async function traceCausalChain(
  memoryId: string,
  options: {
    maxDepth?: number;
    includeContent?: boolean;
    direction?: 'forward' | 'backward' | 'both';
  } = {}
): Promise<{
  origin: MemoryRecord | null;
  causes: Array<{
    memory: MemoryRecord;
    relationship: {
      description: string;
      timestamp: string;
    };
    depth: number;
  }>;
  effects: Array<{
    memory: MemoryRecord;
    relationship: {
      description: string;
      timestamp: string;
    };
    depth: number;
  }>;
}>

// Get directly related memories
async function getCausallyRelatedMemories(
  memoryId: string
): Promise<Array<{
  memory: MemoryRecord;
  relationship: 'cause' | 'effect';
  description: string;
}>>

// Add reflection about causal relationship
async function addCausalReflection(
  causeId: string,
  effectId: string,
  reflection: string
): Promise<string>
```

### Version History

```typescript
// Get edit history for a memory
async function getMemoryHistory(
  memoryId: string,
  options: {
    includeContent?: boolean;
    limit?: number;
    includeSoftDeleted?: boolean;
  } = {}
): Promise<MemoryEditRecord[]>
```

## Utility Functions

```typescript
// Get embeddings for text
async function getEmbedding(text: string): Promise<{ embedding: number[] }>

// Get total message count
async function getMessageCount(): Promise<number>

// Diagnose database health
async function diagnoseDatabaseHealth(): Promise<{ 
  status: string;
  messageCount: number;
  recentMessages: Array<{id: string, type: string, text: string}>
}>

// Summarize chat history
async function summarizeChat(options: {
  userId?: string;
  limit?: number;
  since?: Date;
  until?: Date;
}): Promise<string>
```

## Major Issues with Current Operations

1. **Inconsistent Parameter Patterns**: Different operations use different parameter structures (positional vs. options objects)
2. **Inconsistent Return Types**: Some operations return the created ID, others return a boolean success indicator
3. **Mixed Concerns**: Operations often handle multiple concerns (e.g., embedding generation + database storage)
4. **Redundant Functions**: Several functions perform similar operations with slightly different interfaces
5. **Lack of Validation**: No input validation or schema enforcement
6. **Poor Error Handling**: Inconsistent error handling and reporting
7. **Unclear API Surface**: No clear distinction between public API and internal implementation 