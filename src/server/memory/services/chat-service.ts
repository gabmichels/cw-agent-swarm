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
 * Create a dummy embedding vector with the correct dimensions
 * This ensures compatibility with Qdrant
 */
function createDummyVector(size = 1536) {
  // Create a vector with very small random values to minimize impact on searches
  return Array(size).fill(0).map(() => Math.random() * 0.00001);
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
    // Runtime assertion and debug log
    
    // If getCollectionInfo is not available, implement it on the client instance
    if (typeof client.getCollectionInfo !== 'function') {
      console.log('Adding getCollectionInfo method to client instance');
      // Add a custom implementation of getCollectionInfo
      (client as any).getCollectionInfo = async (collectionName: string) => {
        try {
          // Use client's existing methods to get collection info
          const exists = await client.collectionExists(collectionName);
          if (!exists) {
            return null;
          }
          
          // Access the client's private properties
          const qdrantClient = (client as any).client;
          if (!qdrantClient) {
            console.error('Unable to access Qdrant client');
            return {
              name: collectionName,
              dimensions: 1536, // Default
              pointsCount: 0,
              createdAt: new Date()
            };
          }
          
          // Get collection info
          const info = await qdrantClient.getCollection(collectionName);
          let dimensions = 1536; // Default
          
          // Parse vector dimensions from the response
          if (info.config?.params?.vectors) {
            try {
              const vectorsConfig = info.config.params.vectors;
              if (typeof vectorsConfig === 'object' && !Array.isArray(vectorsConfig)) {
                const vectorNames = Object.keys(vectorsConfig);
                if (vectorNames.length > 0) {
                  const firstVectorName = vectorNames[0];
                  const firstVectorConfig = vectorsConfig[firstVectorName];
                  if (firstVectorConfig && typeof firstVectorConfig === 'object' && 'size' in firstVectorConfig) {
                    dimensions = (firstVectorConfig.size as number) || 1536;
                  }
                }
              }
            } catch (parseError) {
              console.error('Error parsing vector config:', parseError);
            }
          }
          
          // Return simplified collection info
          return {
            name: collectionName,
            dimensions,
            pointsCount: info.vectors_count || 0,
            createdAt: new Date()
          };
        } catch (error) {
          console.error('Error in getCollectionInfo:', error);
          return {
            name: collectionName,
            dimensions: 1536,
            pointsCount: 0,
            createdAt: new Date()
          };
        }
      };
    }
    
    try {
      // Check if collection exists
      const exists = await client.collectionExists(CHAT_COLLECTION);
      
      if (!exists) {
        console.log(`Chat collection ${CHAT_COLLECTION} does not exist. Creating with 1536 dimensions...`);
        
        // Create chat sessions collection with appropriate dimensions for vectors
        const created = await client.createCollection(CHAT_COLLECTION, 1536); // Using standard embedding dimensions
        
        if (created) {
          console.log(`Created ${CHAT_COLLECTION} collection successfully`);
        } else {
          console.error(`Failed to create ${CHAT_COLLECTION} collection`);
          throw new Error(`Failed to create ${CHAT_COLLECTION} collection`);
        }
      } else {
        console.log(`Chat collection ${CHAT_COLLECTION} already exists`);
        
        // Check the vector dimension of the existing collection
        try {
          const collectionInfo = await client.getCollectionInfo(CHAT_COLLECTION);
          const vectorSize = collectionInfo?.dimensions;
          
          console.log(`Collection ${CHAT_COLLECTION} has vector size: ${vectorSize}`);
          
          if (vectorSize !== 1536) {
            console.warn(`Warning: Chat collection has incorrect vector size: ${vectorSize}, expected: 1536`);
            console.warn('This may cause issues with storing and retrieving chats');
          }
        } catch (infoError) {
          console.error('Error checking collection info:', infoError);
        }
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
      } else if (userId === 'gab' && agentId === 'chloe') {
        // Use hardcoded chatId for Chloe and Gab
        chatId = 'chat-chloe-gab';
        
        // Check if this chat already exists
        try {
          existingChat = await this.getChatById(chatId);
          if (existingChat) {
            return existingChat;
          }
        } catch (error) {
          console.log(`Creating new chat with hardcoded ID: ${chatId}`);
        }
      } else {
        // Generate a predictable chat ID for this user-agent pair
        chatId = generateAgentUserChatId(agentId, userId);
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
      // Generate a proper dimensioned vector (using dummy values)
      const placeholderVector = createDummyVector(1536);
      
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
          createdAt: chatSession.createdAt,
          userId: userId,
          agentId: agentId
        }
      } as any; // Cast to any to bypass type checking
      
      // Store in collection using the client's addPoint method
      console.log(`Adding chat to ${CHAT_COLLECTION} with ID ${chatId}`);
      try {
        const pointAdded = await client.addPoint(CHAT_COLLECTION, {
          id: chatId,
          vector: placeholderVector,
          payload: payload
        });
        
        if (!pointAdded) {
          console.error(`Failed to add chat point to ${CHAT_COLLECTION}`);
        } else {
          console.log(`Successfully added chat point to ${CHAT_COLLECTION}`);
        }
      } catch (pointError) {
        console.error(`Error adding point to ${CHAT_COLLECTION}:`, pointError);
      }
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
      console.log(`Attempting to retrieve chat with ID: ${chatId}`);
      
      // Use the client's getPoints method to retrieve the chat by ID
      const points = await client.getPoints(CHAT_COLLECTION, [chatId]);
      console.log(`Qdrant returned ${points.length} points for ID: ${chatId}`);
      
      if (points && points.length > 0) {
        const payload = points[0].payload;
        console.log(`Found chat with ID ${chatId}. Payload type:`, typeof payload);
        
        // Try to parse the stored chat session
        try {
          // First check if we have text data containing JSON
          if (payload.text) {
            try {
              console.log('Attempting to parse text field as JSON');
              const parsedData = JSON.parse(payload.text);
              if (parsedData.id && parsedData.type && parsedData.participants) {
                console.log('Successfully parsed text as ChatSession');
                return parsedData as ChatSession;
              }
            } catch (e) {
              console.log('Text field was not valid JSON:', e);
              // Not valid JSON, continue with fallback
            }
          }
          
          // If metadata contains chatSessionData, use that
          if (payload.metadata && payload.metadata.chatSessionData) {
            try {
              console.log('Attempting to parse chatSessionData in metadata');
              const parsedSession = JSON.parse(payload.metadata.chatSessionData) as ChatSession;
              console.log('Successfully parsed chatSessionData');
              return parsedSession;
            } catch (e) {
              console.log('chatSessionData was not valid JSON:', e);
              // Not valid JSON, continue with fallback
            }
          }
          
          // Fallback to reconstructing from metadata
          if (payload.metadata) {
            console.log('Reconstructing chat from metadata');
            
            // Default participants
            let participants = [];
            
            // Try to parse participants from metadata
            if (payload.metadata.participants) {
              if (typeof payload.metadata.participants === 'string') {
                participants = payload.metadata.participants
                  .split(',')
                  .filter(Boolean)
                  .map(id => ({
                    id,
                    type: id === payload.metadata.agentId ? 'agent' : 'user',
                    joinedAt: payload.metadata.createdAt || payload.timestamp
                  }));
              } else if (Array.isArray(payload.metadata.participants)) {
                participants = payload.metadata.participants;
              }
            }
            
            // If no participants found but we have userId and agentId, create them
            if (participants.length === 0 && payload.metadata.userId && payload.metadata.agentId) {
              participants = [
                {
                  id: payload.metadata.userId,
                  type: 'user',
                  joinedAt: payload.metadata.createdAt || payload.timestamp
                },
                {
                  id: payload.metadata.agentId,
                  type: 'agent',
                  joinedAt: payload.metadata.createdAt || payload.timestamp
                }
              ];
            }
            
            const reconstructedChat = {
              id: chatId,
              type: payload.metadata.chatType || ChatType.DIRECT,
              createdAt: payload.metadata.createdAt || payload.timestamp,
              updatedAt: payload.metadata.updatedAt || payload.timestamp,
              status: payload.metadata.status || ChatStatus.ACTIVE,
              participants,
              metadata: payload.metadata
            } as ChatSession;
            
            console.log('Successfully reconstructed chat session');
            return reconstructedChat;
          }
        } catch (error) {
          console.error(`Error parsing chat data for ${chatId}:`, error);
        }
        
        // Last resort: return the raw payload as a chat session
        console.log('Using raw payload as a last resort');
        return payload as unknown as ChatSession;
      }
      
      console.log(`No chat found with ID: ${chatId}`);
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
   * Get all chats between a specific user and agent using direct lookup
   * 
   * This method is more reliable than the search-based approach as it
   * looks at the metadata directly in each point
   * 
   * @param userId User ID
   * @param agentId Agent ID
   * @returns Array of chat sessions
   */
  async getChatsByUserAndAgentDirect(userId: string, agentId: string): Promise<ChatSession[]> {
    await this.initialize();
    const { client } = await getMemoryServices();
    
    try {
      // Using scrollPoints to get all chats and filter them client-side
      console.log(`Direct lookup: Searching for chats between user ${userId} and agent ${agentId}`);
      const points = await client.scrollPoints(CHAT_COLLECTION);
      
      // Filter the points to find ones with matching userId and agentId in metadata
      const matchingChats = points.filter(point => {
        const payload = point.payload as any;
        
        // Check in metadata
        if (payload.metadata) {
          if (
            (payload.metadata.userId === userId || payload.metadata.createdBy === userId) &&
            payload.metadata.agentId === agentId
          ) {
            return true;
          }
        }
        
        // Check in participants
        if (payload.participants) {
          const hasUser = payload.participants.some((p: any) => p.id === userId);
          const hasAgent = payload.participants.some((p: any) => p.id === agentId);
          if (hasUser && hasAgent) {
            return true;
          }
        }
        
        return false;
      });
      
      console.log(`Direct lookup: Found ${matchingChats.length} matching chats`);
      
      // Convert to ChatSession objects
      return matchingChats.map(point => {
        // Try to parse as a ChatSession
        try {
          // Check for raw ChatSession in text field
          if (point.payload.text) {
            try {
              const parsedText = JSON.parse(point.payload.text);
              if (
                parsedText.id && 
                parsedText.type && 
                parsedText.participants && 
                Array.isArray(parsedText.participants)
              ) {
                return parsedText as ChatSession;
              }
            } catch (e) {
              // Not valid JSON, continue with next approach
            }
          }
          
          // Check for ChatSession data in metadata
          if (point.payload.metadata && point.payload.metadata.chatSessionData) {
            try {
              return JSON.parse(point.payload.metadata.chatSessionData) as ChatSession;
            } catch (e) {
              // Not valid JSON, continue with next approach
            }
          }
          
          // Reconstruct from parts
          return {
            id: point.id,
            type: point.payload.metadata?.chatType || ChatType.DIRECT,
            createdAt: point.payload.metadata?.createdAt || point.payload.timestamp,
            updatedAt: point.payload.metadata?.updatedAt || point.payload.timestamp,
            status: point.payload.metadata?.status || ChatStatus.ACTIVE,
            participants: (point.payload.metadata?.participants || '')
              .split(',')
              .filter(Boolean)
              .map((id: string) => ({
                id,
                type: id === agentId ? 'agent' : 'user',
                joinedAt: point.payload.metadata?.createdAt || point.payload.timestamp
              })),
            metadata: point.payload.metadata
          } as ChatSession;
          
        } catch (error) {
          console.error(`Error converting point to ChatSession: ${error}`);
          // Return a minimal valid ChatSession as fallback
          return {
            id: point.id,
            type: ChatType.DIRECT,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: ChatStatus.ACTIVE,
            participants: [
              { id: userId, type: 'user', joinedAt: new Date().toISOString() },
              { id: agentId, type: 'agent', joinedAt: new Date().toISOString() }
            ],
            metadata: point.payload.metadata || {}
          };
        }
      });
    } catch (error) {
      console.error(`Error in direct lookup for user ${userId} and agent ${agentId}:`, error);
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
