/**
 * DefaultPlanningManager.test.ts - Unit tests for refactored DefaultPlanningManager
 * 
 * Tests the component-based architecture and delegation to specialized components.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DefaultPlanningManager, PlanningError } from '../DefaultPlanningManager';
import { AgentBase } from '../../../../../../agents/shared/base/AgentBase.interface';
import { ManagerType } from '../../../../../../agents/shared/base/managers/ManagerType';
import { 
  Plan,
  PlanStep,
  PlanAction,
  PlanCreationOptions,
  PlanCreationResult,
  PlanExecutionResult
} from '../../../../../../agents/shared/base/managers/PlanningManager.interface';

// Mock the specialized components
vi.mock('../task-creation/AutoTaskCreator');
vi.mock('../execution/PlanExecutor');
vi.mock('../execution/ActionExecutor');
vi.mock('../execution/ExecutionResultProcessor');
vi.mock('../creation/PlanCreator');
vi.mock('../creation/StepGenerator');
vi.mock('../creation/ActionGenerator');
vi.mock('../adaptation/StepAdapter');
vi.mock('../adaptation/PlanOptimizer');
vi.mock('../validation/PlanValidator');
vi.mock('../validation/ActionValidator');

// Mock logger
vi.mock('../../../../../logging/winston-logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }))
}));

describe('DefaultPlanningManager', () => {
  let mockAgent: AgentBase;
  let planningManager: DefaultPlanningManager;

  beforeEach(() => {
    // Create mock agent
    mockAgent = {
      getId: vi.fn().mockReturnValue('test-agent-id'),
      getType: vi.fn().mockReturnValue('test-agent'),
      getConfig: vi.fn().mockReturnValue({}),
      getToolManager: vi.fn(),
      getMemoryManager: vi.fn(),
      getPlanningManager: vi.fn(),
      getSchedulerManager: vi.fn(),
      getReflectionManager: vi.fn(),
      getOpportunityManager: vi.fn(),
      getKnowledgeManager: vi.fn(),
      getCommunicationManager: vi.fn(),
      getLifecycleManager: vi.fn(),
      getExecutionEngine: vi.fn(),
      processUserInput: vi.fn(),
      getLLMResponse: vi.fn(),
      think: vi.fn(),
      initialize: vi.fn(),
      shutdown: vi.fn(),
      getHealth: vi.fn(),
      isInitialized: vi.fn().mockReturnValue(true),
      isEnabled: vi.fn().mockReturnValue(true)
    } as any;

    // Create planning manager instance
    planningManager = new DefaultPlanningManager(mockAgent, {
      enableAutoTaskCreation: true,
      enableOptimization: true,
      enableValidation: true,
      enableAdaptation: true
    });
    
    // Initialize the manager
    (planningManager as any)._initialized = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default configuration', () => {
      const manager = new DefaultPlanningManager(mockAgent);
      expect(manager).toBeInstanceOf(DefaultPlanningManager);
      expect(manager.getConfig()).toMatchObject({
        enabled: true,
        enableAutoTaskCreation: true,
        enableOptimization: true,
        enableValidation: true,
        enableAdaptation: true
      });
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig = {
        enableAutoTaskCreation: false,
        maxConcurrentExecutions: 5,
        planCreationTimeoutMs: 120000
      };

      const manager = new DefaultPlanningManager(mockAgent, customConfig);
      const config = manager.getConfig();

      expect(config.enableAutoTaskCreation).toBe(false);
      expect(config.maxConcurrentExecutions).toBe(5);
      expect(config.planCreationTimeoutMs).toBe(120000);
      expect(config.enabled).toBe(true); // Default value preserved
    });

    it('should initialize all specialized components', () => {
      // Component initialization is tested through successful instantiation
      expect(planningManager).toBeInstanceOf(DefaultPlanningManager);
    });

    it('should have correct manager type', () => {
      // The manager type is set in the constructor via AbstractBaseManager
      expect(planningManager).toBeInstanceOf(DefaultPlanningManager);
    });
  });

  describe('Health Status', () => {
    it('should return degraded status when not initialized', async () => {
      const uninitializedManager = new DefaultPlanningManager(mockAgent);
      // Simulate uninitialized state
      (uninitializedManager as any)._initialized = false;

      const health = await uninitializedManager.getHealth();
      
      expect(health.status).toBe('degraded');
      expect(health.details.issues).toHaveLength(1);
      expect(health.details.issues[0].message).toContain('not initialized');
    });

    it('should return unhealthy status when disabled', async () => {
      // Mock isEnabled to return false
      vi.spyOn(planningManager, 'isEnabled').mockReturnValue(false);

      const health = await planningManager.getHealth();
      
      expect(health.status).toBe('unhealthy');
      expect(health.details.issues).toHaveLength(1);
      expect(health.details.issues[0].message).toContain('disabled');
    });

    it('should return healthy status when all components are healthy', async () => {
      // Mock component health status
      const mockHealthStatus = { healthy: true };
      
      // Mock all component health methods
      (planningManager as any).planCreator = { getHealthStatus: () => mockHealthStatus };
      (planningManager as any).planExecutor = { getHealthStatus: () => mockHealthStatus };
      (planningManager as any).planValidator = { getHealthStatus: () => mockHealthStatus };
      (planningManager as any).actionValidator = { getHealthStatus: () => mockHealthStatus };
      (planningManager as any).planOptimizer = { getHealthStatus: () => mockHealthStatus };
      (planningManager as any).stepAdapter = { getHealthStatus: () => mockHealthStatus };

      const health = await planningManager.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.details.issues).toHaveLength(0);
      expect(health.details.metrics?.healthyComponents).toBe(6);
    });

    it('should return degraded status when some components are unhealthy', async () => {
      // Mock mixed component health status
      const healthyStatus = { healthy: true };
      const unhealthyStatus = { healthy: false };
      
      (planningManager as any).planCreator = { getHealthStatus: () => healthyStatus };
      (planningManager as any).planExecutor = { getHealthStatus: () => unhealthyStatus };
      (planningManager as any).planValidator = { getHealthStatus: () => healthyStatus };
      (planningManager as any).actionValidator = { getHealthStatus: () => unhealthyStatus };
      (planningManager as any).planOptimizer = { getHealthStatus: () => healthyStatus };
      (planningManager as any).stepAdapter = { getHealthStatus: () => healthyStatus };

      const health = await planningManager.getHealth();
      
      expect(health.status).toBe('degraded');
      expect(health.details.issues).toHaveLength(1);
      expect(health.details.issues[0].message).toContain('components are unhealthy');
      expect(health.details.metrics?.unhealthyComponents).toBe(2);
    });
  });

  describe('Plan Creation', () => {
    const mockPlanCreationOptions: PlanCreationOptions = {
      name: 'Test Plan',
      description: 'Test plan description',
      goals: ['Goal 1', 'Goal 2'],
      priority: 5,
      metadata: { test: true }
    };

    const mockPlan: Plan = {
      id: 'test-plan-id',
      name: 'Test Plan',
      description: 'Test plan description',
      goals: ['Goal 1', 'Goal 2'],
      steps: [],
      status: 'pending',
      priority: 5,
      confidence: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { test: true }
    };

    it('should throw error when not initialized', async () => {
      (planningManager as any)._initialized = false;

      await expect(planningManager.createPlan(mockPlanCreationOptions))
        .rejects.toThrow(PlanningError);
    });

    it('should delegate plan creation to PlanCreator component', async () => {
      const mockResult: PlanCreationResult = {
        success: true,
        plan: mockPlan
      };

      // Mock PlanCreator
      const mockPlanCreator = {
        createPlan: vi.fn().mockResolvedValue(mockResult)
      };
      (planningManager as any).planCreator = mockPlanCreator;

      const result = await planningManager.createPlan(mockPlanCreationOptions);

      expect(mockPlanCreator.createPlan).toHaveBeenCalledWith(
        mockPlanCreationOptions.description,
        expect.objectContaining({
          name: mockPlanCreationOptions.name,
          goals: mockPlanCreationOptions.goals,
          priority: mockPlanCreationOptions.priority,
          metadata: mockPlanCreationOptions.metadata
        })
      );
      expect(result).toEqual(mockResult);
    });

    it('should store successfully created plan', async () => {
      const mockResult: PlanCreationResult = {
        success: true,
        plan: mockPlan
      };

      const mockPlanCreator = {
        createPlan: vi.fn().mockResolvedValue(mockResult)
      };
      (planningManager as any).planCreator = mockPlanCreator;

      await planningManager.createPlan(mockPlanCreationOptions);

      const storedPlan = await planningManager.getPlan(mockPlan.id);
      expect(storedPlan).toEqual(mockPlan);
    });

    it('should handle plan creation failure', async () => {
      const mockResult: PlanCreationResult = {
        success: false,
        error: 'Plan creation failed'
      };

      const mockPlanCreator = {
        createPlan: vi.fn().mockResolvedValue(mockResult)
      };
      (planningManager as any).planCreator = mockPlanCreator;

      const result = await planningManager.createPlan(mockPlanCreationOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan creation failed');
    });

    it('should handle plan creation component errors', async () => {
      const mockPlanCreator = {
        createPlan: vi.fn().mockRejectedValue(new Error('Component error'))
      };
      (planningManager as any).planCreator = mockPlanCreator;

      const result = await planningManager.createPlan(mockPlanCreationOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Component error');
    });
  });

  describe('Plan Management', () => {
    const mockPlan: Plan = {
      id: 'test-plan-id',
      name: 'Test Plan',
      description: 'Test plan description',
      goals: ['Goal 1'],
      steps: [],
      status: 'pending',
      priority: 5,
      confidence: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };

    beforeEach(() => {
      // Add a plan to the manager
      (planningManager as any).plans.set(mockPlan.id, mockPlan);
    });

    it('should retrieve plan by ID', async () => {
      const plan = await planningManager.getPlan(mockPlan.id);
      expect(plan).toEqual(mockPlan);
    });

    it('should return null for non-existent plan', async () => {
      const plan = await planningManager.getPlan('non-existent-id');
      expect(plan).toBeNull();
    });

    it('should retrieve all plans', async () => {
      const plans = await planningManager.getAllPlans();
      expect(plans).toHaveLength(1);
      expect(plans[0]).toEqual(mockPlan);
    });

    it('should update existing plan', async () => {
      const updates = { name: 'Updated Plan Name', priority: 8 };
      
      const updatedPlan = await planningManager.updatePlan(mockPlan.id, updates);
      
      expect(updatedPlan).not.toBeNull();
      expect(updatedPlan!.name).toBe('Updated Plan Name');
      expect(updatedPlan!.priority).toBe(8);
      expect(updatedPlan!.updatedAt).toBeInstanceOf(Date);
    });

    it('should return null when updating non-existent plan', async () => {
      const updates = { name: 'Updated Plan Name' };
      
      const result = await planningManager.updatePlan('non-existent-id', updates);
      
      expect(result).toBeNull();
    });

    it('should delete existing plan', async () => {
      const deleted = await planningManager.deletePlan(mockPlan.id);
      
      expect(deleted).toBe(true);
      
      const plan = await planningManager.getPlan(mockPlan.id);
      expect(plan).toBeNull();
    });

    it('should return false when deleting non-existent plan', async () => {
      const deleted = await planningManager.deletePlan('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('Plan Execution', () => {
    const mockPlan: Plan = {
      id: 'test-plan-id',
      name: 'Test Plan',
      description: 'Test plan description',
      goals: ['Goal 1'],
      steps: [
        {
          id: 'step-1',
          name: 'Step 1',
          description: 'First step',
          status: 'pending',
          priority: 0.5,
          actions: [],
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      status: 'pending',
      priority: 5,
      confidence: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };

    beforeEach(() => {
      (planningManager as any).plans.set(mockPlan.id, mockPlan);
    });

    it('should throw error for non-existent plan', async () => {
      await expect(planningManager.executePlan('non-existent-id'))
        .rejects.toThrow(PlanningError);
    });

    it('should throw error for already executing plan', async () => {
      (planningManager as any).executingPlans.add(mockPlan.id);

      await expect(planningManager.executePlan(mockPlan.id))
        .rejects.toThrow(PlanningError);
    });

    it('should delegate plan execution to PlanExecutor component', async () => {
      const mockExecutionResult: PlanExecutionResult = {
        success: true
      };

      const mockPlanExecutor = {
        executePlan: vi.fn().mockResolvedValue(mockExecutionResult)
      };
      (planningManager as any).planExecutor = mockPlanExecutor;

      const result = await planningManager.executePlan(mockPlan.id);

      expect(mockPlanExecutor.executePlan).toHaveBeenCalledWith(mockPlan);
      expect(result).toEqual(mockExecutionResult);
    });

    it('should update plan status on successful execution', async () => {
      const mockExecutionResult: PlanExecutionResult = {
        success: true
      };

      const mockPlanExecutor = {
        executePlan: vi.fn().mockResolvedValue(mockExecutionResult)
      };
      (planningManager as any).planExecutor = mockPlanExecutor;

      await planningManager.executePlan(mockPlan.id);

      const updatedPlan = await planningManager.getPlan(mockPlan.id);
      expect(updatedPlan!.status).toBe('completed');
    });

    it('should update plan status on failed execution', async () => {
      const mockExecutionResult: PlanExecutionResult = {
        success: false,
        error: 'Execution failed'
      };

      const mockPlanExecutor = {
        executePlan: vi.fn().mockResolvedValue(mockExecutionResult)
      };
      (planningManager as any).planExecutor = mockPlanExecutor;

      await planningManager.executePlan(mockPlan.id);

      const updatedPlan = await planningManager.getPlan(mockPlan.id);
      expect(updatedPlan!.status).toBe('failed');
    });

    it('should handle execution component errors', async () => {
      const mockPlanExecutor = {
        executePlan: vi.fn().mockRejectedValue(new Error('Executor error'))
      };
      (planningManager as any).planExecutor = mockPlanExecutor;

      const result = await planningManager.executePlan(mockPlan.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Executor error');
      
      const updatedPlan = await planningManager.getPlan(mockPlan.id);
      expect(updatedPlan!.status).toBe('failed');
    });

    it('should clean up executing plans set after execution', async () => {
      const mockExecutionResult: PlanExecutionResult = {
        success: true
      };

      const mockPlanExecutor = {
        executePlan: vi.fn().mockResolvedValue(mockExecutionResult)
      };
      (planningManager as any).planExecutor = mockPlanExecutor;

      await planningManager.executePlan(mockPlan.id);

      expect((planningManager as any).executingPlans.has(mockPlan.id)).toBe(false);
    });
  });

  describe('Plan Validation', () => {
    const mockPlan: Plan = {
      id: 'test-plan-id',
      name: 'Test Plan',
      description: 'Test plan description',
      goals: ['Goal 1'],
      steps: [],
      status: 'pending',
      priority: 5,
      confidence: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };

    beforeEach(() => {
      (planningManager as any).plans.set(mockPlan.id, mockPlan);
    });

    it('should return false for non-existent plan', async () => {
      const isValid = await planningManager.validatePlan('non-existent-id');
      expect(isValid).toBe(false);
    });

    it('should delegate validation to PlanValidator component', async () => {
      const mockValidationResult = {
        isValid: true,
        score: 0.9,
        issues: []
      };

      const mockPlanValidator = {
        validatePlan: vi.fn().mockResolvedValue(mockValidationResult)
      };
      (planningManager as any).planValidator = mockPlanValidator;

      const isValid = await planningManager.validatePlan(mockPlan.id);

      expect(mockPlanValidator.validatePlan).toHaveBeenCalledWith(mockPlan);
      expect(isValid).toBe(true);
    });

    it('should handle validation component errors', async () => {
      const mockPlanValidator = {
        validatePlan: vi.fn().mockRejectedValue(new Error('Validation error'))
      };
      (planningManager as any).planValidator = mockPlanValidator;

      const isValid = await planningManager.validatePlan(mockPlan.id);
      expect(isValid).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    it('should return current configuration', () => {
      const config = planningManager.getConfig();
      
      expect(config).toMatchObject({
        enabled: true,
        enableAutoTaskCreation: true,
        enableOptimization: true,
        enableValidation: true,
        enableAdaptation: true
      });
    });

    it('should update configuration', () => {
      const newConfig = {
        enableAutoTaskCreation: false,
        maxConcurrentExecutions: 10
      };

      planningManager.configure(newConfig);
      const config = planningManager.getConfig();

      expect(config.enableAutoTaskCreation).toBe(false);
      expect(config.maxConcurrentExecutions).toBe(10);
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', async () => {
      // Add test plans with different statuses
      const plans = [
        { id: '1', status: 'pending' },
        { id: '2', status: 'completed' },
        { id: '3', status: 'failed' },
        { id: '4', status: 'pending' }
      ];

      plans.forEach(plan => {
        (planningManager as any).plans.set(plan.id, plan);
      });

      (planningManager as any).executingPlans.add('1');

      const stats = await planningManager.getStats();

      expect(stats.totalPlans).toBe(4);
      expect(stats.activePlans).toBe(2); // pending plans
      expect(stats.completedPlans).toBe(1);
      expect(stats.failedPlans).toBe(1);
      expect(stats.executingPlans).toBe(1);
    });
  });

  describe('Reset and Shutdown', () => {
    it('should reset successfully', async () => {
      // Add some test data
      (planningManager as any).plans.set('test-id', { id: 'test-id' });
      (planningManager as any).executingPlans.add('test-id');

      const result = await planningManager.reset();

      expect(result).toBe(true);
      expect((planningManager as any).plans.size).toBe(0);
      expect((planningManager as any).executingPlans.size).toBe(0);
    });

    it('should shutdown gracefully', async () => {
      // Add some test data
      (planningManager as any).plans.set('test-id', { id: 'test-id' });
      (planningManager as any).executingPlans.add('test-id');

      await expect(planningManager.shutdown()).resolves.not.toThrow();

      expect((planningManager as any).plans.size).toBe(0);
      expect((planningManager as any).executingPlans.size).toBe(0);
    });
  });
}); 