import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';
import { MemoryRecord } from '../../../../server/qdrant';

export const runtime = 'nodejs';

/**
 * API endpoint to flag content as unreliable
 * This marks the content in the memory system to ensure it's not retrieved in future queries
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, messageId, timestamp } = body;

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    // Initialize Qdrant if necessary
    if (!serverQdrant.isInitialized()) {
      await serverQdrant.initMemory({
        connectionTimeout: 10000 // 10 seconds
      });
    }

    // Search for the message to check if it exists
    const existingMessages = await serverQdrant.searchMemory('message', content.substring(0, 100), {
      limit: 5
    });

    let targetMessage: MemoryRecord | null = null;
    
    // Try to find the message that matches our criteria
    if (existingMessages.length > 0) {
      // If messageId was provided, try to match by ID first
      if (messageId) {
        targetMessage = existingMessages.find(m => 
          m.id === messageId || 
          (m.metadata && m.metadata.messageId === messageId)
        ) || null;
      }
      
      // If no match by ID or ID wasn't provided, try to match by timestamp
      if (!targetMessage && timestamp) {
        targetMessage = existingMessages.find(m => 
          m.timestamp === timestamp || 
          (new Date(m.timestamp).getTime() - new Date(timestamp).getTime() < 1000)
        ) || null;
      }
      
      // If still no match, use content similarity as fallback
      if (!targetMessage) {
        // Get the first result as it should be the most similar
        targetMessage = existingMessages[0];
      }
    }

    // If we found the message, update its metadata to mark it as unreliable
    if (targetMessage) {
      console.log(`Found existing message to flag as unreliable: ${targetMessage.id}`);
      
      // Update the message metadata to mark it as unreliable
      const metadata = {
        ...(targetMessage.metadata || {}),
        flaggedUnreliable: true,
        flaggedUnreliableAt: new Date().toISOString(),
        unreliabilityReason: 'user_flagged',
        excludeFromRetrieval: true, // This is the key flag to exclude from future retrievals
        confidence: 0 // Set confidence to 0 to ensure it's not reranked highly
      };
      
      // Re-add the message with updated metadata (since direct update isn't easily available)
      await serverQdrant.addMemory(
        'message',
        targetMessage.text,
        metadata
      );
      
      return NextResponse.json({ 
        success: true, 
        message: 'Content flagged as unreliable and will be excluded from future retrievals' 
      });
    } else {
      // If message doesn't exist in memory yet, create a new entry with unreliable flag
      console.log('Creating new memory entry with unreliable flag');
      
      // Add as a new memory with unreliable flag
      await serverQdrant.addMemory(
        'message',
        content,
        {
          flaggedUnreliable: true,
          flaggedUnreliableAt: new Date().toISOString(),
          unreliabilityReason: 'user_flagged',
          excludeFromRetrieval: true,
          confidence: 0,
          source: 'user_flagged',
          role: 'system',
          messageId: messageId
        }
      );
      
      return NextResponse.json({ 
        success: true, 
        message: 'Content marked as unreliable and will be excluded from future retrievals' 
      });
    }
  } catch (error) {
    console.error('Error flagging content as unreliable:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to flag content as unreliable' },
      { status: 500 }
    );
  }
} 