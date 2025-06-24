/**
 * WorkflowIntentAnalyzer Service
 * 
 * LLM-powered analysis of user intent for intelligent workflow recommendations.
 * Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability.
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { ulid } from 'ulid';
import { z } from 'zod';
import { WorkflowContext } from './WorkflowContextBuilder';

// Intent Analysis Schemas
export const WorkflowIntentSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  originalQuery: z.string(),
  normalizedQuery: z.string(),
  confidence: z.number().min(0).max(1),
  primaryIntent: z.object({
    action: z.string(),
    domain: z.string(),
    tools: z.array(z.string()),
    complexity: z.enum(['low', 'medium', 'high']),
    priority: z.enum(['low', 'medium', 'high', 'urgent'])
  }),
  secondaryIntents: z.array(z.object({
    action: z.string(),
    domain: z.string(),
    confidence: z.number().min(0).max(1)
  })),
  extractedEntities: z.object({
    tools: z.array(z.string()),
    technologies: z.array(z.string()),
    dataTypes: z.array(z.string()),
    integrations: z.array(z.string()),
    triggers: z.array(z.string()),
    frequency: z.string().optional(),
    constraints: z.array(z.string())
  }),
  contextualFactors: z.object({
    userSkillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    urgency: z.enum(['low', 'medium', 'high']),
    scope: z.enum(['personal', 'team', 'organization']),
    budget: z.enum(['free', 'paid', 'enterprise']).optional(),
    timeframe: z.string().optional()
  }),
  recommendationHints: z.array(z.object({
    category: z.string(),
    suggestion: z.string(),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1)
  }))
});

export type WorkflowIntent = z.infer<typeof WorkflowIntentSchema>;

// Error Classes
export class IntentAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'IntentAnalysisError';
  }
}

export class LLMAnalysisError extends IntentAnalysisError {
  constructor(
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'LLM_ANALYSIS_FAILED', context);
    this.name = 'LLMAnalysisError';
  }
}

// Interfaces
export interface IWorkflowIntentAnalyzer {
  analyzeIntent(userQuery: string, context: WorkflowContext): Promise<WorkflowIntent>;
  refineIntent(intentId: string, feedback: IntentRefinementFeedback): Promise<WorkflowIntent>;
  getIntentHistory(sessionId: string, limit?: number): Promise<WorkflowIntent[]>;
  clearIntentHistory(sessionId: string): Promise<void>;
}

export interface ILLMProvider {
  analyze(prompt: string, options: LLMAnalysisOptions): Promise<LLMAnalysisResponse>;
  validateResponse(response: string, schema: z.ZodSchema): Promise<boolean>;
}

export interface IntentRefinementFeedback {
  intentId: string;
  userFeedback: string;
  corrections: {
    tools?: string[];
    complexity?: 'low' | 'medium' | 'high';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    domain?: string;
  };
}

export interface LLMAnalysisOptions {
  temperature: number;
  maxTokens: number;
  responseFormat: 'json' | 'text';
  systemPrompt?: string;
}

export interface LLMAnalysisResponse {
  content: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason: string;
  model: string;
}

// Implementation
export class WorkflowIntentAnalyzer implements IWorkflowIntentAnalyzer {
  private readonly intentHistory = new Map<string, WorkflowIntent[]>();
  private readonly maxHistoryPerSession = 50;

  constructor(
    private readonly llmProvider: ILLMProvider,
    private readonly promptBuilder: IPromptBuilder,
    private readonly logger: {
      info: (message: string, context?: Record<string, unknown>) => void;
      error: (message: string, context?: Record<string, unknown>) => void;
      warn: (message: string, context?: Record<string, unknown>) => void;
      debug: (message: string, context?: Record<string, unknown>) => void;
    }
  ) {}

  /**
   * Analyzes user intent using LLM with comprehensive context
   * 
   * @param userQuery - User's natural language query
   * @param context - Rich workflow context for analysis
   * @returns Structured intent analysis with confidence scores
   * @throws {LLMAnalysisError} If analysis fails
   */
  async analyzeIntent(userQuery: string, context: WorkflowContext): Promise<WorkflowIntent> {
    try {
      this.logger.info('Starting intent analysis', { 
        queryLength: userQuery.length,
        contextId: context.id,
        sessionId: context.userContext.sessionId
      });

      // Generate ULID for intent tracking
      const intentId = ulid();
      const timestamp = new Date();

      // Build comprehensive prompt with context
      const analysisPrompt = this.promptBuilder.buildIntentAnalysisPrompt(userQuery, context);
      
      // Configure LLM analysis options
      const analysisOptions: LLMAnalysisOptions = {
        temperature: 0.3, // Lower temperature for more consistent analysis
        maxTokens: 2000,
        responseFormat: 'json',
        systemPrompt: this.promptBuilder.getSystemPrompt()
      };

      // Perform LLM analysis
      this.logger.debug('Sending query to LLM', { intentId, promptLength: analysisPrompt.length });
      
      const llmResponse = await this.llmProvider.analyze(analysisPrompt, analysisOptions);
      
      this.logger.debug('LLM analysis complete', { 
        intentId, 
        tokensUsed: llmResponse.tokens.total,
        model: llmResponse.model 
      });

      // Parse and validate LLM response
      const parsedIntent = await this.parseAndValidateResponse(
        llmResponse.content,
        userQuery,
        intentId,
        timestamp
      );

      // Enhance with post-processing
      const enhancedIntent = this.enhanceIntentWithContext(parsedIntent, context);

      // Store in history
      this.addToHistory(context.userContext.sessionId, enhancedIntent);

      this.logger.info('Intent analysis completed successfully', {
        intentId,
        sessionId: context.userContext.sessionId,
        confidence: enhancedIntent.confidence,
        primaryAction: enhancedIntent.primaryIntent.action,
        toolsCount: enhancedIntent.extractedEntities.tools.length
      });

      return enhancedIntent;

    } catch (error) {
      this.logger.error('Intent analysis failed', {
        userQuery: userQuery.substring(0, 100),
        contextId: context.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof z.ZodError) {
        throw new LLMAnalysisError(
          'Intent validation failed',
          { query: userQuery, validationErrors: error.errors }
        );
      }

      throw new LLMAnalysisError(
        'Failed to analyze user intent',
        { query: userQuery, originalError: error }
      );
    }
  }

  /**
   * Refines intent based on user feedback
   * 
   * @param intentId - ID of intent to refine
   * @param feedback - User feedback and corrections
   * @returns Refined intent analysis
   */
  async refineIntent(
    intentId: string, 
    feedback: IntentRefinementFeedback
  ): Promise<WorkflowIntent> {
    try {
      // Find original intent
      const originalIntent = this.findIntentById(intentId);
      if (!originalIntent) {
        throw new IntentAnalysisError(
          'Intent not found for refinement',
          'INTENT_NOT_FOUND',
          { intentId }
        );
      }

      this.logger.info('Refining intent with user feedback', { 
        intentId, 
        feedbackType: Object.keys(feedback.corrections) 
      });

      // Create refined intent with user corrections
      const refinedIntent: WorkflowIntent = {
        ...originalIntent,
        id: ulid(), // New ID for refined version
        timestamp: new Date(),
        confidence: Math.min(originalIntent.confidence + 0.1, 1.0), // Increase confidence
        primaryIntent: {
          ...originalIntent.primaryIntent,
          ...(feedback.corrections.tools && { tools: feedback.corrections.tools }),
          ...(feedback.corrections.complexity && { complexity: feedback.corrections.complexity }),
          ...(feedback.corrections.priority && { priority: feedback.corrections.priority }),
          ...(feedback.corrections.domain && { domain: feedback.corrections.domain })
        },
        recommendationHints: [
          ...originalIntent.recommendationHints,
          {
            category: 'user_feedback',
            suggestion: feedback.userFeedback,
            reasoning: 'Direct user correction',
            confidence: 0.95
          }
        ]
      };

      // Validate refined intent
      const validatedIntent = WorkflowIntentSchema.parse(refinedIntent);

      this.logger.info('Intent refined successfully', {
        originalId: intentId,
        refinedId: validatedIntent.id,
        newConfidence: validatedIntent.confidence
      });

      return validatedIntent;

    } catch (error) {
      this.logger.error('Intent refinement failed', {
        intentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new IntentAnalysisError(
        'Failed to refine intent',
        'REFINEMENT_FAILED',
        { intentId, feedback, originalError: error }
      );
    }
  }

  /**
   * Retrieves intent history for a session
   * 
   * @param sessionId - User session identifier
   * @param limit - Maximum number of intents to return
   * @returns Array of historical intents
   */
  async getIntentHistory(sessionId: string, limit = 10): Promise<WorkflowIntent[]> {
    const history = this.intentHistory.get(sessionId) || [];
    return history.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Clears intent history for a session
   * 
   * @param sessionId - User session identifier
   */
  async clearIntentHistory(sessionId: string): Promise<void> {
    this.intentHistory.delete(sessionId);
    this.logger.info('Intent history cleared', { sessionId });
  }

  // Private Methods

  private async parseAndValidateResponse(
    llmResponse: string,
    originalQuery: string,
    intentId: string,
    timestamp: Date
  ): Promise<WorkflowIntent> {
    try {
      // Parse JSON response
      const parsed = JSON.parse(llmResponse);
      
      // Ensure required fields exist
      const intentData = {
        id: intentId,
        timestamp,
        originalQuery,
        normalizedQuery: parsed.normalizedQuery || originalQuery.toLowerCase().trim(),
        confidence: parsed.confidence || 0.5,
        primaryIntent: parsed.primaryIntent,
        secondaryIntents: parsed.secondaryIntents || [],
        extractedEntities: parsed.extractedEntities,
        contextualFactors: parsed.contextualFactors,
        recommendationHints: parsed.recommendationHints || []
      };

      // Validate against schema
      return WorkflowIntentSchema.parse(intentData);

    } catch (error) {
      this.logger.error('Failed to parse LLM response', {
        intentId,
        responseLength: llmResponse.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return fallback intent for graceful degradation
      return this.createFallbackIntent(intentId, timestamp, originalQuery);
    }
  }

  private enhanceIntentWithContext(
    intent: WorkflowIntent,
    context: WorkflowContext
  ): WorkflowIntent {
    // Enhance with context-specific insights
    const contextualEnhancements = {
      // Add skill level context
      contextualFactors: {
        ...intent.contextualFactors,
        userSkillLevel: context.userContext.skillLevel
      },
      
      // Add domain-specific recommendations
      recommendationHints: [
        ...intent.recommendationHints,
        ...this.generateContextualRecommendations(intent, context)
      ]
    };

    return {
      ...intent,
      ...contextualEnhancements
    };
  }

  private generateContextualRecommendations(
    intent: WorkflowIntent,
    context: WorkflowContext
  ): WorkflowIntent['recommendationHints'] {
    const recommendations: WorkflowIntent['recommendationHints'] = [];

    // Check for tool compatibility
    const availableTools = context.domainKnowledge.toolIntegrations
      .map(tool => tool.toolName.toLowerCase());
    
    const requestedTools = intent.extractedEntities.tools
      .map(tool => tool.toLowerCase());

    const compatibleTools = requestedTools.filter(tool => 
      availableTools.some(available => 
        available.includes(tool) || tool.includes(available)
      )
    );

    if (compatibleTools.length > 0) {
      recommendations.push({
        category: 'tool_compatibility',
        suggestion: `Compatible tools available: ${compatibleTools.join(', ')}`,
        reasoning: 'Matched requested tools with available integrations',
        confidence: 0.8
      });
    }

    // Suggest workflow patterns based on complexity
    const matchingPatterns = context.domainKnowledge.workflowPatterns
      .filter(pattern => pattern.complexity === intent.primaryIntent.complexity);

    if (matchingPatterns.length > 0) {
      recommendations.push({
        category: 'workflow_patterns',
        suggestion: `Consider ${matchingPatterns[0].pattern} pattern`,
        reasoning: `Matches complexity level: ${intent.primaryIntent.complexity}`,
        confidence: 0.7
      });
    }

    return recommendations;
  }

  private createFallbackIntent(
    intentId: string,
    timestamp: Date,
    originalQuery: string
  ): WorkflowIntent {
    return {
      id: intentId,
      timestamp,
      originalQuery,
      normalizedQuery: originalQuery.toLowerCase().trim(),
      confidence: 0.3, // Low confidence for fallback
      primaryIntent: {
        action: 'general_automation',
        domain: 'unknown',
        tools: [],
        complexity: 'medium',
        priority: 'medium'
      },
      secondaryIntents: [],
      extractedEntities: {
        tools: [],
        technologies: [],
        dataTypes: [],
        integrations: [],
        triggers: [],
        constraints: []
      },
      contextualFactors: {
        userSkillLevel: 'intermediate',
        urgency: 'medium',
        scope: 'personal'
      },
      recommendationHints: [{
        category: 'fallback',
        suggestion: 'Query needs clarification for better recommendations',
        reasoning: 'Unable to extract clear intent from query',
        confidence: 0.9
      }]
    };
  }

  private findIntentById(intentId: string): WorkflowIntent | null {
    for (const [, intents] of this.intentHistory) {
      const found = intents.find(intent => intent.id === intentId);
      if (found) return found;
    }
    return null;
  }

  private addToHistory(sessionId: string, intent: WorkflowIntent): void {
    const history = this.intentHistory.get(sessionId) || [];
    history.push(intent);
    
    // Maintain history size limit
    if (history.length > this.maxHistoryPerSession) {
      history.splice(0, history.length - this.maxHistoryPerSession);
    }
    
    this.intentHistory.set(sessionId, history);
  }
}

// Prompt Builder Interface
export interface IPromptBuilder {
  buildIntentAnalysisPrompt(userQuery: string, context: WorkflowContext): string;
  getSystemPrompt(): string;
}

// Pure Utility Functions
export const IntentUtils = {
  /**
   * Calculates intent similarity for duplicate detection
   */
  calculateIntentSimilarity: (intent1: WorkflowIntent, intent2: WorkflowIntent): number => {
    const actionMatch = intent1.primaryIntent.action === intent2.primaryIntent.action ? 0.3 : 0;
    const domainMatch = intent1.primaryIntent.domain === intent2.primaryIntent.domain ? 0.2 : 0;
    
    const toolOverlap = intent1.extractedEntities.tools
      .filter(tool => intent2.extractedEntities.tools.includes(tool)).length;
    const totalTools = new Set([
      ...intent1.extractedEntities.tools,
      ...intent2.extractedEntities.tools
    ]).size;
    const toolMatch = totalTools > 0 ? (toolOverlap / totalTools) * 0.5 : 0;
    
    return actionMatch + domainMatch + toolMatch;
  },

  /**
   * Extracts key terms from intent for search
   */
  extractSearchTerms: (intent: WorkflowIntent): string[] => {
    return [
      intent.primaryIntent.action,
      intent.primaryIntent.domain,
      ...intent.extractedEntities.tools,
      ...intent.extractedEntities.technologies,
      ...intent.extractedEntities.integrations
    ].filter(term => term && term.length > 2);
  },

  /**
   * Determines if intent needs clarification
   */
  needsClarification: (intent: WorkflowIntent): boolean => {
    return intent.confidence < 0.6 || 
           intent.extractedEntities.tools.length === 0 ||
           intent.primaryIntent.domain === 'unknown';
  },

  /**
   * Generates clarification questions
   */
  generateClarificationQuestions: (intent: WorkflowIntent): string[] => {
    const questions: string[] = [];

    if (intent.extractedEntities.tools.length === 0) {
      questions.push("Which specific tools or platforms would you like to integrate?");
    }

    if (intent.primaryIntent.domain === 'unknown') {
      questions.push("What area or domain is this workflow for? (e.g., marketing, sales, development)");
    }

    if (intent.confidence < 0.5) {
      questions.push("Could you provide more details about what you're trying to accomplish?");
    }

    return questions;
  }
}; 