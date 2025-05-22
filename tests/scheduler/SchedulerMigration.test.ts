/**
 * SchedulerMigration.test.ts
 * Tests for migrating from DefaultSchedulerManager to ModularSchedulerManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSchedulerManager } from '../../src/lib/scheduler/factories/SchedulerFactory';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { MemoryTaskRegistry } from '../../src/lib/scheduler/implementations/registry/MemoryTaskRegistry';
import { Task, TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';
import { SchedulerConfig } from '../../src/lib/scheduler/models/SchedulerConfig.model';

// Mock the DefaultSchedulerManager for testing migration
class MockDefaultSchedulerManager {
  private tasks: Map<string, any> = new Map();
  private taskCounter = 0;
  
  async initialize(): Promise<boolean> {
    return true;
  }
  
  async createTask(taskOptions: any): Promise<any> {
    const taskId = `legacy-task-${++this.taskCounter}`;
    
    const task = {
      id: taskId,
      title: taskOptions.title || 'Untitled Task',
      description: taskOptions.description || '',
      type: taskOptions.type || 'default',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      priority: taskOptions.priority || 0.5,
      scheduledTime: taskOptions.scheduledTime,
      handler: taskOptions.handler || (async () => { return { success: true }; }),
      metadata: taskOptions.metadata || {}
    };
    
    this.tasks.set(taskId, task);
    
    return {
      success: true,
      task
    };
  }
  
  async getTask(taskId: string): Promise<any> {
    return this.tasks.get(taskId) || null;
  }
  
  async getTasks(): Promise<any[]> {
    return Array.from(this.tasks.values());
  }
  
  async executeTask(taskId: string): Promise<any> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }
    
    // Execute task handler
    const startTime = Date.now();
    let result;
    try {
      result = await task.handler();
      task.status = 'completed';
      task.lastExecutedAt = new Date();
    } catch (error) {
      task.status = 'failed';
      return { success: false, error: String(error) };
    }
    
    const endTime = Date.now();
    
    return { 
      success: true, 
      taskId,
      durationMs: endTime - startTime,
      result
    };
  }
}

describe('Scheduler Migration', () => {
  let legacyScheduler: MockDefaultSchedulerManager;
  let modernScheduler: ModularSchedulerManager;
  
  // Sample task handler
  const testTaskHandler = vi.fn().mockResolvedValue({ success: true, result: 'Task executed successfully' });
  
  beforeEach(async () => {
    // Create legacy scheduler
    legacyScheduler = new MockDefaultSchedulerManager();
    await legacyScheduler.initialize();
    
    // Create modern scheduler
    const config: Partial<SchedulerConfig> = {
      enabled: true,
      enableAutoScheduling: false
    };
    
    modernScheduler = await createSchedulerManager(config);
  });
  
  describe('Task Migration', () => {
    it('should migrate tasks from legacy to modern scheduler', async () => {
      // Create tasks in legacy system
      const legacyTaskResult1 = await legacyScheduler.createTask({
        title: 'Legacy Task 1',
        description: 'First task from legacy system',
        type: 'test',
        priority: 0.8,
        scheduledTime: new Date(Date.now() + 3600000), // 1 hour from now
        handler: testTaskHandler
      });
      
      const legacyTaskResult2 = await legacyScheduler.createTask({
        title: 'Legacy Task 2',
        description: 'Second task from legacy system',
        type: 'test',
        priority: 0.5,
        handler: testTaskHandler
      });
      
      // Get all tasks from legacy system
      const legacyTasks = await legacyScheduler.getTasks();
      expect(legacyTasks.length).toBe(2);
      
      // Migrate tasks to modern system
      for (const legacyTask of legacyTasks) {
        // Map legacy task fields to modern task fields
        const modernTask: Task = {
          id: legacyTask.id, // Preserve original ID
          name: legacyTask.title, // Map title to name
          description: legacyTask.description,
          status: legacyTask.status === 'pending' ? TaskStatus.PENDING : 
                 legacyTask.status === 'running' ? TaskStatus.RUNNING :
                 legacyTask.status === 'completed' ? TaskStatus.COMPLETED :
                 legacyTask.status === 'failed' ? TaskStatus.FAILED : 
                 TaskStatus.PENDING,
          priority: Math.round(legacyTask.priority * 10), // Convert 0-1 scale to 0-10
          scheduleType: legacyTask.scheduledTime ? TaskScheduleType.EXPLICIT : TaskScheduleType.PRIORITY,
          handler: legacyTask.handler,
          scheduledTime: legacyTask.scheduledTime,
          createdAt: legacyTask.createdAt,
          updatedAt: legacyTask.updatedAt,
          lastExecutedAt: legacyTask.lastExecutedAt
        };
        
        // Store in modern system
        await modernScheduler.createTask(modernTask);
      }
      
      // Verify tasks were migrated correctly
      const modernTasks = await modernScheduler.findTasks({});
      expect(modernTasks.length).toBe(2);
      
      // Check first task details
      const modernTask1 = modernTasks.find(t => t.name === 'Legacy Task 1');
      expect(modernTask1).toBeDefined();
      expect(modernTask1?.id).toBe(legacyTaskResult1.task.id);
      expect(modernTask1?.priority).toBe(8); // 0.8 * 10 = 8
      expect(modernTask1?.scheduleType).toBe(TaskScheduleType.EXPLICIT);
      
      // Check second task details
      const modernTask2 = modernTasks.find(t => t.name === 'Legacy Task 2');
      expect(modernTask2).toBeDefined();
      expect(modernTask2?.id).toBe(legacyTaskResult2.task.id);
      expect(modernTask2?.priority).toBe(5); // 0.5 * 10 = 5
      expect(modernTask2?.scheduleType).toBe(TaskScheduleType.PRIORITY);
    });
    
    it('should allow executing migrated tasks', async () => {
      // Create a task in legacy system
      const legacyTaskResult = await legacyScheduler.createTask({
        title: 'Task to Execute',
        description: 'This task will be migrated and executed',
        type: 'test',
        priority: 0.9,
        scheduledTime: new Date(Date.now() - 1000), // 1 second ago (due)
        handler: testTaskHandler
      });
      
      // Migrate to modern system
      const legacyTask = await legacyScheduler.getTask(legacyTaskResult.task.id);
      const modernTask: Task = {
        id: legacyTask.id,
        name: legacyTask.title,
        description: legacyTask.description,
        status: TaskStatus.PENDING,
        priority: Math.round(legacyTask.priority * 10),
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: legacyTask.handler,
        scheduledTime: legacyTask.scheduledTime,
        createdAt: legacyTask.createdAt,
        updatedAt: legacyTask.updatedAt
      };
      
      await modernScheduler.createTask(modernTask);
      
      // Execute task in modern system
      const executionResults = await modernScheduler.executeDueTasks();
      
      // Verify execution
      expect(executionResults.length).toBe(1);
      expect(executionResults[0].taskId).toBe(legacyTask.id);
      expect(executionResults[0].successful).toBe(true);
      expect(testTaskHandler).toHaveBeenCalled();
      
      // Check task status
      const executedTask = await modernScheduler.getTask(legacyTask.id);
      expect(executedTask?.status).toBe(TaskStatus.COMPLETED);
    });
  });
  
  describe('Migration Factory', () => {
    it('should create a migration helper for moving tasks', async () => {
      // This is a simple migration helper function
      async function migrateTasksFromLegacy(
        legacyScheduler: MockDefaultSchedulerManager, 
        modernScheduler: ModularSchedulerManager
      ): Promise<{ migrated: number, failed: number }> {
        const legacyTasks = await legacyScheduler.getTasks();
        let migrated = 0;
        let failed = 0;
        
        for (const legacyTask of legacyTasks) {
          try {
            // Map legacy task fields to modern task fields
            const modernTask: Task = {
              id: legacyTask.id,
              name: legacyTask.title,
              description: legacyTask.description || '',
              status: legacyTask.status === 'pending' ? TaskStatus.PENDING : 
                     legacyTask.status === 'running' ? TaskStatus.RUNNING :
                     legacyTask.status === 'completed' ? TaskStatus.COMPLETED :
                     legacyTask.status === 'failed' ? TaskStatus.FAILED : 
                     TaskStatus.PENDING,
              priority: Math.round(legacyTask.priority * 10),
              scheduleType: legacyTask.scheduledTime ? TaskScheduleType.EXPLICIT : TaskScheduleType.PRIORITY,
              handler: legacyTask.handler,
              scheduledTime: legacyTask.scheduledTime,
              createdAt: legacyTask.createdAt,
              updatedAt: legacyTask.updatedAt,
              lastExecutedAt: legacyTask.lastExecutedAt
            };
            
            // Store in modern system
            await modernScheduler.createTask(modernTask);
            migrated++;
          } catch (error) {
            failed++;
          }
        }
        
        return { migrated, failed };
      }
      
      // Create some tasks in legacy system
      await legacyScheduler.createTask({ title: 'Legacy Task 1', handler: testTaskHandler });
      await legacyScheduler.createTask({ title: 'Legacy Task 2', handler: testTaskHandler });
      await legacyScheduler.createTask({ title: 'Legacy Task 3', handler: testTaskHandler });
      
      // Migrate tasks
      const result = await migrateTasksFromLegacy(legacyScheduler, modernScheduler);
      
      // Verify migration
      expect(result.migrated).toBe(3);
      expect(result.failed).toBe(0);
      
      const modernTasks = await modernScheduler.findTasks({});
      expect(modernTasks.length).toBe(3);
    });
  });
}); 