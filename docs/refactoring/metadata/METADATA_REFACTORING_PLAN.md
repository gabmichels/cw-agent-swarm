# Memory Metadata Refactoring Plan (Revised)

## Current Issues

Based on the analysis of the memory metadata handling in the codebase and user feedback, the following issues have been identified:

1. **Inconsistent metadata structures**: Multiple metadata interfaces and implementations across different parts of the codebase with varying field names and structures. ✅
2. **Type safety issues**: Frequent use of `Record<string, any>` or `any` typing for metadata, leading to potential runtime errors. ✅
3. **Duplicated metadata definitions**: Similar metadata properties defined in multiple places without a central source of truth. ✅
4. **Inconsistent field naming**: The same conceptual properties use different field names across the codebase. ✅
5. **Missing validation**: No centralized validation for metadata fields, allowing inconsistent data to be stored. ✅
6. **Redundant message flags**: `NOT_FOR_CHAT` and `IS_INTERNAL_MESSAGE` flags create confusion when type could be used instead. ✅
7. **Thread tracking inconsistency**: Using both `inResponseTo` and `isPartOfThread` without clear delineation of when to use which. ✅
8. **Lack of multi-agent support**: Missing standardized way to associate messages with specific agents. ✅
9. **Flawed vision response tracking**: Using timestamps for vision response tracking is unreliable. ✅
10. **Enum duplication**: Multiple definitions of the same enums (e.g., `ImportanceLevel`, `MessageRole`) across the codebase, causing confusion about which to use. ✅

## Goals

1. Establish a consistent, type-safe metadata system throughout the codebase ✅
2. Centralize metadata type definitions ✅
3. Create a validation layer for metadata ✅
4. Replace existing metadata with new structures (no backward compatibility) ✅
5. Better support multi-agent scenarios ✅
6. Consolidate thread handling ✅
7. Simplify message typing ✅
8. Standardize cognitive process metadata (thoughts, reflections, insights) ✅
9. Reuse existing enum definitions rather than creating duplicates to ensure a single source of truth for constants ✅

## Implementation Plan

### Phase 1: Metadata Type Definition ✅

#### 1.1 Create Base Metadata Types ✅

A central location for all metadata types has been created in `src/types/metadata.ts`:

```typescript
/**
 * Base metadata interface that all specific metadata types extend
 */
export interface BaseMetadata {
  // Common fields across all metadata types
  importance?: ImportanceLevel;
  importance_score?: number;
  tags?: string[];
  
  // Soft deletion fields (if not already at the top level)
  is_deleted?: boolean;
  deletion_time?: string;
}

/**
 * Enum for standardized metadata field names
 * Use this to ensure consistent field access across the codebase
 */
export enum MetadataField {
  // Common fields
  IMPORTANCE = 'importance',
  IMPORTANCE_SCORE = 'importance_score',
  TAGS = 'tags',
  IS_DELETED = 'is_deleted',
  DELETION_TIME = 'deletion_time',
  
  // Message-specific fields
  ROLE = 'role',
  USER_ID = 'userId',
  AGENT_ID = 'agentId',
  CHAT_ID = 'chatId',
  MESSAGE_TYPE = 'messageType',
  SOURCE = 'source',
  CATEGORY = 'category',
  ATTACHMENTS = 'attachments',
  
  // Thread fields
  THREAD = 'thread',
}
```

#### 1.2 Create Thread Info Type ✅

```typescript
/**
 * Thread information interface
 * Every user-agent interaction forms a thread
 */
export interface ThreadInfo {
  id: string;         // Unique thread identifier
  position: number;   // Position in thread (0-based)
  parentId?: string;  // Optional reference to parent message
}
```

#### 1.3 Create Message-Specific Metadata Types ✅

```typescript
/**
 * Message metadata interface with strong typing
 */
export interface MessageMetadata extends BaseMetadata {
  // Core message fields
  [MetadataField.ROLE]: 'user' | 'assistant' | 'system';
  [MetadataField.USER_ID]: string;
  [MetadataField.AGENT_ID]: string;
  [MetadataField.CHAT_ID]: string;
  [MetadataField.MESSAGE_TYPE]?: string;
  
  // Thread information (required, not optional)
  [MetadataField.THREAD]: ThreadInfo;
  
  // Attachments
  [MetadataField.ATTACHMENTS]?: Array<{
    type: string;
    url?: string;
    data?: string;
    filename?: string;
    contentType?: string;
  }>;
  
  // Source tracking
  [MetadataField.SOURCE]?: string;
  [MetadataField.CATEGORY]?: string;
}
```

#### 1.4 Create Cognitive Process Metadata Types ✅

```typescript
/**
 * Cognitive process type enum
 */
export enum CognitiveProcessType {
  THOUGHT = 'thought',
  REFLECTION = 'reflection',
  INSIGHT = 'insight',
  PLANNING = 'planning',
  EVALUATION = 'evaluation',
  DECISION = 'decision'
}

/**
 * Cognitive process metadata base interface
 * Common fields for all cognitive processes (thoughts, reflections, insights)
 */
export interface CognitiveProcessMetadata extends BaseMetadata {
  // Core fields
  processType: CognitiveProcessType;
  [MetadataField.AGENT_ID]: string;
  
  // Context and relationships
  contextId?: string;     // Task, conversation, or other context ID
  relatedTo?: string[];   // IDs of related memories
  influences?: string[];  // IDs of memories this process influenced
  influencedBy?: string[]; // IDs of memories that influenced this process
  
  // Source and category
  [MetadataField.SOURCE]?: string;
  [MetadataField.CATEGORY]?: string;
}

/**
 * Thought metadata interface
 */
export interface ThoughtMetadata extends CognitiveProcessMetadata {
  processType: CognitiveProcessType.THOUGHT;
  intention?: string;     // Purpose of the thought
  confidenceScore?: number; // Confidence level (0-1)
}

/**
 * Reflection metadata interface
 */
export interface ReflectionMetadata extends CognitiveProcessMetadata {
  processType: CognitiveProcessType.REFLECTION;
  reflectionType?: 'experience' | 'behavior' | 'strategy' | 'performance';
  timeScope?: 'immediate' | 'short-term' | 'long-term';
}

/**
 * Insight metadata interface
 */
export interface InsightMetadata extends CognitiveProcessMetadata {
  processType: CognitiveProcessType.INSIGHT;
  insightType?: 'pattern' | 'implication' | 'prediction' | 'opportunity';
  applicationContext?: string[];  // Contexts where this insight applies
  validityPeriod?: {
    from?: string;  // ISO date string
    to?: string;    // ISO date string
  };
}

/**
 * Planning metadata interface
 */
export interface PlanningMetadata extends CognitiveProcessMetadata {
  processType: CognitiveProcessType.PLANNING;
  planType?: 'task' | 'strategy' | 'contingency';
  estimatedSteps?: number;
  dependsOn?: string[];  // IDs of prerequisites
}
```

#### 1.5 Create Document and Task Metadata Types ✅

Define similar strongly-typed interfaces for document and task memory types following the same pattern as MessageMetadata and cognitive process metadata types.

### Phase 2: Metadata Validation and Factories ✅

#### 2.1 Create Metadata Validators ✅

Create validation functions to ensure metadata consistency:

```typescript
/**
 * Validate and normalize message metadata
 * @param metadata The metadata to validate
 * @returns Validated and normalized metadata
 * @throws Error if validation fails
 */
export function validateMessageMetadata(metadata: Partial<MessageMetadata>): MessageMetadata {
  // Validate required fields
  if (!metadata[MetadataField.ROLE]) {
    throw new Error(`Missing required field: ${MetadataField.ROLE}`);
  }
  
  if (!metadata[MetadataField.USER_ID]) {
    throw new Error(`Missing required field: ${MetadataField.USER_ID}`);
  }
  
  if (!metadata[MetadataField.AGENT_ID]) {
    throw new Error(`Missing required field: ${MetadataField.AGENT_ID}`);
  }
  
  if (!metadata[MetadataField.CHAT_ID]) {
    throw new Error(`Missing required field: ${MetadataField.CHAT_ID}`);
  }
  
  if (!metadata[MetadataField.THREAD]) {
    throw new Error(`Missing required field: ${MetadataField.THREAD}`);
  }
  
  // Create a new object with validated fields
  const validatedMetadata: MessageMetadata = {
    [MetadataField.ROLE]: metadata[MetadataField.ROLE],
    [MetadataField.USER_ID]: metadata[MetadataField.USER_ID],
    [MetadataField.AGENT_ID]: metadata[MetadataField.AGENT_ID],
    [MetadataField.CHAT_ID]: metadata[MetadataField.CHAT_ID],
    [MetadataField.THREAD]: validateThreadInfo(metadata[MetadataField.THREAD])
  };
  
  // Copy other fields if they exist
  if (metadata[MetadataField.MESSAGE_TYPE]) {
    validatedMetadata[MetadataField.MESSAGE_TYPE] = metadata[MetadataField.MESSAGE_TYPE];
  }
  
  // Copy importance if it exists
  if (metadata[MetadataField.IMPORTANCE]) {
    validatedMetadata[MetadataField.IMPORTANCE] = metadata[MetadataField.IMPORTANCE];
  }
  
  // Copy importance score if it exists
  if (metadata[MetadataField.IMPORTANCE_SCORE] !== undefined) {
    validatedMetadata[MetadataField.IMPORTANCE_SCORE] = metadata[MetadataField.IMPORTANCE_SCORE];
  }
  
  // Copy tags if they exist
  if (metadata[MetadataField.TAGS]) {
    validatedMetadata[MetadataField.TAGS] = metadata[MetadataField.TAGS];
  }
  
  // Copy attachments if they exist
  if (metadata[MetadataField.ATTACHMENTS]) {
    validatedMetadata[MetadataField.ATTACHMENTS] = metadata[MetadataField.ATTACHMENTS];
  }
  
  return validatedMetadata;
}

/**
 * Validate thread info
 */
function validateThreadInfo(threadInfo: Partial<ThreadInfo>): ThreadInfo {
  if (!threadInfo.id) {
    throw new Error('Thread ID is required');
  }
  
  if (threadInfo.position === undefined) {
    throw new Error('Thread position is required');
  }
  
  return {
    id: threadInfo.id,
    position: threadInfo.position,
    parentId: threadInfo.parentId
  };
}

/**
 * Validate cognitive process metadata
 */
export function validateCognitiveProcessMetadata(
  metadata: Partial<CognitiveProcessMetadata>,
  processType: CognitiveProcessType
): CognitiveProcessMetadata {
  // Validate required fields
  if (!metadata[MetadataField.AGENT_ID]) {
    throw new Error(`Missing required field: ${MetadataField.AGENT_ID}`);
  }
  
  // Create a new object with validated fields
  const validatedMetadata: CognitiveProcessMetadata = {
    processType,
    [MetadataField.AGENT_ID]: metadata[MetadataField.AGENT_ID]
  };
  
  // Copy other fields if they exist
  if (metadata.contextId) {
    validatedMetadata.contextId = metadata.contextId;
  }
  
  if (metadata.relatedTo) {
    validatedMetadata.relatedTo = metadata.relatedTo;
  }
  
  if (metadata.influences) {
    validatedMetadata.influences = metadata.influences;
  }
  
  if (metadata.influencedBy) {
    validatedMetadata.influencedBy = metadata.influencedBy;
  }
  
  // Copy importance if it exists
  if (metadata[MetadataField.IMPORTANCE]) {
    validatedMetadata[MetadataField.IMPORTANCE] = metadata[MetadataField.IMPORTANCE];
  }
  
  // Copy importance score if it exists
  if (metadata[MetadataField.IMPORTANCE_SCORE] !== undefined) {
    validatedMetadata[MetadataField.IMPORTANCE_SCORE] = metadata[MetadataField.IMPORTANCE_SCORE];
  }
  
  // Copy tags if they exist
  if (metadata[MetadataField.TAGS]) {
    validatedMetadata[MetadataField.TAGS] = metadata[MetadataField.TAGS];
  }
  
  return validatedMetadata;
}
```

#### 2.2 Create Metadata Factories ✅

Create factory functions to construct properly structured metadata. **All factory functions will be centralized in `src/server/memory/services/helpers/metadata-helpers.ts` to ensure consistent metadata creation across the codebase:**

```typescript
/**
 * Factory function module in src/server/memory/services/helpers/metadata-helpers.ts
 * 
 * This module centralizes all metadata creation to ensure consistency
 * across the entire codebase. All components that need to create
 * metadata MUST use these factory functions instead of creating
 * metadata objects directly.
 */

/**
 * Create message metadata with required fields
 */
export function createMessageMetadata(
  role: 'user' | 'assistant' | 'system',
  userId: StructuredId,
  agentId: StructuredId,
  chatId: StructuredId,
  threadInfo: ThreadInfo,
  options: Partial<MessageMetadata> = {}
): MessageMetadata {
  return validateMessageMetadata({
    [MetadataField.ROLE]: role,
    [MetadataField.USER_ID]: userId,
    [MetadataField.AGENT_ID]: agentId,
    [MetadataField.CHAT_ID]: chatId,
    [MetadataField.THREAD]: threadInfo,
    schemaVersion: "1.0.0",
    ...options,
  });
}

/**
 * Create thread info
 */
export function createThreadInfo(
  threadId: string,
  position: number,
  parentId?: string
): ThreadInfo {
  return {
    id: threadId,
    position,
    parentId
  };
}

/**
 * Create structured identifier
 */
export function createStructuredId(
  namespace: string,
  type: string,
  id: string,
  version?: number
): StructuredId {
  return {
    namespace,
    type,
    id,
    version
  };
}

/**
 * Create thought metadata
 */
export function createThoughtMetadata(
  agentId: StructuredId,
  options: Partial<ThoughtMetadata> = {}
): ThoughtMetadata {
  return {
    processType: CognitiveProcessType.THOUGHT,
    [MetadataField.AGENT_ID]: agentId,
    schemaVersion: "1.0.0",
    ...options
  } as ThoughtMetadata;
}

/**
 * Create reflection metadata
 */
export function createReflectionMetadata(
  agentId: string,
  options: Partial<ReflectionMetadata> = {}
): ReflectionMetadata {
  return {
    processType: CognitiveProcessType.REFLECTION,
    [MetadataField.AGENT_ID]: agentId,
    ...options
  } as ReflectionMetadata;
}

/**
 * Create insight metadata
 */
export function createInsightMetadata(
  agentId: string,
  options: Partial<InsightMetadata> = {}
): InsightMetadata {
  return {
    processType: CognitiveProcessType.INSIGHT,
    [MetadataField.AGENT_ID]: agentId,
    ...options
  } as InsightMetadata;
}

/**
 * Create planning metadata
 */
export function createPlanningMetadata(
  agentId: string,
  options: Partial<PlanningMetadata> = {}
): PlanningMetadata {
  return {
    processType: CognitiveProcessType.PLANNING,
    [MetadataField.AGENT_ID]: agentId,
    ...options
  } as PlanningMetadata;
}
```

### Phase 3: Memory Service Integration

#### 3.1 Create Memory Service Wrappers

```typescript
/**
 * Add message to memory with proper metadata structure
 */
export async function addMessageMemory(
  memoryService: MemoryService,
  content: string,
  role: 'user' | 'assistant' | 'system',
  userId: string,
  agentId: string,
  chatId: string,
  threadInfo: ThreadInfo,
  options: {
    messageType?: string;
    attachments?: any[];
    metadata?: Partial<MessageMetadata>;
  } = {}
): Promise<MemoryResult> {
  // Create metadata with proper structure
  const metadata = createMessageMetadata(
    role,
    userId,
    agentId,
    chatId,
    threadInfo,
    {
      [MetadataField.MESSAGE_TYPE]: options.messageType,
      [MetadataField.ATTACHMENTS]: options.attachments,
      ...options.metadata
    }
  );
  
  // Add to memory
  return memoryService.addMemory<MessageSchema>({
    type: MemoryType.MESSAGE,
    content,
    metadata
  });
}

/**
 * Add thought to memory with proper metadata structure
 */
export async function addCognitiveProcessMemory(
  memoryService: MemoryService,
  content: string,
  processType: CognitiveProcessType,
  agentId: string,
  options: {
    contextId?: string;
    relatedTo?: string[];
    importance?: ImportanceLevel;
    metadata?: Partial<CognitiveProcessMetadata>;
  } = {}
): Promise<MemoryResult> {
  // Create metadata with proper structure based on process type
  let metadata: CognitiveProcessMetadata;
  
  switch (processType) {
    case CognitiveProcessType.THOUGHT:
      metadata = createThoughtMetadata(
        agentId,
        {
          contextId: options.contextId,
          relatedTo: options.relatedTo,
          [MetadataField.IMPORTANCE]: options.importance,
          ...options.metadata
        }
      );
      break;
    case CognitiveProcessType.REFLECTION:
      metadata = createReflectionMetadata(
        agentId,
        {
          contextId: options.contextId,
          relatedTo: options.relatedTo,
          [MetadataField.IMPORTANCE]: options.importance,
          ...options.metadata
        }
      );
      break;
    case CognitiveProcessType.INSIGHT:
      metadata = createInsightMetadata(
        agentId,
        {
          contextId: options.contextId,
          relatedTo: options.relatedTo,
          [MetadataField.IMPORTANCE]: options.importance,
          ...options.metadata
        }
      );
      break;
    case CognitiveProcessType.PLANNING:
      metadata = createPlanningMetadata(
        agentId,
        {
          contextId: options.contextId,
          relatedTo: options.relatedTo,
          [MetadataField.IMPORTANCE]: options.importance,
          ...options.metadata
        }
      );
      break;
    default:
      metadata = {
        processType,
        [MetadataField.AGENT_ID]: agentId,
        contextId: options.contextId,
        relatedTo: options.relatedTo,
        [MetadataField.IMPORTANCE]: options.importance,
        ...options.metadata
      } as CognitiveProcessMetadata;
  }
  
  // Get the appropriate memory type based on the process type
  const memoryType = getCognitiveProcessMemoryType(processType);
  
  // Add to memory
  return memoryService.addMemory({
    type: memoryType,
    content,
    metadata
  });
}
```

#### 3.2 Implement Message Search Functions

```typescript
/**
 * Search for messages with strongly typed filters
 */
export interface MessageSearchFilters {
  userId?: string;
  agentId?: string;
  chatId?: string;
  role?: 'user' | 'assistant' | 'system';
  threadId?: string;
}

/**
 * Search for messages with type-safe filters
 */
export async function searchMessages(
  memoryService: MemoryService,
  filters: MessageSearchFilters,
  options: SearchOptions = {}
): Promise<MemoryPoint<MessageSchema>[]> {
  // Convert filters to metadata filters
  const metadataFilters: Record<string, any> = {};
  
  if (filters.userId) {
    metadataFilters[MetadataField.USER_ID] = filters.userId;
  }
  
  if (filters.agentId) {
    metadataFilters[MetadataField.AGENT_ID] = filters.agentId;
  }
  
  if (filters.chatId) {
    metadataFilters[MetadataField.CHAT_ID] = filters.chatId;
  }
  
  if (filters.role) {
    metadataFilters[MetadataField.ROLE] = filters.role;
  }
  
  if (filters.threadId) {
    metadataFilters[`${MetadataField.THREAD}.id`] = filters.threadId;
  }
  
  return memoryService.search<MessageSchema>({
    ...options,
    type: MemoryType.MESSAGE,
    metadata: metadataFilters,
  });
}

/**
 * Search for cognitive processes with strongly typed filters
 */
export interface CognitiveProcessSearchFilters {
  agentId?: string;
  processType?: CognitiveProcessType;
  contextId?: string;
  relatedTo?: string;
}

/**
 * Search for cognitive processes with type-safe filters
 */
export async function searchCognitiveProcesses(
  memoryService: MemoryService,
  filters: CognitiveProcessSearchFilters,
  options: SearchOptions = {}
): Promise<MemoryPoint<CognitiveProcessMetadata>[]> {
  // Convert filters to metadata filters
  const metadataFilters: Record<string, any> = {};
  
  if (filters.agentId) {
    metadataFilters[MetadataField.AGENT_ID] = filters.agentId;
  }
  
  if (filters.processType) {
    metadataFilters.processType = filters.processType;
  }
  
  if (filters.contextId) {
    metadataFilters.contextId = filters.contextId;
  }
  
  if (filters.relatedTo) {
    metadataFilters.relatedTo = { $contains: filters.relatedTo };
  }
  
  // Determine memory type based on process type
  let memoryType: MemoryType | undefined;
  if (filters.processType) {
    memoryType = getCognitiveProcessMemoryType(filters.processType);
  }
  
  return memoryService.search<any>({
    ...options,
    type: memoryType,
    metadata: metadataFilters,
  });
}
```

### Phase 4: Implementation Strategy (Clean Break)

Given the requirement for a clean break without backward compatibility, we will:

1. **Create clean implementations**: Develop new metadata structures without worrying about backward compatibility.
2. **Replace existing code**: Update all code that creates or consumes metadata to use the new structures.
3. **Enforce factory function usage**: Require all metadata creation to go through the centralized factory functions in `src/server/memory/services/helpers/metadata-helpers.ts`.
4. **Delete legacy data**: If necessary, delete legacy data and start fresh.
5. **No migration scripts**: Skip writing migration scripts since we're making a clean break.
6. **Clear documentation**: Document the new metadata system thoroughly to ensure consistent usage.
7. **Structured identifiers**: Use structured identifiers for all entity references to ensure reliable identification.

### Phase 5: Codebase Updates

Update all places in the codebase where metadata is created or consumed to use the new structures:

1. `src/agents/shared/base/AgentBase.ts` - `storeMessageInMemory` method
2. `src/lib/memory/storeInternalMessageToMemory.ts`
3. Message filters and search utilities
4. UI components that display messages
5. Agent implementations

### Phase 6: Testing and Validation

Create comprehensive tests for the new metadata system:

1. Unit tests for metadata types and factories
2. Integration tests for memory service wrappers
3. End-to-end tests for message and cognitive process operations

## Implementation Timeline

### Week 1: Analysis and Design
- Map out all existing metadata usage
- Document specific inconsistencies
- Define new metadata types with structured identifiers
- Create metadata factory function architecture
- Establish central locations for type definitions and helper functions

### Week 2: Core Implementation
- Implement base metadata types
- Create structured identifier system
- Create metadata validators and factory functions
- Implement centralized factory function pattern
- Write unit tests for new types

### Week 3: Service Integration
- Implement memory service wrappers
- Create search utilities
- Write integration tests

### Week 4: Codebase Updates
- Update all metadata creation and consumption points
- Update UI components
- Delete legacy data if necessary

### Week 5: Testing and Deployment
- Comprehensive testing
- Create documentation
- Deploy to production

## File Change Tracking

Create and update files:

1. Create: `src/types/metadata.ts` - Central location for metadata type definitions
2. Create: `src/types/entity-identifier.ts` - Structured identifier system
3. Create: `src/server/memory/services/helpers/metadata-helpers.ts` - Centralized factory functions and helper utilities
4. Update: `src/server/memory/models/message-schema.ts` - Update message schema
5. Update: `src/server/memory/models/thought-schema.ts` - Update thought schema
6. Update: `src/server/memory/models/base-schema.ts` - Update base schema
7. Update: `src/server/memory/services/memory/memory-service.ts` - Update service
8. Update: `src/agents/shared/base/AgentBase.ts` - Update message creation
9. Update: `src/lib/memory/storeInternalMessageToMemory.ts` - Update internal message handling
10. Update: `src/app/api/chat/proxy.ts` - Update saveToHistory function to use new metadata structure
11. Update: `src/utils/messageFilters.ts` - Update filtering with new metadata
12. Update: `src/utils/smartSearch.ts` - Update searching with new metadata

## Future Considerations

1. **Schema Evolution**: Establish a process for evolving metadata schemas over time without breaking existing code.

2. **Performance Monitoring**: Set up monitoring for memory operations to ensure the new metadata structure doesn't negatively impact performance.

3. **Documentation**: Maintain comprehensive documentation of the metadata system to prevent future inconsistencies.

4. **Eventual Top-Level Migration**: Plan for eventually moving key fields like userId, agentId, and chatId to the top level in a future refactoring.

## Enhanced Multi-Agent Architecture Considerations

To ensure a highly scalable, rock-solid multi-agent architecture that supports authenticated users and autonomous agent-to-agent communication, we need to enhance the implementation plan with the following considerations:

### 1. Advanced Identity Management

```typescript
/**
 * Structured identifier for reliable entity references
 */
export interface StructuredId {
  namespace: string;     // Organization, system or context namespace
  type: string;          // Entity type (user, agent, chat, message, etc.)
  id: string;            // UUID or other unique identifier
  version?: number;      // Optional version for versioned entities
}

/**
 * Enhanced agent identifier with capabilities metadata
 */
export interface AgentIdentifier {
  id: StructuredId;
  capabilities: string[];  // What this agent can do
  domain: string[];        // Knowledge domains
  trustLevel: number;      // 0-1 trust score
  ownerUserId: StructuredId; // User who owns/created this agent
}
```

### 2. Authentication Context

```typescript
/**
 * Authentication context for metadata
 */
export interface AuthContext {
  sessionId: string;
  authMethod: 'oauth' | 'jwt' | 'api-key' | 'internal';
  permissions: string[];
  expiresAt?: string;    // ISO date string
  issuedAt: string;      // ISO date string
}

/**
 * Enhanced base metadata with auth context
 */
export interface EnhancedBaseMetadata extends BaseMetadata {
  authContext?: AuthContext;
  schemaVersion: string; // Semantic versioning string
}
```

### 3. Agent Communication Framework

```typescript
/**
 * Message priority levels for agent-to-agent communication
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Enhanced message metadata for agent-to-agent communication
 */
export interface AgentMessageMetadata extends MessageMetadata {
  senderAgentId: StructuredId;
  receiverAgentId: StructuredId;
  communicationType: 'request' | 'response' | 'notification' | 'broadcast';
  priority: MessagePriority;
  requiresResponse: boolean;
  responseDeadline?: string; // ISO date string
  conversationContext?: {
    taskId?: string;
    purpose: string;
    sharedContext: Record<string, any>;
  };
}
```

### 4. Data Isolation and Multi-tenancy

```typescript
/**
 * Tenant context for multi-tenant deployments
 */
export interface TenantContext {
  tenantId: string;
  dataPolicies: {
    retention: number; // Days
    encryption: boolean;
    classificationLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  };
}

/**
 * Enhanced base metadata with tenant isolation
 */
export interface MultiTenantBaseMetadata extends EnhancedBaseMetadata {
  tenant: TenantContext;
}
```

### 5. Performance Optimization Directives

```typescript
/**
 * Cache and indexing directives for metadata fields
 */
export interface PerformanceDirectives {
  indexPriority: 'high' | 'medium' | 'low' | 'none';
  cacheTTL?: number; // Seconds
  partitionKey?: string; // Field to use for data partitioning
  denyList?: string[]; // Fields that should not be indexed
}

/**
 * Apply performance directives to metadata fields
 */
export function applyPerformanceDirectives(
  metadata: Record<string, any>,
  directives: PerformanceDirectives
): Record<string, any> {
  // Implementation to add performance hints to metadata
  return {
    ...metadata,
    __performance: directives
  };
}
```

### 6. Implementation Updates for Multi-Agent Support

#### 6.1 Enhanced Message Memory Storage

```typescript
/**
 * Add message to memory with enhanced multi-agent support
 */
export async function addEnhancedMessageMemory(
  memoryService: MemoryService,
  content: string,
  role: 'user' | 'assistant' | 'system',
  userId: StructuredId,
  agentId: StructuredId,
  chatId: StructuredId,
  threadInfo: ThreadInfo,
  options: {
    messageType?: string;
    attachments?: any[];
    metadata?: Partial<MessageMetadata>;
    senderAgentId?: StructuredId;
    receiverAgentId?: StructuredId;
    authContext?: AuthContext;
    tenant?: TenantContext;
    priority?: MessagePriority;
  } = {}
): Promise<MemoryResult> {
  // Create enhanced metadata
  const baseMetadata = createMessageMetadata(
    role,
    userId.id,
    agentId.id,
    chatId.id,
    threadInfo,
    {
      [MetadataField.MESSAGE_TYPE]: options.messageType,
      [MetadataField.ATTACHMENTS]: options.attachments,
      ...options.metadata
    }
  );
  
  // Add enhanced fields for multi-agent support
  const enhancedMetadata: AgentMessageMetadata = {
    ...baseMetadata,
    senderAgentId: options.senderAgentId || agentId,
    receiverAgentId: options.receiverAgentId || { 
      namespace: 'system', 
      type: 'agent', 
      id: 'default' 
    },
    communicationType: 'notification',
    priority: options.priority || MessagePriority.NORMAL,
    requiresResponse: false,
    schemaVersion: '1.0.0'
  };
  
  // Add authentication context if provided
  if (options.authContext) {
    (enhancedMetadata as any).authContext = options.authContext;
  }
  
  // Add tenant context if provided
  if (options.tenant) {
    (enhancedMetadata as any).tenant = options.tenant;
  }
  
  // Add to memory with performance directives
  return memoryService.addMemory<MessageSchema>({
    type: MemoryType.MESSAGE,
    content,
    metadata: applyPerformanceDirectives(enhancedMetadata, {
      indexPriority: 'high',
      cacheTTL: 3600,
      partitionKey: 'chatId'
    })
  });
}
```

#### 6.2 Enhanced Agent-to-Agent Communication

```typescript
/**
 * Send message from one agent to another
 */
export async function sendAgentToAgentMessage(
  memoryService: MemoryService,
  content: string,
  senderAgentId: StructuredId,
  receiverAgentId: StructuredId,
  options: {
    priority?: MessagePriority;
    requiresResponse?: boolean;
    responseDeadline?: string;
    conversationContext?: {
      taskId?: string;
      purpose: string;
      sharedContext: Record<string, any>;
    };
    metadata?: Partial<AgentMessageMetadata>;
  } = {}
): Promise<MemoryResult> {
  // Create thread if not already part of one
  const threadId = crypto.randomUUID();
  
  const threadInfo: ThreadInfo = {
    id: threadId,
    position: 0
  };
  
  // Find or create a chat for these agents
  const chatId: StructuredId = {
    namespace: 'agent-chat',
    type: 'chat',
    id: `${senderAgentId.id}-${receiverAgentId.id}`
  };
  
  // System user as the container user
  const systemUserId: StructuredId = {
    namespace: 'system',
    type: 'user',
    id: 'system'
  };
  
  // Create enhanced message metadata
  return addEnhancedMessageMemory(
    memoryService,
    content,
    'assistant', // Always assistant role for agent-to-agent
    systemUserId,
    senderAgentId,
    chatId,
    threadInfo,
    {
      messageType: 'agent-communication',
      senderAgentId,
      receiverAgentId,
      priority: options.priority || MessagePriority.NORMAL,
      requiresResponse: options.requiresResponse || false,
      responseDeadline: options.responseDeadline,
      ...options
    }
  );
}
```

### 7. Reliable Data Queries for Multi-Agent Systems

```typescript
/**
 * Enhanced search for agent-to-agent communication
 */
export async function searchAgentCommunications(
  memoryService: MemoryService,
  filters: {
    senderAgentId?: StructuredId;
    receiverAgentId?: StructuredId;
    priority?: MessagePriority;
    requiresResponse?: boolean;
    conversationTaskId?: string;
  },
  options: SearchOptions = {}
): Promise<MemoryPoint<AgentMessageMetadata>[]> {
  // Convert filters to metadata filters
  const metadataFilters: Record<string, any> = {
    messageType: 'agent-communication'
  };
  
  if (filters.senderAgentId) {
    metadataFilters['senderAgentId.id'] = filters.senderAgentId.id;
  }
  
  if (filters.receiverAgentId) {
    metadataFilters['receiverAgentId.id'] = filters.receiverAgentId.id;
  }
  
  if (filters.priority) {
    metadataFilters.priority = filters.priority;
  }
  
  if (filters.requiresResponse !== undefined) {
    metadataFilters.requiresResponse = filters.requiresResponse;
  }
  
  if (filters.conversationTaskId) {
    metadataFilters['conversationContext.taskId'] = filters.conversationTaskId;
  }
  
  return memoryService.search<any>({
    ...options,
    type: MemoryType.MESSAGE,
    metadata: metadataFilters,
  });
}
```

### 8. Implementation Timeline Updates

Add the following tasks to the existing timeline:

#### Week 1: Add enhanced identity analysis
- Design structured identifiers
- Analyze authentication requirements
- Map agent-to-agent communication patterns

#### Week 2: Add multi-agent capabilities
- Implement structured identifiers
- Create authentication context types
- Build agent-to-agent communication framework

#### Week 3: Add multi-tenant support
- Implement tenant isolation
- Create performance optimization directives
- Design sharding strategy for horizontal scaling

These enhancements will ensure that the metadata system is reliable and scalable for multi-agent architectures with authenticated users and autonomous agent-to-agent communication capabilities. 