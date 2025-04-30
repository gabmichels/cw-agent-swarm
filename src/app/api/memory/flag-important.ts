import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../server/qdrant';
import { MemoryRecord } from '../../../server/qdrant';
import { ImportanceLevel } from '../../../constants/memory';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, timestamp } = body;

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    // Initialize Qdrant if necessary
    if (!serverQdrant.isInitialized()) {
      await serverQdrant.initMemory({
        connectionTimeout: 10000 // 10 seconds
      });
    }

    // First search for the message to check if it exists
    // This is a simplified approach - in production you might want more precise matching
    const existingMessages = await serverQdrant.searchMemory('message', content.substring(0, 100), {
      limit: 5
    });

    let targetMessage: MemoryRecord | null = null;
    
    // Try to find the message that matches our criteria
    if (existingMessages.length > 0) {
      // If timestamp was provided, try to match it
      if (timestamp) {
        targetMessage = existingMessages.find(m => 
          m.timestamp === timestamp || 
          (new Date(m.timestamp).getTime() - new Date(timestamp).getTime() < 1000)
        ) || null;
      }
      
      // If no match by timestamp or timestamp wasn't provided, use the first result
      if (!targetMessage) {
        targetMessage = existingMessages[0];
      }
    }

    if (targetMessage) {
      console.log(`Found existing message to flag as important: ${targetMessage.id}`);
      
      // Update the message importance in Qdrant
      // Since direct update isn't easily available, we'll copy all metadata and add the message again
      const metadata = {
        ...(targetMessage.metadata || {}),
        importance: ImportanceLevel.HIGH, // Ensure it's marked as high importance
        flaggedImportant: true,
        flaggedAt: new Date().toISOString()
      };
      
      // Add the flagged message to memory
      await serverQdrant.addMemory(
        'message',
        targetMessage.text,
        metadata
      );
      
      return NextResponse.json({ 
        success: true, 
        message: 'Message flagged as highly important' 
      });
    } else {
      // If message doesn't exist, create a new memory entry with high importance
      console.log('Creating new high importance memory from content');
      
      // Add as a new memory with high importance
      await serverQdrant.addMemory(
        'message',
        content,
        {
          importance: ImportanceLevel.HIGH,
          flaggedImportant: true,
          flaggedAt: new Date().toISOString(),
          source: 'user_flagged',
          role: 'system', // Mark as system to distinguish from user messages
          type: 'flagged_content'
        }
      );
      
      return NextResponse.json({ 
        success: true, 
        message: 'Content stored as highly important memory' 
      });
    }
  } catch (error) {
    console.error('Error flagging message as important:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to flag message as important' },
      { status: 500 }
    );
  }
} 