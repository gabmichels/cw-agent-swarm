import { FileMetadata } from '../../types/files';

/**
 * Status of a file upload
 */
export enum UploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Progress information for a file upload
 */
export interface UploadProgress {
  /**
   * Number of bytes uploaded
   */
  bytesUploaded: number;

  /**
   * Total number of bytes to upload
   */
  totalBytes: number;

  /**
   * Upload speed in bytes per second
   */
  speed: number;

  /**
   * Estimated time remaining in milliseconds
   */
  timeRemaining: number;
}

/**
 * Information about a file upload
 */
export interface UploadInfo {
  /**
   * Unique identifier for the upload
   */
  id: string;

  /**
   * File being uploaded
   */
  file: File;

  /**
   * Metadata about the file
   */
  metadata: FileMetadata;

  /**
   * Current status of the upload
   */
  status: UploadStatus;

  /**
   * Upload progress information
   */
  progress: UploadProgress;

  /**
   * Error message if upload failed
   */
  error?: string;

  /**
   * Timestamp when upload started
   */
  startTime: number;

  /**
   * Timestamp when upload completed or failed
   */
  endTime?: number;
}

/**
 * Error codes for file uploads
 */
export enum UploadErrorCode {
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  CANCELLED = 'CANCELLED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  VALIDATION_FAILED = 'VALIDATION_FAILED'
}

/**
 * Custom error class for file uploads
 */
export class UploadError extends Error {
  constructor(
    message: string,
    public readonly code: UploadErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * Options for file uploads
 */
export interface UploadOptions {
  /**
   * Whether to compress the file before upload
   */
  compress?: boolean;

  /**
   * Maximum file size in bytes
   */
  maxSize?: number;

  /**
   * Allowed file types
   */
  allowedTypes?: string[];

  /**
   * Number of retry attempts
   */
  retryAttempts?: number;

  /**
   * Delay between retries in milliseconds
   */
  retryDelay?: number;

  /**
   * Whether to show upload progress
   */
  showProgress?: boolean;
}

/**
 * Event types for upload events
 */
export enum UploadEventType {
  PROGRESS = 'progress',
  STATUS_CHANGE = 'statusChange',
  ERROR = 'error',
  COMPLETE = 'complete'
}

/**
 * Base interface for upload events
 */
export interface UploadEvent {
  type: UploadEventType;
  uploadId: string;
  timestamp: number;
}

/**
 * Progress update event
 */
export interface UploadProgressEvent extends UploadEvent {
  type: UploadEventType.PROGRESS;
  progress: UploadProgress;
}

/**
 * Status change event
 */
export interface UploadStatusEvent extends UploadEvent {
  type: UploadEventType.STATUS_CHANGE;
  status: UploadStatus;
}

/**
 * Error event
 */
export interface UploadErrorEvent extends UploadEvent {
  type: UploadEventType.ERROR;
  error: UploadError;
}

/**
 * Complete event
 */
export interface UploadCompleteEvent extends UploadEvent {
  type: UploadEventType.COMPLETE;
  metadata: FileMetadata;
}

/**
 * Union type for all upload events
 */
export type UploadEventTypes = 
  | UploadProgressEvent 
  | UploadStatusEvent 
  | UploadErrorEvent 
  | UploadCompleteEvent;

/**
 * Event handler type
 */
export type UploadEventHandler = (event: UploadEventTypes) => void;

/**
 * Interface for handling file uploads
 */
export interface FileUploadService {
  /**
   * Initialize the upload service
   * @param options Upload configuration options
   */
  initialize(options?: UploadOptions): Promise<void>;

  /**
   * Start uploading a file
   * @param file File to upload
   * @param metadata Optional metadata about the file
   * @returns Upload information
   */
  uploadFile(file: File, metadata?: Partial<FileMetadata>): Promise<UploadInfo>;

  /**
   * Get information about an upload
   * @param uploadId ID of the upload
   * @returns Upload information or null if not found
   */
  getUploadInfo(uploadId: string): Promise<UploadInfo | null>;

  /**
   * Cancel an upload
   * @param uploadId ID of the upload to cancel
   * @returns true if cancelled, false if not found
   */
  cancelUpload(uploadId: string): Promise<boolean>;

  /**
   * Retry a failed upload
   * @param uploadId ID of the upload to retry
   * @returns Updated upload information
   */
  retryUpload(uploadId: string): Promise<UploadInfo>;

  /**
   * List all uploads
   * @returns Array of upload information
   */
  listUploads(): Promise<UploadInfo[]>;

  /**
   * Clear completed uploads
   * @returns Number of uploads cleared
   */
  clearCompleted(): Promise<number>;

  /**
   * Subscribe to upload events
   * @param handler Event handler function
   * @returns Unsubscribe function
   */
  subscribe(handler: UploadEventHandler): () => void;

  /**
   * Validate a file before upload
   * @param file File to validate
   * @throws UploadError if validation fails
   */
  validateFile(file: File): Promise<void>;
} 