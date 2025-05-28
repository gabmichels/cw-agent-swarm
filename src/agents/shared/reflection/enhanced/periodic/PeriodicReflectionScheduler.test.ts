/**
 * PeriodicReflectionScheduler.test.ts
 * 
 * Comprehensive tests for the PeriodicReflectionScheduler component.
 * Following @IMPLEMENTATION_GUIDELINES.md with test-driven development.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PeriodicReflectionScheduler } from './PeriodicReflectionScheduler';
import { 
  PeriodicReflectionConfig,
  ReflectionSchedule,
  ScheduleFrequency,
  SchedulerError
} from '../interfaces/EnhancedReflectionInterfaces';

describe('PeriodicReflectionScheduler', () => {
  let scheduler: PeriodicReflectionScheduler;

  beforeEach(() => {
    scheduler = new PeriodicReflectionScheduler();
  });

  afterEach(async () => {
    await scheduler.stop();
    await scheduler.clear();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Constructor and Configuration
  // ============================================================================

  describe('Constructor and Configuration', () => {
    it('should create scheduler with default configuration', () => {
      expect(scheduler).toBeDefined();
      expect(scheduler.getStats().totalSchedules).toBe(0);
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should create scheduler with custom configuration', () => {
      const customScheduler = new PeriodicReflectionScheduler({
        maxSchedules: 50,
        enableAutoStart: false,
        defaultInterval: 3600000, // 1 hour
        enableLogging: true
      });
      
      expect(customScheduler).toBeDefined();
      expect(customScheduler.getStats().totalSchedules).toBe(0);
      expect(customScheduler.isRunning()).toBe(false);
    });
  });

  // ============================================================================
  // Schedule Creation
  // ============================================================================

  describe('Schedule Creation', () => {
    it('should create a basic reflection schedule', async () => {
      const scheduleConfig: PeriodicReflectionConfig = {
        name: 'Daily Performance Review',
        description: 'Daily reflection on performance metrics',
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000, // 24 hours
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: ['end_of_day'],
        analysisDepth: 'detailed'
      };

      const schedule = await scheduler.createSchedule(scheduleConfig);

      expect(schedule).toHaveProperty('id');
      expect(schedule).toHaveProperty('createdAt');
      expect(schedule).toHaveProperty('updatedAt');
      expect(schedule.name).toBe('Daily Performance Review');
      expect(schedule.frequency).toBe(ScheduleFrequency.DAILY);
      expect(schedule.enabled).toBe(true);
      expect(schedule.nextExecution).toBeInstanceOf(Date);
    });

    it('should create schedule with multiple trigger conditions', async () => {
      const scheduleConfig: PeriodicReflectionConfig = {
        name: 'Multi-Trigger Schedule',
        description: 'Schedule with multiple triggers',
        frequency: ScheduleFrequency.WEEKLY,
        interval: 604800000, // 7 days
        enabled: true,
        reflectionType: 'comprehensive',
        triggerConditions: ['end_of_week', 'milestone_reached', 'error_threshold'],
        analysisDepth: 'comprehensive'
      };

      const schedule = await scheduler.createSchedule(scheduleConfig);

      expect(schedule.triggerConditions).toHaveLength(3);
      expect(schedule.triggerConditions).toContain('end_of_week');
      expect(schedule.triggerConditions).toContain('milestone_reached');
      expect(schedule.triggerConditions).toContain('error_threshold');
    });

    it('should validate schedule configuration before creation', async () => {
      const invalidConfig: PeriodicReflectionConfig = {
        name: '', // Invalid: empty name
        description: 'Invalid schedule',
        frequency: ScheduleFrequency.DAILY,
        interval: -1000, // Invalid: negative interval
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: [],
        analysisDepth: 'basic'
      };

      await expect(scheduler.createSchedule(invalidConfig)).rejects.toThrow(SchedulerError);
    });

    it('should generate ULID for schedule ID', async () => {
      const scheduleConfig: PeriodicReflectionConfig = {
        name: 'Test Schedule',
        description: 'Test schedule for ID validation',
        frequency: ScheduleFrequency.HOURLY,
        interval: 3600000,
        enabled: true,
        reflectionType: 'quick',
        triggerConditions: ['hourly_check'],
        analysisDepth: 'basic'
      };

      const schedule = await scheduler.createSchedule(scheduleConfig);

      // ULID format: 26 characters, alphanumeric
      expect(schedule.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('should calculate next execution time correctly', async () => {
      const beforeCreation = new Date();
      
      const scheduleConfig: PeriodicReflectionConfig = {
        name: 'Timing Test Schedule',
        description: 'Test schedule timing',
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000,
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: ['daily_check'],
        analysisDepth: 'basic'
      };

      const schedule = await scheduler.createSchedule(scheduleConfig);
      const afterCreation = new Date();

      expect(schedule.nextExecution.getTime()).toBeGreaterThan(beforeCreation.getTime());
      expect(schedule.nextExecution.getTime()).toBeGreaterThan(afterCreation.getTime());
      
      // Should be approximately interval milliseconds from now
      const expectedTime = afterCreation.getTime() + scheduleConfig.interval;
      const timeDiff = Math.abs(schedule.nextExecution.getTime() - expectedTime);
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
  });

  // ============================================================================
  // Schedule Retrieval
  // ============================================================================

  describe('Schedule Retrieval', () => {
    let testSchedule: ReflectionSchedule;

    beforeEach(async () => {
      const scheduleConfig: PeriodicReflectionConfig = {
        name: 'Test Schedule',
        description: 'Test schedule for retrieval',
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000,
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: ['daily_check'],
        analysisDepth: 'basic'
      };

      testSchedule = await scheduler.createSchedule(scheduleConfig);
    });

    it('should retrieve existing schedule by ID', async () => {
      const retrievedSchedule = await scheduler.getSchedule(testSchedule.id);

      expect(retrievedSchedule).not.toBeNull();
      expect(retrievedSchedule!.id).toBe(testSchedule.id);
      expect(retrievedSchedule!.name).toBe(testSchedule.name);
      expect(retrievedSchedule!.description).toBe(testSchedule.description);
    });

    it('should return null for non-existent schedule', async () => {
      const retrievedSchedule = await scheduler.getSchedule('non-existent-id');

      expect(retrievedSchedule).toBeNull();
    });

    it('should handle invalid schedule ID format', async () => {
      const retrievedSchedule = await scheduler.getSchedule('');

      expect(retrievedSchedule).toBeNull();
    });
  });

  // ============================================================================
  // Schedule Updates
  // ============================================================================

  describe('Schedule Updates', () => {
    let testSchedule: ReflectionSchedule;

    beforeEach(async () => {
      const scheduleConfig: PeriodicReflectionConfig = {
        name: 'Test Schedule',
        description: 'Test schedule for updates',
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000,
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: ['daily_check'],
        analysisDepth: 'basic'
      };

      testSchedule = await scheduler.createSchedule(scheduleConfig);
    });

    it('should update schedule name and description', async () => {
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updates = {
        name: 'Updated Schedule Name',
        description: 'Updated description'
      };

      const updatedSchedule = await scheduler.updateSchedule(testSchedule.id, updates);

      expect(updatedSchedule.name).toBe('Updated Schedule Name');
      expect(updatedSchedule.description).toBe('Updated description');
      expect(updatedSchedule.updatedAt.getTime()).toBeGreaterThan(testSchedule.updatedAt.getTime());
    });

    it('should update schedule frequency and interval', async () => {
      const updates = {
        frequency: ScheduleFrequency.WEEKLY,
        interval: 604800000 // 7 days
      };

      const updatedSchedule = await scheduler.updateSchedule(testSchedule.id, updates);

      expect(updatedSchedule.frequency).toBe(ScheduleFrequency.WEEKLY);
      expect(updatedSchedule.interval).toBe(604800000);
      // Next execution should be recalculated
      expect(updatedSchedule.nextExecution.getTime()).not.toBe(testSchedule.nextExecution.getTime());
    });

    it('should enable and disable schedules', async () => {
      // Disable schedule
      const disabledSchedule = await scheduler.updateSchedule(testSchedule.id, { enabled: false });
      expect(disabledSchedule.enabled).toBe(false);

      // Enable schedule
      const enabledSchedule = await scheduler.updateSchedule(testSchedule.id, { enabled: true });
      expect(enabledSchedule.enabled).toBe(true);
    });

    it('should validate updates before applying', async () => {
      const invalidUpdates = {
        interval: -5000 // Invalid: negative interval
      };

      await expect(scheduler.updateSchedule(testSchedule.id, invalidUpdates)).rejects.toThrow(SchedulerError);
    });

    it('should throw error for non-existent schedule', async () => {
      const updates = {
        name: 'Updated Name'
      };

      await expect(scheduler.updateSchedule('non-existent-id', updates)).rejects.toThrow(SchedulerError);
    });

    it('should not allow updating immutable fields', async () => {
      const updates = {
        id: 'new-id', // Should be ignored
        createdAt: new Date() // Should be ignored
      } as any;

      const updatedSchedule = await scheduler.updateSchedule(testSchedule.id, updates);

      expect(updatedSchedule.id).toBe(testSchedule.id);
      expect(updatedSchedule.createdAt.getTime()).toBe(testSchedule.createdAt.getTime());
    });
  });

  // ============================================================================
  // Schedule Listing and Filtering
  // ============================================================================

  describe('Schedule Listing and Filtering', () => {
    beforeEach(async () => {
      // Create multiple test schedules
      const schedules = [
        {
          name: 'Daily Performance',
          description: 'Daily performance review',
          frequency: ScheduleFrequency.DAILY,
          interval: 86400000,
          enabled: true,
          reflectionType: 'performance',
          triggerConditions: ['daily_check'],
          analysisDepth: 'detailed'
        },
        {
          name: 'Weekly Summary',
          description: 'Weekly summary reflection',
          frequency: ScheduleFrequency.WEEKLY,
          interval: 604800000,
          enabled: false,
          reflectionType: 'comprehensive',
          triggerConditions: ['weekly_check'],
          analysisDepth: 'comprehensive'
        },
        {
          name: 'Hourly Quick Check',
          description: 'Quick hourly check',
          frequency: ScheduleFrequency.HOURLY,
          interval: 3600000,
          enabled: true,
          reflectionType: 'quick',
          triggerConditions: ['hourly_check'],
          analysisDepth: 'basic'
        }
      ];

      for (const scheduleConfig of schedules) {
        await scheduler.createSchedule(scheduleConfig as PeriodicReflectionConfig);
      }
    });

    it('should list all schedules without filters', async () => {
      const schedules = await scheduler.listSchedules();

      expect(schedules).toHaveLength(3);
    });

    it('should filter schedules by enabled status', async () => {
      const enabledSchedules = await scheduler.listSchedules({ enabled: true });
      const disabledSchedules = await scheduler.listSchedules({ enabled: false });

      expect(enabledSchedules).toHaveLength(2);
      expect(enabledSchedules.every(s => s.enabled)).toBe(true);
      
      expect(disabledSchedules).toHaveLength(1);
      expect(disabledSchedules.every(s => !s.enabled)).toBe(true);
    });

    it('should filter schedules by frequency', async () => {
      const dailySchedules = await scheduler.listSchedules({ frequency: [ScheduleFrequency.DAILY] });
      const weeklySchedules = await scheduler.listSchedules({ frequency: [ScheduleFrequency.WEEKLY] });

      expect(dailySchedules).toHaveLength(1);
      expect(dailySchedules[0].name).toBe('Daily Performance');
      
      expect(weeklySchedules).toHaveLength(1);
      expect(weeklySchedules[0].name).toBe('Weekly Summary');
    });

    it('should filter schedules by reflection type', async () => {
      const performanceSchedules = await scheduler.listSchedules({ reflectionType: ['performance'] });
      const quickSchedules = await scheduler.listSchedules({ reflectionType: ['quick'] });

      expect(performanceSchedules).toHaveLength(1);
      expect(performanceSchedules[0].name).toBe('Daily Performance');
      
      expect(quickSchedules).toHaveLength(1);
      expect(quickSchedules[0].name).toBe('Hourly Quick Check');
    });

    it('should support pagination', async () => {
      const firstPage = await scheduler.listSchedules({ limit: 2, offset: 0 });
      const secondPage = await scheduler.listSchedules({ limit: 2, offset: 2 });

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(1);
    });

    it('should support sorting by creation date', async () => {
      const schedulesAsc = await scheduler.listSchedules({ sortBy: 'createdAt', sortDirection: 'asc' });
      const schedulesDesc = await scheduler.listSchedules({ sortBy: 'createdAt', sortDirection: 'desc' });

      expect(schedulesAsc).toHaveLength(3);
      expect(schedulesDesc).toHaveLength(3);
      expect(schedulesAsc[0].createdAt.getTime()).toBeLessThanOrEqual(schedulesAsc[1].createdAt.getTime());
      expect(schedulesDesc[0].createdAt.getTime()).toBeGreaterThanOrEqual(schedulesDesc[1].createdAt.getTime());
    });

    it('should support sorting by next execution time', async () => {
      const schedulesByExecution = await scheduler.listSchedules({ sortBy: 'nextExecution', sortDirection: 'asc' });

      expect(schedulesByExecution).toHaveLength(3);
      // Hourly should be next (shortest interval)
      expect(schedulesByExecution[0].name).toBe('Hourly Quick Check');
    });
  });

  // ============================================================================
  // Schedule Deletion
  // ============================================================================

  describe('Schedule Deletion', () => {
    let testSchedule: ReflectionSchedule;

    beforeEach(async () => {
      const scheduleConfig: PeriodicReflectionConfig = {
        name: 'Test Schedule',
        description: 'Test schedule for deletion',
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000,
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: ['daily_check'],
        analysisDepth: 'basic'
      };

      testSchedule = await scheduler.createSchedule(scheduleConfig);
    });

    it('should delete existing schedule', async () => {
      const deleted = await scheduler.deleteSchedule(testSchedule.id);

      expect(deleted).toBe(true);
      
      const retrievedSchedule = await scheduler.getSchedule(testSchedule.id);
      expect(retrievedSchedule).toBeNull();
    });

    it('should return false for non-existent schedule', async () => {
      const deleted = await scheduler.deleteSchedule('non-existent-id');

      expect(deleted).toBe(false);
    });
  });

  // ============================================================================
  // Scheduler Control
  // ============================================================================

  describe('Scheduler Control', () => {
    beforeEach(async () => {
      // Create a test schedule
      const scheduleConfig: PeriodicReflectionConfig = {
        name: 'Test Schedule',
        description: 'Test schedule for control',
        frequency: ScheduleFrequency.DAILY,
        interval: 1000, // 1 second for testing
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: ['test_trigger'],
        analysisDepth: 'basic'
      };

      await scheduler.createSchedule(scheduleConfig);
    });

    it('should start and stop scheduler', async () => {
      expect(scheduler.isRunning()).toBe(false);

      await scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      await scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should not start if already running', async () => {
      await scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      // Should not throw error, but should remain running
      await scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      await scheduler.stop();
    });

    it('should handle stop when not running', async () => {
      expect(scheduler.isRunning()).toBe(false);

      // Should not throw error
      await scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });
  });

  // ============================================================================
  // Execution Tracking
  // ============================================================================

  describe('Execution Tracking', () => {
    let testSchedule: ReflectionSchedule;

    beforeEach(async () => {
      const scheduleConfig: PeriodicReflectionConfig = {
        name: 'Execution Test Schedule',
        description: 'Test schedule for execution tracking',
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000,
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: ['test_trigger'],
        analysisDepth: 'basic'
      };

      testSchedule = await scheduler.createSchedule(scheduleConfig);
    });

    it('should track successful execution', async () => {
      const executionResult = {
        scheduleId: testSchedule.id,
        executedAt: new Date(),
        success: true,
        reflectionId: 'test-reflection-id',
        duration: 1500,
        insights: ['Test insight 1', 'Test insight 2']
      };

      await scheduler.recordExecution(executionResult);

      const updatedSchedule = await scheduler.getSchedule(testSchedule.id);
      expect(updatedSchedule!.lastExecution).toEqual(executionResult.executedAt);
      expect(updatedSchedule!.executionCount).toBe(1);
      expect(updatedSchedule!.successCount).toBe(1);
    });

    it('should track failed execution', async () => {
      const executionResult = {
        scheduleId: testSchedule.id,
        executedAt: new Date(),
        success: false,
        error: 'Test error message',
        duration: 500
      };

      await scheduler.recordExecution(executionResult);

      const updatedSchedule = await scheduler.getSchedule(testSchedule.id);
      expect(updatedSchedule!.lastExecution).toEqual(executionResult.executedAt);
      expect(updatedSchedule!.executionCount).toBe(1);
      expect(updatedSchedule!.successCount).toBe(0);
    });

    it('should update next execution time after execution', async () => {
      const originalNextExecution = testSchedule.nextExecution;
      
      // Use a specific execution time that's different from the original next execution
      const executionTime = new Date(originalNextExecution.getTime() + 1000); // 1 second later
      
      const executionResult = {
        scheduleId: testSchedule.id,
        executedAt: executionTime,
        success: true,
        reflectionId: 'test-reflection-id',
        duration: 1000
      };

      await scheduler.recordExecution(executionResult);

      const updatedSchedule = await scheduler.getSchedule(testSchedule.id);
      // Next execution should be executionTime + interval
      const expectedNextExecution = new Date(executionTime.getTime() + testSchedule.interval);
      expect(updatedSchedule!.nextExecution.getTime()).toBe(expectedNextExecution.getTime());
    });

    it('should handle execution for non-existent schedule', async () => {
      const executionResult = {
        scheduleId: 'non-existent-id',
        executedAt: new Date(),
        success: true,
        reflectionId: 'test-reflection-id',
        duration: 1000
      };

      await expect(scheduler.recordExecution(executionResult)).rejects.toThrow(SchedulerError);
    });
  });

  // ============================================================================
  // Due Schedule Detection
  // ============================================================================

  describe('Due Schedule Detection', () => {
    beforeEach(async () => {
      // Create schedules with different execution times
      const now = new Date();
      
      // Past due schedule
      const pastDueConfig: PeriodicReflectionConfig = {
        name: 'Past Due Schedule',
        description: 'Schedule that is past due',
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000,
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: ['test_trigger'],
        analysisDepth: 'basic'
      };
      
      const pastDueSchedule = await scheduler.createSchedule(pastDueConfig);
      // Manually set next execution to past
      await scheduler.updateSchedule(pastDueSchedule.id, {
        nextExecution: new Date(now.getTime() - 3600000) // 1 hour ago
      } as any);

      // Future schedule
      const futureConfig: PeriodicReflectionConfig = {
        name: 'Future Schedule',
        description: 'Schedule for future execution',
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000,
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: ['test_trigger'],
        analysisDepth: 'basic'
      };
      
      await scheduler.createSchedule(futureConfig);
    });

    it('should identify due schedules', async () => {
      const dueSchedules = await scheduler.getDueSchedules();

      expect(dueSchedules).toHaveLength(1);
      expect(dueSchedules[0].name).toBe('Past Due Schedule');
    });

    it('should not include disabled schedules in due list', async () => {
      // Disable the past due schedule
      const schedules = await scheduler.listSchedules();
      const pastDueSchedule = schedules.find(s => s.name === 'Past Due Schedule');
      
      if (pastDueSchedule) {
        await scheduler.updateSchedule(pastDueSchedule.id, { enabled: false });
      }

      const dueSchedules = await scheduler.getDueSchedules();
      expect(dueSchedules).toHaveLength(0);
    });
  });

  // ============================================================================
  // Statistics and State Management
  // ============================================================================

  describe('Statistics and State Management', () => {
    beforeEach(async () => {
      // Create test schedules with different configurations
      const schedules = [
        {
          name: 'Active Daily',
          description: 'Active daily schedule',
          frequency: ScheduleFrequency.DAILY,
          interval: 86400000,
          enabled: true,
          reflectionType: 'performance',
          triggerConditions: ['daily_check'],
          analysisDepth: 'detailed'
        },
        {
          name: 'Disabled Weekly',
          description: 'Disabled weekly schedule',
          frequency: ScheduleFrequency.WEEKLY,
          interval: 604800000,
          enabled: false,
          reflectionType: 'comprehensive',
          triggerConditions: ['weekly_check'],
          analysisDepth: 'comprehensive'
        }
      ];

      for (const scheduleConfig of schedules) {
        await scheduler.createSchedule(scheduleConfig as PeriodicReflectionConfig);
      }
    });

    it('should provide comprehensive statistics', () => {
      const stats = scheduler.getStats();

      expect(stats.totalSchedules).toBe(2);
      expect(stats.activeSchedules).toBe(1);
      expect(stats.disabledSchedules).toBe(1);
      
      expect(stats.schedulesByFrequency[ScheduleFrequency.DAILY]).toBe(1);
      expect(stats.schedulesByFrequency[ScheduleFrequency.WEEKLY]).toBe(1);
      
      expect(stats.schedulesByType['performance']).toBe(1);
      expect(stats.schedulesByType['comprehensive']).toBe(1);
    });

    it('should clear all data and reset state', async () => {
      await scheduler.clear();

      const stats = scheduler.getStats();
      expect(stats.totalSchedules).toBe(0);
      expect(stats.activeSchedules).toBe(0);
      expect(stats.disabledSchedules).toBe(0);

      const schedules = await scheduler.listSchedules();
      expect(schedules).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const invalidConfig: PeriodicReflectionConfig = {
        name: '',
        description: '',
        frequency: ScheduleFrequency.DAILY,
        interval: -1000, // Invalid
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: [],
        analysisDepth: 'basic'
      };

      try {
        await scheduler.createSchedule(invalidConfig);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(SchedulerError);
        expect((error as SchedulerError).code).toBe('SCHEDULER_SCHEDULE_VALIDATION_FAILED');
        expect((error as SchedulerError).suggestions).toContain('Provide a valid schedule name');
      }
    });

    it('should provide helpful error context', async () => {
      try {
        await scheduler.updateSchedule('non-existent-id', { name: 'New Name' });
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(SchedulerError);
        expect((error as SchedulerError).context).toHaveProperty('scheduleId', 'non-existent-id');
        expect((error as SchedulerError).recoverable).toBe(true);
      }
    });
  });

  // ============================================================================
  // Edge Cases and Boundary Conditions
  // ============================================================================

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle large number of schedules', async () => {
      const schedulePromises = [];
      for (let i = 0; i < 100; i++) {
        const scheduleConfig: PeriodicReflectionConfig = {
          name: `Schedule ${i}`,
          description: `Test schedule ${i}`,
          frequency: ScheduleFrequency.DAILY,
          interval: 86400000,
          enabled: i % 2 === 0, // Alternate enabled/disabled
          reflectionType: 'performance',
          triggerConditions: [`trigger_${i}`],
          analysisDepth: 'basic'
        };
        schedulePromises.push(scheduler.createSchedule(scheduleConfig));
      }

      await Promise.all(schedulePromises);

      const stats = scheduler.getStats();
      expect(stats.totalSchedules).toBe(100);
      expect(stats.activeSchedules).toBe(50);
      expect(stats.disabledSchedules).toBe(50);

      const schedules = await scheduler.listSchedules({ limit: 10 });
      expect(schedules).toHaveLength(10);
    });

    it('should handle concurrent operations', async () => {
      const scheduleConfig: PeriodicReflectionConfig = {
        name: 'Concurrent Test Schedule',
        description: 'Test concurrent operations',
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000,
        enabled: true,
        reflectionType: 'performance',
        triggerConditions: ['test_trigger'],
        analysisDepth: 'basic'
      };

      // Create multiple schedules concurrently
      const createPromises = Array(10).fill(null).map((_, i) => 
        scheduler.createSchedule({ ...scheduleConfig, name: `Schedule ${i}` })
      );

      const schedules = await Promise.all(createPromises);

      expect(schedules).toHaveLength(10);
      expect(new Set(schedules.map(s => s.id)).size).toBe(10); // All IDs should be unique
    });

    it('should handle schedules with minimal configuration', async () => {
      const minimalConfig: PeriodicReflectionConfig = {
        name: 'Minimal Schedule',
        description: 'Minimal configuration',
        frequency: ScheduleFrequency.DAILY,
        interval: 86400000,
        enabled: true,
        reflectionType: 'quick',
        triggerConditions: ['minimal'],
        analysisDepth: 'basic'
      };

      const schedule = await scheduler.createSchedule(minimalConfig);

      expect(schedule).toHaveProperty('id');
      expect(schedule.name).toBe('Minimal Schedule');
      expect(schedule.triggerConditions).toHaveLength(1);
    });
  });
}); 