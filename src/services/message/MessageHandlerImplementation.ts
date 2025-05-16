import { v4 as uuidv4 } from 'uuid';
import { FileMetadata } from '../../types/files';
import { FileStorageService } from '../storage/FileStorageService';
import {
  Message,
  MessageHandlerService,
  MessageHandlerOptions,
  MessageHandlerError,
  MessageHandlerErrorCode,
  MessageType,
  MessageStatus,
  TextMessage,
  FileMessage,
  SystemMessage
} from './MessageHandlerService';

/**
 * Implementation of the MessageHandlerService interface
 */
export class MessageHandlerImplementation implements MessageHandlerService {
  private messages: Map<string, Message> = new Map();
  private options: MessageHandlerOptions = {
    maxFilesPerMessage: 10,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedFileTypes: ['image/*', 'application/pdf', 'text/*', 'audio/*', 'video/*'],
    enableFileAttachments: true
  };

  constructor(private readonly fileStorage: FileStorageService) {}

  /**
   * Initialize the message handler with options
   */
  async initialize(options?: MessageHandlerOptions): Promise<void> {
    try {
      this.options = { ...this.options, ...options };
      await this.fileStorage.initialize();
    } catch (error) {
      throw new MessageHandlerError(
        'Failed to initialize message handler',
        MessageHandlerErrorCode.VALIDATION_FAILED,
        { error }
      );
    }
  }

  /**
   * Send a message
   */
  async sendMessage(message: Message): Promise<Message> {
    try {
      await this.validateMessage(message);

      // Generate ID if not provided
      if (!message.id) {
        message = { ...message, id: uuidv4() };
      }

      // Set initial status
      message = {
        ...message,
        status: MessageStatus.SENDING,
        timestamp: Date.now()
      };

      this.messages.set(message.id, message);

      // Process files if it's a file message
      if (message.type === MessageType.FILE) {
        const fileMessage = message as FileMessage;
        for (const file of fileMessage.files) {
          await this.fileStorage.fileExists(file.id);
        }
      }

      // Update status to sent
      message = {
        ...message,
        status: MessageStatus.SENT
      };

      this.messages.set(message.id, message);
      return message;
    } catch (error) {
      // Update status to failed
      message = {
        ...message,
        status: MessageStatus.FAILED,
        error: error instanceof Error ? error.message : 'Failed to send message'
      };

      this.messages.set(message.id, message);

      if (error instanceof MessageHandlerError) {
        throw error;
      }

      throw new MessageHandlerError(
        'Failed to send message',
        MessageHandlerErrorCode.SEND_FAILED,
        { error }
      );
    }
  }

  /**
   * Validate a message before sending
   */
  async validateMessage(message: Message): Promise<void> {
    try {
      // Check message type
      if (!Object.values(MessageType).includes(message.type)) {
        throw new MessageHandlerError(
          'Invalid message type',
          MessageHandlerErrorCode.VALIDATION_FAILED
        );
      }

      // Validate based on message type
      switch (message.type) {
        case MessageType.TEXT:
          await this.validateTextMessage(message as TextMessage);
          break;
        case MessageType.FILE:
          await this.validateFileMessage(message as FileMessage);
          break;
        case MessageType.SYSTEM:
          await this.validateSystemMessage(message as SystemMessage);
          break;
      }
    } catch (error) {
      if (error instanceof MessageHandlerError) {
        throw error;
      }

      throw new MessageHandlerError(
        'Message validation failed',
        MessageHandlerErrorCode.VALIDATION_FAILED,
        { error }
      );
    }
  }

  /**
   * Validate a text message
   */
  private async validateTextMessage(message: TextMessage): Promise<void> {
    if (!message.content || typeof message.content !== 'string') {
      throw new MessageHandlerError(
        'Invalid text message content',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }
  }

  /**
   * Validate a file message
   */
  private async validateFileMessage(message: FileMessage): Promise<void> {
    if (!this.options.enableFileAttachments) {
      throw new MessageHandlerError(
        'File attachments are disabled',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }

    if (!Array.isArray(message.files)) {
      throw new MessageHandlerError(
        'Invalid files array',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }

    if (message.files.length === 0) {
      throw new MessageHandlerError(
        'No files attached',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }

    if (message.files.length > this.options.maxFilesPerMessage!) {
      throw new MessageHandlerError(
        `Too many files. Maximum allowed: ${this.options.maxFilesPerMessage}`,
        MessageHandlerErrorCode.TOO_MANY_FILES
      );
    }

    // Validate each file
    for (const file of message.files) {
      await this.validateFileMetadata(file);
    }
  }

  /**
   * Validate a system message
   */
  private async validateSystemMessage(message: SystemMessage): Promise<void> {
    if (!message.content || typeof message.content !== 'string') {
      throw new MessageHandlerError(
        'Invalid system message content',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }

    if (!['info', 'warning', 'error'].includes(message.level)) {
      throw new MessageHandlerError(
        'Invalid system message level',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }
  }

  /**
   * Validate file metadata
   */
  private async validateFileMetadata(file: FileMetadata): Promise<void> {
    if (!file.id || !file.filename || !file.type || !file.size) {
      throw new MessageHandlerError(
        'Invalid file metadata',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }

    if (file.size > this.options.maxFileSize!) {
      throw new MessageHandlerError(
        `File too large. Maximum size: ${this.options.maxFileSize! / (1024 * 1024)}MB`,
        MessageHandlerErrorCode.FILE_TOO_LARGE
      );
    }

    if (!this.isFileTypeAllowed(file.type)) {
      throw new MessageHandlerError(
        'File type not allowed',
        MessageHandlerErrorCode.INVALID_FILE_TYPE
      );
    }

    // Check if file exists in storage
    const exists = await this.fileStorage.fileExists(file.id);
    if (!exists) {
      throw new MessageHandlerError(
        'File not found in storage',
        MessageHandlerErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Check if file type is allowed
   */
  private isFileTypeAllowed(type: string): boolean {
    return this.options.allowedFileTypes!.some(allowedType => {
      if (allowedType.endsWith('/*')) {
        const prefix = allowedType.slice(0, -2);
        return type.startsWith(prefix);
      }
      return type === allowedType;
    });
  }

  /**
   * Attach files to a message
   */
  async attachFiles(messageId: string, files: FileMetadata[]): Promise<Message> {
    const message = await this.getMessage(messageId);
    if (!message) {
      throw new MessageHandlerError(
        'Message not found',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }

    if (message.type !== MessageType.FILE) {
      throw new MessageHandlerError(
        'Cannot attach files to non-file message',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }

    const fileMessage = message as FileMessage;
    const updatedFiles = [...fileMessage.files, ...files];

    const updatedMessage: FileMessage = {
      ...fileMessage,
      files: updatedFiles
    };

    await this.validateMessage(updatedMessage);
    this.messages.set(messageId, updatedMessage);

    return updatedMessage;
  }

  /**
   * Remove files from a message
   */
  async removeFiles(messageId: string, fileIds: string[]): Promise<Message> {
    const message = await this.getMessage(messageId);
    if (!message) {
      throw new MessageHandlerError(
        'Message not found',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }

    if (message.type !== MessageType.FILE) {
      throw new MessageHandlerError(
        'Cannot remove files from non-file message',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }

    const fileMessage = message as FileMessage;
    const updatedFiles = fileMessage.files.filter(
      file => !fileIds.includes(file.id)
    );

    const updatedMessage: FileMessage = {
      ...fileMessage,
      files: updatedFiles
    };

    await this.validateMessage(updatedMessage);
    this.messages.set(messageId, updatedMessage);

    return updatedMessage;
  }

  /**
   * Get message by ID
   */
  async getMessage(messageId: string): Promise<Message | null> {
    return this.messages.get(messageId) || null;
  }

  /**
   * List messages in a chat
   */
  async listMessages(chatId: string, options?: {
    limit?: number;
    before?: number;
    after?: number;
  }): Promise<Message[]> {
    let messages = Array.from(this.messages.values())
      .sort((a, b) => b.timestamp - a.timestamp);

    if (options?.before) {
      messages = messages.filter(m => m.timestamp < options.before!);
    }

    if (options?.after) {
      messages = messages.filter(m => m.timestamp > options.after!);
    }

    if (options?.limit) {
      messages = messages.slice(0, options.limit);
    }

    return messages;
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    return this.messages.delete(messageId);
  }

  /**
   * Update message status
   */
  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    error?: string
  ): Promise<Message> {
    const message = await this.getMessage(messageId);
    if (!message) {
      throw new MessageHandlerError(
        'Message not found',
        MessageHandlerErrorCode.VALIDATION_FAILED
      );
    }

    const updatedMessage = {
      ...message,
      status,
      error
    };

    this.messages.set(messageId, updatedMessage);
    return updatedMessage;
  }
} 