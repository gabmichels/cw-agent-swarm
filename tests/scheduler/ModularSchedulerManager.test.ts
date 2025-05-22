/**
 * ModularSchedulerManager.test.ts
 * Unit tests for the ModularSchedulerManager implementation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { MemoryTaskRegistry } from '../../src/lib/scheduler/implementations/registry/MemoryTaskRegistry';
import { StrategyBasedTaskScheduler } from '../../src/lib/scheduler/implementations/scheduler/StrategyBasedTaskScheduler';
import { ExplicitTimeStrategy } from '../../src/lib/scheduler/implementations/strategies/ExplicitTimeStrategy';
import { IntervalStrategy } from '../../src/lib/scheduler/implementations/strategies/IntervalStrategy';
import { PriorityBasedStrategy } from '../../src/lib/scheduler/implementations/strategies/PriorityBasedStrategy';
import { BasicTaskExecutor } from '../../src/lib/scheduler/implementations/executor/BasicTaskExecutor';
import { BasicDateTimeProcessor } from '../../src/lib/scheduler/implementations/datetime/BasicDateTimeProcessor';
import { TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';
import { SchedulerConfig } from '../../src/lib/scheduler/models/SchedulerConfig.model';

describe('ModularSchedulerManager', () => {
  let schedulerManager: ModularSchedulerManager;
  let registry: MemoryTaskRegistry;
  let scheduler: StrategyBasedTaskScheduler;
  let executor: BasicTaskExecutor;
  let dateTimeProcessor: BasicDateTimeProcessor;
  
  // Create a simple task handler for testing
  const testTaskHandler = vi.fn().mockResolvedValue({ success: true });
  
  // Mock timers for testing time-dependent features
  beforeEach(() => {
    vi.useFakeTimers();
    
    // Create components
    registry = new MemoryTaskRegistry();
    dateTimeProcessor = new BasicDateTimeProcessor();
    
    // Create strategies
    const explicitStrategy = new ExplicitTimeStrategy();
    const intervalStrategy = new IntervalStrategy();
    const priorityStrategy = new PriorityBasedStrategy();
    
    // Create scheduler with strategies
    scheduler = new StrategyBasedTaskScheduler([
      explicitStrategy,
      intervalStrategy,
      priorityStrategy
    ]);
    
    // Create executor
    executor = new BasicTaskExecutor();
    
    // Spy on key methods
    vi.spyOn(registry, 'storeTask');
    vi.spyOn(registry, 'updateTask');
    vi.spyOn(registry, 'findTasks');
    vi.spyOn(scheduler, 'getDueTasks');
    vi.spyOn(executor, 'executeTask');
    vi.spyOn(executor, 'executeTasks');
    
    // Create manager
    const config: Partial<SchedulerConfig> = {
      enableAutoScheduling: false, // Disable auto-scheduling for controlled testing
      schedulingIntervalMs: 1000, // 1 second interval
      maxConcurrentTasks: 2
    };
    
    schedulerManager = new ModularSchedulerManager(
      registry,
      scheduler,
      executor,
      dateTimeProcessor,
      config
    );
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  
  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const result = await schedulerManager.initialize();
      expect(result).toBe(true);
    });
    
    it('should start scheduler automatically when configured', async () => {
      // Create a manager with auto-scheduling enabled
      const autoScheduleManager = new ModularSchedulerManager(
        registry,
        scheduler,
        executor,
        dateTimeProcessor,
        { enableAutoScheduling: true }
      );
      
      // Spy on startScheduler
      const startSpy = vi.spyOn(autoScheduleManager, 'startScheduler');
      
      await autoScheduleManager.initialize();
      
      expect(startSpy).toHaveBeenCalled();
      expect(autoScheduleManager.isSchedulerRunning()).toBe(true);
      
      // Clean up
      await autoScheduleManager.stopScheduler();
    });
  });
  
  describe('task management', () => {
    beforeEach(async () => {
      await schedulerManager.initialize();
    });
    
    it('should create a task with generated ID', async () => {
      const task = {
        id: '',
        name: 'Test Task',
        description: 'A test task',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(Date.now() + 60000), // 1 minute in the future
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const createdTask = await schedulerManager.createTask(task);
      
      expect(createdTask.id).toBeTruthy();
      expect(createdTask.name).toBe('Test Task');
      expect(registry.storeTask).toHaveBeenCalled();
    });
    
    it('should update an existing task', async () => {
      // Create a task first
      const task = {
        id: '',
        name: 'Original Name',
        description: 'Original description',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(Date.now() + 60000),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const createdTask = await schedulerManager.createTask(task);
      
      // Update the task
      const updatedTask = {
        ...createdTask,
        name: 'Updated Name',
        description: 'Updated description',
        priority: 8
      };
      
      const result = await schedulerManager.updateTask(updatedTask);
      
      expect(result.id).toBe(createdTask.id);
      expect(result.name).toBe('Updated Name');
      expect(result.description).toBe('Updated description');
      expect(result.priority).toBe(8);
      expect(registry.updateTask).toHaveBeenCalled();
    });
    
    it('should delete a task', async () => {
      // Create a task first
      const task = {
        id: '',
        name: 'Task to Delete',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(Date.now() + 60000),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const createdTask = await schedulerManager.createTask(task);
      
      // Delete the task
      const deleteResult = await schedulerManager.deleteTask(createdTask.id);
      
      expect(deleteResult).toBe(true);
      
      // Verify it's deleted
      const retrievedTask = await schedulerManager.getTask(createdTask.id);
      expect(retrievedTask).toBeNull();
    });
    
    it('should find tasks matching criteria', async () => {
      // Create multiple tasks
      const tasks = [
        {
          id: '',
          name: 'High Priority Task',
          scheduleType: TaskScheduleType.EXPLICIT,
          handler: testTaskHandler,
          status: TaskStatus.PENDING,
          priority: 8,
          scheduledTime: new Date(Date.now() + 60000),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '',
          name: 'Low Priority Task',
          scheduleType: TaskScheduleType.PRIORITY,
          handler: testTaskHandler,
          status: TaskStatus.PENDING,
          priority: 2,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      for (const task of tasks) {
        await schedulerManager.createTask(task);
      }
      
      // Find tasks by criteria
      const highPriorityTasks = await schedulerManager.findTasks({
        minPriority: 8
      });
      
      expect(highPriorityTasks.length).toBe(1);
      expect(highPriorityTasks[0].name).toBe('High Priority Task');
    });
  });
  
  describe('task execution', () => {
    beforeEach(async () => {
      await schedulerManager.initialize();
    });
    
    it('should execute due tasks', async () => {
      // Create a task that is due
      const pastTime = new Date(Date.now() - 1000); // 1 second in the past
      const task = {
        id: '',
        name: 'Due Task',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: pastTime,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await schedulerManager.createTask(task);
      
      // Execute due tasks
      const results = await schedulerManager.executeDueTasks();
      
      expect(results.length).toBe(1);
      expect(scheduler.getDueTasks).toHaveBeenCalled();
      expect(executor.executeTasks).toHaveBeenCalled();
    });
    
    it('should execute a specific task immediately', async () => {
      // Create a task
      const task = {
        id: '',
        name: 'Immediate Task',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(Date.now() + 60000), // Not due yet
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const createdTask = await schedulerManager.createTask(task);
      
      // Execute immediately, bypassing scheduling
      const result = await schedulerManager.executeTaskNow(createdTask.id);
      
      expect(result).toBeTruthy();
      expect(executor.executeTask).toHaveBeenCalled();
    });
    
    it('should handle recurring tasks with intervals', async () => {
      // Create an interval task
      const task = {
        id: '',
        name: 'Recurring Task',
        scheduleType: TaskScheduleType.INTERVAL,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(), // Start now
        interval: {
          expression: '1 hour',
          executionCount: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await schedulerManager.createTask(task);
      
      // Execute due tasks
      const results = await schedulerManager.executeDueTasks();
      
      expect(results.length).toBe(1);
      
      // The task should be updated with incremented execution count
      const updatedTasks = await schedulerManager.findTasks({
        name: 'Recurring Task'
      });
      
      expect(updatedTasks.length).toBe(1);
      expect(updatedTasks[0].interval?.executionCount).toBe(1);
    });
  });
  
  describe('scheduler control', () => {
    beforeEach(async () => {
      await schedulerManager.initialize();
    });
    
    it('should start and stop the scheduler', async () => {
      // Start the scheduler
      const startResult = await schedulerManager.startScheduler();
      expect(startResult).toBe(true);
      expect(schedulerManager.isSchedulerRunning()).toBe(true);
      
      // Stop the scheduler
      const stopResult = await schedulerManager.stopScheduler();
      expect(stopResult).toBe(true);
      expect(schedulerManager.isSchedulerRunning()).toBe(false);
    });
    
    it('should set up scheduler when started', async () => {
      // Mock setInterval to verify it's being called
      const originalSetInterval = global.setInterval;
      const mockSetInterval = vi.fn();
      global.setInterval = mockSetInterval as any;
      
      try {
        // Start the scheduler
        await schedulerManager.startScheduler();
        
        // Verify setInterval was called
        expect(mockSetInterval).toHaveBeenCalled();
        
        // Clean up
        await schedulerManager.stopScheduler();
      } finally {
        // Restore original setInterval
        global.setInterval = originalSetInterval;
      }
    });
    
    it('should reset the scheduler state', async () => {
      // Add some tasks
      const task = {
        id: '',
        name: 'Task to Reset',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await schedulerManager.createTask(task);
      
      // Reset the scheduler without starting it
      const resetResult = await schedulerManager.reset();
      
      expect(resetResult).toBe(true);
      expect(schedulerManager.isSchedulerRunning()).toBe(false);
      
      // Registry should be cleared
      const tasks = await schedulerManager.findTasks({});
      expect(tasks.length).toBe(0);
    });
  });
  
  describe('metrics', () => {
    beforeEach(async () => {
      await schedulerManager.initialize();
    });
    
    it('should provide scheduler metrics', async () => {
      // Create tasks with different statuses
      const pendingTask = {
        id: '',
        name: 'Pending Task',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(Date.now() + 60000),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const completedTask = {
        id: '',
        name: 'Completed Task',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: testTaskHandler,
        status: TaskStatus.COMPLETED,
        priority: 5,
        scheduledTime: new Date(Date.now() - 60000),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastExecutedAt: new Date()
      };
      
      await schedulerManager.createTask(pendingTask);
      await schedulerManager.createTask(completedTask);
      
      // Get metrics
      const metrics = await schedulerManager.getMetrics();
      
      expect(metrics.totalTasks).toBe(2);
      expect(metrics.taskStatusCounts.pending).toBe(1);
      expect(metrics.taskStatusCounts.completed).toBe(1);
      expect(metrics.isRunning).toBe(false);
    });
  });
}); 