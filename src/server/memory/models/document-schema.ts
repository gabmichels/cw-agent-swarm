/**
 * Document memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema, BaseMetadataSchema } from './base-schema';

/**
 * Document source types
 */
export type DocumentSource = 
  | 'file_upload'
  | 'web'
  | 'api'
  | 'user_provided'
  | 'generated'
  | 'embedded';

/**
 * Document-specific metadata
 */
export interface DocumentMetadataSchema extends BaseMetadataSchema {
  // Document info
  title?: string;
  source: DocumentSource;
  contentType?: string;
  fileType?: string;
  url?: string;
  
  // Chunking info for large documents
  chunkIndex?: number;
  totalChunks?: number;
  parentDocumentId?: string;
  
  // File-specific metadata
  fileSize?: number;
  fileName?: string;
  lastModified?: string;
  
  // Web-specific metadata
  siteName?: string;
  author?: string;
  publishDate?: string;
}

/**
 * Document schema
 */
export interface DocumentSchema extends BaseMemorySchema {
  type: MemoryType.DOCUMENT;
  metadata: DocumentMetadataSchema;
}

/**
 * Default values for document schema
 */
export const DOCUMENT_DEFAULTS: Partial<DocumentSchema> = {
  type: MemoryType.DOCUMENT,
  metadata: {
    source: 'user_provided',
  }
}; 