/**
 * UserContextProvider Service
 * 
 * Manages user session context and preferences for intelligent workflow recommendations.
 * Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability.
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { ulid } from 'ulid';
import { z } from 'zod';
import { 
  IUserContextProvider,
  WorkflowContext 
} from '../WorkflowContextBuilder';

// User Context Schemas
export const UserContextSchema = z.object({
  sessionId: z.string(),
  previousQueries: z.array(z.string()),
  preferredTools: z.array(z.string()),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  domainFocus: z.array(z.string())
});

export const UserPreferencesSchema = z.object({
  preferredComplexity: z.enum(['low', 'medium', 'high']).optional(),
  favoriteCategories: z.array(z.string()).optional(),
  avoidedTools: z.array(z.string()).optional(),
  preferredIntegrationStyle: z.enum(['simple', 'comprehensive']).optional(),
  languagePreference: z.string().optional(),
  timeZone: z.string().optional()
});

export type UserContext = z.infer<typeof UserContextSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// Error Classes
export class UserContextError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'UserContextError';
  }
}

// Storage Interface
export interface IUserContextStorage {
  getContext(sessionId: string): Promise<UserContext | null>;
  setContext(sessionId: string, context: UserContext): Promise<void>;
  updateContext(sessionId: string, updates: Partial<UserContext>): Promise<void>;
  getPreferences(sessionId: string): Promise<UserPreferences | null>;
  setPreferences(sessionId: string, preferences: UserPreferences): Promise<void>;
  clearSession(sessionId: string): Promise<void>;
}

// Implementation
export class UserContextProvider implements IUserContextProvider {
  private readonly defaultContext: Omit<UserContext, 'sessionId'> = {
    previousQueries: [],
    preferredTools: [],
    skillLevel: 'intermediate',
    domainFocus: []
  };

  constructor(
    private readonly storage: IUserContextStorage,
    private readonly logger: {
      info: (message: string, context?: Record<string, unknown>) => void;
      error: (message: string, context?: Record<string, unknown>) => void;
      warn: (message: string, context?: Record<string, unknown>) => void;
    }
  ) {}

  /**
   * Gets user context for a session, creating default if none exists
   * 
   * @param sessionId - User session identifier
   * @returns User context with preferences and history
   */
  async getUserContext(sessionId: string): Promise<WorkflowContext['userContext']> {
    try {
      this.logger.info('Retrieving user context', { sessionId });

      // Try to get existing context
      let context = await this.storage.getContext(sessionId);

      if (!context) {
        // Create new context with defaults
        context = {
          sessionId,
          ...this.defaultContext
        };

        // Store new context
        await this.storage.setContext(sessionId, context);
        
        this.logger.info('Created new user context', { sessionId });
      } else {
        this.logger.info('Retrieved existing user context', { 
          sessionId, 
          queryCount: context.previousQueries.length,
          skillLevel: context.skillLevel 
        });
      }

      // Validate context
      const validatedContext = UserContextSchema.parse(context);

      return validatedContext;

    } catch (error) {
      this.logger.error('Failed to get user context', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return default context for graceful degradation
      return {
        sessionId,
        ...this.defaultContext
      };
    }
  }

  /**
   * Updates user preferences and context
   * 
   * @param sessionId - User session identifier
   * @param preferences - Partial context updates to apply
   */
  async updateUserPreferences(
    sessionId: string, 
    preferences: Partial<WorkflowContext['userContext']>
  ): Promise<void> {
    try {
      this.logger.info('Updating user preferences', { 
        sessionId, 
        updates: Object.keys(preferences) 
      });

      // Get current context
      const currentContext = await this.getUserContext(sessionId);

      // Create updated context (immutable update)
      const updatedContext: UserContext = {
        ...currentContext,
        ...preferences,
        sessionId // Ensure sessionId doesn't change
      };

      // Validate updated context
      const validatedContext = UserContextSchema.parse(updatedContext);

      // Store updated context
      await this.storage.setContext(sessionId, validatedContext);

      this.logger.info('User preferences updated successfully', { 
        sessionId,
        newSkillLevel: validatedContext.skillLevel,
        preferredToolsCount: validatedContext.preferredTools.length
      });

    } catch (error) {
      this.logger.error('Failed to update user preferences', {
        sessionId,
        preferences,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new UserContextError(
        'Failed to update user preferences',
        'UPDATE_PREFERENCES_FAILED',
        { sessionId, preferences, originalError: error }
      );
    }
  }

  /**
   * Adds a query to user's query history
   * 
   * @param sessionId - User session identifier
   * @param query - Query to add to history
   */
  async addQueryToHistory(sessionId: string, query: string): Promise<void> {
    try {
      const context = await this.getUserContext(sessionId);
      
      // Add query to history (keep last 20 queries)
      const updatedQueries = [...context.previousQueries, query].slice(-20);
      
      await this.updateUserPreferences(sessionId, {
        previousQueries: updatedQueries
      });

      this.logger.info('Query added to history', { 
        sessionId, 
        queryLength: query.length,
        totalQueries: updatedQueries.length 
      });

    } catch (error) {
      this.logger.error('Failed to add query to history', {
        sessionId,
        query: query.substring(0, 50),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Don't throw - this is not critical
    }
  }

  /**
   * Updates user's preferred tools based on usage
   * 
   * @param sessionId - User session identifier
   * @param tools - Tools to add to preferences
   */
  async updatePreferredTools(sessionId: string, tools: string[]): Promise<void> {
    try {
      const context = await this.getUserContext(sessionId);
      
      // Merge with existing preferred tools (remove duplicates)
      const updatedTools = Array.from(new Set([
        ...context.preferredTools,
        ...tools
      ])).slice(0, 10); // Keep top 10 preferred tools

      await this.updateUserPreferences(sessionId, {
        preferredTools: updatedTools
      });

      this.logger.info('Preferred tools updated', { 
        sessionId, 
        newTools: tools,
        totalPreferred: updatedTools.length 
      });

    } catch (error) {
      this.logger.error('Failed to update preferred tools', {
        sessionId,
        tools,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Don't throw - this is not critical
    }
  }

  /**
   * Analyzes user queries to infer skill level
   * 
   * @param sessionId - User session identifier
   */
  async inferSkillLevel(sessionId: string): Promise<void> {
    try {
      const context = await this.getUserContext(sessionId);
      
      if (context.previousQueries.length < 3) {
        return; // Need more data
      }

      const skillLevel = this.analyzeSkillFromQueries(context.previousQueries);
      
      if (skillLevel !== context.skillLevel) {
        await this.updateUserPreferences(sessionId, { skillLevel });
        
        this.logger.info('Skill level inferred and updated', { 
          sessionId, 
          oldLevel: context.skillLevel,
          newLevel: skillLevel 
        });
      }

    } catch (error) {
      this.logger.error('Failed to infer skill level', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Don't throw - this is not critical
    }
  }

  /**
   * Gets advanced user preferences
   * 
   * @param sessionId - User session identifier
   * @returns Extended user preferences
   */
  async getAdvancedPreferences(sessionId: string): Promise<UserPreferences> {
    try {
      const stored = await this.storage.getPreferences(sessionId);
      return stored || {};
    } catch (error) {
      this.logger.error('Failed to get advanced preferences', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {};
    }
  }

  /**
   * Sets advanced user preferences
   * 
   * @param sessionId - User session identifier
   * @param preferences - Advanced preferences to set
   */
  async setAdvancedPreferences(sessionId: string, preferences: UserPreferences): Promise<void> {
    try {
      const validatedPreferences = UserPreferencesSchema.parse(preferences);
      await this.storage.setPreferences(sessionId, validatedPreferences);
      
      this.logger.info('Advanced preferences updated', { sessionId, preferences });
    } catch (error) {
      this.logger.error('Failed to set advanced preferences', {
        sessionId,
        preferences,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new UserContextError(
        'Failed to set advanced preferences',
        'SET_ADVANCED_PREFERENCES_FAILED',
        { sessionId, preferences, originalError: error }
      );
    }
  }

  /**
   * Clears all user data for a session
   * 
   * @param sessionId - User session identifier
   */
  async clearUserData(sessionId: string): Promise<void> {
    try {
      await this.storage.clearSession(sessionId);
      this.logger.info('User data cleared', { sessionId });
    } catch (error) {
      this.logger.error('Failed to clear user data', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new UserContextError(
        'Failed to clear user data',
        'CLEAR_USER_DATA_FAILED',
        { sessionId, originalError: error }
      );
    }
  }

  // Private Methods

  private analyzeSkillFromQueries(queries: string[]): 'beginner' | 'intermediate' | 'advanced' {
    const recentQueries = queries.slice(-10); // Analyze last 10 queries
    
    // Count technical terms and complexity indicators
    let complexityScore = 0;
    const technicalTerms = [
      'api', 'webhook', 'integration', 'automation', 'workflow', 'trigger',
      'conditional', 'advanced', 'custom', 'script', 'code', 'database',
      'query', 'filter', 'transform', 'parse', 'regex', 'json'
    ];

    const beginnerTerms = [
      'simple', 'easy', 'basic', 'help', 'how to', 'tutorial', 'guide',
      'step by step', 'example', 'template'
    ];

    for (const query of recentQueries) {
      const lowerQuery = query.toLowerCase();
      
      // Add points for technical terms
      technicalTerms.forEach(term => {
        if (lowerQuery.includes(term)) complexityScore += 1;
      });

      // Subtract points for beginner terms
      beginnerTerms.forEach(term => {
        if (lowerQuery.includes(term)) complexityScore -= 0.5;
      });

      // Add points for query length and specificity
      if (query.length > 100) complexityScore += 0.5;
      if (query.split(' ').length > 15) complexityScore += 0.5;
    }

    // Determine skill level based on score
    const avgScore = complexityScore / recentQueries.length;
    
    if (avgScore >= 2) return 'advanced';
    if (avgScore >= 0.5) return 'intermediate';
    return 'beginner';
  }
}

// In-Memory Storage Implementation (for development/testing)
export class InMemoryUserContextStorage implements IUserContextStorage {
  private contexts = new Map<string, UserContext>();
  private preferences = new Map<string, UserPreferences>();

  async getContext(sessionId: string): Promise<UserContext | null> {
    return this.contexts.get(sessionId) || null;
  }

  async setContext(sessionId: string, context: UserContext): Promise<void> {
    this.contexts.set(sessionId, context);
  }

  async updateContext(sessionId: string, updates: Partial<UserContext>): Promise<void> {
    const existing = this.contexts.get(sessionId);
    if (existing) {
      this.contexts.set(sessionId, { ...existing, ...updates });
    }
  }

  async getPreferences(sessionId: string): Promise<UserPreferences | null> {
    return this.preferences.get(sessionId) || null;
  }

  async setPreferences(sessionId: string, preferences: UserPreferences): Promise<void> {
    this.preferences.set(sessionId, preferences);
  }

  async clearSession(sessionId: string): Promise<void> {
    this.contexts.delete(sessionId);
    this.preferences.delete(sessionId);
  }

  // Utility methods for testing
  getAllSessions(): string[] {
    return Array.from(this.contexts.keys());
  }

  getSessionCount(): number {
    return this.contexts.size;
  }

  clearAll(): void {
    this.contexts.clear();
    this.preferences.clear();
  }
}

// Pure Utility Functions
export const UserContextUtils = {
  /**
   * Creates a new session ID
   */
  createSessionId: (): string => {
    return ulid();
  },

  /**
   * Merges user contexts (for session consolidation)
   */
  mergeContexts: (primary: UserContext, secondary: UserContext): UserContext => {
    return {
      sessionId: primary.sessionId,
      previousQueries: Array.from(new Set([
        ...primary.previousQueries,
        ...secondary.previousQueries
      ])).slice(-20),
      preferredTools: Array.from(new Set([
        ...primary.preferredTools,
        ...secondary.preferredTools
      ])).slice(0, 10),
      skillLevel: primary.skillLevel, // Keep primary skill level
      domainFocus: Array.from(new Set([
        ...primary.domainFocus,
        ...secondary.domainFocus
      ]))
    };
  },

  /**
   * Validates session ID format
   */
  isValidSessionId: (sessionId: string): boolean => {
    // ULID format: 26 characters, alphanumeric
    return /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(sessionId);
  },

  /**
   * Calculates context freshness score
   */
  calculateFreshnessScore: (context: UserContext, currentTime = new Date()): number => {
    if (context.previousQueries.length === 0) return 0;
    
    // Simple freshness based on query count and recency
    // In real implementation, you'd track timestamps
    const queryCount = context.previousQueries.length;
    const preferredToolsCount = context.preferredTools.length;
    
    return Math.min(1, (queryCount * 0.1) + (preferredToolsCount * 0.05));
  },

  /**
   * Extracts domain focus from queries
   */
  extractDomainFocus: (queries: string[]): string[] => {
    const domains = new Set<string>();
    const domainKeywords = {
      'marketing': ['marketing', 'campaign', 'email', 'social', 'leads', 'conversion'],
      'sales': ['sales', 'crm', 'leads', 'deals', 'customers', 'revenue'],
      'development': ['code', 'github', 'deployment', 'api', 'development', 'programming'],
      'support': ['support', 'tickets', 'help', 'customer service', 'issues'],
      'analytics': ['analytics', 'tracking', 'reports', 'data', 'metrics'],
      'ecommerce': ['orders', 'inventory', 'products', 'shopify', 'sales'],
      'project': ['projects', 'tasks', 'team', 'collaboration', 'management']
    };

    queries.forEach(query => {
      const lowerQuery = query.toLowerCase();
      Object.entries(domainKeywords).forEach(([domain, keywords]) => {
        if (keywords.some(keyword => lowerQuery.includes(keyword))) {
          domains.add(domain);
        }
      });
    });

    return Array.from(domains);
  }
}; 