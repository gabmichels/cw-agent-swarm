import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';
import fs from 'fs';
import path from 'path';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { userId = 'gab' } = data;

    console.log(`Attempting to clear images for user: ${userId}`);

    let successCount = 0;
    let errorCount = 0;

    // 1. Clear image data from the file system
    try {
      // The images are stored in data/files directory
      const filesDir = path.join(process.cwd(), 'data', 'files');
      const metadataPath = path.join(filesDir, 'file_metadata.json');

      // Check if the directory exists
      if (fs.existsSync(filesDir)) {
        // Read the metadata file to identify files to delete
        if (fs.existsSync(metadataPath)) {
          const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataContent);
          
          // Find files belonging to the user
          const userFiles = Object.entries(metadata).filter(([_, fileData]: [string, any]) => {
            const tags = fileData.tags || [];
            return tags.includes(`user:${userId}`) || tags.includes('user:gab');
          });
          
          console.log(`Found ${userFiles.length} files belonging to user ${userId}`);
          
          // Delete each file and remove from metadata
          for (const [fileId, fileData] of userFiles) {
            try {
              const filePath = path.join(filesDir, fileId);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted file: ${fileId}`);
              }
              
              // Remove from metadata
              delete metadata[fileId];
              successCount++;
            } catch (err) {
              console.error(`Failed to delete file ${fileId}:`, err);
              errorCount++;
            }
          }
          
          // Write updated metadata back to file
          fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
          console.log('Updated file metadata');
        } else {
          console.log('No metadata file found');
        }
      } else {
        console.log('Files directory does not exist');
      }
    } catch (err) {
      console.error('Error cleaning up file system:', err);
      errorCount++;
    }

    // 2. Update message records to remove attachment references
    try {
      // Get memory services
      const { client, memoryService, searchService } = await getMemoryServices();
      
      // Check if memory system is initialized
      const status = await client.getStatus();
      if (!status.initialized) {
        await client.initialize();
      }

      // Get all messages for this user
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
      
      const userMessages = allMessages.filter(msg => 
        msg.metadata && msg.metadata.userId === userId
      );

      console.log(`Found ${userMessages.length} messages for user ${userId}`);

      // Count messages with attachments
      const messagesWithAttachments = userMessages.filter(msg => 
        msg.metadata && 
        msg.metadata.attachments && 
        Array.isArray(msg.metadata.attachments) && 
        msg.metadata.attachments.length > 0
      );

      console.log(`${messagesWithAttachments.length} messages have attachments`);

      // Update all messages with attachments
      for (const msg of messagesWithAttachments) {
        try {
          // Create updated metadata without attachments
          const updatedMetadata = { ...msg.metadata };
          delete updatedMetadata.attachments;
          
          // Remove vision response references
          if (updatedMetadata.visionResponseFor) {
            delete updatedMetadata.visionResponseFor;
          }
          
          // Update the memory with the new metadata
          await memoryService.updateMemory({
            id: msg.id,
            type: MemoryType.MESSAGE,
            metadata: updatedMetadata
          });
          
          successCount++;
        } catch (updateErr) {
          console.error(`Error updating message ${msg.id}:`, updateErr);
          errorCount++;
        }
      }
      
      console.log('Updated message records in memory system');
    } catch (err) {
      console.error('Error updating memory records:', err);
      errorCount++;
    }

    return NextResponse.json({
      success: errorCount === 0,
      message: `Cleared image data for user ${userId}`,
      successCount,
      errorCount
    });
  } catch (error) {
    console.error('Error clearing images:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 