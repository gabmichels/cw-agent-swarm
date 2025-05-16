import { KnowledgeGraphManager } from '../../agents/implementations/memory/KnowledgeGraphManager';
import { SemanticSearchService } from '../../knowledge/SemanticSearchService';
import { KnowledgeGapsService } from '../../knowledge/gaps/KnowledgeGapsService';
import { logger } from '../../logging';
import { Message } from '../../../types';
import { KnowledgeNodeType } from '../../agents/shared/memory/types';

/**
 * A processor that analyzes chat conversations for knowledge gaps
 * Implements Milestone 5.2: Knowledge Gaps Identification
 */
export class KnowledgeGapsProcessor {
  private knowledgeGraph: KnowledgeGraphManager;
  private searchService: SemanticSearchService;
  private gapsService: KnowledgeGapsService;
  private samplingProbability: number;
  private minMessagesRequired: number;

  constructor(options: {
    knowledgeGraph: KnowledgeGraphManager,
    searchService?: SemanticSearchService,
    dataDir?: string,
    samplingProbability?: number, // Probability from 0-1 of analyzing a conversation
    minMessagesRequired?: number // Minimum number of messages needed to analyze
  }) {
    this.knowledgeGraph = options.knowledgeGraph;
    this.searchService = options.searchService || new SemanticSearchService(this.knowledgeGraph);
    this.gapsService = new KnowledgeGapsService(this.knowledgeGraph, this.searchService, options.dataDir);
    
    // Initialize service
    this.gapsService.load().catch(err => {
      logger.error(`Failed to load knowledge gaps service: ${err}`);
    });
    
    // Set options with defaults
    this.samplingProbability = options.samplingProbability || 0.25; // Analyze 25% of conversations by default
    this.minMessagesRequired = options.minMessagesRequired || 5; // At least 5 messages in the conversation
  }
  
  /**
   * Process a conversation and check for knowledge gaps
   * This runs asynchronously and won't block the main conversation flow
   */
  public async processConversation(messages: Message[]): Promise<void> {
    try {
      // Don't process every conversation to save resources
      if (Math.random() > this.samplingProbability) {
        logger.debug('Skipping knowledge gaps analysis based on sampling probability');
        return;
      }
      
      // Skip if not enough messages
      if (messages.length < this.minMessagesRequired) {
        logger.debug(`Conversation too short for knowledge gaps analysis (${messages.length} < ${this.minMessagesRequired})`);
        return;
      }
      
      // Convert messages to a text format for analysis
      const conversation = this.formatConversationForAnalysis(messages);
      
      // Analyze for knowledge gaps
      logger.info('Analyzing conversation for knowledge gaps');
      const knowledgeGaps = await this.gapsService.analyzeConversation(conversation);
      
      if (knowledgeGaps.length > 0) {
        logger.info(`Identified ${knowledgeGaps.length} knowledge gaps in the conversation`);
        knowledgeGaps.forEach(gap => {
          logger.info(`Knowledge gap: ${gap.topic} (confidence: ${gap.confidence.toFixed(2)}, importance: ${gap.importance}/10)`);
        });
      } else {
        logger.info('No knowledge gaps identified in the conversation');
      }
    } catch (error) {
      // Don't let errors in knowledge gap analysis affect the main conversation flow
      logger.error(`Error in knowledge gaps analysis: ${error}`);
    }
  }
  
  /**
   * Format the conversation messages for analysis
   */
  private formatConversationForAnalysis(messages: Message[]): string {
    return messages.map(message => {
      // Use the sender.role property to determine the role
      const role = message.sender.role === 'user' ? 'User' : 'Assistant';
      return `${role}: ${message.content}`;
    }).join('\n\n');
  }
} 