import { v4 as uuidv4 } from 'uuid';
import { FileMetadata } from '../../types/files';
import { FileStorageService } from '../storage/FileStorageService';
import {
  FileUploadService,
  UploadOptions,
  UploadInfo,
  UploadStatus,
  UploadProgress,
  UploadError,
  UploadErrorCode,
  UploadEventType,
  UploadEventHandler,
  UploadEventTypes
} from './FileUploadService';

/**
 * Implementation of the FileUploadService interface
 */
export class FileUploadImplementation implements FileUploadService {
  private uploads: Map<string, UploadInfo> = new Map();
  private eventHandlers: Set<UploadEventHandler> = new Set();
  private options: UploadOptions = {
    compress: true,
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: [
      'image/*', 
      'application/pdf', 
      'text/*',
      'audio/*', 
      'video/*',
      // Document formats for knowledge uploads
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/json', // .json
      'text/csv', // .csv
      'text/markdown', // .md
      'text/x-markdown', // .md (alternative MIME type)
      'text/plain', // .txt
      'application/rtf', // .rtf
      'application/x-yaml', // .yaml
      'text/yaml', // .yml
      'application/xml', // .xml
      'text/xml' // .xml
    ],
    retryAttempts: 3,
    retryDelay: 1000,
    showProgress: true
  };

  constructor(private readonly fileStorage: FileStorageService) {}

  /**
   * Initialize the upload service
   */
  async initialize(options?: UploadOptions): Promise<void> {
    try {
      this.options = { ...this.options, ...options };
      await this.fileStorage.initialize();
    } catch (error) {
      throw new UploadError(
        'Failed to initialize upload service',
        UploadErrorCode.VALIDATION_FAILED,
        { error }
      );
    }
  }

  /**
   * Start uploading a file
   */
  async uploadFile(file: File, metadata?: Partial<FileMetadata>): Promise<UploadInfo> {
    try {
      await this.validateFile(file);

      const uploadId = uuidv4();
      const startTime = Date.now();

      const uploadInfo: UploadInfo = {
        id: uploadId,
        file,
        metadata: {
          id: uuidv4(),
          filename: file.name,
          type: file.type,
          size: file.size,
          timestamp: startTime,
          ...metadata
        } as FileMetadata,
        status: UploadStatus.PENDING,
        progress: {
          bytesUploaded: 0,
          totalBytes: file.size,
          speed: 0,
          timeRemaining: 0
        },
        startTime
      };

      this.uploads.set(uploadId, uploadInfo);
      this.emitEvent({
        type: UploadEventType.STATUS_CHANGE,
        uploadId,
        timestamp: Date.now(),
        status: UploadStatus.PENDING
      });

      // Start the upload process
      return this.processUpload(uploadInfo);
    } catch (error) {
      if (error instanceof UploadError) {
        throw error;
      }

      throw new UploadError(
        'Failed to start upload',
        UploadErrorCode.UPLOAD_FAILED,
        { error }
      );
    }
  }

  /**
   * Process the file upload
   */
  private async processUpload(uploadInfo: UploadInfo): Promise<UploadInfo> {
    try {
      // Update status to uploading
      uploadInfo = this.updateUploadStatus(uploadInfo, UploadStatus.UPLOADING);

      // Create chunks for progress tracking
      const CHUNK_SIZE = 1024 * 1024; // 1MB
      const totalChunks = Math.ceil(uploadInfo.file.size / CHUNK_SIZE);
      let uploadedChunks = 0;
      let lastProgressUpdate = Date.now();
      let bytesUploaded = 0;

      // Process file in chunks
      for (let start = 0; start < uploadInfo.file.size; start += CHUNK_SIZE) {
        const chunk = uploadInfo.file.slice(start, start + CHUNK_SIZE);
        
        // Simulate chunk upload (replace with actual upload logic)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        uploadedChunks++;
        bytesUploaded = Math.min(start + CHUNK_SIZE, uploadInfo.file.size);

        // Calculate progress
        const now = Date.now();
        const timeDiff = now - lastProgressUpdate;
        const speed = (CHUNK_SIZE / timeDiff) * 1000; // bytes per second
        const remainingBytes = uploadInfo.file.size - bytesUploaded;
        const timeRemaining = remainingBytes / speed * 1000;

        // Update progress
        uploadInfo = this.updateUploadProgress(uploadInfo, {
          bytesUploaded,
          totalBytes: uploadInfo.file.size,
          speed,
          timeRemaining
        });

        lastProgressUpdate = now;

        // Check if upload was cancelled
        if (uploadInfo.status === UploadStatus.CANCELLED) {
          throw new UploadError(
            'Upload cancelled',
            UploadErrorCode.CANCELLED
          );
        }
      }

      // Store file in FileStorageService
      await this.fileStorage.saveFile({
        id: uploadInfo.metadata.id,
        data: await uploadInfo.file.text(),
        type: uploadInfo.file.type,
        filename: uploadInfo.file.name,
        timestamp: uploadInfo.startTime
      });

      // Update status to completed
      uploadInfo = this.updateUploadStatus(uploadInfo, UploadStatus.COMPLETED);
      uploadInfo.endTime = Date.now();

      this.emitEvent({
        type: UploadEventType.COMPLETE,
        uploadId: uploadInfo.id,
        timestamp: uploadInfo.endTime,
        metadata: uploadInfo.metadata
      });

      return uploadInfo;
    } catch (error) {
      // Update status to failed
      uploadInfo = this.updateUploadStatus(
        uploadInfo,
        UploadStatus.FAILED,
        error instanceof Error ? error.message : 'Upload failed'
      );
      uploadInfo.endTime = Date.now();

      this.emitEvent({
        type: UploadEventType.ERROR,
        uploadId: uploadInfo.id,
        timestamp: uploadInfo.endTime,
        error: error instanceof UploadError ? error : new UploadError(
          'Upload failed',
          UploadErrorCode.UPLOAD_FAILED,
          { error }
        )
      });

      throw error;
    }
  }

  /**
   * Update upload status
   */
  private updateUploadStatus(
    uploadInfo: UploadInfo,
    status: UploadStatus,
    error?: string
  ): UploadInfo {
    const updatedInfo = {
      ...uploadInfo,
      status,
      error
    };

    this.uploads.set(uploadInfo.id, updatedInfo);

    this.emitEvent({
      type: UploadEventType.STATUS_CHANGE,
      uploadId: uploadInfo.id,
      timestamp: Date.now(),
      status
    });

    return updatedInfo;
  }

  /**
   * Update upload progress
   */
  private updateUploadProgress(
    uploadInfo: UploadInfo,
    progress: UploadProgress
  ): UploadInfo {
    const updatedInfo = {
      ...uploadInfo,
      progress
    };

    this.uploads.set(uploadInfo.id, updatedInfo);

    this.emitEvent({
      type: UploadEventType.PROGRESS,
      uploadId: uploadInfo.id,
      timestamp: Date.now(),
      progress
    });

    return updatedInfo;
  }

  /**
   * Get information about an upload
   */
  async getUploadInfo(uploadId: string): Promise<UploadInfo | null> {
    return this.uploads.get(uploadId) || null;
  }

  /**
   * Cancel an upload
   */
  async cancelUpload(uploadId: string): Promise<boolean> {
    const uploadInfo = await this.getUploadInfo(uploadId);
    if (!uploadInfo) {
      return false;
    }

    if (uploadInfo.status === UploadStatus.COMPLETED || 
        uploadInfo.status === UploadStatus.FAILED) {
      return false;
    }

    this.updateUploadStatus(uploadInfo, UploadStatus.CANCELLED);
    return true;
  }

  /**
   * Retry a failed upload
   */
  async retryUpload(uploadId: string): Promise<UploadInfo> {
    const uploadInfo = await this.getUploadInfo(uploadId);
    if (!uploadInfo) {
      throw new UploadError(
        'Upload not found',
        UploadErrorCode.VALIDATION_FAILED
      );
    }

    if (uploadInfo.status !== UploadStatus.FAILED) {
      throw new UploadError(
        'Can only retry failed uploads',
        UploadErrorCode.VALIDATION_FAILED
      );
    }

    // Reset upload info
    const retriedInfo: UploadInfo = {
      ...uploadInfo,
      status: UploadStatus.PENDING,
      progress: {
        bytesUploaded: 0,
        totalBytes: uploadInfo.file.size,
        speed: 0,
        timeRemaining: 0
      },
      startTime: Date.now(),
      endTime: undefined,
      error: undefined
    };

    this.uploads.set(uploadId, retriedInfo);

    // Start the upload process again
    return this.processUpload(retriedInfo);
  }

  /**
   * List all uploads
   */
  async listUploads(): Promise<UploadInfo[]> {
    return Array.from(this.uploads.values());
  }

  /**
   * Clear completed uploads
   */
  async clearCompleted(): Promise<number> {
    let cleared = 0;
    const entries = Array.from(this.uploads.entries());
    for (const [uploadId, uploadInfo] of entries) {
      if (uploadInfo.status === UploadStatus.COMPLETED) {
        this.uploads.delete(uploadId);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Subscribe to upload events
   */
  subscribe(handler: UploadEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Emit an event to all subscribers
   */
  private emitEvent(event: UploadEventTypes): void {
    const handlers = Array.from(this.eventHandlers);
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in upload event handler:', error);
      }
    }
  }

  /**
   * Validate a file before upload
   */
  async validateFile(file: File): Promise<void> {
    console.log('=== FileUploadImplementation.validateFile ===');
    console.log('File name:', file.name);
    console.log('File type (MIME):', file.type);
    console.log('File size:', file.size);

    if (!file) {
      throw new UploadError(
        'No file provided',
        UploadErrorCode.VALIDATION_FAILED
      );
    }

    if (file.size === 0) {
      throw new UploadError(
        'File is empty',
        UploadErrorCode.VALIDATION_FAILED
      );
    }

    if (file.size > this.options.maxSize!) {
      throw new UploadError(
        `File too large. Maximum size: ${this.options.maxSize! / (1024 * 1024)}MB`,
        UploadErrorCode.VALIDATION_FAILED
      );
    }

    // Check MIME type first
    console.log('Checking MIME type against allowed types:', this.options.allowedTypes);
    const mimeTypeAllowed = file.type && this.isFileTypeAllowed(file.type);
    console.log('MIME type allowed:', mimeTypeAllowed);
    
    if (mimeTypeAllowed) {
      console.log('✅ File validated by MIME type');
      return; // Valid MIME type found
    }

    // If MIME type check fails or is empty, check by file extension
    // This is useful for files like .md that might have inconsistent or empty MIME types
    const fileName = file.name.toLowerCase();
    console.log('MIME validation failed or empty, checking extension for file:', fileName);
    
    const allowedExtensions = [
      '.md', '.txt', '.pdf', '.doc', '.docx', '.csv', '.json', '.rtf', 
      '.yaml', '.yml', '.xml', '.xls', '.xlsx', '.ppt', '.pptx',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
      '.mp3', '.wav', '.mp4', '.avi', '.mov'
    ];
    
    console.log('Allowed extensions:', allowedExtensions);
    const hasValidExtension = allowedExtensions.some(ext => {
      const matches = fileName.endsWith(ext);
      if (matches) console.log('✅ Extension match found:', ext);
      return matches;
    });
    
    console.log('Extension validation result:', hasValidExtension);
    
    if (hasValidExtension) {
      console.log(`✅ File ${file.name} allowed by extension despite MIME type: "${file.type}"`);
      return; // Valid extension found
    }

    console.log('❌ Both MIME type and extension validation failed');
    throw new UploadError(
      `File type not allowed. MIME type: "${file.type}", Extension: "${fileName.split('.').pop()}"`,
      UploadErrorCode.VALIDATION_FAILED
    );
  }

  /**
   * Check if file type is allowed
   */
  private isFileTypeAllowed(type: string): boolean {
    return this.options.allowedTypes!.some(allowedType => {
      if (allowedType.endsWith('/*')) {
        const prefix = allowedType.slice(0, -2);
        return type.startsWith(prefix);
      }
      return type === allowedType;
    });
  }
} 