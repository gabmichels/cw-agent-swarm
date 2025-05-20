/**
 * Unit tests for DefaultAgent.processUserInput method
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DefaultAgent } from '../DefaultAgent';
import { ProcessingError, ThinkingError, LLMResponseError, AgentErrorCodes } from '../errors/AgentErrors';
import { ThinkingResult } from '../../../services/thinking/types';
import { AgentResponse } from '../base/AgentBase.interface';

// Define expected typing for the thinkingAnalysis structure
interface ThinkingAnalysis {
  intent: { primary: string; confidence: number };
  entities: Array<{ type: string; value: string; confidence: number }>;
  shouldDelegate: boolean;
  requiredCapabilities: string[];
  complexity: number;
  priority: number;
}

// Create a mock instance for testing
const createTestAgent = () => {
  const agent = new DefaultAgent({
    modelName: 'test-model',
    enableMemoryManager: true
  });
  
  // Mock the think method
  const mockThinkResult: ThinkingResult = {
    intent: {
      primary: 'test_intent',
      confidence: 0.9
    },
    entities: [
      { type: 'test_entity', value: 'test_value', confidence: 0.8 }
    ],
    shouldDelegate: false,
    requiredCapabilities: [],
    reasoning: ['Test reasoning'],
    contextUsed: {
      memories: [],
      files: [],
      tools: []
    },
    priority: 5,
    isUrgent: false,
    complexity: 3
  };
  
  agent.think = vi.fn().mockResolvedValue(mockThinkResult);
  
  // Mock the getLLMResponse method with proper response type including proper typing for metadata
  const mockResponse: AgentResponse = {
    content: 'Test response from LLM',
    thoughts: ['Test thought'],
    metadata: {
      test: true,
      thinkingAnalysis: {
        intent: mockThinkResult.intent,
        entities: mockThinkResult.entities,
        shouldDelegate: mockThinkResult.shouldDelegate,
        requiredCapabilities: mockThinkResult.requiredCapabilities,
        complexity: mockThinkResult.complexity,
        priority: mockThinkResult.priority
      } as ThinkingAnalysis
    }
  };
  
  agent.getLLMResponse = vi.fn().mockResolvedValue(mockResponse);
  
  return {
    agent,
    mockThinkResult,
    mockResponse
  };
};

describe('DefaultAgent.processUserInput', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should orchestrate the thinking and LLM response processes', async () => {
    // Arrange
    const { agent, mockThinkResult, mockResponse } = createTestAgent();
    
    // Act
    const result = await agent.processUserInput('Hello, world!');
    
    // Assert
    expect(agent.think).toHaveBeenCalledWith('Hello, world!', undefined);
    expect(agent.getLLMResponse).toHaveBeenCalledTimes(1);
    
    // Verify the options passed to getLLMResponse include thinking results
    const getLLMResponseOptions = (agent.getLLMResponse as any).mock.calls[0][1];
    expect(getLLMResponseOptions.thinkingResult).toBe(mockThinkResult);
    expect(getLLMResponseOptions.thinkingResults.intent.primary).toBe('test_intent');
    
    // Verify the final response combines data from both steps
    expect(result.content).toBe(mockResponse.content);
    expect(result.thoughts).toEqual(mockResponse.thoughts);
    expect(result.metadata).toBeDefined();
    
    // Type assertion to fix linter warnings
    if (result.metadata && result.metadata.thinkingAnalysis) {
      const thinkingAnalysis = result.metadata.thinkingAnalysis as ThinkingAnalysis;
      expect(thinkingAnalysis.intent).toEqual(mockThinkResult.intent);
    } else {
      throw new Error('Expected thinkingAnalysis to be defined');
    }
  });
  
  it('should pass options to both think and getLLMResponse', async () => {
    // Arrange
    const { agent } = createTestAgent();
    const options = {
      userId: 'test-user',
      workingMemory: [{ id: 'mem1', content: 'test memory' }],
      contextFiles: [{ id: 'file1', content: 'test file' }]
    };
    
    // Act
    await agent.processUserInput('Hello, world!', options);
    
    // Assert
    expect(agent.think).toHaveBeenCalledWith('Hello, world!', options);
    
    // Verify enhanced options are passed to getLLMResponse
    const getLLMResponseOptions = (agent.getLLMResponse as any).mock.calls[0][1];
    expect(getLLMResponseOptions.userId).toBe('test-user');
    expect(getLLMResponseOptions.workingMemory).toBe(options.workingMemory);
    expect(getLLMResponseOptions.contextFiles).toBe(options.contextFiles);
  });
  
  it('should handle errors in the think method', async () => {
    // Arrange
    const { agent } = createTestAgent();
    agent.think = vi.fn().mockRejectedValue(
      new ThinkingError('Failed to think', AgentErrorCodes.THINKING_FAILED)
    );
    
    // Act
    const result = await agent.processUserInput('Hello');
    
    // Assert - should return error response instead of throwing
    expect(result.content).toContain("I'm sorry, but I encountered an error");
    expect(result.thoughts).toContain("Error in processUserInput: Failed to think");
    expect(result.metadata).toMatchObject({
      error: true,
      errorCode: AgentErrorCodes.PROCESSING_FAILED,
      errorType: 'thinking'
    });
  });
  
  it('should handle errors in the getLLMResponse method', async () => {
    // Arrange
    const { agent } = createTestAgent();
    agent.getLLMResponse = vi.fn().mockRejectedValue(
      new LLMResponseError('Failed to get LLM response', AgentErrorCodes.LLM_RESPONSE_FAILED)
    );
    
    // Act
    const result = await agent.processUserInput('Hello');
    
    // Assert - should return error response instead of throwing
    expect(result.content).toContain("I'm sorry, but I encountered an error");
    expect(result.thoughts).toContain("Error in processUserInput: Failed to get LLM response");
    expect(result.metadata).toMatchObject({
      error: true,
      errorCode: AgentErrorCodes.PROCESSING_FAILED,
      errorType: 'llm_response'
    });
  });
  
  it('should add reasoning from thinking as thoughts if no thoughts in LLM response', async () => {
    // Arrange
    const { agent, mockThinkResult } = createTestAgent();
    const responseWithoutThoughts: AgentResponse = {
      content: 'Test response',
      // No thoughts provided
      metadata: { test: true }
    };
    
    agent.getLLMResponse = vi.fn().mockResolvedValue(responseWithoutThoughts);
    
    // Act
    const result = await agent.processUserInput('Hello');
    
    // Assert
    expect(result.thoughts).toEqual(mockThinkResult.reasoning);
  });
  
  it('should include detailed metadata including thinking analysis', async () => {
    // Arrange
    const { agent, mockThinkResult } = createTestAgent();
    
    // Act
    const result = await agent.processUserInput('Hello');
    
    // Assert - with proper type assertions
    expect(result.metadata).toBeDefined();
    
    if (result.metadata) {
      const thinkingAnalysis = result.metadata.thinkingAnalysis as ThinkingAnalysis;
      expect(thinkingAnalysis).toBeDefined();
      expect(thinkingAnalysis.intent).toEqual(mockThinkResult.intent);
      expect(thinkingAnalysis.entities).toEqual(mockThinkResult.entities);
      expect(thinkingAnalysis.complexity).toEqual(mockThinkResult.complexity);
      expect(thinkingAnalysis.priority).toEqual(mockThinkResult.priority);
    } else {
      throw new Error('Expected metadata to be defined');
    }
  });
}); 