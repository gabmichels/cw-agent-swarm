import { NextResponse } from 'next/server';
import * as serverQdrant from '../../../server/qdrant';
import { MemoryRecord } from '../../../server/qdrant';

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
    const fetchPromise = serverQdrant.getRecentMemories('message', 1000);
    const recentMessages = await Promise.race([fetchPromise, timeoutPromise]);
    console.log(`Retrieved ${recentMessages.length} total messages from Qdrant`);
    
    // Log IDs to help debug
    console.log('Message IDs:', recentMessages.map(m => m.id).join(', '));
    
    // Clear existing history if loading for a specific user
    if (specificUserId) {
      chatHistory.delete(specificUserId);
    }
    
    // Group messages by userId
    const userCounts: Record<string, number> = {};
    
    for (const message of recentMessages) {
      if (message.metadata && message.metadata.userId) {
        const userId = message.metadata.userId;
        
        // Track message count per user
        userCounts[userId] = (userCounts[userId] || 0) + 1;
        
        // Skip if we're loading for a specific user and this message isn't for that user
        if (specificUserId && userId !== specificUserId) {
          continue;
        }
        
        const role = message.metadata.role || 'user';
        
        if (!chatHistory.has(userId)) {
          chatHistory.set(userId, []);
        }
        
        chatHistory.get(userId)!.push({
          role,
          content: message.text,
          timestamp: message.timestamp
        });
      } else {
        console.log(`Message missing userId metadata: ${message.id}`);
      }
    }
    
    // Log user counts
    Object.entries(userCounts).forEach(([userId, count]) => {
      console.log(`Found ${count} messages for user ${userId}`);
    });
    
    // Sort messages for each user by timestamp
    const usersToSort = specificUserId ? [specificUserId] : Array.from(chatHistory.keys());
    
    usersToSort.forEach(userId => {
      if (!chatHistory.has(userId)) return;
      
      const messages = chatHistory.get(userId) || [];
      console.log(`Sorting ${messages.length} messages for user ${userId}`);
      
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
const chatHistory: Map<string, Array<{ role: string; content: string; timestamp: string }>> = new Map();

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

    // TEMPORARY: Open the floodgates to see all logs
    // Add timestamp to all logs to make them visible 
    const timestamp = new Date().toISOString();
    thoughts.push(`[${timestamp.split('T')[1].split('.')[0]}] DEBUG LOG: ${logStr}`);
    
    /* Original filtering logic - temporarily disabled to see all logs
    // Capture specific patterns that might be thoughts
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
    */
  };
  
  // Return functions to get captured thoughts and restore console
  return {
    getThoughts: () => thoughts,
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
        
        // Use fallback response on processing error
        result = {
          reply: `Error processing your message: ${processError instanceof Error ? processError.message : 'Unknown error'}. Please try again.`,
          memory: [],
          thoughts: []
        };
      }
    } else {
      // Fallback to simulated response with more detailed error info
      console.log('Using simulated response (real agent not available)');
      result = {
        reply: `💻 [SIMULATED RESPONSE @ ${new Date().toISOString()}]

Your message: "${message}"

The real Chloe agent couldn't be loaded. Check server logs for details.
To fix this issue, make sure:
1. Chloe agent code is properly integrated
2. Environment variables for OpenRouter/APIs are configured
3. Required dependencies are installed

See server logs for specific error messages.`,
        memory: [],
        thoughts: []
      };
    }
    
    // Restore original console.log
    thoughtCapture.restore();
    
    return result;
  } catch (error) {
    console.error('Error generating real response:', error);
    return {
      reply: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      memory: [],
      thoughts: []
    };
  }
}

// Save a message to chat history
async function saveToHistory(userId: string, role: 'user' | 'assistant', content: string) {
  // Ensure we have a user ID
  if (!userId) {
    userId = 'default-user';
  }
  
  // Create a timestamp
  const timestamp = new Date().toISOString();
  
  // Initialize chat history for this user if it doesn't exist
  if (!chatHistory.has(userId)) {
    chatHistory.set(userId, []);
  }
  
  // First add message to in-memory history (this is guaranteed to work)
  const message = {
    role,
    content,
    timestamp
  };
  
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
      const addMemoryPromise = serverQdrant.addMemory('message', content, {
        userId,
        role,
        source: role === 'user' ? 'user' : 'chloe'
      });
      
      // Race the promises to handle timeouts
      const messageId = await Promise.race([addMemoryPromise, timeoutPromise]);
      console.log(`Saved ${role} message to Qdrant for user ${userId}, ID: ${messageId}`);
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
        const userMessages = recentMessages.filter(m => m.metadata.userId === userId);
        console.log(`Verification: Found ${userMessages.length} messages for user ${userId} in Qdrant`);
      }
    } catch (verifyError) {
      console.warn('Error verifying message count:', verifyError);
    }
  }
  
  return message;
}

// Get chat history for a user
function getUserHistory(userId: string) {
  return chatHistory.get(userId) || [];
}

export async function POST(request: Request) {
  try {
    const { message, userId = 'default-user' } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }
    
    console.log(`Processing request from ${userId}: "${message}"`);
    
    // Save user message to history - use await since we modified to be async
    const userMsg = await saveToHistory(userId, 'user', message);
    console.log(`User message saved to history with timestamp: ${userMsg.timestamp}`);
    
    // Process the message with the real agent
    const { reply, memory, thoughts } = await generateRealResponse(message);
    
    // Wait a moment before saving the assistant's response
    // This helps ensure the messages have different timestamps for proper ordering
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Save assistant response to history - use await since we modified to be async
    const assistantMsg = await saveToHistory(userId, 'assistant', reply);
    console.log(`Assistant message saved to history with timestamp: ${assistantMsg.timestamp}`);
    
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
    return NextResponse.json(
      { error: error.message || 'Failed to generate response' },
      { status: 500 }
    );
  }
}

// New endpoint to get chat history for a user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user';
    
    console.log(`Retrieving chat history for user: ${userId}`);
    
    // First check if we already have history for this user in memory
    // This avoids unnecessary Qdrant calls which could fail
    const existingHistory = getUserHistory(userId);
    if (existingHistory.length > 0) {
      console.log(`Found ${existingHistory.length} existing messages in memory for user ${userId}`);
    }
    
    // Force reload from Qdrant for this specific user
    let qdrantSuccess = false;
    let retryCount = 0;
    
    while (!qdrantSuccess && retryCount < 2) {
      try {
        // Set a timeout for the entire operation
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Qdrant history load timeout')), 10000); // 10 second timeout
        });
        
        const loadPromise = loadChatHistoryFromQdrant(userId);
        await Promise.race([loadPromise, timeoutPromise]);
        console.log(`Refreshed chat history from Qdrant for user request: ${userId}`);
        qdrantSuccess = true;
      } catch (loadError) {
        retryCount++;
        console.error(`Error refreshing chat history from Qdrant (attempt ${retryCount}/2):`, 
          loadError instanceof Error ? loadError.message : String(loadError));
        
        if (retryCount < 2) {
          console.log(`Retrying Qdrant history load for user ${userId}...`);
          // Wait a moment before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Get the history after possibly refreshing from Qdrant
    const history = getUserHistory(userId);
    console.log(`Retrieved ${history.length} messages for user ${userId}${qdrantSuccess ? ' (from Qdrant)' : ' (from memory)'}`);
    
    // If we have history but it might be incomplete (missing the last message)
    if (qdrantSuccess && history.length > 0 && history.length < 3) {
      console.log(`Warning: Only ${history.length} messages found for user ${userId}, this may be incomplete`);
    }
    
    // If no history exists, create a welcome message
    if (history.length === 0) {
      const welcomeMessage = {
        role: 'assistant',
        content: "Hello! I'm Chloe, your AI assistant. I'm here to help you with marketing and other tasks. How can I assist you today?",
        timestamp: new Date().toISOString()
      };
      
      try {
        // Save to history - with special handling to avoid errors
        await saveToHistory(userId, 'assistant', welcomeMessage.content);
        console.log(`Created welcome message for new user: ${userId}`);
      } catch (saveError) {
        console.error('Error saving welcome message:', saveError);
        // Still return the welcome message even if saving fails
      }
      
      return NextResponse.json({
        history: [welcomeMessage]
      });
    }
    
    return NextResponse.json({
      history: history,
      source: qdrantSuccess ? 'qdrant' : 'memory',
      count: history.length
    });
  } catch (error: any) {
    console.error('Error fetching chat history:', error);
    // Return an empty history rather than an error to avoid breaking the UI
    return NextResponse.json({
      history: [],
      error: error.message || 'Failed to fetch chat history',
      errorDetails: error.stack
    }, {
      status: 200 // Still return 200 to avoid breaking the UI
    });
  }
} 