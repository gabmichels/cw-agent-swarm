import * as fs from 'fs';
import * as path from 'path';
import { EnhancedMemory } from '../memory/src/enhanced-memory';

// Define types for the libraries
interface PdfParse {
  (dataBuffer: Buffer, options?: any): Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }>;
}

interface Mammoth {
  convertToHtml: (options: {
    // Use any for buffer to avoid type conflicts
    buffer: any; 
    styleMap?: string;
  }) => Promise<{
    value: string;
    messages: any[];
  }>;
}

// Import extraction libraries with error handling
// Use dynamic imports to handle potential missing libraries
let pdfParse: PdfParse | null = null;
let mammothLib: Mammoth | null = null;

// Try to load pdf-parse
try {
  // Load pdf-parse dynamically
  pdfParse = require('pdf-parse');
} catch (error) {
  console.warn('pdf-parse module not found or failed to load. PDF processing will be limited.');
}

// Try to load mammoth
try {
  // Load mammoth dynamically
  mammothLib = require('mammoth');
} catch (error) {
  console.warn('mammoth module not found or failed to load. DOCX processing will be limited.');
}

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
  // Add fields for extracted content/metadata if not storing separately
  extractedText?: string; // Store full extracted text temporarily or pass it back
  extractedMetadata?: Record<string, any>; // Store extracted PDF metadata etc.
  documentType?: string; // Added field for document classification
  language?: string; // Language of the document content
}

export interface ProcessedFile {
  metadata: FileMetadata;
  fullText: string; // Add full extracted text
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
        // Convert date strings back to Date objects if necessary
         Object.values(this.fileMetadata).forEach(meta => {
             if (meta.uploadDate && typeof meta.uploadDate === 'string') {
                 meta.uploadDate = new Date(meta.uploadDate);
             }
         });
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
   * Process a file, extract text, chunk, summarize, and store in memory
   * Returns updated metadata AND the full extracted text
   */
  async processFile(
    fileBuffer: Buffer,
    fileMetadataInput: Omit<FileMetadata, 'fileId' | 'uploadDate' | 'processingStatus' | 'extractedText' | 'extractedMetadata'>,
    options: {
      modelOverride?: string;
      chunkSize?: number;
      overlapSize?: number;
      extractEntities?: boolean;
    } = {}
  ): Promise<{ metadata: FileMetadata, fullText: string | null }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const fileId = `file_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Create initial metadata record
    const metadata: FileMetadata = {
      fileId,
      ...fileMetadataInput,
      uploadDate: new Date(),
      processingStatus: 'processing',
      processingModel: options.modelOverride || this.determineModelForFile(fileMetadataInput.mimeType),
      tags: fileMetadataInput.tags || []
    };

    this.fileMetadata[fileId] = metadata;
    await this.saveFileMetadata();

    let fullText: string | null = null;
    let processedFile: ProcessedFile | null = null;

    try {
      // Process different file types
      if (metadata.mimeType.startsWith('text/')) {
        processedFile = await this.processTextFile(fileBuffer, metadata, options);
      } else if (metadata.mimeType === 'application/pdf') {
        processedFile = await this.processPdfFile(fileBuffer, metadata, options);
      } else if (metadata.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        processedFile = await this.processDocxFile(fileBuffer, metadata, options);
      } else if (metadata.mimeType.startsWith('image/')) {
        processedFile = await this.processImageFile(fileBuffer, metadata, options);
      } else {
        throw new Error(`Unsupported file type: ${metadata.mimeType}`);
      }

      if (!processedFile) {
        throw new Error('File processing returned null');
      }

      // Update metadata with successful processing
      metadata.processingStatus = 'completed';
      metadata.chunkCount = processedFile.chunks.length;
      metadata.extractedMetadata = processedFile.metadata.extractedMetadata; // Store extracted metadata
      fullText = processedFile.fullText; // Get full text
      
      // Generate summary
      if (processedFile.chunks.length > 0) {
        metadata.summary = await this.generateFileSummary(processedFile);
      }

      // Store chunks in memory if enabled
      if (this.enhancedMemory) {
        await this.storeFileInMemory(processedFile);
      }

      // Update metadata in our store
      this.fileMetadata[fileId] = metadata;
      await this.saveFileMetadata();

      return { metadata, fullText }; // Return metadata and full text

    } catch (error: any) {
      // Update metadata with failure
      metadata.processingStatus = 'failed' as const;
      metadata.processingError = error.message || 'Unknown error';
      
      this.fileMetadata[fileId] = metadata;
      await this.saveFileMetadata();
      
      console.error(`Error processing file ${fileId}:`, error);
      return { metadata, fullText: null }; // Return metadata even on failure
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
    if (this.enhancedMemory) {
        try {
            // This requires a method in EnhancedMemory to delete by metadata filter
            // await this.enhancedMemory.deleteMemoriesByFilter({ fileId: fileId });
            console.warn(`Deletion from vector store for file ${fileId} not yet implemented.`);
        } catch (error) {
            console.error(`Failed to delete memory chunks for file ${fileId}:`, error);
        }
    }

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
    
    // Detect document type based on content and extension
    const documentType = this.detectDocumentType(text, metadata.filename);
    
    // Detect language
    const language = this.detectLanguage(text);
    
    // Update metadata with detected document type and language
    const updatedMetadata = {
      ...metadata,
      documentType,
      language
    };
    
    return {
      metadata: updatedMetadata,
      fullText: text,
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
   * Process a PDF file using pdf-parse
   */
  private async processPdfFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
    options: any
  ): Promise<ProcessedFile> {
    try {
      console.log(`Processing PDF file: ${metadata.filename}`);
      
      // Check if pdf-parse module is available
      if (!pdfParse) {
        throw new Error('PDF processing library not available. Try installing pdf-parse package.');
      }
      
      const data = await pdfParse(fileBuffer);
      
      // Extract text and metadata
      const text = data.text;
      const extractedMeta = data.metadata; // PDF metadata (Title, Author, etc.)
      const numPages = data.numpages;
      
      console.log(`PDF Extracted: ${text.length} chars, ${numPages} pages.`);
      if (extractedMeta) {
          console.log(`PDF Metadata: Title: ${extractedMeta.Title}, Author: ${extractedMeta.Author}`);
      }
      
      const chunks = this.chunkText(text, options.chunkSize || 1000, options.overlapSize || 200);
      
      // Detect document type
      const documentType = this.detectDocumentType(text, metadata.filename, extractedMeta);
      
      // Detect language
      const language = this.detectLanguage(text);
      
      // Update file metadata with extracted info
      const updatedMetadata = { 
          ...metadata, 
          extractedMetadata: { ...extractedMeta, numPages }, // Add extracted meta
          documentType, // Add detected document type
          language // Add detected language
      };
      
      return {
        metadata: updatedMetadata,
        fullText: text,
        chunks: chunks.map((chunk, index) => ({
          text: chunk,
          index,
          metadata: { 
            contentType: 'text', 
            // Basic page estimation (could be improved with more complex parsing)
            page: Math.floor((index * (options.chunkSize || 1000)) / (text.length / numPages)) + 1 
          }
        }))
      };
    } catch (error: any) {
        console.error(`Error parsing PDF ${metadata.filename}:`, error);
        // Return a simple version with error info
        const updatedMetadata = {
          ...metadata,
          processingStatus: 'failed' as const,
          processingError: `Failed to parse PDF: ${error.message}`
        };
        return {
          metadata: updatedMetadata,
          fullText: `Failed to extract text from PDF. Error: ${error.message}`,
          chunks: [{
            text: `Failed to extract text from PDF file ${metadata.filename}. Error: ${error.message}`,
            index: 0,
            metadata: { contentType: 'text' }
          }]
        };
    }
  }

  /**
   * Process a DOCX file using mammoth
   */
  private async processDocxFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
    options: any
  ): Promise<ProcessedFile> {
    try {
      console.log(`Processing DOCX file: ${metadata.filename}`);
      
      // Check if mammoth module is available
      if (!mammothLib) {
        throw new Error('DOCX processing library not available. Try installing mammoth package.');
      }
      
      const result = await mammothLib.convertToHtml({ buffer: fileBuffer });
      const text = result.value;
      // Note: Mammoth doesn't easily extract standard metadata like author/title
      // We could potentially parse the XML directly if needed, but keeping it simple for now.
      console.log(`DOCX Extracted: ${text.length} chars`);
      
      const chunks = this.chunkText(text, options.chunkSize || 1000, options.overlapSize || 200);
      
      // Detect document type
      const documentType = this.detectDocumentType(text, metadata.filename);
      
      // Detect language
      const language = this.detectLanguage(text);
      
      // Update metadata with document type and language
      const updatedMetadata = {
        ...metadata,
        documentType,
        language
      };
      
      return {
        metadata: updatedMetadata, 
        fullText: text,
        chunks: chunks.map((chunk, index) => ({
          text: chunk,
          index,
          metadata: { contentType: 'text' }
        }))
      };
    } catch (error: any) {
        console.error(`Error parsing DOCX ${metadata.filename}:`, error);
        // Return a simple version with error info
        const updatedMetadata = {
          ...metadata,
          processingStatus: 'failed' as const,
          processingError: `Failed to parse DOCX: ${error.message}`
        };
        return {
          metadata: updatedMetadata,
          fullText: `Failed to extract text from DOCX. Error: ${error.message}`,
          chunks: [{
            text: `Failed to extract text from DOCX file ${metadata.filename}. Error: ${error.message}`,
            index: 0,
            metadata: { contentType: 'text' }
          }]
        };
    }
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
    console.log(`Processing image file: ${metadata.filename} (placeholder)`);
    
    // TODO: Implement OCR for images using a library like Tesseract.js or a cloud service
    // TODO: For advanced image analysis, integrate with a vision model API to extract:
    //       1. Text content via OCR
    //       2. Image descriptions and detected objects
    //       3. Scene classification
    
    // For now, use a placeholder that indicates image processing is needed
    const placeholderText = `Image content description placeholder for ${metadata.filename}. Vision model processing needed.`;
    
    // Set document type as image
    const updatedMetadata = {
      ...metadata,
      documentType: 'image'
    };
    
    return {
      metadata: updatedMetadata,
      fullText: placeholderText, // Use placeholder as full text for images for now
      chunks: [{
        text: placeholderText,
        index: 0,
        metadata: { contentType: 'image' }
      }]
    };
  }

  /**
   * Split text into chunks with overlap
   */
  private chunkText(text: string, chunkSize: number, overlapSize: number): string[] {
    const chunks: string[] = [];
    
    if (!text || text.length === 0) {
        return [];
    }

    if (text.length <= chunkSize) {
      chunks.push(text);
      return chunks;
    }
    
    let startIndex = 0;
    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      chunks.push(text.slice(startIndex, endIndex));
      // Ensure overlap doesn't go before the start of the string
      startIndex = Math.max(0, endIndex - overlapSize);
      
      // Prevent infinite loop if overlap is too large or chunk is full length
      if (endIndex === text.length) {
          break;
      }
      // If next start index would be same as current end (no progress), break
      if (startIndex >= endIndex) {
           console.warn("Chunking potential issue: Overlap might be too large or chunk size too small.");
           // Add the remaining part as the last chunk
           const remainingText = text.slice(endIndex);
           if (remainingText.length > 0) {
               chunks.push(remainingText);
           }
           break;
       }
    }
    
    return chunks;
  }

  /**
   * Generate a summary of the file
   */
  private async generateFileSummary(file: ProcessedFile): Promise<string> {
    // TODO: Implement LLM-based summarization
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
          tags: metadata.tags || [],
          page: chunk.metadata.page // Add page number if available
        },
        'document'
      );
    }
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
        tags: metadata.tags || [],
        extractedMetadata: metadata.extractedMetadata // Include extracted metadata here too
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
      return 'gemini-pro-vision';
    } else if (mimeType === 'application/pdf' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return 'claude-3-sonnet';
    } else {
      return 'claude-3-haiku';
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

  /**
   * Detect document type based on content and file extension
   * This helps categorize documents for better organization and search
   */
  private detectDocumentType(content: string, filename: string, metadata?: any): string {
    // Get file extension
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    // Default document types based on extension
    const extensionTypes: Record<string, string> = {
      'pdf': 'document',
      'docx': 'document',
      'doc': 'document',
      'txt': 'text',
      'md': 'markdown',
      'csv': 'spreadsheet',
      'xls': 'spreadsheet',
      'xlsx': 'spreadsheet',
      'json': 'data',
      'xml': 'data',
      'html': 'web',
      'htm': 'web',
      'js': 'code',
      'ts': 'code',
      'py': 'code',
      'java': 'code',
      'c': 'code',
      'cpp': 'code',
      'cs': 'code',
      'go': 'code'
    };
    
    // Check for patterns in content to determine more specific document types
    // This is a simple implementation; could be expanded with ML models or more patterns
    let documentType = extensionTypes[extension] || 'unknown';
    
    // Look for patterns in content to refine document type
    if (documentType === 'document' || documentType === 'text') {
      if (/\brevenue\b|\bprofit\b|\bfinance\b|\bbudget\b|\bbalance sheet\b|\bincome statement\b/i.test(content)) {
        documentType = 'financial';
      } else if (/\blegal\b|\bagreement\b|\bcontract\b|\bcompliance\b|\bpolicy\b|\bterms\b|\bregulation\b/i.test(content)) {
        documentType = 'legal';
      } else if (/\bmeeting\b|\bminutes\b|\bagenda\b|\bschedule\b|\bcalendar\b/i.test(content)) {
        documentType = 'meeting';
      } else if (/\bresearch\b|\bstudy\b|\bexperiment\b|\banalysis\b|\bhypothesis\b|\bconclusion\b/i.test(content)) {
        documentType = 'research';
      } else if (/\bproject\b|\bmilestone\b|\bdeliverable\b|\btimeline\b|\bprogress\b/i.test(content)) {
        documentType = 'project';
      } else if (/\bresume\b|\bcv\b|\bqualification\b|\bexperience\b|\bskill\b|\beducation\b/i.test(content)) {
        documentType = 'resume';
      } else if (/\bpresentation\b|\bslide\b|\bdeck\b|\bpowerpoint\b/i.test(content)) {
        documentType = 'presentation';
      }
    }
    
    // Use PDF metadata to further refine if available
    if (metadata) {
      if (metadata.Subject === 'Invoice' || metadata.Title?.includes('Invoice')) {
        documentType = 'invoice';
      } else if (metadata.Subject === 'Report' || metadata.Title?.includes('Report')) {
        documentType = 'report';
      }
    }
    
    return documentType;
  }

  /**
   * Simple language detection based on common words and patterns
   * This is a basic implementation - could be replaced with a more sophisticated library
   */
  private detectLanguage(text: string): string {
    // Take a sample of the text (first 1000 chars) for efficiency
    const sample = text.substring(0, 1000).toLowerCase();
    
    // Define common word patterns for various languages
    const languagePatterns: Record<string, RegExp[]> = {
      english: [/\bthe\b|\band\b|\bof\b|\bto\b|\ba\b|\bin\b|\bis\b|\bthat\b|\bfor\b|\bit\b/g],
      spanish: [/\bel\b|\bla\b|\bde\b|\by\b|\ben\b|\bque\b|\bun\b|\buna\b|\blos\b|\blas\b/g],
      french: [/\ble\b|\bla\b|\bde\b|\bet\b|\bun\b|\bune\b|\ben\b|\best\b|\bque\b|\bpour\b/g],
      german: [/\bder\b|\bdie\b|\bdas\b|\bund\b|\bin\b|\bist\b|\bden\b|\bzu\b|\bvon\b|\bmit\b/g],
      italian: [/\bil\b|\bla\b|\bdi\b|\be\b|\bin\b|\bun\b|\buna\b|\bche\b|\bper\b|\bè\b/g],
      portuguese: [/\bo\b|\ba\b|\bde\b|\be\b|\bque\b|\bem\b|\bum\b|\bpara\b|\bcom\b|\bnão\b/g],
      dutch: [/\bde\b|\ben\b|\been\b|\bhet\b|\bvan\b|\bin\b|\bis\b|\bdat\b|\bop\b|\bte\b/g],
      chinese: [/[\u4e00-\u9fff]/g], // Matches Chinese characters
      japanese: [/[\u3040-\u309f\u30a0-\u30ff]/g], // Matches hiragana and katakana
      korean: [/[\uac00-\ud7af\u1100-\u11ff]/g], // Matches Hangul
      arabic: [/[\u0600-\u06ff]/g], // Matches Arabic script
      russian: [/[\u0400-\u04ff]/g], // Matches Cyrillic script
      hindi: [/[\u0900-\u097f]/g], // Matches Devanagari script
    };
    
    let detectedLanguage = 'unknown';
    let highestScore = 0;
    
    // Check each language pattern
    for (const [language, patterns] of Object.entries(languagePatterns)) {
      let score = 0;
      
      for (const pattern of patterns) {
        const matches = (sample.match(pattern) || []).length;
        score += matches;
      }
      
      // Normalize score by pattern count
      score = score / patterns.length;
      
      if (score > highestScore) {
        highestScore = score;
        detectedLanguage = language;
      }
    }
    
    // Set a minimum threshold to avoid false positives
    if (highestScore < 3) {
      detectedLanguage = 'unknown';
    }
    
    console.log(`Language detection: ${detectedLanguage} (score: ${highestScore})`);
    return detectedLanguage;
  }
}

// Export singleton instance
export const fileProcessor = new FileProcessor();

// Export factory function
export function createFileProcessor(enhancedMemory?: EnhancedMemory): FileProcessor {
  return new FileProcessor(enhancedMemory);
} 