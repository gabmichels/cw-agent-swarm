import { NextResponse } from 'next/server';
import { IdGenerator } from '../../../../../utils/ulid';
import { createAgentMemoryService } from '../../../../../server/memory/services/multi-agent';
import { getMemoryServices } from '../../../../../server/memory/services';
import { getChatService } from '../../../../../server/memory/services/chat-service';
import { ChatType, ChatParticipant } from '../../../../../server/memory/models/chat-collection';

/**
 * GET handler - list chats
 */
export async function GET(
  request: Request,
  { params }: { params: { agentType: string } }
) {
  try {
    console.log(`API DEBUG: GET multi-agent/${params.agentType}/chats`);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
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
export async function POST(
  request: Request,
  { params }: { params: { agentType: string } }
) {
  try {
    console.log(`API DEBUG: POST multi-agent/${params.agentType}/chats`);
    const { userId, agentId, title, description, type = ChatType.DIRECT, forceNew = false, participants = [] } = await request.json();
    
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
    
    // If this is a multi-agent chat, add additional participants
    if (type === ChatType.GROUP && Array.isArray(participants) && participants.length > 0) {
      // Get existing chat
      const existingChat = await chatService.getChatById(chatSession.id);
      if (!existingChat) {
        return NextResponse.json({ chat: chatSession });
      }
      
      // Create updated participants list
      const updatedParticipants = [...existingChat.participants];
      
      // Add each participant that doesn't already exist
      for (const participant of participants) {
        if (participant.id && participant.id !== agentId) {
          // Check if participant already exists
          const exists = updatedParticipants.some(p => p.id === participant.id);
          if (!exists) {
            // Create a participant object that matches the ChatParticipant interface
            const timestamp = new Date().toISOString();
            updatedParticipants.push({
              id: participant.id,
              type: participant.type || 'agent',
              joinedAt: timestamp,
              metadata: {
                // Store additional data in metadata
                name: participant.name,
                description: participant.description
              }
            });
          }
        }
      }
      
      // Update the chat with the new participants list
      const updatedChat = await chatService.updateChat(chatSession.id, {
        metadata: {
          ...existingChat.metadata,
          participants: updatedParticipants
        }
      });
      
      if (updatedChat) {
        return NextResponse.json({ chat: updatedChat });
      }
    }
    
    return NextResponse.json({ chat: chatSession });
  } catch (error) {
    console.error('Error creating chat:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 