import { NextRequest, NextResponse } from 'next/server';
import { fileProcessor } from '../../../lib/file-processing/index';
import { POST as chatPost } from '../chat/route';
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '../../../server/memory/config';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import process from 'process';
// Import necessary services for flagging
import { KnowledgeGraph } from '../../../lib/knowledge/KnowledgeGraph';
import { KnowledgeFlaggingService } from '../../../lib/knowledge/flagging/KnowledgeFlaggingService';
import path from 'path';
import fs from 'fs';

// Mark as server-only
export const runtime = 'nodejs';

// Define types for processed files
interface ProcessedFile {
  filename: string;
  fileId?: string;
  summary?: string;
  error?: string;
}

// Define types for memory records
interface MemoryRecord {
  id: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// File processing cache to prevent duplicate operations
// Key format: fileId:operation (e.g. "file123:read")
const fileOperationCache = new Map<string, {
  result: any;
  timestamp: number;
  expiry: number;
}>();

// Cache TTL (10 minutes)
const FILE_CACHE_TTL = 10 * 60 * 1000;

// Helper function to check and use file cache
function useFileCache<T>(fileId: string, operation: string, executor: () => T): T {
  const cacheKey = `${fileId}:${operation}`;
  const cachedResult = fileOperationCache.get(cacheKey);
  
  if (cachedResult && cachedResult.expiry > Date.now()) {
    console.log(`Using cached file operation result for ${cacheKey}, age: ${Math.round((Date.now() - cachedResult.timestamp) / 1000)}s`);
    return cachedResult.result;
  }
  
  // Execute the operation
  const result = executor();
  
  // Cache the result
  fileOperationCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
    expiry: Date.now() + FILE_CACHE_TTL
  });
  
  return result;
}

// --- Helper: Initialize Flagging Service --- 
// Avoid initializing multiple times per request if possible
let flaggingServiceInstance: KnowledgeFlaggingService | null = null;
async function getFlaggingService(): Promise<KnowledgeFlaggingService | null> {
    if (flaggingServiceInstance) {
        return flaggingServiceInstance;
    }
    try {
        // Assuming 'default' or a relevant domain for general file flagging
        const knowledgeGraph = new KnowledgeGraph('default'); 
        await knowledgeGraph.load(); // Ensure graph is loaded
        flaggingServiceInstance = new KnowledgeFlaggingService(knowledgeGraph);
        await flaggingServiceInstance.load(); // Load existing flagged items
        console.log("Initialized KnowledgeFlaggingService for file processing.");
        return flaggingServiceInstance;
    } catch (error) {
        console.error("Failed to initialize KnowledgeFlaggingService:", error);
        return null;
    }
}

// Function to ensure directory exists
const ensureDirectoryExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Function to save a file buffer to the filesystem
const saveFileToFS = (fileId: string, fileBuffer: Buffer, subdir: string = 'uploads'): string => {
  const dirPath = path.join(process.cwd(), 'data', 'files', subdir);
  ensureDirectoryExists(dirPath);
  
  const filePath = path.join(dirPath, fileId);
  fs.writeFileSync(filePath, fileBuffer);
  console.log(`Saved file to ${filePath}`);
  return filePath;
};

/**
 * Get conversation history for a user
 */
async function getConversationHistory(userId: string) {
  try {
    // Get services
    const { memoryService, searchService } = await getMemoryServices();
    
    // Search for messages related to this user with limit of 20
    const recentMessages = await searchService.search("", {
      limit: 20,
      types: [MemoryType.MESSAGE],
      filter: { userId }
    });
    
    // Convert to a more usable format
    const userMessages = recentMessages
      .map(result => {
        // Cast payload to any to access its properties
        const payload = result.point.payload as any;
        return {
          role: payload.role || 'user',
          content: payload.content || '',
          timestamp: payload.timestamp || new Date().toISOString(),
          importance: payload.importance || ImportanceLevel.MEDIUM
        };
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Prioritize important messages and keep more context
    // Get all high importance messages regardless of recency
    const highImportanceMessages = userMessages.filter(m => m.importance === ImportanceLevel.HIGH);
    
    // Get the most recent messages (up to 10)
    const recentContextMessages = userMessages.slice(-10);
    
    // Combine and deduplicate
    const allContextMessages = [...highImportanceMessages, ...recentContextMessages];
    const seenIds = new Set();
    const dedupedMessages = allContextMessages.filter(m => {
      const messageId = `${m.role}-${m.timestamp}`;
      if (seenIds.has(messageId)) return false;
      seenIds.add(messageId);
      return true;
    });
    
    // Sort by timestamp to ensure chronological order
    return dedupedMessages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

/**
 * Process a message with image files using a vision-enabled model
 */
async function processWithVisionModel(message: string, images: Array<{fileId: string, filename: string, mimeType?: string}>, userId: string) {
  try {
    console.log(`Processing ${images.length} images with vision model`);
    
    // Get conversation history for context
    const conversationHistory = await getConversationHistory(userId);
    
    // We need to fetch the actual image data for each image
    const processedImages = [];
    const failedImages = [];
    
    for (const image of images) {
      try {
        // Get file metadata
        const metadata = fileProcessor.getFileById(image.fileId);
        
        if (!metadata) {
          console.error(`File metadata not found for fileId: ${image.fileId}`);
          failedImages.push({id: image.fileId, reason: 'Metadata not found'});
          continue;
        }
        
        // Determine where the file should be stored
        const fileStoragePath = path.join(process.cwd(), 'data', 'files', 'uploads', image.fileId);
        
        let fileBuffer: Buffer;
        
        // Try to read the file from local storage
        if (fs.existsSync(fileStoragePath)) {
          fileBuffer = fs.readFileSync(fileStoragePath);
        } else {
          console.error(`File not found at expected path: ${fileStoragePath}. Attempting to recreate it.`);
          
          // Check if we can find it in the storage directory instead
          const storageFilePath = path.join(process.cwd(), 'data', 'files', 'storage', image.fileId);
          
          if (fs.existsSync(storageFilePath)) {
            // Found in storage, copy to uploads
            fileBuffer = fs.readFileSync(storageFilePath);
            // Save to uploads directory for future use
            saveFileToFS(image.fileId, fileBuffer, 'uploads');
          } else {
            console.error(`File not found in storage either: ${storageFilePath}`);
            failedImages.push({id: image.fileId, reason: 'File not found'});
            continue;
          }
        }
        
        // Convert buffer to base64
        const base64Data = fileBuffer.toString('base64');
        
        // Determine mime type from metadata or file extension
        const mimeType = metadata.mimeType || image.mimeType || 'image/jpeg';
        
        processedImages.push({
          base64Data,
          mimeType,
          fileId: image.fileId,
          filename: image.filename
        });
        
        console.log(`Successfully processed image: ${image.filename} (${mimeType})`);
      } catch (err: any) {
        console.error(`Error processing image ${image.fileId}:`, err);
        failedImages.push({id: image.fileId, reason: err.message || 'Unknown error'});
      }
    }
    
    if (processedImages.length === 0) {
      if (failedImages.length > 0) {
        const failureReasons = failedImages.map(img => `${img.id}: ${img.reason}`).join(', ');
        throw new Error(`Failed to process any of the provided images. Reasons: ${failureReasons}`);
      } else {
        throw new Error('Failed to process any of the provided images');
      }
    }
    
    // Create a prompt that includes the message and processed image data
    const promptWithImages = {
      message: message,
      images: processedImages,
      userId: userId,
      conversationHistory: conversationHistory
    };
    
    // Generate a timestamp for tracking the vision response relationship
    const requestTimestamp = new Date().toISOString();
    
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
    
    const responseData = await response.json();
    
    // Store this message in memory with proper metadata
    try {
      const { memoryService } = await getMemoryServices();
      
      // Add the user message with attachments
      await memoryService.addMemory({
        type: MemoryType.MESSAGE,
        content: message,
        metadata: {
          userId: userId || 'gab',
          role: 'user',
          source: MemorySource.USER,
          attachments: images.map(img => ({
            filename: img.filename,
            type: 'image',
            fileId: img.fileId
          })),
          timestamp: requestTimestamp,
          importance: ImportanceLevel.MEDIUM
        },
        payload: {
          userId,
          role: 'user',
          source: MemorySource.USER,
          attachments: images.map(img => ({
            filename: img.filename,
            type: 'image',
            fileId: img.fileId
          })),
          timestamp: requestTimestamp,
          importance: ImportanceLevel.MEDIUM
        }
      });
      
      console.log(`Saved user message with images to memory with timestamp: ${requestTimestamp}`);
      
      // Add the assistant's response with reference to the user's message
      await memoryService.addMemory({
        type: MemoryType.MESSAGE,
        content: responseData.reply,
        metadata: {
          userId: userId || 'gab',
          role: 'assistant',
          source: MemorySource.AGENT,
          visionResponseFor: requestTimestamp,
          importance: ImportanceLevel.MEDIUM
        },
        payload: {
          userId,
          role: 'assistant',
          source: MemorySource.AGENT,
          visionResponseFor: requestTimestamp,
          importance: ImportanceLevel.MEDIUM
        }
      });
      
      console.log(`Saved assistant vision response to memory with reference to: ${requestTimestamp}`);
    } catch (error) {
      console.error('Error saving vision conversation to memory:', error);
      // Continue anyway, non-critical error
    }
    
    return {
      ...responseData,
      requestTimestamp // Include the timestamp for the client to use
    };
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
    const formData = await request.formData();
    const message = formData.get('message') as string | null;
    const userId = formData.get('userId') as string || 'gab';
    
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'No message provided' },
        { status: 400 }
      );
    }
    
    console.log(`Processing chat with files request from ${userId}: "${message}"`);
    
    if (!fileProcessor.isInitialized) {
      await fileProcessor.initialize();
    }
    
    const fileKeys = Array.from(formData.keys()).filter(key => key.startsWith('file_'));
    const processedFilesData: Array<{ metadata: any, fullText: string | null }> = []; // To store results
    const imageFiles = []; // For vision model

    for (const key of fileKeys) {
      const file = formData.get(key) as File | null;
      if (!file) continue;
      
      try {
        const index = parseInt(key.replace('file_', ''));
        const typeKey = `metadata_${index}_type`;
        const fileIdKey = `metadata_${index}_fileId`; // Although we generate a new one in processFile
        const fileType = formData.get(typeKey) as string || '';

        console.log(`Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        
        const fileMetadataInput = {
          filename: file.name,
          originalFilename: file.name,
          mimeType: file.type,
          size: file.size,
          tags: [`user:${userId}`, 'source:chat']
        };
        
        // Process file, get metadata AND full text
        const { metadata: processedMetadata, fullText } = await fileProcessor.processFile(
            fileBuffer, 
            fileMetadataInput
        );

        // Save the file to filesystem for later retrieval
        if (file.type.startsWith('image/')) {
          saveFileToFS(processedMetadata.fileId, fileBuffer, 'uploads');
          
          // Also save to storage for the view API
          saveFileToFS(processedMetadata.fileId, fileBuffer, 'storage');
        } else {
          // For non-image files, just save to storage
          saveFileToFS(processedMetadata.fileId, fileBuffer, 'storage');
        }

        // Store result for later flagging and response
        processedFilesData.push({ metadata: processedMetadata, fullText });

        // Separate images for vision model if needed
        if (file.type.startsWith('image/')) {
          imageFiles.push({
            fileId: processedMetadata.fileId, // Use the ID generated by fileProcessor
            filename: file.name,
            mimeType: file.type
          });
        }
      } catch (fileError: any) {
        console.error(`Error processing file ${file.name}:`, fileError);
        // Still add metadata even if processing failed, for reporting
         processedFilesData.push({ 
             metadata: { 
                 filename: file.name, 
                 processingStatus: 'failed', 
                 processingError: fileError.message || 'Unknown error' 
             }, 
             fullText: null 
         });
      }
    }
    
    // --- Vision Model Handling (remains mostly the same) --- 
    if (imageFiles.length > 0) {
        console.log(`Processing ${imageFiles.length} image files with vision model`);
        const containsImageRequest = /describe|what.*see|analyze|explain|tell.*about.*image|what.*in.*picture|what.*in.*image/i.test(message);
        if (containsImageRequest) {
            console.log("Image-related request detected. Prioritizing image analysis.");
        }
        const visionResponse = await processWithVisionModel(message, imageFiles, userId);
        // Note: We aren't flagging image content in this flow yet.
         return NextResponse.json({
            ...visionResponse,
            files: processedFilesData.map(p => p.metadata), // Return only metadata to client
            containsImageRequest
         });
    }
    
    // --- Standard File Processing & Chat Response --- 
    let fileContext = '';
    const successfulFiles = processedFilesData.filter(p => p.metadata.processingStatus === 'completed');
    if (successfulFiles.length > 0) {
      const fileInfos = successfulFiles.map(fileData => {
        const summary = fileData.metadata.summary && fileData.metadata.summary.length > 200 
          ? fileData.metadata.summary.substring(0, 200) + "..." 
          : fileData.metadata.summary;
        return `- ${fileData.metadata.filename}${summary ? ` - Summary: ${summary}` : ''}`;
      }).join('\n');
      fileContext = `\n\n[SYSTEM: Files processed: ${successfulFiles.length}. Files: \n${fileInfos}]`;
    }
    
    const attachmentsForChat = successfulFiles.map(p => ({
        filename: p.metadata.filename,
        type: p.metadata.mimeType.startsWith('image/') ? 'image' : 'document',
        fileId: p.metadata.fileId,
        size: p.metadata.size,
        mimeType: p.metadata.mimeType
    }));
    
    // Create the body for the chat request
    const requestBody = JSON.stringify({ 
        message: message + fileContext, 
        userId, 
        attachments: attachmentsForChat 
    });
    
    // Update headers on the original request instead of creating a new Request
    const chatHeaders = new Headers(request.headers);
    chatHeaders.set('Content-Type', 'application/json');
    chatHeaders.set('X-Has-Attachments', 'true');
    
    // Create a modified NextRequest with our updated body and headers
    const chatRequest = new NextRequest(
        new URL(request.url),
        {
            headers: chatHeaders,
            method: 'POST',
            body: requestBody
        }
    );
    
    const chatResponse = await chatPost(chatRequest);
    const responseData = await chatResponse.json();
    
    // --- **NEW: Asynchronous Knowledge Flagging for Files** --- 
    const flaggingService = await getFlaggingService();
    if (flaggingService) {
        successfulFiles.forEach(fileData => {
            if (fileData.fullText && fileData.metadata.processingStatus === 'completed') {
                const metadataForFlagging = { 
                    fileId: fileData.metadata.fileId,
                    originalFilename: fileData.metadata.originalFilename,
                    mimeType: fileData.metadata.mimeType,
                    size: fileData.metadata.size,
                    uploadDate: fileData.metadata.uploadDate.toISOString(),
                    tags: fileData.metadata.tags,
                    extractedMetadata: fileData.metadata.extractedMetadata, // Pass extracted PDF metadata etc.
                    documentType: fileData.metadata.documentType || 'unknown', // Include document type classification
                    language: fileData.metadata.language || 'unknown' // Include detected language
                };

                // Log detected document type and language for monitoring
                console.log(`Flagging file "${fileData.metadata.filename}" - Type: ${fileData.metadata.documentType || 'unknown'}, Language: ${fileData.metadata.language || 'unknown'}`);

                flaggingService.flagFromFile(
                    fileData.fullText,
                    fileData.metadata.filename,
                    fileData.metadata.mimeType, 
                    metadataForFlagging
                )
                .then(flaggingResult => {
                    if (flaggingResult.success && flaggingResult.itemId) {
                        console.log(`Successfully flagged knowledge from file: ${fileData.metadata.filename} (Item ID: ${flaggingResult.itemId})`);
                    } else if (!flaggingResult.success && flaggingResult.error !== 'No relevant knowledge was extracted from the file') {
                        console.warn(`Failed to flag knowledge from file ${fileData.metadata.filename}:`, flaggingResult.error);
                    }
                })
                .catch(flaggingError => {
                    console.error(`Error during async knowledge flagging for file ${fileData.metadata.filename}:`, flaggingError);
                });
            }
        });
    } else {
        console.warn("Knowledge Flagging Service not available, skipping file flagging.");
    }
    // --- **END: Asynchronous Knowledge Flagging for Files** --- 

    // Return response with file processing metadata (not full text)
    return NextResponse.json({
      ...responseData,
      files: processedFilesData.map(p => p.metadata) // Send only metadata back
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