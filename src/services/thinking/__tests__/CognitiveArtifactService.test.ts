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
}); 