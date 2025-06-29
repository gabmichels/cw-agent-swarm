import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ulid } from 'ulid';
import { DefaultContentGenerationService } from '../../core/DefaultContentGenerationService';
import { ContentType, GenerationMethod, GenerationStatus } from '../../types/ContentGenerationTypes';
import { ContentGenerationError } from '../../errors/ContentGenerationError';
import type { IContentGenerator, ILLMContentGenerator } from '../../interfaces/IContentGenerator';
import type { ICache } from '../../interfaces/ICache';
import type { ILogger } from '../../interfaces/ILogger';

describe('DefaultContentGenerationService', () => {
  let service: DefaultContentGenerationService;
  let mockEmailGenerator: ILLMContentGenerator;
  let mockDocumentGenerator: IContentGenerator;
  let mockCache: ICache;
  let mockLogger: ILogger;

  const createMockGenerator = (
    id: string,
    supportedTypes: ContentType[],
    shouldSucceed: boolean = true
  ): ILLMContentGenerator => ({
    id,
    name: `${id} Generator`,
    version: '1.0.0',
    supportedTypes,
    canGenerate: vi.fn().mockReturnValue(true),
    generateContent: vi.fn().mockImplementation(async (request) => {
      if (!shouldSucceed) {
        throw new ContentGenerationError('Generation failed', 'GENERATION_FAILED', { requestId: request.id });
      }

      return {
        success: true,
        data: {
          id: ulid(),
          type: request.contentType,
          content: {
            text: `Generated content for ${request.contentType}`
          },
          metadata: {
            generatedAt: new Date(),
            method: GenerationMethod.LLM_POWERED,
            confidence: 0.9,
            processingTimeMs: 500,
            fallbackUsed: false
          }
        },
        metrics: {
          requestId: request.id,
          startTime: new Date(),
          endTime: new Date(),
          durationMs: 500,
          memoryUsed: 1024,
          cacheHit: false,
          retryCount: 0,
          success: true
        }
      };
    }),
    validateContent: vi.fn().mockResolvedValue({
      isValid: true,
      score: 0.9,
      issues: [],
      suggestions: [],
      platformCompliance: {}
    }),
    getHealth: vi.fn().mockResolvedValue({
      status: 'healthy',
      responseTimeMs: 100,
      lastCheck: new Date(),
      details: {}
    })
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock generators
    mockEmailGenerator = createMockGenerator('email-gen', [ContentType.EMAIL_SUBJECT, ContentType.EMAIL_BODY]);
    mockDocumentGenerator = createMockGenerator('doc-gen', [ContentType.DOCUMENT_TEXT]);

    // Mock cache
    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(void 0),
      delete: vi.fn().mockResolvedValue(true),
      clear: vi.fn().mockResolvedValue(void 0),
      has: vi.fn().mockResolvedValue(false),
      keys: vi.fn().mockResolvedValue([]),
      generateKey: vi.fn().mockReturnValue('test-cache-key')
    };

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    // Create service
    service = new DefaultContentGenerationService({
      generators: [mockEmailGenerator, mockDocumentGenerator],
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(service).toBeInstanceOf(DefaultContentGenerationService);
    });

    it('should register all provided generators', () => {
      // Verify generators are registered by attempting generation
      const request = {
        id: ulid(),
        agentId: 'test-agent',
        toolId: 'email-tool',
        contentType: ContentType.EMAIL_SUBJECT,
        context: {
          originalMessage: 'Test message',
          extractedEntities: {}
        },
        priority: 1,
        metadata: {
          createdAt: new Date(),
          userId: 'test-user',
          source: 'direct' as const,
          retryCount: 0
        }
      };

      expect(() => service.generateContent(request)).not.toThrow();
    });

    it('should throw error with invalid configuration', () => {
      expect(() => new DefaultContentGenerationService({
        generators: [],
        cache: mockCache,
        logger: mockLogger,
        config: {
          defaultTimeout: -1, // Invalid timeout
          maxRetries: 3,
          cacheEnabled: true,
          cacheTTL: 3600,
          batchSize: 10
        }
      })).toThrow();
    });
  });

  describe('generateContent', () => {
    const createValidRequest = (contentType: ContentType = ContentType.EMAIL_SUBJECT) => ({
      id: ulid(),
      agentId: 'test-agent',
      toolId: 'test-tool',
      contentType,
      context: {
        originalMessage: 'Generate email about Bitcoin investment',
        extractedEntities: {
          recipient: 'test@example.com',
          topic: 'Bitcoin'
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

    it('should generate content successfully', async () => {
      const request = createValidRequest();
      const result = await service.generateContent(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe(ContentType.EMAIL_SUBJECT);
        expect(result.data.content.text).toContain('Generated content');
        expect(result.data.metadata.confidence).toBe(0.9);
        expect(result.metrics.success).toBe(true);
      }

      expect(mockEmailGenerator.generateContent).toHaveBeenCalledWith(request);
    });

    it('should handle generator not found error', async () => {
      const request = createValidRequest(ContentType.SOCIAL_POST); // Unsupported type
      const result = await service.generateContent(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('GENERATOR_NOT_FOUND');
        expect(result.error.message).toContain('No generator found');
      }
    });

    it('should handle generation failure with retry', async () => {
      const failingGenerator = createMockGenerator('failing-gen', [ContentType.EMAIL_SUBJECT], false);
      const serviceWithFailingGen = new DefaultContentGenerationService({
        generators: [failingGenerator],
        cache: mockCache,
        logger: mockLogger,
        config: {
          defaultTimeout: 30000,
          maxRetries: 2,
          cacheEnabled: true,
          cacheTTL: 3600,
          batchSize: 10
        }
      });

      const request = createValidRequest();
      const result = await serviceWithFailingGen.generateContent(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('GENERATION_FAILED');
        expect(result.metrics.retryCount).toBe(2);
      }

      // Should have attempted retries
      expect(failingGenerator.generateContent).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use cache when available', async () => {
      const request = createValidRequest();
      const cachedContent = {
        id: ulid(),
        type: ContentType.EMAIL_SUBJECT,
        content: { text: 'Cached content' },
        metadata: {
          generatedAt: new Date(),
          method: GenerationMethod.LLM_POWERED,
          confidence: 0.8,
          processingTimeMs: 50,
          fallbackUsed: false
        }
      };

      mockCache.get.mockResolvedValue(cachedContent);

      const result = await service.generateContent(request);

      expect(mockCache.get).toHaveBeenCalled();
      expect(mockEmailGenerator.generateContent).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content.text).toBe('Cached content');
        expect(result.metrics.cacheHit).toBe(true);
      }
    });

    it('should cache successful results', async () => {
      const request = createValidRequest();
      await service.generateContent(request);

      expect(mockCache.set).toHaveBeenCalled();
      const [cacheKey, cachedValue, ttl] = mockCache.set.mock.calls[0];
      expect(cacheKey).toBe('test-cache-key');
      expect(ttl).toBe(3600);
    });

    it('should handle timeout correctly', async () => {
      const slowGenerator = createMockGenerator('slow-gen', [ContentType.EMAIL_SUBJECT]);
      slowGenerator.generateContent = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 35000)) // Longer than timeout
      );

      const serviceWithTimeout = new DefaultContentGenerationService({
        generators: [slowGenerator],
        cache: mockCache,
        logger: mockLogger,
        config: {
          defaultTimeout: 1000, // Short timeout
          maxRetries: 1,
          cacheEnabled: true,
          cacheTTL: 3600,
          batchSize: 10
        }
      });

      const request = createValidRequest();
      const result = await serviceWithTimeout.generateContent(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('GENERATION_TIMEOUT');
      }
    });

    it('should validate request parameters', async () => {
      const invalidRequest = {
        id: '', // Invalid ULID
        agentId: '',
        toolId: '',
        contentType: 'INVALID_TYPE' as ContentType,
        context: {
          originalMessage: '',
          extractedEntities: {}
        },
        priority: -1, // Invalid priority
        metadata: {
          createdAt: new Date(),
          userId: '',
          source: 'direct' as const,
          retryCount: 0
        }
      };

      const result = await service.generateContent(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_REQUEST');
      }
    });
  });

  describe('validateContent', () => {
    it('should validate content successfully', async () => {
      const content = {
        id: ulid(),
        type: ContentType.EMAIL_SUBJECT,
        content: {
          text: 'Test subject'
        },
        metadata: {
          generatedAt: new Date(),
          method: GenerationMethod.LLM_POWERED,
          confidence: 0.9,
          processingTimeMs: 500,
          fallbackUsed: false
        }
      };

      const result = await service.validateContent(content);

      expect(result.isValid).toBe(true);
      expect(result.score).toBe(0.9);
      expect(mockEmailGenerator.validateContent).toHaveBeenCalledWith(content);
    });

    it('should handle validation failure', async () => {
      mockEmailGenerator.validateContent = vi.fn().mockResolvedValue({
        isValid: false,
        score: 0.3,
        issues: [{ type: 'LENGTH_TOO_SHORT', severity: 'high', message: 'Content too short' }],
        suggestions: ['Add more detail'],
        platformCompliance: {}
      });

      const content = {
        id: ulid(),
        type: ContentType.EMAIL_SUBJECT,
        content: {
          text: 'Hi'
        },
        metadata: {
          generatedAt: new Date(),
          method: GenerationMethod.LLM_POWERED,
          confidence: 0.9,
          processingTimeMs: 500,
          fallbackUsed: false
        }
      };

      const result = await service.validateContent(content);

      expect(result.isValid).toBe(false);
      expect(result.score).toBe(0.3);
      expect(result.issues).toHaveLength(1);
      expect(result.suggestions).toHaveLength(1);
    });
  });

  describe('batchGenerateContent', () => {
    it('should generate content for multiple requests', async () => {
      const requests = [
        createValidRequest(ContentType.EMAIL_SUBJECT),
        createValidRequest(ContentType.EMAIL_BODY),
        createValidRequest(ContentType.DOCUMENT_TEXT)
      ];

      const results = await service.batchGenerateContent(requests);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle mixed success/failure in batch', async () => {
      const requests = [
        createValidRequest(ContentType.EMAIL_SUBJECT),
        createValidRequest(ContentType.SOCIAL_POST), // Unsupported
        createValidRequest(ContentType.DOCUMENT_TEXT)
      ];

      const results = await service.batchGenerateContent(requests);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should respect batch size limits', async () => {
      const requests = Array.from({ length: 15 }, () =>
        createValidRequest(ContentType.EMAIL_SUBJECT)
      );

      const results = await service.batchGenerateContent(requests);

      expect(results).toHaveLength(15);
      // Should process in batches of 10 (config.batchSize)
      expect(mockEmailGenerator.generateContent).toHaveBeenCalledTimes(15);
    });
  });

  describe('getGeneratorHealth', () => {
    it('should return health status for all generators', async () => {
      const health = await service.getGeneratorHealth();

      expect(health).toHaveLength(2);
      expect(health[0].generatorId).toBe('email-gen');
      expect(health[0].status).toBe('healthy');
      expect(health[1].generatorId).toBe('doc-gen');
      expect(health[1].status).toBe('healthy');
    });

    it('should handle unhealthy generators', async () => {
      mockEmailGenerator.getHealth = vi.fn().mockResolvedValue({
        status: 'unhealthy',
        responseTimeMs: 5000,
        lastCheck: new Date(),
        details: { error: 'Connection timeout' }
      });

      const health = await service.getGeneratorHealth();

      expect(health[0].status).toBe('unhealthy');
      expect(health[0].details).toEqual({ error: 'Connection timeout' });
    });
  });

  describe('Error Handling', () => {
    it('should log errors appropriately', async () => {
      const request = createValidRequest(ContentType.SOCIAL_POST); // Unsupported
      await service.generateContent(request);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Content generation failed'),
        expect.objectContaining({
          requestId: request.id,
          contentType: ContentType.SOCIAL_POST
        })
      );
    });

    it('should handle cache errors gracefully', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache connection failed'));

      const request = createValidRequest();
      const result = await service.generateContent(request);

      // Should still succeed by bypassing cache
      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cache error'),
        expect.any(Object)
      );
    });
  });

  describe('Performance', () => {
    it('should complete generation within reasonable time', async () => {
      const request = createValidRequest();
      const startTime = Date.now();

      await service.generateContent(request);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, () =>
        createValidRequest(ContentType.EMAIL_SUBJECT)
      );

      const startTime = Date.now();
      const promises = requests.map(req => service.generateContent(req));
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(2000); // Should handle 10 concurrent requests within 2 seconds
    });
  });

  function createValidRequest(contentType: ContentType = ContentType.EMAIL_SUBJECT) {
    return {
      id: ulid(),
      agentId: 'test-agent',
      toolId: 'test-tool',
      contentType,
      context: {
        originalMessage: 'Generate email about Bitcoin investment',
        extractedEntities: {
          recipient: 'test@example.com',
          topic: 'Bitcoin'
        }
      },
      priority: 1,
      metadata: {
        createdAt: new Date(),
        userId: 'test-user',
        source: 'direct' as const,
        retryCount: 0
      }
    };
  }
}); 