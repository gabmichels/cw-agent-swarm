/**
 * Utility for storing internal messages to memory
 * This ensures proper routing of internal messages to memory instead of chat UI
 */

import { MessageType } from '../../constants/message';
import { ImportanceLevel, MemorySource } from '../../constants/memory';
import { MemoryType as StandardMemoryType } from '../../server/memory/config';

/**
 * Store an internal message to memory with proper tagging
 * @param message The message content to store
 * @param type The type of internal message (thought, reflection, etc.)
 * @param memoryManager The memory manager instance
 * @param metadata Optional metadata about the message
 */
export async function storeInternalMessageToMemory(
  message: string,
  type: MessageType.THOUGHT | MessageType.REFLECTION | MessageType.SYSTEM | MessageType.TOOL_LOG | MessageType.MEMORY_LOG,
  memoryManager: any,
  metadata: {
    originTaskId?: string,
    toolUsed?: string,
    importance?: ImportanceLevel,
    source?: MemorySource,
    [key: string]: any
  } = {}
) {
  // Default importance based on message type
  let importance = metadata.importance || ImportanceLevel.MEDIUM;
  let source = metadata.source || MemorySource.AGENT;
  
  // Map message type to memory type
  let memoryType: string;
  switch (type) {
    case MessageType.THOUGHT:
      memoryType = StandardMemoryType.THOUGHT;
      break;
    case MessageType.REFLECTION:
      memoryType = 'reflection';
      importance = metadata.importance || ImportanceLevel.HIGH; // Reflections are high importance by default
      break;
    case MessageType.SYSTEM:
      memoryType = 'system';
      source = MemorySource.SYSTEM;
      break;
    case MessageType.TOOL_LOG:
      memoryType = 'tool';
      break;
    case MessageType.MEMORY_LOG:
      memoryType = 'memory_log';
      break;
    default:
      memoryType = StandardMemoryType.THOUGHT;
  }

  // Add additional metadata
  const enhancedMetadata = {
    ...metadata,
    timestamp: new Date().toISOString(),
    isInternalMessage: true,
    notForChat: true
  };
  
  // Store in memory
  await memoryManager.addMemory(
    message,
    memoryType,
    importance,
    source,
    JSON.stringify(enhancedMetadata)
  );
  
  // Log to console in dev mode
  if (process.env.DEV_SHOW_INTERNAL_MESSAGES === 'true') {
    console.log(`INTERNAL MESSAGE [${type}]: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
  }

  return true;
} 