/**
 * File Processor Service
 * 
 * Main service for processing files of various types using specialized processors.
 */

import { 
  FileMetadata, 
  FileProcessingOptions, 
  IDocumentTypeDetector, 
  IFileMemoryStorage, 
  IFileMetadataStorage, 
  IFileProcessorService,
  IFileTypeProcessor, 
  ILanguageDetector,
  ISummaryGenerator,
  ProcessedFile
} from '../types';
import { AppError } from '../../../lib/errors/base';
import { TextFileProcessor } from './text-file-processor';
import { PdfFileProcessor } from './pdf-file-processor';
import { DocumentTypeDetector } from './document-type-detector';
import { LanguageDetector } from './language-detector';
import { BasicSummaryGenerator } from './summary-generator';
import { v4 as uuidv4 } from 'uuid';
import { StructuredId, IdGenerator } from '../../../utils/ulid';

/**
 * Generate a file ID using proper StructuredId
 */
const generateFileId = (): StructuredId => {
  return IdGenerator.generate('file');
};

/**
 * Error codes for file processor service operations
 */
export enum FileProcessorServiceErrorCode {
  INVALID_INPUT = 'FILE_PROCESSOR_SERVICE_INVALID_INPUT',
  PROCESSING_FAILED = 'FILE_PROCESSOR_SERVICE_PROCESSING_FAILED',
  METADATA_ERROR = 'FILE_PROCESSOR_SERVICE_METADATA_ERROR',
  UNSUPPORTED_TYPE = 'FILE_PROCESSOR_SERVICE_UNSUPPORTED_TYPE',
  STORAGE_ERROR = 'FILE_PROCESSOR_SERVICE_STORAGE_ERROR',
}

/**
 * Configuration for the file processor service
 */
export interface FileProcessorServiceConfig {
  /**
   * File processors for different file types
   */
  processors?: IFileTypeProcessor[];
  
  /**
   * Document type detector
   */
  documentTypeDetector?: IDocumentTypeDetector;
  
  /**
   * Language detector
   */
  languageDetector?: ILanguageDetector;
  
  /**
   * Summary generator
   */
  summaryGenerator?: ISummaryGenerator;
  
  /**
   * Metadata storage
   */
  metadataStorage?: IFileMetadataStorage;
  
  /**
   * Memory storage for processed files
   */
  memoryStorage?: IFileMemoryStorage;
  
  /**
   * Default processing options
   */
  defaultOptions?: FileProcessingOptions;
  
  /**
   * Schema version for metadata
   */
  schemaVersion?: string;
}

/**
 * Implementation of the IFileProcessorService interface
 */
export class FileProcessorService implements IFileProcessorService {
  /**
   * File processors for different file types
   */
  private readonly processors: IFileTypeProcessor[];
  
  /**
   * Document type detector
   */
  private readonly documentTypeDetector: IDocumentTypeDetector;
  
  /**
   * Language detector
   */
  private readonly languageDetector: ILanguageDetector;
  
  /**
   * Summary generator
   */
  private readonly summaryGenerator: ISummaryGenerator;
  
  /**
   * Metadata storage
   */
  private readonly metadataStorage: IFileMetadataStorage | null;
  
  /**
   * Memory storage
   */
  private readonly memoryStorage: IFileMemoryStorage | null;
  
  /**
   * Default processing options
   */
  private readonly defaultOptions: FileProcessingOptions;
  
  /**
   * Schema version for metadata
   */
  private readonly schemaVersion: string;
  
  /**
   * Constructor
   * 
   * @param config Service configuration
   */
  constructor(config: FileProcessorServiceConfig = {}) {
    // Initialize processors
    this.processors = config.processors || [
      new TextFileProcessor(),
      new PdfFileProcessor()
    ];
    
    // Initialize other services
    this.documentTypeDetector = config.documentTypeDetector || new DocumentTypeDetector();
    this.languageDetector = config.languageDetector || new LanguageDetector();
    this.summaryGenerator = config.summaryGenerator || new BasicSummaryGenerator();
    
    // Initialize storage
    this.metadataStorage = config.metadataStorage || null;
    this.memoryStorage = config.memoryStorage || null;
    
    // Set defaults
    this.defaultOptions = config.defaultOptions || {
      chunkSize: 1000,
      overlapSize: 200,
      summarize: true
    };
    
    this.schemaVersion = config.schemaVersion || '1.0.0';
  }
  
  /**
   * Process a file and return the result
   * 
   * @param fileBuffer File content buffer
   * @param fileMetadata File metadata without system fields
   * @param options Processing options
   * @returns Processed file metadata and text
   * @throws AppError if processing fails
   */
  async processFile(
    fileBuffer: Buffer,
    fileMetadata: Omit<FileMetadata, 'id' | 'createdAt' | 'processingStatus' | 'schemaVersion'>,
    options?: FileProcessingOptions
  ): Promise<{ metadata: FileMetadata, fullText: string | null }> {
    // Validate inputs
    if (!fileBuffer || !(fileBuffer instanceof Buffer)) {
      throw new AppError(
        'Invalid file buffer provided',
        FileProcessorServiceErrorCode.INVALID_INPUT,
        { provided: fileBuffer ? typeof fileBuffer : 'null' }
      );
    }
    
    if (!fileMetadata || !fileMetadata.mimeType || !fileMetadata.filename) {
      throw new AppError(
        'Invalid file metadata provided',
        FileProcessorServiceErrorCode.INVALID_INPUT,
        { provided: fileMetadata ? 'Incomplete metadata' : 'null' }
      );
    }
    
    // Prepare complete metadata with system fields
    const completeMetadata: FileMetadata = {
      ...fileMetadata,
      id: generateFileId(),
      createdAt: new Date(),
      processingStatus: 'pending',
      schemaVersion: this.schemaVersion
    };
    
    try {
      // Find appropriate processor for the file type
      const processor = this.findProcessor(completeMetadata.mimeType);
      
      if (!processor) {
        throw new AppError(
          `No processor available for file type: ${completeMetadata.mimeType}`,
          FileProcessorServiceErrorCode.UNSUPPORTED_TYPE,
          { mimeType: completeMetadata.mimeType }
        );
      }
      
      // Update status to processing
      completeMetadata.processingStatus = 'processing';
      
      // Merge options with defaults
      const mergedOptions = {
        ...this.defaultOptions,
        ...options
      };
      
      // Process the file
      const processedFile = await processor.processFile(
        fileBuffer,
        completeMetadata,
        mergedOptions
      );
      
      // Detect document type and language
      if (processedFile.fullText) {
        // Detect document type if not already set
        if (!processedFile.metadata.documentType) {
          processedFile.metadata.documentType = this.documentTypeDetector.detectDocumentType(
            processedFile.fullText,
            processedFile.metadata.filename,
            processedFile.metadata.extractedMetadata
          );
        }
        
        // Detect language if not already set
        if (!processedFile.metadata.language) {
          processedFile.metadata.language = this.languageDetector.detectLanguage(
            processedFile.fullText
          );
        }
        
        // Generate summary if requested
        if (mergedOptions.summarize && !processedFile.metadata.summary) {
          processedFile.metadata.summary = await this.summaryGenerator.generateSummary(
            processedFile
          );
        }
      }
      
      // Store in metadata storage if available
      if (this.metadataStorage) {
        try {
          await this.metadataStorage.saveFileMetadata(processedFile.metadata);
        } catch (error) {
          console.error('Failed to save file metadata:', error);
          // Don't fail the whole process for metadata storage errors
        }
      }
      
      // Store in memory storage if available
      if (this.memoryStorage) {
        try {
          await this.memoryStorage.storeFileInMemory(processedFile);
        } catch (error) {
          console.error('Failed to store file in memory:', error);
          // Don't fail the whole process for memory storage errors
        }
      }
      
      // Return the processed file metadata and text
      return {
        metadata: processedFile.metadata,
        fullText: processedFile.fullText
      };
    } catch (error) {
      // Update metadata to reflect failure
      completeMetadata.processingStatus = 'failed';
      completeMetadata.processingError = error instanceof Error 
        ? error.message 
        : 'Unknown error during file processing';
      
      // Try to save failed metadata
      if (this.metadataStorage) {
        try {
          await this.metadataStorage.saveFileMetadata(completeMetadata);
        } catch (storageError) {
          console.error('Failed to save error metadata:', storageError);
        }
      }
      
      throw new AppError(
        `Failed to process file: ${error instanceof Error ? error.message : String(error)}`,
        FileProcessorServiceErrorCode.PROCESSING_FAILED,
        { filename: completeMetadata.filename }
      );
    }
  }
  
  /**
   * Get metadata for a processed file
   * 
   * @param fileId File ID
   * @returns File metadata or null if not found
   * @throws AppError if metadata storage is not available
   */
  async getFileMetadata(fileId: string | StructuredId): Promise<FileMetadata | null> {
    if (!this.metadataStorage) {
      throw new AppError(
        'Metadata storage not available',
        FileProcessorServiceErrorCode.METADATA_ERROR
      );
    }
    
    try {
      return await this.metadataStorage.getFileMetadata(fileId);
    } catch (error) {
      throw new AppError(
        `Failed to get file metadata: ${error instanceof Error ? error.message : String(error)}`,
        FileProcessorServiceErrorCode.METADATA_ERROR,
        { fileId: typeof fileId === 'string' ? fileId : fileId }
      );
    }
  }
  
  /**
   * Get metadata for all processed files
   * 
   * @returns Record of file IDs to metadata
   * @throws AppError if metadata storage is not available
   */
  async getAllFileMetadata(): Promise<Record<string, FileMetadata>> {
    if (!this.metadataStorage) {
      throw new AppError(
        'Metadata storage not available',
        FileProcessorServiceErrorCode.METADATA_ERROR
      );
    }
    
    try {
      return await this.metadataStorage.getAllFileMetadata();
    } catch (error) {
      throw new AppError(
        `Failed to get all file metadata: ${error instanceof Error ? error.message : String(error)}`,
        FileProcessorServiceErrorCode.METADATA_ERROR
      );
    }
  }
  
  /**
   * Delete a processed file and its metadata
   * 
   * @param fileId File ID
   * @returns Whether the deletion was successful
   * @throws AppError if metadata storage is not available
   */
  async deleteFile(fileId: string | StructuredId): Promise<boolean> {
    if (!this.metadataStorage) {
      throw new AppError(
        'Metadata storage not available',
        FileProcessorServiceErrorCode.METADATA_ERROR
      );
    }
    
    try {
      return await this.metadataStorage.deleteFileMetadata(fileId);
    } catch (error) {
      throw new AppError(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
        FileProcessorServiceErrorCode.METADATA_ERROR,
        { fileId: typeof fileId === 'string' ? fileId : fileId }
      );
    }
  }
  
  /**
   * Find an appropriate processor for the given MIME type
   * 
   * @param mimeType MIME type
   * @returns Processor or null if none found
   */
  private findProcessor(mimeType: string): IFileTypeProcessor | null {
    return this.processors.find(processor => processor.canProcess(mimeType)) || null;
  }
} 