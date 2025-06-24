import { NextResponse } from 'next/server';
import { getChatService } from '../../../../../../server/memory/services/chat-service';

/**
 * GET handler - get chat by ID
 */
export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const awaitedParams = await params;
    console.log(`API DEBUG: GET multi-agent/system/chats/${awaitedParams.chatId}`);
    
    const { chatId  } = await params;
    
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
    console.error(`Error getting chat ${awaitedParams.chatId}:`, error);
    
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
    console.log(`API DEBUG: PUT multi-agent/system/chats/${awaitedParams.chatId}`);
    
    const { chatId  } = await params;
    const updateData = await request.json();
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    const chatService = await getChatService();
    
    // Check if chat exists
    const existingChat = await chatService.getChatById(chatId);
    
    if (!existingChat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    // Update the chat
    const updates = {
      title: updateData.title,
      description: updateData.description,
      status: updateData.status,
      metadata: updateData.metadata
    };
    
    const updatedChat = await chatService.updateChat(chatId, updates);
    
    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Failed to update chat' },
        { status: 500 }
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
 * DELETE handler - delete chat
 */
export async function DELETE(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    console.log(`API DEBUG: DELETE multi-agent/system/chats/${awaitedParams.chatId}`);
    
    const { chatId  } = await params;
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    const chatService = await getChatService();
    
    // Check if chat exists
    const existingChat = await chatService.getChatById(chatId);
    
    if (!existingChat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    // Delete the chat
    const result = await chatService.deleteChat(chatId);
    
    if (!result) {
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
    console.error(`Error deleting chat ${awaitedParams.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 