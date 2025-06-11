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
      console.warn(`⚠️ Chat ${chatId} not found during message retrieval, but continuing anyway`);
      // Don't fail immediately - allow message retrieval to continue
      // This prevents user messages from disappearing due to chat persistence issues
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
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Filtering by tags: ${tags.join(', ')}`);
      }
      // For each tag, add a filter to match any message that contains that tag
      tags.forEach(tag => {
        mustFilters.push({ key: "metadata.tags", match: { value: tag } });
      });
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.debug(`Search filters being applied:`, JSON.stringify(mustFilters, null, 2));
    }
    
    // Search for messages with this chat ID
    if (process.env.NODE_ENV === 'development') {
      console.debug(`Searching for messages using filter-based approach...`);
      console.debug(`Trying structured ID format first: metadata.chatId.id = ${chatId}`);
    }
    
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
      if (process.env.NODE_ENV === 'development') {
        console.debug(`No results with structured ID format, trying legacy string format: metadata.chatId = ${chatId}`);
      }
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
        if (process.env.NODE_ENV === 'development') {
          console.debug(`Found ${searchResults.length} results with legacy string format`);
        }
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Found ${searchResults.length} results with structured ID format`);
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug(`Found ${searchResults.length} total items, filtering to message types only...`);
    }
    
    // Filter to only message types (client-side validation)
    const messageResults = searchResults.filter(result => {
      const payloadType = result.point?.payload?.type;
      const metadataType = (result.point?.payload?.metadata as any)?.type;
      const actualType = payloadType || metadataType;
      return actualType === MemoryType.MESSAGE;
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.debug(`✅ Filtered to ${messageResults.length} message items (removed ${searchResults.length - messageResults.length} non-message items)`);
    }
    
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
        // Include reply context and other metadata for client use
        metadata: {
          ...(metadata.replyTo && { replyTo: metadata.replyTo }),
          ...(metadata.importance && { importance: metadata.importance }),
          ...(metadata.importance_score && { importance_score: metadata.importance_score }),
          // Include other metadata fields that might be useful
          ...Object.fromEntries(
            Object.entries(metadata).filter(([key]) => 
              !['userId', 'agentId', 'chatId', 'role', 'messageType', 'thread', 'attachments', 'tags'].includes(key)
            )
          )
        },
        
        // DEBUG: Include type information for troubleshooting
        _debug: {
          originalType: contentType,
          memoryId: point.id,
          collection: 'messages' // Should always be messages now
        }
      };
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.debug(`Final response: ${messages.length} messages prepared for client`);
    }
    
    // Log sample content for debugging (first message only)
    if (messages.length > 0 && process.env.NODE_ENV === 'development') {
      const firstMessage = messages[0];
      console.debug(`Sample message content:`, {
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

    // Extract actual string values from structured IDs if they exist
    // Handle both StructuredId objects and plain strings for backward compatibility
    const actualUserId = typeof userId === 'object' && userId?.id ? userId.id : userId;
    const actualAgentId = typeof agentId === 'object' && agentId?.id ? agentId.id : agentId;

    console.log(`Processing message for user: ${actualUserId}, agent: ${actualAgentId}, chat: ${chatId}`);

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
        console.log('🧪 DEBUG: Attempting to get existing chat:', chatId);
        chatSession = await chatService.getChatById(chatId);
        console.log(`✅ Found existing chat session: ${chatId}`, {
          chatExists: !!chatSession,
          chatId: chatSession?.id,
          status: chatSession?.status
        });
      } catch (notFoundError) {
        // If not found, create a new chat
        console.log(`🧪 DEBUG: Chat not found, creating new chat session: ${chatId}`);
        console.log('Chat not found error:', notFoundError);
        
        // Get agent info for title
        let agentName = 'Assistant';
        try {
          const agent = await AgentService.getAgent(actualAgentId);
          if (agent) {
            agentName = agent.name || 'Assistant';
          }
        } catch (agentError) {
          console.warn('Error getting agent info:', agentError);
        }
        
        console.log('🧪 DEBUG: Creating chat with params:', {
          userId: actualUserId,
          agentId: actualAgentId,
          chatId: chatId,
          agentName: agentName
        });
        
        chatSession = await chatService.createChat(actualUserId, actualAgentId, {
          title: `Chat with ${agentName}`,
          description: `Conversation between user ${actualUserId} and agent ${agentName}`
        });
        
        console.log('🧪 DEBUG: Chat creation result:', {
          success: !!chatSession,
          newChatId: chatSession?.id,
          requestedChatId: chatId,
          idsMatch: chatSession?.id === chatId
        });
      }
    } catch (chatError) {
      console.error('🧪 DEBUG: Error in chat creation/retrieval:', chatError);
      // Create a minimal chat session for conversation continuity
      let agentName = 'Assistant';
      try {
        const agent = await AgentService.getAgent(actualAgentId);
        if (agent) {
          agentName = agent.name || 'Assistant';
        }
      } catch (agentError) {
        console.warn('Error getting agent info:', agentError);
      }
      
      console.log('🧪 DEBUG: Creating fallback chat session...');
      chatSession = {
        id: chatId,
        type: 'direct',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
        participants: [
          { id: actualUserId, type: 'user', joinedAt: new Date().toISOString() },
          { id: actualAgentId, type: 'agent', joinedAt: new Date().toISOString() }
        ],
        metadata: {
          title: `Chat with ${agentName}`,
          description: `Conversation between user ${actualUserId} and agent ${agentName}`
        }
      };
      console.log('🧪 DEBUG: Fallback chat session created:', !!chatSession);
    }
    
    // Create structured IDs
    const userStructuredId = createUserId(actualUserId);
    const agentStructuredId = createAgentId(actualAgentId);
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
        maxTags: 20,         // Increased to 20 like assistant messages
        minConfidence: 0.3
        // No existingTags parameter - we want fresh tags for user input
      });
      
      if (extractionResult.success && extractionResult.tags.length > 0) {
        userMessageTags = extractionResult.tags.map(tag => tag.text);
        console.log(`Extracted ${userMessageTags.length} tags from user message:`, userMessageTags);
      }
    } catch (extractionError) {
      console.warn('Error extracting tags from user message:', extractionError);
    }
    
    // Calculate importance for user message
    let userImportance: any = undefined;
    let userImportanceScore: number | undefined = undefined;
    try {
      // Import importance calculator
      const { ImportanceCalculatorService, ImportanceCalculationMode } = await import('../../../../../../services/importance/ImportanceCalculatorService');
      const { getLLM } = await import('../../../../../../lib/core/llm');
      
      // Create LLM service wrapper for importance calculation
      const llmService = {
        generateStructuredOutput: async <T>(
          model: string,
          prompt: string,
          outputSchema: Record<string, unknown>
        ): Promise<T> => {
          const cheapModel = getLLM({ 
            useCheapModel: true, 
            temperature: 0.3, 
            maxTokens: 300 
          });
          
          try {
            const response = await cheapModel.invoke(prompt);
            const responseContent = typeof response === 'string' ? response : response.content;
            
            try {
              return JSON.parse(responseContent) as T;
            } catch {
              return responseContent as T;
            }
          } catch (error) {
            throw error;
          }
        }
      };
      
      const importanceCalculator = new ImportanceCalculatorService(llmService, {
        defaultMode: ImportanceCalculationMode.LLM,
        hybridConfidenceThreshold: 0.8
      });
      
      const importanceResult = await importanceCalculator.calculateImportance({
        content,
        contentType: 'user_message',
        tags: userMessageTags,
        source: 'user',
        userContext: `User ${actualUserId} in chat ${chatId}`
      }, ImportanceCalculationMode.LLM);
      
      userImportance = importanceResult.importance_level;
      userImportanceScore = importanceResult.importance_score;
      
      console.log(`Calculated user message importance:`, {
        importance: userImportance,
        score: userImportanceScore,
        reasoning: importanceResult.reasoning
      });
    } catch (importanceError) {
      console.warn('Error calculating user message importance:', importanceError);
    }
    
    // Create thread info for user message
    const userThreadInfo = getOrCreateThreadInfo(chatId, 'user');
    console.log(`Created user message with thread ID: ${userThreadInfo.id}, position: ${userThreadInfo.position}`);
    
    // Save user message to memory with extracted tags and importance
    console.log('🧪 DEBUG: About to save user message to memory...', {
      content: content.substring(0, 100) + '...',
      userId: actualUserId,
      agentId: actualAgentId,
      chatId: chatId,
      userMessageTags,
      userImportance,
      userImportanceScore
    });
    
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
          tags: userMessageTags,
          ...(userImportance && { importance: userImportance }),
          ...(userImportanceScore && { importance_score: userImportanceScore }),
          // Include the full metadata from client (including replyTo context)
          ...(metadata.replyTo && { replyTo: metadata.replyTo }),
          // Include any other metadata fields from the client
          ...Object.fromEntries(
            Object.entries(metadata).filter(([key]) => 
              !['userId', 'agentId', 'attachments', 'thinking'].includes(key)
            )
          )
        }
      }
    );

    console.log('🧪 DEBUG: User message save result:', {
      success: !!userMemoryResult?.id,
      messageId: userMemoryResult?.id,
      error: userMemoryResult?.error || 'none'
    });

    // Store user message ID for assistant response
    if (userMemoryResult && userMemoryResult.id) {
      lastUserMessageId = userMemoryResult.id;
      console.log(`Saved user message to memory with ID: ${lastUserMessageId}`);
    } else {
      console.error('🚨 USER MESSAGE SAVE FAILED!', userMemoryResult);
    }

    // Get the agent instance from the runtime registry (already bootstrapped and running)
    const { getAgentById, getAllAgents, debugAgentRegistry } = await import('../../../../../../server/agent/agent-service');
    let agent = getAgentById(actualAgentId);
    
    if (!agent) {
      console.warn(`Agent ${actualAgentId} not found in runtime registry. Attempting recovery...`);
      
      // Try to get any available agent as fallback
      const availableAgents = getAllAgents();
      if (availableAgents.length > 0) {
        agent = availableAgents[0];
        console.log(`Using fallback agent ${agent.getAgentId()} instead of ${actualAgentId}`);
      } else {
        // No agents available, try to bootstrap
        console.log('No agents available in registry. Attempting bootstrap...');
        try {
          const { bootstrapAgentsFromDatabase } = await import('../../../../../../server/agent/bootstrap-agents');
          const bootstrappedCount = await bootstrapAgentsFromDatabase();
          console.log(`Bootstrapped ${bootstrappedCount} agents`);
          
          // Try to get the originally requested agent again
          agent = getAgentById(actualAgentId);
          if (!agent) {
            // Still not found, use first available
            const newlyAvailableAgents = getAllAgents();
            if (newlyAvailableAgents.length > 0) {
              agent = newlyAvailableAgents[0];
              console.log(`Using bootstrapped agent ${agent.getAgentId()} instead of ${actualAgentId}`);
            }
          }
        } catch (bootstrapError) {
          console.error('Failed to bootstrap agents:', bootstrapError);
        }
      }
    }
    
    if (!agent) {
      // Log debug information about the registry state
      debugAgentRegistry();
      throw new Error(`No agents available in runtime registry. Make sure agents are bootstrapped on server startup. Try restarting the server with: npm run dev:with-bootstrap`);
    }
    
    const actualUsedAgentId = agent.getAgentId();
    if (actualUsedAgentId !== actualAgentId) {
      console.log(`Note: Using agent ${actualUsedAgentId} instead of requested agent ${actualAgentId}`);
    } else {
      console.log(`Using requested agent ${actualAgentId} from runtime registry`);
    }
    
    // Check if agent has the required processUserInput method
    if (typeof (agent as any).processUserInput !== 'function') {
      throw new Error(`Agent ${actualAgentId} does not have processUserInput method. This agent may not be compatible with the current system.`);
    }

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
        userId: actualUserId,
        chatId: chatId,
        userMessageId: lastUserMessageId || undefined,
        skipResponseMemoryStorage: true, // We'll handle memory storage here
        thinking: thinking // Pass thinking flag to the agent
      };
      
      console.log(`Processing user input with agent ${actualAgentId} using its processUserInput method`);
      
      // Set a reasonable timeout (120 seconds for complex processing)
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          clearTimeout(timeoutId);
          reject(new Error('Request timed out after 120 seconds'));
        }, 120000);
      });
      
      // Process the user input through the new unified pipeline in the agent
      // The agent is now a DefaultAgent with processUserInput
      
      // Use Promise.race with proper error handling
      try {
        // Wait for either response or timeout
        agentResponse = await Promise.race([
          (agent as any).processUserInput(content, processingOptions), 
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
    
    // Extract importance from agent response thinking analysis if available
    const thinkingAnalysis = agentResponse.metadata?.thinkingAnalysis as any;
    const importance = thinkingAnalysis?.importance;
    const importanceScore = thinkingAnalysis?.importanceScore;

    // Extract tags from agent response
    let responseMessageTags: string[] = ['agent_response']; // Always include agent_response tag
    try {
      const extractionResult = await extractTags(responseContent, {
        maxTags: 20,         // Increased from 8 to 20 for more comprehensive tagging
        minConfidence: 0.3   // Keep existing confidence threshold
        // Removed existingTags parameter to prevent tag duplication between user and assistant
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
          ...(importance && { importance }),
          ...(importanceScore && { importance_score: importanceScore }),
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
          agentId: actualAgentId,
          agentName: agent.getName() || 'Assistant',
          userId: actualUserId,
          threadId: assistantThreadInfo.id,
          parentMessageId: lastUserMessageId,
          thoughts,
          memories,
          importance,
          importanceScore
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