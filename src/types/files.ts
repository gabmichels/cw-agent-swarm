/**
 * Possible file attachment types
 */
export enum FileAttachmentType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  VIDEO = 'video',
  AUDIO = 'audio',
  OTHER = 'other'
}

/**
 * Status of file processing
 */
export enum FileProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Metadata for a file attachment
 */
export interface FileMetadata {
  /**
   * Unique identifier for the file
   */
  id: string;

  /**
   * Original filename
   */
  filename: string;

  /**
   * MIME type of the file
   */
  type: string;

  /**
   * Type of attachment
   */
  attachmentType: FileAttachmentType;

  /**
   * Size of file in bytes
   */
  size: number;

  /**
   * Timestamp when file was created/uploaded
   */
  timestamp: number;

  /**
   * Processing status of the file
   */
  processingStatus: FileProcessingStatus;

  /**
   * Error message if processing failed
   */
  processingError?: string;

  /**
   * Additional metadata specific to file type
   */
  metadata?: Record<string, unknown>;
}

/**
 * File attachment interface for messages
 */
export interface FileAttachment {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * File type
   */
  type: string;

  /**
   * URL to access the file
   */
  url: string;

  /**
   * Preview URL (for images)
   */
  preview?: string;

  /**
   * File metadata
   */
  metadata: FileMetadata;
} 