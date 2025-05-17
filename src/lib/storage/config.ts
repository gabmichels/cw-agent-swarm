import { StorageProvider } from './StorageService';

interface StorageConfig {
  provider: StorageProvider;
  bucket: string;
  gcpProjectId?: string;
  gcpKeyFilename?: string;
  minioEndpoint?: string;
  minioAccessKey?: string;
  minioSecretKey?: string;
  localStoragePath?: string;
}

const configs: Record<string, StorageConfig> = {
  development: {
    provider: StorageProvider.MINIO,
    bucket: 'chat-attachments',
    minioEndpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
    minioAccessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    minioSecretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    localStoragePath: './storage'
  },
  
  // For local development using MinIO
  minio: {
    provider: StorageProvider.MINIO,
    bucket: 'chat-attachments',
    minioEndpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
    minioAccessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    minioSecretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
  },
  
  // For production with GCP
  production: {
    provider: StorageProvider.GCP,
    bucket: process.env.GCP_STORAGE_BUCKET || 'chat-attachments',
    gcpProjectId: process.env.GCP_PROJECT_ID,
    gcpKeyFilename: process.env.GCP_KEY_FILENAME
  }
};

// Get environment-specific config
export function getStorageConfig(): StorageConfig {
  const env = process.env.NODE_ENV || 'development';
  
  // For local testing with explicitly defined local storage
  if (process.env.USE_LOCAL_STORAGE === 'true') {
    console.log('Using LOCAL storage provider due to USE_LOCAL_STORAGE=true');
    return {
      ...configs.development,
      provider: StorageProvider.LOCAL
    };
  }
  
  // For local MinIO testing
  if (process.env.USE_MINIO === 'true') {
    console.log('Using MINIO storage provider due to USE_MINIO=true');
    return configs.minio;
  }
  
  return configs[env] || configs.development;
} 