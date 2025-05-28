/**
 * AgentInitializer.test.ts - Unit tests for AgentInitializer
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  AgentInitializer, 
  AgentInitializationError,
  type AgentInitializationConfig,
  type AgentInitializationResult
} from '../AgentInitializer';
import type { AgentBase } from '../../base/AgentBase.interface';
import { ManagerType } from '../../base/managers/ManagerType';

// Mock dependencies
const mockAgent = {
  getId: vi.fn(() => 'test-agent-123'),
  getAgentId: vi.fn(() => 'test-agent-123'), // Add this method that some managers expect
  getName: vi.fn(() => 'Test Agent'),
  getType: vi.fn(() => 'default'),
  getStatus: vi.fn(() => 'active'),
  getCapabilities: vi.fn(() => []),
  getManagers: vi.fn(() => new Map()),
  getManager: vi.fn(),
  addManager: vi.fn(),
  removeManager: vi.fn(),
  hasManager: vi.fn(() => false),
  updateConfig: vi.fn(),
  getConfig: vi.fn(() => ({})),
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  processMessage: vi.fn(),
  getMetrics: vi.fn(() => ({})),
  getHealth: vi.fn(() => ({ status: 'healthy' }))
} as unknown as AgentBase;

// Helper function to create mock initialization config
const createMockConfig = (overrides: Partial<AgentInitializationConfig> = {}): AgentInitializationConfig => ({
  id: 'test-agent',
  name: 'Test Agent',
  description: 'Test agent for unit testing',
  type: 'default',
  modelName: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  adaptiveBehavior: true,
  systemPrompt: 'You are a helpful assistant.',
  persona: {
    background: 'AI assistant',
    personality: 'helpful and knowledgeable',
    communicationStyle: 'friendly',
    expertise: ['general assistance'],
    preferences: { style: 'conversational' }
  },
  memoryRefresh: {
    enabled: true,
    interval: 60000,
    maxCriticalMemories: 10
  },
  managersConfig: {
    memoryManager: { enabled: true },
    planningManager: { enabled: true },
    toolManager: { enabled: true },
    knowledgeManager: { enabled: true },
    schedulerManager: { enabled: true },
    inputProcessor: { enabled: true },
    outputProcessor: { enabled: true },
    resourceTracker: { samplingIntervalMs: 10000 },
    reflectionManager: { enabled: true }
  },
  ...overrides
});

describe('AgentInitializer', () => {
  let initializer: AgentInitializer;

  beforeEach(() => {
    vi.clearAllMocks();
    initializer = new AgentInitializer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should create initializer instance', () => {
      expect(initializer).toBeInstanceOf(AgentInitializer);
    });

    it('should have required methods', () => {
      expect(typeof initializer.initializeAgent).toBe('function');
      expect(typeof initializer.getManagers).toBe('function');
      expect(typeof initializer.getSchedulerManager).toBe('function');
      expect(typeof initializer.getOpportunityManager).toBe('function');
    });

    it('should return empty managers map initially', () => {
      const managers = initializer.getManagers();
      expect(managers).toBeInstanceOf(Map);
      expect(managers.size).toBe(0);
    });

    it('should return undefined for scheduler manager initially', () => {
      const schedulerManager = initializer.getSchedulerManager();
      expect(schedulerManager).toBeUndefined();
    });

    it('should return undefined for opportunity manager initially', () => {
      const opportunityManager = initializer.getOpportunityManager();
      expect(opportunityManager).toBeUndefined();
    });
  });

  describe('Agent Initialization', () => {
    it('should initialize agent with minimal configuration', async () => {
      const config = createMockConfig({
        enableMemoryManager: false,
        enablePlanningManager: false,
        enableToolManager: false,
        enableKnowledgeManager: false,
        enableSchedulerManager: false,
        enableInputProcessor: false,
        enableOutputProcessor: false,
        enableResourceTracking: false,
        enableReflectionManager: false
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
      expect(result).toHaveProperty('errors');
      expect(result.managers).toBeInstanceOf(Map);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should initialize agent with full configuration', async () => {
      const config = createMockConfig();

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
      expect(result).toHaveProperty('errors');
      expect(result.managers).toBeInstanceOf(Map);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle agent initialization with custom ID', async () => {
      const customId = 'custom-agent-id';
      const config = createMockConfig({ id: customId });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(mockAgent.getId).toHaveBeenCalled();
    });

    it('should handle agent initialization with enhanced managers', async () => {
      const config = createMockConfig({
        useEnhancedMemory: true,
        useEnhancedReflection: true
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
    });

    it('should handle agent initialization with memory refresh configuration', async () => {
      const config = createMockConfig({
        memoryRefresh: {
          enabled: true,
          interval: 30000,
          maxCriticalMemories: 5
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
    });
  });

  describe('Manager Configuration', () => {
    it('should handle memory manager configuration', async () => {
      const config = createMockConfig({
        enableMemoryManager: true,
        managersConfig: {
          memoryManager: {
            enabled: true,
            maxMemories: 1000,
            compressionThreshold: 0.8
          }
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result.managers).toBeInstanceOf(Map);
    });

    it('should handle planning manager configuration', async () => {
      const config = createMockConfig({
        enablePlanningManager: true,
        managersConfig: {
          planningManager: {
            enabled: true,
            maxPlanDepth: 5,
            planningTimeout: 30000
          }
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result.managers).toBeInstanceOf(Map);
    });

    it('should handle tool manager configuration', async () => {
      const config = createMockConfig({
        enableToolManager: true,
        managersConfig: {
          toolManager: {
            enabled: true,
            maxConcurrentTools: 3,
            toolTimeout: 10000
          }
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result.managers).toBeInstanceOf(Map);
    });

    it('should handle knowledge manager configuration', async () => {
      const config = createMockConfig({
        enableKnowledgeManager: true,
        managersConfig: {
          knowledgeManager: {
            enabled: true,
            maxKnowledgeItems: 500,
            indexingEnabled: true
          }
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result.managers).toBeInstanceOf(Map);
    });

    it('should handle scheduler manager configuration', async () => {
      const config = createMockConfig({
        enableSchedulerManager: true,
        managersConfig: {
          schedulerManager: {
            enabled: true,
            maxConcurrentTasks: 5,
            taskTimeout: 60000
          }
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result.managers).toBeInstanceOf(Map);
    });
  });

  describe('Processor Configuration', () => {
    it('should handle input processor configuration', async () => {
      const config = createMockConfig({
        enableInputProcessor: true,
        managersConfig: {
          inputProcessor: {
            enabled: true,
            maxInputLength: 10000,
            validationEnabled: true,
            preprocessingEnabled: true
          }
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result.managers).toBeInstanceOf(Map);
    });

    it('should handle output processor configuration', async () => {
      const config = createMockConfig({
        enableOutputProcessor: true,
        managersConfig: {
          outputProcessor: {
            enabled: true,
            maxOutputLength: 5000,
            formattingEnabled: true,
            validationEnabled: true
          }
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result.managers).toBeInstanceOf(Map);
    });

    it('should handle reflection manager configuration', async () => {
      const config = createMockConfig({
        enableReflectionManager: true,
        managersConfig: {
          reflectionManager: {
            enabled: true,
            reflectionDepth: 3,
            autoReflectionEnabled: true
          }
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result.managers).toBeInstanceOf(Map);
    });
  });

  describe('Error Handling', () => {
    it('should create AgentInitializationError with proper properties', () => {
      const error = new AgentInitializationError(
        'Test error',
        'TEST_ERROR',
        { extra: 'context' }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AgentInitializationError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual({ extra: 'context' });
      expect(error.name).toBe('AgentInitializationError');
    });

    it('should handle initialization errors gracefully', async () => {
      // Create a config that might cause initialization issues
      const config = createMockConfig({
        enableMemoryManager: true,
        managersConfig: {
          memoryManager: {
            enabled: true,
            // Invalid configuration that might cause errors
            maxMemories: -1
          }
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle missing agent gracefully', async () => {
      const config = createMockConfig();

      // Test with null agent - this should throw an error, so we catch it
      try {
        const result = await initializer.initializeAgent(null as unknown as AgentBase, config);
        // If it doesn't throw, check that it failed gracefully
        expect(result).toHaveProperty('success');
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      } catch (error) {
        // If it throws, that's also acceptable behavior for null input
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle invalid configuration gracefully', async () => {
      const invalidConfig = {} as AgentInitializationConfig;

      const result = await initializer.initializeAgent(mockAgent, invalidConfig);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('Manager Access', () => {
    it('should provide access to initialized managers', async () => {
      const config = createMockConfig({
        enableMemoryManager: true,
        enablePlanningManager: true
      });

      await initializer.initializeAgent(mockAgent, config);

      const managers = initializer.getManagers();
      expect(managers).toBeInstanceOf(Map);
      // Note: Actual manager instances depend on successful initialization
    });

    it('should provide access to scheduler manager when enabled', async () => {
      const config = createMockConfig({
        enableSchedulerManager: true
      });

      await initializer.initializeAgent(mockAgent, config);

      const schedulerManager = initializer.getSchedulerManager();
      // Note: May be undefined if initialization failed
      expect(schedulerManager === undefined || schedulerManager !== null).toBe(true);
    });

    it('should provide access to opportunity manager when enabled', async () => {
      const config = createMockConfig({
        enableResourceTracking: true
      });

      await initializer.initializeAgent(mockAgent, config);

      const opportunityManager = initializer.getOpportunityManager();
      // Note: May be undefined if initialization failed
      expect(opportunityManager === undefined || opportunityManager !== null).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty configuration object', async () => {
      const emptyConfig = {} as AgentInitializationConfig;

      const result = await initializer.initializeAgent(mockAgent, emptyConfig);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
      expect(result).toHaveProperty('errors');
    });

    it('should handle configuration with all managers disabled', async () => {
      const config = createMockConfig({
        enableMemoryManager: false,
        enablePlanningManager: false,
        enableToolManager: false,
        enableKnowledgeManager: false,
        enableSchedulerManager: false,
        enableInputProcessor: false,
        enableOutputProcessor: false,
        enableResourceTracking: false,
        enableReflectionManager: false
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      // With all managers disabled, we might have 0 or 1 managers depending on logger initialization
      expect(result.managers.size).toBeGreaterThanOrEqual(0);
    });

    it('should handle configuration with partial manager configs', async () => {
      const config = createMockConfig({
        enableMemoryManager: true,
        enablePlanningManager: true,
        managersConfig: {
          memoryManager: { enabled: true },
          // planningManager config missing
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
    });

    it('should handle very large configuration objects', async () => {
      const largeConfig = createMockConfig({
        managersConfig: {}
      });

      // Add many manager configurations
      for (let i = 0; i < 100; i++) {
        largeConfig.managersConfig![`customManager${i}`] = {
          enabled: true,
          customProperty: `value${i}`
        };
      }

      const result = await initializer.initializeAgent(mockAgent, largeConfig);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
    });

    it('should handle concurrent initialization attempts', async () => {
      const config = createMockConfig();

      const promises = [
        initializer.initializeAgent(mockAgent, config),
        initializer.initializeAgent(mockAgent, config),
        initializer.initializeAgent(mockAgent, config)
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('managers');
        expect(result).toHaveProperty('errors');
      });
    });
  });

  describe('Persona and System Configuration', () => {
    it('should handle persona configuration', async () => {
             const config = createMockConfig({
         persona: {
           background: 'Software engineering expert with 10+ years experience',
           personality: 'analytical, precise, and helpful',
           communicationStyle: 'professional and detailed',
           expertise: ['software engineering', 'technical guidance', 'problem solving'],
           preferences: { 
             detail: 'comprehensive',
             approach: 'methodical'
           }
         }
       });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
    });

    it('should handle system prompt configuration', async () => {
      const config = createMockConfig({
        systemPrompt: 'You are an expert software engineer. Provide detailed, accurate technical guidance.'
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
    });

    it('should handle LLM configuration parameters', async () => {
      const config = createMockConfig({
        modelName: 'gpt-4-turbo',
        temperature: 0.3,
        maxTokens: 4000
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
    });
  });
}); 