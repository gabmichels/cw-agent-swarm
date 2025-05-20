/**
 * Unit tests for DefaultAgent.think method
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create successful mock result first
const mockThinkingResult = {
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

// Create a mock process request function that we can control in tests
const mockProcessRequest = vi.fn().mockResolvedValue(mockThinkingResult);

// Mock dependencies
vi.mock('../../../services/thinking', () => {
  return {
    ThinkingService: vi.fn().mockImplementation(() => ({
      processRequest: mockProcessRequest
    }))
  };
});

vi.mock('../../../services/importance/ImportanceCalculatorService', () => ({
  ImportanceCalculatorService: vi.fn().mockImplementation(() => ({}))
}));

// Mock EnhancedMemoryManager to avoid circular dependencies
vi.mock('../memory/managers/EnhancedMemoryManager', () => ({
  EnhancedMemoryManager: vi.fn()
}));

// Now import the DefaultAgent and other dependencies
import { DefaultAgent } from '../DefaultAgent';
import { ThinkingResult } from '../../../services/thinking/types';
import { ThinkingError, AgentErrorCodes } from '../errors/AgentErrors';
import { ManagerType } from '../base/managers/ManagerType';
import { MemoryManager } from '../base/managers/MemoryManager.interface';
import { BaseManager } from '../base/managers/BaseManager';
import { ToolManager } from '../base/managers/ToolManager.interface';

// Create a mock memory manager with all required methods
const createMockMemoryManager = () => {
  const memoryManager = {
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
    updateConfig: vi.fn().mockReturnValue({}),
    getAgent: vi.fn().mockReturnValue({}),
    setAgent: vi.fn()
  };
  
  return memoryManager as unknown as MemoryManager & BaseManager;
};

// Create a mock tool manager with all required methods
const createMockToolManager = () => {
  const toolManager = {
    managerType: ManagerType.TOOL,
    managerId: 'tool-manager-1',
    initialize: vi.fn().mockResolvedValue(true),
    getTools: vi.fn().mockResolvedValue([
      {
        id: 'test-tool-1',
        name: 'TestTool',
        description: 'A test tool',
        categories: ['utility'],
        execute: vi.fn()
      }
    ]),
    reset: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn().mockReturnValue({}),
    updateConfig: vi.fn().mockReturnValue({}),
    getAgent: vi.fn().mockReturnValue({}),
    setAgent: vi.fn()
  };
  
  return toolManager as unknown as ToolManager & BaseManager;
};

describe('DefaultAgent.think', () => {
  let agent: DefaultAgent;
  let mockMemoryManager: MemoryManager & BaseManager;
  let mockToolManager: ToolManager & BaseManager;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset the mockProcessRequest implementation
    mockProcessRequest.mockResolvedValue(mockThinkingResult);
    
    // Create the agent
    agent = new DefaultAgent({
      modelName: 'test-model',
      enableMemoryManager: true,
      enableToolManager: true
    });
    
    // Create mock managers
    mockMemoryManager = createMockMemoryManager();
    mockToolManager = createMockToolManager();
    
    // Add mock managers to agent
    agent.setManager(mockMemoryManager);
    agent.setManager(mockToolManager);
    
    // Mock agent methods
    agent.getName = vi.fn().mockReturnValue('TestAgent');
    agent.getDescription = vi.fn().mockReturnValue('Test agent description');
    agent.getCapabilities = vi.fn().mockResolvedValue(['test', 'memory']);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should process a message and return thinking results', async () => {
    // Act
    const result = await agent.think('Hello, world!');
    
    // Assert
    expect(result).toBeDefined();
    expect(result.intent.primary).toBe('test_intent');
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].value).toBe('test_value');
    expect(result.context).toBeDefined();
    expect(result.reasoning).toEqual(['Test reasoning']);
  });
  
  it('should include memory context in the thinking results', async () => {
    // Act
    const result = await agent.think('Tell me about our conversation');
    
    // Assert
    expect(result.context).toBeDefined();
    expect(result.context?.chatHistoryLength).toBe(2);
    expect(result.context?.recentMemories).toBe(2);
  });
  
  it('should handle image/vision attachments', async () => {
    // Arrange
    const attachments = [
      {
        filename: 'test-image.jpg',
        type: 'image',
        is_image_for_vision: true,
        vision_data: {
          url: 'http://example.com/test.jpg'
        }
      }
    ];
    
    // Act
    const result = await agent.think('What is in this image?', { 
      attachments 
    });
    
    // Assert
    expect(result.context).toBeDefined();
    expect(result.context?.hasVisionAttachments).toBe(true);
    expect(result.context?.attachments).toBe(attachments);
  });
  
  it('should include available tools in the context', async () => {
    // Act
    const result = await agent.think('What tools do you have?');
    
    // Assert
    expect(result.context).toBeDefined();
    expect(result.context?.availableTools).toBeDefined();
    expect(result.context?.availableTools).toHaveLength(1);
    expect(result.context?.availableTools[0].name).toBe('TestTool');
    expect(result.context?.availableTools[0].category).toBe('utility');
  });
  
  it('should throw ThinkingError when memory retrieval fails', async () => {
    // Arrange
    (mockMemoryManager.searchMemories as any) = vi.fn().mockRejectedValue(new Error('Memory retrieval error'));
    
    // Act and Assert
    await expect(agent.think('Hello')).rejects.toThrow(ThinkingError);
    await expect(agent.think('Hello')).rejects.toMatchObject({
      code: AgentErrorCodes.MEMORY_CONTEXT_FAILED
    });
  });
  
  it('should throw ThinkingError when thinking process fails', async () => {
    // Arrange - mock the ThinkingService to throw an error just for this test
    mockProcessRequest.mockRejectedValue(new Error('Thinking process error'));
    
    // Act and Assert
    const promise = agent.think('Complex query');
    await expect(promise).rejects.toThrow(ThinkingError);
    await expect(promise).rejects.toMatchObject({
      code: AgentErrorCodes.INTENT_ANALYSIS_FAILED
    });
  });
}); 