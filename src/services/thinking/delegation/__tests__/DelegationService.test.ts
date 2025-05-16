import { DelegationService } from '../DelegationService';
import { DelegationManager } from '../DelegationManager';

// Mock the DelegationManager
jest.mock('../DelegationManager', () => {
  return {
    DelegationManager: jest.fn().mockImplementation(() => {
      return {
        delegateTask: jest.fn().mockReturnValue({
          success: true,
          agentId: 'test-agent-id',
          taskId: 'test-task-id',
          estimatedWaitTime: 5000,
          reason: 'Task delegated successfully'
        }),
        recordFeedback: jest.fn().mockReturnValue(true),
        getAgents: jest.fn().mockReturnValue([
          {
            id: 'research-agent',
            name: 'Research Agent',
            capabilities: ['research', 'information_retrieval'],
            currentLoad: 0.2,
            maxCapacity: 10,
            successRate: 0.95,
            avgResponseTime: 5000,
            isAvailable: true
          },
          {
            id: 'creative-agent',
            name: 'Creative Agent',
            capabilities: ['content_creation', 'writing'],
            currentLoad: 0.3,
            maxCapacity: 8,
            successRate: 0.9,
            avgResponseTime: 8000,
            isAvailable: true
          }
        ])
      };
    })
  };
});

describe('DelegationService', () => {
  let delegationService: DelegationService;

  beforeEach(() => {
    jest.clearAllMocks();
    delegationService = new DelegationService();
  });

  test('should delegate task successfully', async () => {
    const result = await delegationService.delegateTask(
      'user-123',
      'Research quantum computing',
      ['research'],
      8,
      true
    );

    expect(result.success).toBe(true);
    expect(result.agentId).toBe('test-agent-id');
    expect(result.taskId).toBe('test-task-id');
  });

  test('should record feedback successfully', async () => {
    const feedback = {
      taskId: 'test-task-id',
      agentId: 'test-agent-id',
      wasSuccessful: true,
      executionTime: 3000,
      userSatisfaction: 0.9,
      details: 'Task completed well'
    };

    const result = await delegationService.recordFeedback(feedback);
    expect(result).toBe(true);
  });

  test('should get available agents', async () => {
    const agents = await delegationService.getAvailableAgents();
    
    expect(agents.length).toBe(2);
    expect(agents[0].id).toBe('research-agent');
    expect(agents[1].id).toBe('creative-agent');
  });

  test('should check capabilities correctly', async () => {
    const hasCapabilities = await delegationService.hasCapabilities(['research', 'information_retrieval']);
    expect(hasCapabilities).toBe(true);

    const hasInvalidCapabilities = await delegationService.hasCapabilities(['invalid_capability']);
    expect(hasInvalidCapabilities).toBe(false);
  });
}); 