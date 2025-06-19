/**
 * FileProcessingManager.ts - Handles file processing operations
 * 
 * This file provides a manager for processing uploaded files with support for:
 * - File type detection
 * - Content extraction
 * - Memory storage
 * - Knowledge graph updates
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { AbstractBaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { MemoryManager } from '../../../../agents/shared/base/managers/MemoryManager.interface';
import { KnowledgeManager } from '../../../../agents/shared/base/managers/KnowledgeManager.interface';

/**
 * Configuration for FileProcessingManager
 */
export interface FileProcessingConfig {
  enabled: boolean;
  allowedFileTypes: string[];
  maxFileSizeBytes: number;
  storeInMemory: boolean;
  updateKnowledgeGraph: boolean;
  [key: string]: unknown;
}

/**
 * Default configuration
 */
export const DEFAULT_FILE_PROCESSING_CONFIG: FileProcessingConfig = {
  enabled: true,
  allowedFileTypes: ['.txt', '.md', '.json', '.csv', '.pdf'],
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  storeInMemory: true,
  updateKnowledgeGraph: true
};

/**
 * Result of file processing
 */
export interface FileProcessingResult {
  success: boolean;
  fileId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  contentSummary?: string;
  memoryIds?: string[];
  knowledgeNodeIds?: string[];
  error?: string;
}

/**
 * Error class for file processing errors
 */
export class FileProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'FILE_PROCESSING_ERROR',
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'FileProcessingError';
  }
}

/**
 * Manager for handling file processing operations
 */
export class FileProcessingManager extends AbstractBaseManager {
  protected _config: FileProcessingConfig;
  
  /**
   * Create a new FileProcessingManager
   * 
   * @param agent The agent this manager belongs to
   * @param config Configuration options
   */
  constructor(
    agent: AgentBase,
    config: Partial<FileProcessingConfig> = {}
  ) {
    super(
      `file-processing-manager-${uuidv4()}`,
      ManagerType.FILE_PROCESSING,
      agent,
      { enabled: true }
    );
    
    this._config = {
      ...DEFAULT_FILE_PROCESSING_CONFIG,
      ...config
    };
  }
  
  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    if (this._initialized) {
      return true;
    }
    
    try {
      console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
      this._initialized = true;
      return true;
    } catch (error) {
      console.error(`[${this.managerId}] Error during initialization:`, error);
      return false;
    }
  }
  
  /**
   * Process a file
   * 
   * @param filePath Path to the file
   * @param originalName Original name of the file
   * @param userId Optional user ID for memory storage
   */
  async processFile(filePath: string, originalName: string, userId?: string): Promise<FileProcessingResult> {
    if (!this._initialized) {
      throw new FileProcessingError('File processing manager not initialized', 'NOT_INITIALIZED');
    }
    
    try {
      // Check file type
      const fileType = extname(originalName).toLowerCase();
      if (!this._config.allowedFileTypes.includes(fileType)) {
        throw new FileProcessingError(
          `File type ${fileType} not allowed`,
          'INVALID_FILE_TYPE',
          { allowedTypes: this._config.allowedFileTypes }
        );
      }
      
      // Read file
      const fileContent = await readFile(filePath);
      
      // Check file size
      if (fileContent.length > this._config.maxFileSizeBytes) {
        throw new FileProcessingError(
          `File size ${fileContent.length} bytes exceeds maximum of ${this._config.maxFileSizeBytes} bytes`,
          'FILE_TOO_LARGE'
        );
      }
      
      // Process based on file type
      const result: FileProcessingResult = {
        success: true,
        fileId: uuidv4(),
        fileName: originalName,
        fileType,
        fileSizeBytes: fileContent.length
      };
      
      // Store in memory if enabled
      if (this._config.storeInMemory) {
        const memoryManager = this.getAgent().getManager(ManagerType.MEMORY) as MemoryManager;
        if (memoryManager) {
          const memory = await memoryManager.addMemory(
            fileContent.toString(),
            {
              type: 'file_content',
              fileId: result.fileId,
              fileName: originalName,
              fileType,
              userId: userId || 'test-user' // CRITICAL FIX: Add userId to memory metadata
            }
          );
          
          console.log(`[FileProcessingManager] 🆔 Stored file memory with userId: ${userId || 'test-user'}`);
          result.memoryIds = [memory.id];
        }
      }
      
      // Update knowledge graph if enabled
      if (this._config.updateKnowledgeGraph) {
        const knowledgeManager = this.getAgent().getManager(ManagerType.KNOWLEDGE) as KnowledgeManager;
        if (knowledgeManager) {
          const entry = await knowledgeManager.addKnowledgeEntry({
            title: originalName,
            content: fileContent.toString(),
            source: 'file_upload',
            category: 'files',
            tags: ['file', fileType.slice(1)], // Remove the dot from extension
            metadata: {
              fileId: result.fileId,
              fileName: originalName,
              fileType,
              fileSizeBytes: fileContent.length
            }
          });
          result.knowledgeNodeIds = [entry.id];
        }
      }
      
      return result;
    } catch (error) {
      if (error instanceof FileProcessingError) {
        throw error;
      }
      throw new FileProcessingError(
        `Failed to process file: ${(error as Error).message}`,
        'PROCESSING_FAILED'
      );
    }
  }
  
  /**
   * Get the health status of the manager
   */
  async getHealth(): Promise<ManagerHealth> {
    return {
      status: this._initialized ? 'healthy' : 'unhealthy',
      message: `File processing manager is ${this._initialized ? 'healthy' : 'unhealthy'}`,
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: {
          allowedFileTypes: this._config.allowedFileTypes.length,
          maxFileSizeBytes: this._config.maxFileSizeBytes
        }
      }
    };
  }
  
  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.managerId}] Shutting down ${this.managerType} manager`);
    this._initialized = false;
  }
  
  /**
   * Reset the manager
   */
  async reset(): Promise<boolean> {
    console.log(`[${this.managerId}] Resetting ${this.managerType} manager`);
    return true;
  }
} 