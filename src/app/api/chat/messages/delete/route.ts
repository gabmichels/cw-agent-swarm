import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../server/memory/services';
import { MemoryType } from '../../../../../server/memory/config';
import { BaseMetadata } from '../../../../../types/metadata';

// Define a properly typed interface for the message metadata
interface MessageMetadata extends BaseMetadata {
  userId?: string;
  chatId?: string;
  role?: string;
}

// Define a properly typed interface for memory objects
interface MemoryItem {
  id: string;
  timestamp?: string;
  metadata: MessageMetadata;
}

// Make sure this is server-side only
export const runtime = 'nodejs';

/**
 * GET handler for testing route availability
 */
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
  console.log('DELETE request received in messages/delete');
  
  try {
    // Get the request body
    const body = await request.json();
    const { messageId, timestamp, userId = 'gab' } = body;
    
    console.log('Request parameters:', { messageId, timestamp, userId });
    
    if (!messageId && !timestamp) {
      console.error('Missing required parameters');
      return NextResponse.json(
        { success: false, error: 'Either messageId or timestamp is required' },
        { status: 400 }
      );
    }
    
    // Get memory services
    const { client, searchService, memoryService } = await getMemoryServices();
    
    // Check if memory service is initialized
    const status = await client.getStatus();
    console.log(`Memory system initialized: ${status.initialized}`);
    
    // Make sure memory system is initialized
    if (!status.initialized) {
      console.log('Initializing memory system for message deletion');
      await client.initialize();
    }
    
    let memories: MemoryItem[] = [];
    
    // Find the message by id or timestamp
    if (messageId) {
      // Get memory directly by ID
      const memory = await memoryService.getMemory({
        id: messageId,
        type: MemoryType.MESSAGE
      });
      
      if (memory) {
        memories = [{
          id: memory.id || messageId,
          timestamp: memory.payload?.timestamp,
          metadata: (memory.payload?.metadata || {}) as MessageMetadata
        }];
      }
    } else if (timestamp) {
      // Search for the message with the specified timestamp
      const searchResults = await searchService.search('', {
        types: [MemoryType.MESSAGE],
        limit: 10,
        filter: {
          timestamp
        }
      });
      
      memories = searchResults.map((result: any) => ({
        id: result.point.id,
        timestamp: result.point.payload?.timestamp,
        metadata: (result.point.payload?.metadata || {}) as MessageMetadata
      }));
    }
    
    console.log(`Retrieved ${memories.length} messages`);
    
    // Find the specific message, filtering by userId if provided
    const targetMessage = memories.find((m: any) => 
      (!m.metadata?.userId || !userId || m.metadata.userId === userId)
    );
    
    if (!targetMessage) {
      console.error(`Message with ID ${messageId} or timestamp ${timestamp} not found`);
      
      // Return actual error instead of fake success
      return NextResponse.json(
        { 
          success: false, 
          error: 'Message not found',
          messageId: messageId || `timestamp-${timestamp}`
        },
        { status: 404 }
      );
    }
    
    console.log(`Found target message with ID: ${targetMessage.id}`);
    
    // Delete the message using memory service
    const deleteResult = await memoryService.deleteMemory({
      id: targetMessage.id,
      type: MemoryType.MESSAGE
    });
    
    if (!deleteResult) {
      console.error(`Failed to delete message with ID: ${targetMessage.id}`);
      return NextResponse.json(
        { success: false, error: 'Failed to delete message' },
        { status: 500 }
      );
    }
    
    console.log(`Successfully deleted message with ID: ${targetMessage.id}`);
    
    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully',
      deletedId: targetMessage.id
    });
    
  } catch (error: any) {
    console.error('Error in messages/delete API:', error);
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