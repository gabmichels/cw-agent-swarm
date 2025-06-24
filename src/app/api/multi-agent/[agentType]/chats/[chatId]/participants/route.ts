import { NextResponse } from 'next/server';
import { getChatService } from '../../../../../../../server/memory/services/chat-service';
import { ChatParticipant } from '../../../../../../../server/memory/models/chat-collection';

/**
 * GET handler - get all participants in a chat
 */
export async function GET(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    const awaitedParams = await params;
    console.log(`API DEBUG: GET multi-agent/${awaitedParams.agentType}/chats/${awaitedParams.chatId}/participants`);
    const chatId = (await params).chatId;
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    const chatService = await getChatService();
    const chat = await chatService.getChatById(chatId);
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    // Return the participants
    return NextResponse.json({ participants: chat.participants || [] });
  } catch (error) {
    console.error(`Error fetching participants for chat ${awaitedParams.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler - add a participant to a chat
 */
export async function POST(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    console.log(`API DEBUG: POST multi-agent/${awaitedParams.agentType}/chats/${awaitedParams.chatId}/participants`);
    const chatId = (await params).chatId;
    const { id, type = 'agent' } = await request.json();
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    if (!id) {
      return NextResponse.json(
        { error: 'Participant ID is required' },
        { status: 400 }
      );
    }
    
    const chatService = await getChatService();
    const chat = await chatService.getChatById(chatId);
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    // Check if participant already exists
    const existingParticipant = chat.participants.find(p => p.id === id);
    if (existingParticipant) {
      return NextResponse.json(
        { error: 'Participant already exists in this chat' },
        { status: 409 }
      );
    }
    
    // Add the new participant
    const timestamp = new Date().toISOString();
    const newParticipant: ChatParticipant = {
      id,
      type: type as 'user' | 'agent',
      joinedAt: timestamp
    };
    
    const updatedParticipants = [...chat.participants, newParticipant];
    
    // Update the chat
    const updatedChat = await chatService.updateChat(chatId, {
      metadata: {
        ...chat.metadata,
        participants: updatedParticipants
      }
    });
    
    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Failed to add participant' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      participant: newParticipant,
      message: 'Participant added successfully'
    });
  } catch (error) {
    console.error(`Error adding participant to chat ${awaitedParams.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - remove all participants from a chat
 */
export async function DELETE(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    console.log(`API DEBUG: DELETE multi-agent/${awaitedParams.agentType}/chats/${awaitedParams.chatId}/participants`);
    const chatId = (await params).chatId;
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    const chatService = await getChatService();
    const chat = await chatService.getChatById(chatId);
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    // Keep only the first two participants (usually the original user and agent)
    // in a real implementation, you might want to be more selective
    const originalParticipants = chat.participants.slice(0, 2);
    
    // Update the chat
    const updatedChat = await chatService.updateChat(chatId, {
      metadata: {
        ...chat.metadata,
        participants: originalParticipants
      }
    });
    
    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Failed to remove participants' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: 'Additional participants removed successfully',
      remainingParticipants: originalParticipants.length
    });
  } catch (error) {
    console.error(`Error removing participants from chat ${awaitedParams.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 