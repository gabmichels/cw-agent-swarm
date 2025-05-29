import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ChatCreationRequest, ChatVisibility } from '../../../src/lib/multi-agent/types/chat';

// Import the actual route handlers - no mocks needed for real Qdrant testing
import { POST as createChat } from '../../../src/app/api/multi-agent/chats/route';
import { POST as addParticipants } from '../../../src/app/api/multi-agent/chats/[chatId]/participants/route';

describe('Chat API Endpoints', () => {
  beforeEach(async () => {
    // Clean setup before each test - let services initialize naturally
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('POST /api/multi-agent/chats', () => {
    it('should create a new chat successfully', async () => {
      // Arrange
      const mockChatData: ChatCreationRequest = {
        name: 'Test Chat',
        description: 'A test chat for unit testing',
        settings: {
          visibility: ChatVisibility.PRIVATE,
          allowAnonymousMessages: false,
          enableBranching: false,
          recordTranscript: true
        },
        metadata: {
          tags: ['test', 'chat'],
          category: ['unit-test'],
          priority: 'medium',
          sensitivity: 'internal',
          language: ['en'],
          version: '1.0'
        }
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/chats', {
        method: 'POST',
        body: JSON.stringify(mockChatData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await createChat(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.chat).toBeDefined();
      expect(responseData.chat.name).toBe(mockChatData.name);
      expect(responseData.chat.id).toBeDefined();
    });

    it('should return an error when required fields are missing', async () => {
      // Arrange
      const invalidChatData = {
        // Missing name and other required fields
        description: 'An invalid chat'
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/chats', {
        method: 'POST',
        body: JSON.stringify(invalidChatData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await createChat(mockRequest);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });
  });

  describe('POST /api/multi-agent/chats/[chatId]/participants', () => {
    it('should add participants to a chat successfully', async () => {
      // Arrange
      const chatId = 'chat_test_123';
      const params = { chatId };

      const mockParticipantsData = {
        participants: [
          {
            participantId: 'user_test_123',
            participantType: 'user',
            role: 'member'
          },
          {
            participantId: 'agent_test_123',
            participantType: 'agent',
            role: 'member'
          }
        ]
      };

      const mockRequest = new NextRequest(`http://localhost:3000/api/multi-agent/chats/${chatId}/participants`, {
        method: 'POST',
        body: JSON.stringify(mockParticipantsData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await addParticipants(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.participants).toBeDefined();
      expect(responseData.participants.length).toBe(2);
      expect(responseData.participants[0].chatId).toBe(chatId);
    });

    it('should return an error when chat ID is missing', async () => {
      // Arrange
      const params = { chatId: '' };

      const mockParticipantsData = {
        participants: [
          {
            participantId: 'user_test_123',
            participantType: 'user',
            role: 'member'
          }
        ]
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/multi-agent/chats//participants', {
        method: 'POST',
        body: JSON.stringify(mockParticipantsData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await addParticipants(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });

    it('should return an error when participants are missing', async () => {
      // Arrange
      const chatId = 'chat_test_123';
      const params = { chatId };

      const mockParticipantsData = {
        // Missing participants array
      };

      const mockRequest = new NextRequest(`http://localhost:3000/api/multi-agent/chats/${chatId}/participants`, {
        method: 'POST',
        body: JSON.stringify(mockParticipantsData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Act
      const response = await addParticipants(mockRequest, { params });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });
  });
}); 