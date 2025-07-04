import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config';
import { MessageMetadata, MessageRole, ThreadInfo } from '../../../../types/metadata';
import { generateSystemUserId, generateSystemAgentId, generateChatId } from '../../../../lib/core/id-generation';
import { createUserId, createAgentId, createChatId as createChatEntityId } from '../../../../types/entity-identifier';

export const runtime = 'nodejs';

// Extended metadata interface for unreliable message flags
interface ExtendedMessageMetadata extends MessageMetadata {
  messageId?: string;
  flaggedUnreliable?: boolean;
  flaggedUnreliableAt?: string;
  unreliabilityReason?: string;
  excludeFromRetrieval?: boolean;
  confidence?: number;
}

/**
 * API endpoint to flag content as unreliable
 * This marks the content in the memory system to ensure it's not retrieved in future queries
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, messageId, timestamp } = body;

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    // Initialize memory services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    // Ensure memory system is initialized
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }

    // Search for the message to check if it exists
    const searchResults = await searchService.search(content.substring(0, 100), {
      limit: 5,
      types: [MemoryType.MESSAGE]
    });

    let targetMemory = null;
    
    // Try to find the message that matches our criteria
    if (searchResults.length > 0) {
      // If messageId was provided, try to match by ID first
      if (messageId) {
        targetMemory = searchResults.find((result: any) => {
          const metadata = result.point.payload?.metadata as ExtendedMessageMetadata;
          return result.point.id === messageId || 
                (metadata && metadata.messageId === messageId);
        });
      }
      
      // If no match by ID or ID wasn't provided, try to match by timestamp
      if (!targetMemory && timestamp) {
        targetMemory = searchResults.find((result: any) => {
          const messageTimestamp = result.point.payload?.timestamp || 
                                result.point.payload?.metadata?.timestamp;
          return messageTimestamp === timestamp || 
                (messageTimestamp && new Date(messageTimestamp).getTime() - new Date(timestamp).getTime() < 1000);
        });
      }
      
      // If still no match, use content similarity as fallback
      if (!targetMemory) {
        // Get the first result as it should be the most similar
        targetMemory = searchResults[0];
      }
    }

    // If we found the message, update its metadata to mark it as unreliable
    if (targetMemory) {
      console.log(`Found existing message to flag as unreliable: ${targetMemory.point.id}`);
      
      // Get existing metadata
      const existingMetadata = targetMemory.point.payload?.metadata || {};
      const typedMetadata = existingMetadata as ExtendedMessageMetadata;
      
      // Update the message metadata to mark it as unreliable
      await memoryService.updateMemory({
        id: targetMemory.point.id,
        type: MemoryType.MESSAGE,
        metadata: {
          ...typedMetadata,
          schemaVersion: typedMetadata.schemaVersion || "1.0.0",
          flaggedUnreliable: true,
          flaggedUnreliableAt: new Date().toISOString(),
          unreliabilityReason: 'user_flagged',
          excludeFromRetrieval: true, // This is the key flag to exclude from future retrievals
          confidence: 0 // Set confidence to 0 to ensure it's not reranked highly
        }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Content flagged as unreliable and will be excluded from future retrievals' 
      });
    } else {
      // If message doesn't exist in memory yet, create a new entry with unreliable flag
      console.log('Creating new memory entry with unreliable flag');
      
      // Create ULID strings following arch-refactor-guidelines
      const systemUserId = generateSystemUserId();
      const systemAgentId = generateSystemAgentId();
      const systemChatId = generateChatId();
      
      // Create default thread info
      const threadInfo: ThreadInfo = {
        id: 'system-flagged',
        position: 0
      };
      
      // Add as a new memory with unreliable flag
      await memoryService.addMemory({
        type: MemoryType.MESSAGE,
        content: content,
        metadata: {
          schemaVersion: "1.0.0",
          role: MessageRole.SYSTEM,
          userId: createUserId(systemUserId),       // Create EntityIdentifier object
          agentId: createAgentId(systemAgentId),   // Create EntityIdentifier object
          chatId: createChatEntityId(systemChatId), // Create EntityIdentifier object
          thread: threadInfo,
          messageId: messageId,
          flaggedUnreliable: true,
          flaggedUnreliableAt: new Date().toISOString(),
          unreliabilityReason: 'user_flagged',
          excludeFromRetrieval: true,
          confidence: 0,
          source: 'user_flagged',
          timestamp: Date.now()  // Add proper numeric timestamp
        } as ExtendedMessageMetadata
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Content marked as unreliable and will be excluded from future retrievals' 
      });
    }
  } catch (error) {
    console.error('Error flagging content as unreliable:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to flag content as unreliable' },
      { status: 500 }
    );
  }
} 