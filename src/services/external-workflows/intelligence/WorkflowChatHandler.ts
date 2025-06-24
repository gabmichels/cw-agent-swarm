import { z } from 'zod';
import { ulid } from 'ulid';
import type { IWorkflowContextBuilder } from './WorkflowContextBuilder.js';
import type { IWorkflowIntentAnalyzer, WorkflowIntent } from './WorkflowIntentAnalyzer.js';
import type { WorkflowSearchService } from '../integrations/WorkflowSearchService.js';

// Interface adapters to handle WorkflowIntent structure differences
interface LegacyWorkflowIntent {
  primaryAction: string;
  sourceSystem?: string;
  targetSystem?: string;
  suggestedCategories?: string[];
  compatibleIntegrations?: string[];
  clarificationQuestions?: string[];
  confidence: number;
  originalQuery: string;
}

/**
 * Adapter to convert WorkflowIntent to legacy format expected by chat handler logic
 */
function adaptWorkflowIntent(intent: WorkflowIntent): LegacyWorkflowIntent {
  return {
    primaryAction: intent.primaryIntent.action,
    sourceSystem: intent.extractedEntities.integrations[0] || undefined,
    targetSystem: intent.extractedEntities.integrations[1] || undefined,
    suggestedCategories: [intent.primaryIntent.domain],
    compatibleIntegrations: intent.extractedEntities.integrations,
    clarificationQuestions: intent.recommendationHints
      .filter(hint => hint.category === 'clarification')
      .map(hint => hint.suggestion),
    confidence: intent.confidence,
    originalQuery: intent.originalQuery
  };
}

// Base types
export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  role: 'user' | 'assistant';
  metadata?: Record<string, unknown>;
}

export interface ChatContext {
  sessionId: string;
  userId: string;
  messages: ChatMessage[];
  preferences?: Record<string, unknown>;
}

export interface WorkflowSuggestion {
  workflowId: string;
  title: string;
  description: string;
  category: string;
  complexity: 'simple' | 'medium' | 'complex';
  score: number;
  explanation: string;
  setupTime: string;
  requirements: string[];
  tags: string[];
}

export interface WorkflowChatResponse {
  id: string;
  message: string;
  suggestions?: WorkflowSuggestion[];
  clarificationQuestions?: string[];
  hasWorkflowRecommendations: boolean;
  intent?: WorkflowIntent;
  nextActions?: string[];
  timestamp: Date;
}

// Configuration schema
const WorkflowChatConfigSchema = z.object({
  maxSuggestions: z.number().min(1).max(10).default(3),
  confidenceThreshold: z.number().min(0).max(1).default(0.6),
  enableConversationHistory: z.boolean().default(true),
  maxConversationTurns: z.number().min(1).max(50).default(20),
  responseTimeoutMs: z.number().min(1000).max(30000).default(10000),
  enableCaching: z.boolean().default(true),
  cacheExpiryMinutes: z.number().min(1).max(60).default(15)
});

export type WorkflowChatConfig = z.infer<typeof WorkflowChatConfigSchema>;

// Error classes
export class WorkflowChatError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowChatError';
  }
}

export class ConversationTimeoutError extends WorkflowChatError {
  constructor(timeoutMs: number) {
    super(
      `Conversation timeout after ${timeoutMs}ms`,
      'CONVERSATION_TIMEOUT',
      { timeoutMs }
    );
  }
}

export class InvalidChatContextError extends WorkflowChatError {
  constructor(reason: string) {
    super(
      `Invalid chat context: ${reason}`,
      'INVALID_CHAT_CONTEXT',
      { reason }
    );
  }
}

// Interfaces
export interface IWorkflowChatHandler {
  handleWorkflowRequest(message: string, context: ChatContext): Promise<WorkflowChatResponse>;
  isWorkflowRequest(message: string): boolean;
  generateSuggestions(intent: WorkflowIntent, maxResults?: number): Promise<WorkflowSuggestion[]>;
  refineIntent(originalIntent: WorkflowIntent, feedback: string): Promise<WorkflowIntent>;
  getClarificationQuestions(intent: WorkflowIntent): string[];
}

export interface IConversationMemory {
  store(sessionId: string, context: ChatContext): Promise<void>;
  retrieve(sessionId: string): Promise<ChatContext | null>;
  update(sessionId: string, message: ChatMessage): Promise<void>;
  cleanup(olderThanMinutes: number): Promise<number>;
}

// In-memory conversation storage for development
export class InMemoryConversationMemory implements IConversationMemory {
  private conversations = new Map<string, ChatContext>();

  async store(sessionId: string, context: ChatContext): Promise<void> {
    this.conversations.set(sessionId, { ...context });
  }

  async retrieve(sessionId: string): Promise<ChatContext | null> {
    return this.conversations.get(sessionId) || null;
  }

  async update(sessionId: string, message: ChatMessage): Promise<void> {
    const context = this.conversations.get(sessionId);
    if (context) {
      context.messages.push(message);
      this.conversations.set(sessionId, context);
    }
  }

  async cleanup(olderThanMinutes: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    let cleaned = 0;
    
    for (const [sessionId, context] of this.conversations.entries()) {
      const lastMessage = context.messages[context.messages.length - 1];
      if (lastMessage && lastMessage.timestamp < cutoffTime) {
        this.conversations.delete(sessionId);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

// Main implementation
export class WorkflowChatHandler implements IWorkflowChatHandler {
  private readonly config: WorkflowChatConfig;
  private readonly cache = new Map<string, { data: WorkflowChatResponse; expiry: Date }>();

  constructor(
    private readonly contextBuilder: IWorkflowContextBuilder,
    private readonly intentAnalyzer: IWorkflowIntentAnalyzer,
    private readonly searchService: WorkflowSearchService,
    private readonly conversationMemory: IConversationMemory,
    config: Partial<WorkflowChatConfig> = {}
  ) {
    this.config = WorkflowChatConfigSchema.parse(config);
  }

  async handleWorkflowRequest(
    message: string,
    context: ChatContext
  ): Promise<WorkflowChatResponse> {
    const startTime = Date.now();
    
    try {
      // Validate input
      this.validateChatContext(context);
      
      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.getCachedResponse(message, context.sessionId);
        if (cached) {
          return cached;
        }
      }
      
      // Store conversation context
      if (this.config.enableConversationHistory) {
        await this.conversationMemory.store(context.sessionId, context);
      }
      
      // Build enriched context for intent analysis
      const workflowContext = await this.contextBuilder.buildContext(
        context.sessionId,
        message
      );
      
      // Analyze intent
      const intent = await this.intentAnalyzer.analyzeIntent(message, workflowContext);
      
      // Generate response based on confidence level
      const response = await this.generateResponse(intent, context, message);
      
      // Cache the response
      if (this.config.enableCaching) {
        this.setCachedResponse(message, context.sessionId, response);
      }
      
      // Update conversation memory
      if (this.config.enableConversationHistory) {
        const userMessage: ChatMessage = {
          id: ulid(),
          content: message,
          timestamp: new Date(),
          role: 'user'
        };
        
        const assistantMessage: ChatMessage = {
          id: response.id,
          content: response.message,
          timestamp: response.timestamp,
          role: 'assistant',
          metadata: { intent, suggestions: response.suggestions }
        };
        
        await this.conversationMemory.update(context.sessionId, userMessage);
        await this.conversationMemory.update(context.sessionId, assistantMessage);
      }
      
      return response;
      
    } catch (error) {
      if (Date.now() - startTime > this.config.responseTimeoutMs) {
        throw new ConversationTimeoutError(this.config.responseTimeoutMs);
      }
      
      if (error instanceof WorkflowChatError) {
        throw error;
      }
      
      throw new WorkflowChatError(
        'Failed to handle workflow request',
        'HANDLER_ERROR',
        { originalError: error, message, sessionId: context.sessionId }
      );
    }
  }

  isWorkflowRequest(message: string): boolean {
    const workflowKeywords = [
      'workflow', 'automation', 'integrate', 'connect', 'sync', 'automate',
      'trigger', 'schedule', 'notify', 'send', 'create', 'update', 'import',
      'export', 'backup', 'monitor', 'track', 'process', 'transform'
    ];
    
    const toolKeywords = [
      'slack', 'gmail', 'google', 'salesforce', 'hubspot', 'notion', 'trello',
      'asana', 'jira', 'github', 'dropbox', 'mailchimp', 'discord', 'teams'
    ];
    
    const normalizedMessage = message.toLowerCase();
    
    // Check for workflow-related keywords
    const hasWorkflowKeyword = workflowKeywords.some(keyword => 
      normalizedMessage.includes(keyword)
    );
    
    // Check for tool/integration keywords
    const hasToolKeyword = toolKeywords.some(keyword => 
      normalizedMessage.includes(keyword)
    );
    
    // Check for automation patterns
    const automationPatterns = [
      /when\s+.+\s+then/i,           // "when X happens then Y"
      /if\s+.+\s+(then|do)/i,       // "if X then/do Y"
      /i\s+want\s+to\s+(sync|connect|automate)/i,  // "I want to sync/connect/automate"
      /how\s+(do\s+i|can\s+i)\s+(sync|connect|automate)/i,  // "how do/can I sync/connect/automate"
      /\b(setup|set\s+up)\s+.+\s+(integration|workflow)/i   // "setup X integration/workflow"
    ];
    
    const hasAutomationPattern = automationPatterns.some(pattern => 
      pattern.test(normalizedMessage)
    );
    
    return hasWorkflowKeyword || hasToolKeyword || hasAutomationPattern;
  }

  async generateSuggestions(
    intent: WorkflowIntent,
    maxResults = this.config.maxSuggestions
  ): Promise<WorkflowSuggestion[]> {
    try {
      const adaptedIntent = adaptWorkflowIntent(intent);
      
      // Search for workflows based on intent
      const searchResults = await this.searchService.searchWorkflows({
        q: this.buildSearchQuery(intent),
        category: adaptedIntent.suggestedCategories?.[0] as any,
        limit: maxResults * 2 // Get more results for filtering
      });
      
      // Score and rank workflows
      const scoredSuggestions = searchResults.workflows.map(workflow => 
        this.scoreWorkflow(workflow, intent)
      );
      
      // Sort by score and take top results
      const topSuggestions = scoredSuggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
      
      return topSuggestions;
      
    } catch (error) {
      throw new WorkflowChatError(
        'Failed to generate workflow suggestions',
        'SUGGESTION_ERROR',
        { intent, error }
      );
    }
  }

  async refineIntent(
    originalIntent: WorkflowIntent,
    feedback: string
  ): Promise<WorkflowIntent> {
    try {
      // Create refined query by combining original query with feedback
      const refinedQuery = `${originalIntent.originalQuery} ${feedback}`;
      
      // Re-analyze with additional context
      const context = await this.contextBuilder.buildContext(
        ulid(), // New session for refinement
        refinedQuery
      );
      
      const refinedIntent = await this.intentAnalyzer.analyzeIntent(refinedQuery, context);
      
      // Merge with original intent, keeping higher confidence values
      return this.mergeIntents(originalIntent, refinedIntent);
      
    } catch (error) {
      throw new WorkflowChatError(
        'Failed to refine intent',
        'INTENT_REFINEMENT_ERROR',
        { originalIntent, feedback, error }
      );
    }
  }

  getClarificationQuestions(intent: WorkflowIntent): string[] {
    const adaptedIntent = adaptWorkflowIntent(intent);
    const questions: string[] = [];
    
    // Add questions based on missing or unclear information
    if (adaptedIntent.confidence < 0.7) {
      questions.push('Could you describe what you want to automate in more detail?');
    }
    
    if (!adaptedIntent.sourceSystem && adaptedIntent.primaryAction !== 'other') {
      questions.push('Which tool or platform should be the source of this automation?');
    }
    
    if (!adaptedIntent.targetSystem && ['sync', 'notify', 'export'].includes(adaptedIntent.primaryAction)) {
      questions.push('Which tool or platform should receive the data or notifications?');
    }
    
    if (adaptedIntent.clarificationQuestions && adaptedIntent.clarificationQuestions.length > 0) {
      questions.push(...adaptedIntent.clarificationQuestions);
    }
    
    // Add contextual questions based on primary action
    switch (adaptedIntent.primaryAction) {
      case 'sync':
        if (!questions.some(q => q.includes('how often'))) {
          questions.push('How often should the sync happen? (real-time, hourly, daily, etc.)');
        }
        break;
      case 'notify':
        if (!questions.some(q => q.includes('trigger'))) {
          questions.push('What should trigger the notification?');
        }
        break;
      case 'backup':
        if (!questions.some(q => q.includes('frequency'))) {
          questions.push('How frequently should backups be created?');
        }
        break;
    }
    
    return questions.slice(0, 3); // Limit to 3 questions to avoid overwhelming
  }

  // Private helper methods
  private validateChatContext(context: ChatContext): void {
    if (!context.sessionId) {
      throw new InvalidChatContextError('Missing sessionId');
    }
    
    if (!context.userId) {
      throw new InvalidChatContextError('Missing userId');
    }
    
    if (!Array.isArray(context.messages)) {
      throw new InvalidChatContextError('Invalid messages array');
    }
    
    if (context.messages.length > this.config.maxConversationTurns) {
      throw new InvalidChatContextError(
        `Too many conversation turns (${context.messages.length} > ${this.config.maxConversationTurns})`
      );
    }
  }

  private getCachedResponse(message: string, sessionId: string): WorkflowChatResponse | null {
    const cacheKey = this.getCacheKey(message, sessionId);
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expiry > new Date()) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(cacheKey); // Remove expired cache
    }
    
    return null;
  }

  private setCachedResponse(
    message: string,
    sessionId: string,
    response: WorkflowChatResponse
  ): void {
    const cacheKey = this.getCacheKey(message, sessionId);
    const expiry = new Date(Date.now() + this.config.cacheExpiryMinutes * 60 * 1000);
    
    this.cache.set(cacheKey, { data: response, expiry });
    
    // Clean up expired cache entries periodically
    if (this.cache.size > 100) {
      this.cleanupCache();
    }
  }

  private getCacheKey(message: string, sessionId: string): string {
    return `${sessionId}:${message.toLowerCase().trim()}`;
  }

  private cleanupCache(): void {
    const now = new Date();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry <= now) {
        this.cache.delete(key);
      }
    }
  }

  private async generateResponse(
    intent: WorkflowIntent,
    context: ChatContext,
    originalMessage: string
  ): Promise<WorkflowChatResponse> {
    const responseId = ulid();
    const timestamp = new Date();
    
    if (intent.confidence < this.config.confidenceThreshold) {
      // Low confidence - ask clarifying questions
      const clarificationQuestions = this.getClarificationQuestions(intent);
      
      return {
        id: responseId,
        message: this.generateLowConfidenceMessage(intent, clarificationQuestions),
        clarificationQuestions,
        hasWorkflowRecommendations: false,
        intent,
        nextActions: ['clarify_intent'],
        timestamp
      };
    }
    
    // High confidence - generate suggestions
    const suggestions = await this.generateSuggestions(intent);
    
    if (suggestions.length === 0) {
      return {
        id: responseId,
        message: this.generateNoSuggestionsMessage(intent),
        hasWorkflowRecommendations: false,
        intent,
        nextActions: ['refine_search', 'custom_workflow'],
        timestamp
      };
    }
    
    return {
      id: responseId,
      message: this.generateSuggestionsMessage(intent, suggestions),
      suggestions,
      hasWorkflowRecommendations: true,
      intent,
      nextActions: ['select_workflow', 'refine_requirements'],
      timestamp
    };
  }

  private generateLowConfidenceMessage(
    intent: WorkflowIntent,
    questions: string[]
  ): string {
    const baseMessage = "I'd like to help you find the perfect workflow! ";
    
    if (questions.length === 0) {
      return baseMessage + "Could you provide more details about what you want to automate?";
    }
    
    if (questions.length === 1) {
      return baseMessage + questions[0];
    }
    
    return baseMessage + "I have a few questions to help narrow down the options:\n\n" +
           questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
  }

  private generateNoSuggestionsMessage(intent: WorkflowIntent): string {
    const adaptedIntent = adaptWorkflowIntent(intent);
    return `I understand you want to ${adaptedIntent.primaryAction}${adaptedIntent.sourceSystem ? ` from ${adaptedIntent.sourceSystem}` : ''}${adaptedIntent.targetSystem ? ` to ${adaptedIntent.targetSystem}` : ''}, but I couldn't find any pre-built workflows that match exactly.\n\n` +
           `Would you like me to:\n` +
           `• Help you build a custom workflow\n` +
           `• Search for similar automations that you could modify\n` +
           `• Provide general guidance for this type of automation`;
  }

  private generateSuggestionsMessage(
    intent: WorkflowIntent,
    suggestions: WorkflowSuggestion[]
  ): string {
    const adaptedIntent = adaptWorkflowIntent(intent);
    const action = adaptedIntent.primaryAction === 'other' ? 'automate this' : adaptedIntent.primaryAction;
    let message = `Great! I found ${suggestions.length} workflow${suggestions.length === 1 ? '' : 's'} that can help you ${action}:\n\n`;
    
    suggestions.forEach((suggestion, index) => {
      message += `**${index + 1}. ${suggestion.title}** (${suggestion.complexity} setup, ~${suggestion.setupTime})\n`;
      message += `${suggestion.explanation}\n`;
      if (suggestion.requirements.length > 0) {
        message += `*Requirements: ${suggestion.requirements.join(', ')}*\n`;
      }
      message += '\n';
    });
    
    message += `Would you like me to help you set up any of these workflows?`;
    
    return message;
  }

  private buildSearchQuery(intent: WorkflowIntent): string {
    const adaptedIntent = adaptWorkflowIntent(intent);
    const parts: string[] = [];
    
    if (adaptedIntent.sourceSystem) parts.push(adaptedIntent.sourceSystem);
    if (adaptedIntent.targetSystem) parts.push(adaptedIntent.targetSystem);
    if (adaptedIntent.primaryAction !== 'other') parts.push(adaptedIntent.primaryAction);
    
    // Add compatible integrations as additional search terms
    if (adaptedIntent.compatibleIntegrations && adaptedIntent.compatibleIntegrations.length > 0) {
      parts.push(...adaptedIntent.compatibleIntegrations.slice(0, 3)); // Top 3 compatible integrations
    }
    
    return parts.join(' ');
  }

  private scoreWorkflow(workflow: any, intent: WorkflowIntent): WorkflowSuggestion {
    const adaptedIntent = adaptWorkflowIntent(intent);
    let score = 0;
    
    // Base score from search relevance
    score += (workflow.relevanceScore || 0) * 0.3;
    
    // Tool matching
    if (adaptedIntent.sourceSystem && this.workflowIncludesTool(workflow, adaptedIntent.sourceSystem)) {
      score += 0.25;
    }
    if (adaptedIntent.targetSystem && this.workflowIncludesTool(workflow, adaptedIntent.targetSystem)) {
      score += 0.25;
    }
    
    // Action matching
    if (this.workflowMatchesAction(workflow, adaptedIntent.primaryAction)) {
      score += 0.2;
    }
    
    // Complexity preference (favor simpler workflows for beginners)
    const complexityScore = workflow.complexity === 'simple' ? 0.1 : 
                           workflow.complexity === 'medium' ? 0.05 : 0;
    score += complexityScore;
    
    // Popularity boost
    if (workflow.usageCount > 100) score += 0.05;
    
    const explanation = this.generateWorkflowExplanation(workflow, intent);
    
    return {
      workflowId: workflow.id,
      title: workflow.title,
      description: workflow.description,
      category: workflow.category,
      complexity: workflow.complexity || 'medium',
      score: Math.min(score, 1), // Cap at 1.0
      explanation,
      setupTime: this.estimateSetupTime(workflow),
      requirements: this.extractRequirements(workflow),
      tags: workflow.tags || []
    };
  }

  private workflowIncludesTool(workflow: any, toolName: string): boolean {
    const normalizedTool = toolName.toLowerCase();
    const workflowText = `${workflow.title} ${workflow.description} ${(workflow.tags || []).join(' ')}`.toLowerCase();
    return workflowText.includes(normalizedTool);
  }

  private workflowMatchesAction(workflow: any, action: string): boolean {
    if (action === 'other') return false;
    
    const actionKeywords: Record<string, string[]> = {
      sync: ['sync', 'synchronize', 'mirror', 'replicate'],
      notify: ['notify', 'alert', 'message', 'email', 'send'],
      backup: ['backup', 'archive', 'save', 'store'],
      monitor: ['monitor', 'watch', 'track', 'observe'],
      transform: ['transform', 'convert', 'process', 'format']
    };
    
    const keywords = actionKeywords[action] || [action];
    const workflowText = `${workflow.title} ${workflow.description}`.toLowerCase();
    
    return keywords.some(keyword => workflowText.includes(keyword));
  }

  private generateWorkflowExplanation(workflow: any, intent: WorkflowIntent): string {
    const adaptedIntent = adaptWorkflowIntent(intent);
    const parts: string[] = [];
    
    if (adaptedIntent.sourceSystem && this.workflowIncludesTool(workflow, adaptedIntent.sourceSystem)) {
      parts.push(`integrates with ${adaptedIntent.sourceSystem}`);
    }
    
    if (adaptedIntent.targetSystem && this.workflowIncludesTool(workflow, adaptedIntent.targetSystem)) {
      parts.push(`connects to ${adaptedIntent.targetSystem}`);
    }
    
    if (this.workflowMatchesAction(workflow, adaptedIntent.primaryAction)) {
      parts.push(`handles ${adaptedIntent.primaryAction} operations`);
    }
    
    if (parts.length === 0) {
      return `This workflow might work for your ${adaptedIntent.primaryAction} needs.`;
    }
    
    return `Perfect match - ${parts.join(', ')}.`;
  }

  private estimateSetupTime(workflow: any): string {
    const complexity = workflow.complexity || 'medium';
    const nodeCount = workflow.nodeCount || 5;
    
    if (complexity === 'simple' || nodeCount <= 3) return '10 minutes';
    if (complexity === 'medium' || nodeCount <= 8) return '30 minutes';
    return '1 hour';
  }

  private extractRequirements(workflow: any): string[] {
    const requirements: string[] = [];
    
    // Extract from workflow metadata
    if (workflow.requirements) {
      requirements.push(...workflow.requirements);
    }
    
    // Infer from description and tags
    const text = `${workflow.title} ${workflow.description} ${(workflow.tags || []).join(' ')}`.toLowerCase();
    
    if (text.includes('api key') || text.includes('authentication')) {
      requirements.push('API credentials');
    }
    
    if (text.includes('webhook')) {
      requirements.push('Webhook setup');
    }
    
    if (text.includes('premium') || text.includes('paid')) {
      requirements.push('Premium account');
    }
    
    return [...new Set(requirements)]; // Remove duplicates
  }

  private mergeIntents(original: WorkflowIntent, refined: WorkflowIntent): WorkflowIntent {
    // For now, return the refined intent as the new structure doesn't support legacy merging
    // In a complete implementation, this would properly merge the WorkflowIntent structures
    return refined.confidence > original.confidence ? refined : original;
  }
} 