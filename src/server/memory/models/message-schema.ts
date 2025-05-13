/**
 * Message memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema } from './base-schema';
import { MessageMetadata } from '../../../types/metadata';
import { MessageRole } from '../../../agents/shared/types/MessageTypes';
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
 * Extends MessageMetadata directly since we've unified the base interfaces
 */
export interface MessageMetadataSchema extends MessageMetadata {
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
    chatId: createChatId('chat-chloe-gab'),
    role: MessageRole.ASSISTANT,
    messageType: 'chat',
    thread: {
      id: 'default-thread', // Simple string ID for thread
      position: 0
    }
  }
}; 