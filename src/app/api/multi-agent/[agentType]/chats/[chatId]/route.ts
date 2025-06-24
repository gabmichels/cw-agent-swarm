import { NextResponse } from 'next/server';
import { getChatService } from '../../../../../../server/memory/services/chat-service';
import { ChatStatus } from '../../../../../../server/memory/models/chat-collection';

/**
 * GET handler - retrieve a specific chat
 */
export async function GET(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    const awaitedParams = await params;
    console.log(`API DEBUG: GET multi-agent/${awaitedParams.agentType}/chats/${awaitedParams.chatId}`);
    const chatId = awaitedParams.chatId;

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
    console.error(`Error fetching chat ${awaitedParams.chatId}:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT handler - update a chat
 */
export async function PUT(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    const awaitedParams = await params;
    console.log(`API DEBUG: PUT multi-agent/${awaitedParams.agentType}/chats/${awaitedParams.chatId}`);
    const chatId = awaitedParams.chatId;
    const updateData = await request.json();

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    const chatService = await getChatService();

    // Only allow updating specific fields
    const allowedFields = {
      title: updateData.title,
      description: updateData.description,
      status: updateData.status
    };

    // Filter out undefined fields
    const filteredUpdate = Object.entries(allowedFields)
      .filter(([_, value]) => value !== undefined)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

    if (Object.keys(filteredUpdate).length === 0) {
      return NextResponse.json(
        { error: 'No valid update fields provided' },
        { status: 400 }
      );
    }

    const updatedChat = await chatService.updateChat(chatId, filteredUpdate);

    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Chat not found or could not be updated' },
        { status: 404 }
      );
    }

    return NextResponse.json({ chat: updatedChat });
  } catch (error) {
    console.error(`Error updating chat ${awaitedParams.chatId}:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - archive/delete a chat
 */
export async function DELETE(
  request: Request,
  { params }: { params: { agentType: string, chatId: string } }
) {
  try {
    const awaitedParams = await params;
    console.log(`API DEBUG: DELETE multi-agent/${awaitedParams.agentType}/chats/${awaitedParams.chatId}`);
    const chatId = awaitedParams.chatId;

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    const chatService = await getChatService();

    // First try to archive the chat (soft delete)
    const archived = await chatService.archiveChat(chatId);

    if (!archived) {
      // If archiving fails, try hard delete
      const deleted = await chatService.deleteChat(chatId);

      if (!deleted) {
        return NextResponse.json(
          { error: 'Chat not found or could not be deleted' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting chat ${awaitedParams.chatId}:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 