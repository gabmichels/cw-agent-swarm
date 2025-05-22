/**
 * ExistingSchedulerUpdate.test.ts
 * Demonstrates how to update existing scheduler tests to use the new ModularSchedulerManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSchedulerManager } from '../../src/lib/scheduler/factories/SchedulerFactory';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { Task, TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';

// Mock agent for testing
const mockAgent = {
  getId: () => 'test-agent',
  getAgentId: () => 'test-agent',
  getType: () => 'test',
  getName: () => 'Test Agent',
  getDescription: () => 'Test agent for unit tests',
  getVersion: () => '1.0.0',
  getCapabilities: async () => [],
  getStatus: () => ({ status: 'AVAILABLE' }),
  initialize: async () => true,
  shutdown: async () => {},
  reset: async () => {},
  // ... other agent methods would be here ...
};

describe('Updating Existing Scheduler Tests', () => {
  let modernScheduler: ModularSchedulerManager;
  
  beforeEach(async () => {
    // Create a modern scheduler for testing
    modernScheduler = await createSchedulerManager({
      enabled: true,
      enableAutoScheduling: false, // Disable auto-scheduling for controlled testing
      schedulingIntervalMs: 1000,
      maxConcurrentTasks: 3
    });
  });
  
  /**
   * BEFORE: Original test using DefaultSchedulerManager
   * 
   * it('creates and retrieves a task', async () => {
   *   const config = {
   *     enabled: true,
   *     maxConcurrentTasks: 5
   *   };
   *   
   *   const manager = new DefaultSchedulerManager(mockAgent, config);
   *   await manager.initialize();
   *   
   *   const result = await manager.createTask({
   *     title: 'Test Task',
   *     description: 'Test task description',
   *     type: 'test',
   *     priority: 0.5,
   *     metadata: {
   *       testId: '123'
   *     }
   *   });
   *   
   *   expect(result.success).toBe(true);
   *   expect(result.task).toBeDefined();
   *   
   *   const task = await manager.getTask(result.task.id);
   *   expect(task).toBeDefined();
   *   expect(task?.title).toBe('Test Task');
   *   expect(task?.description).toBe('Test task description');
   *   expect(task?.status).toBe('pending');
   *   expect(task?.priority).toBe(0.5);
   * });
   */
  
  /**
   * AFTER: Updated test using ModularSchedulerManager
   */
  it('creates and retrieves a task with ModularSchedulerManager', async () => {
    // Create a task with the modern scheduler
    const task: Task = {
      id: '',
      name: 'Test Task', // Changed from 'title' to 'name'
      description: 'Test task description',
      scheduleType: TaskScheduleType.EXPLICIT, // New required field
      handler: async () => ({ success: true }), // New required field
      status: TaskStatus.PENDING, // Using enum instead of string
      priority: 5, // Using 0-10 scale instead of 0-1
      scheduledTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const createdTask = await modernScheduler.createTask(task);
    expect(createdTask.id).toBeTruthy();
    
    // Retrieve the task
    const retrievedTask = await modernScheduler.getTask(createdTask.id);
    expect(retrievedTask).toBeDefined();
    expect(retrievedTask?.name).toBe('Test Task');
    expect(retrievedTask?.description).toBe('Test task description');
    expect(retrievedTask?.status).toBe(TaskStatus.PENDING);
    expect(retrievedTask?.priority).toBe(5);
  });
  
  /**
   * BEFORE: Original test for executing tasks
   * 
   * it('executes a task', async () => {
   *   const manager = new DefaultSchedulerManager(mockAgent, { enabled: true });
   *   await manager.initialize();
   *   
   *   const result = await manager.createTask({
   *     title: 'Task to Execute',
   *     description: 'This task should be executed',
   *     type: 'test',
   *     priority: 0.8
   *   });
   *   
   *   const executionResult = await manager.executeTask(result.task.id);
   *   expect(executionResult.success).toBe(true);
   *   
   *   const task = await manager.getTask(result.task.id);
   *   expect(task?.status).toBe('completed');
   * });
   */
  
  /**
   * AFTER: Updated test for executing tasks
   */
  it('executes a task with ModularSchedulerManager', async () => {
    // Create a task with the modern scheduler
    const task: Task = {
      id: '',
      name: 'Task to Execute',
      description: 'This task should be executed',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: async () => ({ success: true, result: 'Executed' }),
      status: TaskStatus.PENDING,
      priority: 8, // Using 0-10 scale
      scheduledTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const createdTask = await modernScheduler.createTask(task);
    
    // Execute the task directly
    const executionResult = await modernScheduler.executeTaskNow(createdTask.id);
    expect(executionResult.successful).toBe(true); // Changed from 'success' to 'successful'
    
    // Verify task status
    const completedTask = await modernScheduler.getTask(createdTask.id);
    expect(completedTask?.status).toBe(TaskStatus.COMPLETED);
  });
  
  /**
   * BEFORE: Original test for getting due tasks
   * 
   * it('gets due tasks', async () => {
   *   const manager = new DefaultSchedulerManager(mockAgent, { enabled: true });
   *   await manager.initialize();
   *   
   *   // Create a task due in the past
   *   await manager.createTask({
   *     title: 'Past Task',
   *     description: 'Due in the past',
   *     scheduledTime: new Date(Date.now() - 1000),
   *     priority: 0.5
   *   });
   *   
   *   // Create a task due in the future
   *   await manager.createTask({
   *     title: 'Future Task',
   *     description: 'Due in the future',
   *     scheduledTime: new Date(Date.now() + 60000),
   *     priority: 0.5
   *   });
   *   
   *   const dueTasks = await manager.getDueTasks();
   *   expect(dueTasks.length).toBe(1);
   *   expect(dueTasks[0].title).toBe('Past Task');
   * });
   */
  
  /**
   * AFTER: Updated test for getting due tasks
   */
  it('gets due tasks with ModularSchedulerManager', async () => {
    // Create a task due in the past
    const pastTask: Task = {
      id: '',
      name: 'Past Task',
      description: 'Due in the past',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: async () => ({ success: true }),
      status: TaskStatus.PENDING,
      priority: 5,
      scheduledTime: new Date(Date.now() - 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create a task due in the future
    const futureTask: Task = {
      id: '',
      name: 'Future Task',
      description: 'Due in the future',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: async () => ({ success: true }),
      status: TaskStatus.PENDING,
      priority: 5,
      scheduledTime: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await modernScheduler.createTask(pastTask);
    await modernScheduler.createTask(futureTask);
    
    // Get due tasks - use executeDueTasks instead
    const executionResults = await modernScheduler.executeDueTasks();
    expect(executionResults.length).toBe(1);
    
    // Verify the past task was executed
    const updatedPastTask = await modernScheduler.getTask(executionResults[0].taskId);
    expect(updatedPastTask?.name).toBe('Past Task');
    expect(updatedPastTask?.status).toBe(TaskStatus.COMPLETED);
  });
  
  /**
   * Migration Guide Summary:
   * 
   * 1. Task Structure Changes:
   *    - 'title' field is now 'name'
   *    - 'scheduleType' is a required field (use TaskScheduleType enum)
   *    - 'handler' is a required field (function that executes the task)
   *    - 'status' uses TaskStatus enum instead of strings
   *    - 'priority' uses 0-10 scale instead of 0-1
   * 
   * 2. Method Name Changes:
   *    - 'executeTask' is now 'executeTaskNow'
   *    - Result property 'success' is now 'successful'
   * 
   * 3. Factory Usage:
   *    - Use createSchedulerManager() instead of new DefaultSchedulerManager()
   *    - No need to pass agent to the scheduler
   */
}); 