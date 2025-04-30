import { ChatOpenAI } from '@langchain/openai';
import { logger } from '../../../lib/logging';

export interface GeneratedContent {
  content: string;
  tokens?: number;
  modelUsed?: string;
}

/**
 * Interface for interacting with language models
 */
export class ModelInterface {
  private model: ChatOpenAI;
  
  constructor(model: ChatOpenAI) {
    this.model = model;
  }
  
  /**
   * Generate content using the language model
   * @param prompt Prompt to send to the model
   * @returns The generated content
   */
  async generateContent(prompt: string): Promise<GeneratedContent> {
    try {
      logger.info('Generating content with LLM');
      
      const response = await this.model.invoke(prompt);
      const content = response.content.toString();
      
      return {
        content
      };
    } catch (error) {
      logger.error('Error generating content with LLM:', error);
      throw new Error(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get the underlying model instance
   */
  getModel(): ChatOpenAI {
    return this.model;
  }
} 