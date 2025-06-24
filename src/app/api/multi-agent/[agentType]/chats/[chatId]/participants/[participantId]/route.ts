import { NextResponse } from 'next/server';
import { getChatService } from '../../../../../../../../server/memory/services/chat-service';

/**
 * GET handler - get specific participant in a chat
 */
export async function GET(
  request: Request,
  { params }: { params: { agentType: string, chatId: string, participantId: string } }
) {
  try {
    const awaitedParams = await params;
    console.log(`API DEBUG: GET multi-agent/${awaitedParams.agentType}/chats/${awaitedParams.chatId}/participants/${awaitedParams.participantId}`);
    const { chatId, participantId  } = await params;
    
    if (!chatId || !participantId) {
      return NextResponse.json(
        { error: 'Chat ID and Participant ID are required' },
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
    
    // Find the participant
    const participant = chat.participants.find(p => p.id === participantId);
    
    if (!participant) {
      return NextResponse.json(
        { error: 'Participant not found in this chat' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ participant });
  } catch (error) {
    console.error(`Error fetching participant ${awaitedParams.participantId} for chat ${awaitedParams.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - remove a specific participant from a chat
 */
export async function DELETE(
  request: Request,
  { params }: { params: { agentType: string, chatId: string, participantId: string } }
) {
  try {
    console.log(`API DEBUG: DELETE multi-agent/${awaitedParams.agentType}/chats/${awaitedParams.chatId}/participants/${awaitedParams.participantId}`);
    const { chatId, participantId  } = await params;
    
    if (!chatId || !participantId) {
      return NextResponse.json(
        { error: 'Chat ID and Participant ID are required' },
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
    
    // Check if participant exists
    const participantIndex = chat.participants.findIndex(p => p.id === participantId);
    
    if (participantIndex === -1) {
      return NextResponse.json(
        { error: 'Participant not found in this chat' },
        { status: 404 }
      );
    }
    
    // Don't allow removing the first two participants (usually the original user and agent)
    if (participantIndex < 2) {
      return NextResponse.json(
        { error: 'Cannot remove original participants from the chat' },
        { status: 400 }
      );
    }
    
    // Filter out the participant
    const updatedParticipants = chat.participants.filter(p => p.id !== participantId);
    
    // Update the chat
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

/**
 * PATCH handler - update a participant (e.g., mark as left)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { agentType: string, chatId: string, participantId: string } }
) {
  try {
    console.log(`API DEBUG: PATCH multi-agent/${awaitedParams.agentType}/chats/${awaitedParams.chatId}/participants/${awaitedParams.participantId}`);
    const { chatId, participantId  } = await params;
    const updateData = await request.json();
    
    if (!chatId || !participantId) {
      return NextResponse.json(
        { error: 'Chat ID and Participant ID are required' },
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
    
    // Find the participant
    const participantIndex = chat.participants.findIndex(p => p.id === participantId);
    
    if (participantIndex === -1) {
      return NextResponse.json(
        { error: 'Participant not found in this chat' },
        { status: 404 }
      );
    }
    
    // Create updated participants list
    const updatedParticipants = [...chat.participants];
    
    // Only allow updating leftAt field for now
    if (updateData.leftAt === true) {
      // Set leftAt to current time
      updatedParticipants[participantIndex] = {
        ...updatedParticipants[participantIndex],
        leftAt: new Date().toISOString()
      };
    } else if (updateData.leftAt === false) {
      // Remove leftAt field
      const { leftAt, ...rest } = updatedParticipants[participantIndex];
      updatedParticipants[participantIndex] = rest;
    }
    
    // Update metadata if provided
    if (updateData.metadata && typeof updateData.metadata === 'object') {
      updatedParticipants[participantIndex] = {
        ...updatedParticipants[participantIndex],
        metadata: {
          ...updatedParticipants[participantIndex].metadata,
          ...updateData.metadata
        }
      };
    }
    
    // Update the chat
    const updatedChat = await chatService.updateChat(chatId, {
      metadata: {
        ...chat.metadata,
        participants: updatedParticipants
      }
    });
    
    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Failed to update participant' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      participant: updatedParticipants[participantIndex],
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