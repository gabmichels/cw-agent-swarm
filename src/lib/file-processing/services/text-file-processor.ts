/**
 * Text File Processor Service
 * 
 * Processes text files by extracting content and splitting into chunks.
 */

import { FileChunk, FileMetadata, FileProcessingOptions, IFileTypeProcessor, ProcessedFile } from '../types';
import { ITextChunker } from '../types';
import { TextChunker } from './text-chunker';
import { AppError } from '../../../lib/errors/base';

/**
 * Error codes for text file processing operations
 */
export enum TextFileProcessorErrorCode {
  INVALID_INPUT = 'TEXT_FILE_PROCESSOR_INVALID_INPUT',
  PROCESSING_FAILED = 'TEXT_FILE_PROCESSOR_PROCESSING_FAILED',
  UNSUPPORTED_TYPE = 'TEXT_FILE_PROCESSOR_UNSUPPORTED_TYPE',
}

/**
 * Implementation of the IFileTypeProcessor interface for text files
 */
export class TextFileProcessor implements IFileTypeProcessor {
  /**
   * Text chunker service
   */
  private readonly textChunker: ITextChunker;
  
  /**
   * Constructor
   * 
   * @param textChunker Optional custom text chunker implementation
   */
  constructor(textChunker?: ITextChunker) {
    this.textChunker = textChunker || new TextChunker();
  }
  
  /**
   * Check if this processor can handle the given file type
   * 
   * @param mimeType MIME type of the file
   * @returns Whether the processor can handle the file
   */
  canProcess(mimeType: string): boolean {
    const supportedTypes = [
      'text/plain',
      'text/html',
      'text/markdown',
      'text/css',
      'text/csv',
      'text/javascript',
      'application/json',
      'application/xml',
      'application/javascript'
    ];
    
    return supportedTypes.includes(mimeType.toLowerCase()) || mimeType.startsWith('text/');
  }
  
  /**
   * Process a text file
   * 
   * @param fileBuffer Raw file content
   * @param metadata File metadata
   * @param options Processing options
   * @returns Processed file result
   * @throws AppError if processing fails
   */
  async processFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
    options: FileProcessingOptions
  ): Promise<ProcessedFile> {
    // Validate inputs
    if (!fileBuffer || !(fileBuffer instanceof Buffer)) {
      throw new AppError(
        'Invalid file buffer provided',
        TextFileProcessorErrorCode.INVALID_INPUT,
        { provided: fileBuffer ? typeof fileBuffer : 'null' }
      );
    }
    
    if (!this.canProcess(metadata.mimeType)) {
      throw new AppError(
        `Unsupported file type: ${metadata.mimeType}`,
        TextFileProcessorErrorCode.UNSUPPORTED_TYPE,
        { mimeType: metadata.mimeType }
      );
    }
    
    try {
      // Default options
      const chunkSize = options.chunkSize || 1000;
      const overlapSize = options.overlapSize || 200;
      
      // Extract text from the buffer
      const encoding = this.detectEncoding(fileBuffer);
      const text = fileBuffer.toString(encoding);
      
      // Apply custom formatters if specified
      let processedText = text;
      if (options.customFormatting && options.customExtractors && options.customExtractors[metadata.mimeType]) {
        processedText = options.customExtractors[metadata.mimeType](text);
      }
      
      // Chunk the text
      const textChunks = this.textChunker.chunkText(processedText, chunkSize, overlapSize);
      
      // Create chunks with metadata
      const chunks: FileChunk[] = textChunks.map((chunk, index) => ({
        text: chunk,
        index,
        metadata: {
          contentType: 'text' // Default content type
        }
      }));
      
      // Update metadata
      const updatedMetadata: FileMetadata = {
        ...metadata,
        processingStatus: 'completed',
        chunkCount: chunks.length
      };
      
      // Return processed file
      return {
        metadata: updatedMetadata,
        fullText: processedText,
        chunks
      };
    } catch (error) {
      // Update metadata to reflect failure
      metadata.processingStatus = 'failed';
      metadata.processingError = error instanceof Error 
        ? error.message 
        : 'Unknown error during text file processing';
      
      throw new AppError(
        `Failed to process text file: ${error instanceof Error ? error.message : String(error)}`,
        TextFileProcessorErrorCode.PROCESSING_FAILED,
        { filename: metadata.filename }
      );
    }
  }
  
  /**
   * Detect text encoding from buffer
   * 
   * @param buffer File buffer
   * @returns Detected encoding
   */
  private detectEncoding(buffer: Buffer): BufferEncoding {
    // Simple encoding detection
    // Look for UTF-8 BOM (Byte Order Mark)
    if (buffer.length >= 3 && 
        buffer[0] === 0xEF && 
        buffer[1] === 0xBB && 
        buffer[2] === 0xBF) {
      return 'utf8';
    }
    
    // Look for UTF-16 BOM
    if (buffer.length >= 2) {
      // UTF-16 LE
      if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return 'utf16le';
      }
      
      // UTF-16 BE
      if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return 'utf16le'; // Using utf16le as it's in the BufferEncoding type
      }
    }
    
    // Default to UTF-8 if no BOM is found
    return 'utf8';
  }
} 