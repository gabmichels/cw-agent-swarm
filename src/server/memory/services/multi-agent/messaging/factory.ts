/**
 * Messaging Factory
 * 
 * A factory class that simplifies the creation and access to the multi-agent
 * communication system components.
 */

import { getMessageRouter, getMessageTransformer, getConversationManager, getCapabilityRegistry } from './index';
import { MessageRouter, MessageTransformer, ConversationManager } from './index';
import { CapabilityRegistry } from '../../../../../agents/shared/capabilities/capability-registry';
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
   * Get all messaging components as a bundle
   */
  static async getMessagingComponents(): Promise<{
    router: MessageRouter;
    transformer: MessageTransformer;
    conversationManager: ConversationManager;
    capabilityRegistry: CapabilityRegistry;
  }> {
    const [router, transformer, conversationManager, capabilityRegistry] = await Promise.all([
      this.getMessageRouter(),
      this.getMessageTransformer(),
      this.getConversationManager(),
      this.getCapabilityRegistry()
    ]);
    
    return {
      router,
      transformer,
      conversationManager,
      capabilityRegistry
    };
  }
  
  /**
   * Create custom messaging components with a specific memory service
   */
  static createCustomComponents(memoryService: AnyMemoryService): {
    router: MessageRouter;
    transformer: MessageTransformer;
    conversationManager: ConversationManager;
    capabilityRegistry: CapabilityRegistry;
  } {
    // Create the capability registry first since the router depends on it
    const capabilityRegistry = new CapabilityRegistry(memoryService);
    
    // Create router and transformer
    const router = new MessageRouter(memoryService, capabilityRegistry);
    const transformer = new MessageTransformer(memoryService);
    
    // Create conversation manager which depends on router and transformer
    const conversationManager = new ConversationManager(
      memoryService,
      router,
      transformer
    );
    
    return {
      router,
      transformer,
      conversationManager,
      capabilityRegistry
    };
  }
}

// Also export a direct instance for convenience
export const messagingFactory = new MessagingFactory(); 