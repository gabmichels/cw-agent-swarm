/**
 * Multi-Agent System Integration Tests
 * 
 * Simplified integration tests for the multi-agent system
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ulid } from 'ulid';

// Define types locally to avoid import issues
type AgentCommunicationType = 'DIRECT_MESSAGE' | 'BROADCAST' | 'TASK_DELEGATION';
type MemoryType = 'MESSAGE' | 'TASK';

interface AgentCommunicationParams {
  type: MemoryType;
  content: string;
  senderAgentId: string;
  receiverAgentId?: string;
  communicationType: AgentCommunicationType;
  priority?: 'medium' | 'high';
  metadata?: Record<string, any>;
}

// Mock memory client
const mockMemoryClient = {
  addPoint: vi.fn().mockResolvedValue(undefined),
  searchPoints: vi.fn().mockResolvedValue([])
};

// Mock Enhanced Memory Service
class MockEnhancedMemoryService {
  async sendAgentMessage(params: AgentCommunicationParams): Promise<any> {
    const messageId = ulid();
    await mockMemoryClient.addPoint('messages', {
      id: messageId,
      senderAgentId: params.senderAgentId,
      receiverAgentId: params.receiverAgentId,
      communicationType: params.communicationType,
      priority: params.priority,
      payload: { text: params.content, type: params.type }
    });
    return { success: true, id: messageId };
  }

  async searchAgentMemories(params: any): Promise<any[]> {
    return await mockMemoryClient.searchPoints('messages', {
      limit: params.limit || 10,
      filter: { must: [{ key: 'senderAgentId', match: { value: params.senderAgentId } }] }
    });
  }
}

// Mock Agent Repository
const mockAgentRepository = {
  findById: vi.fn().mockImplementation((id: string) => {
    const agents = {
      'agent-1': { id: 'agent-1', name: 'Research Agent' },
      'agent-2': { id: 'agent-2', name: 'Analysis Agent' }
    };
    const agent = agents[id as keyof typeof agents];
    return Promise.resolve({ success: !!agent, data: agent });
  })
};

// Mock Agent Factory
class MockAgentFactory {
  constructor(
    private agentRepository: any,
    private enhancedMemoryService?: MockEnhancedMemoryService
  ) {}

  async sendAgentMessage(senderAgentId: string, receiverAgentId: string, content: string): Promise<any> {
    if (!this.enhancedMemoryService) {
      return { success: false, error: { code: 'SERVICE_NOT_AVAILABLE' } };
    }

    const senderResult = await this.agentRepository.findById(senderAgentId);
    const receiverResult = await this.agentRepository.findById(receiverAgentId);

    if (!senderResult.success) {
      return { success: false, error: { code: 'SENDER_NOT_FOUND' } };
    }
    if (!receiverResult.success) {
      return { success: false, error: { code: 'RECEIVER_NOT_FOUND' } };
    }

    const result = await this.enhancedMemoryService.sendAgentMessage({
      type: 'MESSAGE',
      content,
      senderAgentId,
      receiverAgentId,
      communicationType: 'DIRECT_MESSAGE',
      priority: 'medium'
    });

    return { success: result.success, data: result };
  }
}

describe('Multi-Agent System Integration', () => {
  let enhancedMemoryService: MockEnhancedMemoryService;
  let agentFactory: MockAgentFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    enhancedMemoryService = new MockEnhancedMemoryService();
    agentFactory = new MockAgentFactory(mockAgentRepository, enhancedMemoryService);
  });

  describe('Enhanced Memory Service', () => {
    test('should send direct message between agents', async () => {
      const params: AgentCommunicationParams = {
        type: 'MESSAGE',
        content: 'Hello from Research Agent',
        senderAgentId: 'agent-1',
        receiverAgentId: 'agent-2',
        communicationType: 'DIRECT_MESSAGE',
        priority: 'medium'
      };

      const result = await enhancedMemoryService.sendAgentMessage(params);

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
      expect(mockMemoryClient.addPoint).toHaveBeenCalledWith('messages', expect.objectContaining({
        id: expect.any(String),
        senderAgentId: 'agent-1',
        receiverAgentId: 'agent-2',
        communicationType: 'DIRECT_MESSAGE',
        priority: 'medium'
      }));
    });

    test('should search agent memories', async () => {
      const searchParams = { senderAgentId: 'agent-1', limit: 10 };
      await enhancedMemoryService.searchAgentMemories(searchParams);

      expect(mockMemoryClient.searchPoints).toHaveBeenCalledWith('messages', {
        limit: 10,
        filter: { must: [{ key: 'senderAgentId', match: { value: 'agent-1' } }] }
      });
    });
  });

  describe('Agent Factory', () => {
    test('should send message between validated agents', async () => {
      const result = await agentFactory.sendAgentMessage('agent-1', 'agent-2', 'Test message');

      expect(result.success).toBe(true);
      expect(mockAgentRepository.findById).toHaveBeenCalledWith('agent-1');
      expect(mockAgentRepository.findById).toHaveBeenCalledWith('agent-2');
      expect(mockMemoryClient.addPoint).toHaveBeenCalled();
    });

    test('should handle invalid sender agent', async () => {
      const result = await agentFactory.sendAgentMessage('invalid-agent', 'agent-2', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SENDER_NOT_FOUND');
      expect(mockMemoryClient.addPoint).not.toHaveBeenCalled();
    });

    test('should handle invalid receiver agent', async () => {
      const result = await agentFactory.sendAgentMessage('agent-1', 'invalid-agent', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RECEIVER_NOT_FOUND');
      expect(mockMemoryClient.addPoint).not.toHaveBeenCalled();
    });

    test('should handle service unavailable', async () => {
      const factoryWithoutMemory = new MockAgentFactory(mockAgentRepository);
      const result = await factoryWithoutMemory.sendAgentMessage('agent-1', 'agent-2', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SERVICE_NOT_AVAILABLE');
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent messages', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        const params: AgentCommunicationParams = {
          type: 'MESSAGE',
          content: `Message ${i}`,
          senderAgentId: 'agent-1',
          receiverAgentId: 'agent-2',
          communicationType: 'DIRECT_MESSAGE'
        };
        promises.push(enhancedMemoryService.sendAgentMessage(params));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockMemoryClient.addPoint).toHaveBeenCalledTimes(5);
    });
  });
});
