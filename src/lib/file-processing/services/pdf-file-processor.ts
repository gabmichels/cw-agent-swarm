/**
 * PDF File Processor Service
 * 
 * Processes PDF files by extracting text content and metadata.
 */

import { FileChunk, FileMetadata, FileProcessingOptions, IFileTypeProcessor, ProcessedFile } from '../types';
import { ITextChunker } from '../types';
import { TextChunker } from './text-chunker';
import { AppError } from '../../../lib/errors/base';

/**
 * Error codes for PDF file processing operations
 */
export enum PdfFileProcessorErrorCode {
  INVALID_INPUT = 'PDF_FILE_PROCESSOR_INVALID_INPUT',
  PROCESSING_FAILED = 'PDF_FILE_PROCESSOR_PROCESSING_FAILED',
  PARSER_NOT_AVAILABLE = 'PDF_FILE_PROCESSOR_PARSER_NOT_AVAILABLE',
  EXTRACTION_FAILED = 'PDF_FILE_PROCESSOR_EXTRACTION_FAILED',
  UNSUPPORTED_TYPE = 'PDF_FILE_PROCESSOR_UNSUPPORTED_TYPE',
}

/**
 * PDF parse result interface
 */
interface PdfParseResult {
  numpages: number;
  numrender: number;
  info: Record<string, unknown>;
  metadata: Record<string, unknown>;
  text: string;
  version: string;
}

/**
 * PDF parser function type
 */
type PdfParseFunction = (
  dataBuffer: Buffer, 
  options?: {
    max?: number;
    pagerender?: (pageData: {
      pageIndex: number;
      pageId: string | number;
      pageContent: string;
    }) => string;
  }
) => Promise<PdfParseResult>;

/**
 * Implementation of the IFileTypeProcessor interface for PDF files
 */
export class PdfFileProcessor implements IFileTypeProcessor {
  /**
   * Text chunker service
   */
  private readonly textChunker: ITextChunker;
  
  /**
   * PDF parser function
   */
  private readonly pdfParse: PdfParseFunction | null;
  
  /**
   * Constructor
   * 
   * @param pdfParse Optional PDF parser function
   * @param textChunker Optional custom text chunker implementation
   */
  constructor(pdfParse?: PdfParseFunction | null, textChunker?: ITextChunker) {
    // Try to load pdf-parse dynamically if not provided
    if (pdfParse === undefined) {
      try {
        // Load pdf-parse dynamically
        this.pdfParse = require('pdf-parse');
      } catch (error) {
        console.warn('pdf-parse module not found or failed to load. PDF processing will be limited.');
        this.pdfParse = null;
      }
    } else {
      this.pdfParse = pdfParse;
    }
    
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
      'application/pdf',
      'application/x-pdf',
      'application/acrobat',
      'application/vnd.pdf'
    ];
    
    return supportedTypes.includes(mimeType.toLowerCase());
  }
  
  /**
   * Process a PDF file
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
        PdfFileProcessorErrorCode.INVALID_INPUT,
        { provided: fileBuffer ? typeof fileBuffer : 'null' }
      );
    }
    
    if (!this.canProcess(metadata.mimeType)) {
      throw new AppError(
        `Unsupported file type: ${metadata.mimeType}`,
        PdfFileProcessorErrorCode.UNSUPPORTED_TYPE,
        { mimeType: metadata.mimeType }
      );
    }
    
    // Check if PDF parser is available
    if (!this.pdfParse) {
      throw new AppError(
        'PDF parser not available',
        PdfFileProcessorErrorCode.PARSER_NOT_AVAILABLE
      );
    }
    
    try {
      // Default options
      const chunkSize = options.chunkSize || 1000;
      const overlapSize = options.overlapSize || 200;
      
      // Parse PDF
      const pdfData = await this.extractPdfContent(fileBuffer);
      
      // Extract text
      const text = pdfData.text || '';
      
      // Extract metadata
      const extractedMetadata = {
        ...pdfData.info,
        ...pdfData.metadata,
        pageCount: pdfData.numpages
      };
      
      // Chunk the text
      const textChunks = this.textChunker.chunkText(text, chunkSize, overlapSize);
      
      // Create chunks with metadata
      const chunks: FileChunk[] = textChunks.map((chunk, index) => ({
        text: chunk,
        index,
        metadata: {
          contentType: 'text'
          // Note: In a more sophisticated implementation, we could include
          // page numbers based on chunk position relative to the PDF pages
        }
      }));
      
      // Update metadata
      const updatedMetadata: FileMetadata = {
        ...metadata,
        processingStatus: 'completed',
        chunkCount: chunks.length,
        extractedMetadata
      };
      
      // Return processed file
      return {
        metadata: updatedMetadata,
        fullText: text,
        chunks
      };
    } catch (error) {
      // Update metadata to reflect failure
      metadata.processingStatus = 'failed';
      metadata.processingError = error instanceof Error 
        ? error.message 
        : 'Unknown error during PDF processing';
      
      throw new AppError(
        `Failed to process PDF file: ${error instanceof Error ? error.message : String(error)}`,
        PdfFileProcessorErrorCode.PROCESSING_FAILED,
        { filename: metadata.filename }
      );
    }
  }
  
  /**
   * Extract text and metadata from a PDF file
   * 
   * @param buffer PDF file buffer
   * @returns Extracted content and metadata
   * @throws AppError if extraction fails
   */
  private async extractPdfContent(buffer: Buffer): Promise<PdfParseResult> {
    try {
      if (!this.pdfParse) {
        throw new Error('PDF parser not available');
      }
      
      // Parse PDF content
      const result = await this.pdfParse(buffer, {
        // Custom page renderer to preserve page breaks
        pagerender: (pageData) => {
          return `${pageData.pageContent}\n--- Page ${pageData.pageIndex + 1} ---\n`;
        }
      });
      
      return result;
    } catch (error) {
      throw new AppError(
        `Failed to extract PDF content: ${error instanceof Error ? error.message : String(error)}`,
        PdfFileProcessorErrorCode.EXTRACTION_FAILED
      );
    }
  }
} 