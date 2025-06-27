/**
 * Memory service helpers
 * 
 * Utility functions for common memory operations
 */

import { MemoryType } from '@/server/memory/config/types';
import { getMemoryServices } from "..";
import { generateSystemAgentId, generateSystemChatId, generateSystemUserId } from "../../../../lib/core/id-generation";
import { createAgentId, createChatId, createUserId } from "../../../../types/entity-identifier";
import { MessageMetadata, MessageRole, ThreadInfo } from "../../../../types/metadata";

/**
 * Extended metadata schema for message memories that includes additional properties
 * Extends MessageMetadata directly for consistency with the unified metadata interfaces
 */
export interface MessageMetadataSchema extends MessageMetadata {
  // Additional properties specific to helper functions
  messageId?: string;
  flaggedUnreliable?: boolean;
  flaggedUnreliableAt?: string;
  unreliabilityReason?: string;
  excludeFromRetrieval?: boolean;
  confidence?: number;
}

/**
 * Flag content as unreliable in the memory system
 * @param content Content to flag as unreliable
 * @param messageId Optional message ID to match
 * @param timestamp Optional timestamp to match
 * @returns True if operation was successful
 */
export async function flagAsUnreliable(
  content: string,
  messageId?: string,
  timestamp?: string
): Promise<boolean> {
  try {
    // Get memory services
    const { memoryService, searchService } = await getMemoryServices();

    // Search for the message to check if it exists
    const searchResults = await searchService.search(
      content.substring(0, 100),
      {
        types: [MemoryType.MESSAGE],
        limit: 5
      }
    );

    let targetMessage = null;

    // Try to find the message that matches our criteria
    if (searchResults && searchResults.length > 0) {
      // If messageId was provided, try to match by ID first
      if (messageId) {
        targetMessage = searchResults.find((result: any) => {
          const messageObj = result.point;
          return messageObj?.payload?.messageId === messageId;
        });
      }

      // If no match by ID or ID wasn't provided, try to match by timestamp
      if (!targetMessage && timestamp) {
        targetMessage = searchResults.find((result: any) => {
          const resultTimestamp = result.point.payload.timestamp;
          return resultTimestamp === timestamp ||
            (Math.abs(new Date(resultTimestamp).getTime() - new Date(timestamp).getTime()) < 1000);
        });
      }

      // If still no match, use content similarity as fallback
      if (!targetMessage) {
        // Get the first result as it should be the most similar
        targetMessage = searchResults[0];
      }
    }

    // If we found the message, update its metadata to mark it as unreliable
    if (targetMessage) {
      console.log(`Found existing message to flag as unreliable: ${targetMessage.point.id}`);

      // Get existing metadata and cast to our schema
      const existingMetadata = targetMessage.point.payload.metadata || {};
      const typedMetadata = existingMetadata as MessageMetadataSchema;

      // Update the message metadata to mark it as unreliable
      const updatedMetadata: MessageMetadataSchema = {
        ...typedMetadata,
        schemaVersion: typedMetadata.schemaVersion || '1.0.0',
        flaggedUnreliable: true,
        flaggedUnreliableAt: new Date().toISOString(),
        unreliabilityReason: 'user_flagged',
        excludeFromRetrieval: true, // This is the key flag to exclude from future retrievals
        confidence: 0 // Set confidence to 0 to ensure it's not reranked highly
      };

      // Update the memory with the new metadata
      await memoryService.updateMemory({
        id: targetMessage.point.id,
        type: MemoryType.MESSAGE,
        metadata: updatedMetadata
      });

      return true;
    } else {
      // If message doesn't exist in memory yet, create a new entry with unreliable flag
      console.log('Creating new memory entry with unreliable flag');

      // Create default thread info
      const threadInfo: ThreadInfo = {
        id: 'system-flagged',
        position: 0
      };

      // Create ULID strings
      const systemUserId = generateSystemUserId('system');
      const systemAgentId = generateSystemAgentId('system');
      const systemChatId = generateSystemChatId('flagged-content');

      // Add as a new memory with unreliable flag
      const result = await memoryService.addMemory({
        type: MemoryType.MESSAGE,
        content: content,
        metadata: {
          schemaVersion: '1.0.0',
          // Required MessageMetadata fields
          role: MessageRole.SYSTEM,
          userId: createUserId(systemUserId),     // Create EntityIdentifier object
          agentId: createAgentId(systemAgentId),  // Create EntityIdentifier object
          chatId: createChatId(systemChatId),     // Create EntityIdentifier object
          thread: threadInfo,
          timestamp: Date.now(),  // Add proper numeric timestamp
          // Flagging specific fields
          messageId: messageId,
          flaggedUnreliable: true,
          flaggedUnreliableAt: new Date().toISOString(),
          unreliabilityReason: 'user_flagged',
          excludeFromRetrieval: true,
          confidence: 0,
          source: 'user_flagged'
        } as MessageMetadataSchema
      });

      return result.success;
    }
  } catch (error) {
    console.error('Error flagging content as unreliable:', error);
    return false;
  }
} 