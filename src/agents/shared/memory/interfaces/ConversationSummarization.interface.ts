/**
 * Conversation Summarization Interface
 * 
 * This file defines interfaces for conversation summarization capabilities
 * to be implemented by memory managers.
 */

/**
 * Options for conversation summarization
 */
export interface ConversationSummaryOptions {
  /** Maximum number of conversation entries to include in summarization */
  maxEntries?: number;
  
  /** Maximum length of the generated summary */
  maxLength?: number;
  
  /** Optional conversation ID or thread ID to summarize */
  conversationId?: string;
  
  /** Optional start timestamp to include conversations from */
  fromTimestamp?: Date;
  
  /** Optional end timestamp to include conversations until */
  toTimestamp?: Date;
  
  /** Optional metadata filter for specific conversation types */
  filters?: Record<string, unknown>;
  
  /** Whether to include system messages in the summarization */
  includeSystemMessages?: boolean;
  
  /** Summary detail level */
  detailLevel?: 'brief' | 'standard' | 'detailed';
  
  /** Whether to extract topics as keywords/tags */
  extractTopics?: boolean;
  
  /** Whether to include action items in summary */
  includeActionItems?: boolean;
  
  /** Visualization context for tracking the summarization process */
  visualization?: any;
  
  /** Visualization service for creating nodes and edges */
  visualizer?: any;
  
  /** Parent node ID to connect to in the visualization */
  parentNodeId?: string;
}

/**
 * Result of conversation summarization
 */
export interface ConversationSummaryResult {
  /** The generated summary text */
  summary: string;
  
  /** Success status of the summarization */
  success: boolean;
  
  /** Optional error message if summarization failed */
  error?: string;
  
  /** Statistics about the summarized conversation */
  stats?: {
    /** Total number of messages included in summarization */
    messageCount: number;
    
    /** How many user messages were included */
    userMessageCount: number;
    
    /** How many agent messages were included */
    agentMessageCount: number;
    
    /** How many system messages were included */
    systemMessageCount: number;
    
    /** Timespan of the conversation */
    timespan?: {
      start: Date;
      end: Date;
    };
  };
  
  /** Extracted topics from the conversation */
  topics?: string[];
  
  /** Extracted action items from the conversation */
  actionItems?: string[];
  
  /** ID of the conversation that was summarized */
  conversationId?: string;
  
  /** Visualization node ID if visualization was created */
  visualizationNodeId?: string;
}

/**
 * Conversation summarization capability interface
 */
export interface ConversationSummarizer {
  /**
   * Summarize a conversation
   * 
   * @param options Options for summarization
   * @returns Promise resolving to the summary result
   */
  summarizeConversation(options?: ConversationSummaryOptions): Promise<ConversationSummaryResult>;
  
  /**
   * Summarize multiple conversations
   * 
   * @param conversationIds IDs of conversations to summarize
   * @param options Options for summarization
   * @returns Promise resolving to summaries for each conversation
   */
  summarizeMultipleConversations(
    conversationIds: string[],
    options?: ConversationSummaryOptions
  ): Promise<Record<string, ConversationSummaryResult>>;
  
  /**
   * Get conversation topics
   * 
   * @param conversationId ID of conversation to analyze
   * @param options Options for topic extraction
   * @returns Promise resolving to extracted topics
   */
  getConversationTopics(
    conversationId: string,
    options?: { maxTopics?: number; minConfidence?: number; visualization?: any; visualizer?: any; parentNodeId?: string; }
  ): Promise<string[]>;
  
  /**
   * Extract action items from conversation
   * 
   * @param conversationId ID of conversation to analyze
   * @param options Options for action item extraction
   * @returns Promise resolving to extracted action items
   */
  extractActionItems(
    conversationId: string,
    options?: { maxItems?: number; minConfidence?: number; visualization?: any; visualizer?: any; parentNodeId?: string; }
  ): Promise<string[]>;
} 