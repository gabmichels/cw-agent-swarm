import { NextResponse } from 'next/server';
import { generateMessageId, MessageRole, MessageStatus, MessageType, SendMessageRequest } from '@/lib/multi-agent/types/message';
import { AgentFactory } from '@/agents/shared/AgentFactory';
import { createAgentMemoryService } from '@/server/memory/services/multi-agent';
import { getMemoryServices } from '@/server/memory/services';
import { AgentMemoryService } from '@/server/memory/services/multi-agent/agent-service';
import { MessageProcessingOptions } from '@/agents/shared/base/AgentBase.interface';
import { MemoryType } from '@/server/memory/config/types';

/**
 * Collection name for messages
 */
const MESSAGES_COLLECTION = 'messages';

/**
 * POST /api/multi-agent/messages
 * Send a message to a chat
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const requestData: SendMessageRequest = await request.json();
    
    // Validate required fields
    if (!requestData.chatId) {
      return NextResponse.json(
        { success: false, error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.senderId) {
      return NextResponse.json(
        { success: false, error: 'Sender ID is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.senderType) {
      return NextResponse.json(
        { success: false, error: 'Sender type is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.content && !requestData.attachments?.length) {
      return NextResponse.json(
        { success: false, error: 'Message content or attachments are required' },
        { status: 400 }
      );
    }
    
    // Generate message ID and timestamps
    const messageId = generateMessageId();
    const timestamp = new Date();
    
    // Determine message role based on sender type
    let role = MessageRole.USER;
    if (requestData.senderType === 'agent') {
      role = MessageRole.AGENT;
    } else if (requestData.senderType === 'system') {
      role = MessageRole.SYSTEM;
    }
    
    // Create message object
    const message = {
      id: messageId,
      chatId: requestData.chatId,
      senderId: requestData.senderId,
      senderType: requestData.senderType,
      content: requestData.content || '',
      type: requestData.type || MessageType.TEXT,
      role,
      status: MessageStatus.DELIVERED,
      attachments: requestData.attachments || [],
      replyToId: requestData.replyToId,
      metadata: requestData.metadata || {},
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    // Store the message in the Qdrant database
    try {
      const { memoryService } = await getMemoryServices();
      
      // Create content for embedding
      const content = requestData.content || 'Message with attachments';
      
      // Store message in memory system
      const result = await memoryService.addMemory({
        type: 'message' as MemoryType,
        content: content,
        metadata: {
          ...message,
          // Convert dates to strings for JSON serialization
          createdAt: timestamp.toISOString(),
          updatedAt: timestamp.toISOString()
        }
      });
      
      if (!result.success) {
        console.error('Failed to store message:', result.error);
        return NextResponse.json(
          { success: false, error: 'Failed to store message' },
          { status: 500 }
        );
      }
      
      console.log(`Message ${messageId} stored successfully in chat ${requestData.chatId}`);
    } catch (error) {
      console.error('Error storing message:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to store message' },
        { status: 500 }
      );
    }
    
    // If the sender is a user, trigger agent response
    if (role === MessageRole.USER && requestData.recipientId) {
      try {
        // Get the agent instance
        const { memoryService } = await getMemoryServices();
        const agentService: AgentMemoryService = await createAgentMemoryService(memoryService);
        
        // Get the agent entity
        const result = await agentService.getAgent(requestData.recipientId);
        
        if (result.isError || !result.value) {
          console.error('Agent not found or error retrieving agent:', result.error?.message);
        } else {
          const agentEntity = result.value;
          
          // Create an agent instance from the entity
          const agent = AgentFactory.createFromDbEntity(agentEntity);
          
          // Initialize the agent (if not already initialized)
          await agent.initialize();
          
          // Convert MessageAttachment to the format expected by MessageProcessingOptions
          const convertedAttachments = requestData.attachments?.map((attachment: any) => ({
            filename: attachment.filename || 'untitled',
            type: attachment.type,
            size: attachment.size,
            mimeType: attachment.contentType,
            fileId: attachment.id,
            preview: attachment.url,
            is_image_for_vision: attachment.type === 'image'
          }));
          
          // Process options
          const processOptions: MessageProcessingOptions = {
            userId: requestData.senderId,
            chatId: requestData.chatId,
            attachments: convertedAttachments,
            // Only include options from metadata if it exists and is an object
            ...(requestData.metadata?.options && typeof requestData.metadata.options === 'object' 
              ? requestData.metadata.options as Record<string, unknown>
              : {})
          };
          
          // Process the user input using the agent's processUserInput method
          console.log(`Processing user message for agent ${requestData.recipientId}`);
          const agentResponse = await agent.processUserInput(requestData.content, processOptions);
          
          // For now, just log the agent's response
          console.log('Agent response:', agentResponse);
          
          // TODO: Store the agent's response in the database and broadcast to clients
          // This would typically involve creating a new message from the agent
          // and broadcasting it through a WebSocket or similar mechanism
        }
      } catch (error) {
        console.error('Error processing message with agent:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: {
        ...message,
        // Convert dates to strings for JSON serialization
        createdAt: timestamp.toISOString(),
        updatedAt: timestamp.toISOString()
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/multi-agent/messages
 * Get messages from a chat
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    const senderId = searchParams.get('senderId');
    const senderType = searchParams.get('senderType');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    
    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    // Fetch messages from the Qdrant database
    try {
      const { memoryService } = await getMemoryServices();
      
      // Search for messages in this chat
      const searchQuery = `chatId:${chatId}`;
      
      const results = await memoryService.searchMemories({
        type: 'message' as MemoryType,
        query: searchQuery,
        limit,
        offset
      });
      
      // Convert search results back to message format
      const messages = results.map((point: any) => {
        const metadata = point.payload.metadata as any;
        return {
          id: metadata.id,
          chatId: metadata.chatId,
          senderId: metadata.senderId,
          senderType: metadata.senderType,
          content: metadata.content,
          type: metadata.type,
          role: metadata.role,
          status: metadata.status,
          attachments: metadata.attachments || [],
          replyToId: metadata.replyToId,
          metadata: metadata.metadata || {},
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt
        };
      });
      
      // Filter by additional criteria if provided
      let filteredMessages = messages;
      
      if (senderId) {
        filteredMessages = filteredMessages.filter((msg: any) => msg.senderId === senderId);
      }
      
      if (senderType) {
        filteredMessages = filteredMessages.filter((msg: any) => msg.senderType === senderType);
      }
      
      if (fromDate) {
        const from = new Date(fromDate);
        filteredMessages = filteredMessages.filter((msg: any) => new Date(msg.createdAt) >= from);
      }
      
      if (toDate) {
        const to = new Date(toDate);
        filteredMessages = filteredMessages.filter((msg: any) => new Date(msg.createdAt) <= to);
      }
      
      // Sort by creation date (newest first)
      filteredMessages.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      console.log(`Found ${filteredMessages.length} messages for chat ${chatId}`);
      
      return NextResponse.json({
        success: true,
        messages: filteredMessages,
        total: filteredMessages.length,
        hasMore: filteredMessages.length === limit
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
} 