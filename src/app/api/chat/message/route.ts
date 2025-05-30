import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';
import prisma from '@/lib/prisma';
import { getFileService } from '@/lib/storage';

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
 * Also deletes any file attachments associated with the message
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
    
    // Get the message to find any attachments
    let messageToDelete: any = null;
    
    // If we have a direct ID, use it for deletion (most precise)
    if (messageId) {
      console.log(`Finding message by ID: ${messageId}`);
      
      try {
        // Get the message first to check for attachments
        const message = await memoryService.getMemory({
          id: messageId,
          type: MemoryType.MESSAGE
        });
        
        if (message) {
          messageToDelete = message;
        } else {
          return NextResponse.json(
            { success: false, error: `Message not found with ID: ${messageId}` },
            { status: 404 }
          );
        }
      } catch (error) {
        console.error(`Error finding message with ID ${messageId}:`, error);
      }
    } else if (timestamp) {
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
          try {
            // Direct string comparison
            if (pointTimestamp === timestamp) return true;
            
            // Safely convert to date objects and compare - check if valid dates first
            const pointDate = new Date(pointTimestamp);
            const searchDate = new Date(timestamp);
            
            // Verify both dates are valid before ISO string conversion
            if (!isNaN(pointDate.getTime()) && !isNaN(searchDate.getTime())) {
              return pointDate.getTime() === searchDate.getTime();
            }
            
            // Numeric timestamp comparison (fallback)
            const pointNum = parseInt(String(pointTimestamp), 10);
            const searchNum = parseInt(String(timestamp), 10);
            if (!isNaN(pointNum) && !isNaN(searchNum)) {
              return pointNum === searchNum;
            }
            
            return false;
          } catch (error) {
            console.warn('Error comparing timestamps:', error);
            return false;
          }
        });
      
      console.log(`Found ${memories.length} messages with matching timestamp`);
      
      // Get the first matching message
      messageToDelete = memories[0];
      
      if (!messageToDelete) {
        console.log(`No message found with timestamp: ${timestamp}`);
        return NextResponse.json(
          { success: false, error: 'Message not found' },
          { status: 404 }
        );
      }
    }
    
    if (!messageToDelete) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }
    
    // Check for attachments in the message metadata
    try {
      const fileService = getFileService();
      const metadata = messageToDelete.metadata || {};
      const attachments = metadata.attachments || [];
      
      console.log(`Found ${attachments.length} attachments in message`);
      
      // Delete each attachment
      for (const attachment of attachments) {
        if (attachment.url) {
          // Extract the fileId from the URL or use a direct fileId if available
          let fileId = attachment.fileId;
          
          if (!fileId) {
            try {
              // Try to extract fileId from the URL - can have different formats:
              // 1. Direct filename: /api/files/123abc.jpg
              // 2. Full URL with file id as param: https://example.com/api/files?id=123abc.jpg
              // 3. Full URL with file id as path: https://example.com/api/files/123abc.jpg
              
              // First attempt to extract from path segments
              const url = new URL(attachment.url.startsWith('http') ? attachment.url : `http://example.com${attachment.url}`);
              const pathSegments = url.pathname.split('/').filter(Boolean);
              
              // Try the last path segment which might be the file
              if (pathSegments.length > 0) {
                const lastSegment = pathSegments[pathSegments.length - 1];
                
                // Check if it contains a file extension
                if (lastSegment.includes('.')) {
                  fileId = lastSegment;
                }
              }
              
              // If not found, try URL parameters
              if (!fileId) {
                const idParam = url.searchParams.get('id') || url.searchParams.get('fileId');
                if (idParam) {
                  fileId = idParam;
                }
              }
            } catch (error) {
              console.warn(`Failed to parse URL for attachment: ${attachment.url}`, error);
              // Fallback to the simple method
              fileId = attachment.url.split('/').pop();
            }
          }
          
          if (fileId) {
            try {
              // First check if this is a valid ID in our database
              let dbAttachment = await prisma.chatAttachment.findUnique({
                where: { fileId }
              });
              
              // If not found, try looking up by a more flexible approach
              if (!dbAttachment) {
                // Try to find by contained text - this might help if the URL format varies
                const potentialAttachments = await prisma.chatAttachment.findMany({
                  where: {
                    OR: [
                      { fileId: { contains: fileId } },
                      { storageUrl: { contains: fileId } }
                    ]
                  }
                });
                
                if (potentialAttachments.length > 0) {
                  dbAttachment = potentialAttachments[0];
                }
              }
              
              if (dbAttachment) {
                console.log(`Deleting file: ${dbAttachment.fileId}`);
                
                // Delete from storage
                await fileService.deleteFile(dbAttachment.fileId);
                
                // Delete from database
                await prisma.chatAttachment.delete({
                  where: { id: dbAttachment.id }
                });
                
                console.log(`Successfully deleted attachment: ${dbAttachment.fileId}`);
              } else {
                console.log(`No database record found for attachment: ${fileId}`);
              }
            } catch (error) {
              console.error(`Error deleting attachment ${fileId}:`, error);
              // Continue with other attachments even if one fails
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error processing attachments:', error);
      // Continue with message deletion even if attachment deletion fails
    }
    
    // Now delete the message
    console.log(`Deleting message with ID: ${messageToDelete.id}`);
    
    try {
      const deleteResult = await memoryService.deleteMemory({
        id: messageToDelete.id,
        type: MemoryType.MESSAGE
      });
      
      if (deleteResult) {
        return NextResponse.json({
          success: true,
          message: 'Message and attachments deleted successfully',
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
  } catch (error) {
    console.error('Error in DELETE message handler:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred while processing your request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 