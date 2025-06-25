/**
 * Metadata Helpers
 * 
 * This module centralizes all metadata creation and validation to ensure
 * consistency across the codebase. All components that need to create
 * metadata MUST use these factory functions instead of creating
 * metadata objects directly.
 */

import { v4 as uuidv4 } from 'uuid';
import { MessageRole } from '../../../../agents/shared/types/MessageTypes';
import { ImportanceLevel } from '../../../../constants/memory';
import {
  generateChatId,
  generateMessageId,
  generateThoughtId
} from '../../../../lib/core/id-generation';
import {
  EntityIdentifier,
  EntityNamespace,
  EntityType,
  createEnumEntityIdentifier
} from '../../../../types/entity-identifier';
import {
  AuthContext,
  BaseMetadata,
  CognitiveMemoryMetadata,
  CognitiveProcessMetadata,
  CognitiveProcessType,
  DocumentMetadata,
  DocumentSource,
  InsightMetadata,
  MessageMetadata,
  MessagePriority,
  PerformanceDirectives,
  PlanningMetadata,
  ReflectionMetadata,
  TaskMetadata,
  TaskPriority,
  TaskStatus,
  TenantContext,
  ThoughtMetadata,
  ThreadInfo
} from '../../../../types/metadata';

/**
 * Current schema version for metadata
 */
export const CURRENT_SCHEMA_VERSION = '1.0.0';

// ================================
// Base Metadata Helpers
// ================================

/**
 * Create base metadata with common fields
 */
export function createBaseMetadata(options: Partial<BaseMetadata> = {}): BaseMetadata {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...options
  };
}

/**
 * Validate base metadata
 */
export function validateBaseMetadata(metadata: Partial<BaseMetadata>): BaseMetadata {
  if (!metadata.schemaVersion) {
    metadata.schemaVersion = CURRENT_SCHEMA_VERSION;
  }

  return {
    schemaVersion: metadata.schemaVersion,
    ...(metadata.importance !== undefined ? { importance: metadata.importance } : {}),
    ...(metadata.importance_score !== undefined ? { importance_score: metadata.importance_score } : {}),
    ...(metadata.tags !== undefined ? { tags: metadata.tags } : {}),
    ...(metadata.is_deleted !== undefined ? { is_deleted: metadata.is_deleted } : {}),
    ...(metadata.deletion_time !== undefined ? { deletion_time: metadata.deletion_time } : {}),
    ...(metadata.authContext !== undefined ? { authContext: metadata.authContext } : {}),
    ...(metadata.tenant !== undefined ? { tenant: metadata.tenant } : {}),
    ...(metadata.performanceDirectives !== undefined ? { performanceDirectives: metadata.performanceDirectives } : {})
  };
}

/**
 * Apply performance directives to metadata
 */
export function applyPerformanceDirectives<T extends Record<string, unknown>>(
  metadata: T,
  directives: PerformanceDirectives
): T {
  return {
    ...metadata,
    performanceDirectives: directives
  };
}

// ================================
// Thread Info Helpers
// ================================

/**
 * Create thread info
 */
export function createThreadInfo(
  threadId?: string,
  position: number = 0,
  parentId?: string
): ThreadInfo {
  return {
    id: threadId || uuidv4(),
    position,
    ...(parentId ? { parentId } : {})
  };
}

/**
 * Validate thread info
 */
export function validateThreadInfo(threadInfo: Partial<ThreadInfo>): ThreadInfo {
  if (!threadInfo.id) {
    throw new Error('Thread ID is required');
  }

  if (threadInfo.position === undefined) {
    throw new Error('Thread position is required');
  }

  return {
    id: threadInfo.id,
    position: threadInfo.position,
    ...(threadInfo.parentId ? { parentId: threadInfo.parentId } : {})
  };
}

// ================================
// Message Metadata Helpers
// ================================

/**
 * Create message metadata with StructuredId objects
 * @param content Message content
 * @param role Message role
 * @param userId User StructuredId object
 * @param agentId Agent StructuredId object
 * @param chatId Chat StructuredId object
 * @param threadInfo Thread information
 * @param options Additional options
 * @returns Message metadata
 */
export function createMessageMetadata(
  content: string,
  role: MessageRole,
  userId: EntityIdentifier,
  agentId: EntityIdentifier,
  chatId: EntityIdentifier,
  threadInfo: ThreadInfo,
  options: {
    messageType?: string;
    attachments?: Array<{
      type: string;
      url?: string;
      data?: string;
      filename?: string;
      contentType?: string;
    }>;
    importance?: ImportanceLevel;
    metadata?: Partial<MessageMetadata>;
  } = {}
): MessageMetadata {
  // Extract tags from content if not provided in metadata
  const extractedTags = options.metadata?.tags || [];
  if (content && extractedTags.length === 0) {
    // Basic tag extraction from content - look for hashtags and keywords
    const hashtagMatches = content.match(/#[a-zA-Z0-9_]+/g) || [];
    const hashtags = hashtagMatches.map(tag => tag.substring(1).toLowerCase());

    // Extract key terms (simple approach - can be enhanced)
    const words = content.toLowerCase().split(/\s+/);
    const keyWords = words.filter(word =>
      word.length > 3 &&
      !['this', 'that', 'with', 'from', 'they', 'were', 'been', 'have', 'will', 'your', 'what', 'when', 'where', 'would', 'could', 'should'].includes(word)
    );

    extractedTags.push(...hashtags, ...keyWords.slice(0, 10)); // Limit to first 10 key words
  }

  const baseMetadata: MessageMetadata = {
    schemaVersion: '1.0.0',
    // Required MessageMetadata fields
    role: role, // Use the provided role parameter
    userId,     // StructuredId object
    agentId,    // StructuredId object
    chatId,     // StructuredId object
    thread: threadInfo,
    messageType: options.messageType || 'text',
    attachments: options.attachments || [],
    timestamp: Date.now(), // Use numeric timestamp

    // Importance
    importance: options.importance || ImportanceLevel.MEDIUM,

    // Memory metadata fields
    tags: [...new Set(extractedTags)], // Remove duplicates

    // Custom metadata
    ...options.metadata
  };

  return baseMetadata;
}

/**
 * Create agent-to-agent message metadata
 */
export function createAgentToAgentMessageMetadata(
  senderAgentId: EntityIdentifier,
  receiverAgentId: EntityIdentifier,
  chatId: EntityIdentifier,
  threadInfo: ThreadInfo,
  options: {
    communicationType?: 'request' | 'response' | 'notification' | 'broadcast';
    priority?: MessagePriority;
    requiresResponse?: boolean;
    responseDeadline?: string;
    conversationContext?: {
      taskId?: string;
      purpose: string;
      sharedContext: Record<string, unknown>;
    };
  } = {}
): MessageMetadata {
  // Create system user ID (owner of the agent-to-agent conversation)
  const systemUserId = createEnumEntityIdentifier(
    EntityNamespace.SYSTEM,
    EntityType.USER,
    'system'
  );

  return createMessageMetadata(
    '',
    MessageRole.ASSISTANT, // Always assistant role for agent-to-agent
    systemUserId,    // Pass StructuredId object directly
    senderAgentId,   // Pass StructuredId object directly
    chatId,          // Pass StructuredId object directly
    threadInfo,
    {
      messageType: 'agent-communication',
      metadata: {
        senderAgentId,     // Store as StructuredId object
        receiverAgentId,   // Store as StructuredId object
        communicationType: options.communicationType || 'notification',
        priority: options.priority || MessagePriority.NORMAL,
        requiresResponse: options.requiresResponse || false,
        ...(options.responseDeadline ? { responseDeadline: options.responseDeadline } : {}),
        ...(options.conversationContext ? { conversationContext: options.conversationContext } : {})
      }
    }
  );
}

// ================================
// Cognitive Process Metadata Helpers
// ================================

/**
 * Create cognitive process metadata with string IDs
 * @param processType Cognitive process type
 * @param agentId Agent ID string
 * @param options Additional options
 * @returns Cognitive process metadata
 */
export function createCognitiveProcessMetadata(
  processType: CognitiveProcessType,
  agentId: string,
  options: {
    contextId?: string;
    relatedTo?: string[];
    influences?: string[];
    influencedBy?: string[];
    importance?: ImportanceLevel;
    metadata?: Partial<CognitiveProcessMetadata>;
  } = {}
): CognitiveProcessMetadata {
  const baseMetadata: CognitiveProcessMetadata = {
    schemaVersion: '1.0.0',
    processType,
    agentId,
    contextId: options.contextId,
    relatedTo: options.relatedTo || [],
    influences: options.influences || [],
    influencedBy: options.influencedBy || [],
    timestamp: new Date().toISOString(),

    // Importance
    importance: options.importance || ImportanceLevel.MEDIUM,

    // Memory metadata fields
    tags: [],

    // Custom metadata
    ...options.metadata
  };

  return baseMetadata;
}

/**
 * Create thought metadata
 */
export function createThoughtMetadata(
  agentId: string,
  options: Partial<ThoughtMetadata> = {}
): ThoughtMetadata {
  const baseMetadata = createCognitiveProcessMetadata(
    CognitiveProcessType.THOUGHT,
    agentId,
    options
  );

  const thoughtMetadata: ThoughtMetadata = {
    ...baseMetadata,
    processType: CognitiveProcessType.THOUGHT
  };

  if (options.intention) {
    thoughtMetadata.intention = options.intention;
  }

  if (options.confidenceScore !== undefined) {
    thoughtMetadata.confidenceScore = options.confidenceScore;
  }

  return thoughtMetadata;
}

/**
 * Create reflection metadata
 */
export function createReflectionMetadata(
  agentId: string,
  options: Partial<ReflectionMetadata> = {}
): ReflectionMetadata {
  const baseMetadata = createCognitiveProcessMetadata(
    CognitiveProcessType.REFLECTION,
    agentId,
    options
  );

  const reflectionMetadata: ReflectionMetadata = {
    ...baseMetadata,
    processType: CognitiveProcessType.REFLECTION
  };

  if (options.reflectionType) {
    reflectionMetadata.reflectionType = options.reflectionType;
  }

  if (options.timeScope) {
    reflectionMetadata.timeScope = options.timeScope;
  }

  return reflectionMetadata;
}

/**
 * Create insight metadata
 */
export function createInsightMetadata(
  agentId: string,
  options: Partial<InsightMetadata> = {}
): InsightMetadata {
  const baseMetadata = createCognitiveProcessMetadata(
    CognitiveProcessType.INSIGHT,
    agentId,
    options
  );

  const insightMetadata: InsightMetadata = {
    ...baseMetadata,
    processType: CognitiveProcessType.INSIGHT
  };

  if (options.insightType) {
    insightMetadata.insightType = options.insightType;
  }

  if (options.applicationContext) {
    insightMetadata.applicationContext = options.applicationContext;
  }

  if (options.validityPeriod) {
    insightMetadata.validityPeriod = options.validityPeriod;
  }

  return insightMetadata;
}

/**
 * Create planning metadata
 */
export function createPlanningMetadata(
  agentId: string,
  options: Partial<PlanningMetadata> = {}
): PlanningMetadata {
  const baseMetadata = createCognitiveProcessMetadata(
    CognitiveProcessType.PLANNING,
    agentId,
    options
  );

  const planningMetadata: PlanningMetadata = {
    ...baseMetadata,
    processType: CognitiveProcessType.PLANNING
  };

  if (options.planType) {
    planningMetadata.planType = options.planType;
  }

  if (options.estimatedSteps !== undefined) {
    planningMetadata.estimatedSteps = options.estimatedSteps;
  }

  if (options.dependsOn) {
    planningMetadata.dependsOn = options.dependsOn;
  }

  return planningMetadata;
}

// ================================
// Document Metadata Helpers
// ================================

/**
 * Create document metadata
 */
export function createDocumentMetadata(
  source: DocumentSource,
  options: Partial<DocumentMetadata> = {}
): DocumentMetadata {
  const baseMetadata = createBaseMetadata(options);

  const documentMetadata: DocumentMetadata = {
    ...baseMetadata,
    source
  };

  // Copy fields if they exist
  if (options.title) {
    documentMetadata.title = options.title;
  }

  if (options.contentType) {
    documentMetadata.contentType = options.contentType;
  }

  if (options.fileType) {
    documentMetadata.fileType = options.fileType;
  }

  if (options.url) {
    documentMetadata.url = options.url;
  }

  if (options.userId) {
    documentMetadata.userId = options.userId;
  }

  if (options.agentId) {
    documentMetadata.agentId = options.agentId;
  }

  if (options.chunkIndex !== undefined) {
    documentMetadata.chunkIndex = options.chunkIndex;
  }

  if (options.totalChunks !== undefined) {
    documentMetadata.totalChunks = options.totalChunks;
  }

  if (options.parentDocumentId) {
    documentMetadata.parentDocumentId = options.parentDocumentId;
  }

  if (options.fileSize !== undefined) {
    documentMetadata.fileSize = options.fileSize;
  }

  if (options.fileName) {
    documentMetadata.fileName = options.fileName;
  }

  if (options.lastModified) {
    documentMetadata.lastModified = options.lastModified;
  }

  if (options.siteName) {
    documentMetadata.siteName = options.siteName;
  }

  if (options.author) {
    documentMetadata.author = options.author;
  }

  if (options.publishDate) {
    documentMetadata.publishDate = options.publishDate;
  }

  return documentMetadata;
}

// ================================
// Task Metadata Helpers
// ================================

/**
 * Create task metadata with string IDs
 * @param title Task title
 * @param status Task status
 * @param priority Task priority
 * @param createdBy User ID string who created the task
 * @param options Additional options
 * @returns Task metadata
 */
export function createTaskMetadata(
  title: string,
  status: TaskStatus,
  priority: TaskPriority,
  createdBy: string,
  options: {
    description?: string;
    assignedTo?: string;
    dueDate?: string;
    startDate?: string;
    completedDate?: string;
    parentTaskId?: string;
    subtaskIds?: string[];
    dependsOn?: string[];
    blockedBy?: string[];
    importance?: ImportanceLevel;
    metadata?: Partial<TaskMetadata>;
  } = {}
): TaskMetadata {
  const baseMetadata: TaskMetadata = {
    schemaVersion: '1.0.0',
    title,
    description: options.description || '',
    status,
    priority,
    createdBy,
    assignedTo: options.assignedTo,
    dueDate: options.dueDate,
    startDate: options.startDate,
    completedDate: options.completedDate,
    parentTaskId: options.parentTaskId,
    subtaskIds: options.subtaskIds || [],
    dependsOn: options.dependsOn || [],
    blockedBy: options.blockedBy || [],
    timestamp: new Date().toISOString(),

    // Importance
    importance: options.importance || ImportanceLevel.MEDIUM,

    // Memory metadata fields
    tags: [],

    // Custom metadata
    ...options.metadata
  };

  return baseMetadata;
}

// ================================
// Authentication and Security Helpers
// ================================

/**
 * Create authentication context
 */
export function createAuthContext(
  sessionId: string,
  authMethod: 'oauth' | 'jwt' | 'api-key' | 'internal',
  permissions: string[],
  options: {
    expiresAt?: string;
    issuedAt?: string;
  } = {}
): AuthContext {
  return {
    sessionId,
    authMethod,
    permissions,
    issuedAt: options.issuedAt || new Date().toISOString(),
    ...(options.expiresAt ? { expiresAt: options.expiresAt } : {})
  };
}

/**
 * Create tenant context
 */
export function createTenantContext(
  tenantId: string,
  options: {
    retention?: number;
    encryption?: boolean;
    classificationLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
  } = {}
): TenantContext {
  return {
    tenantId,
    dataPolicies: {
      retention: options.retention || 365, // Default to 1 year
      encryption: options.encryption !== undefined ? options.encryption : true,
      classificationLevel: options.classificationLevel || 'internal'
    }
  };
}

/**
 * Create a message ID string
 * @returns A message ID string in the format: memory:message:ulid
 */
export function createMessageId(): string {
  return generateMessageId();
}

/**
 * Create a thought ID string
 * @returns A thought ID string in the format: memory:thought:ulid
 */
export function createThoughtId(): string {
  return generateThoughtId();
}

/**
 * Create a chat ID string
 * @returns A chat ID string in the format: chat:chat:ulid
 */
export function createChatId(): string {
  return generateChatId();
}

/**
 * Create cognitive memory metadata
 */
export function createCognitiveMemoryMetadata(
  options: Partial<CognitiveMemoryMetadata> = {}
): CognitiveMemoryMetadata {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    decayFactor: 1.0,
    retrievalCount: 0,
    emotions: ['neutral'],
    ...options
  };
}

/**
 * Update metadata with decay information
 */
export function updateWithDecayInfo<T extends Partial<BaseMetadata>>(
  metadata: T,
  decayFactor: number,
  retrievalCount: number
): T & BaseMetadata {
  return {
    ...metadata,
    schemaVersion: metadata.schemaVersion || CURRENT_SCHEMA_VERSION,
    decayFactor,
    retrievalCount,
    last_used: new Date().toISOString()
  } as T & BaseMetadata;
} 