/**
 * Multi-Agent Communication System
 * 
 * This module exports the components and factories for the multi-agent communication system,
 * including the message router, message transformer, conversation manager, and capability registry.
 */

import { getMemoryServices } from '../../../services';
import { AnyMemoryService } from '../../memory/memory-service-wrappers';
import { MessageRouter, IMessageRouter } from './message-router';
import { MessageTransformer, IMessageTransformer } from './message-transformer';
import { ConversationManager, IConversationManager } from './conversation-manager';
import { CapabilityRegistry, ICapabilityRegistry } from '../../../../../agents/shared/capabilities/capability-registry';
import { AgentRelationshipService } from '../../../../../agents/shared/capabilities/agent-relationship';

// Singleton instances
let messageRouter: MessageRouter | null = null;
let messageTransformer: MessageTransformer | null = null;
let conversationManager: ConversationManager | null = null;
let capabilityRegistry: CapabilityRegistry | null = null;
let agentRelationshipService: AgentRelationshipService | null = null;

/**
 * Get the message router instance
 */
export async function getMessageRouter(): Promise<MessageRouter> {
  if (!messageRouter) {
    const services = await getMemoryServices();
    const registry = await getCapabilityRegistry();
    
    messageRouter = new MessageRouter(
      services.memoryService,
      registry
    );
  }
  
  return messageRouter;
}

/**
 * Get the message transformer instance
 */
export async function getMessageTransformer(): Promise<MessageTransformer> {
  if (!messageTransformer) {
    const services = await getMemoryServices();
    
    messageTransformer = new MessageTransformer(
      services.memoryService
    );
  }
  
  return messageTransformer;
}

/**
 * Get the conversation manager instance
 */
export async function getConversationManager(): Promise<ConversationManager> {
  if (!conversationManager) {
    const services = await getMemoryServices();
    const router = await getMessageRouter();
    const transformer = await getMessageTransformer();
    
    conversationManager = new ConversationManager(
      services.memoryService,
      router,
      transformer
    );
  }
  
  return conversationManager;
}

/**
 * Get the capability registry instance
 */
export async function getCapabilityRegistry(): Promise<CapabilityRegistry> {
  if (!capabilityRegistry) {
    const services = await getMemoryServices();
    
    capabilityRegistry = new CapabilityRegistry(
      services.memoryService
    );
  }
  
  return capabilityRegistry;
}

/**
 * Get the agent relationship service instance
 */
export async function getAgentRelationshipService(): Promise<AgentRelationshipService> {
  if (!agentRelationshipService) {
    const services = await getMemoryServices();
    
    agentRelationshipService = new AgentRelationshipService(
      services.memoryService
    );
  }
  
  return agentRelationshipService;
}

/**
 * Create a custom message router
 */
export function createMessageRouter(
  memoryService: AnyMemoryService,
  registry: CapabilityRegistry
): MessageRouter {
  return new MessageRouter(
    memoryService,
    registry
  );
}

/**
 * Create a custom message transformer
 */
export function createMessageTransformer(
  memoryService: AnyMemoryService
): MessageTransformer {
  return new MessageTransformer(
    memoryService
  );
}

/**
 * Create a custom conversation manager
 */
export function createConversationManager(
  memoryService: AnyMemoryService,
  router: MessageRouter,
  transformer: MessageTransformer
): ConversationManager {
  return new ConversationManager(
    memoryService,
    router,
    transformer
  );
}

/**
 * Create a custom capability registry
 */
export function createCapabilityRegistry(
  memoryService: AnyMemoryService
): CapabilityRegistry {
  return new CapabilityRegistry(
    memoryService
  );
}

/**
 * Create a custom agent relationship service
 */
export function createAgentRelationshipService(
  memoryService: AnyMemoryService
): AgentRelationshipService {
  return new AgentRelationshipService(
    memoryService
  );
}

// Export component classes
export { MessageRouter } from './message-router';
export { MessageTransformer } from './message-transformer';
export { ConversationManager } from './conversation-manager';
export { CapabilityRegistry } from '../../../../../agents/shared/capabilities/capability-registry';

// Export interfaces
export type { IMessageRouter } from './message-router';
export type { IMessageTransformer } from './message-transformer';
export type { IConversationManager } from './conversation-manager';
export type { ICapabilityRegistry } from '../../../../../agents/shared/capabilities/capability-registry';

// Export type definitions
export type { MessagePriority, RoutingStrategy, DeliveryStatus, AgentMessage, RoutingParams, RoutingResult } from './message-router';
export type { MessageFormat, EnrichmentType, TransformableMessage, TransformationOptions } from './message-transformer';
export type { ConversationState, ParticipantType, ParticipantRole, FlowControlType, Conversation, Participant } from './conversation-manager';
export type { Capability, CapabilityLevel, CapabilityType, AgentCapability } from '../../../../../agents/shared/capabilities/types';

// Export factory
export { MessagingFactory, messagingFactory } from './factory'; 