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
  return message.trim().toLowerCase();
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
async function saveToHistory(userId: string, role: 'user' | 'assistant', content: string, attachments?: any[], visionResponseFor?: string) {
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
        const chatStructuredId = createChatId('default-chat');
        
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
    const { message, userId = 'gab', memoryDisabled, attachments = [], visionResponseFor, agentId = 'chloe' } = await req.json();
    
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
        
        // Track this message in history
        if (!memoryDisabled) {
          await saveToHistory(userId, 'user', normalizedMessage, attachments);
        }
        
        // Set up a timeout to ensure we always respond
        const timeoutPromise = new Promise((_, reject) => {
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
        } else {
          throw new Error(`Unsupported agent ID: ${agentId}`);
        }
        
        // Process the message with the selected agent
        const chatResponse = await agent.processMessage(message, {
          attachments,
          userId,
          // TypeScript error fix: Cast to any to allow the visionResponseFor property
          ...(visionResponseFor ? { visionResponseFor } : {})
        } as any);
        
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
        
        return {
          reply,
          memory: memories,
          thoughts,
          timestamp
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
