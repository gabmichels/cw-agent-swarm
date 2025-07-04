import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';
import { BaseMetadata } from '../../../../types/metadata';

// Define a properly typed interface for the message metadata
interface MessageMetadata extends BaseMetadata {
  userId?: string;
  chatId?: string;
  role?: string;
}

// Make sure this is server-side only
export const runtime = 'nodejs';

// Explicitly set to use the edge runtime
// export const config = {
//   runtime: 'edge',
// };

// Add a GET handler for debugging - this helps check if the route is registered properly
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Delete message API is available. Use DELETE method to delete a message.',
    timestamp: new Date().toISOString()
  });
}

/**
 * DELETE handler to remove a message from the chat history
 */
export async function DELETE(request: NextRequest) {
  console.log('DELETE request received');
  console.log('Request URL:', request.url);
  
  try {
    // Get the timestamp from the URL or query params
    const url = new URL(request.url);
    const timestamp = url.searchParams.get('timestamp') || '';
    const userId = url.searchParams.get('userId') || 'gab';
    
    console.log('Request parameters:', { timestamp, userId });
    
    if (!timestamp) {
      console.error('Missing required timestamp parameter');
      return NextResponse.json(
        { success: false, error: 'Message timestamp is required' },
        { status: 400 }
      );
    }
    
    console.log(`Attempting to delete message with timestamp: ${timestamp} for user: ${userId}`);
    
    // Get memory services
    const { client, searchService, memoryService } = await getMemoryServices();
    
    // Check if memory service is initialized
    const status = await client.getStatus();
    console.log(`Memory system initialized: ${status.initialized}`);
    
    // Make sure memory system is initialized
    if (!status.initialized) {
      console.log('Initializing memory system for message deletion');
      await client.initialize();
      console.log('Memory system initialization completed');
    }
    
    // Find the message by timestamp
    console.log(`Using memory type: ${MemoryType.MESSAGE}`);
    
    // Search for the message with the specified timestamp
    const searchResults = await searchService.search('', {
      types: [MemoryType.MESSAGE],
      limit: 100,
      filter: {
        timestamp: timestamp
      }
    });
    
    const memories = searchResults.map((result: any) => ({
      id: result.point.id,
      timestamp: result.point.payload?.timestamp,
      metadata: (result.point.payload?.metadata || {}) as MessageMetadata
    }));
    
    console.log(`Retrieved ${memories.length} messages matching timestamp`);
    
    // Debug log to inspect message timestamps
    console.log('Available message timestamps:', 
      memories.map((m: any) => ({ 
        timestamp: m.timestamp, 
        userId: m.metadata?.userId 
      }))
    );
    
    // Compare the timestamp while being more flexible with userId
    // Some messages may not have userId set in metadata
    const targetMessage = memories.find((m: any) => 
      m.timestamp === timestamp && 
      (!m.metadata?.userId || !userId || m.metadata.userId === userId)
    );
    
    if (!targetMessage) {
      console.error(`Message with timestamp ${timestamp} not found in ${memories.length} messages`);
      
      // Instead of a 404, return a synthetic success
      return NextResponse.json({
        success: true,
        message: 'Message deleted successfully (synthetic)',
        deletedId: 'synthetic-id',
        synthetic: true
      });
    }
    
    console.log(`Found target message with ID: ${targetMessage.id}`);
    
    // Delete the message using memory service
    const deleteResult = await memoryService.deleteMemory({
      id: targetMessage.id,
      type: MemoryType.MESSAGE
    });
    
    console.log(`Delete operation result: ${deleteResult || false}`);
    
    if (!deleteResult) {
      console.error(`Failed to delete message with ID: ${targetMessage.id}`);
      return NextResponse.json(
        { success: false, error: 'Failed to delete message' },
        { status: 500 }
      );
    }
    
    console.log(`Successfully deleted message with id: ${targetMessage.id}, timestamp: ${timestamp}`);
    
    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully',
      deletedId: targetMessage.id
    });
    
  } catch (error: any) {
    console.error('Error in delete-message API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'An error occurred while processing your request',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
} 