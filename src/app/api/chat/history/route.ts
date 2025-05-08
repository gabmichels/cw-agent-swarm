import { NextResponse } from 'next/server';
import { getChatService } from '../../../../server/memory/services/chat-service';

// Import types needed for proper typing
import { Message } from '../../../../lib/multi-agent/types/message';

// Add server-only markers to prevent client-side execution
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Define interface for message service to avoid direct import that's causing issues
interface MessageService {
  getMessagesByChatId: (chatId: string, options: { 
    limit: number;
    skip: number;
    sortDirection: 'asc' | 'desc';
  }) => Promise<{
    success: boolean;
    data: Message[];
    error?: string;
  }>;
  getMessagesByLegacyChatId: (chatId: string, options: {
    limit: number;
    skip: number;
    sortDirection: 'asc' | 'desc';
  }) => Promise<{
    success: boolean;
    data: Message[];
    error?: string;
  }>;
}

// Mock function for getting message service until the actual import works
async function createMessageService(_: null): Promise<MessageService> {
  // This is a temporary placeholder implementation
  // The real implementation would come from the actual imported service
  return {
    getMessagesByChatId: async (chatId: string, options) => {
      // Placeholder implementation returns empty data
      console.log(`Mock getMessagesByChatId called for ${chatId}`);
      return { success: true, data: [] };
    },
    getMessagesByLegacyChatId: async (chatId: string, options) => {
      // Placeholder implementation returns empty data
      console.log(`Mock getMessagesByLegacyChatId called for ${chatId}`);
      return { success: true, data: [] };
    }
  };
}

/**
 * GET handler for chat history endpoint
 * Retrieves chat history from the memory system
 */
export async function GET(req: Request) {
  try {
    console.log('GET /api/chat/history - Retrieving chat history');
    
    // Parse query parameters
    const url = new URL(req.url);
    const chatId = url.searchParams.get('chatId');
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 100;
    const skip = url.searchParams.get('skip') ? parseInt(url.searchParams.get('skip')!, 10) : 0;
    
    // Validate chatId parameter
    if (!chatId) {
      console.log('No chatId provided, falling back to compatibility mode');
      // For backward compatibility, use hardcoded chat ID
      return getCompatibilityChatHistory('chat-chloe-gab');
    }
    
    console.log(`Retrieving chat history for chatId: ${chatId}`);
    
    // Get chat service to verify chat exists
    const chatService = await getChatService();
    const chat = await chatService.getChatById(chatId);
    
    if (!chat) {
      console.log(`Chat not found: ${chatId}`);
      return NextResponse.json(
        { status: 'error', error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    // Get message service
    const messageService = await createMessageService(null);
    
    // Get messages for chat
    const messageResults = await messageService.getMessagesByChatId(chatId, {
      limit,
      skip,
      sortDirection: 'asc' // oldest first
    });
    
    if (!messageResults.success) {
      throw new Error(messageResults.error || 'Failed to retrieve messages');
    }
    
    // Format the messages for display
    const formattedHistory = messageResults.data.map((message: Message) => ({
      id: message.id,
      content: message.content,
      sender: message.role === 'user' ? 'You' : message.metadata?.senderName || 'Agent',
      timestamp: message.createdAt,
      attachments: message.attachments || []
    }));
    
    console.log(`Returning ${formattedHistory.length} formatted messages, sorted oldest to newest`);
    
    return NextResponse.json({
      status: 'success',
      history: formattedHistory,
      totalLoaded: formattedHistory.length,
      hasMore: formattedHistory.length === limit
    });
  } catch (error) {
    console.error('Error in chat history GET handler:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function for backward compatibility with old chat history format
 */
async function getCompatibilityChatHistory(chatId: string) {
  try {
    // Get message service
    const messageService = await createMessageService(null);
    
    // Get messages for chat using compatibility mode
    const messageResults = await messageService.getMessagesByLegacyChatId(chatId, {
      limit: 1000,
      skip: 0,
      sortDirection: 'asc'
    });
    
    if (!messageResults.success) {
      throw new Error(messageResults.error || 'Failed to retrieve legacy messages');
    }
    
    // Format the messages for display
    const formattedHistory = messageResults.data.map((message: Message) => ({
      id: message.id,
      content: message.content,
      sender: message.role === 'user' ? 'You' : 'Chloe',
      timestamp: message.createdAt,
      attachments: message.attachments || []
    }));
    
    console.log(`Returning ${formattedHistory.length} formatted legacy messages`);
    
    return NextResponse.json({
      status: 'success',
      history: formattedHistory,
      totalLoaded: formattedHistory.length
    });
  } catch (error) {
    console.error('Error in compatibility chat history:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 