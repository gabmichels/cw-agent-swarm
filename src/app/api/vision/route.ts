import { NextRequest, NextResponse } from 'next/server';
import { fileProcessor } from '../../../lib/file-processing/index';
import process from 'process';
import OpenAI from 'openai';

// Mark as server-only
export const runtime = 'nodejs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Process image with a vision-capable model (GPT-4o)
 */
async function processWithVisionModel(message: string, imageData: Array<{data: string, mimeType: string}>, conversationHistory: any[] = []) {
  try {
    console.log(`Processing ${imageData.length} images with GPT-4o vision model`);
    
    // Format the conversation history for context (limited to save tokens)
    const formattedHistory = conversationHistory.slice(-3).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content.length > 300 ? msg.content.substring(0, 300) + '...' : msg.content
    }));
    
    // Build the messages array with proper format for vision models
    const messages = [
      {
        role: 'system' as const,
        content: 'You are a helpful assistant with vision capabilities. When analyzing images:'
          + '\n- Provide detailed descriptions that focus on what the user is asking about'
          + '\n- If the message references previous conversation, consider that context'
          + '\n- Consider both the image content AND the user\'s message to give relevant answers'
          + '\n- If you see text in the images, read and include it in your analysis when relevant'
          + '\n- Respond in a natural conversational style'
      },
      ...formattedHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: message },
          ...imageData.map(img => ({
            type: 'image_url' as const,
            image_url: {
              url: `data:${img.mimeType};base64,${img.data}`
            }
          }))
        ]
      }
    ];
    
    console.log(`Calling GPT-4o with ${messages.length} messages and ${imageData.length} images`);
    
    // Call the OpenAI vision model
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Use GPT-4o which has integrated vision capabilities
      messages: messages,
      max_tokens: 1000,
    });
    
    const reply = response.choices[0]?.message?.content || 'No response from vision model';
    console.log(`GPT-4o response (first 100 chars): ${reply.substring(0, 100)}...`);
    console.log(`Total tokens used: ${response.usage?.total_tokens || 'unknown'}`);
    
    return {
      reply,
      thoughts: [`Processed ${imageData.length} images with GPT-4o vision model. Total tokens: ${response.usage?.total_tokens || 'unknown'}`]
    };
  } catch (error: any) {
    console.error('Error processing with vision model:', error);
    return {
      reply: `I encountered an error analyzing the images: ${error.message}. Please try again.`,
      thoughts: [`Error processing images with GPT-4o: ${error.message}`]
    };
  }
}

/**
 * POST handler for vision requests
 * Processes messages that contain images using GPT-4o
 */
export async function POST(request: NextRequest) {
  try {
    const { message, images, userId = 'default-user', conversationHistory = [] } = await request.json();
    
    if (!message || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Valid message and at least one image are required' 
        },
        { status: 400 }
      );
    }
    
    console.log(`Processing vision request for ${userId} with ${images.length} images: "${message}"`);
    console.log(`Conversation history: ${conversationHistory.length} messages`);
    
    // Initialize file processor if needed
    if (!fileProcessor.isInitialized) {
      await fileProcessor.initialize();
    }
    
    // This is a TEMPORARY WORKAROUND
    // Just to make things work, we'll have the chat-with-files endpoint send the entire file data in base64
    // In your actual implementation, you'll want to properly retrieve the file data from wherever it's stored
    
    try {
      // For now, we'll just use the incoming images data directly
      const processedImages = [];
      
      // Access the raw request data to check if base64Data was sent
      for (const image of images) {
        if (image.base64Data && image.mimeType) {
          // If the request already includes base64 data, use it directly
          processedImages.push({
            data: image.base64Data,
            mimeType: image.mimeType
          });
        }
      }
      
      if (processedImages.length === 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'No image data was provided. Please include base64 encoded image data with each image.'
          },
          { status: 400 }
        );
      }
      
      // Process with vision model
      const visionResponse = await processWithVisionModel(message, processedImages, conversationHistory);
      
      return NextResponse.json({
        success: true,
        ...visionResponse,
        processedImages: processedImages.length
      });
      
    } catch (error: any) {
      console.error('Error processing images:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: `Error processing images: ${error.message}`
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in vision API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Vision processing failed: ${error.message || 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to get file buffer from fileId
 * TODO: Implement this based on how files are actually stored in your system
 */
async function getFileBufferFromId(fileId: string): Promise<{buffer: Buffer, mimeType: string}> {
  // This is a placeholder. You need to implement actual file retrieval logic.
  // It should access wherever fileProcessor is actually storing the files.
  // Check fileProcessor documentation or implementation for details.
  throw new Error(`File retrieval not properly implemented. File ID: ${fileId}`);
}