import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';

/**
 * Debug endpoint to analyze timestamp issues
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    
    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }
    
    // Get memory services
    const { searchService } = await getMemoryServices();
    
    // Search for messages with this chat ID
    const searchResults = await searchService.search("", {
      filter: {
        must: [
          { key: "type", match: { value: MemoryType.MESSAGE } },
          { key: "metadata.chatId.id", match: { value: chatId } }
        ]
      },
      limit: 10,
      sort: { field: "timestamp", direction: "asc" }
    });
    
    // Get raw messages and analyze timestamps
    const messageAnalysis = searchResults.map(result => {
      const point = result.point;
      const payload = point.payload;
      const timestamp = payload.timestamp;
      
      // Analyze the timestamp
      let parsedDate;
      try {
        parsedDate = new Date(Number(timestamp));
      } catch (e) {
        parsedDate = null;
      }
      
      return {
        id: point.id,
        raw_timestamp: timestamp,
        timestamp_type: typeof timestamp,
        is_valid_number: !isNaN(Number(timestamp)),
        parsed_as_number: typeof timestamp === 'string' ? Number(timestamp) : timestamp,
        iso_string: parsedDate ? parsedDate.toISOString() : null,
        local_time: parsedDate ? parsedDate.toLocaleTimeString() : null,
        local_date: parsedDate ? parsedDate.toLocaleDateString() : null
      };
    });
    
    return NextResponse.json({
      message: 'Timestamp analysis',
      count: messageAnalysis.length,
      timestamps: messageAnalysis
    });
  } catch (error) {
    console.error('Error analyzing timestamps:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { 
      status: 500 
    });
  }
} 