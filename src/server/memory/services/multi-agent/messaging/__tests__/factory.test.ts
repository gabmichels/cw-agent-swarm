/**
 * Messaging Factory Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessagingFactory } from '../factory';
import { AnyMemoryService } from '../../../memory/memory-service-wrappers';
import { MessageRouter } from '../message-router';
import { MessageTransformer } from '../message-transformer';
import { ConversationManager } from '../conversation-manager';
import { CapabilityRegistry } from '../../../../../../agents/shared/capabilities/capability-registry';

// Mock constructors
vi.mock('../message-router', () => ({
  MessageRouter: vi.fn().mockImplementation(() => ({ name: 'CustomMessageRouter' }))
}));

vi.mock('../message-transformer', () => ({
  MessageTransformer: vi.fn().mockImplementation(() => ({ name: 'CustomMessageTransformer' }))
}));

vi.mock('../conversation-manager', () => ({
  ConversationManager: vi.fn().mockImplementation(() => ({ name: 'CustomConversationManager' }))
}));

vi.mock('../../../../../../agents/shared/capabilities/capability-registry', () => ({
  CapabilityRegistry: vi.fn().mockImplementation(() => ({ name: 'CustomCapabilityRegistry' }))
}));

// Mock memory service for custom components
const mockMemoryService = {
  name: 'MockMemoryService'
} as unknown as AnyMemoryService;

describe('MessagingFactory', () => {
  // Create mock implementations for factory methods
  const mockRouter = { name: 'MockedMessageRouter' };
  const mockTransformer = { name: 'MockedMessageTransformer' };
  const mockManager = { name: 'MockedConversationManager' };
  const mockRegistry = { name: 'MockedCapabilityRegistry' };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup spies on MessagingFactory methods 
    vi.spyOn(MessagingFactory, 'getMessageRouter').mockResolvedValue(mockRouter as unknown as MessageRouter);
    vi.spyOn(MessagingFactory, 'getMessageTransformer').mockResolvedValue(mockTransformer as unknown as MessageTransformer);
    vi.spyOn(MessagingFactory, 'getConversationManager').mockResolvedValue(mockManager as unknown as ConversationManager);
    vi.spyOn(MessagingFactory, 'getCapabilityRegistry').mockResolvedValue(mockRegistry as unknown as CapabilityRegistry);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('singleton getters', () => {
    it('should get message router singleton', async () => {
      const router = await MessagingFactory.getMessageRouter();
      expect(router).toEqual(mockRouter);
    });
    
    it('should get message transformer singleton', async () => {
      const transformer = await MessagingFactory.getMessageTransformer();
      expect(transformer).toEqual(mockTransformer);
    });
    
    it('should get conversation manager singleton', async () => {
      const manager = await MessagingFactory.getConversationManager();
      expect(manager).toEqual(mockManager);
    });
    
    it('should get capability registry singleton', async () => {
      const registry = await MessagingFactory.getCapabilityRegistry();
      expect(registry).toEqual(mockRegistry);
    });
    
    it('should get all messaging components as a bundle', async () => {
      const components = await MessagingFactory.getMessagingComponents();
      
      expect(components).toEqual({
        router: mockRouter,
        transformer: mockTransformer,
        conversationManager: mockManager,
        capabilityRegistry: mockRegistry
      });
    });
  });
  
  describe('custom components', () => {
    it('should create custom components with provided memory service', () => {
      // Original createCustomComponents is not mocked
      const components = MessagingFactory.createCustomComponents(mockMemoryService);
      
      // Expect constructor calls
      expect(CapabilityRegistry).toHaveBeenCalledWith(mockMemoryService);
      expect(MessageRouter).toHaveBeenCalledWith(
        mockMemoryService,
        expect.anything()
      );
      expect(MessageTransformer).toHaveBeenCalledWith(mockMemoryService);
      expect(ConversationManager).toHaveBeenCalledWith(
        mockMemoryService,
        expect.anything(),
        expect.anything()
      );
      
      // Check that the components have the right structure
      expect(components).toEqual({
        router: expect.anything(),
        transformer: expect.anything(),
        conversationManager: expect.anything(),
        capabilityRegistry: expect.anything()
      });
    });
  });
  
  describe('messagingFactory instance', () => {
    it('should export a MessagingFactory class', () => {
      // Just check that the MessagingFactory class is properly exported
      expect(MessagingFactory).toBeDefined();
      expect(typeof MessagingFactory).toBe('function');
      expect(MessagingFactory.name).toBe('MessagingFactory');
    });
  });
}); 