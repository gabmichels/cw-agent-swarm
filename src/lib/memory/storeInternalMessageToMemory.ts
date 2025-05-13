/**
 * Utility for storing internal messages to memory
 * This ensures proper routing of internal messages with appropriate metadata
 */

import { MessageType } from '../../constants/message';
import { ImportanceLevel } from '../../constants/memory';
import { MemoryType } from '../../server/memory/config';
import { 
  createThoughtMetadata, 
  createReflectionMetadata,
  createMessageMetadata,
  createThreadInfo
} from '../../server/memory/services/helpers/metadata-helpers';
import { CognitiveProcessType } from '../../types/metadata';
import { 
  addMessageMemory, 
  addCognitiveProcessMemory,
  AnyMemoryService
} from '../../server/memory/services/memory/memory-service-wrappers';
import { 
  createSystemId,
  createAgentId,
  createUserId,
  createChatId,
  parseStructuredId,
  EntityType,
  StructuredId
} from '../../types/structured-id';
import { MessageRole } from '../../agents/shared/types/MessageTypes';

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
    agentId?: string | StructuredId,
    userId?: string | StructuredId,
    chatId?: string | StructuredId,
    threadId?: string,
    [key: string]: any
  } = {}
) {
  // Default importance
  const importance = metadata.importance || ImportanceLevel.MEDIUM;
  
  // Create structured IDs or use system entity ID if not provided
  const agentId: StructuredId = metadata.agentId 
    ? (typeof metadata.agentId === 'string' && !metadata.agentId.includes(':') 
        ? createAgentId(metadata.agentId) 
        : metadata.agentId as StructuredId)
    : createSystemId(EntityType.AGENT, 'system');
    
  const userId: StructuredId = metadata.userId 
    ? (typeof metadata.userId === 'string' && !metadata.userId.includes(':') 
        ? createUserId(metadata.userId) 
        : metadata.userId as StructuredId)
    : createSystemId(EntityType.USER, 'system');
    
  const chatId: StructuredId = metadata.chatId 
    ? (typeof metadata.chatId === 'string' && !metadata.chatId.includes(':') 
        ? createChatId(metadata.chatId) 
        : metadata.chatId as StructuredId)
    : createSystemId(EntityType.CHAT, 'system');
  
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
        agentId,
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
        agentId,
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
        userId,
        agentId,
        chatId,
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