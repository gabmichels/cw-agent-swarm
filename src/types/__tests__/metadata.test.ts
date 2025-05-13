/**
 * Unit tests for metadata.ts
 */

import { describe, test, expect } from 'vitest';
import {
  BaseMetadata,
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
  TaskPriority,
  MessagePriority,
  MetadataField,
  AuthContext,
  TenantContext,
  PerformanceDirectives,
  MessageAttachment,
  MessageRole
} from '../metadata';
import { ImportanceLevel } from '../../constants/memory';
import { createUserId, createAgentId, createChatId } from '../structured-id';

describe('Metadata Types', () => {
  describe('BaseMetadata', () => {
    test('should have the correct structure with required and optional fields', () => {
      const baseMetadata: BaseMetadata = {
        schemaVersion: '1.0.0',
        importance: ImportanceLevel.HIGH,
        importance_score: 0.95,
        tags: ['important', 'test'],
        is_deleted: false,
        authContext: {
          sessionId: 'session-123',
          authMethod: 'oauth',
          permissions: ['read', 'write'],
          issuedAt: new Date().toISOString()
        }
      };

      expect(baseMetadata).toHaveProperty('schemaVersion', '1.0.0');
      expect(baseMetadata).toHaveProperty('importance', ImportanceLevel.HIGH);
      expect(baseMetadata).toHaveProperty('importance_score', 0.95);
      expect(baseMetadata).toHaveProperty('tags', ['important', 'test']);
      expect(baseMetadata).toHaveProperty('is_deleted', false);
      expect(baseMetadata.authContext).toHaveProperty('sessionId', 'session-123');
    });
  });

  describe('ThreadInfo', () => {
    test('should have the correct structure with required and optional fields', () => {
      const threadInfo: ThreadInfo = {
        id: 'thread-123',
        position: 5,
        parentId: 'thread-parent'
      };

      expect(threadInfo).toHaveProperty('id', 'thread-123');
      expect(threadInfo).toHaveProperty('position', 5);
      expect(threadInfo).toHaveProperty('parentId', 'thread-parent');
    });
  });

  describe('MessageMetadata', () => {
    test('should have the correct structure with required and optional fields', () => {
      const userId = createUserId('user-123');
      const agentId = createAgentId('agent-123');
      const chatId = createChatId('chat-123');
      const senderAgentId = createAgentId('sender-123');
      const receiverAgentId = createAgentId('receiver-123');
      
      const threadInfo: ThreadInfo = {
        id: 'thread-123',
        position: 2
      };
      
      const attachment: MessageAttachment = {
        type: 'image',
        url: 'https://example.com/image.jpg',
        filename: 'image.jpg',
        contentType: 'image/jpeg'
      };
      
      const messageMetadata: MessageMetadata = {
        schemaVersion: '1.0.0',
        role: MessageRole.ASSISTANT,
        userId,
        agentId,
        chatId,
        thread: threadInfo,
        messageType: 'chat',
        attachments: [attachment],
        source: 'web-interface',
        category: 'general',
        senderAgentId,
        receiverAgentId,
        communicationType: 'request',
        priority: MessagePriority.HIGH,
        requiresResponse: true,
        responseDeadline: new Date().toISOString(),
        conversationContext: {
          purpose: 'information-retrieval',
          sharedContext: { topic: 'metadata-system' }
        }
      };

      expect(messageMetadata).toHaveProperty('schemaVersion', '1.0.0');
      expect(messageMetadata).toHaveProperty('role', MessageRole.ASSISTANT);
      expect(messageMetadata).toHaveProperty('userId', userId);
      expect(messageMetadata).toHaveProperty('agentId', agentId);
      expect(messageMetadata).toHaveProperty('chatId', chatId);
      expect(messageMetadata).toHaveProperty('thread', threadInfo);
      expect(messageMetadata.thread).toHaveProperty('id', 'thread-123');
      expect(messageMetadata).toHaveProperty('messageType', 'chat');
      expect(messageMetadata.attachments?.[0]).toEqual(attachment);
      expect(messageMetadata).toHaveProperty('senderAgentId', senderAgentId);
      expect(messageMetadata).toHaveProperty('receiverAgentId', receiverAgentId);
      expect(messageMetadata).toHaveProperty('communicationType', 'request');
      expect(messageMetadata).toHaveProperty('priority', MessagePriority.HIGH);
      expect(messageMetadata).toHaveProperty('requiresResponse', true);
      expect(messageMetadata.conversationContext).toHaveProperty('purpose', 'information-retrieval');
    });
  });

  describe('CognitiveProcessMetadata', () => {
    test('should have the correct structure for base cognitive process metadata', () => {
      const agentId = createAgentId('agent-123');
      
      const cognitiveMetadata: CognitiveProcessMetadata = {
        schemaVersion: '1.0.0',
        processType: CognitiveProcessType.THOUGHT,
        agentId,
        contextId: 'context-123',
        relatedTo: ['memory-1', 'memory-2'],
        influences: ['memory-3'],
        influencedBy: ['memory-4'],
        source: 'reasoning-engine',
        category: 'decision-support'
      };

      expect(cognitiveMetadata).toHaveProperty('schemaVersion', '1.0.0');
      expect(cognitiveMetadata).toHaveProperty('processType', CognitiveProcessType.THOUGHT);
      expect(cognitiveMetadata).toHaveProperty('agentId', agentId);
      expect(cognitiveMetadata).toHaveProperty('contextId', 'context-123');
      expect(cognitiveMetadata).toHaveProperty('relatedTo', ['memory-1', 'memory-2']);
      expect(cognitiveMetadata).toHaveProperty('influences', ['memory-3']);
      expect(cognitiveMetadata).toHaveProperty('influencedBy', ['memory-4']);
      expect(cognitiveMetadata).toHaveProperty('source', 'reasoning-engine');
      expect(cognitiveMetadata).toHaveProperty('category', 'decision-support');
    });

    test('should have the correct structure for ThoughtMetadata', () => {
      const agentId = createAgentId('agent-123');
      
      const thoughtMetadata: ThoughtMetadata = {
        schemaVersion: '1.0.0',
        processType: CognitiveProcessType.THOUGHT,
        agentId,
        intention: 'problem-solving',
        confidenceScore: 0.85
      };

      expect(thoughtMetadata).toHaveProperty('schemaVersion', '1.0.0');
      expect(thoughtMetadata).toHaveProperty('processType', CognitiveProcessType.THOUGHT);
      expect(thoughtMetadata).toHaveProperty('agentId', agentId);
      expect(thoughtMetadata).toHaveProperty('intention', 'problem-solving');
      expect(thoughtMetadata).toHaveProperty('confidenceScore', 0.85);
    });

    test('should have the correct structure for ReflectionMetadata', () => {
      const agentId = createAgentId('agent-123');
      
      const reflectionMetadata: ReflectionMetadata = {
        schemaVersion: '1.0.0',
        processType: CognitiveProcessType.REFLECTION,
        agentId,
        reflectionType: 'performance',
        timeScope: 'short-term'
      };

      expect(reflectionMetadata).toHaveProperty('schemaVersion', '1.0.0');
      expect(reflectionMetadata).toHaveProperty('processType', CognitiveProcessType.REFLECTION);
      expect(reflectionMetadata).toHaveProperty('agentId', agentId);
      expect(reflectionMetadata).toHaveProperty('reflectionType', 'performance');
      expect(reflectionMetadata).toHaveProperty('timeScope', 'short-term');
    });

    test('should have the correct structure for InsightMetadata', () => {
      const agentId = createAgentId('agent-123');
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      
      const insightMetadata: InsightMetadata = {
        schemaVersion: '1.0.0',
        processType: CognitiveProcessType.INSIGHT,
        agentId,
        insightType: 'pattern',
        applicationContext: ['finance', 'trading'],
        validityPeriod: {
          from: now.toISOString(),
          to: tomorrow.toISOString()
        }
      };

      expect(insightMetadata).toHaveProperty('schemaVersion', '1.0.0');
      expect(insightMetadata).toHaveProperty('processType', CognitiveProcessType.INSIGHT);
      expect(insightMetadata).toHaveProperty('agentId', agentId);
      expect(insightMetadata).toHaveProperty('insightType', 'pattern');
      expect(insightMetadata).toHaveProperty('applicationContext', ['finance', 'trading']);
      expect(insightMetadata.validityPeriod).toHaveProperty('from');
      expect(insightMetadata.validityPeriod).toHaveProperty('to');
    });

    test('should have the correct structure for PlanningMetadata', () => {
      const agentId = createAgentId('agent-123');
      
      const planningMetadata: PlanningMetadata = {
        schemaVersion: '1.0.0',
        processType: CognitiveProcessType.PLANNING,
        agentId,
        planType: 'task',
        estimatedSteps: 5,
        dependsOn: ['task-1', 'task-2']
      };

      expect(planningMetadata).toHaveProperty('schemaVersion', '1.0.0');
      expect(planningMetadata).toHaveProperty('processType', CognitiveProcessType.PLANNING);
      expect(planningMetadata).toHaveProperty('agentId', agentId);
      expect(planningMetadata).toHaveProperty('planType', 'task');
      expect(planningMetadata).toHaveProperty('estimatedSteps', 5);
      expect(planningMetadata).toHaveProperty('dependsOn', ['task-1', 'task-2']);
    });
  });

  describe('DocumentMetadata', () => {
    test('should have the correct structure for DocumentMetadata', () => {
      const userId = createUserId('user-123');
      const agentId = createAgentId('agent-123');
      
      const documentMetadata: DocumentMetadata = {
        schemaVersion: '1.0.0',
        title: 'Important Document',
        source: DocumentSource.FILE,
        contentType: 'application/pdf',
        fileType: 'pdf',
        url: 'https://example.com/document.pdf',
        userId,
        agentId,
        chunkIndex: 1,
        totalChunks: 5,
        parentDocumentId: 'parent-doc-123',
        fileSize: 1024 * 1024,
        fileName: 'document.pdf',
        lastModified: new Date().toISOString(),
        siteName: 'Example Site',
        author: 'John Doe',
        publishDate: new Date().toISOString()
      };

      expect(documentMetadata).toHaveProperty('schemaVersion', '1.0.0');
      expect(documentMetadata).toHaveProperty('title', 'Important Document');
      expect(documentMetadata).toHaveProperty('source', DocumentSource.FILE);
      expect(documentMetadata).toHaveProperty('contentType', 'application/pdf');
      expect(documentMetadata).toHaveProperty('fileType', 'pdf');
      expect(documentMetadata).toHaveProperty('url', 'https://example.com/document.pdf');
      expect(documentMetadata).toHaveProperty('userId', userId);
      expect(documentMetadata).toHaveProperty('agentId', agentId);
      expect(documentMetadata).toHaveProperty('chunkIndex', 1);
      expect(documentMetadata).toHaveProperty('totalChunks', 5);
      expect(documentMetadata).toHaveProperty('parentDocumentId', 'parent-doc-123');
      expect(documentMetadata).toHaveProperty('fileSize', 1024 * 1024);
      expect(documentMetadata).toHaveProperty('fileName', 'document.pdf');
      expect(documentMetadata).toHaveProperty('siteName', 'Example Site');
      expect(documentMetadata).toHaveProperty('author', 'John Doe');
    });
  });

  describe('TaskMetadata', () => {
    test('should have the correct structure for TaskMetadata', () => {
      const assignedTo = createAgentId('agent-456');
      const createdBy = createUserId('user-123');
      
      const taskMetadata: TaskMetadata = {
        schemaVersion: '1.0.0',
        title: 'Important Task',
        description: 'This is an important task to complete',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        assignedTo,
        createdBy,
        dueDate: new Date().toISOString(),
        startDate: new Date().toISOString(),
        completedDate: undefined,
        parentTaskId: 'parent-task-123',
        subtaskIds: ['subtask-1', 'subtask-2'],
        dependsOn: ['task-1', 'task-2'],
        blockedBy: ['task-3']
      };

      expect(taskMetadata).toHaveProperty('schemaVersion', '1.0.0');
      expect(taskMetadata).toHaveProperty('title', 'Important Task');
      expect(taskMetadata).toHaveProperty('description', 'This is an important task to complete');
      expect(taskMetadata).toHaveProperty('status', TaskStatus.IN_PROGRESS);
      expect(taskMetadata).toHaveProperty('priority', TaskPriority.HIGH);
      expect(taskMetadata).toHaveProperty('assignedTo', assignedTo);
      expect(taskMetadata).toHaveProperty('createdBy', createdBy);
      expect(taskMetadata).toHaveProperty('dueDate');
      expect(taskMetadata).toHaveProperty('startDate');
      expect(taskMetadata.completedDate).toBeUndefined();
      expect(taskMetadata).toHaveProperty('parentTaskId', 'parent-task-123');
      expect(taskMetadata).toHaveProperty('subtaskIds', ['subtask-1', 'subtask-2']);
      expect(taskMetadata).toHaveProperty('dependsOn', ['task-1', 'task-2']);
      expect(taskMetadata).toHaveProperty('blockedBy', ['task-3']);
    });
  });

  describe('Enums', () => {
    test('should have the expected values for CognitiveProcessType', () => {
      expect(CognitiveProcessType.THOUGHT).toBe('thought');
      expect(CognitiveProcessType.REFLECTION).toBe('reflection');
      expect(CognitiveProcessType.INSIGHT).toBe('insight');
      expect(CognitiveProcessType.PLANNING).toBe('planning');
      expect(CognitiveProcessType.EVALUATION).toBe('evaluation');
      expect(CognitiveProcessType.DECISION).toBe('decision');
    });

    test('should have the expected values for DocumentSource', () => {
      expect(DocumentSource.FILE).toBe('file');
      expect(DocumentSource.WEB).toBe('web');
      expect(DocumentSource.API).toBe('api');
      expect(DocumentSource.USER).toBe('user');
      expect(DocumentSource.AGENT).toBe('agent');
      expect(DocumentSource.TOOL).toBe('tool');
      expect(DocumentSource.SYSTEM).toBe('system');
    });

    test('should have the expected values for TaskStatus', () => {
      expect(TaskStatus.PENDING).toBe('pending');
      expect(TaskStatus.IN_PROGRESS).toBe('in_progress');
      expect(TaskStatus.COMPLETED).toBe('completed');
      expect(TaskStatus.CANCELLED).toBe('cancelled');
      expect(TaskStatus.FAILED).toBe('failed');
    });

    test('should have the expected values for TaskPriority', () => {
      expect(TaskPriority.LOW).toBe('low');
      expect(TaskPriority.MEDIUM).toBe('medium');
      expect(TaskPriority.HIGH).toBe('high');
      expect(TaskPriority.URGENT).toBe('urgent');
    });

    test('should have the expected values for MessagePriority', () => {
      expect(MessagePriority.LOW).toBe('low');
      expect(MessagePriority.NORMAL).toBe('normal');
      expect(MessagePriority.HIGH).toBe('high');
      expect(MessagePriority.URGENT).toBe('urgent');
    });
  });

  describe('MetadataField enum', () => {
    test('should have all the expected fields', () => {
      // Test some core fields
      expect(MetadataField.SCHEMA_VERSION).toBe('schemaVersion');
      expect(MetadataField.IMPORTANCE).toBe('importance');
      expect(MetadataField.IMPORTANCE_SCORE).toBe('importance_score');
      expect(MetadataField.TAGS).toBe('tags');
      
      // Test some message fields
      expect(MetadataField.ROLE).toBe('role');
      expect(MetadataField.USER_ID).toBe('userId');
      expect(MetadataField.AGENT_ID).toBe('agentId');
      expect(MetadataField.CHAT_ID).toBe('chatId');
      expect(MetadataField.THREAD).toBe('thread');
      
      // Test some cognitive process fields
      expect(MetadataField.PROCESS_TYPE).toBe('processType');
      expect(MetadataField.CONTEXT_ID).toBe('contextId');
      expect(MetadataField.RELATED_TO).toBe('relatedTo');
      
      // Test some document fields
      expect(MetadataField.TITLE).toBe('title');
      expect(MetadataField.FILE_NAME).toBe('fileName');
      expect(MetadataField.AUTHOR).toBe('author');
      
      // Test some task fields
      expect(MetadataField.STATUS).toBe('status');
      expect(MetadataField.ASSIGNED_TO).toBe('assignedTo');
      expect(MetadataField.DUE_DATE).toBe('dueDate');
    });
  });

  describe('Cross-cutting concerns', () => {
    test('should have the correct structure for AuthContext', () => {
      const authContext: AuthContext = {
        sessionId: 'session-123',
        authMethod: 'oauth',
        permissions: ['read', 'write'],
        expiresAt: new Date().toISOString(),
        issuedAt: new Date().toISOString()
      };

      expect(authContext).toHaveProperty('sessionId', 'session-123');
      expect(authContext).toHaveProperty('authMethod', 'oauth');
      expect(authContext).toHaveProperty('permissions', ['read', 'write']);
      expect(authContext).toHaveProperty('expiresAt');
      expect(authContext).toHaveProperty('issuedAt');
    });

    test('should have the correct structure for TenantContext', () => {
      const tenantContext: TenantContext = {
        tenantId: 'tenant-123',
        dataPolicies: {
          retention: 90,
          encryption: true,
          classificationLevel: 'confidential'
        }
      };

      expect(tenantContext).toHaveProperty('tenantId', 'tenant-123');
      expect(tenantContext.dataPolicies).toHaveProperty('retention', 90);
      expect(tenantContext.dataPolicies).toHaveProperty('encryption', true);
      expect(tenantContext.dataPolicies).toHaveProperty('classificationLevel', 'confidential');
    });

    test('should have the correct structure for PerformanceDirectives', () => {
      const performanceDirectives: PerformanceDirectives = {
        indexPriority: 'high',
        cacheTTL: 3600,
        partitionKey: 'userId',
        denyList: ['sensitiveField1', 'sensitiveField2']
      };

      expect(performanceDirectives).toHaveProperty('indexPriority', 'high');
      expect(performanceDirectives).toHaveProperty('cacheTTL', 3600);
      expect(performanceDirectives).toHaveProperty('partitionKey', 'userId');
      expect(performanceDirectives).toHaveProperty('denyList', ['sensitiveField1', 'sensitiveField2']);
    });
  });
}); 