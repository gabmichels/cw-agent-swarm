import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ulid } from 'ulid';
import { EmailContentGenerator } from '../../generators/email/EmailContentGenerator';
import { ContentType, GenerationMethod } from '../../types/ContentGenerationTypes';
import { ContentGenerationError } from '../../errors/ContentGenerationError';
import type { ILLMService } from '../../interfaces/ILLMService';
import type { ILogger } from '../../interfaces/ILogger';

describe('EmailContentGenerator', () => {
  let generator: EmailContentGenerator;
  let mockLLMService: ILLMService;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLLMService = {
      generateResponse: vi.fn().mockResolvedValue({
        content: 'Generated email content',
        confidence: 0.9,
        tokensUsed: 150,
        model: 'gpt-4',
        processingTimeMs: 500
      }),
      estimateTokens: vi.fn().mockReturnValue(100),
      validateResponse: vi.fn().mockReturnValue(true)
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    generator = new EmailContentGenerator(mockLLMService, mockLogger);
  });

  describe('Constructor', () => {
    it('should initialize with correct supported types', () => {
      expect(generator.supportedTypes).toEqual([
        ContentType.EMAIL_SUBJECT,
        ContentType.EMAIL_BODY,
        ContentType.EMAIL_REPLY,
        ContentType.EMAIL_FORWARD
      ]);
    });

    it('should have LLM-powered capabilities', () => {
      expect(generator.capabilities).toContain('CONTEXT_AWARE');
      expect(generator.capabilities).toContain('LLM_POWERED');
      expect(generator.capabilities).toContain('ANTI_HALLUCINATION');
    });
  });

  describe('canGenerate', () => {
    it('should return true for supported email types', () => {
      expect(generator.canGenerate(ContentType.EMAIL_SUBJECT)).toBe(true);
      expect(generator.canGenerate(ContentType.EMAIL_BODY)).toBe(true);
      expect(generator.canGenerate(ContentType.EMAIL_REPLY)).toBe(true);
      expect(generator.canGenerate(ContentType.EMAIL_FORWARD)).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(generator.canGenerate(ContentType.DOCUMENT_TEXT)).toBe(false);
      expect(generator.canGenerate(ContentType.SOCIAL_POST)).toBe(false);
    });
  });

  describe('generateContent', () => {
    const createEmailRequest = (contentType: ContentType, context: any = {}) => ({
      id: ulid(),
      agentId: 'test-agent',
      toolId: 'email-tool',
      contentType,
      context: {
        originalMessage: 'Send an email about Bitcoin investment opportunities',
        extractedEntities: {
          recipient: 'investor@example.com',
          topic: 'Bitcoin investment',
          ...context
        }
      },
      priority: 1,
      metadata: {
        createdAt: new Date(),
        userId: 'test-user',
        source: 'direct' as const,
        retryCount: 0
      }
    });

    describe('Email Subject Generation', () => {
      it('should generate appropriate email subject', async () => {
        const request = createEmailRequest(ContentType.EMAIL_SUBJECT);
        const result = await generator.generateContent(request);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBe(ContentType.EMAIL_SUBJECT);
          expect(result.data.content.text).toBe('Generated email content');
          expect(result.data.metadata.method).toBe(GenerationMethod.LLM_POWERED);
          expect(result.data.metadata.confidence).toBe(0.9);
        }

        expect(mockLLMService.generateResponse).toHaveBeenCalledWith(
          expect.stringContaining('email subject'),
          expect.objectContaining({
            temperature: 0.7,
            maxTokens: 50
          })
        );
      });

      it('should include context in subject generation prompt', async () => {
        const request = createEmailRequest(ContentType.EMAIL_SUBJECT, {
          urgency: 'high',
          tone: 'professional'
        });

        await generator.generateContent(request);

        const [prompt] = mockLLMService.generateResponse.mock.calls[0];
        expect(prompt).toContain('Bitcoin investment');
        expect(prompt).toContain('investor@example.com');
        expect(prompt).toContain('professional');
      });
    });

    describe('Email Body Generation', () => {
      it('should generate comprehensive email body', async () => {
        const request = createEmailRequest(ContentType.EMAIL_BODY);
        const result = await generator.generateContent(request);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBe(ContentType.EMAIL_BODY);
          expect(result.data.metadata.method).toBe(GenerationMethod.LLM_POWERED);
        }

        expect(mockLLMService.generateResponse).toHaveBeenCalledWith(
          expect.stringContaining('email body'),
          expect.objectContaining({
            temperature: 0.8,
            maxTokens: 500
          })
        );
      });

      it('should handle specific requirements in body generation', async () => {
        const request = createEmailRequest(ContentType.EMAIL_BODY, {
          requirements: ['Include 10 reasons', 'Professional tone', 'Call to action']
        });

        await generator.generateContent(request);

        const [prompt] = mockLLMService.generateResponse.mock.calls[0];
        expect(prompt).toContain('10 reasons');
        expect(prompt).toContain('Professional tone');
        expect(prompt).toContain('Call to action');
      });
    });

    describe('Email Reply Generation', () => {
      it('should generate contextual email reply', async () => {
        const request = createEmailRequest(ContentType.EMAIL_REPLY, {
          originalEmail: {
            from: 'client@example.com',
            subject: 'Question about Bitcoin',
            body: 'I have some concerns about Bitcoin volatility.'
          }
        });

        const result = await generator.generateContent(request);

        expect(result.success).toBe(true);
        expect(mockLLMService.generateResponse).toHaveBeenCalledWith(
          expect.stringContaining('reply to the email'),
          expect.any(Object)
        );

        const [prompt] = mockLLMService.generateResponse.mock.calls[0];
        expect(prompt).toContain('client@example.com');
        expect(prompt).toContain('Bitcoin volatility');
      });
    });

    describe('Email Forward Generation', () => {
      it('should generate appropriate forward content', async () => {
        const request = createEmailRequest(ContentType.EMAIL_FORWARD, {
          forwardTo: ['team@company.com'],
          forwardReason: 'FYI - Important market update'
        });

        const result = await generator.generateContent(request);

        expect(result.success).toBe(true);
        const [prompt] = mockLLMService.generateResponse.mock.calls[0];
        expect(prompt).toContain('forward');
        expect(prompt).toContain('FYI - Important market update');
      });
    });

    describe('Error Handling', () => {
      it('should handle LLM service failures', async () => {
        mockLLMService.generateResponse = vi.fn().mockRejectedValue(
          new Error('LLM service unavailable')
        );

        const request = createEmailRequest(ContentType.EMAIL_SUBJECT);
        const result = await generator.generateContent(request);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('LLM_SERVICE_ERROR');
          expect(result.error.message).toContain('LLM service unavailable');
        }
      });

      it('should handle low confidence responses', async () => {
        mockLLMService.generateResponse = vi.fn().mockResolvedValue({
          content: 'Generated content',
          confidence: 0.3, // Low confidence
          tokensUsed: 150,
          model: 'gpt-4',
          processingTimeMs: 500
        });

        const request = createEmailRequest(ContentType.EMAIL_SUBJECT);
        const result = await generator.generateContent(request);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('LOW_CONFIDENCE');
        }
      });

      it('should handle unsupported content types', async () => {
        const request = createEmailRequest(ContentType.DOCUMENT_TEXT);
        const result = await generator.generateContent(request);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('UNSUPPORTED_CONTENT_TYPE');
        }
      });
    });

    describe('Anti-Hallucination Measures', () => {
      it('should validate generated content against context', async () => {
        const request = createEmailRequest(ContentType.EMAIL_SUBJECT, {
          recipient: 'specific@example.com',
          topic: 'Quarterly Report'
        });

        await generator.generateContent(request);

        // Should validate that generated content is relevant to context
        expect(mockLLMService.validateResponse).toHaveBeenCalled();
      });

      it('should reject content that seems hallucinated', async () => {
        mockLLMService.validateResponse = vi.fn().mockReturnValue(false);

        const request = createEmailRequest(ContentType.EMAIL_SUBJECT);
        const result = await generator.generateContent(request);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('CONTENT_VALIDATION_FAILED');
        }
      });
    });
  });

  describe('validateContent', () => {
    const createGeneratedContent = (text: string, contentType: ContentType) => ({
      id: ulid(),
      type: contentType,
      content: { text },
      metadata: {
        generatedAt: new Date(),
        method: GenerationMethod.LLM_POWERED,
        confidence: 0.9,
        processingTimeMs: 500,
        fallbackUsed: false
      }
    });

    it('should validate email subject length', async () => {
      const shortSubject = createGeneratedContent('Hi', ContentType.EMAIL_SUBJECT);
      const result = await generator.validateContent(shortSubject);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'LENGTH_TOO_SHORT',
          severity: 'medium'
        })
      );
    });

    it('should validate email subject not too long', async () => {
      const longSubject = createGeneratedContent(
        'This is an extremely long email subject that exceeds reasonable limits and should be flagged as too long for most email clients',
        ContentType.EMAIL_SUBJECT
      );
      const result = await generator.validateContent(longSubject);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'LENGTH_EXCEEDED',
          severity: 'high'
        })
      );
    });

    it('should validate email body has sufficient content', async () => {
      const shortBody = createGeneratedContent('Thanks.', ContentType.EMAIL_BODY);
      const result = await generator.validateContent(shortBody);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'LENGTH_TOO_SHORT',
          severity: 'medium'
        })
      );
    });

    it('should validate appropriate email content', async () => {
      const goodSubject = createGeneratedContent(
        'Bitcoin Investment Opportunities - Q4 2024 Analysis',
        ContentType.EMAIL_SUBJECT
      );
      const result = await generator.validateContent(goodSubject);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect inappropriate content', async () => {
      const inappropriateContent = createGeneratedContent(
        'Get rich quick with this amazing crypto scheme!!!',
        ContentType.EMAIL_SUBJECT
      );
      const result = await generator.validateContent(inappropriateContent);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'INAPPROPRIATE_CONTENT',
          severity: 'high'
        })
      );
    });
  });

  describe('getHealth', () => {
    it('should return healthy status when LLM service is available', async () => {
      const health = await generator.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.responseTimeMs).toBeGreaterThan(0);
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('should return unhealthy status when LLM service fails', async () => {
      mockLLMService.generateResponse = vi.fn().mockRejectedValue(
        new Error('Service unavailable')
      );

      const health = await generator.getHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.details).toEqual({
        error: 'Service unavailable'
      });
    });
  });

  describe('Performance', () => {
    it('should complete subject generation within reasonable time', async () => {
      const request = createEmailRequest(ContentType.EMAIL_SUBJECT);
      const startTime = Date.now();

      await generator.generateContent(request);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent generation requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        createEmailRequest(ContentType.EMAIL_SUBJECT)
      );

      const startTime = Date.now();
      const promises = requests.map(req => generator.generateContent(req));
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(3000); // Should handle 5 concurrent requests within 3 seconds
    });
  });
}); 