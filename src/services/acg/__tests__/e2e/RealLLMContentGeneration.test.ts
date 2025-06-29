import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ulid } from 'ulid';
import { DefaultContentGenerationService } from '../../core/DefaultContentGenerationService';
import { EmailContentGenerator } from '../../generators/email/EmailContentGenerator';
import { LLMServiceAdapter } from '../../adapters/LLMServiceAdapter';
import { WorkspaceACGIntegration } from '../../integration/WorkspaceACGIntegration';
import { ContentType } from '../../types/ContentGenerationTypes';
import { AgentLLMService } from '../../../llm/AgentLLMService';
import { createLogger } from '../../../utils/logger';

// These tests use REAL LLM services - they require valid API keys and network access
// Run with: npm test src/services/acg/__tests__/e2e/RealLLMContentGeneration.test.ts --verbose
describe('Real LLM Content Generation E2E Tests', () => {
  let contentService: DefaultContentGenerationService;
  let emailGenerator: EmailContentGenerator;
  let llmAdapter: LLMServiceAdapter;
  let agentLLMService: AgentLLMService;
  let logger: ReturnType<typeof createLogger>;

  beforeAll(async () => {
    // Skip tests if no OpenAI key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn('Skipping real LLM tests - OPENAI_API_KEY not set');
      return;
    }

    logger = createLogger('ACG-E2E-Test');

    // Initialize real LLM service
    agentLLMService = new AgentLLMService({
      openaiApiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4',
      maxTokens: 1000,
      temperature: 0.7
    });

    llmAdapter = new LLMServiceAdapter(agentLLMService);
    emailGenerator = new EmailContentGenerator(llmAdapter, logger);

    // Simple in-memory cache for testing
    const testCache = {
      data: new Map(),
      get: async (key: string) => testCache.data.get(key) || null,
      set: async (key: string, value: any, ttl?: number) => {
        testCache.data.set(key, value);
        if (ttl) {
          setTimeout(() => testCache.data.delete(key), ttl * 1000);
        }
      },
      delete: async (key: string) => testCache.data.delete(key),
      clear: async () => testCache.data.clear(),
      has: async (key: string) => testCache.data.has(key),
      keys: async () => Array.from(testCache.data.keys()),
      generateKey: (context: any) => `test-${JSON.stringify(context).slice(0, 50)}`
    };

    contentService = new DefaultContentGenerationService({
      generators: [emailGenerator],
      cache: testCache,
      logger,
      config: {
        defaultTimeout: 30000,
        maxRetries: 2,
        cacheEnabled: true,
        cacheTTL: 300, // 5 minutes for testing
        batchSize: 5
      }
    });
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Real Bitcoin Investment Email Generation', () => {
    it('should generate professional Bitcoin investment email subject and body', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('Skipping - no API key');
        return;
      }

      const originalMessage = 'Send gab@crowd-wisdom.com an email with 10 reasons why he should consider Bitcoin as a serious investment vehicle';

      // Test subject generation
      const subjectRequest = {
        id: ulid(),
        agentId: 'real-test-agent',
        toolId: 'email-tool',
        contentType: ContentType.EMAIL_SUBJECT,
        context: {
          originalMessage,
          extractedEntities: {
            recipient: 'gab@crowd-wisdom.com',
            topic: 'Bitcoin investment',
            requirements: ['10 reasons', 'serious investment vehicle'],
            tone: 'professional'
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

      const subjectResult = await contentService.generateContent(subjectRequest);

      expect(subjectResult.success).toBe(true);
      if (subjectResult.success) {
        const subject = subjectResult.data.content.text!;

        // Validate subject quality
        expect(subject.length).toBeGreaterThan(10);
        expect(subject.length).toBeLessThan(100);
        expect(subject.toLowerCase()).toContain('bitcoin');
        expect(subject.toLowerCase()).toMatch(/invest|opportunity|consider|analysis/);
        expect(subjectResult.data.metadata.confidence).toBeGreaterThan(0.7);

        console.log('Generated Subject:', subject);
        console.log('Subject Confidence:', subjectResult.data.metadata.confidence);
      }

      // Test body generation
      const bodyRequest = {
        ...subjectRequest,
        id: ulid(),
        contentType: ContentType.EMAIL_BODY
      };

      const bodyResult = await contentService.generateContent(bodyRequest);

      expect(bodyResult.success).toBe(true);
      if (bodyResult.success) {
        const body = bodyResult.data.content.text!;

        // Validate body quality
        expect(body.length).toBeGreaterThan(200);
        expect(body.toLowerCase()).toContain('bitcoin');
        expect(body.toLowerCase()).toContain('gab');
        expect(body.toLowerCase()).toMatch(/reason|investment|consider/);

        // Should contain structured content (numbered list or clear points)
        expect(body).toMatch(/\d+\.|•|\n-|\n\d+/); // Numbers, bullets, or dashes

        // Should be professional
        expect(body.toLowerCase()).toMatch(/dear|hello|greetings/);
        expect(body.toLowerCase()).toMatch(/regards|sincerely|best/);

        expect(bodyResult.data.metadata.confidence).toBeGreaterThan(0.7);

        console.log('Generated Body Preview:', body.substring(0, 200) + '...');
        console.log('Body Length:', body.length);
        console.log('Body Confidence:', bodyResult.data.metadata.confidence);
      }
    }, 45000); // 45 second timeout for LLM calls

    it('should generate different content for different contexts', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('Skipping - no API key');
        return;
      }

      // Test 1: Casual email to friend
      const casualRequest = {
        id: ulid(),
        agentId: 'real-test-agent',
        toolId: 'email-tool',
        contentType: ContentType.EMAIL_BODY,
        context: {
          originalMessage: 'Send my friend John an email about why Bitcoin is cool',
          extractedEntities: {
            recipient: 'john@friend.com',
            topic: 'Bitcoin',
            tone: 'casual',
            relationship: 'friend'
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

      // Test 2: Formal email to investor
      const formalRequest = {
        ...casualRequest,
        id: ulid(),
        context: {
          originalMessage: 'Send an email to potential investor about Bitcoin investment thesis',
          extractedEntities: {
            recipient: 'investor@fund.com',
            topic: 'Bitcoin investment thesis',
            tone: 'formal',
            relationship: 'professional'
          }
        }
      };

      const [casualResult, formalResult] = await Promise.all([
        contentService.generateContent(casualRequest),
        contentService.generateContent(formalRequest)
      ]);

      expect(casualResult.success).toBe(true);
      expect(formalResult.success).toBe(true);

      if (casualResult.success && formalResult.success) {
        const casualContent = casualResult.data.content.text!;
        const formalContent = formalResult.data.content.text!;

        // Content should be different
        expect(casualContent).not.toBe(formalContent);

        // Casual should be more informal
        expect(casualContent.toLowerCase()).toMatch(/hey|hi|cool|awesome|dude/);

        // Formal should be more professional
        expect(formalContent.toLowerCase()).toMatch(/dear|investment|analysis|portfolio|strategy/);

        console.log('Casual tone detected:', casualContent.includes('Hey') || casualContent.includes('Hi'));
        console.log('Formal tone detected:', formalContent.includes('Dear') || formalContent.includes('investment'));
      }
    }, 60000); // 60 second timeout for multiple LLM calls
  });

  describe('Real Email Reply Generation', () => {
    it('should generate contextual reply to received email', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('Skipping - no API key');
        return;
      }

      const replyRequest = {
        id: ulid(),
        agentId: 'real-test-agent',
        toolId: 'email-tool',
        contentType: ContentType.EMAIL_REPLY,
        context: {
          originalMessage: 'Reply to this email about Bitcoin concerns',
          extractedEntities: {
            originalEmail: {
              from: 'concerned.investor@example.com',
              subject: 'Bitcoin Volatility Concerns',
              body: `Hi there,

I've been reading about Bitcoin and I'm quite concerned about its volatility. 
The price seems to swing wildly from day to day. How can this be considered 
a stable store of value when it can lose 20% in a single day?

I'm also worried about regulatory risks. What if governments ban it?

Looking forward to your thoughts.

Best regards,
Sarah`
            }
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

      const result = await contentService.generateContent(replyRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        const reply = result.data.content.text!;

        // Should acknowledge the original email
        expect(reply.toLowerCase()).toMatch(/sarah|thank|appreciate/);

        // Should address the concerns mentioned
        expect(reply.toLowerCase()).toMatch(/volatility|concern|understand/);
        expect(reply.toLowerCase()).toMatch(/regulatory|government|regulation/);

        // Should provide informative response
        expect(reply.length).toBeGreaterThan(150);
        expect(reply.toLowerCase()).toMatch(/bitcoin|investment|value/);

        // Should be professional and helpful
        expect(reply.toLowerCase()).toMatch(/dear|hello|hi/);
        expect(reply.toLowerCase()).toMatch(/regards|sincerely|best/);

        console.log('Generated Reply Preview:', reply.substring(0, 300) + '...');
        console.log('Reply addresses volatility:', reply.toLowerCase().includes('volatility'));
        console.log('Reply addresses regulation:', reply.toLowerCase().includes('regulat'));
      }
    }, 45000);
  });

  describe('Content Quality and Anti-Hallucination', () => {
    it('should generate factual content about Bitcoin without hallucination', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('Skipping - no API key');
        return;
      }

      const factualRequest = {
        id: ulid(),
        agentId: 'real-test-agent',
        toolId: 'email-tool',
        contentType: ContentType.EMAIL_BODY,
        context: {
          originalMessage: 'Send an email explaining Bitcoin basics with accurate information',
          extractedEntities: {
            recipient: 'learner@example.com',
            topic: 'Bitcoin basics',
            requirements: ['accurate facts', 'no speculation', 'educational']
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

      const result = await contentService.generateContent(factualRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        const content = result.data.content.text!;

        // Should mention key Bitcoin facts
        expect(content.toLowerCase()).toMatch(/21 million|blockchain|satoshi|2009|digital/);

        // Should not contain obvious hallucinations or false claims
        expect(content).not.toMatch(/Bitcoin was created in 199[0-8]/); // Wrong year
        expect(content).not.toMatch(/unlimited supply/); // False claim
        expect(content).not.toMatch(/controlled by banks/); // False claim

        // Should be educational and informative
        expect(content.length).toBeGreaterThan(200);
        expect(result.data.metadata.confidence).toBeGreaterThan(0.8);

        console.log('Factual content confidence:', result.data.metadata.confidence);
        console.log('Contains key facts:', content.includes('21 million') && content.includes('blockchain'));
      }
    }, 45000);

    it('should maintain consistency across multiple generations', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('Skipping - no API key');
        return;
      }

      const baseRequest = {
        agentId: 'real-test-agent',
        toolId: 'email-tool',
        contentType: ContentType.EMAIL_SUBJECT,
        context: {
          originalMessage: 'Send an email about Bitcoin investment to professional investor',
          extractedEntities: {
            recipient: 'investor@fund.com',
            topic: 'Bitcoin investment',
            tone: 'professional'
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

      // Generate 3 subjects with same context
      const requests = Array.from({ length: 3 }, () => ({
        ...baseRequest,
        id: ulid()
      }));

      const results = await Promise.all(
        requests.map(req => contentService.generateContent(req))
      );

      expect(results.every(r => r.success)).toBe(true);

      const subjects = results.map(r =>
        r.success ? r.data.content.text! : ''
      ).filter(Boolean);

      expect(subjects).toHaveLength(3);

      // All should be professional and Bitcoin-related
      subjects.forEach(subject => {
        expect(subject.toLowerCase()).toMatch(/bitcoin|btc|crypto|investment/);
        expect(subject.length).toBeGreaterThan(10);
        expect(subject.length).toBeLessThan(100);
      });

      // Should have variation (not identical)
      const uniqueSubjects = new Set(subjects);
      expect(uniqueSubjects.size).toBeGreaterThan(1);

      console.log('Generated subjects:', subjects);
      console.log('Variation achieved:', uniqueSubjects.size === 3);
    }, 60000);
  });

  describe('Performance with Real LLM', () => {
    it('should complete generation within acceptable time limits', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('Skipping - no API key');
        return;
      }

      const request = {
        id: ulid(),
        agentId: 'real-test-agent',
        toolId: 'email-tool',
        contentType: ContentType.EMAIL_SUBJECT,
        context: {
          originalMessage: 'Quick email about Bitcoin to colleague',
          extractedEntities: {
            recipient: 'colleague@work.com',
            topic: 'Bitcoin update'
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

      const startTime = Date.now();
      const result = await contentService.generateContent(request);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      if (result.success) {
        expect(result.metrics.durationMs).toBeLessThan(10000);
        console.log('Generation time:', duration, 'ms');
        console.log('Reported duration:', result.metrics.durationMs, 'ms');
      }
    }, 15000);
  });

  describe('Error Handling with Real LLM', () => {
    it('should handle rate limiting gracefully', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('Skipping - no API key');
        return;
      }

      // Create many concurrent requests to potentially trigger rate limiting
      const requests = Array.from({ length: 10 }, (_, i) => ({
        id: ulid(),
        agentId: 'real-test-agent',
        toolId: 'email-tool',
        contentType: ContentType.EMAIL_SUBJECT,
        context: {
          originalMessage: `Email ${i} about Bitcoin`,
          extractedEntities: {
            recipient: `user${i}@example.com`,
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
      }));

      const results = await Promise.allSettled(
        requests.map(req => contentService.generateContent(req))
      );

      // At least some should succeed
      const successful = results.filter(r =>
        r.status === 'fulfilled' && r.value.success
      );

      expect(successful.length).toBeGreaterThan(0);

      // If any failed due to rate limiting, they should be handled gracefully
      const failed = results.filter(r =>
        r.status === 'fulfilled' && !r.value.success
      );

      failed.forEach(result => {
        if (result.status === 'fulfilled' && !result.value.success) {
          expect(result.value.error.code).toMatch(/RATE_LIMIT|TIMEOUT|LLM_SERVICE_ERROR/);
        }
      });

      console.log(`Successful: ${successful.length}, Failed: ${failed.length} out of ${requests.length}`);
    }, 120000); // 2 minutes for many requests
  });
}); 