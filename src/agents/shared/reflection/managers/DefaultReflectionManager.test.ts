/**
 * DefaultReflectionManager Tests
 * 
 * Comprehensive tests for the reflection system implementation
 * covering improvement actions and reflection strategies.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultReflectionManager } from './DefaultReflectionManager';
import { ReflectionTrigger } from '../../base/managers/ReflectionManager.interface';

// Mock agent
const mockAgent = {
  id: 'test-agent',
  name: 'Test Agent',
  getManager: vi.fn(),
  hasManager: vi.fn(),
  setManager: vi.fn()
} as any;

describe('DefaultReflectionManager', () => {
  let reflectionManager: DefaultReflectionManager;

  beforeEach(() => {
    reflectionManager = new DefaultReflectionManager(mockAgent, {
      enabled: true,
      reflectionDepth: 'standard'
    });
  });

  describe('Improvement Actions', () => {
    describe('createImprovementAction', () => {
      it('should create a valid improvement action', async () => {
        const actionData = {
          title: 'Improve error handling',
          description: 'Better error recovery mechanisms',
          targetArea: 'execution' as const,
          priority: 'high' as const,
          expectedImpact: 0.8,
          difficulty: 0.6,
          status: 'suggested' as const,
          sourceInsightId: 'insight-123',
          implementationSteps: [
            { description: 'Analyze current errors', status: 'pending' as const }
          ]
        };

        const action = await reflectionManager.createImprovementAction(actionData);

        expect(action.id).toBeTruthy();
        expect(action.title).toBe(actionData.title);
        expect(action.description).toBe(actionData.description);
        expect(action.targetArea).toBe(actionData.targetArea);
        expect(action.priority).toBe(actionData.priority);
        expect(action.expectedImpact).toBe(actionData.expectedImpact);
        expect(action.difficulty).toBe(actionData.difficulty);
        expect(action.status).toBe('suggested');
        expect(action.createdAt).toBeInstanceOf(Date);
        expect(action.updatedAt).toBeInstanceOf(Date);
        expect(action.implementationSteps).toEqual(actionData.implementationSteps);
      });

      it('should validate required fields', async () => {
        await expect(reflectionManager.createImprovementAction({
          title: '',
          description: 'Test description',
          targetArea: 'execution',
          priority: 'high',
          expectedImpact: 0.8,
          difficulty: 0.6,
          status: 'suggested',
          sourceInsightId: 'test-insight',
          implementationSteps: []
        })).rejects.toThrow('Action title is required');

        await expect(reflectionManager.createImprovementAction({
          title: 'Test title',
          description: '',
          targetArea: 'execution',
          priority: 'high',
          expectedImpact: 0.8,
          difficulty: 0.6,
          status: 'suggested',
          sourceInsightId: 'test-insight',
          implementationSteps: []
        })).rejects.toThrow('Action description is required');
      });

      it('should validate numeric fields', async () => {
        await expect(reflectionManager.createImprovementAction({
          title: 'Test title',
          description: 'Test description',
          targetArea: 'execution',
          priority: 'high',
          expectedImpact: 1.5, // Invalid: > 1
          difficulty: 0.6,
          status: 'suggested',
          sourceInsightId: 'test-insight',
          implementationSteps: []
        })).rejects.toThrow('Expected impact must be a number between 0 and 1');

        await expect(reflectionManager.createImprovementAction({
          title: 'Test title',
          description: 'Test description',
          targetArea: 'execution',
          priority: 'high',
          expectedImpact: 0.8,
          difficulty: -0.1, // Invalid: < 0
          status: 'suggested',
          sourceInsightId: 'test-insight',
          implementationSteps: []
        })).rejects.toThrow('Difficulty must be a number between 0 and 1');
      });
    });

    describe('getImprovementAction', () => {
      it('should retrieve an existing action', async () => {
        const actionData = {
          title: 'Test action',
          description: 'Test description',
          targetArea: 'execution' as const,
          priority: 'medium' as const,
          expectedImpact: 0.7,
          difficulty: 0.5,
          status: 'suggested' as const,
          sourceInsightId: 'test-insight',
          implementationSteps: []
        };

        const createdAction = await reflectionManager.createImprovementAction(actionData);
        const retrievedAction = await reflectionManager.getImprovementAction(createdAction.id);

        expect(retrievedAction).toEqual(createdAction);
      });

      it('should return null for non-existent action', async () => {
        const result = await reflectionManager.getImprovementAction('non-existent-id');
        expect(result).toBeNull();
      });

      it('should validate action ID', async () => {
        await expect(reflectionManager.getImprovementAction('')).rejects.toThrow('Action ID is required');
      });
    });

    describe('updateImprovementAction', () => {
      it('should update an existing action', async () => {
        const actionData = {
          title: 'Original title',
          description: 'Original description',
          targetArea: 'execution' as const,
          priority: 'medium' as const,
          expectedImpact: 0.7,
          difficulty: 0.5,
          status: 'suggested' as const,
          sourceInsightId: 'test-insight',
          implementationSteps: []
        };

        const createdAction = await reflectionManager.createImprovementAction(actionData);
        
        // Add a small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const updates = {
          title: 'Updated title',
          priority: 'high' as const,
          expectedImpact: 0.9
        };

        const updatedAction = await reflectionManager.updateImprovementAction(createdAction.id, updates);

        expect(updatedAction.id).toBe(createdAction.id);
        expect(updatedAction.title).toBe(updates.title);
        expect(updatedAction.priority).toBe(updates.priority);
        expect(updatedAction.expectedImpact).toBe(updates.expectedImpact);
        expect(updatedAction.description).toBe(actionData.description); // Unchanged
        expect(updatedAction.createdAt).toEqual(createdAction.createdAt); // Unchanged
        expect(updatedAction.updatedAt.getTime()).toBeGreaterThan(createdAction.updatedAt.getTime());
      });

      it('should validate updates', async () => {
        const actionData = {
          title: 'Test action',
          description: 'Test description',
          targetArea: 'execution' as const,
          priority: 'medium' as const,
          expectedImpact: 0.7,
          difficulty: 0.5,
          status: 'suggested' as const,
          sourceInsightId: 'test-insight',
          implementationSteps: []
        };

        const createdAction = await reflectionManager.createImprovementAction(actionData);

        await expect(reflectionManager.updateImprovementAction(createdAction.id, {
          title: ''
        })).rejects.toThrow('Action title cannot be empty');

        await expect(reflectionManager.updateImprovementAction(createdAction.id, {
          expectedImpact: 1.5
        })).rejects.toThrow('Expected impact must be a number between 0 and 1');
      });

      it('should handle non-existent action', async () => {
        await expect(reflectionManager.updateImprovementAction('non-existent', {
          title: 'New title'
        })).rejects.toThrow('Improvement action not found');
      });
    });

    describe('listImprovementActions', () => {
      beforeEach(async () => {
        // Create test actions
        await reflectionManager.createImprovementAction({
          title: 'High priority action',
          description: 'High priority description',
          targetArea: 'execution',
          priority: 'high',
          expectedImpact: 0.9,
          difficulty: 0.3,
          status: 'suggested',
          sourceInsightId: 'test-insight-1',
          implementationSteps: []
        });

        await reflectionManager.createImprovementAction({
          title: 'Medium priority action',
          description: 'Medium priority description',
          targetArea: 'planning',
          priority: 'medium',
          expectedImpact: 0.6,
          difficulty: 0.7,
          status: 'accepted',
          sourceInsightId: 'test-insight-2',
          implementationSteps: []
        });

        await reflectionManager.createImprovementAction({
          title: 'Low priority action',
          description: 'Low priority description',
          targetArea: 'execution',
          priority: 'low',
          expectedImpact: 0.3,
          difficulty: 0.2,
          status: 'completed',
          sourceInsightId: 'test-insight-3',
          implementationSteps: []
        });
      });

      it('should list all actions without filters', async () => {
        const actions = await reflectionManager.listImprovementActions();
        expect(actions).toHaveLength(3);
      });

      it('should filter by status', async () => {
        const suggestedActions = await reflectionManager.listImprovementActions({
          status: ['suggested']
        });
        expect(suggestedActions).toHaveLength(1);
        expect(suggestedActions[0].status).toBe('suggested');
      });

      it('should filter by target area', async () => {
        const executionActions = await reflectionManager.listImprovementActions({
          targetArea: ['execution']
        });
        expect(executionActions).toHaveLength(2);
        executionActions.forEach(action => {
          expect(action.targetArea).toBe('execution');
        });
      });

      it('should filter by priority', async () => {
        const highPriorityActions = await reflectionManager.listImprovementActions({
          priority: ['high']
        });
        expect(highPriorityActions).toHaveLength(1);
        expect(highPriorityActions[0].priority).toBe('high');
      });

      it('should filter by minimum expected impact', async () => {
        const highImpactActions = await reflectionManager.listImprovementActions({
          minExpectedImpact: 0.7
        });
        expect(highImpactActions).toHaveLength(1);
        expect(highImpactActions[0].expectedImpact).toBeGreaterThanOrEqual(0.7);
      });

      it('should sort by priority', async () => {
        const actions = await reflectionManager.listImprovementActions({
          sortBy: 'priority',
          sortDirection: 'desc'
        });
        
        expect(actions[0].priority).toBe('high');
        expect(actions[1].priority).toBe('medium');
        expect(actions[2].priority).toBe('low');
      });

      it('should sort by expected impact', async () => {
        const actions = await reflectionManager.listImprovementActions({
          sortBy: 'expectedImpact',
          sortDirection: 'desc'
        });
        
        expect(actions[0].expectedImpact).toBe(0.9);
        expect(actions[1].expectedImpact).toBe(0.6);
        expect(actions[2].expectedImpact).toBe(0.3);
      });

      it('should apply pagination', async () => {
        const firstPage = await reflectionManager.listImprovementActions({
          limit: 2,
          offset: 0
        });
        expect(firstPage).toHaveLength(2);

        const secondPage = await reflectionManager.listImprovementActions({
          limit: 2,
          offset: 2
        });
        expect(secondPage).toHaveLength(1);
      });
    });
  });

  describe('Reflection Strategies', () => {
    describe('registerReflectionStrategy', () => {
      it('should register a valid reflection strategy', async () => {
        const strategyData = {
          name: 'Error Analysis Strategy',
          description: 'Analyze errors for learning opportunities',
          triggers: [ReflectionTrigger.ERROR],
          enabled: true,
          priority: 0.8,
          queryTemplate: 'What can we learn from this error: {error}?',
          requiredContext: ['error', 'context'],
          focusAreas: ['error_handling', 'learning']
        };

        const strategy = await reflectionManager.registerReflectionStrategy(strategyData);

        expect(strategy.id).toBeTruthy();
        expect(strategy.name).toBe(strategyData.name);
        expect(strategy.description).toBe(strategyData.description);
        expect(strategy.triggers).toEqual(strategyData.triggers);
        expect(strategy.enabled).toBe(strategyData.enabled);
        expect(strategy.priority).toBe(strategyData.priority);
        expect(strategy.queryTemplate).toBe(strategyData.queryTemplate);
        expect(strategy.requiredContext).toEqual(strategyData.requiredContext);
        expect(strategy.focusAreas).toEqual(strategyData.focusAreas);
      });

      it('should validate required fields', async () => {
        await expect(reflectionManager.registerReflectionStrategy({
          name: '',
          description: 'Test description',
          triggers: [ReflectionTrigger.ERROR],
          enabled: true,
          priority: 0.5,
          queryTemplate: 'Test query'
        })).rejects.toThrow('Strategy name is required');

        await expect(reflectionManager.registerReflectionStrategy({
          name: 'Test strategy',
          description: '',
          triggers: [ReflectionTrigger.ERROR],
          enabled: true,
          priority: 0.5,
          queryTemplate: 'Test query'
        })).rejects.toThrow('Strategy description is required');

        await expect(reflectionManager.registerReflectionStrategy({
          name: 'Test strategy',
          description: 'Test description',
          triggers: [],
          enabled: true,
          priority: 0.5,
          queryTemplate: 'Test query'
        })).rejects.toThrow('At least one trigger is required');

        await expect(reflectionManager.registerReflectionStrategy({
          name: 'Test strategy',
          description: 'Test description',
          triggers: [ReflectionTrigger.ERROR],
          enabled: true,
          priority: 0.5,
          queryTemplate: ''
        })).rejects.toThrow('Query template is required');
      });

      it('should validate priority range', async () => {
        await expect(reflectionManager.registerReflectionStrategy({
          name: 'Test strategy',
          description: 'Test description',
          triggers: [ReflectionTrigger.ERROR],
          enabled: true,
          priority: 1.5, // Invalid: > 1
          queryTemplate: 'Test query'
        })).rejects.toThrow('Priority must be a number between 0 and 1');

        await expect(reflectionManager.registerReflectionStrategy({
          name: 'Test strategy',
          description: 'Test description',
          triggers: [ReflectionTrigger.ERROR],
          enabled: true,
          priority: -0.1, // Invalid: < 0
          queryTemplate: 'Test query'
        })).rejects.toThrow('Priority must be a number between 0 and 1');
      });

      it('should prevent duplicate strategy names', async () => {
        const strategyData = {
          name: 'Unique Strategy',
          description: 'Test description',
          triggers: [ReflectionTrigger.ERROR],
          enabled: true,
          priority: 0.5,
          queryTemplate: 'Test query'
        };

        await reflectionManager.registerReflectionStrategy(strategyData);

        await expect(reflectionManager.registerReflectionStrategy({
          ...strategyData,
          description: 'Different description'
        })).rejects.toThrow("Strategy with name 'Unique Strategy' already exists");
      });
    });

    describe('getReflectionStrategy', () => {
      it('should retrieve an existing strategy', async () => {
        const strategyData = {
          name: 'Test Strategy',
          description: 'Test description',
          triggers: [ReflectionTrigger.FEEDBACK],
          enabled: true,
          priority: 0.7,
          queryTemplate: 'What made this successful?'
        };

        const createdStrategy = await reflectionManager.registerReflectionStrategy(strategyData);
        const retrievedStrategy = await reflectionManager.getReflectionStrategy(createdStrategy.id);

        expect(retrievedStrategy).toEqual(createdStrategy);
      });

      it('should return null for non-existent strategy', async () => {
        const result = await reflectionManager.getReflectionStrategy('non-existent-id');
        expect(result).toBeNull();
      });
    });

    describe('updateReflectionStrategy', () => {
      it('should update an existing strategy', async () => {
        const strategyData = {
          name: 'Original Strategy',
          description: 'Original description',
          triggers: [ReflectionTrigger.ERROR],
          enabled: true,
          priority: 0.5,
          queryTemplate: 'Original query'
        };

        const createdStrategy = await reflectionManager.registerReflectionStrategy(strategyData);
        
        const updates = {
          name: 'Updated Strategy',
          priority: 0.9,
          enabled: false
        };

        const updatedStrategy = await reflectionManager.updateReflectionStrategy(createdStrategy.id, updates);

        expect(updatedStrategy.id).toBe(createdStrategy.id);
        expect(updatedStrategy.name).toBe(updates.name);
        expect(updatedStrategy.priority).toBe(updates.priority);
        expect(updatedStrategy.enabled).toBe(updates.enabled);
        expect(updatedStrategy.description).toBe(strategyData.description); // Unchanged
      });

      it('should prevent duplicate names when updating', async () => {
        await reflectionManager.registerReflectionStrategy({
          name: 'Strategy One',
          description: 'Description one',
          triggers: [ReflectionTrigger.ERROR],
          enabled: true,
          priority: 0.5,
          queryTemplate: 'Query one'
        });

        const strategy2 = await reflectionManager.registerReflectionStrategy({
          name: 'Strategy Two',
          description: 'Description two',
          triggers: [ReflectionTrigger.FEEDBACK],
          enabled: true,
          priority: 0.6,
          queryTemplate: 'Query two'
        });

        await expect(reflectionManager.updateReflectionStrategy(strategy2.id, {
          name: 'Strategy One'
        })).rejects.toThrow("Strategy with name 'Strategy One' already exists");
      });
    });

    describe('listReflectionStrategies', () => {
      beforeEach(async () => {
        await reflectionManager.registerReflectionStrategy({
          name: 'Error Strategy',
          description: 'Handle errors',
          triggers: [ReflectionTrigger.ERROR],
          enabled: true,
          priority: 0.9,
          queryTemplate: 'Error query'
        });

        await reflectionManager.registerReflectionStrategy({
          name: 'Feedback Strategy',
          description: 'Analyze feedback',
          triggers: [ReflectionTrigger.FEEDBACK],
          enabled: false,
          priority: 0.7,
          queryTemplate: 'Feedback query'
        });

        await reflectionManager.registerReflectionStrategy({
          name: 'Mixed Strategy',
          description: 'Handle multiple triggers',
          triggers: [ReflectionTrigger.ERROR, ReflectionTrigger.FEEDBACK],
          enabled: true,
          priority: 0.5,
          queryTemplate: 'Mixed query'
        });
      });

      it('should list all strategies without filters', async () => {
        const strategies = await reflectionManager.listReflectionStrategies();
        expect(strategies).toHaveLength(3);
      });

      it('should filter by trigger', async () => {
        const errorStrategies = await reflectionManager.listReflectionStrategies({
          trigger: [ReflectionTrigger.ERROR]
        });
        expect(errorStrategies).toHaveLength(2); // Error Strategy and Mixed Strategy
      });

      it('should filter by enabled status', async () => {
        const enabledStrategies = await reflectionManager.listReflectionStrategies({
          enabled: true
        });
        expect(enabledStrategies).toHaveLength(2);
        enabledStrategies.forEach(strategy => {
          expect(strategy.enabled).toBe(true);
        });
      });

      it('should sort by priority', async () => {
        const strategies = await reflectionManager.listReflectionStrategies({
          sortBy: 'priority',
          sortDirection: 'desc'
        });
        
        expect(strategies[0].priority).toBe(0.9);
        expect(strategies[1].priority).toBe(0.7);
        expect(strategies[2].priority).toBe(0.5);
      });

      it('should sort by name', async () => {
        const strategies = await reflectionManager.listReflectionStrategies({
          sortBy: 'name',
          sortDirection: 'asc'
        });
        
        expect(strategies[0].name).toBe('Error Strategy');
        expect(strategies[1].name).toBe('Feedback Strategy');
        expect(strategies[2].name).toBe('Mixed Strategy');
      });
    });

    describe('setReflectionStrategyEnabled', () => {
      it('should enable/disable a strategy', async () => {
        const strategy = await reflectionManager.registerReflectionStrategy({
          name: 'Test Strategy',
          description: 'Test description',
          triggers: [ReflectionTrigger.ERROR],
          enabled: true,
          priority: 0.5,
          queryTemplate: 'Test query'
        });

        // Disable the strategy
        const disabledStrategy = await reflectionManager.setReflectionStrategyEnabled(strategy.id, false);
        expect(disabledStrategy.enabled).toBe(false);

        // Enable the strategy
        const enabledStrategy = await reflectionManager.setReflectionStrategyEnabled(strategy.id, true);
        expect(enabledStrategy.enabled).toBe(true);
      });

      it('should handle non-existent strategy', async () => {
        await expect(reflectionManager.setReflectionStrategyEnabled('non-existent', true))
          .rejects.toThrow('Reflection strategy not found');
      });
    });
  });
}); 