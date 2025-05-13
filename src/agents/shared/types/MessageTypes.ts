/**
 * MessageTypes.ts
 * 
 * This file contains standardized types and enumerations related to messages
 * in the agent system. These types are used throughout the codebase to ensure
 * consistency in message handling.
 */

/**
 * Defines the possible roles in a message exchange.
 * This enum is used to identify the sender's role in a conversation.
 * 
 * @enum {string}
 * @property {string} USER - Messages from human users
 * @property {string} ASSISTANT - Messages from AI assistants
 * @property {string} SYSTEM - System messages (instructions, errors, notifications)
 */
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

/**
 * Interface for basic message structure with required type information.
 * 
 * @interface Message
 * @property {string} id - Unique identifier for the message
 * @property {string} content - The text content of the message
 * @property {MessageRole} role - The role of the sender (user, assistant, system)
 * @property {Record<string, any>} [metadata] - Optional metadata for the message
 * @property {Date} timestamp - When the message was created
 * @property {string} [parent_id] - Optional identifier for the parent message
 * @property {string} conversation_id - Identifier for the conversation this message belongs to
 */
export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  metadata?: Record<string, any>;
  timestamp: Date;
  parent_id?: string;
  conversation_id: string;
}

/**
 * Interface for message options used when creating/storing messages.
 * 
 * @interface MessageOptions
 * @property {string} userId - ID of the user associated with this message
 * @property {any[]} [attachments] - Optional array of attachments
 * @property {string} [visionResponseFor] - Optional reference to a vision message this is a response for
 * @property {string} [userMessageId] - Optional ID of the user message if already stored
 * @property {boolean} [skipResponseMemoryStorage] - Flag to skip storing the agent response in memory
 */
export interface MessageOptions {
  userId: string;
  attachments?: any[];
  visionResponseFor?: string;
  userMessageId?: string;
  skipResponseMemoryStorage?: boolean;
} 