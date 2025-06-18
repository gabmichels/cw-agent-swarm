/**
 * Message Router Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageRouter, MessagePriority, RoutingStrategy, DeliveryStatus, AgentMessage, RoutingParams } from '../message-router';
import { AnyMemoryService } from '../../../memory/memory-service-wrappers';
import { CapabilityRegistry } from '../../../../../../agents/shared/capabilities/capability-registry';
import { MemoryType } from '../../../../config/types';
import { createAgentId, createChatId } from '../../../../../../types/entity-identifier';

// Mock dependencies
// Create properly typed mock functions
const mockAddMemory = vi.fn().mockResolvedValue({ success: true, id: 'mock-mem-id' });
const mockSearchMemories = vi.fn().mockResolvedValue([]);
const mockUpdateMemory = vi.fn().mockResolvedValue(true);
const mockDeleteMemory = vi.fn().mockResolvedValue(true);

const mockMemoryService = {
  addMemory: mockAddMemory,
  searchMemories: mockSearchMemories,
  updateMemory: mockUpdateMemory,
  deleteMemory: mockDeleteMemory
} as unknown as AnyMemoryService;

// Create properly typed mock functions for capability registry
const mockFindProviders = vi.fn().mockResolvedValue(['agent-1', 'agent-2']);
const mockGetAgentCapabilities = vi.fn().mockResolvedValue([]);

const mockCapabilityRegistry = {
  findProviders: mockFindProviders,
  getAgentCapabilities: mockGetAgentCapabilities
} as unknown as CapabilityRegistry;

// Test data
const TEST_AGENT_ID = createAgentId('test-agent');
const TEST_RECIPIENT_ID = createAgentId('test-recipient');
const TEST_CHAT_ID = createChatId('test-chat');

describe('MessageRouter', () => {
  let router: MessageRouter;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create router instance with mocked dependencies
    router = new MessageRouter(
      mockMemoryService,
      mockCapabilityRegistry
    );
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('routeMessage', () => {
    it('should route a direct message successfully', async () => {
      // Mock successful delivery
      mockAddMemory.mockResolvedValueOnce({ success: true, id: 'msg-1' });
      
      // Create test message
      const testMessage: AgentMessage = {
        id: 'test-message-1',
        senderId: TEST_AGENT_ID.toString(),
        recipientId: TEST_RECIPIENT_ID.toString(),
        chatId: TEST_CHAT_ID.toString(),
        content: 'Hello recipient',
        timestamp: Date.now(),
        priority: MessagePriority.NORMAL,
        routingStrategy: RoutingStrategy.DIRECT,
        deliveryStatus: DeliveryStatus.PENDING,
        traceId: 'trace-1'
      };
      
      const params: RoutingParams = {
        message: testMessage,
        strategy: RoutingStrategy.DIRECT
      };
      
      // Call method
      const result = await router.routeMessage(params);
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-1');
      expect(result.recipientIds).toContain(TEST_RECIPIENT_ID.toString());
      expect(result.traceId).toBe('trace-1');
      
      // Verify memory service was called
      expect(mockAddMemory).toHaveBeenCalledWith({
        type: MemoryType.MESSAGE,
        content: 'Hello recipient',
        metadata: expect.objectContaining({
          messageType: 'agent-communication'
        })
      });
    });
    
    it('should fail when no recipient is specified for direct routing', async () => {
      // Create test message without recipientId
      const testMessage: AgentMessage = {
        id: 'test-message-1',
        senderId: TEST_AGENT_ID.toString(),
        chatId: TEST_CHAT_ID.toString(),
        content: 'Hello recipient',
        timestamp: Date.now(),
        priority: MessagePriority.NORMAL,
        routingStrategy: RoutingStrategy.DIRECT,
        deliveryStatus: DeliveryStatus.PENDING,
        traceId: 'trace-1'
      };
      
      const params: RoutingParams = {
        message: testMessage,
        strategy: RoutingStrategy.DIRECT
      };
      
      // Call method
      const result = await router.routeMessage(params);
      
      // Verify result
      expect(result.success).toBe(false);
      expect(result.recipientIds).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].code).toBe('ROUTING_ERROR');
      expect(result.errors![0].message).toContain('Recipient ID is required');
    });
    
    it('should route messages by capability', async () => {
      // Mock finding providers by capability
      mockFindProviders.mockResolvedValueOnce(['agent-3', 'agent-4']);
      
      // Create test message
      const testMessage: AgentMessage = {
        id: 'test-message-1',
        senderId: TEST_AGENT_ID.toString(),
        chatId: TEST_CHAT_ID.toString(),
        content: 'I need help with coding',
        timestamp: Date.now(),
        priority: MessagePriority.HIGH,
        requiredCapabilities: ['coding.javascript'],
        routingStrategy: RoutingStrategy.CAPABILITY,
        deliveryStatus: DeliveryStatus.PENDING
      };
      
      const params: RoutingParams = {
        message: testMessage,
        strategy: RoutingStrategy.CAPABILITY,
        requiredCapabilities: ['coding.javascript']
      };
      
      // Mock successful deliveries
      mockAddMemory
        .mockResolvedValueOnce({ success: true, id: 'msg-1' })
        .mockResolvedValueOnce({ success: true, id: 'msg-2' });
      
      // Call method
      const result = await router.routeMessage(params);
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.recipientIds).toEqual(['agent-3', 'agent-4']);
      
      // Verify capability registry was called
      expect(mockFindProviders).toHaveBeenCalledWith('coding.javascript');
      
      // Verify memory service was called twice (one for each recipient)
      expect(mockAddMemory).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('getMessageStatus', () => {
    it('should return the status of a message', async () => {
      // Mock finding the message
      mockSearchMemories.mockResolvedValueOnce([{
        id: 'msg-1',
        payload: {
          text: 'Test message',
          metadata: {
            deliveryStatus: DeliveryStatus.DELIVERED
          }
        }
      }]);
      
      // Call method
      const status = await router.getMessageStatus('msg-1');
      
      // Verify result
      expect(status).toBe(DeliveryStatus.DELIVERED);
      
      // Verify memory service was called
      expect(mockSearchMemories).toHaveBeenCalledWith({
        type: MemoryType.MESSAGE,
        filter: { id: 'msg-1' }
      });
    });
    
    it('should throw an error if message is not found', async () => {
      // Mock not finding the message
      mockSearchMemories.mockResolvedValueOnce([]);
      
      // Call method and expect it to throw
      await expect(router.getMessageStatus('non-existent-msg'))
        .rejects.toThrow('Message not found');
    });
  });
  
  describe('getAgentQueue', () => {
    it('should return the message queue for an agent', async () => {
      // Mock finding messages in queue
      mockSearchMemories.mockResolvedValueOnce([
        {
          id: 'msg-1',
          payload: {
            text: 'Message 1',
            metadata: {
              senderId: 'sender-1',
              recipientId: 'agent-1',
              chatId: 'chat-1',
              priority: MessagePriority.NORMAL,
              routingStrategy: RoutingStrategy.DIRECT,
              deliveryStatus: DeliveryStatus.PENDING,
              traceId: 'trace-1'
            }
          }
        }
      ]);
      
      // Call method
      const queue = await router.getAgentQueue('agent-1');
      
      // Verify result
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('msg-1');
      expect(queue[0].content).toBe('Message 1');
      expect(queue[0].senderId).toBe('sender-1');
      expect(queue[0].recipientId).toBe('agent-1');
      
      // Verify memory service was called
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: MemoryType.MESSAGE,
        filter: {
          recipientId: 'agent-1',
          'metadata.deliveryStatus': DeliveryStatus.PENDING
        }
      }));
    });
  });
}); 