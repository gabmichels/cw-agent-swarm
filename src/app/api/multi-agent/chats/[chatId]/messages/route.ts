import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../../server/memory/services';
import { MemoryType, ImportanceLevel } from '../../../../../../server/memory/config';
import { MessageRole } from '../../../../../../agents/shared/types/MessageTypes';
import { createUserId, createAgentId, createChatId } from '../../../../../../types/structured-id';
import { addMessageMemory } from '../../../../../../server/memory/services/memory/memory-service-wrappers';
import { getOrCreateThreadInfo, createResponseThreadInfo } from '../../../../chat/thread/helper';
import { AgentService } from '../../../../../../services/AgentService';
import { getChatService } from '../../../../../../server/memory/services/chat-service';

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
    // TODO: Replace with real message fetching logic
    // For now, always return an empty array for new chats
    // In production, fetch messages from your DB or memory service
    return NextResponse.json({ messages: [] });
  } catch (error) {
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { content, metadata } = await request.json();
    const { userId, agentId, attachments = [] } = metadata;
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
        messageType: 'user_message'
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
      
      // Process message with proper timeout handling
      const processingPromise = AgentService.processMessage(agentId, content, processingOptions);
      
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
          // Use standard fields for custom data
          tags: ['agent_response'],
          category: 'response',
          // Store agent thoughts and memories as part of the conversation context
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