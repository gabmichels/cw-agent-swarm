import { NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../../server/memory/services';
import { MemoryType } from '../../../../../../server/memory/config';
import { getChatService } from '../../../../../../server/memory/services/chat-service';
import { MessageMetadata } from '../../../../../../types/metadata';

/**
 * GET handler - get messages for a specific chat
 */
export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const chatId = params.chatId;
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeInternal = searchParams.get('includeInternal') === 'true';
    
    // First verify the chat exists
    const chatService = await getChatService();
    const chat = await chatService.getChatById(chatId);
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    // Get memory services
    const { searchService } = await getMemoryServices();
    
    // Search for messages with this chat ID
    const searchResults = await searchService.search("", {
      filter: {
        must: [
          { key: "type", match: { value: MemoryType.MESSAGE } },
          { key: "metadata.chatId.id", match: { value: chatId } }
        ],
        must_not: includeInternal ? [] : [
          { key: "metadata.isInternalMessage", match: { value: true } }
        ]
      },
      limit,
      offset,
      sort: { field: "timestamp", direction: "asc" }
    });
    
    // Format the messages
    const messages = searchResults.map(result => {
      const point = result.point;
      const payload = point.payload;
      // Properly type the metadata
      const metadata = (payload.metadata || {}) as MessageMetadata;
      
      // Log the raw data from Qdrant
      console.log('-------------------------');
      console.log('RAW QDRANT MESSAGE DATA:');
      console.log('Point ID:', point.id);
      console.log('Raw payload:', JSON.stringify(payload, null, 2));
      console.log('Raw timestamp:', payload.timestamp);
      console.log('Timestamp type:', typeof payload.timestamp);
      console.log('Timestamp value (if number):', typeof payload.timestamp === 'number' ? new Date(payload.timestamp).toISOString() : 'N/A');
      console.log('Timestamp value (if string):', typeof payload.timestamp === 'string' ? new Date(payload.timestamp).toISOString() : 'N/A');
      console.log('-------------------------');
      
      return {
        id: point.id,
        content: payload.text,
        sender: metadata.role === 'user' ? 'user' : 'agent',
        timestamp: payload.timestamp,
        metadata: metadata
      };
    });
    
    // Log the final messages being returned
    console.log('FINAL MESSAGES BEING RETURNED TO CLIENT:');
    messages.forEach((msg, idx) => {
      console.log(`Message ${idx + 1}:`, {
        id: msg.id,
        sender: msg.sender,
        timestamp: msg.timestamp,
        timestampISO: new Date(msg.timestamp).toISOString(),
        localTime: new Date(msg.timestamp).toLocaleTimeString()
      });
    });
    
    return NextResponse.json({
      chatId,
      messages,
      totalCount: messages.length,
      hasMore: messages.length === limit
    });
  } catch (error) {
    console.error(`Error retrieving messages for chat ${params.chatId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 