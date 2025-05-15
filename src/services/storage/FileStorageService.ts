import { FileMetadata } from '../../types/files';

/**
 * Error codes specific to file storage operations
 */
export enum FileStorageErrorCode {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  SAVE_FAILED = 'SAVE_FAILED',
  RETRIEVE_FAILED = 'RETRIEVE_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND'
}

/**
 * Custom error class for file storage operations
 */
export class FileStorageError extends Error {
  constructor(
    message: string,
    public readonly code: FileStorageErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FileStorageError';
  }
}

/**
 * Interface for file data to be stored
 */
export interface StoredFileData {
  id: string;
  data: string;
  type: string;
  filename: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Options for file storage operations
 */
export interface FileStorageOptions {
  /**
   * Database name for storage
   */
  dbName?: string;
  
  /**
   * Store name for files
   */
  storeName?: string;
  
  /**
   * Version number for database
   */
  version?: number;
}

/**
 * Interface defining file storage operations
 */
export interface FileStorageService {
  /**
   * Initialize the storage system
   * @throws FileStorageError if initialization fails
   */
  initialize(): Promise<void>;
  
  /**
   * Save file data to storage
   * @param fileData The file data to store
   * @returns The ID of the stored file
   * @throws FileStorageError if save fails
   */
  saveFile(fileData: StoredFileData): Promise<string>;
  
  /**
   * Retrieve file data from storage
   * @param id The ID of the file to retrieve
   * @returns The file data or null if not found
   * @throws FileStorageError if retrieval fails
   */
  getFile(id: string): Promise<StoredFileData | null>;
  
  /**
   * Delete file from storage
   * @param id The ID of the file to delete
   * @returns true if deleted, false if not found
   * @throws FileStorageError if deletion fails
   */
  deleteFile(id: string): Promise<boolean>;
  
  /**
   * Check if a file exists in storage
   * @param id The ID of the file to check
   * @returns true if exists, false otherwise
   */
  fileExists(id: string): Promise<boolean>;
  
  /**
   * List all stored files
   * @returns Array of stored file metadata
   * @throws FileStorageError if listing fails
   */
  listFiles(): Promise<FileMetadata[]>;
  
  /**
   * Clear all stored files
   * @throws FileStorageError if clearing fails
   */
  clearStorage(): Promise<void>;
} 