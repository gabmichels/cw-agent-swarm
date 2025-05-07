import { NextResponse } from 'next/server';
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType, ImportanceLevel } from '../../../server/memory/config';
import { 
  INTERNAL_MESSAGE_PATTERNS, 
  METADATA_KEYS, 
  INTERNAL_MESSAGE_TYPES, 
  MESSAGE_SOURCES,
  DEBUG_CONSTANTS 
} from '../../../constants/proxy';
import { STORAGE_KEYS, DEFAULTS } from '../../../constants/qdrant';
import { MemorySource } from '../../../constants/memory';
import { addMessageMemory } from '../../../server/memory/services/memory/memory-service-wrappers';
import { createThreadInfo } from '../../../server/memory/services/helpers/metadata-helpers';
import { createUserId, createAgentId, createChatId } from '../../../types/structured-id';
import { MessageRole } from '../../../agents/chloe/types/state';
import { generateChatId } from '../../../utils/uuid';
import { getChatService } from '../../../server/memory/services/chat-service';

// In-memory cache and in-flight request tracking
const responseCache = new Map<string, {
  reply: string;
  memory: any[];
  thoughts: string[];
  timestamp: string;
  expiry: number;
}>();

// Track requests in progress to prevent duplicate processing
const inFlightRequests = new Map<string, Promise<{
  reply: string;
  memory?: string[];
  thoughts?: string[];
}>>();

// Cache TTL in ms (2 minutes)
const CACHE_TTL = 2 * 60 * 1000;

// Chat history cache to avoid repeated Qdrant calls
const chatHistoryCache = new Map<string, {
  history: any[];
  timestamp: number;
  expiry: number;
}>();

// Chat history cache TTL (5 minutes)
const CHAT_HISTORY_CACHE_TTL = 5 * 60 * 1000;

// Keep track of pending memory operations to avoid duplicate database calls
const pendingMemoryOperations = new Map<string, Promise<any>>();

// Create a function to normalize messages for caching
function normalizeMessage(message: string): string {
  return message.trim();
}

// Create a cache key from message and userId
function createCacheKey(message: string, userId: string = 'gab'): string {
  return `${userId}:${normalizeMessage(message)}`;
}

// Memory service status check
async function isMemoryInitialized(): Promise<boolean> {
  const { client } = await getMemoryServices();
  const status = await client.getStatus();
  return status.initialized;
}

// Initialize memory service
async function initializeMemory(options: any = {}): Promise<void> {
  const { client } = await getMemoryServices();
  if (!client) {
    throw new Error('Memory client not available');
  }
  await client.initialize();
}

// Load chat history from memory service
export async function loadChatHistoryFromQdrant(specificUserId?: string) {
  console.log(`Loading chat history from memory service${specificUserId ? ` for user: ${specificUserId}` : ''}`);
  try {
    // Check if memory services are initialized
    const { client, memoryService, searchService } = await getMemoryServices();
    const status = await client.getStatus();
    
    if (!status.initialized) {
      console.log('Initializing memory services...');
      await client.initialize();
    }
    
    // Set up a timeout to prevent hanging
    const fetchTimeout = 30000; // 30 seconds total timeout for this operation
    const timeoutPromise = new Promise<any[]>((_, reject) => {
      setTimeout(() => reject(new Error('Memory fetch operation timed out')), fetchTimeout);
    });
    
    // Get recent messages with timeout protection
    console.log('Fetching messages from memory service...');
    
    // Search for all messages with high limit - no filtering
    const fetchPromise = searchService.search("", {
      limit: 2000,
      types: [MemoryType.MESSAGE]
    });
    
    const searchResults = await Promise.race([fetchPromise, timeoutPromise]);
    const allMessages = searchResults.map(result => result.point);
    console.log(`Retrieved ${allMessages.length} total messages from memory service`);
    
    // Debug log all messages before grouping
    console.log(`DEBUG - All messages before filtering in loadChatHistoryFromQdrant:`, 
      allMessages.map(message => {
        const payload = message.payload as any;
        const metadata = payload.metadata || {};
        return {
          id: message.id,
          role: metadata.role || 'unknown',
          userId: metadata.userId || 'unknown',
          chatId: metadata.chatId || 'unknown',
          text: (payload.text || '').substring(0, 30) + '...'
        };
      })
    );
    
    // Group by user id
    const messagesByUser = new Map<string, any[]>();
    const defaultUserId = 'gab';  // Default user ID for the application
    
    for (const message of allMessages) {
      const payload = message.payload as any;
      const metadata = payload.metadata || {};
      
      // Normalize the userId - use 'gab' as the default for all messages to ensure they're grouped together
      // This fixes the issue where some messages have 'default' or undefined userId
      const userId = metadata.userId || defaultUserId;
      
      // Skip messages that don't match the specific user ID if one was provided
      if (specificUserId && userId !== specificUserId) {
        continue;
      }
      
      // Always store under the default userId to ensure all messages are grouped together
      const userKey = specificUserId || defaultUserId;
      
      if (!messagesByUser.has(userKey)) {
        messagesByUser.set(userKey, []);
      }
      
      messagesByUser.get(userKey)?.push(message);
    }
    
    // Sort each user's messages by timestamp
    Array.from(messagesByUser.entries()).forEach(([userId, messages]) => {
      // Sort by timestamp
      messages.sort((a: any, b: any) => {
        const aTime = (a.payload as any).timestamp || '0';
        const bTime = (b.payload as any).timestamp || '0';
        return aTime.localeCompare(bTime);
      });
      
      // Update the cache
      chatHistoryCache.set(userId, {
        history: messages,
        timestamp: Date.now(),
        expiry: Date.now() + CHAT_HISTORY_CACHE_TTL
      });
      
      console.log(`Cached ${messages.length} messages for user: ${userId}`);
    });
    
    return {
      messagesByUser,
      totalMessagesLoaded: allMessages.length,
      userCount: messagesByUser.size
    };
  } catch (error) {
    console.error('Error loading chat history:', error);
    return {
      messagesByUser: new Map(),
      totalMessagesLoaded: 0,
      userCount: 0,
      error: String(error)
    };
  }
}

// Function to extract cleaned messages
function extractCleanedMessages(messages: any[]): string[] {
  return messages.map(message => {
    const payload = message.payload as any;
    const role = (payload.metadata || {}).role || 'unknown';
    return `${role}: ${payload.text || ''}`;
  });
}

// Helper function to check if a message contains image data
function containsImageData(message: string): boolean {
  // Check for data URLs which are usually images
  return message.includes('data:image/') || 
         message.includes('<img src=') || 
         message.includes('![](data:image');
}

// Modify the saveToHistory function to be more efficient
async function saveToHistory(userId: string, role: 'user' | 'assistant', content: string, chatId: string = 'chat-chloe-gab', attachments?: any[], visionResponseFor?: string) {
  if (!content || content.trim() === '') return null;
  
  // Create an operation key to track this specific save operation
  const operationKey = `save:${userId}:${role}:${content.substring(0, 20)}`;
  
  try {
    // Check if we're already processing this message
    if (pendingMemoryOperations.has(operationKey)) {
      console.log(`Memory operation for ${operationKey} is already in progress, reusing promise`);
      return await pendingMemoryOperations.get(operationKey);
    }
    
    // Create a promise for this operation
    const operationPromise = (async () => {
      try {
        // Ensure memory services are initialized before adding memory
        const { client, memoryService } = await getMemoryServices();
        const status = await client.getStatus();
        
        if (!status.initialized) {
          console.log('Initializing memory services before saving message');
          await client.initialize();
        }
        
        // Set up a timeout to prevent long-running operations
        const timeout = 15000; // 15 seconds
        const timeoutPromise = new Promise<any>((_, reject) => {
          setTimeout(() => reject(new Error('Memory operation timed out')), timeout);
        });
        
        console.log(`Saving ${role} message to memory service for user ${userId}: "${content.substring(0, 50)}..."`);
        
        let processedAttachments = attachments;
        if (attachments && attachments.length > 0) {
          console.log(`Message has ${attachments.length} attachments`);
          
          // For each attachment, ensure preview URLs aren't too long
          processedAttachments = attachments.map(attachment => {
            // If it has a data URL preview that's too long, truncate it or remove it
            if (attachment.preview && attachment.preview.length > 1000 && attachment.preview.startsWith('data:')) {
              // For image attachments, keep a token part of the data URL to indicate it exists
              const truncatedPreview = attachment.preview.substring(0, 100) + '...[truncated for storage]';
              return {
                ...attachment,
                preview: truncatedPreview,
                has_full_preview: true // Flag to indicate there was a preview
              };
            }
            return attachment;
          });
          
          console.log(`Processed attachments for storage:`, JSON.stringify(processedAttachments).substring(0, 200) + '...');
        }
        
        // Convert role to the right format
        const messageRole = role === 'user' ? MessageRole.USER : MessageRole.ASSISTANT;
        
        // Create structured IDs
        const userStructuredId = createUserId(userId || 'default');
        const agentStructuredId = createAgentId('assistant');
        
        // Get or create a chat session for this user-agent pair
        let chatSession;
        let chatStructuredId;
        
        try {
          const chatService = await getChatService();
          const assistantAgentId = 'assistant'; // Default agent ID for the memory service
          
          // Check if the chat already exists
          try {
            await chatService.getChatById(chatId);
          } catch (err) {
            // If chat doesn't exist, create it with the hardcoded id
            await chatService.createChat(userId, assistantAgentId, {
              title: `Chat with ${assistantAgentId}`,
              description: `Conversation between user ${userId} and agent ${assistantAgentId}`
            });
          }
          
          // Create a structured chat ID
          chatStructuredId = createChatId(chatId);
        } catch (error) {
          console.warn('Error checking/creating chat session:', error);
          // Create a fallback structured ID
          chatStructuredId = createChatId(chatId);
        }
        
        // Create thread info
        const threadInfo = createThreadInfo(`thread_${Date.now()}`, 0);
        
        // Add to memory using new pattern
        const memoryOperation = addMessageMemory(
          memoryService,
          content,
          messageRole,
          userStructuredId,
          agentStructuredId,
          chatStructuredId,
          threadInfo,
          {
            attachments: processedAttachments,
            // Use valid MessageMetadata properties like tags for custom data
            ...(visionResponseFor ? { 
              messageType: 'vision-response',
              tags: ['vision', `response-for:${visionResponseFor.substring(0, 20)}`]
            } : {})
          }
        );
        
        // Execute with timeout protection
        const memoryResult = await Promise.race([memoryOperation, timeoutPromise]);
        
        // Update cache with new message (if relevant)
        if (userId && chatHistoryCache.has(userId)) {
          const cachedData = chatHistoryCache.get(userId);
          if (cachedData) {
            // Create a simplified point for the cache
            const newPoint = {
              id: memoryResult.id,
              payload: {
                text: content,
                metadata: {
                  role: messageRole,
                  userId: userStructuredId,
                  timestamp: Date.now(),
                  chatId: chatId, // Store the UUID-based chat ID in metadata
                  ...(visionResponseFor ? { visionResponseFor } : {}) // Keep this for the cache only
                }
              }
            };
            
            // Add to cache
            cachedData.history.push(newPoint);
            cachedData.timestamp = Date.now();
            
            console.log(`Added message to in-memory cache for user ${userId}`);
          }
        }
        
        return memoryResult;
      } catch (error) {
        console.error('Error saving message to history:', error);
        throw error; // Re-throw to let the caller handle it
      }
    })();
    
    // Store the promise in the pending operations map
    pendingMemoryOperations.set(operationKey, operationPromise);
    
    // Clean up after operation is complete
    operationPromise.finally(() => {
      pendingMemoryOperations.delete(operationKey);
    });
    
    return await operationPromise;
  } catch (error) {
    console.error('Error in saveToHistory:', error);
    return null;
  }
}

// Agent singleton
let agent = null;

// POST handler
export async function POST(req: Request) {
  try {
    // Parse the JSON request
    const { message, userId = 'gab', memoryDisabled, attachments = [], visionResponseFor, agentId = 'chloe', chatId = 'chat-chloe-gab' } = await req.json();
    
    // Normalize and validate the message
    const normalizedMessage = normalizeMessage(message);
    
    if (!normalizedMessage) {
      return NextResponse.json(
        { error: 'Message is required and cannot be empty' },
        { status: 400 }
      );
    }
    
    // Create a cache key
    const cacheKey = createCacheKey(normalizedMessage, userId);
    
    // Check if we already have this request in flight
    if (inFlightRequests.has(cacheKey)) {
      console.log(`Using in-flight request for: ${normalizedMessage.substring(0, 50)}...`);
      const result = await inFlightRequests.get(cacheKey);
      return NextResponse.json(result);
    }
    
    // Check cache first
    if (!containsImageData(normalizedMessage) && !visionResponseFor && responseCache.has(cacheKey)) {
      const cachedResponse = responseCache.get(cacheKey);
      
      // If not expired, return cached response
      if (cachedResponse && cachedResponse.expiry > Date.now()) {
        console.log(`Using cached response for: ${normalizedMessage.substring(0, 50)}...`);
        return NextResponse.json({
          reply: cachedResponse.reply,
          memory: cachedResponse.memory,
          thoughts: cachedResponse.thoughts,
          timestamp: cachedResponse.timestamp,
          cached: true
        });
      }
    }
    
    // Create a new promise for this request
    const resultPromise = (async () => {
      try {
        // Initialize memory if not already done
        if (!memoryDisabled) {
          await initializeMemory();
        }
        
        // Get or create a chat session for this conversation
        let chatSession;
        try {
          const chatService = await getChatService();
          chatSession = await chatService.createChat(userId, agentId, {
            title: `Chat with ${agentId}`,
            description: `Conversation between user ${userId} and agent ${agentId}`
          });
        } catch (chatError) {
          console.error('Error creating chat session:', chatError);
          // Continue without a chat session - the conversation will still work
          chatSession = {
            id: `chat-${userId}-${agentId}`,
            type: 'direct',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active',
            participants: [
              { id: userId, type: 'user', joinedAt: new Date().toISOString() },
              { id: agentId, type: 'agent', joinedAt: new Date().toISOString() }
            ],
            metadata: {
              title: `Chat with ${agentId}`,
              description: `Conversation between user ${userId} and agent ${agentId}`
            }
          };
        }
        
        // Use the UUID directly - no longer need to create a structured ID from it
        const chatId = chatSession.id;
        
        // Create structured IDs for user and agent
        const userStructuredId = createUserId(userId || 'default');
        const agentStructuredId = createAgentId('assistant');
        
        // Create thread info
        const threadInfo = createThreadInfo(`thread_${Date.now()}`, 0);
        
        // Track this message in history
        let userMessageId = null;
        if (!memoryDisabled) {
          // Save user message to history
          const memoryResult = await saveToHistory(userId, 'user', normalizedMessage, chatId, attachments);
          if (memoryResult && memoryResult.id) {
            userMessageId = memoryResult.id;
            console.log(`Saved user message to memory with ID: ${userMessageId}`);
          }
        }
        
        // Set up a timeout to ensure we always respond
        const timeoutPromise = new Promise<any>((_, reject) => {
          setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
        });
        
        // Choose agent based on agentId parameter
        let agent;
        
        // Currently we only support Chloe, but this can be expanded
        if (agentId === 'chloe') {
          const { getChloeInstance } = await import('../../../agents/chloe');
          agent = await getChloeInstance();
          
          if (!agent) {
            throw new Error('Failed to load Chloe agent');
          }
          
          // Make sure Chloe is initialized
          if (!agent.initialized && typeof agent.initialize === 'function') {
            console.log('Initializing Chloe on first use');
            await agent.initialize();
          }
        } else {
          throw new Error(`Unsupported agent ID: ${agentId}`);
        }
        
        // Process the message with the selected agent - with timeout protection
        let chatResponse;
        try {
          const processPromise = agent.processMessage(message, {
            attachments,
            userId,
            // Add the userMessageId to the options so the agent knows not to save this message again
            userMessageId,
            // TypeScript error fix: Cast to any to allow the visionResponseFor property
            ...(visionResponseFor ? { visionResponseFor } : {})
          } as any);
          
          // Race the process against a timeout
          chatResponse = await Promise.race([processPromise, timeoutPromise]);
        } catch (agentError) {
          console.error('Error from agent process:', agentError);
          // Provide a fallback response
          chatResponse = {
            content: "I'm experiencing some technical difficulties at the moment. Please try again later.",
            memories: [],
            thoughts: [`Error: ${agentError instanceof Error ? agentError.message : String(agentError)}`]
          };
        }
        
        // TypeScript error fix: Properly extract data with type handling
        // Extract essential information with proper type handling
        const reply = typeof chatResponse === 'string' 
          ? chatResponse 
          : (chatResponse as any).content?.trim() || "I'm sorry, I couldn't generate a response.";
          
        const memories = typeof chatResponse === 'string' 
          ? [] 
          : (chatResponse as any).memories || [];
          
        const thoughts = typeof chatResponse === 'string' 
          ? [] 
          : (chatResponse as any).thoughts || [];
        
        // Update cache
        const timestamp = new Date().toISOString();
        responseCache.set(cacheKey, {
          reply,
          memory: memories,
          thoughts,
          timestamp,
          expiry: Date.now() + CACHE_TTL
        });
        
        // Save reply to history if memory is enabled
        if (!memoryDisabled) {
          await saveToHistory(userId, 'assistant', reply, chatId, attachments);
        }
        
        return {
          reply,
          memory: memories,
          thoughts,
          timestamp,
          chatId: chatSession?.id || `chat-${userId}-${agentId}`,
          chatInfo: chatSession ? {
            title: chatSession.metadata?.title || `Chat with ${agentId}`,
            participants: chatSession.participants.map(p => ({
              id: p.id,
              type: p.type
            }))
          } : {
            title: `Chat with ${agentId}`,
            participants: [
              { id: userId, type: 'user' },
              { id: agentId, type: 'agent' }
            ]
          }
        };
      } catch (error) {
        console.error('Error processing message:', error);
        
        // Generate a fallback response
        const errorMessage = error instanceof Error ? error.message : String(error);
        const fallbackReply = 'I encountered an error while processing your message. Please try again later.';
        
        return {
          reply: fallbackReply,
          error: errorMessage,
          timestamp: new Date().toISOString()
        };
      } finally {
        // Clean up the in-flight request tracking
        setTimeout(() => {
          inFlightRequests.delete(cacheKey);
        }, 5000);
      }
    })();
    
    // Store the promise
    inFlightRequests.set(cacheKey, resultPromise);
    
    // Wait for the result
    const result = await resultPromise;
    
    // Return the response
    return NextResponse.json(result);
  } catch (error) {
    console.error('Unexpected error in /api/chat/proxy POST handler:', error);
    
    return NextResponse.json(
      {
        reply: 'Sorry, I encountered an unexpected error processing your request.',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// GET handler
export async function GET(req: Request) {
  try {
    // Get memory service status
    const isInitialized = await isMemoryInitialized();
    
    return NextResponse.json({
      status: 'ok',
      initialized: isInitialized,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in GET handler:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
