import { ChatOpenAI } from '@langchain/openai';
import { KnowledgeGapsManager } from '../../agents/chloe/core/knowledgeGapsManager';

export class ConversationManager {
  private model: ChatOpenAI;
  private knowledgeGapsProcessor: KnowledgeGapsManager | null = null;

  constructor(openaiApiKey: string, knowledgeGapsProcessor?: KnowledgeGapsManager) {
    this.model = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0.2,
      openAIApiKey: openaiApiKey
    });
    
    if (knowledgeGapsProcessor) {
      this.knowledgeGapsProcessor = knowledgeGapsProcessor;
    }
  }

  async processConversation(messages: Array<{ role: string; content: string }>) {
    try {
      if (this.knowledgeGapsProcessor) {
        // Convert messages to a single string for analysis
        const conversationText = messages
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n');
        
        // Use identifyKnowledgeGaps instead of processConversation
        await this.knowledgeGapsProcessor.identifyKnowledgeGaps();
      }
      return true;
    } catch (error: unknown) {
      console.error('Error processing conversation:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }
} 