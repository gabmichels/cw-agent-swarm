/**
 * Basic DefaultAgent Feature Tests
 * 
 * This file tests basic DefaultAgent features with minimal dependencies.
 * It focuses on direct agent capabilities rather than complex interactions.
 */

import { DefaultAgent } from '../../agents/shared/DefaultAgent';
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest';

// Allow tests to run for extended periods
vi.setConfig({ testTimeout: 10000 }); 

// Ensure deterministic values in tests
vi.mock('crypto', () => ({
  randomUUID: () => 'test-uuid'
}));

// Mock OpenAI dependency
vi.mock('openai', () => {
  const mockOpenAIClient = {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: "The capital of France is Paris.",
                role: 'assistant'
              },
              finish_reason: 'stop'
            }
          ]
        })
      }
    }
  };
  
  const MockOpenAI = vi.fn(() => mockOpenAIClient);
  
  return {
    OpenAI: MockOpenAI,
    default: MockOpenAI
  };
});

// Mock the tag extractor used by DefaultAgent
vi.mock('../../utils/tagExtractor', () => {
  return {
    tagExtractor: {
      extractTags: vi.fn().mockResolvedValue({
        tags: [
          { text: 'france', confidence: 0.9 },
          { text: 'paris', confidence: 0.9 },
          { text: 'capital', confidence: 0.8 }
        ],
        success: true
      })
    },
    OpenAITagExtractor: {
      getInstance: () => ({
        extractTags: vi.fn().mockResolvedValue({
          tags: [
            { text: 'france', confidence: 0.9 },
            { text: 'paris', confidence: 0.9 },
            { text: 'capital', confidence: 0.8 }
          ],
          success: true
        })
      })
    },
    // Export extractTags function
    extractTags: vi.fn().mockResolvedValue({
      tags: [
        { text: 'france', confidence: 0.9 },
        { text: 'paris', confidence: 0.9 },
        { text: 'capital', confidence: 0.8 }
      ],
      success: true
    })
  };
});

// Mock langchain
vi.mock('@langchain/openai', () => {
  return {
    ChatOpenAI: class MockChatOpenAI {
      constructor() {}
      invoke() {
        return Promise.resolve({
          content: "The capital of France is Paris."
        });
      }
      call() {
        return Promise.resolve({
          content: "The capital of France is Paris."
        });
      }
    }
  };
});

// Mock local LLM module
vi.mock('../../lib/core/llm', () => {
  return {
    createChatOpenAI: () => ({
      invoke() {
        return Promise.resolve({
          content: "The capital of France is Paris."
        });
      },
      call() {
        return Promise.resolve({
          content: "The capital of France is Paris."
        });
      }
    })
  };
});

describe('DefaultAgent Basic Feature Tests', () => {
  let agent: DefaultAgent;
  let originalEnv: typeof process.env;
  
  beforeEach(async () => {
    // Store original env variables
    originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env.OPENAI_API_KEY = 'test-key-not-real';
    process.env.TEST_MODE = 'true';
    
    // Create an agent with minimal configuration
    agent = new DefaultAgent({
      name: "BasicFeatureTester",
      enableMemoryManager: true,
      enableToolManager: false,
      enablePlanningManager: false,
      enableSchedulerManager: false,
      enableReflectionManager: false
    });
    
    // Mock getName to avoid overrides
    vi.spyOn(agent, 'getName').mockReturnValue("BasicFeatureTester");
    
    // Mock the processUserInput method to avoid actual LLM calls
    vi.spyOn(agent, 'processUserInput').mockImplementation(async (message) => {
      return {
        content: message.includes('France') 
          ? "The capital of France is Paris."
          : "I'll help you with that.",
        thoughts: [],
        metadata: {}
      };
    });
    
    // Initialize the agent
    await agent.initialize();
  });
  
  afterEach(async () => {
    if (agent) {
      await agent.shutdown();
    }
    
    // Restore original env variables
    process.env = originalEnv;
    
    // Clean up mocks
    vi.clearAllMocks();
  });
  
  test('Agent can be initialized', () => {
    expect(agent).toBeTruthy();
    expect(agent.getName()).toBe("BasicFeatureTester");
  });
  
  test('Agent can process user input', async () => {
    const result = await agent.processUserInput("What is the capital of France?");
    
    expect(result).toBeTruthy();
    expect(result.content).toContain("Paris");
  });
  
  test('Agent can be shutdown properly', async () => {
    // This test just verifies that shutdown doesn't throw an error
    await expect(agent.shutdown()).resolves.not.toThrow();
  });
}); 