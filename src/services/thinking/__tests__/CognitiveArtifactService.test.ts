import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CognitiveArtifactService } from '../cognitive/CognitiveArtifactService';
import { 
  ImportanceLevel, 
  MemoryType,
  MemorySource
} from '../../../constants/memory';
import { CognitiveProcessType, TaskPriority, TaskStatus } from '../../../types/metadata';
import { createAgentId } from '../../../types/structured-id';

// Mock dependencies
const mockMemoryService = {
  addMemory: vi.fn(),
  getMemory: vi.fn(),
  getMemoryById: vi.fn(),
  deleteMemory: vi.fn(),
  updateMemory: vi.fn(),
  searchMemories: vi.fn()
};

// Mock metadata factory results
const mockThoughtMetadata = {
  processType: CognitiveProcessType.THOUGHT,
  importance: ImportanceLevel.MEDIUM,
  source: MemorySource.AGENT,
  agentId: 'test-agent',
  schemaVersion: '1.0',
  timestamp: new Date().toISOString()
};

const mockReflectionMetadata = {
  processType: CognitiveProcessType.REFLECTION,
  reflectionType: 'experience',
  timeScope: 'immediate',
  tags: ['reflection'],
  agentId: 'test-agent',
  schemaVersion: '1.0',
  timestamp: new Date().toISOString()
};

const mockInsightMetadata = {
  processType: CognitiveProcessType.INSIGHT,
  insightType: 'pattern',
  importance: ImportanceLevel.HIGH,
  tags: ['insight'],
  agentId: 'test-agent',
  schemaVersion: '1.0',
  timestamp: new Date().toISOString()
};

const mockPlanningMetadata = {
  processType: CognitiveProcessType.PLANNING,
  planType: 'task',
  estimatedSteps: 4,
  tags: ['plan', 'task'],
  agentId: 'test-agent',
  schemaVersion: '1.0',
  timestamp: new Date().toISOString()
};

const mockTaskMetadata = {
  title: 'Task title',
  status: TaskStatus.PENDING,
  priority: TaskPriority.MEDIUM,
  importance: ImportanceLevel.MEDIUM,
  tags: ['task'],
  agentId: 'test-agent',
  schemaVersion: '1.0',
  timestamp: new Date().toISOString()
};

// Mock factory functions
vi.mock('../../../server/memory/services/helpers/metadata-helpers', () => ({
  createThoughtMetadata: vi.fn().mockImplementation((_, options) => options),
  createReflectionMetadata: vi.fn().mockImplementation((_, options) => options),
  createInsightMetadata: vi.fn().mockImplementation((_, options) => options),
  createPlanningMetadata: vi.fn().mockImplementation((_, options) => options),
  createTaskMetadata: vi.fn().mockImplementation((title, status, priority, _, options) => ({
    title,
    status,
    priority,
    ...options
  }))
}));

vi.mock('../../../utils/ulid', () => ({
  IdGenerator: {
    generate: vi.fn(() => 'mock-id-123456')
  }
}));

describe('CognitiveArtifactService', () => {
  let service: CognitiveArtifactService;
  const testAgentId = 'test-agent';

  beforeEach(() => {
    vi.clearAllMocks();
    mockMemoryService.addMemory.mockReset();
    mockMemoryService.addMemory.mockResolvedValue({ success: true, id: 'memory-123' });
    
    service = new CognitiveArtifactService(mockMemoryService as any, testAgentId);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('storeThought', () => {
    it('should store a thought with default options', async () => {
      const content = 'This is a test thought';
      
      const result = await service.storeThought(content);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1);
      expect(result).toBe('memory-123');
    });

    it('should store a thought with custom options', async () => {
      const content = 'This is a test thought with custom options';
      const options = {
        intention: 'problem-solving',
        confidenceScore: 0.9,
        importance: ImportanceLevel.HIGH,
        relatedTo: ['memory-1', 'memory-2'],
        influencedBy: ['memory-3'],
        contextId: 'context-1',
        tags: ['important', 'creative'],
        category: 'analysis'
      };
      
      const result = await service.storeThought(content, options);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1);
      expect(result).toBe('memory-123');
    });

    it('should handle errors gracefully', async () => {
      mockMemoryService.addMemory.mockRejectedValueOnce(new Error('Test error'));
      
      const content = 'This will cause an error';
      const result = await service.storeThought(content);
      
      expect(result).toBeNull();
    });

    it('should return null when service fails', async () => {
      mockMemoryService.addMemory.mockResolvedValueOnce({ success: false });
      
      const content = 'This will return a failure';
      const result = await service.storeThought(content);
      
      expect(result).toBeNull();
    });
  });

  describe('storeReasoning', () => {
    it('should store reasoning steps with default options', async () => {
      const steps = ['Step 1', 'Step 2', 'Step 3'];
      const conclusion = 'Final conclusion';
      
      const result = await service.storeReasoning(steps, conclusion);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1);
      expect(result).toBe('memory-123');
    });

    it('should handle errors in storeReasoning', async () => {
      mockMemoryService.addMemory.mockRejectedValueOnce(new Error('Test error'));
      
      const steps = ['Step 1', 'Step 2'];
      const conclusion = 'Error conclusion';
      const result = await service.storeReasoning(steps, conclusion);
      
      expect(result).toBeNull();
    });
  });

  describe('storeReflection', () => {
    it('should store reflection with default options', async () => {
      const content = 'This is a reflection on my performance';
      
      const result = await service.storeReflection(content);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1);
      expect(result).toBe('memory-123');
    });

    it('should store reflection with custom options', async () => {
      const content = 'This is a strategic reflection';
      const options = {
        reflectionType: 'strategy' as const,
        timeScope: 'long-term' as const,
        importance: ImportanceLevel.HIGH,
        tags: ['strategic', 'planning']
      };
      
      const result = await service.storeReflection(content, options);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1);
      expect(result).toBe('memory-123');
    });

    it('should handle errors in storeReflection', async () => {
      mockMemoryService.addMemory.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await service.storeReflection('Error reflection');
      expect(result).toBeNull();
    });
  });

  describe('storeInsight', () => {
    it('should store insight with default options', async () => {
      const content = 'This is an insight about patterns';
      
      const result = await service.storeInsight(content);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1);
      expect(result).toBe('memory-123');
    });

    it('should store insight with custom options', async () => {
      const content = 'This is a predictive insight';
      const options = {
        insightType: 'prediction' as const,
        applicationContext: ['market-analysis', 'strategy'],
        validityPeriod: {
          from: '2023-01-01',
          to: '2023-12-31'
        },
        tags: ['prediction', 'future']
      };
      
      const result = await service.storeInsight(content, options);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1);
      expect(result).toBe('memory-123');
    });

    it('should handle errors in storeInsight', async () => {
      mockMemoryService.addMemory.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await service.storeInsight('Error insight');
      expect(result).toBeNull();
    });
  });

  describe('storePlan', () => {
    it('should store planning information with default options', async () => {
      const goal = 'Complete the project';
      const steps = ['Research', 'Design', 'Implement', 'Test'];
      
      const result = await service.storePlan(goal, steps);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1);
      expect(result).toBe('memory-123');
    });

    it('should store planning with custom options', async () => {
      const goal = 'Develop strategic roadmap';
      const steps = ['Analysis', 'Strategy formulation', 'Implementation plan'];
      const options = {
        planType: 'strategy' as const,
        dependsOn: ['memory-1'],
        importance: ImportanceLevel.HIGH,
        tags: ['strategic', 'long-term']
      };
      
      const result = await service.storePlan(goal, steps, options);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1);
      expect(result).toBe('memory-123');
    });

    it('should handle errors in storePlan', async () => {
      mockMemoryService.addMemory.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await service.storePlan('Error goal', ['Step 1']);
      expect(result).toBeNull();
    });
  });

  describe('storeTask', () => {
    it('should store task with default options', async () => {
      const title = 'Task title';
      const description = 'Task description';
      
      const result = await service.storeTask(title, description);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1);
      expect(result).toBe('memory-123');
    });

    it('should store task with custom options', async () => {
      const title = 'Critical task';
      const description = 'High priority task description';
      const options = {
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        dueDate: '2023-12-31',
        parentTaskId: 'task-parent',
        subtaskIds: ['subtask-1', 'subtask-2'],
        dependsOn: ['task-dependency'],
        blockedBy: ['task-blocker'],
        importance: ImportanceLevel.HIGH,
        tags: ['critical', 'urgent']
      };
      
      const result = await service.storeTask(title, description, options);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1);
      expect(result).toBe('memory-123');
    });

    it('should handle errors in storeTask', async () => {
      mockMemoryService.addMemory.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await service.storeTask('Error task', 'Error description');
      expect(result).toBeNull();
    });
  });

  describe('storeThinkingResult', () => {
    it('should store complete thinking results', async () => {
      // Setup multiple mock returns for successive calls
      mockMemoryService.addMemory
        .mockResolvedValueOnce({ success: true, id: 'thought-id' })
        .mockResolvedValueOnce({ success: true, id: 'entity-id-1' })
        .mockResolvedValueOnce({ success: true, id: 'reasoning-id' })
        .mockResolvedValueOnce({ success: true, id: 'plan-id' });

      const thinking = {
        intent: {
          primary: 'analyze-data',
          confidence: 0.9,
          alternatives: [{ intent: 'research', confidence: 0.4 }]
        },
        entities: [
          { type: 'dataset', value: 'sales-2023', confidence: 0.95 }
        ],
        reasoning: ['Step 1: Understand the request', 'Step 2: Analyze the data'],
        planSteps: ['Retrieve data', 'Perform analysis', 'Create visualization'],
        shouldDelegate: false
      };
      
      const userId = 'user-123';
      const message = 'Analyze the sales data for 2023';
      
      const result = await service.storeThinkingResult(thinking, userId, message);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(4); // Intent, entity, reasoning, and plan
      expect(result).toEqual({
        thoughtId: 'thought-id',
        planId: 'plan-id',
        entityIds: ['entity-id-1']
      });
    });

    it('should handle missing reasoning and plan', async () => {
      mockMemoryService.addMemory
        .mockResolvedValueOnce({ success: true, id: 'thought-id' });

      const thinking = {
        intent: {
          primary: 'simple-request',
          confidence: 0.85
        }
      };
      
      const userId = 'user-123';
      const message = 'Simple request';
      
      const result = await service.storeThinkingResult(thinking, userId, message);
      
      expect(mockMemoryService.addMemory).toHaveBeenCalledTimes(1); // Just intent
      expect(result).toEqual({
        thoughtId: 'thought-id',
        planId: null,
        entityIds: []
      });
    });

    it('should handle errors in storeThinkingResult', async () => {
      mockMemoryService.addMemory.mockRejectedValueOnce(new Error('Test error'));
      
      const thinking = {
        intent: {
          primary: 'error-intent',
          confidence: 0.5
        }
      };
      
      const result = await service.storeThinkingResult(thinking, 'user', 'Error message');
      
      expect(result).toEqual({
        thoughtId: null,
        planId: null,
        entityIds: []
      });
    });
  });

  // Add tests for retrieval methods
  describe('getThought', () => {
    it('should retrieve a thought by ID', async () => {
      const thoughtId = 'thought-123';
      mockMemoryService.getMemory = vi.fn().mockResolvedValue({
        id: thoughtId,
        payload: {
          text: 'This is a test thought',
          metadata: {
            ...mockThoughtMetadata,
            intention: 'analysis'
          }
        }
      });
      
      const result = await service.getThought(thoughtId);
      
      expect(mockMemoryService.getMemory).toHaveBeenCalledWith({
        id: thoughtId,
        type: MemoryType.THOUGHT
      });
      expect(result).toEqual({
        content: 'This is a test thought',
        metadata: {
          ...mockThoughtMetadata,
          intention: 'analysis'
        }
      });
    });
    
    it('should return null when thought is not found', async () => {
      mockMemoryService.getMemory = vi.fn().mockResolvedValue(null);
      
      const result = await service.getThought('non-existent-id');
      
      expect(result).toBeNull();
    });
    
    it('should handle errors gracefully', async () => {
      mockMemoryService.getMemory = vi.fn().mockRejectedValue(new Error('Test error'));
      
      const result = await service.getThought('error-id');
      
      expect(result).toBeNull();
    });
  });
  
  describe('getReasoning', () => {
    it('should retrieve and parse reasoning content', async () => {
      const reasoningId = 'reasoning-123';
      const reasoningContent = `
Reasoning Steps:
1. First consider the evidence
2. Then analyze patterns
3. Finally draw conclusions

Conclusion: The pattern indicates a trend.
      `.trim();
      
      // First mock the getThought method that getReasoning uses internally
      service.getThought = vi.fn().mockResolvedValue({
        content: reasoningContent,
        metadata: {
          ...mockThoughtMetadata,
          intention: 'reasoning'
        }
      });
      
      const result = await service.getReasoning(reasoningId);
      
      expect(service.getThought).toHaveBeenCalledWith(reasoningId);
      expect(result).toEqual({
        content: reasoningContent,
        steps: [
          'First consider the evidence',
          'Then analyze patterns',
          'Finally draw conclusions'
        ],
        conclusion: 'The pattern indicates a trend.',
        metadata: {
          ...mockThoughtMetadata,
          intention: 'reasoning'
        }
      });
    });
    
    it('should return null for non-reasoning thoughts', async () => {
      service.getThought = vi.fn().mockResolvedValue({
        content: 'This is not a reasoning thought',
        metadata: {
          ...mockThoughtMetadata,
          intention: 'observation'
        }
      });
      
      const result = await service.getReasoning('not-reasoning-id');
      
      expect(result).toBeNull();
    });
    
    it('should handle errors gracefully', async () => {
      service.getThought = vi.fn().mockRejectedValue(new Error('Test error'));
      
      const result = await service.getReasoning('error-id');
      
      expect(result).toBeNull();
    });
  });
  
  describe('getReflection', () => {
    it('should retrieve a reflection by ID', async () => {
      const reflectionId = 'reflection-123';
      mockMemoryService.getMemory = vi.fn().mockResolvedValue({
        id: reflectionId,
        payload: {
          text: 'This is a reflective thought about my performance',
          metadata: mockReflectionMetadata
        }
      });
      
      const result = await service.getReflection(reflectionId);
      
      expect(mockMemoryService.getMemory).toHaveBeenCalledWith({
        id: reflectionId,
        type: MemoryType.REFLECTION
      });
      expect(result).toEqual({
        content: 'This is a reflective thought about my performance',
        metadata: mockReflectionMetadata
      });
    });
    
    it('should return null when reflection is not found', async () => {
      mockMemoryService.getMemory = vi.fn().mockResolvedValue(null);
      
      const result = await service.getReflection('non-existent-id');
      
      expect(result).toBeNull();
    });
  });
  
  describe('getInsight', () => {
    it('should retrieve an insight by ID', async () => {
      const insightId = 'insight-123';
      mockMemoryService.getMemory = vi.fn().mockResolvedValue({
        id: insightId,
        payload: {
          text: 'This insight reveals a pattern in user behavior',
          metadata: mockInsightMetadata
        }
      });
      
      const result = await service.getInsight(insightId);
      
      expect(mockMemoryService.getMemory).toHaveBeenCalledWith({
        id: insightId,
        type: MemoryType.INSIGHT
      });
      expect(result).toEqual({
        content: 'This insight reveals a pattern in user behavior',
        metadata: mockInsightMetadata
      });
    });
  });
  
  describe('getPlan', () => {
    it('should retrieve and parse a plan by ID', async () => {
      const planId = 'plan-123';
      const planContent = `
Goal: Complete the project successfully

Plan Steps:
1. Research requirements
2. Design architecture
3. Implement core features
4. Test thoroughly
5. Deploy to production
      `.trim();
      
      mockMemoryService.getMemory = vi.fn().mockResolvedValue({
        id: planId,
        payload: {
          text: planContent,
          metadata: mockPlanningMetadata
        }
      });
      
      const result = await service.getPlan(planId);
      
      expect(mockMemoryService.getMemory).toHaveBeenCalledWith({
        id: planId,
        type: MemoryType.TASK
      });
      expect(result).toEqual({
        content: planContent,
        goal: 'Complete the project successfully',
        steps: [
          'Research requirements',
          'Design architecture',
          'Implement core features',
          'Test thoroughly',
          'Deploy to production'
        ],
        metadata: mockPlanningMetadata
      });
    });
    
    it('should return null for non-plan tasks', async () => {
      mockMemoryService.getMemory = vi.fn().mockResolvedValue({
        payload: {
          text: 'This is not a plan',
          metadata: {
            processType: 'something-else'
          }
        }
      });
      
      const result = await service.getPlan('not-plan-id');
      
      expect(result).toBeNull();
    });
  });
  
  describe('getTask', () => {
    it('should retrieve and parse a task by ID', async () => {
      const taskId = 'task-123';
      const taskContent = `Create user authentication system
Implement secure login and registration features with OAuth support and proper validation.`;
      
      mockMemoryService.getMemory = vi.fn().mockResolvedValue({
        id: taskId,
        payload: {
          text: taskContent,
          metadata: mockTaskMetadata
        }
      });
      
      const result = await service.getTask(taskId);
      
      expect(mockMemoryService.getMemory).toHaveBeenCalledWith({
        id: taskId,
        type: MemoryType.TASK
      });
      expect(result).toEqual({
        title: 'Create user authentication system',
        description: 'Implement secure login and registration features with OAuth support and proper validation.',
        metadata: mockTaskMetadata
      });
    });
  });
  
  describe('getRelatedArtifacts', () => {
    it('should retrieve related artifacts', async () => {
      // Set up mocks for the memory retrieval flow
      // First mock the memory type detection
      mockMemoryService.getMemory = vi.fn()
        .mockImplementation(async (params) => {
          if (params.id === 'thought-123' && params.type === MemoryType.THOUGHT) {
            return {
              id: 'thought-123',
              payload: {
                text: 'Main thought',
                metadata: {
                  ...mockThoughtMetadata,
                  relatedTo: ['insight-456', 'reflection-789']
                }
              }
            };
          }
          if (params.id === 'insight-456' && params.type === MemoryType.INSIGHT) {
            return {
              id: 'insight-456',
              payload: {
                text: 'Related insight',
                metadata: mockInsightMetadata
              }
            };
          }
          if (params.id === 'reflection-789' && params.type === MemoryType.REFLECTION) {
            return {
              id: 'reflection-789',
              payload: {
                text: 'Related reflection',
                metadata: mockReflectionMetadata
              }
            };
          }
          return null;
        });
      
      const result = await service.getRelatedArtifacts('thought-123');
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('insight-456');
      expect(result[0].content).toBe('Related insight');
      expect(result[1].id).toBe('reflection-789');
      expect(result[1].content).toBe('Related reflection');
    });
    
    it('should handle the "influences" relationship type', async () => {
      // For the 'influences' relationship type, we need to mock searchMemories
      mockMemoryService.getMemory = vi.fn()
        .mockImplementation(async (params) => {
          if (params.id === 'thought-123' && params.type === MemoryType.THOUGHT) {
            return {
              id: 'thought-123',
              payload: {
                text: 'Source thought',
                metadata: mockThoughtMetadata
              }
            };
          }
          if (params.id === 'insight-456' && params.type === MemoryType.INSIGHT) {
            return {
              id: 'insight-456',
              payload: {
                text: 'Influenced insight',
                metadata: {
                  ...mockInsightMetadata,
                  influencedBy: ['thought-123']
                }
              }
            };
          }
          return null;
        });
      
      mockMemoryService.searchMemories = vi.fn().mockResolvedValue([
        { id: 'insight-456', type: MemoryType.INSIGHT }
      ]);
      
      const result = await service.getRelatedArtifacts('thought-123', {
        relationshipType: 'influences'
      });
      
      expect(mockMemoryService.searchMemories).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('insight-456');
    });
  });
  
  describe('traverseReasoningChain', () => {
    it('should traverse a reasoning chain in both directions', async () => {
      // Mock a chain: A <- B -> C where B is the starting point
      mockMemoryService.getMemory = vi.fn()
        .mockImplementation(async (params) => {
          if (params.id === 'thought-A' && params.type === MemoryType.THOUGHT) {
            return {
              id: 'thought-A',
              payload: {
                text: 'Thought A',
                metadata: {
                  ...mockThoughtMetadata,
                  influences: ['thought-B']
                }
              }
            };
          }
          if (params.id === 'thought-B' && params.type === MemoryType.THOUGHT) {
            return {
              id: 'thought-B',
              payload: {
                text: 'Thought B',
                metadata: {
                  ...mockThoughtMetadata,
                  influencedBy: ['thought-A'],
                  influences: ['thought-C']
                }
              }
            };
          }
          if (params.id === 'thought-C' && params.type === MemoryType.THOUGHT) {
            return {
              id: 'thought-C',
              payload: {
                text: 'Thought C',
                metadata: {
                  ...mockThoughtMetadata,
                  influencedBy: ['thought-B']
                }
              }
            };
          }
          return null;
        });
      
      // For the 'influences' search
      service.getRelatedArtifacts = vi.fn()
        .mockImplementation(async (id, options) => {
          if (id === 'thought-B' && options?.relationshipType === 'influences') {
            return [{
              id: 'thought-C',
              type: MemoryType.THOUGHT,
              content: 'Thought C',
              metadata: {
                ...mockThoughtMetadata,
                influencedBy: ['thought-B']
              }
            }];
          }
          return [];
        });
      
      const result = await service.traverseReasoningChain('thought-B');
      
      // We expect all three nodes in the chain
      expect(result).toHaveLength(3);
      
      // Starting node (depth 0) should be first
      expect(result[0].id).toBe('thought-B');
      expect(result[0].depth).toBe(0);
      
      // The two nodes with depth 1 can be in any order, just make sure they're both there
      const depthOneNodes = result.slice(1);
      expect(depthOneNodes).toHaveLength(2);
      expect(depthOneNodes.map(n => n.id)).toContain('thought-A');
      expect(depthOneNodes.map(n => n.id)).toContain('thought-C');
      
      // Verify all depth values are correct
      depthOneNodes.forEach(node => {
        expect(node.depth).toBe(1);
      });
    });
    
    it('should respect maxDepth parameter', async () => {
      // Create a mock for a deep chain A -> B -> C -> D -> E
      // But limit traversal to depth 2
      
      // Initialize mocks with a simpler setup for easier testing
      mockMemoryService.getMemory = vi.fn()
        .mockImplementation(async (params) => {
          return {
            id: params.id,
            payload: {
              text: `Thought ${params.id}`,
              metadata: {
                ...mockThoughtMetadata,
                // Add relevant influenced-by relationships based on the ID
                influencedBy: params.id === 'thought-B' ? ['thought-A'] :
                              params.id === 'thought-C' ? ['thought-B'] :
                              params.id === 'thought-D' ? ['thought-C'] :
                              params.id === 'thought-E' ? ['thought-D'] : []
              }
            }
          };
        });
      
      // No need to mock getRelatedArtifacts here as we're only testing backward traversal
      
      const result = await service.traverseReasoningChain('thought-C', {
        maxDepth: 1,
        direction: 'backward'
      });
      
      // We only expect nodes B and C (not A) due to depth limit
      expect(result).toHaveLength(2);
      expect(result.map(node => node.id)).toContain('thought-B');
      expect(result.map(node => node.id)).toContain('thought-C');
      expect(result.map(node => node.id)).not.toContain('thought-A');
    });
  });
}); 