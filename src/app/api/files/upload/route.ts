import { NextRequest, NextResponse } from 'next/server';
import { fileProcessor } from '../../../../lib/file-processing';
import * as qdrantMemory from '../../../../server/qdrant';
import path from 'path';
import fs from 'fs';
import { createEnhancedMemory } from '@/lib/memory/src/enhanced-memory';
import { ImportanceLevel, MemorySource, MemoryType } from '@/constants/memory';

// Define types based on the qdrant memory module
// type MemoryType = 'message' | 'thought' | 'document' | 'task';
// type MemoryImportance = 'low' | 'medium' | 'high';
// type MemorySource = 'user' | 'system' | 'agent';

// Create an instance of the EnhancedMemory class
function createEnhancedMemoryAdapter() {
  // Use the factory function from the memory module
  return createEnhancedMemory('file-processor');
}

// Prepare memory for file storage
async function prepareMemory() {
  try {
    // Initialize Qdrant memory if needed
    if (!qdrantMemory.isInitialized()) {
      await qdrantMemory.initMemory();
    }
    return true;
  } catch (error) {
    console.error('Error initializing memory:', error);
    return false;
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
    
    // Prepare Qdrant memory
    const memoryReady = await prepareMemory();
    if (memoryReady) {
      console.log('Memory system initialized for file processing');
      // Create an enhanced memory adapter that wraps the qdrantMemory module
      const enhancedMemory = createEnhancedMemoryAdapter();
      fileProcessor.setEnhancedMemory(enhancedMemory);
    } else {
      console.warn('Memory system initialization failed, proceeding without memory integration');
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
    
    // Save files to the filesystem for image files
    if (result.metadata.mimeType.startsWith('image/')) {
      // Ensure directories exist
      const uploadsDir = path.join(process.cwd(), 'data', 'files', 'uploads');
      const storageDir = path.join(process.cwd(), 'data', 'files', 'storage');
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      
      // Save files to both directories
      const uploadPath = path.join(uploadsDir, result.metadata.fileId);
      const storagePath = path.join(storageDir, result.metadata.fileId);
      
      fs.writeFileSync(uploadPath, fileBuffer);
      fs.writeFileSync(storagePath, fileBuffer);
      
      console.log(`Image file saved to: ${uploadPath} and ${storagePath}`);
    }
    
    // If successful, send notification to Discord
    if (result.metadata.processingStatus === 'completed') {
      // Log file information for debugging
      console.log(`Successfully processed file: ${result.metadata.filename} (ID: ${result.metadata.fileId})`);
      
      // Additional logging for image files
      if (result.metadata.mimeType.startsWith('image/')) {
        console.log(`Image file stored: ${result.metadata.filename} (ID: ${result.metadata.fileId})`);
        
        // Verify file storage (for debugging)
        const uploadPath = path.join(process.cwd(), 'data', 'files', 'uploads', result.metadata.fileId);
        const storagePath = path.join(process.cwd(), 'data', 'files', 'storage', result.metadata.fileId);
        
        if (fs.existsSync(uploadPath)) {
          console.log(`✅ Image file verified in uploads: ${uploadPath}`);
        } else {
          console.warn(`❌ Image file NOT found in uploads: ${uploadPath}`);
        }
        
        if (fs.existsSync(storagePath)) {
          console.log(`✅ Image file verified in storage: ${storagePath}`);
        } else {
          console.warn(`❌ Image file NOT found in storage: ${storagePath}`);
        }
      }
      
      // Send notification asynchronously (don't await)
      sendDiscordNotification(result.metadata.filename, result.metadata.fileId);
    }
    
    // Return response
    return NextResponse.json({ 
      success: result.metadata.processingStatus === 'completed',
      fileId: result.metadata.fileId,
      filename: result.metadata.filename,
      status: result.metadata.processingStatus,
      error: result.metadata.processingError,
      summary: result.metadata.summary
    });
  } catch (error: any) {
    console.error('Error processing file upload:', error);
    
    return NextResponse.json(
      { success: false, error: `File upload failed: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 