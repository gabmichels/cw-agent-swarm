/**
 * WorkflowContextBuilder Service Tests
 * 
 * Comprehensive test suite for WorkflowContextBuilder service.
 * Following IMPLEMENTATION_GUIDELINES.md: Test-first development, >95% coverage
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  WorkflowContextBuilder,
  WorkflowContext,
  WorkflowContextSchema,
  ContextBuildError,
  ContextUtils,
  IDomainKnowledgeProvider,
  IUserContextProvider,
  IWorkflowLibraryProvider
} from '../WorkflowContextBuilder';

// Mock Dependencies
const mockDomainKnowledgeProvider: IDomainKnowledgeProvider = {
  getToolIntegrations: vi.fn(),
  getWorkflowPatterns: vi.fn(),
  getCategoryTaxonomy: vi.fn()
};

const mockUserContextProvider: IUserContextProvider = {
  getUserContext: vi.fn(),
  updateUserPreferences: vi.fn()
};

const mockWorkflowLibraryProvider: IWorkflowLibraryProvider = {
  getLibraryStatistics: vi.fn(),
  getPopularWorkflows: vi.fn(),
  getRecentWorkflows: vi.fn()
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
};

// Test Data
const mockToolIntegrations = [
  {
    toolName: 'Slack',
    aliases: ['slack', 'team chat'],
    category: 'Communication',
    capabilities: ['messaging', 'notifications'],
    apiRequirements: ['OAuth token'],
    commonUses: ['team updates', 'alerts']
  },
  {
    toolName: 'Gmail',
    aliases: ['gmail', 'email'],
    category: 'Email',
    capabilities: ['send emails', 'read emails'],
    apiRequirements: ['OAuth credentials'],
    commonUses: ['automated responses', 'notifications']
  }
];

const mockWorkflowPatterns = [
  {
    pattern: 'Notification Broadcasting',
    description: 'Send notifications to multiple channels',
    useCases: ['System alerts', 'Team updates'],
    requiredTools: ['Slack', 'Email'],
    complexity: 'low' as const
  },
  {
    pattern: 'Data Processing Pipeline',
    description: 'Automated data processing',
    useCases: ['Business intelligence', 'Analytics'],
    requiredTools: ['Database', 'Analytics'],
    complexity: 'high' as const
  }
];

const mockCategoryTaxonomy = [
  {
    category: 'Communication',
    subcategories: ['Team Chat', 'Email'],
    relatedTerms: ['messaging', 'collaboration'],
    commonRequests: ['send notifications', 'team updates']
  },
  {
    category: 'Marketing',
    subcategories: ['Email Marketing', 'Social Media'],
    relatedTerms: ['campaigns', 'leads'],
    commonRequests: ['email campaigns', 'social posting']
  }
];

const mockUserContext = {
  sessionId: 'test_session_123',
  previousQueries: ['automate slack notifications', 'email marketing setup'],
  preferredTools: ['Slack', 'Gmail'],
  skillLevel: 'intermediate' as const,
  domainFocus: ['communication', 'marketing']
};

const mockLibraryStatistics = {
  totalWorkflows: 2053,
  categories: [
    {
      name: 'Communication',
      count: 245,
      popularWorkflows: ['slack-notifications', 'email-alerts']
    },
    {
      name: 'Marketing',
      count: 189,
      popularWorkflows: ['email-campaigns', 'social-posting']
    }
  ],
  recentlyAdded: ['new-workflow-1', 'new-workflow-2'],
  mostPopular: ['popular-workflow-1', 'popular-workflow-2']
};

describe('WorkflowContextBuilder', () => {
  let contextBuilder: WorkflowContextBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    vi.mocked(mockDomainKnowledgeProvider.getToolIntegrations).mockResolvedValue(mockToolIntegrations);
    vi.mocked(mockDomainKnowledgeProvider.getWorkflowPatterns).mockResolvedValue(mockWorkflowPatterns);
    vi.mocked(mockDomainKnowledgeProvider.getCategoryTaxonomy).mockResolvedValue(mockCategoryTaxonomy);
    vi.mocked(mockUserContextProvider.getUserContext).mockResolvedValue(mockUserContext);
    vi.mocked(mockWorkflowLibraryProvider.getLibraryStatistics).mockResolvedValue(mockLibraryStatistics);

    contextBuilder = new WorkflowContextBuilder(
      mockDomainKnowledgeProvider,
      mockUserContextProvider,
      mockWorkflowLibraryProvider,
      mockLogger
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('buildContext', () => {
    it('should build complete context successfully', async () => {
      const context = await contextBuilder.buildContext('test_session_123');

      expect(context).toBeDefined();
      expect(context.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
      expect(context.timestamp).toBeInstanceOf(Date);
      expect(context.domainKnowledge.toolIntegrations).toEqual(mockToolIntegrations);
      expect(context.domainKnowledge.workflowPatterns).toEqual(mockWorkflowPatterns);
      expect(context.domainKnowledge.categoryTaxonomy).toEqual(mockCategoryTaxonomy);
      expect(context.userContext).toEqual(mockUserContext);
      expect(context.workflowLibrary).toEqual(mockLibraryStatistics);

      // Validate against schema
      expect(() => WorkflowContextSchema.parse(context)).not.toThrow();
    });

    it('should enhance user context with query when provided', async () => {
      const userQuery = 'automate social media posting';
      const context = await contextBuilder.buildContext('test_session_123', userQuery);

      expect(context.userContext.previousQueries).toContain(userQuery);
      expect(context.userContext.previousQueries.length).toBeGreaterThan(mockUserContext.previousQueries.length);
    });

    it('should return cached context when available and fresh', async () => {
      // First call to build context
      const context1 = await contextBuilder.buildContext('test_session_123');
      
      // Second call should return cached context
      const context2 = await contextBuilder.buildContext('test_session_123');

      expect(context1.id).toBe(context2.id);
      expect(mockDomainKnowledgeProvider.getToolIntegrations).toHaveBeenCalledTimes(1);
    });

    it('should rebuild context when query suggests different domain', async () => {
      // First call
      await contextBuilder.buildContext('test_session_123', 'slack notifications');
      
      // Second call with very different query
      const context2 = await contextBuilder.buildContext('test_session_123', 'database analytics reporting');

      expect(mockDomainKnowledgeProvider.getToolIntegrations).toHaveBeenCalledTimes(2);
    });

    it('should handle domain knowledge provider errors gracefully', async () => {
      vi.mocked(mockDomainKnowledgeProvider.getToolIntegrations).mockRejectedValue(
        new Error('Domain knowledge failed')
      );

      await expect(contextBuilder.buildContext('test_session_123')).rejects.toThrow(ContextBuildError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to build context',
        expect.objectContaining({
          sessionId: 'test_session_123'
        })
      );
    });

    it('should handle user context provider errors gracefully', async () => {
      vi.mocked(mockUserContextProvider.getUserContext).mockRejectedValue(
        new Error('User context failed')
      );

      await expect(contextBuilder.buildContext('test_session_123')).rejects.toThrow(ContextBuildError);
    });

    it('should handle workflow library provider errors gracefully', async () => {
      vi.mocked(mockWorkflowLibraryProvider.getLibraryStatistics).mockRejectedValue(
        new Error('Library stats failed')
      );

      await expect(contextBuilder.buildContext('test_session_123')).rejects.toThrow(ContextBuildError);
    });

    it('should validate context schema and throw on invalid data', async () => {
      vi.mocked(mockDomainKnowledgeProvider.getToolIntegrations).mockResolvedValue([
        // Invalid tool integration missing required fields
        { toolName: 'Invalid Tool' } as any
      ]);

      await expect(contextBuilder.buildContext('test_session_123')).rejects.toThrow(ContextBuildError);
    });

    it('should log context building progress', async () => {
      await contextBuilder.buildContext('test_session_123');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Building workflow context',
        expect.objectContaining({
          sessionId: 'test_session_123',
          hasQuery: false
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Context built successfully',
        expect.objectContaining({
          sessionId: 'test_session_123',
          toolCount: mockToolIntegrations.length,
          patternCount: mockWorkflowPatterns.length
        })
      );
    });
  });

  describe('updateUserContext', () => {
    it('should update user preferences successfully', async () => {
      const preferences = {
        skillLevel: 'advanced' as const,
        preferredTools: ['Slack', 'GitHub']
      };

      await contextBuilder.updateUserContext('test_session_123', preferences);

      expect(mockUserContextProvider.updateUserPreferences).toHaveBeenCalledWith(
        'test_session_123',
        preferences
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User context updated',
        expect.objectContaining({
          sessionId: 'test_session_123',
          preferences
        })
      );
    });

    it('should invalidate cache after updating preferences', async () => {
      // Build initial context
      await contextBuilder.buildContext('test_session_123');
      
      // Update preferences
      await contextBuilder.updateUserContext('test_session_123', { skillLevel: 'advanced' });
      
      // Build context again - should call providers again
      await contextBuilder.buildContext('test_session_123');

      expect(mockDomainKnowledgeProvider.getToolIntegrations).toHaveBeenCalledTimes(2);
    });

    it('should handle update errors gracefully', async () => {
      vi.mocked(mockUserContextProvider.updateUserPreferences).mockRejectedValue(
        new Error('Update failed')
      );

      await expect(
        contextBuilder.updateUserContext('test_session_123', { skillLevel: 'advanced' })
      ).rejects.toThrow(ContextBuildError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update user context',
        expect.objectContaining({
          sessionId: 'test_session_123'
        })
      );
    });
  });

  describe('getCachedContext', () => {
    it('should return null when no cache exists', async () => {
      const cached = await contextBuilder.getCachedContext('new_session');
      expect(cached).toBeNull();
    });

    it('should return cached context when available', async () => {
      const context = await contextBuilder.buildContext('test_session_123');
      const cached = await contextBuilder.getCachedContext('test_session_123');

      expect(cached).toEqual(context);
    });

    it('should return null when cache is expired', async () => {
      // Build context
      await contextBuilder.buildContext('test_session_123');
      
      // Manually expire cache by creating new builder with short expiry
      const shortExpiryBuilder = new WorkflowContextBuilder(
        mockDomainKnowledgeProvider,
        mockUserContextProvider,
        mockWorkflowLibraryProvider,
        mockLogger
      );
      
      // Mock Date to simulate time passage
      const originalNow = Date.now;
      Date.now = vi.fn(() => originalNow() + 2 * 60 * 60 * 1000); // 2 hours later
      
      const cached = await shortExpiryBuilder.getCachedContext('test_session_123');
      expect(cached).toBeNull();
      
      Date.now = originalNow;
    });
  });

  describe('clearContextCache', () => {
    it('should clear cache for specific session', async () => {
      await contextBuilder.buildContext('test_session_123');
      await contextBuilder.clearContextCache('test_session_123');
      
      const cached = await contextBuilder.getCachedContext('test_session_123');
      expect(cached).toBeNull();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Context cache cleared for session',
        { sessionId: 'test_session_123' }
      );
    });

    it('should clear all cache when no session specified', async () => {
      await contextBuilder.buildContext('session_1');
      await contextBuilder.buildContext('session_2');
      
      await contextBuilder.clearContextCache();
      
      const cached1 = await contextBuilder.getCachedContext('session_1');
      const cached2 = await contextBuilder.getCachedContext('session_2');
      
      expect(cached1).toBeNull();
      expect(cached2).toBeNull();
      
      expect(mockLogger.info).toHaveBeenCalledWith('All context cache cleared');
    });
  });

  describe('private methods', () => {
    it('should detect similar queries correctly', async () => {
      const context1 = await contextBuilder.buildContext('test_session_123', 'slack notifications setup');
      const context2 = await contextBuilder.buildContext('test_session_123', 'slack notification automation');

      // Should return same context for similar queries
      expect(context1.id).toBe(context2.id);
    });

    it('should detect different queries correctly', async () => {
      await contextBuilder.buildContext('test_session_123', 'slack notifications');
      
      // Clear mock call counts
      vi.clearAllMocks();
      vi.mocked(mockDomainKnowledgeProvider.getToolIntegrations).mockResolvedValue(mockToolIntegrations);
      vi.mocked(mockDomainKnowledgeProvider.getWorkflowPatterns).mockResolvedValue(mockWorkflowPatterns);
      vi.mocked(mockDomainKnowledgeProvider.getCategoryTaxonomy).mockResolvedValue(mockCategoryTaxonomy);
      vi.mocked(mockUserContextProvider.getUserContext).mockResolvedValue(mockUserContext);
      vi.mocked(mockWorkflowLibraryProvider.getLibraryStatistics).mockResolvedValue(mockLibraryStatistics);
      
      await contextBuilder.buildContext('test_session_123', 'database analytics reporting');

      // Should call providers again for different query
      expect(mockDomainKnowledgeProvider.getToolIntegrations).toHaveBeenCalled();
    });

    it('should maintain query history limit', async () => {
      const longUserContext = {
        ...mockUserContext,
        previousQueries: Array(15).fill('test query') // More than 10 queries
      };
      
      vi.mocked(mockUserContextProvider.getUserContext).mockResolvedValue(longUserContext);
      
      const context = await contextBuilder.buildContext('test_session_123', 'new query');
      
      expect(context.userContext.previousQueries.length).toBeLessThanOrEqual(11); // 10 + new query
    });
  });
});

describe('ContextUtils', () => {
  let mockContext: WorkflowContext;

  beforeEach(() => {
    mockContext = {
      id: 'test_context_123',
      timestamp: new Date(),
      domainKnowledge: {
        toolIntegrations: mockToolIntegrations,
        workflowPatterns: mockWorkflowPatterns,
        categoryTaxonomy: mockCategoryTaxonomy
      },
      userContext: mockUserContext,
      workflowLibrary: mockLibraryStatistics
    };
  });

  describe('extractToolNames', () => {
    it('should extract all tool names from context', () => {
      const toolNames = ContextUtils.extractToolNames(mockContext);
      expect(toolNames).toEqual(['Slack', 'Gmail']);
    });

    it('should return empty array for empty integrations', () => {
      const emptyContext = {
        ...mockContext,
        domainKnowledge: {
          ...mockContext.domainKnowledge,
          toolIntegrations: []
        }
      };
      
      const toolNames = ContextUtils.extractToolNames(emptyContext);
      expect(toolNames).toEqual([]);
    });
  });

  describe('getAllToolAliases', () => {
    it('should create map of tool names to aliases', () => {
      const aliasMap = ContextUtils.getAllToolAliases(mockContext);
      
      expect(aliasMap.get('Slack')).toEqual(['slack', 'team chat']);
      expect(aliasMap.get('Gmail')).toEqual(['gmail', 'email']);
      expect(aliasMap.size).toBe(2);
    });
  });

  describe('getPatternsByComplexity', () => {
    it('should filter patterns by complexity level', () => {
      const lowComplexityPatterns = ContextUtils.getPatternsByComplexity(mockContext, 'low');
      expect(lowComplexityPatterns).toHaveLength(1);
      expect(lowComplexityPatterns[0].pattern).toBe('Notification Broadcasting');
      
      const highComplexityPatterns = ContextUtils.getPatternsByComplexity(mockContext, 'high');
      expect(highComplexityPatterns).toHaveLength(1);
      expect(highComplexityPatterns[0].pattern).toBe('Data Processing Pipeline');
      
      const mediumComplexityPatterns = ContextUtils.getPatternsByComplexity(mockContext, 'medium');
      expect(mediumComplexityPatterns).toHaveLength(0);
    });
  });

  describe('getCategoryTerms', () => {
    it('should create map of categories to all related terms', () => {
      const categoryTerms = ContextUtils.getCategoryTerms(mockContext);
      
      const communicationTerms = categoryTerms.get('Communication');
      expect(communicationTerms).toContain('Communication');
      expect(communicationTerms).toContain('Team Chat');
      expect(communicationTerms).toContain('Email');
      expect(communicationTerms).toContain('messaging');
      expect(communicationTerms).toContain('collaboration');
      
      const marketingTerms = categoryTerms.get('Marketing');
      expect(marketingTerms).toContain('Marketing');
      expect(marketingTerms).toContain('Email Marketing');
      expect(marketingTerms).toContain('Social Media');
      expect(marketingTerms).toContain('campaigns');
      expect(marketingTerms).toContain('leads');
    });
  });
});

describe('Error Handling', () => {
  let contextBuilder: WorkflowContextBuilder;

  beforeEach(() => {
    contextBuilder = new WorkflowContextBuilder(
      mockDomainKnowledgeProvider,
      mockUserContextProvider,
      mockWorkflowLibraryProvider,
      mockLogger
    );
  });

  it('should throw ContextBuildError with proper context', async () => {
    const testError = new Error('Test error');
    vi.mocked(mockDomainKnowledgeProvider.getToolIntegrations).mockRejectedValue(testError);

    try {
      await contextBuilder.buildContext('test_session');
      expect.fail('Should have thrown ContextBuildError');
    } catch (error) {
      expect(error).toBeInstanceOf(ContextBuildError);
      expect(error.code).toBe('CONTEXT_BUILD_FAILED');
      expect(error.context).toEqual({
        sessionId: 'test_session',
        originalError: testError
      });
    }
  });

  it('should include validation errors in context build error', async () => {
    // Mock invalid data that will fail schema validation
    vi.mocked(mockDomainKnowledgeProvider.getToolIntegrations).mockResolvedValue([
      { invalid: 'data' } as any
    ]);

    try {
      await contextBuilder.buildContext('test_session');
      expect.fail('Should have thrown ContextBuildError');
    } catch (error) {
      expect(error).toBeInstanceOf(ContextBuildError);
      expect(error.message).toBe('Context validation failed');
      expect(error.context).toHaveProperty('validationErrors');
    }
  });
}); 