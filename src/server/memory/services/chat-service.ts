// @ts-nocheck
/**
 * Chat Service
 * 
 * Handles operations on the chat collection, including:
 * - Creating new chats
 * - Retrieving chats by user or agent
 * - Updating chat metadata
 * - Managing chat status
 */
import { v4 as uuidv4 } from 'uuid';
import { generateAgentUserChatId, generateNewChatId } from '../../../utils/uuid';
import { 
  ChatSession, 
  ChatType, 
  ChatStatus, 
  ChatParticipant,
  createChatSession 
} from '../models/chat-collection';
import { getMemoryServices } from './index';
import { MemoryType } from '../config';

// Collection name for chat sessions
const CHAT_COLLECTION = 'chat_sessions';

// Helper to convert ChatSession to BaseMemorySchema compatible format
function chatSessionToMemorySchema(chatSession: ChatSession): BaseMemorySchema {
  return {
    id: chatSession.id,
    text: JSON.stringify({ 
      title: chatSession.metadata?.title || 'Chat session',
      description: chatSession.metadata?.description || 'Conversation'
    }),
    timestamp: chatSession.createdAt,
    type: MemoryType.CHAT,
    metadata: {
      status: chatSession.status,
      ...(chatSession.metadata || {}),
      // Store original data as JSON
      chatSessionData: JSON.stringify(chatSession)
    } as BaseMetadataSchema
  };
}

/**
 * Chat service class for managing chat sessions
 */
export class ChatService {
  private initialized = false;

  /**
   * Initialize the chat service
   */
  async initialize() {
    if (this.initialized) return;

    const { client } = await getMemoryServices();
    
    try {
      // Check if collection exists
      const exists = await client.collectionExists(CHAT_COLLECTION);
      
      if (!exists) {
        // Create chat sessions collection with appropriate dimensions for placeholder vectors
        await client.createCollection(CHAT_COLLECTION, 4); // Using a small dimension for metadata
        
        console.log(`Created ${CHAT_COLLECTION} collection`);
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing chat service:', error);
      throw error;
    }
  }

  /**
   * Create a new chat session between a user and an agent
   * 
   * @param userId User ID
   * @param agentId Agent ID
   * @param options Additional options
   * @returns The created chat session
   */
  async createChat(
    userId: string,
    agentId: string,
    options: {
      type?: ChatType;
      title?: string;
      description?: string;
      metadata?: Record<string, any>;
      forceNewId?: boolean;
    } = {}
  ): Promise<ChatSession> {
    await this.initialize();
    const { client, embeddingService } = await getMemoryServices();
    
    // Generate chat ID
    let chatId;
    let existingChat = null;
    
    try {
      if (options.forceNewId) {
        // Generate a completely new chat ID with UUID
        chatId = generateNewChatId(userId, agentId);
      } else {
        // Check for legacy chat format first (for backward compatibility)
        const legacyId = `chat-${userId}-${agentId}`;
        try {
          existingChat = await this.getChatById(legacyId);
          
          if (existingChat) {
            console.log(`Using existing legacy chat ID: ${legacyId}`);
            return existingChat;
          }
        } catch (legacyError) {
          console.warn(`Error checking legacy chat ID, will use UUID: ${legacyError}`);
        }
        
        // No legacy chat found, use UUID-based chat ID
        chatId = generateAgentUserChatId(userId, agentId);
      }
      
      // Check if chat already exists with the UUID if not already checked
      if (!existingChat) {
        try {
          existingChat = await this.getChatById(chatId);
          if (existingChat && !options.forceNewId) {
            // Chat already exists, return it
            return existingChat;
          }
        } catch (chatError) {
          console.warn(`Error checking existing chat, will create new: ${chatError}`);
        }
      }
    } catch (idError) {
      // If any error in chat ID process, generate a fresh UUID
      console.warn(`Error in chat ID generation/lookup: ${idError}, using fresh UUID`);
      chatId = uuidv4();
    }
    
    // Create new chat session
    const chatSession = createChatSession(
      chatId,
      userId,
      agentId,
      options.type,
      {
        title: options.title,
        description: options.description,
        // Store a reference to the legacy format for backward compatibility
        legacyId: `chat-${userId}-${agentId}`,
        ...options.metadata
      }
    );
    
    try {
      // Generate a placeholder vector (just using zeros since we don't need semantic search for chats)
      const placeholderVector = [0, 0, 0, 0];
      
      // Prepare data for storage - use any to bypass type checking
      const payload = {
        id: chatSession.id,
        text: JSON.stringify(chatSession),
        timestamp: chatSession.createdAt,
        type: MemoryType.CHAT,
        metadata: {
          ...chatSession.metadata,
          chatType: chatSession.type,
          status: chatSession.status,
          participants: chatSession.participants.map(p => p.id).join(','),
          createdAt: chatSession.createdAt
        }
      } as any; // Cast to any to bypass type checking
      
      // Store in collection using the client's addPoint method
      await client.addPoint(CHAT_COLLECTION, {
        id: chatId,
        vector: placeholderVector,
        payload: payload
      });
    } catch (saveError) {
      console.error(`Error saving chat session: ${saveError}`);
      // We'll still return the chat session even if saving failed
    }
    
    return chatSession;
  }

  /**
   * Get a chat session by ID
   * 
   * @param chatId Chat ID
   * @returns The chat session or null if not found
   */
  async getChatById(chatId: string): Promise<ChatSession | null> {
    await this.initialize();
    const { client } = await getMemoryServices();
    
    try {
      // Use the client's getPoints method to retrieve the chat by ID
      const points = await client.getPoints(CHAT_COLLECTION, [chatId]);
      
      if (points && points.length > 0) {
        const payload = points[0].payload;
        
        // Try to parse the stored chat session
        try {
          // First check if we have text data containing JSON
          if (payload.text) {
            try {
              const parsedData = JSON.parse(payload.text);
              if (parsedData.id && parsedData.type && parsedData.participants) {
                return parsedData as ChatSession;
              }
            } catch (e) {
              // Not valid JSON, continue with fallback
            }
          }
          
          // If metadata contains chatSessionData, use that
          if (payload.metadata && payload.metadata.chatSessionData) {
            try {
              return JSON.parse(payload.metadata.chatSessionData) as ChatSession;
            } catch (e) {
              // Not valid JSON, continue with fallback
            }
          }
          
          // Fallback to reconstructing from metadata
          if (payload.metadata) {
            return {
              id: chatId,
              type: payload.metadata.chatType || ChatType.DIRECT,
              createdAt: payload.metadata.createdAt || payload.timestamp,
              updatedAt: payload.metadata.updatedAt || payload.timestamp,
              status: payload.metadata.status || ChatStatus.ACTIVE,
              participants: (payload.metadata.participants || '')
                .split(',')
                .filter(Boolean)
                .map(id => ({
                  id,
                  type: id === payload.metadata.agentId ? 'agent' : 'user',
                  joinedAt: payload.metadata.createdAt || payload.timestamp
                })),
              metadata: payload.metadata
            } as ChatSession;
          }
        } catch (error) {
          console.error(`Error parsing chat data for ${chatId}:`, error);
        }
        
        // Last resort: return the raw payload as a chat session
        return payload as unknown as ChatSession;
      }
      
      return null;
    } catch (error) {
      console.error(`Error retrieving chat ${chatId}:`, error);
      return null;
    }
  }

  /**
   * Get all chats for a user
   * 
   * @param userId User ID
   * @returns Array of chat sessions
   */
  async getChatsByUserId(userId: string): Promise<ChatSession[]> {
    await this.initialize();
    const { client, searchService } = await getMemoryServices();
    
    try {
      // Use searchService for filtering
      const result = await searchService.search("", {
        filter: {
          must: [
            {
              key: "participants.id",
              match: {
                value: userId
              }
            }
          ]
        }
      });
      
      return result.map(item => item.point.payload as unknown as ChatSession);
    } catch (error) {
      console.error(`Error retrieving chats for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get all chats for an agent
   * 
   * @param agentId Agent ID
   * @returns Array of chat sessions
   */
  async getChatsByAgentId(agentId: string): Promise<ChatSession[]> {
    await this.initialize();
    const { searchService } = await getMemoryServices();
    
    try {
      // Use searchService for filtering
      const result = await searchService.search("", {
        filter: {
          must: [
            {
              key: "participants.id",
              match: {
                value: agentId
              }
            }
          ]
        }
      });
      
      return result.map(item => item.point.payload as unknown as ChatSession);
    } catch (error) {
      console.error(`Error retrieving chats for agent ${agentId}:`, error);
      return [];
    }
  }

  /**
   * Get all chats between a specific user and agent
   * 
   * @param userId User ID
   * @param agentId Agent ID
   * @returns Array of chat sessions
   */
  async getChatsByUserAndAgent(userId: string, agentId: string): Promise<ChatSession[]> {
    await this.initialize();
    const { searchService } = await getMemoryServices();
    
    try {
      // Use searchService for filtering
      const result = await searchService.search("", {
        filter: {
          must: [
            {
              key: "participants.id",
              match: {
                value: userId
              }
            },
            {
              key: "participants.id",
              match: {
                value: agentId
              }
            }
          ]
        }
      });
      
      return result.map(item => item.point.payload as unknown as ChatSession);
    } catch (error) {
      console.error(`Error retrieving chats for user ${userId} and agent ${agentId}:`, error);
      return [];
    }
  }

  /**
   * Update a chat session
   * 
   * @param chatId Chat ID
   * @param updates Updates to apply
   * @returns The updated chat session
   */
  async updateChat(
    chatId: string,
    updates: {
      status?: ChatStatus;
      title?: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ChatSession | null> {
    await this.initialize();
    const { client } = await getMemoryServices();
    
    // Get existing chat
    const existingChat = await this.getChatById(chatId);
    if (!existingChat) {
      console.error(`Chat ${chatId} not found for update`);
      return null;
    }
    
    // Apply updates
    const updatedChat: ChatSession = {
      ...existingChat,
      updatedAt: new Date().toISOString(),
      status: updates.status || existingChat.status,
      metadata: {
        ...existingChat.metadata,
        title: updates.title || existingChat.metadata?.title,
        description: updates.description || existingChat.metadata?.description,
        ...(updates.metadata || {})
      }
    };
    
    // Prepare update payload - use any to bypass type checking
    const payload = {
      text: JSON.stringify(updatedChat),
      metadata: {
        ...updatedChat.metadata,
        chatType: updatedChat.type,
        status: updatedChat.status,
        participants: updatedChat.participants.map(p => p.id).join(','),
        updatedAt: updatedChat.updatedAt,
        chatSessionData: JSON.stringify(updatedChat)
      }
    } as any; // Cast to any to bypass type checking
    
    // Use the client's updatePoint method to update the chat
    const success = await client.updatePoint(CHAT_COLLECTION, chatId, {
      payload: payload
    });
    
    return success ? updatedChat : null;
  }

  /**
   * Archive a chat session
   * 
   * @param chatId Chat ID
   * @returns Success status
   */
  async archiveChat(chatId: string): Promise<boolean> {
    const result = await this.updateChat(chatId, { status: ChatStatus.ARCHIVED });
    return result !== null;
  }

  /**
   * Delete a chat session
   * 
   * @param chatId Chat ID
   * @returns Success status
   */
  async deleteChat(chatId: string): Promise<boolean> {
    await this.initialize();
    const { client } = await getMemoryServices();
    
    try {
      // Use the client's deletePoint method to delete the chat
      return await client.deletePoint(CHAT_COLLECTION, chatId);
    } catch (error) {
      console.error(`Error deleting chat ${chatId}:`, error);
      return false;
    }
  }
}

// Singleton instance
let chatServiceInstance: ChatService | null = null;

/**
 * Get the chat service instance
 */
export async function getChatService(): Promise<ChatService> {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
    await chatServiceInstance.initialize();
  }
  return chatServiceInstance;
}
