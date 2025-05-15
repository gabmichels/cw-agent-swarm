/**
 * Tests for DefaultAgent LLM integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DefaultAgent } from '../DefaultAgent';
import { StringOutputParser } from '@langchain/core/output_parsers';

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

describe('DefaultAgent', () => {
  let agent: DefaultAgent;

  beforeEach(async () => {
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
}); 