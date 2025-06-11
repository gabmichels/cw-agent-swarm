/**
 * LLM-Powered Message Generator
 * 
 * Generates contextual messages using agent's LLM with persona, background,
 * and full context. Leverages existing agent infrastructure for consistent
 * tone and communication style.
 */

import { ulid } from 'ulid';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MessageTrigger {
  readonly type: 'task_completion' | 'opportunity' | 'reflection' | 'scheduled' | 'follow_up' | 'error' | 'learning';
  readonly source: string; // taskId, opportunityId, etc.
  readonly priority: 'low' | 'medium' | 'high' | 'urgent';
  readonly context: Record<string, unknown>;
}

export interface MessageGenerationContext {
  // Agent context
  readonly agentPersona?: {
    readonly name: string;
    readonly description: string;
    readonly background: string;
    readonly personality: string;
    readonly communicationStyle: string;
    readonly preferences: string;
  };
  readonly agentId: string;
  
  // Trigger context  
  readonly trigger: MessageTrigger;
  readonly taskResult?: TaskExecutionResult;
  readonly opportunity?: DetectedOpportunity;
  readonly reflection?: ReflectionResult;
  
  // User context
  readonly userId: string;
  readonly userPreferences?: MessagingPreferences;
  readonly recentConversation?: ReadonlyArray<RecentMessage>;
  readonly userTimezone?: string;
  readonly relationshipHistory?: string;
}

export interface TaskExecutionResult {
  readonly taskId: string;
  readonly agentId: string;
  readonly userId: string;
  readonly success: boolean;
  readonly result?: unknown;
  readonly error?: string;
  readonly duration: number;
  readonly completedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface DetectedOpportunity {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly confidence: number;
  readonly urgency: 'low' | 'medium' | 'high';
  readonly category: string;
  readonly detectedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface ReflectionResult {
  readonly id: string;
  readonly agentId: string;
  readonly insights: ReadonlyArray<string>;
  readonly patterns: ReadonlyArray<string>;
  readonly improvements: ReadonlyArray<string>;
  readonly significantInsights: boolean;
  readonly generatedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface MessagingPreferences {
  readonly enableTaskNotifications: boolean;
  readonly enableOpportunityAlerts: boolean;
  readonly enableReflectionInsights: boolean;
  readonly enableScheduledSummaries: boolean;
  readonly preferredTone: 'professional' | 'friendly' | 'casual';
  readonly maxMessagesPerHour: number;
  readonly quietHours?: { start: string; end: string; timezone: string };
}

export interface RecentMessage {
  readonly id: string;
  readonly content: string;
  readonly sender: 'user' | 'agent';
  readonly timestamp: Date;
  readonly messageType?: string;
}

export interface GeneratedMessage {
  readonly id: string;
  readonly content: string;
  readonly messageType: string;
  readonly priority: 'low' | 'medium' | 'high' | 'urgent';
  readonly requiresResponse: boolean;
  readonly generatedAt: Date;
  readonly metadata: Record<string, unknown>;
}

// ============================================================================
// Message Generation Error Types
// ============================================================================

export class MessageGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'MessageGenerationError';
  }
}

// ============================================================================
// LLM Interface for Message Generation
// ============================================================================

export interface AgentLLMService {
  generateResponse(
    systemPrompt: string,
    userMessage: string,
    context?: Record<string, unknown>
  ): Promise<string>;
}

// ============================================================================
// Message Generator Interface
// ============================================================================

export interface MessageGenerator {
  generateTaskCompletionMessage(context: MessageGenerationContext): Promise<GeneratedMessage>;
  generateOpportunityMessage(context: MessageGenerationContext): Promise<GeneratedMessage>;
  generateReflectionMessage(context: MessageGenerationContext): Promise<GeneratedMessage>;
  generateScheduledMessage(context: MessageGenerationContext, messageType: string): Promise<GeneratedMessage>;
  generateFollowUpMessage(context: MessageGenerationContext): Promise<GeneratedMessage>;
}

// ============================================================================
// Default LLM-Powered Message Generator
// ============================================================================

export class LLMMessageGenerator implements MessageGenerator {
  private readonly llmService: AgentLLMService;

  constructor(llmService: AgentLLMService) {
    this.llmService = llmService;
  }

  /**
   * Generate task completion message
   */
  async generateTaskCompletionMessage(context: MessageGenerationContext): Promise<GeneratedMessage> {
    try {
      const systemPrompt = this.buildTaskCompletionPrompt(context);
      const userMessage = this.buildTaskCompletionInput(context);
      
      const content = await this.llmService.generateResponse(systemPrompt, userMessage, {
        messageType: 'task_completion',
        agentId: context.agentId,
        userId: context.userId
      });

      return this.createGeneratedMessage(content, 'task_completion', context);
    } catch (error) {
      throw new MessageGenerationError(
        `Failed to generate task completion message: ${error instanceof Error ? error.message : String(error)}`,
        'TASK_COMPLETION_GENERATION_ERROR',
        { context: this.sanitizeContext(context), error: String(error) }
      );
    }
  }

  /**
   * Generate opportunity notification message
   */
  async generateOpportunityMessage(context: MessageGenerationContext): Promise<GeneratedMessage> {
    try {
      const systemPrompt = this.buildOpportunityPrompt(context);
      const userMessage = this.buildOpportunityInput(context);
      
      const content = await this.llmService.generateResponse(systemPrompt, userMessage, {
        messageType: 'opportunity',
        agentId: context.agentId,
        userId: context.userId
      });

      return this.createGeneratedMessage(content, 'opportunity', context);
    } catch (error) {
      throw new MessageGenerationError(
        `Failed to generate opportunity message: ${error instanceof Error ? error.message : String(error)}`,
        'OPPORTUNITY_GENERATION_ERROR',
        { context: this.sanitizeContext(context), error: String(error) }
      );
    }
  }

  /**
   * Generate reflection insight message
   */
  async generateReflectionMessage(context: MessageGenerationContext): Promise<GeneratedMessage> {
    try {
      const systemPrompt = this.buildReflectionPrompt(context);
      const userMessage = this.buildReflectionInput(context);
      
      const content = await this.llmService.generateResponse(systemPrompt, userMessage, {
        messageType: 'reflection',
        agentId: context.agentId,
        userId: context.userId
      });

      return this.createGeneratedMessage(content, 'reflection', context);
    } catch (error) {
      throw new MessageGenerationError(
        `Failed to generate reflection message: ${error instanceof Error ? error.message : String(error)}`,
        'REFLECTION_GENERATION_ERROR',
        { context: this.sanitizeContext(context), error: String(error) }
      );
    }
  }

  /**
   * Generate scheduled message (daily reflections, reminders, etc.)
   */
  async generateScheduledMessage(context: MessageGenerationContext, messageType: string): Promise<GeneratedMessage> {
    try {
      const systemPrompt = this.buildScheduledPrompt(context, messageType);
      const userMessage = this.buildScheduledInput(context, messageType);
      
      const content = await this.llmService.generateResponse(systemPrompt, userMessage, {
        messageType: 'scheduled',
        scheduledMessageType: messageType,
        agentId: context.agentId,
        userId: context.userId
      });

      return this.createGeneratedMessage(content, 'scheduled', context);
    } catch (error) {
      throw new MessageGenerationError(
        `Failed to generate scheduled message: ${error instanceof Error ? error.message : String(error)}`,
        'SCHEDULED_GENERATION_ERROR',
        { context: this.sanitizeContext(context), messageType, error: String(error) }
      );
    }
  }

  /**
   * Generate follow-up message
   */
  async generateFollowUpMessage(context: MessageGenerationContext): Promise<GeneratedMessage> {
    try {
      const systemPrompt = this.buildFollowUpPrompt(context);
      const userMessage = this.buildFollowUpInput(context);
      
      const content = await this.llmService.generateResponse(systemPrompt, userMessage, {
        messageType: 'follow_up',
        agentId: context.agentId,
        userId: context.userId
      });

      return this.createGeneratedMessage(content, 'follow_up', context);
    } catch (error) {
      throw new MessageGenerationError(
        `Failed to generate follow-up message: ${error instanceof Error ? error.message : String(error)}`,
        'FOLLOW_UP_GENERATION_ERROR',
        { context: this.sanitizeContext(context), error: String(error) }
      );
    }
  }

  // ============================================================================
  // Prompt Building Methods
  // ============================================================================

  private buildTaskCompletionPrompt(context: MessageGenerationContext): string {
    const persona = context.agentPersona;
    const prefs = context.userPreferences;

    return `You are ${persona?.name || 'an AI assistant'}.

PERSONA & COMMUNICATION:
${persona?.description ? `Description: ${persona.description}` : ''}
${persona?.background ? `Background: ${persona.background}` : ''}
${persona?.communicationStyle ? `Communication Style: ${persona.communicationStyle}` : 'Communicate clearly and helpfully'}
${persona?.personality ? `Personality: ${persona.personality}` : ''}

TASK: Generate a message to inform the user about a completed task.

REQUIREMENTS:
- Match your persona and communication style exactly
- Be concise but informative (2-3 sentences)
- Include key results or outcomes
- Suggest next steps if relevant
- Use ${prefs?.preferredTone || 'professional'} tone
- Use emojis sparingly and appropriately
- Don't mention technical details like task IDs
- Focus on user value and actionable insights

The user prefers ${prefs?.preferredTone || 'professional'} communication.`;
  }

  private buildTaskCompletionInput(context: MessageGenerationContext): string {
    const result = context.taskResult;
    if (!result) {
      throw new MessageGenerationError('Task result required for task completion message', 'MISSING_TASK_RESULT');
    }

    const recentContext = context.recentConversation 
      ? `\n\nRecent conversation context:\n${context.recentConversation.map(m => `${m.sender}: ${m.content}`).join('\n')}`
      : '';

    return `Task Details:
- Success: ${result.success}
- Duration: ${result.duration}ms
- Completed: ${result.completedAt.toLocaleString()}
${result.result ? `- Result: ${JSON.stringify(result.result)}` : ''}
${result.error ? `- Error: ${result.error}` : ''}
${result.metadata ? `- Additional Info: ${JSON.stringify(result.metadata)}` : ''}${recentContext}

Generate an appropriate message to inform the user about this task completion.`;
  }

  private buildOpportunityPrompt(context: MessageGenerationContext): string {
    const persona = context.agentPersona;
    const prefs = context.userPreferences;

    return `You are ${persona?.name || 'an AI assistant'}.

PERSONA & COMMUNICATION:
${persona?.description ? `Description: ${persona.description}` : ''}
${persona?.communicationStyle ? `Communication Style: ${persona.communicationStyle}` : 'Communicate clearly and helpfully'}

TASK: Notify the user about a detected opportunity.

REQUIREMENTS:
- Match your persona and communication style
- Be exciting but not pushy
- Explain why this is relevant to the user
- Include confidence level naturally
- Suggest specific next actions
- Use ${prefs?.preferredTone || 'professional'} tone
- Keep it concise (2-3 sentences)
- Include appropriate emoji (💡, 🎯, 📈, etc.)`;
  }

  private buildOpportunityInput(context: MessageGenerationContext): string {
    const opportunity = context.opportunity;
    if (!opportunity) {
      throw new MessageGenerationError('Opportunity required for opportunity message', 'MISSING_OPPORTUNITY');
    }

    return `Opportunity Details:
- Title: ${opportunity.title}
- Description: ${opportunity.description}
- Confidence: ${Math.round(opportunity.confidence * 100)}%
- Urgency: ${opportunity.urgency}
- Category: ${opportunity.category}
- Detected: ${opportunity.detectedAt.toLocaleString()}

Generate an engaging message to notify the user about this opportunity.`;
  }

  private buildReflectionPrompt(context: MessageGenerationContext): string {
    const persona = context.agentPersona;
    
    return `You are ${persona?.name || 'an AI assistant'}.

PERSONA & COMMUNICATION:
${persona?.description ? `Description: ${persona.description}` : ''}
${persona?.communicationStyle ? `Communication Style: ${persona.communicationStyle}` : 'Communicate thoughtfully and insightfully'}

TASK: Share a reflection or insight with the user.

REQUIREMENTS:
- Be thoughtful and introspective
- Share genuine insights that provide value
- Connect patterns to actionable improvements
- Use 🧠, 💭, 🔄, 📈 emojis appropriately
- Keep it personal and relevant
- Suggest how to apply the insight
- Be encouraging and growth-focused`;
  }

  private buildReflectionInput(context: MessageGenerationContext): string {
    const reflection = context.reflection;
    if (!reflection) {
      throw new MessageGenerationError('Reflection required for reflection message', 'MISSING_REFLECTION');
    }

    return `Reflection Details:
- Insights: ${reflection.insights.join(', ')}
- Patterns: ${reflection.patterns.join(', ')}
- Improvements: ${reflection.improvements.join(', ')}
- Significant: ${reflection.significantInsights}
- Generated: ${reflection.generatedAt.toLocaleString()}

Generate a thoughtful message sharing these insights with the user.`;
  }

  private buildScheduledPrompt(context: MessageGenerationContext, messageType: string): string {
    const persona = context.agentPersona;
    
    return `You are ${persona?.name || 'an AI assistant'}.

PERSONA & COMMUNICATION:
${persona?.description ? `Description: ${persona.description}` : ''}
${persona?.communicationStyle ? `Communication Style: ${persona.communicationStyle}` : 'Communicate warmly and encouragingly'}

TASK: Generate a ${messageType} message.

REQUIREMENTS FOR ${messageType.toUpperCase()}:
${this.getScheduledMessageRequirements(messageType)}
- Match your persona and communication style
- Be encouraging and supportive
- Include relevant questions or prompts
- Use appropriate emojis
- Keep it engaging but not overwhelming`;
  }

  private buildScheduledInput(context: MessageGenerationContext, messageType: string): string {
    const currentTime = new Date().toLocaleString();
    const timezone = context.userTimezone || 'local time';
    
    return `Message Type: ${messageType}
Current Time: ${currentTime} (${timezone})
User ID: ${context.userId}

Generate an appropriate ${messageType} message for this time and user.`;
  }

  private buildFollowUpPrompt(context: MessageGenerationContext): string {
    const persona = context.agentPersona;
    
    return `You are ${persona?.name || 'an AI assistant'}.

PERSONA & COMMUNICATION:
${persona?.description ? `Description: ${persona.description}` : ''}
${persona?.communicationStyle ? `Communication Style: ${persona.communicationStyle}` : 'Communicate helpfully and respectfully'}

TASK: Generate a follow-up message or question.

REQUIREMENTS:
- Be helpful and relevant
- Ask specific, actionable questions
- Reference previous context naturally
- Be respectful of the user's time
- Use ❓, 🤔, ✋ emojis appropriately
- Provide options or suggestions`;
  }

  private buildFollowUpInput(context: MessageGenerationContext): string {
    const recentContext = context.recentConversation 
      ? context.recentConversation.map(m => `${m.sender}: ${m.content}`).join('\n')
      : 'No recent conversation';

    return `Follow-up Context:
${recentContext}

Trigger: ${context.trigger.type} (${context.trigger.source})
Priority: ${context.trigger.priority}

Generate an appropriate follow-up message or question.`;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getScheduledMessageRequirements(messageType: string): string {
    switch (messageType) {
      case 'daily_reflection':
        return `- Ask 2-3 thoughtful questions about the day
- Focus on achievements, challenges, and learnings
- Encourage honest self-reflection`;
      
      case 'weekly_summary':
        return `- Summarize the week's key activities
- Highlight major accomplishments
- Identify areas for improvement`;
      
      case 'goal_review':
        return `- Check progress on current goals
- Ask about obstacles and breakthroughs
- Encourage continued effort`;
      
      case 'break_reminder':
        return `- Gently remind to take a break
- Suggest specific break activities
- Emphasize well-being`;
      
      default:
        return `- Be relevant to the ${messageType} purpose
- Provide value to the user
- Encourage engagement`;
    }
  }

  private createGeneratedMessage(
    content: string,
    messageType: string,
    context: MessageGenerationContext
  ): GeneratedMessage {
    return {
      id: ulid(),
      content: content.trim(),
      messageType,
      priority: context.trigger.priority,
      requiresResponse: this.shouldRequireResponse(messageType, context),
      generatedAt: new Date(),
      metadata: {
        agentId: context.agentId,
        userId: context.userId,
        trigger: context.trigger,
        generationMethod: 'llm',
        hasPersona: !!context.agentPersona
      }
    };
  }

  private shouldRequireResponse(messageType: string, context: MessageGenerationContext): boolean {
    // Scheduled messages typically expect responses (reflections, check-ins)
    if (messageType === 'scheduled') return true;
    
    // Follow-ups expect responses by definition
    if (messageType === 'follow_up') return true;
    
    // High priority opportunities might want confirmation
    if (messageType === 'opportunity' && context.trigger.priority === 'high') return true;
    
    // Default to not requiring response
    return false;
  }

  private sanitizeContext(context: MessageGenerationContext): Record<string, unknown> {
    return {
      agentId: context.agentId,
      userId: context.userId.substring(0, 8) + '...',
      triggerType: context.trigger.type,
      triggerPriority: context.trigger.priority,
      hasPersona: !!context.agentPersona,
      hasUserPreferences: !!context.userPreferences,
      hasRecentConversation: !!(context.recentConversation?.length),
      hasTaskResult: !!context.taskResult,
      hasOpportunity: !!context.opportunity,
      hasReflection: !!context.reflection
    };
  }
}

// ============================================================================
// Mock LLM Service for Development/Testing
// ============================================================================

export class MockAgentLLMService implements AgentLLMService {
  async generateResponse(
    systemPrompt: string,
    userMessage: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    // Simple mock implementation - replace with actual LLM service
    const messageType = context?.messageType || 'general';
    
    switch (messageType) {
      case 'task_completion':
        return "✅ Task completed successfully! I've processed your request and the results look good. Would you like me to proceed with the next steps?";
      
      case 'opportunity':
        return "💡 I've detected an interesting opportunity that matches your interests. This could be worth exploring further - should I gather more details?";
      
      case 'reflection':
        return "🧠 I've been reflecting on our recent work together and noticed some interesting patterns in your productivity. Your focus seems strongest in the morning hours.";
      
      case 'scheduled':
        return "📝 Time for your daily reflection! How did today go? What was your biggest accomplishment, and what would you do differently tomorrow?";
      
      case 'follow_up':
        return "❓ I wanted to follow up on our earlier conversation. Do you need any additional information or assistance with what we discussed?";
      
      default:
        return "I wanted to update you on something that might interest you. Let me know if you'd like more details!";
    }
  }
} 