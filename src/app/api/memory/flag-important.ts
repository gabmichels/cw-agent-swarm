import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../server/memory/services';
import { ImportanceLevel } from '../../../server/memory/config';
import { MemoryType } from '../../../server/memory/config';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, timestamp } = body;

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    // Initialize memory services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    // Ensure memory system is initialized
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }

    // First search for the message to check if it exists
    // This is a simplified approach - in production you might want more precise matching
    const searchResults = await searchService.search(content.substring(0, 100), {
      limit: 5,
      types: [MemoryType.MESSAGE]
    });

    let targetMemory = null;
    
    // Try to find the message that matches our criteria
    if (searchResults.length > 0) {
      // If timestamp was provided, try to match it
      if (timestamp) {
        targetMemory = searchResults.find((result: any) => {
          const messageTimestamp = result.point.payload?.timestamp || 
                                result.point.payload?.metadata?.timestamp;
          return messageTimestamp === timestamp || 
                (messageTimestamp && new Date(messageTimestamp).getTime() - new Date(timestamp).getTime() < 1000);
        });
      }
      
      // If no match by timestamp or timestamp wasn't provided, use the first result
      if (!targetMemory) {
        targetMemory = searchResults[0];
      }
    }

    if (targetMemory) {
      console.log(`Found existing message to flag as important: ${targetMemory.point.id}`);
      
      // Update the message importance using the memory service
      await memoryService.updateMemory({
        id: targetMemory.point.id,
        type: MemoryType.MESSAGE,
        metadata: {
          importance: ImportanceLevel.HIGH, // Ensure it's marked as high importance
          flaggedImportant: true,
          flaggedAt: new Date().toISOString()
        }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Message flagged as highly important' 
      });
    } else {
      // If message doesn't exist, create a new memory entry with high importance
      console.log('Creating new high importance memory from content');
      
      // Add as a new memory with high importance
      await memoryService.addMemory({
        type: MemoryType.MESSAGE,
        content: content,
        metadata: {
          userId: 'gab', // Ensure userId is set
          importance: ImportanceLevel.HIGH,
          flaggedImportant: true,
          flaggedAt: new Date().toISOString(),
          source: 'user_flagged',
          role: 'system', // Mark as system to distinguish from user messages
          type: 'flagged_content'
        }
      });
      
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