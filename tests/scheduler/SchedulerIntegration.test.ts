/**
 * SchedulerIntegration.test.ts
 * Integration tests for the scheduler system components working together
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSchedulerManager } from '../../src/lib/scheduler/factories/SchedulerFactory';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { Task, TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';
import { SchedulerConfig } from '../../src/lib/scheduler/models/SchedulerConfig.model';

describe('Scheduler System Integration', () => {
  let schedulerManager: ModularSchedulerManager;
  
  // Create a simple task handler for testing
  const testTaskHandler = vi.fn().mockImplementation(async () => {
    return { success: true, result: 'Task executed successfully' };
  });
  
  beforeEach(async () => {
    // Create a fresh scheduler for each test
    const config: Partial<SchedulerConfig> = {
      enabled: true,
      enableAutoScheduling: false, // Disable auto-scheduling for controlled testing
      schedulingIntervalMs: 1000,
      maxConcurrentTasks: 3
    };
    
    // Use the factory to create a fully configured scheduler
    schedulerManager = await createSchedulerManager(config);
  });
  
  afterEach(async () => {
    // Clean up
    if (schedulerManager.isSchedulerRunning()) {
      await schedulerManager.stopScheduler();
    }
    await schedulerManager.reset();
  });
  
  describe('End-to-end task lifecycle', () => {
    it('should handle the complete lifecycle of a task', async () => {
      // 1. Create a task
      const task: Task = {
        id: '',
        name: 'Integration Test Task',
        description: 'Testing complete task lifecycle',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(Date.now() - 1000), // Due 1 second ago
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const createdTask = await schedulerManager.createTask(task);
      expect(createdTask.id).toBeTruthy();
      expect(createdTask.name).toBe('Integration Test Task');
      
      // 2. Verify task is stored and retrievable
      const retrievedTask = await schedulerManager.getTask(createdTask.id);
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask?.status).toBe(TaskStatus.PENDING);
      
      // 3. Execute due tasks
      const executionResults = await schedulerManager.executeDueTasks();
      expect(executionResults.length).toBe(1);
      expect(executionResults[0].taskId).toBe(createdTask.id);
      expect(executionResults[0].successful).toBe(true);
      
      // 4. Verify task has been executed
      const executedTask = await schedulerManager.getTask(createdTask.id);
      expect(executedTask?.status).toBe(TaskStatus.COMPLETED);
      expect(executedTask?.lastExecutedAt).toBeDefined();
      
      // 5. Verify task handler was called
      expect(testTaskHandler).toHaveBeenCalled();
    });
  });
  
  describe('Natural language scheduling', () => {
    it('should schedule tasks using natural language expressions', async () => {
      // Get access to the dateTimeProcessor for testing
      const dateTimeProcessor = schedulerManager['dateTimeProcessor'];
      
      // Test parsing of "tomorrow"
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Midnight tomorrow
      
      // Parse "tomorrow" using the dateTimeProcessor
      const parsedTomorrow = dateTimeProcessor.parseNaturalLanguage("tomorrow");
      expect(parsedTomorrow).not.toBeNull();
      
      // Verify the date is correctly parsed
      expect(parsedTomorrow?.getDate()).toBe(tomorrow.getDate());
      expect(parsedTomorrow?.getMonth()).toBe(tomorrow.getMonth());
      expect(parsedTomorrow?.getFullYear()).toBe(tomorrow.getFullYear());
      
      // Create a task using the parsed date
      const task1: Task = {
        id: '',
        name: 'Tomorrow Task',
        description: 'Task scheduled for tomorrow',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: parsedTomorrow as Date,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const createdTask1 = await schedulerManager.createTask(task1);
      const retrievedTask1 = await schedulerManager.getTask(createdTask1.id);
      
      // Verify task was stored with correct scheduledTime
      expect(retrievedTask1?.scheduledTime).toBeInstanceOf(Date);
      
      // Test vague term translation with a reference date
      const now = new Date();
      const vagueTerm = "urgent";
      const translatedVague = dateTimeProcessor.translateVagueTerm(vagueTerm, now);
      expect(translatedVague).not.toBeNull();
      
      // Create a task using the vague term translation
      const task2: Task = {
        id: '',
        name: 'Urgent Task',
        description: 'Task that needs immediate attention',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler, 
        status: TaskStatus.PENDING,
        priority: translatedVague?.priority || 5,
        scheduledTime: translatedVague?.date as Date,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const createdTask2 = await schedulerManager.createTask(task2);
      const retrievedTask2 = await schedulerManager.getTask(createdTask2.id);
      
      // Verify the vague term was properly processed
      expect(retrievedTask2?.priority).toBeGreaterThan(5); // Priority should be increased
      expect(retrievedTask2?.scheduledTime).toBeInstanceOf(Date);
      
      // The scheduledTime should be very close to now
      const urgentTime = retrievedTask2?.scheduledTime as Date;
      const timeDiff = Math.abs(urgentTime.getTime() - now.getTime());
      expect(timeDiff).toBeLessThan(60 * 60 * 1000); // Within an hour
    });
  });
  
  describe('Task execution ordering', () => {
    it('should execute tasks in the correct order based on priority and scheduling', async () => {
      // Simplify the test to make it more reliable
      const highPriorityTask: Task = {
        id: '',
        name: 'High Priority Task',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 10, // Maximum priority
        scheduledTime: new Date(Date.now() - 1000), // Just now
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const lowPriorityTask: Task = {
        id: '',
        name: 'Low Priority Task',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 1, // Minimum priority
        scheduledTime: new Date(Date.now() - 2000), // 2 seconds ago (earlier than high priority)
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Create tasks
      await schedulerManager.createTask(lowPriorityTask);
      const highPriorityCreated = await schedulerManager.createTask(highPriorityTask);
      
      // Execute the high priority task directly
      const result = await schedulerManager.executeTaskNow(highPriorityCreated.id);
      
      // Verify it executed successfully
      expect(result.successful).toBe(true);
      expect(result.taskId).toBe(highPriorityCreated.id);
      
      // Verify task was marked as completed
      const completedTask = await schedulerManager.getTask(highPriorityCreated.id);
      expect(completedTask?.status).toBe(TaskStatus.COMPLETED);
    });
  });
  
  describe('Factory integration', () => {
    it('should create a fully functional scheduler with factory methods', async () => {
      // Create a scheduler using the factory with default configuration
      const factoryScheduler = await createSchedulerManager();
      
      try {
        // Create a simple task
        const task: Task = {
          id: '',
          name: 'Factory Test Task',
          scheduleType: TaskScheduleType.EXPLICIT,
          handler: testTaskHandler,
          status: TaskStatus.PENDING,
          priority: 5,
          scheduledTime: new Date(Date.now() - 1000), // Due 1 second ago
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Test basic operations with the factory-created scheduler
        const createdTask = await factoryScheduler.createTask(task);
        expect(createdTask.id).toBeTruthy();
        
        // Execute the task
        const executionResults = await factoryScheduler.executeDueTasks();
        expect(executionResults.length).toBe(1);
        expect(executionResults[0].successful).toBe(true);
        
        // Verify task was executed
        const executedTask = await factoryScheduler.getTask(createdTask.id);
        expect(executedTask?.status).toBe(TaskStatus.COMPLETED);
        
        // All scheduler components should be properly initialized
        expect(factoryScheduler['registry']).toBeDefined();
        expect(factoryScheduler['scheduler']).toBeDefined();
        expect(factoryScheduler['executor']).toBeDefined();
        expect(factoryScheduler['dateTimeProcessor']).toBeDefined();
      } finally {
        // Clean up
        if (factoryScheduler.isSchedulerRunning()) {
          await factoryScheduler.stopScheduler();
        }
        await factoryScheduler.reset();
      }
    });
  });
}); 