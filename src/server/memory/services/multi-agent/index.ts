/**
 * Multi-Agent System Memory Services
 * 
 * This module exports the memory services for the multi-agent system.
 */

// Export schemas
export { agentSchema } from '../../schema/agent';
export type { 
  AgentMemoryEntity, 
  AgentStatus, 
  AgentCapability, 
  AgentParameters, 
  AgentTool, 
  AgentMetadata 
} from '../../schema/agent';

export { chatSchema } from '../../schema/chat';
export type { 
  ChatMemoryEntity, 
  ChatParticipant, 
  ChatParticipantRole, 
  ChatPermission, 
  ChatStatus, 
  ChatSettings, 
  ChatMetadata
} from '../../schema/chat';

// Export services
export { AgentMemoryService } from '../../services/agent-memory-service';
export { ChatMemoryService } from '../../services/chat-memory-service';
export type { MessageQueryOptions } from '../../services/chat-memory-service';

// Export agent factory
export { AgentFactory } from './agent-factory';
export type { AgentTemplate } from './agent-factory';

// Export conversation manager
export { ConversationManager } from './conversation-manager';
export type { Message, ConversationOptions } from './conversation-manager';

// Export other shared types
export { IdGenerator } from '../../../../utils/ulid';
export type { StructuredId } from '../../../../utils/ulid';

/**
 * Helper function to create a new agent memory service instance
 * @param repository The repository to use
 * @returns A new agent memory service
 */
export function createAgentMemoryService(repository: any) {
  const { AgentMemoryService } = require('../../services/agent-memory-service');
  return new AgentMemoryService(repository);
}

/**
 * Helper function to create a new chat memory service instance
 * @param repository The repository to use
 * @returns A new chat memory service
 */
export function createChatMemoryService(repository: any) {
  const { ChatMemoryService } = require('../../services/chat-memory-service');
  return new ChatMemoryService(repository);
}

/**
 * Helper function to create a new agent factory instance
 * @param repository The repository to use
 * @returns A new agent factory
 */
export function createAgentFactory(repository: any) {
  const { AgentFactory } = require('./agent-factory');
  return new AgentFactory(repository);
}

/**
 * Helper function to create a new conversation manager instance
 * @param repository The repository to use
 * @returns A new conversation manager
 */
export function createConversationManager(repository: any) {
  const { ConversationManager } = require('./conversation-manager');
  return new ConversationManager(repository);
} 