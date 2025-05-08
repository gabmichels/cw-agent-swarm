/**
 * ChatMemoryService Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatMemoryService } from '../chat-memory-service';
import { ChatMemoryEntity, ChatStatus, ChatParticipantRole, ChatPermission, ChatParticipant } from '../../schema/chat';
import { FilterOperator } from '../filters/types';
import { IMemoryRepository } from '../base/types';
import { StructuredId } from '../../../../utils/ulid';
import { SchemaType } from '../../schema/types';

// Create a mock repository with proper typing
const mockCreate = vi.fn();
const mockGetById = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSearch = vi.fn();
const mockSearchByVector = vi.fn();
const mockFilter = vi.fn();
const mockGetAll = vi.fn();
const mockCount = vi.fn();
const mockExists = vi.fn();

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
    isValid: vi.fn() as unknown as (data: unknown) => data is ChatMemoryEntity,
    validate: vi.fn(),
    getDefaults: vi.fn(),
    create: vi.fn(),
    type: SchemaType.ENTITY,
    version: { 
      major: 1, 
      minor: 0, 
      toString: () => 'v1.0',
      isNewerThan: vi.fn().mockReturnValue(false),
      isCompatibleWith: vi.fn().mockReturnValue(true)
    }
  },
  collectionName: 'chats'
};

// Mock the StructuredId class/functions with proper methods
const mockStructuredId = {
  id: 'test-chat-id',
  prefix: 'chat',
  timestamp: new Date(),
  toString: () => 'chat_test-chat-id',
  toULID: () => 'test-chat-id',
  getTimestamp: () => new Date()
} as unknown as StructuredId;

describe('ChatMemoryService', () => {
  let chatMemoryService: ChatMemoryService;
  const now = new Date();
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create new service instance
    chatMemoryService = new ChatMemoryService(mockRepository);
    
    // Setup mock responses
    mockFilter.mockResolvedValue([
      {
        id: mockStructuredId,
        name: 'Test Chat',
        status: ChatStatus.ACTIVE,
        participants: [
          {
            id: 'user_123',
            type: 'user',
            role: ChatParticipantRole.OWNER,
            joinedAt: now,
            lastActiveAt: now,
            permissions: [ChatPermission.READ, ChatPermission.WRITE]
          },
          {
            id: 'agent_456',
            type: 'agent',
            role: ChatParticipantRole.MEMBER,
            joinedAt: now,
            lastActiveAt: now,
            permissions: [ChatPermission.READ, ChatPermission.WRITE]
          }
        ],
        settings: {
          visibility: 'private',
          allowAnonymousMessages: false,
          enableBranching: true,
          recordTranscript: true
        },
        purpose: 'Testing',
        messageCount: 10,
        lastMessageAt: now,
        metadata: {
          tags: ['test', 'discussion'],
          category: ['general'],
          priority: 'medium',
          sensitivity: 'internal',
          language: ['en'],
          version: '1.0.0'
        }
      },
      {
        id: { 
          id: 'test-chat-id-2',
          prefix: 'chat',
          timestamp: now,
          toString: () => 'chat_test-chat-id-2',
          toULID: () => 'test-chat-id-2',
          getTimestamp: () => now
        } as unknown as StructuredId,
        name: 'Another Chat',
        status: ChatStatus.ACTIVE,
        participants: [
          {
            id: 'user_123',
            type: 'user',
            role: ChatParticipantRole.OWNER,
            joinedAt: now,
            lastActiveAt: now,
            permissions: [ChatPermission.READ, ChatPermission.WRITE]
          }
        ],
        purpose: 'Another test chat',
        messageCount: 5,
        lastMessageAt: now,
        metadata: {
          tags: ['test'],
          category: ['support'],
          priority: 'high',
          sensitivity: 'internal',
          language: ['en'],
          version: '1.0.0'
        }
      }
    ]);
    
    mockSearch.mockResolvedValue([
      {
        id: mockStructuredId,
        name: 'Test Chat',
        participants: [
          {
            id: 'user_123',
            type: 'user',
            role: ChatParticipantRole.OWNER,
            joinedAt: now,
            lastActiveAt: now,
            permissions: [ChatPermission.READ, ChatPermission.WRITE]
          }
        ]
      }
    ]);
    
    mockUpdate.mockImplementation(async (id: string | StructuredId, updates: Partial<ChatMemoryEntity>) => {
      return {
        id: typeof id === 'string' ? { 
          id, 
          prefix: 'chat',
          timestamp: now,
          toString: () => `chat_${id}`,
          toULID: () => id,
          getTimestamp: () => now
        } as unknown as StructuredId : id,
        name: 'Test Chat',
        ...updates
      };
    });
    
    mockGetById.mockImplementation(async (id: string | StructuredId) => {
      if (id === 'non-existent-id' || id.toString() === 'non-existent-id') {
        return null;
      }
      
      return {
        id: typeof id === 'string' ? { 
          id, 
          prefix: 'chat',
          timestamp: now,
          toString: () => `chat_${id}`,
          toULID: () => id,
          getTimestamp: () => now
        } as unknown as StructuredId : id,
        name: 'Test Chat',
        participants: [
          {
            id: 'user_123',
            type: 'user',
            role: ChatParticipantRole.OWNER,
            joinedAt: now,
            lastActiveAt: now,
            permissions: [ChatPermission.READ, ChatPermission.WRITE]
          }
        ],
        status: ChatStatus.ACTIVE,
        messageCount: 10,
        lastMessageAt: now
      };
    });
  });
  
  describe('addParticipant', () => {
    it('should add a participant to a chat', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const participant: ChatParticipant = {
        id: 'agent_789',
        type: 'agent',
        role: ChatParticipantRole.MEMBER,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        permissions: [ChatPermission.READ, ChatPermission.WRITE]
      };
      
      // Act
      const result = await chatMemoryService.addParticipant(chatId, participant);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly
      expect(mockGetById).toHaveBeenCalledWith(chatId);
      expect(mockUpdate).toHaveBeenCalled();
    });
    
    it('should not add a participant that already exists', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const participant: ChatParticipant = {
        id: 'user_123', // Already in the chat
        type: 'user',
        role: ChatParticipantRole.MEMBER,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        permissions: [ChatPermission.READ]
      };
      
      // Act
      const result = await chatMemoryService.addParticipant(chatId, participant);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly but no update happened
      expect(mockGetById).toHaveBeenCalledWith(chatId);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
    
    it('should return null if chat does not exist', async () => {
      // Arrange
      const chatId = 'non-existent-id';
      const participant: ChatParticipant = {
        id: 'agent_789',
        type: 'agent',
        role: ChatParticipantRole.MEMBER,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        permissions: [ChatPermission.READ, ChatPermission.WRITE]
      };
      
      // Setup mock response for non-existent chat
      mockGetById.mockResolvedValueOnce(null);
      
      // Act
      const result = await chatMemoryService.addParticipant(chatId, participant);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeNull();
      
      // Verify repository was called correctly
      expect(mockGetById).toHaveBeenCalledWith(chatId);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
  
  describe('removeParticipant', () => {
    it('should remove a participant from a chat', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const participantId = 'user_123';
      
      // Act
      const result = await chatMemoryService.removeParticipant(chatId, participantId);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly
      expect(mockGetById).toHaveBeenCalledWith(chatId);
      expect(mockUpdate).toHaveBeenCalled();
    });
    
    it('should not modify chat if participant does not exist', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const participantId = 'non-existent-user';
      
      // Act
      const result = await chatMemoryService.removeParticipant(chatId, participantId);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly but no update happened
      expect(mockGetById).toHaveBeenCalledWith(chatId);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
  
  describe('updateParticipantRole', () => {
    it('should update a participant\'s role', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const participantId = 'user_123';
      const newRole = ChatParticipantRole.ADMIN;
      
      // Act
      const result = await chatMemoryService.updateParticipantRole(chatId, participantId, newRole);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly
      expect(mockGetById).toHaveBeenCalledWith(chatId);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
  
  describe('findChatsByParticipant', () => {
    it('should find chats by participant ID', async () => {
      // Arrange
      const participantId = 'user_123';
      
      // Act
      const result = await chatMemoryService.findChatsByParticipant(participantId);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly with the actual parameters
      expect(mockSearch).toHaveBeenCalledWith(
        participantId,
        expect.any(Object)
      );
    });
  });
  
  describe('findActiveChats', () => {
    it('should find active chats', async () => {
      // Act
      const result = await chatMemoryService.findActiveChats();
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
      
      // Verify repository was called correctly
      expect(mockFilter).toHaveBeenCalledWith(
        {
          status: {
            operator: FilterOperator.EQUALS,
            value: ChatStatus.ACTIVE
          }
        },
        { includeDeleted: false }
      );
    });
  });
  
  describe('findChatsByMetadata', () => {
    it('should find chats by metadata', async () => {
      // Arrange
      const metadata = {
        priority: 'high',
        category: 'support'
      };
      
      // Act
      const result = await chatMemoryService.findChatsByMetadata(metadata);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly
      expect(mockFilter).toHaveBeenCalledWith(
        {
          'metadata.priority': {
            operator: FilterOperator.EQUALS,
            value: 'high'
          },
          'metadata.category': {
            operator: FilterOperator.EQUALS,
            value: 'support'
          }
        },
        { includeDeleted: false }
      );
    });
  });
  
  describe('updateChatStatus', () => {
    it('should update chat status', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const status = ChatStatus.PAUSED;
      
      // Act
      const result = await chatMemoryService.updateChatStatus(chatId, status);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.status).toEqual(status);
      }
      
      // Verify repository was called correctly
      expect(mockUpdate).toHaveBeenCalledWith(
        chatId,
        { status }
      );
    });
  });
  
  describe('addMessage', () => {
    it('should update chat when a message is added', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const message = {
        content: 'Test message',
        senderId: 'user_123',
        senderType: 'user'
      };
      
      // Act
      const result = await chatMemoryService.addMessage(chatId, message);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly
      expect(mockGetById).toHaveBeenCalledWith(chatId);
      expect(mockUpdate).toHaveBeenCalled();
    });
    
    it('should return null if chat does not exist', async () => {
      // Arrange
      const chatId = 'non-existent-id';
      const message = {
        content: 'Test message',
        senderId: 'user_123',
        senderType: 'user'
      };
      
      // Setup mock response for non-existent chat
      mockGetById.mockResolvedValueOnce(null);
      
      // Act
      const result = await chatMemoryService.addMessage(chatId, message);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeNull();
      
      // Verify repository was called correctly
      expect(mockGetById).toHaveBeenCalledWith(chatId);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
  
  describe('getMessages', () => {
    it('should return an empty array (placeholder implementation)', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      
      // Act
      const result = await chatMemoryService.getMessages(chatId);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toEqual([]);
    });
  });
}); 