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

    let createdDoc: CodaDoc;

    try {
      const client = this.getApiClient();
      
      // Clean the content for proper handling
      const cleanContent = content.replace(/\r\n/g, '\n'); // Normalize line endings
      
      // Create a new doc with initial page
      logger.info(`Creating new Coda doc "${title}" with initial content`);

      const requestBody = {
        title: title,
        timezone: 'Europe/Berlin',
        folderId: process.env.CODA_FOLDER_ID,
        initialPage: {
          name: title,
          subtitle: `Created on ${new Date().toLocaleString()}`,
          iconName: "rocket",
          pageContent: {
            type: "canvas",
            canvasContent: {
              format: "markdown",
              content: content
            }
          }
        }
      }

      logger.info(JSON.stringify(requestBody));

      try {
        const createResponse = await client.post('/docs', JSON.stringify(requestBody));
        
        createdDoc = createResponse.data;
        logger.info(`Successfully created Coda doc "${title}" with ID ${createdDoc.id}`);
        
        return createdDoc;
      } catch (error: any) {
        // Enhanced error logging for the POST request
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          logger.error(`Coda API response error: ${error.response.status}`);
          logger.error(`Response data:`, JSON.stringify(error.response.data, null, 2));
          logger.error(`Response headers:`, JSON.stringify(error.response.headers, null, 2));
        } else if (error.request) {
          // The request was made but no response was received
          logger.error(`No response received from Coda API:`, error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          logger.error(`Error setting up Coda API request:`, error.message);
        }
        
        throw error; // Re-throw to be caught by the outer catch block
      }
    } catch (error) {
      logger.error(`Error creating Coda doc "${title}":`, error);
      throw new Error(`Failed to create Coda doc: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update the content of a specific doc or page
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
      
      // Check if this is a document ID or page ID
      // Page IDs typically start with "canvas-" or other prefixes
      const isPage = docId.includes('canvas-') || docId.includes('table-') || docId.includes('view-');
      
      if (isPage) {
        // If it's a page ID, update the page content directly with the proper format
        logger.info(`Updating page content for page ID: ${cleanDocId}`);
        
        // Format the payload according to Coda API requirements
        await client.put(`/pages/${cleanDocId}`, {
          contentUpdate: {
            insertionMode: "append", // or "replace" to overwrite existing content
            canvasContent: {
              content: content
            }
          }
        });
      } else {
        // If it's a doc ID, try to find the main page and update its content
        logger.info(`Finding main page for doc ID: ${cleanDocId}`);
        const pagesResponse = await client.get(`/docs/${cleanDocId}/pages`);
        
        if (pagesResponse.data.items && pagesResponse.data.items.length > 0) {
          const mainPage = pagesResponse.data.items[0];
          logger.info(`Found main page with ID ${mainPage.id}, updating content...`);
          
          // Format the payload according to Coda API requirements
          await client.put(`/docs/${cleanDocId}/pages/${mainPage.id}`, {
            contentUpdate: {
              insertionMode: "append", // or "replace" to overwrite existing content
              canvasContent: {
                content: content
              }
            }
          });
          
          logger.info(`Successfully updated main page content`);
        } else {
          throw new Error(`No pages found in document ${cleanDocId}`);
        }
      }
      
      logger.info(`Successfully updated content for ${isPage ? 'page' : 'doc'} ${cleanDocId}`);
    } catch (error) {
      logger.error(`Error updating content for doc/page ${docId}:`, error);
      throw new Error(`Failed to update content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export a singleton instance of the CodaIntegration class
export const codaIntegration = new CodaIntegration();