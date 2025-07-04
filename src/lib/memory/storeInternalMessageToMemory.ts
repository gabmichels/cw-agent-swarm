/**
 * Utility for storing internal messages to memory
 * This ensures proper routing of internal messages with appropriate metadata
 */

import { MessageRole } from '../../agents/shared/types/MessageTypes';
import { ImportanceLevel } from '../../constants/memory';
import { MessageType } from '../../constants/message';
import {
  createThreadInfo
} from '../../server/memory/services/helpers/metadata-helpers';
import {
  addCognitiveProcessMemory,
  addMessageMemory,
  AnyMemoryService
} from '../../server/memory/services/memory/memory-service-wrappers';
import { createAgentId, createChatId, createUserId } from '../../types/entity-identifier';
import { CognitiveProcessType } from '../../types/metadata';
import {
  generateSystemAgentId,
  generateSystemChatId,
  generateSystemUserId
} from '../core/id-generation';

/**
 * Store an internal message to memory with proper metadata and typing
 * 
 * @param message The message content to store
 * @param type The type of internal message (thought, reflection, etc.)
 * @param memoryService The memory service instance (either MemoryService or EnhancedMemoryService)
 * @param metadata Optional metadata about the message
 */
export async function storeInternalMessageToMemory(
  message: string,
  type: MessageType.THOUGHT | MessageType.REFLECTION | MessageType.SYSTEM | MessageType.TOOL_LOG | MessageType.MEMORY_LOG,
  memoryService: AnyMemoryService,
  metadata: {
    originTaskId?: string,
    toolUsed?: string,
    importance?: ImportanceLevel,
    agentId?: string,
    userId?: string,
    chatId?: string,
    threadId?: string,
    [key: string]: any
  } = {}
) {
  // Default importance
  const importance = metadata.importance || ImportanceLevel.MEDIUM;

  // Use provided IDs or generate system defaults
  const agentId: string = metadata.agentId || generateSystemAgentId('system');
  const userId: string = metadata.userId || generateSystemUserId('system');
  const chatId: string = metadata.chatId || generateSystemChatId('system');

  // Create thread info
  const threadInfo = createThreadInfo(
    metadata.threadId || `thread_${Date.now()}`,
    0
  );

  // Handle based on message type
  switch (type) {
    case MessageType.THOUGHT:
      // Use cognitive process for thoughts
      return addCognitiveProcessMemory(
        memoryService,
        message,
        CognitiveProcessType.THOUGHT,
        createAgentId(agentId),
        {
          contextId: metadata.originTaskId,
          importance: importance,
          metadata: {
            source: metadata.toolUsed ? 'tool' : 'agent',
            category: metadata.toolUsed ? 'tool-output' : 'internal'
          }
        }
      );

    case MessageType.REFLECTION:
      // Use cognitive process for reflections
      return addCognitiveProcessMemory(
        memoryService,
        message,
        CognitiveProcessType.REFLECTION,
        createAgentId(agentId),
        {
          contextId: metadata.originTaskId,
          importance: metadata.importance || ImportanceLevel.HIGH,
          metadata: {
            source: metadata.toolUsed ? 'tool' : 'agent',
            category: 'reflection'
          }
        }
      );

    case MessageType.SYSTEM:
    case MessageType.TOOL_LOG:
    case MessageType.MEMORY_LOG:
    default:
      // Use message memory for other types
      return addMessageMemory(
        memoryService,
        message,
        MessageRole.SYSTEM,
        createUserId(userId),   // Create EntityIdentifier object
        createAgentId(agentId), // Create EntityIdentifier object
        createChatId(chatId),   // Create EntityIdentifier object
        threadInfo,
        {
          messageType: type,
          importance: importance,
          metadata: {
            tags: ['internal', 'not-for-chat'],
            ...(metadata.toolUsed ? { toolUsed: metadata.toolUsed } : {})
          }
        }
      );
  }
} 