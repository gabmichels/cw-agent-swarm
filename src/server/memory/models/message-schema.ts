/**
 * Message memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema, BaseMetadataSchema } from './base-schema';
import { MessageMetadata } from '../../../types/metadata';
import { MessageRole } from '../../../agents/chloe/types/state';
import { 
  IdPrefix, 
  createStructuredId, 
  createUserId, 
  createAgentId, 
  createChatId, 
  EntityNamespace, 
  EntityType 
} from '../../../types/structured-id';

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
    schemaVersion: '1.0.0',
    source: 'system',
    timestamp: Date.now(),
    userId: createUserId('default-user'),
    agentId: createAgentId('default-agent'),
    chatId: createChatId('default-chat'),
    role: MessageRole.ASSISTANT,
    messageType: 'chat',
    thread: {
      id: 'default-thread', // Simple string ID for thread
      position: 0
    }
  }
}; 