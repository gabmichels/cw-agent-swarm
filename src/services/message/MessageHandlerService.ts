import { FileMetadata } from '../../types/files';

/**
 * Types of messages that can be handled
 */
export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  SYSTEM = 'system'
}

/**
 * Status of a message
 */
export enum MessageStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed'
}

/**
 * Base message interface
 */
export interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: number;
  status: MessageStatus;
  error?: string;
}

/**
 * Text message interface
 */
export interface TextMessage extends BaseMessage {
  type: MessageType.TEXT;
  content: string;
}

/**
 * File message interface
 */
export interface FileMessage extends BaseMessage {
  type: MessageType.FILE;
  files: FileMetadata[];
}

/**
 * System message interface
 */
export interface SystemMessage extends BaseMessage {
  type: MessageType.SYSTEM;
  content: string;
  level: 'info' | 'warning' | 'error';
}

/**
 * Union type for all message types
 */
export type Message = TextMessage | FileMessage | SystemMessage;

/**
 * Options for message handling
 */
export interface MessageHandlerOptions {
  /**
   * Maximum number of files per message
   */
  maxFilesPerMessage?: number;

  /**
   * Maximum file size in bytes
   */
  maxFileSize?: number;

  /**
   * Allowed file types
   */
  allowedFileTypes?: string[];

  /**
   * Whether to enable file attachments
   */
  enableFileAttachments?: boolean;
}

/**
 * Error codes for message handling
 */
export enum MessageHandlerErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SEND_FAILED = 'SEND_FAILED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  TOO_MANY_FILES = 'TOO_MANY_FILES',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  STORAGE_ERROR = 'STORAGE_ERROR'
}

/**
 * Custom error class for message handling
 */
export class MessageHandlerError extends Error {
  constructor(
    message: string,
    public readonly code: MessageHandlerErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MessageHandlerError';
  }
}

/**
 * Interface for handling messages
 */
export interface MessageHandlerService {
  /**
   * Initialize the message handler
   * @param options Configuration options
   * @throws MessageHandlerError if initialization fails
   */
  initialize(options?: MessageHandlerOptions): Promise<void>;

  /**
   * Send a message
   * @param message The message to send
   * @returns The sent message with updated status
   * @throws MessageHandlerError if send fails
   */
  sendMessage(message: Message): Promise<Message>;

  /**
   * Validate a message before sending
   * @param message The message to validate
   * @throws MessageHandlerError if validation fails
   */
  validateMessage(message: Message): Promise<void>;

  /**
   * Attach files to a message
   * @param messageId ID of the message to attach files to
   * @param files Array of file metadata
   * @returns Updated message with attached files
   * @throws MessageHandlerError if attachment fails
   */
  attachFiles(messageId: string, files: FileMetadata[]): Promise<Message>;

  /**
   * Remove files from a message
   * @param messageId ID of the message to remove files from
   * @param fileIds Array of file IDs to remove
   * @returns Updated message with files removed
   * @throws MessageHandlerError if removal fails
   */
  removeFiles(messageId: string, fileIds: string[]): Promise<Message>;

  /**
   * Get message by ID
   * @param messageId ID of the message to retrieve
   * @returns The message or null if not found
   */
  getMessage(messageId: string): Promise<Message | null>;

  /**
   * List messages in a chat
   * @param chatId ID of the chat to list messages from
   * @param options Optional pagination options
   * @returns Array of messages
   */
  listMessages(chatId: string, options?: {
    limit?: number;
    before?: number;
    after?: number;
  }): Promise<Message[]>;

  /**
   * Delete a message
   * @param messageId ID of the message to delete
   * @returns true if deleted, false if not found
   * @throws MessageHandlerError if deletion fails
   */
  deleteMessage(messageId: string): Promise<boolean>;

  /**
   * Update message status
   * @param messageId ID of the message to update
   * @param status New status
   * @param error Optional error message
   * @returns Updated message
   */
  updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    error?: string
  ): Promise<Message>;
} 