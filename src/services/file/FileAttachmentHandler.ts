import { FileMetadata, FileAttachmentType, FileProcessingStatus } from '@/types/files';
import { FileStorageService } from '../storage/FileStorageService';
import { ThumbnailService, ThumbnailOptions } from '../image/ThumbnailService';

/**
 * Configuration options for file attachment handling
 */
export interface FileAttachmentOptions {
  /**
   * Maximum file size in bytes
   */
  maxFileSize: number;

  /**
   * Allowed file types
   */
  allowedTypes: string[];

  /**
   * Thumbnail generation options
   */
  thumbnailOptions?: Partial<ThumbnailOptions>;

  /**
   * Whether to generate thumbnails for non-image files
   */
  generateNonImageThumbnails: boolean;
}

/**
 * Default file attachment options
 */
const DEFAULT_OPTIONS: FileAttachmentOptions = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'image/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ],
  generateNonImageThumbnails: false
};

/**
 * Result of file attachment processing
 */
export interface FileAttachmentResult {
  /**
   * File metadata
   */
  metadata: FileMetadata;

  /**
   * Preview URL (thumbnail for images, icon for other types)
   */
  preview: string;

  /**
   * Original file reference
   */
  file: File;
}

/**
 * Handler for managing file attachments
 */
export class FileAttachmentHandler {
  private readonly storageService: FileStorageService;
  private readonly thumbnailService: ThumbnailService;
  private readonly options: FileAttachmentOptions;

  constructor(
    storageService: FileStorageService,
    options: Partial<FileAttachmentOptions> = {}
  ) {
    this.storageService = storageService;
    this.thumbnailService = ThumbnailService.getInstance();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Process a file for attachment
   */
  public async processFile(file: File): Promise<FileAttachmentResult> {
    // Validate file
    await this.validateFile(file);

    // Generate unique ID
    const fileId = this.generateFileId(file);

    // Create metadata
    const metadata: FileMetadata = {
      id: fileId,
      filename: file.name,
      type: file.type,
      attachmentType: this.getAttachmentType(file),
      size: file.size,
      timestamp: Date.now(),
      processingStatus: FileProcessingStatus.PROCESSING
    };

    try {
      // Generate preview
      const preview = await this.generatePreview(file);

      // Store file data
      await this.storeFile(file, fileId);

      // Update metadata status
      metadata.processingStatus = FileProcessingStatus.COMPLETED;

      return {
        metadata,
        preview,
        file
      };
    } catch (error) {
      metadata.processingStatus = FileProcessingStatus.FAILED;
      metadata.processingError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Process multiple files for attachment
   */
  public async processFiles(files: File[]): Promise<FileAttachmentResult[]> {
    return Promise.all(files.map(file => this.processFile(file)));
  }

  /**
   * Validate a file against configured options
   */
  private async validateFile(file: File): Promise<void> {
    // Check file size
    if (file.size > this.options.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.options.maxFileSize} bytes`);
    }

    // Check file type
    const isAllowed = this.options.allowedTypes.some(allowedType => {
      if (allowedType.endsWith('/*')) {
        const typePrefix = allowedType.slice(0, -2);
        return file.type.startsWith(typePrefix);
      }
      return file.type === allowedType;
    });

    if (!isAllowed) {
      throw new Error(`File type ${file.type} is not allowed`);
    }
  }

  /**
   * Generate a unique file ID
   */
  private generateFileId(file: File): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const typePrefix = file.type.split('/')[0].charAt(0);
    return `${typePrefix}_${timestamp}_${random}`;
  }

  /**
   * Determine attachment type from file
   */
  private getAttachmentType(file: File): FileAttachmentType {
    if (file.type.startsWith('image/')) {
      return FileAttachmentType.IMAGE;
    } else if (file.type.startsWith('video/')) {
      return FileAttachmentType.VIDEO;
    } else if (file.type.startsWith('audio/')) {
      return FileAttachmentType.AUDIO;
    } else if (
      file.type.startsWith('application/pdf') ||
      file.type.startsWith('application/msword') ||
      file.type.startsWith('application/vnd.openxmlformats-officedocument') ||
      file.type.startsWith('text/')
    ) {
      return FileAttachmentType.DOCUMENT;
    }
    return FileAttachmentType.OTHER;
  }

  /**
   * Generate preview for a file
   */
  private async generatePreview(file: File): Promise<string> {
    if (file.type.startsWith('image/')) {
      return this.thumbnailService.generateThumbnail(file, this.options.thumbnailOptions);
    }

    if (this.options.generateNonImageThumbnails) {
      // TODO: Implement preview generation for non-image files
      // This could include:
      // - PDF thumbnails
      // - Document previews
      // - Video thumbnails
      // For now, return a placeholder
      return this.getPlaceholderPreview(file.type);
    }

    return this.getPlaceholderPreview(file.type);
  }

  /**
   * Store file data using storage service
   */
  private async storeFile(file: File, id: string): Promise<void> {
    const reader = new FileReader();

    const fileData = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    await this.storageService.saveFile({
      id,
      data: fileData,
      type: file.type,
      filename: file.name,
      timestamp: Date.now()
    });
  }

  /**
   * Get placeholder preview for non-image files
   */
  private getPlaceholderPreview(fileType: string): string {
    // Return appropriate icon based on file type
    // This could be enhanced to use actual icons
    if (fileType.startsWith('application/pdf')) {
      return '/icons/pdf.svg';
    } else if (fileType.startsWith('application/msword') || fileType.startsWith('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      return '/icons/document.svg';
    } else if (fileType.startsWith('text/')) {
      return '/icons/text.svg';
    }
    return '/icons/file.svg';
  }
} 