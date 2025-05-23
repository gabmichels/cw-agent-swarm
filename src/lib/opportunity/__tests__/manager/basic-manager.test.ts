import { describe, test, expect, beforeEach, vi } from 'vitest';
import { BasicOpportunityManager } from '../../manager/BasicOpportunityManager';
import { 
  OpportunitySource, 
  OpportunityStatus, 
  OpportunityType, 
  TimeSensitivity, 
  OpportunityPriority,
  Opportunity
} from '../../models/opportunity.model';
import { OpportunityManagerError } from '../../errors/OpportunityError';
import { ulid } from 'ulid';

// Mock dependencies
const mockRegistry = {
  initialize: vi.fn().mockResolvedValue(true),
  createOpportunity: vi.fn().mockImplementation((data) => {
    return Promise.resolve({
      ...data,
      id: ulid(),
      status: OpportunityStatus.DETECTED,
      detectedAt: new Date(),
      updatedAt: new Date()
    });
  }),
  getOpportunityById: vi.fn().mockImplementation((id) => {
    return Promise.resolve({
      id,
      title: 'Mock Opportunity',
      status: OpportunityStatus.DETECTED
    });
  }),
  updateOpportunity: vi.fn().mockResolvedValue({}),
  updateOpportunityStatus: vi.fn().mockResolvedValue({}),
  findOpportunities: vi.fn().mockResolvedValue([]),
  countOpportunities: vi.fn().mockResolvedValue(0),
  getHealth: vi.fn().mockResolvedValue({ isHealthy: true })
};

const mockDetector = {
  initialize: vi.fn().mockResolvedValue(true),
  detectTriggers: vi.fn().mockResolvedValue([
    {
      id: ulid(),
      type: 'help',
      source: OpportunitySource.USER_INTERACTION,
      timestamp: new Date(),
      content: 'User needs help',
      confidence: 0.8,
      context: {}
    }
  ]),
  detectOpportunitiesFromContent: vi.fn().mockResolvedValue({
    opportunities: [
      {
        id: ulid(),
        title: 'Mock Detected Opportunity',
        status: OpportunityStatus.DETECTED
      }
    ],
    timestamp: new Date(),
    source: 'test',
    triggerCount: 1,
    successfulDetections: 1
  }),
  detectOpportunities: vi.fn().mockResolvedValue({
    opportunities: [
      {
        id: ulid(),
        title: 'Mock Detected Opportunity',
        status: OpportunityStatus.DETECTED
      }
    ],
    timestamp: new Date(),
    source: 'test',
    triggerCount: 1,
    successfulDetections: 1
  }),
  getHealth: vi.fn().mockResolvedValue({ isHealthy: true }),
  getAvailableStrategies: vi.fn().mockResolvedValue(['user-interaction'])
};

const mockEvaluator = {
  initialize: vi.fn().mockResolvedValue(true),
  evaluateOpportunity: vi.fn().mockResolvedValue({
    success: true,
    evaluation: {
      opportunity: {},
      score: { overall: 0.8 },
      recommendedPriority: OpportunityPriority.HIGH,
      recommendedTimeSensitivity: TimeSensitivity.STANDARD,
      evaluatedAt: new Date(),
      insights: [],
      recommendations: []
    }
  }),
  getHealth: vi.fn().mockResolvedValue({ isHealthy: true })
};

const mockProcessor = {
  initialize: vi.fn().mockResolvedValue(true),
  processOpportunity: vi.fn().mockResolvedValue({
    success: true,
    opportunity: {},
    taskIds: ['mock-task-id'],
    stats: {
      executionTimeMs: 100,
      processingDate: new Date()
    }
  }),
  getHealth: vi.fn().mockResolvedValue({ isHealthy: true })
};

describe('BasicOpportunityManager', () => {
  let manager: BasicOpportunityManager;
  
  // Sample opportunity data for testing
  const sampleOpportunityData = {
    title: 'Test Opportunity',
    description: 'This is a test opportunity',
    type: OpportunityType.USER_ASSISTANCE,
    source: OpportunitySource.USER_INTERACTION,
    trigger: {
      type: 'keyword',
      source: OpportunitySource.USER_INTERACTION,
      timestamp: new Date(),
      content: 'User needs help',
      confidence: 0.8,
      context: {}
    },
    context: {
      agentId: 'test-agent',
      source: 'test',
      metadata: {},
      recentMemories: [],
      relevantKnowledge: []
    }
  };
  
  beforeEach(async () => {
    // Reset mock call history
    vi.clearAllMocks();
    
    manager = new BasicOpportunityManager({
      registry: mockRegistry as any,
      detector: mockDetector as any,
      evaluator: mockEvaluator as any,
      processor: mockProcessor as any
    });
    
    await manager.initialize();
  });
  
  test('should initialize successfully', async () => {
    // Reset mocks to ensure clean state for this test
    vi.clearAllMocks();
    
    const newManager = new BasicOpportunityManager({
      registry: mockRegistry as any,
      detector: mockDetector as any,
      evaluator: mockEvaluator as any,
      processor: mockProcessor as any
    });
    
    const result = await newManager.initialize();
    expect(result).toBe(true);
    
    // Verify all dependencies were initialized exactly once
    expect(mockRegistry.initialize).toHaveBeenCalledTimes(1);
    expect(mockDetector.initialize).toHaveBeenCalledTimes(1);
    expect(mockEvaluator.initialize).toHaveBeenCalledTimes(1);
    expect(mockProcessor.initialize).toHaveBeenCalledTimes(1);
  });
  
  test('should throw error if not initialized', async () => {
    const uninitializedManager = new BasicOpportunityManager({
      registry: mockRegistry as any,
      detector: mockDetector as any,
      evaluator: mockEvaluator as any,
      processor: mockProcessor as any
    });
    
    await expect(uninitializedManager.createOpportunity(
      sampleOpportunityData
    )).rejects.toBeInstanceOf(OpportunityManagerError);
  });
  
  test('should create an opportunity', async () => {
    const opportunity = await manager.createOpportunity(sampleOpportunityData);
    
    expect(opportunity).toBeDefined();
    expect(opportunity.id).toBeDefined();
    expect(opportunity.title).toBe(sampleOpportunityData.title);
    expect(mockRegistry.createOpportunity).toHaveBeenCalledTimes(1);
  });
  
  test('should get opportunity by ID', async () => {
    const mockId = ulid();
    const opportunity = await manager.getOpportunityById(mockId);
    
    expect(opportunity).toBeDefined();
    expect(mockRegistry.getOpportunityById).toHaveBeenCalledWith(mockId);
  });
  
  test('should detect opportunities from content', async () => {
    // This test was failing because the implementation uses detectTriggers + detectOpportunities
    // instead of detectOpportunitiesFromContent
    const result = await manager.detectOpportunities('User needs help with configuration', {
      agentId: 'test-agent'
    });
    
    expect(result).toBeDefined();
    expect(result.opportunities.length).toBeGreaterThan(0);
    // Check that the correct methods were called according to implementation
    expect(mockDetector.detectTriggers).toHaveBeenCalledTimes(1);
    expect(mockDetector.detectOpportunities).toHaveBeenCalledTimes(1);
  });
  
  test('should evaluate an opportunity', async () => {
    const mockId = ulid();
    const result = await manager.evaluateOpportunity(mockId);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(mockRegistry.getOpportunityById).toHaveBeenCalledWith(mockId);
    expect(mockEvaluator.evaluateOpportunity).toHaveBeenCalledTimes(1);
  });
  
  test('should process an opportunity', async () => {
    const mockId = ulid();
    const result = await manager.processOpportunity(mockId);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(mockRegistry.getOpportunityById).toHaveBeenCalledWith(mockId);
    expect(mockProcessor.processOpportunity).toHaveBeenCalledTimes(1);
  });
  
  test('should evaluate opportunity after creation when handler is implemented', async () => {
    // Mock the evaluateOpportunity method implementation
    manager.evaluateOpportunity = vi.fn().mockResolvedValue({
      success: true,
      evaluation: {
        score: { overall: 0.5 }
      }
    });
    
    await manager.createOpportunity(sampleOpportunityData);
    
    // Verify evaluation was called
    expect(manager.evaluateOpportunity).toHaveBeenCalledTimes(1);
  });
  
  test('should auto-process opportunities when score threshold is met', async () => {
    // Setup mocks with high score to trigger auto-processing
    mockEvaluator.evaluateOpportunity.mockResolvedValue({
      success: true,
      evaluation: {
        opportunity: {},
        score: { overall: 0.9 }, // High score that should trigger auto-processing
        recommendedPriority: OpportunityPriority.HIGH,
        recommendedTimeSensitivity: TimeSensitivity.STANDARD,
        evaluatedAt: new Date(),
        insights: [],
        recommendations: []
      }
    });
    
    const managerWithAutoProcess = new BasicOpportunityManager({
      registry: mockRegistry as any,
      detector: mockDetector as any,
      evaluator: mockEvaluator as any,
      processor: mockProcessor as any
    });
    
    // Configure for auto-processing
    await managerWithAutoProcess.initialize({
      autoProcessing: {
        enabled: true,
        minScoreThreshold: 0.8
      }
    });
    
    // Create mock ID for opportunity
    const mockId = ulid();
    
    // Setup getOpportunityById to return consistent ID
    mockRegistry.getOpportunityById.mockResolvedValue({
      ...sampleOpportunityData,
      id: mockId,
      status: OpportunityStatus.DETECTED
    });
    
    // Evaluate opportunity should trigger auto-processing
    await managerWithAutoProcess.evaluateOpportunity(mockId);
    
    // Should call processor after evaluating with high score
    expect(mockProcessor.processOpportunity).toHaveBeenCalledTimes(1);
    expect(mockProcessor.processOpportunity).toHaveBeenCalledWith(expect.objectContaining({
      id: mockId
    }));
  });
  
  test('should provide system health status', async () => {
    const health = await manager.getHealth();
    
    expect(health).toBeDefined();
    expect(health.isHealthy).toBe(true);
    expect(health.components).toBeDefined();
    expect(health.components.registry).toBeDefined();
    expect(health.components.detector).toBeDefined();
    expect(health.components.evaluator).toBeDefined();
    expect(health.components.processor).toBeDefined();
  });
  
  test('should find opportunities by filter', async () => {
    const filter = {
      types: [OpportunityType.USER_ASSISTANCE],
      statuses: [OpportunityStatus.PENDING]
    };
    
    await manager.findOpportunities(filter);
    expect(mockRegistry.findOpportunities).toHaveBeenCalledWith(filter, undefined, undefined, undefined);
  });
  
  test('should apply ordering when finding opportunities', async () => {
    const filter = { 
      types: [OpportunityType.USER_ASSISTANCE] 
    };
    const ordering = { 
      field: 'priority' as const, 
      direction: 'desc' as const 
    };
    
    await manager.findOpportunities(filter, ordering);
    expect(mockRegistry.findOpportunities).toHaveBeenCalledWith(filter, ordering, undefined, undefined);
  });
}); 