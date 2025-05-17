import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../../server/memory/services';
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

// Track the last user message ID to maintain thread relationships
let lastUserMessageId: string | null = null;

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    // Properly await params to get chatId
    const { chatId } = params;
    
    // Parse form data
    const formData = await request.formData();
    const message = formData.get('message') as string || '';
    const userId = formData.get('userId') as string || '';
    const agentId = formData.get('agentId') as string || '';
    
    // Process file attachments
    const attachments: MessageAttachment[] = [];
    const fileEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith('file_'));
    
    for (let i = 0; i < fileEntries.length; i++) {
      const fileKey = `file_${i}`;
      const typeKey = `metadata_${i}_type`;
      const fileIdKey = `metadata_${i}_fileId`;
      
      const file = formData.get(fileKey) as File;
      const type = formData.get(typeKey) as string || 'other';
      const fileId = formData.get(fileIdKey) as string || '';
      
      if (file) {
        // Process file attachment
        const attachment: MessageAttachment = {
          filename: file.name,
          type,
          size: file.size,
          mimeType: file.type,
          fileId
        };
        
        // For image files, we could optionally process them further
        if (file.type.startsWith('image/')) {
          // Read file as buffer for processing if needed
          const buffer = await file.arrayBuffer();
          // Store additional image data if needed
          // You might want to save the image to a storage service here
        }
        
        attachments.push(attachment);
      }
    }
    
    console.log(`Processed ${attachments.length} file attachments`);

    // Initialize memory services
    const { memoryService, client } = await getMemoryServices();
    
    // Ensure memory services are initialized
    const status = await client.getStatus();
    if (!status.initialized) {
      console.log('Initializing memory services before saving message');
      await client.initialize();
    }
    
    // Get or create a chat session
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
      // Continue with a minimal fallback session
      chatSession = {
        id: chatId,
        type: 'direct',
        status: 'active'
      };
    }
    
    // Create structured IDs
    const userStructuredId = createUserId(userId);
    const agentStructuredId = createAgentId(agentId);
    const chatStructuredId = createChatId(chatId);

    // Create thread info for user message
    const userThreadInfo = getOrCreateThreadInfo(chatId, 'user');
    console.log(`Created user message with thread ID: ${userThreadInfo.id}, position: ${userThreadInfo.position}`);
    
    // Define message content - include description of files
    const fileDescriptions = attachments.map(a => `- ${a.filename} (${a.type})`).join('\n');
    const messageContent = message ? 
      `${message}\n\n[Attached files:\n${fileDescriptions}]` : 
      `[Shared files without additional context:\n${fileDescriptions}]`;
    
    // Save user message to memory
    const userMemoryResult = await addMessageMemory(
      memoryService,
      messageContent,
      MessageRole.USER,
      userStructuredId,
      agentStructuredId,
      chatStructuredId,
      userThreadInfo,
      {
        attachments,
        messageType: 'user_message_with_files'
      }
    );

    // Store user message ID for assistant response
    if (userMemoryResult && userMemoryResult.id) {
      lastUserMessageId = userMemoryResult.id;
      console.log(`Saved user message with files to memory with ID: ${lastUserMessageId}`);
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
        attachments,
        userId,
        userMessageId: lastUserMessageId || undefined,
        skipResponseMemoryStorage: true // We'll handle memory storage here
      };
      
      // Process message with proper timeout handling
      const processingPromise = AgentService.processMessage(agentId, messageContent, processingOptions);
      
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
            content: "The agent could not process the files you shared.",
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
            content: "I'm sorry, but it's taking me longer than expected to process your files. Please try again with smaller files or fewer attachments.",
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
        content: "I'm experiencing some technical difficulties processing your files at the moment. Please try again later.",
        thoughts: [`Error: ${agentError instanceof Error ? agentError.message : String(agentError)}`]
      };
    }

    // Extract response components
    const responseContent = agentResponse.content || "I couldn't process the files you shared.";
    const thoughts = agentResponse.thoughts || [];
    const memories = agentResponse.memories || [];

    // Create thread info for assistant response
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
        messageType: 'assistant_response_to_file',
        metadata: {
          // Use standard fields for custom data
          tags: ['file_response', ...attachments.map(a => a.type)],
          category: 'file_response',
          // Store file information in the conversation context
          conversationContext: {
            purpose: 'file_analysis',
            sharedContext: {
              processedFiles: attachments.map(a => a.filename),
              fileTypes: attachments.map(a => a.type),
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
          memories,
          messageType: 'assistant_response_to_file',
          processedFiles: attachments.map(a => a.filename)
        }
      }
    });

  } catch (error) {
    console.error('Error processing files:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 