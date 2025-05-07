import { NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';

// Add server-only markers to prevent client-side execution
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET handler for chat history endpoint
 * Retrieves chat history from the memory system
 */
export async function GET(req: Request) {
  try {
    console.log('GET /api/chat/history - Retrieving chat history');
    
    // Hardcoded values - skip all the parameter parsing
    const userId = 'gab';
    const chatId = 'chat-chloe-gab';
    
    console.log(`Retrieving chat history for hardcoded chatId: ${chatId}`);
    
    // Get memory services
    const { client, searchService } = await getMemoryServices();
    
    // Ensure memory services are initialized
    const status = await client.getStatus();
    
    if (!status.initialized) {
      console.log('Initializing memory services...');
      await client.initialize();
    }
    
    // Directly fetch all message memories
    console.log('Fetching ALL messages with no filters');
    const allSearchResults = await searchService.search("", {
      limit: 1000,
      types: [MemoryType.MESSAGE]
    });
    
    // Extract the actual messages
    const allMessages = allSearchResults.map((result: any) => result.point);
    console.log(`Retrieved ${allMessages.length} total messages`);
    
    // Manually filter to find messages with chatId "chat-chloe-gab"
    const filteredMessages = allMessages.filter((message: any) => {
      const payload = message.payload as any;
      const metadata = payload.metadata || {};
      
      // Log each message's chatId for debugging
      const messageChatId = typeof metadata.chatId === 'object' ? 
        `object:${metadata.chatId?.id || 'undefined'}` : 
        `string:${metadata.chatId || 'undefined'}`;
      
      console.log(`Message ${message.id}: chatId = ${messageChatId}`);
      
      // Check chatId in all possible formats
      if (typeof metadata.chatId === 'object' && metadata.chatId?.id === chatId) {
        console.log(`✅ MATCH - Message ${message.id} has matching chatId.id`);
        return true;
      }
      
      if (metadata.chatId === chatId) {
        console.log(`✅ MATCH - Message ${message.id} has matching chatId string`);
        return true;
      }
      
      return false;
    });
    
    console.log(`Filtered to ${filteredMessages.length} messages with chatId "${chatId}"`);
    
    // Format the messages for display
    const formattedHistory = filteredMessages.map((message: any) => {
      const payload = message.payload || {};
      const metadata = payload.metadata || {};
      
      // Use the original timestamp from the message payload
      const originalTimestamp = payload.timestamp || message.timestamp;
      
      // Log the original timestamp for debugging
      console.log(`Message ${message.id} original timestamp: ${originalTimestamp}`);
      
      return {
        id: message.id,
        content: payload.text || '',
        sender: metadata.role === 'user' ? 'You' : 'Chloe',
        timestamp: originalTimestamp, // Use the original timestamp directly
        attachments: metadata.attachments || []
      };
    });
    
    // Sort by timestamp (oldest first)
    formattedHistory.sort((a: any, b: any) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB; // Ascending order (oldest first)
    });
    
    console.log(`Returning ${formattedHistory.length} formatted messages, sorted oldest to newest`);
    
    return NextResponse.json({
      status: 'success',
      history: formattedHistory,
      totalLoaded: formattedHistory.length
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