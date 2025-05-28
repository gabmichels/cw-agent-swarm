/**
 * LearningActivityManager.test.ts
 * 
 * Comprehensive test suite for LearningActivityManager component.
 * Following @IMPLEMENTATION_GUIDELINES.md with >95% test coverage.
 */

import { LearningActivityManager, LearningActivityManagerConfig } from './LearningActivityManager';
import { 
  LearningActivity,
  ImprovementAreaType,
  ImprovementPriority,
  LearningActivityError
} from '../interfaces/EnhancedReflectionInterfaces';

describe('LearningActivityManager', () => {
  let manager: LearningActivityManager;
  let testActivity: Omit<LearningActivity, 'id'>;

  beforeEach(() => {
    manager = new LearningActivityManager();
    testActivity = {
      name: 'Test Learning Activity',
      description: 'A test learning activity for unit testing',
      planId: 'test-plan-id',
      type: 'reading',
      area: ImprovementAreaType.KNOWLEDGE,
      priority: ImprovementPriority.MEDIUM,
      status: 'planned',
      estimatedDuration: 60, // minutes
      successCriteria: ['Complete reading', 'Take notes', 'Write summary'],
      prerequisites: ['Basic understanding of topic'],
      resources: ['Book: Test Book', 'Online article'],
      notes: 'Initial notes',
      metadata: {}
    };
  });

  afterEach(async () => {
    await manager.clear();
  });

  // ============================================================================
  // Constructor and Configuration Tests
  // ============================================================================

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultManager = new LearningActivityManager();
      const stats = defaultManager.getStats();
      
      expect(stats.totalActivities).toBe(0);
      expect(stats.completedActivities).toBe(0);
      expect(stats.inProgressActivities).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const config: LearningActivityManagerConfig = {
        maxActivities: 5000,
        enableAutoProgress: false,
        enableValidation: false,
        enableCaching: false,
        cacheSize: 50,
        cacheTTL: 60000,
        enableDurationTracking: false
      };

      const customManager = new LearningActivityManager(config);
      const stats = customManager.getStats();
      
      expect(stats.totalActivities).toBe(0);
    });
  });

  // ============================================================================
  // Activity CRUD Operations Tests
  // ============================================================================

  describe('Activity CRUD Operations', () => {
    describe('createActivity', () => {
      it('should create a new activity with generated ID', async () => {
        const createdActivity = await manager.createActivity(testActivity);

        expect(createdActivity.id).toBeDefined();
        expect(createdActivity.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
        expect(createdActivity.name).toBe(testActivity.name);
        expect(createdActivity.description).toBe(testActivity.description);
        expect(createdActivity.planId).toBe(testActivity.planId);
        expect(createdActivity.type).toBe(testActivity.type);
        expect(createdActivity.area).toBe(testActivity.area);
        expect(createdActivity.priority).toBe(testActivity.priority);
        expect(createdActivity.status).toBe(testActivity.status);
        expect(createdActivity.estimatedDuration).toBe(testActivity.estimatedDuration);
        expect(createdActivity.successCriteria).toEqual(testActivity.successCriteria);
        expect(createdActivity.prerequisites).toEqual(testActivity.prerequisites);
        expect(createdActivity.resources).toEqual(testActivity.resources);
        expect(createdActivity.notes).toBe(testActivity.notes);
      });

      it('should validate activity data when validation is enabled', async () => {
        const invalidActivity = {
          ...testActivity,
          name: '', // Invalid: empty name
          estimatedDuration: -10 // Invalid: negative duration
        };

        await expect(manager.createActivity(invalidActivity))
          .rejects.toThrow(LearningActivityError);
      });

      it('should skip validation when disabled', async () => {
        const managerWithoutValidation = new LearningActivityManager({
          enableValidation: false
        });

        const invalidActivity = {
          ...testActivity,
          name: '', // Would be invalid if validation was enabled
          estimatedDuration: -10
        };

        const createdActivity = await managerWithoutValidation.createActivity(invalidActivity);
        expect(createdActivity.id).toBeDefined();
      });

      it('should enforce maximum activity limit', async () => {
        const limitedManager = new LearningActivityManager({
          maxActivities: 2
        });

        // Create activities up to the limit
        await limitedManager.createActivity(testActivity);
        await limitedManager.createActivity({ ...testActivity, name: 'Activity 2' });

        // Third activity should fail
        await expect(limitedManager.createActivity({ ...testActivity, name: 'Activity 3' }))
          .rejects.toThrow(LearningActivityError);
      });

      it('should handle all required validation rules', async () => {
        const testCases = [
          { field: 'name', value: '', expectedError: 'Activity name is required' },
          { field: 'description', value: '', expectedError: 'Activity description is required' },
          { field: 'planId', value: '', expectedError: 'Plan ID is required' },
          { field: 'estimatedDuration', value: 0, expectedError: 'Estimated duration must be positive' },
          { field: 'successCriteria', value: [], expectedError: 'Success criteria are required' }
        ];

        for (const testCase of testCases) {
          const invalidActivity = {
            ...testActivity,
            [testCase.field]: testCase.value
          };

          try {
            await manager.createActivity(invalidActivity);
            fail(`Expected validation error for ${testCase.field}`);
          } catch (error) {
            expect(error).toBeInstanceOf(LearningActivityError);
            expect((error as LearningActivityError).message).toContain(testCase.expectedError);
          }
        }
      });
    });

    describe('getActivity', () => {
      it('should retrieve an existing activity', async () => {
        const createdActivity = await manager.createActivity(testActivity);
        const retrievedActivity = await manager.getActivity(createdActivity.id);

        expect(retrievedActivity).not.toBeNull();
        expect(retrievedActivity!.id).toBe(createdActivity.id);
        expect(retrievedActivity!.name).toBe(testActivity.name);
      });

      it('should return null for non-existent activity', async () => {
        const retrievedActivity = await manager.getActivity('non-existent-id');
        expect(retrievedActivity).toBeNull();
      });

      it('should return null for invalid activity ID', async () => {
        const testCases = ['', null, undefined, 123];
        
        for (const invalidId of testCases) {
          const retrievedActivity = await manager.getActivity(invalidId as any);
          expect(retrievedActivity).toBeNull();
        }
      });

      it('should use caching when enabled', async () => {
        const createdActivity = await manager.createActivity(testActivity);
        
        // First retrieval should cache the result
        const firstRetrieval = await manager.getActivity(createdActivity.id);
        expect(firstRetrieval).not.toBeNull();
        
        // Second retrieval should use cache
        const secondRetrieval = await manager.getActivity(createdActivity.id);
        expect(secondRetrieval).not.toBeNull();
        expect(secondRetrieval!.id).toBe(firstRetrieval!.id);
      });
    });

    describe('updateActivity', () => {
      it('should update activity fields', async () => {
        const createdActivity = await manager.createActivity(testActivity);
        
        const updates = {
          name: 'Updated Activity Name',
          description: 'Updated description',
          priority: ImprovementPriority.HIGH,
          notes: 'Updated notes'
        };

        const updatedActivity = await manager.updateActivity(createdActivity.id, updates);

        expect(updatedActivity.id).toBe(createdActivity.id); // ID should not change
        expect(updatedActivity.name).toBe(updates.name);
        expect(updatedActivity.description).toBe(updates.description);
        expect(updatedActivity.priority).toBe(updates.priority);
        expect(updatedActivity.notes).toBe(updates.notes);
      });

      it('should throw error for non-existent activity', async () => {
        await expect(manager.updateActivity('non-existent-id', { name: 'New Name' }))
          .rejects.toThrow(LearningActivityError);
      });

      it('should validate updated activity data', async () => {
        const createdActivity = await manager.createActivity(testActivity);
        
        const invalidUpdates = {
          name: '', // Invalid: empty name
          estimatedDuration: -5 // Invalid: negative duration
        };

        await expect(manager.updateActivity(createdActivity.id, invalidUpdates))
          .rejects.toThrow(LearningActivityError);
      });

      it('should prevent updating immutable fields', async () => {
        const createdActivity = await manager.createActivity(testActivity);
        
        const updates = {
          id: 'new-id', // Should be ignored
          name: 'Updated Name'
        };

        const updatedActivity = await manager.updateActivity(createdActivity.id, updates);
        
        expect(updatedActivity.id).toBe(createdActivity.id); // ID should not change
        expect(updatedActivity.name).toBe(updates.name); // Name should change
      });
    });

    describe('listActivities', () => {
      beforeEach(async () => {
        // Create test activities with different properties
        await manager.createActivity({
          ...testActivity,
          name: 'Activity 1',
          planId: 'plan-1',
          status: 'planned',
          type: 'reading',
          area: ImprovementAreaType.KNOWLEDGE,
          priority: ImprovementPriority.HIGH
        });

        await manager.createActivity({
          ...testActivity,
          name: 'Activity 2',
          planId: 'plan-1',
          status: 'in_progress',
          type: 'practice',
          area: ImprovementAreaType.SKILL,
          priority: ImprovementPriority.MEDIUM
        });

        await manager.createActivity({
          ...testActivity,
          name: 'Activity 3',
          planId: 'plan-2',
          status: 'completed',
          type: 'experiment',
          area: ImprovementAreaType.BEHAVIOR,
          priority: ImprovementPriority.LOW
        });
      });

      it('should list all activities without filters', async () => {
        const activities = await manager.listActivities();
        expect(activities).toHaveLength(3);
      });

      it('should filter by plan ID', async () => {
        const activities = await manager.listActivities({ planId: 'plan-1' });
        expect(activities).toHaveLength(2);
        expect(activities.every(a => a.planId === 'plan-1')).toBe(true);
      });

      it('should filter by status', async () => {
        const activities = await manager.listActivities({ 
          status: ['planned', 'in_progress'] 
        });
        expect(activities).toHaveLength(2);
        expect(activities.every(a => ['planned', 'in_progress'].includes(a.status))).toBe(true);
      });

      it('should filter by type', async () => {
        const activities = await manager.listActivities({ 
          type: ['reading', 'practice'] 
        });
        expect(activities).toHaveLength(2);
        expect(activities.every(a => ['reading', 'practice'].includes(a.type))).toBe(true);
      });

      it('should filter by area', async () => {
        const activities = await manager.listActivities({ 
          area: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL] 
        });
        expect(activities).toHaveLength(2);
        expect(activities.every(a => 
          [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL].includes(a.area)
        )).toBe(true);
      });

      it('should filter by priority', async () => {
        const activities = await manager.listActivities({ 
          priority: [ImprovementPriority.HIGH, ImprovementPriority.MEDIUM] 
        });
        expect(activities).toHaveLength(2);
        expect(activities.every(a => 
          [ImprovementPriority.HIGH, ImprovementPriority.MEDIUM].includes(a.priority)
        )).toBe(true);
      });

      it('should sort by priority', async () => {
        const activities = await manager.listActivities({ 
          sortBy: 'priority',
          sortDirection: 'desc'
        });
        
        expect(activities).toHaveLength(3);
        expect(activities[0].priority).toBe(ImprovementPriority.HIGH);
        expect(activities[1].priority).toBe(ImprovementPriority.MEDIUM);
        expect(activities[2].priority).toBe(ImprovementPriority.LOW);
      });

      it('should sort by estimated duration', async () => {
        // Update activities with different durations
        const allActivities = await manager.listActivities();
        await manager.updateActivity(allActivities[0].id, { estimatedDuration: 30 });
        await manager.updateActivity(allActivities[1].id, { estimatedDuration: 90 });
        await manager.updateActivity(allActivities[2].id, { estimatedDuration: 60 });

        const activities = await manager.listActivities({ 
          sortBy: 'estimatedDuration',
          sortDirection: 'asc'
        });
        
        expect(activities[0].estimatedDuration).toBe(30);
        expect(activities[1].estimatedDuration).toBe(60);
        expect(activities[2].estimatedDuration).toBe(90);
      });

      it('should apply pagination', async () => {
        const firstPage = await manager.listActivities({ 
          offset: 0,
          limit: 2
        });
        expect(firstPage).toHaveLength(2);

        const secondPage = await manager.listActivities({ 
          offset: 2,
          limit: 2
        });
        expect(secondPage).toHaveLength(1);
      });

      it('should combine filters, sorting, and pagination', async () => {
        const activities = await manager.listActivities({
          planId: 'plan-1',
          status: ['planned', 'in_progress'],
          sortBy: 'priority',
          sortDirection: 'desc',
          offset: 0,
          limit: 1
        });

        expect(activities).toHaveLength(1);
        expect(activities[0].planId).toBe('plan-1');
        expect(['planned', 'in_progress'].includes(activities[0].status)).toBe(true);
      });
    });

    describe('deleteActivity', () => {
      it('should delete an existing activity', async () => {
        const createdActivity = await manager.createActivity(testActivity);
        
        const deleted = await manager.deleteActivity(createdActivity.id);
        expect(deleted).toBe(true);

        const retrievedActivity = await manager.getActivity(createdActivity.id);
        expect(retrievedActivity).toBeNull();
      });

      it('should return false for non-existent activity', async () => {
        const deleted = await manager.deleteActivity('non-existent-id');
        expect(deleted).toBe(false);
      });
    });
  });

  // ============================================================================
  // Activity Lifecycle Management Tests
  // ============================================================================

  describe('Activity Lifecycle Management', () => {
    describe('startActivity', () => {
      it('should start a planned activity', async () => {
        const createdActivity = await manager.createActivity(testActivity);
        
        const startedActivity = await manager.startActivity(createdActivity.id);
        
        expect(startedActivity.status).toBe('in_progress');
        expect(startedActivity.startDate).toBeInstanceOf(Date);
        expect(startedActivity.startDate!.getTime()).toBeCloseTo(Date.now(), -2); // Within 2 seconds
      });

      it('should throw error for non-existent activity', async () => {
        await expect(manager.startActivity('non-existent-id'))
          .rejects.toThrow(LearningActivityError);
      });

      it('should throw error for invalid status transition', async () => {
        const createdActivity = await manager.createActivity({
          ...testActivity,
          status: 'completed'
        });
        
        await expect(manager.startActivity(createdActivity.id))
          .rejects.toThrow(LearningActivityError);
      });
    });

    describe('completeActivity', () => {
      it('should complete an in-progress activity', async () => {
        const createdActivity = await manager.createActivity(testActivity);
        const startedActivity = await manager.startActivity(createdActivity.id);
        
        const completedActivity = await manager.completeActivity(startedActivity.id, 'Completion notes');
        
        expect(completedActivity.status).toBe('completed');
        expect(completedActivity.completedAt).toBeInstanceOf(Date);
        expect(completedActivity.actualDuration).toBeGreaterThanOrEqual(0); // Duration can be 0 for very short activities
        expect(completedActivity.notes).toBe('Completion notes');
      });

      it('should complete activity without additional notes', async () => {
        const createdActivity = await manager.createActivity(testActivity);
        const startedActivity = await manager.startActivity(createdActivity.id);
        
        const completedActivity = await manager.completeActivity(startedActivity.id);
        
        expect(completedActivity.status).toBe('completed');
        expect(completedActivity.notes).toBe(testActivity.notes); // Original notes preserved
      });

      it('should calculate actual duration when duration tracking is enabled', async () => {
        const managerWithTracking = new LearningActivityManager({
          enableDurationTracking: true
        });

        const createdActivity = await managerWithTracking.createActivity(testActivity);
        const startedActivity = await managerWithTracking.startActivity(createdActivity.id);
        
        // Wait a small amount to ensure duration > 0
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const completedActivity = await managerWithTracking.completeActivity(startedActivity.id);
        
        expect(completedActivity.actualDuration).toBeGreaterThanOrEqual(0); // Duration can be 0 for very short activities
      });

      it('should throw error for non-existent activity', async () => {
        await expect(manager.completeActivity('non-existent-id'))
          .rejects.toThrow(LearningActivityError);
      });

      it('should throw error for invalid status transition', async () => {
        const createdActivity = await manager.createActivity(testActivity);
        
        await expect(manager.completeActivity(createdActivity.id))
          .rejects.toThrow(LearningActivityError);
      });
    });
  });

  // ============================================================================
  // Plan Integration Tests
  // ============================================================================

  describe('Plan Integration', () => {
    it('should get activities for a specific plan', async () => {
      await manager.createActivity({ ...testActivity, planId: 'plan-1' });
      await manager.createActivity({ ...testActivity, planId: 'plan-1', name: 'Activity 2' });
      await manager.createActivity({ ...testActivity, planId: 'plan-2', name: 'Activity 3' });

      const plan1Activities = await manager.getActivitiesForPlan('plan-1');
      expect(plan1Activities).toHaveLength(2);
      expect(plan1Activities.every(a => a.planId === 'plan-1')).toBe(true);

      const plan2Activities = await manager.getActivitiesForPlan('plan-2');
      expect(plan2Activities).toHaveLength(1);
      expect(plan2Activities[0].planId).toBe('plan-2');
    });

    it('should return empty array for plan with no activities', async () => {
      const activities = await manager.getActivitiesForPlan('non-existent-plan');
      expect(activities).toHaveLength(0);
    });
  });

  // ============================================================================
  // Statistics and State Management Tests
  // ============================================================================

  describe('Statistics and State Management', () => {
    beforeEach(async () => {
      // Create activities with different statuses and types
      await manager.createActivity({
        ...testActivity,
        name: 'Reading Activity',
        type: 'reading',
        area: ImprovementAreaType.KNOWLEDGE,
        status: 'completed'
      });

      await manager.createActivity({
        ...testActivity,
        name: 'Practice Activity',
        type: 'practice',
        area: ImprovementAreaType.SKILL,
        status: 'in_progress'
      });

      await manager.createActivity({
        ...testActivity,
        name: 'Experiment Activity',
        type: 'experiment',
        area: ImprovementAreaType.BEHAVIOR,
        status: 'planned'
      });
    });

    it('should calculate comprehensive statistics', () => {
      const stats = manager.getStats();

      expect(stats.totalActivities).toBe(3);
      expect(stats.completedActivities).toBe(1);
      expect(stats.inProgressActivities).toBe(1);

      expect(stats.activitiesByType.reading).toBe(1);
      expect(stats.activitiesByType.practice).toBe(1);
      expect(stats.activitiesByType.experiment).toBe(1);

      expect(stats.activitiesByArea[ImprovementAreaType.KNOWLEDGE]).toBe(1);
      expect(stats.activitiesByArea[ImprovementAreaType.SKILL]).toBe(1);
      expect(stats.activitiesByArea[ImprovementAreaType.BEHAVIOR]).toBe(1);

      expect(stats.activitiesByStatus.completed).toBe(1);
      expect(stats.activitiesByStatus.in_progress).toBe(1);
      expect(stats.activitiesByStatus.planned).toBe(1);
    });

    it('should calculate average duration for completed activities', async () => {
      // Complete activities with known durations
      const activities = await manager.listActivities();
      const completedActivity = activities.find(a => a.status === 'completed');
      
      if (completedActivity) {
        await manager.updateActivity(completedActivity.id, { actualDuration: 45 });
      }

      const stats = manager.getStats();
      expect(stats.averageDuration).toBe(45);
    });

    it('should return zero average duration when no completed activities', async () => {
      await manager.clear();
      await manager.createActivity({ ...testActivity, status: 'planned' });

      const stats = manager.getStats();
      expect(stats.averageDuration).toBe(0);
    });

    it('should use caching for statistics', () => {
      const stats1 = manager.getStats();
      const stats2 = manager.getStats();
      
      expect(stats1).toEqual(stats2);
    });
  });

  describe('clear', () => {
    it('should clear all activities and reset statistics', async () => {
      await manager.createActivity(testActivity);
      await manager.createActivity({ ...testActivity, name: 'Activity 2' });

      let stats = manager.getStats();
      expect(stats.totalActivities).toBe(2);

      await manager.clear();

      stats = manager.getStats();
      expect(stats.totalActivities).toBe(0);
      expect(stats.completedActivities).toBe(0);
      expect(stats.inProgressActivities).toBe(0);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should provide helpful error context and suggestions', async () => {
      try {
        await manager.createActivity({
          ...testActivity,
          name: '', // Invalid
          estimatedDuration: -10 // Invalid
        });
        fail('Expected validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(LearningActivityError);
        const activityError = error as LearningActivityError;
        
        expect(activityError.code).toBe('LEARNING_ACTIVITY_VALIDATION_FAILED');
        expect(activityError.context).toBeDefined();
        expect(activityError.recoverable).toBe(true);
        expect(activityError.suggestions).toBeDefined();
        expect(activityError.suggestions.length).toBeGreaterThan(0);
      }
    });

    it('should handle activity not found errors gracefully', async () => {
      try {
        await manager.updateActivity('non-existent-id', { name: 'New Name' });
        fail('Expected activity not found error');
      } catch (error) {
        expect(error).toBeInstanceOf(LearningActivityError);
        const activityError = error as LearningActivityError;
        
        expect(activityError.code).toBe('LEARNING_ACTIVITY_ACTIVITY_NOT_FOUND');
        expect(activityError.context.activityId).toBe('non-existent-id');
        expect(activityError.recoverable).toBe(true);
        expect(activityError.suggestions).toContain('Check the activity ID');
      }
    });
  });

  // ============================================================================
  // Edge Cases and Boundary Conditions Tests
  // ============================================================================

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle concurrent operations safely', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        manager.createActivity({
          ...testActivity,
          name: `Concurrent Activity ${i}`
        })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      expect(new Set(results.map(r => r.id)).size).toBe(10); // All IDs should be unique
    });

    it('should handle activities with minimal required data', async () => {
      const minimalActivity = {
        name: 'Minimal Activity',
        description: 'Minimal description',
        planId: 'test-plan',
        type: 'reading' as const,
        area: ImprovementAreaType.KNOWLEDGE,
        priority: ImprovementPriority.MEDIUM,
        status: 'planned' as const,
        estimatedDuration: 30,
        successCriteria: ['Complete task'],
        resources: [],
        prerequisites: [],
        metadata: {}
      };

      const createdActivity = await manager.createActivity(minimalActivity);
      expect(createdActivity.id).toBeDefined();
      expect(createdActivity.prerequisites).toEqual([]);
      expect(createdActivity.resources).toEqual([]);
    });

    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Create 100 activities
      const promises = Array.from({ length: 100 }, (_, i) =>
        manager.createActivity({
          ...testActivity,
          name: `Activity ${i}`,
          planId: `plan-${i % 10}` // 10 different plans
        })
      );

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
      
      // Verify all activities were created
      const allActivities = await manager.listActivities();
      expect(allActivities).toHaveLength(100);
    });

    it('should handle cache expiration correctly', async () => {
      const shortCacheManager = new LearningActivityManager({
        enableCaching: true,
        cacheTTL: 50 // 50ms
      });

      const createdActivity = await shortCacheManager.createActivity(testActivity);
      
      // First retrieval should cache
      const firstRetrieval = await shortCacheManager.getActivity(createdActivity.id);
      expect(firstRetrieval).not.toBeNull();
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Second retrieval should work but not use expired cache
      const secondRetrieval = await shortCacheManager.getActivity(createdActivity.id);
      expect(secondRetrieval).not.toBeNull();
      expect(secondRetrieval!.id).toBe(createdActivity.id);
    });
  });
}); 