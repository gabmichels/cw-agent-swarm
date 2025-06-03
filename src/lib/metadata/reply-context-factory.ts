/**
 * Factory utilities for creating standardized reply context metadata
 * Follows implementation guidelines for type safety and structured IDs
 */

import { StructuredId, createStructuredId, EntityNamespace, EntityType } from '../../types/structured-id';
import { MessageReplyContext } from '../../types/metadata';
import { ImportanceLevel } from '../../constants/memory';
import { MessageRole } from '../../agents/shared/types/MessageTypes';

/**
 * Creates a standardized MessageReplyContext object
 * 
 * @param messageId - Structured ID of the message being replied to
 * @param content - Content of the original message
 * @param senderRole - Role of the original message sender
 * @param options - Optional additional context fields
 * @returns Properly typed MessageReplyContext
 */
export function createMessageReplyContext(
  messageId: StructuredId,
  content: string,
  senderRole: MessageRole,
  options: Partial<MessageReplyContext> = {}
): MessageReplyContext {
  const now = new Date().toISOString();
  
  return {
    messageId,
    content,
    senderRole,
    timestamp: options.timestamp || now,
    importance: options.importance || ImportanceLevel.MEDIUM, // Use medium importance, let memory retrieval handle prioritization
    senderAgentId: options.senderAgentId,
    senderUserId: options.senderUserId,
    threadId: options.threadId,
  };
}

/**
 * Creates a MessageReplyContext from a legacy message object
 * Handles conversion from various message formats to standardized types
 * 
 * @param message - Message object with various possible formats
 * @returns Properly typed MessageReplyContext or null if invalid
 */
export function createReplyContextFromMessage(message: {
  id?: string;
  content: string;
  sender: string | { id: string; name: string; role: string };
  timestamp: Date | string | number;
  [key: string]: any;
}): MessageReplyContext | null {
  // Validate required fields
  if (!message.id || !message.content) {
    return null;
  }

  // Convert ID to StructuredId format
  const messageId: StructuredId = createStructuredId(
    EntityNamespace.CHAT, 
    EntityType.MESSAGE, 
    message.id
  );

  // Determine sender role and IDs
  let senderRole: MessageRole;
  let senderAgentId: StructuredId | undefined;
  let senderUserId: StructuredId | undefined;

  if (typeof message.sender === 'string') {
    // Handle string sender format
    if (message.sender === 'You' || message.sender === 'user') {
      senderRole = MessageRole.USER;
      senderUserId = createStructuredId(EntityNamespace.USER, EntityType.USER, 'user');
    } else {
      senderRole = MessageRole.ASSISTANT;
      senderAgentId = createStructuredId(EntityNamespace.AGENT, EntityType.AGENT, 'assistant');
    }
  } else {
    // Handle object sender format
    const role = message.sender.role.toLowerCase();
    if (role === 'user') {
      senderRole = MessageRole.USER;
      senderUserId = createStructuredId(EntityNamespace.USER, EntityType.USER, message.sender.id);
    } else if (role === 'assistant') {
      senderRole = MessageRole.ASSISTANT;
      senderAgentId = createStructuredId(EntityNamespace.AGENT, EntityType.AGENT, message.sender.id);
    } else {
      senderRole = MessageRole.SYSTEM;
      senderAgentId = createStructuredId(EntityNamespace.SYSTEM, EntityType.AGENT, message.sender.id);
    }
  }

  return createMessageReplyContext(messageId, message.content, senderRole, {
    senderAgentId,
    senderUserId,
    timestamp: new Date(message.timestamp).toISOString(),
    importance: ImportanceLevel.MEDIUM // Use medium importance, let memory retrieval handle prioritization
  });
} 