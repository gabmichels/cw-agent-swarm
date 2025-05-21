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
import { logger } from '../../../../lib/logging';

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
    const startTime = Date.now();
    let summaryNodeId: string | undefined;
    const visualization = options.visualization;
    const visualizer = options.visualizer;
    
    try {
      // Merge provided options with defaults
      const mergedOptions = {
        ...this.defaultOptions,
        ...options,
      };
      
      this.logger.debug('Summarizing conversation', mergedOptions);
      
      // Create visualization node if visualization is enabled
      if (visualization && visualizer) {
        try {
          // Create a summarization visualization node
          summaryNodeId = visualizer.addNode(
            visualization,
            'summarization',
            'Conversation Summarization',
            {
              detailLevel: mergedOptions.detailLevel,
              timestamp: startTime,
              targetLength: mergedOptions.maxLength,
              extractTopics: mergedOptions.extractTopics,
              includeActionItems: mergedOptions.includeActionItems,
              conversationId: mergedOptions.conversationId
            },
            'in_progress'
          );
          
          // Connect to parent node if specified
          if (mergedOptions.parentNodeId && summaryNodeId) {
            visualizer.addEdge(
              visualization,
              mergedOptions.parentNodeId,
              summaryNodeId,
              'child',
              'summarizes'
            );
          }
        } catch (visualizationError) {
          this.logger.error('Error creating summarization visualization node:', visualizationError);
        }
      }
      
      // Get conversation messages - in a real implementation, this would
      // come from a data source like a memory store or conversation repository
      const messages = await this.getConversationMessages(mergedOptions);
      
      // If no messages found, return minimal result
      if (!messages || messages.length === 0) {
        const errorMessage = "No conversation messages found to summarize.";
        
        // Update visualization with error
        if (visualization && visualizer && summaryNodeId) {
          try {
            visualizer.updateNode(
              visualization,
              summaryNodeId,
              {
                status: 'error',
                data: {
                  error: errorMessage,
                  errorCode: 'EMPTY_CONVERSATION',
                  executionCompleted: Date.now(),
                  durationMs: Date.now() - startTime
                }
              }
            );
          } catch (visualizationError) {
            this.logger.error('Error updating summarization visualization with error:', visualizationError);
          }
        }
        
        return {
          summary: errorMessage,
          success: true,
          stats: {
            messageCount: 0,
            userMessageCount: 0,
            agentMessageCount: 0,
            systemMessageCount: 0,
          },
          conversationId: mergedOptions.conversationId,
          visualizationNodeId: summaryNodeId
        };
      }
      
      // Update visualization with message count
      if (visualization && visualizer && summaryNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            summaryNodeId,
            {
              data: {
                messageCount: messages.length,
                processingStarted: Date.now(),
                method: this.modelProvider ? 'model-based' : 'simple'
              }
            }
          );
        } catch (visualizationError) {
          this.logger.error('Error updating summarization visualization with details:', visualizationError);
        }
      }
      
      // Count message types for statistics
      const stats = this.calculateMessageStats(messages);
      
      // Simple summarization if no model provider available
      if (!this.modelProvider) {
        const result = this.generateSimpleSummary(messages, stats, mergedOptions);
        
        // Update visualization with result
        if (visualization && visualizer && summaryNodeId) {
          try {
            visualizer.updateNode(
              visualization,
              summaryNodeId,
              {
                status: 'completed',
                data: {
                  summaryLength: result.summary.length,
                  topics: result.topics,
                  executionCompleted: Date.now(),
                  durationMs: Date.now() - startTime,
                  success: true
                }
              }
            );
          } catch (visualizationError) {
            this.logger.error('Error updating summarization visualization with result:', visualizationError);
          }
        }
        
        return {
          ...result,
          visualizationNodeId: summaryNodeId
        };
      }
      
      // Use model provider for enhanced summarization
      const summary = await this.generateModelBasedSummary(messages, mergedOptions);
      
      // Extract topics if requested
      let topics: string[] | undefined;
      if (mergedOptions.extractTopics) {
        topics = await this.extractTopicsFromMessages(messages, {
          ...mergedOptions,
          visualization,
          visualizer,
          parentNodeId: summaryNodeId
        });
      }
      
      // Extract action items if requested
      let actionItems: string[] | undefined;
      if (mergedOptions.includeActionItems) {
        actionItems = await this.extractActionItemsFromMessages(messages, {
          ...mergedOptions,
          visualization,
          visualizer,
          parentNodeId: summaryNodeId
        });
      }
      
      // Update visualization with final result
      if (visualization && visualizer && summaryNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            summaryNodeId,
            {
              status: 'completed',
              data: {
                summaryLength: summary.length,
                topicCount: topics?.length || 0,
                actionItemCount: actionItems?.length || 0,
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime,
                success: true
              }
            }
          );
        } catch (visualizationError) {
          this.logger.error('Error updating final summarization visualization:', visualizationError);
        }
      }
      
      return {
        summary,
        success: true,
        stats,
        topics,
        actionItems,
        conversationId: mergedOptions.conversationId,
        visualizationNodeId: summaryNodeId
      };
    } catch (error) {
      this.logger.error('Error summarizing conversation:', error);
      
      // Update visualization with error
      if (visualization && visualizer && summaryNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            summaryNodeId,
            {
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : String(error),
                errorCode: 'SUMMARIZATION_ERROR',
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          this.logger.error('Error updating summarization visualization with error:', visualizationError);
        }
      }
      
      return {
        summary: "Error generating conversation summary.",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        conversationId: options.conversationId,
        visualizationNodeId: summaryNodeId
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
    const startTime = Date.now();
    let topicsNodeId: string | undefined;
    const visualization = options.visualization;
    const visualizer = options.visualizer;
    
    try {
      // Create visualization node if visualization is enabled
      if (visualization && visualizer) {
        try {
          // Create a topic extraction visualization node
          topicsNodeId = visualizer.addNode(
            visualization,
            'topic_extraction',
            'Topic Extraction',
            {
              messageCount: messages.length,
              timestamp: startTime,
              maxTopics: options.maxTopics || 5,
              minConfidence: options.minConfidence || 0.5
            },
            'in_progress'
          );
          
          // Connect to parent node if specified
          if (options.parentNodeId && topicsNodeId) {
            visualizer.addEdge(
              visualization,
              options.parentNodeId,
              topicsNodeId,
              'child',
              'extracts_topics'
            );
          }
        } catch (visualizationError) {
          this.logger.error('Error creating topic extraction visualization node:', visualizationError);
        }
      }
      
      // Update visualization with processing info
      if (visualization && visualizer && topicsNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            topicsNodeId,
            {
              data: {
                processingStarted: Date.now(),
                method: this.modelProvider ? 'model-based' : 'rule-based'
              }
            }
          );
        } catch (visualizationError) {
          this.logger.error('Error updating topic extraction visualization with details:', visualizationError);
        }
      }
      
      let topics: string[] = [];
      
      // Use model provider if available
      if (this.modelProvider) {
        try {
          const conversationText = messages
            .filter(m => m.role !== 'system' || options.includeSystemMessages)
            .map(m => `${m.role}: ${m.content}`)
            .join('\n\n');
          
          const systemPrompt = `You are an expert at analyzing conversations and identifying key topics.
            Analyze the following conversation and extract the main topics discussed.
            Return only a JSON array of strings representing the topics.
            Limit to the ${options.maxTopics || 5} most important topics.`;
          
          const response = await this.modelProvider.invoke({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: conversationText }
            ]
          });
          
          try {
            // Try to parse as JSON array
            const content = response.content.trim();
            const parsedContent = content.startsWith('[') ? 
              JSON.parse(content) : 
              this.extractTopicsFromText(content);
            
            topics = Array.isArray(parsedContent) ? 
              parsedContent.slice(0, options.maxTopics || 5) : 
              this.extractTopicsWithoutModel(messages, options.maxTopics || 5);
          } catch (parseError) {
            // Fallback to extracting topics from response text
            topics = this.extractTopicsFromText(response.content);
          }
        } catch (modelError) {
          this.logger.warn('Error extracting topics with model, falling back to rule-based:', modelError);
          topics = this.extractTopicsWithoutModel(messages, options.maxTopics || 5);
        }
      } else {
        // Use rule-based extraction
        topics = this.extractTopicsWithoutModel(messages, options.maxTopics || 5);
      }
      
      // Update visualization with result
      if (visualization && visualizer && topicsNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            topicsNodeId,
            {
              status: 'completed',
              data: {
                topics,
                topicCount: topics.length,
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime,
                success: true
              }
            }
          );
          
          // Create nodes for each topic
          for (const topic of topics) {
            const topicNodeId = visualizer.addNode(
              visualization,
              'topic',
              `Topic: ${topic}`,
              {
                name: topic,
                timestamp: Date.now()
              },
              'completed'
            );
            
            // Connect extraction node to topic node
            visualizer.addEdge(
              visualization,
              topicsNodeId,
              topicNodeId,
              'produces',
              'extracted'
            );
          }
        } catch (visualizationError) {
          this.logger.error('Error updating topic extraction visualization:', visualizationError);
        }
      }
      
      return topics;
    } catch (error) {
      this.logger.error('Error extracting topics from messages:', error);
      
      // Update visualization with error
      if (visualization && visualizer && topicsNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            topicsNodeId,
            {
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : String(error),
                errorCode: 'TOPIC_EXTRACTION_ERROR',
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          this.logger.error('Error updating topic extraction visualization with error:', visualizationError);
        }
      }
      
      return [];
    }
  }
  
  /**
   * Extract topics from text
   */
  private extractTopicsFromText(text: string): string[] {
    // Simple extraction of topic-like strings from text
    const lines = text.split('\n');
    const topics: string[] = [];
    
    for (const line of lines) {
      // Try to extract topics from bullet points, numbered lists, or JSON-like formats
      const match = line.match(/[•\-*\d+\.]\s*["']?([^"']+)["']?/) || 
                    line.match(/["']([^"']+)["']/);
      
      if (match && match[1]) {
        const topic = match[1].trim();
        if (topic && !topics.includes(topic)) {
          topics.push(topic);
        }
      }
    }
    
    return topics;
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
    const startTime = Date.now();
    let actionItemsNodeId: string | undefined;
    const visualization = options.visualization;
    const visualizer = options.visualizer;
    
    try {
      // Create visualization node if visualization is enabled
      if (visualization && visualizer) {
        try {
          // Create an action item extraction visualization node
          actionItemsNodeId = visualizer.addNode(
            visualization,
            'action_item_extraction',
            'Action Item Extraction',
            {
              messageCount: messages.length,
              timestamp: startTime,
              maxItems: options.maxItems || 5,
              minConfidence: options.minConfidence || 0.5
            },
            'in_progress'
          );
          
          // Connect to parent node if specified
          if (options.parentNodeId && actionItemsNodeId) {
            visualizer.addEdge(
              visualization,
              options.parentNodeId,
              actionItemsNodeId,
              'child',
              'extracts_action_items'
            );
          }
        } catch (visualizationError) {
          this.logger.error('Error creating action item extraction visualization node:', visualizationError);
        }
      }
      
      // Update visualization with processing info
      if (visualization && visualizer && actionItemsNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            actionItemsNodeId,
            {
              data: {
                processingStarted: Date.now(),
                method: this.modelProvider ? 'model-based' : 'rule-based'
              }
            }
          );
        } catch (visualizationError) {
          this.logger.error('Error updating action item extraction visualization with details:', visualizationError);
        }
      }
      
      let actionItems: string[] = [];
      
      if (this.modelProvider) {
        try {
          const conversationText = messages
            .filter(m => m.role !== 'system' || options.includeSystemMessages)
            .map(m => `${m.role}: ${m.content}`)
            .join('\n\n');
          
          const systemPrompt = `You are an expert at analyzing conversations and identifying action items.
            Review the conversation and identify concrete action items, tasks, or to-dos mentioned.
            Return only a JSON array of strings representing the action items.
            Limit to the ${options.maxItems || 5} most important action items.
            Each action item should be clear and actionable.`;
          
          const response = await this.modelProvider.invoke({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: conversationText }
            ]
          });
          
          try {
            // Try to parse as JSON array
            const content = response.content.trim();
            const parsedContent = content.startsWith('[') ? 
              JSON.parse(content) : 
              this.extractActionItemsFromText(content);
            
            actionItems = Array.isArray(parsedContent) ? 
              parsedContent.slice(0, options.maxItems || 5) : 
              this.extractActionItemsWithRules(messages, options.maxItems || 5);
          } catch (parseError) {
            // Fallback to extracting action items from response text
            actionItems = this.extractActionItemsFromText(response.content);
          }
        } catch (modelError) {
          this.logger.warn('Error extracting action items with model, falling back to rule-based:', modelError);
          actionItems = this.extractActionItemsWithRules(messages, options.maxItems || 5);
        }
      } else {
        // Use rule-based extraction if no model available
        actionItems = this.extractActionItemsWithRules(messages, options.maxItems || 5);
      }
      
      // Update visualization with result
      if (visualization && visualizer && actionItemsNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            actionItemsNodeId,
            {
              status: 'completed',
              data: {
                actionItems,
                itemCount: actionItems.length,
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime,
                success: true
              }
            }
          );
          
          // Create nodes for each action item
          for (const item of actionItems) {
            const itemNodeId = visualizer.addNode(
              visualization,
              'action_item',
              `Action Item: ${item.substring(0, 30)}${item.length > 30 ? '...' : ''}`,
              {
                description: item,
                timestamp: Date.now()
              },
              'completed'
            );
            
            // Connect extraction node to action item node
            visualizer.addEdge(
              visualization,
              actionItemsNodeId,
              itemNodeId,
              'produces',
              'extracted'
            );
          }
        } catch (visualizationError) {
          this.logger.error('Error updating action item extraction visualization:', visualizationError);
        }
      }
      
      return actionItems;
    } catch (error) {
      this.logger.error('Error extracting action items from messages:', error);
      
      // Update visualization with error
      if (visualization && visualizer && actionItemsNodeId) {
        try {
          visualizer.updateNode(
            visualization,
            actionItemsNodeId,
            {
              status: 'error',
              data: {
                error: error instanceof Error ? error.message : String(error),
                errorCode: 'ACTION_ITEM_EXTRACTION_ERROR',
                executionCompleted: Date.now(),
                durationMs: Date.now() - startTime
              }
            }
          );
        } catch (visualizationError) {
          this.logger.error('Error updating action item extraction visualization with error:', visualizationError);
        }
      }
      
      return [];
    }
  }
  
  /**
   * Extract action items from text
   */
  private extractActionItemsFromText(text: string): string[] {
    // Simple extraction of action item-like strings from text
    const lines = text.split('\n');
    const actionItems: string[] = [];
    
    for (const line of lines) {
      // Try to extract action items from bullet points, numbered lists, or JSON-like formats
      const match = line.match(/[•\-*\d+\.]\s*(.+)/) || 
                    line.match(/["']([^"']+)["']/);
      
      if (match && match[1]) {
        const item = match[1].trim();
        if (item && !actionItems.includes(item)) {
          actionItems.push(item);
        }
      }
    }
    
    return actionItems;
  }
  
  /**
   * Extract action items using rules
   */
  private extractActionItemsWithRules(messages: any[], maxItems: number = 5): string[] {
    const actionItems: string[] = [];
    const actionKeywords = [
      'todo', 'to-do', 'to do', 'action item', 'task',
      'need to', 'should', 'must', 'remember to', 'don\'t forget',
      'follow up', 'follow-up', 'get back to'
    ];
    
    for (const message of messages) {
      const content = message.content.toLowerCase();
      const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
      
      for (const sentence of sentences) {
        if (actionItems.length >= maxItems) break;
        
        // Check if sentence contains action keywords and is imperative/instructive
        const hasActionKeyword = actionKeywords.some(keyword => sentence.includes(keyword));
        
        if (hasActionKeyword || sentence.match(/^[a-z]+\s.+/)) {
          const cleanedItem = sentence.trim()
            .replace(/^(todo|to-do|to do|action item|task)[\s:]+/i, '')
            .replace(/^(i|we)\s+(need|should|must|have\sto)\s+/i, '')
            .replace(/^(remember\sto|don't\sforget\sto)\s+/i, '')
            .replace(/^(let's|let\sus)\s+/i, '');
          
          // Capitalize first letter for consistency
          const formattedItem = cleanedItem.charAt(0).toUpperCase() + cleanedItem.slice(1);
          
          if (formattedItem.length > 5 && !actionItems.includes(formattedItem)) {
            actionItems.push(formattedItem);
          }
        }
      }
    }
    
    return actionItems;
  }
} 