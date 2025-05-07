/**
 * Chat Memory Schema
 * 
 * This file defines the schema for chat memory entities.
 * It is used for validation and type checking in the chat memory repository and service.
 */

import { JSONSchema7 } from 'json-schema';
import { Schema, SchemaType, SchemaVersion } from '../../../schema/types';
import { SchemaVersionImpl } from '../../../schema/version';
import { SchemaImpl } from '../../../schema/schema';
import { ChatMemoryEntity } from './chat-memory-repository';

/**
 * Chat memory JSON Schema
 */
export const chatMemoryJsonSchema: JSONSchema7 = {
  type: 'object',
  required: ['id', 'content', 'type', 'createdAt', 'updatedAt', 'schemaVersion', 'metadata'],
  properties: {
    id: { 
      type: 'object',
      required: ['id', 'prefix', 'timestamp', 'toString']
    },
    content: { type: 'string' },
    type: { type: 'string', enum: ['chat'] },
    createdAt: { type: 'object' },
    updatedAt: { type: 'object' },
    schemaVersion: { type: 'string' },
    metadata: {
      type: 'object',
      required: ['chatId', 'role'],
      properties: {
        chatId: { type: 'string' },
        messageId: { type: 'string' },
        role: { type: 'string', enum: ['user', 'assistant', 'system'] },
        sentiment: { type: 'number', minimum: -1, maximum: 1 },
        language: { type: 'string' },
        isImportant: { type: 'boolean' },
        tags: { 
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  }
};

/**
 * Chat memory schema version
 */
export const chatMemorySchemaVersion: SchemaVersion = new SchemaVersionImpl(1, 0);

/**
 * Chat memory schema defaults
 */
export const chatMemoryDefaults: Partial<ChatMemoryEntity> = {
  metadata: {
    chatId: 'default_chat',
    role: 'user',
    isImportant: false,
    tags: []
  }
};

/**
 * Chat memory schema
 */
export const chatMemorySchema: Schema<ChatMemoryEntity> = new SchemaImpl<ChatMemoryEntity>(
  'chat_memory',
  chatMemorySchemaVersion,
  SchemaType.ENTITY,
  chatMemoryJsonSchema,
  chatMemoryDefaults
); 