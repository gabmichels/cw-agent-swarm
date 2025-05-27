/**
 * Unit tests for ImprovementActionManager
 */

import { ImprovementActionManager, ActionManagementError } from './ImprovementActionManager';
import { ImprovementAction } from '../interfaces/ReflectionInterfaces';

describe('ImprovementActionManager', () => {
  let manager: ImprovementActionManager;

  beforeEach(() => {
    manager = new ImprovementActionManager();
  });

  afterEach(async () => {
    await manager.clear();
  });

  describe('createAction', () => {
    it('should create a valid improvement action', async () => {
      const actionData = {
        title: 'Improve error handling',
        description: 'Add better error handling to the planning system',
        sourceInsightId: 'insight-123',
        status: 'suggested' as const,
        priority: 'high' as const,
        targetArea: 'planning' as const,
        expectedImpact: 0.8,
        difficulty: 0.6,
        implementationSteps: [
          { description: 'Analyze current error patterns', status: 'pending' as const },
          { description: 'Design new error handling strategy', status: 'pending' as const }
        ]
      };

      const action = await manager.createAction(actionData);

      expect(action.id).toBeDefined();
      expect(action.title).toBe(actionData.title);
      expect(action.description).toBe(actionData.description);
      expect(action.sourceInsightId).toBe(actionData.sourceInsightId);
      expect(action.status).toBe(actionData.status);
      expect(action.priority).toBe(actionData.priority);
      expect(action.targetArea).toBe(actionData.targetArea);
      expect(action.expectedImpact).toBe(actionData.expectedImpact);
      expect(action.difficulty).toBe(actionData.difficulty);
      expect(action.createdAt).toBeInstanceOf(Date);
      expect(action.updatedAt).toBeInstanceOf(Date);
      expect(action.implementationSteps).toEqual(actionData.implementationSteps);
    });

    it('should throw error for invalid action data', async () => {
      const invalidAction = {
        title: '', // Empty title
        description: 'Valid description',
        sourceInsightId: 'insight-123',
        status: 'suggested' as const,
        priority: 'high' as const,
        targetArea: 'planning' as const,
        expectedImpact: 0.8,
        difficulty: 0.6,
        implementationSteps: []
      };

      await expect(manager.createAction(invalidAction)).rejects.toThrow(ActionManagementError);
    });

    it('should throw error when capacity is exceeded', async () => {
      const smallManager = new ImprovementActionManager({ maxActions: 1 });
      
      const actionData = {
        title: 'Test action',
        description: 'Test description',
        sourceInsightId: 'insight-123',
        status: 'suggested' as const,
        priority: 'medium' as const,
        targetArea: 'tools' as const,
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: []
      };

      // First action should succeed
      await smallManager.createAction(actionData);

      // Second action should fail
      await expect(smallManager.createAction(actionData)).rejects.toThrow(ActionManagementError);
    });

    it('should validate implementation steps', async () => {
      const actionWithInvalidSteps = {
        title: 'Test action',
        description: 'Test description',
        sourceInsightId: 'insight-123',
        status: 'suggested' as const,
        priority: 'medium' as const,
        targetArea: 'tools' as const,
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: [
          { description: '', status: 'pending' as const } // Empty description
        ]
      };

      await expect(manager.createAction(actionWithInvalidSteps)).rejects.toThrow(ActionManagementError);
    });
  });

  describe('getAction', () => {
    it('should return action by ID', async () => {
      const actionData = {
        title: 'Test action',
        description: 'Test description',
        sourceInsightId: 'insight-123',
        status: 'suggested' as const,
        priority: 'medium' as const,
        targetArea: 'tools' as const,
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: []
      };

      const createdAction = await manager.createAction(actionData);
      const retrievedAction = await manager.getAction(createdAction.id);

      expect(retrievedAction).toEqual(createdAction);
    });

    it('should return null for non-existent action', async () => {
      const result = await manager.getAction('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('updateAction', () => {
    let testAction: ImprovementAction;

    beforeEach(async () => {
      const actionData = {
        title: 'Test action',
        description: 'Test description',
        sourceInsightId: 'insight-123',
        status: 'suggested' as const,
        priority: 'medium' as const,
        targetArea: 'tools' as const,
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: []
      };
      testAction = await manager.createAction(actionData);
    });

    it('should update action successfully', async () => {
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updates = {
        title: 'Updated title',
        priority: 'high' as const,
        expectedImpact: 0.9
      };

      const updatedAction = await manager.updateAction(testAction.id, updates);

      expect(updatedAction.title).toBe(updates.title);
      expect(updatedAction.priority).toBe(updates.priority);
      expect(updatedAction.expectedImpact).toBe(updates.expectedImpact);
      expect(updatedAction.updatedAt.getTime()).toBeGreaterThan(testAction.updatedAt.getTime());
      expect(updatedAction.createdAt).toEqual(testAction.createdAt);
    });

    it('should throw error for non-existent action', async () => {
      await expect(manager.updateAction('non-existent-id', { title: 'New title' }))
        .rejects.toThrow(ActionManagementError);
    });

    it('should validate update data', async () => {
      const invalidUpdates = {
        expectedImpact: 1.5 // Invalid range
      };

      await expect(manager.updateAction(testAction.id, invalidUpdates))
        .rejects.toThrow(ActionManagementError);
    });
  });

  describe('listActions', () => {
    beforeEach(async () => {
      // Create test actions
      const actions = [
        {
          title: 'High priority action',
          description: 'Description 1',
          sourceInsightId: 'insight-1',
          status: 'suggested' as const,
          priority: 'high' as const,
          targetArea: 'planning' as const,
          expectedImpact: 0.9,
          difficulty: 0.7,
          implementationSteps: []
        },
        {
          title: 'Medium priority action',
          description: 'Description 2',
          sourceInsightId: 'insight-2',
          status: 'accepted' as const,
          priority: 'medium' as const,
          targetArea: 'tools' as const,
          expectedImpact: 0.6,
          difficulty: 0.4,
          implementationSteps: []
        },
        {
          title: 'Low priority action',
          description: 'Description 3',
          sourceInsightId: 'insight-3',
          status: 'completed' as const,
          priority: 'low' as const,
          targetArea: 'learning' as const,
          expectedImpact: 0.3,
          difficulty: 0.2,
          implementationSteps: []
        }
      ];

      for (const actionData of actions) {
        await manager.createAction(actionData);
      }
    });

    it('should return all actions without filters', async () => {
      const actions = await manager.listActions();
      expect(actions).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const actions = await manager.listActions({ status: ['suggested', 'accepted'] });
      expect(actions).toHaveLength(2);
      expect(actions.every(a => ['suggested', 'accepted'].includes(a.status))).toBe(true);
    });

    it('should filter by priority', async () => {
      const actions = await manager.listActions({ priority: ['high'] });
      expect(actions).toHaveLength(1);
      expect(actions[0].priority).toBe('high');
    });

    it('should filter by target area', async () => {
      const actions = await manager.listActions({ targetArea: ['planning', 'tools'] });
      expect(actions).toHaveLength(2);
      expect(actions.every(a => ['planning', 'tools'].includes(a.targetArea))).toBe(true);
    });

    it('should filter by minimum expected impact', async () => {
      const actions = await manager.listActions({ minExpectedImpact: 0.5 });
      expect(actions).toHaveLength(2);
      expect(actions.every(a => a.expectedImpact >= 0.5)).toBe(true);
    });

    it('should sort by priority descending', async () => {
      const actions = await manager.listActions({ 
        sortBy: 'priority', 
        sortDirection: 'desc' 
      });
      
      expect(actions[0].priority).toBe('high');
      expect(actions[1].priority).toBe('medium');
      expect(actions[2].priority).toBe('low');
    });

    it('should sort by expected impact ascending', async () => {
      const actions = await manager.listActions({ 
        sortBy: 'expectedImpact', 
        sortDirection: 'asc' 
      });
      
      expect(actions[0].expectedImpact).toBe(0.3);
      expect(actions[1].expectedImpact).toBe(0.6);
      expect(actions[2].expectedImpact).toBe(0.9);
    });

    it('should apply pagination', async () => {
      const firstPage = await manager.listActions({ limit: 2, offset: 0 });
      const secondPage = await manager.listActions({ limit: 2, offset: 2 });
      
      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(1);
      expect(firstPage[0].id).not.toBe(secondPage[0].id);
    });
  });

  describe('deleteAction', () => {
    it('should delete existing action', async () => {
      const actionData = {
        title: 'Test action',
        description: 'Test description',
        sourceInsightId: 'insight-123',
        status: 'suggested' as const,
        priority: 'medium' as const,
        targetArea: 'tools' as const,
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: []
      };

      const action = await manager.createAction(actionData);
      const deleted = await manager.deleteAction(action.id);
      
      expect(deleted).toBe(true);
      
      const retrievedAction = await manager.getAction(action.id);
      expect(retrievedAction).toBeNull();
    });

    it('should return false for non-existent action', async () => {
      const deleted = await manager.deleteAction('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('executeAction', () => {
    let testAction: ImprovementAction;

    beforeEach(async () => {
      const actionData = {
        title: 'Test action',
        description: 'Test description',
        sourceInsightId: 'insight-123',
        status: 'accepted' as const,
        priority: 'medium' as const,
        targetArea: 'tools' as const,
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: []
      };
      testAction = await manager.createAction(actionData);
    });

    it('should execute accepted action', async () => {
      const result = await manager.executeAction(testAction.id);
      expect(result).toBe(true);
      
      const updatedAction = await manager.getAction(testAction.id);
      expect(updatedAction?.status).toBe('in_progress');
    });

    it('should return false for non-existent action', async () => {
      const result = await manager.executeAction('non-existent-id');
      expect(result).toBe(false);
    });

    it('should throw error for action not in accepted status', async () => {
      await manager.updateAction(testAction.id, { status: 'suggested' });
      
      await expect(manager.executeAction(testAction.id))
        .rejects.toThrow(ActionManagementError);
    });
  });

  describe('getActionsByStatus', () => {
    beforeEach(async () => {
      const actions = [
        {
          title: 'Suggested action',
          description: 'Description 1',
          sourceInsightId: 'insight-1',
          status: 'suggested' as const,
          priority: 'high' as const,
          targetArea: 'planning' as const,
          expectedImpact: 0.9,
          difficulty: 0.7,
          implementationSteps: []
        },
        {
          title: 'Accepted action',
          description: 'Description 2',
          sourceInsightId: 'insight-2',
          status: 'accepted' as const,
          priority: 'medium' as const,
          targetArea: 'tools' as const,
          expectedImpact: 0.6,
          difficulty: 0.4,
          implementationSteps: []
        }
      ];

      for (const actionData of actions) {
        await manager.createAction(actionData);
      }
    });

    it('should return actions by status', async () => {
      const suggestedActions = await manager.getActionsByStatus('suggested');
      const acceptedActions = await manager.getActionsByStatus('accepted');
      
      expect(suggestedActions).toHaveLength(1);
      expect(acceptedActions).toHaveLength(1);
      expect(suggestedActions[0].status).toBe('suggested');
      expect(acceptedActions[0].status).toBe('accepted');
    });
  });

  describe('getActionsByPriority', () => {
    beforeEach(async () => {
      const actions = [
        {
          title: 'High priority action',
          description: 'Description 1',
          sourceInsightId: 'insight-1',
          status: 'suggested' as const,
          priority: 'high' as const,
          targetArea: 'planning' as const,
          expectedImpact: 0.9,
          difficulty: 0.7,
          implementationSteps: []
        },
        {
          title: 'Medium priority action',
          description: 'Description 2',
          sourceInsightId: 'insight-2',
          status: 'accepted' as const,
          priority: 'medium' as const,
          targetArea: 'tools' as const,
          expectedImpact: 0.6,
          difficulty: 0.4,
          implementationSteps: []
        }
      ];

      for (const actionData of actions) {
        await manager.createAction(actionData);
      }
    });

    it('should return actions by priority', async () => {
      const highPriorityActions = await manager.getActionsByPriority('high');
      const mediumPriorityActions = await manager.getActionsByPriority('medium');
      
      expect(highPriorityActions).toHaveLength(1);
      expect(mediumPriorityActions).toHaveLength(1);
      expect(highPriorityActions[0].priority).toBe('high');
      expect(mediumPriorityActions[0].priority).toBe('medium');
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      const actions = [
        {
          title: 'Action 1',
          description: 'Description 1',
          sourceInsightId: 'insight-1',
          status: 'suggested' as const,
          priority: 'high' as const,
          targetArea: 'planning' as const,
          expectedImpact: 0.8,
          difficulty: 0.6,
          implementationSteps: []
        },
        {
          title: 'Action 2',
          description: 'Description 2',
          sourceInsightId: 'insight-2',
          status: 'suggested' as const,
          priority: 'medium' as const,
          targetArea: 'tools' as const,
          expectedImpact: 0.6,
          difficulty: 0.4,
          implementationSteps: []
        },
        {
          title: 'Action 3',
          description: 'Description 3',
          sourceInsightId: 'insight-3',
          status: 'completed' as const,
          priority: 'low' as const,
          targetArea: 'planning' as const,
          expectedImpact: 0.4,
          difficulty: 0.2,
          implementationSteps: []
        }
      ];

      for (const actionData of actions) {
        await manager.createAction(actionData);
      }
    });

    it('should return comprehensive statistics', async () => {
      const stats = await manager.getStats();
      
      expect(stats.total).toBe(3);
      expect(stats.byStatus).toEqual({
        suggested: 2,
        completed: 1
      });
      expect(stats.byPriority).toEqual({
        high: 1,
        medium: 1,
        low: 1
      });
      expect(stats.byTargetArea).toEqual({
        planning: 2,
        tools: 1
      });
      expect(stats.averageExpectedImpact).toBeCloseTo(0.6);
      expect(stats.averageDifficulty).toBeCloseTo(0.4);
    });
  });

  describe('validation', () => {
    it('should validate required fields', async () => {
      const invalidActions = [
        {
          // Missing title
          description: 'Valid description',
          sourceInsightId: 'insight-123',
          status: 'suggested' as const,
          priority: 'medium' as const,
          targetArea: 'tools' as const,
          expectedImpact: 0.5,
          difficulty: 0.3,
          implementationSteps: []
        },
        {
          title: 'Valid title',
          // Missing description
          sourceInsightId: 'insight-123',
          status: 'suggested' as const,
          priority: 'medium' as const,
          targetArea: 'tools' as const,
          expectedImpact: 0.5,
          difficulty: 0.3,
          implementationSteps: []
        },
        {
          title: 'Valid title',
          description: 'Valid description',
          // Missing sourceInsightId
          status: 'suggested' as const,
          priority: 'medium' as const,
          targetArea: 'tools' as const,
          expectedImpact: 0.5,
          difficulty: 0.3,
          implementationSteps: []
        }
      ];

      for (const invalidAction of invalidActions) {
        await expect(manager.createAction(invalidAction as any))
          .rejects.toThrow(ActionManagementError);
      }
    });

    it('should validate enum values', async () => {
      const actionWithInvalidEnum = {
        title: 'Test action',
        description: 'Test description',
        sourceInsightId: 'insight-123',
        status: 'invalid-status' as any,
        priority: 'medium' as const,
        targetArea: 'tools' as const,
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: []
      };

      await expect(manager.createAction(actionWithInvalidEnum))
        .rejects.toThrow(ActionManagementError);
    });

    it('should validate numeric ranges', async () => {
      const actionWithInvalidRange = {
        title: 'Test action',
        description: 'Test description',
        sourceInsightId: 'insight-123',
        status: 'suggested' as const,
        priority: 'medium' as const,
        targetArea: 'tools' as const,
        expectedImpact: 1.5, // Invalid range
        difficulty: 0.3,
        implementationSteps: []
      };

      await expect(manager.createAction(actionWithInvalidRange))
        .rejects.toThrow(ActionManagementError);
    });
  });
}); 