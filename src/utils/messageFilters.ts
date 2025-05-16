/**
 * Message filter utilities
 * Used to control which messages are displayed in the UI
 */
import { Message } from '../types';
import { MessageType } from '../constants/message';

/**
 * Filter to determine if a message should be displayed in the chat UI
 * Only messages of type USER and AGENT should be shown in the chat
 * @param message The message to check
 * @returns boolean indicating if the message should be displayed
 */
export function isMessageVisibleInChat(message: Message): boolean {
  // Check if we have explicit metadata about visibility
  if (message.metadata) {
    // Prioritize isForChat when available - it's the most direct signal
    if (message.metadata.isForChat === true) {
      return true;
    }
    
    if (message.metadata.isForChat === false) {
      return false;
    }
    
    // Check for isInternal flag
    if (message.metadata.isInternal === true) {
      return false;
    }
    
    // Handle nested metadata structure
    if (message.metadata.metadata && typeof message.metadata.metadata === 'object') {
      const nestedMetadata = message.metadata.metadata as Record<string, unknown>;
      
      if (nestedMetadata.isForChat === true) {
        return true;
      }
      
      if (nestedMetadata.isForChat === false) {
        return false;
      }
      
      if (nestedMetadata.isInternal === true) {
        return false;
      }
    }
  }
  
  // Check for internal flag in metadata
  if (message.metadata?.isInternalMessage === true) {
    return false;
  }
  
  // If message has explicit messageType, check if it's a chat-visible type
  if (message.messageType) {
    return message.messageType === MessageType.USER || 
           message.messageType === MessageType.AGENT;
  }
  
  // IMPORTANT: Only show messages if they are from expected roles
  // Avoid showing any internal processing messages
  if (message.sender) {
    const allowedRoles = ['user', 'assistant'];
    return allowedRoles.includes(message.sender.role);
  }
  
  // Default to not showing messages with unclear origin
  return false;
}

/**
 * Filter an array of messages to only those that should be visible in chat
 * @param messages Array of messages to filter
 * @returns Filtered array of messages
 */
export function filterChatVisibleMessages(messages: Message[]): Message[] {
  // Add debug logging to see what we're working with
  console.debug(`Filtering ${messages?.length || 0} messages for chat display`);
  
  if (!messages || !Array.isArray(messages)) {
    console.warn('No messages to filter or messages is not an array');
    return [];
  }
  
  const filtered = messages.filter(isMessageVisibleInChat);
  console.debug(`After filtering: ${filtered.length} messages visible`);
  return filtered;
}

/**
 * Determines if a message is an internal thought or reflection
 * Used for routing to memory instead of chat
 * @param message The message to check
 * @returns boolean indicating if the message is internal
 */
export function isInternalMessage(message: Message): boolean {
  // Check metadata properties 
  if (message.metadata) {
    // Check metadata.isInternal flag
    if (message.metadata.isInternal === true) {
      return true;
    }
    
    // Check metadata.isForChat flag (inverse logic)
    if (message.metadata.isForChat === false) {
      return true;
    }
    
    // Check for isInternalMessage in metadata
    if (message.metadata.isInternalMessage === true) {
      return true;
    }

    // Check for nested metadata.metadata structure
    if (message.metadata.metadata && typeof message.metadata.metadata === 'object') {
      const nestedMetadata = message.metadata.metadata as Record<string, unknown>;
      
      if (nestedMetadata.isInternal === true) {
        return true;
      }
      if (nestedMetadata.isForChat === false) {
        return true;
      }
    }
  }
  
  // Check message type
  if (message.messageType) {
    return message.messageType === MessageType.THOUGHT ||
           message.messageType === MessageType.REFLECTION ||
           message.messageType === MessageType.SYSTEM ||
           message.messageType === MessageType.TOOL_LOG ||
           message.messageType === MessageType.MEMORY_LOG;
  }
  
  // Check sender role - system messages are generally internal
  if (message.sender && message.sender.role === 'system') {
    return true;
  }
  
  // For backwards compatibility
  // Check the message content for thought/reflection indicators
  if (message.content) {
    const lowerContent = message.content.toLowerCase();
    return lowerContent.startsWith('thought:') ||
           lowerContent.startsWith('reflection:') ||
           lowerContent.startsWith('thinking:') ||
           lowerContent.startsWith('!important! thought:') ||
           lowerContent.includes('!important!');
  }
  
  return false;
} 