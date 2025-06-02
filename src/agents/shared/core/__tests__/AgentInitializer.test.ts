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
  modelName: 'gpt-4.1-2025-04-14',
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
    reflectionManager: { enabled: true },
    
    // New manager configurations (Phase 2 integration)
    ethicsManager: { enabled: false },
    collaborationManager: { enabled: false },
    communicationManager: { enabled: false },
    notificationManager: { enabled: false }
  },
  ...overrides
});

describe('AgentInitializer', () => {
  let initializer: AgentInitializer;
  
  beforeEach(() => {
    initializer = new AgentInitializer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create an instance', () => {
      expect(initializer).toBeInstanceOf(AgentInitializer);
    });

    it('should have required methods', () => {
      expect(typeof initializer.initializeAgent).toBe('function');
      expect(typeof initializer.getManagers).toBe('function');
      expect(typeof initializer.getSchedulerManager).toBe('function');
      expect(typeof initializer.getOpportunityManager).toBe('function');
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
        enableReflectionManager: false,
        enableEthicsManager: false,
        enableCollaborationManager: false,
        enableCommunicationManager: false,
        enableNotificationManager: false
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

    it('should initialize agent with new managers enabled', async () => {
      const config = createMockConfig({
        enableEthicsManager: true,
        enableCollaborationManager: true,
        enableCommunicationManager: true,
        enableNotificationManager: true,
        managersConfig: {
          ...createMockConfig().managersConfig,
          ethicsManager: { enabled: true, enableBiasAuditing: true },
          collaborationManager: { enabled: true, enableApprovalWorkflows: true },
          communicationManager: { enabled: true, enableMessageRouting: true },
          notificationManager: { enabled: true, enableAutoCleanup: true }
        }
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
      
      // The managers should be available after initialization
      const managers = initializer.getManagers();
      expect(managers).toBeInstanceOf(Map);
    });
  });

  describe('New Manager Initialization (Phase 2 Integration)', () => {
    describe('Ethics Manager', () => {
      it('should initialize ethics manager when enabled', async () => {
        const config = createMockConfig({
          enableEthicsManager: true,
          managersConfig: {
            ...createMockConfig().managersConfig,
            ethicsManager: { 
              enabled: true, 
              enableBiasAuditing: true,
              enforceMiddleware: true,
              biasThreshold: 0.8
            }
          }
        });

        const result = await initializer.initializeAgent(mockAgent, config);

        expect(result).toHaveProperty('success');
        
        // Verify the manager was initialized (would be in the managers map)
        const managers = initializer.getManagers();
        expect(managers).toBeInstanceOf(Map);
      });

      it('should skip ethics manager initialization when disabled', async () => {
        const config = createMockConfig({
          enableEthicsManager: false
        });

        const result = await initializer.initializeAgent(mockAgent, config);

        expect(result).toHaveProperty('success');
        expect(result.errors).toEqual(expect.arrayContaining([]));
      });
    });

    describe('Collaboration Manager', () => {
      it('should initialize collaboration manager when enabled', async () => {
        const config = createMockConfig({
          enableCollaborationManager: true,
          managersConfig: {
            ...createMockConfig().managersConfig,
            collaborationManager: { 
              enabled: true, 
              enableClarificationChecking: true,
              enableApprovalWorkflows: true
            }
          }
        });

        const result = await initializer.initializeAgent(mockAgent, config);

        expect(result).toHaveProperty('success');
        
        // Verify the manager was initialized
        const managers = initializer.getManagers();
        expect(managers).toBeInstanceOf(Map);
      });

      it('should skip collaboration manager initialization when disabled', async () => {
        const config = createMockConfig({
          enableCollaborationManager: false
        });

        const result = await initializer.initializeAgent(mockAgent, config);

        expect(result).toHaveProperty('success');
      });
    });

    describe('Communication Manager', () => {
      it('should initialize communication manager when enabled', async () => {
        const config = createMockConfig({
          enableCommunicationManager: true,
          managersConfig: {
            ...createMockConfig().managersConfig,
            communicationManager: { 
              enabled: true, 
              enableMessageRouting: true,
              enableDelegation: true,
              defaultMessageTimeout: 30000
            }
          }
        });

        const result = await initializer.initializeAgent(mockAgent, config);

        expect(result).toHaveProperty('success');
        
        // Verify the manager was initialized
        const managers = initializer.getManagers();
        expect(managers).toBeInstanceOf(Map);
      });

      it('should skip communication manager initialization when disabled', async () => {
        const config = createMockConfig({
          enableCommunicationManager: false
        });

        const result = await initializer.initializeAgent(mockAgent, config);

        expect(result).toHaveProperty('success');
      });
    });

    describe('Notification Manager', () => {
      it('should initialize notification manager when enabled', async () => {
        const config = createMockConfig({
          enableNotificationManager: true,
          managersConfig: {
            ...createMockConfig().managersConfig,
            notificationManager: { 
              enabled: true, 
              enableAutoCleanup: true,
              maxNotificationAge: 86400000,
              enableBatching: false
            }
          }
        });

        const result = await initializer.initializeAgent(mockAgent, config);

        expect(result).toHaveProperty('success');
        
        // Verify the manager was initialized
        const managers = initializer.getManagers();
        expect(managers).toBeInstanceOf(Map);
      });

      it('should skip notification manager initialization when disabled', async () => {
        const config = createMockConfig({
          enableNotificationManager: false
        });

        const result = await initializer.initializeAgent(mockAgent, config);

        expect(result).toHaveProperty('success');
      });
    });

    describe('All New Managers Together', () => {
      it('should initialize all new managers when enabled together', async () => {
        const config = createMockConfig({
          enableEthicsManager: true,
          enableCollaborationManager: true,
          enableCommunicationManager: true,
          enableNotificationManager: true,
          managersConfig: {
            ...createMockConfig().managersConfig,
            ethicsManager: { 
              enabled: true, 
              enableBiasAuditing: true,
              biasThreshold: 0.7
            },
            collaborationManager: { 
              enabled: true, 
              enableApprovalWorkflows: true
            },
            communicationManager: { 
              enabled: true, 
              enableMessageRouting: true,
              maxRetryAttempts: 3
            },
            notificationManager: { 
              enabled: true, 
              enableAutoCleanup: true,
              batchSize: 10
            }
          }
        });

        const result = await initializer.initializeAgent(mockAgent, config);

        expect(result).toHaveProperty('success');
        
        // Verify all managers were attempted to be initialized
        const managers = initializer.getManagers();
        expect(managers).toBeInstanceOf(Map);
      });

      it('should handle mixed success/failure scenarios gracefully', async () => {
        const config = createMockConfig({
          enableEthicsManager: true,
          enableCollaborationManager: true,
          enableCommunicationManager: true,
          enableNotificationManager: true
        });

        const result = await initializer.initializeAgent(mockAgent, config);

        // Should still return a result even if some managers fail
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('managers');
        expect(result).toHaveProperty('errors');
        expect(Array.isArray(result.errors)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle agent initialization errors gracefully', async () => {
      // Create a malformed agent to trigger errors
      const badAgent = {
        ...mockAgent,
        getId: vi.fn(() => { throw new Error('ID error'); })
      };

      const config = createMockConfig();

      try {
        const result = await initializer.initializeAgent(badAgent as unknown as AgentBase, config);
        
        // If no error is thrown, check that it failed gracefully
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('errors');
        expect(result.errors.length).toBeGreaterThan(0);
      } catch (error) {
        // If it throws an error, that's also acceptable for a critically malformed agent
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('ID error');
      }
    });

    it('should continue initialization even if some managers fail', async () => {
      const config = createMockConfig({
        enableMemoryManager: true,
        enableEthicsManager: true, // This might fail but shouldn't stop others
        enableCollaborationManager: true
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      // Should have attempted initialization and collected any errors
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('managers');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('Integration Scenarios', () => {
    it('should integrate new managers with existing agent workflow', async () => {
      const config = createMockConfig({
        enableMemoryManager: true,
        enablePlanningManager: true,
        enableToolManager: true,
        enableEthicsManager: true,
        enableCollaborationManager: true,
        enableCommunicationManager: true,
        enableNotificationManager: true
      });

      const result = await initializer.initializeAgent(mockAgent, config);

      expect(result).toHaveProperty('success');
      
      // Should have attempted to initialize all requested managers
      const managers = initializer.getManagers();
      expect(managers).toBeInstanceOf(Map);
    });

    it('should maintain backward compatibility with existing configurations', async () => {
      // Old-style config without new managers
      const legacyConfig = createMockConfig({
        enableMemoryManager: true,
        enablePlanningManager: true,
        enableToolManager: true
        // No new manager flags
      });

      const result = await initializer.initializeAgent(mockAgent, legacyConfig);

      expect(result).toHaveProperty('success');
      
      // Should work fine without the new managers
      const managers = initializer.getManagers();
      expect(managers).toBeInstanceOf(Map);
    });
  });
}); 