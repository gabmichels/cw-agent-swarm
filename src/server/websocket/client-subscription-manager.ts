import { ClientSubscriptionManager } from './types';

/**
 * Implementation of the ClientSubscriptionManager interface for tracking client subscriptions
 */
export class DefaultClientSubscriptionManager implements ClientSubscriptionManager {
  // Maps to track subscriptions
  private agentSubscriptions: Map<string, Set<string>> = new Map();
  private chatSubscriptions: Map<string, Set<string>> = new Map();
  private collectionSubscriptions: Map<string, Set<string>> = new Map();
  
  // Reverse maps to track client subscriptions
  private clientAgentSubscriptions: Map<string, Set<string>> = new Map();
  private clientChatSubscriptions: Map<string, Set<string>> = new Map();
  private clientCollectionSubscriptions: Map<string, Set<string>> = new Map();
  
  /**
   * Add a client subscription to an agent
   */
  subscribeToAgent(socketId: string, agentId: string): void {
    // Add to agent subscriptions
    if (!this.agentSubscriptions.has(agentId)) {
      this.agentSubscriptions.set(agentId, new Set());
    }
    this.agentSubscriptions.get(agentId)?.add(socketId);
    
    // Add to client agent subscriptions
    if (!this.clientAgentSubscriptions.has(socketId)) {
      this.clientAgentSubscriptions.set(socketId, new Set());
    }
    this.clientAgentSubscriptions.get(socketId)?.add(agentId);
  }
  
  /**
   * Remove a client subscription from an agent
   */
  unsubscribeFromAgent(socketId: string, agentId: string): void {
    // Remove from agent subscriptions
    this.agentSubscriptions.get(agentId)?.delete(socketId);
    if (this.agentSubscriptions.get(agentId)?.size === 0) {
      this.agentSubscriptions.delete(agentId);
    }
    
    // Remove from client agent subscriptions
    this.clientAgentSubscriptions.get(socketId)?.delete(agentId);
    if (this.clientAgentSubscriptions.get(socketId)?.size === 0) {
      this.clientAgentSubscriptions.delete(socketId);
    }
  }
  
  /**
   * Add a client subscription to a chat
   */
  subscribeToChat(socketId: string, chatId: string): void {
    // Add to chat subscriptions
    if (!this.chatSubscriptions.has(chatId)) {
      this.chatSubscriptions.set(chatId, new Set());
    }
    this.chatSubscriptions.get(chatId)?.add(socketId);
    
    // Add to client chat subscriptions
    if (!this.clientChatSubscriptions.has(socketId)) {
      this.clientChatSubscriptions.set(socketId, new Set());
    }
    this.clientChatSubscriptions.get(socketId)?.add(chatId);
  }
  
  /**
   * Remove a client subscription from a chat
   */
  unsubscribeFromChat(socketId: string, chatId: string): void {
    // Remove from chat subscriptions
    this.chatSubscriptions.get(chatId)?.delete(socketId);
    if (this.chatSubscriptions.get(chatId)?.size === 0) {
      this.chatSubscriptions.delete(chatId);
    }
    
    // Remove from client chat subscriptions
    this.clientChatSubscriptions.get(socketId)?.delete(chatId);
    if (this.clientChatSubscriptions.get(socketId)?.size === 0) {
      this.clientChatSubscriptions.delete(socketId);
    }
  }
  
  /**
   * Add a client subscription to a collection
   */
  subscribeToCollection(socketId: string, collectionId: string): void {
    // Add to collection subscriptions
    if (!this.collectionSubscriptions.has(collectionId)) {
      this.collectionSubscriptions.set(collectionId, new Set());
    }
    this.collectionSubscriptions.get(collectionId)?.add(socketId);
    
    // Add to client collection subscriptions
    if (!this.clientCollectionSubscriptions.has(socketId)) {
      this.clientCollectionSubscriptions.set(socketId, new Set());
    }
    this.clientCollectionSubscriptions.get(socketId)?.add(collectionId);
  }
  
  /**
   * Remove a client subscription from a collection
   */
  unsubscribeFromCollection(socketId: string, collectionId: string): void {
    // Remove from collection subscriptions
    this.collectionSubscriptions.get(collectionId)?.delete(socketId);
    if (this.collectionSubscriptions.get(collectionId)?.size === 0) {
      this.collectionSubscriptions.delete(collectionId);
    }
    
    // Remove from client collection subscriptions
    this.clientCollectionSubscriptions.get(socketId)?.delete(collectionId);
    if (this.clientCollectionSubscriptions.get(socketId)?.size === 0) {
      this.clientCollectionSubscriptions.delete(socketId);
    }
  }
  
  /**
   * Get all clients subscribed to an agent
   */
  getAgentSubscribers(agentId: string): string[] {
    return Array.from(this.agentSubscriptions.get(agentId) || []);
  }
  
  /**
   * Get all clients subscribed to a chat
   */
  getChatSubscribers(chatId: string): string[] {
    return Array.from(this.chatSubscriptions.get(chatId) || []);
  }
  
  /**
   * Get all clients subscribed to a collection
   */
  getCollectionSubscribers(collectionId: string): string[] {
    return Array.from(this.collectionSubscriptions.get(collectionId) || []);
  }
  
  /**
   * Remove all subscriptions for a client (on disconnect)
   */
  removeAllSubscriptions(socketId: string): void {
    // Remove agent subscriptions
    const agentIds = Array.from(this.clientAgentSubscriptions.get(socketId) || []);
    for (const agentId of agentIds) {
      this.unsubscribeFromAgent(socketId, agentId);
    }
    
    // Remove chat subscriptions
    const chatIds = Array.from(this.clientChatSubscriptions.get(socketId) || []);
    for (const chatId of chatIds) {
      this.unsubscribeFromChat(socketId, chatId);
    }
    
    // Remove collection subscriptions
    const collectionIds = Array.from(this.clientCollectionSubscriptions.get(socketId) || []);
    for (const collectionId of collectionIds) {
      this.unsubscribeFromCollection(socketId, collectionId);
    }
    
    // Clear client maps
    this.clientAgentSubscriptions.delete(socketId);
    this.clientChatSubscriptions.delete(socketId);
    this.clientCollectionSubscriptions.delete(socketId);
  }
} 