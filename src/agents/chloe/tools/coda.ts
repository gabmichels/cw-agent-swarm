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

interface ResolvedResource {
  type: string;
  id: string;
  name: string;
  href: string;
}

interface BrowserLinkResponse {
  type: string;
  href: string;
  browserLink: string;
  resource: ResolvedResource;
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
   * Resolves a browser link to get the resource details
   * This converts a URL like https://coda.io/d/_dXXXXXX/PageName_sYYYYYY
   * into the proper resource IDs that can be used with the API
   */
  async resolveBrowserLink(url: string): Promise<ResolvedResource> {
    if (!this.isEnabled) {
      logger.warn(`Attempted to resolve browser link ${url} but integration is disabled`);
      throw new Error('Coda integration is disabled - CODA_API_KEY not set in environment variables');
    }

    try {
      const client = this.getApiClient();
      const response = await client.get<BrowserLinkResponse>('/resolveBrowserLink', {
        params: { url }
      });
      
      logger.info(`Successfully resolved browser link ${url} to resource ${response.data.resource.id}`);
      return response.data.resource;
    } catch (error) {
      logger.error(`Error resolving browser link ${url}:`, error);
      throw new Error(`Failed to resolve browser link: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      // Remove leading underscore if present (API requires ID without underscore)
      const cleanDocId = docId.startsWith('_') ? docId.substring(1) : docId;
      
      const client = this.getApiClient();
      
      // Get the list of pages in the doc
      const pagesResponse = await client.get(`/docs/${cleanDocId}/pages`);
      const pages = pagesResponse.data.items;
      
      let fullContent = '';
      
      // For each page, get the content as text
      for (const page of pages) {
        const contentResponse = await client.get(`/docs/${cleanDocId}/pages/${page.id}/content`, {
          params: { format: 'text' }
        });
        
        fullContent += `# ${page.name}\n\n${contentResponse.data.content}\n\n`;
      }
      
      logger.info(`Successfully read Coda doc ${cleanDocId}`);
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
        sourceDoc: '',
        folderId: process.env.CODA_FOLDER_ID // Can be used to clone an existing doc
      });
      
      const newDoc = createResponse.data;
      logger.info(`Successfully created Coda doc "${title}" with ID ${newDoc.id}`);
      
      // The doc is created even if content addition fails, so try adding content in a separate try/catch
      try {
        // Add a delay to give Coda time to process the document
        logger.info(`Waiting for document ${newDoc.id} to be fully processed...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        
        // Get the pages to find the first page if defaultPageId is not provided
        if (!newDoc.defaultPageId) {
          logger.info(`No defaultPageId found for document ${newDoc.id}, fetching pages...`);
          try {
            const pagesResponse = await client.get(`/docs/${newDoc.id}/pages`);
            const pages = pagesResponse.data.items;
            if (pages && pages.length > 0) {
              // Update the content of the first page
              await client.put(`/docs/${newDoc.id}/pages/${pages[0].id}/content`, {
                content: content
              });
              logger.info(`Added content to first page (${pages[0].id}) of doc ${newDoc.id}`);
            } else {
              logger.warn(`No pages found in new document ${newDoc.id}, content not added`);
            }
          } catch (pageError) {
            logger.error(`Error fetching pages for new doc ${newDoc.id}:`, pageError);
            logger.info(`Document created but couldn't access pages. Try adding content later when the document is fully processed.`);
          }
        } else {
          // Add content to the first page using defaultPageId
          await client.put(`/docs/${newDoc.id}/pages/${newDoc.defaultPageId}/content`, {
            content: content
          });
          logger.info(`Added content to default page (${newDoc.defaultPageId}) of doc ${newDoc.id}`);
        }
      } catch (contentError) {
        // Log the error but don't fail the whole operation - the doc is still created
        logger.error(`Error adding content to new doc ${newDoc.id}:`, contentError);
        logger.info(`Document created but content could not be added. You can add content later using updateDoc.`);
      }
      
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
      // Remove leading underscore if present (API requires ID without underscore)
      const cleanDocId = docId.startsWith('_') ? docId.substring(1) : docId;
      
      const client = this.getApiClient();
      
      // Get the first page of the doc
      const pagesResponse = await client.get(`/docs/${cleanDocId}/pages`);
      const firstPage = pagesResponse.data.items[0];
      
      // Update the content of the first page
      await client.put(`/docs/${cleanDocId}/pages/${firstPage.id}/content`, {
        content: content
      });
      
      logger.info(`Successfully updated Coda doc ${cleanDocId}`);
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
export const resolveCodaLink = (url: string) => codaIntegration.resolveBrowserLink(url); 