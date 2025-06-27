/**
 * Phase 6: End-to-End Testing and Validation
 * 
 * Comprehensive testing across all tool categories, persona consistency validation,
 * performance testing, load testing, and integration validation.
 */

import { ulid } from 'ulid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentResponse } from '../../../agents/shared/base/AgentBase.interface';
import { PersonaInfo } from '../../../agents/shared/messaging/PromptFormatter';
import { ToolExecutionResult } from '../../../lib/tools/types';
import { AdvancedConfigurationManager } from '../AdvancedConfigurationManager';
import { EnhancedQualityScorer } from '../EnhancedQualityScorer';
import { LLMPersonaFormatter } from '../LLMPersonaFormatter';
import { LLMToolResponseFormatter } from '../LLMToolResponseFormatter';
import { PerformanceMonitor } from '../PerformanceMonitor';
import {
  ResponseStyleType,
  ToolCategory,
  ToolResponseConfig,
  ToolResponseContext,
  ToolResponsePromptTemplate
} from '../types';

// Mock dependencies
const mockLLMService = {
  generateResponse: vi.fn()
};

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

const mockConfigService = {
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

// Mock PromptFormatter
vi.mock('../../../agents/shared/messaging/PromptFormatter', () => ({
  PromptFormatter: {
    formatSystemPrompt: vi.fn()
  }
}));

describe('Phase 6: End-to-End Testing and Validation', () => {
  let formatter: LLMToolResponseFormatter;
  let personaFormatter: LLMPersonaFormatter;
  let qualityScorer: EnhancedQualityScorer;
  let performanceMonitor: PerformanceMonitor;
  let configManager: AdvancedConfigurationManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize services
    formatter = new LLMToolResponseFormatter(
      mockLLMService as any,
      mockPromptTemplateService,
      mockResponseCache
    );

    personaFormatter = new LLMPersonaFormatter(
      formatter as any,
      mockConfigService as any
    );

    qualityScorer = new EnhancedQualityScorer();
    performanceMonitor = new PerformanceMonitor();
    configManager = new AdvancedConfigurationManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('6.1 Comprehensive Testing Across All Tool Categories', () => {
    it('should format workspace tool results correctly', async () => {
      // Test Email Tools
      const emailContext = createMockContext({
        toolCategory: ToolCategory.WORKSPACE,
        toolId: 'gmail_sender',
        toolData: {
          messageId: 'msg_123',
          recipient: 'user@example.com',
          subject: 'Project Update',
          sentAt: new Date().toISOString()
        },
        responseStyle: 'business'
      });

      const emailTemplate = createMockTemplate(ToolCategory.WORKSPACE, 'business');
      mockPromptTemplateService.getTemplate.mockResolvedValue(emailTemplate);
      mockLLMService.generateResponse.mockResolvedValue(
        'Perfect! I\'ve successfully sent your project update email to user@example.com. The message has been delivered and assigned ID msg_123. You can find it in your sent folder.'
      );

      const result = await formatter.formatResponse(emailContext);

      expect(result.content).toContain('successfully sent');
      expect(result.content).toContain('user@example.com');
      expect(result.content).toContain('msg_123');
      expect(result.responseStyle).toBe('business');
      expect(result.qualityScore).toBeGreaterThan(0.6);
    });

    it('should format social media tool results with engagement focus', async () => {
      // Test Twitter Tools
      const twitterContext = createMockContext({
        toolCategory: ToolCategory.SOCIAL_MEDIA,
        toolId: 'twitter_post',
        toolData: {
          tweetId: '1234567890',
          content: 'Just launched our new feature! 🚀',
          metrics: {
            impressions: 1250,
            likes: 45,
            retweets: 12
          }
        },
        responseStyle: 'casual'
      });

      const twitterTemplate = createMockTemplate(ToolCategory.SOCIAL_MEDIA, 'casual');
      mockPromptTemplateService.getTemplate.mockResolvedValue(twitterTemplate);
      mockLLMService.generateResponse.mockResolvedValue(
        'Awesome! 🎉 Your tweet is live and already getting great engagement! With 1,250 impressions, 45 likes, and 12 retweets, it\'s off to a strong start. The rocket emoji was a perfect touch! 🚀'
      );

      const result = await formatter.formatResponse(twitterContext);

      expect(result.content).toContain('engagement');
      expect(result.content).toContain('1,250 impressions');
      expect(result.content).toContain('🎉');
      expect(result.responseStyle).toBe('casual');
      expect(result.qualityScore).toBeGreaterThan(0.7);
    });

    it('should format external API tool results with business intelligence', async () => {
      // Test Apify Web Scraping
      const apifyContext = createMockContext({
        toolCategory: ToolCategory.EXTERNAL_API,
        toolId: 'apify_scraper',
        toolData: {
          runId: 'run_abc123',
          itemsScraped: 1250,
          dataPoints: [
            { company: 'TechCorp', price: '$299', rating: 4.5 },
            { company: 'InnovateLab', price: '$249', rating: 4.2 },
            { company: 'DataFlow', price: '$349', rating: 4.8 }
          ],
          insights: {
            averagePrice: 299,
            topRatedCompany: 'DataFlow',
            marketTrend: 'increasing'
          }
        },
        responseStyle: 'technical'
      });

      const apifyTemplate = createMockTemplate(ToolCategory.EXTERNAL_API, 'technical');
      mockPromptTemplateService.getTemplate.mockResolvedValue(apifyTemplate);
      mockLLMService.generateResponse.mockResolvedValue(
        'Web scraping completed successfully. Extracted 1,250 data points from 3 companies. Key insights: Average pricing at $299, DataFlow leads with 4.8 rating, market shows increasing trend. Data quality score: 94%. Ready for business analysis.'
      );

      const result = await formatter.formatResponse(apifyContext);

      expect(result.content).toContain('1,250 data points');
      expect(result.content).toContain('business analysis');
      expect(result.content).toContain('DataFlow');
      expect(result.responseStyle).toBe('technical');
      expect(result.qualityScore).toBeGreaterThan(0.6);
    });

    it('should format workflow tool results with efficiency metrics', async () => {
      // Test N8N Workflow
      const workflowContext = createMockContext({
        toolCategory: ToolCategory.WORKFLOW,
        toolId: 'n8n_workflow',
        toolData: {
          workflowId: 'wf_automation_001',
          executionId: 'exec_456789',
          steps: 8,
          duration: 2.3,
          tasksAutomated: 15,
          timesSaved: 45,
          status: 'success'
        },
        responseStyle: 'business'
      });

      const workflowTemplate = createMockTemplate(ToolCategory.WORKFLOW, 'business');
      mockPromptTemplateService.getTemplate.mockResolvedValue(workflowTemplate);
      mockLLMService.generateResponse.mockResolvedValue(
        'Workflow automation completed successfully! 8 steps executed in 2.3 seconds, automating 15 tasks and saving 45 minutes of manual work. ROI impact: $1,125 in time savings. Your automation is performing excellently.'
      );

      const result = await formatter.formatResponse(workflowContext);

      expect(result.content).toContain('45 minutes');
      expect(result.content).toContain('ROI impact');
      expect(result.content).toContain('automation');
      expect(result.responseStyle).toBe('business');
      expect(result.qualityScore).toBeGreaterThan(0.7);
    });

    it('should format research tool results with insight analysis', async () => {
      // Test Research Tools
      const researchContext = createMockContext({
        toolCategory: ToolCategory.RESEARCH,
        toolId: 'market_analysis',
        toolData: {
          sources: 25,
          insights: [
            'Growing demand for AI automation tools',
            'Small businesses adoption rate increasing 35%',
            'Enterprise market shows 67% growth potential'
          ],
          confidence: 0.89,
          recommendations: [
            'Focus on small business segment',
            'Develop enterprise partnerships',
            'Invest in AI automation features'
          ]
        },
        responseStyle: 'conversational'
      });

      const researchTemplate = createMockTemplate(ToolCategory.RESEARCH, 'conversational');
      mockPromptTemplateService.getTemplate.mockResolvedValue(researchTemplate);
      mockLLMService.generateResponse.mockResolvedValue(
        'Great research results! I analyzed 25 sources and found some exciting insights. The small business adoption rate is up 35%, and there\'s huge 67% growth potential in enterprise. My recommendation: focus on small businesses first, then build enterprise partnerships. Confidence level: 89%.'
      );

      const result = await formatter.formatResponse(researchContext);

      expect(result.content).toContain('25 sources');
      expect(result.content).toContain('35%');
      expect(result.content).toContain('67% growth');
      expect(result.responseStyle).toBe('conversational');
      expect(result.qualityScore).toBeGreaterThan(0.7);
    });
  });

  describe('6.2 Persona Consistency Validation', () => {
    it('should maintain technical persona across different tool types', async () => {
      const technicalPersona: PersonaInfo = {
        background: 'Senior Software Engineer with 10+ years experience',
        personality: 'Detail-oriented, analytical, and precision-focused',
        communicationStyle: 'Technical, precise, and specification-driven',
        expertise: ['software architecture', 'system optimization', 'technical analysis'],
        preferences: { includeMetrics: true, technicalDepth: 'high' }
      };

      const contexts = [
        createMockContext({ toolCategory: ToolCategory.WORKSPACE, toolId: 'email_sender', persona: technicalPersona }),
        createMockContext({ toolCategory: ToolCategory.EXTERNAL_API, toolId: 'api_client', persona: technicalPersona }),
        createMockContext({ toolCategory: ToolCategory.WORKFLOW, toolId: 'n8n_workflow', persona: technicalPersona })
      ];

      const template = createMockTemplate(ToolCategory.WORKSPACE, 'technical');
      mockPromptTemplateService.getTemplate.mockResolvedValue(template);

      const responses = [
        'Email transmission completed. SMTP handshake successful, message ID: msg_123, delivery confirmation received. Processing time: 1.23s.',
        'API request executed successfully. HTTP 200 response, payload size: 2.4KB, latency: 89ms, rate limit remaining: 4,950/5,000.',
        'Workflow execution completed. 8 nodes processed, total execution time: 2.34s, memory usage: 45MB, success rate: 100%.'
      ];

      for (let i = 0; i < contexts.length; i++) {
        mockLLMService.generateResponse.mockResolvedValueOnce(responses[i]);
        const result = await formatter.formatResponse(contexts[i]);

        expect(result.content).toMatch(/\d+\.\d+s|\d+ms/); // Contains timing metrics
        expect(result.content.toLowerCase()).not.toContain('awesome');
        expect(result.content.toLowerCase()).not.toContain('great');
        expect(result.content).toMatch(/completed|successful|processed/);
      }
    });

    it('should maintain friendly persona across different tool types', async () => {
      const friendlyPersona: PersonaInfo = {
        background: 'Customer success specialist focused on user experience',
        personality: 'Enthusiastic, empathetic, and supportive',
        communicationStyle: 'Warm, encouraging, and user-focused',
        expertise: ['customer service', 'user experience', 'problem solving'],
        preferences: { includeEmojis: true, tone: 'encouraging' }
      };

      const contexts = [
        createMockContext({ toolCategory: ToolCategory.SOCIAL_MEDIA, toolId: 'twitter_post', persona: friendlyPersona }),
        createMockContext({ toolCategory: ToolCategory.WORKSPACE, toolId: 'calendar_event', persona: friendlyPersona }),
        createMockContext({ toolCategory: ToolCategory.RESEARCH, toolId: 'market_research', persona: friendlyPersona })
      ];

      const template = createMockTemplate(ToolCategory.SOCIAL_MEDIA, 'conversational');
      mockPromptTemplateService.getTemplate.mockResolvedValue(template);

      const responses = [
        'Amazing! 🎉 Your tweet is live and already getting fantastic engagement! The community is loving your content! 💙',
        'Perfect! 📅 I\'ve added your meeting to the calendar. Everything looks great and you\'re all set for next Tuesday! ✨',
        'Wonderful research results! 📊 I found some really exciting insights that I think you\'ll love. The data shows promising trends! 🚀'
      ];

      for (let i = 0; i < contexts.length; i++) {
        mockLLMService.generateResponse.mockResolvedValueOnce(responses[i]);
        const result = await formatter.formatResponse(contexts[i]);

        expect(result.content).toMatch(/[!😊🎉💙📅✨📊🚀]/); // Contains emojis/enthusiasm
        expect(result.content).toMatch(/amazing|perfect|wonderful|fantastic|great|exciting/i);
        expect(result.content).toMatch(/[!]/); // Contains exclamation marks
      }
    });
  });

  describe('6.3 Performance Testing with Concurrent Tool Executions', () => {
    it('should handle concurrent tool executions within performance targets', async () => {
      const startTime = Date.now();
      const concurrentRequests = 20; // Reduced for faster testing

      // Setup mock template and responses
      const template = createMockTemplate(ToolCategory.WORKSPACE, 'conversational');
      mockPromptTemplateService.getTemplate.mockResolvedValue(template);
      mockLLMService.generateResponse.mockImplementation(async () => {
        // Simulate realistic LLM response time
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
        return 'Concurrent test response completed successfully.';
      });

      // Create concurrent contexts
      const contexts = Array.from({ length: concurrentRequests }, (_, i) =>
        createMockContext({
          toolCategory: ToolCategory.WORKSPACE,
          toolId: `test_tool_${i}`,
          toolData: { testId: i }
        })
      );

      // Execute all requests concurrently
      const results = await Promise.all(
        contexts.map(context => formatter.formatResponse(context))
      );

      const totalTime = Date.now() - startTime;

      // Performance assertions
      expect(results).toHaveLength(concurrentRequests);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all responses are valid
      results.forEach((result, i) => {
        expect(result.content).toBeTruthy();
        expect(result.generationMetrics.generationTime).toBeGreaterThan(0);
        expect(result.qualityScore).toBeGreaterThan(0);
      });

      // Average response time should be reasonable
      const avgResponseTime = results.reduce((sum, r) => sum + r.generationMetrics.generationTime, 0) / results.length;
      expect(avgResponseTime).toBeLessThan(2000); // < 2s average
    });

    it('should maintain quality under load', async () => {
      const loadTestRequests = 100;

      const template = createMockTemplate(ToolCategory.EXTERNAL_API, 'business');
      mockPromptTemplateService.getTemplate.mockResolvedValue(template);

      // Simulate variable LLM performance under load
      mockLLMService.generateResponse.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
        return 'Load test response with business insights and actionable recommendations for optimization.';
      });

      const contexts = Array.from({ length: loadTestRequests }, (_, i) =>
        createMockContext({
          toolCategory: ToolCategory.EXTERNAL_API,
          toolId: `load_test_${i}`,
          responseStyle: 'business'
        })
      );

      const results = await Promise.all(
        contexts.map(context => formatter.formatResponse(context))
      );

      // Quality should remain high under load
      const avgQuality = results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length;
      expect(avgQuality).toBeGreaterThan(0.6);

      // No fallbacks should be used under normal load
      const fallbackCount = results.filter(r => r.fallbackUsed).length;
      expect(fallbackCount).toBeLessThan(loadTestRequests * 0.05); // < 5% fallback rate
    });
  });

  describe('6.4 Fallback Mechanism Validation', () => {
    it('should gracefully handle LLM service failures', async () => {
      const context = createMockContext({
        toolCategory: ToolCategory.WORKSPACE,
        toolId: 'email_sender'
      });

      const template = createMockTemplate(ToolCategory.WORKSPACE, 'conversational');
      mockPromptTemplateService.getTemplate.mockResolvedValue(template);

      // Simulate LLM service failure
      mockLLMService.generateResponse.mockRejectedValue(new Error('LLM service unavailable'));

      // Should throw error but with context for fallback handling
      await expect(formatter.formatResponse(context)).rejects.toThrow();
    });

    it('should handle prompt template service failures with fallback', async () => {
      const context = createMockContext({
        toolCategory: ToolCategory.SOCIAL_MEDIA,
        toolId: 'twitter_post'
      });

      // Simulate template service failure
      mockPromptTemplateService.getTemplate.mockRejectedValue(new Error('Template not found'));
      mockLLMService.generateResponse.mockResolvedValue('Fallback response using default template.');

      const result = await formatter.formatResponse(context);

      expect(result.content).toBe('Fallback response using default template.');
      expect(result.fallbackUsed).toBe(false); // Using fallback system prompt, not response fallback
    });

    it('should validate LLMPersonaFormatter integration fallbacks', async () => {
      // Test when tool result is missing
      const responseWithoutTool: AgentResponse = {
        content: 'Regular response without tool execution',
        thoughts: [],
        metadata: {
          agentId: 'test_agent',
          userId: 'test_user'
        }
      };

      const result = await personaFormatter.format('Regular response', responseWithoutTool);
      expect(result).toBe('Regular response'); // Should return original content

      // Test when LLM formatting is disabled
      const responseWithTool: AgentResponse = {
        content: 'Tool executed successfully',
        thoughts: [],
        metadata: {
          toolResult: createMockToolResult(),
          agentId: 'test_agent',
          userId: 'test_user'
        }
      };

      mockConfigService.getConfig.mockResolvedValue({
        enableLLMFormatting: false,
        maxResponseLength: 500,
        includeEmojis: false,
        includeNextSteps: false,
        includeMetrics: false,
        responseStyle: 'conversational',
        enableCaching: false,
        cacheTTLSeconds: 0,
        toolCategoryOverrides: {}
      });

      const disabledResult = await personaFormatter.format('Tool executed', responseWithTool);
      expect(disabledResult).toBe('Tool executed'); // Should return original when disabled
    });
  });

  describe('6.5 Context Awareness Validation', () => {
    it('should use conversation history for coherent follow-ups', async () => {
      const contextWithHistory = createMockContext({
        toolCategory: ToolCategory.WORKSPACE,
        toolId: 'email_sender',
        conversationHistory: [
          { sender: 'user', content: 'I need to send an email to the marketing team', timestamp: new Date() },
          { sender: 'assistant', content: 'I can help you send that email. What would you like to say?', timestamp: new Date() },
          { sender: 'user', content: 'Please send them the Q3 performance report', timestamp: new Date() }
        ]
      });

      const template = createMockTemplate(ToolCategory.WORKSPACE, 'business');
      mockPromptTemplateService.getTemplate.mockResolvedValue(template);
      mockLLMService.generateResponse.mockResolvedValue(
        'Perfect! I\'ve sent the Q3 performance report to your marketing team as requested. The email has been delivered successfully.'
      );

      const result = await formatter.formatResponse(contextWithHistory);

      expect(result.content).toContain('Q3 performance report');
      expect(result.content).toContain('marketing team');
      expect(result.qualityScore).toBeGreaterThan(0.6);
    });

    it('should provide relevant next-step suggestions', async () => {
      const context = createMockContext({
        toolCategory: ToolCategory.SOCIAL_MEDIA,
        toolId: 'instagram_post',
        toolData: {
          postId: 'ig_post_123',
          likes: 156,
          comments: 23,
          engagement: '4.2%'
        },
        responseConfig: {
          ...createDefaultConfig(),
          includeNextSteps: true
        }
      });

      const template = createMockTemplate(ToolCategory.SOCIAL_MEDIA, 'conversational');
      mockPromptTemplateService.getTemplate.mockResolvedValue(template);
      mockLLMService.generateResponse.mockResolvedValue(
        'Great post performance! 156 likes and 23 comments with 4.2% engagement. Next steps: respond to comments, cross-post to stories, and consider boosting this high-performing content.'
      );

      const result = await formatter.formatResponse(context);

      expect(result.content).toContain('Next steps:');
      expect(result.content).toMatch(/respond|cross-post|boosting/);
    });
  });

  describe('6.6 Error Message Clarity and Helpfulness', () => {
    it('should provide clear error messages for failed tool executions', async () => {
      const failedContext = createMockContext({
        toolCategory: ToolCategory.EXTERNAL_API,
        toolId: 'api_client',
        toolResult: {
          id: ulid(),
          toolId: 'api_client',
          success: false,
          error: {
            message: 'API rate limit exceeded',
            code: 'RATE_LIMIT_ERROR',
            details: { limit: 1000, used: 1000, resetTime: '2024-01-15T14:30:00Z' }
          },
          metrics: {
            startTime: Date.now() - 500,
            endTime: Date.now(),
            durationMs: 500
          }
        }
      });

      const template = createMockTemplate(ToolCategory.EXTERNAL_API, 'conversational');
      mockPromptTemplateService.getTemplate.mockResolvedValue(template);
      mockLLMService.generateResponse.mockResolvedValue(
        'I encountered a rate limit issue with the API (1000/1000 requests used). The service will reset at 2:30 PM. You can try again then, or I can help you optimize your API usage pattern.'
      );

      const result = await formatter.formatResponse(failedContext);

      expect(result.content).toContain('rate limit');
      expect(result.content).toContain('2:30 PM');
      expect(result.content).toContain('try again');
      expect(result.content).toContain('optimize');
    });
  });

  describe('6.7 Enhanced Quality Metrics Validation', () => {
    it('should calculate enhanced quality metrics accurately', async () => {
      const context = createMockContext({
        toolCategory: ToolCategory.WORKSPACE,
        toolId: 'email_sender',
        executionIntent: 'send quarterly report email',
        originalUserMessage: 'Please send the quarterly report to the board members'
      });

      const highQualityResponse = 'I\'ve successfully sent your quarterly report email to all board members. The message was delivered with high priority and includes the financial summary, growth metrics, and strategic recommendations. All recipients have been notified and you can track delivery status in your sent folder.';

      const qualityMetrics = await qualityScorer.calculateEnhancedQuality(
        highQualityResponse,
        context,
        { generationTime: 850, promptTokens: 120, responseTokens: 65, cacheHit: false }
      );

      expect(qualityMetrics.contextRelevance).toBeGreaterThan(0.8);
      expect(qualityMetrics.actionabilityScore).toBeGreaterThan(0.3);
      expect(qualityMetrics.businessValueAlignment).toBeGreaterThan(0.6);
      expect(qualityMetrics.userEngagementPrediction).toBeGreaterThan(0.5);
    });
  });

  describe('6.8 Integration Testing with Real Scenarios', () => {
    it('should handle complex multi-step workflow scenarios', async () => {
      // Simulate a complex workflow: Research → Email → Calendar → Follow-up
      const workflowSteps = [
        {
          category: ToolCategory.RESEARCH,
          toolId: 'competitor_analysis',
          data: { companies: 5, insights: 12, confidence: 0.87 }
        },
        {
          category: ToolCategory.WORKSPACE,
          toolId: 'email_sender',
          data: { recipients: ['team@company.com'], subject: 'Research Results' }
        },
        {
          category: ToolCategory.WORKSPACE,
          toolId: 'calendar_event',
          data: { title: 'Research Review Meeting', attendees: 6 }
        },
        {
          category: ToolCategory.WORKFLOW,
          toolId: 'n8n_reminder',
          data: { reminders: 3, scheduleTime: '24h' }
        }
      ];

      const template = createMockTemplate(ToolCategory.WORKSPACE, 'business');
      mockPromptTemplateService.getTemplate.mockResolvedValue(template);

      const responses = [
        'Research analysis completed! Found 12 key insights from 5 competitors with 87% confidence. Ready to share findings.',
        'Research results email sent to team@company.com successfully. The comprehensive analysis is now in their inbox.',
        'Research review meeting scheduled with 6 attendees. The team is aligned and ready to discuss findings.',
        'Automated follow-up reminders set for 24 hours. The workflow will ensure nothing falls through the cracks.'
      ];

      for (let i = 0; i < workflowSteps.length; i++) {
        const step = workflowSteps[i];
        const context = createMockContext({
          toolCategory: step.category,
          toolId: step.toolId,
          toolData: step.data,
          conversationHistory: i > 0 ? [
            { sender: 'assistant', content: responses[i - 1], timestamp: new Date() }
          ] : []
        });

        mockLLMService.generateResponse.mockResolvedValueOnce(responses[i]);
        const result = await formatter.formatResponse(context);

        expect(result.content).toBeTruthy();
        expect(result.qualityScore).toBeGreaterThan(0.6);
        expect(result.fallbackUsed).toBe(false);
      }
    });
  });
});

// Helper functions
function createMockContext(overrides: Partial<{
  toolCategory: ToolCategory;
  toolId: string;
  toolData: any;
  responseStyle: ResponseStyleType;
  persona: PersonaInfo;
  conversationHistory: Array<{ sender: string; content: string; timestamp: Date }>;
  responseConfig: ToolResponseConfig;
  executionIntent: string;
  originalUserMessage: string;
  toolResult: ToolExecutionResult;
}> = {}): ToolResponseContext {
  const defaultPersona: PersonaInfo = {
    background: 'Professional assistant',
    personality: 'Helpful and efficient',
    communicationStyle: 'Professional yet approachable',
    expertise: ['general assistance'],
    preferences: {}
  };

  const defaultToolResult: ToolExecutionResult = overrides.toolResult || {
    id: ulid(),
    toolId: overrides.toolId || 'test_tool',
    success: true,
    data: overrides.toolData || { result: 'success' },
    metrics: {
      startTime: Date.now() - 1000,
      endTime: Date.now(),
      durationMs: 1000
    }
  };

  return {
    id: ulid(),
    timestamp: new Date(),
    toolResult: defaultToolResult,
    toolCategory: overrides.toolCategory || ToolCategory.WORKSPACE,
    executionIntent: overrides.executionIntent || 'test operation',
    originalUserMessage: overrides.originalUserMessage || 'Please run the test',
    agentId: 'test_agent',
    agentPersona: overrides.persona || defaultPersona,
    agentCapabilities: ['testing', 'assistance'],
    userId: 'test_user',
    userPreferences: {
      preferredTone: 'friendly',
      maxMessageLength: 500,
      enableEmojis: true,
      includeMetrics: false,
      communicationStyle: 'conversational'
    },
    conversationHistory: overrides.conversationHistory || [],
    responseConfig: overrides.responseConfig || createDefaultConfig(overrides.responseStyle),
    fallbackEnabled: true
  };
}

function createMockTemplate(category: ToolCategory, style: string): ToolResponsePromptTemplate {
  return {
    id: `${category}_${style}`,
    category,
    style: style as ResponseStyleType,
    systemPrompt: `You are a helpful assistant specializing in ${category} tools with ${style} communication style.`,
    successTemplate: 'Task completed successfully',
    errorTemplate: 'Error occurred during execution',
    partialSuccessTemplate: 'Task partially completed',
    enabled: true,
    priority: 1
  };
}

function createDefaultConfig(responseStyle: ResponseStyleType = 'conversational'): ToolResponseConfig {
  return {
    enableLLMFormatting: true,
    maxResponseLength: 500,
    includeEmojis: true,
    includeNextSteps: true,
    includeMetrics: false,
    responseStyle,
    enableCaching: true,
    cacheTTLSeconds: 3600,
    toolCategoryOverrides: {}
  };
}

function createMockToolResult(): ToolExecutionResult {
  return {
    id: ulid(),
    toolId: 'test_tool',
    success: true,
    data: { result: 'success' },
    metrics: {
      startTime: Date.now() - 1000,
      endTime: Date.now(),
      durationMs: 1000
    }
  };
}