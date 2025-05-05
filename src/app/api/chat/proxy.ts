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
async function loadChatHistoryFromQdrant(specificUserId?: string) {
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
    
    // Search for recent messages
    const fetchPromise = searchService.search("", {
      limit: 2000,
      types: [MemoryType.MESSAGE]
    });
    
    const searchResults = await Promise.race([fetchPromise, timeoutPromise]);
    const recentMessages = searchResults.map(result => result.point);
    console.log(`Retrieved ${recentMessages.length} total messages from memory service`);
    
    // Also fetch specifically high importance messages
    console.log('Fetching high importance memories...');
    const highImportanceResults = await searchService.search("", {
      types: [MemoryType.MESSAGE],
      filter: { importance: ImportanceLevel.HIGH },
      limit: 500
    });
    const importantMemories = highImportanceResults.map(result => result.point);
    console.log(`Retrieved ${importantMemories.length} high importance memories`);
    
    // Combine and deduplicate messages
    const allMessages = [...recentMessages];
    const seenIds = new Set(recentMessages.map((m: any) => m.id));
    
    // Add important memories that weren't already in recent messages
    for (const memory of importantMemories) {
      if (!seenIds.has(memory.id)) {
        allMessages.push(memory);
        seenIds.add(memory.id);
      }
    }
    
    console.log(`Combined ${allMessages.length} total messages after deduplication`);
    
    // Filter out internal reflections and messages not meant for chat
    const filteredMessages = allMessages.filter(message => {
      // Skip if no payload
      if (!message.payload) return false;
      
      // Extract contents
      const payload = message.payload as any;
      const content = payload.text || '';
      const metadata = payload.metadata || {};
      
      // Skip internal messages - new memory structure checks
      if (metadata.isInternal === true) return false;
      if (metadata.isForChat === false) return false;
      
      // Filter by user if specified
      if (specificUserId && metadata.userId && metadata.userId !== specificUserId) {
        return false;
      }
      
      // Skip auto-generated system messages
      const isSystemMessage = metadata.role === 'system' && metadata.source !== 'user';
      if (isSystemMessage) return false;
      
      // Check content patterns for internal messages
      const internalPatternValues = Object.values(INTERNAL_MESSAGE_PATTERNS);
      for (const pattern of internalPatternValues) {
        if (typeof pattern === 'string' && content.includes(pattern)) return false;
      }
      
      return true;
    });
    
    console.log(`Filtered to ${filteredMessages.length} chat-relevant messages`);
    
    // Group by user id
    const messagesByUser = new Map<string, any[]>();
    
    for (const message of filteredMessages) {
      const payload = message.payload as any;
      const metadata = payload.metadata || {};
      const userId = metadata.userId || 'default';
      
      if (!messagesByUser.has(userId)) {
        messagesByUser.set(userId, []);
      }
      
      messagesByUser.get(userId)?.push(message);
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
      totalMessagesLoaded: filteredMessages.length,
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
  
  // Create a message object
  const message = {
    role,
    content,
    timestamp: new Date().toISOString(),
  };
  
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
      let memorySuccess = false;
      
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
        
        // Try to add memory with timeout protection
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
        
        // Ensure userId is always set and is a string
        const safeUserId = String(userId || 'gab');
        
        const metadata: Record<string, any> = {
          userId: safeUserId, // Ensure userId is explicitly set and not undefined
          role,
          source: role === 'user' ? 'user' : 'chloe',
          attachments: processedAttachments || [],
          isForChat: true // Explicitly mark regular messages as intended for chat display
        };
        
        // Add visionResponseFor if it exists
        if (visionResponseFor) {
          metadata.visionResponseFor = visionResponseFor;
          console.log(`Including visionResponseFor in metadata: ${visionResponseFor}`);
        }
        
        // Debug - log the full metadata we're about to save
        console.log(`Saving message with metadata: userId=${metadata.userId}, role=${metadata.role}, source=${metadata.source}`);
        console.log(`Full metadata to memory service:`, JSON.stringify(metadata).substring(0, 200) + '...');
        
        // Add the memory using the memory service directly
        const addMemoryPromise = memoryService.addMemory({
          type: MemoryType.MESSAGE,
          content,
          metadata,
          payload: {
            text: content
          }
        });
        
        // Race the promises to handle timeouts
        const result = await Promise.race([addMemoryPromise, timeoutPromise]);
        const messageId = result.id;
        console.log(`Saved ${role} message to memory service for user ${safeUserId}, ID: ${messageId}`);
        memorySuccess = true;
        
        // Skip the verification step if we've successfully added the memory
        // This reduces unnecessary database operations
        
        return {
          ...message,
          visionResponseFor,
          memoryId: messageId
        };
      } catch (error) {
        // Log the error but continue - this is non-critical
        console.error('Error saving message to memory service:', error instanceof Error ? error.message : String(error));
        console.error('Full error details:', error);
        
        // Continue with in-memory storage only
        console.log(`Falling back to in-memory storage only for user ${userId}`);
        
        return {
          ...message,
          visionResponseFor
        };
      }
    })();
    
    // Store the promise in the pending operations map
    pendingMemoryOperations.set(operationKey, operationPromise);
    
    // Execute the operation
    const result = await operationPromise;
    
    // Clean up after operation completes
    setTimeout(() => {
      pendingMemoryOperations.delete(operationKey);
    }, 30000); // Keep in map for 30 seconds to prevent duplicates
    
    return result;
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
    const body = await req.json();
    
    // Check for required fields
    if (!body.message) {
      return NextResponse.json(
        { error: 'Missing required field: message' },
        { status: 400 }
      );
    }
    
    // Normalize the message to reduce duplicates
    const message = body.message.trim();
    const visionResponseFor = body.visionResponseFor;
    const attachments = body.attachments || [];
    
    // Use a consistent user ID
    const userId = body.userId || 'gab';
    
    // Skip empty messages
    if (!message) {
      return NextResponse.json(
        { error: 'Empty message' },
        { status: 400 }
      );
    }
    
    // Check the cache for recent responses to the same message
    const cacheKey = createCacheKey(message, userId);
    
    if (responseCache.has(cacheKey) && !body.bypassCache) {
      const cached = responseCache.get(cacheKey)!;
      
      // Check if cache is valid
      if (cached.expiry > Date.now()) {
        console.log(`Cache hit for message: ${message.substring(0, 30)}...`);
        
        return NextResponse.json({
          reply: cached.reply,
          memory: cached.memory,
          timestamp: cached.timestamp,
          thoughts: cached.thoughts,
          cached: true
        });
      } else {
        // Cache expired
        responseCache.delete(cacheKey);
      }
    }
    
    // Check if this exact request is already in flight
    if (inFlightRequests.has(cacheKey) && !body.bypassCache) {
      console.log(`Reusing in-flight request for: ${message.substring(0, 30)}...`);
      
      try {
        const response = await inFlightRequests.get(cacheKey)!;
        return NextResponse.json({
          ...response,
          inFlight: true
        });
      } catch (error) {
        // If the in-flight request fails, continue with a new request
        console.error('In-flight request failed, starting new request:', error);
        inFlightRequests.delete(cacheKey);
      }
    }
    
    // Save user message to history
    await saveToHistory(userId, 'user', message, attachments);
    
    // Process with the Chloe agent
    const resultPromise = (async () => {
      try {
        // Import the Chloe agent dynamically in this request context
        const { getChloeInstance } = await import('../../../agents/chloe');
        const chloeInstance = await getChloeInstance();
        
        if (!chloeInstance) {
          throw new Error('Failed to load Chloe agent');
        }
        
        // Process the message with Chloe
        const chatResponse = await chloeInstance.processMessage(message, {
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
        
        // Save assistant response to history
        await saveToHistory(userId, 'assistant', reply);
        
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
