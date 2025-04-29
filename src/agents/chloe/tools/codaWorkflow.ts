import { codaIntegration } from './coda';
import { logger } from '../../../lib/logging';
import { ModelInterface } from '../../chloe/core/modelInterface';

/**
 * Workflow for creating a Coda document with LLM-generated content
 */
export class CodaDocumentWorkflow {
  private modelInterface: ModelInterface;
  
  constructor(modelInterface: ModelInterface) {
    this.modelInterface = modelInterface;
  }
  
  /**
   * Create a Coda document with LLM-generated content
   * @param title Document title
   * @param contentPrompt Instructions for the LLM to generate content
   * @returns Information about the created document
   */
  async createDocumentWithLLMContent(title: string, contentPrompt: string) {
    try {
      logger.info(`Starting Coda document workflow for "${title}"`);
      
      // Step 1: Create empty document
      logger.info(`Creating empty Coda document with title: "${title}"`);
      const emptyDoc = await codaIntegration.createDoc(title, "");
      const docId = emptyDoc.id;
      
      // Step 2: Generate content with LLM
      logger.info(`Generating content using LLM for document: ${docId}`);
      const fullPrompt = `Please create content for a document titled "${title}". ${contentPrompt}
      Format the content with proper markdown headings, paragraphs, and bullet points.`;
      
      const llmResponse = await this.modelInterface.generateContent(fullPrompt);
      const generatedContent = llmResponse.content || "No content was generated.";
      
      // Step 3: Update document with generated content
      logger.info(`Updating document ${docId} with generated content`);
      await codaIntegration.updateDoc(docId, generatedContent);
      
      return {
        success: true,
        docId: docId,
        title: title,
        browserLink: emptyDoc.browserLink,
        message: "Document created successfully with AI-generated content"
      };
    } catch (error) {
      logger.error(`Error in Coda document workflow:`, error);
      throw new Error(`Failed to create document with LLM content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 