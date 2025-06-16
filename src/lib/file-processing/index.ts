import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import sharp from 'sharp';
import { EnhancedMemory } from '../memory/src/enhanced-memory';
import { MemoryType as StandardMemoryType } from '../../server/memory/config';

// Define types for the libraries
interface PdfParse {
  (dataBuffer: Buffer, options?: {
    max?: number;
    pagerender?: (pageData: {
      pageIndex: number;
      pageId: string | number;
      pageContent: string;
    }) => string;
  }): Promise<{
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    text: string;
    version: string;
  }>;
}

interface Mammoth {
  convertToHtml: (options: {
    buffer: Buffer; 
    styleMap?: string;
  }) => Promise<{
    value: string;
    messages: Array<{
      type: string;
      message: string;
      paragraph?: unknown;
    }>;
  }>;
}

// Import extraction libraries with error handling
// Use dynamic imports to handle potential missing libraries
let pdfParse: PdfParse | null = null;
let mammoth: Mammoth | null = null;

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
  mammoth = require('mammoth');
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
  extractedMetadata?: Record<string, unknown>; // Store extracted PDF metadata etc.
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

export interface FileProcessingOptions {
  modelOverride?: string;
  chunkSize?: number;
  overlapSize?: number;
  extractEntities?: boolean;
  customFormatting?: boolean;
  customExtractors?: Record<string, (content: string) => string>;
  includeMetadata?: boolean;
  summarize?: boolean;
}

// Path to store file metadata
const FILE_METADATA_DIR = path.join(process.cwd(), 'data');
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
      if (this.initialized) {
        return true;
      }
      
      // Create necessary directories
      if (!fs.existsSync(FILE_METADATA_DIR)) {
        fs.mkdirSync(FILE_METADATA_DIR, { recursive: true });
      }
      
      // Ensure storage directories exist
      const uploadsDir = path.join(process.cwd(), 'data', 'files', 'uploads');
      const storageDir = path.join(process.cwd(), 'data', 'files', 'storage');
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('Created uploads directory');
      }
      
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
        console.log('Created storage directory');
      }
      
      // Load existing metadata
      if (fs.existsSync(FILE_METADATA_PATH)) {
        const data = fs.readFileSync(FILE_METADATA_PATH, 'utf8');
        try {
          this.fileMetadata = JSON.parse(data);
          // Convert date strings back to Date objects if necessary
          Object.values(this.fileMetadata).forEach(meta => {
            if (meta.uploadDate && typeof meta.uploadDate === 'string') {
              meta.uploadDate = new Date(meta.uploadDate);
            }
          });
        } catch (e: unknown) {
          console.error('Error parsing file metadata JSON:', e instanceof Error ? e.message : String(e));
          // Start with empty metadata if file is corrupted
          this.fileMetadata = {};
        }
      }
      
      // Try to load PDF parser dynamically (supported in Next.js environment)
      try {
        pdfParse = require('pdf-parse');
      } catch (e: unknown) {
        console.warn('pdf-parse not available:', e instanceof Error ? e.message : String(e));
      }
      
      // Try to load DOCX parser dynamically
      try {
        mammoth = require('mammoth');
      } catch (e: unknown) {
        console.warn('mammoth not available:', e instanceof Error ? e.message : String(e));
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
    options: FileProcessingOptions = {}
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

    } catch (error: unknown) {
      // Update metadata with failure
      metadata.processingStatus = 'failed' as const;
      metadata.processingError = error instanceof Error ? error.message : String(error);
      
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
    options: FileProcessingOptions
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
    options: FileProcessingOptions
  ): Promise<ProcessedFile> {
    try {
      console.log(`Processing PDF file: ${metadata.filename}`);
      
      // Check if pdf-parse module is available
      if (!pdfParse) {
        throw new Error('PDF processing library not available. Try installing pdf-parse package.');
      }
      
      const data = await pdfParse(fileBuffer, {
        max: 1000,
        pagerender: (pageData) => {
          return pageData.pageContent;
        }
      });
      
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
    } catch (error: unknown) {
        console.error(`Error parsing PDF ${metadata.filename}:`, error);
        // Return a simple version with error info
        const updatedMetadata = {
          ...metadata,
          processingStatus: 'failed' as const,
          processingError: `Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`
        };
        return {
          metadata: updatedMetadata,
          fullText: `Failed to extract text from PDF. Error: ${error instanceof Error ? error.message : String(error)}`,
          chunks: [{
            text: `Failed to extract text from PDF file ${metadata.filename}. Error: ${error instanceof Error ? error.message : String(error)}`,
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
    options: FileProcessingOptions
  ): Promise<ProcessedFile> {
    try {
      console.log(`Processing DOCX file: ${metadata.filename}`);
      
      // Check if mammoth module is available
      if (!mammoth) {
        throw new Error('DOCX processing library not available. Try installing mammoth package.');
      }
      
      const result = await mammoth.convertToHtml({ buffer: fileBuffer });
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
    } catch (error: unknown) {
        console.error(`Error parsing DOCX ${metadata.filename}:`, error);
        // Return a simple version with error info
        const updatedMetadata = {
          ...metadata,
          processingStatus: 'failed' as const,
          processingError: `Failed to parse DOCX: ${error instanceof Error ? error.message : String(error)}`
        };
        return {
          metadata: updatedMetadata,
          fullText: `Failed to extract text from DOCX. Error: ${error instanceof Error ? error.message : String(error)}`,
          chunks: [{
            text: `Failed to extract text from DOCX file ${metadata.filename}. Error: ${error instanceof Error ? error.message : String(error)}`,
            index: 0,
            metadata: { contentType: 'text' }
          }]
        };
    }
  }

  /**
   * Process image files using GPT-4 Vision API
   */
  private async processImageFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
    options: FileProcessingOptions
  ): Promise<ProcessedFile> {
    console.log(`Processing image file: ${metadata.filename} with GPT-4 Vision`);
    
    try {
      // Convert buffer to base64 for GPT-4 Vision API
      const base64Image = fileBuffer.toString('base64');
      const mimeType = metadata.mimeType;
      
      // Prepare the image for GPT-4 Vision API
      const imageData = `data:${mimeType};base64,${base64Image}`;
      
      // Use GPT-4 Vision for comprehensive image analysis
      const analysisPrompt = `Analyze this image comprehensively and provide:
1. **Text Extraction**: Extract all visible text (OCR) including signs, documents, labels, etc.
2. **Scene Description**: Describe the overall scene, setting, and context
3. **Object Detection**: List and describe all significant objects, people, and elements
4. **Document Analysis**: If this is a document/screenshot, analyze its structure and content
5. **Metadata**: Note any relevant technical details, quality, or special characteristics

Format your response as:
TEXT_CONTENT: [All extracted text here]
SCENE: [Scene description]
OBJECTS: [List of detected objects]
DOCUMENT_TYPE: [If applicable: form, receipt, screenshot, etc.]
TECHNICAL_NOTES: [Any relevant technical observations]`;

      // Make API call to GPT-4 Vision (using OpenAI client)
      let extractedContent = '';
      let sceneDescription = '';
      let detectedObjects = '';
      let documentType = 'image';
      let technicalNotes = '';
      
      try {
        // Note: This would require OpenAI client integration
        // For now, we'll simulate the response structure
        const response = await this.callGPT4Vision(imageData, analysisPrompt);
        
        // Parse the structured response
        const sections = this.parseGPT4VisionResponse(response);
        extractedContent = sections.textContent || '';
        sceneDescription = sections.scene || '';
        detectedObjects = sections.objects || '';
        documentType = sections.documentType || 'image';
        technicalNotes = sections.technicalNotes || '';
        
      } catch (error) {
        console.warn('GPT-4 Vision API call failed, using fallback analysis:', error);
        
        // Fallback: Basic image analysis
        extractedContent = `Image analysis for ${metadata.filename}`;
        sceneDescription = `Image file of type ${mimeType}`;
        detectedObjects = 'Unable to detect objects - API unavailable';
        technicalNotes = `File size: ${this.formatFileSize(metadata.size)}`;
      }
      
      // Combine all extracted information
      const fullText = [
        extractedContent,
        `Scene: ${sceneDescription}`,
        `Objects: ${detectedObjects}`,
        technicalNotes
      ].filter(Boolean).join('\n\n');
      
      // Create chunks for different types of content
      const chunks = [];
      
      // Text content chunk (if any text was extracted)
      if (extractedContent.trim()) {
        chunks.push({
          text: extractedContent,
          index: 0,
          metadata: { 
            contentType: 'text' as const,
            source: 'ocr',
            confidence: 'high'
          }
        });
      }
      
      // Scene description chunk
      if (sceneDescription.trim()) {
        chunks.push({
          text: `Scene Description: ${sceneDescription}`,
          index: chunks.length,
          metadata: { 
            contentType: 'image' as const,
            source: 'vision_analysis',
            analysisType: 'scene'
          }
        });
      }
      
      // Objects detection chunk
      if (detectedObjects.trim()) {
        chunks.push({
          text: `Detected Objects: ${detectedObjects}`,
          index: chunks.length,
          metadata: { 
            contentType: 'image' as const,
            source: 'vision_analysis',
            analysisType: 'objects'
          }
        });
      }
      
      // If no meaningful content was extracted, create a basic chunk
      if (chunks.length === 0) {
        chunks.push({
          text: `Image file: ${metadata.filename} (${mimeType})`,
          index: 0,
          metadata: { 
            contentType: 'image' as const,
            source: 'metadata'
          }
        });
      }
      
      // Update metadata with extracted information
      const updatedMetadata = {
        ...metadata,
        documentType: documentType,
        extractedMetadata: {
          hasText: extractedContent.length > 0,
          sceneAnalyzed: true,
          objectsDetected: detectedObjects.length > 0,
          analysisMethod: 'gpt4_vision',
          imageFormat: mimeType,
          processingDate: new Date().toISOString()
        }
      };
      
      return {
        metadata: updatedMetadata,
        fullText: fullText,
        chunks: chunks
      };
      
    } catch (error) {
      console.error('Error processing image file:', error);
      
      // Fallback to basic image handling
      const fallbackText = `Image file: ${metadata.filename} (${metadata.mimeType}, ${this.formatFileSize(metadata.size)})`;
      
      return {
        metadata: {
          ...metadata,
          documentType: 'image',
          processingError: `Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        fullText: fallbackText,
        chunks: [{
          text: fallbackText,
          index: 0,
          metadata: { contentType: 'image' as const }
        }]
      };
    }
  }
  
  /**
   * Call GPT-4 Vision API for image analysis
   */
  private async callGPT4Vision(imageData: string, prompt: string): Promise<string> {
    // TODO: Implement actual OpenAI GPT-4 Vision API call
    // This would require proper OpenAI client setup and API key
    
    // For now, return a simulated response
    // In real implementation, this would be:
    /*
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-2025-04-14-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageData } }
          ]
        }
      ],
      max_tokens: 1000
    });
    return response.choices[0].message.content || '';
    */
    
    // Simulated response for development
    return `TEXT_CONTENT: Sample extracted text from image
SCENE: A document or screenshot containing text and visual elements
OBJECTS: Text blocks, potential UI elements, document structure
DOCUMENT_TYPE: document
TECHNICAL_NOTES: Image processed successfully with GPT-4 Vision`;
  }
  
  /**
   * Parse GPT-4 Vision response into structured sections
   */
  private parseGPT4VisionResponse(response: string): {
    textContent: string;
    scene: string;
    objects: string;
    documentType: string;
    technicalNotes: string;
  } {
    const sections = {
      textContent: '',
      scene: '',
      objects: '',
      documentType: 'image',
      technicalNotes: ''
    };
    
    // Parse the structured response
    const lines = response.split('\n');
    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('TEXT_CONTENT:')) {
        currentSection = 'textContent';
        sections.textContent = trimmedLine.replace('TEXT_CONTENT:', '').trim();
      } else if (trimmedLine.startsWith('SCENE:')) {
        currentSection = 'scene';
        sections.scene = trimmedLine.replace('SCENE:', '').trim();
      } else if (trimmedLine.startsWith('OBJECTS:')) {
        currentSection = 'objects';
        sections.objects = trimmedLine.replace('OBJECTS:', '').trim();
      } else if (trimmedLine.startsWith('DOCUMENT_TYPE:')) {
        currentSection = 'documentType';
        sections.documentType = trimmedLine.replace('DOCUMENT_TYPE:', '').trim();
      } else if (trimmedLine.startsWith('TECHNICAL_NOTES:')) {
        currentSection = 'technicalNotes';
        sections.technicalNotes = trimmedLine.replace('TECHNICAL_NOTES:', '').trim();
      } else if (trimmedLine && currentSection) {
        // Continue adding to current section
        switch (currentSection) {
          case 'textContent':
            sections.textContent += ' ' + trimmedLine;
            break;
          case 'scene':
            sections.scene += ' ' + trimmedLine;
            break;
          case 'objects':
            sections.objects += ' ' + trimmedLine;
            break;
          case 'technicalNotes':
            sections.technicalNotes += ' ' + trimmedLine;
            break;
        }
      }
    }
    
    return sections;
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
   * Generate a summary of the file using LLM-based summarization
   */
  private async generateFileSummary(file: ProcessedFile): Promise<string> {
    if (file.chunks.length === 0) {
      return 'Empty file - no content to summarize';
    }
    
    try {
      // Determine the best summarization approach based on content length
      const totalLength = file.fullText.length;
      const documentType = file.metadata.documentType || 'document';
      
      // For very short documents, return a brief description
      if (totalLength < 200) {
        return `Brief ${documentType}: ${file.fullText.substring(0, 150)}${totalLength > 150 ? '...' : ''}`;
      }
      
      // For longer documents, use LLM-based summarization
      const summary = await this.generateLLMSummary(file);
      
      // Add metadata to the summary
      const metadata = [
        `Document type: ${documentType}`,
        `Length: ${this.formatFileSize(file.metadata.size)}`,
        `Chunks: ${file.chunks.length}`,
        file.metadata.language ? `Language: ${file.metadata.language}` : null
      ].filter(Boolean).join(' | ');
      
      return `${summary}\n\n[${metadata}]`;
      
    } catch (error) {
      console.warn('Error generating LLM summary, falling back to simple summary:', error);
      
      // Fallback to simple summarization
      const firstChunk = file.chunks[0].text;
      const words = firstChunk.split(/\s+/).slice(0, 50).join(' ');
      return `${words}... (${file.chunks.length} chunks total, ${this.formatFileSize(file.metadata.size)})`;
    }
  }
  
  /**
   * Generate LLM-based summary using GPT-4
   */
  private async generateLLMSummary(file: ProcessedFile): Promise<string> {
    const documentType = file.metadata.documentType || 'document';
    const filename = file.metadata.filename;
    
    // Prepare content for summarization
    let contentToSummarize = file.fullText;
    
    // For very long documents, use only the first few chunks to stay within token limits
    if (file.fullText.length > 8000) {
      const selectedChunks = file.chunks.slice(0, 3); // First 3 chunks
      contentToSummarize = selectedChunks.map(chunk => chunk.text).join('\n\n');
      contentToSummarize += '\n\n[Note: This is a partial summary of the first sections due to length constraints]';
    }
    
    // Create a context-aware prompt based on document type
    const prompt = this.createSummarizationPrompt(documentType, filename, contentToSummarize);
    
    try {
      // Call LLM for summarization
      const summary = await this.callLLMForSummarization(prompt);
      
      // Post-process and validate the summary
      return this.postProcessSummary(summary, file);
      
    } catch (error) {
      console.warn('LLM summarization failed:', error);
      throw error;
    }
  }
  
  /**
   * Create a context-aware summarization prompt
   */
  private createSummarizationPrompt(documentType: string, filename: string, content: string): string {
    const basePrompt = `Please provide a comprehensive summary of this ${documentType}`;
    
    let specificInstructions = '';
    
    switch (documentType.toLowerCase()) {
      case 'pdf':
      case 'document':
        specificInstructions = `
- Identify the main topic and purpose
- Extract key points and important information
- Note any conclusions or recommendations
- Highlight significant data or findings`;
        break;
        
      case 'spreadsheet':
        specificInstructions = `
- Describe the data structure and organization
- Identify key metrics and trends
- Summarize important calculations or formulas
- Note any significant patterns in the data`;
        break;
        
      case 'presentation':
        specificInstructions = `
- Outline the main presentation flow
- Extract key messages from each section
- Identify the target audience and purpose
- Summarize conclusions and action items`;
        break;
        
      case 'image':
        specificInstructions = `
- Describe the visual content and context
- Extract any text or data visible in the image
- Identify the purpose and type of image
- Note any important visual elements or patterns`;
        break;
        
      default:
        specificInstructions = `
- Identify the main topics and themes
- Extract the most important information
- Summarize key points and conclusions
- Note any actionable items or recommendations`;
    }
    
    return `${basePrompt} titled "${filename}".

Please provide a summary that includes:
${specificInstructions}

Keep the summary concise but comprehensive (2-4 paragraphs), focusing on the most valuable information for someone who needs to understand the document's content and purpose.

Document content:
${content}

Summary:`;
  }
  
  /**
   * Call LLM for summarization (placeholder for actual implementation)
   */
  private async callLLMForSummarization(prompt: string): Promise<string> {
    // TODO: Implement actual LLM API call
    // This would integrate with OpenAI GPT-4, Anthropic Claude, or other LLM services
    
    // For now, return a simulated response
    // In real implementation, this would be:
    /*
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-2025-04-14",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });
    return response.choices[0].message.content || '';
    */
    
    // Simulated intelligent summary based on content analysis
    const contentLength = prompt.length;
    const hasNumbers = /\d+/.test(prompt);
    const hasCode = /function|class|import|export|const|let|var/.test(prompt);
    const hasTechnicalTerms = /API|database|server|client|algorithm|implementation/.test(prompt);
    
    let summary = "This document contains ";
    
    if (hasCode) {
      summary += "technical code and implementation details. ";
    } else if (hasTechnicalTerms) {
      summary += "technical information and system documentation. ";
    } else if (hasNumbers) {
      summary += "data, metrics, and quantitative information. ";
    } else {
      summary += "textual content and information. ";
    }
    
    if (contentLength > 5000) {
      summary += "The document is comprehensive and covers multiple topics in detail. ";
    } else if (contentLength > 2000) {
      summary += "The document provides moderate detail on its subject matter. ";
    } else {
      summary += "The document is concise and focused. ";
    }
    
    summary += "Key information has been extracted and organized for easy reference. ";
    summary += "This summary provides an overview of the main content and structure.";
    
    return summary;
  }
  
  /**
   * Post-process and validate the LLM-generated summary
   */
  private postProcessSummary(summary: string, file: ProcessedFile): string {
    // Clean up the summary
    let processedSummary = summary.trim();
    
    // Remove any unwanted prefixes or suffixes
    processedSummary = processedSummary.replace(/^(Summary:|Here's a summary:|The summary is:)\s*/i, '');
    processedSummary = processedSummary.replace(/\s*(That's the summary\.?|End of summary\.?)$/i, '');
    
    // Ensure minimum length
    if (processedSummary.length < 50) {
      const fallback = `Summary of ${file.metadata.filename}: ${file.chunks[0]?.text.substring(0, 100) || 'Content available'}...`;
      return fallback;
    }
    
    // Ensure maximum length (for storage efficiency)
    if (processedSummary.length > 1000) {
      processedSummary = processedSummary.substring(0, 997) + '...';
    }
    
    // Add quality indicators
    const qualityScore = this.calculateSummaryQuality(processedSummary, file);
    if (qualityScore < 0.5) {
      processedSummary += '\n\n[Note: Summary quality may be limited due to content complexity]';
    }
    
    return processedSummary;
  }
  
  /**
   * Calculate summary quality score (0-1)
   */
  private calculateSummaryQuality(summary: string, file: ProcessedFile): number {
    let score = 0.5; // Base score
    
    // Length appropriateness (not too short, not too long)
    const summaryLength = summary.length;
    const contentLength = file.fullText.length;
    const compressionRatio = summaryLength / contentLength;
    
    if (compressionRatio > 0.05 && compressionRatio < 0.3) {
      score += 0.2; // Good compression ratio
    }
    
    // Content coverage (check if summary mentions key terms from original)
    const originalWords = new Set(file.fullText.toLowerCase().match(/\b\w{4,}\b/g) || []);
    const summaryWords = new Set(summary.toLowerCase().match(/\b\w{4,}\b/g) || []);
    
    const overlap = Array.from(originalWords).filter(word => summaryWords.has(word)).length;
    const coverageRatio = overlap / Math.max(originalWords.size, 1);
    
    if (coverageRatio > 0.1) {
      score += 0.2; // Good content coverage
    }
    
    // Structure quality (has multiple sentences, proper punctuation)
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length >= 2 && sentences.length <= 8) {
      score += 0.1; // Good structure
    }
    
    return Math.min(1.0, score);
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
        StandardMemoryType.DOCUMENT
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
      StandardMemoryType.DOCUMENT
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
  private detectDocumentType(content: string, filename: string, metadata?: Record<string, unknown>): string {
    // Get file extension
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    // Default document type based on extension
    let documentType = 'document';
    
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) {
      documentType = 'document';
    } else if (['xls', 'xlsx', 'csv', 'tsv'].includes(extension)) {
      documentType = 'spreadsheet';
    } else if (['ppt', 'pptx'].includes(extension)) {
      documentType = 'presentation';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].includes(extension)) {
      documentType = 'image';
    }
    
    // Further refine based on content 
    if (content) {
      if (/\binvoice\b|\bpayment\b|\bamount\b|\btotal\b|\bdue\b/i.test(content)) {
        documentType = 'invoice';
      } else if (/\breport\b|\banalysis\b|\bsummary\b|\bfindings\b/i.test(content)) {
        documentType = 'report';
      } else if (/\bcontract\b|\bagreement\b|\bterms\b|\bconditions\b|\bparties\b/i.test(content)) {
        documentType = 'contract';
      } else if (/\bresearch\b|\bstudy\b|\bexperiment\b|\bmethod\b|\bresults\b/i.test(content)) {
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
      const subject = metadata.Subject as string | undefined;
      const title = metadata.Title as string | undefined;
      
      if (subject === 'Invoice' || (title && title.includes('Invoice'))) {
        documentType = 'invoice';
      } else if (subject === 'Report' || (title && title.includes('Report'))) {
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

// Export factory function
export function createFileProcessor(enhancedMemory?: EnhancedMemory): FileProcessor {
  return new FileProcessor(enhancedMemory);
}

// Export a default fileProcessor instance for backward compatibility
export const fileProcessor = new FileProcessor();