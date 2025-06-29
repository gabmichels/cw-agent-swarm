import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ulid } from 'ulid';
import { WorkspaceACGIntegration } from '../../integration/WorkspaceACGIntegration';
import { DefaultContentGenerationService } from '../../core/DefaultContentGenerationService';
import { EmailContentGenerator } from '../../generators/email/EmailContentGenerator';
import { ContentGeneratorFactory } from '../../factories/ContentGeneratorFactory';
import { ContentType, GenerationMethod } from '../../types/ContentGenerationTypes';
import type { WorkspaceNLPProcessor } from '../../../workspace/WorkspaceNLPProcessor';
import type { ICache } from '../../interfaces/ICache';
import type { ILogger } from '../../interfaces/ILogger';

describe('ACG Workspace Integration', () => {
  let integration: WorkspaceACGIntegration;
  let mockNLPProcessor: WorkspaceNLPProcessor;
  let contentGenerationService: DefaultContentGenerationService;
  let mockCache: ICache;
  let mockLogger: ILogger;
  let mockLLMService: any;

  beforeEach(() => {
    // Mock LLM Service
    mockLLMService = {
      generateResponse: vi.fn().mockResolvedValue({
        content: 'Generated content from LLM',
        confidence: 0.9,
        tokensUsed: 150,
        model: 'gpt-4',
        processingTimeMs: 500
      }),
      estimateTokens: vi.fn().mockReturnValue(100),
      validateResponse: vi.fn().mockReturnValue(true)
    };

    // Mock Cache
    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(void 0),
      delete: vi.fn().mockResolvedValue(true),
      clear: vi.fn().mockResolvedValue(void 0),
      has: vi.fn().mockResolvedValue(false),
      keys: vi.fn().mockResolvedValue([]),
      generateKey: vi.fn().mockReturnValue('integration-test-key')
    };

    // Mock Logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    // Mock NLP Processor
    mockNLPProcessor = {
      parseCommand: vi.fn().mockResolvedValue({
        action: 'send_email',
        entities: {
          recipients: ['test@example.com'],
          subject: null, // Missing - should trigger ACG
          body: null, // Missing - should trigger ACG
          action: 'send'
        },
        originalText: 'Send an email to test@example.com about Bitcoin investment opportunities',
        confidence: 0.9,
        intent: 'email_communication'
      })
    } as any;

    // Create real content generation service with mocked dependencies
    const emailGenerator = new EmailContentGenerator(mockLLMService, mockLogger);
    const generatorFactory = new ContentGeneratorFactory();
    generatorFactory.registerGenerator(emailGenerator);

    contentGenerationService = new DefaultContentGenerationService({
      generators: [emailGenerator],
      cache: mockCache,
      logger: mockLogger,
      config: {
        defaultTimeout: 30000,
        maxRetries: 3,
        cacheEnabled: true,
        cacheTTL: 3600,
        batchSize: 10
      }
    });

    integration = new WorkspaceACGIntegration(
      mockNLPProcessor,
      contentGenerationService,
      {
        enableAutoGeneration: true,
        requireConfirmation: false,
        maxGenerationTimeMs: 30000,
        fallbackOnError: true
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Email Generation', () => {
    it('should parse user input and generate missing email content', async () => {
      const userInput = 'Send gab@crowd-wisdom.com an email with 10 reasons why he should consider Bitcoin as a serious investment vehicle';
      const userId = 'test-user-123';
      const agentId = 'test-agent-456';

      // Mock NLP processor to return command with missing content
      mockNLPProcessor.parseCommand = vi.fn().mockResolvedValue({
        action: 'send_email',
        entities: {
          recipients: ['gab@crowd-wisdom.com'],
          subject: null, // Missing - should trigger ACG
          body: null, // Missing - should trigger ACG
          action: 'send'
        },
        originalText: userInput,
        confidence: 0.9,
        intent: 'email_communication'
      });

      // Mock LLM to generate different content for subject vs body
      mockLLMService.generateResponse = vi.fn()
        .mockResolvedValueOnce({
          content: '10 Compelling Reasons to Consider Bitcoin as a Serious Investment',
          confidence: 0.95,
          tokensUsed: 25,
          model: 'gpt-4',
          processingTimeMs: 300
        })
        .mockResolvedValueOnce({
          content: `Dear Gab,

I hope this email finds you well. I wanted to share with you 10 compelling reasons why Bitcoin should be considered as a serious investment vehicle:

1. Digital Gold: Bitcoin serves as a hedge against inflation
2. Limited Supply: Only 21 million Bitcoin will ever exist
3. Institutional Adoption: Major companies are adding Bitcoin to their balance sheets
4. Network Effect: Growing global adoption and acceptance
5. Decentralized Nature: No single point of failure or control
6. Transparency: All transactions are recorded on a public ledger
7. Portability: Easy to transfer across borders
8. Divisibility: Can be divided into very small units
9. Store of Value: Proven track record over time
10. Future Technology: Built on revolutionary blockchain technology

I'd be happy to discuss this further if you're interested.

Best regards`,
          confidence: 0.92,
          tokensUsed: 180,
          model: 'gpt-4',
          processingTimeMs: 800
        });

      const result = await integration.parseCommandWithACG(userInput, userId, agentId);

      // Verify the command was enhanced with generated content
      expect(result).toBeDefined();
      expect(result!.contentGenerated).toBe(true);
      expect(result!.entities.subject).toBe('10 Compelling Reasons to Consider Bitcoin as a Serious Investment');
      expect(result!.entities.body).toContain('Dear Gab');
      expect(result!.entities.body).toContain('10 compelling reasons');
      expect(result!.entities.body).toContain('Digital Gold');

      // Verify both subject and body were generated
      expect(result!.generatedContent?.subject).toBeDefined();
      expect(result!.generatedContent?.body).toBeDefined();

      // Verify LLM was called twice (subject + body)
      expect(mockLLMService.generateResponse).toHaveBeenCalledTimes(2);

      // Verify caching was attempted
      expect(mockCache.set).toHaveBeenCalledTimes(2);

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Content generated successfully'),
        expect.any(Object)
      );
    });

    it('should handle partial content generation gracefully', async () => {
      const userInput = 'Send an email to investor@example.com with subject "Investment Opportunity" about Bitcoin';

      mockNLPProcessor.parseCommand = vi.fn().mockResolvedValue({
        action: 'send_email',
        entities: {
          recipients: ['investor@example.com'],
          subject: 'Investment Opportunity', // Already provided
          body: null, // Missing - should trigger ACG
          action: 'send'
        },
        originalText: userInput,
        confidence: 0.9,
        intent: 'email_communication'
      });

      const result = await integration.parseCommandWithACG(userInput);

      expect(result).toBeDefined();
      expect(result!.contentGenerated).toBe(true);
      expect(result!.entities.subject).toBe('Investment Opportunity'); // Unchanged
      expect(result!.entities.body).toContain('Generated content from LLM'); // Generated

      // Should only generate body, not subject
      expect(result!.generatedContent?.subject).toBeUndefined();
      expect(result!.generatedContent?.body).toBeDefined();

      expect(mockLLMService.generateResponse).toHaveBeenCalledTimes(1);
    });

    it('should handle generation failures with fallback', async () => {
      const userInput = 'Send an email about Bitcoin to test@example.com';

      mockNLPProcessor.parseCommand = vi.fn().mockResolvedValue({
        action: 'send_email',
        entities: {
          recipients: ['test@example.com'],
          subject: null,
          body: null,
          action: 'send'
        },
        originalText: userInput,
        confidence: 0.9,
        intent: 'email_communication'
      });

      // Mock LLM to fail
      mockLLMService.generateResponse = vi.fn().mockRejectedValue(
        new Error('LLM service temporarily unavailable')
      );

      const result = await integration.parseCommandWithACG(userInput);

      // Should return original command even if generation fails (fallback)
      expect(result).toBeDefined();
      expect(result!.contentGenerated).toBe(false);
      expect(result!.entities.subject).toBeNull();
      expect(result!.entities.body).toBeNull();

      // Should log the error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Content generation process failed'),
        expect.any(Object)
      );
    });
  });

  describe('Content Quality Validation', () => {
    it('should validate generated content meets quality standards', async () => {
      const userInput = 'Send an email to client@example.com about our services';

      mockNLPProcessor.parseCommand = vi.fn().mockResolvedValue({
        action: 'send_email',
        entities: {
          recipients: ['client@example.com'],
          subject: null,
          body: null,
          action: 'send'
        },
        originalText: userInput,
        confidence: 0.9,
        intent: 'email_communication'
      });

      const result = await integration.parseCommandWithACG(userInput);

      expect(result).toBeDefined();
      expect(result!.contentGenerated).toBe(true);

      // Validate the generated content
      const validation = await integration.validateGeneratedContent(result!);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.suggestions).toHaveLength(0);
    });

    it('should detect quality issues in generated content', async () => {
      const userInput = 'Send an email to test@example.com';

      mockNLPProcessor.parseCommand = vi.fn().mockResolvedValue({
        action: 'send_email',
        entities: {
          recipients: ['test@example.com'],
          subject: null,
          body: null,
          action: 'send'
        },
        originalText: userInput,
        confidence: 0.9,
        intent: 'email_communication'
      });

      // Mock LLM to generate low-quality content
      mockLLMService.generateResponse = vi.fn()
        .mockResolvedValueOnce({
          content: 'Hi', // Too short subject
          confidence: 0.4, // Low confidence
          tokensUsed: 5,
          model: 'gpt-4',
          processingTimeMs: 100
        })
        .mockResolvedValueOnce({
          content: 'Thanks.', // Too short body
          confidence: 0.3, // Low confidence
          tokensUsed: 5,
          model: 'gpt-4',
          processingTimeMs: 100
        });

      const result = await integration.parseCommandWithACG(userInput);

      expect(result).toBeDefined();

      const validation = await integration.validateGeneratedContent(result!);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.suggestions.length).toBeGreaterThan(0);

      // Should suggest improvements
      expect(validation.suggestions).toContain(
        expect.stringContaining('more context')
      );
    });
  });

  describe('Generation Summary', () => {
    it('should provide human-readable summary of generated content', async () => {
      const userInput = 'Send an email to team@company.com about the meeting';

      mockNLPProcessor.parseCommand = vi.fn().mockResolvedValue({
        action: 'send_email',
        entities: {
          recipients: ['team@company.com'],
          subject: null,
          body: null,
          action: 'send'
        },
        originalText: userInput,
        confidence: 0.9,
        intent: 'email_communication'
      });

      const result = await integration.parseCommandWithACG(userInput);

      expect(result).toBeDefined();
      expect(result!.contentGenerated).toBe(true);

      const summary = integration.getGenerationSummary(result!);

      expect(summary).toBeDefined();
      expect(summary).toContain('I generated the');
      expect(summary).toContain('email subject and email body');
      expect(summary).toContain('based on your request');
    });

    it('should return null when no content was generated', async () => {
      const userInput = 'Send an email to test@example.com with subject "Test" and body "Hello"';

      mockNLPProcessor.parseCommand = vi.fn().mockResolvedValue({
        action: 'send_email',
        entities: {
          recipients: ['test@example.com'],
          subject: 'Test', // Already provided
          body: 'Hello', // Already provided
          action: 'send'
        },
        originalText: userInput,
        confidence: 0.9,
        intent: 'email_communication'
      });

      const result = await integration.parseCommandWithACG(userInput);

      expect(result).toBeDefined();
      expect(result!.contentGenerated).toBe(false);

      const summary = integration.getGenerationSummary(result!);

      expect(summary).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should complete end-to-end generation within reasonable time', async () => {
      const userInput = 'Send an email to performance@test.com about our quarterly results';

      mockNLPProcessor.parseCommand = vi.fn().mockResolvedValue({
        action: 'send_email',
        entities: {
          recipients: ['performance@test.com'],
          subject: null,
          body: null,
          action: 'send'
        },
        originalText: userInput,
        confidence: 0.9,
        intent: 'email_communication'
      });

      const startTime = Date.now();
      const result = await integration.parseCommandWithACG(userInput);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result!.contentGenerated).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent generation requests efficiently', async () => {
      const requests = Array.from({ length: 3 }, (_, i) =>
        `Send an email to user${i}@test.com about topic ${i}`
      );

      mockNLPProcessor.parseCommand = vi.fn().mockImplementation((text: string) => {
        const userIndex = text.match(/user(\d+)/)?.[1] || '0';
        return Promise.resolve({
          action: 'send_email',
          entities: {
            recipients: [`user${userIndex}@test.com`],
            subject: null,
            body: null,
            action: 'send'
          },
          originalText: text,
          confidence: 0.9,
          intent: 'email_communication'
        });
      });

      const startTime = Date.now();
      const promises = requests.map(request =>
        integration.parseCommandWithACG(request)
      );
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(results.every(r => r?.contentGenerated)).toBe(true);
      expect(duration).toBeLessThan(8000); // Should handle 3 concurrent requests within 8 seconds
    });
  });

  describe('Error Recovery', () => {
    it('should recover from NLP processor failures', async () => {
      const userInput = 'Send an email about Bitcoin';

      mockNLPProcessor.parseCommand = vi.fn().mockRejectedValue(
        new Error('NLP processor failed')
      );

      const result = await integration.parseCommandWithACG(userInput);

      expect(result).toBeNull(); // Should return null when NLP fails
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse command'),
        expect.any(Object)
      );
    });

    it('should handle cache failures gracefully', async () => {
      const userInput = 'Send an email to cache@test.com about caching';

      mockNLPProcessor.parseCommand = vi.fn().mockResolvedValue({
        action: 'send_email',
        entities: {
          recipients: ['cache@test.com'],
          subject: null,
          body: null,
          action: 'send'
        },
        originalText: userInput,
        confidence: 0.9,
        intent: 'email_communication'
      });

      // Mock cache to fail
      mockCache.get = vi.fn().mockRejectedValue(new Error('Cache unavailable'));
      mockCache.set = vi.fn().mockRejectedValue(new Error('Cache unavailable'));

      const result = await integration.parseCommandWithACG(userInput);

      // Should still succeed even with cache failures
      expect(result).toBeDefined();
      expect(result!.contentGenerated).toBe(true);

      // Should log cache warnings
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cache error'),
        expect.any(Object)
      );
    });
  });
}); 