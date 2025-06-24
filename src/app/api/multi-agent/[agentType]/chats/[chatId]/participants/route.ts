import { NextResponse } from 'next/server';
import { getChatService } from '../../../../../../../server/memory/services/chat-service';

/**
 * GET handler - get participants for a multi-agent chat
 */
export async function GET(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    const { agentType, chatId } = await params;
    console.log(`API DEBUG: GET multi-agent/${agentType}/chats/${chatId}/participants`);

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    const chatService = await getChatService();
    const chat = await chatService.getChatById(chatId);

    if (!chat) {
      return NextResponse.json({ participants: [] });
    }

    return NextResponse.json({ participants: chat.participants || [] });
  } catch (error) {
    console.error(`Error in API operation:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler - add a participant to a multi-agent chat
 */
export async function POST(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    const { agentType, chatId } = await params;
    console.log(`API DEBUG: POST multi-agent/${agentType}/chats/${chatId}/participants`);

    const body = await request.json();
    const { participantId, participantType = 'user', metadata = {} } = body;

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

    // Check if participant already exists
    const existingParticipant = chat.participants?.find((p: any) => p.id === participantId);
    if (existingParticipant) {
      return NextResponse.json(
        { error: 'Participant already exists in this chat' },
        { status: 409 }
      );
    }

    // Create new participant
    const newParticipant = {
      id: participantId,
      type: participantType,
      joinedAt: new Date().toISOString(),
      metadata
    };

    // Add participant to chat
    const updatedParticipants = [...(chat.participants || []), newParticipant];

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
    console.error(`Error in API operation:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - remove all participants from a chat (or specific ones)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    const { agentType, chatId } = await params;
    console.log(`API DEBUG: DELETE multi-agent/${agentType}/chats/${chatId}/participants`);

    const { participantIds } = await request.json();

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

    let updatedParticipants;

    if (participantIds && Array.isArray(participantIds)) {
      // Remove specific participants
      updatedParticipants = chat.participants?.filter(
        (p: any) => !participantIds.includes(p.id)
      ) || [];
    } else {
      // Remove all participants except the first two (original user and agent)
      updatedParticipants = chat.participants?.slice(0, 2) || [];
    }

    const updatedChat = await chatService.updateChat(chatId, {
      metadata: {
        ...chat.metadata,
        participants: updatedParticipants
      }
    });

    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Failed to remove participants' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Participants removed successfully'
    });
  } catch (error) {
    console.error(`Error in API operation:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 