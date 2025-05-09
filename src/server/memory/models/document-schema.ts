/**
 * Document memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema } from './base-schema';
import { DocumentMetadata, DocumentSource } from '../../../types/metadata';

/**
 * Document schema
 */
export interface DocumentSchema extends BaseMemorySchema {
  type: MemoryType.DOCUMENT;
  metadata: DocumentMetadata;
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