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
// Use our new agent service implementation with UUID compatibility
export * from './agent-service';
export { ChatMemoryService } from '../../services/chat-memory-service';
export type { MessageQueryOptions } from '../../services/chat-memory-service';

// Export agent factory
export { AgentFactory } from './agent-factory';
export type { AgentTemplate } from './agent-factory';

// Export conversation manager
export { ConversationManager } from './conversation-manager';
export type { Message, ConversationOptions } from './conversation-manager';

// Export enhanced memory service
export { EnhancedMemoryService } from './enhanced-memory-service';
export type { 
  EnhancedMemoryPoint, 
  EnhancedMemoryServiceOptions 
} from './enhanced-memory-service';

// Export migration helpers
export {
  migrateToEnhancedMemoryService,
  createEnhancedMemoryService as createEnhancedServiceWithDependencies,
  isEnhancedMemoryService,
  asEnhancedMemoryService
} from './migration-helpers';

// Export other shared types
export { IdGenerator } from '../../../../utils/ulid';
export type { StructuredId } from '../../../../utils/ulid';

/**
 * Helper function to create a new agent memory service instance
 * @param memoryService The memory service to use
 * @returns A new agent memory service
 */
export async function createAgentMemoryService(memoryService: any) {
  const { DefaultAgentMemoryService } = require('./agent-service');
  
  // Check if memoryService has a memoryClient property
  const memoryClient = memoryService?.memoryClient;
  
  if (!memoryClient) {
    console.error("No memory client available in the provided memoryService");
    throw new Error("Memory client is required to create agent memory service");
  }
  
  // Create new service with memory client
  return new DefaultAgentMemoryService(memoryClient);
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

/**
 * Helper function to create a new enhanced memory service instance
 * @param memoryClient The memory client to use
 * @param embeddingClient The embedding client to use
 * @param options Service options
 * @returns A new enhanced memory service
 */
export function createEnhancedMemoryService(
  memoryClient: any, 
  embeddingClient: any, 
  options?: any
) {
  const { EnhancedMemoryService } = require('./enhanced-memory-service');
  return new EnhancedMemoryService(memoryClient, embeddingClient, options);
} 