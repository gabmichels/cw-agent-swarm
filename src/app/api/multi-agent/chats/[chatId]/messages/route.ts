import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../../server/memory/services';
import { MemoryType, ImportanceLevel } from '../../../../../../server/memory/config';
import { MessageRole } from '../../../../../../agents/shared/types/MessageTypes';
import { createUserId, createAgentId, createChatId } from '../../../../../../types/structured-id';
import { addMessageMemory } from '../../../../../../server/memory/services/memory/memory-service-wrappers';
import { getOrCreateThreadInfo, createResponseThreadInfo } from '../../../../chat/thread/helper';
import { AgentService } from '../../../../../../services/AgentService';
import { getChatService } from '../../../../../../server/memory/services/chat-service';
import { MessageMetadata } from '../../../../../../types/metadata';
import { ThinkingService } from '@/services/thinking';
import { toolRegistry } from '@/services/thinking/tools';
import { ThinkingVisualizer, VisualizationNodeType } from '../../../../../../services/thinking/visualization';
import { UnifiedAgentResponse } from '@/services/thinking/UnifiedAgentService';
import { AgentProfile } from '@/lib/multi-agent/types/agent';

// Define interface for message attachments
interface MessageAttachment {
  filename: string;
  type: string;
  size?: number;
  mimeType?: string;
  fileId?: string;
  preview?: string;
  has_full_preview?: boolean;
}

// Define interface for message processing options
interface MessageProcessingOptions {
  attachments?: MessageAttachment[];
  userId?: string;
  userMessageId?: string;
  skipResponseMemoryStorage?: boolean;
  internal?: boolean;
}

// Define interface for agent response
interface AgentResponse {
  content: string;
  memories?: string[];
  thoughts?: string[];
  metadata?: Record<string, unknown>;
}

// Define interface for a processable agent
interface ProcessableAgent {
  id: string;
  name?: string;
  processMessage(message: string, options: MessageProcessingOptions): Promise<string | AgentResponse>;
}

// Define interface for an initializable agent
interface InitializableAgent extends ProcessableAgent {
  initialized: boolean;
  initialize(): Promise<void>;
}

// Track the last user message ID to maintain thread relationships
let lastUserMessageId: string | null = null;

// Cache the ThinkingService instance
const thinkingService = new ThinkingService();

// Create a singleton instance of ThinkingVisualizer
const thinkingVisualizer = new ThinkingVisualizer();

// Initialize the tool registry (make sure executors are registered)
console.log('Initializing tool registry with default executors...');
// The registry is already initialized with default executors in its constructor

/**
 * GET /api/multi-agent/chats/[chatId]/messages
 * Returns all messages for a chat, or an empty array if none exist
 */
export async function GET(
  request: NextRequest,
  context: { params: { chatId: string } }
) {
  const params = await context.params;
  const chatId = params.chatId;

  try {
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeInternal = searchParams.get('includeInternal') === 'true';
    
    // First verify the chat exists
    const chatService = await getChatService();
    const chat = await chatService.getChatById(chatId);
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    // Get memory services
    const { searchService } = await getMemoryServices();
    
    console.log(`Searching for messages with chatId: ${chatId}`);
    
    // Search for messages with this chat ID
    const searchResults = await searchService.search("", {
      filter: {
        must: [
          { key: "type", match: { value: MemoryType.MESSAGE } },
          { key: "metadata.chatId.id", match: { value: chatId } }
        ],
        must_not: includeInternal ? [] : [
          { key: "metadata.isInternalMessage", match: { value: true } }
        ]
      },
      limit,
      offset,
      sort: { field: "timestamp", direction: "asc" }
    });

    console.log(`Found ${searchResults.length} messages in search results`);
    if (searchResults.length > 0) {
      console.log('First message metadata:', searchResults[0].point.payload.metadata);
    }
    
    // Format the messages
    const messages = searchResults.map(result => {
      const point = result.point;
      const payload = point.payload;
      // Properly type the metadata
      const metadata = (payload.metadata || {}) as MessageMetadata;
      
      // Log the raw data from Qdrant
      console.log('-------------------------');
      console.log('MULTI-AGENT RAW QDRANT MESSAGE DATA:');
      console.log('Point ID:', point.id);
      console.log('Raw payload:', JSON.stringify(payload, null, 2));
      console.log('Raw timestamp:', payload.timestamp);
      console.log('Timestamp type:', typeof payload.timestamp);
      
      // Fix timestamp parsing for numeric strings
      let parsedTimestamp: number | null = null;
      try {
        if (typeof payload.timestamp === 'number') {
          parsedTimestamp = payload.timestamp;
        } else if (typeof payload.timestamp === 'string' && /^\d+$/.test(payload.timestamp)) {
          parsedTimestamp = parseInt(payload.timestamp, 10);
        }
        
        console.log('Parsed timestamp:', parsedTimestamp);
        console.log('Timestamp as date:', parsedTimestamp ? new Date(parsedTimestamp).toISOString() : 'Invalid timestamp');
      } catch (err) {
        console.error('Error parsing timestamp:', err);
      }
      console.log('-------------------------');
      
      // Return message with correctly parsed timestamp
      return {
        id: point.id,
        content: payload.text,
        sender: {
          id: metadata.role === 'user' ? metadata.userId.id : metadata.agentId.id,
          name: metadata.role === 'user' ? 'You' : metadata.agentId.id,
          role: metadata.role
        },
        // Convert numeric string timestamps to numbers for the client
        timestamp: typeof payload.timestamp === 'string' && /^\d+$/.test(payload.timestamp) 
          ? parseInt(payload.timestamp, 10) 
          : payload.timestamp,
        status: 'delivered',
        attachments: metadata.attachments || []
      };
    });
    
    return NextResponse.json({
      chatId,
      messages,
      totalCount: messages.length,
      hasMore: messages.length === limit
    });
  } catch (error) {
    console.error(`Error retrieving messages for chat ${params.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { content, metadata } = await request.json();
    const { userId, agentId, attachments = [], thinking = false } = metadata;
    const dynamicParams = await params;
    const chatId = dynamicParams.chatId;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Initialize memory services
    const { memoryService, client } = await getMemoryServices();
    
    // Ensure memory services are initialized
    const status = await client.getStatus();
    if (!status.initialized) {
      console.log('Initializing memory services before saving message');
      await client.initialize();
    }
    
    // Get or create a chat session for this conversation
    let chatSession: any = null;
    try {
      const chatService = await getChatService();
      // Try to get an existing chat first
      try {
        chatSession = await chatService.getChatById(chatId);
        console.log(`Found existing chat session: ${chatId}`);
      } catch (notFoundError) {
        // If not found, create a new chat
        console.log(`Creating new chat session: ${chatId}`);
        // Get agent info for title
        let agentName = 'Assistant';
        try {
          const agent = await AgentService.getAgent(agentId);
          if (agent) {
            agentName = agent.name || 'Assistant';
          }
        } catch (agentError) {
          console.warn('Error getting agent info:', agentError);
        }
        
        chatSession = await chatService.createChat(userId, agentId, {
          title: `Chat with ${agentName}`,
          description: `Conversation between user ${userId} and agent ${agentName}`
        });
      }
    } catch (chatError) {
      console.error('Error creating chat session:', chatError);
      // Continue without a chat session - the conversation will still work
      // Get agent info for title
      let agentName = 'Assistant';
      try {
        const agent = await AgentService.getAgent(agentId);
        if (agent) {
          agentName = agent.name || 'Assistant';
        }
      } catch (agentError) {
        console.warn('Error getting agent info:', agentError);
      }
      
      chatSession = {
        id: chatId,
        type: 'direct',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
        participants: [
          { id: userId, type: 'user', joinedAt: new Date().toISOString() },
          { id: agentId, type: 'agent', joinedAt: new Date().toISOString() }
        ],
        metadata: {
          title: `Chat with ${agentName}`,
          description: `Conversation between user ${userId} and agent ${agentName}`
        }
      };
    }
    
    // Create structured IDs
    const userStructuredId = createUserId(userId);
    const agentStructuredId = createAgentId(agentId);
    const chatStructuredId = createChatId(chatId);

    // Process any attachments
    let processedAttachments = attachments;
    if (attachments && attachments.length > 0) {
      console.log(`Message has ${attachments.length} attachments`);
      
      // For each attachment, ensure preview URLs aren't too long
      processedAttachments = attachments.map((attachment: MessageAttachment) => {
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

    // Create thread info for user message
    const userThreadInfo = getOrCreateThreadInfo(chatId, 'user');
    console.log(`Created user message with thread ID: ${userThreadInfo.id}, position: ${userThreadInfo.position}`);
    
    // Save user message to memory
    const userMemoryResult = await addMessageMemory(
      memoryService,
      content,
      MessageRole.USER,
      userStructuredId,
      agentStructuredId,
      chatStructuredId,
      userThreadInfo,
      {
        attachments: processedAttachments,
        messageType: 'user_message',
        metadata: {
          chatId: chatStructuredId // Ensure chatId is properly set
        }
      }
    );

    // Store user message ID for assistant response
    if (userMemoryResult && userMemoryResult.id) {
      lastUserMessageId = userMemoryResult.id;
      console.log(`Saved user message to memory with ID: ${lastUserMessageId}`);
    }

    // Get the agent instance
    const agent = await AgentService.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Process message with agent
    let agentResponse: AgentResponse;
    try {
      // Create message processing options
      const processingOptions: MessageProcessingOptions = {
        attachments: processedAttachments,
        userId,
        userMessageId: lastUserMessageId || undefined,
        skipResponseMemoryStorage: true // We'll handle memory storage here
      };
      
      // Add thinking step if enabled
      let thoughts: string[] = [];
      
      // Run thinking process if enabled
      if (thinking) {
        try {
          console.log('Performing initial thinking analysis using ThinkingService...');
          
          // Initialize visualization
          const visualizationId = thinkingVisualizer.initializeVisualization(
            lastUserMessageId || 'unknown-msg', 
            userId,
            content
          );
          
          console.log(`Initialized thinking visualization with ID: ${visualizationId}`);
          
          // Get agent information for persona
          let agentInfo;
          let agentSystemPrompt;
          try {
            if (agent) {
              // Extract agent properties for proper type handling
              const agentName = agent.name || 'Assistant';
              const agentDescription = agent.description || 'A helpful AI assistant';
              
              // Extract system prompt if available from parameters
              agentSystemPrompt = (agent.parameters as { systemPrompt?: string })?.systemPrompt;
              
              // Add visualization data node for agent info
              const agentInfoNodeId = thinkingVisualizer.addNode(
                lastUserMessageId || 'unknown-msg',
                VisualizationNodeType.THINKING,
                'Agent Information',
                {
                  agentName,
                  agentDescription,
                  hasSystemPrompt: !!agentSystemPrompt,
                  chatId
                }
              );
              
              agentInfo = {
                name: agentName,
                description: agentDescription,
                systemPrompt: agentSystemPrompt
              };
            }
          } catch (agentInfoError) {
            console.warn('Error getting agent info for persona:', agentInfoError);
            
            // Add error node to visualization
            thinkingVisualizer.handleError(
              lastUserMessageId || 'unknown-msg',
              new Error(`Failed to get agent info: ${agentInfoError}`)
            );
          }
          
          // Use our thinking service for advanced thinking analysis
          const thinkingResult = await thinkingService.processRequest(
            userId,
            content,
            {
              debug: true,
              agentInfo
            }
          );
          
          // Complete thinking visualization with proper UnifiedAgentResponse structure
          thinkingVisualizer.finalizeVisualization(
            lastUserMessageId || 'unknown-msg',
            {
              id: lastUserMessageId || 'unknown-msg',
              response: thinkingResult.reasoning?.[0] || 'No response generated',
              thinking: thinkingResult,
              metrics: {
                totalTime: 0,
                thinkingTime: 0,
                retrievalTime: 0,
                toolExecutionTime: 0,
                llmTime: 0
              }
            }
          );
          
          // Extract reasoning for context thoughts
          if (thinkingResult && thinkingResult.reasoning.length > 0) {
            thoughts = thinkingResult.reasoning;
            
            // Log detailed analysis info
            console.log('ThinkingService analysis completed:');
            console.log(`- Intent: ${thinkingResult.intent.primary} (confidence: ${thinkingResult.intent.confidence})`);
            console.log(`- Entities detected: ${thinkingResult.entities.length}`);
            console.log(`- Delegation decision: ${thinkingResult.shouldDelegate ? 'Should delegate' : 'Handle directly'}`);
            
            // Include the thinking insights in the debug info but not in thoughts directly
            // to avoid overwhelming the context
            if (thinkingResult.planSteps && thinkingResult.planSteps.length > 0) {
              console.log(`- Execution plan: ${thinkingResult.planSteps.join(' → ')}`);
            }
          }
        } catch (thinkingError) {
          console.warn('Error during ThinkingService analysis:', thinkingError);
          thoughts = [`Error in thinking: ${thinkingError instanceof Error ? thinkingError.message : String(thinkingError)}`];
        }
      }
      
      // Prepare enhanced processing options with thinking results
      const enhancedOptions: MessageProcessingOptions & Record<string, any> = {
        ...processingOptions,
        // Include thinking results if available
        contextThoughts: thoughts.length > 0 ? thoughts : undefined,
        // Pass agent persona information as additional context
        persona: {
          systemPrompt: agent.parameters?.systemPrompt || '',
          name: agent.name || 'Assistant',
          description: agent.description || 'A helpful AI assistant',
          traits: agent.metadata?.traits || []
        }
      };

      // Process message with proper timeout handling
      const processingPromise = AgentService.processMessage(agentId, content, enhancedOptions);
      
      // Set a reasonable timeout (30 seconds instead of 60)
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          clearTimeout(timeoutId); // Clean up the timeout
          reject(new Error('Request timed out after 30 seconds'));
        }, 30000);
      });
      
      // Use Promise.race with proper error handling
      try {
        console.log(`Processing message with agent ${agentId} via AgentService (with 30s timeout)`);
        const result = await Promise.race([processingPromise, timeoutPromise]);
        
        // Parse response based on its structure
        if (typeof result === 'string') {
          agentResponse = { content: result };
        } else if (result && typeof result === 'object') {
          if ('response' in result && result.response) {
            // Handle response wrapped in a container object
            const response = result.response;
            agentResponse = typeof response === 'string' 
              ? { content: response } 
              : response as AgentResponse;
          } else if ('content' in result) {
            // Handle direct response object
            agentResponse = result as AgentResponse;
          } else {
            // Fallback for unexpected response structure
            agentResponse = {
              content: "The agent returned an unexpected response format.",
              thoughts: ["Response format error: " + JSON.stringify(result).substring(0, 100)]
            };
          }
        } else {
          // Fallback for null or undefined response
          agentResponse = {
            content: "The agent did not produce a response.",
            thoughts: ["No response received from agent."]
          };
        }
      } catch (raceError: unknown) {
        // Handle timeout and other race-related errors
        console.error('Error in Promise.race:', raceError);
        if (typeof raceError === 'object' && 
            raceError !== null && 
            'message' in raceError && 
            typeof raceError.message === 'string' && 
            raceError.message.includes('timed out')) {
          agentResponse = {
            content: "I'm sorry, but it's taking me longer than expected to process your request. Please try again with a simpler query.",
            thoughts: [`Timeout error: ${String(raceError.message)}`]
          };
        } else {
          throw raceError; // Re-throw unexpected errors
        }
      }

      // Add thinking results to agent response
      if (thoughts.length > 0) {
        agentResponse.thoughts = [...(agentResponse.thoughts || []), ...thoughts];
      }
    } catch (agentError) {
      console.error('Error from agent process:', agentError);
      // Provide a fallback response
      agentResponse = {
        content: "I'm experiencing some technical difficulties at the moment. Please try again later.",
        thoughts: [`Error: ${agentError instanceof Error ? agentError.message : String(agentError)}`]
      };
    }

    // Extract response components
    const responseContent = agentResponse.content || "I couldn't generate a response.";
    const thoughts = agentResponse.thoughts || [];
    const memories = agentResponse.memories || [];

    // Create thread info for the assistant response
    let assistantThreadInfo;
    if (lastUserMessageId) {
      assistantThreadInfo = await createResponseThreadInfo(lastUserMessageId);
    } else {
      assistantThreadInfo = getOrCreateThreadInfo(chatId, 'assistant');
    }

    if (assistantThreadInfo) {
      console.log(`Created assistant response with thread ID: ${assistantThreadInfo.id}, position: ${assistantThreadInfo.position}, parentId: ${assistantThreadInfo.parentId || 'none'}`);
    }

    // Save assistant response to memory
    await addMessageMemory(
      memoryService,
      responseContent,
      MessageRole.ASSISTANT,
      userStructuredId,
      agentStructuredId,
      chatStructuredId,
      assistantThreadInfo,
      {
        messageType: 'assistant_response',
        metadata: {
          chatId: chatStructuredId, // Ensure chatId is properly set
          tags: ['agent_response'],
          category: 'response',
          conversationContext: {
            purpose: 'user_query_response',
            sharedContext: {
              thoughts,
              memories
            }
          }
        }
      }
    );

    // Return the response with all metadata
    return NextResponse.json({
      success: true,
      message: {
        content: responseContent,
        timestamp: new Date().toISOString(),
        metadata: {
          agentId,
          agentName: agent.name || 'Assistant',
          userId,
          threadId: assistantThreadInfo.id,
          parentMessageId: lastUserMessageId,
          thoughts,
          memories
        }
      }
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error processing message'
      },
      { status: 500 }
    );
  }
} 