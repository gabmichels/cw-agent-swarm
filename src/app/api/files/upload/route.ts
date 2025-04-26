import { NextRequest, NextResponse } from 'next/server';
import { fileProcessor } from '../../../../lib/file-processing';
import { EnhancedMemory } from '../../../../lib/memory/src/enhanced-memory';

// Get Chloe's enhanced memory instance
async function getEnhancedMemory() {
  try {
    // Dynamically import to avoid server/client module mismatches
    const { getChloeInstance } = await import('../../../../agents/chloe');
    const chloe = await getChloeInstance();
    
    if (!chloe) {
      console.error('Failed to get Chloe instance');
      return null;
    }
    
    return chloe.getEnhancedMemory();
  } catch (error) {
    console.error('Error getting enhanced memory:', error);
    return null;
  }
}

// Send notification to Discord
async function sendDiscordNotification(filename: string, fileId: string) {
  try {
    // Dynamically import to avoid server/client module mismatches
    const { getChloeInstance } = await import('../../../../agents/chloe');
    const chloe = await getChloeInstance();
    
    if (!chloe) {
      console.error('Failed to get Chloe instance for Discord notification');
      return;
    }
    
    // Check if Discord notifier is available
    chloe.notify(`New file added to memory: ${filename} (ID: ${fileId})`);
  } catch (error) {
    console.error('Error sending Discord notification:', error);
  }
}

/**
 * POST handler for file uploads
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize file processor if needed
    if (!fileProcessor.isInitialized) {
      await fileProcessor.initialize();
    }
    
    // Get enhanced memory instance
    const enhancedMemory = await getEnhancedMemory();
    if (enhancedMemory) {
      fileProcessor.setEnhancedMemory(enhancedMemory);
    }
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Extract tags if provided
    const tagsString = formData.get('tags') as string | null;
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()) : [];
    
    // Check file type
    const allowedTypes = [
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Unsupported file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}` 
        },
        { status: 400 }
      );
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { 
          success: false, 
          error: `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum allowed: 10MB` 
        },
        { status: 400 }
      );
    }
    
    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Create file metadata
    const fileMetadata = {
      filename: file.name,
      originalFilename: file.name,
      mimeType: file.type,
      size: file.size,
      tags
    };
    
    // Process the file
    const result = await fileProcessor.processFile(fileBuffer, fileMetadata);
    
    // If successful, send notification to Discord
    if (result.processingStatus === 'completed') {
      // Send notification asynchronously (don't await)
      sendDiscordNotification(result.filename, result.fileId);
    }
    
    // Return response
    return NextResponse.json({ 
      success: result.processingStatus === 'completed',
      fileId: result.fileId,
      filename: result.filename,
      status: result.processingStatus,
      error: result.processingError,
      summary: result.summary
    });
  } catch (error: any) {
    console.error('Error processing file upload:', error);
    
    return NextResponse.json(
      { success: false, error: `File upload failed: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 