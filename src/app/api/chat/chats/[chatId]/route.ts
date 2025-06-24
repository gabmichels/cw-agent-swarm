import { NextResponse } from 'next/server';
import { getChatService } from '../../../../../server/memory/services/chat-service';

/**
 * GET handler - get chat by ID
 */
export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const awaitedParams = await params;
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
    console.error(`Error fetching chat:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT handler - update chat
 */
export async function PUT(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const awaitedParams = await params;
    const chatId = awaitedParams.chatId;
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    const { title, description, status, metadata } = await request.json();

    const chatService = await getChatService();
    const chat = await chatService.updateChat(chatId, {
      title,
      description,
      status,
      metadata
    });

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ chat });
  } catch (error) {
    console.error(`Error updating chat:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - delete chat
 */
export async function DELETE(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const awaitedParams = await params;
    const chatId = awaitedParams.chatId;
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const archiveOnly = searchParams.get('archive') === 'true';

    const chatService = await getChatService();

    let success = false;
    if (archiveOnly) {
      success = await chatService.archiveChat(chatId);
    } else {
      success = await chatService.deleteChat(chatId);
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Chat not found or operation failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: archiveOnly ? 'Chat archived successfully' : 'Chat deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting chat:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 