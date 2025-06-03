/**
 * CodaToolAdapter.ts - Adapter for Coda tools
 * 
 * This file provides adapters that bridge the existing Coda tools from the Chloe system
 * to the new DefaultAgent tool system. It follows the IMPLEMENTATION_GUIDELINES.md
 * principles for clean implementation without legacy compatibility layers.
 */

import { Tool, ToolCategory, ToolExecutionResult } from '../../../../lib/tools/types';
import { IdGenerator } from '../../../../utils/ulid';
import { codaIntegration } from '../integrations/coda';
import { logger } from '../../../../lib/logging';

/**
 * Coda document creation parameters
 */
interface CodaCreateDocumentParams {
  /** Title of the document */
  title: string;
  /** Content of the document in markdown format */
  content: string;
  /** Optional folder ID for document placement */
  folderId?: string;
}

/**
 * Coda document read parameters
 */
interface CodaReadDocumentParams {
  /** Document or page ID to read */
  documentId: string;
}

/**
 * Coda document update parameters
 */
interface CodaUpdateDocumentParams {
  /** Document or page ID to update */
  documentId: string;
  /** New content for the document */
  content: string;
}

/**
 * Coda document list parameters
 */
interface CodaListDocumentsParams {
  /** Optional limit on number of documents to return */
  limit?: number;
}

/**
 * Result structure for Coda document operations
 */
interface CodaDocumentResult {
  /** Document ID */
  id: string;
  /** Document name/title */
  name: string;
  /** Browser link to access the document */
  browserLink: string;
  /** Creation/update timestamp */
  timestamp: string;
}

/**
 * Create Coda Document Tool - Adapted from Chloe's CodaDocumentTool
 */
export function createCodaCreateDocumentTool(): Tool {
  return {
    id: 'coda_create_document',
    name: 'Create Coda Document',
    description: 'Create a new document in Coda workspace with title and content',
    category: ToolCategory.DOCUMENT,
    enabled: true,
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the document to create'
        },
        content: {
          type: 'string',
          description: 'Content of the document in markdown format'
        },
        folderId: {
          type: 'string',
          description: 'Optional folder ID for document placement (uses CODA_FOLDER_ID from .env if not specified)',
          required: false
        }
      },
      required: ['title', 'content']
    },
    metadata: {
      costEstimate: 1,
      usageLimit: 100,
      source: 'chloe_adapter',
      version: '1.0.0'
    },
    execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const startTime = Date.now();
      
      try {
        const params = args as unknown as CodaCreateDocumentParams;
        
        // Validate required parameters
        if (!params.title || !params.content) {
          throw new Error('Both title and content are required for document creation');
        }
        
        logger.info('Creating Coda document', {
          title: params.title,
          contentLength: params.content.length,
          folderId: params.folderId || process.env.CODA_FOLDER_ID || 'default'
        });
        
        // Use the existing Coda integration (ported from Chloe)
        const doc = await codaIntegration.createDoc(params.title, params.content);
        
        const result: CodaDocumentResult = {
          id: doc.id,
          name: doc.name,
          browserLink: doc.browserLink,
          timestamp: new Date().toISOString()
        };
        
        const endTime = Date.now();
        
        logger.info('Coda document created successfully', {
          documentId: doc.id,
          documentName: doc.name,
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'coda_create_document',
          success: true,
          data: result,
          metrics: {
            startTime,
            endTime,
            durationMs: endTime - startTime
          }
        };
        
      } catch (error) {
        const endTime = Date.now();
        
        logger.error('Error creating Coda document', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'coda_create_document',
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error creating Coda document',
            code: 'CODA_CREATE_FAILED',
            details: error
          },
          metrics: {
            startTime,
            endTime,
            durationMs: endTime - startTime
          }
        };
      }
    }
  };
}

/**
 * Read Coda Document Tool - Adapted from Chloe's CodaDocumentTool
 */
export function createCodaReadDocumentTool(): Tool {
  return {
    id: 'coda_read_document',
    name: 'Read Coda Document',
    description: 'Read content from a Coda document or page',
    category: ToolCategory.DOCUMENT,
    enabled: true,
    schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'Document or page ID to read from'
        }
      },
      required: ['documentId']
    },
    metadata: {
      costEstimate: 1,
      usageLimit: 200,
      source: 'chloe_adapter',
      version: '1.0.0'
    },
    execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const startTime = Date.now();
      
      try {
        const params = args as unknown as CodaReadDocumentParams;
        
        if (!params.documentId) {
          throw new Error('Document ID is required for reading');
        }
        
        logger.info('Reading Coda document', { documentId: params.documentId });
        
        const content = await codaIntegration.readDoc(params.documentId);
        
        if (!content) {
          throw new Error('No content found or document not accessible');
        }
        
        const endTime = Date.now();
        
        logger.info('Coda document read successfully', {
          documentId: params.documentId,
          contentLength: content.length,
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'coda_read_document',
          success: true,
          data: {
            documentId: params.documentId,
            content,
            contentLength: content.length,
            timestamp: new Date().toISOString()
          },
          metrics: {
            startTime,
            endTime,
            durationMs: endTime - startTime
          }
        };
        
      } catch (error) {
        const endTime = Date.now();
        
        logger.error('Error reading Coda document', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'coda_read_document',
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error reading Coda document',
            code: 'CODA_READ_FAILED',
            details: error
          },
          metrics: {
            startTime,
            endTime,
            durationMs: endTime - startTime
          }
        };
      }
    }
  };
}

/**
 * Update Coda Document Tool - Adapted from Chloe's CodaDocumentTool
 */
export function createCodaUpdateDocumentTool(): Tool {
  return {
    id: 'coda_update_document',
    name: 'Update Coda Document',
    description: 'Update content of an existing Coda document or page',
    category: ToolCategory.DOCUMENT,
    enabled: true,
    schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'Document or page ID to update'
        },
        content: {
          type: 'string',
          description: 'New content for the document'
        }
      },
      required: ['documentId', 'content']
    },
    metadata: {
      costEstimate: 1,
      usageLimit: 100,
      source: 'chloe_adapter',
      version: '1.0.0'
    },
    execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const startTime = Date.now();
      
      try {
        const params = args as unknown as CodaUpdateDocumentParams;
        
        if (!params.documentId || !params.content) {
          throw new Error('Both document ID and content are required for updating');
        }
        
        logger.info('Updating Coda document', {
          documentId: params.documentId,
          contentLength: params.content.length
        });
        
        await codaIntegration.updateDoc(params.documentId, params.content);
        
        const endTime = Date.now();
        
        logger.info('Coda document updated successfully', {
          documentId: params.documentId,
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'coda_update_document',
          success: true,
          data: {
            documentId: params.documentId,
            contentLength: params.content.length,
            timestamp: new Date().toISOString()
          },
          metrics: {
            startTime,
            endTime,
            durationMs: endTime - startTime
          }
        };
        
      } catch (error) {
        const endTime = Date.now();
        
        logger.error('Error updating Coda document', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'coda_update_document',
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error updating Coda document',
            code: 'CODA_UPDATE_FAILED',
            details: error
          },
          metrics: {
            startTime,
            endTime,
            durationMs: endTime - startTime
          }
        };
      }
    }
  };
}

/**
 * List Coda Documents Tool - Adapted from Chloe's CodaDocumentTool
 */
export function createCodaListDocumentsTool(): Tool {
  return {
    id: 'coda_list_documents',
    name: 'List Coda Documents',
    description: 'List all documents in the Coda workspace',
    category: ToolCategory.DOCUMENT,
    enabled: true,
    schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Optional limit on number of documents to return',
          required: false
        }
      }
    },
    metadata: {
      costEstimate: 1,
      usageLimit: 500,
      source: 'chloe_adapter',
      version: '1.0.0'
    },
    execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const startTime = Date.now();
      
      try {
        const params = args as unknown as CodaListDocumentsParams;
        
        logger.info('Listing Coda documents', { limit: params.limit });
        
        const docs = await codaIntegration.listDocs();
        
        // Apply limit if specified
        const limitedDocs = params.limit ? docs.slice(0, params.limit) : docs;
        
        const results = limitedDocs.map(doc => ({
          id: doc.id,
          name: doc.name,
          browserLink: doc.browserLink,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        }));
        
        const endTime = Date.now();
        
        logger.info('Coda documents listed successfully', {
          totalDocs: docs.length,
          returnedDocs: results.length,
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'coda_list_documents',
          success: true,
          data: {
            documents: results,
            totalCount: docs.length,
            returnedCount: results.length,
            timestamp: new Date().toISOString()
          },
          metrics: {
            startTime,
            endTime,
            durationMs: endTime - startTime
          }
        };
        
      } catch (error) {
        const endTime = Date.now();
        
        logger.error('Error listing Coda documents', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'coda_list_documents',
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error listing Coda documents',
            code: 'CODA_LIST_FAILED',
            details: error
          },
          metrics: {
            startTime,
            endTime,
            durationMs: endTime - startTime
          }
        };
      }
    }
  };
}

/**
 * Factory function to create all Coda tools
 */
export function createAllCodaTools(): Tool[] {
  return [
    createCodaCreateDocumentTool(),
    createCodaReadDocumentTool(),
    createCodaUpdateDocumentTool(),
    createCodaListDocumentsTool()
  ];
} 