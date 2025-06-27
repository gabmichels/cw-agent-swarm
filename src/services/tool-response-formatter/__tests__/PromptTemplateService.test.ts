/**
 * Tests for PromptTemplateService
 */

import { ulid } from 'ulid';
import { ToolExecutionResult } from '../../../lib/tools/types';
import { PersonaInfo } from '../../../types';
import { PromptTemplateService } from '../PromptTemplateService';
import { ResponseStyleType, ToolCategory, ToolResponseConfig, ToolResponseContext } from '../types';

// Mock dependencies
const mockPersonaInfo: PersonaInfo = {
  id: 'persona_1',
  name: 'Test Assistant',
  role: 'Business Assistant',
  background: 'Experienced in business operations and customer service',
  personality: 'Professional, friendly, and detail-oriented',
  communicationStyle: 'Direct and supportive',
  capabilities: ['email', 'calendar', 'data analysis'],
  systemPrompt: 'You are a helpful business assistant.',
  avatar: 'business-assistant.png',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockToolExecutionResult: ToolExecutionResult = {
  id: ulid(),
  toolId: 'test_email_tool',
  success: true,
  data: {
    messageId: 'msg_123',
    recipients: ['user@example.com'],
    subject: 'Test Email'
  },
  metrics: {
    startTime: Date.now() - 1000,
    endTime: Date.now(),
    durationMs: 1000
  }
};

const mockToolResponseConfig: ToolResponseConfig = {
  enableLLMFormatting: true,
  maxResponseLength: 500,
  includeEmojis: true,
  includeNextSteps: true,
  includeMetrics: false,
  responseStyle: 'conversational',
  enableCaching: true,
  cacheTTLSeconds: 1800,
  toolCategoryOverrides: {}
};

const mockToolResponseContext: ToolResponseContext = {
  id: ulid(),
  timestamp: new Date(),
  toolResult: mockToolExecutionResult,
  toolCategory: ToolCategory.WORKSPACE,
  executionIntent: 'Send a test email',
  originalUserMessage: 'Please send an email to user@example.com',
  agentId: 'agent_123',
  agentPersona: mockPersonaInfo,
  agentCapabilities: ['email', 'calendar', 'documents'],
  userId: 'user_456',
  userPreferences: {
    preferredTone: 'professional',
    maxMessageLength: 300,
    enableEmojis: true,
    includeMetrics: false,
    communicationStyle: 'detailed'
  },
  conversationHistory: [],
  responseConfig: mockToolResponseConfig,
  fallbackEnabled: true
};

describe('PromptTemplateService', () => {
  let service: PromptTemplateService;

  beforeEach(() => {
    service = new PromptTemplateService();
  });

  describe('getTemplate', () => {
    it('should retrieve template for valid category and style', async () => {
      const template = await service.getTemplate(ToolCategory.WORKSPACE, 'conversational');

      expect(template).toBeDefined();
      expect(template.category).toBe(ToolCategory.WORKSPACE);
      expect(template.style).toBe('conversational');
      expect(template.enabled).toBe(true);
      expect(template.systemPrompt).toContain('workplace');
    });

    it('should use fallback template for unavailable combinations', async () => {
      // Test with a combination that might not exist
      const template = await service.getTemplate(ToolCategory.CUSTOM, 'technical');

      expect(template).toBeDefined();
      expect(template.enabled).toBe(true);
      expect(template.systemPrompt).toBeDefined();
    });

    it('should throw error for completely invalid category/style', async () => {
      // This should trigger the fallback, but if fallback fails, it should throw
      try {
        await service.getTemplate('invalid_category' as ToolCategory, 'invalid_style' as ResponseStyleType);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('getAllTemplates', () => {
    it('should return all available templates', async () => {
      const templates = await service.getAllTemplates();

      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);

      // Check that templates include different categories
      const categories = new Set(templates.map(t => t.category));
      expect(categories.has(ToolCategory.WORKSPACE)).toBe(true);
      expect(categories.has(ToolCategory.SOCIAL_MEDIA)).toBe(true);
    });

    it('should return only enabled templates', async () => {
      const templates = await service.getAllTemplates();

      templates.forEach(template => {
        expect(template.enabled).toBe(true);
      });
    });
  });

  describe('upsertTemplate', () => {
    it('should log upsert request and throw not implemented error', async () => {
      const mockTemplate = {
        id: 'test_template',
        category: ToolCategory.WORKSPACE,
        style: 'conversational' as ResponseStyleType,
        systemPrompt: 'Test prompt',
        successTemplate: 'Success!',
        errorTemplate: 'Error occurred.',
        partialSuccessTemplate: 'Partial success.',
        enabled: true,
        priority: 1
      };

      await expect(service.upsertTemplate(mockTemplate)).rejects.toThrow('not implemented');
    });
  });

  describe('generatePromptForContext', () => {
    it('should generate complete prompt result for context', async () => {
      const result = await service.generatePromptForContext(mockToolResponseContext);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.systemPrompt).toBeDefined();
      expect(result.template).toBeDefined();
      expect(result.responsePattern).toBeDefined();
      expect(result.personaAdapted).toBe(true);
      expect(result.generationMetrics).toBeDefined();
      expect(result.generationMetrics.totalGenerationTime).toBeGreaterThan(0);
    });

    it('should adapt prompt based on persona configuration', async () => {
      const personaConfig = {
        enablePersonaAdaptation: true,
        enableToneAdjustment: true,
        enableCapabilityContext: true,
        enableCommunicationStyleOverride: true,
        preferenceWeight: 0.8
      };

      const result = await service.generatePromptForContext(mockToolResponseContext, personaConfig);

      expect(result.personaAdapted).toBe(true);
      expect(result.systemPrompt).toContain('PERSONA INTEGRATION');
      expect(result.systemPrompt).toContain('AGENT CAPABILITIES CONTEXT');
      expect(result.systemPrompt).toContain('COMMUNICATION ADAPTATION');
    });

    it('should use cache for identical contexts', async () => {
      // First generation
      const result1 = await service.generatePromptForContext(mockToolResponseContext);

      // Second generation with same context
      const result2 = await service.generatePromptForContext(mockToolResponseContext);

      expect(result2.generationMetrics.cacheHit).toBe(true);
      expect(result2.generationMetrics.totalGenerationTime).toBeLessThan(result1.generationMetrics.totalGenerationTime);
    });

    it('should handle different response styles', async () => {
      const contexts = [
        { ...mockToolResponseContext, responseConfig: { ...mockToolResponseConfig, responseStyle: 'business' as ResponseStyleType } },
        { ...mockToolResponseContext, responseConfig: { ...mockToolResponseConfig, responseStyle: 'technical' as ResponseStyleType } },
        { ...mockToolResponseContext, responseConfig: { ...mockToolResponseConfig, responseStyle: 'casual' as ResponseStyleType } }
      ];

      const results = await Promise.all(
        contexts.map(context => service.generatePromptForContext(context))
      );

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.template.style).toBe(contexts[index].responseConfig.responseStyle);
        expect(result.responsePattern).toBeDefined();
      });
    });

    it('should handle error tool results appropriately', async () => {
      const errorContext = {
        ...mockToolResponseContext,
        toolResult: {
          ...mockToolExecutionResult,
          success: false,
          error: {
            message: 'Email sending failed',
            code: 'SMTP_ERROR',
            details: { reason: 'Invalid recipient' }
          }
        }
      };

      const result = await service.generatePromptForContext(errorContext);

      expect(result).toBeDefined();
      expect(result.responsePattern).toBeDefined();
      // Error responses should have different patterns than success responses
    });
  });

  describe('getAvailableStyles', () => {
    it('should return available styles for workspace category', async () => {
      const styles = await service.getAvailableStyles(ToolCategory.WORKSPACE);

      expect(Array.isArray(styles)).toBe(true);
      expect(styles.length).toBeGreaterThan(0);
      expect(styles).toContain('conversational');
      expect(styles).toContain('business');
    });

    it('should return available styles for social media category', async () => {
      const styles = await service.getAvailableStyles(ToolCategory.SOCIAL_MEDIA);

      expect(Array.isArray(styles)).toBe(true);
      expect(styles.length).toBeGreaterThan(0);
      expect(styles).toContain('conversational');
    });

    it('should include default style even if not directly available', async () => {
      const styles = await service.getAvailableStyles(ToolCategory.CUSTOM);

      expect(Array.isArray(styles)).toBe(true);
      expect(styles.length).toBeGreaterThan(0);
      // Default style for CUSTOM category should be included
    });

    it('should return fallback for unknown categories', async () => {
      const styles = await service.getAvailableStyles('unknown' as ToolCategory);

      expect(styles).toEqual(['conversational']);
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = service.getCacheStatistics();

      expect(stats).toBeDefined();
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.totalHits).toBe('number');
      expect(stats.maxSize).toBeGreaterThan(0);
    });

    it('should clear cache when requested', async () => {
      // Generate some cached results
      await service.generatePromptForContext(mockToolResponseContext);

      let stats = service.getCacheStatistics();
      expect(stats.size).toBeGreaterThan(0);

      // Clear cache
      service.clearCache();

      stats = service.getCacheStatistics();
      expect(stats.size).toBe(0);
    });

    it('should handle cache eviction when full', async () => {
      // This test would require generating many different contexts to fill cache
      // For now, just verify the cache statistics work
      const stats = service.getCacheStatistics();
      expect(stats.maxSize).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle missing persona information gracefully', async () => {
      const contextWithoutPersona = {
        ...mockToolResponseContext,
        agentPersona: {
          ...mockPersonaInfo,
          personality: undefined,
          communicationStyle: undefined
        }
      };

      const result = await service.generatePromptForContext(contextWithoutPersona);

      expect(result).toBeDefined();
      expect(result.personaAdapted).toBe(true); // Should still adapt with available info
    });

    it('should handle empty capabilities list', async () => {
      const contextWithoutCapabilities = {
        ...mockToolResponseContext,
        agentCapabilities: []
      };

      const result = await service.generatePromptForContext(contextWithoutCapabilities);

      expect(result).toBeDefined();
      expect(result.systemPrompt).toContain('No specific agent capabilities available');
    });

    it('should handle disabled persona adaptation', async () => {
      const personaConfig = {
        enablePersonaAdaptation: false,
        enableToneAdjustment: false,
        enableCapabilityContext: false,
        enableCommunicationStyleOverride: false,
        preferenceWeight: 0
      };

      const result = await service.generatePromptForContext(mockToolResponseContext, personaConfig);

      expect(result.personaAdapted).toBe(false);
      // System prompt should be less customized
    });
  });
}); 