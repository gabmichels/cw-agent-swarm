/**
 * scheduler-modern.test.ts
 * Tests the ModularSchedulerManager with real-world agent scenarios
 */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { ManagerType } from '../../src/agents/shared/base/managers/ManagerType';
import { createSchedulerManager } from '../../src/lib/scheduler/factories/SchedulerFactory';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { Task, TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';
import { AgentResponse } from '../../src/agents/shared/base/AgentBase.interface';

// Test timeout
const TEST_TIMEOUT = 30000; // 30 seconds
vi.setConfig({ testTimeout: TEST_TIMEOUT });

describe('ModularSchedulerManager with Agent Integration', () => {
  let agent: DefaultAgent;
  let modernScheduler: ModularSchedulerManager;
  let executedTasks: string[] = [];
  
  beforeEach(async () => {
    console.log('Setting up ModularSchedulerManager test with agent integration...');
    
    // Use real timers for actual behavior
    vi.useRealTimers();
    
    // Reset tracking
    executedTasks = [];
    
    // Set test environment variables
    process.env.TEST_MODE = 'true';
    
    // Create agent with default scheduler disabled (we'll inject our own)
    agent = new DefaultAgent({
      name: "ModernSchedulerTester",
      enableMemoryManager: true,
      enableToolManager: true,
      enablePlanningManager: true,
      enableSchedulerManager: false, // Disable default scheduler
      enableReflectionManager: true
    });
    
    // Initialize the agent
    await agent.initialize();
    
    // Create our modern scheduler
    modernScheduler = await createSchedulerManager({
      enabled: true,
      enableAutoScheduling: true,
      schedulingIntervalMs: 1000,
      maxConcurrentTasks: 5
    });
    
    // Mock the agent's processUserInput method to track task execution
    vi.spyOn(agent, 'processUserInput').mockImplementation(async (message: string): Promise<AgentResponse> => {
      console.log(`[MOCK] Executed task message: ${message}`);
      executedTasks.push(message);
      return { 
        content: `Processed: ${message}`,
        metadata: {}
      };
    });
  });
  
  afterEach(async () => {
    // Clean up
    if (modernScheduler.isSchedulerRunning()) {
      await modernScheduler.stopScheduler();
    }
    await modernScheduler.reset();
    await agent.shutdown();
    
    // Reset mocks
    vi.restoreAllMocks();
  });
  
  test('ModularSchedulerManager can be used independently of DefaultSchedulerManager', async () => {
    // Verify the scheduler is properly initialized
    expect(modernScheduler).toBeDefined();
    expect(modernScheduler['config'].enabled).toBe(true);
    
    // Verify we can create tasks
    const task: Task = {
      id: '',
      name: 'Test Task',
      description: 'Testing independent operation',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: async (...args: unknown[]): Promise<unknown> => {
        console.log("Test task handler called");
        return { success: true, result: 'Task executed' };
      },
      status: TaskStatus.PENDING,
      priority: 5,
      scheduledTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const createdTask = await modernScheduler.createTask(task);
    expect(createdTask.id).toBeTruthy();
    
    // Verify we can retrieve tasks
    const retrievedTask = await modernScheduler.getTask(createdTask.id);
    expect(retrievedTask).toBeDefined();
    expect(retrievedTask?.name).toBe('Test Task');
  });
  
  test('ModularSchedulerManager can work with agent functionality', async () => {
    // Create a simplified test
    const simpleTask: Task = {
      id: '',
      name: 'Simple Agent Task',
      description: 'Simple task for testing',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: async () => {
        console.log("Simple task handler called");
        const message = "Executing simple task";
        await agent.processUserInput(message);
        return { success: true };
      },
      status: TaskStatus.PENDING,
      priority: 5,
      scheduledTime: new Date(Date.now() - 1000), // Due 1 second ago
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create and execute task
    const createdTask = await modernScheduler.createTask(simpleTask);
    console.log(`Created task with ID: ${createdTask.id}`);
    
    // Execute the task directly instead of using executeDueTasks
    console.log("Executing task directly...");
    const result = await modernScheduler.executeTaskNow(createdTask.id);
    console.log(`Task execution result: ${JSON.stringify(result)}`);
    
    // Verify execution
    expect(result.successful).toBe(true);
    expect(executedTasks.length).toBe(1);
    expect(executedTasks[0]).toBe('Executing simple task');
  });
  
  test('ModularSchedulerManager can handle natural language scheduling', async () => {
    // Simplify this test too
    const dateTimeProcessor = modernScheduler['dateTimeProcessor'];
    
    // Parse "urgent" as a vague term
    const now = new Date();
    const urgentTranslation = dateTimeProcessor.translateVagueTerm('urgent', now);
    expect(urgentTranslation).not.toBeNull();
    
    // Create an urgent task
    const urgentTask: Task = {
      id: '',
      name: 'Urgent Task',
      description: 'Task that needs immediate attention',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: async () => {
        console.log("Urgent task handler called");
        const message = "Executing urgent task";
        await agent.processUserInput(message);
        return { success: true };
      },
      status: TaskStatus.PENDING,
      priority: urgentTranslation?.priority || 10,
      scheduledTime: urgentTranslation?.date as Date,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create and execute task
    const createdTask = await modernScheduler.createTask(urgentTask);
    console.log(`Created urgent task with ID: ${createdTask.id}`);
    
    // Execute the task directly
    console.log("Executing urgent task directly...");
    const result = await modernScheduler.executeTaskNow(createdTask.id);
    console.log(`Urgent task execution result: ${JSON.stringify(result)}`);
    
    // Verify execution
    expect(result.successful).toBe(true);
    expect(executedTasks.length).toBe(1);
    expect(executedTasks[0]).toBe('Executing urgent task');
  });
  
  test('ModularSchedulerManager can autonomously execute due tasks', async () => {
    // Create a simpler test
    const futureTask: Task = {
      id: '',
      name: 'Auto Task',
      description: 'Task that should be executed autonomously',
      scheduleType: TaskScheduleType.EXPLICIT,
      handler: async () => {
        console.log("Auto task handler called");
        const message = "Executing auto task";
        await agent.processUserInput(message);
        return { success: true };
      },
      status: TaskStatus.PENDING,
      priority: 7,
      scheduledTime: new Date(Date.now() + 1000), // Due in 1 second
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create task
    const createdTask = await modernScheduler.createTask(futureTask);
    console.log(`Created auto task with ID: ${createdTask.id}`);
    
    // Start the scheduler's autonomous execution
    console.log("Starting scheduler...");
    await modernScheduler.startScheduler();
    
    // Wait for the task to be executed
    console.log("Waiting for task to be executed...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Stop the scheduler
    console.log("Stopping scheduler...");
    await modernScheduler.stopScheduler();
    
    // Log the executed tasks
    console.log(`Executed tasks: ${JSON.stringify(executedTasks)}`);
    
    // Verify the task was executed
    expect(executedTasks.length).toBe(1);
    expect(executedTasks[0]).toBe('Executing auto task');
  });
}); 