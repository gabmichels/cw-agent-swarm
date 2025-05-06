/**
 * Message memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema, BaseMetadataSchema } from './base-schema';
import { MessageMetadata } from '../../../types/metadata';
import { MessageRole } from '../../../agents/chloe/types/state';
import { StructuredId } from '../../../types/structured-id';

/**
 * Message-specific metadata schema
 * Extends the BaseMetadataSchema with message-specific fields from our MessageMetadata type
 */
export interface MessageMetadataSchema extends BaseMetadataSchema, Omit<MessageMetadata, keyof BaseMetadataSchema> {
  // No additional fields needed as MessageMetadata already contains everything
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
    schemaVersion: "1.0.0",
    userId: {
      namespace: 'default',
      type: 'user',
      id: 'default'
    } as StructuredId,
    agentId: {
      namespace: 'default',
      type: 'agent', 
      id: 'assistant'
    } as StructuredId,
    chatId: {
      namespace: 'default',
      type: 'chat',
      id: 'default'
    } as StructuredId,
    role: MessageRole.ASSISTANT,
    thread: {
      id: 'default',
      position: 0
    }
  }
}; 