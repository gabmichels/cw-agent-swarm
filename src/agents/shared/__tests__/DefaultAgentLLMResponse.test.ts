/**
 * Unit tests for DefaultAgent.getLLMResponse method
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

// Mock dependencies first, before importing the modules that use them
vi.mock('../../../lib/core/llm', () => ({
  createChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: 'This is a test response from the LLM'
    })
  }))
}));

// Mock memory manager, EnhancedMemoryManager, and any other modules that might cause circular dependencies
vi.mock('../memory/managers/EnhancedMemoryManager', () => ({
  EnhancedMemoryManager: vi.fn()
}));

// Now import the DefaultAgent after mocking its dependencies
import { DefaultAgent } from '../DefaultAgent';
import { LLMResponseError, AgentErrorCodes } from '../errors/AgentErrors';
import { ManagerType } from '../base/managers/ManagerType';
import { MemoryManager } from '../base/managers/MemoryManager.interface';
import { ChatOpenAI } from '@langchain/openai';

// Mock PromptFormatter
vi.mock('../messaging/PromptFormatter', () => ({
  PromptFormatter: {
    formatConversationHistory: vi.fn().mockReturnValue([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' }
    ]),
    formatSystemPrompt: vi.fn().mockReturnValue('You are a helpful assistant.'),
    createChatMessages: vi.fn().mockReturnValue([
      new SystemMessage('You are a helpful assistant.'),
      new HumanMessage('Hello world')
    ])
  }
}));

// Mock RelevanceScorer
vi.mock('../memory/RelevanceScorer', () => ({
  RelevanceScorer: vi.fn().mockImplementation(() => ({
    getRelevantMemories: vi.fn().mockResolvedValue([
      { id: 'memory-1', content: 'Relevant memory', score: 0.9 }
    ])
  }))
}));

// Mock the tagExtractor
vi.mock('../../../utils/tagExtractor', () => ({
  tagExtractor: {
    extractTags: vi.fn().mockResolvedValue({
      tags: [{ text: 'test', type: 'keyword' }],
      success: true
    })
  }
}));

// Create a mock for memory manager
const createMockMemoryManager = () => ({
  managerType: ManagerType.MEMORY,
  managerId: 'memory-manager-1',
  initialize: vi.fn().mockResolvedValue(true),
  searchMemories: vi.fn().mockResolvedValue([
    {
      id: 'test-memory-1',
      content: 'This is a test memory',
      metadata: {
        userId: 'test-user',
        role: 'user',
        timestamp: new Date().toISOString()
      }
    },
    {
      id: 'test-memory-2',
      content: 'This is a response',
      metadata: {
        userId: 'test-user',
        role: 'assistant',
        timestamp: new Date().toISOString()
      }
    }
  ]),
  addMemory: vi.fn().mockResolvedValue({ id: 'new-memory' }),
  reset: vi.fn().mockResolvedValue(undefined),
  getConfig: vi.fn().mockReturnValue({}),
  updateConfig: vi.fn(),
  getAgent: vi.fn().mockReturnValue({}),
  setAgent: vi.fn()
});

describe('DefaultAgent.getLLMResponse', () => {
  let agent: DefaultAgent;
  let mockMemoryManager: MemoryManager;
  let mockLLMInstance: any;
  
  beforeEach(() => {
    // Create a mock LLM instance
    mockLLMInstance = {
      invoke: vi.fn().mockResolvedValue({
        content: 'This is a test response from the LLM'
      })
    };
    
    // Create the agent with custom config
    agent = new DefaultAgent({
      modelName: 'test-model',
      enableMemoryManager: true
    });
    
    // Create mock managers
    mockMemoryManager = createMockMemoryManager() as unknown as MemoryManager;
    
    // Add mock managers to agent
    agent.setManager(mockMemoryManager);
    
    // Mock agent methods
    agent.getName = vi.fn().mockReturnValue('TestAgent');
    agent.getDescription = vi.fn().mockReturnValue('Test agent description');
    agent.getCapabilities = vi.fn().mockResolvedValue(['test', 'memory']);
    
    // Mock addTaggedMemory to avoid circular dependencies
    agent.addTaggedMemory = vi.fn().mockResolvedValue(undefined);
    
    // Directly set the model property
    Object.defineProperty(agent, 'model', {
      value: mockLLMInstance,
      writable: true
    });
    
    // Create a fake processWithVisionModel method
    Object.defineProperty(agent, 'processWithVisionModel', {
      value: vi.fn().mockResolvedValue('Description of the image'),
      writable: true
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should process a message and return an LLM response', async () => {
    // Act
    const result = await agent.getLLMResponse('Hello, world!');
    
    // Assert
    expect(result).toBeDefined();
    expect(result.content).toBe('This is a test response from the LLM');
    expect(result.thoughts).toEqual([]);
    expect(result.metadata).toBeDefined();
  });
  
  it('should include thinking results in the prompt when provided', async () => {
    // Arrange
    const thinkingResults = {
      intent: {
        primary: 'greeting',
        confidence: 0.9
      },
      entities: [
        { type: 'person', value: 'world', confidence: 0.8 }
      ],
      context: { additionalInfo: 'test' },
      planSteps: ['Say hello', 'Ask how they are']
    };
    
    // Act
    const result = await agent.getLLMResponse('Hello, world!', { 
      thinkingResults,
      formattedMemoryContext: 'User has greeted the system before.'
    });
    
    // Assert
    expect(result).toBeDefined();
    expect(result.content).toBe('This is a test response from the LLM');
    expect(agent.addTaggedMemory).toHaveBeenCalledTimes(2); // Once for input, once for output
  });
  
  it('should add tags to memory for both input and output', async () => {
    // Act
    await agent.getLLMResponse('Hello, world!');
    
    // Assert
    expect(agent.addTaggedMemory).toHaveBeenCalledTimes(2);
    const calls = (agent.addTaggedMemory as any).mock.calls;
    
    // First call should be for user input
    expect(calls[0][0]).toBe('Hello, world!');
    expect(calls[0][1].type).toBe('user_input');
    
    // Second call should be for agent response
    expect(calls[1][0]).toBe('This is a test response from the LLM');
    expect(calls[1][1].type).toBe('agent_response');
  });
  
  it('should throw LLMResponseError when memory manager is not initialized', async () => {
    // Arrange - remove memory manager
    agent.removeManager(ManagerType.MEMORY);
    
    // Act and Assert
    await expect(agent.getLLMResponse('Hello')).rejects.toThrow(LLMResponseError);
    await expect(agent.getLLMResponse('Hello')).rejects.toMatchObject({
      code: AgentErrorCodes.AGENT_NOT_INITIALIZED
    });
  });
  
  it('should throw LLMResponseError when LLM inference fails', async () => {
    // Arrange - mock the LLM to throw an error
    const mockError = new Error('LLM inference failed');
    mockLLMInstance.invoke = vi.fn().mockRejectedValue(mockError);
    
    // Act and Assert
    await expect(agent.getLLMResponse('Complex query')).rejects.toThrow(LLMResponseError);
    await expect(agent.getLLMResponse('Complex query')).rejects.toMatchObject({
      code: AgentErrorCodes.LLM_RESPONSE_FAILED
    });
  });
  
  it('should handle vision requests properly', async () => {
    // Arrange
    const attachments = [{
      filename: 'test.jpg',
      type: 'image',
      mimeType: 'image/jpeg',
      is_image_for_vision: true
    }];
    
    // Act
    const result = await agent.getLLMResponse('What is in this image?', { 
      attachments,
      useVisionModel: true
    });
    
    // Assert
    expect(result).toBeDefined();
    expect((agent as any).processWithVisionModel).toHaveBeenCalled();
    // Type assertion for metadata
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.visionUsed).toBe(true);
  });
  
  it('should continue to function when memory operations fail', async () => {
    // Arrange
    agent.addTaggedMemory = vi.fn().mockRejectedValue(new Error('Memory storage failed'));
    
    // Act - should not throw despite memory failure
    const result = await agent.getLLMResponse('Hello world');
    
    // Assert
    expect(result).toBeDefined();
    expect(result.content).toBe('This is a test response from the LLM');
  });
}); 