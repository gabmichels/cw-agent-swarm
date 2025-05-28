/**
 * ImprovementPlanManager.test.ts
 * 
 * Comprehensive tests for the ImprovementPlanManager component.
 * Following @IMPLEMENTATION_GUIDELINES.md with test-driven development.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImprovementPlanManager } from './ImprovementPlanManager';
import { 
  SelfImprovementPlan, 
  ImprovementAreaType, 
  ImprovementPriority,
  ImprovementPlanError
} from '../interfaces/EnhancedReflectionInterfaces';

describe('ImprovementPlanManager', () => {
  let manager: ImprovementPlanManager;

  beforeEach(() => {
    manager = new ImprovementPlanManager();
  });

  afterEach(async () => {
    await manager.clear();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Constructor and Configuration
  // ============================================================================

  describe('Constructor and Configuration', () => {
    it('should create manager with default configuration', () => {
      expect(manager).toBeDefined();
      expect(manager.getStats().totalPlans).toBe(0);
    });

    it('should create manager with custom configuration', () => {
      const customManager = new ImprovementPlanManager({
        maxPlans: 50,
        enableAutoProgress: false,
        enableValidation: true
      });
      
      expect(customManager).toBeDefined();
      expect(customManager.getStats().totalPlans).toBe(0);
    });
  });

  // ============================================================================
  // Plan Creation
  // ============================================================================

  describe('Plan Creation', () => {
    it('should create a basic improvement plan', async () => {
      const planData = {
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000), // Tomorrow
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['accuracy'],
        successCriteria: ['Improved performance']
      };

      const plan = await manager.createPlan(planData);

      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('createdAt');
      expect(plan).toHaveProperty('updatedAt');
      expect(plan.name).toBe('Test Plan');
      expect(plan.description).toBe('A test improvement plan');
      expect(plan.targetAreas).toEqual([ImprovementAreaType.KNOWLEDGE]);
      expect(plan.status).toBe('active');
      expect(plan.priority).toBe(ImprovementPriority.MEDIUM);
      expect(plan.progress).toBe(0);
    });

    it('should create plan with multiple target areas', async () => {
      const planData = {
        name: 'Multi-Area Plan',
        description: 'Plan targeting multiple areas',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1', 'reflection-2'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL, ImprovementAreaType.BEHAVIOR],
        status: 'draft' as const,
        priority: ImprovementPriority.HIGH,
        progress: 0,
        successMetrics: ['accuracy', 'efficiency', 'quality'],
        successCriteria: ['Improved performance', 'Better outcomes']
      };

      const plan = await manager.createPlan(planData);

      expect(plan.targetAreas).toHaveLength(3);
      expect(plan.targetAreas).toContain(ImprovementAreaType.KNOWLEDGE);
      expect(plan.targetAreas).toContain(ImprovementAreaType.SKILL);
      expect(plan.targetAreas).toContain(ImprovementAreaType.BEHAVIOR);
      expect(plan.successMetrics).toHaveLength(3);
      expect(plan.successCriteria).toHaveLength(2);
    });

    it('should validate plan data before creation', async () => {
      const invalidPlanData = {
        name: '', // Invalid: empty name
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() - 86400000), // Invalid: end before start
        sourceReflectionIds: [],
        targetAreas: [],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: [],
        successCriteria: []
      };

      await expect(manager.createPlan(invalidPlanData)).rejects.toThrow(ImprovementPlanError);
    });

    it('should generate ULID for plan ID', async () => {
      const planData = {
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['accuracy'],
        successCriteria: ['Improved performance']
      };

      const plan = await manager.createPlan(planData);

      // ULID format: 26 characters, alphanumeric
      expect(plan.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('should set creation and update timestamps', async () => {
      const beforeCreation = new Date();
      
      const planData = {
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['accuracy'],
        successCriteria: ['Improved performance']
      };

      const plan = await manager.createPlan(planData);
      const afterCreation = new Date();

      expect(plan.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(plan.createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
      expect(plan.updatedAt.getTime()).toEqual(plan.createdAt.getTime());
    });
  });

  // ============================================================================
  // Plan Retrieval
  // ============================================================================

  describe('Plan Retrieval', () => {
    let testPlan: SelfImprovementPlan;

    beforeEach(async () => {
      const planData = {
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['accuracy'],
        successCriteria: ['Improved performance']
      };

      testPlan = await manager.createPlan(planData);
    });

    it('should retrieve existing plan by ID', async () => {
      const retrievedPlan = await manager.getPlan(testPlan.id);

      expect(retrievedPlan).not.toBeNull();
      expect(retrievedPlan!.id).toBe(testPlan.id);
      expect(retrievedPlan!.name).toBe(testPlan.name);
      expect(retrievedPlan!.description).toBe(testPlan.description);
    });

    it('should return null for non-existent plan', async () => {
      const retrievedPlan = await manager.getPlan('non-existent-id');

      expect(retrievedPlan).toBeNull();
    });

    it('should handle invalid plan ID format', async () => {
      const retrievedPlan = await manager.getPlan('');

      expect(retrievedPlan).toBeNull();
    });
  });

  // ============================================================================
  // Plan Updates
  // ============================================================================

  describe('Plan Updates', () => {
    let testPlan: SelfImprovementPlan;

    beforeEach(async () => {
      const planData = {
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['accuracy'],
        successCriteria: ['Improved performance']
      };

      testPlan = await manager.createPlan(planData);
    });

    it('should update plan name and description', async () => {
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updates = {
        name: 'Updated Plan Name',
        description: 'Updated description'
      };

      const updatedPlan = await manager.updatePlan(testPlan.id, updates);

      expect(updatedPlan.name).toBe('Updated Plan Name');
      expect(updatedPlan.description).toBe('Updated description');
      expect(updatedPlan.updatedAt.getTime()).toBeGreaterThan(testPlan.updatedAt.getTime());
    });

    it('should update plan status and priority', async () => {
      const updates = {
        status: 'paused' as const,
        priority: ImprovementPriority.HIGH
      };

      const updatedPlan = await manager.updatePlan(testPlan.id, updates);

      expect(updatedPlan.status).toBe('paused');
      expect(updatedPlan.priority).toBe(ImprovementPriority.HIGH);
    });

    it('should update plan progress', async () => {
      const updates = {
        progress: 0.5
      };

      const updatedPlan = await manager.updatePlan(testPlan.id, updates);

      expect(updatedPlan.progress).toBe(0.5);
    });

    it('should validate progress range (0-1)', async () => {
      const invalidUpdates = {
        progress: 1.5 // Invalid: > 1
      };

      await expect(manager.updatePlan(testPlan.id, invalidUpdates)).rejects.toThrow(ImprovementPlanError);
    });

    it('should throw error for non-existent plan', async () => {
      const updates = {
        name: 'Updated Name'
      };

      await expect(manager.updatePlan('non-existent-id', updates)).rejects.toThrow(ImprovementPlanError);
    });

    it('should not allow updating immutable fields', async () => {
      const updates = {
        id: 'new-id', // Should be ignored
        createdAt: new Date() // Should be ignored
      } as any;

      const updatedPlan = await manager.updatePlan(testPlan.id, updates);

      expect(updatedPlan.id).toBe(testPlan.id);
      expect(updatedPlan.createdAt.getTime()).toBe(testPlan.createdAt.getTime());
    });
  });

  // ============================================================================
  // Plan Listing and Filtering
  // ============================================================================

  describe('Plan Listing and Filtering', () => {
    beforeEach(async () => {
      // Create multiple test plans
      const plans = [
        {
          name: 'Knowledge Plan',
          description: 'Focus on knowledge',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          sourceReflectionIds: ['reflection-1'],
          targetAreas: [ImprovementAreaType.KNOWLEDGE],
          status: 'active' as const,
          priority: ImprovementPriority.HIGH,
          progress: 0.3,
          successMetrics: ['accuracy'],
          successCriteria: ['Improved performance']
        },
        {
          name: 'Skill Plan',
          description: 'Focus on skills',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          sourceReflectionIds: ['reflection-2'],
          targetAreas: [ImprovementAreaType.SKILL],
          status: 'paused' as const,
          priority: ImprovementPriority.MEDIUM,
          progress: 0.7,
          successMetrics: ['efficiency'],
          successCriteria: ['Better outcomes']
        },
        {
          name: 'Behavior Plan',
          description: 'Focus on behavior',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          sourceReflectionIds: ['reflection-3'],
          targetAreas: [ImprovementAreaType.BEHAVIOR],
          status: 'completed' as const,
          priority: ImprovementPriority.LOW,
          progress: 1.0,
          successMetrics: ['quality'],
          successCriteria: ['Consistent behavior']
        }
      ];

      for (const planData of plans) {
        await manager.createPlan(planData);
      }
    });

    it('should list all plans without filters', async () => {
      const plans = await manager.listPlans();

      expect(plans).toHaveLength(3);
    });

    it('should filter plans by status', async () => {
      const activePlans = await manager.listPlans({ status: ['active'] });
      const pausedPlans = await manager.listPlans({ status: ['paused'] });
      const completedPlans = await manager.listPlans({ status: ['completed'] });

      expect(activePlans).toHaveLength(1);
      expect(activePlans[0].name).toBe('Knowledge Plan');
      
      expect(pausedPlans).toHaveLength(1);
      expect(pausedPlans[0].name).toBe('Skill Plan');
      
      expect(completedPlans).toHaveLength(1);
      expect(completedPlans[0].name).toBe('Behavior Plan');
    });

    it('should filter plans by priority', async () => {
      const highPriorityPlans = await manager.listPlans({ priority: [ImprovementPriority.HIGH] });
      const mediumPriorityPlans = await manager.listPlans({ priority: [ImprovementPriority.MEDIUM] });

      expect(highPriorityPlans).toHaveLength(1);
      expect(highPriorityPlans[0].name).toBe('Knowledge Plan');
      
      expect(mediumPriorityPlans).toHaveLength(1);
      expect(mediumPriorityPlans[0].name).toBe('Skill Plan');
    });

    it('should filter plans by target area', async () => {
      const knowledgePlans = await manager.listPlans({ area: [ImprovementAreaType.KNOWLEDGE] });
      const skillPlans = await manager.listPlans({ area: [ImprovementAreaType.SKILL] });

      expect(knowledgePlans).toHaveLength(1);
      expect(knowledgePlans[0].name).toBe('Knowledge Plan');
      
      expect(skillPlans).toHaveLength(1);
      expect(skillPlans[0].name).toBe('Skill Plan');
    });

    it('should filter plans by progress range', async () => {
      const lowProgressPlans = await manager.listPlans({ minProgress: 0, maxProgress: 0.5 });
      const highProgressPlans = await manager.listPlans({ minProgress: 0.5 });

      expect(lowProgressPlans).toHaveLength(1);
      expect(lowProgressPlans[0].name).toBe('Knowledge Plan');
      
      expect(highProgressPlans).toHaveLength(2);
      expect(highProgressPlans.map((p: SelfImprovementPlan) => p.name)).toContain('Skill Plan');
      expect(highProgressPlans.map((p: SelfImprovementPlan) => p.name)).toContain('Behavior Plan');
    });

    it('should support pagination', async () => {
      const firstPage = await manager.listPlans({ limit: 2, offset: 0 });
      const secondPage = await manager.listPlans({ limit: 2, offset: 2 });

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(1);
    });

    it('should support sorting by creation date', async () => {
      const plansAsc = await manager.listPlans({ sortBy: 'createdAt', sortDirection: 'asc' });
      const plansDesc = await manager.listPlans({ sortBy: 'createdAt', sortDirection: 'desc' });

      expect(plansAsc).toHaveLength(3);
      expect(plansDesc).toHaveLength(3);
      expect(plansAsc[0].createdAt.getTime()).toBeLessThanOrEqual(plansAsc[1].createdAt.getTime());
      expect(plansDesc[0].createdAt.getTime()).toBeGreaterThanOrEqual(plansDesc[1].createdAt.getTime());
    });

    it('should support sorting by priority', async () => {
      const plansByPriority = await manager.listPlans({ sortBy: 'priority', sortDirection: 'desc' });

      expect(plansByPriority).toHaveLength(3);
      // High priority should come first
      expect(plansByPriority[0].priority).toBe(ImprovementPriority.HIGH);
    });
  });

  // ============================================================================
  // Plan Deletion
  // ============================================================================

  describe('Plan Deletion', () => {
    let testPlan: SelfImprovementPlan;

    beforeEach(async () => {
      const planData = {
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['accuracy'],
        successCriteria: ['Improved performance']
      };

      testPlan = await manager.createPlan(planData);
    });

    it('should delete existing plan', async () => {
      const deleted = await manager.deletePlan(testPlan.id);

      expect(deleted).toBe(true);
      
      const retrievedPlan = await manager.getPlan(testPlan.id);
      expect(retrievedPlan).toBeNull();
    });

    it('should return false for non-existent plan', async () => {
      const deleted = await manager.deletePlan('non-existent-id');

      expect(deleted).toBe(false);
    });
  });

  // ============================================================================
  // Progress Calculation
  // ============================================================================

  describe('Progress Calculation', () => {
    let testPlan: SelfImprovementPlan;

    beforeEach(async () => {
      const planData = {
        name: 'Test Plan',
        description: 'A test improvement plan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['accuracy'],
        successCriteria: ['Improved performance']
      };

      testPlan = await manager.createPlan(planData);
    });

    it('should calculate progress for plan without activities', async () => {
      const progress = await manager.calculateProgress(testPlan.id);

      expect(progress).toBe(0);
    });

    it('should throw error for non-existent plan', async () => {
      await expect(manager.calculateProgress('non-existent-id')).rejects.toThrow(ImprovementPlanError);
    });
  });

  // ============================================================================
  // Plan Generation from Reflections
  // ============================================================================

  describe('Plan Generation from Reflections', () => {
    it('should generate plan from reflection IDs', async () => {
      const reflectionIds = ['reflection-1', 'reflection-2', 'reflection-3'];
      const options = {
        priorityThreshold: ImprovementPriority.MEDIUM,
        maxImprovements: 5,
        focusAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL]
      };

      const plan = await manager.generatePlanFromReflections(reflectionIds, options);

      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('description');
      expect(plan.sourceReflectionIds).toEqual(reflectionIds);
      expect(plan.targetAreas.length).toBeGreaterThan(0);
      expect(plan.status).toBe('draft');
    });

    it('should generate plan with default options', async () => {
      const reflectionIds = ['reflection-1'];

      const plan = await manager.generatePlanFromReflections(reflectionIds);

      expect(plan).toHaveProperty('id');
      expect(plan.sourceReflectionIds).toEqual(reflectionIds);
    });

    it('should handle empty reflection IDs', async () => {
      await expect(manager.generatePlanFromReflections([])).rejects.toThrow(ImprovementPlanError);
    });
  });

  // ============================================================================
  // Statistics and State Management
  // ============================================================================

  describe('Statistics and State Management', () => {
    beforeEach(async () => {
      // Create test plans with different statuses and priorities
      const plans = [
        {
          name: 'Active High Priority',
          description: 'Test plan',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          sourceReflectionIds: ['reflection-1'],
          targetAreas: [ImprovementAreaType.KNOWLEDGE],
          status: 'active' as const,
          priority: ImprovementPriority.HIGH,
          progress: 0.3,
          successMetrics: ['accuracy'],
          successCriteria: ['Improved performance']
        },
        {
          name: 'Completed Medium Priority',
          description: 'Test plan',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          sourceReflectionIds: ['reflection-2'],
          targetAreas: [ImprovementAreaType.SKILL],
          status: 'completed' as const,
          priority: ImprovementPriority.MEDIUM,
          progress: 1.0,
          successMetrics: ['efficiency'],
          successCriteria: ['Better outcomes']
        }
      ];

      for (const planData of plans) {
        await manager.createPlan(planData);
      }
    });

    it('should provide comprehensive statistics', () => {
      const stats = manager.getStats();

      expect(stats.totalPlans).toBe(2);
      expect(stats.activePlans).toBe(1);
      expect(stats.completedPlans).toBe(1);
      expect(stats.averageProgress).toBe(0.65); // (0.3 + 1.0) / 2
      
      expect(stats.plansByPriority[ImprovementPriority.HIGH]).toBe(1);
      expect(stats.plansByPriority[ImprovementPriority.MEDIUM]).toBe(1);
      
      expect(stats.plansByArea[ImprovementAreaType.KNOWLEDGE]).toBe(1);
      expect(stats.plansByArea[ImprovementAreaType.SKILL]).toBe(1);
      
      expect(stats.plansByStatus['active']).toBe(1);
      expect(stats.plansByStatus['completed']).toBe(1);
    });

    it('should clear all data and reset state', async () => {
      await manager.clear();

      const stats = manager.getStats();
      expect(stats.totalPlans).toBe(0);
      expect(stats.activePlans).toBe(0);
      expect(stats.completedPlans).toBe(0);
      expect(stats.averageProgress).toBe(0);

      const plans = await manager.listPlans();
      expect(plans).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const invalidPlanData = {
        name: '',
        description: '',
        startDate: new Date(),
        endDate: new Date(Date.now() - 86400000), // End before start
        sourceReflectionIds: [],
        targetAreas: [],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: -1, // Invalid progress
        successMetrics: [],
        successCriteria: []
      };

      try {
        await manager.createPlan(invalidPlanData);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(ImprovementPlanError);
        expect((error as ImprovementPlanError).code).toBe('IMPROVEMENT_PLAN_VALIDATION_FAILED');
        expect((error as ImprovementPlanError).suggestions).toContain('Provide a valid plan name');
      }
    });

    it('should provide helpful error context', async () => {
      try {
        await manager.updatePlan('non-existent-id', { name: 'New Name' });
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(ImprovementPlanError);
        expect((error as ImprovementPlanError).context).toHaveProperty('planId', 'non-existent-id');
        expect((error as ImprovementPlanError).recoverable).toBe(true);
      }
    });
  });

  // ============================================================================
  // Edge Cases and Boundary Conditions
  // ============================================================================

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle large number of plans', async () => {
      const planPromises = [];
      for (let i = 0; i < 100; i++) {
        const planData = {
          name: `Plan ${i}`,
          description: `Test plan ${i}`,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          sourceReflectionIds: [`reflection-${i}`],
          targetAreas: [ImprovementAreaType.KNOWLEDGE],
          status: 'active' as const,
          priority: ImprovementPriority.MEDIUM,
          progress: i / 100,
          successMetrics: ['accuracy'],
          successCriteria: ['Improved performance']
        };
        planPromises.push(manager.createPlan(planData));
      }

      await Promise.all(planPromises);

      const stats = manager.getStats();
      expect(stats.totalPlans).toBe(100);

      const plans = await manager.listPlans({ limit: 10 });
      expect(plans).toHaveLength(10);
    });

    it('should handle concurrent operations', async () => {
      const planData = {
        name: 'Concurrent Test Plan',
        description: 'Test concurrent operations',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'active' as const,
        priority: ImprovementPriority.MEDIUM,
        progress: 0,
        successMetrics: ['accuracy'],
        successCriteria: ['Improved performance']
      };

      // Create multiple plans concurrently
      const createPromises = Array(10).fill(null).map((_, i) => 
        manager.createPlan({ ...planData, name: `Plan ${i}` })
      );

      const plans = await Promise.all(createPromises);

      expect(plans).toHaveLength(10);
      expect(new Set(plans.map((p: SelfImprovementPlan) => p.id)).size).toBe(10); // All IDs should be unique
    });

    it('should handle plans with minimal data', async () => {
      const minimalPlanData = {
        name: 'Minimal Plan',
        description: 'Minimal description',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        sourceReflectionIds: ['reflection-1'],
        targetAreas: [ImprovementAreaType.KNOWLEDGE],
        status: 'draft' as const,
        priority: ImprovementPriority.LOW,
        progress: 0,
        successMetrics: ['basic'],
        successCriteria: ['minimal']
      };

      const plan = await manager.createPlan(minimalPlanData);

      expect(plan).toHaveProperty('id');
      expect(plan.name).toBe('Minimal Plan');
      expect(plan.successMetrics).toHaveLength(1);
      expect(plan.successCriteria).toHaveLength(1);
    });
  });
}); 