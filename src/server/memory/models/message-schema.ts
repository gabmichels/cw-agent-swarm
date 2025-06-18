/**
 * Message memory schema
 */
import { MemoryType } from '../config';
import { BaseMemorySchema } from './base-schema';
import { MessageMetadata, ThreadInfo } from '../../../types/metadata';
import { MessageRole } from '../../../agents/shared/types/MessageTypes';
import { 
  IdPrefix, 
  createStructuredId, 
  createUserId, 
  createAgentId, 
  createChatId, 
  EntityNamespace, 
  EntityType,
  structuredIdToString
} from '../../../types/structured-id';
import { generateUserId, generateAgentId, generateChatId } from '../../../lib/core/id-generation';

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
    userId: generateUserId('default-user'),
    agentId: generateAgentId('default-agent'),
    chatId: generateChatId('chat-chloe-gab'),
    role: MessageRole.ASSISTANT,
    messageType: 'chat',
    thread: {
      id: 'default-thread', // Simple string ID for thread
      position: 0
    }
  }
}; 