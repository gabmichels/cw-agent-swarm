/**
 * WorkflowContextBuilder Service
 * 
 * Builds comprehensive context for LLM-powered workflow analysis and recommendations.
 * Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability.
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { ulid } from 'ulid';
import { z } from 'zod';

// Core Types and Schemas
export const WorkflowContextSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  domainKnowledge: z.object({
    toolIntegrations: z.array(z.object({
      toolName: z.string(),
      aliases: z.array(z.string()),
      category: z.string(),
      capabilities: z.array(z.string()),
      apiRequirements: z.array(z.string()),
      commonUses: z.array(z.string())
    })),
    workflowPatterns: z.array(z.object({
      pattern: z.string(),
      description: z.string(),
      useCases: z.array(z.string()),
      requiredTools: z.array(z.string()),
      complexity: z.enum(['low', 'medium', 'high'])
    })),
    categoryTaxonomy: z.array(z.object({
      category: z.string(),
      subcategories: z.array(z.string()),
      relatedTerms: z.array(z.string()),
      commonRequests: z.array(z.string())
    }))
  }),
  userContext: z.object({
    sessionId: z.string(),
    previousQueries: z.array(z.string()),
    preferredTools: z.array(z.string()),
    skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    domainFocus: z.array(z.string())
  }),
  workflowLibrary: z.object({
    totalWorkflows: z.number(),
    categories: z.array(z.object({
      name: z.string(),
      count: z.number(),
      popularWorkflows: z.array(z.string())
    })),
    recentlyAdded: z.array(z.string()),
    mostPopular: z.array(z.string())
  })
});

export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;

// Error Classes
export class WorkflowContextError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'WorkflowContextError';
  }
}

export class ContextBuildError extends WorkflowContextError {
  constructor(
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'CONTEXT_BUILD_FAILED', context);
    this.name = 'ContextBuildError';
  }
}

// Interfaces
export interface IWorkflowContextBuilder {
  buildContext(userSessionId: string, userQuery?: string): Promise<WorkflowContext>;
  updateUserContext(sessionId: string, preferences: Partial<WorkflowContext['userContext']>): Promise<void>;
  getCachedContext(sessionId: string): Promise<WorkflowContext | null>;
  clearContextCache(sessionId?: string): Promise<void>;
}

export interface IDomainKnowledgeProvider {
  getToolIntegrations(): Promise<WorkflowContext['domainKnowledge']['toolIntegrations']>;
  getWorkflowPatterns(): Promise<WorkflowContext['domainKnowledge']['workflowPatterns']>;
  getCategoryTaxonomy(): Promise<WorkflowContext['domainKnowledge']['categoryTaxonomy']>;
}

export interface IUserContextProvider {
  getUserContext(sessionId: string): Promise<WorkflowContext['userContext']>;
  updateUserPreferences(sessionId: string, preferences: Partial<WorkflowContext['userContext']>): Promise<void>;
}

export interface IWorkflowLibraryProvider {
  getLibraryStatistics(): Promise<WorkflowContext['workflowLibrary']>;
  getPopularWorkflows(limit: number): Promise<string[]>;
  getRecentWorkflows(limit: number): Promise<string[]>;
}

// Implementation
export class WorkflowContextBuilder implements IWorkflowContextBuilder {
  private readonly contextCache = new Map<string, { context: WorkflowContext; expiresAt: Date }>();
  private readonly cacheExpiryMinutes = 30;

  constructor(
    private readonly domainKnowledgeProvider: IDomainKnowledgeProvider,
    private readonly userContextProvider: IUserContextProvider,
    private readonly workflowLibraryProvider: IWorkflowLibraryProvider,
    private readonly logger: { 
      info: (message: string, context?: Record<string, unknown>) => void;
      error: (message: string, context?: Record<string, unknown>) => void;
      warn: (message: string, context?: Record<string, unknown>) => void;
    }
  ) {}

  /**
   * Builds comprehensive context for LLM workflow analysis
   * 
   * @param userSessionId - Unique session identifier
   * @param userQuery - Optional user query for context enhancement
   * @returns Complete workflow context for LLM consumption
   * @throws {ContextBuildError} If context building fails
   */
  async buildContext(userSessionId: string, userQuery?: string): Promise<WorkflowContext> {
    try {
      this.logger.info('Building workflow context', { 
        sessionId: userSessionId, 
        hasQuery: Boolean(userQuery) 
      });

      // Check cache first
      const cached = await this.getCachedContext(userSessionId);
      if (cached && !this.shouldRefreshContext(cached, userQuery)) {
        this.logger.info('Returning cached context', { sessionId: userSessionId });
        return cached;
      }

      // Build fresh context
      const contextId = ulid();
      const timestamp = new Date();

      const [domainKnowledge, userContext, workflowLibrary] = await Promise.all([
        this.buildDomainKnowledge(),
        this.buildUserContext(userSessionId, userQuery),
        this.buildWorkflowLibraryContext()
      ]);

      const context: WorkflowContext = {
        id: contextId,
        timestamp,
        domainKnowledge,
        userContext,
        workflowLibrary
      };

      // Validate context
      const validatedContext = WorkflowContextSchema.parse(context);

      // Cache context
      this.setCachedContext(userSessionId, validatedContext);

      this.logger.info('Context built successfully', { 
        contextId, 
        sessionId: userSessionId,
        toolCount: domainKnowledge.toolIntegrations.length,
        patternCount: domainKnowledge.workflowPatterns.length
      });

      return validatedContext;

    } catch (error) {
      this.logger.error('Failed to build context', { 
        sessionId: userSessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });

      if (error instanceof z.ZodError) {
        throw new ContextBuildError(
          'Context validation failed',
          { sessionId: userSessionId, validationErrors: error.errors }
        );
      }

      throw new ContextBuildError(
        'Failed to build workflow context',
        { sessionId: userSessionId, originalError: error }
      );
    }
  }

  /**
   * Updates user context preferences
   * 
   * @param sessionId - User session identifier
   * @param preferences - Partial user context updates
   */
  async updateUserContext(
    sessionId: string, 
    preferences: Partial<WorkflowContext['userContext']>
  ): Promise<void> {
    try {
      await this.userContextProvider.updateUserPreferences(sessionId, preferences);
      
      // Invalidate cache to force refresh
      this.contextCache.delete(sessionId);
      
      this.logger.info('User context updated', { sessionId, preferences });
    } catch (error) {
      this.logger.error('Failed to update user context', { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new ContextBuildError(
        'Failed to update user context',
        { sessionId, preferences, originalError: error }
      );
    }
  }

  /**
   * Retrieves cached context if available and not expired
   * 
   * @param sessionId - User session identifier
   * @returns Cached context or null if not available
   */
  async getCachedContext(sessionId: string): Promise<WorkflowContext | null> {
    const cached = this.contextCache.get(sessionId);
    
    if (!cached) {
      return null;
    }

    if (new Date() > cached.expiresAt) {
      this.contextCache.delete(sessionId);
      this.logger.info('Context cache expired', { sessionId });
      return null;
    }

    return cached.context;
  }

  /**
   * Clears context cache for specific session or all sessions
   * 
   * @param sessionId - Optional specific session to clear
   */
  async clearContextCache(sessionId?: string): Promise<void> {
    if (sessionId) {
      this.contextCache.delete(sessionId);
      this.logger.info('Context cache cleared for session', { sessionId });
    } else {
      this.contextCache.clear();
      this.logger.info('All context cache cleared');
    }
  }

  // Private Methods

  private async buildDomainKnowledge(): Promise<WorkflowContext['domainKnowledge']> {
    const [toolIntegrations, workflowPatterns, categoryTaxonomy] = await Promise.all([
      this.domainKnowledgeProvider.getToolIntegrations(),
      this.domainKnowledgeProvider.getWorkflowPatterns(),
      this.domainKnowledgeProvider.getCategoryTaxonomy()
    ]);

    return {
      toolIntegrations,
      workflowPatterns,
      categoryTaxonomy
    };
  }

  private async buildUserContext(
    sessionId: string, 
    userQuery?: string
  ): Promise<WorkflowContext['userContext']> {
    const baseContext = await this.userContextProvider.getUserContext(sessionId);
    
    // Enhance context with query analysis if provided
    if (userQuery) {
      const enhancedContext = this.enhanceContextWithQuery(baseContext, userQuery);
      return enhancedContext;
    }

    return baseContext;
  }

  private async buildWorkflowLibraryContext(): Promise<WorkflowContext['workflowLibrary']> {
    return await this.workflowLibraryProvider.getLibraryStatistics();
  }

  private enhanceContextWithQuery(
    baseContext: WorkflowContext['userContext'],
    userQuery: string
  ): WorkflowContext['userContext'] {
    // Add query to previous queries (immutable update)
    const updatedQueries = [...baseContext.previousQueries, userQuery].slice(-10); // Keep last 10

    return {
      ...baseContext,
      previousQueries: updatedQueries
    };
  }

  private shouldRefreshContext(context: WorkflowContext, userQuery?: string): boolean {
    // Refresh if context is older than cache expiry
    const ageMinutes = (Date.now() - context.timestamp.getTime()) / (1000 * 60);
    if (ageMinutes > this.cacheExpiryMinutes) {
      return true;
    }

    // Refresh if new query provided and significantly different from recent queries
    if (userQuery && !this.isSimilarToRecentQueries(context.userContext.previousQueries, userQuery)) {
      return true;
    }

    return false;
  }

  private isSimilarToRecentQueries(previousQueries: string[], newQuery: string): boolean {
    if (previousQueries.length === 0) {
      return false;
    }

    const recentQueries = previousQueries.slice(-3); // Check last 3 queries
    const normalizedNewQuery = newQuery.toLowerCase().trim();

    return recentQueries.some(query => {
      const normalizedQuery = query.toLowerCase().trim();
      
      // Simple similarity check - could be enhanced with more sophisticated NLP
      const commonWords = normalizedNewQuery
        .split(' ')
        .filter(word => word.length > 3)
        .filter(word => normalizedQuery.includes(word));

      return commonWords.length > 0;
    });
  }

  private setCachedContext(sessionId: string, context: WorkflowContext): void {
    const expiresAt = new Date(Date.now() + this.cacheExpiryMinutes * 60 * 1000);
    this.contextCache.set(sessionId, { context, expiresAt });
  }
}

// Pure Utility Functions
export const ContextUtils = {
  /**
   * Extracts tool names from context
   */
  extractToolNames: (context: WorkflowContext): string[] => {
    return context.domainKnowledge.toolIntegrations.map(tool => tool.toolName);
  },

  /**
   * Gets all tool aliases for better matching
   */
  getAllToolAliases: (context: WorkflowContext): Map<string, string[]> => {
    const aliasMap = new Map<string, string[]>();
    
    context.domainKnowledge.toolIntegrations.forEach(tool => {
      aliasMap.set(tool.toolName, tool.aliases);
    });

    return aliasMap;
  },

  /**
   * Finds patterns by complexity level
   */
  getPatternsByComplexity: (
    context: WorkflowContext, 
    complexity: 'low' | 'medium' | 'high'
  ): WorkflowContext['domainKnowledge']['workflowPatterns'] => {
    return context.domainKnowledge.workflowPatterns.filter(
      pattern => pattern.complexity === complexity
    );
  },

  /**
   * Gets category-specific terms for query analysis
   */
  getCategoryTerms: (context: WorkflowContext): Map<string, string[]> => {
    const termMap = new Map<string, string[]>();
    
    context.domainKnowledge.categoryTaxonomy.forEach(category => {
      const allTerms = [
        category.category,
        ...category.subcategories,
        ...category.relatedTerms
      ];
      termMap.set(category.category, allTerms);
    });

    return termMap;
  }
}; 