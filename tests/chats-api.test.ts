import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getChatsList, POST as createChat } from '../src/app/api/multi-agent/system/chats/route';
import { GET as getChat, PUT as updateChat, DELETE as deleteChat } from '../src/app/api/multi-agent/system/chats/[chatId]/route';

// Mock the chat service
vi.mock('../src/server/memory/services/chat-service', () => {
  let mockChats = new Map();
  
  // Setup initial test chat
  const testChat = {
    id: 'test-chat-id',
    type: 'group',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
    participants: [
      {
        id: 'user123',
        type: 'user',
        joinedAt: new Date().toISOString()
      },
      {
        id: 'agent456',
        type: 'agent',
        joinedAt: new Date().toISOString()
      }
    ],
    metadata: {
      title: 'Test Chat',
      description: 'Test chat description'
    }
  };
  
  mockChats.set('test-chat-id', testChat);
  
  return {
    getChatService: vi.fn().mockResolvedValue({
      getChatById: vi.fn((id) => Promise.resolve(mockChats.get(id) || null)),
      getChatsByUserId: vi.fn((userId) => Promise.resolve(
        Array.from(mockChats.values()).filter(chat => 
          chat.participants.some((p: any) => p.id === userId && p.type === 'user')
        )
      )),
      getChatsByAgentId: vi.fn((agentId) => Promise.resolve(
        Array.from(mockChats.values()).filter(chat => 
          chat.participants.some((p: any) => p.id === agentId && p.type === 'agent')
        )
      )),
      getChatsByUserAndAgent: vi.fn((userId, agentId) => Promise.resolve(
        Array.from(mockChats.values()).filter(chat => 
          chat.participants.some((p: any) => p.id === userId && p.type === 'user') &&
          chat.participants.some((p: any) => p.id === agentId && p.type === 'agent')
        )
      )),
      getAllChats: vi.fn(() => Promise.resolve(Array.from(mockChats.values()))),
      createChat: vi.fn((userId, agentId, options) => {
        const chatId = options.forceNewId || `chat-${Date.now()}`;
        const newChat = {
          id: chatId,
          type: options.type || 'direct',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active',
          participants: [
            {
              id: userId,
              type: 'user',
              joinedAt: new Date().toISOString()
            },
            {
              id: agentId,
              type: 'agent',
              joinedAt: new Date().toISOString()
            },
            ...(options.participants || [])
          ],
          metadata: {
            title: options.title || 'New Chat',
            description: options.description || '',
            ...(options.metadata || {})
          }
        };
        mockChats.set(chatId, newChat);
        return Promise.resolve(newChat);
      }),
      updateChat: vi.fn((id, updates) => {
        const chat = mockChats.get(id);
        if (!chat) return Promise.resolve(null);
        
        const updatedChat = {
          ...chat,
          updatedAt: new Date().toISOString(),
          status: updates.status || chat.status,
          metadata: {
            ...chat.metadata,
            title: updates.title || chat.metadata.title,
            description: updates.description || chat.metadata.description,
            ...(updates.metadata || {})
          }
        };
        
        mockChats.set(id, updatedChat);
        return Promise.resolve(updatedChat);
      }),
      deleteChat: vi.fn((id) => {
        if (!mockChats.has(id)) return Promise.resolve(false);
        mockChats.delete(id);
        return Promise.resolve(true);
      })
    })
  };
});

// Helper function to create mock request
function createMockRequest(method: string, url: string, body: any = null): NextRequest {
  const request = {
    method,
    url,
    headers: new Headers({
      'Content-Type': 'application/json'
    }),
    json: () => Promise.resolve(body),
    nextUrl: new URL(url)
  } as unknown as NextRequest;
  
  return request;
}

describe('Chat Management API Tests', () => {
  describe('GET /api/multi-agent/system/chats', () => {
    test('should return all chats when no query params provided', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/chats');
      const response = await getChatsList(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('chats');
      expect(Array.isArray(data.chats)).toBe(true);
      expect(data.chats.length).toBeGreaterThanOrEqual(0);
      if (data.chats.length > 0) {
        expect(data.chats[0]).toHaveProperty('id');
      }
    });
    
    test('should filter chats by userId', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/chats?userId=user123');
      const response = await getChatsList(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('chats');
      expect(Array.isArray(data.chats)).toBe(true);
      expect(data.chats.length).toBeGreaterThan(0);
    });
    
    test('should filter chats by agentId', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/chats?agentId=agent456');
      const response = await getChatsList(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('chats');
      expect(Array.isArray(data.chats)).toBe(true);
      expect(data.chats.length).toBeGreaterThan(0);
    });
    
    test('should filter chats by both userId and agentId', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/system/chats?userId=user123&agentId=agent456');
      const response = await getChatsList(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('chats');
      expect(Array.isArray(data.chats)).toBe(true);
      expect(data.chats.length).toBeGreaterThan(0);
    });
  });
  
  describe('POST /api/multi-agent/system/chats', () => {
    test('should create a new chat with minimal data', async () => {
      const chatData = {
        userId: 'user123',
        agentId: 'agent456'
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/chats', chatData);
      const response = await createChat(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('chat');
      expect(data.chat).toHaveProperty('id');
      expect(data.chat).toHaveProperty('participants');
      expect(data.chat.participants.length).toBe(2);
      expect(data.chat.type).toBe('direct');
    });
    
    test('should create a new chat with full data', async () => {
      const chatData = {
        userId: 'user789',
        agentId: 'agent456',
        title: 'Research Project',
        description: 'Discussion about research project details',
        type: 'group',
        participants: [
          {
            id: 'agent789',
            type: 'agent',
            name: 'Analysis Agent'
          }
        ],
        metadata: {
          category: 'research',
          priority: 'high'
        }
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/chats', chatData);
      const response = await createChat(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('chat');
      expect(data.chat).toHaveProperty('id');
      expect(data.chat).toHaveProperty('participants');
      expect(data.chat.participants.length).toBe(3);
      expect(data.chat.type).toBe('group');
      expect(data.chat.metadata.title).toBe('Research Project');
      expect(data.chat.metadata).toBeTruthy();
    });
    
    test('should return 400 if userId is missing', async () => {
      const chatData = {
        agentId: 'agent456',
        title: 'Invalid Chat'
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/chats', chatData);
      const response = await createChat(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
    
    test('should return 400 if agentId is missing', async () => {
      const chatData = {
        userId: 'user123',
        title: 'Invalid Chat'
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/system/chats', chatData);
      const response = await createChat(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
  });
  
  describe('GET /api/multi-agent/system/chats/[chatId]', () => {
    test('should return chat details', async () => {
      const params = { chatId: 'test-chat-id' };
      const request = createMockRequest('GET', `http://localhost/api/multi-agent/system/chats/test-chat-id`);
      const response = await getChat(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('chat');
      expect(data.chat).toHaveProperty('id', 'test-chat-id');
      expect(data.chat).toHaveProperty('participants');
      expect(data.chat.participants.length).toBe(2);
      expect(data.chat.metadata).toHaveProperty('title', 'Test Chat');
    });
    
    test('should return 404 if chat not found', async () => {
      const params = { chatId: 'non-existent-chat' };
      const request = createMockRequest('GET', `http://localhost/api/multi-agent/system/chats/non-existent-chat`);
      const response = await getChat(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Chat not found');
    });
  });
  
  describe('PUT /api/multi-agent/system/chats/[chatId]', () => {
    test('should update chat metadata', async () => {
      const params = { chatId: 'test-chat-id' };
      const updateData = {
        title: 'Updated Chat Title',
        description: 'Updated chat description',
        metadata: {
          status: 'important',
          tags: ['research', 'ai']
        }
      };
      
      const request = createMockRequest('PUT', `http://localhost/api/multi-agent/system/chats/test-chat-id`, updateData);
      const response = await updateChat(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('chat');
      expect(data.chat.metadata).toHaveProperty('title', 'Updated Chat Title');
      expect(data.chat.metadata).toHaveProperty('description', 'Updated chat description');
      expect(data.chat.metadata).toHaveProperty('status', 'important');
      expect(data.chat.metadata).toHaveProperty('tags');
    });
    
    test('should update chat status', async () => {
      const params = { chatId: 'test-chat-id' };
      const updateData = {
        status: 'archived'
      };
      
      const request = createMockRequest('PUT', `http://localhost/api/multi-agent/system/chats/test-chat-id`, updateData);
      const response = await updateChat(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('chat');
      expect(data.chat).toHaveProperty('status', 'archived');
    });
    
    test('should return 404 if chat not found', async () => {
      const params = { chatId: 'non-existent-chat' };
      const updateData = {
        title: 'Updated Chat'
      };
      
      const request = createMockRequest('PUT', `http://localhost/api/multi-agent/system/chats/non-existent-chat`, updateData);
      const response = await updateChat(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Chat not found');
    });
  });
  
  describe('DELETE /api/multi-agent/system/chats/[chatId]', () => {
    test('should delete chat', async () => {
      const params = { chatId: 'test-chat-id' };
      const request = createMockRequest('DELETE', `http://localhost/api/multi-agent/system/chats/test-chat-id`);
      const response = await deleteChat(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message', 'Chat deleted successfully');
    });
    
    test('should return 404 if chat not found', async () => {
      const params = { chatId: 'non-existent-chat' };
      const request = createMockRequest('DELETE', `http://localhost/api/multi-agent/system/chats/non-existent-chat`);
      const response = await deleteChat(request, { params });
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Chat not found');
    });
  });
}); 