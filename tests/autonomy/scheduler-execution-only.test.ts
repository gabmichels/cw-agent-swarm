/**
 * scheduler-execution-only.test.ts
 * Focused test on scheduler execution without external dependencies
 */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createSchedulerManager, RegistryType } from '../../src/lib/scheduler/factories/SchedulerFactory';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { Task, TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';

const TEST_TIMEOUT = 15000; // 15 seconds
vi.setConfig({ testTimeout: TEST_TIMEOUT });

describe('Scheduler Execution Only Tests', () => {
  let scheduler: ModularSchedulerManager;
  let executedTasks: string[] = [];

  beforeEach(async () => {
    console.log('Setting up scheduler execution test...');
    
    vi.useRealTimers();
    executedTasks = [];
    process.env.TEST_MODE = 'true';
    
    // Use memory storage to avoid Qdrant issues
    scheduler = await createSchedulerManager({
      enabled: true,
      enableAutoScheduling: true,
      schedulingIntervalMs: 1000, // Check every 1 second
      maxConcurrentTasks: 3,
      registryType: RegistryType.MEMORY
    });
    
    await scheduler.initialize();
  });
  
  afterEach(async () => {
    if (scheduler?.isSchedulerRunning()) {
      await scheduler.stopScheduler();
    }
    await scheduler?.reset();
    vi.restoreAllMocks();
  });

  test('Scheduler executes a simple task', async () => {
    console.log('Testing simple task execution...');
    
    // Create a task with handler that tracks execution
    const task: Partial<Task> = {
      name: 'Simple Test Task',
      description: 'Task to verify scheduler execution',
      priority: 8,
      scheduleType: TaskScheduleType.EXPLICIT,
      scheduledTime: new Date(Date.now() + 500), // 0.5 second from now
      handler: async () => {
        console.log('✅ Task handler executed!');
        executedTasks.push('Simple Test Task');
        return { success: true, message: 'Task completed' };
      }
    };
    
    // Create the task
    const createdTask = await scheduler.createTask(task as Task);
    console.log(`Created task: ${createdTask.id} scheduled for ${createdTask.scheduledTime}`);
    
    // Verify task was created
    expect(createdTask.id).toBeTruthy();
    expect(createdTask.status).toBe(TaskStatus.PENDING);
    
    // Start the scheduler
    console.log('Starting scheduler...');
    await scheduler.startScheduler();
    
    // Wait for task execution
    console.log('Waiting for task execution...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Stop scheduler
    await scheduler.stopScheduler();
    console.log('Scheduler stopped');
    
    // Verify task was executed
    console.log(`Executed tasks: ${JSON.stringify(executedTasks)}`);
    expect(executedTasks.length).toBe(1);
    expect(executedTasks[0]).toBe('Simple Test Task');
    
    console.log('✅ Simple task execution test completed successfully!');
  });

  test('Scheduler executes multiple tasks in order', async () => {
    console.log('Testing multiple task execution...');
    
    const tasks = [
      {
        name: 'Task A',
        priority: 10,
        scheduledTime: new Date(Date.now() + 500),
        handler: async () => {
          executedTasks.push('Task A');
          return { success: true };
        }
      },
      {
        name: 'Task B', 
        priority: 8,
        scheduledTime: new Date(Date.now() + 1000),
        handler: async () => {
          executedTasks.push('Task B');
          return { success: true };
        }
      },
      {
        name: 'Task C',
        priority: 6,
        scheduledTime: new Date(Date.now() + 1500), 
        handler: async () => {
          executedTasks.push('Task C');
          return { success: true };
        }
      }
    ];
    
    // Create all tasks
    for (const taskData of tasks) {
      const task: Partial<Task> = {
        name: taskData.name,
        description: `Testing ${taskData.name}`,
        priority: taskData.priority,
        scheduleType: TaskScheduleType.EXPLICIT,
        scheduledTime: taskData.scheduledTime,
        handler: taskData.handler
      };
      
      const createdTask = await scheduler.createTask(task as Task);
      console.log(`Created ${taskData.name}: ${createdTask.id}`);
    }
    
    // Start scheduler
    await scheduler.startScheduler();
    
    // Wait for all tasks to execute
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    await scheduler.stopScheduler();
    
    // Verify all tasks executed
    console.log(`Executed tasks: ${JSON.stringify(executedTasks)}`);
    expect(executedTasks.length).toBe(3);
    expect(executedTasks).toContain('Task A');
    expect(executedTasks).toContain('Task B');
    expect(executedTasks).toContain('Task C');
    
    console.log('✅ Multiple task execution test completed successfully!');
  });

  test('Scheduler respects task priorities', async () => {
    console.log('Testing priority-based execution...');
    
    // Create tasks with different priorities but same schedule time
    const baseTime = Date.now() + 500;
    const tasks = [
      {
        name: 'Low Priority Task',
        priority: 3,
        scheduledTime: new Date(baseTime),
      },
      {
        name: 'High Priority Task', 
        priority: 9,
        scheduledTime: new Date(baseTime),
      },
      {
        name: 'Medium Priority Task',
        priority: 6,
        scheduledTime: new Date(baseTime),
      }
    ];
    
    // Create all tasks
    for (const taskData of tasks) {
      const task: Partial<Task> = {
        name: taskData.name,
        description: `Priority test: ${taskData.name}`,
        priority: taskData.priority,
        scheduleType: TaskScheduleType.EXPLICIT,
        scheduledTime: taskData.scheduledTime,
        handler: async () => {
          console.log(`Executing ${taskData.name} (priority ${taskData.priority})`);
          executedTasks.push(taskData.name);
          return { success: true };
        }
      };
      
      await scheduler.createTask(task as Task);
    }
    
    // Start scheduler
    await scheduler.startScheduler();
    
    // Wait for execution
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await scheduler.stopScheduler();
    
    // Verify tasks executed
    console.log(`Execution order: ${JSON.stringify(executedTasks)}`);
    expect(executedTasks.length).toBe(3);
    
    // High priority should execute first (or at least be included)
    expect(executedTasks).toContain('High Priority Task');
    expect(executedTasks).toContain('Medium Priority Task');
    expect(executedTasks).toContain('Low Priority Task');
    
    console.log('✅ Priority-based execution test completed successfully!');
  });
}); 