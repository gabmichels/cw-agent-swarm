/**
 * Messaging Factory
 * 
 * A factory class that simplifies the creation and access to the multi-agent
 * communication system components.
 */

import { 
  getMessageRouter, 
  getMessageTransformer, 
  getConversationManager, 
  getCapabilityRegistry,
  getAgentRelationshipService,
  getConversationAnalyticsService,
  getSecurityTrustService,
  getConversationBranchingService
} from './index';
import { 
  MessageRouter, 
  MessageTransformer, 
  ConversationManager,
  SecurityTrustService,
  ConversationBranchingService
} from './index';
import { CapabilityRegistry } from '../../../../../agents/shared/capabilities/capability-registry';
import { AgentRelationshipService } from '../../../../../agents/shared/capabilities/agent-relationship';
import { ConversationAnalyticsService } from './conversation-analytics/analytics-service';
import { AnyMemoryService } from '../../memory/memory-service-wrappers';

/**
 * Factory class for creating and accessing multi-agent communication components
 */
export class MessagingFactory {
  /**
   * Get the singleton message router instance
   */
  static async getMessageRouter(): Promise<MessageRouter> {
    return getMessageRouter();
  }
  
  /**
   * Get the singleton message transformer instance
   */
  static async getMessageTransformer(): Promise<MessageTransformer> {
    return getMessageTransformer();
  }
  
  /**
   * Get the singleton conversation manager instance
   */
  static async getConversationManager(): Promise<ConversationManager> {
    return getConversationManager();
  }
  
  /**
   * Get the singleton capability registry instance
   */
  static async getCapabilityRegistry(): Promise<CapabilityRegistry> {
    return getCapabilityRegistry();
  }
  
  /**
   * Get the singleton agent relationship service instance
   */
  static async getAgentRelationshipService(): Promise<AgentRelationshipService> {
    return getAgentRelationshipService();
  }
  
  /**
   * Get the singleton conversation analytics service instance
   */
  static async getConversationAnalyticsService(): Promise<ConversationAnalyticsService> {
    return getConversationAnalyticsService();
  }
  
  /**
   * Get the singleton security trust service instance
   */
  static async getSecurityTrustService(): Promise<SecurityTrustService> {
    return getSecurityTrustService();
  }
  
  /**
   * Get the singleton conversation branching service instance
   */
  static async getConversationBranchingService(): Promise<ConversationBranchingService> {
    return getConversationBranchingService();
  }
  
  /**
   * Create a new message router instance (for testing)
   */
  static createMessageRouter(
    memoryService: AnyMemoryService,
    capabilityRegistry: CapabilityRegistry
  ): MessageRouter {
    return new MessageRouter(memoryService, capabilityRegistry);
  }
  
  /**
   * Create a new message transformer instance (for testing)
   */
  static createMessageTransformer(
    memoryService: AnyMemoryService
  ): MessageTransformer {
    return new MessageTransformer(memoryService);
  }
  
  /**
   * Create a new conversation manager instance (for testing)
   */
  static createConversationManager(
    memoryService: AnyMemoryService,
    messageRouter: MessageRouter,
    messageTransformer: MessageTransformer
  ): ConversationManager {
    return new ConversationManager(memoryService, messageRouter, messageTransformer);
  }
  
  /**
   * Create a new capability registry instance (for testing)
   */
  static createCapabilityRegistry(
    memoryService: AnyMemoryService
  ): CapabilityRegistry {
    return new CapabilityRegistry(memoryService);
  }
  
  /**
   * Create a new agent relationship service instance (for testing)
   */
  static createAgentRelationshipService(
    memoryService: AnyMemoryService
  ): AgentRelationshipService {
    return new AgentRelationshipService(memoryService);
  }
  
  /**
   * Create a new conversation analytics service instance (for testing)
   */
  static createConversationAnalyticsService(
    memoryService: AnyMemoryService
  ): ConversationAnalyticsService {
    return new ConversationAnalyticsService(memoryService);
  }
  
  /**
   * Create a new security trust service instance (for testing)
   */
  static createSecurityTrustService(
    memoryService: AnyMemoryService
  ): SecurityTrustService {
    return new SecurityTrustService(memoryService);
  }
  
  /**
   * Create a new conversation branching service instance (for testing)
   */
  static createConversationBranchingService(
    memoryService: AnyMemoryService
  ): ConversationBranchingService {
    return new ConversationBranchingService(memoryService);
  }
}

// Also export a direct instance for convenience
export const messagingFactory = new MessagingFactory(); 