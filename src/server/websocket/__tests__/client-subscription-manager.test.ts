import { describe, test, expect, beforeEach } from 'vitest';
import { DefaultClientSubscriptionManager } from '../client-subscription-manager';

describe('DefaultClientSubscriptionManager', () => {
  let subscriptionManager: DefaultClientSubscriptionManager;
  const socketId1 = 'socket-1';
  const socketId2 = 'socket-2';
  const agentId1 = 'agent-1';
  const agentId2 = 'agent-2';
  const chatId1 = 'chat-1';
  const chatId2 = 'chat-2';
  const collectionId1 = 'collection-1';
  const collectionId2 = 'collection-2';

  beforeEach(() => {
    subscriptionManager = new DefaultClientSubscriptionManager();
  });

  describe('Agent Subscriptions', () => {
    test('should subscribe a client to an agent', () => {
      subscriptionManager.subscribeToAgent(socketId1, agentId1);
      
      const subscribers = subscriptionManager.getAgentSubscribers(agentId1);
      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain(socketId1);
    });

    test('should handle multiple clients subscribing to the same agent', () => {
      subscriptionManager.subscribeToAgent(socketId1, agentId1);
      subscriptionManager.subscribeToAgent(socketId2, agentId1);
      
      const subscribers = subscriptionManager.getAgentSubscribers(agentId1);
      expect(subscribers).toHaveLength(2);
      expect(subscribers).toContain(socketId1);
      expect(subscribers).toContain(socketId2);
    });

    test('should handle a client subscribing to multiple agents', () => {
      subscriptionManager.subscribeToAgent(socketId1, agentId1);
      subscriptionManager.subscribeToAgent(socketId1, agentId2);
      
      const subscribers1 = subscriptionManager.getAgentSubscribers(agentId1);
      const subscribers2 = subscriptionManager.getAgentSubscribers(agentId2);
      
      expect(subscribers1).toHaveLength(1);
      expect(subscribers1).toContain(socketId1);
      
      expect(subscribers2).toHaveLength(1);
      expect(subscribers2).toContain(socketId1);
    });

    test('should unsubscribe a client from an agent', () => {
      subscriptionManager.subscribeToAgent(socketId1, agentId1);
      subscriptionManager.subscribeToAgent(socketId2, agentId1);
      
      subscriptionManager.unsubscribeFromAgent(socketId1, agentId1);
      
      const subscribers = subscriptionManager.getAgentSubscribers(agentId1);
      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain(socketId2);
      expect(subscribers).not.toContain(socketId1);
    });

    test('should return an empty array for non-existent agent subscriptions', () => {
      const subscribers = subscriptionManager.getAgentSubscribers('non-existent');
      expect(subscribers).toHaveLength(0);
      expect(subscribers).toEqual([]);
    });
  });

  describe('Chat Subscriptions', () => {
    test('should subscribe a client to a chat', () => {
      subscriptionManager.subscribeToChat(socketId1, chatId1);
      
      const subscribers = subscriptionManager.getChatSubscribers(chatId1);
      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain(socketId1);
    });

    test('should handle multiple clients subscribing to the same chat', () => {
      subscriptionManager.subscribeToChat(socketId1, chatId1);
      subscriptionManager.subscribeToChat(socketId2, chatId1);
      
      const subscribers = subscriptionManager.getChatSubscribers(chatId1);
      expect(subscribers).toHaveLength(2);
      expect(subscribers).toContain(socketId1);
      expect(subscribers).toContain(socketId2);
    });

    test('should handle a client subscribing to multiple chats', () => {
      subscriptionManager.subscribeToChat(socketId1, chatId1);
      subscriptionManager.subscribeToChat(socketId1, chatId2);
      
      const subscribers1 = subscriptionManager.getChatSubscribers(chatId1);
      const subscribers2 = subscriptionManager.getChatSubscribers(chatId2);
      
      expect(subscribers1).toHaveLength(1);
      expect(subscribers1).toContain(socketId1);
      
      expect(subscribers2).toHaveLength(1);
      expect(subscribers2).toContain(socketId1);
    });

    test('should unsubscribe a client from a chat', () => {
      subscriptionManager.subscribeToChat(socketId1, chatId1);
      subscriptionManager.subscribeToChat(socketId2, chatId1);
      
      subscriptionManager.unsubscribeFromChat(socketId1, chatId1);
      
      const subscribers = subscriptionManager.getChatSubscribers(chatId1);
      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain(socketId2);
      expect(subscribers).not.toContain(socketId1);
    });
  });

  describe('Collection Subscriptions', () => {
    test('should subscribe a client to a collection', () => {
      subscriptionManager.subscribeToCollection(socketId1, collectionId1);
      
      const subscribers = subscriptionManager.getCollectionSubscribers(collectionId1);
      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain(socketId1);
    });

    test('should handle multiple clients subscribing to the same collection', () => {
      subscriptionManager.subscribeToCollection(socketId1, collectionId1);
      subscriptionManager.subscribeToCollection(socketId2, collectionId1);
      
      const subscribers = subscriptionManager.getCollectionSubscribers(collectionId1);
      expect(subscribers).toHaveLength(2);
      expect(subscribers).toContain(socketId1);
      expect(subscribers).toContain(socketId2);
    });

    test('should unsubscribe a client from a collection', () => {
      subscriptionManager.subscribeToCollection(socketId1, collectionId1);
      subscriptionManager.subscribeToCollection(socketId2, collectionId1);
      
      subscriptionManager.unsubscribeFromCollection(socketId1, collectionId1);
      
      const subscribers = subscriptionManager.getCollectionSubscribers(collectionId1);
      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain(socketId2);
      expect(subscribers).not.toContain(socketId1);
    });
  });

  describe('Remove All Subscriptions', () => {
    test('should remove all subscriptions for a client', () => {
      // Subscribe to multiple entities
      subscriptionManager.subscribeToAgent(socketId1, agentId1);
      subscriptionManager.subscribeToAgent(socketId1, agentId2);
      subscriptionManager.subscribeToChat(socketId1, chatId1);
      subscriptionManager.subscribeToCollection(socketId1, collectionId1);
      
      // Remove all subscriptions
      subscriptionManager.removeAllSubscriptions(socketId1);
      
      // Verify all subscriptions are removed
      expect(subscriptionManager.getAgentSubscribers(agentId1)).not.toContain(socketId1);
      expect(subscriptionManager.getAgentSubscribers(agentId2)).not.toContain(socketId1);
      expect(subscriptionManager.getChatSubscribers(chatId1)).not.toContain(socketId1);
      expect(subscriptionManager.getCollectionSubscribers(collectionId1)).not.toContain(socketId1);
    });

    test('should not affect other clients when removing subscriptions', () => {
      // Subscribe two clients
      subscriptionManager.subscribeToAgent(socketId1, agentId1);
      subscriptionManager.subscribeToAgent(socketId2, agentId1);
      
      // Remove one client's subscriptions
      subscriptionManager.removeAllSubscriptions(socketId1);
      
      // Verify only the target client is affected
      const subscribers = subscriptionManager.getAgentSubscribers(agentId1);
      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain(socketId2);
      expect(subscribers).not.toContain(socketId1);
    });
  });
}); 