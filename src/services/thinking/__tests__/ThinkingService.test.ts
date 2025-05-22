import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThinkingService } from '../ThinkingService';
import { ThinkingResult, ThinkingOptions } from '../types';
import { ImportanceLevel } from '../../../constants/memory';
import { CognitiveArtifactService } from '../cognitive/CognitiveArtifactService';
import * as graphModule from '../graph';
import * as ulidModule from '../../../utils/ulid';

// Mock the server memory services first to prevent initialization issues
vi.mock('../../../server/memory/services', () => ({
  getMemoryServices: vi.fn().mockResolvedValue({
    memoryService: {
      addMemory: vi.fn().mockResolvedValue({ success: true, id: 'memory-123' }),
      getMemoryById: vi.fn(),
      deleteMemory: vi.fn(),
      updateMemory: vi.fn(),
      searchMemories: vi.fn()
    }
  })
}));

// Mock the private methods of ThinkingService
class TestableThinkingService extends ThinkingService {
  // Expose private methods for testing
  public exposedStoreThinkingArtifacts(userId: string, message: string, thinkingResult: ThinkingResult) {
    return this['storeThinkingArtifacts'](userId, message, thinkingResult);
  }
  
  public exposedCalculateImportance(thinkingResult: ThinkingResult) {
    return this['calculateImportance'](thinkingResult);
  }
  
  // Override the original constructor to prevent initialization
  constructor() {
    // Create a mock ImportanceCalculatorService that matches the interface
    const mockImportanceCalculator = {
      calculateImportance: vi.fn().mockResolvedValue({
        importance: ImportanceLevel.MEDIUM,
        importance_score: 0.5,
        confidence: 0.8,
        keywords: ['test'],
        reasoning: 'Mock reasoning'
      }),
      ruleBasedCalculator: {},
      llmCalculator: {},
      defaultMode: 'hybrid',
      hybridConfidenceThreshold: 0.7,
      convertScoreToLevel: vi.fn().mockReturnValue(ImportanceLevel.MEDIUM),
      convertLevelToScore: vi.fn().mockReturnValue(0.5),
      ensureBothImportanceFields: vi.fn().mockImplementation(obj => obj),
      llmService: {} as any
    };
    
    super(mockImportanceCalculator as any);
    
    // Replace the initializeCognitiveService method to prevent original from running
    this['initializeCognitiveService'] = async (): Promise<void> => { 
      // Do nothing - this prevents the original method from running
      return Promise.resolve();
    };
  }
}

// Mock executeThinkingWorkflow
vi.mock('../graph', () => ({
  executeThinkingWorkflow: vi.fn().mockResolvedValue({
    userId: 'test-user',
    input: 'test input',
    intent: {
      name: 'test-intent',
      confidence: 0.8,
      alternatives: [{ name: 'alt-intent', confidence: 0.3 }]
    },
    entities: [
      { type: 'person', value: 'John', confidence: 0.9 },
      { type: 'date', value: 'tomorrow', confidence: 0.7 }
    ],
    shouldDelegate: false,
    reasoning: ['Step 1', 'Step 2'],
    plan: ['Plan step 1', 'Plan step 2'],
    tools: ['calculator', 'search'],
    contextMemories: [{ id: 'memory-1' }],
    contextFiles: [{ id: 'file-1' }]
  })
}));

// Mock IdGenerator
vi.mock('../../../utils/ulid', () => ({
  IdGenerator: {
    generate: vi.fn().mockReturnValue('mock-id-123456')
  }
}));

// Mock DelegationService constructor
vi.mock('../delegation/DelegationService', () => {
  // Create a mock constructor
  const MockDelegationService = vi.fn();
  // Setup the prototype methods
  MockDelegationService.prototype.hasCapabilities = vi.fn().mockImplementation((capabilities) => {
    // Return true only for 'math-capability'
    return Promise.resolve(capabilities.includes('math-capability'));
  });
  MockDelegationService.prototype.delegateTask = vi.fn().mockResolvedValue({ 
    success: true, 
    taskId: 'delegated-task-123', 
    agentId: 'agent-456' 
  });
  MockDelegationService.prototype.recordDelegationFeedback = vi.fn().mockResolvedValue(true);
  
  return {
    DelegationService: MockDelegationService
  };
});

// Mock CognitiveArtifactService
vi.mock('../cognitive/CognitiveArtifactService', () => {
  const MockCognitiveService = vi.fn();
  
  // Add all required methods to the prototype
  MockCognitiveService.prototype.storeThought = vi.fn().mockResolvedValue('thought-123');
  MockCognitiveService.prototype.storeReasoning = vi.fn().mockResolvedValue('reasoning-123');
  MockCognitiveService.prototype.storeReflection = vi.fn().mockResolvedValue('reflection-123');
  MockCognitiveService.prototype.storeInsight = vi.fn().mockResolvedValue('insight-123');
  MockCognitiveService.prototype.storePlan = vi.fn().mockResolvedValue('plan-123');
  MockCognitiveService.prototype.storeTask = vi.fn().mockResolvedValue('task-123');
  MockCognitiveService.prototype.storeThinkingResult = vi.fn().mockResolvedValue('thinking-123');

  return {
    CognitiveArtifactService: MockCognitiveService
  };
});

describe('ThinkingService', () => {
  let service: TestableThinkingService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create and set up the service instance
    service = new TestableThinkingService();
    
    // Manually set the cognitive artifact service
    service['cognitiveArtifactService'] = new CognitiveArtifactService(null as any);
    
    // Reset the mocked executeThinkingWorkflow to default behavior
    const graphMock = graphModule.executeThinkingWorkflow as unknown as ReturnType<typeof vi.fn>;
    graphMock.mockReset();
    graphMock.mockResolvedValue({
      userId: 'test-user',
      input: 'test input',
      intent: {
        name: 'test-intent',
        confidence: 0.8,
        alternatives: [{ name: 'alt-intent', confidence: 0.3 }]
      },
      entities: [
        { type: 'person', value: 'John', confidence: 0.9 },
        { type: 'date', value: 'tomorrow', confidence: 0.7 }
      ],
      shouldDelegate: false,
      reasoning: ['Step 1', 'Step 2'],
      plan: ['Plan step 1', 'Plan step 2'],
      tools: ['calculator', 'search'],
      contextMemories: [{ id: 'memory-1' }],
      contextFiles: [{ id: 'file-1' }]
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('analyzeIntent', () => {
    it('should analyze user intent from message', async () => {
      const message = 'Help me with my project';
      const options: ThinkingOptions = { userId: 'test-user' };
      
      const result = await service.analyzeIntent(message, options);
      
      expect(result).toBeDefined();
      expect(result.intent.primary).toBe('test-intent');
      expect(result.intent.confidence).toBe(0.8);
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].type).toBe('person');
      expect(result.entities[0].value).toBe('John');
    });
    
    it('should handle errors during intent analysis', async () => {
      const mockExecuteThinkingWorkflow = graphModule.executeThinkingWorkflow as unknown as ReturnType<typeof vi.fn>;
      mockExecuteThinkingWorkflow.mockRejectedValueOnce(new Error('Analysis failed'));
      
      await expect(service.analyzeIntent('Error message')).rejects.toThrow('Failed to analyze intent');
    });
  });
  
  describe('shouldDelegate', () => {
    it('should determine if a task should be delegated based on thinking result', async () => {
      // Override the hasCapabilities method for this specific test
      service['delegationService'].hasCapabilities = vi.fn().mockResolvedValueOnce(true);
      
      const thinkingResult: ThinkingResult = {
        intent: { primary: 'test-intent', confidence: 0.8 },
        entities: [],
        shouldDelegate: true,
        requiredCapabilities: ['math-capability'],
        reasoning: [],
        contextUsed: { memories: [], files: [], tools: [] },
        priority: 5,
        isUrgent: false,
        complexity: 3
      };
      
      const result = await service.shouldDelegate(thinkingResult);
      
      expect(result.delegate).toBe(true);
      expect(result.requiredCapabilities).toEqual(['math-capability']);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
    
    it('should return false when required capabilities are not available', async () => {
      const thinkingResult: ThinkingResult = {
        intent: { primary: 'test-intent', confidence: 0.8 },
        entities: [],
        shouldDelegate: true,
        requiredCapabilities: ['unavailable-capability'],
        reasoning: [],
        contextUsed: { memories: [], files: [], tools: [] },
        priority: 5,
        isUrgent: false,
        complexity: 3
      };
      
      const result = await service.shouldDelegate(thinkingResult);
      
      expect(result.delegate).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reason).toContain('not available');
    });
  });
  
  describe('createExecutionPlan', () => {
    it('should create an execution plan with steps and tools', async () => {
      const intent = 'calculate';
      const entities = [{ type: 'expression', value: '2+2', confidence: 0.9 }];
      const context = { history: [] };
      
      const plan = await service.createExecutionPlan(intent, entities, context);
      
      expect(plan.steps).toBeDefined();
      expect(Array.isArray(plan.steps)).toBe(true);
      expect(plan.tools).toBeDefined();
      expect(plan.reasoning).toBeDefined();
    });
  });
  
  describe('processRequest', () => {
    it('should process a user request and return thinking results', async () => {
      // Mock the IdGenerator for working memory
      const idGeneratorMock = ulidModule.IdGenerator.generate as unknown as ReturnType<typeof vi.fn>;
      idGeneratorMock.mockReturnValue('mock-id-123456');
      
      // Mock the thinking workflow
      const graphMock = graphModule.executeThinkingWorkflow as unknown as ReturnType<typeof vi.fn>;
      graphMock.mockResolvedValueOnce({
        userId: 'test-user',
        input: 'Calculate 2+2',
        intent: {
          name: 'test-intent',
          confidence: 0.8
        },
        entities: [
          { type: 'expression', value: '2+2', confidence: 0.9 }
        ],
        reasoning: ['Step 1'],
        plan: ['Execute calculation']
      });
      
      // Override updateWorkingMemory to prevent errors with ID generation
      vi.spyOn(service, 'updateWorkingMemory').mockResolvedValueOnce();
      
      // Mock storeThinkingArtifacts to prevent issues
      vi.spyOn(service as any, 'storeThinkingArtifacts').mockResolvedValueOnce(undefined);
      
      const result = await service.processRequest('test-user', 'Calculate 2+2');
      
      expect(result).toBeDefined();
      expect(result.intent.primary).toBe('test-intent');
    });
    
    it('should handle errors during processing', async () => {
      const graphMock = graphModule.executeThinkingWorkflow as unknown as ReturnType<typeof vi.fn>;
      graphMock.mockRejectedValueOnce(new Error('Processing failed'));
      
      // The service should handle this error and return a fallback result
      const result = await service.processRequest('test-user', 'Error message');
      
      expect(result).toBeDefined();
      expect(result.intent.primary).toBe('error_processing');
      expect(result.reasoning).toContain('Error processing request: Processing failed');
    });
  });
  
  describe('getWorkingMemory', () => {
    it('should return working memory for a user', async () => {
      const userId = 'test-user';
      
      // Manually set some memory items
      service['workingMemoryStore'][userId] = [
        {
          id: 'memory-1',
          content: 'Test memory',
          type: 'fact',
          tags: ['test'],
          addedAt: new Date(),
          priority: 5,
          expiresAt: null,
          confidence: 0.9,
          userId
        }
      ];
      
      const memory = await service.getWorkingMemory(userId);
      
      expect(memory).toHaveLength(1);
      expect(memory[0].content).toBe('Test memory');
    });
    
    it('should return empty array for unknown user', async () => {
      const memory = await service.getWorkingMemory('unknown-user');
      
      expect(memory).toEqual([]);
    });
  });
  
  describe('calculateImportance', () => {
    it('should calculate importance based on intent confidence and priority', async () => {
      const thinkingResult: ThinkingResult = {
        intent: { primary: 'test-intent', confidence: 0.9 },
        entities: [],
        shouldDelegate: false,
        requiredCapabilities: [],
        reasoning: [],
        contextUsed: { memories: [], files: [], tools: [] },
        priority: 8,
        isUrgent: true,
        complexity: 3
      };
      
      // Call exposed method 
      const importance = service.exposedCalculateImportance(thinkingResult);
      
      expect(importance).toBe(ImportanceLevel.HIGH);
    });
    
    it('should return medium importance for average cases', async () => {
      const thinkingResult: ThinkingResult = {
        intent: { primary: 'test-intent', confidence: 0.6 },
        entities: [],
        shouldDelegate: false,
        requiredCapabilities: [],
        reasoning: [],
        contextUsed: { memories: [], files: [], tools: [] },
        priority: 5,
        isUrgent: false,
        complexity: 3
      };
      
      // Call exposed method
      const importance = service.exposedCalculateImportance(thinkingResult);
      
      expect(importance).toBe(ImportanceLevel.MEDIUM);
    });
  });
}); 