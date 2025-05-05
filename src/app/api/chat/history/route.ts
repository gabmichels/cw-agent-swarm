import { NextResponse } from 'next/server';
import { loadChatHistoryFromQdrant } from '../proxy';

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
    
    // Use a default user ID
    const userId = 'gab';
    
    // Load chat history from Qdrant
    const result = await loadChatHistoryFromQdrant(userId);
    const { messagesByUser, totalMessagesLoaded, userCount, error } = result;
    
    // Get messages for the specific user
    const userMessages = messagesByUser.get(userId) || [];
    
    // Format messages for chat interface
    const formattedHistory = userMessages.map((message: any) => {
      try {
        const payload = message.payload || {};
        const metadata = payload.metadata || {};
        
        // Debug the timestamp
        console.log(`Message ID: ${message.id}, Raw timestamp: ${payload.timestamp || message.timestamp || 'none'}`);
        
        // Try to get timestamp from various possible locations
        let timestamp: Date;
        try {
          if (payload.timestamp) {
            timestamp = new Date(payload.timestamp);
            if (isNaN(timestamp.getTime())) {
              // If timestamp is invalid, try parsing it as a number
              const numericTimestamp = parseInt(payload.timestamp);
              if (!isNaN(numericTimestamp)) {
                timestamp = new Date(numericTimestamp);
              } else {
                // If still invalid, use current time
                timestamp = new Date();
              }
            }
          } else if (message.timestamp) {
            timestamp = new Date(message.timestamp);
            if (isNaN(timestamp.getTime())) {
              // If timestamp is invalid, try parsing it as a number
              const numericTimestamp = parseInt(message.timestamp);
              if (!isNaN(numericTimestamp)) {
                timestamp = new Date(numericTimestamp);
              } else {
                // If still invalid, use current time
                timestamp = new Date();
              }
            }
          } else {
            // Fallback to current time if no timestamp available
            timestamp = new Date();
          }
        } catch (e) {
          console.error("Error parsing timestamp:", e);
          timestamp = new Date();
        }
        
        return {
          id: message.id,
          content: payload.text || '',
          sender: metadata.role === 'user' ? 'You' : 'Chloe',
          timestamp: timestamp,
          attachments: metadata.attachments || [],
          visionResponseFor: metadata.visionResponseFor
        };
      } catch (error) {
        console.error('Error formatting message:', error);
        return null;
      }
    }).filter(Boolean);
    
    // Sort messages by timestamp
    formattedHistory.sort((a: any, b: any) => {
      const timeA = a.timestamp ? a.timestamp.getTime() : 0;
      const timeB = b.timestamp ? b.timestamp.getTime() : 0;
      return timeA - timeB;
    });
    
    console.log(`Returning ${formattedHistory.length} chat history messages for user ${userId}`);
    
    return NextResponse.json({
      status: 'success',
      history: formattedHistory,
      totalLoaded: totalMessagesLoaded,
      error: error || undefined
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