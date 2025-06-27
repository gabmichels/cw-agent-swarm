/**
 * Integration tests for LLMPersonaFormatter
 * 
 * Tests the integration with OutputProcessingCoordinator and the adapter pattern
 * for hooking into the existing formatter system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ulid } from 'ulid';
import { LLMPersonaFormatter } from '../LLMPersonaFormatter';
import { LLMToolResponseFormatter } from '../LLMToolResponseFormatter';
import { AgentResponse } from '../../../agents/shared/base/AgentBase.interface';
import { ToolExecutionResult } from '../../../lib/tools/types';
import {
  IToolResponseConfigService,
  ToolResponseConfig,
  FormattedToolResponse,
  ToolCategory
} from '../types';

// Mock dependencies
const mockToolResponseFormatter: jest.Mocked<LLMToolResponseFormatter> = {
  formatResponse: vi.fn(),
  getAvailableStyles: vi.fn()
};

const mockConfigService: jest.Mocked<IToolResponseConfigService> = {
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  getDefaultConfig: vi.fn()
};

// Mock logger
vi.mock('../../../lib/logging/winston-logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

describe('LLMPersonaFormatter', () => {
  let formatter: LLMPersonaFormatter;
  let mockAgentResponse: AgentResponse;
  let mockToolResult: ToolExecutionResult;
  let mockConfig: ToolResponseConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create formatter instance
    formatter = new LLMPersonaFormatter(
      mockToolResponseFormatter,
      mockConfigService
    );

    // Create mock objects
    mockToolResult = {
      id: ulid(),
      toolId: 'email_sender',
      success: true,
      data: { messageId: 'msg_123', recipient: 'user@example.com' },
      metrics: {
        startTime: Date.now(),
        endTime: Date.now() + 150,
        durationMs: 150
      }
    };

    mockConfig = {
      enableLLMFormatting: true,
      maxResponseLength: 500,
      includeEmojis: true,
      includeNextSteps: true,
      includeMetrics: false,
      responseStyle: 'conversational',
      enableCaching: true,
      cacheTTLSeconds: 3600,
      toolCategoryOverrides: {}
    };

    mockAgentResponse = {
      content: 'Email sent successfully',
      thoughts: [],
      metadata: {
        toolResult: mockToolResult,
        agentId: 'assistant_001',
        agentPersona: {
          background: 'Professional email assistant',
          personality: 'Helpful and efficient',
          communicationStyle: 'Professional yet friendly',
          expertise: ['email management', 'communication'],
          preferences: {}
        },
        agentCapabilities: ['email', 'calendar', 'contacts'],
        userId: 'user_123',
        userPreferences: {
          preferredTone: 'friendly',
          maxMessageLength: 500,
          enableEmojis: true,
          includeMetrics: false,
          communicationStyle: 'conversational'
        },
        conversationHistory: [],
        originalMessage: 'Please send an email to user@example.com',
        originalIntent: 'send email'
      }
    };
  });

  describe('format', () => {
    it('should successfully format tool response when all conditions are met', async () => {
      // Arrange
      const formattedResponse: FormattedToolResponse = {
        id: ulid(),
        content: 'Perfect! I\'ve successfully sent your email to user@example.com. The message has been delivered and you should see it in your sent folder. 📧',
        responseStyle: 'conversational',
        generationMetrics: {
          generationTime: 250,
          promptTokens: 120,
          responseTokens: 45,
          cacheHit: false
        },
        qualityScore: 0.92,
        fallbackUsed: false,
        timestamp: new Date()
      };

      mockConfigService.getConfig.mockResolvedValue(mockConfig);
      mockToolResponseFormatter.formatResponse.mockResolvedValue(formattedResponse);

      // Act
      const result = await formatter.format('Email sent successfully', mockAgentResponse);

      // Assert
      expect(result).toBe(formattedResponse.content);
      expect(mockConfigService.getConfig).toHaveBeenCalledWith('assistant_001');
      expect(mockToolResponseFormatter.formatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          toolResult: mockToolResult,
          toolCategory: ToolCategory.WORKSPACE, // email_sender should be categorized as workspace
          agentId: 'assistant_001',
          originalUserMessage: 'Please send an email to user@example.com',
          executionIntent: 'send email'
        })
      );
    });

    it('should return original content when no tool result is found', async () => {
      // Arrange
      const responseWithoutToolResult = {
        ...mockAgentResponse,
        metadata: {
          ...mockAgentResponse.metadata,
          toolResult: undefined
        }
      };

      // Act
      const result = await formatter.format('Regular response', responseWithoutToolResult);

      // Assert
      expect(result).toBe('Regular response');
      expect(mockConfigService.getConfig).not.toHaveBeenCalled();
      expect(mockToolResponseFormatter.formatResponse).not.toHaveBeenCalled();
    });

    it('should return original content when agent ID is missing', async () => {
      // Arrange
      const responseWithoutAgentId = {
        ...mockAgentResponse,
        metadata: {
          ...mockAgentResponse.metadata,
          agentId: undefined
        }
      };

      // Act
      const result = await formatter.format('Regular response', responseWithoutAgentId);

      // Assert
      expect(result).toBe('Regular response');
      expect(mockConfigService.getConfig).not.toHaveBeenCalled();
      expect(mockToolResponseFormatter.formatResponse).not.toHaveBeenCalled();
    });

    it('should return original content when LLM formatting is disabled', async () => {
      // Arrange
      const disabledConfig = {
        ...mockConfig,
        enableLLMFormatting: false
      };

      mockConfigService.getConfig.mockResolvedValue(disabledConfig);

      // Act
      const result = await formatter.format('Tool response', mockAgentResponse);

      // Assert
      expect(result).toBe('Tool response');
      expect(mockConfigService.getConfig).toHaveBeenCalledWith('assistant_001');
      expect(mockToolResponseFormatter.formatResponse).not.toHaveBeenCalled();
    });

    it('should handle formatter errors gracefully and return original content', async () => {
      // Arrange
      mockConfigService.getConfig.mockResolvedValue(mockConfig);
      mockToolResponseFormatter.formatResponse.mockRejectedValue(new Error('LLM service unavailable'));

      // Act
      const result = await formatter.format('Tool response', mockAgentResponse);

      // Assert
      expect(result).toBe('Tool response'); // Should fallback to original content
      expect(mockConfigService.getConfig).toHaveBeenCalledWith('assistant_001');
      expect(mockToolResponseFormatter.formatResponse).toHaveBeenCalled();
    });

    it('should correctly categorize different tool types', async () => {
      // Arrange
      const socialMediaToolResult = {
        ...mockToolResult,
        toolId: 'twitter_post'
      };

      const socialMediaResponse = {
        ...mockAgentResponse,
        metadata: {
          ...mockAgentResponse.metadata,
          toolResult: socialMediaToolResult
        }
      };

      const formattedResponse: FormattedToolResponse = {
        id: ulid(),
        content: 'Tweet posted successfully! 🐦',
        responseStyle: 'conversational',
        generationMetrics: {
          generationTime: 200,
          promptTokens: 100,
          responseTokens: 30,
          cacheHit: false
        },
        qualityScore: 0.85,
        fallbackUsed: false,
        timestamp: new Date()
      };

      mockConfigService.getConfig.mockResolvedValue(mockConfig);
      mockToolResponseFormatter.formatResponse.mockResolvedValue(formattedResponse);

      // Act
      const result = await formatter.format('Tweet posted', socialMediaResponse);

      // Assert
      expect(result).toBe(formattedResponse.content);
      expect(mockToolResponseFormatter.formatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCategory: ToolCategory.SOCIAL_MEDIA,
          toolResult: socialMediaToolResult
        })
      );
    });

    it('should use default values when metadata is incomplete', async () => {
      // Arrange
      const minimalResponse = {
        content: 'Basic response',
        thoughts: [],
        metadata: {
          toolResult: mockToolResult,
          agentId: 'assistant_001'
          // Missing most metadata
        }
      };

      const formattedResponse: FormattedToolResponse = {
        id: ulid(),
        content: 'Formatted response with defaults',
        responseStyle: 'conversational',
        generationMetrics: {
          generationTime: 150,
          promptTokens: 80,
          responseTokens: 25,
          cacheHit: false
        },
        qualityScore: 0.75,
        fallbackUsed: false,
        timestamp: new Date()
      };

      mockConfigService.getConfig.mockResolvedValue(mockConfig);
      mockToolResponseFormatter.formatResponse.mockResolvedValue(formattedResponse);

      // Act
      const result = await formatter.format('Basic response', minimalResponse);

      // Assert
      expect(result).toBe(formattedResponse.content);
      expect(mockToolResponseFormatter.formatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          agentPersona: expect.objectContaining({
            background: 'A helpful AI assistant'
          }),
          userPreferences: expect.objectContaining({
            preferredTone: 'friendly'
          }),
          userId: 'unknown',
          executionIntent: 'unknown'
        })
      );
    });
  });

  describe('validate', () => {
    it('should always return true', () => {
      // Act & Assert
      expect(formatter.validate('any content')).toBe(true);
      expect(formatter.validate('')).toBe(true);
      expect(formatter.validate('   ')).toBe(true);
    });
  });

  describe('formatter properties', () => {
    it('should have correct formatter properties', () => {
      // Assert
      expect(formatter.name).toBe('llm_persona_formatter');
      expect(formatter.enabled).toBe(true);
      expect(formatter.priority).toBe(100); // Highest priority
      expect(formatter.supportedTypes).toEqual(['*']); // All content types
    });
  });

  describe('tool category detection', () => {
    it('should correctly detect workspace tools', async () => {
      // Test various workspace tool IDs
      const workspaceTools = [
        'email_sender',
        'google_calendar',
        'drive_uploader',
        'google_sheets',
        'docs_creator'
      ];

      for (const toolId of workspaceTools) {
        const toolResult = { ...mockToolResult, toolId };
        const response = {
          ...mockAgentResponse,
          metadata: { ...mockAgentResponse.metadata, toolResult }
        };

        mockConfigService.getConfig.mockResolvedValue(mockConfig);
        mockToolResponseFormatter.formatResponse.mockResolvedValue({
          id: ulid(),
          content: 'Test response',
          responseStyle: 'conversational',
          generationMetrics: { generationTime: 100, promptTokens: 50, responseTokens: 20, cacheHit: false },
          qualityScore: 0.8,
          fallbackUsed: false,
          timestamp: new Date()
        });

        await formatter.format('test', response);

        expect(mockToolResponseFormatter.formatResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            toolCategory: ToolCategory.WORKSPACE
          })
        );

        vi.clearAllMocks();
      }
    });

    it('should correctly detect API tools', async () => {
      // Test various API tool IDs
      const apiTools = [
        'apify_scraper',
        'web_search',
        'http_request',
        'api_fetch'
      ];

      for (const toolId of apiTools) {
        const toolResult = { ...mockToolResult, toolId };
        const response = {
          ...mockAgentResponse,
          metadata: { ...mockAgentResponse.metadata, toolResult }
        };

        mockConfigService.getConfig.mockResolvedValue(mockConfig);
        mockToolResponseFormatter.formatResponse.mockResolvedValue({
          id: ulid(),
          content: 'Test response',
          responseStyle: 'conversational',
          generationMetrics: { generationTime: 100, promptTokens: 50, responseTokens: 20, cacheHit: false },
          qualityScore: 0.8,
          fallbackUsed: false,
          timestamp: new Date()
        });

        await formatter.format('test', response);

        expect(mockToolResponseFormatter.formatResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            toolCategory: ToolCategory.EXTERNAL_API
          })
        );

        vi.clearAllMocks();
      }
    });

    it('should default to CUSTOM category for unknown tools', async () => {
      // Arrange
      const unknownToolResult = { ...mockToolResult, toolId: 'unknown_custom_tool' };
      const response = {
        ...mockAgentResponse,
        metadata: { ...mockAgentResponse.metadata, toolResult: unknownToolResult }
      };

      mockConfigService.getConfig.mockResolvedValue(mockConfig);
      mockToolResponseFormatter.formatResponse.mockResolvedValue({
        id: ulid(),
        content: 'Test response',
        responseStyle: 'conversational',
        generationMetrics: { generationTime: 100, promptTokens: 50, responseTokens: 20, cacheHit: false },
        qualityScore: 0.8,
        fallbackUsed: false,
        timestamp: new Date()
      });

      // Act
      await formatter.format('test', response);

      // Assert
      expect(mockToolResponseFormatter.formatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCategory: ToolCategory.CUSTOM
        })
      );
    });
  });
}); 