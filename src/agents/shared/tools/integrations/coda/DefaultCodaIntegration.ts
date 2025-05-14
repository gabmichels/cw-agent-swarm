/**
 * DefaultCodaIntegration.ts
 * Implementation of the ICodaIntegration interface for Coda document management
 */

import axios, { AxiosInstance } from 'axios';
import { ICodaIntegration, CodaDoc, ResolvedResource, CodaIntegrationOptions } from './CodaIntegration.interface';
import { logger } from '../../../../../lib/logging';

// Constants
const CODA_API_BASE = 'https://coda.io/apis/v1';
const DEFAULT_TIMEZONE = 'UTC';

/**
 * Default implementation of the ICodaIntegration interface
 */
export class DefaultCodaIntegration implements ICodaIntegration {
  private readonly apiKey: string;
  private readonly folderId?: string;
  private readonly timezone: string;
  private readonly _isEnabled: boolean;

  /**
   * Create a new Coda integration instance
   * 
   * @param options Configuration options
   */
  constructor(options?: CodaIntegrationOptions) {
    this.apiKey = options?.apiKey || process.env.CODA_API_KEY || '';
    this.folderId = options?.folderId || process.env.CODA_FOLDER_ID;
    this.timezone = options?.timezone || process.env.CODA_TIMEZONE || DEFAULT_TIMEZONE;
    this._isEnabled = !!this.apiKey;

    if (!this._isEnabled) {
      logger.warn('Coda integration is disabled - no API key provided');
    } else {
      logger.info('Coda integration initialized successfully');
    }
  }

  /**
   * Check if the integration is enabled
   */
  isEnabled(): boolean {
    return this._isEnabled;
  }

  /**
   * Get API client with auth headers
   * @private
   */
  private getApiClient(): AxiosInstance {
    return axios.create({
      baseURL: CODA_API_BASE,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
  }

  /**
   * Verify the integration is enabled or throw an error
   * @private
   */
  private verifyEnabled(operation: string): void {
    if (!this._isEnabled) {
      const message = `Attempted to ${operation} but integration is disabled - no API key provided`;
      logger.warn(message);
      throw new Error(message);
    }
  }

  /**
   * Clean document ID by removing leading underscore if present
   * @private
   */
  private cleanDocId(docId: string): string {
    return docId.startsWith('_') ? docId.substring(1) : docId;
  }

  /**
   * Format error message with details when possible
   * @private
   */
  private formatErrorMessage(action: string, error: unknown): string {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      let message = `Coda API error (${status})`;
      
      if (error.response.data && error.response.data.message) {
        message += `: ${error.response.data.message}`;
      }
      
      return message;
    }
    
    return `Failed to ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  /**
   * Resolves a browser link to get the resource details
   */
  async resolveBrowserLink(url: string): Promise<ResolvedResource> {
    this.verifyEnabled('resolve browser link');

    try {
      const client = this.getApiClient();
      const response = await client.get('/resolveBrowserLink', {
        params: { url }
      });
      
      logger.info(`Successfully resolved browser link ${url} to resource ${response.data.resource.id}`);
      return response.data.resource;
    } catch (error) {
      const errorMessage = this.formatErrorMessage('resolve browser link', error);
      logger.error(`Error resolving browser link ${url}: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * List all docs in the workspace
   */
  async listDocs(): Promise<CodaDoc[]> {
    if (!this._isEnabled) {
      logger.warn('Attempted to list Coda docs but integration is disabled');
      return [];
    }

    try {
      const client = this.getApiClient();
      const response = await client.get('/docs');
      
      logger.info(`Retrieved ${response.data.items.length} Coda docs`);
      return response.data.items;
    } catch (error) {
      const errorMessage = this.formatErrorMessage('list Coda docs', error);
      logger.error(`Error listing Coda docs: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Read the content of a specific doc or page
   */
  async readDoc(docId: string): Promise<string> {
    this.verifyEnabled('read document');

    try {
      // Determine if this is a document or page ID
      const isPage = docId.includes('canvas-') || docId.includes('table-') || docId.includes('view-');
      
      if (isPage) {
        return this.readPageContent(docId);
      } else {
        return this.readDocumentContent(docId);
      }
    } catch (error) {
      const errorMessage = this.formatErrorMessage('read document', error);
      logger.error(`Error reading doc/page ${docId}: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Read content from a page directly
   * @private
   */
  private async readPageContent(pageId: string): Promise<string> {
    const client = this.getApiClient();
    const contentResponse = await client.get(`/pages/${pageId}/content`, {
      params: { format: 'text' }
    });
    
    logger.info(`Successfully read content from page ${pageId}`);
    return contentResponse.data.content || '';
  }

  /**
   * Read content from a document by aggregating all pages
   * @private
   */
  private async readDocumentContent(docId: string): Promise<string> {
    const cleanDocId = this.cleanDocId(docId);
    const client = this.getApiClient();
    
    // Get the list of pages in the doc
    const pagesResponse = await client.get(`/docs/${cleanDocId}/pages`);
    const pages = pagesResponse.data.items;
    
    if (!pages || pages.length === 0) {
      logger.warn(`No pages found in document ${cleanDocId}`);
      return '';
    }
    
    let fullContent = '';
    
    // For each page, get the content as text
    for (const page of pages) {
      try {
        const contentResponse = await client.get(`/docs/${cleanDocId}/pages/${page.id}/content`, {
          params: { format: 'text' }
        });
        
        fullContent += `# ${page.name}\n\n${contentResponse.data.content || ''}\n\n`;
      } catch (pageError) {
        logger.warn(`Could not read content from page ${page.id} in document ${cleanDocId}: ${pageError instanceof Error ? pageError.message : 'Unknown error'}`);
        // Continue with other pages despite this error
      }
    }
    
    logger.info(`Successfully read content from ${pages.length} pages in document ${cleanDocId}`);
    return fullContent;
  }

  /**
   * Create a new doc with specified title and content
   */
  async createDoc(title: string, content: string): Promise<CodaDoc> {
    this.verifyEnabled('create document');

    try {
      const client = this.getApiClient();
      
      // Clean the content for proper handling
      const cleanContent = content.replace(/\r\n/g, '\n'); // Normalize line endings
      
      // Create a new doc with initial page
      logger.info(`Creating new Coda doc "${title}" with initial content`);

      const requestBody = {
        title: title,
        timezone: this.timezone,
        folderId: this.folderId,
        initialPage: {
          name: title,
          subtitle: `Created on ${new Date().toLocaleString()}`,
          iconName: "rocket",
          pageContent: {
            type: "canvas",
            canvasContent: {
              format: "markdown",
              content: cleanContent
            }
          }
        }
      };

      try {
        const createResponse = await client.post('/docs', JSON.stringify(requestBody));
        
        const createdDoc = createResponse.data;
        logger.info(`Successfully created Coda doc "${title}" with ID ${createdDoc.id}`);
        
        return createdDoc;
      } catch (apiError) {
        // Enhanced error logging
        if (axios.isAxiosError(apiError) && apiError.response) {
          logger.error(`Coda API response error: ${apiError.response.status}`);
          logger.error(`Response data:`, JSON.stringify(apiError.response.data, null, 2));
        }
        throw apiError; // Re-throw to be caught by the outer catch block
      }
    } catch (error) {
      const errorMessage = this.formatErrorMessage('create document', error);
      logger.error(`Error creating Coda doc "${title}": ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Update the content of a specific doc or page
   */
  async updateDoc(docId: string, content: string): Promise<void> {
    this.verifyEnabled('update document');

    try {
      // Determine if this is a document or page ID
      const isPage = docId.includes('canvas-') || docId.includes('table-') || docId.includes('view-');
      
      if (isPage) {
        await this.updatePageContent(docId, content);
      } else {
        await this.updateDocumentContent(docId, content);
      }
      
      logger.info(`Successfully updated content for ${isPage ? 'page' : 'doc'} ${docId}`);
    } catch (error) {
      const errorMessage = this.formatErrorMessage('update document', error);
      logger.error(`Error updating content for doc/page ${docId}: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Update content for a page directly
   * @private
   */
  private async updatePageContent(pageId: string, content: string): Promise<void> {
    const client = this.getApiClient();
    
    // Format the payload according to Coda API requirements
    await client.put(`/pages/${pageId}`, {
      contentUpdate: {
        insertionMode: "append", // append to existing content
        canvasContent: {
          content: content
        }
      }
    });
  }

  /**
   * Update content for a document by updating its main page
   * @private
   */
  private async updateDocumentContent(docId: string, content: string): Promise<void> {
    const cleanDocId = this.cleanDocId(docId);
    const client = this.getApiClient();
    
    // Find the main page and update its content
    const pagesResponse = await client.get(`/docs/${cleanDocId}/pages`);
    
    if (!pagesResponse.data.items || pagesResponse.data.items.length === 0) {
      throw new Error(`No pages found in document ${cleanDocId}`);
    }
    
    const mainPage = pagesResponse.data.items[0];
    logger.info(`Found main page with ID ${mainPage.id}, updating content...`);
    
    // Format the payload according to Coda API requirements
    await client.put(`/docs/${cleanDocId}/pages/${mainPage.id}`, {
      contentUpdate: {
        insertionMode: "append", // append to existing content
        canvasContent: {
          content: content
        }
      }
    });
  }
} 