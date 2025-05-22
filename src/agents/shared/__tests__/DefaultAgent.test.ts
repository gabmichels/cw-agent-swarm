/**
 * Tests for DefaultAgent LLM integration
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { DefaultAgent } from '../DefaultAgent';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ManagerType } from '../base/managers/ManagerType';
import { MemoryManager } from '../base/managers/MemoryManager.interface';
import { PlanningManager } from '../base/managers/PlanningManager.interface';
import { ReflectionManager, ReflectionTrigger } from '../base/managers/ReflectionManager.interface';

// Mock StringOutputParser to fix the error
vi.mock('@langchain/core/output_parsers', () => {
  return {
    StringOutputParser: vi.fn().mockImplementation(() => ({
      pipe: vi.fn(),
      invoke: vi.fn().mockResolvedValue('This is a test response from the mocked LLM')
    }))
  };
});

// Mock the core LLM module to avoid actual API calls
vi.mock('../../../lib/core/llm', () => {
  return {
    createChatOpenAI: vi.fn().mockImplementation(() => ({
      invoke: vi.fn().mockResolvedValue({
        content: 'This is a test response from the mocked LLM'
      }),
      pipe: vi.fn().mockReturnValue({
        pipe: vi.fn().mockReturnValue({
          invoke: vi.fn().mockResolvedValue('This is a test response from the mocked LLM')
        })
      })
    }))
  };
});

// Mock the memory manager for testing
vi.mock('../../../lib/agents/implementations/managers/DefaultMemoryManager', () => {
  return {
    DefaultMemoryManager: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(true),
      managerType: 'memory',
      addMemory: vi.fn().mockResolvedValue(true),
      searchMemories: vi.fn().mockResolvedValue([]),
      reset: vi.fn().mockResolvedValue(true),
    }))
  };
});

// Mock the planning manager for testing
vi.mock('../../../lib/agents/implementations/managers/DefaultPlanningManager', () => {
  return {
    DefaultPlanningManager: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(true),
      managerType: 'planning',
      createPlan: vi.fn().mockResolvedValue({
        success: true,
        plan: {
          id: 'test-plan-id',
          name: 'Test Plan',
          goals: ['Test goal'],
          steps: []
        }
      }),
      executePlan: vi.fn().mockResolvedValue({
        success: true,
        plan: {
          id: 'test-plan-id',
          status: 'completed'
        }
      }),
      reset: vi.fn().mockResolvedValue(true),
    }))
  };
});

// Mock the reflection manager for testing
vi.mock('../reflection/managers/DefaultReflectionManager', () => {
  return {
    DefaultReflectionManager: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(true),
      managerType: 'reflection',
      reflect: vi.fn().mockResolvedValue({
        success: true,
        id: 'test-reflection-id',
        insights: [
          {
            id: 'test-insight-1',
            content: 'Test insight',
            type: 'learning'
          }
        ],
        message: 'Reflection completed successfully'
      }),
      reset: vi.fn().mockResolvedValue(true),
    }))
  };
});

// Mock ChatPromptTemplate
vi.mock('@langchain/core/prompts', () => {
  return {
    ChatPromptTemplate: {
      fromMessages: vi.fn().mockReturnValue({
        pipe: vi.fn().mockReturnValue({
          pipe: vi.fn().mockReturnValue({
            invoke: vi.fn().mockResolvedValue('This is a test response from the mocked LLM')
          })
        })
      })
    },
    MessagesPlaceholder: vi.fn()
  };
});

// Mock tagExtractor
vi.mock('../../../utils/tagExtractor', () => {
  return {
    tagExtractor: {
      extractTags: vi.fn().mockResolvedValue({
        tags: [
          { text: 'ai', confidence: 0.9 },
          { text: 'machine learning', confidence: 0.8 },
          { text: 'neural networks', confidence: 0.7 }
        ],
        success: true
      })
    }
  };
});

// Mock server memory services module
vi.mock('../../../server/memory/services', () => {
  return {
    getMemoryServices: vi.fn().mockResolvedValue({
      searchService: {
        search: vi.fn().mockResolvedValue([])
      }
    })
  };
});

// Mock memory types
vi.mock('../../../server/memory/config', () => {
  return {
    MemoryType: {
      THOUGHT: 'thought',
      TASK: 'task',
      DOCUMENT: 'document',
      MESSAGE: 'message'
    }
  };
});

// Mock ethics middleware
vi.mock('../ethics/EthicsMiddleware', () => {
  return {
    enforceEthics: vi.fn().mockResolvedValue({
      output: 'Ethics-checked plan',
      violations: []
    })
  };
});

// Mock the Planner to prevent actual server calls
vi.mock('../planning/Planner', () => {
  return {
    Planner: vi.fn().mockImplementation(() => ({
      setMemoryProvider: vi.fn(),
      createPlan: vi.fn().mockResolvedValue({
        title: 'Test Plan',
        steps: [
          { description: 'Step 1', difficulty: 2, estimatedTimeMinutes: 15 }
        ],
        reasoning: 'Test reasoning',
        estimatedTotalTimeMinutes: 15,
        context: { goal: 'Test goal' }
      })
    }))
  };
});

describe('DefaultAgent', () => {
  let agent: DefaultAgent;
  let mockMemoryManager: any;
  let mockPlanningManager: any;
  let mockReflectionManager: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a new agent with memory management enabled
    agent = new DefaultAgent({
      name: 'Test Agent',
      description: 'Test Agent Description',
      modelName: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      enableMemoryManager: true,
      enablePlanningManager: true,
      enableReflectionManager: true
    });
    
    await agent.initialize();
    
    // Get the mock memory manager for assertions
    const memoryManagerModule = await import('../../../lib/agents/implementations/managers/DefaultMemoryManager');
    mockMemoryManager = (memoryManagerModule.DefaultMemoryManager as unknown as MockInstance).mock.results[0].value;
    
    // Get the mock planning manager for assertions
    const planningManagerModule = await import('../../../lib/agents/implementations/managers/DefaultPlanningManager');
    mockPlanningManager = (planningManagerModule.DefaultPlanningManager as unknown as MockInstance).mock.results[0].value;
    
    // Get the mock reflection manager for assertions
    const reflectionManagerModule = await import('../reflection/managers/DefaultReflectionManager');
    mockReflectionManager = (reflectionManagerModule.DefaultReflectionManager as unknown as MockInstance).mock.results[0].value;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('LLM Integration', () => {
    it('processUserInput should use LLM and return a response', async () => {
      const response = await agent.processUserInput('Hello, how are you?');
      
      // Verify we got a response from the (mocked) LLM
      expect(response).toBeTruthy();
      expect(response).toEqual('This is a test response from the mocked LLM');
    });
  });
  
  describe('Memory and Tag Integration', () => {
    it('addTaggedMemory should extract tags and store memory', async () => {
      const mockTagExtractor = await import('../../../utils/tagExtractor');
      
      await agent.addTaggedMemory('This is about artificial intelligence and machine learning.', { source: 'test' });
      
      // Verify tagExtractor was called
      expect(mockTagExtractor.tagExtractor.extractTags).toHaveBeenCalledWith('This is about artificial intelligence and machine learning.');
      
      // Since we can't access the mock directly, just verify it was called
      // This test primarily checks that the method runs without error
    });
    
    it('getMemoriesByTags should search memories using tags', async () => {
      // Setup mocked return values for this specific test
      const mockSearchMemories = vi.fn().mockResolvedValue([
        { content: 'Test memory 1', metadata: { tags: ['ai', 'test'] } },
        { content: 'Test memory 2', metadata: { tags: ['ai', 'machine learning'] } }
      ]);
      
      // Override the searchMemories method on the agent's memory manager
      const memoryManager = agent.getManager<MemoryManager>(ManagerType.MEMORY);
      if (memoryManager) {
        memoryManager.searchMemories = mockSearchMemories;
      }
      
      const memories = await agent.getMemoriesByTags(['ai']);
      
      // Verify searchMemories was called with correct parameters
      expect(mockSearchMemories).toHaveBeenCalledWith('', {
        metadata: { tags: ['ai'] },
        limit: 10
      });
      
      // Check returned memories
      expect(memories).toHaveLength(2);
      expect(memories[0].content).toEqual('Test memory 1');
      expect(memories[1].content).toEqual('Test memory 2');
    });
    
    it('processUserInput should store response with tags', async () => {
      // This test primarily checks that processInput runs without errors
      // and tests the integration with LLM and memory
      const response = await agent.processUserInput('Tell me about machine learning');
      
      // Verify we got a response
      expect(response).toBeTruthy();
      expect(response).toEqual('This is a test response from the mocked LLM');
      
      // Verify tagExtractor was used by checking it was imported
      const mockTagExtractor = await import('../../../utils/tagExtractor');
      expect(mockTagExtractor.tagExtractor.extractTags).toHaveBeenCalled();
    });
    
    it('rateMessageImportance should return importance scores', async () => {
      // Create mock functions for the enhanced memory manager methods
      const mockRateImportance = vi.fn().mockResolvedValue(0.8);
      const mockRateNovelty = vi.fn().mockResolvedValue(0.7);
      const mockAnalyzeEmotion = vi.fn().mockResolvedValue(0.6);
      
      // Override the memory manager with mock functions for enhanced capabilities
      const memoryManager = agent.getManager<MemoryManager>(ManagerType.MEMORY);
      if (memoryManager) {
        (memoryManager as any).rateMemoryImportance = mockRateImportance;
        (memoryManager as any).rateMemoryNovelty = mockRateNovelty;
        (memoryManager as any).analyzeMemoryEmotion = mockAnalyzeEmotion;
      }
      
      // Test the method with a memory ID
      const result = await agent.rateMessageImportance('test-memory-id');
      
      // Check that our mock functions were called
      expect(mockRateImportance).toHaveBeenCalledWith('test-memory-id');
      expect(mockRateNovelty).toHaveBeenCalledWith('test-memory-id');
      expect(mockAnalyzeEmotion).toHaveBeenCalledWith('test-memory-id');
      
      // Verify the returned values match what our mocks provided
      expect(result).toEqual({
        importance: 0.8,
        novelty: 0.7,
        emotion: 0.6
      });
    });
    
    it('processMemoriesCognitively should handle enhanced memory processing', async () => {
      // Create mock function for the enhanced memory manager method
      const mockBatchProcess = vi.fn().mockResolvedValue([
        { id: 'memory-1', content: 'Test memory 1', importance: 0.8 },
        { id: 'memory-2', content: 'Test memory 2', importance: 0.6 }
      ]);
      
      // Override the memory manager with mock function for enhanced capability
      const memoryManager = agent.getManager<MemoryManager>(ManagerType.MEMORY);
      if (memoryManager) {
        (memoryManager as any).batchProcessMemoriesCognitively = mockBatchProcess;
      }
      
      // Test the method with an array of memory IDs
      const result = await agent.processMemoriesCognitively(['memory-1', 'memory-2']);
      
      // Check that our mock function was called with the expected parameters
      expect(mockBatchProcess).toHaveBeenCalledWith(['memory-1', 'memory-2'], {
        processingTypes: ['associations', 'importance', 'novelty', 'emotion', 'categorization'],
        forceReprocess: false,
        maxConcurrent: 5
      });
      
      // Verify the returned values match what our mock provided
      expect(result).toHaveLength(2);
      expect(result?.[0].id).toEqual('memory-1');
      expect(result?.[1].id).toEqual('memory-2');
    });
  });
  
  describe('Planning and Execution', () => {
    it('planAndExecute should create and execute a plan', async () => {
      const result = await agent.planAndExecute('Create a report about AI trends');
      
      // Verify createPlan was called with the correct parameters
      expect(mockPlanningManager.createPlan).toHaveBeenCalledWith({
        name: 'Plan for: Create a report about AI trends',
        description: 'Create a report about AI trends',
        goals: ['Create a report about AI trends'],
        priority: 1,
        metadata: {}
      });
      
      // Verify executePlan was called with the correct plan ID
      expect(mockPlanningManager.executePlan).toHaveBeenCalledWith('test-plan-id');
      
      // Verify the result structure
      expect(result).toEqual({
        success: true,
        plan: {
          id: 'test-plan-id',
          status: 'completed'
        }
      });
    });
    
    it('planAndExecute should handle errors properly', async () => {
      // Override the createPlan method to simulate an error
      mockPlanningManager.createPlan = vi.fn().mockResolvedValue({
        success: false,
        error: 'Failed to create plan due to insufficient context'
      });
      
      const result = await agent.planAndExecute('Invalid goal');
      
      // Verify createPlan was called
      expect(mockPlanningManager.createPlan).toHaveBeenCalled();
      
      // Verify executePlan was not called
      expect(mockPlanningManager.executePlan).not.toHaveBeenCalled();
      
      // Verify the error result
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
  
  describe('Reflection', () => {
    it('reflect should call reflection manager and return results', async () => {
      const result = await agent.reflect({ trigger: ReflectionTrigger.MANUAL });
      
      // Verify reflect was called with the correct parameters
      expect(mockReflectionManager.reflect).toHaveBeenCalledWith(ReflectionTrigger.MANUAL, { trigger: ReflectionTrigger.MANUAL });
      
      // Verify the result structure
      expect(result).toEqual({
        success: true,
        id: 'test-reflection-id',
        insights: [
          {
            id: 'test-insight-1',
            content: 'Test insight',
            type: 'learning'
          }
        ],
        message: 'Reflection completed successfully'
      });
    });
    
    it('reflect should handle errors properly', async () => {
      // Override the reflect method to simulate an error
      mockReflectionManager.reflect = vi.fn().mockRejectedValue(new Error('Reflection failed'));
      
      const result = await agent.reflect();
      
      // Verify reflect was called
      expect(mockReflectionManager.reflect).toHaveBeenCalled();
      
      // Verify the error result
      expect(result.success).toBe(false);
      expect(result.message).toEqual('Reflection failed');
      expect(result.insights).toEqual([]);
    });
    
    it('schedulePeriodicReflection should delegate to reflection manager if supported', async () => {
      // Add the schedulePeriodicReflection mock method to the reflection manager
      mockReflectionManager.schedulePeriodicReflection = vi.fn().mockResolvedValue(true);
      
      const result = await agent.schedulePeriodicReflection({
        schedule: '0 0 * * *', // Every day at midnight
        name: 'Daily Reflection',
        depth: 'standard',
        focusAreas: ['memory', 'planning']
      });
      
      // Verify schedulePeriodicReflection was called with the correct parameters
      expect(mockReflectionManager.schedulePeriodicReflection).toHaveBeenCalledWith(
        '0 0 * * *',
        {
          name: 'Daily Reflection',
          depth: 'standard',
          focusAreas: ['memory', 'planning']
        }
      );
      
      // Verify the result
      expect(result).toBe(true);
    });
  });
}); 