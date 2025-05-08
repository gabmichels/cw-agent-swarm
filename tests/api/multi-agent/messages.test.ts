import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as sendMessage, GET as getMessages } from '../../../src/app/api/multi-agent/messages/route';
import { MessageType, SendMessageRequest } from '../../../src/lib/multi-agent/types/message';
import { ParticipantType } from '../../../src/lib/multi-agent/types/chat';
import { MessageStatus } from '../../../src/lib/multi-agent/types/message';

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());

// Mock the message service
vi.mock('../../../src/server/memory/services/multi-agent/messaging/message-service', () => {
  const messages = new Map();
  
  return {
    createMessageService: vi.fn().mockResolvedValue({
      sendMessage: vi.fn((message) => {
        // Store message in mock database
        const messageId = message.id || `msg_${Date.now()}`;
        const timestamp = new Date().toISOString();
        
        const storedMessage = {
          ...message,
          id: messageId,
          senderType: message.senderType || ParticipantType.USER,
          createdAt: timestamp,
          updatedAt: timestamp,
          status: MessageStatus.DELIVERED
        };
        
        messages.set(messageId, storedMessage);
        
        // Return success with the created message
        return Promise.resolve({
          success: true,
          message: storedMessage
        });
      }),
      getMessagesByChatId: vi.fn((chatId) => {
        // Filter messages by chatId
        const chatMessages = Array.from(messages.values())
          .filter((msg) => msg.chatId === chatId);
        
        return Promise.resolve({
          success: true,
          data: chatMessages
        });
      }),
      getMessageById: vi.fn((messageId) => {
        const message = messages.get(messageId);
        
        if (!message) {
          return Promise.resolve({
            success: false,
            error: 'Message not found'
          });
        }
        
        return Promise.resolve({
          success: true,
          data: message
        });
      })
    })
  };
});

describe('Messages API Endpoints', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/multi-agent/messages', () => {
    it('should send a message successfully', async () => {
      // Arrange
      const mockMessageData = {
        chatId: 'chat_test_123',
        senderId: 'user_test_123',
        senderType: ParticipantType.USER,
        content: 'This is a test message',
        type: MessageType.TEXT
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/messages', {
        method: 'POST',
        body: JSON.stringify(mockMessageData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await sendMessage(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBeDefined();
      expect(responseData.message.content).toBe(mockMessageData.content);
      expect(responseData.message.id).toBeDefined();
      expect(responseData.message.chatId).toBe(mockMessageData.chatId);
      expect(responseData.message.senderId).toBe(mockMessageData.senderId);
    });

    it('should return an error when chat ID is missing', async () => {
      // Arrange
      const invalidMessageData = {
        // Missing chatId
        senderId: 'user_test_123',
        senderType: ParticipantType.USER,
        content: 'This is a test message'
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/messages', {
        method: 'POST',
        body: JSON.stringify(invalidMessageData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await sendMessage(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });

    it('should return an error when sender ID is missing', async () => {
      // Arrange
      const invalidMessageData = {
        chatId: 'chat_test_123',
        // Missing senderId
        senderType: ParticipantType.USER,
        content: 'This is a test message'
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/messages', {
        method: 'POST',
        body: JSON.stringify(invalidMessageData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await sendMessage(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });

    it('should return an error when content is missing and no attachments', async () => {
      // Arrange
      const invalidMessageData = {
        chatId: 'chat_test_123',
        senderId: 'user_test_123',
        senderType: ParticipantType.USER,
        // Missing content and no attachments
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/messages', {
        method: 'POST',
        body: JSON.stringify(invalidMessageData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await sendMessage(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });
  });

  describe('GET /api/multi-agent/messages', () => {
    it('should fetch messages for a chat successfully', async () => {
      // Arrange
      const chatId = 'chat_test_123';
      const mockUrl = new URL(`http://localhost:3000/api/multi-agent/messages?chatId=${chatId}`);

      const mockRequest = new NextRequest(mockUrl);

      // Act
      const response = await getMessages(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.messages).toBeDefined();
      expect(Array.isArray(responseData.messages)).toBe(true);
    });

    it('should return an error when chat ID is missing', async () => {
      // Arrange
      const mockUrl = new URL('http://localhost:3000/api/multi-agent/messages');

      const mockRequest = new NextRequest(mockUrl);

      // Act
      const response = await getMessages(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });
  });
}); 