import { NextResponse } from 'next/server';
import { getChatService } from '../../../../../../../server/memory/services/chat-service';

/**
 * GET handler - list chat participants
 */
export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    console.log(`API DEBUG: GET multi-agent/system/chats/${params.chatId}/participants`);
    
    const { chatId } = params;
    
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
    
    return NextResponse.json({ participants: chat.participants || [] });
  } catch (error) {
    console.error(`Error getting chat participants for ${params.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler - add participant to chat
 */
export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    console.log(`API DEBUG: POST multi-agent/system/chats/${params.chatId}/participants`);
    
    const { chatId } = params;
    const data = await request.json();
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    if (!data.id) {
      return NextResponse.json(
        { error: 'Participant ID is required' },
        { status: 400 }
      );
    }
    
    if (!data.type) {
      return NextResponse.json(
        { error: 'Participant type is required' },
        { status: 400 }
      );
    }
    
    const chatService = await getChatService();
    
    // Check if chat exists
    const chat = await chatService.getChatById(chatId);
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    // Check if participant already exists in the chat
    const existingParticipant = chat.participants?.find(p => p.id === data.id);
    
    if (existingParticipant) {
      return NextResponse.json(
        { error: 'Participant already exists in the chat' },
        { status: 409 }
      );
    }
    
    // Add participant to chat
    const newParticipant = {
      id: data.id,
      type: data.type,
      name: data.name || data.id,
      joinedAt: new Date().toISOString(),
      metadata: data.metadata || {}
    };
    
    chat.participants = chat.participants || [];
    chat.participants.push(newParticipant);
    
    // Update chat
    const updatedChat = await chatService.updateChat(chatId, {
      metadata: {
        ...chat.metadata,
        participants: chat.participants
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
    console.error(`Error adding participant to chat ${params.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - remove all additional participants from chat
 */
export async function DELETE(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    console.log(`API DEBUG: DELETE multi-agent/system/chats/${params.chatId}/participants`);
    
    const { chatId } = params;
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    const chatService = await getChatService();
    
    // Check if chat exists
    const chat = await chatService.getChatById(chatId);
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    // Keep only the original participants (usually user and primary agent)
    // Assume the first two participants are the original ones
    const originalParticipants = chat.participants?.slice(0, 2) || [];
    
    // Update chat
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
    console.error(`Error removing participants from chat ${params.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 