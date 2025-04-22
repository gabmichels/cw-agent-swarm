import { NextResponse } from 'next/server';

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
function saveToHistory(userId: string, role: 'user' | 'assistant', content: string) {
  if (!chatHistory.has(userId)) {
    chatHistory.set(userId, []);
  }
  
  const userHistory = chatHistory.get(userId)!;
  userHistory.push({
    role,
    content,
    timestamp: new Date().toISOString()
  });
  
  // Limit history size (optional)
  if (userHistory.length > 100) {
    userHistory.shift(); // Remove oldest message if too many
  }
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
    
    // Save user message to history
    saveToHistory(userId, 'user', message);
    
    // Process the message with the real agent
    const { reply, memory, thoughts } = await generateRealResponse(message);
    
    // Log thoughts for debugging
    if (thoughts && thoughts.length > 0) {
      console.log('Chloe thoughts:', thoughts);
    }
    
    // Save assistant response to history
    saveToHistory(userId, 'assistant', reply);
    
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
    
    const history = getUserHistory(userId);
    
    // If no history exists, create a welcome message
    if (history.length === 0) {
      const welcomeMessage = {
        role: 'assistant',
        content: "Hello! I'm Chloe, your AI assistant. I'm here to help you with marketing and other tasks. How can I assist you today?",
        timestamp: new Date().toISOString()
      };
      
      // Save to history
      saveToHistory(userId, 'assistant', welcomeMessage.content);
      
      return NextResponse.json({
        history: [welcomeMessage]
      });
    }
    
    return NextResponse.json({
      history: history
    });
  } catch (error: any) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
} 