import { NextResponse } from 'next/server';
import { getChatService } from '../../../../server/memory/services/chat-service';
import { ChatType } from '../../../../server/memory/models/chat-collection';

/**
 * GET handler - list chats for a user
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'gab';
    const agentId = searchParams.get('agentId');
    
    const chatService = await getChatService();
    let chats = [];
    
    if (userId && agentId) {
      // Get chats between specific user and agent
      chats = await chatService.getChatsByUserAndAgent(userId, agentId);
    } else if (userId) {
      // Get all chats for a user
      chats = await chatService.getChatsByUserId(userId);
    } else if (agentId) {
      // Get all chats for an agent
      chats = await chatService.getChatsByAgentId(agentId);
    } else {
      return NextResponse.json(
        { error: 'Either userId or agentId must be provided' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ chats });
  } catch (error) {
    console.error('Error fetching chats:', error);
    
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
    const { userId, agentId, title, description, type = ChatType.DIRECT, forceNew = false } = await request.json();
    
    if (!userId || !agentId) {
      return NextResponse.json(
        { error: 'userId and agentId are required' },
        { status: 400 }
      );
    }
    
    const chatService = await getChatService();
    const chatSession = await chatService.createChat(userId, agentId, {
      title,
      description,
      type,
      forceNewId: forceNew
    });
    
    return NextResponse.json({ chat: chatSession });
  } catch (error) {
    console.error('Error creating chat:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 