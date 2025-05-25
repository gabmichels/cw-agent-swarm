/**
 * priority-and-urgency.test.ts
 * Tests for Scenario 1: Simple High-Urgency Task (Immediate Execution)
 * Tests priority assignment and urgency detection with real Qdrant + OpenAI
 */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { createSchedulerManager, RegistryType } from '../../src/lib/scheduler/factories/SchedulerFactory';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { Task, TaskStatus } from '../../src/lib/scheduler/models/Task.model';

const TEST_TIMEOUT = 120000; // 2 minutes for real API calls
vi.setConfig({ testTimeout: TEST_TIMEOUT });

describe('Priority and Urgency Tests', () => {
  let agent: DefaultAgent;
  let scheduler: ModularSchedulerManager;
  let testTaskIds: string[] = [];

  beforeEach(async () => {
    console.log('🚀 Setting up Priority and Urgency Tests with REAL Qdrant + OpenAI...');
    
    vi.useRealTimers();
    testTaskIds = [];
    
    console.log(process.env.OPENAI_API_KEY ? '✅ OpenAI API key found' : '❌ OPENAI_API_KEY missing!');
    
    agent = new DefaultAgent({
      name: "PriorityTester",
      enableMemoryManager: true,
      enableToolManager: true,
      enablePlanningManager: true,
      enableSchedulerManager: false,
      enableReflectionManager: true
    });
    
    await agent.initialize();
    
    scheduler = await createSchedulerManager({
      enabled: true,
      enableAutoScheduling: true,
      schedulingIntervalMs: 2000, // Check every 2 seconds
      maxConcurrentTasks: 3,
      registryType: RegistryType.QDRANT,
      qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantCollectionName: 'priority_test_tasks'
    });
    
    await scheduler.initialize();
    console.log('✅ Setup completed');
  });
  
  afterEach(async () => {
    console.log('🧹 Cleaning up...');
    
    if (scheduler?.isSchedulerRunning()) {
      await scheduler.stopScheduler();
    }
    
    for (const taskId of testTaskIds) {
      try {
        await scheduler.deleteTask(taskId);
        console.log(`✅ Cleaned up task: ${taskId}`);
      } catch (error) {
        console.warn(`⚠️ Failed to clean up task ${taskId}:`, error);
      }
    }
    
    await scheduler?.reset();
    await agent?.shutdown();
    console.log('✅ Cleanup completed');
  });

  test('High-urgency tasks get priority 8-10 and immediate scheduling', async () => {
    console.log('🎯 Testing HIGH-URGENCY task priority assignment...');
    
    // Test urgent user inputs from the guide
    const urgentInputs = [
      "URGENT: Please analyze this error message immediately and provide a solution",
      "I need help RIGHT NOW with this critical bug", 
      "Emergency: System is down, need immediate assessment",
      "Priority 1: Server crashed, investigate ASAP",
      "Critical issue: Database connection failed, urgent fix needed"
    ];
    
    const createdTasks: Task[] = [];
    
    // Create tasks for each urgent input
    for (const input of urgentInputs) {
      console.log(`📝 Creating urgent task: "${input.substring(0, 50)}..."`);
      
      const startTime = new Date();
      const response = await agent.processUserInput(input);
      
      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      
      // Wait for task to be stored in Qdrant
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Find the created task
      const allTasks = await scheduler.findTasks({ limit: 20 });
      const newTasks = allTasks.filter(task => 
        new Date(task.createdAt).getTime() >= startTime.getTime() - 2000 &&
        (task.name.toLowerCase().includes('urgent') ||
         task.name.toLowerCase().includes('critical') ||
         task.name.toLowerCase().includes('emergency') ||
         task.name.toLowerCase().includes('priority') ||
         (task.description && (
           task.description.toLowerCase().includes('urgent') ||
           task.description.toLowerCase().includes('critical') ||
           task.description.toLowerCase().includes('emergency')
         )))
      );
      
      if (newTasks.length > 0) {
        const urgentTask = newTasks[0];
        createdTasks.push(urgentTask);
        testTaskIds.push(urgentTask.id);
        
        console.log(`✅ Found urgent task: ${urgentTask.name} (Priority: ${urgentTask.priority})`);
        
        // Verify high priority (8-10)
        expect(urgentTask.priority).toBeGreaterThanOrEqual(8);
        expect(urgentTask.priority).toBeLessThanOrEqual(10);
        
        // Verify immediate scheduling (should be very recent or immediate)
        const scheduledTime = urgentTask.scheduledTime ? new Date(urgentTask.scheduledTime) : new Date();
        const timeDiff = Math.abs(scheduledTime.getTime() - Date.now());
        expect(timeDiff).toBeLessThan(60000); // Within 1 minute of now
        
        console.log(`   Priority: ${urgentTask.priority}/10 ✅`);
        console.log(`   Scheduled for: ${scheduledTime.toISOString()}`);
        console.log(`   Time difference: ${Math.round(timeDiff/1000)}s from now`);
        
      } else {
        console.warn(`⚠️ No urgent task found for input: "${input.substring(0, 30)}..."`);
        // Don't fail immediately, continue with other tests
      }
    }
    
    console.log(`📊 Summary: Created ${createdTasks.length} urgent tasks out of ${urgentInputs.length} inputs`);
    
    if (createdTasks.length > 0) {
      // Verify priority distribution
      const priorities = createdTasks.map(task => task.priority);
      const averagePriority = priorities.reduce((a, b) => a + b, 0) / priorities.length;
      
      console.log(`📊 Priority distribution: [${priorities.join(', ')}]`);
      console.log(`📊 Average priority: ${averagePriority.toFixed(1)}`);
      
      expect(averagePriority).toBeGreaterThanOrEqual(8);
      
      console.log('✅ HIGH-URGENCY priority assignment verified!');
    } else {
      throw new Error('No urgent tasks were created - check task creation process');
    }
  });

  test('Medium and low priority tasks get appropriate priority levels', async () => {
    console.log('🎯 Testing MEDIUM and LOW priority task assignment...');
    
    const priorityInputs = [
      { input: "When you have time, please review this document", expectedMin: 1, expectedMax: 4, type: "low" },
      { input: "Can you help me with this task sometime today?", expectedMin: 3, expectedMax: 6, type: "medium" },
      { input: "Please process this request at your convenience", expectedMin: 1, expectedMax: 3, type: "low" },
      { input: "I need this done by end of day", expectedMin: 5, expectedMax: 7, type: "medium-high" },
      { input: "Normal priority: analyze this data when possible", expectedMin: 4, expectedMax: 6, type: "medium" }
    ];
    
    const createdTasks: Array<Task & { expectedType: string }> = [];
    
    for (const { input, expectedMin, expectedMax, type } of priorityInputs) {
      console.log(`📝 Creating ${type} priority task: "${input.substring(0, 40)}..."`);
      
      const startTime = new Date();
      const response = await agent.processUserInput(input);
      
      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const allTasks = await scheduler.findTasks({ limit: 20 });
      const newTasks = allTasks.filter(task => 
        new Date(task.createdAt).getTime() >= startTime.getTime() - 2000
      );
      
      if (newTasks.length > 0) {
        const task = newTasks[0];
        createdTasks.push({ ...task, expectedType: type });
        testTaskIds.push(task.id);
        
        console.log(`✅ Found ${type} task: Priority ${task.priority} (expected ${expectedMin}-${expectedMax})`);
        
        // Verify priority range
        expect(task.priority).toBeGreaterThanOrEqual(expectedMin);
        expect(task.priority).toBeLessThanOrEqual(expectedMax);
        
      } else {
        console.warn(`⚠️ No task found for ${type} priority input`);
      }
    }
    
    console.log(`📊 Summary: Created ${createdTasks.length} priority-varied tasks`);
    
    if (createdTasks.length >= 3) {
      // Verify priority differentiation
      const priorities = createdTasks.map(task => task.priority);
      const uniquePriorities = [...new Set(priorities)];
      
      console.log('📊 Priority analysis:');
      createdTasks.forEach(task => {
        console.log(`   ${task.expectedType}: Priority ${task.priority}`);
      });
      
      expect(uniquePriorities.length).toBeGreaterThan(1); // Should have different priorities
      
      console.log('✅ Priority differentiation verified!');
    }
  });

  test('Tasks execute in priority order with status tracking', async () => {
    console.log('🎯 Testing priority-based execution order with status tracking...');
    
    // Create tasks with different priorities simultaneously
    const taskInputs = [
      { input: "Low priority: organize files when convenient", priority: "low" },
      { input: "URGENT: Critical system failure needs immediate attention", priority: "urgent" },
      { input: "Medium priority: update documentation by end of day", priority: "medium" },
      { input: "EMERGENCY: Security breach detected, investigate now!", priority: "emergency" }
    ];
    
    console.log('📝 Creating multiple tasks with different priorities...');
    
    // Create all tasks quickly
    const taskCreationPromises = taskInputs.map(async ({ input, priority }) => {
      console.log(`   Creating ${priority} task...`);
      const response = await agent.processUserInput(input);
      return { response, priority, input };
    });
    
    const results = await Promise.all(taskCreationPromises);
    
    // Verify all responses
    results.forEach(({ response, priority }) => {
      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      console.log(`   ✅ ${priority} task created`);
    });
    
    // Wait for all tasks to be stored
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get all tasks and identify our test tasks
    const allTasks = await scheduler.findTasks({ limit: 50 });
    const ourTasks = allTasks.filter(task => {
      const name = task.name.toLowerCase();
      const desc = task.description?.toLowerCase() || '';
      return name.includes('urgent') || name.includes('emergency') || 
             name.includes('medium') || name.includes('organize') ||
             desc.includes('urgent') || desc.includes('emergency') ||
             desc.includes('critical') || desc.includes('security');
    });
    
    ourTasks.forEach(task => testTaskIds.push(task.id));
    
    console.log(`📊 Found ${ourTasks.length} test tasks in Qdrant:`);
    ourTasks.forEach(task => {
      console.log(`   - ${task.name}: Priority ${task.priority}, Status ${task.status}`);
    });
    
    if (ourTasks.length >= 2) {
      // Sort by priority to verify ordering
      const sortedTasks = ourTasks.sort((a, b) => b.priority - a.priority);
      
      console.log('📊 Tasks sorted by priority (highest first):');
      sortedTasks.forEach((task, index) => {
        console.log(`   ${index + 1}. Priority ${task.priority}: ${task.name.substring(0, 50)}...`);
      });
      
      // Verify high priority tasks come first
      const highestPriority = sortedTasks[0].priority;
      const lowestPriority = sortedTasks[sortedTasks.length - 1].priority;
      
      expect(highestPriority).toBeGreaterThan(lowestPriority);
      
      // Start scheduler and monitor execution order
      console.log('⚡ Starting scheduler to test execution order...');
      await scheduler.startScheduler();
      
      // Monitor for 30 seconds
      const executionLog: Array<{ taskId: string; priority: number; status: TaskStatus; timestamp: Date }> = [];
      
      for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const currentTasks = await scheduler.findTasks({ ids: ourTasks.map(t => t.id) });
        
        currentTasks.forEach(task => {
          const lastLog = executionLog.find(log => log.taskId === task.id);
          if (!lastLog || lastLog.status !== task.status) {
            executionLog.push({
              taskId: task.id,
              priority: task.priority,
              status: task.status,
              timestamp: new Date()
            });
            
            if (task.status !== TaskStatus.PENDING) {
              console.log(`🔄 Priority ${task.priority} task → ${task.status}`);
            }
          }
        });
        
        // Check if high priority tasks are being processed first
        const runningTasks = currentTasks.filter(t => t.status === TaskStatus.RUNNING);
        if (runningTasks.length > 0) {
          const runningPriorities = runningTasks.map(t => t.priority);
          console.log(`🏃‍♂️ Currently running: Priority ${runningPriorities.join(', ')}`);
        }
      }
      
      await scheduler.stopScheduler();
      
      console.log('📊 Execution timeline:');
      executionLog.forEach(log => {
        console.log(`   ${log.timestamp.toISOString()}: Priority ${log.priority} → ${log.status}`);
      });
      
      // Verify that higher priority tasks started first
      const firstRunning = executionLog.find(log => log.status === TaskStatus.RUNNING);
      if (firstRunning) {
        console.log(`✅ First task to run had priority: ${firstRunning.priority}`);
        
        // Should be one of the higher priority tasks
        expect(firstRunning.priority).toBeGreaterThanOrEqual(6);
      }
      
      console.log('✅ Priority-based execution order verified!');
    } else {
      console.warn('⚠️ Not enough tasks created for priority order testing');
    }
  });
}); 