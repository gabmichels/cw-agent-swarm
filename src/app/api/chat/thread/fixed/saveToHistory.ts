import { getMemoryServices } from '../../../../../server/memory/services';
import { createUserId, createAgentId, createChatId } from '../../../../../types/structured-id';
import { MessageRole } from '../../../../../agents/shared/types/MessageTypes';
import { getOrCreateThreadInfo, createResponseThreadInfo } from '../helper';
import { ThreadInfo } from '../../../../../types/metadata';
import { MemoryType } from '../../../../../server/memory/config/types';

// Simple tracking of pending operations to prevent duplicates
const pendingMemoryOperations = new Map<string, Promise<any>>();

/**
 * Save a message to history with proper thread tracking
 * 
 * @param userId User ID
 * @param role Message role (user or assistant)
 * @param content Message content
 * @param chatId Chat ID (optional, defaults to 'chat-chloe-gab')
 * @param prevMessageId ID of previous message in conversation (for thread linking)
 * @param attachments Optional message attachments
 * @returns The saved memory object or null if error
 */
export async function saveToHistory(
  userId: string, 
  role: 'user' | 'assistant', 
  content: string, 
  chatId: string = 'chat-chloe-gab',
  prevMessageId?: string,
  attachments?: any[]
) {
  if (!content || content.trim() === '') return null;
  
  // Create an operation key to track this specific save operation
  const operationKey = `save:${userId}:${role}:${content.substring(0, 20)}`;
  
  try {
    // Check if we're already processing this message
    if (pendingMemoryOperations.has(operationKey)) {
      console.log(`Memory operation for ${operationKey} is already in progress, reusing promise`);
      return await pendingMemoryOperations.get(operationKey);
    }
    
    // Create a promise for this operation
    const operationPromise = (async () => {
      try {
        // Get memory services
        const { memoryService } = await getMemoryServices();
        
        // Convert role to the right format
        const messageRole = role === 'user' ? MessageRole.USER : MessageRole.ASSISTANT;
        
        // Create structured IDs
        const userStructuredId = createUserId(userId || 'default');
        const agentStructuredId = createAgentId('assistant');
        const chatStructuredId = createChatId(chatId);
        
        // Create proper thread info for continuity
        let threadInfo: ThreadInfo;
        
        // Handle thread differently based on message role
        if (role === 'user') {
          // For user messages, get or create a thread (always position 0)
          threadInfo = getOrCreateThreadInfo(chatId, role, prevMessageId);
        } else {
          // For assistant responses, ensure they link to the previous user message
          if (prevMessageId) {
            // Create a response thread that properly links to user message
            threadInfo = await createResponseThreadInfo(prevMessageId);
          } else {
            // Fallback to a simple thread if no previous message
            threadInfo = getOrCreateThreadInfo(chatId, role);
          }
        }
        
        // Add to memory
        const memoryResult = await memoryService.addMemory({
          type: MemoryType.MESSAGE,
          content: content,
          metadata: {
            role: messageRole,
            userId: userStructuredId,
            agentId: agentStructuredId,
            chatId: chatStructuredId, 
            thread: threadInfo,
            attachments: attachments,
            timestamp: Date.now()
          }
        });
        
        console.log(`Saved ${role} message to memory with thread position ${threadInfo.position}`);
        
        return memoryResult;
      } catch (error) {
        console.error('Error saving message to history:', error);
        throw error;
      }
    })();
    
    // Store the promise in the pending operations map
    pendingMemoryOperations.set(operationKey, operationPromise);
    
    // Clean up after operation is complete
    operationPromise.finally(() => {
      pendingMemoryOperations.delete(operationKey);
    });
    
    return await operationPromise;
  } catch (error) {
    console.error('Error in saveToHistory:', error);
    return null;
  }
} 