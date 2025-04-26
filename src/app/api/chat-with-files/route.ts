import { NextRequest, NextResponse } from 'next/server';
import { fileProcessor } from '../../../lib/file-processing/index';
import { POST as chatPost } from '../chat/route';
import * as serverQdrant from '../../../server/qdrant';
import process from 'process';

// Mark as server-only
export const runtime = 'nodejs';

/**
 * Get conversation history for a user
 */
async function getConversationHistory(userId: string) {
  try {
    // Try to load recent messages from Qdrant
    if (!serverQdrant.isInitialized()) {
      await serverQdrant.initMemory({
        connectionTimeout: 10000 // 10 seconds
      });
    }
    
    // Get recent messages, filter by userId
    const recentMessages = await serverQdrant.getRecentMemories('message', 10);
    const userMessages = recentMessages
      .filter(m => m.metadata && m.metadata.userId === userId)
      .map(m => ({
        role: m.metadata.role || 'user',
        content: m.text,
        timestamp: m.timestamp
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Keep only the most recent 5 messages to reduce context size
    return userMessages.slice(-5);
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

/**
 * Process a message with image files using a vision-enabled model
 */
async function processWithVisionModel(message: string, images: Array<{fileId: string, filename: string}>, userId: string) {
  try {
    console.log(`Processing ${images.length} images with vision model`);
    
    // Get conversation history for context
    const conversationHistory = await getConversationHistory(userId);
    
    // Create a prompt that includes the message and image information
    const promptWithImages = {
      message: message,
      images: images, // Now just passing fileIds for processing server-side
      userId: userId,
      conversationHistory: conversationHistory
    };
    
    // Call the vision API endpoint that handles base64 encoding
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const apiUrl = new URL('/api/vision', baseUrl).toString();
    console.log(`Calling vision API at: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(promptWithImages),
    });
    
    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('Error processing with vision model:', error);
    
    // Get detailed error information
    let errorMessage = error.message || 'Unknown error';
    if (error.cause) {
      console.error('Caused by:', error.cause);
      errorMessage += ` (${error.cause.message || 'Unknown cause'})`;
    }
    if (error.code) {
      console.error('Error code:', error.code);
      errorMessage += ` [${error.code}]`;
    }
    
    // Provide a more helpful error message to the user
    return {
      reply: `I encountered an error processing the images: ${errorMessage}. Could you try again or describe the image content?`,
      memory: [],
      thoughts: [`Error processing images: ${errorMessage}`, `Stack: ${error.stack || 'No stack trace'}`]
    };
  }
}

/**
 * POST handler for chat with files
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const message = formData.get('message') as string | null;
    const userId = formData.get('userId') as string || 'default-user';
    
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'No message provided' },
        { status: 400 }
      );
    }
    
    console.log(`Processing chat with files request from ${userId}: "${message}"`);
    
    // Initialize file processor if needed
    if (!fileProcessor.isInitialized) {
      await fileProcessor.initialize();
    }
    
    // Process each file in the form data
    const fileKeys = Array.from(formData.keys()).filter(key => key.startsWith('file_'));
    const processedFiles = [];
    const imageFiles = [];
    
    for (const key of fileKeys) {
      const file = formData.get(key) as File | null;
      
      if (!file) {
        console.warn(`No file found for key ${key}`);
        continue;
      }
      
      try {
        console.log(`Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);
        
        // Convert file to buffer
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        
        // If this is an image file, convert it to base64 for vision processing
        let base64Data = null;
        if (file.type.startsWith('image/')) {
          base64Data = fileBuffer.toString('base64');
        }
        
        // Create file metadata with proper structure
        const fileMetadata = {
          filename: file.name,
          originalFilename: file.name,
          mimeType: file.type,
          size: file.size,
          tags: [`user:${userId}`, 'source:chat']
        };
        
        // Process file using the correct parameter structure with appropriate options
        const result = await fileProcessor.processFile(fileBuffer, fileMetadata);
        
        // Get the base URL for files
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        
        // Track image files separately
        if (file.type.startsWith('image/')) {
          imageFiles.push({
            fileId: result.fileId,
            filename: file.name,
            base64Data: base64Data,
            mimeType: file.type
          });
        }
        
        processedFiles.push({
          filename: file.name,
          fileId: result.fileId,
          summary: result.summary
        });
      } catch (fileError: any) {
        console.error(`Error processing file ${file.name}:`, fileError);
        processedFiles.push({
          filename: file.name,
          error: fileError.message || 'Unknown error'
        });
      }
    }
    
    // If we have image files, use the vision model to process them
    if (imageFiles.length > 0) {
      console.log(`Processing ${imageFiles.length} image files with vision model`);
      
      // Check if the message contains an image-related request
      const containsImageRequest = /describe|what.*see|analyze|explain|tell.*about.*image|what.*in.*picture|what.*in.*image/i.test(message);
      
      if (containsImageRequest) {
        console.log("Image-related request detected. Prioritizing image analysis.");
      }
      
      const visionResponse = await processWithVisionModel(message, imageFiles, userId);
      
      // Return the response from the vision model
      return NextResponse.json({
        ...visionResponse,
        files: processedFiles,
        containsImageRequest // Include this flag for the client
      });
    }
    
    // For non-image files, proceed with standard processing
    // Create a new request with the message that includes file context
    let fileContext = '';
    if (processedFiles.length > 0) {
      // Make this more concise to save tokens
      const fileInfos = processedFiles.map(file => {
        if ('error' in file) {
          return `- ${file.filename} (Error: ${file.error})`;
        }
        
        // Truncate long summaries
        const summary = file.summary && file.summary.length > 200 
          ? file.summary.substring(0, 200) + "..." 
          : file.summary;
          
        return `- ${file.filename}${summary ? ` - Summary: ${summary}` : ''}`;
      }).join('\n');
      
      fileContext = `\n\n[SYSTEM: Files processed and stored: ${processedFiles.length}. ${processedFiles.length > 2 ? 'Key files' : 'Files'}: \n${fileInfos}]`;
    }
    
    // Create a new request object to pass to the standard chat endpoint
    const chatRequest = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Has-Attachments': 'true'
      },
      body: JSON.stringify({
        message: message + fileContext,
        userId: userId
      }),
    });
    
    // Process the chat request using the existing POST handler
    const chatResponse = await chatPost(chatRequest);
    const responseData = await chatResponse.json();
    
    // Return response with file information
    return NextResponse.json({
      ...responseData,
      files: processedFiles
    });
  } catch (error: any) {
    console.error('Error processing chat with files:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to process chat with files: ${error.message || 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
} 