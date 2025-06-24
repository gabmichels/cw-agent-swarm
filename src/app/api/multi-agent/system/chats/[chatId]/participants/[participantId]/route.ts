import { NextResponse } from 'next/server';
import { getChatService } from '../../../../../../../../server/memory/services/chat-service';

/**
 * GET handler - get specific participant
 */
export async function GET(
  request: Request,
  { params }: { params: { chatId: string, participantId: string } }
) {
  try {
    const awaitedParams = await params;
    console.log(`API DEBUG: GET multi-agent/system/chats/${awaitedParams.chatId}/participants/${awaitedParams.participantId}`);
    
    const { chatId, participantId  } = await params;
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    if (!participantId) {
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
    
    // Find the specific participant
    const participant = chat.participants?.find(p => p.id === participantId);
    
    if (!participant) {
      return NextResponse.json(
        { error: 'Participant not found in the chat' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ participant });
  } catch (error) {
    console.error(`Error getting participant ${awaitedParams.participantId} from chat ${awaitedParams.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH handler - update participant (e.g., mark as left)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { chatId: string, participantId: string } }
) {
  try {
    console.log(`API DEBUG: PATCH multi-agent/system/chats/${awaitedParams.chatId}/participants/${awaitedParams.participantId}`);
    
    const { chatId, participantId  } = await params;
    const updateData = await request.json();
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    if (!participantId) {
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
    
    // Find the specific participant
    const participantIndex = chat.participants?.findIndex(p => p.id === participantId) ?? -1;
    
    if (participantIndex === -1) {
      return NextResponse.json(
        { error: 'Participant not found in the chat' },
        { status: 404 }
      );
    }
    
    // Update participant data
    chat.participants = chat.participants || [];
    const updatedParticipant = {
      ...chat.participants[participantIndex]
    };
    
    // Handle "leftAt" flag, which means the participant has left the chat
    if (updateData.leftAt) {
      updatedParticipant.leftAt = new Date().toISOString();
    }
    
    // Handle metadata updates
    if (updateData.metadata) {
      updatedParticipant.metadata = {
        ...updatedParticipant.metadata,
        ...updateData.metadata
      };
    }
    
    // Update the participant in the chat
    chat.participants[participantIndex] = updatedParticipant;
    
    // Update chat with new participants array
    const updatedChat = await chatService.updateChat(chatId, {
      metadata: {
        ...chat.metadata,
        participants: chat.participants
      }
    });
    
    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Failed to update participant' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      participant: updatedParticipant,
      message: 'Participant updated successfully'
    });
  } catch (error) {
    console.error(`Error updating participant ${awaitedParams.participantId} in chat ${awaitedParams.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - remove specific participant
 */
export async function DELETE(
  request: Request,
  { params }: { params: { chatId: string, participantId: string } }
) {
  try {
    console.log(`API DEBUG: DELETE multi-agent/system/chats/${awaitedParams.chatId}/participants/${awaitedParams.participantId}`);
    
    const { chatId, participantId  } = await params;
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    if (!participantId) {
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
    
    // Make sure we're not removing the original participants (usually user or primary agent)
    // Assume the first two participants are the original ones that must remain
    if (chat.participants && chat.participants.length >= 2) {
      const originalParticipantIds = chat.participants.slice(0, 2).map(p => p.id);
      
      if (originalParticipantIds.includes(participantId)) {
        return NextResponse.json(
          { error: 'Cannot remove original chat participant' },
          { status: 400 }
        );
      }
    }
    
    // Filter out the participant to remove
    const updatedParticipants = chat.participants?.filter(p => p.id !== participantId) || [];
    
    // Update chat with new participants array
    const updatedChat = await chatService.updateChat(chatId, {
      metadata: {
        ...chat.metadata,
        participants: updatedParticipants
      }
    });
    
    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Failed to remove participant' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Participant removed successfully'
    });
  } catch (error) {
    console.error(`Error removing participant ${awaitedParams.participantId} from chat ${awaitedParams.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 