/**
 * Default Conversation Summarizer Implementation
 * 
 * This file implements the default conversation summarization capability
 * that can be used by memory managers.
 */

import { 
  ConversationSummarizer, 
  ConversationSummaryOptions, 
  ConversationSummaryResult 
} from '../interfaces/ConversationSummarization.interface';

/**
 * Default implementation of the ConversationSummarizer interface
 */
export class DefaultConversationSummarizer implements ConversationSummarizer {
  // Dependencies and configuration
  private modelProvider: any; // This would be a model provider interface
  private defaultOptions: Partial<ConversationSummaryOptions>;
  private logger: any; // Optional logger
  
  /**
   * Create a new DefaultConversationSummarizer
   * 
   * @param options - Configuration options
   */
  constructor(options: {
    modelProvider?: any;
    logger?: any;
    defaultOptions?: Partial<ConversationSummaryOptions>;
  } = {}) {
    this.modelProvider = options.modelProvider;
    this.logger = options.logger || console;
    this.defaultOptions = {
      maxEntries: 20,
      maxLength: 500,
      detailLevel: 'standard',
      extractTopics: true,
      includeActionItems: true,
      includeSystemMessages: false,
      ...options.defaultOptions,
    };
  }
  
  /**
   * Summarize a conversation
   * 
   * @param options - Summarization options
   */
  async summarizeConversation(
    options: ConversationSummaryOptions = {}
  ): Promise<ConversationSummaryResult> {
    try {
      // Merge provided options with defaults
      const mergedOptions = {
        ...this.defaultOptions,
        ...options,
      };
      
      this.logger.debug('Summarizing conversation', mergedOptions);
      
      // Get conversation messages - in a real implementation, this would
      // come from a data source like a memory store or conversation repository
      const messages = await this.getConversationMessages(mergedOptions);
      
      // If no messages found, return minimal result
      if (!messages || messages.length === 0) {
        return {
          summary: "No conversation messages found to summarize.",
          success: true,
          stats: {
            messageCount: 0,
            userMessageCount: 0,
            agentMessageCount: 0,
            systemMessageCount: 0,
          },
          conversationId: mergedOptions.conversationId,
        };
      }
      
      // Count message types for statistics
      const stats = this.calculateMessageStats(messages);
      
      // Simple summarization if no model provider available
      if (!this.modelProvider) {
        return this.generateSimpleSummary(messages, stats, mergedOptions);
      }
      
      // Use model provider for enhanced summarization
      const summary = await this.generateModelBasedSummary(messages, mergedOptions);
      
      // Extract topics if requested
      let topics: string[] | undefined;
      if (mergedOptions.extractTopics) {
        topics = await this.extractTopicsFromMessages(messages, mergedOptions);
      }
      
      // Extract action items if requested
      let actionItems: string[] | undefined;
      if (mergedOptions.includeActionItems) {
        actionItems = await this.extractActionItemsFromMessages(messages, mergedOptions);
      }
      
      return {
        summary,
        success: true,
        stats,
        topics,
        actionItems,
        conversationId: mergedOptions.conversationId,
      };
    } catch (error) {
      this.logger.error('Error summarizing conversation:', error);
      return {
        summary: "Error generating conversation summary.",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        conversationId: options.conversationId,
      };
    }
  }
  
  /**
   * Summarize multiple conversations
   * 
   * @param conversationIds - IDs of conversations to summarize
   * @param options - Summarization options
   */
  async summarizeMultipleConversations(
    conversationIds: string[],
    options: ConversationSummaryOptions = {}
  ): Promise<Record<string, ConversationSummaryResult>> {
    const results: Record<string, ConversationSummaryResult> = {};
    
    // Process each conversation ID in parallel
    await Promise.all(
      conversationIds.map(async (id) => {
        try {
          // Summarize each conversation with the conversation ID set
          const result = await this.summarizeConversation({
            ...options,
            conversationId: id,
          });
          
          results[id] = result;
        } catch (error) {
          // Handle any errors for individual conversations
          results[id] = {
            summary: `Error summarizing conversation ${id}`,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            conversationId: id,
          };
        }
      })
    );
    
    return results;
  }
  
  /**
   * Get conversation topics
   * 
   * @param conversationId - ID of conversation to analyze
   * @param options - Topic extraction options
   */
  async getConversationTopics(
    conversationId: string,
    options: { maxTopics?: number; minConfidence?: number } = {}
  ): Promise<string[]> {
    try {
      const messages = await this.getConversationMessages({ conversationId });
      
      return this.extractTopicsFromMessages(messages, {
        maxTopics: options.maxTopics,
        minConfidence: options.minConfidence,
      });
    } catch (error) {
      this.logger.error('Error extracting conversation topics:', error);
      return [];
    }
  }
  
  /**
   * Extract action items from conversation
   * 
   * @param conversationId - ID of conversation to analyze
   * @param options - Action item extraction options
   */
  async extractActionItems(
    conversationId: string,
    options: { maxItems?: number; minConfidence?: number } = {}
  ): Promise<string[]> {
    try {
      const messages = await this.getConversationMessages({ conversationId });
      
      return this.extractActionItemsFromMessages(messages, {
        maxItems: options.maxItems,
        minConfidence: options.minConfidence,
      });
    } catch (error) {
      this.logger.error('Error extracting action items:', error);
      return [];
    }
  }
  
  // Private helper methods
  
  /**
   * Get conversation messages from a data source
   */
  private async getConversationMessages(
    options: ConversationSummaryOptions
  ): Promise<any[]> {
    // In a real implementation, this would retrieve messages from a data source
    // For now, we'll return a placeholder array
    return [
      { role: 'system', content: 'Conversation start', timestamp: new Date() },
      { role: 'user', content: 'Hello assistant', timestamp: new Date() },
      { role: 'assistant', content: 'Hello! How can I help you today?', timestamp: new Date() },
      { role: 'user', content: 'I need to discuss our marketing strategy', timestamp: new Date() },
      { role: 'assistant', content: 'I would be happy to discuss marketing strategy. What aspects are you interested in?', timestamp: new Date() },
    ].slice(0, options.maxEntries || 20);
  }
  
  /**
   * Calculate message statistics
   */
  private calculateMessageStats(messages: any[]): ConversationSummaryResult['stats'] {
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    const agentMessageCount = messages.filter(m => m.role === 'assistant').length;
    const systemMessageCount = messages.filter(m => m.role === 'system').length;
    
    // Get earliest and latest timestamps if available
    const timestamps = messages
      .filter(m => m.timestamp)
      .map(m => new Date(m.timestamp).getTime());
    
    const timespan = timestamps.length > 0 ? {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps)),
    } : undefined;
    
    return {
      messageCount: messages.length,
      userMessageCount,
      agentMessageCount,
      systemMessageCount,
      timespan,
    };
  }
  
  /**
   * Generate a simple summary without using a model
   */
  private generateSimpleSummary(
    messages: any[],
    stats: ConversationSummaryResult['stats'],
    options: ConversationSummaryOptions
  ): ConversationSummaryResult {
    // Extract simple topic keywords
    const allText = messages.map(m => m.content).join(' ').toLowerCase();
    const possibleTopics = [
      'marketing', 'strategy', 'planning', 'analytics', 'goals',
      'results', 'metrics', 'performance', 'website', 'social media',
      'campaign', 'budget', 'schedule', 'team', 'content',
      'design', 'development', 'launch', 'review', 'feedback'
    ];
    
    const topics = possibleTopics
      .filter(topic => allText.includes(topic))
      .slice(0, 3);
    
    const topicsText = topics.length > 0
      ? `about ${topics.join(', ')}`
      : '';
    
    // Ensure stats is defined with default values if needed
    const messageCount = stats?.messageCount ?? messages.length;
    const userMessageCount = stats?.userMessageCount ?? 0;
    const agentMessageCount = stats?.agentMessageCount ?? 0;
    
    // Create a simple summary text
    const summary = `Conversation with ${messageCount} messages ` +
      `(${userMessageCount} from user, ${agentMessageCount} from assistant) ` +
      topicsText + '.';
    
    return {
      summary,
      success: true,
      stats: stats ?? {
        messageCount: messages.length,
        userMessageCount: 0,
        agentMessageCount: 0,
        systemMessageCount: 0
      },
      topics,
      conversationId: options.conversationId,
    };
  }
  
  /**
   * Generate a model-based summary
   */
  private async generateModelBasedSummary(
    messages: any[],
    options: ConversationSummaryOptions
  ): Promise<string> {
    if (!this.modelProvider) {
      throw new Error('Model provider required for model-based summarization');
    }
    
    // Format messages for the model
    const conversationText = messages
      .filter(m => m.role !== 'system' || options.includeSystemMessages)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');
    
    // Create the system prompt based on detail level
    const detailsPrompt = this.getDetailLevelPrompt(options.detailLevel || 'standard');
    
    const systemPrompt = `You are an expert conversation summarizer. 
    Analyze the following conversation and create a concise summary.
    
    ${detailsPrompt}
    
    Keep your summary under ${options.maxLength || 500} characters and focus only on the most important information.`;
    
    // Call the model provider
    try {
      const response = await this.modelProvider.invoke({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: conversationText }
        ]
      });
      
      return response.content || 'Summary could not be generated.';
    } catch (error) {
      this.logger.error('Error calling model for summary:', error);
      throw error;
    }
  }
  
  /**
   * Get prompt details based on requested detail level
   */
  private getDetailLevelPrompt(detailLevel: string): string {
    switch (detailLevel) {
      case 'brief':
        return 'Create a very short summary with just the main topic and 1-2 key points.';
      case 'detailed':
        return `Include:
        1. The main topics discussed in detail
        2. Key points made by each participant
        3. All decisions or conclusions reached
        4. Action items agreed upon
        5. Open questions or unresolved issues`;
      case 'standard':
      default:
        return `Include:
        1. The main topics discussed
        2. Key points or decisions made
        3. Any actions agreed upon`;
    }
  }
  
  /**
   * Extract topics from conversation messages
   */
  private async extractTopicsFromMessages(
    messages: any[],
    options: any
  ): Promise<string[]> {
    if (!this.modelProvider) {
      // Simple extraction without model
      const allText = messages.map(m => m.content).join(' ').toLowerCase();
      const possibleTopics = [
        'marketing', 'strategy', 'planning', 'analytics', 'goals',
        'results', 'metrics', 'performance', 'website', 'social media',
        'campaign', 'budget', 'schedule', 'team', 'content'
      ];
      
      return possibleTopics
        .filter(topic => allText.includes(topic))
        .slice(0, options.maxTopics || 5);
    }
    
    // Use model for topic extraction
    try {
      const conversationText = messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n\n');
      
      const systemPrompt = `Extract the main topics from this conversation. 
      Return only a JSON array of strings, with each string being a topic.
      Example: ["marketing", "social media", "content strategy"]
      
      Limit to ${options.maxTopics || 5} topics maximum.`;
      
      const response = await this.modelProvider.invoke({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: conversationText }
        ]
      });
      
      // Parse the response as JSON
      try {
        const content = response.content.trim();
        const cleanContent = content
          .replace(/^```json/, '')
          .replace(/^```/, '')
          .replace(/```$/, '')
          .trim();
          
        return JSON.parse(cleanContent);
      } catch (parseError) {
        this.logger.error('Error parsing topics JSON:', parseError);
        // Fallback to simple extraction
        return response.content
          .split(',')
          .map((topic: string) => topic.trim().replace(/["\[\]]/g, ''))
          .filter(Boolean)
          .slice(0, options.maxTopics || 5);
      }
    } catch (error) {
      this.logger.error('Error extracting topics with model:', error);
      // Fallback to simple extraction
      return this.extractTopicsWithoutModel(messages, options.maxTopics || 5);
    }
  }
  
  /**
   * Extract topics without using a model
   */
  private extractTopicsWithoutModel(messages: any[], maxTopics: number): string[] {
    const allText = messages.map(m => m.content).join(' ').toLowerCase();
    const possibleTopics = [
      'marketing', 'strategy', 'planning', 'analytics', 'goals',
      'results', 'metrics', 'performance', 'website', 'social media',
      'campaign', 'budget', 'schedule', 'team', 'content',
      'design', 'development', 'launch', 'review', 'feedback'
    ];
    
    return possibleTopics
      .filter(topic => allText.includes(topic))
      .slice(0, maxTopics);
  }
  
  /**
   * Extract action items from conversation messages
   */
  private async extractActionItemsFromMessages(
    messages: any[],
    options: any
  ): Promise<string[]> {
    if (!this.modelProvider) {
      // Simple extraction without model (very basic)
      const actionItemIndicators = [
        'need to', 'should', 'must', 'will', 'going to',
        'todo', 'to-do', 'action item', 'take action', 'follow up'
      ];
      
      const actionItems: string[] = [];
      
      // Look for sentences that might contain action items
      for (const message of messages) {
        if (message.role === 'assistant') {
          const sentences = message.content.split(/[.!?]+/).filter(Boolean);
          
          for (const sentence of sentences) {
            const lowercaseSentence = sentence.toLowerCase().trim();
            if (actionItemIndicators.some(indicator => lowercaseSentence.includes(indicator))) {
              actionItems.push(sentence.trim());
            }
          }
        }
      }
      
      return actionItems.slice(0, options.maxItems || 5);
    }
    
    // Use model for action item extraction
    try {
      const conversationText = messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n\n');
      
      const systemPrompt = `Extract action items from this conversation. 
      Return only a JSON array of strings, with each string being a clear action item.
      Example: ["Schedule meeting with marketing team", "Review campaign results", "Prepare report"]
      
      Limit to ${options.maxItems || 5} action items maximum.
      Only include clear tasks/actions that were discussed, not hypotheticals.`;
      
      const response = await this.modelProvider.invoke({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: conversationText }
        ]
      });
      
      // Parse the response as JSON
      try {
        const content = response.content.trim();
        const cleanContent = content
          .replace(/^```json/, '')
          .replace(/^```/, '')
          .replace(/```$/, '')
          .trim();
          
        return JSON.parse(cleanContent);
      } catch (parseError) {
        this.logger.error('Error parsing action items JSON:', parseError);
        // Fallback to simple extraction
        return response.content
          .split('\n')
          .map((item: string) => item.trim().replace(/^["\[\]-\s]+|["\[\]]+$/g, ''))
          .filter(Boolean)
          .slice(0, options.maxItems || 5);
      }
    } catch (error) {
      this.logger.error('Error extracting action items with model:', error);
      return [];
    }
  }
} 