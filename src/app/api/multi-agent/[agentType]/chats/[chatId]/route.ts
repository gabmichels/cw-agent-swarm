import { NextResponse } from 'next/server';
import { getChatService } from '../../../../../../server/memory/services/chat-service';

/**
 * GET handler - get a specific multi-agent chat
 */
export async function GET(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    const { agentType, chatId } = await params;
    console.log(`API DEBUG: GET multi-agent/${agentType}/chats/${chatId}`);

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

    return NextResponse.json({ chat });
  } catch (error) {
    console.error('Error in API operation:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT handler - update a multi-agent chat
 */
export async function PUT(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    const { agentType, chatId } = await params;
    console.log(`API DEBUG: PUT multi-agent/${agentType}/chats/${chatId}`);

    const updateData = await request.json();

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    const chatService = await getChatService();
    const updatedChat = await chatService.updateChat(chatId, updateData);

    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Failed to update chat' },
        { status: 500 }
      );
    }

    return NextResponse.json({ chat: updatedChat });
  } catch (error) {
    console.error('Error in API operation:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - delete a multi-agent chat
 */
export async function DELETE(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    const { agentType, chatId } = await params;
    console.log(`API DEBUG: DELETE multi-agent/${agentType}/chats/${chatId}`);

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    const chatService = await getChatService();

    // Verify chat exists before deletion
    const chat = await chatService.getChatById(chatId);
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    const success = await chatService.deleteChat(chatId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete chat' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Error in API operation:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 