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

/**
 * Message types for strict classification
 * Used to properly route messages to UI or memory
 */
export enum MessageType {
  USER = 'user',           // User messages - visible in chat
  AGENT = 'agent',         // Agent responses - visible in chat
  THOUGHT = 'thought',     // Agent internal thinking - not visible in chat
  REFLECTION = 'reflection', // Agent reflections on past actions - not visible in chat
  SYSTEM = 'system',       // System messages - not visible in chat 
  TOOL_LOG = 'tool_log',   // Tool execution logs - not visible in chat
  MEMORY_LOG = 'memory_log' // Memory storage logs - not visible in chat
} 