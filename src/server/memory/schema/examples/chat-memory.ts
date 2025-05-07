/**
 * Chat Memory Schema Example
 * 
 * This module demonstrates how to define and register a schema.
 */

import { JSONSchema7 } from 'json-schema';
import { StructuredId } from '../../../../utils/ulid';
import { SchemaImpl, SchemaVersionImpl, SchemaType, defaultSchemaRegistry } from '../index';
import { BaseMemoryEntity } from '../types';

/**
 * Chat memory entity types
 */
export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

/**
 * Chat memory entity interface
 */
export interface ChatMemoryEntity extends BaseMemoryEntity {
  /**
   * Entity type
   */
  type: 'chat';
  
  /**
   * Entity metadata
   */
  metadata: {
    /**
     * Chat ID
     */
    chatId: StructuredId;
    
    /**
     * Message ID (optional)
     */
    messageId?: StructuredId;
    
    /**
     * Message role (user, assistant, system)
     */
    role: ChatRole;
    
    /**
     * Sentiment score (-1 to 1)
     */
    sentiment?: number;
  };
}

/**
 * Chat memory JSON Schema definition (v1.0)
 */
const chatMemorySchemaV1_0: JSONSchema7 = {
  $id: 'chat_memory_v1.0',
  type: 'object',
  required: ['id', 'content', 'type', 'createdAt', 'updatedAt', 'metadata', 'schemaVersion'],
  properties: {
    id: {
      type: 'object',
      required: ['id', 'prefix', 'timestamp']
    },
    content: { type: 'string' },
    type: { type: 'string', enum: ['chat'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    schemaVersion: { type: 'string' },
    metadata: {
      type: 'object',
      required: ['chatId', 'role'],
      properties: {
        chatId: { type: 'object' },
        messageId: { type: 'object' },
        role: { 
          type: 'string', 
          enum: [ChatRole.USER, ChatRole.ASSISTANT, ChatRole.SYSTEM] 
        },
        sentiment: { 
          type: 'number', 
          minimum: -1, 
          maximum: 1 
        }
      }
    }
  }
};

/**
 * Create chat memory schema
 */
export const chatMemorySchema = new SchemaImpl<ChatMemoryEntity>(
  'chat_memory',
  SchemaVersionImpl.create(1, 0),
  SchemaType.ENTITY,
  chatMemorySchemaV1_0,
  {
    // Default values for top-level fields
    type: 'chat'
    // We don't provide defaults for required fields in metadata
    // That must be supplied when creating entities
  }
);

// Register the schema with the registry
defaultSchemaRegistry.register(chatMemorySchema);

/**
 * Example of creating a chat memory entity
 */
export function createChatMemory(
  chatId: StructuredId, 
  content: string, 
  role: ChatRole = ChatRole.USER
): ChatMemoryEntity {
  return chatMemorySchema.create({
    content,
    metadata: {
      chatId,
      role,
      sentiment: 0 // Default sentiment as neutral
    }
  });
} 