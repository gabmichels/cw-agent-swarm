import { NextResponse } from 'next/server';
import * as serverQdrant from '../../../server/qdrant';
import { MemoryRecord } from '../../../server/qdrant';
import { 
  INTERNAL_MESSAGE_PATTERNS, 
  METADATA_KEYS, 
  INTERNAL_MESSAGE_TYPES, 
  MESSAGE_SOURCES,
  DEBUG_CONSTANTS 
} from '../../../constants/proxy';
import { STORAGE_KEYS, DEFAULTS } from '../../../constants/qdrant';
import { MemorySource } from '../../../constants/memory';

// Dynamically import the Chloe agent to avoid import errors
async function getChloeAgent() {
  try {
    console.log('Attempting to import Chloe agent...');
    
    // Try to dynamically import the agent
    const agentModule = await import('../../../agents/chloe');
    
    console.log('Import successful. Available exports:', Object.keys(agentModule));
    
    if (!agentModule.ChloeAgent) {
      console.error('ChloeAgent not found in the imported module. Available exports:', Object.keys(agentModule));
      return null;
    }
    
    return agentModule.ChloeAgent;
  } catch (error) {
    console.error('Detailed error importing Chloe agent:', error);
    
    // Try to get more specific error information
    if (error instanceof Error) {
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    
    // Check if the package is installed
    try {
      require.resolve('../../../agents/chloe');
      console.log('Package is installed but failed to import');
    } catch (e) {
      console.error('ChloeAgent module is not installed or not resolvable');
    }
    
    return null;
  }
}

// Load chat history from Qdrant on startup
async function loadChatHistoryFromQdrant(specificUserId?: string) {
  console.log(`Loading chat history from Qdrant${specificUserId ? ` for user: ${specificUserId}` : ''}`);
  try {
    // Initialize Qdrant if needed with a longer timeout for initial load
    if (!serverQdrant.isInitialized()) {
      await serverQdrant.initMemory({
        connectionTimeout: 10000 // 10 seconds
      });
    }
    
    // Set up a timeout to prevent hanging
    const fetchTimeout = 30000; // 30 seconds total timeout for this operation
    const timeoutPromise = new Promise<MemoryRecord[]>((_, reject) => {
      setTimeout(() => reject(new Error('Qdrant fetch operation timed out')), fetchTimeout);
    });
    
    // Try to get recent messages with timeout protection - increase limit to ensure we get all messages
    console.log('Fetching messages from Qdrant...');
    const fetchPromise = serverQdrant.getRecentMemories('message', 2000); // Increased from 1000
    const recentMessages = await Promise.race([fetchPromise, timeoutPromise]);
    console.log(`Retrieved ${recentMessages.length} total messages from Qdrant`);
    
    // Also fetch specifically high importance messages
    console.log('Fetching high importance memories...');
    const importantMemories = await serverQdrant.getMemoriesByImportance('high', 500);
    console.log(`Retrieved ${importantMemories.length} high importance memories`);
    
    // Combine and deduplicate messages
    const allMessages = [...recentMessages];
    const seenIds = new Set(recentMessages.map(m => m.id));
    
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
      // Check if message has metadata and should be excluded from chat
      if (message.metadata) {
        // Skip messages explicitly marked as not for chat
        if (message.metadata[METADATA_KEYS.NOT_FOR_CHAT] === true) {
          console.log(`Filtering out message ${message.id} marked as notForChat`);
          return false;
        }
        
        // Skip messages marked as internal reflections
        if (message.metadata[METADATA_KEYS.IS_INTERNAL_REFLECTION] === true || 
            message.metadata[METADATA_KEYS.IS_INTERNAL_MESSAGE] === true) {
          console.log(`Filtering out message ${message.id} marked as internal`);
          return false;
        }
        
        // Skip messages with 'performance_review' subtype
        if (message.metadata[METADATA_KEYS.SUBTYPE] === 'performance_review') {
          console.log(`Filtering out message ${message.id} with performance_review subtype`);
          return false;
        }

        // Skip messages from internal sources
        if (message.metadata[METADATA_KEYS.SOURCE] === MESSAGE_SOURCES.INTERNAL || 
            message.metadata[METADATA_KEYS.SOURCE] === MESSAGE_SOURCES.SYSTEM ||
            message.metadata[METADATA_KEYS.SOURCE] === MemorySource.FILE) {
          console.log(`Filtering out message ${message.id} from internal/system/file source`);
          return false;
        }

        // Skip messages with file paths (indicating markdown file source)
        if (message.metadata.filePath) {
          console.log(`Filtering out message ${message.id} with filePath: ${message.metadata.filePath}`);
          return false;
        }

        // Skip messages with internal message types
        if (message.metadata[METADATA_KEYS.MESSAGE_TYPE]) {
          if (INTERNAL_MESSAGE_TYPES.includes(
            message.metadata[METADATA_KEYS.MESSAGE_TYPE].toLowerCase())
          ) {
            console.log(`Filtering out message ${message.id} with internal messageType: ${message.metadata[METADATA_KEYS.MESSAGE_TYPE]}`);
            return false;
          }
        }
      }
      
      // Also filter based on content patterns for backward compatibility
      if (message.text.includes(INTERNAL_MESSAGE_PATTERNS.PERFORMANCE_REVIEW) || 
          message.text.includes(INTERNAL_MESSAGE_PATTERNS.SUCCESS_RATE) ||
          message.text.includes(INTERNAL_MESSAGE_PATTERNS.TASK_COMPLETION) ||
          message.text.includes(INTERNAL_MESSAGE_PATTERNS.USER_SATISFACTION) ||
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.REFLECTION_PREFIX) ||
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.THOUGHT_PREFIX) ||
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.THOUGHT_PREFIX_LC) ||
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.REFLECTION_PREFIX_UC) ||
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.REFLECTION_PREFIX_LC) ||
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.MESSAGE_PREFIX) ||
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.TIMESTAMP_PREFIX) ||
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.IMPORTANT_THOUGHT_PREFIX) ||
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.IMPORTANT_THOUGHT_PREFIX_LC) ||
          message.text.includes(INTERNAL_MESSAGE_PATTERNS.IMPORTANT_THOUGHT) ||
          // Markdown content patterns
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.MARKDOWN_HEADER_PREFIX) ||
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.MARKDOWN_SUBHEADER_PREFIX) ||
          message.text.startsWith(INTERNAL_MESSAGE_PATTERNS.YAML_FRONTMATTER_START) ||
          // Filter out market scanner insights
          message.text.startsWith('{"insight":') ||
          // Filter out message format patterns that indicate duplicates
          message.text.match(/^USER MESSAGE \[\d{4}-\d{2}-\d{2}/) ||
          message.text.match(/^MESSAGE \[\d{4}-\d{2}-\d{2}/) ||
          (message.text.indexOf('[') === 0 && message.text.indexOf(']:') > 0)) {
        console.log(`Filtering out internal message ${message.id} based on content pattern`);
        return false;
      }
      
      return true;
    });
    
    console.log(`Filtered down to ${filteredMessages.length} chat-appropriate messages`);
    
    // Log IDs to help debug
    console.log('Message IDs sample:', filteredMessages.slice(0, 5).map(m => m.id).join(', '));
    
    // Show the full metadata of the last few messages
    if (filteredMessages.length > 0) {
      console.log('Last 3 messages full details:');
      filteredMessages.slice(-3).forEach((msg, i) => {
        const hasAttachments = msg.metadata && 
                           msg.metadata.attachments && 
                           Array.isArray(msg.metadata.attachments) && 
                           msg.metadata.attachments.length > 0;
        
        console.log(`Message ${i + 1}:`, {
          id: msg.id,
          text: msg.text.substring(0, 50) + '...',
          timestamp: msg.timestamp,
          metadata: {
            userId: msg.metadata?.userId,
            role: msg.metadata?.role,
            source: msg.metadata?.source,
            importance: msg.metadata?.importance || 'medium',
            hasAttachments: hasAttachments,
            attachmentsCount: hasAttachments ? msg.metadata.attachments.length : 0
          }
        });
        
        if (hasAttachments) {
          console.log('Attachments sample:', JSON.stringify(msg.metadata.attachments[0]).substring(0, 200) + '...');
        }
      });
    }
    
    // Clear existing history if loading for a specific user
    if (specificUserId) {
      chatHistory.delete(specificUserId);
    }
    
    // Group messages by userId
    const userCounts: Record<string, number> = {};
    let messagesWithAttachments = 0;
    
    // Process all messages, handling missing userId metadata
    for (const message of filteredMessages) {
      // Determine the userId for this message
      let userId: string;
      
      if (message.metadata && message.metadata.userId) {
        // Use the userId from metadata if it exists
        userId = message.metadata.userId;
      } else {
        if (specificUserId) {
          // If we're loading for a specific user, assume orphaned messages belong to them
          userId = specificUserId;
          console.log(`Adopting message ${message.id} with missing userId metadata for user ${specificUserId}`);
        } else {
          // Default to 'gab' if no userId is specified
          userId = 'gab';
          console.log(`Assigning message ${message.id} with missing userId metadata to default user 'gab'`);
        }
      }
      
      // Track message count per user
      userCounts[userId] = (userCounts[userId] || 0) + 1;
      
      // Skip if we're loading for a specific user and this message isn't for that user
      if (specificUserId && userId !== specificUserId) {
        continue;
      }
      
      // Determine role from metadata or default to a reasonable value
      const role = message.metadata?.role || 
                  (message.metadata?.source === 'user' ? 'user' : 'assistant');
      
      // Handle attachments - ensure it's an array and properly structured
      let attachments = [];
      if (message.metadata && message.metadata.attachments && Array.isArray(message.metadata.attachments)) {
        attachments = message.metadata.attachments;
        messagesWithAttachments++;
      }
      
      const hasAttachments = attachments.length > 0;
      console.log(`Processing message for user ${userId}, has attachments: ${hasAttachments}`);
      if (hasAttachments) {
        console.log(`Message has ${attachments.length} attachments:`, 
          JSON.stringify(attachments).substring(0, 200) + '...');
      }
      
      if (!chatHistory.has(userId)) {
        chatHistory.set(userId, []);
      }
      
      // Check for duplicate content before adding to chat history
      // This prevents the same message from appearing twice in the UI
      const existingMessages = chatHistory.get(userId)!;
      const isDuplicate = existingMessages.some(existingMsg => 
        existingMsg.content === message.text && 
        existingMsg.role === role &&
        (existingMsg.timestamp === message.timestamp ||
         (new Date(existingMsg.timestamp).getTime() - new Date(message.timestamp).getTime() < 1000))
      );
      
      if (!isDuplicate) {
        chatHistory.get(userId)!.push({
          role,
          content: message.text,
          timestamp: message.timestamp,
          attachments: attachments.length > 0 ? attachments : undefined
        });
      } else {
        console.log(`Skipping duplicate message: ${message.text.substring(0, 30)}...`);
      }
    }
    
    // Log user counts
    Object.entries(userCounts).forEach(([userId, count]) => {
      console.log(`Found ${count} messages for user ${userId}`);
    });
    console.log(`Found ${messagesWithAttachments} messages with attachments across all users`);
    
    // Sort messages for each user by timestamp
    const usersToSort = specificUserId ? [specificUserId] : Array.from(chatHistory.keys());
    
    usersToSort.forEach(userId => {
      if (!chatHistory.has(userId)) return;
      
      const messages = chatHistory.get(userId) || [];
      console.log(`Sorting ${messages.length} messages for user ${userId}`);
      
      // Log messages with attachments
      const messagesWithAttachments = messages.filter(m => m.attachments && m.attachments.length > 0);
      if (messagesWithAttachments.length > 0) {
        console.log(`Found ${messagesWithAttachments.length} messages with attachments for user ${userId}`);
        messagesWithAttachments.forEach((msg, i) => {
          console.log(`Attachment message ${i + 1}:`, {
            role: msg.role,
            content: msg.content.substring(0, 50) + '...',
            timestamp: msg.timestamp,
            attachmentsCount: msg.attachments?.length
          });
        });
      }
      
      chatHistory.set(userId, messages.sort((a: { timestamp: string }, b: { timestamp: string }) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ));
    });
    
    if (specificUserId) {
      console.log(`Loaded ${chatHistory.get(specificUserId)?.length || 0} messages for user ${specificUserId}`);
    } else {
      console.log(`Loaded chat history for ${chatHistory.size} users from Qdrant`);
    }
    
    return true;
  } catch (error) {
    console.error('Error loading chat history from Qdrant:', error instanceof Error ? error.message : String(error));
    console.error('Full error details:', error);
    
    // If this is for a specific user who doesn't have history yet, just create an empty array
    if (specificUserId && !chatHistory.has(specificUserId)) {
      chatHistory.set(specificUserId, []);
    }
    
    return false;
  }
}

// Call this when the module is loaded
loadChatHistoryFromQdrant();

// Agent singleton
let chloeInstance: any = null;

// In-memory chat history storage (userId -> messages)
const chatHistory: Map<string, Array<{ role: string; content: string; timestamp: string; attachments?: any[] }>> = new Map();

// Capture Chloe's thoughts from logs
const captureThoughts = () => {
  const thoughts: string[] = [];
  
  // Store original console.log
  const originalConsoleLog = console.log;
  
  // Override console.log to capture thoughts
  console.log = function(...args) {
    // Call original console.log
    originalConsoleLog.apply(console, args);
    
    // Check if this might be a thought
    const logStr = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      } else {
        return String(arg);
      }
    }).join(' ');

    // Mark messages that are explicitly internal reflections
    if (logStr.includes('INTERNAL REFLECTION (NOT CHAT)')) {
      const timestamp = new Date().toISOString();
      thoughts.push(`[${timestamp.split('T')[1].split('.')[0]}] ${logStr.replace('INTERNAL REFLECTION (NOT CHAT): ', '')}`);
      return; // Don't process further since we know exactly what this is
    }
    
    // Filter for thought-like patterns
    if (
      (logStr.includes('Chloe thinking:') || 
       logStr.includes('Agent thought:') || 
       logStr.includes('Reasoning:') ||
       logStr.includes('Planning:') ||
       logStr.includes('agent state:') ||
       logStr.includes('thinking about:') ||
       logStr.includes('analyzing:') ||
       logStr.includes('considering:') ||
       (logStr.includes('LangGraph') && logStr.includes('state')) ||
       (logStr.includes('thought:') && !logStr.includes('API')) ||
       (logStr.includes('LLM response') && logStr.length < 500)) && 
      !logStr.includes('API') && 
      !logStr.includes('initialize') &&
      !logStr.includes('socket') &&
      !logStr.includes('connection')
    ) {
      // Add timestamp to the thought
      const timestamp = new Date().toISOString();
      thoughts.push(`[${timestamp.split('T')[1].split('.')[0]}] ${logStr}`);
    }
  };
  
  // Function to get collected thoughts
  return {
    getThoughts: () => [...thoughts],
    reset: () => { thoughts.length = 0; },
    restore: () => { console.log = originalConsoleLog; }
  };
};

// Process a message through the real Chloe agent
async function generateRealResponse(message: string): Promise<{reply: string, memory?: string[], thoughts?: string[]}> {
  console.log('Processing message through Chloe agent:', message);
  
  try {
    // Start capturing thoughts
    const thoughtCapture = captureThoughts();
    
    // Try to get the real agent
    if (!chloeInstance) {
      console.log('No existing Chloe instance, attempting to create one...');
      const ChloeAgent = await getChloeAgent();
      
      if (ChloeAgent) {
        console.log('Initializing real Chloe agent...');
        try {
          chloeInstance = new ChloeAgent();
          await chloeInstance.initialize();
          console.log('Chloe agent initialized successfully');
        } catch (initError) {
          console.error('Error initializing Chloe agent instance:', initError);
          if (initError instanceof Error) {
            console.error(`Init error stack: ${initError.stack}`);
          }
          chloeInstance = null;
        }
      } else {
        console.error('Failed to get ChloeAgent class');
      }
    }
    
    // If we have a real agent, use it
    let result;
    try {
      if (chloeInstance) {
        console.log('Using real Chloe agent to process message');
        try {
          // Capture agent thoughts about the message
          console.log(`Chloe thinking: Analyzing user query: "${message}"`);
          
          const reply = await chloeInstance.processMessage(message);
          
          // Get memory context
          let memoryContext = [];
          try {
            if (chloeInstance.getMemory && typeof chloeInstance.getMemory === 'function') {
              const memory = chloeInstance.getMemory();
              if (memory && memory.getContext && typeof memory.getContext === 'function') {
                console.log('Retrieving relevant memory context for:', message);
                memoryContext = await memory.getContext(message) || [];
                console.log(`Found ${memoryContext.length} memory items that may be relevant`);
              } else {
                console.error('Memory object does not have getContext method');
              }
            } else {
              console.error('Chloe instance does not have getMemory method');
            }
          } catch (memoryError) {
            console.error('Error getting memory context:', memoryError);
          }
          
          // Get captured thoughts
          const thoughts = thoughtCapture.getThoughts();
          console.log(`Captured ${thoughts.length} thought steps during processing`);
          
          // Add final thought about the response if there are no thoughts yet
          if (thoughts.length === 0) {
            const timestamp = new Date().toISOString();
            thoughts.push(`[${timestamp.split('T')[1].split('.')[0]}] Chloe thinking: Generated response based on the user query without detailed thought steps.`);
          }
          
          result = {
            reply,
            memory: Array.isArray(memoryContext) ? memoryContext : memoryContext ? [memoryContext] : [],
            thoughts: thoughts
          };
        } catch (processError) {
          console.error('Error processing message with Chloe:', processError);
          if (processError instanceof Error) {
            console.error(`Process error stack: ${processError.stack}`);
          }
          
          // Fall through to OpenAI fallback
          throw processError;
        }
      } else {
        // Fall through to OpenAI fallback
        throw new Error('Chloe instance not available');
      }
    } catch (error) {
      // OpenAI Direct Fallback
      console.log('Using OpenAI direct fallback due to error:', error);
      try {
        // Import OpenAI (from a package that's already in use)
        const { OpenAI } = await import("openai");
        
        // Create client with OpenAI configuration
        const openAI = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY || 'your-key-here', // You should replace this with your actual key or make sure env var is set
          dangerouslyAllowBrowser: true,
        });
        
        // Construct system message for Chloe's persona
        const systemMessage = `You are Chloe, a helpful, friendly AI marketing assistant for the Crowd Wisdom agency.
Your goal is to help with marketing tasks, strategy, and content creation.
Always be professional but conversational. You have expertise in digital marketing trends, content strategy, and social media.
When you don't know something, admit it and offer to help find the information.
If the user asks about "Claro" specifically, it's a travel app we're developing that focuses on simplicity, clarity, and social sharing for travelers.`;
        
        // Call OpenAI directly
        const completion = await openAI.chat.completions.create({
          model: "gpt-3.5-turbo", // Use a cheaper model for fallback
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: message }
          ],
          temperature: 0.7,
        });
        
        // Extract the response
        const reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";
        
        // Create a thought explaining we used the fallback
        const timestamp = new Date().toISOString();
        const fallbackThought = `[${timestamp.split('T')[1].split('.')[0]}] Chloe thinking: Using cheap OpenAI model fallback due to agent processing error.`;
        
        result = {
          reply,
          memory: [],
          thoughts: [fallbackThought]
        };
      } catch (fallbackError) {
        console.error('Error using OpenAI fallback:', fallbackError);
        
        // Ultimate fallback response
        result = {
          reply: "I apologize, but I'm having trouble processing your request right now. This seems to be a technical issue on my end. Could you try again with a different question, or come back a bit later?",
          memory: [],
          thoughts: ["Error in both primary and fallback response generation."]
        };
      }
    }
    
    // Restore original console.log
    thoughtCapture.restore();
    
    return result;
  } catch (error) {
    console.error('Error generating real response:', error);
    return {
      reply: `I'm sorry, I'm having trouble processing your request right now. Please try a different question or check back later.`,
      memory: [],
      thoughts: []
    };
  }
}

// Save a message to chat history
async function saveToHistory(userId: string, role: 'user' | 'assistant', content: string, attachments?: any[], visionResponseFor?: string) {
  // Ensure we have a user ID
  if (!userId) {
    userId = 'gab';
  }
  
  // Create a timestamp
  const timestamp = new Date().toISOString();
  
  // Initialize chat history for this user if it doesn't exist
  if (!chatHistory.has(userId)) {
    chatHistory.set(userId, []);
  }
  
  // Skip saving if this is an internal reflection/thought that shouldn't be in chat
  if (role === 'assistant' && (
    content.includes('Performance Review:') || 
    content.includes('Success Rate:') || 
    content.includes('Task Completion:') || 
    content.includes('User Satisfaction:') ||
    (content.match(/Daily Performance Review:[\s\S]*Success Rate:[\s\S]*Task Completion:[\s\S]*User Satisfaction:/) !== null) ||
    (content.match(/Weekly Performance Review:[\s\S]*Success Rate:[\s\S]*Task Completion:[\s\S]*User Satisfaction:/) !== null) ||
    (content.match(/Monthly Performance Review:[\s\S]*Success Rate:[\s\S]*Task Completion:[\s\S]*User Satisfaction:/) !== null) ||
    content.includes('Investigated intent failures') ||
    content.includes('Analyzed user feedback') ||
    content.includes('Monitored system performance') ||
    content.includes('Evaluated response quality') ||
    content.includes('Detected patterns in') ||
    content.includes('Optimized response generation')
  )) {
    console.log(`Skipping saving internal reflection to chat history: ${content.substring(0, 50)}...`);
    return;
  }
  
  // First add message to in-memory history (this is guaranteed to work)
  const message = {
    role,
    content,
    timestamp,
    attachments
  };
  
  console.log(`Saving ${role} message with ${attachments ? attachments.length : 0} attachments:`, 
    attachments ? JSON.stringify(attachments).substring(0, 200) + '...' : 'none');
  
  chatHistory.get(userId)!.push(message);
  console.log(`Added ${role} message to in-memory history for user ${userId}`);
  
  // Then try to persist to Qdrant (only when running server-side)
  if (typeof window === 'undefined') {
    let qdrantSuccess = false;
    
    try {
      // Ensure Qdrant is initialized before adding memory
      if (!serverQdrant.isInitialized()) {
        console.log('Initializing Qdrant before saving message');
        await serverQdrant.initMemory({
          connectionTimeout: 10000 // Increase timeout to 10 seconds
        });
      }
      
      // Set up a timeout to prevent long-running operations
      const timeout = 15000; // 15 seconds
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Qdrant operation timed out')), timeout);
      });
      
      // Try to add memory with timeout protection
      console.log(`Saving ${role} message to Qdrant for user ${userId}: "${content.substring(0, 50)}..."`);
      
      if (attachments && attachments.length > 0) {
        console.log(`Message has ${attachments.length} attachments`);
        
        // For each attachment, ensure preview URLs aren't too long for Qdrant
        const processedAttachments = attachments.map(attachment => {
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
        attachments: attachments || [],
        isForChat: true // Explicitly mark regular messages as intended for chat display
      };
      
      // Add visionResponseFor if it exists
      if (visionResponseFor) {
        metadata.visionResponseFor = visionResponseFor;
        console.log(`Including visionResponseFor in metadata: ${visionResponseFor}`);
      }
      
      // Debug - log the full metadata we're about to save
      console.log(`Saving message with metadata: userId=${metadata.userId}, role=${metadata.role}, source=${metadata.source}`);
      console.log(`Full metadata to Qdrant:`, JSON.stringify(metadata).substring(0, 200) + '...');
      
      const addMemoryPromise = serverQdrant.addMemory('message', content, metadata);
      
      // Race the promises to handle timeouts
      const messageId = await Promise.race([addMemoryPromise, timeoutPromise]);
      console.log(`Saved ${role} message to Qdrant for user ${safeUserId}, ID: ${messageId}`);
      qdrantSuccess = true;
    } catch (error) {
      // Log the error but continue - this is non-critical
      console.error('Error saving message to Qdrant:', error instanceof Error ? error.message : String(error));
      console.error('Full error details:', error);
      
      // Continue with in-memory storage only
      console.log(`Falling back to in-memory storage only for user ${userId}`);
    }
    
    // After saving, verify the message count to ensure it's consistent
    try {
      if (qdrantSuccess) {
        const recentMessages = await serverQdrant.getRecentMemories('message', 100);
        const userMessages = recentMessages.filter(m => m.metadata && m.metadata.userId === userId);
        console.log(`Verification: Found ${userMessages.length} messages for user ${userId} in Qdrant`);
        
        // Check if the last message has attachments
        const lastMessage = userMessages[userMessages.length - 1];
        if (lastMessage && lastMessage.metadata && lastMessage.metadata.attachments) {
          console.log(`Last message has ${lastMessage.metadata.attachments.length} attachments`);
          if (lastMessage.metadata.attachments.length > 0) {
            console.log(`Attachment sample:`, JSON.stringify(lastMessage.metadata.attachments[0]).substring(0, 200) + '...');
          }
        } else {
          console.log('Last message has no attachments');
        }
      }
    } catch (verifyError) {
      console.warn('Error verifying message count:', verifyError);
    }
  }
  
  return {
    ...message,
    visionResponseFor
  };
}

// Get chat history for a user
function getUserHistory(userId: string) {
  // Get history from in-memory cache
  const history = chatHistory.get(userId) || [];
  
  // Only return messages that are meant for the chat interface
  return history;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, userId = 'gab', attachments, visionResponseFor } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }
    
    console.log(`Processing request from ${userId}: "${message}"`);
    
    // Check if this is a vision response
    if (visionResponseFor) {
      console.log(`This is a vision response for message with timestamp: ${visionResponseFor}`);
    }
    
    // Save user message to history - use await since we modified to be async
    const userMsg = await saveToHistory(userId, 'user', message, attachments, visionResponseFor);
    console.log(`User message saved to history with timestamp: ${userMsg?.timestamp}`);
    
    // Try to process with real agent, but ensure we have a valid response even if errors occur
    let reply, memory, thoughts;
    try {
      // Process the message with the real agent
      const response = await generateRealResponse(message);
      reply = response.reply;
      memory = response.memory;
      thoughts = response.thoughts;
    } catch (processingError) {
      console.error('Critical error processing message:', processingError);
      // Provide a friendly fallback response
      reply = "I apologize, but I encountered an issue while processing your request. Could you try asking in a different way?";
      memory = [];
      thoughts = [`Error processing message: ${processingError}`];
    }
    
    // Wait a moment before saving the assistant's response
    // This helps ensure the messages have different timestamps for proper ordering
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Save assistant response to history, including visionResponseFor if present
    const assistantMsg = await saveToHistory(
      userId, 
      'assistant', 
      reply, 
      undefined, 
      visionResponseFor
    );
    console.log(`Assistant message saved to history with timestamp: ${assistantMsg?.timestamp}`);
    
    // Verify the history after saving
    const updatedHistory = getUserHistory(userId);
    console.log(`After response, history has ${updatedHistory.length} messages for user ${userId}`);
    
    // Log thoughts for debugging
    if (thoughts && thoughts.length > 0) {
      console.log('Chloe thoughts:', thoughts);
    }
    
    return NextResponse.json({
      reply,
      memory,
      thoughts,
      timestamp: new Date().toISOString(),
      history: getUserHistory(userId)
    });
  } catch (error: any) {
    console.error('Error handling chat request:', error);
    // Always return a valid response even if an error occurs
    return NextResponse.json({
      reply: "I apologize, but I'm having trouble processing your request right now. Let's try a different approach.",
      memory: [],
      thoughts: [],
      timestamp: new Date().toISOString(),
      error: error.message || 'Failed to generate response'
    });
  }
}

// New endpoint to get chat history for a user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'gab';
    
    console.log(`Retrieving chat history for user: ${userId}`);
    
    // First check if we already have history for this user in memory
    // This avoids unnecessary Qdrant calls which could fail
    const existingHistory = getUserHistory(userId);
    if (existingHistory.length > 0) {
      console.log(`Found ${existingHistory.length} messages in memory for user ${userId}`);
      return NextResponse.json({
        history: existingHistory
      });
    }
    
    // If not in memory, try to load from Qdrant
    const success = await loadChatHistoryFromQdrant(userId);
    if (success) {
      console.log(`Loaded ${chatHistory.get(userId)?.length || 0} messages from Qdrant for user ${userId}`);
      return NextResponse.json({
        history: getUserHistory(userId)
      });
    } else {
      console.log(`Failed to load chat history from Qdrant for user ${userId}`);
      return NextResponse.json({
        history: []
      });
    }
  } catch (error: any) {
    console.error('Error retrieving chat history:', error);
    return NextResponse.json({
      history: [],
      error: error.message || 'Failed to retrieve chat history'
    });
  }
}
