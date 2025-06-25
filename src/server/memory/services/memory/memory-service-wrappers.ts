/**
 * Memory Service Wrappers
 * 
 * This module provides strongly-typed wrapper functions around the memory service
 * that use the new metadata types and factory functions. All components should use
 * these wrappers instead of directly calling the memory service to ensure
 * consistent metadata usage across the codebase.
 */

import { ImportanceLevel, MemoryType } from '@/server/memory/config/types';
import { MessageRole } from '../../../../agents/shared/types/MessageTypes';
import { createEnumEntityIdentifier, EntityIdentifier, EntityNamespace, EntityType } from '../../../../types/entity-identifier';
import {
  CognitiveProcessMetadata,
  CognitiveProcessType,
  DocumentMetadata,
  DocumentSource,
  InsightMetadata,
  MessageMetadata,
  PlanningMetadata,
  ReflectionMetadata,
  TaskMetadata,
  TaskPriority,
  TaskStatus,
  ThoughtMetadata,
  ThreadInfo
} from '../../../../types/metadata';
import { BaseMemorySchema, MemoryPoint } from '../../models';
import {
  createDocumentMetadata,
  createInsightMetadata,
  createMessageMetadata,
  createPlanningMetadata,
  createReflectionMetadata,
  createTaskMetadata,
  createThoughtMetadata
} from '../helpers/metadata-helpers';
import { EnhancedMemoryService } from '../multi-agent/enhanced-memory-service';
import { isEnhancedMemoryService } from '../multi-agent/migration-helpers';
import { MemoryService } from './memory-service';
import { MemoryResult } from './types';


/**
 * Type definition for either a MemoryService or EnhancedMemoryService
 * This allows the wrapper functions to work with both types
 */
export type AnyMemoryService = MemoryService | EnhancedMemoryService;

/**
 * Maps cognitive process type to memory type
 */
export function getCognitiveProcessMemoryType(processType: CognitiveProcessType): MemoryType {
  switch (processType) {
    case CognitiveProcessType.THOUGHT:
      return MemoryType.THOUGHT;
    case CognitiveProcessType.REFLECTION:
      return MemoryType.REFLECTION;
    case CognitiveProcessType.INSIGHT:
      return MemoryType.INSIGHT;
    case CognitiveProcessType.PLANNING:
      return MemoryType.TASK;
    case CognitiveProcessType.EVALUATION:
      return MemoryType.ANALYSIS;
    case CognitiveProcessType.DECISION:
      return MemoryType.THOUGHT; // No exact mapping, using THOUGHT
    default:
      return MemoryType.THOUGHT;
  }
}

/**
 * Add message to memory with proper metadata structure
 * 
 * @param memoryService Memory service instance (either MemoryService or EnhancedMemoryService)
 * @param content Message content
 * @param role Message role
 * @param userId User StructuredId object
 * @param agentId Agent StructuredId object  
 * @param chatId Chat StructuredId object
 * @param threadInfo Thread information
 * @param options Additional options
 * @returns Memory operation result
 */
export async function addMessageMemory(
  memoryService: AnyMemoryService,
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
): Promise<MemoryResult> {
  // Create metadata with proper structure
  const metadata = createMessageMetadata(
    content,
    role,
    userId,    // Pass EntityIdentifier object directly
    agentId,   // Pass EntityIdentifier object directly
    chatId,    // Pass EntityIdentifier object directly
    threadInfo,
    {
      messageType: options.messageType,
      attachments: options.attachments,
      importance: options.importance,
      ...options.metadata
    }
  );

  // Add to memory
  return memoryService.addMemory({
    type: MemoryType.MESSAGE,
    content,
    metadata
  });
}

/**
 * Add cognitive process to memory with proper metadata structure
 * 
 * @param memoryService Memory service instance (either MemoryService or EnhancedMemoryService)
 * @param content Process content
 * @param processType Process type
 * @param agentId Agent ID structured identifier
 * @param options Additional options
 * @returns Memory operation result
 */
export async function addCognitiveProcessMemory(
  memoryService: AnyMemoryService,
  content: string,
  processType: CognitiveProcessType,
  agentId: EntityIdentifier,
  options: {
    contextId?: string;
    relatedTo?: string[];
    influences?: string[];
    influencedBy?: string[];
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
          influences: options.influences,
          influencedBy: options.influencedBy,
          importance: options.importance,
          ...options.metadata as Partial<ThoughtMetadata>
        }
      );
      break;
    case CognitiveProcessType.REFLECTION:
      metadata = createReflectionMetadata(
        agentId,
        {
          contextId: options.contextId,
          relatedTo: options.relatedTo,
          influences: options.influences,
          influencedBy: options.influencedBy,
          importance: options.importance,
          ...options.metadata as Partial<ReflectionMetadata>
        }
      );
      break;
    case CognitiveProcessType.INSIGHT:
      metadata = createInsightMetadata(
        agentId,
        {
          contextId: options.contextId,
          relatedTo: options.relatedTo,
          influences: options.influences,
          influencedBy: options.influencedBy,
          importance: options.importance,
          ...options.metadata as Partial<InsightMetadata>
        }
      );
      break;
    case CognitiveProcessType.PLANNING:
      metadata = createPlanningMetadata(
        agentId,
        {
          contextId: options.contextId,
          relatedTo: options.relatedTo,
          influences: options.influences,
          influencedBy: options.influencedBy,
          importance: options.importance,
          ...options.metadata as Partial<PlanningMetadata>
        }
      );
      break;
    default:
      metadata = {
        processType,
        agentId,
        contextId: options.contextId,
        relatedTo: options.relatedTo,
        influences: options.influences,
        influencedBy: options.influencedBy,
        importance: options.importance,
        schemaVersion: "1.0.0",
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

/**
 * Add document to memory with proper metadata structure
 * 
 * @param memoryService Memory service instance (either MemoryService or EnhancedMemoryService)
 * @param content Document content
 * @param source Document source
 * @param options Additional options
 * @returns Memory operation result
 */
export async function addDocumentMemory(
  memoryService: AnyMemoryService,
  content: string,
  source: DocumentSource,
  options: {
    title?: string;
    contentType?: string;
    fileType?: string;
    url?: string;
    userId?: string;
    agentId?: string;
    chunkIndex?: number;
    totalChunks?: number;
    parentDocumentId?: string;
    fileSize?: number;
    fileName?: string;
    lastModified?: string;
    siteName?: string;
    author?: string;
    publishDate?: string;
    importance?: ImportanceLevel;
    metadata?: Partial<DocumentMetadata>;
  } = {}
): Promise<MemoryResult> {
  // Create metadata with proper structure
  const metadata = createDocumentMetadata(
    source,
    {
      title: options.title,
      contentType: options.contentType,
      fileType: options.fileType,
      url: options.url,
      userId: options.userId,
      agentId: options.agentId,
      chunkIndex: options.chunkIndex,
      totalChunks: options.totalChunks,
      parentDocumentId: options.parentDocumentId,
      fileSize: options.fileSize,
      fileName: options.fileName,
      lastModified: options.lastModified,
      siteName: options.siteName,
      author: options.author,
      publishDate: options.publishDate,
      importance: options.importance,
      // Mark all documents as critical to prevent decay - documents should be permanent
      critical: true,
      ...options.metadata
    }
  );

  // Add to memory
  return memoryService.addMemory({
    type: MemoryType.DOCUMENT,
    content,
    metadata
  });
}

/**
 * Add task to memory with proper metadata structure
 * 
 * @param memoryService Memory service instance (either MemoryService or EnhancedMemoryService)
 * @param content Task content
 * @param title Task title
 * @param status Task status
 * @param priority Task priority
 * @param createdBy Creator structured identifier
 * @param options Additional options
 * @returns Memory operation result
 */
export async function addTaskMemory(
  memoryService: AnyMemoryService,
  content: string,
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
): Promise<MemoryResult> {
  // Create metadata with proper structure
  const metadata = createTaskMetadata(
    title,
    status,
    priority,
    createdBy,
    {
      description: options.description,
      assignedTo: options.assignedTo,
      dueDate: options.dueDate,
      startDate: options.startDate,
      completedDate: options.completedDate,
      parentTaskId: options.parentTaskId,
      subtaskIds: options.subtaskIds,
      dependsOn: options.dependsOn,
      blockedBy: options.blockedBy,
      importance: options.importance,
      ...options.metadata
    }
  );

  // Add to memory
  return memoryService.addMemory({
    type: MemoryType.TASK,
    content,
    metadata
  });
}

/**
 * Strongly typed search filters for messages
 */
export interface MessageSearchFilters {
  userId?: string;
  agentId?: string;
  chatId?: string;
  role?: MessageRole;
  threadId?: string;
  messageType?: string;
  importance?: ImportanceLevel;
}

/**
 * Search for messages with strongly typed filters
 * 
 * @param memoryService Memory service instance (either MemoryService or EnhancedMemoryService)
 * @param filters Search filters
 * @param options Search options
 * @returns Array of matching memory points
 */
export async function searchMessages(
  memoryService: AnyMemoryService,
  filters: MessageSearchFilters,
  options: {
    query?: string;
    limit?: number;
    offset?: number;
    minScore?: number;
  } = {}
): Promise<MemoryPoint<BaseMemorySchema>[]> {
  // Convert filters to metadata filters
  const metadataFilters: Record<string, any> = {};

  if (filters.userId) {
    metadataFilters['userId.id'] = filters.userId;
  }

  if (filters.agentId) {
    metadataFilters['agentId.id'] = filters.agentId;
  }

  if (filters.chatId) {
    metadataFilters['chatId.id'] = filters.chatId;
  }

  if (filters.role) {
    metadataFilters['role'] = filters.role;
  }

  if (filters.threadId) {
    metadataFilters['thread.id'] = filters.threadId;
  }

  if (filters.messageType) {
    metadataFilters['messageType'] = filters.messageType;
  }

  if (filters.importance) {
    metadataFilters['importance'] = filters.importance;
  }

  // Create optimized filters for EnhancedMemoryService
  let optimizedFilter: Record<string, any> = {};

  // Check if we're using EnhancedMemoryService which can use top-level fields
  if (isEnhancedMemoryService(memoryService)) {
    // Use the top-level fields for frequently accessed properties
    if (filters.userId) {
      optimizedFilter.userId = filters.userId;
    }

    if (filters.agentId) {
      optimizedFilter.agentId = filters.agentId;
    }

    if (filters.chatId) {
      optimizedFilter.chatId = filters.chatId;
    }

    if (filters.threadId) {
      optimizedFilter.threadId = filters.threadId;
    }

    if (filters.messageType) {
      optimizedFilter.messageType = filters.messageType;
    }

    if (filters.importance) {
      optimizedFilter.importance = filters.importance;
    }

    // Add remaining metadata filters
    if (filters.role) {
      optimizedFilter.metadata = { role: filters.role };
    }
  } else {
    // For base MemoryService, just use metadata filters
    optimizedFilter = { metadata: metadataFilters };
  }

  return memoryService.searchMemories({
    type: MemoryType.MESSAGE,
    query: options.query,
    limit: options.limit,
    offset: options.offset,
    minScore: options.minScore,
    filter: optimizedFilter
  });
}

/**
 * Strongly typed search filters for cognitive processes
 */
export interface CognitiveProcessSearchFilters {
  agentId?: string;
  processType?: CognitiveProcessType;
  contextId?: string;
  relatedTo?: string;
  influences?: string;
  influencedBy?: string;
  importance?: ImportanceLevel;
}

/**
 * Search for cognitive processes with strongly typed filters
 * 
 * @param memoryService Memory service instance (either MemoryService or EnhancedMemoryService)
 * @param filters Search filters
 * @param options Search options
 * @returns Array of matching memory points
 */
export async function searchCognitiveProcesses(
  memoryService: AnyMemoryService,
  filters: CognitiveProcessSearchFilters,
  options: {
    query?: string;
    limit?: number;
    offset?: number;
    minScore?: number;
  } = {}
): Promise<MemoryPoint<BaseMemorySchema>[]> {
  // Convert filters to metadata filters
  const metadataFilters: Record<string, any> = {};

  if (filters.agentId) {
    metadataFilters['agentId.id'] = filters.agentId;
  }

  if (filters.processType) {
    metadataFilters['processType'] = filters.processType;
  }

  if (filters.contextId) {
    metadataFilters['contextId'] = filters.contextId;
  }

  if (filters.relatedTo) {
    metadataFilters['relatedTo'] = filters.relatedTo;
  }

  if (filters.influences) {
    metadataFilters['influences'] = filters.influences;
  }

  if (filters.influencedBy) {
    metadataFilters['influencedBy'] = filters.influencedBy;
  }

  if (filters.importance) {
    metadataFilters['importance'] = filters.importance;
  }

  // Create optimized filters for EnhancedMemoryService
  let optimizedFilter: Record<string, any> = {};

  // Check if we're using EnhancedMemoryService which can use top-level fields
  if (isEnhancedMemoryService(memoryService)) {
    // Use the top-level fields for frequently accessed properties
    if (filters.agentId) {
      optimizedFilter.agentId = filters.agentId;
    }

    if (filters.importance) {
      optimizedFilter.importance = filters.importance;
    }

    // Add remaining metadata filters
    optimizedFilter.metadata = {};

    if (filters.processType) {
      optimizedFilter.metadata.processType = filters.processType;
    }

    if (filters.contextId) {
      optimizedFilter.metadata.contextId = filters.contextId;
    }

    if (filters.relatedTo) {
      optimizedFilter.metadata.relatedTo = filters.relatedTo;
    }

    if (filters.influences) {
      optimizedFilter.metadata.influences = filters.influences;
    }

    if (filters.influencedBy) {
      optimizedFilter.metadata.influencedBy = filters.influencedBy;
    }
  } else {
    // For base MemoryService, just use metadata filters
    optimizedFilter = { metadata: metadataFilters };
  }

  // Determine memory type based on process type
  let memoryType: MemoryType | undefined;
  if (filters.processType) {
    memoryType = getCognitiveProcessMemoryType(filters.processType);
  }

  return memoryService.searchMemories({
    type: memoryType || MemoryType.THOUGHT,
    query: options.query,
    limit: options.limit,
    offset: options.offset,
    minScore: options.minScore,
    filter: optimizedFilter
  });
}

/**
 * Strongly typed search filters for documents
 */
export interface DocumentSearchFilters {
  source?: DocumentSource;
  userId?: string;
  agentId?: string;
  title?: string;
  fileName?: string;
  contentType?: string;
  fileType?: string;
  author?: string;
  importance?: ImportanceLevel;
}

/**
 * Search for documents with strongly typed filters
 * 
 * @param memoryService Memory service instance (either MemoryService or EnhancedMemoryService)
 * @param filters Search filters
 * @param options Search options
 * @returns Array of matching memory points
 */
export async function searchDocuments(
  memoryService: AnyMemoryService,
  filters: DocumentSearchFilters,
  options: {
    query?: string;
    limit?: number;
    offset?: number;
    minScore?: number;
  } = {}
): Promise<MemoryPoint<BaseMemorySchema>[]> {
  // Convert filters to metadata filters
  const metadataFilters: Record<string, any> = {};

  if (filters.source) {
    metadataFilters['source'] = filters.source;
  }

  if (filters.userId) {
    metadataFilters['userId'] = filters.userId;
  }

  if (filters.agentId) {
    metadataFilters['agentId'] = filters.agentId;
  }

  if (filters.title) {
    metadataFilters['title'] = filters.title;
  }

  if (filters.fileName) {
    metadataFilters['fileName'] = filters.fileName;
  }

  if (filters.contentType) {
    metadataFilters['contentType'] = filters.contentType;
  }

  if (filters.fileType) {
    metadataFilters['fileType'] = filters.fileType;
  }

  if (filters.author) {
    metadataFilters['author'] = filters.author;
  }

  if (filters.importance) {
    metadataFilters['importance'] = filters.importance;
  }

  // Create optimized filters for EnhancedMemoryService
  let optimizedFilter: Record<string, any> = {};

  // Check if we're using EnhancedMemoryService which can use top-level fields
  if (isEnhancedMemoryService(memoryService)) {
    // Use the top-level fields for frequently accessed properties
    if (filters.userId) {
      optimizedFilter.userId = filters.userId;
    }

    if (filters.agentId) {
      optimizedFilter.agentId = filters.agentId;
    }

    if (filters.importance) {
      optimizedFilter.importance = filters.importance;
    }

    // Add remaining metadata filters
    optimizedFilter.metadata = {};

    if (filters.source) {
      optimizedFilter.metadata.source = filters.source;
    }

    if (filters.title) {
      optimizedFilter.metadata.title = filters.title;
    }

    if (filters.fileName) {
      optimizedFilter.metadata.fileName = filters.fileName;
    }

    if (filters.contentType) {
      optimizedFilter.metadata.contentType = filters.contentType;
    }

    if (filters.fileType) {
      optimizedFilter.metadata.fileType = filters.fileType;
    }

    if (filters.author) {
      optimizedFilter.metadata.author = filters.author;
    }
  } else {
    // For base MemoryService, just use metadata filters
    optimizedFilter = { metadata: metadataFilters };
  }

  return memoryService.searchMemories({
    type: MemoryType.DOCUMENT,
    query: options.query,
    limit: options.limit,
    offset: options.offset,
    minScore: options.minScore,
    filter: optimizedFilter
  });
}

/**
 * Strongly typed search filters for tasks
 */
export interface TaskSearchFilters {
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  createdBy?: string;
  assignedTo?: string;
  dueDate?: string;
  parentTaskId?: string;
  importance?: ImportanceLevel;
}

/**
 * Search for tasks with strongly typed filters
 * 
 * @param memoryService Memory service instance (either MemoryService or EnhancedMemoryService)
 * @param filters Search filters
 * @param options Search options
 * @returns Array of matching memory points
 */
export async function searchTasks(
  memoryService: AnyMemoryService,
  filters: TaskSearchFilters,
  options: {
    query?: string;
    limit?: number;
    offset?: number;
    minScore?: number;
  } = {}
): Promise<MemoryPoint<BaseMemorySchema>[]> {
  // Convert filters to metadata filters
  const metadataFilters: Record<string, any> = {};

  if (filters.title) {
    metadataFilters['title'] = filters.title;
  }

  if (filters.status) {
    metadataFilters['status'] = filters.status;
  }

  if (filters.priority) {
    metadataFilters['priority'] = filters.priority;
  }

  if (filters.createdBy) {
    metadataFilters['createdBy'] = filters.createdBy;
  }

  if (filters.assignedTo) {
    metadataFilters['assignedTo'] = filters.assignedTo;
  }

  if (filters.dueDate) {
    metadataFilters['dueDate'] = filters.dueDate;
  }

  if (filters.parentTaskId) {
    metadataFilters['parentTaskId'] = filters.parentTaskId;
  }

  if (filters.importance) {
    metadataFilters['importance'] = filters.importance;
  }

  // Create optimized filters for EnhancedMemoryService
  let optimizedFilter: Record<string, any> = {};

  // Check if we're using EnhancedMemoryService which can use top-level fields
  if (isEnhancedMemoryService(memoryService)) {
    // Use the top-level fields for frequently accessed properties
    if (filters.importance) {
      optimizedFilter.importance = filters.importance;
    }

    // Add remaining metadata filters
    optimizedFilter.metadata = {};

    if (filters.title) {
      optimizedFilter.metadata.title = filters.title;
    }

    if (filters.status) {
      optimizedFilter.metadata.status = filters.status;
    }

    if (filters.priority) {
      optimizedFilter.metadata.priority = filters.priority;
    }

    if (filters.createdBy) {
      optimizedFilter.metadata.createdBy = filters.createdBy;
    }

    if (filters.assignedTo) {
      optimizedFilter.metadata.assignedTo = filters.assignedTo;
    }

    if (filters.dueDate) {
      optimizedFilter.metadata.dueDate = filters.dueDate;
    }

    if (filters.parentTaskId) {
      optimizedFilter.metadata.parentTaskId = filters.parentTaskId;
    }
  } else {
    // For base MemoryService, just use metadata filters
    optimizedFilter = { metadata: metadataFilters };
  }

  return memoryService.searchMemories({
    type: MemoryType.TASK,
    query: options.query,
    limit: options.limit,
    offset: options.offset,
    minScore: options.minScore,
    filter: optimizedFilter
  });
}

/**
 * Agent communication options
 */
export interface AgentCommunicationOptions {
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  requiresResponse?: boolean;
  responseDeadline?: string;
  parentMessageId?: string; // ID of the parent message for thread linking
  communicationType?: 'request' | 'response' | 'notification' | 'broadcast'; // Type of communication
  conversationContext?: {
    taskId?: string;
    purpose: string;
    sharedContext: Record<string, unknown>;
  };
}

/**
 * Send a message from one agent to another
 * 
 * @param memoryService Memory service instance (either MemoryService or EnhancedMemoryService)
 * @param content Message content
 * @param senderAgentId Sender agent structured identifier
 * @param receiverAgentId Receiver agent structured identifier
 * @param chatId Chat structured identifier
 * @param options Additional options
 * @returns Memory operation result
 */
export async function sendAgentToAgentMessage(
  memoryService: AnyMemoryService,
  content: string,
  senderAgentId: string,
  receiverAgentId: string,
  chatId: string,
  options: AgentCommunicationOptions = {}
): Promise<MemoryResult> {
  // Import thread helper to avoid circular dependencies
  const { getOrCreateThreadInfo } = require('../../../../app/api/chat/thread/helper');

  // Get appropriate thread info
  const threadInfo = getOrCreateThreadInfo(
    chatId,
    'assistant', // Agent-to-agent is always an assistant role
    options.parentMessageId
  );

  // Create EntityIdentifier objects from string parameters
  const systemUserStructuredId = createEnumEntityIdentifier(EntityNamespace.SYSTEM, EntityType.USER, 'system');
  const senderAgentStructuredId = createEnumEntityIdentifier(EntityNamespace.AGENT, EntityType.AGENT, senderAgentId);
  const chatStructuredId = createEnumEntityIdentifier(EntityNamespace.CHAT, EntityType.CHAT, chatId);

  // Add to memory using addMessageMemory with agent-to-agent metadata
  return addMessageMemory(
    memoryService,
    content,
    MessageRole.ASSISTANT, // Always assistant role for agent-to-agent
    systemUserStructuredId,     // StructuredId object
    senderAgentStructuredId,    // StructuredId object
    chatStructuredId,           // StructuredId object
    threadInfo,
    {
      messageType: 'agent-communication',
      metadata: {
        senderAgentId: senderAgentStructuredId,      // Store as StructuredId object
        receiverAgentId: createEnumEntityIdentifier(EntityNamespace.AGENT, EntityType.AGENT, receiverAgentId), // EntityIdentifier object
        communicationType: options.communicationType || 'request',
        priority: options.priority as any || 'normal',
        requiresResponse: options.requiresResponse || false,
        responseDeadline: options.responseDeadline,
        conversationContext: options.conversationContext
      }
    }
  );
}

