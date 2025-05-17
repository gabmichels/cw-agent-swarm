import { Storage } from '@google-cloud/storage';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions } from '@azure/storage-blob';
import * as fs from 'fs';
import * as path from 'path';

export enum StorageProvider {
  GCP = 'gcp',
  AWS = 'aws',
  AZURE = 'azure',
  MINIO = 'minio',
  LOCAL = 'local'
}

export interface StorageServiceConfig {
  provider: StorageProvider;
  bucket: string;
  
  // GCP specific
  gcpProjectId?: string;
  gcpKeyFilename?: string;
  
  // AWS/MinIO specific
  awsEndpoint?: string;
  awsRegion?: string; 
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  
  // Azure specific
  azureAccountName?: string;
  azureAccountKey?: string;
  
  // Local specific
  localStoragePath?: string;
}

/**
 * Multi-cloud compatible storage service
 * Supports: GCP Cloud Storage, AWS S3, Azure Blob Storage, MinIO, Local filesystem
 */
export class StorageService {
  private provider: StorageProvider;
  private bucket: string;
  
  // Clients
  private gcpClient?: Storage;
  private s3Client?: S3Client;
  private azureClient?: BlobServiceClient;
  private localStoragePath?: string;
  
  constructor(config: StorageServiceConfig) {
    this.provider = config.provider;
    this.bucket = config.bucket;
    
    // Initialize the appropriate client based on provider
    switch (this.provider) {
      case StorageProvider.GCP:
        this.initGcpClient(config);
        break;
      case StorageProvider.AWS:
      case StorageProvider.MINIO:
        this.initS3Client(config);
        break;
      case StorageProvider.AZURE:
        this.initAzureClient(config);
        break;
      case StorageProvider.LOCAL:
        this.initLocalStorage(config);
        break;
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }
  
  /**
   * Initialize Google Cloud Storage client
   */
  private initGcpClient(config: StorageServiceConfig): void {
    if (!config.gcpProjectId) {
      throw new Error('GCP project ID is required for GCP Storage');
    }
    
    const options: any = {
      projectId: config.gcpProjectId
    };
    
    if (config.gcpKeyFilename) {
      options.keyFilename = config.gcpKeyFilename;
    }
    
    this.gcpClient = new Storage(options);
  }
  
  /**
   * Initialize AWS S3 or MinIO client
   */
  private initS3Client(config: StorageServiceConfig): void {
    const options: any = {
      region: config.awsRegion || 'us-east-1'
    };
    
    if (config.awsEndpoint) {
      options.endpoint = config.awsEndpoint;
      options.forcePathStyle = true; // Required for MinIO
    }
    
    if (config.awsAccessKeyId && config.awsSecretAccessKey) {
      options.credentials = {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey
      };
    }
    
    this.s3Client = new S3Client(options);
  }
  
  /**
   * Initialize Azure Blob Storage client
   */
  private initAzureClient(config: StorageServiceConfig): void {
    if (!config.azureAccountName || !config.azureAccountKey) {
      throw new Error('Azure account name and key are required for Azure Blob Storage');
    }
    
    const sharedKeyCredential = new StorageSharedKeyCredential(
      config.azureAccountName,
      config.azureAccountKey
    );
    
    this.azureClient = new BlobServiceClient(
      `https://${config.azureAccountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
  }
  
  /**
   * Initialize local file storage
   */
  private initLocalStorage(config: StorageServiceConfig): void {
    this.localStoragePath = config.localStoragePath || path.join(process.cwd(), 'storage');
    
    // Create storage directory if it doesn't exist
    const bucketPath = path.join(this.localStoragePath, this.bucket);
    if (!fs.existsSync(bucketPath)) {
      fs.mkdirSync(bucketPath, { recursive: true });
    }
  }
  
  /**
   * Upload a file to storage
   * @param fileId Unique identifier for the file
   * @param buffer File data as Buffer
   * @param contentType MIME type of the file
   * @returns URL or path to the stored file
   */
  async uploadFile(fileId: string, buffer: Buffer, contentType: string): Promise<string> {
    switch (this.provider) {
      case StorageProvider.GCP:
        return this.uploadToGcp(fileId, buffer, contentType);
      case StorageProvider.AWS:
      case StorageProvider.MINIO:
        return this.uploadToS3(fileId, buffer, contentType);
      case StorageProvider.AZURE:
        return this.uploadToAzure(fileId, buffer, contentType);
      case StorageProvider.LOCAL:
        return this.uploadToLocal(fileId, buffer);
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }
  
  /**
   * Retrieve a file from storage
   * @param fileId Unique identifier for the file
   * @returns File data as Buffer
   */
  async getFile(fileId: string): Promise<Buffer> {
    switch (this.provider) {
      case StorageProvider.GCP:
        return this.getFromGcp(fileId);
      case StorageProvider.AWS:
      case StorageProvider.MINIO:
        return this.getFromS3(fileId);
      case StorageProvider.AZURE:
        return this.getFromAzure(fileId);
      case StorageProvider.LOCAL:
        return this.getFromLocal(fileId);
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }
  
  /**
   * Delete a file from storage
   * @param fileId Unique identifier for the file
   */
  async deleteFile(fileId: string): Promise<void> {
    switch (this.provider) {
      case StorageProvider.GCP:
        await this.deleteFromGcp(fileId);
        break;
      case StorageProvider.AWS:
      case StorageProvider.MINIO:
        await this.deleteFromS3(fileId);
        break;
      case StorageProvider.AZURE:
        await this.deleteFromAzure(fileId);
        break;
      case StorageProvider.LOCAL:
        await this.deleteFromLocal(fileId);
        break;
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }
  
  /**
   * Get a public URL for a file
   * @param fileId Unique identifier for the file
   * @param expiryMinutes How long the URL should be valid for (in minutes)
   * @returns Public URL for the file
   */
  async getPublicUrl(fileId: string, expiryMinutes: number = 60): Promise<string> {
    switch (this.provider) {
      case StorageProvider.GCP:
        return this.getGcpPublicUrl(fileId, expiryMinutes);
      case StorageProvider.AWS:
      case StorageProvider.MINIO:
        return this.getS3PublicUrl(fileId, expiryMinutes);
      case StorageProvider.AZURE:
        return this.getAzurePublicUrl(fileId, expiryMinutes);
      case StorageProvider.LOCAL:
        return this.getLocalPublicUrl(fileId);
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }
  
  // GCP implementation methods
  private async uploadToGcp(fileId: string, buffer: Buffer, contentType: string): Promise<string> {
    const file = this.gcpClient!.bucket(this.bucket).file(fileId);
    await file.save(buffer, {
      contentType,
      metadata: {
        contentType
      }
    });
    return fileId;
  }
  
  private async getFromGcp(fileId: string): Promise<Buffer> {
    const file = this.gcpClient!.bucket(this.bucket).file(fileId);
    const [contents] = await file.download();
    return contents;
  }
  
  private async deleteFromGcp(fileId: string): Promise<void> {
    const file = this.gcpClient!.bucket(this.bucket).file(fileId);
    await file.delete();
  }
  
  private async getGcpPublicUrl(fileId: string, expiryMinutes: number): Promise<string> {
    const file = this.gcpClient!.bucket(this.bucket).file(fileId);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiryMinutes * 60 * 1000
    });
    return url;
  }
  
  // S3/MinIO implementation methods
  private async uploadToS3(fileId: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.s3Client!.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileId,
      Body: buffer,
      ContentType: contentType
    }));
    return fileId;
  }
  
  private async getFromS3(fileId: string): Promise<Buffer> {
    const response = await this.s3Client!.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileId
    }));
    
    return Buffer.from(await response.Body!.transformToByteArray());
  }
  
  private async deleteFromS3(fileId: string): Promise<void> {
    // Import DeleteObjectCommand on-demand to avoid circular dependencies
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    
    // Use proper DeleteObjectCommand for S3/MinIO deletion
    await this.s3Client!.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fileId
    }));
  }
  
  private async getS3PublicUrl(fileId: string, expiryMinutes: number): Promise<string> {
    // Import required S3 classes for creating presigned URLs
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    
    // Create the command to get the object
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileId
    });
    
    try {
      // Calculate expiry time in seconds
      const expirySeconds = expiryMinutes * 60;
      
      // Generate the presigned URL
      const url = await getSignedUrl(this.s3Client!, command, { 
        expiresIn: expirySeconds 
      });
      
      // For local MinIO development, ensure URL is properly formatted
      // Sometimes MinIO URLs need adjustment in development environments
      if (url.includes('localhost:9000')) {
        // Parse the URL to ensure it's correctly formed
        const parsedUrl = new URL(url);
        
        // Ensure localhost URL uses proper encoding
        return url.replace(/%2F/g, '/');
      }
      
      return url;
    } catch (error) {
      console.error('Error generating S3/MinIO presigned URL:', error);
      
      // Try a fallback for MinIO by constructing a direct URL
      // Note: This works only for buckets with public access enabled
      if (this.provider === StorageProvider.MINIO) {
        const endpoint = (this.s3Client as any)?.config?.endpoint?.href || 'http://localhost:9000/';
        const directUrl = `${endpoint}${this.bucket}/${fileId}`;
        console.warn(`Using fallback direct MinIO URL: ${directUrl}`);
        return directUrl;
      }
      
      // If not MinIO or fallback fails, rethrow error
      throw error;
    }
  }
  
  // Azure implementation methods
  private async uploadToAzure(fileId: string, buffer: Buffer, contentType: string): Promise<string> {
    const containerClient = this.azureClient!.getContainerClient(this.bucket);
    const blockBlobClient = containerClient.getBlockBlobClient(fileId);
    
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType
      }
    });
    
    return fileId;
  }
  
  private async getFromAzure(fileId: string): Promise<Buffer> {
    const containerClient = this.azureClient!.getContainerClient(this.bucket);
    const blockBlobClient = containerClient.getBlockBlobClient(fileId);
    
    const downloadResponse = await blockBlobClient.download(0);
    const chunks: Buffer[] = [];
    
    for await (const chunk of downloadResponse.readableStreamBody!) {
      chunks.push(Buffer.from(chunk));
    }
    
    return Buffer.concat(chunks);
  }
  
  private async deleteFromAzure(fileId: string): Promise<void> {
    const containerClient = this.azureClient!.getContainerClient(this.bucket);
    const blockBlobClient = containerClient.getBlockBlobClient(fileId);
    
    await blockBlobClient.delete();
  }
  
  private async getAzurePublicUrl(fileId: string, expiryMinutes: number): Promise<string> {
    const containerClient = this.azureClient!.getContainerClient(this.bucket);
    const blockBlobClient = containerClient.getBlockBlobClient(fileId);
    
    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes);
    
    // Create proper permissions object
    const permissions = new BlobSASPermissions();
    permissions.read = true;
    
    const sasToken = await blockBlobClient.generateSasUrl({
      permissions,
      expiresOn
    });
    
    return sasToken;
  }
  
  // Local filesystem implementation methods
  private async uploadToLocal(fileId: string, buffer: Buffer): Promise<string> {
    const filePath = this.getLocalFilePath(fileId);
    await fs.promises.writeFile(filePath, buffer);
    return fileId;
  }
  
  private async getFromLocal(fileId: string): Promise<Buffer> {
    const filePath = this.getLocalFilePath(fileId);
    return fs.promises.readFile(filePath);
  }
  
  private async deleteFromLocal(fileId: string): Promise<void> {
    const filePath = this.getLocalFilePath(fileId);
    await fs.promises.unlink(filePath);
  }
  
  private getLocalPublicUrl(fileId: string): string {
    // For local development, we'll just return a relative URL
    // In a real app, you might have an Express route to serve these files
    return `/api/storage/${this.bucket}/${fileId}`;
  }
  
  private getLocalFilePath(fileId: string): string {
    return path.join(this.localStoragePath!, this.bucket, fileId);
  }
} 