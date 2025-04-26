import * as fs from 'fs';
import * as path from 'path';
import { EnhancedMemory } from '../memory/src/enhanced-memory';

/**
 * FileProcessor utility
 * 
 * Handles processing of different file types and stores them in memory
 * Supports text files, PDFs, Word documents, and images
 */

export interface FileMetadata {
  fileId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  uploadDate: Date;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  summary?: string;
  processingModel?: string;
  chunkCount?: number;
  tags?: string[];
}

export interface ProcessedFile {
  metadata: FileMetadata;
  chunks: {
    text: string;
    index: number;
    metadata: {
      page?: number;
      section?: string;
      contentType?: 'text' | 'table' | 'image' | 'code';
    };
  }[];
}

// Store file metadata in a local JSON file
const FILE_METADATA_DIR = path.join(process.cwd(), 'data', 'files');
const FILE_METADATA_PATH = path.join(FILE_METADATA_DIR, 'file_metadata.json');

/**
 * FileProcessor class
 */
export class FileProcessor {
  private enhancedMemory: EnhancedMemory | null = null;
  private fileMetadata: Record<string, FileMetadata> = {};
  private initialized: boolean = false;

  constructor(enhancedMemory?: EnhancedMemory) {
    if (enhancedMemory) {
      this.enhancedMemory = enhancedMemory;
    }
  }

  /**
   * Check if the file processor is initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Initialize the file processor
   */
  async initialize(): Promise<boolean> {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(FILE_METADATA_DIR)) {
        fs.mkdirSync(FILE_METADATA_DIR, { recursive: true });
      }

      // Load existing file metadata
      if (fs.existsSync(FILE_METADATA_PATH)) {
        const data = fs.readFileSync(FILE_METADATA_PATH, 'utf8');
        this.fileMetadata = JSON.parse(data);
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize file processor:', error);
      return false;
    }
  }

  /**
   * Set the enhanced memory instance
   */
  setEnhancedMemory(memory: EnhancedMemory): void {
    this.enhancedMemory = memory;
  }

  /**
   * Process a file and store it in memory
   */
  async processFile(
    fileBuffer: Buffer,
    fileMetadata: Omit<FileMetadata, 'fileId' | 'uploadDate' | 'processingStatus'>,
    options: {
      modelOverride?: string;
      chunkSize?: number;
      overlapSize?: number;
      extractEntities?: boolean;
    } = {}
  ): Promise<FileMetadata> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Generate a unique file ID
    const fileId = `file_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Create metadata record
    const metadata: FileMetadata = {
      fileId,
      filename: fileMetadata.filename,
      originalFilename: fileMetadata.originalFilename,
      mimeType: fileMetadata.mimeType,
      size: fileMetadata.size,
      uploadDate: new Date(),
      processingStatus: 'processing',
      processingModel: options.modelOverride || this.determineModelForFile(fileMetadata.mimeType),
      tags: fileMetadata.tags || []
    };

    // Save metadata
    this.fileMetadata[fileId] = metadata;
    await this.saveFileMetadata();

    try {
      let processedFile: ProcessedFile | null = null;

      // Process different file types
      if (fileMetadata.mimeType.startsWith('text/')) {
        processedFile = await this.processTextFile(fileBuffer, metadata, options);
      } else if (fileMetadata.mimeType === 'application/pdf') {
        processedFile = await this.processPdfFile(fileBuffer, metadata, options);
      } else if (fileMetadata.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        processedFile = await this.processDocxFile(fileBuffer, metadata, options);
      } else if (fileMetadata.mimeType.startsWith('image/')) {
        processedFile = await this.processImageFile(fileBuffer, metadata, options);
      } else {
        throw new Error(`Unsupported file type: ${fileMetadata.mimeType}`);
      }

      if (!processedFile) {
        throw new Error('File processing failed');
      }

      // Update metadata with successful processing
      metadata.processingStatus = 'completed';
      metadata.chunkCount = processedFile.chunks.length;
      
      // Generate summary if we have enough content
      if (processedFile.chunks.length > 0) {
        metadata.summary = await this.generateFileSummary(processedFile);
      }

      // Store in memory if we have an enhanced memory instance
      if (this.enhancedMemory) {
        await this.storeFileInMemory(processedFile);
      }

      // Update metadata
      this.fileMetadata[fileId] = metadata;
      await this.saveFileMetadata();

      return metadata;
    } catch (error: any) {
      // Update metadata with failure
      metadata.processingStatus = 'failed';
      metadata.processingError = error.message || 'Unknown error';
      
      // Save updated metadata
      this.fileMetadata[fileId] = metadata;
      await this.saveFileMetadata();
      
      console.error(`Error processing file ${fileId}:`, error);
      return metadata;
    }
  }

  /**
   * Get all file metadata
   */
  getAllFiles(): FileMetadata[] {
    return Object.values(this.fileMetadata);
  }

  /**
   * Get file metadata by ID
   */
  getFileById(fileId: string): FileMetadata | null {
    return this.fileMetadata[fileId] || null;
  }

  /**
   * Delete a file from memory
   */
  async deleteFile(fileId: string): Promise<boolean> {
    if (!this.fileMetadata[fileId]) {
      return false;
    }

    // Remove file metadata
    delete this.fileMetadata[fileId];
    await this.saveFileMetadata();

    // TODO: Remove file chunks from memory
    // This will be implemented when we have a way to delete specific memories

    return true;
  }

  /**
   * Process a text file
   */
  private async processTextFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
    options: any
  ): Promise<ProcessedFile> {
    const text = fileBuffer.toString('utf8');
    const chunks = this.chunkText(text, options.chunkSize || 1000, options.overlapSize || 200);
    
    return {
      metadata,
      chunks: chunks.map((chunk, index) => ({
        text: chunk,
        index,
        metadata: {
          contentType: 'text'
        }
      }))
    };
  }

  /**
   * Process a PDF file
   * This is a placeholder - in a real implementation we would use a PDF parsing library
   */
  private async processPdfFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
    options: any
  ): Promise<ProcessedFile> {
    // In a real implementation, we would use pdf.js or a similar library
    // For now, we'll just simulate processing with a placeholder
    console.log(`Processing PDF file: ${metadata.filename}`);
    
    // Placeholder implementation
    return {
      metadata,
      chunks: [{
        text: `This is a placeholder for PDF content from ${metadata.filename}. In a real implementation, we would extract text and parse the PDF structure.`,
        index: 0,
        metadata: {
          contentType: 'text',
          page: 1
        }
      }]
    };
  }

  /**
   * Process a DOCX file
   * This is a placeholder - in a real implementation we would use a DOCX parsing library
   */
  private async processDocxFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
    options: any
  ): Promise<ProcessedFile> {
    // In a real implementation, we would use mammoth.js or a similar library
    // For now, we'll just simulate processing with a placeholder
    console.log(`Processing DOCX file: ${metadata.filename}`);
    
    // Placeholder implementation
    return {
      metadata,
      chunks: [{
        text: `This is a placeholder for DOCX content from ${metadata.filename}. In a real implementation, we would extract text and parse the document structure.`,
        index: 0,
        metadata: {
          contentType: 'text'
        }
      }]
    };
  }

  /**
   * Process an image file
   * This is a placeholder - in a real implementation we would use OCR or a vision model
   */
  private async processImageFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
    options: any
  ): Promise<ProcessedFile> {
    // In a real implementation, we would use a vision model or OCR
    // For now, we'll just simulate processing with a placeholder
    console.log(`Processing image file: ${metadata.filename}`);
    
    // Placeholder implementation
    return {
      metadata,
      chunks: [{
        text: `This is a placeholder for image content from ${metadata.filename}. In a real implementation, we would use a vision model to describe the image.`,
        index: 0,
        metadata: {
          contentType: 'image'
        }
      }]
    };
  }

  /**
   * Split text into chunks with overlap
   */
  private chunkText(text: string, chunkSize: number, overlapSize: number): string[] {
    const chunks: string[] = [];
    
    if (text.length <= chunkSize) {
      chunks.push(text);
      return chunks;
    }
    
    let startIndex = 0;
    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      chunks.push(text.slice(startIndex, endIndex));
      startIndex = endIndex - overlapSize;
      
      if (startIndex < 0 || startIndex >= text.length) {
        break;
      }
    }
    
    return chunks;
  }

  /**
   * Generate a summary of the file
   */
  private async generateFileSummary(file: ProcessedFile): Promise<string> {
    // In a real implementation, we would use an LLM to generate a summary
    // For now, we'll just create a simple summary based on the first chunk
    
    if (file.chunks.length === 0) {
      return 'Empty file';
    }
    
    const firstChunk = file.chunks[0].text;
    const words = firstChunk.split(/\s+/).slice(0, 30).join(' ');
    
    return `${words}... (${file.chunks.length} chunks total)`;
  }

  /**
   * Store file chunks in memory
   */
  private async storeFileInMemory(file: ProcessedFile): Promise<void> {
    if (!this.enhancedMemory) {
      console.warn('No enhanced memory instance available to store file');
      return;
    }
    
    const { metadata, chunks } = file;
    
    // Store each chunk as a separate memory
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      await this.enhancedMemory.addMemory(
        chunk.text,
        {
          type: 'file_content',
          importance: 'medium',
          category: 'document',
          created: metadata.uploadDate.toISOString(),
          fileId: metadata.fileId,
          filename: metadata.filename,
          chunkIndex: i,
          totalChunks: chunks.length,
          contentType: chunk.metadata.contentType || 'text',
          mimeType: metadata.mimeType,
          tags: metadata.tags || []
        },
        'document'
      );
    }
    
    // Store file metadata as a separate memory
    await this.enhancedMemory.addMemory(
      `File: ${metadata.filename} (${metadata.mimeType}, ${this.formatFileSize(metadata.size)})${metadata.summary ? `\nSummary: ${metadata.summary}` : ''}`,
      {
        type: 'file_metadata',
        importance: 'high',
        category: 'document',
        created: metadata.uploadDate.toISOString(),
        fileId: metadata.fileId,
        filename: metadata.filename,
        mimeType: metadata.mimeType,
        size: metadata.size,
        tags: metadata.tags || []
      },
      'document'
    );
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} bytes`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
  }

  /**
   * Determine the best model to use for processing
   */
  private determineModelForFile(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'gemini-pro-vision'; // For images
    } else if (mimeType === 'application/pdf' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return 'claude-3-sonnet'; // For complex documents
    } else {
      return 'claude-3-haiku'; // For simple text
    }
  }
  
  /**
   * Save file metadata to disk
   */
  private async saveFileMetadata(): Promise<void> {
    try {
      if (!fs.existsSync(FILE_METADATA_DIR)) {
        fs.mkdirSync(FILE_METADATA_DIR, { recursive: true });
      }
      
      fs.writeFileSync(
        FILE_METADATA_PATH,
        JSON.stringify(this.fileMetadata, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Error saving file metadata:', error);
    }
  }
}

// Export singleton instance
export const fileProcessor = new FileProcessor();

// Export factory function
export function createFileProcessor(enhancedMemory?: EnhancedMemory): FileProcessor {
  return new FileProcessor(enhancedMemory);
} 