/**
 * Unit tests for ReflectionStrategyManager
 */

import { ReflectionStrategyManager, StrategyManagementError } from './ReflectionStrategyManager';
import { ReflectionStrategy, ReflectionTrigger, ExecutionContext } from '../interfaces/ReflectionInterfaces';

describe('ReflectionStrategyManager', () => {
  let manager: ReflectionStrategyManager;

  beforeEach(() => {
    manager = new ReflectionStrategyManager();
  });

  afterEach(async () => {
    await manager.clear();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const stats = manager.getStats();
      const config = stats.config as Record<string, unknown>;
      
      expect(config.maxStrategies).toBe(50);
      expect(config.defaultPriority).toBe(5);
      expect(config.enablePerformanceTracking).toBe(true);
      expect(config.strategyTimeoutMs).toBe(30000);
      expect(config.maxExecutionHistory).toBe(1000);
      expect(config.autoDisableThreshold).toBe(0.3);
    });

    it('should initialize with custom configuration', () => {
      const customManager = new ReflectionStrategyManager({
        maxStrategies: 25,
        defaultPriority: 3,
        enablePerformanceTracking: false,
        strategyTimeoutMs: 15000,
        maxExecutionHistory: 500,
        autoDisableThreshold: 0.5
      });

      const stats = customManager.getStats();
      const config = stats.config as Record<string, unknown>;
      
      expect(config.maxStrategies).toBe(25);
      expect(config.defaultPriority).toBe(3);
      expect(config.enablePerformanceTracking).toBe(false);
      expect(config.strategyTimeoutMs).toBe(15000);
      expect(config.maxExecutionHistory).toBe(500);
      expect(config.autoDisableThreshold).toBe(0.5);
    });

    it('should register default strategies on initialization', () => {
      const stats = manager.getStats();
      expect(stats.totalStrategies).toBeGreaterThan(0);
      expect(stats.enabledStrategies).toBeGreaterThan(0);
    });
  });

  describe('registerStrategy', () => {
    it('should register a valid strategy successfully', async () => {
      const strategy = {
        name: 'Test Strategy',
        description: 'A test strategy for unit testing',
        trigger: 'error' as ReflectionTrigger,
        priority: 7,
        enabled: true,
        implementation: async (context: ExecutionContext) => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);

      expect(registered.id).toBeDefined();
      expect(registered.name).toBe(strategy.name);
      expect(registered.description).toBe(strategy.description);
      expect(registered.trigger).toBe(strategy.trigger);
      expect(registered.priority).toBe(strategy.priority);
      expect(registered.enabled).toBe(strategy.enabled);
      expect(registered.createdAt).toBeInstanceOf(Date);
      expect(registered.updatedAt).toBeInstanceOf(Date);
      expect(typeof registered.implementation).toBe('function');
    });

    it('should use default priority when not specified', async () => {
      const strategy = {
        name: 'Default Priority Strategy',
        description: 'Strategy without explicit priority',
        trigger: 'task_completion' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);
      expect(registered.priority).toBe(5); // Default priority
    });

    it('should enable strategy by default when not specified', async () => {
      const strategy = {
        name: 'Auto-enabled Strategy',
        description: 'Strategy without explicit enabled flag',
        trigger: 'learning_opportunity' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);
      expect(registered.enabled).toBe(true);
    });

    it('should throw error for invalid strategy name', async () => {
      const strategy = {
        name: '',
        description: 'Strategy with empty name',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await expect(manager.registerStrategy(strategy)).rejects.toThrow(StrategyManagementError);
    });

    it('should throw error for invalid strategy description', async () => {
      const strategy = {
        name: 'Valid Name',
        description: '',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await expect(manager.registerStrategy(strategy)).rejects.toThrow(StrategyManagementError);
    });

    it('should throw error for invalid trigger', async () => {
      const strategy = {
        name: 'Invalid Trigger Strategy',
        description: 'Strategy with invalid trigger',
        trigger: 'invalid_trigger' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await expect(manager.registerStrategy(strategy)).rejects.toThrow(StrategyManagementError);
    });

    it('should throw error for invalid priority', async () => {
      const strategy = {
        name: 'Invalid Priority Strategy',
        description: 'Strategy with invalid priority',
        trigger: 'error' as ReflectionTrigger,
        priority: 15, // Invalid - should be 1-10
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await expect(manager.registerStrategy(strategy)).rejects.toThrow(StrategyManagementError);
    });

    it('should throw error for missing implementation', async () => {
      const strategy = {
        name: 'No Implementation Strategy',
        description: 'Strategy without implementation',
        trigger: 'error' as ReflectionTrigger,
        implementation: undefined as any
      };

      await expect(manager.registerStrategy(strategy)).rejects.toThrow(StrategyManagementError);
    });

    it('should throw error when capacity is exceeded', async () => {
      const limitedManager = new ReflectionStrategyManager({ maxStrategies: 1 });
      
      // Clear default strategies first without re-registering them
      await limitedManager.clear(false);
      
      const strategy1 = {
        name: 'First Strategy',
        description: 'First strategy',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const strategy2 = {
        name: 'Second Strategy',
        description: 'Second strategy',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await limitedManager.registerStrategy(strategy1);
      await expect(limitedManager.registerStrategy(strategy2)).rejects.toThrow(StrategyManagementError);
    });
  });

  describe('getStrategy', () => {
    it('should return strategy by ID', async () => {
      const strategy = {
        name: 'Retrievable Strategy',
        description: 'Strategy for retrieval testing',
        trigger: 'performance_issue' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);
      const retrieved = await manager.getStrategy(registered.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(registered.id);
      expect(retrieved!.name).toBe(strategy.name);
    });

    it('should return null for non-existent strategy', async () => {
      const retrieved = await manager.getStrategy('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateStrategy', () => {
    it('should update strategy successfully', async () => {
      const strategy = {
        name: 'Updatable Strategy',
        description: 'Strategy for update testing',
        trigger: 'user_feedback' as ReflectionTrigger,
        priority: 5,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);
      
      // Add a small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updates = {
        name: 'Updated Strategy Name',
        description: 'Updated description',
        priority: 8
      };

      const updated = await manager.updateStrategy(registered.id, updates);

      expect(updated.id).toBe(registered.id);
      expect(updated.name).toBe(updates.name);
      expect(updated.description).toBe(updates.description);
      expect(updated.priority).toBe(updates.priority);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(registered.updatedAt.getTime());
    });

    it('should throw error for non-existent strategy', async () => {
      const updates = { name: 'Updated Name' };
      await expect(manager.updateStrategy('non-existent-id', updates)).rejects.toThrow(StrategyManagementError);
    });

    it('should validate updates', async () => {
      const strategy = {
        name: 'Validation Strategy',
        description: 'Strategy for validation testing',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);
      
      // Test that validation only happens when key fields are updated
      const validUpdates = { priority: 8 }; // Valid update
      const updated = await manager.updateStrategy(registered.id, validUpdates);
      expect(updated.priority).toBe(8);
      
      // Test invalid trigger update
      const invalidTriggerUpdates = { trigger: 'invalid_trigger' as ReflectionTrigger };
      await expect(manager.updateStrategy(registered.id, invalidTriggerUpdates)).rejects.toThrow(StrategyManagementError);
    });
  });

  describe('listStrategies', () => {
    beforeEach(async () => {
      // Clear default strategies for consistent testing
      await manager.clear(false);
      
      // Register test strategies
      const strategies = [
        {
          name: 'Error Strategy',
          description: 'Handles errors',
          trigger: 'error' as ReflectionTrigger,
          priority: 8,
          enabled: true
        },
        {
          name: 'Task Strategy',
          description: 'Handles task completion',
          trigger: 'task_completion' as ReflectionTrigger,
          priority: 6,
          enabled: true
        },
        {
          name: 'Disabled Strategy',
          description: 'Disabled strategy',
          trigger: 'learning_opportunity' as ReflectionTrigger,
          priority: 4,
          enabled: false
        }
      ];

      for (const strategy of strategies) {
        await manager.registerStrategy({
          ...strategy,
          implementation: async () => ({
            success: true,
            insights: [],
            metrics: {},
            errors: [],
            executionTime: 100
          })
        });
      }
    });

    it('should list all strategies by default', async () => {
      const strategies = await manager.listStrategies();
      expect(strategies.length).toBe(3);
    });

    it('should filter by trigger', async () => {
      const errorStrategies = await manager.listStrategies({
        trigger: ['error']
      });
      expect(errorStrategies.length).toBe(1);
      expect(errorStrategies[0].trigger).toBe('error');
    });

    it('should filter by enabled status', async () => {
      const enabledStrategies = await manager.listStrategies({
        enabled: true
      });
      expect(enabledStrategies.length).toBe(2);
      expect(enabledStrategies.every(s => s.enabled)).toBe(true);

      const disabledStrategies = await manager.listStrategies({
        enabled: false
      });
      expect(disabledStrategies.length).toBe(1);
      expect(disabledStrategies[0].enabled).toBe(false);
    });

    it('should sort by priority descending by default', async () => {
      const strategies = await manager.listStrategies();
      expect(strategies[0].priority!).toBeGreaterThanOrEqual(strategies[1].priority!);
      expect(strategies[1].priority!).toBeGreaterThanOrEqual(strategies[2].priority!);
    });

    it('should sort by priority ascending when specified', async () => {
      const strategies = await manager.listStrategies({
        sortBy: 'priority',
        sortDirection: 'asc'
      });
      expect(strategies[0].priority!).toBeLessThanOrEqual(strategies[1].priority!);
      expect(strategies[1].priority!).toBeLessThanOrEqual(strategies[2].priority!);
    });

    it('should sort by name', async () => {
      const strategies = await manager.listStrategies({
        sortBy: 'name',
        sortDirection: 'asc'
      });
      expect(strategies[0].name.localeCompare(strategies[1].name)).toBeLessThanOrEqual(0);
    });
  });

  describe('setStrategyEnabled', () => {
    it('should enable strategy', async () => {
      const strategy = {
        name: 'Toggle Strategy',
        description: 'Strategy for enable/disable testing',
        trigger: 'error' as ReflectionTrigger,
        enabled: false,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);
      expect(registered.enabled).toBe(false);

      // Add a small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const enabled = await manager.setStrategyEnabled(registered.id, true);
      expect(enabled.enabled).toBe(true);
      expect(enabled.updatedAt.getTime()).toBeGreaterThan(registered.updatedAt.getTime());
    });

    it('should disable strategy', async () => {
      const strategy = {
        name: 'Disable Strategy',
        description: 'Strategy for disable testing',
        trigger: 'error' as ReflectionTrigger,
        enabled: true,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);
      expect(registered.enabled).toBe(true);

      const disabled = await manager.setStrategyEnabled(registered.id, false);
      expect(disabled.enabled).toBe(false);
    });

    it('should throw error for non-existent strategy', async () => {
      await expect(manager.setStrategyEnabled('non-existent-id', true)).rejects.toThrow(StrategyManagementError);
    });
  });

  describe('selectStrategy', () => {
    beforeEach(async () => {
      await manager.clear(false);
      
      // Register test strategies with different priorities
      const strategies = [
        {
          name: 'High Priority Error Strategy',
          description: 'High priority error handling',
          trigger: 'error' as ReflectionTrigger,
          priority: 9,
          enabled: true
        },
        {
          name: 'Medium Priority Error Strategy',
          description: 'Medium priority error handling',
          trigger: 'error' as ReflectionTrigger,
          priority: 6,
          enabled: true
        },
        {
          name: 'Disabled Error Strategy',
          description: 'Disabled error handling',
          trigger: 'error' as ReflectionTrigger,
          priority: 10,
          enabled: false
        },
        {
          name: 'Quick Task Strategy',
          description: 'Quick task completion handling',
          trigger: 'task_completion' as ReflectionTrigger,
          priority: 7,
          enabled: true
        }
      ];

      for (const strategy of strategies) {
        await manager.registerStrategy({
          ...strategy,
          implementation: async () => ({
            success: true,
            insights: [],
            metrics: {},
            errors: [],
            executionTime: 100
          })
        });
      }
    });

    it('should select highest priority enabled strategy for trigger', async () => {
      const selected = await manager.selectStrategy('error', {});
      expect(selected).not.toBeNull();
      expect(selected!.trigger).toBe('error');
      expect(selected!.priority).toBe(9); // Highest priority enabled strategy
      expect(selected!.enabled).toBe(true);
    });

    it('should return null when no strategies match trigger', async () => {
      const selected = await manager.selectStrategy('performance_issue', {});
      expect(selected).toBeNull();
    });

    it('should return null when no enabled strategies match trigger', async () => {
      // Disable all error strategies
      const errorStrategies = await manager.listStrategies({ trigger: ['error'] });
      for (const strategy of errorStrategies) {
        await manager.setStrategyEnabled(strategy.id, false);
      }

      const selected = await manager.selectStrategy('error', {});
      expect(selected).toBeNull();
    });

    it('should boost score for quick strategies with high urgency context', async () => {
      const selected = await manager.selectStrategy('task_completion', { urgency: 'high' });
      expect(selected).not.toBeNull();
      expect(selected!.name).toContain('Quick');
    });
  });

  describe('evaluateStrategyPerformance', () => {
    it('should return zero metrics for strategy with no executions', async () => {
      const strategy = {
        name: 'Unexecuted Strategy',
        description: 'Strategy with no executions',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);
      const performance = await manager.evaluateStrategyPerformance(registered.id);

      expect(performance.executionCount).toBe(0);
      expect(performance.successRate).toBe(0);
      expect(performance.averageExecutionTime).toBe(0);
      expect(performance.effectiveness).toBe(0);
      expect(performance.lastExecuted).toEqual(registered.createdAt);
    });

    it('should calculate performance metrics correctly', async () => {
      const strategy = {
        name: 'Executed Strategy',
        description: 'Strategy with executions',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);

      // Record some executions
      await manager.recordExecution(registered.id, 'error', {}, 100, true);
      await manager.recordExecution(registered.id, 'error', {}, 200, true);
      await manager.recordExecution(registered.id, 'error', {}, 150, false);

      const performance = await manager.evaluateStrategyPerformance(registered.id);

      expect(performance.executionCount).toBe(3);
      expect(performance.successRate).toBe(2/3); // 2 successes out of 3
      expect(performance.averageExecutionTime).toBe(150); // (100 + 200 + 150) / 3
      expect(performance.effectiveness).toBeGreaterThan(0);
      expect(performance.lastExecuted).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent strategy', async () => {
      await expect(manager.evaluateStrategyPerformance('non-existent-id')).rejects.toThrow(StrategyManagementError);
    });

    it('should throw error when performance tracking is disabled', async () => {
      const noTrackingManager = new ReflectionStrategyManager({ enablePerformanceTracking: false });
      
      const strategy = {
        name: 'No Tracking Strategy',
        description: 'Strategy without performance tracking',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await noTrackingManager.registerStrategy(strategy);
      await expect(noTrackingManager.evaluateStrategyPerformance(registered.id)).rejects.toThrow(StrategyManagementError);
    });

    it('should auto-disable strategy with low success rate', async () => {
      const strategy = {
        name: 'Failing Strategy',
        description: 'Strategy that fails often',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);

      // Record many failed executions
      for (let i = 0; i < 6; i++) {
        await manager.recordExecution(registered.id, 'error', {}, 100, false);
      }

      const performance = await manager.evaluateStrategyPerformance(registered.id);
      expect(performance.successRate).toBe(0);

      // Strategy should be auto-disabled
      const updatedStrategy = await manager.getStrategy(registered.id);
      expect(updatedStrategy!.enabled).toBe(false);
    });
  });

  describe('recordExecution', () => {
    it('should record execution when performance tracking is enabled', async () => {
      const strategy = {
        name: 'Tracked Strategy',
        description: 'Strategy with execution tracking',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await manager.registerStrategy(strategy);

      await manager.recordExecution(registered.id, 'error', { test: true }, 150, true);

      const performance = await manager.evaluateStrategyPerformance(registered.id);
      expect(performance.executionCount).toBe(1);
      expect(performance.successRate).toBe(1);
      expect(performance.averageExecutionTime).toBe(150);
    });

    it('should not record execution when performance tracking is disabled', async () => {
      const noTrackingManager = new ReflectionStrategyManager({ enablePerformanceTracking: false });
      
      const strategy = {
        name: 'Untracked Strategy',
        description: 'Strategy without execution tracking',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await noTrackingManager.registerStrategy(strategy);

      // This should not throw an error, but also not record anything
      await noTrackingManager.recordExecution(registered.id, 'error', {}, 150, true);

      // Performance evaluation should throw since tracking is disabled
      await expect(noTrackingManager.evaluateStrategyPerformance(registered.id)).rejects.toThrow(StrategyManagementError);
    });

    it('should trim execution history when it exceeds max size', async () => {
      const limitedManager = new ReflectionStrategyManager({ maxExecutionHistory: 2 });
      
      const strategy = {
        name: 'History Limited Strategy',
        description: 'Strategy with limited history',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const registered = await limitedManager.registerStrategy(strategy);

      // Record more executions than the limit
      await limitedManager.recordExecution(registered.id, 'error', {}, 100, true);
      await limitedManager.recordExecution(registered.id, 'error', {}, 200, true);
      await limitedManager.recordExecution(registered.id, 'error', {}, 300, true);

      const stats = limitedManager.getStats();
      expect(stats.executionHistorySize).toBe(2); // Should be trimmed to max size
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', async () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty('totalStrategies');
      expect(stats).toHaveProperty('enabledStrategies');
      expect(stats).toHaveProperty('disabledStrategies');
      expect(stats).toHaveProperty('triggerDistribution');
      expect(stats).toHaveProperty('performanceTrackingEnabled');
      expect(stats).toHaveProperty('executionHistorySize');
      expect(stats).toHaveProperty('config');

      expect(typeof stats.totalStrategies).toBe('number');
      expect(typeof stats.enabledStrategies).toBe('number');
      expect(typeof stats.disabledStrategies).toBe('number');
      expect(typeof stats.triggerDistribution).toBe('object');
      expect(typeof stats.performanceTrackingEnabled).toBe('boolean');
      expect(typeof stats.executionHistorySize).toBe('number');
    });

    it('should show correct trigger distribution', async () => {
      await manager.clear(false);
      
      const strategy1 = {
        name: 'Error Strategy',
        description: 'Error handling',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
      };

      const strategy2 = {
        name: 'Task Strategy',
        description: 'Task completion',
        trigger: 'task_completion' as ReflectionTrigger,
        implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
      };

      await manager.registerStrategy(strategy1);
      await manager.registerStrategy(strategy2);

      const stats = manager.getStats();
      const triggerDistribution = stats.triggerDistribution as Record<string, number>;
      
      expect(triggerDistribution.error).toBe(1);
      expect(triggerDistribution.task_completion).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all strategies and reset state', async () => {
      const strategy = {
        name: 'Clearable Strategy',
        description: 'Strategy to be cleared',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await manager.registerStrategy(strategy);
      
      let stats = manager.getStats();
      expect(stats.totalStrategies).toBeGreaterThan(0);

      await manager.clear();

      stats = manager.getStats();
      // Should have default strategies after clear
      expect(stats.totalStrategies).toBeGreaterThan(0);
      expect(stats.executionHistorySize).toBe(0);
    });
  });

  describe('default strategies', () => {
    it('should register error analysis strategy by default', async () => {
      const strategies = await manager.listStrategies({ trigger: ['error'] });
      const errorStrategy = strategies.find(s => s.name.includes('Error Analysis'));
      
      expect(errorStrategy).toBeDefined();
      expect(errorStrategy!.trigger).toBe('error');
      expect(errorStrategy!.enabled).toBe(true);
      expect(typeof errorStrategy!.implementation).toBe('function');
    });

    it('should register task completion strategy by default', async () => {
      const strategies = await manager.listStrategies({ trigger: ['task_completion'] });
      const taskStrategy = strategies.find(s => s.name.includes('Task Completion'));
      
      expect(taskStrategy).toBeDefined();
      expect(taskStrategy!.trigger).toBe('task_completion');
      expect(taskStrategy!.enabled).toBe(true);
      expect(typeof taskStrategy!.implementation).toBe('function');
    });

    it('should execute default strategies successfully', async () => {
      const strategies = await manager.listStrategies();
      const errorStrategy = strategies.find(s => s.trigger === 'error');
      
      expect(errorStrategy).toBeDefined();
      
      const context = {
        trigger: 'error' as ReflectionTrigger,
        data: { reflectionId: 'test-reflection' },
        environment: {},
        constraints: {}
      };

      const result = await errorStrategy!.implementation(context);
      
      expect(result.success).toBe(true);
      expect(result.insights).toBeInstanceOf(Array);
      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.errors).toBeInstanceOf(Array);
      expect(typeof result.executionTime).toBe('number');
    });
  });
}); 