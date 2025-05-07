/**
 * File Memory Storage Service
 * 
 * Stores processed files in the memory system for retrieval.
 */

import { IFileMemoryStorage, ProcessedFile } from '../types';
import { AppError } from '../../../lib/errors/base';

// Mock implementations for dependencies that aren't available yet
// TODO: Replace with actual imports once the modules are available

/**
 * Mock implementation of EnhancedMemory until the actual module is available
 */
class EnhancedMemory {
  async storeText(
    text: string,
    collection: string,
    tags: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    console.log(`[MOCK] Stored text in collection ${collection} with tags:`, tags);
  }
}

/**
 * Memory type constants
 */
enum MemoryType {
  FILE_CONTENT = 'file_content',
  FILE_METADATA = 'file_metadata'
}

/**
 * Error codes for file memory storage operations
 */
export enum FileMemoryStorageErrorCode {
  INVALID_INPUT = 'FILE_MEMORY_STORAGE_INVALID_INPUT',
  STORAGE_FAILED = 'FILE_MEMORY_STORAGE_FAILED',
  MEMORY_NOT_INITIALIZED = 'FILE_MEMORY_STORAGE_NOT_INITIALIZED',
}

/**
 * Options for storing files in memory
 */
export interface FileMemoryStorageOptions {
  /**
   * Collection name to store the file in
   */
  collectionName?: string;
  
  /**
   * Whether to include metadata in the stored chunks
   */
  includeMetadata?: boolean;
  
  /**
   * Whether to include file ID in the text for improved retrieval
   */
  includeFileId?: boolean;
  
  /**
   * Custom tags to add to the memory entries
   */
  tags?: string[];
}

/**
 * Implementation of the IFileMemoryStorage interface
 */
export class FileMemoryStorage implements IFileMemoryStorage {
  /**
   * Enhanced memory instance for storage
   */
  private memory: EnhancedMemory | null;
  
  /**
   * Default storage options
   */
  private defaultOptions: FileMemoryStorageOptions;
  
  /**
   * Constructor
   * 
   * @param memory Optional EnhancedMemory instance
   * @param options Default storage options
   */
  constructor(memory?: EnhancedMemory, options: FileMemoryStorageOptions = {}) {
    this.memory = memory || null;
    this.defaultOptions = {
      collectionName: 'file_content',
      includeMetadata: true,
      includeFileId: true,
      tags: ['file_content'],
      ...options
    };
  }
  
  /**
   * Set the memory instance
   * 
   * @param memory EnhancedMemory instance
   */
  setMemory(memory: EnhancedMemory): void {
    this.memory = memory;
  }
  
  /**
   * Store a processed file in memory
   * 
   * @param file Processed file to store
   * @param options Storage options
   * @returns Promise resolving when storage is complete
   * @throws AppError if storage fails
   */
  async storeFileInMemory(
    file: ProcessedFile,
    options: FileMemoryStorageOptions = {}
  ): Promise<void> {
    // Validate file
    if (!file || !file.metadata || !file.metadata.id) {
      throw new AppError(
        'Invalid file provided for memory storage',
        FileMemoryStorageErrorCode.INVALID_INPUT,
        { provided: file ? 'ProcessedFile without valid metadata' : 'null' }
      );
    }
    
    // Check memory availability
    if (!this.memory) {
      throw new AppError(
        'Memory not initialized',
        FileMemoryStorageErrorCode.MEMORY_NOT_INITIALIZED
      );
    }
    
    try {
      // Merge options with defaults
      const mergedOptions = {
        ...this.defaultOptions,
        ...options
      };
      
      // Extract file info
      const { id, filename, documentType, language } = file.metadata;
      
      // Prepare tags
      const tags = [
        ...(mergedOptions.tags || []),
        'file',
        documentType || 'document',
        language || 'unknown'
      ];
      
      // Store each chunk in memory
      const promises = file.chunks.map(async (chunk, index) => {
        // Create text with optional file ID prefix
        const chunkText = mergedOptions.includeFileId
          ? `[File: ${id.toString()}] ${chunk.text}`
          : chunk.text;
        
        // Prepare metadata
        const metadata = mergedOptions.includeMetadata
          ? {
              fileId: id.toString(),
              filename,
              chunkIndex: index,
              totalChunks: file.chunks.length,
              documentType,
              language,
              pageNumber: chunk.metadata.page,
              section: chunk.metadata.section,
              contentType: chunk.metadata.contentType || 'text'
            }
          : undefined;
        
        // Store in memory
        await this.memory?.storeText(
          chunkText,
          mergedOptions.collectionName || MemoryType.FILE_CONTENT,
          tags,
          metadata
        );
      });
      
      // Wait for all chunks to be stored
      await Promise.all(promises);
      
      // Update metadata in file memory
      await this.memory.storeText(
        `File metadata: ${filename} (${documentType || 'document'})`,
        MemoryType.FILE_METADATA,
        ['file_metadata', documentType || 'document'],
        {
          ...file.metadata,
          id: id.toString()
        }
      );
    } catch (error) {
      throw new AppError(
        `Failed to store file in memory: ${error instanceof Error ? error.message : String(error)}`,
        FileMemoryStorageErrorCode.STORAGE_FAILED,
        { fileId: file.metadata.id.toString(), filename: file.metadata.filename }
      );
    }
  }
}

/**
 * Mock implementation for testing without actual memory storage
 */
export class MockFileMemoryStorage implements IFileMemoryStorage {
  /**
   * Store a processed file in memory (mock implementation)
   * 
   * @param file Processed file to store
   * @returns Promise that resolves immediately
   */
  async storeFileInMemory(file: ProcessedFile): Promise<void> {
    console.log(`[MOCK] Stored file: ${file.metadata.filename} (${file.chunks.length} chunks)`);
    return Promise.resolve();
  }
} 