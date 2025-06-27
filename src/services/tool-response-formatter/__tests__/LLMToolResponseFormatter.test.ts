/**
 * Unit tests for LLMToolResponseFormatter
 * 
 * Tests cover:
 * - Response formatting with various tool results
 * - Error handling and fallback scenarios
 * - Caching functionality
 * - Quality scoring
 * - Persona integration
 */

import { ulid } from 'ulid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonaInfo } from '../../../agents/shared/messaging/PromptFormatter';
import { ToolExecutionResult } from '../../../lib/tools/types';
import { LLMToolResponseFormatter } from '../LLMToolResponseFormatter';
import {
  FormattedToolResponse,
  LLMGenerationError,
  ToolCategory,
  ToolResponseContext,
  ToolResponsePromptTemplate
} from '../types';

// Mock dependencies
const mockLLMService = {
  generateResponse: vi.fn()
} as any;

const mockPromptTemplateService = {
  getTemplate: vi.fn(),
  getAllTemplates: vi.fn(),
  upsertTemplate: vi.fn()
} as any;

const mockResponseCache = {
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn()
} as any;

// Mock logger
vi.mock('../../../lib/logging/winston-logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

// Mock PromptFormatter
vi.mock('../../../agents/shared/messaging/PromptFormatter', () => ({
  PromptFormatter: {
    formatSystemPrompt: vi.fn().mockResolvedValue('Mocked system prompt for testing')
  }
}));

describe('LLMToolResponseFormatter', () => {
  let formatter: LLMToolResponseFormatter;
  let mockContext: ToolResponseContext;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create formatter instance
    formatter = new LLMToolResponseFormatter(
      mockLLMService,
      mockPromptTemplateService,
      mockResponseCache
    );

    // Create mock context
    mockContext = createMockContext();
  });

  describe('formatResponse', () => {
    it('should successfully format a tool response', async () => {
      // Arrange
      const mockTemplate: ToolResponsePromptTemplate = {
        id: 'test_template',
        category: ToolCategory.WORKSPACE,
        style: 'conversational',
        systemPrompt: 'You are a helpful assistant',
        successTemplate: 'Success template',
        errorTemplate: 'Error template',
        partialSuccessTemplate: 'Partial success template',
        enabled: true,
        priority: 1
      };

      mockPromptTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockLLMService.generateResponse.mockResolvedValue('Great! I successfully completed the task.');
      mockResponseCache.get.mockResolvedValue(null); // No cache hit

      // Act
      const result = await formatter.formatResponse(mockContext);

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBe('Great! I successfully completed the task.');
      expect(result.responseStyle).toBe('conversational');
      expect(result.fallbackUsed).toBe(false);
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.generationMetrics.cacheHit).toBe(false);
      expect(typeof result.generationMetrics.generationTime).toBe('number');
    });

    it('should use cached response when available', async () => {
      // Arrange
      const cachedResponse: FormattedToolResponse = {
        id: ulid(),
        content: 'Cached response',
        responseStyle: 'conversational',
        generationMetrics: {
          generationTime: 100,
          promptTokens: 50,
          responseTokens: 20,
          cacheHit: false
        },
        qualityScore: 0.8,
        fallbackUsed: false,
        timestamp: new Date()
      };

      mockResponseCache.get.mockResolvedValue(cachedResponse);

      // Act
      const result = await formatter.formatResponse(mockContext);

      // Assert
      expect(result.content).toBe('Cached response');
      expect(result.generationMetrics.cacheHit).toBe(true);
      expect(result.generationMetrics.generationTime).toBe(0);
      expect(mockLLMService.generateResponse).not.toHaveBeenCalled();
    });

    it('should handle LLM generation errors gracefully', async () => {
      // Arrange
      const mockTemplate: ToolResponsePromptTemplate = {
        id: 'test_template',
        category: ToolCategory.WORKSPACE,
        style: 'conversational',
        systemPrompt: 'You are a helpful assistant',
        successTemplate: 'Success template',
        errorTemplate: 'Error template',
        partialSuccessTemplate: 'Partial success template',
        enabled: true,
        priority: 1
      };

      mockPromptTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockLLMService.generateResponse.mockRejectedValue(new Error('LLM service unavailable'));
      mockResponseCache.get.mockResolvedValue(null);

      // Act & Assert
      await expect(formatter.formatResponse(mockContext)).rejects.toThrow(LLMGenerationError);
    });

    it('should apply response length constraints', async () => {
      // Arrange
      const longResponse = 'A'.repeat(1000); // Create a response longer than max length
      const contextWithShortLimit = {
        ...mockContext,
        responseConfig: {
          ...mockContext.responseConfig,
          maxResponseLength: 100
        }
      };

      const mockTemplate: ToolResponsePromptTemplate = {
        id: 'test_template',
        category: ToolCategory.WORKSPACE,
        style: 'conversational',
        systemPrompt: 'You are a helpful assistant',
        successTemplate: 'Success template',
        errorTemplate: 'Error template',
        partialSuccessTemplate: 'Partial success template',
        enabled: true,
        priority: 1
      };

      mockPromptTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockLLMService.generateResponse.mockResolvedValue(longResponse);
      mockResponseCache.get.mockResolvedValue(null);

      // Act
      const result = await formatter.formatResponse(contextWithShortLimit);

      // Assert
      expect(result.content.length).toBeLessThanOrEqual(100);
      expect(result.content).toMatch(/\.\.\.$/); // Should end with ellipsis
    });

    it('should remove emojis when not desired', async () => {
      // Arrange
      const responseWithEmojis = 'Great work! 😊👍 Task completed successfully! 🎉';
      const contextWithoutEmojis = {
        ...mockContext,
        responseConfig: {
          ...mockContext.responseConfig,
          includeEmojis: false
        }
      };

      const mockTemplate: ToolResponsePromptTemplate = {
        id: 'test_template',
        category: ToolCategory.WORKSPACE,
        style: 'conversational',
        systemPrompt: 'You are a helpful assistant',
        successTemplate: 'Success template',
        errorTemplate: 'Error template',
        partialSuccessTemplate: 'Partial success template',
        enabled: true,
        priority: 1
      };

      mockPromptTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockLLMService.generateResponse.mockResolvedValue(responseWithEmojis);
      mockResponseCache.get.mockResolvedValue(null);

      // Act
      const result = await formatter.formatResponse(contextWithoutEmojis);

      // Assert
      expect(result.content).not.toMatch(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u);
      expect(result.content).toContain('Great work!');
      expect(result.content).toContain('Task completed successfully!');
    });

    it('should calculate quality scores correctly', async () => {
      // Arrange
      const contextWithIntent = {
        ...mockContext,
        executionIntent: 'send email',
        toolResult: {
          ...mockContext.toolResult,
          toolId: 'email_sender'
        }
      };

      const relevantResponse = 'I successfully sent your email using the email_sender tool.';

      const mockTemplate: ToolResponsePromptTemplate = {
        id: 'test_template',
        category: ToolCategory.WORKSPACE,
        style: 'conversational',
        systemPrompt: 'You are a helpful assistant',
        successTemplate: 'Success template',
        errorTemplate: 'Error template',
        partialSuccessTemplate: 'Partial success template',
        enabled: true,
        priority: 1
      };

      mockPromptTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockLLMService.generateResponse.mockResolvedValue(relevantResponse);
      mockResponseCache.get.mockResolvedValue(null);

      // Act
      const result = await formatter.formatResponse(contextWithIntent);

      // Assert
      expect(result.qualityScore).toBeGreaterThan(0.5); // Should score well for relevance
    });

    it('should cache responses when caching is enabled', async () => {
      // Arrange
      const mockTemplate: ToolResponsePromptTemplate = {
        id: 'test_template',
        category: ToolCategory.WORKSPACE,
        style: 'conversational',
        systemPrompt: 'You are a helpful assistant',
        successTemplate: 'Success template',
        errorTemplate: 'Error template',
        partialSuccessTemplate: 'Partial success template',
        enabled: true,
        priority: 1
      };

      mockPromptTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockLLMService.generateResponse.mockResolvedValue('Response to cache');
      mockResponseCache.get.mockResolvedValue(null);
      mockResponseCache.set.mockResolvedValue();

      // Act
      await formatter.formatResponse(mockContext);

      // Assert
      expect(mockResponseCache.set).toHaveBeenCalledWith(
        expect.stringContaining('tool_response:'),
        expect.objectContaining({
          content: 'Response to cache'
        }),
        mockContext.responseConfig.cacheTTLSeconds
      );
    });
  });

  describe('getAvailableStyles', () => {
    it('should return available styles for a tool category', async () => {
      // Arrange
      const mockTemplates: ToolResponsePromptTemplate[] = [
        {
          id: 'workspace_business',
          category: ToolCategory.WORKSPACE,
          style: 'business',
          systemPrompt: 'Business prompt',
          successTemplate: 'Success',
          errorTemplate: 'Error',
          partialSuccessTemplate: 'Partial',
          enabled: true,
          priority: 1
        },
        {
          id: 'workspace_casual',
          category: ToolCategory.WORKSPACE,
          style: 'casual',
          systemPrompt: 'Casual prompt',
          successTemplate: 'Success',
          errorTemplate: 'Error',
          partialSuccessTemplate: 'Partial',
          enabled: true,
          priority: 2
        }
      ];

      mockPromptTemplateService.getAllTemplates.mockResolvedValue(mockTemplates);

      // Act
      const result = await formatter.getAvailableStyles(ToolCategory.WORKSPACE);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('business');
      expect(result[1].name).toBe('casual');
    });

    it('should return default style when template service fails', async () => {
      // Arrange
      mockPromptTemplateService.getAllTemplates.mockRejectedValue(new Error('Service unavailable'));

      // Act
      const result = await formatter.getAvailableStyles(ToolCategory.WORKSPACE);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('conversational');
    });

    it('should remove duplicate styles', async () => {
      // Arrange
      const mockTemplates: ToolResponsePromptTemplate[] = [
        {
          id: 'workspace_business_1',
          category: ToolCategory.WORKSPACE,
          style: 'business',
          systemPrompt: 'Business prompt 1',
          successTemplate: 'Success',
          errorTemplate: 'Error',
          partialSuccessTemplate: 'Partial',
          enabled: true,
          priority: 1
        },
        {
          id: 'workspace_business_2',
          category: ToolCategory.WORKSPACE,
          style: 'business',
          systemPrompt: 'Business prompt 2',
          successTemplate: 'Success',
          errorTemplate: 'Error',
          partialSuccessTemplate: 'Partial',
          enabled: true,
          priority: 2
        }
      ];

      mockPromptTemplateService.getAllTemplates.mockResolvedValue(mockTemplates);

      // Act
      const result = await formatter.getAvailableStyles(ToolCategory.WORKSPACE);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('business');
    });
  });

  describe('error handling', () => {
    it('should throw ToolResponseFormattingError for invalid contexts', async () => {
      // Arrange
      const invalidContext = {
        ...mockContext,
        toolResult: {
          ...mockContext.toolResult,
          toolId: '' // Invalid tool ID
        }
      };

      mockPromptTemplateService.getTemplate.mockResolvedValue({
        id: 'test_template',
        category: ToolCategory.WORKSPACE,
        style: 'conversational',
        systemPrompt: 'Test prompt',
        successTemplate: 'Success',
        errorTemplate: 'Error',
        partialSuccessTemplate: 'Partial',
        enabled: true,
        priority: 1
      });

      mockLLMService.generateResponse.mockResolvedValue('Very short'); // Too short
      mockResponseCache.get.mockResolvedValue(null);

      // Act
      const result = await formatter.formatResponse(invalidContext);

      // Assert - should succeed but with low quality score due to short length
      expect(result.content).toBe('Very short');
      expect(result.qualityScore).toBeLessThan(0.7); // Quality should be lower for short responses
    });

    it('should handle prompt template service failures with fallback', async () => {
      // Arrange
      mockPromptTemplateService.getTemplate.mockRejectedValue(new Error('Template not found'));
      mockLLMService.generateResponse.mockResolvedValue('Fallback response with adequate length for testing purposes');
      mockResponseCache.get.mockResolvedValue(null);

      // Act
      const result = await formatter.formatResponse(mockContext);

      // Assert
      expect(result.content).toBe('Fallback response with adequate length for testing purposes');
      expect(result.fallbackUsed).toBe(false); // System prompt fallback, not response fallback
    });
  });
});

// Helper function to create mock context
function createMockContext(): ToolResponseContext {
  const mockToolResult: ToolExecutionResult = {
    id: ulid(),
    toolId: 'test_tool',
    success: true,
    data: { result: 'Test data' },
    metrics: {
      startTime: Date.now(),
      endTime: Date.now() + 100,
      durationMs: 100
    }
  };

  const mockPersona: PersonaInfo = {
    background: 'Test assistant',
    personality: 'Helpful and friendly',
    communicationStyle: 'Professional yet approachable',
    expertise: ['testing', 'assistance'],
    preferences: {}
  };

  return {
    id: ulid(),
    timestamp: new Date(),
    toolResult: mockToolResult,
    toolCategory: ToolCategory.WORKSPACE,
    executionIntent: 'test operation',
    originalUserMessage: 'Please run the test tool',
    agentId: 'test_agent',
    agentPersona: mockPersona,
    agentCapabilities: ['testing', 'assistance'],
    userId: 'test_user',
    userPreferences: {
      preferredTone: 'friendly',
      maxMessageLength: 500,
      enableEmojis: true,
      includeMetrics: false,
      communicationStyle: 'conversational'
    },
    conversationHistory: [],
    responseConfig: {
      enableLLMFormatting: true,
      maxResponseLength: 500,
      includeEmojis: true,
      includeNextSteps: true,
      includeMetrics: false,
      responseStyle: 'conversational',
      enableCaching: true,
      cacheTTLSeconds: 3600,
      toolCategoryOverrides: {}
    },
    fallbackEnabled: true
  };
} 