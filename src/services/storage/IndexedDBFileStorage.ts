import { FileMetadata, FileProcessingStatus, FileAttachmentType } from '@/types/files';
import { FileStorageService, FileStorageError, FileStorageErrorCode, StoredFileData, FileStorageOptions } from './FileStorageService';

const DEFAULT_DB_NAME = 'crowd-wisdom-storage';
const DEFAULT_STORE_NAME = 'file-attachments';
const DEFAULT_VERSION = 1;

/**
 * IndexedDB implementation of FileStorageService
 */
export class IndexedDBFileStorage implements FileStorageService {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly storeName: string;
  private readonly version: number;

  constructor(options: FileStorageOptions = {}) {
    this.dbName = options.dbName || DEFAULT_DB_NAME;
    this.storeName = options.storeName || DEFAULT_STORE_NAME;
    this.version = options.version || DEFAULT_VERSION;
  }

  /**
   * Initialize the IndexedDB database
   */
  public async initialize(): Promise<void> {
    if (this.db) {
      return;
    }

    try {
      this.db = await this.openDatabase();
    } catch (error) {
      throw new FileStorageError(
        `Failed to initialize IndexedDB: ${error instanceof Error ? error.message : String(error)}`,
        FileStorageErrorCode.INITIALIZATION_FAILED
      );
    }
  }

  /**
   * Save file data to IndexedDB
   */
  public async saveFile(fileData: StoredFileData): Promise<string> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.put(fileData);

        request.onsuccess = () => {
          console.log(`File ${fileData.filename} saved to IndexedDB`);
          resolve(fileData.id);
        };

        request.onerror = () => {
          reject(new FileStorageError(
            `Failed to save file ${fileData.filename}`,
            FileStorageErrorCode.SAVE_FAILED,
            { filename: fileData.filename }
          ));
        };
      });
    } catch (error) {
      throw new FileStorageError(
        `Error saving file: ${error instanceof Error ? error.message : String(error)}`,
        FileStorageErrorCode.SAVE_FAILED,
        { filename: fileData.filename }
      );
    }
  }

  /**
   * Retrieve file data from IndexedDB
   */
  public async getFile(id: string): Promise<StoredFileData | null> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.get(id);

        request.onsuccess = () => {
          const file = request.result;
          if (file) {
            console.log(`File ${id} retrieved from IndexedDB`);
            resolve(file);
          } else {
            console.log(`File ${id} not found in IndexedDB`);
            resolve(null);
          }
        };

        request.onerror = () => {
          reject(new FileStorageError(
            `Failed to retrieve file ${id}`,
            FileStorageErrorCode.RETRIEVE_FAILED,
            { fileId: id }
          ));
        };
      });
    } catch (error) {
      throw new FileStorageError(
        `Error retrieving file: ${error instanceof Error ? error.message : String(error)}`,
        FileStorageErrorCode.RETRIEVE_FAILED,
        { fileId: id }
      );
    }
  }

  /**
   * Delete file from IndexedDB
   */
  public async deleteFile(id: string): Promise<boolean> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.delete(id);

        request.onsuccess = () => {
          console.log(`File ${id} deleted from IndexedDB`);
          resolve(true);
        };

        request.onerror = () => {
          reject(new FileStorageError(
            `Failed to delete file ${id}`,
            FileStorageErrorCode.DELETE_FAILED,
            { fileId: id }
          ));
        };
      });
    } catch (error) {
      throw new FileStorageError(
        `Error deleting file: ${error instanceof Error ? error.message : String(error)}`,
        FileStorageErrorCode.DELETE_FAILED,
        { fileId: id }
      );
    }
  }

  /**
   * Check if file exists in IndexedDB
   */
  public async fileExists(id: string): Promise<boolean> {
    const file = await this.getFile(id);
    return file !== null;
  }

  /**
   * List all files in IndexedDB
   */
  public async listFiles(): Promise<FileMetadata[]> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const files = request.result;
          const metadata: FileMetadata[] = files.map(file => ({
            id: file.id,
            filename: file.filename,
            type: file.type,
            attachmentType: this.getAttachmentType(file.type),
            size: file.data.length,
            timestamp: file.timestamp,
            processingStatus: FileProcessingStatus.COMPLETED,
            metadata: file.metadata
          }));
          resolve(metadata);
        };

        request.onerror = () => {
          reject(new FileStorageError(
            'Failed to list files',
            FileStorageErrorCode.RETRIEVE_FAILED
          ));
        };
      });
    } catch (error) {
      throw new FileStorageError(
        `Error listing files: ${error instanceof Error ? error.message : String(error)}`,
        FileStorageErrorCode.RETRIEVE_FAILED
      );
    }
  }

  /**
   * Clear all files from IndexedDB
   */
  public async clearStorage(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.clear();

        request.onsuccess = () => {
          console.log('IndexedDB storage cleared');
          resolve();
        };

        request.onerror = () => {
          reject(new FileStorageError(
            'Failed to clear storage',
            FileStorageErrorCode.DELETE_FAILED
          ));
        };
      });
    } catch (error) {
      throw new FileStorageError(
        `Error clearing storage: ${error instanceof Error ? error.message : String(error)}`,
        FileStorageErrorCode.DELETE_FAILED
      );
    }
  }

  /**
   * Open IndexedDB database
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Determine attachment type from MIME type
   */
  private getAttachmentType(mimeType: string): FileAttachmentType {
    if (mimeType.startsWith('image/')) {
      return FileAttachmentType.IMAGE;
    } else if (mimeType.startsWith('video/')) {
      return FileAttachmentType.VIDEO;
    } else if (mimeType.startsWith('audio/')) {
      return FileAttachmentType.AUDIO;
    } else if (
      mimeType.startsWith('application/pdf') ||
      mimeType.startsWith('application/msword') ||
      mimeType.startsWith('application/vnd.openxmlformats-officedocument') ||
      mimeType.startsWith('text/')
    ) {
      return FileAttachmentType.DOCUMENT;
    }
    return FileAttachmentType.OTHER;
  }
} 