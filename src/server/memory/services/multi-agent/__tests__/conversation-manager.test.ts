/**
 * ConversationManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationManager, Message, ConversationOptions } from '../conversation-manager';
import { ChatMemoryEntity, ChatStatus, ChatParticipantRole, ChatPermission } from '../../../schema/chat';
import { IdGenerator } from '../../../../../utils/ulid';
import { Result } from '../../../../../lib/errors/base';
import { SchemaType } from '../../../schema/types';
import { IMemoryRepository } from '../../base/types';

// Create the repository functions with proper typing
const mockCreate = vi.fn<Parameters<IMemoryRepository<ChatMemoryEntity>['create']>, ReturnType<IMemoryRepository<ChatMemoryEntity>['create']>>();
const mockGetById = vi.fn<Parameters<IMemoryRepository<ChatMemoryEntity>['getById']>, ReturnType<IMemoryRepository<ChatMemoryEntity>['getById']>>();
const mockUpdate = vi.fn<Parameters<IMemoryRepository<ChatMemoryEntity>['update']>, ReturnType<IMemoryRepository<ChatMemoryEntity>['update']>>();
const mockDelete = vi.fn<Parameters<IMemoryRepository<ChatMemoryEntity>['delete']>, ReturnType<IMemoryRepository<ChatMemoryEntity>['delete']>>();
const mockSearch = vi.fn<Parameters<IMemoryRepository<ChatMemoryEntity>['search']>, ReturnType<IMemoryRepository<ChatMemoryEntity>['search']>>();
const mockSearchByVector = vi.fn<Parameters<IMemoryRepository<ChatMemoryEntity>['searchByVector']>, ReturnType<IMemoryRepository<ChatMemoryEntity>['searchByVector']>>();
const mockFilter = vi.fn<Parameters<IMemoryRepository<ChatMemoryEntity>['filter']>, ReturnType<IMemoryRepository<ChatMemoryEntity>['filter']>>();
const mockGetAll = vi.fn<Parameters<IMemoryRepository<ChatMemoryEntity>['getAll']>, ReturnType<IMemoryRepository<ChatMemoryEntity>['getAll']>>();
const mockCount = vi.fn<Parameters<IMemoryRepository<ChatMemoryEntity>['count']>, ReturnType<IMemoryRepository<ChatMemoryEntity>['count']>>();
const mockExists = vi.fn<Parameters<IMemoryRepository<ChatMemoryEntity>['exists']>, ReturnType<IMemoryRepository<ChatMemoryEntity>['exists']>>();

// Create a mock repository
const mockRepository: IMemoryRepository<ChatMemoryEntity> = {
  create: mockCreate,
  getById: mockGetById,
  update: mockUpdate,
  delete: mockDelete,
  search: mockSearch,
  searchByVector: mockSearchByVector,
  filter: mockFilter,
  getAll: mockGetAll,
  count: mockCount,
  exists: mockExists,
  schema: {
    name: 'chat',
    jsonSchema: {},
    isValid: (data: unknown): data is ChatMemoryEntity => true,
    validate: vi.fn(),
    getDefaults: vi.fn(),
    create: vi.fn(),
    type: SchemaType.ENTITY,
    version: { 
      major: 1, 
      minor: 0, 
      toString: () => 'v1.0',
      isNewerThan: () => false,
      isCompatibleWith: () => true
    }
  },
  collectionName: 'chats'
};

// Mock the IdGenerator
vi.mock('../../../../../utils/ulid', () => ({
  IdGenerator: {
    generate: vi.fn().mockImplementation((prefix) => {
      return {
        id: `test-${prefix}-id`,
        prefix,
        timestamp: new Date(),
        toString: () => `${prefix}_test-${prefix}-id`,
        toULID: () => `test-${prefix}-id`,
        getTimestamp: () => new Date()
      };
    })
  }
}));

describe('ConversationManager', () => {
  let conversationManager: ConversationManager;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create new conversation manager instance
    conversationManager = new ConversationManager(mockRepository);
    
    // Mock the repository create method
    mockCreate.mockImplementation(async (data) => {
      const id = IdGenerator.generate('chat').toString();
      return {
        ...data,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: 'v1.0'
      };
    });
    
    // Mock the repository getById method
    mockGetById.mockImplementation(async (id) => {
      if (id === 'non-existent-id') {
        return null;
      }
      
      const now = new Date();
      const chatId = typeof id === 'string' ? id : id.toString();
      return {
        id: chatId,
        name: 'Test Chat',
        description: 'Test chat description',
        purpose: 'Testing',
        createdBy: 'test-user',
        participants: [
          {
            id: 'test-user',
            type: 'user',
            role: ChatParticipantRole.OWNER,
            joinedAt: now,
            lastActiveAt: now,
            permissions: [
              ChatPermission.READ,
              ChatPermission.WRITE,
              ChatPermission.INVITE,
              ChatPermission.REMOVE,
              ChatPermission.MANAGE
            ]
          }
        ],
        settings: {
          visibility: 'private',
          allowAnonymousMessages: false,
          enableBranching: true,
          recordTranscript: true
        },
        status: ChatStatus.ACTIVE,
        lastMessageAt: now,
        messageCount: 0,
        contextIds: [],
        content: 'Test chat description',
        type: 'chat',
        createdAt: now,
        updatedAt: now,
        schemaVersion: 'v1.0',
        metadata: {
          tags: [],
          category: [],
          priority: 'medium',
          sensitivity: 'internal',
          language: ['en'],
          version: '1.0.0'
        }
      };
    });
    
    // Mock the repository update method
    mockUpdate.mockImplementation(async (id, data) => {
      const existingChat = await mockGetById(id);
      if (!existingChat) return null;
      
      return {
        ...existingChat,
        ...data,
        updatedAt: new Date()
      };
    });
  });
  
  describe('createConversation', () => {
    it('should create a conversation with the provided options', async () => {
      // Arrange
      const options: ConversationOptions = {
        name: 'Test Conversation',
        description: 'Test conversation description',
        purpose: 'Testing the conversation manager',
        visibility: 'private',
        enableBranching: true,
        recordTranscript: true,
        metadata: {
          tags: ['test', 'conversation'],
          priority: 'high'
        }
      };
      
      // Act
      const result = await conversationManager.createConversation(options, 'test-user');
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.name).toBe(options.name);
        expect(result.data.description).toBe(options.description);
        expect(result.data.purpose).toBe(options.purpose);
        expect(result.data.createdBy).toBe('test-user');
        expect(result.data.participants.length).toBeGreaterThan(0);
        expect(result.data.settings.visibility).toBe('private');
        expect(result.data.settings.enableBranching).toBe(true);
        expect(result.data.settings.recordTranscript).toBe(true);
        expect(result.data.status).toBe(ChatStatus.ACTIVE);
      }
      
      // Verify IdGenerator and repository were called correctly
      expect(IdGenerator.generate).toHaveBeenCalledWith('chat');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
    
    it('should use default values when minimal options are provided', async () => {
      // Arrange
      const options: ConversationOptions = {
        name: 'Minimal Conversation'
      };
      
      // Act
      const result = await conversationManager.createConversation(options);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.name).toBe('Minimal Conversation');
        expect(result.data.description).toBe('');
        expect(result.data.purpose).toBe('Minimal Conversation');
        expect(result.data.createdBy).toBe('system');
        expect(result.data.settings.visibility).toBe('private');
        expect(result.data.settings.enableBranching).toBe(false);
        expect(result.data.settings.recordTranscript).toBe(true);
      }
    });
  });
  
  describe('addMessage', () => {
    it('should add a message to a conversation', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const message = {
        content: 'Test message content',
        senderId: 'test-user',
        senderType: 'user' as const
      };
      
      // Act
      const result = await conversationManager.addMessage(chatId, message);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.id).toBeDefined();
        expect(result.data.content).toBe(message.content);
        expect(result.data.senderId).toBe(message.senderId);
        expect(result.data.senderType).toBe(message.senderType);
        expect(result.data.timestamp).toBeDefined();
      }
      
      // Verify repository was called to update the chat
      expect(mockUpdate).toHaveBeenCalled();
    });
    
    it('should support adding a message with metadata and thread info', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const message = {
        content: 'Test threaded message',
        senderId: 'test-user',
        senderType: 'user' as const,
        threadId: 'test-thread-id',
        metadata: { 
          importance: 'high',
          tags: ['urgent', 'action-required']
        }
      };
      
      // Act
      const result = await conversationManager.addMessage(chatId, message);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.threadId).toBe(message.threadId);
        expect(result.data.metadata).toEqual(message.metadata);
      }
    });
  });
  
  describe('getMessages', () => {
    it('should retrieve messages from a conversation', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const testMessages = [
        {
          id: 'msg1',
          content: 'First test message',
          senderId: 'test-user',
          senderType: 'user' as const,
          timestamp: new Date(Date.now() - 100000)
        },
        {
          id: 'msg2',
          content: 'Second test message',
          senderId: 'test-agent',
          senderType: 'agent' as const,
          timestamp: new Date()
        }
      ];
      
      // Add test messages to the conversation
      await conversationManager.addMessage(chatId, {
        content: testMessages[0].content,
        senderId: testMessages[0].senderId,
        senderType: testMessages[0].senderType
      });
      await conversationManager.addMessage(chatId, {
        content: testMessages[1].content,
        senderId: testMessages[1].senderId,
        senderType: testMessages[1].senderType
      });
      
      // Act
      const result = await conversationManager.getMessages(chatId);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
    });
    
    it('should apply filtering options when retrieving messages', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const userId = 'test-user';
      const agentId = 'test-agent';
      
      // Add test messages from different senders
      await conversationManager.addMessage(chatId, {
        content: 'User message 1',
        senderId: userId,
        senderType: 'user' as const
      });
      await conversationManager.addMessage(chatId, {
        content: 'Agent message',
        senderId: agentId,
        senderType: 'agent' as const
      });
      await conversationManager.addMessage(chatId, {
        content: 'User message 2',
        senderId: userId,
        senderType: 'user' as const
      });
      
      // Act - get only user messages
      const result = await conversationManager.getMessages(chatId, {
        senderId: userId
      });
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.length).toBe(2);
        expect(result.data.every(m => m.senderId === userId)).toBe(true);
      }
    });
  });
  
  describe('createThread', () => {
    it('should create a new thread in a conversation', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const subject = 'Test Thread';
      const initialMessage = {
        content: 'Initial thread message',
        senderId: 'test-user',
        senderType: 'user' as const
      };
      
      // Act
      const result = await conversationManager.createThread(
        chatId, 
        subject, 
        initialMessage
      );
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.threadId).toBeDefined();
        expect(result.data.content).toBe(initialMessage.content);
        expect(result.data.metadata?.subject).toBe(subject);
        expect(result.data.metadata?.isThreadStart).toBe(true);
      }
      
      // Verify IdGenerator was called to generate a thread ID
      expect(IdGenerator.generate).toHaveBeenCalledWith('thrd');
    });
    
    it('should fail to create a thread if branching is not enabled', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const subject = 'Test Thread';
      const initialMessage = {
        content: 'Initial thread message',
        senderId: 'test-user',
        senderType: 'user' as const
      };
      
      // Mock a chat with branching disabled
      mockGetById.mockResolvedValueOnce({
        ...(await mockGetById(chatId))!,
        settings: {
          visibility: 'private',
          allowAnonymousMessages: false,
          enableBranching: false, // Branching disabled
          recordTranscript: true
        }
      });
      
      // Act
      const result = await conversationManager.createThread(
        chatId, 
        subject, 
        initialMessage
      );
      
      // Assert
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
      expect(result.error?.message).toContain('does not allow branching');
    });
  });
  
  describe('replyToMessage', () => {
    it('should create a reply to an existing message', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      
      // Add an initial message
      const initialMessageResult = await conversationManager.addMessage(chatId, {
        content: 'Initial message to reply to',
        senderId: 'test-user',
        senderType: 'user' as const
      });
      
      const originalMessageId = initialMessageResult.data!.id;
      
      const replyMessage = {
        content: 'This is a reply',
        senderId: 'test-agent',
        senderType: 'agent' as const
      };
      
      // Act
      const result = await conversationManager.replyToMessage(
        chatId,
        originalMessageId,
        replyMessage
      );
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.content).toBe(replyMessage.content);
        expect(result.data.replyToId).toBe(originalMessageId);
        expect(result.data.threadId).toBeDefined();
      }
    });
    
    it('should fail to reply to a non-existent message', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const nonExistentMessageId = 'non-existent-message';
      
      const replyMessage = {
        content: 'This reply should fail',
        senderId: 'test-agent',
        senderType: 'agent' as const
      };
      
      // Act
      const result = await conversationManager.replyToMessage(
        chatId,
        nonExistentMessageId,
        replyMessage
      );
      
      // Assert
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });
  
  describe('exportConversation', () => {
    it('should export a conversation with all its messages', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      
      // Add some test messages
      await conversationManager.addMessage(chatId, {
        content: 'First message',
        senderId: 'test-user',
        senderType: 'user' as const
      });
      
      await conversationManager.addMessage(chatId, {
        content: 'Second message',
        senderId: 'test-agent',
        senderType: 'agent' as const
      });
      
      // Act
      const result = await conversationManager.exportConversation(chatId);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.chat).toBeDefined();
        expect(result.data.messages).toBeDefined();
        expect(result.data.messages.length).toBe(2);
      }
    });
    
    it('should fail to export a non-existent conversation', async () => {
      // Arrange
      const nonExistentChatId = 'non-existent-id';
      
      // Act
      const result = await conversationManager.exportConversation(nonExistentChatId);
      
      // Assert
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });
}); 