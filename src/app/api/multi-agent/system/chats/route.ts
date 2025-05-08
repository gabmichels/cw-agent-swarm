import { NextResponse } from 'next/server';
import { getChatService } from '../../../../../server/memory/services/chat-service';

/**
 * GET handler - list chats or filter by user/agent ID
 */
export async function GET(request: Request) {
  try {
    console.log(`API DEBUG: GET multi-agent/system/chats`);
    
    // Get query parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const agentId = url.searchParams.get('agentId');
    
    const chatService = await getChatService();
    
    // Filter chats based on query parameters
    if (userId && agentId) {
      // Get chats for specific user AND agent
      const chats = await chatService.getChatsByUserAndAgent(userId, agentId);
      return NextResponse.json({ chats });
    } else if (userId) {
      // Get chats for specific user
      const chats = await chatService.getChatsByUserId(userId);
      return NextResponse.json({ chats });
    } else if (agentId) {
      // Get chats for specific agent
      const chats = await chatService.getChatsByAgentId(agentId);
      return NextResponse.json({ chats });
    } else {
      // Get all chats (default)
      const chats = await chatService.getChatsByUserId('*');
      return NextResponse.json({ chats });
    }
  } catch (error) {
    console.error('Error getting chats:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler - create a new chat
 */
export async function POST(request: Request) {
  try {
    console.log(`API DEBUG: POST multi-agent/system/chats`);
    
    const data = await request.json();
    
    // Validate request data
    if (!data.userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    if (!data.agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }
    
    const chatService = await getChatService();
    
    // Create chat with specified parameters
    const options = {
      title: data.title || 'New Chat',
      description: data.description || '',
      type: data.type || 'direct',
      forceNewId: true,
      participants: data.participants || []
    };
    
    const chat = await chatService.createChat(data.userId, data.agentId, options);
    
    return NextResponse.json({ chat });
  } catch (error) {
    console.error('Error creating chat:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 