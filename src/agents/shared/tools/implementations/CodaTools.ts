/**
 * CodaTools.ts - Enhanced Coda tool implementations
 * 
 * This file provides enhanced implementations of Coda tools that preserve the working
 * patterns from Chloe (action|title|content format) while integrating with the new
 * DefaultAgent tool system. Follows IMPLEMENTATION_GUIDELINES.md principles.
 */

import { Tool, ToolCategory, ToolExecutionResult } from '../../../../lib/tools/types';
import { IdGenerator } from '../../../../utils/ulid';
import { codaIntegration } from '../integrations/coda';
import { logger } from '../../../../lib/logging';

/**
 * Legacy input format parameters (from Chloe's action|title|content pattern)
 */
interface CodaLegacyInputParams {
  /** Raw input string in action|title|content format */
  input: string;
}

/**
 * Enhanced document creation parameters
 */
interface CodaEnhancedCreateParams {
  /** Title of the document */
  title: string;
  /** Content of the document in markdown format */
  content: string;
  /** Optional folder ID for document placement */
  folderId?: string;
  /** Auto-generate title from content if not provided */
  autoTitle?: boolean;
}

/**
 * Enhanced document read parameters
 */
interface CodaEnhancedReadParams {
  /** Document or page ID to read */
  documentId: string;
  /** Optional format for the output */
  format?: 'raw' | 'formatted' | 'summary';
}

/**
 * Enhanced document update parameters
 */
interface CodaEnhancedUpdateParams {
  /** Document or page ID to update */
  documentId: string;
  /** New content for the document */
  content: string;
  /** Update mode: replace, append, or prepend */
  mode?: 'replace' | 'append' | 'prepend';
}

/**
 * Enhanced document list parameters
 */
interface CodaEnhancedListParams {
  /** Optional limit on number of documents to return */
  limit?: number;
  /** Filter by document name pattern */
  nameFilter?: string;
  /** Sort order */
  sortBy?: 'name' | 'created' | 'updated';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Utility function to parse Chloe's action|title|content format
 */
function parseLegacyInput(input: string): {
  action: string;
  args: string[];
  isValid: boolean;
  error?: string;
} {
  const parts = input.split('|');
  
  if (parts.length === 0 || !parts[0]) {
    return {
      action: '',
      args: [],
      isValid: false,
      error: 'Invalid input format: Missing action. Expected format: action|title|content'
    };
  }
  
  const action = parts[0].trim().toLowerCase();
  const args = parts.slice(1).map(arg => arg.trim());
  
  return {
    action,
    args,
    isValid: true
  };
}

/**
 * Utility function to auto-generate title from content
 */
function generateTitleFromContent(content: string, defaultTitle?: string): string {
  // Try to extract title from first heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }
  
  // Use first line as title
  const firstLine = content.split('\n')[0].trim();
  if (firstLine && firstLine.length > 0) {
    return firstLine.substring(0, 50) + (firstLine.length > 50 ? '...' : '');
  }
  
  // Fall back to default or timestamp
  return defaultTitle || `Document - ${new Date().toLocaleString()}`;
}

/**
 * Enhanced Coda Document Tool - Preserves Chloe's action|title|content pattern
 * 
 * This tool maintains backward compatibility with Chloe's input format while
 * adding enhanced features for the DefaultAgent system.
 */
export function createEnhancedCodaDocumentTool(): Tool {
  return {
    id: 'enhanced_coda_document',
    name: 'Enhanced Coda Document',
    description: 'Create, read, update, or list documents in Coda workspace. Supports both legacy (action|title|content) and new parameter formats.',
    category: ToolCategory.DOCUMENT,
    enabled: true,
    schema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Legacy format: action|title|content (e.g., "create_document|My Title|My content here")'
        },
        action: {
          type: 'string',
          description: 'Action to perform: list_documents, read_document, create_document, update',
          enum: ['list_documents', 'read_document', 'create_document', 'update']
        },
        title: {
          type: 'string',
          description: 'Title for document creation'
        },
        content: {
          type: 'string',
          description: 'Content for document creation or update'
        },
        documentId: {
          type: 'string',
          description: 'Document ID for read/update operations'
        },
        folderId: {
          type: 'string',
          description: 'Optional folder ID for document placement (uses CODA_FOLDER_ID from .env if not specified)'
        }
      }
    },
    metadata: {
      costEstimate: 1,
      usageLimit: 100,
      source: 'enhanced_implementation',
      version: '2.0.0',
      preservesLegacy: true,
      supportedActions: ['list_documents', 'read_document', 'create_document', 'update']
    },
    execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const startTime = Date.now();
      
      try {
        let action: string;
        let operationArgs: string[] = [];
        
        // Check if using legacy input format
        if (args.input && typeof args.input === 'string') {
          const parsed = parseLegacyInput(args.input as string);
          if (!parsed.isValid) {
            throw new Error(parsed.error || 'Invalid legacy input format');
          }
          action = parsed.action;
          operationArgs = parsed.args;
          
          logger.info('Processing legacy Coda command', {
            action,
            argsCount: operationArgs.length,
            legacyFormat: true
          });
        } else {
          // New parameter format
          action = (args.action as string)?.toLowerCase() || '';
          if (!action) {
            throw new Error('Action is required. Use either "input" (legacy format) or "action" parameter.');
          }
          
          logger.info('Processing enhanced Coda command', {
            action,
            legacyFormat: false
          });
        }
        
        // Execute action with enhanced error handling and logging
        let result: any;
        
        switch (action) {
          case 'list_documents':
            const docs = await codaIntegration.listDocs();
            if (docs.length === 0) {
              result = {
                message: "No documents found in the Coda workspace.",
                documents: [],
                count: 0
              };
            } else {
              const documentList = docs.map(doc => ({
                id: doc.id,
                name: doc.name,
                browserLink: doc.browserLink,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt
              }));
              
              result = {
                message: `Found ${docs.length} documents in Coda workspace`,
                documents: documentList,
                count: docs.length,
                // Legacy format for backward compatibility
                legacyFormat: docs.map(doc => `${doc.name} (ID: ${doc.id})`).join('\n')
              };
            }
            break;
            
          case 'read_document':
            const docId = operationArgs[0] || args.documentId as string;
            if (!docId) {
              throw new Error('Document ID is required for reading');
            }
            
            const content = await codaIntegration.readDoc(docId);
            if (!content) {
              throw new Error('No content found or document not accessible');
            }
            
            result = {
              documentId: docId,
              content,
              contentLength: content.length,
              message: `Successfully read document ${docId}`,
              // Legacy format for backward compatibility
              legacyFormat: content
            };
            break;
            
          case 'create_document':
            let title: string;
            let docContent: string;
            
            if (operationArgs.length > 0) {
              // Legacy format: args[0] = title, args[1+] = content
              title = operationArgs[0];
              docContent = operationArgs.length > 1 
                ? operationArgs.slice(1).join('\n\n')
                : `# ${title}\n\nThis document was created automatically.`;
            } else {
              // New format
              title = args.title as string;
              docContent = args.content as string;
              
              if (!title || !docContent) {
                throw new Error('Both title and content are required for document creation');
              }
            }
            
            logger.info('Creating Coda document', {
              title,
              contentLength: docContent.length,
              folderId: args.folderId || process.env.CODA_FOLDER_ID || 'default'
            });
            
            const newDoc = await codaIntegration.createDoc(title, docContent);
            
            result = {
              id: newDoc.id,
              name: newDoc.name,
              browserLink: newDoc.browserLink,
              title,
              contentLength: docContent.length,
              message: `Document created successfully: "${newDoc.name}"`,
              // Legacy format for backward compatibility
              legacyFormat: `Document created: "${newDoc.name}" (ID: ${newDoc.id})\nYou can access it at: ${newDoc.browserLink}`
            };
            break;
            
          case 'update':
            const updateDocId = operationArgs[0] || args.documentId as string;
            let updateContent: string;
            
            if (operationArgs.length > 1) {
              // Legacy format: args[0] = docId, args[1+] = content
              updateContent = operationArgs.slice(1).join('\n\n');
            } else {
              // New format
              updateContent = args.content as string;
            }
            
            if (!updateDocId || !updateContent) {
              throw new Error('Both document ID and content are required for updating');
            }
            
            await codaIntegration.updateDoc(updateDocId, updateContent);
            
            result = {
              documentId: updateDocId,
              contentLength: updateContent.length,
              message: `Document updated successfully`,
              // Legacy format for backward compatibility
              legacyFormat: `Document updated successfully (ID: ${updateDocId})`
            };
            break;
            
          default:
            throw new Error(`Unknown action: ${action}. Available actions: list_documents, read_document, create_document, update`);
        }
        
        const endTime = Date.now();
        
        logger.info('Coda operation completed successfully', {
          action,
          durationMs: endTime - startTime,
          legacyFormat: !!args.input
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'enhanced_coda_document',
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
        
        logger.error('Error in enhanced Coda operation', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: endTime - startTime,
          legacyFormat: !!args.input
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'enhanced_coda_document',
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error in Coda operation',
            code: 'ENHANCED_CODA_FAILED',
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
 * Enhanced Create Coda Document Tool - Modern interface with auto-titling
 */
export function createEnhancedCodaCreateTool(): Tool {
  return {
    id: 'enhanced_coda_create',
    name: 'Enhanced Coda Create',
    description: 'Create a new Coda document with advanced features like auto-titling and folder placement',
    category: ToolCategory.DOCUMENT,
    enabled: true,
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the document (auto-generated from content if not provided)'
        },
        content: {
          type: 'string',
          description: 'Content of the document in markdown format'
        },
        folderId: {
          type: 'string',
          description: 'Optional folder ID for document placement (uses CODA_FOLDER_ID from .env if not specified)'
        },
        autoTitle: {
          type: 'boolean',
          description: 'Auto-generate title from content if title not provided (default: true)'
        }
      },
      required: ['content']
    },
    metadata: {
      costEstimate: 1,
      usageLimit: 100,
      source: 'enhanced_implementation',
      version: '2.0.0',
      features: ['auto-titling', 'folder-placement', 'markdown-support']
    },
    execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const startTime = Date.now();
      
      try {
        const params = args as unknown as CodaEnhancedCreateParams;
        
        if (!params.content) {
          throw new Error('Content is required for document creation');
        }
        
        // Auto-generate title if needed
        let title = params.title;
        if (!title && (params.autoTitle !== false)) {
          title = generateTitleFromContent(params.content);
        } else if (!title) {
          throw new Error('Title is required when auto-titling is disabled');
        }
        
        logger.info('Creating enhanced Coda document', {
          title,
          contentLength: params.content.length,
          autoTitle: !params.title,
          folderId: params.folderId || process.env.CODA_FOLDER_ID || 'default'
        });
        
        const doc = await codaIntegration.createDoc(title, params.content);
        
        const result = {
          id: doc.id,
          name: doc.name,
          browserLink: doc.browserLink,
          title,
          contentLength: params.content.length,
          autoGenerated: !params.title,
          folderId: params.folderId || process.env.CODA_FOLDER_ID,
          timestamp: new Date().toISOString()
        };
        
        const endTime = Date.now();
        
        logger.info('Enhanced Coda document created successfully', {
          documentId: doc.id,
          documentName: doc.name,
          autoTitle: !params.title,
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'enhanced_coda_create',
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
        
        logger.error('Error creating enhanced Coda document', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'enhanced_coda_create',
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error creating enhanced Coda document',
            code: 'ENHANCED_CREATE_FAILED',
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
 * Enhanced Read Coda Document Tool - Multiple output formats
 */
export function createEnhancedCodaReadTool(): Tool {
  return {
    id: 'enhanced_coda_read',
    name: 'Enhanced Coda Read',
    description: 'Read content from a Coda document with multiple output format options',
    category: ToolCategory.DOCUMENT,
    enabled: true,
    schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'Document or page ID to read from'
        },
        format: {
          type: 'string',
          description: 'Output format: raw (default), formatted, or summary',
          enum: ['raw', 'formatted', 'summary']
        }
      },
      required: ['documentId']
    },
    metadata: {
      costEstimate: 1,
      usageLimit: 200,
      source: 'enhanced_implementation',
      version: '2.0.0',
      features: ['multiple-formats', 'content-analysis']
    },
    execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const startTime = Date.now();
      
      try {
        const params = args as unknown as CodaEnhancedReadParams;
        
        if (!params.documentId) {
          throw new Error('Document ID is required for reading');
        }
        
        logger.info('Reading enhanced Coda document', {
          documentId: params.documentId,
          format: params.format || 'raw'
        });
        
        const content = await codaIntegration.readDoc(params.documentId);
        
        if (!content) {
          throw new Error('No content found or document not accessible');
        }
        
        let processedContent = content;
        let metadata: Record<string, unknown> = {
          originalLength: content.length,
          lineCount: content.split('\n').length,
          hasMarkdown: /^#|^\*|\*\*|__/.test(content)
        };
        
        // Process content based on format
        switch (params.format) {
          case 'formatted':
            // Add basic formatting analysis
            processedContent = content;
            metadata = {
              ...metadata,
              headings: (content.match(/^#.+$/gm) || []).length,
              links: (content.match(/\[.+\]\(.+\)/g) || []).length,
              codeBlocks: (content.match(/```/g) || []).length / 2
            };
            break;
            
          case 'summary':
            // Create a simple summary
            const lines = content.split('\n').filter(line => line.trim());
            const headings = lines.filter(line => line.startsWith('#'));
            const firstParagraph = lines.find(line => !line.startsWith('#') && line.length > 20);
            
            processedContent = `Summary of document:\n` +
              (headings.length > 0 ? `Headings: ${headings.join(', ')}\n` : '') +
              (firstParagraph ? `Preview: ${firstParagraph.substring(0, 200)}...\n` : '') +
              `Total length: ${content.length} characters, ${lines.length} lines`;
            break;
            
          default:
            // Raw format - no processing
            break;
        }
        
        const result = {
          documentId: params.documentId,
          content: processedContent,
          format: params.format || 'raw',
          metadata,
          timestamp: new Date().toISOString()
        };
        
        const endTime = Date.now();
        
        logger.info('Enhanced Coda document read successfully', {
          documentId: params.documentId,
          format: params.format || 'raw',
          contentLength: content.length,
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'enhanced_coda_read',
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
        
        logger.error('Error reading enhanced Coda document', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'enhanced_coda_read',
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error reading enhanced Coda document',
            code: 'ENHANCED_READ_FAILED',
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
 * Enhanced Update Coda Document Tool - Multiple update modes
 */
export function createEnhancedCodaUpdateTool(): Tool {
  return {
    id: 'enhanced_coda_update',
    name: 'Enhanced Coda Update',
    description: 'Update content of an existing Coda document with replace, append, or prepend modes',
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
        },
        mode: {
          type: 'string',
          description: 'Update mode: replace (default), append, or prepend',
          enum: ['replace', 'append', 'prepend']
        }
      },
      required: ['documentId', 'content']
    },
    metadata: {
      costEstimate: 1,
      usageLimit: 100,
      source: 'enhanced_implementation',
      version: '2.0.0',
      features: ['multiple-update-modes', 'content-preservation']
    },
    execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const startTime = Date.now();
      
      try {
        const params = args as unknown as CodaEnhancedUpdateParams;
        
        if (!params.documentId || !params.content) {
          throw new Error('Both document ID and content are required for updating');
        }
        
        let finalContent = params.content;
        
        // Handle different update modes
        if (params.mode === 'append' || params.mode === 'prepend') {
          logger.info('Reading existing content for update mode', {
            documentId: params.documentId,
            mode: params.mode
          });
          
          const existingContent = await codaIntegration.readDoc(params.documentId);
          
          if (existingContent) {
            finalContent = params.mode === 'append'
              ? `${existingContent}\n\n${params.content}`
              : `${params.content}\n\n${existingContent}`;
          }
        }
        
        logger.info('Updating enhanced Coda document', {
          documentId: params.documentId,
          contentLength: finalContent.length,
          mode: params.mode || 'replace'
        });
        
        await codaIntegration.updateDoc(params.documentId, finalContent);
        
        const result = {
          documentId: params.documentId,
          contentLength: finalContent.length,
          originalContentLength: params.content.length,
          mode: params.mode || 'replace',
          timestamp: new Date().toISOString()
        };
        
        const endTime = Date.now();
        
        logger.info('Enhanced Coda document updated successfully', {
          documentId: params.documentId,
          mode: params.mode || 'replace',
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'enhanced_coda_update',
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
        
        logger.error('Error updating enhanced Coda document', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'enhanced_coda_update',
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error updating enhanced Coda document',
            code: 'ENHANCED_UPDATE_FAILED',
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
 * Enhanced List Coda Documents Tool - Advanced filtering and sorting
 */
export function createEnhancedCodaListTool(): Tool {
  return {
    id: 'enhanced_coda_list',
    name: 'Enhanced Coda List',
    description: 'List documents in the Coda workspace with advanced filtering and sorting options',
    category: ToolCategory.DOCUMENT,
    enabled: true,
    schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Optional limit on number of documents to return'
        },
        nameFilter: {
          type: 'string',
          description: 'Filter documents by name pattern (case-insensitive)'
        },
        sortBy: {
          type: 'string',
          description: 'Sort by: name, created, or updated',
          enum: ['name', 'created', 'updated']
        },
        sortOrder: {
          type: 'string',
          description: 'Sort order: asc or desc',
          enum: ['asc', 'desc']
        }
      }
    },
    metadata: {
      costEstimate: 1,
      usageLimit: 500,
      source: 'enhanced_implementation',
      version: '2.0.0',
      features: ['filtering', 'sorting', 'advanced-search']
    },
    execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const startTime = Date.now();
      
      try {
        const params = args as unknown as CodaEnhancedListParams;
        
        logger.info('Listing enhanced Coda documents', {
          limit: params.limit,
          nameFilter: params.nameFilter,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder
        });
        
        let docs = await codaIntegration.listDocs();
        
        // Apply name filter
        if (params.nameFilter) {
          const filter = params.nameFilter.toLowerCase();
          docs = docs.filter(doc => doc.name.toLowerCase().includes(filter));
        }
        
        // Apply sorting
        if (params.sortBy) {
          docs.sort((a, b) => {
            let aValue: string | Date;
            let bValue: string | Date;
            
            switch (params.sortBy) {
              case 'name':
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                break;
              case 'created':
                aValue = new Date(a.createdAt || 0);
                bValue = new Date(b.createdAt || 0);
                break;
              case 'updated':
                aValue = new Date(a.updatedAt || 0);
                bValue = new Date(b.updatedAt || 0);
                break;
              default:
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
            }
            
            let comparison = 0;
            if (aValue < bValue) comparison = -1;
            if (aValue > bValue) comparison = 1;
            
            return params.sortOrder === 'desc' ? -comparison : comparison;
          });
        }
        
        // Apply limit
        const totalCount = docs.length;
        if (params.limit && params.limit > 0) {
          docs = docs.slice(0, params.limit);
        }
        
        const results = docs.map(doc => ({
          id: doc.id,
          name: doc.name,
          browserLink: doc.browserLink,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        }));
        
        const result = {
          documents: results,
          totalCount,
          returnedCount: results.length,
          filters: {
            nameFilter: params.nameFilter,
            limit: params.limit
          },
          sorting: {
            sortBy: params.sortBy,
            sortOrder: params.sortOrder
          },
          timestamp: new Date().toISOString(),
          // Legacy format for backward compatibility
          legacyFormat: results.length > 0 
            ? results.map(doc => `${doc.name} (ID: ${doc.id})`).join('\n')
            : 'No documents found in the Coda workspace.'
        };
        
        const endTime = Date.now();
        
        logger.info('Enhanced Coda documents listed successfully', {
          totalDocs: totalCount,
          returnedDocs: results.length,
          filtered: !!params.nameFilter,
          sorted: !!params.sortBy,
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'enhanced_coda_list',
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
        
        logger.error('Error listing enhanced Coda documents', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: endTime - startTime
        });
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: 'enhanced_coda_list',
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error listing enhanced Coda documents',
            code: 'ENHANCED_LIST_FAILED',
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
 * Factory function to create all enhanced Coda tools
 */
export function createAllEnhancedCodaTools(): Tool[] {
  return [
    createEnhancedCodaDocumentTool(),
    createEnhancedCodaCreateTool(),
    createEnhancedCodaReadTool(),
    createEnhancedCodaUpdateTool(),
    createEnhancedCodaListTool()
  ];
} 