/**
 * Document memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema } from './base-schema';
import { BaseMetadata, DocumentSource } from '../../../types/metadata';

/**
 * Document-specific metadata
 */
export interface DocumentMetadataSchema extends BaseMetadata {
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
    schemaVersion: "1.0.0",
    source: DocumentSource.USER,
  }
}; 