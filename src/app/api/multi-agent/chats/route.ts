import { NextResponse } from 'next/server';
import { generateChatId } from '@/lib/multi-agent/types/chat';
import { ChatCreationRequest, ChatProfile, ChatVisibility } from '@/lib/multi-agent/types/chat';
import { getChatService } from '@/server/memory/services/chat-service';
import { ChatType, ChatSession } from '@/server/memory/models/chat-collection';

/**
 * POST /api/multi-agent/chats
 * Creates a new chat
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const requestData: ChatCreationRequest = await request.json();
    
    // Validate request data
    if (!requestData.name) {
      return NextResponse.json(
        { success: false, error: 'Chat name is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.description) {
      return NextResponse.json(
        { success: false, error: 'Chat description is required' },
        { status: 400 }
      );
    }
    
    if (!requestData.settings) {
      return NextResponse.json(
        { success: false, error: 'Chat settings are required' },
        { status: 400 }
      );
    }
    
    if (!requestData.metadata) {
      return NextResponse.json(
        { success: false, error: 'Chat metadata is required' },
        { status: 400 }
      );
    }
    
    // Get the user ID from the request or use a default
    // In a real implementation, this would come from authentication
    const userId = (requestData.metadata as any).userId || 'default_user';
    
    // For now, we'll use a dummy agent ID if not specified
    const agentId = (requestData.metadata as any).agentId || 'default_agent';
    
    console.log(`Creating chat between user ${userId} and agent ${agentId}`);
    
    // Initialize chat service
    const chatService = await getChatService();
    
    // Determine chat type based on visibility
    let chatType = ChatType.DIRECT;
    if (requestData.settings.visibility === ChatVisibility.PUBLIC) {
      chatType = ChatType.GROUP;
    }
    
    // Create a chat session using the chat service
    const chatSession = await chatService.createChat(userId, agentId, {
      title: requestData.name,
      description: requestData.description,
      type: chatType,
      forceNewId: true, // Always create a new chat ID
      metadata: {
        ...requestData.metadata,
        settings: requestData.settings,
        // Add explicit fields for searchability
        userId: userId,
        agentId: agentId
      }
    });
    
    if (!chatSession) {
      console.error('Failed to create chat session');
      return NextResponse.json(
        { success: false, error: 'Failed to create chat session' },
        { status: 500 }
      );
    }
    
    // Return the created chat with the format expected by the front-end
    const chatResponse: ChatProfile = {
      id: chatSession.id,
      name: requestData.name,
      description: requestData.description,
      settings: requestData.settings,
      metadata: requestData.metadata,
      createdAt: new Date(chatSession.createdAt),
      updatedAt: new Date(chatSession.updatedAt)
    };
    
    return NextResponse.json({
      success: true,
      message: 'Chat created successfully',
      chat: chatResponse
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    
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
 * GET /api/multi-agent/chats
 * Retrieves a list of chats
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const nameParam = searchParams.get('name');
    const userId = searchParams.get('userId');
    const agentId = searchParams.get('agentId');
    
    console.log('Retrieving chats with params:', { idParam, nameParam, userId, agentId });
    
    // Initialize chat service
    const chatService = await getChatService();
    
    let chats: ChatSession[] = [];
    
    if (idParam) {
      // Get a specific chat by ID
      console.log(`Looking up chat by ID: ${idParam}`);
      const chat = await chatService.getChatById(idParam);
      console.log('Chat lookup result:', chat ? 'Found' : 'Not found');
      if (chat) {
        chats = [chat];
      }
    } else if (userId && agentId) {
      // Get chats between a specific user and agent
      console.log(`Looking up chats between user ${userId} and agent ${agentId}`);
      
      // Try direct lookup first - this is more reliable than using the search service
      const directLookupChats = await chatService.getChatsByUserAndAgentDirect(userId, agentId);
      if (directLookupChats && directLookupChats.length > 0) {
        console.log(`Found ${directLookupChats.length} chats via direct lookup`);
        chats = directLookupChats;
      } else {
        // Fall back to search service
        console.log('Direct lookup failed, trying search service');
        chats = await chatService.getChatsByUserAndAgent(userId, agentId);
        console.log(`Found ${chats.length} chats via search service`);
      }
    } else if (userId) {
      // Get all chats for a user
      console.log(`Looking up chats for user ${userId}`);
      chats = await chatService.getChatsByUserId(userId);
      console.log(`Found ${chats.length} chats for user`);
    } else if (agentId) {
      // Get all chats for an agent
      console.log(`Looking up chats for agent ${agentId}`);
      chats = await chatService.getChatsByAgentId(agentId);
      console.log(`Found ${chats.length} chats for agent`);
    }
    
    console.log(`Returning ${chats.length} chats`);
    
    // Map to the expected response format
    const chatProfiles = chats.map((chat: any) => ({
      id: chat.id,
      name: chat.metadata?.title || 'Untitled Chat',
      description: chat.metadata?.description || '',
      settings: chat.metadata?.settings || {
        visibility: chat.type === ChatType.GROUP ? ChatVisibility.PUBLIC : ChatVisibility.PRIVATE,
        allowAnonymousMessages: false,
        enableBranching: false,
        recordTranscript: true
      },
      metadata: {
        ...chat.metadata,
        participants: chat.participants.map((p: any) => ({
          id: p.id,
          type: p.type
        }))
      },
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt)
    }));
    
    return NextResponse.json({
      success: true,
      chats: chatProfiles,
      total: chatProfiles.length,
      page: 1,
      pageSize: chatProfiles.length
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
} 