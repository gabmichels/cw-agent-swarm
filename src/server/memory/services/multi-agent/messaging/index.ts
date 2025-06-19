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
import { ConversationAnalyticsService } from './conversation-analytics/analytics-service';
import { SecurityTrustService } from './security-trust/security-trust-service';
import { ISecurityTrustService } from './security-trust/security-trust-interface';
import { ConversationBranchingService } from './conversation-branching/branching-service';
import { IConversationBranchingService } from './conversation-branching/branching-interface';

// Singleton instances
let messageRouter: MessageRouter | null = null;
let messageTransformer: MessageTransformer | null = null;
let conversationManager: ConversationManager | null = null;
let capabilityRegistry: CapabilityRegistry | null = null;
let agentRelationshipService: AgentRelationshipService | null = null;
let conversationAnalyticsService: ConversationAnalyticsService | null = null;
let securityTrustService: SecurityTrustService | null = null;
let conversationBranchingService: ConversationBranchingService | null = null;

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
    
    // Create Enhanced Memory Service instance if memoryService is compatible
    let enhancedMemoryService: any | undefined; // Use any to avoid circular import
    if (services.memoryService && 'sendAgentMessage' in services.memoryService) {
      enhancedMemoryService = services.memoryService;
    }
    
    conversationManager = new ConversationManager(
      services.memoryService,
      router,
      transformer,
      enhancedMemoryService
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
 * Get the conversation analytics service instance
 */
export async function getConversationAnalyticsService(): Promise<ConversationAnalyticsService> {
  if (!conversationAnalyticsService) {
    const services = await getMemoryServices();
    
    conversationAnalyticsService = new ConversationAnalyticsService(
      services.memoryService
    );
  }
  
  return conversationAnalyticsService;
}

/**
 * Get the security trust service instance
 */
export async function getSecurityTrustService(): Promise<SecurityTrustService> {
  if (!securityTrustService) {
    const services = await getMemoryServices();
    
    securityTrustService = new SecurityTrustService(
      services.memoryService
    );
  }
  
  return securityTrustService;
}

/**
 * Get the conversation branching service instance
 */
export async function getConversationBranchingService(): Promise<ConversationBranchingService> {
  if (!conversationBranchingService) {
    const services = await getMemoryServices();
    
    conversationBranchingService = new ConversationBranchingService(
      services.memoryService
    );
  }
  
  return conversationBranchingService;
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
  transformer: MessageTransformer,
  enhancedMemoryService?: any // Use any to avoid circular import
): ConversationManager {
  return new ConversationManager(
    memoryService,
    router,
    transformer,
    enhancedMemoryService
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

/**
 * Create a custom conversation analytics service
 */
export function createConversationAnalyticsService(
  memoryService: AnyMemoryService
): ConversationAnalyticsService {
  return new ConversationAnalyticsService(
    memoryService
  );
}

// Export component classes
export { MessageRouter } from './message-router';
export { MessageTransformer } from './message-transformer';
export { ConversationManager } from './conversation-manager';
export { CapabilityRegistry } from '../../../../../agents/shared/capabilities/capability-registry';
export { SecurityTrustService } from './security-trust/security-trust-service';
export { ConversationBranchingService } from './conversation-branching/branching-service';

// Export interfaces
export type { IMessageRouter } from './message-router';
export type { IMessageTransformer } from './message-transformer';
export type { IConversationManager } from './conversation-manager';
export type { ICapabilityRegistry } from '../../../../../agents/shared/capabilities/capability-registry';
export type { ISecurityTrustService } from './security-trust/security-trust-interface';
export type { IConversationBranchingService } from './conversation-branching/branching-interface';

// Export type definitions
export type { MessagePriority, RoutingStrategy, DeliveryStatus, AgentMessage, RoutingParams, RoutingResult } from './message-router';
export type { MessageFormat, EnrichmentType, TransformableMessage, TransformationOptions } from './message-transformer';
export type { ConversationState, ParticipantType, ParticipantRole, FlowControlType, Conversation, Participant } from './conversation-manager';
export type { Capability, CapabilityLevel, CapabilityType, AgentCapability } from '../../../../../agents/shared/capabilities/types';

// Export factory
export { MessagingFactory, messagingFactory } from './factory';

// Export interface
export type { IConversationAnalyticsService } from './conversation-analytics/interfaces';

// Export type definitions
export type {
  ConversationAnalytics,
  MessageAnalyticsUpdate,
  AnalyticsQueryOptions,
  ConversationInsights,
  Insight,
  ParticipantAnalytics,
  InteractionLink,
  AnalyticsPeriod,
  InsightType
} from './conversation-analytics/types'; 