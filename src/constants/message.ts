/**
 * Constants related to message types and messaging system
 */

/**
 * Message sender types
 * Represents who sent a message in the system
 */
export enum MessageSender {
  USER = 'user',
  SYSTEM = 'system',
  AGENT = 'agent',
  CHLOE = 'chloe',
  ERROR = 'error',
}

/**
 * Message content types
 * Used to specify different types of message content
 */
export enum MessageContentType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  CHART = 'chart',
  CODE = 'code',
  DATA = 'data',
}

/**
 * Message visibility
 * Controls who can see messages
 */
export enum MessageVisibility {
  PUBLIC = 'public',    // Visible to all users
  PRIVATE = 'private',  // Visible only to the sender
  INTERNAL = 'internal', // System internal messages
}

/**
 * Chat modes
 * Different modes of interaction with the chat system
 */
export enum ChatMode {
  NORMAL = 'normal',
  CREATIVE = 'creative',
  PRECISE = 'precise',
  AUTONOMOUS = 'autonomous',
  COLLABORATIVE = 'collaborative',
} 