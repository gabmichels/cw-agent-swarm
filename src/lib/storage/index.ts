import { FileService } from './FileService';
import { getStorageConfig } from './config';

// Export types
export { StorageProvider } from './StorageService';
export type { StoredFile } from './FileService';

// Create and export a singleton FileService instance
let fileServiceInstance: FileService | null = null;

export function getFileService(): FileService {
  if (!fileServiceInstance) {
    const config = getStorageConfig();
    fileServiceInstance = new FileService({
      storageProvider: config.provider,
      bucket: config.bucket,
      gcpProjectId: config.gcpProjectId,
      gcpKeyFilename: config.gcpKeyFilename,
      minioEndpoint: config.minioEndpoint,
      minioAccessKey: config.minioAccessKey,
      minioSecretKey: config.minioSecretKey,
    });
  }
  
  return fileServiceInstance;
} 