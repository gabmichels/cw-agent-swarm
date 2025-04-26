import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';
import fs from 'fs';
import path from 'path';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { userId = 'default-user' } = data;

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
            return tags.includes(`user:${userId}`) || tags.includes('user:default-user');
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

    // 2. Update message records in Qdrant to remove attachment references
    try {
      // Initialize Qdrant if needed
      if (!serverQdrant.isInitialized()) {
        await serverQdrant.initMemory();
      }

      // Get all messages for this user
      const allMessages = await serverQdrant.getRecentMemories('message', 1000);
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

      // We can't easily update messages in Qdrant, so we'll delete and re-add them
      // First, get all messages (including from other users)
      const allMessagesAgain = await serverQdrant.getRecentMemories('message', 1000);
      
      // Reset the collection
      await serverQdrant.resetCollection('message');
      
      // Re-add all messages, but remove attachments from the user's messages
      for (const msg of allMessagesAgain) {
        if (msg.metadata && msg.metadata.userId === userId) {
          // Remove attachments from this user's messages
          if (msg.metadata.attachments) {
            delete msg.metadata.attachments;
          }
          // Remove vision response references
          if (msg.metadata.visionResponseFor) {
            delete msg.metadata.visionResponseFor;
          }
        }
        
        // Re-add the message
        await serverQdrant.addMemory('message', msg.text, msg.metadata);
      }
      
      console.log('Updated message records in Qdrant');
    } catch (err) {
      console.error('Error updating Qdrant records:', err);
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