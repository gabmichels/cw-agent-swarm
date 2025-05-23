import { describe, test, expect, beforeEach, vi } from 'vitest';
import { BasicOpportunityProcessor } from '../../processor/BasicOpportunityProcessor';
import { 
  OpportunitySource, 
  OpportunityStatus, 
  OpportunityType, 
  TimeSensitivity, 
  OpportunityPriority,
  Opportunity
} from '../../models/opportunity.model';
import { OpportunityProcessingError } from '../../errors/OpportunityError';
import { ulid } from 'ulid';

// Mock OpportunityRegistry
const mockRegistry = {
  updateOpportunityStatus: vi.fn().mockResolvedValue({}),
  getOpportunityById: vi.fn().mockImplementation((id) => {
    return Promise.resolve({
      id,
      title: 'Mock Opportunity',
      status: OpportunityStatus.PENDING
    });
  })
};

// Mock TaskScheduler
const mockTaskScheduler = {
  createTask: vi.fn().mockResolvedValue("mock-task-id-1"),
  createTaskForAgent: vi.fn().mockResolvedValue("mock-task-id-1"),
  getTaskById: vi.fn().mockImplementation((id) => {
    return Promise.resolve({
      id,
      name: 'Mock Task',
      status: 'pending'
    });
  }),
  updateTask: vi.fn().mockResolvedValue(true)
};

describe('BasicOpportunityProcessor', () => {
  let processor: BasicOpportunityProcessor;
  
  // Create a sample opportunity for testing
  const createSampleOpportunity = (
    overrides: Partial<Opportunity> = {}
  ): Opportunity => {
    const now = new Date();
    
    return {
      id: ulid(),
      title: 'Test Opportunity',
      description: 'This is a test opportunity for processing',
      type: OpportunityType.USER_ASSISTANCE,
      priority: OpportunityPriority.MEDIUM,
      status: OpportunityStatus.PENDING,
      source: OpportunitySource.USER_INTERACTION,
      trigger: {
        id: ulid(),
        type: 'keyword',
        source: OpportunitySource.USER_INTERACTION,
        timestamp: new Date(),
        content: 'User needs help with configuration',
        confidence: 0.8,
        context: {}
      },
      context: {
        agentId: 'test-agent',
        timestamp: new Date(),
        source: 'test',
        metadata: {},
        recentMemories: [],
        relevantKnowledge: []
      },
      timeSensitivity: TimeSensitivity.STANDARD,
      resourceNeeded: {
        estimatedMinutes: 15,
        priorityLevel: OpportunityPriority.MEDIUM,
        complexityLevel: 'low'
      },
      detectedAt: now,
      updatedAt: now,
      tags: ['user-assistance', 'configuration'],
      ...overrides
    };
  };
  
  beforeEach(async () => {
    // Reset mock call history
    vi.clearAllMocks();
    
    processor = new BasicOpportunityProcessor(
      mockRegistry as any,
      mockTaskScheduler as any
    );
    await processor.initialize();
  });
  
  test('should initialize successfully', async () => {
    const processor = new BasicOpportunityProcessor(
      mockRegistry as any,
      mockTaskScheduler as any
    );
    const result = await processor.initialize();
    expect(result).toBe(true);
  });
  
  test('should throw error if not initialized', async () => {
    const uninitializedProcessor = new BasicOpportunityProcessor(
      mockRegistry as any,
      mockTaskScheduler as any
    );
    
    await expect(uninitializedProcessor.processOpportunity(
      createSampleOpportunity()
    )).rejects.toBeInstanceOf(OpportunityProcessingError);
  });
  
  test('should process an opportunity', async () => {
    const opportunity = createSampleOpportunity();
    const result = await processor.processOpportunity(opportunity);
    
    expect(result.success).toBe(true);
    expect(result.taskIds).toContain('mock-task-id-1');
    expect(result.details).toBeDefined();
    expect(mockTaskScheduler.createTaskForAgent).toHaveBeenCalledTimes(1);
    
    // Verify task creation arguments
    const createTaskArgs = mockTaskScheduler.createTaskForAgent.mock.calls[0][0];
    expect(createTaskArgs.name).toContain(opportunity.title);
    expect(createTaskArgs.description).toBe(opportunity.description);
  });
  
  test('should map opportunity priority to task priority', async () => {
    const criticalOpportunity = createSampleOpportunity({
      priority: OpportunityPriority.CRITICAL
    });
    
    await processor.processOpportunity(criticalOpportunity);
    expect(mockTaskScheduler.createTaskForAgent).toHaveBeenCalledTimes(1);
    
    const lowOpportunity = createSampleOpportunity({
      priority: OpportunityPriority.LOW
    });
    
    vi.clearAllMocks();
    await processor.processOpportunity(lowOpportunity);
    expect(mockTaskScheduler.createTaskForAgent).toHaveBeenCalledTimes(1);
  });
  
  test('should include opportunity context in task metadata', async () => {
    const opportunity = createSampleOpportunity({
      context: {
        agentId: 'test-agent',
        timestamp: new Date(),
        source: 'test',
        metadata: {
          conversationId: 'test-conversation',
          customData: 'test-data'
        },
        recentMemories: [],
        relevantKnowledge: []
      }
    });
    
    await processor.processOpportunity(opportunity);
    const createTaskArgs = mockTaskScheduler.createTaskForAgent.mock.calls[0][0];
    expect(createTaskArgs.metadata).toBeDefined();
  });
  
  test('should handle failure in task creation', async () => {
    // Mock a failure
    mockTaskScheduler.createTaskForAgent.mockRejectedValueOnce(new Error('Task creation failed'));
    
    const opportunity = createSampleOpportunity();
    const result = await processor.processOpportunity(opportunity);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Task creation failed');
    expect(result.taskIds).toEqual([]);
  });
  
  test('should generate task metadata from opportunity', async () => {
    const opportunity = createSampleOpportunity({
      tags: ['important', 'user-request', 'configuration']
    });
    
    const metadata = await processor.generateTaskMetadata(opportunity);
    
    expect(metadata).toBeDefined();
    expect(metadata.opportunityId).toBe(opportunity.id);
    expect(metadata.opportunityType).toBe(opportunity.type);
    expect(metadata.priorityInfo).toBeDefined();
    expect(metadata.timeSensitivity).toBeDefined();
  });
  
  test('should return health status', async () => {
    const health = await processor.getHealth();
    
    expect(health.isHealthy).toBe(true);
    expect(health.lastCheck).toBeInstanceOf(Date);
    expect(health.details).toBeDefined();
  });
}); 