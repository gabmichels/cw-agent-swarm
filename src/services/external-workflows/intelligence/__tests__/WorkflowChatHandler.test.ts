import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ulid } from 'ulid';
import {
  WorkflowChatHandler,
  InMemoryConversationMemory,
  type WorkflowChatConfig,
  type ChatContext,
  type ChatMessage,
  type WorkflowSuggestion,
  WorkflowChatError,
  ConversationTimeoutError,
  InvalidChatContextError
} from '../WorkflowChatHandler.js';
import type { IWorkflowContextBuilder } from '../WorkflowContextBuilder.js';
import type { IWorkflowIntentAnalyzer, WorkflowIntent } from '../WorkflowIntentAnalyzer.js';
import type { WorkflowSearchService } from '../../integrations/WorkflowSearchService.js';

// Mock implementations
const mockContextBuilder: IWorkflowContextBuilder = {
  buildContext: vi.fn(),
  invalidateCache: vi.fn(),
  updateUserPreferences: vi.fn()
};

const mockIntentAnalyzer: IWorkflowIntentAnalyzer = {
  analyzeIntent: vi.fn(),
  refineIntent: vi.fn(),
  validateIntent: vi.fn()
};

const mockSearchService = {
  searchWorkflows: vi.fn()
} as unknown as WorkflowSearchService;

// Helper function to create mock WorkflowIntent with correct structure
function createMockWorkflowIntent(overrides: Partial<{
  action: string;
  domain: string;
  integrations: string[];
  confidence: number;
  originalQuery: string;
  clarificationQuestions: string[];
}>): WorkflowIntent {
  return {
    id: ulid(),
    timestamp: new Date(),
    originalQuery: overrides.originalQuery || 'test query',
    confidence: overrides.confidence || 0.8,
    primaryIntent: {
      tools: overrides.integrations || [],
      domain: overrides.domain || 'general',
      priority: 'medium',
      action: overrides.action || 'sync',
      complexity: 'medium'
    },
    extractedEntities: {
      integrations: overrides.integrations || [],
      dataTypes: [],
      actions: [overrides.action || 'sync'],
      conditions: [],
      schedule: null
    },
    contextualFactors: {
      userSkillLevel: 'intermediate',
      timeConstraints: [],
      businessContext: [],
      technicalConstraints: []
    },
    recommendationHints: (overrides.clarificationQuestions || []).map(q => ({
      category: 'clarification' as const,
      suggestion: q,
      priority: 'medium' as const,
      reasoning: 'Test clarification'
    }))
  };
}

describe('WorkflowChatHandler', () => {
  let chatHandler: WorkflowChatHandler;
  let conversationMemory: InMemoryConversationMemory;
  let config: WorkflowChatConfig;
  let mockContext: ChatContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    conversationMemory = new InMemoryConversationMemory();
    config = {
      maxSuggestions: 3,
      confidenceThreshold: 0.6,
      enableConversationHistory: true,
      maxConversationTurns: 20,
      responseTimeoutMs: 10000,
      enableCaching: true,
      cacheExpiryMinutes: 15
    };
    
    chatHandler = new WorkflowChatHandler(
      mockContextBuilder,
      mockIntentAnalyzer,
      mockSearchService,
      conversationMemory,
      config
    );

    mockContext = {
      sessionId: ulid(),
      userId: 'test-user-123',
      messages: [],
      preferences: { theme: 'dark' }
    };
  });

  describe('isWorkflowRequest', () => {
    it('should detect workflow-related requests with workflow keywords', () => {
      expect(chatHandler.isWorkflowRequest('I want to create a workflow')).toBe(true);
      expect(chatHandler.isWorkflowRequest('Help me automate my email')).toBe(true);
      expect(chatHandler.isWorkflowRequest('How do I integrate Slack with Gmail?')).toBe(true);
      expect(chatHandler.isWorkflowRequest('Can you connect my CRM to notifications?')).toBe(true);
    });

    it('should detect tool-specific requests', () => {
      expect(chatHandler.isWorkflowRequest('sync my Salesforce data')).toBe(true);
      expect(chatHandler.isWorkflowRequest('backup Gmail to Google Drive')).toBe(true);
      expect(chatHandler.isWorkflowRequest('send Slack messages from Notion')).toBe(true);
      expect(chatHandler.isWorkflowRequest('GitHub notifications to Discord')).toBe(true);
    });

    it('should detect automation patterns', () => {
      expect(chatHandler.isWorkflowRequest('when a new lead is created then notify me')).toBe(true);
      expect(chatHandler.isWorkflowRequest('if someone mentions me then send email')).toBe(true);
      expect(chatHandler.isWorkflowRequest('I want to sync my calendar with Trello')).toBe(true);
      expect(chatHandler.isWorkflowRequest('how can I automate data entry')).toBe(true);
      expect(chatHandler.isWorkflowRequest('setup Mailchimp integration')).toBe(true);
    });

    it('should not detect non-workflow requests', () => {
      expect(chatHandler.isWorkflowRequest('What is the weather today?')).toBe(false);
      expect(chatHandler.isWorkflowRequest('Hello, how are you?')).toBe(false);
      expect(chatHandler.isWorkflowRequest('Tell me a joke')).toBe(false);
      expect(chatHandler.isWorkflowRequest('What time is it?')).toBe(false);
    });
  });

  describe('handleWorkflowRequest', () => {
    beforeEach(() => {
      (mockContextBuilder.buildContext as Mock).mockResolvedValue({
        sessionId: mockContext.sessionId,
        domainKnowledge: { tools: [], patterns: [] },
        userContext: { preferences: {} },
        libraryStats: { totalWorkflows: 2053 }
      });
    });

    it('should handle high confidence workflow request with suggestions', async () => {
      const mockIntent = createMockWorkflowIntent({
        action: 'sync',
        domain: 'communication',
        integrations: ['gmail', 'slack'],
        confidence: 0.8,
        originalQuery: 'sync Gmail to Slack'
      });

      const mockWorkflows = [
        {
          id: 'wf-001',
          title: 'Gmail to Slack Sync',
          description: 'Sync Gmail messages to Slack channels',
          category: 'communication',
          complexity: 'simple',
          usageCount: 500,
          averageRating: 4.5,
          tags: ['gmail', 'slack', 'sync']
        }
      ];

      (mockIntentAnalyzer.analyzeIntent as Mock).mockResolvedValue(mockIntent);
      (mockSearchService.searchWorkflows as Mock).mockResolvedValue({
        workflows: mockWorkflows,
        total: 1
      });

      const response = await chatHandler.handleWorkflowRequest(
        'I want to sync my Gmail to Slack',
        mockContext
      );

      expect(response.hasWorkflowRecommendations).toBe(true);
      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions![0].title).toBe('Gmail to Slack Sync');
      expect(response.message).toContain('Great! I found 1 workflow');
      expect(response.intent).toEqual(mockIntent);
      expect(response.nextActions).toContain('select_workflow');
    });

    it('should handle low confidence request with clarification questions', async () => {
      const mockIntent = createMockWorkflowIntent({
        action: 'other',
        domain: 'general',
        integrations: [],
        confidence: 0.3,
        originalQuery: 'help me automate stuff',
        clarificationQuestions: ['Which tools do you want to connect?']
      });

      (mockIntentAnalyzer.analyzeIntent as Mock).mockResolvedValue(mockIntent);

      const response = await chatHandler.handleWorkflowRequest(
        'help me automate stuff',
        mockContext
      );

      expect(response.hasWorkflowRecommendations).toBe(false);
      expect(response.clarificationQuestions).toContain('Which tools do you want to connect?');
      expect(response.message).toContain("I'd like to help you find the perfect workflow!");
      expect(response.nextActions).toContain('clarify_intent');
    });

    it('should handle request with no matching workflows', async () => {
      const mockIntent = createMockWorkflowIntent({
        action: 'sync',
        domain: 'data',
        integrations: [],
        confidence: 0.8,
        originalQuery: 'sync RareSystem to UnknownTool'
      });

      (mockIntentAnalyzer.analyzeIntent as Mock).mockResolvedValue(mockIntent);
      (mockSearchService.searchWorkflows as Mock).mockResolvedValue({
        workflows: [],
        total: 0
      });

      const response = await chatHandler.handleWorkflowRequest(
        'sync RareSystem to UnknownTool',
        mockContext
      );

      expect(response.hasWorkflowRecommendations).toBe(false);
      expect(response.message).toContain('couldn\'t find any pre-built workflows');
      expect(response.nextActions).toContain('custom_workflow');
    });

    it('should validate chat context and throw error for invalid context', async () => {
      const invalidContext = {
        sessionId: '',
        userId: 'test-user',
        messages: []
      } as ChatContext;

      await expect(
        chatHandler.handleWorkflowRequest('test message', invalidContext)
      ).rejects.toThrow(InvalidChatContextError);
    });

    it('should throw timeout error for slow responses', async () => {
      const slowConfig = { ...config, responseTimeoutMs: 1000 }; // Fixed: use minimum allowed value
      const slowHandler = new WorkflowChatHandler(
        mockContextBuilder,
        mockIntentAnalyzer,
        mockSearchService,
        conversationMemory,
        slowConfig
      );

      (mockIntentAnalyzer.analyzeIntent as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1200))
      );

      await expect(
        slowHandler.handleWorkflowRequest('test', mockContext)
      ).rejects.toThrow(ConversationTimeoutError);
    });

    it('should use cache for repeated requests', async () => {
      const mockIntent = createMockWorkflowIntent({
        action: 'notify',
        domain: 'communication',
        integrations: ['slack'],
        confidence: 0.7,
        originalQuery: 'notify me on Slack'
      });

      (mockIntentAnalyzer.analyzeIntent as Mock).mockResolvedValue(mockIntent);
      (mockSearchService.searchWorkflows as Mock).mockResolvedValue({
        workflows: [],
        total: 0
      });

      // First request
      const response1 = await chatHandler.handleWorkflowRequest(
        'notify me on Slack',
        mockContext
      );

      // Second identical request should use cache
      const response2 = await chatHandler.handleWorkflowRequest(
        'notify me on Slack',
        mockContext
      );

      // The cached response should have the same ID (that's how caching works)
      expect(response1.id).toBe(response2.id); // Same cached response
      expect(mockIntentAnalyzer.analyzeIntent).toHaveBeenCalledTimes(1); // Only called once due to caching
    });
  });

  describe('generateSuggestions', () => {
    it('should generate and score workflow suggestions', async () => {
      const mockIntent = createMockWorkflowIntent({
        action: 'backup',
        domain: 'productivity',
        integrations: ['google-drive', 'dropbox'],
        confidence: 0.8,
        originalQuery: 'backup Google Drive to Dropbox'
      });

      const mockWorkflows = [
        {
          id: 'wf-backup-001',
          title: 'Google Drive to Dropbox Backup',
          description: 'Automated backup of Google Drive files to Dropbox',
          category: 'productivity',
          complexity: 'medium',
          usageCount: 300,
          averageRating: 4.2,
          tags: ['google-drive', 'dropbox', 'backup'],
          nodeCount: 5
        },
        {
          id: 'wf-backup-002',
          title: 'Cloud Storage Sync',
          description: 'Sync files between cloud storage providers',
          category: 'productivity',
          complexity: 'simple',
          usageCount: 150,
          averageRating: 4.0,
          tags: ['cloud', 'sync'],
          nodeCount: 3
        }
      ];

      (mockSearchService.searchWorkflows as Mock).mockResolvedValue({
        workflows: mockWorkflows,
        total: 2
      });

      const suggestions = await chatHandler.generateSuggestions(mockIntent, 2);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].workflowId).toBe('wf-backup-001');
      expect(suggestions[0].title).toBe('Google Drive to Dropbox Backup');
      expect(suggestions[0].score).toBeGreaterThan(0);
      expect(suggestions[0].complexity).toBe('medium');
    });

    it('should handle empty search results', async () => {
      const mockIntent = createMockWorkflowIntent({
        action: 'transform',
        domain: 'data',
        integrations: [],
        confidence: 0.6,
        originalQuery: 'transform data from UnknownSystem'
      });

      (mockSearchService.searchWorkflows as Mock).mockResolvedValue({
        workflows: [],
        total: 0
      });

      const suggestions = await chatHandler.generateSuggestions(mockIntent, 5);

      expect(suggestions).toHaveLength(0);
    });
  });

  describe('refineIntent', () => {
    it('should refine intent with additional feedback', async () => {
      const originalIntent = createMockWorkflowIntent({
        action: 'sync',
        domain: 'general',
        integrations: [],
        confidence: 0.5,
        originalQuery: 'automate something'
      });

      const refinedIntent = createMockWorkflowIntent({
        action: 'sync',
        domain: 'communication',
        integrations: ['gmail', 'slack'],
        confidence: 0.8,
        originalQuery: 'automate something with Gmail and Slack'
      });

      (mockContextBuilder.buildContext as Mock).mockResolvedValue({});
      (mockIntentAnalyzer.analyzeIntent as Mock).mockResolvedValue(refinedIntent);

      const result = await chatHandler.refineIntent(originalIntent, 'with Gmail and Slack');

      expect(result.confidence).toBeGreaterThan(originalIntent.confidence);
      expect(mockIntentAnalyzer.analyzeIntent).toHaveBeenCalledWith(
        'automate something with Gmail and Slack',
        {}
      );
    });
  });

  describe('getClarificationQuestions', () => {
    it('should generate appropriate clarification questions for low confidence intent', async () => {
      const lowConfidenceIntent = createMockWorkflowIntent({
        action: 'other',
        domain: 'general',
        integrations: [],
        confidence: 0.4,
        originalQuery: 'help with automation'
      });

      const questions = chatHandler.getClarificationQuestions(lowConfidenceIntent);

      expect(questions).toContain('Could you describe what you want to automate in more detail?');
      // Note: sourceSystem check requires the action to not be 'other', but we set it to 'other'
      // So this specific question won't appear for 'other' actions
      expect(questions.length).toBeGreaterThan(0);
    });

    it('should generate action-specific questions', async () => {
      const syncIntent = createMockWorkflowIntent({
        action: 'sync',
        domain: 'productivity',
        integrations: ['google-drive'],
        confidence: 0.8,
        originalQuery: 'sync Google Drive'
      });

      const questions = chatHandler.getClarificationQuestions(syncIntent);

      expect(questions).toContain('How often should the sync happen? (real-time, hourly, daily, etc.)');
    });

    it('should include existing clarification questions from intent', async () => {
      const intentWithQuestions = createMockWorkflowIntent({
        action: 'notify',
        domain: 'communication',
        integrations: ['slack'],
        confidence: 0.6,
        originalQuery: 'notify on Slack',
        clarificationQuestions: ['Which channel?']
      });

      const questions = chatHandler.getClarificationQuestions(intentWithQuestions);

      // Should include clarification questions from the intent
      expect(questions).toContain('Which channel?');
      // Should also include action-specific questions
      expect(questions.length).toBeGreaterThan(1);
    });
  });

  describe('Real-world conversation scenarios', () => {
    it('should handle CRM to email marketing automation request', async () => {
      const mockIntent = createMockWorkflowIntent({
        action: 'sync',
        domain: 'sales',
        integrations: ['salesforce', 'mailchimp'],
        confidence: 0.9,
        originalQuery: 'sync Salesforce leads to Mailchimp'
      });

      const mockWorkflows = [
        {
          id: 'wf-crm-001',
          title: 'Salesforce to Mailchimp Lead Sync',
          description: 'Automatically sync new Salesforce leads to Mailchimp campaigns',
          category: 'marketing',
          complexity: 'medium',
          usageCount: 800,
          averageRating: 4.7,
          tags: ['salesforce', 'mailchimp', 'leads', 'crm']
        }
      ];

      (mockIntentAnalyzer.analyzeIntent as Mock).mockResolvedValue(mockIntent);
      (mockSearchService.searchWorkflows as Mock).mockResolvedValue({
        workflows: mockWorkflows,
        total: 1
      });

      const response = await chatHandler.handleWorkflowRequest(
        'I want to automatically sync new leads from Salesforce to my Mailchimp email campaigns',
        mockContext
      );

      expect(response.hasWorkflowRecommendations).toBe(true);
      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions![0].title).toBe('Salesforce to Mailchimp Lead Sync');
      expect(response.message).toContain('Great! I found 1 workflow');
    });

    it('should handle project management notification request', async () => {
      const mockIntent = createMockWorkflowIntent({
        action: 'notify',
        domain: 'project_management',
        integrations: ['trello', 'slack'],
        confidence: 0.8,
        originalQuery: 'get Slack notifications for Trello card updates'
      });

      const mockWorkflows = [
        {
          id: 'wf-pm-001',
          title: 'Trello to Slack Notifications',
          description: 'Get instant Slack notifications when Trello cards are updated',
          category: 'project_management',
          complexity: 'simple',
          usageCount: 1200,
          averageRating: 4.8,
          tags: ['trello', 'slack', 'notifications', 'project-management']
        }
      ];

      (mockIntentAnalyzer.analyzeIntent as Mock).mockResolvedValue(mockIntent);
      (mockSearchService.searchWorkflows as Mock).mockResolvedValue({
        workflows: mockWorkflows,
        total: 1
      });

      const response = await chatHandler.handleWorkflowRequest(
        'I need to get Slack notifications whenever cards are updated in my Trello board',
        mockContext
      );

      expect(response.hasWorkflowRecommendations).toBe(true);
      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions![0].workflowId).toBe('wf-pm-001');
      expect(response.message).toContain('Great! I found 1 workflow');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle search service errors gracefully', async () => {
      const mockIntent = createMockWorkflowIntent({
        action: 'sync',
        domain: 'general',
        integrations: [],
        confidence: 0.8,
        originalQuery: 'sync TestSystem'
      });

      (mockIntentAnalyzer.analyzeIntent as Mock).mockResolvedValue(mockIntent);
      (mockSearchService.searchWorkflows as Mock).mockRejectedValue(new Error('Search service unavailable'));

      await expect(
        chatHandler.handleWorkflowRequest('sync TestSystem', mockContext)
      ).rejects.toThrow(WorkflowChatError);
    });

    it('should handle context builder errors', async () => {
      (mockContextBuilder.buildContext as Mock).mockRejectedValue(new Error('Context builder failed'));

      await expect(
        chatHandler.handleWorkflowRequest('test message', mockContext)
      ).rejects.toThrow(WorkflowChatError);
    });

    it('should handle intent analyzer errors', async () => {
      (mockContextBuilder.buildContext as Mock).mockResolvedValue({});
      (mockIntentAnalyzer.analyzeIntent as Mock).mockRejectedValue(new Error('Intent analysis failed'));

      await expect(
        chatHandler.handleWorkflowRequest('test message', mockContext)
      ).rejects.toThrow(WorkflowChatError);
    });

    it('should validate maximum conversation turns', async () => {
      const longContext = {
        ...mockContext,
        messages: Array(101).fill({
          id: ulid(),
          content: 'test message',
          timestamp: new Date(),
          role: 'user' as const
        })
      };

      await expect(
        chatHandler.handleWorkflowRequest('test message', longContext)
      ).rejects.toThrow(InvalidChatContextError);
    });
  });
});

describe('InMemoryConversationMemory', () => {
  let memory: InMemoryConversationMemory;
  let testContext: ChatContext;

  beforeEach(() => {
    memory = new InMemoryConversationMemory();
    testContext = {
      sessionId: ulid(),
      userId: 'test-user',
      messages: [],
      preferences: {}
    };
  });

  it('should store and retrieve conversation context', async () => {
    await memory.store(testContext.sessionId, testContext);
    const retrieved = await memory.retrieve(testContext.sessionId);
    
    expect(retrieved).toEqual(testContext);
  });

  it('should return null for non-existent session', async () => {
    const retrieved = await memory.retrieve('non-existent-session');
    expect(retrieved).toBeNull();
  });

  it('should update conversation with new messages', async () => {
    await memory.store(testContext.sessionId, testContext);
    
    const newMessage: ChatMessage = {
      id: ulid(),
      content: 'Test message',
      timestamp: new Date(),
      role: 'user'
    };

    await memory.update(testContext.sessionId, newMessage);
    
    const updated = await memory.retrieve(testContext.sessionId);
    expect(updated?.messages).toHaveLength(1);
    expect(updated?.messages[0]).toEqual(newMessage);
  });

  it('should cleanup old conversations', async () => {
    const oldMessage: ChatMessage = {
      id: ulid(),
      content: 'Old message',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      role: 'user'
    };

    const oldContext = {
      ...testContext,
      messages: [oldMessage]
    };

    await memory.store('old-session', oldContext);
    await memory.store('new-session', testContext);

    const cleaned = await memory.cleanup(60); // Clean conversations older than 1 hour

    expect(cleaned).toBe(1);
    expect(await memory.retrieve('old-session')).toBeNull();
    expect(await memory.retrieve('new-session')).not.toBeNull();
  });
}); 