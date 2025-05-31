import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../../server/memory/services';
import { MemoryType } from '../../../../../../server/memory/config';
import { ImportanceLevel } from '../../../../../../constants/memory';
import { MessageRole } from '../../../../../../agents/shared/types/MessageTypes';
import { createUserId, createAgentId, createChatId } from '../../../../../../types/structured-id';
import { addMessageMemory } from '../../../../../../server/memory/services/memory/memory-service-wrappers';
import { getOrCreateThreadInfo, createResponseThreadInfo } from '../../../../chat/thread/helper';
import { AgentService } from '../../../../../../services/AgentService';
import { getChatService } from '../../../../../../server/memory/services/chat-service';
import { MessageMetadata } from '../../../../../../types/metadata';
import { extractTags } from '../../../../../../utils/tagExtractor';
import { MessageProcessingOptions, AgentResponse } from '../../../../../../agents/shared/base/AgentBase.interface';

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

// Track the last user message ID to maintain thread relationships
let lastUserMessageId: string | null = null;

/**
 * GET /api/multi-agent/chats/[chatId]/messages
 * Returns all messages for a chat, or an empty array if none exist
 * STRICTLY FILTERS TO ONLY MemoryType.MESSAGE ITEMS
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
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    
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
    console.log(`STRICT FILTER: Only MemoryType.MESSAGE (${MemoryType.MESSAGE}) will be returned`);
    
    // Build STRICT filter for search - ONLY MESSAGES
    const mustFilters = [
      { key: "type", match: { value: MemoryType.MESSAGE } }, // STRICT: Only 'message' type
      { key: "metadata.chatId.id", match: { value: chatId } }
    ];
    
    // Add tag filters if provided
    if (tags && tags.length > 0) {
      console.log(`Filtering by tags: ${tags.join(', ')}`);
      // For each tag, add a filter to match any message that contains that tag
      tags.forEach(tag => {
        mustFilters.push({ key: "metadata.tags", match: { value: tag } });
      });
    }
    
    console.log(`Search filters being applied:`, JSON.stringify(mustFilters, null, 2));
    
    // Search for messages with this chat ID
    console.log(`Searching for messages using filter-based approach...`);
    console.log(`Trying structured ID format first: metadata.chatId.id = ${chatId}`);
    
    let searchResults = await searchService.search("", {
      filter: {
        must: [
          { key: "type", match: { value: MemoryType.MESSAGE } }, // Filter for message type in results
          { key: "metadata.chatId.id", match: { value: chatId } }  // Structured ID format (new)
        ],
        must_not: includeInternal ? [] : [
          { key: "metadata.isInternalMessage", match: { value: true } }
        ]
      },
      limit,
      offset,
      sort: { field: "timestamp", direction: "asc" }
    });
    
    // If no results with structured ID format, try legacy string format
    if (searchResults.length === 0) {
      console.log(`No results with structured ID format, trying legacy string format: metadata.chatId = ${chatId}`);
      searchResults = await searchService.search("", {
        filter: {
          must: [
            { key: "type", match: { value: MemoryType.MESSAGE } },
            { key: "metadata.chatId", match: { value: chatId } }      // Simple string format (legacy)
          ],
          must_not: includeInternal ? [] : [
            { key: "metadata.isInternalMessage", match: { value: true } }
          ]
        },
        limit,
        offset,
        sort: { field: "timestamp", direction: "asc" }
      });
      
      if (searchResults.length > 0) {
        console.log(`Found ${searchResults.length} results with legacy string format`);
      }
    } else {
      console.log(`Found ${searchResults.length} results with structured ID format`);
    }

    console.log(`Found ${searchResults.length} total items, filtering to message types only...`);
    
    // Filter to only message types (client-side validation)
    const messageResults = searchResults.filter(result => {
      const payloadType = result.point?.payload?.type;
      const metadataType = (result.point?.payload?.metadata as any)?.type;
      const actualType = payloadType || metadataType;
      return actualType === MemoryType.MESSAGE;
    });
    
    console.log(`✅ Filtered to ${messageResults.length} message items (removed ${searchResults.length - messageResults.length} non-message items)`);
    
    const nonMessageResults = searchResults.filter(result => {
      const payloadType = result.point?.payload?.type;
      const metadataType = (result.point?.payload?.metadata as any)?.type;
      const actualType = payloadType || metadataType;
      return actualType !== MemoryType.MESSAGE;
    });
    
    const validatedResults = messageResults; // Use filtered message results

    // Format the messages with additional type checking
    const messages = validatedResults.map(result => {
      const point = result.point;
      const payload = point.payload;
      // Properly type the metadata
      const metadata = (payload.metadata || {}) as MessageMetadata;
      
      // Verify this is a message type (should always be true now with type restriction)
      const contentType = payload.type || (metadata as any).type;
      if (contentType !== MemoryType.MESSAGE) {
        console.error(`UNEXPECTED: Non-message item in results:`, {
          id: point.id,
          type: contentType,
          expected: MemoryType.MESSAGE
        });
      }
      
      // Fix timestamp parsing for numeric strings
      let parsedTimestamp: number | null = null;
      try {
        if (typeof payload.timestamp === 'number') {
          parsedTimestamp = payload.timestamp;
        } else if (typeof payload.timestamp === 'string' && /^\d+$/.test(payload.timestamp)) {
          parsedTimestamp = parseInt(payload.timestamp, 10);
        }
        
      } catch (err) {
        console.error('Error parsing timestamp:', err);
      }
      
      // Return message with correctly parsed timestamp and tags
      return {
        id: point.id,
        content: payload.text,
        sender: {
          id: metadata.role === 'user' ? metadata.userId?.id || 'unknown' : metadata.agentId?.id || 'unknown',
          name: metadata.role === 'user' ? 'You' : metadata.agentId?.id || 'Assistant',
          role: metadata.role || 'assistant'
        },
        // Convert numeric string timestamps to numbers for the client
        timestamp: typeof payload.timestamp === 'string' && /^\d+$/.test(payload.timestamp) 
          ? parseInt(payload.timestamp, 10) 
          : payload.timestamp,
        status: 'delivered',
        attachments: metadata.attachments || [],
        tags: metadata.tags || [], // Include tags in the response
        
        // DEBUG: Include type information for troubleshooting
        _debug: {
          originalType: contentType,
          memoryId: point.id,
          collection: 'messages' // Should always be messages now
        }
      };
    });
    
    console.log(`Final response: ${messages.length} messages prepared for client`);
    
    // Log sample content for debugging (first message only)
    if (messages.length > 0) {
      const firstMessage = messages[0];
      console.log(`Sample message content:`, {
        id: firstMessage.id,
        contentPreview: firstMessage.content?.substring(0, 100),
        sender: firstMessage.sender,
        type: firstMessage._debug?.originalType
      });
    }
    
    return NextResponse.json({
      chatId,
      messages,
      totalCount: messages.length,
      hasMore: messages.length === limit,
      _meta: {
        searchResultsCount: searchResults.length,
        finalMessageCount: messages.length,
        typeFilter: MemoryType.MESSAGE,
        collectionSearched: 'all (filtered by type)',
        nonMessageItemsFound: nonMessageResults.length
      }
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
      // Create a minimal chat session for conversation continuity
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

    // Extract tags from user message
    let userMessageTags: string[] = [];
    try {
      const extractionResult = await extractTags(content, {
        maxTags: 8,
        minConfidence: 0.3
      });
      
      if (extractionResult.success && extractionResult.tags.length > 0) {
        userMessageTags = extractionResult.tags.map(tag => tag.text);
        console.log(`Extracted ${userMessageTags.length} tags from user message:`, userMessageTags);
      }
    } catch (extractionError) {
      console.warn('Error extracting tags from user message:', extractionError);
    }
    
    // Create thread info for user message
    const userThreadInfo = getOrCreateThreadInfo(chatId, 'user');
    console.log(`Created user message with thread ID: ${userThreadInfo.id}, position: ${userThreadInfo.position}`);
    
    // Save user message to memory with extracted tags
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
          chatId: chatStructuredId, 
          tags: userMessageTags // Add extracted tags
        }
      }
    );

    // Store user message ID for assistant response
    if (userMemoryResult && userMemoryResult.id) {
      lastUserMessageId = userMemoryResult.id;
      console.log(`Saved user message to memory with ID: ${lastUserMessageId}`);
    }

    // Get the agent instance
    const agentProfile = await AgentService.getAgent(agentId);
    if (!agentProfile) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    // Import AgentFactory to create a proper agent instance with processUserInput method
    const { AgentFactory } = await import('@/agents/shared/AgentFactory');
    const agent = await new AgentFactory().createAgent(agentProfile);
    
    if (!agent) {
      throw new Error(`Failed to create agent instance for ${agentId}`);
    }
    
    // Initialize the agent before using it
    console.log(`Initializing agent instance for ${agentId}`);
    const initSuccess = await agent.initialize();
    if (!initSuccess) {
      throw new Error(`Failed to initialize agent ${agentId}`);
    }
    console.log(`Agent initialization successful for ${agentId}`);

    // Process message with agent
    let agentResponse: AgentResponse | undefined;
    
    try {
      // Create message processing options
      const processingOptions: MessageProcessingOptions = {
        attachments: processedAttachments.map((attachment: MessageAttachment) => ({
          filename: attachment.filename,
          type: attachment.type,
          size: attachment.size,
          mimeType: attachment.mimeType,
          fileId: attachment.fileId,
          preview: attachment.preview,
          has_full_preview: attachment.has_full_preview,
          is_image_for_vision: attachment.type === 'image'
        })),
        userId: userId,
        chatId: chatId,
        userMessageId: lastUserMessageId || undefined,
        skipResponseMemoryStorage: true, // We'll handle memory storage here
        thinking: thinking // Pass thinking flag to the agent
      };
      
      console.log(`Processing user input with agent ${agentId} using its processUserInput method`);
      
      // Set a reasonable timeout (30 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          clearTimeout(timeoutId);
          reject(new Error('Request timed out after 30 seconds'));
        }, 30000);
      });
      
      // Process the user input through the new unified pipeline in the agent
      // The agent is now a DefaultAgent with processUserInput
      
      // Use Promise.race with proper error handling
      try {
        // Wait for either response or timeout
        agentResponse = await Promise.race([
          agent.processUserInput(content, processingOptions), 
          timeoutPromise
        ]);
        console.log('Agent processUserInput completed successfully');
      } catch (error) {
        console.error('Error in agent processing:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('timed out')) {
          agentResponse = {
            content: "I'm sorry, but it's taking me longer than expected to process your request. Please try again with a simpler query.",
            thoughts: [`Timeout error: ${errorMessage}`]
          };
        } else {
          agentResponse = {
            content: "I encountered an error while processing your request. Please try again.",
            thoughts: [`Error: ${errorMessage}`]
          };
        }
      }
    } catch (processingError) {
      console.error('Error processing user input:', processingError);
      agentResponse = {
        content: "I encountered an error while processing your request. Please try again.",
        thoughts: [`Error: ${processingError instanceof Error ? processingError.message : String(processingError)}`]
      };
    }
    
    // Ensure we always have a valid agentResponse
    if (!agentResponse) {
      console.warn('No agent response was generated, using default response');
      agentResponse = {
        content: "I apologize, but I couldn't generate a proper response for your message. Please try again or rephrase your question.",
        thoughts: ["No response was generated through the normal processing flow"]
      };
    }

    // Extract response components
    const responseContent = agentResponse.content;
    const thoughts = agentResponse.thoughts || [];
    const memories = agentResponse.memories || [];

    // Extract tags from agent response
    let responseMessageTags: string[] = ['agent_response']; // Always include agent_response tag
    try {
      const extractionResult = await extractTags(responseContent, {
        maxTags: 8,
        minConfidence: 0.3,
        existingTags: userMessageTags // Pass user message tags as context
      });
      
      if (extractionResult.success && extractionResult.tags.length > 0) {
        // Get the extracted tags and add to existing agent_response tag
        const extractedTags = extractionResult.tags.map(tag => tag.text);
        responseMessageTags = [...responseMessageTags, ...extractedTags];
        console.log(`Extracted ${extractedTags.length} tags from agent response:`, extractedTags);
      }
    } catch (extractionError) {
      console.warn('Error extracting tags from agent response:', extractionError);
    }

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

    // Save assistant response to memory with extracted tags
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
          chatId: chatStructuredId,
          tags: responseMessageTags,
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
          agentName: agentProfile.name || 'Assistant',
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