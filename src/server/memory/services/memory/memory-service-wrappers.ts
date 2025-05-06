/**
 * Memory Service Wrappers
 * 
 * This module provides strongly-typed wrapper functions around the memory service
 * that use the new metadata types and factory functions. All components should use
 * these wrappers instead of directly calling the memory service to ensure
 * consistent metadata usage across the codebase.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  MessageMetadata, 
  ThreadInfo, 
  CognitiveProcessMetadata,
  ThoughtMetadata,
  ReflectionMetadata,
  InsightMetadata,
  PlanningMetadata,
  DocumentMetadata,
  TaskMetadata,
  CognitiveProcessType,
  DocumentSource,
  TaskStatus,
  TaskPriority
} from '../../../../types/metadata';
import { StructuredId } from '../../../../types/structured-id';
import { MessageRole } from '../../../../agents/chloe/types/state';
import { MemoryType } from '../../config/types';
import { ImportanceLevel } from '../../../../constants/memory';
import { MemoryService } from './memory-service';
import {
  createMessageMetadata,
  createThreadInfo,
  createThoughtMetadata,
  createReflectionMetadata,
  createInsightMetadata,
  createPlanningMetadata,
  createDocumentMetadata,
  createTaskMetadata
} from '../helpers/metadata-helpers';
import { BaseMemorySchema, MemoryPoint } from '../../models';
import { MemoryResult } from './types';

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
 * @param memoryService Memory service instance
 * @param content Message content
 * @param role Message role (user, assistant, system)
 * @param userId User ID structured identifier
 * @param agentId Agent ID structured identifier
 * @param chatId Chat ID structured identifier
 * @param threadInfo Thread information
 * @param options Additional options
 * @returns Memory operation result
 */
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
    role,
    userId,
    agentId,
    chatId,
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
 * @param memoryService Memory service instance
 * @param content Process content
 * @param processType Process type
 * @param agentId Agent ID structured identifier
 * @param options Additional options
 * @returns Memory operation result
 */
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
 * @param memoryService Memory service instance
 * @param content Document content
 * @param source Document source
 * @param options Additional options
 * @returns Memory operation result
 */
export async function addDocumentMemory(
  memoryService: MemoryService,
  content: string,
  source: DocumentSource,
  options: {
    title?: string;
    contentType?: string;
    fileType?: string;
    url?: string;
    userId?: StructuredId;
    agentId?: StructuredId;
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
 * @param memoryService Memory service instance
 * @param content Task content
 * @param title Task title
 * @param status Task status
 * @param priority Task priority
 * @param createdBy Creator structured identifier
 * @param options Additional options
 * @returns Memory operation result
 */
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
  userId?: string | StructuredId;
  agentId?: string | StructuredId;
  chatId?: string | StructuredId;
  role?: MessageRole;
  threadId?: string;
  messageType?: string;
  importance?: ImportanceLevel;
}

/**
 * Search for messages with strongly typed filters
 * 
 * @param memoryService Memory service instance
 * @param filters Search filters
 * @param options Search options
 * @returns Array of matching memory points
 */
export async function searchMessages(
  memoryService: MemoryService,
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
    metadataFilters['userId.id'] = typeof filters.userId === 'string' 
      ? filters.userId 
      : filters.userId.id;
  }
  
  if (filters.agentId) {
    metadataFilters['agentId.id'] = typeof filters.agentId === 'string'
      ? filters.agentId
      : filters.agentId.id;
  }
  
  if (filters.chatId) {
    metadataFilters['chatId.id'] = typeof filters.chatId === 'string'
      ? filters.chatId
      : filters.chatId.id;
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
  
  return memoryService.searchMemories({
    type: MemoryType.MESSAGE,
    query: options.query,
    limit: options.limit,
    offset: options.offset,
    minScore: options.minScore,
    filter: metadataFilters
  });
}

/**
 * Strongly typed search filters for cognitive processes
 */
export interface CognitiveProcessSearchFilters {
  agentId?: string | StructuredId;
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
 * @param memoryService Memory service instance
 * @param filters Search filters
 * @param options Search options
 * @returns Array of matching memory points
 */
export async function searchCognitiveProcesses(
  memoryService: MemoryService,
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
    metadataFilters['agentId.id'] = typeof filters.agentId === 'string'
      ? filters.agentId
      : filters.agentId.id;
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
    filter: metadataFilters
  });
}

/**
 * Strongly typed search filters for documents
 */
export interface DocumentSearchFilters {
  source?: DocumentSource;
  userId?: string | StructuredId;
  agentId?: string | StructuredId;
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
 * @param memoryService Memory service instance
 * @param filters Search filters
 * @param options Search options
 * @returns Array of matching memory points
 */
export async function searchDocuments(
  memoryService: MemoryService,
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
    metadataFilters['userId.id'] = typeof filters.userId === 'string'
      ? filters.userId
      : filters.userId.id;
  }
  
  if (filters.agentId) {
    metadataFilters['agentId.id'] = typeof filters.agentId === 'string'
      ? filters.agentId
      : filters.agentId.id;
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
  
  return memoryService.searchMemories({
    type: MemoryType.DOCUMENT,
    query: options.query,
    limit: options.limit,
    offset: options.offset,
    minScore: options.minScore,
    filter: metadataFilters
  });
}

/**
 * Strongly typed search filters for tasks
 */
export interface TaskSearchFilters {
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  createdBy?: string | StructuredId;
  assignedTo?: string | StructuredId;
  dueDate?: string;
  parentTaskId?: string;
  importance?: ImportanceLevel;
}

/**
 * Search for tasks with strongly typed filters
 * 
 * @param memoryService Memory service instance
 * @param filters Search filters
 * @param options Search options
 * @returns Array of matching memory points
 */
export async function searchTasks(
  memoryService: MemoryService,
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
    metadataFilters['createdBy.id'] = typeof filters.createdBy === 'string'
      ? filters.createdBy
      : filters.createdBy.id;
  }
  
  if (filters.assignedTo) {
    metadataFilters['assignedTo.id'] = typeof filters.assignedTo === 'string'
      ? filters.assignedTo
      : filters.assignedTo.id;
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
  
  return memoryService.searchMemories({
    type: MemoryType.TASK,
    query: options.query,
    limit: options.limit,
    offset: options.offset,
    minScore: options.minScore,
    filter: metadataFilters
  });
}

/**
 * Agent communication options
 */
export interface AgentCommunicationOptions {
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  requiresResponse?: boolean;
  responseDeadline?: string;
  conversationContext?: {
    taskId?: string;
    purpose: string;
    sharedContext: Record<string, unknown>;
  };
}

/**
 * Send a message from one agent to another
 * 
 * @param memoryService Memory service instance
 * @param content Message content
 * @param senderAgentId Sender agent structured identifier
 * @param receiverAgentId Receiver agent structured identifier
 * @param chatId Chat structured identifier
 * @param options Additional options
 * @returns Memory operation result
 */
export async function sendAgentToAgentMessage(
  memoryService: MemoryService,
  content: string,
  senderAgentId: StructuredId,
  receiverAgentId: StructuredId,
  chatId: StructuredId,
  options: AgentCommunicationOptions = {}
): Promise<MemoryResult> {
  // Create thread
  const threadInfo = createThreadInfo(uuidv4(), 0);
  
  // System user (for agent-to-agent communication)
  const systemUserId = {
    namespace: 'system',
    type: 'user',
    id: 'system'
  };
  
  // Add to memory using addMessageMemory with agent-to-agent metadata
  return addMessageMemory(
    memoryService,
    content,
    MessageRole.ASSISTANT, // Always assistant role for agent-to-agent
    systemUserId,
    senderAgentId,
    chatId,
    threadInfo,
    {
      messageType: 'agent-communication',
      metadata: {
        senderAgentId,
        receiverAgentId,
        communicationType: 'request',
        priority: options.priority as any || 'normal',
        requiresResponse: options.requiresResponse || false,
        responseDeadline: options.responseDeadline,
        conversationContext: options.conversationContext
      }
    }
  );
} 