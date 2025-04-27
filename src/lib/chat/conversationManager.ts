import { KnowledgeGapsProcessor } from './processors/KnowledgeGapsProcessor';
import { KnowledgeGraph } from '../knowledge/KnowledgeGraph';
import { Message } from '../../types';

class ConversationManager {
  private knowledgeGapsProcessor: KnowledgeGapsProcessor;
  
  constructor() {
    // Initialize knowledge gaps processor if it doesn't already exist
    const knowledgeGraph = new KnowledgeGraph('marketing'); // Or whatever domain is appropriate
    this.knowledgeGapsProcessor = new KnowledgeGapsProcessor({
      knowledgeGraph,
      samplingProbability: 0.25, // Analyze 25% of conversations
      minMessagesRequired: 5
    });
  }

  processMessages(messages: Message[]) {
    // Process for knowledge gaps asynchronously (don't await)
    this.knowledgeGapsProcessor.processConversation(messages)
      .catch((error: Error) => {
        console.error('Error processing knowledge gaps:', error);
      });
  }
} 