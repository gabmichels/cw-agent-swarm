import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';

// Make sure this is server-side only
export const runtime = 'nodejs';

/**
 * GET handler for checking if the endpoint is available
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Message API is available',
    timestamp: new Date().toISOString()
  });
}

/**
 * DELETE handler to remove a message by ID or timestamp
 * Prefers ID-based deletion for precision but falls back to timestamp for backwards compatibility
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get parameters from URL
    const url = new URL(request.url);
    const messageId = url.searchParams.get('messageId') || url.searchParams.get('id');
    const timestamp = url.searchParams.get('timestamp');
    
    console.log('Delete message request:', { messageId, timestamp });
    
    if (!messageId && !timestamp) {
      return NextResponse.json(
        { error: 'Missing required parameter: either messageId/id or timestamp must be provided' },
        { status: 400 }
      );
    }
    
    // Get memory services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    // Initialize memory services if needed
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }
    
    // If we have a direct ID, use it for deletion (most precise)
    if (messageId) {
      console.log(`Deleting message by ID: ${messageId}`);
      
      try {
        const deleteResult = await memoryService.deleteMemory({
          id: messageId,
          type: MemoryType.MESSAGE
        });
        
        if (deleteResult) {
          return NextResponse.json({
            success: true,
            message: 'Message deleted successfully',
            deletedId: messageId
          });
        } else {
          return NextResponse.json(
            { success: false, error: `Failed to delete message with ID: ${messageId}` },
            { status: 500 }
          );
        }
      } catch (error) {
        console.error(`Error deleting message with ID ${messageId}:`, error);
        return NextResponse.json(
          { success: false, error: 'Delete operation failed', details: error instanceof Error ? error.message : String(error) },
          { status: 500 }
        );
      }
    }
    
    // Otherwise, search by timestamp (fallback approach)
    if (timestamp) {
      console.log(`Searching for message with timestamp: ${timestamp}`);
      
      // Search for the exact message by timestamp
      const searchResults = await searchService.search('', {
        types: [MemoryType.MESSAGE],
        limit: 100
      });
      
      // Map results to simpler objects
      const memories = searchResults
        .map(result => result.point)
        .filter(point => {
          // Check if it's the message we're looking for by exact ISO string comparison
          const pointTimestamp = point.payload?.timestamp;
          if (!pointTimestamp) return false;
          
          // Try various timestamp formats for comparison
          return (
            // Direct string comparison
            pointTimestamp === timestamp ||
            // Convert both to date objects and compare
            (new Date(pointTimestamp)).toISOString() === (new Date(timestamp)).toISOString() ||
            // Convert numeric timestamps
            parseInt(String(pointTimestamp), 10) === parseInt(String(timestamp), 10)
          );
        });
      
      console.log(`Found ${memories.length} messages with matching timestamp`);
      
      // Get the first matching message
      const messageToDelete = memories[0];
      
      if (!messageToDelete) {
        console.log(`No message found with timestamp: ${timestamp}`);
        return NextResponse.json(
          { success: false, error: 'Message not found' },
          { status: 404 }
        );
      }
      
      console.log(`Deleting message with ID: ${messageToDelete.id}, timestamp: ${messageToDelete.payload?.timestamp}`);
      
      // Delete the message
      try {
        const deleteResult = await memoryService.deleteMemory({
          id: messageToDelete.id,
          type: MemoryType.MESSAGE
        });
        
        if (deleteResult) {
          return NextResponse.json({
            success: true,
            message: 'Message deleted successfully',
            deletedId: messageToDelete.id
          });
        } else {
          return NextResponse.json(
            { success: false, error: `Failed to delete message with ID: ${messageToDelete.id}` },
            { status: 500 }
          );
        }
      } catch (error) {
        console.error(`Error deleting message with ID ${messageToDelete.id}:`, error);
        return NextResponse.json(
          { success: false, error: 'Delete operation failed', details: error instanceof Error ? error.message : String(error) },
          { status: 500 }
        );
      }
    }
    
    // This should not be reached
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in DELETE message handler:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred while processing your request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 