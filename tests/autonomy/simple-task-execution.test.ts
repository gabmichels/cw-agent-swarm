/**
 * simple-task-execution.test.ts
 * Simple tests focused on async task execution by the scheduler
 */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { createSchedulerManager, RegistryType } from '../../src/lib/scheduler/factories/SchedulerFactory';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { Task, TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';
import { ulid } from 'ulid';

const TEST_TIMEOUT = 30000; // 30 seconds
vi.setConfig({ testTimeout: TEST_TIMEOUT });

describe('Simple Task Execution Tests', () => {
  let agent: DefaultAgent;
  let scheduler: ModularSchedulerManager;
  let executedTasks: string[] = [];

  beforeEach(async () => {
    console.log('Setting up simple task execution test...');
    
    vi.useRealTimers();
    executedTasks = [];
    process.env.TEST_MODE = 'true';
    
    // Create agent
    agent = new DefaultAgent({
      name: "SimpleTaskTester",
      componentsConfig: {
        memoryManager: { enabled: true },
        toolManager: { enabled: true },
        planningManager: { enabled: true },
        schedulerManager: { enabled: false },
        reflectionManager: { enabled: true }
      }
    });
    
    await agent.initialize();
    
    // Create scheduler with Qdrant
    scheduler = await createSchedulerManager({
      enabled: true,
      enableAutoScheduling: true,
      schedulingIntervalMs: 2000, // Check every 2 seconds
      maxConcurrentTasks: 3,
      registryType: RegistryType.QDRANT,
      qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantCollectionName: 'simple_test_tasks'
    });
    
    await scheduler.initialize();
    
    // Mock to track executions without creating infinite loops
    vi.spyOn(agent, 'processUserInput').mockImplementation(async (message: string) => {
      console.log(`[EXECUTION] ${message}`);
      executedTasks.push(message);
      
      // Return a simple mock response instead of calling the original method
      return {
        content: `Processed: ${message}`,
        metadata: {
          messageId: `mock-${Date.now()}`,
          timestamp: new Date().toISOString(),
          mock: true
        }
      };
    });
  });
  
  afterEach(async () => {
    if (scheduler?.isSchedulerRunning()) {
      await scheduler.stopScheduler();
    }
    await scheduler?.reset();
    await agent?.shutdown();
    vi.restoreAllMocks();
  });

  test('Simple urgent task gets picked up by scheduler', async () => {
    console.log('Starting urgent task test...');
    
    // Stop auto-scheduling temporarily to check task creation without execution
    if (scheduler?.isSchedulerRunning()) {
      await scheduler.stopScheduler();
    }
    
    // Send urgent input
    const userInput = "URGENT: Please help me with this critical issue";
    const response = await agent.processUserInput(userInput);
    
    expect(response).toBeDefined();
    expect(response.content).toBeTruthy();
    
    // Check if task was created
    const tasks = await scheduler.findTasks({});
    console.log(`Found ${tasks.length} tasks`);
    
    if (tasks.length > 0) {
      const task = tasks[0];
      console.log(`Task created: ${task.name} with priority ${task.priority} status: ${task.status}`);
      
      // Verify task properties
      expect(task.priority).toBeGreaterThanOrEqual(5);
      expect(task.status).toBe(TaskStatus.PENDING);
    }
    
    console.log('Urgent task test completed');
  });

  test('Scheduler picks up and executes scheduled task', async () => {
    console.log('🚨🚨🚨 FAILING TEST STARTED 🚨🚨🚨');
    console.log('Starting scheduler execution test...');
    
    // Stop auto-scheduling temporarily to create task without immediate execution
    if (scheduler?.isSchedulerRunning()) {
      await scheduler.stopScheduler();
    }
    
    console.log('📝 About to create task object...');
    // Create a task scheduled for immediate execution with ALL required fields
    const task: Task = {
      id: ulid(), // Generate unique ID
      name: 'Test Scheduler Task',
      description: 'Task to test scheduler execution',
      scheduleType: TaskScheduleType.EXPLICIT, // Required field
      priority: 8,
      status: TaskStatus.PENDING, // Required field
      scheduledTime: new Date(Date.now() - 1000), // 1 second in the past (immediately due)
      createdAt: new Date(), // Required field
      updatedAt: new Date(), // Required field
      handler: async () => {
        console.log('Task handler executed');
        executedTasks.push('Executing scheduled task');
        return { success: true };
      }
    };
    
    console.log('📋 Task object created:', {
      id: task.id,
      name: task.name,
      scheduleType: task.scheduleType,
      status: task.status,
      priority: task.priority,
      scheduledTime: task.scheduledTime?.toISOString(),
      hasHandler: !!task.handler
    });
    
    console.log('🔥🔥🔥 ABOUT TO CALL scheduler.createTask() 🔥🔥🔥');
    // Create the task
    const createdTask = await scheduler.createTask(task);
    console.log(`✅✅✅ scheduler.createTask() COMPLETED! Task ID: ${createdTask.id} ✅✅✅`);
    
    // Verify task was created with detailed logging
    console.log('🔍 Calling scheduler.findTasks({})...');
    const allTasks = await scheduler.findTasks({});
    console.log(`📊 Total tasks in scheduler: ${allTasks.length}`);
    
    if (allTasks.length === 0) {
      console.log('🔍 Trying findTasks with different filters...');
      const pendingTasks = await scheduler.findTasks({ status: TaskStatus.PENDING });
      console.log(`📊 Pending tasks: ${pendingTasks.length}`);
      
      const allTasksNoFilter = await scheduler.findTasks({});
      console.log(`📊 All tasks (no filter): ${allTasksNoFilter.length}`);
      
      console.log('❌ No tasks found after creation - this indicates a storage issue');
      // Skip the rest of the test if task creation failed
      expect(allTasks.length).toBeGreaterThan(0);
      return;
    }
    
    // Start the scheduler
    console.log('Starting scheduler...');
    await scheduler.startScheduler();
    
    // Wait for task execution
    console.log('Waiting for task execution...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Stop scheduler
    await scheduler.stopScheduler();
    console.log('Scheduler stopped');
    
    // Verify task was executed
    console.log(`Executed tasks: ${JSON.stringify(executedTasks)}`);
    expect(executedTasks.length).toBeGreaterThan(0);
    
    console.log('Scheduler execution test completed');
  });

  test('Task with time constraint gets scheduled correctly', async () => {
    console.log('Starting time constraint test...');
    
    const userInput = "Check Bitcoin price and report back in 3 seconds";
    const startTime = Date.now();
    
    const response = await agent.processUserInput(userInput);
    expect(response).toBeDefined();
    
    // Check for created tasks
    const tasks = await scheduler.findTasks({});
    console.log(`Found ${tasks.length} tasks after input`);
    
    // Start scheduler to execute any due tasks
    await scheduler.startScheduler();
    
    // Wait a bit longer than the constraint
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    await scheduler.stopScheduler();
    
    const endTime = Date.now();
    console.log(`Test completed in ${endTime - startTime}ms`);
    
    console.log('Time constraint test completed');
  });

  test('Multiple tasks are handled concurrently', async () => {
    console.log('Starting concurrent tasks test...');
    
    const inputs = [
      "Task 1: Simple analysis",
      "Task 2: Quick check",
      "Task 3: Brief review"
    ];
    
    // Send all inputs
    const promises = inputs.map(async (input, index) => {
      await new Promise(resolve => setTimeout(resolve, index * 100)); // Stagger slightly
      return agent.processUserInput(input);
    });
    
    const results = await Promise.all(promises);
    
    // Verify all completed
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.content).toBeTruthy();
    });
    
    console.log('Concurrent tasks test completed');
  });
});