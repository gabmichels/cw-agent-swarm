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
 * Process image with a vision-capable model (GPT-4.1)
 */
async function processWithVisionModel(message: string, imageData: Array<{data: string, mimeType: string}>, conversationHistory: any[] = []) {
  try {
    console.log(`Processing ${imageData.length} images with GPT-4.1 vision model`);
    
    // Format the conversation history for context (limited to save tokens)
    const formattedHistory = conversationHistory.slice(-3).map((msg: any) => ({
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
      ...formattedHistory.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: message },
          ...imageData.map((img: any) => ({
            type: 'image_url' as const,
            image_url: {
              url: `data:${img.mimeType};base64,${img.data}`,
              detail: ''
            }
          }))
        ]
      }
    ];
    
    console.log(`Calling GPT-4.1 with ${messages.length} messages and ${imageData.length} images`);
    
    // Call the OpenAI vision model
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL_NAME || "gpt-4.1-2025-04-14",
      messages: messages,
      max_tokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 1000,
      temperature: 0.5
    });
    
    const reply = response.choices[0]?.message?.content || 'No response from vision model';
    console.log(`GPT-4.1 response (first 100 chars): ${reply.substring(0, 100)}...`);
    console.log(`Total tokens used: ${response.usage?.total_tokens || 'unknown'}`);
    
    return {
      reply,
      thoughts: [`Processed ${imageData.length} images with GPT-4.1 vision model. Total tokens: ${response.usage?.total_tokens || 'unknown'}`]
    };
  } catch (error: any) {
    console.error('Error processing with vision model:', error);
    return {
      reply: `I encountered an error analyzing the images: ${error.message}. Please try again.`,
      thoughts: [`Error processing images with GPT-4.1: ${error.message}`]
    };
  }
}

/**
 * POST handler for vision requests
 * Processes messages that contain images using GPT-4.1
 */
export async function POST(request: NextRequest) {
  try {
    const { message, images, userId = 'gab', conversationHistory = [] } = await request.json();
    
    // Log more details about the request
    console.log(`Vision API request for user ${userId}:`);
    console.log(`- Message: "${message}"`);
    console.log(`- Images: ${images?.length || 0}`);
    console.log(`- Conversation history: ${conversationHistory?.length || 0} messages`);
    
    // Validate required fields
    if (!message) {
      console.error('Vision API error: No message provided');
      return NextResponse.json(
        { 
          success: false, 
          error: 'A message is required when processing images' 
        },
        { status: 400 }
      );
    }
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      console.error('Vision API error: No images provided or invalid images format');
      return NextResponse.json(
        { 
          success: false, 
          error: 'At least one valid image is required' 
        },
        { status: 400 }
      );
    }
    
    // Validate image data
    const validImages = [];
    
    for (let index = 0; index < images.length; index++) {
      const image = images[index];
      if (!image.base64Data || !image.mimeType) {
        console.error(`Vision API error: Image at index ${index} missing required data:`, {
          hasBase64: !!image.base64Data,
          hasMimeType: !!image.mimeType,
          fileId: image.fileId || 'not provided',
          filename: image.filename || 'not provided'
        });
        continue;
      }
      
      // Validate mime type is an image
      if (!image.mimeType.startsWith('image/')) {
        console.error(`Vision API error: Invalid mime type for image at index ${index}: ${image.mimeType}`);
        continue;
      }
      
      // Check if base64 data is valid
      if (typeof image.base64Data !== 'string' || image.base64Data.length < 100) {
        console.error(`Vision API error: Invalid or too small base64 data for image at index ${index}`);
        continue;
      }
      
      validImages.push({
        data: image.base64Data,
        mimeType: image.mimeType
      });
    }
    
    if (validImages.length === 0) {
      console.error('Vision API error: No valid images found after validation');
      return NextResponse.json(
        { 
          success: false, 
          error: 'No valid images found. Each image must include base64Data and a valid image mimeType.'
        },
        { status: 400 }
      );
    }
    
    console.log(`Processing ${validImages.length} valid images with the vision model`);
    
    // Initialize file processor if needed
    if (!fileProcessor.isInitialized) {
      await fileProcessor.initialize();
    }
    
    // Process with vision model
    const visionResponse = await processWithVisionModel(message, validImages, conversationHistory);
    
    return NextResponse.json({
      success: true,
      ...visionResponse,
      processedImages: validImages.length
    });
    
  } catch (error: any) {
    console.error('Error in vision API:', error);
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Unknown error';
    const errorStack = error.stack || 'No stack trace available';
    
    console.error('Vision API error details:');
    console.error('- Message:', errorMessage);
    console.error('- Stack:', errorStack);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Vision processing failed: ${errorMessage}`,
        details: process.env.NODE_ENV !== 'production' ? errorStack : undefined
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