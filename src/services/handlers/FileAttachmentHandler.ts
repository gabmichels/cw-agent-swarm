import { FileUploadImplementation } from '../upload/FileUploadImplementation';
import { IndexedDBFileStorage } from '../storage/IndexedDBFileStorage';
import { FileMetadata, FileAttachmentType, FileProcessingStatus, FileAttachment } from '@/types/files';
import { StoredFileData } from '../storage/FileStorageService';

export interface FileHandlerOptions {
  onProgress?: (progress: number) => void;
  onComplete?: (metadata: FileMetadata) => void;
  onError?: (error: Error) => void;
}

export class FileAttachmentHandler {
  private storage: IndexedDBFileStorage;
  private uploadCancellations: Map<string, boolean>;

  constructor(
    private fileUploadService: FileUploadImplementation,
    fileStorageService: IndexedDBFileStorage
  ) {
    this.storage = fileStorageService;
    this.uploadCancellations = new Map();
  }

  async handleFile(file: File, options?: FileHandlerOptions): Promise<FileAttachment> {
    try {
      // Upload file
      const uploadResult = await this.fileUploadService.uploadFile(file);

      // Create metadata
      const metadata: FileMetadata = {
        id: uploadResult.id,
        filename: file.name,
        type: file.type,
        size: file.size,
        attachmentType: this.determineFileType(file.type),
        processingStatus: FileProcessingStatus.COMPLETED,
        timestamp: Date.now()
      };

      // Track progress if callback provided
      if (options?.onProgress) {
        const progressHandler = (progress: number) => options.onProgress!(progress);
        // Implement progress tracking manually with a timer for simulation
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          progressHandler(Math.min(progress, 100));
          if (progress >= 100) clearInterval(interval);
        }, 100);
      }

      // Store metadata
      await this.storage.saveFile({
        id: metadata.id,
        data: await file.text(),
        type: file.type,
        filename: file.name,
        timestamp: Date.now()
      });

      // Create file attachment - generate a data URL for the preview
      const url = URL.createObjectURL(file);
      const attachment: FileAttachment = {
        id: metadata.id,
        type: file.type,
        url: url,
        preview: file.type.startsWith('image/') ? url : undefined,
        metadata
      };

      return attachment;
    } catch (error) {
      if (options?.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)));
      }
      console.error('Failed to handle file:', error);
      throw error;
    }
  }

  async handleFileUpload(file: File, options: FileHandlerOptions): Promise<FileMetadata> {
    try {
      // Validate file
      await this.validateFile(file);

      // Store file
      const metadata = await this.storeFile(file);

      // Generate preview if it's an image
      if (file.type.startsWith('image/')) {
        const preview = await this.generateThumbnail(file);
        metadata.metadata = { preview };
      }

      options.onComplete?.(metadata);
      return metadata;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }

  async storeFile(file: File): Promise<FileMetadata> {
    try {
      const metadata: FileMetadata = {
        id: crypto.randomUUID(),
        filename: file.name,
        type: file.type,
        size: file.size,
        attachmentType: this.determineFileType(file.type),
        processingStatus: FileProcessingStatus.COMPLETED,
        timestamp: Date.now()
      };

      const fileData: StoredFileData = {
        id: metadata.id,
        data: await file.text(),
        type: file.type,
        filename: file.name,
        timestamp: Date.now()
      };

      await this.storage.saveFile(fileData);
      return metadata;
    } catch (error) {
      console.error('Error storing file:', error);
      throw error;
    }
  }

  async retrieveFile(id: string): Promise<Blob> {
    try {
      const fileData = await this.storage.getFile(id);
      if (!fileData) {
        throw new Error(`File ${id} not found`);
      }
      return new Blob([fileData.data], { type: fileData.type });
    } catch (error) {
      console.error('Error retrieving file:', error);
      throw error;
    }
  }

  async deleteFile(id: string): Promise<void> {
    try {
      await this.storage.deleteFile(id);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  cancelUpload(fileName: string): void {
    this.uploadCancellations.set(fileName, true);
  }

  async generateThumbnail(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
      return this.getDefaultThumbnail(file.type);
    }

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      const img = await this.createImage(file);
      const maxSize = 200;
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL(file.type);
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return this.getDefaultThumbnail(file.type);
    }
  }

  private async createImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private getDefaultThumbnail(type: string): string {
    // Return a data URL for a default icon based on file type
    return `data:image/svg+xml,${encodeURIComponent(this.getDefaultIcon(type))}`;
  }

  private getDefaultIcon(type: string): string {
    // Simple SVG icons for different file types
    if (type.startsWith('image/')) {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/></svg>';
    }
    if (type.startsWith('video/')) {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>';
    }
    if (type.startsWith('audio/')) {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg>';
    }
    // Default document icon
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
  }

  private async validateFile(file: File): Promise<void> {
    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File size exceeds maximum size of 50MB');
    }

    // Check file type
    const allowedTypes = [
      'image/',
      'text/',
      'application/pdf',
      'application/json',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const isAllowed = allowedTypes.some(type => file.type.startsWith(type));
    if (!isAllowed) {
      throw new Error(`File type ${file.type} not allowed`);
    }
  }

  private determineFileType(mimeType: string): FileAttachmentType {
    if (mimeType.startsWith('image/')) {
      return FileAttachmentType.IMAGE;
    }
    if (mimeType.startsWith('video/')) {
      return FileAttachmentType.VIDEO;
    }
    if (mimeType.startsWith('audio/')) {
      return FileAttachmentType.AUDIO;
    }
    if (
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