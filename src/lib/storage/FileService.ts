import { StorageService, StorageProvider } from './StorageService';
import { randomUUID } from 'crypto';
import path from 'path';

export interface StoredFile {
  id: string;
  originalName: string;
  contentType: string;
  size: number;
  url?: string;
  createdAt: Date;
}

export interface FileServiceConfig {
  storageProvider: StorageProvider;
  bucket: string;
  
  // Only needed if not using LOCAL
  gcpProjectId?: string;
  gcpKeyFilename?: string;
  minioEndpoint?: string;
  minioAccessKey?: string;
  minioSecretKey?: string;
  azureAccountName?: string;
  azureAccountKey?: string;
}

/**
 * Service for handling file uploads and downloads
 */
export class FileService {
  private storageService: StorageService;
  
  constructor(config: FileServiceConfig) {
    const storageConfig = {
      provider: config.storageProvider,
      bucket: config.bucket,
      
      // GCP specific
      gcpProjectId: config.gcpProjectId,
      gcpKeyFilename: config.gcpKeyFilename,
      
      // MinIO specific
      awsEndpoint: config.minioEndpoint,
      awsAccessKeyId: config.minioAccessKey,
      awsSecretAccessKey: config.minioSecretKey,
      awsRegion: 'us-east-1', // Default for MinIO
      
      // Azure specific
      azureAccountName: config.azureAccountName,
      azureAccountKey: config.azureAccountKey
    };
    
    this.storageService = new StorageService(storageConfig);
  }
  
  /**
   * Upload a file to storage
   * @param file File to upload (Buffer)
   * @param filename Original filename
   * @param contentType MIME type of the file
   * @returns Information about the stored file
   */
  async uploadFile(
    file: Buffer, 
    filename: string, 
    contentType: string
  ): Promise<StoredFile> {
    try {
      // Generate a unique ID for this file
      const id = randomUUID();
      
      // Get file extension
      const ext = path.extname(filename);
      
      // Create a path with the original extension
      const fileId = `${id}${ext}`;
      
      // Upload the file
      await this.storageService.uploadFile(fileId, file, contentType);
      
      // Create and return file metadata
      const fileData: StoredFile = {
        id: fileId,
        originalName: filename,
        contentType,
        size: file.length,
        createdAt: new Date()
      };
      
      return fileData;
    } catch (error: unknown) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Retrieve a file from storage
   * @param fileId Unique identifier for the file
   * @returns File data as Buffer
   */
  async getFile(fileId: string): Promise<Buffer> {
    try {
      return await this.storageService.getFile(fileId);
    } catch (error: unknown) {
      console.error('Error retrieving file:', error);
      throw new Error(`Failed to retrieve file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get a public URL for accessing a file
   * @param fileId Unique identifier for the file
   * @param expiryMinutes How long the URL should be valid for (in minutes)
   * @returns Public URL for the file
   */
  async getPublicUrl(fileId: string, expiryMinutes: number = 60): Promise<string> {
    try {
      return await this.storageService.getPublicUrl(fileId, expiryMinutes);
    } catch (error: unknown) {
      console.error('Error generating public URL:', error);
      throw new Error(`Failed to generate public URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Delete a file from storage
   * @param fileId Unique identifier for the file
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.storageService.deleteFile(fileId);
    } catch (error: unknown) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 