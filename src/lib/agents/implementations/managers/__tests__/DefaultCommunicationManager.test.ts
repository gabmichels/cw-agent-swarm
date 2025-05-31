/**
 * DefaultCommunicationManager.test.ts - Unit Tests for DefaultCommunicationManager
 * 
 * Comprehensive test suite covering all functionality of the DefaultCommunicationManager
 * Following @IMPLEMENTATION_GUIDELINES.md requirements for >95% test coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { DefaultCommunicationManager, DefaultCommunicationManagerConfig, CommunicationError } from '../DefaultCommunicationManager';
import { ManagerType } from '../../../../../agents/shared/base/managers/ManagerType';
import { 
  AgentMessage,
  MessageResponse,
  MessageType,
  MessagePriority,
  CommunicationProtocol,
  DelegationRequest,
  DelegationResult,
  SendMessageOptions
} from '../../../../../agents/shared/base/managers/CommunicationManager.interface';
import { AgentBase } from '../../../../../agents/shared/base/AgentBase';
import { TaskStatus, TaskPriority } from '../../../../../services/thinking/delegation/DelegationManager';

// Mock MessageRouter
vi.mock('../../../../../agents/shared/messaging/MessageRouter', () => ({
  MessageRouter: {
    registerHandler: vi.fn(),
    sendMessage: vi.fn(),
    broadcastMessage: vi.fn(),
    getMessagesForAgent: vi.fn(),
    clearHandlers: vi.fn(),
    clearMessageLog: vi.fn()
  }
}));

// Mock DelegationManager
vi.mock('../../../../../services/thinking/delegation/DelegationManager', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    DelegationManager: vi.fn().mockImplementation(() => ({
      delegateTask: vi.fn(),
      registerAgent: vi.fn(),
      updateAgentStatus: vi.fn(),
      getAgentStatus: vi.fn()
    }))
  };
});

// Mock AgentBase
const createMockAgent = (): AgentBase => ({
  getId: vi.fn(() => 'test-agent-123'),
  getName: vi.fn(() => 'Test Agent'),
  getType: vi.fn(() => 'test'),
  getStatus: vi.fn(() => 'active'),
  initialize: vi.fn(() => Promise.resolve(true)),
  shutdown: vi.fn(() => Promise.resolve()),
  reset: vi.fn(() => Promise.resolve(true)),
  processInput: vi.fn(),
  generateResponse: vi.fn(),
  getHealth: vi.fn(),
  getConfiguration: vi.fn(() => ({})),
  updateConfiguration: vi.fn()
} as any);

describe('DefaultCommunicationManager', () => {
  let manager: DefaultCommunicationManager;
  let mockAgent: AgentBase;
  let config: Partial<DefaultCommunicationManagerConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAgent = createMockAgent();
    config = {
      enabled: true,
      enableMessageRouting: true,
      enableDelegation: true,
      defaultMessageTimeout: 30000,
      maxRetryAttempts: 3,
      maxMessageHistory: 1000,
      maxDelegationHistory: 500
    };
    manager = new DefaultCommunicationManager(mockAgent, config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test data
  const testMessage: AgentMessage = {
    id: 'msg-123',
    fromAgentId: 'test-agent-123',
    toAgentId: 'target-agent-456',
    type: MessageType.REQUEST,
    protocol: CommunicationProtocol.REQUEST_RESPONSE,
    priority: MessagePriority.NORMAL,
    content: 'Test message content',
    payload: { data: 'test' },
    timestamp: new Date(),
    correlationId: 'corr-123',
    requiresResponse: true,
    responseTimeout: 30000
  };

  const testDelegationRequest: DelegationRequest = {
    id: 'delegation-123',
    task: {
      id: 'task-123',
      type: 'analysis',
      description: 'Analyze the provided data',
      parameters: { data: 'sample data' },
      priority: MessagePriority.HIGH
    },
    requiredCapabilities: ['analysis', 'data-processing'],
    context: {
      originalAgentId: 'test-agent-123',
      reason: 'Specialized analysis required',
      expectedOutcome: 'Detailed analysis report'
    }
  };

  describe('Constructor and Basic Properties', () => {
    it('should create instance with correct properties', () => {
      expect(manager.managerType).toBe(ManagerType.COMMUNICATION);
      expect(manager.managerId).toMatch(/communication-manager-[0-9A-Z]{26}/);
      expect(manager.getAgent()).toBe(mockAgent);
    });

    it('should merge config with defaults', () => {
      const customConfig = { enabled: false, defaultMessageTimeout: 60000 };
      const customManager = new DefaultCommunicationManager(mockAgent, customConfig);
      
      const finalConfig = customManager.getConfig();
      expect(finalConfig.enabled).toBe(false);
      expect(finalConfig.defaultMessageTimeout).toBe(60000);
      expect(finalConfig.enableMessageRouting).toBe(true); // default value
    });

    it('should use default config when none provided', () => {
      const defaultManager = new DefaultCommunicationManager(mockAgent);
      const config = defaultManager.getConfig();
      
      expect(config.enabled).toBe(false); // default is disabled
      expect(config.enableMessageRouting).toBe(true);
      expect(config.enableDelegation).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = manager.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.enableMessageRouting).toBe(true);
      expect(config.defaultMessageTimeout).toBe(30000);
    });

    it('should update configuration', () => {
      const newConfig = { enabled: false, defaultMessageTimeout: 60000 };
      const updatedConfig = manager.updateConfig(newConfig);
      
      expect(updatedConfig.enabled).toBe(false);
      expect(updatedConfig.defaultMessageTimeout).toBe(60000);
    });

    it('should check if manager is enabled', () => {
      expect(manager.isEnabled()).toBe(true);
      
      manager.updateConfig({ enabled: false });
      expect(manager.isEnabled()).toBe(false);
    });

    it('should set enabled status', () => {
      const result = manager.setEnabled(false);
      expect(result).toBe(false);
      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe('Lifecycle Management', () => {
    it('should initialize when enabled', async () => {
      const result = await manager.initialize();
      expect(result).toBe(true);
    });

    it('should initialize when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const result = await manager.initialize();
      expect(result).toBe(true);
    });

    it('should shutdown successfully', async () => {
      await manager.initialize();
      await manager.shutdown();
      expect(manager['_initialized']).toBe(false);
    });

    it('should reset successfully', async () => {
      await manager.initialize();
      const result = await manager.reset();
      expect(result).toBe(true);
    });

    it('should handle initialization errors', async () => {
      // Mock MessageRouter to throw error
      const { MessageRouter } = await import('../../../../../agents/shared/messaging/MessageRouter');
      vi.mocked(MessageRouter.registerHandler).mockImplementation(() => {
        throw new Error('Handler registration failed');
      });
      
      await expect(manager.initialize()).rejects.toThrow(CommunicationError);
    });
  });

  describe('Health Monitoring', () => {
    it('should return healthy status when enabled and initialized', async () => {
      await manager.initialize();
      const health = await manager.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.details.issues).toHaveLength(0);
    });

    it('should return degraded status when disabled', async () => {
      manager.updateConfig({ enabled: false });
      const health = await manager.getHealth();
      
      expect(health.status).toBe('degraded');
      expect(health.details.issues).toHaveLength(1);
      expect(health.details.issues[0].message).toContain('disabled');
    });

    it('should warn when message history is approaching capacity', async () => {
      await manager.initialize();
      
      // Set a smaller capacity for testing
      manager['_config'].maxMessageHistory = 10;
      
      // Fill with 90% of capacity (9 messages out of 10, which is >90%)
      for (let i = 0; i < 10; i++) {
        manager['addToMessageHistory']({
          ...testMessage,
          id: `msg-${i}`,
          timestamp: new Date()
        });
      }
      
      const health = await manager.getHealth();
      expect(health.status).toBe('degraded');
      
      const capacityIssue = health.details.issues.find(issue => 
        issue.message.includes('approaching maximum capacity')
      );
      expect(capacityIssue).toBeDefined();
    });

    it('should warn when delegation history is approaching capacity', async () => {
      await manager.initialize();
      
      // Set a smaller capacity for testing
      manager['_config'].maxDelegationHistory = 10;
      
      // Fill with 90% of capacity (9 delegations out of 10, which is >90%)
      for (let i = 0; i < 10; i++) {
        manager['addToDelegationHistory']({
          delegationId: `del-${i}`,
          taskId: `task-${i}`,
          assignedAgentId: 'agent-1',
          status: 'completed'
        });
      }
      
      const health = await manager.getHealth();
      expect(health.status).toBe('degraded');
      
      const capacityIssue = health.details.issues.find(issue => 
        issue.message.includes('approaching maximum capacity')
      );
      expect(capacityIssue).toBeDefined();
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should send message successfully', async () => {
      const { MessageRouter } = await import('../../../../../agents/shared/messaging/MessageRouter');
      vi.mocked(MessageRouter.sendMessage).mockResolvedValue({ success: true });

      const response = await manager.sendMessage(
        'target-agent',
        MessageType.REQUEST,
        'Test message'
      );

      expect(response.success).toBe(true);
      expect(MessageRouter.sendMessage).toHaveBeenCalled();
    });

    it('should send message with options', async () => {
      const { MessageRouter } = await import('../../../../../agents/shared/messaging/MessageRouter');
      vi.mocked(MessageRouter.sendMessage).mockResolvedValue({ success: true });

      const options: SendMessageOptions = {
        priority: MessagePriority.HIGH,
        protocol: CommunicationProtocol.NOTIFICATION,
        requiresResponse: true,
        metadata: { source: 'test' }
      };

      const response = await manager.sendMessage(
        'target-agent',
        MessageType.NOTIFICATION,
        'High priority message',
        { urgentData: true },
        options
      );

      expect(response.success).toBe(true);
      expect(MessageRouter.sendMessage).toHaveBeenCalled();
    });

    it('should return error when disabled', async () => {
      manager.updateConfig({ enabled: false });
      
      const response = await manager.sendMessage(
        'target-agent',
        MessageType.REQUEST,
        'Test message'
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('disabled');
    });

    it('should handle send message errors', async () => {
      const { MessageRouter } = await import('../../../../../agents/shared/messaging/MessageRouter');
      vi.mocked(MessageRouter.sendMessage).mockRejectedValue(new Error('Send failed'));

      await expect(manager.sendMessage(
        'target-agent',
        MessageType.REQUEST,
        'Test message'
      )).rejects.toThrow(CommunicationError);
    });
  });

  describe('Message Broadcasting', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should broadcast message to multiple agents', async () => {
      const { MessageRouter } = await import('../../../../../agents/shared/messaging/MessageRouter');
      vi.mocked(MessageRouter.broadcastMessage).mockResolvedValue({
        'agent-1': { success: true },
        'agent-2': { success: true }
      });

      const responses = await manager.broadcastMessage(
        ['agent-1', 'agent-2'],
        MessageType.NOTIFICATION,
        'Broadcast message'
      );

      expect(Object.keys(responses)).toHaveLength(2);
      expect(responses['agent-1'].success).toBe(true);
      expect(responses['agent-2'].success).toBe(true);
    });

    it('should return error responses when disabled', async () => {
      manager.updateConfig({ enabled: false });
      
      const responses = await manager.broadcastMessage(
        ['agent-1', 'agent-2'],
        MessageType.NOTIFICATION,
        'Broadcast message'
      );

      expect(Object.keys(responses)).toHaveLength(2);
      expect(responses['agent-1'].success).toBe(false);
      expect(responses['agent-2'].success).toBe(false);
    });

    it('should handle broadcast errors', async () => {
      const { MessageRouter } = await import('../../../../../agents/shared/messaging/MessageRouter');
      vi.mocked(MessageRouter.broadcastMessage).mockRejectedValue(new Error('Broadcast failed'));

      await expect(manager.broadcastMessage(
        ['agent-1', 'agent-2'],
        MessageType.NOTIFICATION,
        'Broadcast message'
      )).rejects.toThrow(CommunicationError);
    });
  });

  describe('Task Delegation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should delegate task successfully', async () => {
      const mockDelegationManager = manager['delegationManager'];
      mockDelegationManager.delegateTask = vi.fn().mockResolvedValue({
        success: true,
        taskId: 'task-123',
        agentId: 'agent-1',
        confidence: 0.9,
        reason: 'Best match',
        status: TaskStatus.ASSIGNED
      });

      const result = await manager.delegateTask(testDelegationRequest);

      expect(result.status).toBe('accepted');
      expect(result.assignedAgentId).toBe('agent-1');
      expect(result.delegationId).toBe('delegation-123');
    });

    it('should return error when delegation disabled', async () => {
      manager.updateConfig({ enableDelegation: false });
      
      const result = await manager.delegateTask(testDelegationRequest);

      expect(result.status).toBe('rejected');
      expect(result.error).toContain('disabled');
    });

    it('should return error when manager disabled', async () => {
      manager.updateConfig({ enabled: false });
      
      const result = await manager.delegateTask(testDelegationRequest);

      expect(result.status).toBe('rejected');
      expect(result.error).toContain('disabled');
    });

    it('should handle delegation errors', async () => {
      const mockDelegationManager = manager['delegationManager'];
      mockDelegationManager.delegateTask = vi.fn().mockRejectedValue(new Error('Delegation failed'));

      await expect(manager.delegateTask(testDelegationRequest)).rejects.toThrow(CommunicationError);
    });
  });

  describe('Message Processing', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should process incoming message with registered handler', async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        id: 'response-123',
        responseToId: 'msg-123',
        success: true,
        content: 'Handled successfully'
      });

      await manager.registerMessageHandler(MessageType.REQUEST, mockHandler);
      
      const response = await manager.processIncomingMessage(testMessage);

      expect(mockHandler).toHaveBeenCalledWith(testMessage);
      expect(response.success).toBe(true);
      expect(response.content).toBe('Handled successfully');
    });

    it('should process incoming message without handler', async () => {
      const response = await manager.processIncomingMessage(testMessage);

      expect(response.success).toBe(true);
      expect(response.content).toContain('received and processed');
      expect(response.responseToId).toBe(testMessage.id);
    });

    it('should return error when disabled', async () => {
      manager.updateConfig({ enabled: false });
      
      const response = await manager.processIncomingMessage(testMessage);

      expect(response.success).toBe(false);
      expect(response.error).toContain('disabled');
    });

    it('should handle processing errors gracefully', async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      await manager.registerMessageHandler(MessageType.REQUEST, mockHandler);
      
      const response = await manager.processIncomingMessage(testMessage);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Error processing message');
    });
  });

  describe('Message Handler Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should register message handler', async () => {
      const mockHandler = vi.fn();
      const result = await manager.registerMessageHandler(MessageType.REQUEST, mockHandler);

      expect(result).toBe(true);
      expect(manager['messageHandlers'].has(MessageType.REQUEST)).toBe(true);
    });

    it('should not register handler when disabled', async () => {
      manager.updateConfig({ enabled: false });
      
      const mockHandler = vi.fn();
      const result = await manager.registerMessageHandler(MessageType.REQUEST, mockHandler);

      expect(result).toBe(false);
    });

    it('should unregister message handler', async () => {
      const mockHandler = vi.fn();
      await manager.registerMessageHandler(MessageType.REQUEST, mockHandler);
      
      const result = await manager.unregisterMessageHandler(MessageType.REQUEST);

      expect(result).toBe(true);
      expect(manager['messageHandlers'].has(MessageType.REQUEST)).toBe(false);
    });

    it('should not unregister handler when disabled', async () => {
      manager.updateConfig({ enabled: false });
      
      const result = await manager.unregisterMessageHandler(MessageType.REQUEST);

      expect(result).toBe(false);
    });

    it('should handle registration errors', async () => {
      const mockHandler = vi.fn();
      // Force an error by making the handler registry unavailable
      manager['messageHandlers'] = null as any;

      await expect(manager.registerMessageHandler(MessageType.REQUEST, mockHandler))
        .rejects.toThrow(CommunicationError);
    });
  });

  describe('Message History Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should get message history with filters', async () => {
      // Add test messages
      const messages = [
        { ...testMessage, id: 'msg-1', type: MessageType.REQUEST, timestamp: new Date('2024-01-01') },
        { ...testMessage, id: 'msg-2', type: MessageType.RESPONSE, timestamp: new Date('2024-01-02') },
        { ...testMessage, id: 'msg-3', type: MessageType.REQUEST, timestamp: new Date('2024-01-03') }
      ];

      messages.forEach(msg => manager['addToMessageHistory'](msg));

      const history = await manager.getMessageHistory({
        messageType: MessageType.REQUEST,
        limit: 2
      });

      expect(history).toHaveLength(2);
      expect(history.every(msg => msg.type === MessageType.REQUEST)).toBe(true);
    });

    it('should return empty history when disabled', async () => {
      manager.updateConfig({ enabled: false });
      
      const history = await manager.getMessageHistory();

      expect(history).toHaveLength(0);
    });

    it('should filter by agent ID', async () => {
      const messages = [
        { ...testMessage, id: 'msg-1', fromAgentId: 'agent-1' },
        { ...testMessage, id: 'msg-2', fromAgentId: 'agent-2' },
        { ...testMessage, id: 'msg-3', toAgentId: 'agent-1' }
      ];

      messages.forEach(msg => manager['addToMessageHistory'](msg));

      const history = await manager.getMessageHistory({ agentId: 'agent-1' });

      expect(history).toHaveLength(2);
      expect(history.every(msg => 
        msg.fromAgentId === 'agent-1' || msg.toAgentId === 'agent-1'
      )).toBe(true);
    });

    it('should filter by date range', async () => {
      const messages = [
        { ...testMessage, id: 'msg-1', timestamp: new Date('2024-01-01') },
        { ...testMessage, id: 'msg-2', timestamp: new Date('2024-01-15') },
        { ...testMessage, id: 'msg-3', timestamp: new Date('2024-02-01') }
      ];

      messages.forEach(msg => manager['addToMessageHistory'](msg));

      const history = await manager.getMessageHistory({
        startDate: new Date('2024-01-10'),
        endDate: new Date('2024-01-20')
      });

      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('msg-2');
    });
  });

  describe('Pending Messages Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should get pending messages', async () => {
      const { MessageRouter } = await import('../../../../../agents/shared/messaging/MessageRouter');
      vi.mocked(MessageRouter.getMessagesForAgent).mockReturnValue([
        {
          fromAgentId: 'agent-1',
          toAgentId: 'test-agent-123',
          type: 'ask',
          payload: { content: 'Test message' },
          timestamp: Date.now(),
          metadata: { requiresResponse: true }
        }
      ]);

      const pending = await manager.getPendingMessages();

      expect(pending).toHaveLength(1);
      expect(pending[0].requiresResponse).toBe(true);
    });

    it('should return empty when disabled', async () => {
      manager.updateConfig({ enabled: false });
      
      const pending = await manager.getPendingMessages();

      expect(pending).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      const { MessageRouter } = await import('../../../../../agents/shared/messaging/MessageRouter');
      vi.mocked(MessageRouter.getMessagesForAgent).mockImplementation(() => {
        throw new Error('Failed to get messages');
      });

      await expect(manager.getPendingMessages()).rejects.toThrow(CommunicationError);
    });
  });

  describe('Delegation History Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should get delegation history with filters', async () => {
      const delegations = [
        {
          delegationId: 'del-1',
          taskId: 'task-1',
          assignedAgentId: 'agent-1',
          status: 'completed' as const,
          completedAt: new Date('2024-01-01')
        },
        {
          delegationId: 'del-2',
          taskId: 'task-2',
          assignedAgentId: 'agent-2',
          status: 'failed' as const,
          completedAt: new Date('2024-01-02')
        }
      ];

      delegations.forEach(del => manager['addToDelegationHistory'](del));

      const history = await manager.getDelegationHistory({
        status: 'completed',
        limit: 1
      });

      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('completed');
    });

    it('should return empty when disabled', async () => {
      manager.updateConfig({ enabled: false });
      
      const history = await manager.getDelegationHistory();

      expect(history).toHaveLength(0);
    });

    it('should filter by agent ID', async () => {
      const delegations = [
        {
          delegationId: 'del-1',
          taskId: 'task-1',
          assignedAgentId: 'agent-1',
          status: 'completed' as const
        },
        {
          delegationId: 'del-2',
          taskId: 'task-2',
          assignedAgentId: 'agent-2',
          status: 'completed' as const
        }
      ];

      delegations.forEach(del => manager['addToDelegationHistory'](del));

      const history = await manager.getDelegationHistory({ agentId: 'agent-1' });

      expect(history).toHaveLength(1);
      expect(history[0].assignedAgentId).toBe('agent-1');
    });
  });

  describe('Agent Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should get available agents', async () => {
      const agents = await manager.getAvailableAgents();

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
    });

    it('should get available agents with capabilities filter', async () => {
      const agents = await manager.getAvailableAgents(['analysis', 'data-processing']);

      expect(Array.isArray(agents)).toBe(true);
    });

    it('should return empty when disabled', async () => {
      manager.updateConfig({ enabled: false });
      
      const agents = await manager.getAvailableAgents();

      expect(agents).toHaveLength(0);
    });

    it('should check agent availability', async () => {
      const availability = await manager.checkAgentAvailability('agent-1');

      expect(availability).toHaveProperty('available');
      expect(availability).toHaveProperty('status');
      expect(availability).toHaveProperty('capabilities');
      expect(availability).toHaveProperty('currentLoad');
    });

    it('should return unavailable when disabled', async () => {
      manager.updateConfig({ enabled: false });
      
      const availability = await manager.checkAgentAvailability('agent-1');

      expect(availability.available).toBe(false);
      expect(availability.status).toBe('disabled');
    });
  });

  describe('Helper Methods and Format Conversion', () => {
    it('should convert message types correctly', () => {
      expect(manager['convertToLegacyMessageType'](MessageType.REQUEST)).toBe('ask');
      expect(manager['convertToLegacyMessageType'](MessageType.RESPONSE)).toBe('result');
      expect(manager['convertToLegacyMessageType'](MessageType.UPDATE)).toBe('update');
      expect(manager['convertToLegacyMessageType'](MessageType.DELEGATION)).toBe('handoff');
    });

    it('should convert from legacy message types', () => {
      expect(manager['convertFromLegacyMessageType']('ask')).toBe(MessageType.ASK);
      expect(manager['convertFromLegacyMessageType']('result')).toBe(MessageType.RESULT);
      expect(manager['convertFromLegacyMessageType']('update')).toBe(MessageType.UPDATE);
      expect(manager['convertFromLegacyMessageType']('handoff')).toBe(MessageType.HANDOFF);
    });

    it('should convert priority levels', () => {
      expect(manager['convertToTaskPriority'](MessagePriority.LOW)).toBe(TaskPriority.LOW);
      expect(manager['convertToTaskPriority'](MessagePriority.URGENT)).toBe(TaskPriority.URGENT);
      expect(manager['convertToTaskPriority'](MessagePriority.CRITICAL)).toBe(TaskPriority.URGENT);
    });

    it('should convert task status to delegation status', () => {
      expect(manager['convertFromTaskStatus'](TaskStatus.PENDING)).toBe('in_progress');
      expect(manager['convertFromTaskStatus'](TaskStatus.COMPLETED)).toBe('completed');
      expect(manager['convertFromTaskStatus'](TaskStatus.FAILED)).toBe('failed');
    });

    it('should add messages to history with capacity management', () => {
      manager.updateConfig({ maxMessageHistory: 3 });
      
      // Add more messages than capacity
      for (let i = 0; i < 5; i++) {
        manager['addToMessageHistory']({
          ...testMessage,
          id: `msg-${i}`,
          timestamp: new Date()
        });
      }
      
      // Should only keep the last 3
      expect(manager['messageHistoryCache']).toHaveLength(3);
      expect(manager['messageHistoryCache'][0].id).toBe('msg-2');
      expect(manager['messageHistoryCache'][2].id).toBe('msg-4');
    });

    it('should add delegations to history with capacity management', () => {
      manager.updateConfig({ maxDelegationHistory: 2 });
      
      // Add more delegations than capacity
      for (let i = 0; i < 4; i++) {
        manager['addToDelegationHistory']({
          delegationId: `del-${i}`,
          taskId: `task-${i}`,
          assignedAgentId: 'agent-1',
          status: 'completed'
        });
      }
      
      // Should only keep the last 2
      expect(manager['delegationHistoryCache']).toHaveLength(2);
      expect(manager['delegationHistoryCache'][0].delegationId).toBe('del-2');
      expect(manager['delegationHistoryCache'][1].delegationId).toBe('del-3');
    });

    it('should check if message has response', () => {
      // Add original message
      manager['addToMessageHistory'](testMessage);
      
      // Add response message
      manager['addToMessageHistory']({
        ...testMessage,
        id: 'response-123',
        metadata: { responseToId: 'msg-123' }
      });
      
      expect(manager['hasResponse']('msg-123')).toBe(true);
      expect(manager['hasResponse']('msg-456')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should create CommunicationError with correct properties', () => {
      const error = new CommunicationError('Test message', 'TEST_CODE', { test: 'context' });
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.context).toEqual({ test: 'context' });
      expect(error.name).toBe('CommunicationError');
    });

    it('should use default values in CommunicationError', () => {
      const error = new CommunicationError('Test message');
      
      expect(error.code).toBe('COMMUNICATION_ERROR');
      expect(error.context).toEqual({});
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete communication workflow', async () => {
      await manager.initialize();
      
      // Register a message handler
      const mockHandler = vi.fn().mockResolvedValue({
        id: 'response-123',
        responseToId: 'msg-123',
        success: true,
        content: 'Processed successfully'
      });
      
      await manager.registerMessageHandler(MessageType.REQUEST, mockHandler);
      
      // Send a message
      const { MessageRouter } = await import('../../../../../agents/shared/messaging/MessageRouter');
      vi.mocked(MessageRouter.sendMessage).mockResolvedValue({ success: true });
      
      const sendResponse = await manager.sendMessage(
        'target-agent',
        MessageType.REQUEST,
        'Test request'
      );
      
      expect(sendResponse.success).toBe(true);
      
      // Process incoming message
      const processResponse = await manager.processIncomingMessage(testMessage);
      expect(processResponse.success).toBe(true);
      expect(mockHandler).toHaveBeenCalled();
      
      // Check message history
      const history = await manager.getMessageHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should maintain state across multiple operations', async () => {
      await manager.initialize();
      
      // Send some messages
      const { MessageRouter } = await import('../../../../../agents/shared/messaging/MessageRouter');
      vi.mocked(MessageRouter.sendMessage).mockResolvedValue({ success: true });
      
      await manager.sendMessage('agent-1', MessageType.REQUEST, 'Message 1');
      await manager.sendMessage('agent-2', MessageType.NOTIFICATION, 'Message 2');
      
      // Process some messages
      await manager.processIncomingMessage(testMessage);
      
      // Check health
      const health = await manager.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.details.metrics?.messageHistory).toBeGreaterThan(0);
      
      // Reset and verify state is cleared
      await manager.reset();
      expect(manager['messageHistoryCache']).toHaveLength(0);
    });
  });
}); 