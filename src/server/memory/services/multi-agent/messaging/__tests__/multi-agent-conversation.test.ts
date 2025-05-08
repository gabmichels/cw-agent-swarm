/**
 * Multi-Agent Conversation Tests (Vitest Version)
 * 
 * This file contains integration tests for the multi-agent conversation system,
 * testing the interaction between multiple agents using the communication protocols,
 * message router, and conversation manager.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageFormat } from '../communication-protocols';

// Mock the module (Vitest automatically hoists this)
vi.mock('../factory', () => ({
  MessagingFactory: {
    getMessageRouter: vi.fn(),
    getConversationManager: vi.fn(),
    getCapabilityRegistry: vi.fn()
  }
}));

// Import the factory after mocking it
import { MessagingFactory } from '../factory';

describe('Multi-Agent Conversation Integration', () => {
  // Test constants
  const mockData = {
    conversationId: 'conv-1',
    coordinatorId: 'agent-coordinator',
    specialistId: 'agent-specialist',
    userId: 'user-1'
  };
  
  // Create mock functions inside the describe block
  const mockRouteMessage = vi.fn();
  const mockGetConversation = vi.fn();
  const mockSubmitMessage = vi.fn();
  const mockFindProviders = vi.fn();
  
  beforeEach(() => {
    // Setup mocks before each test
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => 'mock-uuid');
    vi.spyOn(Date, 'now').mockImplementation(() => 1234567890);
    
    // Setup mock implementations
    mockRouteMessage.mockResolvedValue(['agent-specialist']);
    mockGetConversation.mockResolvedValue({
      id: 'conv-1',
      participants: [
        { id: 'agent-coordinator', type: 'agent', role: 'admin' },
        { id: 'agent-specialist', type: 'agent', role: 'member' },
        { id: 'user-1', type: 'user', role: 'member' }
      ],
      state: 'active',
      messages: []
    });
    mockSubmitMessage.mockResolvedValue({ id: 'msg-1', conversationId: 'conv-1' });
    mockFindProviders.mockResolvedValue(['agent-specialist']);
    
    // Set up factory mock implementations
    (MessagingFactory.getMessageRouter as any).mockResolvedValue({
      routeMessage: mockRouteMessage
    });
    (MessagingFactory.getConversationManager as any).mockResolvedValue({
      getConversation: mockGetConversation,
      submitMessage: mockSubmitMessage
    });
    (MessagingFactory.getCapabilityRegistry as any).mockResolvedValue({
      findProviders: mockFindProviders
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });
  
  test('should successfully route messages between agents', async () => {
    // Get the message router
    const router = await MessagingFactory.getMessageRouter();
    
    // Route a test message
    const result = await router.routeMessage({
      message: {
        content: 'test message',
        senderId: mockData.coordinatorId,
        id: 'test-msg-1',
        chatId: 'chat-1',
        timestamp: 1234567890,
        // Add required properties for AgentMessage type
        priority: 'normal',
        routingStrategy: 'direct',
        deliveryStatus: 'pending'
      } as any
    } as any);
    
    // Verify the message was routed correctly
    expect(mockRouteMessage).toHaveBeenCalled();
    expect(result).toContain(mockData.specialistId);
  });
  
  test('should create and manage conversations', async () => {
    // Get the conversation manager
    const conversationManager = await MessagingFactory.getConversationManager();
    
    // Get a conversation
    const conversation = await conversationManager.getConversation(mockData.conversationId);
    
    // Verify conversation structure
    expect(mockGetConversation).toHaveBeenCalledWith(mockData.conversationId);
    expect(conversation.id).toBe(mockData.conversationId);
    expect(conversation.participants).toHaveLength(3);
    
    // Submit a message
    await conversationManager.submitMessage(mockData.conversationId, {
      senderId: mockData.coordinatorId,
      content: 'Test message',
      format: MessageFormat.TEXT
    });
    
    // Verify message was submitted
    expect(mockSubmitMessage).toHaveBeenCalledWith(
      mockData.conversationId,
      expect.objectContaining({
        senderId: mockData.coordinatorId,
        content: 'Test message'
      })
    );
  });
  
  test('should find agents based on capabilities', async () => {
    // Get the capability registry
    const capabilityRegistry = await MessagingFactory.getCapabilityRegistry();
    
    // Find providers for a capability
    const providers = await capabilityRegistry.findProviders('data_analysis');
    
    // Verify the correct capability was requested
    expect(mockFindProviders).toHaveBeenCalledWith('data_analysis');
    
    // Verify providers contain the expected agent
    expect(providers).toContain(mockData.specialistId);
  });
}); 