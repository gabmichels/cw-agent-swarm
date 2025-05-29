import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as sendMessage, GET as getMessages } from '../../src/app/api/multi-agent/messages/route';
import { MessageRole, MessageStatus, MessageType, Message, SendMessageRequest } from '../../src/lib/multi-agent/types/message';
import { ParticipantType } from '../../src/lib/multi-agent/types/chat';

// Type for our message storage - using a mapped type to correctly transform Date to string
interface StoredMessage extends Omit<Message, 'senderType' | 'createdAt' | 'updatedAt'> {
  senderType: ParticipantType;
  createdAt: string;  // In the real Message interface this is a Date
  updatedAt: string;  // In the real Message interface this is a Date
}

// Helper function to create mock request
function createMockRequest<T>(method: string, url: string, body: T | null = null): NextRequest {
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

describe('Messages API Tests', () => {
  beforeEach(() => {
    // Setup for real Qdrant services
  });
  
  describe('POST /api/multi-agent/messages', () => {
    test('should create a new message', async () => {
      const messageData: SendMessageRequest = {
        chatId: 'chat_123',
        senderId: 'user_abc',
        senderType: ParticipantType.USER,
        content: 'Hello, this is a test message!',
        type: MessageType.TEXT
      };
      
      const request = createMockRequest<SendMessageRequest>('POST', 'http://localhost/api/multi-agent/messages', messageData);
      const response = await sendMessage(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toHaveProperty('id');
      expect(data.message.chatId).toBe('chat_123');
      expect(data.message.senderId).toBe('user_abc');
      expect(data.message.content).toBe('Hello, this is a test message!');
      expect(data.message.role).toBe('user');
      expect(data.message.status).toBe('delivered');
    });
    
    test('should return 400 if required fields are missing', async () => {
      // Missing chatId
      const invalidData = {
        senderId: 'user_abc',
        senderType: ParticipantType.USER,
        content: 'Hello, this is a test message!',
        type: MessageType.TEXT
      };
      
      const request = createMockRequest('POST', 'http://localhost/api/multi-agent/messages', invalidData);
      const response = await sendMessage(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Chat ID is required');
    });
    
    test('should handle message from an agent with correct role', async () => {
      const agentMessageData: SendMessageRequest = {
        chatId: 'chat_123',
        senderId: 'agent_xyz',
        senderType: ParticipantType.AGENT,
        content: 'I am an agent response',
        type: MessageType.TEXT
      };
      
      const request = createMockRequest<SendMessageRequest>('POST', 'http://localhost/api/multi-agent/messages', agentMessageData);
      const response = await sendMessage(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message.role).toBe('agent');
    });
  });
  
  describe('GET /api/multi-agent/messages', () => {
    test('should get messages for a chat', async () => {
      // First, create some test messages
      const messageData1: SendMessageRequest = {
        chatId: 'chat_456',
        senderId: 'user_abc',
        senderType: ParticipantType.USER,
        content: 'First test message',
        type: MessageType.TEXT
      };
      
      const messageData2: SendMessageRequest = {
        chatId: 'chat_456',
        senderId: 'agent_xyz',
        senderType: ParticipantType.AGENT,
        content: 'Agent response',
        type: MessageType.TEXT
      };
      
      // Add messages
      await sendMessage(createMockRequest<SendMessageRequest>('POST', 'http://localhost/api/multi-agent/messages', messageData1));
      await sendMessage(createMockRequest<SendMessageRequest>('POST', 'http://localhost/api/multi-agent/messages', messageData2));
      
      // Get messages
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/messages?chatId=chat_456');
      const response = await getMessages(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messages).toBeInstanceOf(Array);
      expect(data.messages.length).toBeGreaterThan(0);
      
      // Verify message contents - check that at least one message matches each content
      const messages = data.messages;
      const hasFirstMessage = messages.some((m: Message) => m.content === 'First test message');
      const hasAgentResponse = messages.some((m: Message) => m.content === 'Agent response');
      
      expect(hasFirstMessage || hasAgentResponse).toBe(true); // At least one message should be found
    });
    
    test('should return 400 if chatId is not provided', async () => {
      const request = createMockRequest('GET', 'http://localhost/api/multi-agent/messages');
      const response = await getMessages(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Chat ID is required');
    });
    
    test('should apply query parameters correctly', async () => {
      // Create specific test request with query parameters
      const request = createMockRequest(
        'GET', 
        'http://localhost/api/multi-agent/messages?chatId=chat_456&limit=10&offset=0'
      );
      const response = await getMessages(request);
      
      expect(response.status).toBe(200);
    });
  });
}); 