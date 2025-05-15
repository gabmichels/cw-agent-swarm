/**
 * Tests for DefaultAgent LLM integration
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { DefaultAgent } from '../DefaultAgent';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ManagerType } from '../base/managers/ManagerType';
import { MemoryManager } from '../base/managers/MemoryManager.interface';

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

describe('DefaultAgent', () => {
  let agent: DefaultAgent;
  let mockMemoryManager: any;

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
      enableMemoryManager: true
    });
    
    await agent.initialize();
    
    // Get the mock memory manager for assertions
    const memoryManagerModule = await import('../../../lib/agents/implementations/managers/DefaultMemoryManager');
    mockMemoryManager = (memoryManagerModule.DefaultMemoryManager as unknown as MockInstance).mock.results[0].value;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('LLM Integration', () => {
    it('processInput should use LLM and return a response', async () => {
      const response = await agent.processInput('Hello, how are you?');
      
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
    
    it('processInput should store response with tags', async () => {
      // This test primarily checks that processInput runs without errors
      // and tests the integration with LLM and memory
      const response = await agent.processInput('Tell me about machine learning');
      
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
}); 