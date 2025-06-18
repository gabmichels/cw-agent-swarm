/**
 * Unit tests for metadata-helpers.ts
 */

import { describe, test, expect, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  createBaseMetadata,
  validateBaseMetadata,
  applyPerformanceDirectives,
  createThreadInfo,
  validateThreadInfo,
  createMessageMetadata,
  validateMessageMetadata,
  createAgentToAgentMessageMetadata,
  createCognitiveProcessMetadata,
  validateCognitiveProcessMetadata,
  createThoughtMetadata,
  createReflectionMetadata,
  createInsightMetadata,
  createPlanningMetadata,
  createDocumentMetadata,
  createTaskMetadata,
  createAuthContext,
  createTenantContext,
  CURRENT_SCHEMA_VERSION
} from '../metadata-helpers';
import { 
  MetadataField,
  CognitiveProcessType,
  DocumentSource,
  TaskStatus,
  TaskPriority,
  MessagePriority,
  BaseMetadata,
  ThreadInfo
} from '../../../../../types/metadata';
import { MessageRole } from '../../../../../agents/shared/types/MessageTypes';
import { ImportanceLevel } from '../../../../../constants/memory';
import { 
  createUserId, 
  createAgentId, 
  createChatId,
  StructuredId 
} from '../../../../../types/entity-identifier';

// Mock UUID generation for predictable tests
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-12345')
}));

describe('Metadata Helpers', () => {
  describe('Base Metadata Helpers', () => {
    test('createBaseMetadata should create base metadata with default schema version', () => {
      const baseMetadata = createBaseMetadata();
      
      expect(baseMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION
      });
    });

    test('createBaseMetadata should include provided options', () => {
      const baseMetadata = createBaseMetadata({
        importance: ImportanceLevel.HIGH,
        tags: ['important', 'test']
      });
      
      expect(baseMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        importance: ImportanceLevel.HIGH,
        tags: ['important', 'test']
      });
    });

    test('validateBaseMetadata should apply default schema version if missing', () => {
      const baseMetadata = validateBaseMetadata({
        importance: ImportanceLevel.HIGH
      });
      
      expect(baseMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        importance: ImportanceLevel.HIGH
      });
    });

    test('validateBaseMetadata should preserve existing schema version', () => {
      const baseMetadata = validateBaseMetadata({
        schemaVersion: '2.0.0',
        importance: ImportanceLevel.HIGH
      });
      
      expect(baseMetadata).toEqual({
        schemaVersion: '2.0.0',
        importance: ImportanceLevel.HIGH
      });
    });

    test('applyPerformanceDirectives should add performance directives to metadata', () => {
      const metadata = {
        schemaVersion: CURRENT_SCHEMA_VERSION
      } as Record<string, unknown>;
      
      const directives = {
        indexPriority: 'high' as const,
        cacheTTL: 3600
      };
      
      const result = applyPerformanceDirectives(metadata, directives);
      
      expect(result).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        performanceDirectives: directives
      });
    });
  });

  describe('Thread Info Helpers', () => {
    test('createThreadInfo should create thread info with default values', () => {
      const threadInfo = createThreadInfo();
      
      expect(threadInfo).toEqual({
        id: 'mock-uuid-12345',
        position: 0
      });
      expect(uuidv4).toHaveBeenCalled();
    });

    test('createThreadInfo should use provided values', () => {
      // Reset mock before test
      vi.mocked(uuidv4).mockClear();
      
      const threadInfo = createThreadInfo('custom-thread-id', 3, 'parent-thread-id');
      
      expect(threadInfo).toEqual({
        id: 'custom-thread-id',
        position: 3,
        parentId: 'parent-thread-id'
      });
      expect(uuidv4).not.toHaveBeenCalled();
    });

    test('validateThreadInfo should throw error if id is missing', () => {
      expect(() => validateThreadInfo({
        position: 0
      } as ThreadInfo)).toThrow('Thread ID is required');
    });

    test('validateThreadInfo should throw error if position is missing', () => {
      expect(() => validateThreadInfo({
        id: 'thread-id'
      } as ThreadInfo)).toThrow('Thread position is required');
    });

    test('validateThreadInfo should return valid thread info', () => {
      const threadInfo = validateThreadInfo({
        id: 'thread-id',
        position: 2,
        parentId: 'parent-id'
      });
      
      expect(threadInfo).toEqual({
        id: 'thread-id',
        position: 2,
        parentId: 'parent-id'
      });
    });
  });

  describe('Message Metadata Helpers', () => {
    const userId = createUserId('user-123');
    const agentId = createAgentId('agent-123');
    const chatId = createChatId('chat-123');
    const threadInfo: ThreadInfo = {
      id: 'thread-123',
      position: 0
    };

    test('createMessageMetadata should create message metadata with required fields', () => {
      const messageMetadata = createMessageMetadata(
        MessageRole.ASSISTANT,
        userId,
        agentId,
        chatId,
        threadInfo
      );
      
      expect(messageMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        role: MessageRole.ASSISTANT,
        userId,
        agentId,
        chatId,
        thread: threadInfo
      });
    });

    test('createMessageMetadata should include optional fields', () => {
      const messageMetadata = createMessageMetadata(
        MessageRole.ASSISTANT,
        userId,
        agentId,
        chatId,
        threadInfo,
        {
          messageType: 'chat',
          source: 'web-interface',
          importance: ImportanceLevel.HIGH
        }
      );
      
      expect(messageMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        role: MessageRole.ASSISTANT,
        userId,
        agentId,
        chatId,
        thread: threadInfo,
        messageType: 'chat',
        source: 'web-interface',
        importance: ImportanceLevel.HIGH
      });
    });

    test('validateMessageMetadata should throw error if required fields are missing', () => {
      // Missing role
      expect(() => validateMessageMetadata({
        userId,
        agentId,
        chatId,
        thread: threadInfo
      })).toThrow(`Missing required field: ${MetadataField.ROLE}`);

      // Missing userId
      expect(() => validateMessageMetadata({
        role: MessageRole.ASSISTANT,
        agentId,
        chatId,
        thread: threadInfo
      })).toThrow(`Missing required field: ${MetadataField.USER_ID}`);

      // Missing agentId
      expect(() => validateMessageMetadata({
        role: MessageRole.ASSISTANT,
        userId,
        chatId,
        thread: threadInfo
      })).toThrow(`Missing required field: ${MetadataField.AGENT_ID}`);

      // Missing chatId
      expect(() => validateMessageMetadata({
        role: MessageRole.ASSISTANT,
        userId,
        agentId,
        thread: threadInfo
      })).toThrow(`Missing required field: ${MetadataField.CHAT_ID}`);

      // Missing thread
      expect(() => validateMessageMetadata({
        role: MessageRole.ASSISTANT,
        userId,
        agentId,
        chatId
      })).toThrow(`Missing required field: ${MetadataField.THREAD}`);
    });

    test('createAgentToAgentMessageMetadata should create agent-to-agent message metadata', () => {
      const senderAgentId = createAgentId('sender-123');
      const receiverAgentId = createAgentId('receiver-123');
      
      const messageMetadata = createAgentToAgentMessageMetadata(
        senderAgentId,
        receiverAgentId,
        chatId,
        threadInfo,
        {
          communicationType: 'request',
          priority: MessagePriority.HIGH,
          requiresResponse: true
        }
      );
      
      expect(messageMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        role: MessageRole.ASSISTANT, // Default role for agent-to-agent
        userId: expect.any(Object), // System user
        agentId: senderAgentId,
        chatId,
        thread: threadInfo,
        senderAgentId,
        receiverAgentId,
        communicationType: 'request',
        priority: MessagePriority.HIGH,
        requiresResponse: true,
        messageType: 'agent-communication'
      });
    });
  });

  describe('Cognitive Process Metadata Helpers', () => {
    const agentId = createAgentId('agent-123');

    test('createCognitiveProcessMetadata should create base cognitive process metadata', () => {
      const cognitiveMetadata = createCognitiveProcessMetadata(
        CognitiveProcessType.THOUGHT,
        agentId
      );
      
      expect(cognitiveMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        processType: CognitiveProcessType.THOUGHT,
        agentId
      });
    });

    test('validateCognitiveProcessMetadata should throw error if required fields are missing', () => {
      // Missing agentId
      expect(() => validateCognitiveProcessMetadata({
        processType: CognitiveProcessType.THOUGHT
      })).toThrow(`Missing required field: ${MetadataField.AGENT_ID}`);
    });

    test('createThoughtMetadata should create thought metadata', () => {
      const thoughtMetadata = createThoughtMetadata(
        agentId,
        {
          intention: 'problem-solving',
          confidenceScore: 0.85
        }
      );
      
      expect(thoughtMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        processType: CognitiveProcessType.THOUGHT,
        agentId,
        intention: 'problem-solving',
        confidenceScore: 0.85
      });
    });

    test('createReflectionMetadata should create reflection metadata', () => {
      const reflectionMetadata = createReflectionMetadata(
        agentId,
        {
          reflectionType: 'performance',
          timeScope: 'short-term'
        }
      );
      
      expect(reflectionMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        processType: CognitiveProcessType.REFLECTION,
        agentId,
        reflectionType: 'performance',
        timeScope: 'short-term'
      });
    });

    test('createInsightMetadata should create insight metadata', () => {
      const insightMetadata = createInsightMetadata(
        agentId,
        {
          insightType: 'pattern',
          applicationContext: ['finance', 'trading']
        }
      );
      
      expect(insightMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        processType: CognitiveProcessType.INSIGHT,
        agentId,
        insightType: 'pattern',
        applicationContext: ['finance', 'trading']
      });
    });

    test('createPlanningMetadata should create planning metadata', () => {
      const planningMetadata = createPlanningMetadata(
        agentId,
        {
          planType: 'task',
          estimatedSteps: 5,
          dependsOn: ['task-1', 'task-2']
        }
      );
      
      expect(planningMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        processType: CognitiveProcessType.PLANNING,
        agentId,
        planType: 'task',
        estimatedSteps: 5,
        dependsOn: ['task-1', 'task-2']
      });
    });
  });

  describe('Document Metadata Helpers', () => {
    test('createDocumentMetadata should create document metadata with required fields', () => {
      const documentMetadata = createDocumentMetadata(
        DocumentSource.FILE
      );
      
      expect(documentMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        source: DocumentSource.FILE
      });
    });

    test('createDocumentMetadata should include optional fields', () => {
      const userId = createUserId('user-123');
      const documentMetadata = createDocumentMetadata(
        DocumentSource.FILE,
        {
          title: 'Important Document',
          contentType: 'application/pdf',
          fileType: 'pdf',
          userId,
          fileName: 'document.pdf'
        }
      );
      
      expect(documentMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        source: DocumentSource.FILE,
        title: 'Important Document',
        contentType: 'application/pdf',
        fileType: 'pdf',
        userId,
        fileName: 'document.pdf'
      });
    });
  });

  describe('Task Metadata Helpers', () => {
    test('createTaskMetadata should create task metadata with required fields', () => {
      const createdBy = createUserId('user-123');
      
      const taskMetadata = createTaskMetadata(
        'Important Task',
        TaskStatus.PENDING,
        TaskPriority.HIGH,
        createdBy
      );
      
      expect(taskMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        title: 'Important Task',
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        createdBy
      });
    });

    test('createTaskMetadata should include optional fields', () => {
      const createdBy = createUserId('user-123');
      const assignedTo = createAgentId('agent-123');
      
      const taskMetadata = createTaskMetadata(
        'Important Task',
        TaskStatus.IN_PROGRESS,
        TaskPriority.HIGH,
        createdBy,
        {
          description: 'This is an important task',
          assignedTo,
          dueDate: '2025-12-31T23:59:59Z',
          parentTaskId: 'parent-task-123'
        }
      );
      
      expect(taskMetadata).toEqual({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        title: 'Important Task',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        createdBy,
        description: 'This is an important task',
        assignedTo,
        dueDate: '2025-12-31T23:59:59Z',
        parentTaskId: 'parent-task-123'
      });
    });
  });

  describe('Cross-cutting Concerns Helpers', () => {
    test('createAuthContext should create authentication context', () => {
      const authContext = createAuthContext(
        'session-123',
        'oauth',
        ['read', 'write']
      );
      
      expect(authContext).toEqual({
        sessionId: 'session-123',
        authMethod: 'oauth',
        permissions: ['read', 'write'],
        issuedAt: expect.any(String)
      });
    });

    test('createAuthContext should include optional fields', () => {
      const now = new Date().toISOString();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expiresAt = tomorrow.toISOString();
      
      const authContext = createAuthContext(
        'session-123',
        'jwt',
        ['read', 'write'],
        {
          expiresAt,
          issuedAt: now
        }
      );
      
      expect(authContext).toEqual({
        sessionId: 'session-123',
        authMethod: 'jwt',
        permissions: ['read', 'write'],
        expiresAt,
        issuedAt: now
      });
    });

    test('createTenantContext should create tenant context', () => {
      const tenantContext = createTenantContext(
        'tenant-123'
      );
      
      expect(tenantContext).toEqual({
        tenantId: 'tenant-123',
        dataPolicies: {
          retention: 365,
          encryption: true,
          classificationLevel: 'internal'
        }
      });
    });

    test('createTenantContext should include optional fields', () => {
      const tenantContext = createTenantContext(
        'tenant-123',
        {
          retention: 90,
          encryption: true,
          classificationLevel: 'confidential'
        }
      );
      
      expect(tenantContext).toEqual({
        tenantId: 'tenant-123',
        dataPolicies: {
          retention: 90,
          encryption: true,
          classificationLevel: 'confidential'
        }
      });
    });
  });
}); 