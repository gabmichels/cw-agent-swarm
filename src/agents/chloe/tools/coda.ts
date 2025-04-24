import axios from 'axios';
import { logger } from '../../../lib/logging';

const CODA_API_BASE = 'https://coda.io/apis/v1';

interface CodaDoc {
  id: string;
  type: string;
  href: string;
  browserLink: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface CodaListResponse {
  items: CodaDoc[];
  nextPageToken?: string;
  nextPageLink?: string;
}

/**
 * Coda API integration for document management
 * Allows reading, writing, and creating docs in Coda workspace
 */
export class CodaIntegration {
  private apiKey: string;
  private isEnabled: boolean = false;

  constructor() {
    this.apiKey = process.env.CODA_API_KEY || '';
    this.isEnabled = !!this.apiKey;

    if (!this.isEnabled) {
      logger.warn('Coda integration is disabled - CODA_API_KEY not set in environment variables');
    } else {
      logger.info('Coda integration initialized successfully');
    }
  }

  /**
   * Get API client with auth headers
   */
  private getApiClient() {
    return axios.create({
      baseURL: CODA_API_BASE,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * List all docs in the workspace
   */
  async listDocs(): Promise<CodaDoc[]> {
    if (!this.isEnabled) {
      logger.warn('Attempted to list Coda docs but integration is disabled');
      return [];
    }

    try {
      const client = this.getApiClient();
      const response = await client.get<CodaListResponse>('/docs');
      
      logger.info(`Retrieved ${response.data.items.length} Coda docs`);
      return response.data.items;
    } catch (error) {
      logger.error('Error listing Coda docs:', error);
      throw new Error(`Failed to list Coda docs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read the content of a specific doc
   */
  async readDoc(docId: string): Promise<string> {
    if (!this.isEnabled) {
      logger.warn(`Attempted to read Coda doc ${docId} but integration is disabled`);
      return '';
    }

    try {
      const client = this.getApiClient();
      
      // Get the list of pages in the doc
      const pagesResponse = await client.get(`/docs/${docId}/pages`);
      const pages = pagesResponse.data.items;
      
      let fullContent = '';
      
      // For each page, get the content as text
      for (const page of pages) {
        const contentResponse = await client.get(`/docs/${docId}/pages/${page.id}/content`, {
          params: { format: 'text' }
        });
        
        fullContent += `# ${page.name}\n\n${contentResponse.data.content}\n\n`;
      }
      
      logger.info(`Successfully read Coda doc ${docId}`);
      return fullContent;
    } catch (error) {
      logger.error(`Error reading Coda doc ${docId}:`, error);
      throw new Error(`Failed to read Coda doc: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new doc with specified title and content
   */
  async createDoc(title: string, content: string): Promise<CodaDoc> {
    if (!this.isEnabled) {
      logger.warn(`Attempted to create Coda doc "${title}" but integration is disabled`);
      throw new Error('Coda integration is disabled - CODA_API_KEY not set in environment variables');
    }

    try {
      const client = this.getApiClient();
      
      // Create a new doc
      const createResponse = await client.post('/docs', {
        title: title,
        sourceDoc: '' // Can be used to clone an existing doc
      });
      
      const newDoc = createResponse.data;
      
      // Add content to the first page
      await client.put(`/docs/${newDoc.id}/pages/${newDoc.defaultPageId}/content`, {
        content: content
      });
      
      logger.info(`Successfully created Coda doc "${title}" with ID ${newDoc.id}`);
      return newDoc;
    } catch (error) {
      logger.error(`Error creating Coda doc "${title}":`, error);
      throw new Error(`Failed to create Coda doc: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing doc with new content
   */
  async updateDoc(docId: string, content: string): Promise<void> {
    if (!this.isEnabled) {
      logger.warn(`Attempted to update Coda doc ${docId} but integration is disabled`);
      throw new Error('Coda integration is disabled - CODA_API_KEY not set in environment variables');
    }

    try {
      const client = this.getApiClient();
      
      // Get the first page of the doc
      const pagesResponse = await client.get(`/docs/${docId}/pages`);
      const firstPage = pagesResponse.data.items[0];
      
      // Update the content of the first page
      await client.put(`/docs/${docId}/pages/${firstPage.id}/content`, {
        content: content
      });
      
      logger.info(`Successfully updated Coda doc ${docId}`);
    } catch (error) {
      logger.error(`Error updating Coda doc ${docId}:`, error);
      throw new Error(`Failed to update Coda doc: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export a singleton instance
export const codaIntegration = new CodaIntegration();

// Export wrapper functions for easier use
export const listCodaDocs = () => codaIntegration.listDocs();
export const readCodaDoc = (docId: string) => codaIntegration.readDoc(docId);
export const createCodaDoc = (title: string, content: string) => codaIntegration.createDoc(title, content);
export const updateCodaDoc = (docId: string, content: string) => codaIntegration.updateDoc(docId, content); 