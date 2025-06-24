import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../../server/memory/services';
import { addMessageMemory } from '../../../../../../server/memory/services/memory/memory-service-wrappers';
import { MessageRole } from '../../../../../../agents/shared/types/MessageTypes';
import { getOrCreateThreadInfo, createResponseThreadInfo } from '../../../../chat/thread/helper';
import { extractTags } from '../../../../../../utils/tagExtractor';
import { AgentService } from '../../../../../../services/AgentService';
import { createUserId, createAgentId, createChatId } from '../../../../../../types/entity-identifier';
import { getChatService } from '../../../../../../server/memory/services/chat-service';
import { getFileService, StoredFile } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import { MessageAttachment as MetadataMessageAttachment } from '../../../../../../types/metadata';
import { ulid } from 'ulid';
import { ImportanceLevel } from '../../../../../../constants/memory';
import * as fs from 'fs';
import * as path from 'path';
import { getStorageConfig } from '@/lib/storage/config';

// Define interface for message attachments with strict typing
interface MessageAttachment {
  filename: string;
  type: string;
  size?: number;
  mimeType?: string;
  fileId?: string;
  preview?: string;
  has_full_preview?: boolean;
}

// Define interface for message processing options
interface MessageProcessingOptions {
  attachments?: MessageAttachment[];
  userId?: string;
  userMessageId?: string;
  skipResponseMemoryStorage?: boolean;
  useVisionModel?: boolean;
}

// Define interface for agent response with all required properties
interface AgentResponse {
  content: string;
  memories?: string[];
  thoughts?: string[];
  metadata?: Record<string, unknown>;
}

// Track the last user message ID to maintain thread relationships
let lastUserMessageId: string | null = null;

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Interface for file type information
interface FileTypeInfo {
  type: string;
  extension: string;
}

// Supported file types and their corresponding MIME types
const SUPPORTED_FILE_TYPES: Record<string, FileTypeInfo> = {
  // Images
  'image/jpeg': { type: 'image', extension: 'jpg' },
  'image/png': { type: 'image', extension: 'png' },
  'image/gif': { type: 'image', extension: 'gif' },
  'image/webp': { type: 'image', extension: 'webp' },
  
  // Documents
  'application/pdf': { type: 'document', extension: 'pdf' },
  'text/plain': { type: 'document', extension: 'txt' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { 
    type: 'document', 
    extension: 'docx' 
  },
};

export interface FileUploadResponse {
  files: StoredFileResponse[];
  messageId?: string;
}

export interface StoredFileResponse {
  id: string;
  url: string;
  contentType: string;
  originalName: string;
  type: string;
}

// Make sure storage directory exists
function ensureStorageDirectoryExists(): void {
  try {
    const config = getStorageConfig();
    const localStoragePath = config.localStoragePath || path.join(process.cwd(), 'storage');
    const bucketPath = path.join(localStoragePath, 'chat-attachments');
    
    // Create parent directory if it doesn't exist
    if (!fs.existsSync(localStoragePath)) {
      console.log(`Creating storage directory: ${localStoragePath}`);
      fs.mkdirSync(localStoragePath, { recursive: true });
    }
    
    // Create bucket directory if it doesn't exist
    if (!fs.existsSync(bucketPath)) {
      console.log(`Creating chat attachments directory: ${bucketPath}`);
      fs.mkdirSync(bucketPath, { recursive: true });
    }
  } catch (error) {
    console.error('Error ensuring storage directory exists:', error);
  }
}

/**
 * Helper function to load file as base64 data if it's accessible in the filesystem
 * @param fileId File ID to load
 * @returns Base64 encoded string or null if file can't be loaded
 */
async function getFileAsBase64(fileId: string): Promise<string | null> {
  try {
    // Get storage configuration
    const config = getStorageConfig();
    
    // Determine file path in local storage
    const localStoragePath = config.localStoragePath || path.join(process.cwd(), 'storage');
    const bucketPath = path.join(localStoragePath, 'chat-attachments');
    const filePath = path.join(bucketPath, fileId);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found for base64 encoding: ${filePath}`);
      return null;
    }
    
    // Read file and convert to base64
    const fileBuffer = await fs.promises.readFile(filePath);
    return fileBuffer.toString('base64');
  } catch (error) {
    console.error('Error getting file as base64:', error);
    return null;
  }
}

export async function POST(
  request: Request,
  context: { params: { chatId: string } }
) {
  try {
    // Properly await the params object
    const params = await context.params;
    const chatId = (await params).chatId;
    
    // Make sure the storage directory exists
    ensureStorageDirectoryExists();
    
    // Parse form data
    const formData = await request.formData();
    const message = formData.get('message') as string || '';
    const userId = formData.get('userId') as string || '';
    const agentId = formData.get('agentId') as string || '';
    const replyContextString = formData.get('replyContext') as string || '';
    
    // Parse reply context if provided
    let replyContext = null;
    if (replyContextString) {
      try {
        replyContext = JSON.parse(replyContextString);
        console.log('Parsed reply context from form data:', replyContext);
      } catch (error) {
        console.warn('Error parsing reply context:', error);
      }
    }
    
    // Get the file service
    const fileService = getFileService();
    
    // Process uploaded files
    const uploadPromises: Promise<StoredFile>[] = [];
    const fileTypes: Record<string, string> = {};
    
    // Convert formData entries to array to make it iterable in all environments
    const formDataEntries = Array.from(formData.entries());
    
    for (const [key, value] of formDataEntries) {
      // Check if the entry is a file
      if (value instanceof File) {
        const file = value;
        
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
            { status: 400 }
          );
        }
        
        // Generate a proper filename for clipboard pastes
        // If the file has no name or is named "image.png" (common for clipboard), generate a random name
        let filename = file.name;
        if (!filename || filename === "image.png" || filename === "clipboard.png" || filename === "paste.png") {
          // Generate a name based on time and random string
          const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
          const randomStr = Math.random().toString(36).substring(2, 10);
          
          // Get extension from mime type if possible
          let extension = "png"; // Default for clipboard images
          if (file.type) {
            const fileType = SUPPORTED_FILE_TYPES[file.type];
            if (fileType) {
              extension = fileType.extension;
            }
          }
          
          filename = `clipboard_${timestamp}_${randomStr}.${extension}`;
          console.log(`Generated filename for clipboard image: ${filename}`);
        }
        
        // Check file type
        const fileType = SUPPORTED_FILE_TYPES[file.type];
        if (!fileType) {
          return NextResponse.json(
            { error: `Unsupported file type: ${file.type}` },
            { status: 400 }
          );
        }
        
        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Note: Files are NOT organized by chatId in storage
        // They are stored in a flat structure, but the relationship is tracked in the database
        // This allows for shared files across chats if needed in the future
        
        // Upload file to storage
        const uploadPromise = fileService.uploadFile(
          buffer,
          filename, // Use potentially modified filename
          file.type
        );
        
        uploadPromises.push(uploadPromise);
        fileTypes[filename] = fileType.type; // Use the new filename as key
      }
    }
    
    // Wait for all uploads to complete
    const uploadedFiles = await Promise.all(uploadPromises);
    
    // Get public URLs for the files
    const storedFiles: StoredFileResponse[] = await Promise.all(
      uploadedFiles.map(async (file: StoredFile) => {
        // Create a generic API URL that works with any storage provider
        const url = `/api/storage/chat-attachments/${file.id}`;
        
        // Parse originalName to detect if it's a clipboard image
        const isClipboardImage = file.originalName.startsWith('clipboard_');
        
        // Create a more user-friendly display name for clipboard images
        const displayName = isClipboardImage 
          ? `Pasted image ${new Date(file.createdAt).toLocaleString().split(',')[0]}`
          : file.originalName;
        
        // Make sure the chat exists in the database
        await prisma.chat.upsert({
          where: { id: chatId },
          update: {}, // No updates needed if it exists
          create: {
            id: chatId
          }
        });
        
        // Save file reference in database with new schema
        await prisma.chatAttachment.create({
          data: {
            chatId,
            type: file.contentType,
            url: url
          }
        });
        
        return {
          id: file.id,
          url,
          contentType: file.contentType,
          originalName: displayName, // Use display name for UI
          type: fileTypes[file.originalName] || 'unknown'
        };
      })
    );
    
    // Initialize memory services to store the message with attachments
    const { memoryService, client } = await getMemoryServices();
    
    // Ensure memory services are initialized
    const status = await client.getStatus();
    if (!status.initialized) {
      console.log('Initializing memory services before saving message');
      await client.initialize();
    }
    
    // Create EntityIdentifier objects from the provided ID strings
    const userEntityId = createUserId(userId);
    const agentEntityId = createAgentId(agentId);
    const chatEntityId = createChatId(chatId);
    
    // Create thread info for user message
    const userThreadInfo = getOrCreateThreadInfo(chatId, 'user');
    console.log(`Created user message with thread ID: ${userThreadInfo.id}, position: ${userThreadInfo.position}`);
    
    // Define message content - include description of files if needed
    let messageContent = message;
    if (!messageContent) {
      const fileDescriptions = storedFiles.map(f => `- ${f.originalName} (${f.type})`).join('\n');
      messageContent = `[Shared files without additional context:\n${fileDescriptions}]`;
    }
    
    // Create message attachments in the format expected by memory service
    const messageAttachments: MetadataMessageAttachment[] = storedFiles.map(file => ({
      type: file.type,
      url: file.url,
      filename: file.originalName,
      contentType: file.contentType
    }));
    
    // Extract tags from user message
    let userMessageTags: string[] = [];
    try {
      const extractionResult = await extractTags(messageContent, {
        maxTags: 8,
        minConfidence: 0.3
      });
      
      if (extractionResult.success && extractionResult.tags.length > 0) {
        userMessageTags = extractionResult.tags.map(tag => tag.text);
        console.log(`Extracted ${userMessageTags.length} tags from user message with files:`, userMessageTags);
      } else {
        // Fallback to basic tag extraction if AI extraction produces no results
        userMessageTags = ['file_upload'];
        console.log('AI tag extraction produced no results, using fallback tags');
      }
    } catch (extractionError) {
      console.warn('Error extracting tags from user message with files:', extractionError);
      userMessageTags = ['file_upload']; // Default fallback tag
    }
    
    // Add file type tags to extracted message tags
    const fileTypeTags = storedFiles.map(file => file.type.toLowerCase());
    const allTags = Array.from(new Set([...userMessageTags, 'file_upload', ...fileTypeTags]));
    console.log(`Final tags for file message: ${allTags.join(', ')}`);
    
    // Save user message to memory
    const userMemoryResult = await addMessageMemory(
      memoryService,
      messageContent,
      MessageRole.USER,
      userEntityId,
      agentEntityId,
      chatEntityId,
      userThreadInfo,
      {
        attachments: messageAttachments,
        messageType: 'user_message_with_files',
        metadata: {
          // Replace hardcoded tags with extracted + file type tags
          tags: allTags,
          category: 'file_upload',
          // Include reply context if present
          ...(replyContext && { replyTo: replyContext }),
          // Enhanced context
          conversationContext: {
            purpose: 'file_sharing',
            sharedContext: {
              uploadedFiles: storedFiles.map(file => ({
                name: file.originalName,
                type: file.type,
                id: file.id,
                url: file.url
              }))
            }
          }
        }
      }
    );

    // Store user message ID
    let messageId = null;
    if (userMemoryResult && userMemoryResult.id) {
      lastUserMessageId = userMemoryResult.id;
      messageId = lastUserMessageId;
      console.log(`Saved user message with files to memory with ID: ${lastUserMessageId}`);
    }
    
    // Now process the message with the agent
    // Get the agent instance
    const agent = await AgentService.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Process message with the agent
    let agentResponse: AgentResponse;
    try {
      // Prepare attachments with base64 data for images to ensure reliable processing
      const processedAttachments = await Promise.all(messageAttachments.map(async (att) => {
        const isImage = att.type === 'image';
        
        // For images, attempt to get base64 data first
        let base64Data = null;
        if (isImage && att.url) {
          // Extract fileId from URL
          const fileIdMatch = att.url.match(/\/([^\/]+)$/);
          const fileId = fileIdMatch ? fileIdMatch[1] : null;
          
          if (fileId) {
            try {
              // Use our new base64 endpoint to get optimized base64 data
              const baseUrl = process.env.NEXTAUTH_URL || 
                             (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
              
              // Remove trailing slash if present
              const baseUrlNormalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
              
              // Create the base64 endpoint URL
              const base64Url = `${baseUrlNormalized}/api/files/local/${fileId}?format=base64`;
              
              // Fetch base64 data from our endpoint
              const response = await fetch(base64Url);
              
              if (response.ok) {
                const data = await response.json();
                base64Data = data.base64;
                console.log(`Successfully loaded base64 data for image: ${fileId} (${data.mimeType})`);
              } else {
                console.warn(`Failed to load base64 data for image ${fileId}: ${response.status} ${response.statusText}`);
                // Fall back to local file system method
                base64Data = await getFileAsBase64(fileId);
              }
            } catch (error) {
              console.warn(`Error using base64 endpoint for image ${fileId}:`, error);
              // Fall back to local file system method
              base64Data = await getFileAsBase64(fileId);
            }
          }
        }
        
        // Ensure we have an absolute URL for the image as fallback
        let fullUrl = att.url || '';
        
        // Check if URL is relative and convert to absolute
        if (fullUrl.startsWith('/')) {
          // Get base URL from environment variables
          const baseUrl = process.env.NEXTAUTH_URL || 
                         (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
          
          // Remove trailing slash if present
          const baseUrlNormalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
          
          // Combine to form absolute URL
          fullUrl = `${baseUrlNormalized}${att.url}`;
        }
        
        return {
          filename: att.filename || '',
          type: att.type,
          size: 0,
          mimeType: att.contentType,
          fileId: att.url || '',
          preview: fullUrl, // Use absolute URL
          // Flag for vision processing
          is_image_for_vision: isImage,
          // Add vision-specific processing info
          vision_data: isImage ? {
            url: fullUrl, // Use absolute URL for vision processing
            base64Data: base64Data, // Include base64 data if available
            detail: "high"
          } : undefined
        };
      }));
      
      // Add information about vision processing to the message content if needed
      let enhancedMessage = messageContent;
      const imageAttachments = processedAttachments.filter(att => att.is_image_for_vision);
      
      if (imageAttachments.length > 0) {
        // If no explicit message was provided, create one that instructs the model to analyze the images
        if (!message || message.trim() === '') {
          enhancedMessage = `Please analyze the following ${imageAttachments.length === 1 ? 'image' : 'images'} and provide detailed information about what you see.`;
        }
        
        // Log that we're using vision processing
        console.log(`Processing ${imageAttachments.length} images with vision capabilities`);
        // Log whether we have base64 data for any images
        const imagesWithBase64 = imageAttachments.filter(att => att.vision_data?.base64Data).length;
        console.log(`${imagesWithBase64} of ${imageAttachments.length} images have base64 data available`);
      }
      
      const processingOptions: MessageProcessingOptions = {
        attachments: processedAttachments,
        userId,
        userMessageId: lastUserMessageId || undefined,
        skipResponseMemoryStorage: true, // We'll handle memory storage here
        // Add vision model flag if we have images
        useVisionModel: imageAttachments.length > 0
      };
      
      // Process message with the agent
      console.log(`Processing file message with agent ${agentId}`);
      
      // Update processing options to explicitly include vision model flag and persona
      const enhancedOptions = {
        ...processingOptions,
        // Add agent's persona properties to ensure they're used during image processing
        persona: agent?.metadata?.persona || {},
        originalMessage: message || enhancedMessage,
        // Explicitly set useVisionModel flag
        useVisionModel: imageAttachments.length > 0
      };
      
      // Use AgentService to process the message
      const result = await AgentService.processMessage(
        agentId, 
        enhancedMessage, 
        enhancedOptions
      );
      
      // Parse response based on its structure
      if (typeof result === 'string') {
        agentResponse = { content: result };
      } else if (result && typeof result === 'object') {
        if ('response' in result && result.response) {
          // Handle response wrapped in a container object
          const response = result.response;
          agentResponse = typeof response === 'string' 
            ? { content: response } 
            : response as AgentResponse;
        } else if ('content' in result) {
          // Handle direct response object
          agentResponse = result as AgentResponse;
        } else {
          // Fallback for unexpected response structure
          agentResponse = {
            content: "I've analyzed your files but encountered format issues in processing the response.",
            thoughts: ["Response format error: " + JSON.stringify(result).substring(0, 100)]
          };
        }
      } else {
        // Fallback for null or undefined response
        agentResponse = {
          content: "I've received your files but couldn't generate a response. Please try again.",
          thoughts: ["No response received from agent."]
        };
      }
    } catch (error: unknown) {
      console.error('Error processing files with agent:', error);
      
      // Provide more helpful error messages based on error type
      let errorMessage = "I'm experiencing some technical difficulties processing your files at the moment.";
      
      // Check for specific error types to provide more helpful messages
      if (error instanceof Error) {
        if (error.message.includes('invalid_image_url') || error.message.includes('downloading')) {
          errorMessage = "I had trouble accessing the image files you shared. This might be due to a connection issue. Could you try sharing them again?";
        } else if (error.message.includes('timeout')) {
          errorMessage = "The image processing took too long to complete. This might be because the images are very large or complex. Could you try with smaller images?";
        }
      }
      
      agentResponse = {
        content: errorMessage,
        thoughts: [`Error: ${error instanceof Error ? error.message : String(error)}`]
      };
    }

    // Extract response components
    const responseContent = agentResponse.content || "I couldn't process the files you shared.";
    const thoughts = agentResponse.thoughts || [];
    const memories = agentResponse.memories || [];

    // Create thread info for assistant response
    let assistantThreadInfo;
    if (lastUserMessageId) {
      assistantThreadInfo = await createResponseThreadInfo(lastUserMessageId);
    } else {
      assistantThreadInfo = getOrCreateThreadInfo(chatId, 'assistant');
    }
      
    if (assistantThreadInfo) {
      console.log(`Created assistant response with thread ID: ${assistantThreadInfo.id}, position: ${assistantThreadInfo.position}, parentId: ${assistantThreadInfo.parentId || 'none'}`);
    }

    // Save assistant response to memory
    const assistantMemoryResult = await addMessageMemory(
      memoryService,
      responseContent,
      MessageRole.ASSISTANT,
      userEntityId,
      agentEntityId,
      chatEntityId,
      assistantThreadInfo,
      {
        messageType: 'assistant_response_to_file',
        metadata: {
          tags: ['file_response', ...storedFiles.map(file => file.type)],
          category: 'file_response',
          conversationContext: {
            purpose: 'file_analysis',
            sharedContext: {
              processedFiles: storedFiles.map(file => file.originalName),
              fileTypes: storedFiles.map(file => file.type),
              thoughts,
              memories
            }
          }
        }
      }
    );

    let assistantMessageId = null;
    if (assistantMemoryResult && assistantMemoryResult.id) {
      assistantMessageId = assistantMemoryResult.id;
    }
    
    // Return success with stored files and message IDs
    return NextResponse.json({
      success: true,
      files: storedFiles,
      messageId,
      response: {
        id: assistantMessageId,
        content: responseContent,
        timestamp: new Date().toISOString(),
        sender: {
          id: agentId,
          name: agent.name || 'Assistant',
          role: 'assistant'
        },
        threadId: assistantThreadInfo.id,
        parentMessageId: lastUserMessageId,
        thoughts,
        memories,
        attachments: []
      }
    });
    
  } catch (error: unknown) {
    console.error('Error processing files:', error);
    return NextResponse.json(
      { error: `Error processing files: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 