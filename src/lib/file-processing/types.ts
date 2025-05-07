/**
 * File Processing System Types
 * 
 * This module defines the interfaces and types for the modular file processing system.
 * Following interface-first design principles for the architecture refactoring.
 */

import { StructuredId } from '../../utils/ulid';

/**
 * File metadata containing information about a processed file
 */
export interface FileMetadata {
  /**
   * Unique identifier for the file
   */
  id: StructuredId;
  
  /**
   * Display filename
   */
  filename: string;
  
  /**
   * Original filename before processing
   */
  originalFilename: string;
  
  /**
   * MIME type of the file
   */
  mimeType: string;
  
  /**
   * Size of the file in bytes
   */
  size: number;
  
  /**
   * When the file was uploaded/processed
   */
  createdAt: Date;
  
  /**
   * Processing status
   */
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  
  /**
   * Error message if processing failed
   */
  processingError?: string;
  
  /**
   * Generated summary of the file contents
   */
  summary?: string;
  
  /**
   * Model used for processing
   */
  processingModel?: string;
  
  /**
   * Number of chunks the file was split into
   */
  chunkCount?: number;
  
  /**
   * Tags associated with the file
   */
  tags?: string[];
  
  /**
   * Extracted metadata from the file (e.g., PDF metadata)
   */
  extractedMetadata?: Record<string, unknown>;
  
  /**
   * Type of document (e.g., 'report', 'invoice', etc.)
   */
  documentType?: string;
  
  /**
   * Detected language of the content
   */
  language?: string;
  
  /**
   * Schema version for this metadata
   */
  schemaVersion: string;
}

/**
 * Options for file processing
 */
export interface FileProcessingOptions {
  /**
   * Override the model used for processing
   */
  modelOverride?: string;
  
  /**
   * Size of each chunk in characters
   * @default 1000
   */
  chunkSize?: number;
  
  /**
   * Size of the overlap between chunks in characters
   * @default 200
   */
  overlapSize?: number;
  
  /**
   * Whether to extract entities from the text
   */
  extractEntities?: boolean;
  
  /**
   * Whether to apply custom formatting
   */
  customFormatting?: boolean;
  
  /**
   * Custom extractors for specific content types
   */
  customExtractors?: Record<string, (content: string) => string>;
  
  /**
   * Whether to include metadata in the result
   */
  includeMetadata?: boolean;
  
  /**
   * Whether to generate a summary
   */
  summarize?: boolean;
}

/**
 * Chunk of text from a processed file
 */
export interface FileChunk {
  /**
   * Chunk content
   */
  text: string;
  
  /**
   * Index of the chunk in the file
   */
  index: number;
  
  /**
   * Metadata about the chunk
   */
  metadata: {
    /**
     * Page number for PDF files
     */
    page?: number;
    
    /**
     * Section name or identifier
     */
    section?: string;
    
    /**
     * Type of content in the chunk
     */
    contentType?: 'text' | 'table' | 'image' | 'code';
  };
}

/**
 * Result of processing a file
 */
export interface ProcessedFile {
  /**
   * File metadata
   */
  metadata: FileMetadata;
  
  /**
   * Full extracted text
   */
  fullText: string;
  
  /**
   * Chunks of text from the file
   */
  chunks: FileChunk[];
}

/**
 * Interface for file processors that handle specific file types
 */
export interface IFileTypeProcessor {
  /**
   * Check if this processor can handle the given file type
   */
  canProcess(mimeType: string): boolean;
  
  /**
   * Process a file of the supported type
   */
  processFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
    options: FileProcessingOptions
  ): Promise<ProcessedFile>;
}

/**
 * Interface for text chunking service
 */
export interface ITextChunker {
  /**
   * Split text into chunks with optional overlap
   */
  chunkText(
    text: string, 
    chunkSize: number, 
    overlapSize: number
  ): string[];
}

/**
 * Interface for document type detection service
 */
export interface IDocumentTypeDetector {
  /**
   * Detect the type of document based on content and filename
   */
  detectDocumentType(
    content: string, 
    filename: string, 
    metadata?: Record<string, unknown>
  ): string;
}

/**
 * Interface for language detection service
 */
export interface ILanguageDetector {
  /**
   * Detect the language of the text
   */
  detectLanguage(text: string): string;
}

/**
 * Interface for summary generation service
 */
export interface ISummaryGenerator {
  /**
   * Generate a summary of the file
   */
  generateSummary(file: ProcessedFile): Promise<string>;
}

/**
 * Interface for file metadata storage service
 */
export interface IFileMetadataStorage {
  /**
   * Get metadata for a file by ID
   */
  getFileMetadata(fileId: string | StructuredId): Promise<FileMetadata | null>;
  
  /**
   * Get metadata for all files
   */
  getAllFileMetadata(): Promise<Record<string, FileMetadata>>;
  
  /**
   * Save metadata for a file
   */
  saveFileMetadata(metadata: FileMetadata): Promise<void>;
  
  /**
   * Delete metadata for a file
   */
  deleteFileMetadata(fileId: string | StructuredId): Promise<boolean>;
}

/**
 * Interface for memory storage service that stores processed files
 */
export interface IFileMemoryStorage {
  /**
   * Store file chunks in memory
   */
  storeFileInMemory(file: ProcessedFile): Promise<void>;
}

/**
 * Main file processing service interface
 */
export interface IFileProcessorService {
  /**
   * Process a file and return the result
   */
  processFile(
    fileBuffer: Buffer,
    fileMetadata: Omit<FileMetadata, 'id' | 'createdAt' | 'processingStatus' | 'schemaVersion'>,
    options?: FileProcessingOptions
  ): Promise<{ metadata: FileMetadata, fullText: string | null }>;
  
  /**
   * Get metadata for a processed file
   */
  getFileMetadata(fileId: string | StructuredId): Promise<FileMetadata | null>;
  
  /**
   * Get metadata for all processed files
   */
  getAllFileMetadata(): Promise<Record<string, FileMetadata>>;
  
  /**
   * Delete a processed file and its metadata
   */
  deleteFile(fileId: string | StructuredId): Promise<boolean>;
} 