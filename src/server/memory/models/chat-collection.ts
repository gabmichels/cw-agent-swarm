/**
 * Chat Collection Model
 * 
 * This model represents a collection of chat sessions between users and agents.
 * It's used to track which chat IDs are associated with which users and agents.
 */

/**
 * Chat session types
 */
export enum ChatType {
  DIRECT = 'direct',         // User to agent direct conversation
  GROUP = 'group',           // Group chat with multiple participants
  SYSTEM = 'system',         // System generated chat (for logging or notifications)
  THREAD = 'thread'          // A thread within a larger conversation
}

/**
 * Chat status
 */
export enum ChatStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

/**
 * Participant in a chat
 */
export interface ChatParticipant {
  id: string;          // User or agent ID
  type: 'user' | 'agent';  // Type of participant
  joinedAt: string;    // ISO timestamp when they joined
  leftAt?: string;     // ISO timestamp when they left (if applicable)
  metadata?: Record<string, any>; // Additional info
}

/**
 * Chat model interface
 */
export interface ChatSession {
  id: string;                     // Unique chat ID
  type: ChatType;                 // Type of chat
  createdAt: string;              // ISO timestamp when created
  updatedAt: string;              // ISO timestamp when last updated
  status: ChatStatus;             // Current status
  participants: ChatParticipant[]; // Participants in this chat
  metadata?: {
    title?: string;               // Optional chat title
    description?: string;         // Optional description
    createdBy?: string;           // Who created this chat
    parentChatId?: string;        // Parent chat if this is a thread
    tags?: string[];              // Tags for categorization
    [key: string]: any;           // Additional extensible metadata
  };
}

/**
 * Create a new chat session object
 * 
 * @param id Unique chat ID
 * @param userId The primary user ID
 * @param agentId The primary agent ID
 * @param type Chat type (defaults to direct)
 * @param metadata Additional metadata
 * @returns A new chat session object
 */
export function createChatSession(
  id: string,
  userId: string,
  agentId: string,
  type: ChatType = ChatType.DIRECT,
  metadata: Record<string, any> = {}
): ChatSession {
  const timestamp = new Date().toISOString();
  
  return {
    id,
    type,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: ChatStatus.ACTIVE,
    participants: [
      {
        id: userId,
        type: 'user',
        joinedAt: timestamp
      },
      {
        id: agentId,
        type: 'agent',
        joinedAt: timestamp
      }
    ],
    metadata: {
      createdBy: userId,
      ...metadata
    }
  };
} 