import { v4 as uuidv4 } from 'uuid';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config/types';
import { ThreadInfo } from '../../../../types/metadata';

/**
 * Creates a new thread or gets an existing one based on parameters
 * 
 * @param chatId Chat ID to associate with the thread
 * @param role Role of the message ('user' or 'assistant')
 * @param prevMessageId Optional ID of previous message for continuing threads
 * @returns Thread info object with ID and position
 */
export function getOrCreateThreadInfo(
  chatId: string,
  role: 'user' | 'assistant',
  prevMessageId?: string
): ThreadInfo {
  // If we don't have a previous message ID, create a new thread
  // User messages are always position 0 in a thread
  if (!prevMessageId || role === 'user') {
    return {
      id: uuidv4(), // Using UUID instead of timestamp for better uniqueness
      position: 0
    };
  }
  
  // If we have a previous message ID but no specific handling,
  // just create a thread with the same ID but incremented position
  return {
    id: `thread_${Date.now()}`,
    position: 0
  };
}

/**
 * Creates a thread info object for a response message
 * Ensures proper thread linking to the parent message
 * 
 * @param parentMessageId ID of the parent/previous message
 * @returns Thread info with proper position and linking
 */
export async function createResponseThreadInfo(parentMessageId: string): Promise<ThreadInfo> {
  try {
    // Get memory services
    const { memoryService } = await getMemoryServices();
    
    // Find the parent message
    const parentMessage = await memoryService.getMemory({
      id: parentMessageId,
      type: MemoryType.MESSAGE
    });
    
    if (!parentMessage) {
      console.warn(`Parent message ${parentMessageId} not found, creating new thread`);
      return {
        id: uuidv4(),
        position: 0
      };
    }
    
    // Use the same thread ID but increment position
    const parentThreadInfo = (parentMessage.payload.metadata as any).thread as ThreadInfo;
    
    if (!parentThreadInfo || !parentThreadInfo.id) {
      console.warn(`Parent message ${parentMessageId} has no valid thread info, creating new thread`);
      return {
        id: uuidv4(),
        position: 0
      };
    }
    
    // Return a thread with same ID but position + 1
    return {
      id: parentThreadInfo.id,
      position: parentThreadInfo.position + 1,
      parentId: parentMessageId
    };
  } catch (error) {
    console.error('Error creating response thread info:', error);
    // Fallback to a new thread if anything goes wrong
    return {
      id: uuidv4(),
      position: 0
    };
  }
}

/**
 * Retrieves and formats all messages in a thread
 * 
 * @param threadId The thread ID to fetch messages for
 * @returns Array of formatted messages in order of position
 */
export async function getFormattedThreadMessages(threadId: string) {
  try {
    const { memoryService } = await getMemoryServices();
    
    // Get all memories with this thread ID
    const memories = await memoryService.searchMemories({
      type: MemoryType.MESSAGE,
      filter: {
        "metadata.thread.id": threadId
      }
    });
    
    if (!memories || memories.length === 0) {
      return [];
    }
    
    // Format and sort the messages by position
    const formattedMessages = memories
      .map(memory => ({
        id: memory.id,
        content: memory.payload.text,
        role: (memory.payload.metadata as any).role,
        threadInfo: (memory.payload.metadata as any).thread,
        timestamp: memory.payload.metadata.timestamp,
        attachments: (memory.payload.metadata as any).attachments
      }))
      .sort((a, b) => {
        // Sort by thread position
        const posA = a.threadInfo?.position || 0;
        const posB = b.threadInfo?.position || 0;
        return posA - posB;
      });
    
    return formattedMessages;
  } catch (error) {
    console.error('Error getting thread messages:', error);
    return [];
  }
} 