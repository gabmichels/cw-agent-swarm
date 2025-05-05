import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config/types';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { userId = 'gab', resetAll = false } = data;

    // Get memory services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    // Check if memory system is initialized
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }

    if (resetAll) {
      console.log('Performing complete database reset of all collections');
      
      // Reset all collections by iterating through all memory types
      let resetSuccessful = true;
      for (const type in MemoryType) {
        // Skip numeric enum values
        if (!isNaN(Number(type))) continue;
        
        try {
          // Get the collection name for this type
          const memoryTypeValue = MemoryType[type as keyof typeof MemoryType];
          // Create a fresh collection for each type (effectively resetting it)
          await client.createCollection(memoryTypeValue.toString(), 1536);
          console.log(`Reset collection for type: ${memoryTypeValue}`);
        } catch (error) {
          console.error(`Error resetting collection for type ${type}:`, error);
          resetSuccessful = false;
        }
      }
      
      return NextResponse.json({
        success: resetSuccessful,
        message: 'Successfully reset all memory collections',
        completeDatabaseReset: true
      });
    }
    
    console.log(`Attempting to reset chat history for user: ${userId}`);

    // Get all messages from the memory service
    const messageResults = await searchService.search('', {
      types: [MemoryType.MESSAGE],
      limit: 1000
    });
    
    // Convert search results to a more usable format
    const allMessages = messageResults.map(result => ({
      id: result.point.id,
      text: result.point.payload?.text || '',
      timestamp: result.point.payload?.timestamp,
      metadata: result.point.payload?.metadata || {}
    }));
    
    // Filter for this user's messages
    const userMessages = allMessages.filter(msg => 
      msg.metadata && msg.metadata.userId === userId
    );

    console.log(`Found ${userMessages.length} messages for user ${userId}`);

    // Delete user messages one by one
    let deletedCount = 0;
    for (const message of userMessages) {
      try {
        const deleteResult = await memoryService.deleteMemory({
          id: message.id,
          type: MemoryType.MESSAGE
        });
        
        if (deleteResult) {
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error deleting message ${message.id}:`, error);
      }
    }

    console.log(`Successfully deleted ${deletedCount} messages for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: `Successfully reset chat history for user ${userId}`,
      deletedMessageCount: deletedCount
    });
  } catch (error) {
    console.error('Error resetting chat history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 