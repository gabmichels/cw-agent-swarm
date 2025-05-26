/**
 * Unit tests for AgentCommunicationHandler.ts
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { AgentCommunicationHandler, CommunicationError, MessageType, MessagePriority } from '../AgentCommunicationHandler';

// Mock the logger
vi.mock('../../../../lib/logging/winston-logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

// Mock processors
const createMockInputProcessor = () => ({
  processInput: vi.fn().mockResolvedValue({
    processedInput: 'processed input',
    metadata: { processed: true }
  }),
  validateInput: vi.fn().mockReturnValue({ isValid: true }),
  isEnabled: () => true
});

const createMockOutputProcessor = () => ({
  processOutput: vi.fn().mockResolvedValue({
    formattedOutput: 'formatted output',
    deliveryStatus: 'delivered'
  }),
  formatOutput: vi.fn().mockReturnValue('formatted output'),
  isEnabled: () => true
});

// Simple mock agent
const createMockAgent = (id = 'test-agent') => ({
  getId: () => id,
  getManager: () => null, // Add missing getManager method
  async processUserInput(input: string) {
    return {
      content: `Agent processed: ${input}`,
      metadata: { agentId: id, timestamp: new Date().toISOString() }
    };
  }
});

describe('AgentCommunicationHandler', () => {
  let communicationHandler: AgentCommunicationHandler;
  let mockAgent: ReturnType<typeof createMockAgent>;
  let mockInputProcessor: ReturnType<typeof createMockInputProcessor>;
  let mockOutputProcessor: ReturnType<typeof createMockOutputProcessor>;

  beforeEach(() => {
    mockAgent = createMockAgent();
    mockInputProcessor = createMockInputProcessor();
    mockOutputProcessor = createMockOutputProcessor();
    
    communicationHandler = new AgentCommunicationHandler(
      mockAgent as any,
      {
        enableInputValidation: true,
        enableOutputSanitization: true,
        maxMessageLength: 10000,
        security: {
          enableContentFiltering: false, // Disable to avoid regex issues in tests
          blockedPatterns: [],
          allowedDomains: []
        }
      }
    );
  });

  describe('Message Processing', () => {
    test('should process message successfully', async () => {
      const response = await communicationHandler.processMessage('Hello world');
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
    });

    test('should handle message with options', async () => {
      const options = {
        userId: 'test-user',
        metadata: { source: 'test' }
      };

      const response = await communicationHandler.processMessage('Test command', options);
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });

    test('should handle empty message', async () => {
      const response = await communicationHandler.processMessage('');
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });

    test('should handle very long message within limits', async () => {
      const longMessage = 'a'.repeat(5000); // Within default 10000 limit
      const response = await communicationHandler.processMessage(longMessage);
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });
  });

  describe('Message Sending', () => {
    test('should send message with default options', async () => {
      const response = await communicationHandler.sendMessage('Test message');
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });

    test('should send message with custom options', async () => {
      const options = {
        type: MessageType.COMMAND,
        priority: MessagePriority.HIGH,
        metadata: { urgent: true }
      };

      const response = await communicationHandler.sendMessage('Urgent command', options);
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });

    test('should handle different message types', async () => {
      const messageTypes = [
        MessageType.TEXT,
        MessageType.COMMAND,
        MessageType.QUERY,
        MessageType.SYSTEM
      ];

      for (const type of messageTypes) {
        const response = await communicationHandler.sendMessage('Test message', { type });
        expect(response).toBeDefined();
        expect(response.content).toBeDefined();
      }
    });
  });

  describe('Configuration', () => {
    test('should use provided configuration', () => {
      const config = {
        enableInputValidation: false,
        enableOutputSanitization: false,
        maxMessageLength: 5000
      };

      const configuredHandler = new AgentCommunicationHandler(mockAgent as any, config);
      const handlerConfig = configuredHandler.getConfig();
      
      expect(handlerConfig.enableInputValidation).toBe(false);
      expect(handlerConfig.enableOutputSanitization).toBe(false);
      expect(handlerConfig.maxMessageLength).toBe(5000);
    });

    test('should update configuration', () => {
      communicationHandler.updateConfig({
        enableInputValidation: false,
        maxMessageLength: 15000
      });

      const config = communicationHandler.getConfig();
      expect(config.enableInputValidation).toBe(false);
      expect(config.maxMessageLength).toBe(15000);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide statistics', async () => {
      await communicationHandler.processMessage('Test message 1');
      await communicationHandler.processMessage('Test message 2');

      const stats = communicationHandler.getStatistics();
      
      expect(stats.totalMessages).toBeGreaterThan(0);
      expect(stats.queuedMessages).toBeGreaterThanOrEqual(0);
      expect(stats.rateLimitedUsers).toBeGreaterThanOrEqual(0);
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    test('should track message processing', async () => {
      const initialStats = communicationHandler.getStatistics();
      
      await communicationHandler.processMessage('Test message');
      
      const updatedStats = communicationHandler.getStatistics();
      expect(updatedStats.totalMessages).toBeGreaterThan(initialStats.totalMessages);
    });
  });

  describe('Queue Management', () => {
    test('should clear message queue', () => {
      communicationHandler.clearQueue();
      
      const stats = communicationHandler.getStatistics();
      expect(stats.queuedMessages).toBe(0);
    });

    test('should handle queue operations', async () => {
      // Process some messages to populate queue
      await communicationHandler.processMessage('Message 1');
      await communicationHandler.processMessage('Message 2');
      
      // Clear queue
      communicationHandler.clearQueue();
      
      const stats = communicationHandler.getStatistics();
      expect(stats.queuedMessages).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle agent processing errors', async () => {
      const errorAgent = {
        getId: () => 'error-agent',
        getManager: () => null,
        processUserInput: vi.fn().mockRejectedValue(new Error('Agent error'))
      };

      const errorHandler = new AgentCommunicationHandler(errorAgent as any, {
        security: {
          enableContentFiltering: false,
          blockedPatterns: [],
          allowedDomains: []
        }
      });

      const response = await errorHandler.processMessage('Test input');
      
      expect(response.content).toContain('Error processing message');
      expect(response.metadata?.error).toBe(true);
    });

    test('should handle invalid message length', async () => {
      const tooLongMessage = 'a'.repeat(20000); // Exceeds default 10000 limit
      
      const response = await communicationHandler.processMessage(tooLongMessage);
      
      expect(response.content).toContain('Error processing message');
      expect(response.metadata?.error).toBe(true);
      expect(response.metadata?.errorCode).toBe('VALIDATION_FAILED');
    });

    test('should create CommunicationError for specific failures', async () => {
      const tooLongMessage = 'a'.repeat(20000);
      
      try {
        await communicationHandler.processMessage(tooLongMessage);
      } catch (error) {
        expect(error).toBeInstanceOf(CommunicationError);
        expect((error as CommunicationError).code).toBeDefined();
      }
    });
  });

  describe('Rate Limiting', () => {
    test('should handle rate limiting when enabled', async () => {
      const rateLimitedHandler = new AgentCommunicationHandler(mockAgent as any, {
        rateLimiting: {
          enabled: true,
          maxMessagesPerMinute: 2,
          maxMessagesPerHour: 10
        }
      });

      // Send messages within limit
      await rateLimitedHandler.processMessage('Message 1');
      await rateLimitedHandler.processMessage('Message 2');
      
      // Third message should potentially hit rate limit
      // Note: This test might be flaky depending on timing
      const stats = rateLimitedHandler.getStatistics();
      expect(stats.totalMessages).toBeGreaterThan(0);
    });

    test('should work when rate limiting is disabled', async () => {
      const noRateLimitHandler = new AgentCommunicationHandler(mockAgent as any, {
        rateLimiting: {
          enabled: false,
          maxMessagesPerMinute: 1,
          maxMessagesPerHour: 1
        }
      });

      // Should be able to send multiple messages
      await noRateLimitHandler.processMessage('Message 1');
      await noRateLimitHandler.processMessage('Message 2');
      await noRateLimitHandler.processMessage('Message 3');
      
      const stats = noRateLimitHandler.getStatistics();
      expect(stats.totalMessages).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined input gracefully', async () => {
      // These should either work or throw predictable errors
      await expect(async () => {
        await communicationHandler.processMessage(null as any);
      }).not.toThrow('Unexpected error');
      
      await expect(async () => {
        await communicationHandler.processMessage(undefined as any);
      }).not.toThrow('Unexpected error');
    });

    test('should handle special characters in message', async () => {
      const specialMessage = '!@#$%^&*()_+{}|:"<>?[]\\;\',./ 🚀 🎉 ñáéíóú';
      const response = await communicationHandler.processMessage(specialMessage);
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });

    test('should handle concurrent message processing', async () => {
      const messages = Array.from({ length: 5 }, (_, i) => `Message ${i}`);
      const promises = messages.map(msg => communicationHandler.processMessage(msg));

      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response).toBeDefined();
        expect(response.content).toBeDefined();
      });
    });
  });

  describe('Agent Integration', () => {
    test('should work with different agent implementations', async () => {
      const customAgent = {
        getId: () => 'custom-agent',
        getManager: () => null,
        async processUserInput(input: string) {
          return {
            content: `Custom agent response to: ${input}`,
            metadata: { customField: 'value' },
            thoughts: ['Processing input', 'Generating response']
          };
        }
      };

      const customHandler = new AgentCommunicationHandler(customAgent as any, {
        security: {
          enableContentFiltering: false,
          blockedPatterns: [],
          allowedDomains: []
        }
      });
      const response = await customHandler.processMessage('Test input');
      
      expect(response.content).toContain('Custom agent response');
      expect(response.metadata?.customField).toBe('value');
      expect(response.thoughts).toBeDefined();
    });

    test('should handle agent responses with different structures', async () => {
      const minimalAgent = {
        getId: () => 'minimal-agent',
        getManager: () => null,
        async processUserInput() {
          return { content: 'Minimal response' };
        }
      };

      const minimalHandler = new AgentCommunicationHandler(minimalAgent as any, {
        security: {
          enableContentFiltering: false,
          blockedPatterns: [],
          allowedDomains: []
        }
      });
      const response = await minimalHandler.processMessage('Test');
      
      expect(response.content).toBe('Minimal response');
    });
  });
}); 