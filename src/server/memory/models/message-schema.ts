/**
 * Message memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema, BaseMetadataSchema } from './base-schema';

/**
 * Available message roles
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Attachment for messages
 */
export interface MessageAttachment {
  id: string;
  type: string;
  name?: string;
  url?: string;
  contentType?: string;
  size?: number;
  metadata?: Record<string, any>;
}

/**
 * Message-specific metadata
 */
export interface MessageMetadataSchema extends BaseMetadataSchema {
  // Core message fields
  role: MessageRole;
  userId: string;
  messageType?: string;
  
  // UI-specific flags
  isInternalMessage?: boolean;
  notForChat?: boolean;
  
  // Attachments and vision
  attachments?: MessageAttachment[];
  visionResponseFor?: string;
}

/**
 * Message schema
 */
export interface MessageSchema extends BaseMemorySchema {
  type: MemoryType.MESSAGE;
  metadata: MessageMetadataSchema;
}

/**
 * Default values for message schema
 */
export const MESSAGE_DEFAULTS: Partial<MessageSchema> = {
  type: MemoryType.MESSAGE,
  metadata: {
    userId: 'default',
    role: 'assistant',
    isInternalMessage: false,
    notForChat: false
  }
}; 