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
        await this.knowledgeGapsProcessor.processConversation({ messages });
      }
      return true;
    } catch (error: any) {
      console.error('Error processing conversation:', error);
      return false;
    }
  }
} 