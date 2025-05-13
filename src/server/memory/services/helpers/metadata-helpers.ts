/**
 * Metadata Helpers
 * 
 * This module centralizes all metadata creation and validation to ensure
 * consistency across the codebase. All components that need to create
 * metadata MUST use these factory functions instead of creating
 * metadata objects directly.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  BaseMetadata,
  MessageMetadata,
  CognitiveProcessMetadata,
  ThoughtMetadata,
  ReflectionMetadata,
  InsightMetadata,
  PlanningMetadata,
  ThreadInfo,
  MetadataField,
  CognitiveProcessType,
  MessagePriority,
  DocumentMetadata,
  DocumentSource,
  TaskMetadata,
  TaskStatus,
  TaskPriority,
  AuthContext,
  TenantContext,
  PerformanceDirectives,
  MetadataSource,
  MessageType,
  CognitiveMemoryMetadata
} from '../../../../types/metadata';
import { MessageRole } from '../../../../agents/shared/types/MessageTypes';
import { ImportanceLevel } from '../../../../constants/memory';
import {
  StructuredId,
  createStructuredId,
  createEnumStructuredId,
  EntityNamespace,
  EntityType,
  IdPrefix
} from '../../../../types/structured-id';

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
 * Create message metadata with required fields
 */
export function createMessageMetadata(
  role: MessageRole,
  userId: StructuredId,
  agentId: StructuredId,
  chatId: StructuredId,
  threadInfo: ThreadInfo,
  options: Partial<MessageMetadata> = {}
): MessageMetadata {
  return validateMessageMetadata({
    ...createBaseMetadata(options),
    role,
    userId,
    agentId,
    chatId,
    thread: threadInfo,
    ...options
  });
}

/**
 * Validate and normalize message metadata
 */
export function validateMessageMetadata(metadata: Partial<MessageMetadata>): MessageMetadata {
  // Validate required fields
  if (!metadata.role) {
    throw new Error(`Missing required field: ${MetadataField.ROLE}`);
  }
  
  if (!metadata.userId) {
    throw new Error(`Missing required field: ${MetadataField.USER_ID}`);
  }
  
  if (!metadata.agentId) {
    throw new Error(`Missing required field: ${MetadataField.AGENT_ID}`);
  }
  
  if (!metadata.chatId) {
    throw new Error(`Missing required field: ${MetadataField.CHAT_ID}`);
  }
  
  if (!metadata.thread) {
    throw new Error(`Missing required field: ${MetadataField.THREAD}`);
  }
  
  const baseMetadata = validateBaseMetadata(metadata);
  
  // Create validated metadata
  const validatedMetadata: MessageMetadata = {
    ...baseMetadata,
    role: metadata.role,
    userId: metadata.userId,
    agentId: metadata.agentId,
    chatId: metadata.chatId,
    thread: validateThreadInfo(metadata.thread)
  };
  
  // Copy optional fields if they exist
  if (metadata.messageType) {
    validatedMetadata.messageType = metadata.messageType;
  }
  
  if (metadata.attachments) {
    validatedMetadata.attachments = metadata.attachments;
  }
  
  if (metadata.source) {
    validatedMetadata.source = metadata.source;
  }
  
  if (metadata.category) {
    validatedMetadata.category = metadata.category;
  }
  
  // Multi-agent communication fields
  if (metadata.senderAgentId) {
    validatedMetadata.senderAgentId = metadata.senderAgentId;
  }
  
  if (metadata.receiverAgentId) {
    validatedMetadata.receiverAgentId = metadata.receiverAgentId;
  }
  
  if (metadata.communicationType) {
    validatedMetadata.communicationType = metadata.communicationType;
  }
  
  if (metadata.priority) {
    validatedMetadata.priority = metadata.priority;
  }
  
  if (metadata.requiresResponse !== undefined) {
    validatedMetadata.requiresResponse = metadata.requiresResponse;
  }
  
  if (metadata.responseDeadline) {
    validatedMetadata.responseDeadline = metadata.responseDeadline;
  }
  
  if (metadata.conversationContext) {
    validatedMetadata.conversationContext = metadata.conversationContext;
  }
  
  return validatedMetadata;
}

/**
 * Create agent-to-agent message metadata
 */
export function createAgentToAgentMessageMetadata(
  senderAgentId: StructuredId,
  receiverAgentId: StructuredId,
  chatId: StructuredId,
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
  const systemUserId = createEnumStructuredId(
    EntityNamespace.SYSTEM,
    EntityType.USER,
    'system'
  );
  
  return createMessageMetadata(
    MessageRole.ASSISTANT, // Always assistant role for agent-to-agent
    systemUserId,
    senderAgentId,
    chatId,
    threadInfo,
    {
      messageType: 'agent-communication',
      senderAgentId,
      receiverAgentId,
      communicationType: options.communicationType || 'notification',
      priority: options.priority || MessagePriority.NORMAL,
      requiresResponse: options.requiresResponse || false,
      ...(options.responseDeadline ? { responseDeadline: options.responseDeadline } : {}),
      ...(options.conversationContext ? { conversationContext: options.conversationContext } : {})
    }
  );
}

// ================================
// Cognitive Process Metadata Helpers
// ================================

/**
 * Create base cognitive process metadata
 */
export function createCognitiveProcessMetadata(
  processType: CognitiveProcessType,
  agentId: StructuredId,
  options: Partial<CognitiveProcessMetadata> = {}
): CognitiveProcessMetadata {
  return validateCognitiveProcessMetadata({
    ...createBaseMetadata(options),
    processType,
    agentId,
    ...options
  });
}

/**
 * Validate cognitive process metadata
 */
export function validateCognitiveProcessMetadata(
  metadata: Partial<CognitiveProcessMetadata>
): CognitiveProcessMetadata {
  // Validate required fields
  if (!metadata.processType) {
    throw new Error(`Missing required field: ${MetadataField.PROCESS_TYPE}`);
  }
  
  if (!metadata.agentId) {
    throw new Error(`Missing required field: ${MetadataField.AGENT_ID}`);
  }
  
  const baseMetadata = validateBaseMetadata(metadata);
  
  // Create validated metadata
  const validatedMetadata: CognitiveProcessMetadata = {
    ...baseMetadata,
    processType: metadata.processType,
    agentId: metadata.agentId
  };
  
  // Copy optional fields if they exist
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
  
  if (metadata.source) {
    validatedMetadata.source = metadata.source;
  }
  
  if (metadata.category) {
    validatedMetadata.category = metadata.category;
  }
  
  return validatedMetadata;
}

/**
 * Create thought metadata
 */
export function createThoughtMetadata(
  agentId: StructuredId,
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
  agentId: StructuredId,
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
  agentId: StructuredId,
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
  agentId: StructuredId,
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
 * Create task metadata
 */
export function createTaskMetadata(
  title: string,
  status: TaskStatus,
  priority: TaskPriority,
  createdBy: StructuredId,
  options: Partial<TaskMetadata> = {}
): TaskMetadata {
  const baseMetadata = createBaseMetadata(options);
  
  const taskMetadata: TaskMetadata = {
    ...baseMetadata,
    title,
    status,
    priority,
    createdBy
  };
  
  // Copy optional fields if they exist
  if (options.description) {
    taskMetadata.description = options.description;
  }
  
  if (options.assignedTo) {
    taskMetadata.assignedTo = options.assignedTo;
  }
  
  if (options.dueDate) {
    taskMetadata.dueDate = options.dueDate;
  }
  
  if (options.startDate) {
    taskMetadata.startDate = options.startDate;
  }
  
  if (options.completedDate) {
    taskMetadata.completedDate = options.completedDate;
  }
  
  if (options.parentTaskId) {
    taskMetadata.parentTaskId = options.parentTaskId;
  }
  
  if (options.subtaskIds) {
    taskMetadata.subtaskIds = options.subtaskIds;
  }
  
  if (options.dependsOn) {
    taskMetadata.dependsOn = options.dependsOn;
  }
  
  if (options.blockedBy) {
    taskMetadata.blockedBy = options.blockedBy;
  }
  
  return taskMetadata;
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
 * Creates a message ID with the structured ID format
 * @returns A structured message ID
 */
export function createMessageId(): StructuredId {
  return createEnumStructuredId(
    EntityNamespace.CHAT,
    EntityType.MESSAGE,
    `${Date.now()}-${generateRandomString(8)}`
  );
}

/**
 * Creates a thought ID with the structured ID format
 * @returns A structured thought ID
 */
export function createThoughtId(): StructuredId {
  return createEnumStructuredId(
    EntityNamespace.MEMORY,
    EntityType.THOUGHT,
    `${Date.now()}-${generateRandomString(8)}`
  );
}

/**
 * Creates a chat ID with the structured ID format
 * @returns A structured chat ID
 */
export function createChatId(): StructuredId {
  return createEnumStructuredId(
    EntityNamespace.CHAT,
    EntityType.CHAT,
    `${Date.now()}-${generateRandomString(8)}`
  );
}

/**
 * Generates a random alphanumeric string
 * @param length The length of the string to generate
 * @returns A random alphanumeric string
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars.charAt(randomIndex);
  }
  return result;
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