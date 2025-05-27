import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Also try to load from test.env if it exists
try {
  const testEnvPath = path.resolve(process.cwd(), 'test.env');
  if (fs.existsSync(testEnvPath)) {
    console.log('Loading test environment variables from test.env');
    const testEnvConfig = dotenv.parse(fs.readFileSync(testEnvPath));
    
    // Only set the variables that aren't already set in process.env
    for (const key in testEnvConfig) {
      if (!process.env[key]) {
        process.env[key] = testEnvConfig[key];
      }
    }
  }
} catch (error) {
  console.warn('Error loading test.env:', error);
}

import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { StrategyBasedTaskScheduler } from '../../src/lib/scheduler/implementations/scheduler/StrategyBasedTaskScheduler';
import { Task, TaskStatus } from '../../src/lib/scheduler/models/Task.model';
import { MemoryTaskRegistry } from '../../src/lib/scheduler/implementations/registry/MemoryTaskRegistry';
import { ManagerType } from '../../src/agents/shared/base/managers/ManagerType';

describe('Async Tool-Based Task Execution', () => {
  let agent: DefaultAgent;
  let scheduler: StrategyBasedTaskScheduler;
  let taskRegistry: MemoryTaskRegistry;

  beforeAll(async () => {
    // Use memory task registry for fast testing
    taskRegistry = new MemoryTaskRegistry();
    
    // Create scheduler with basic strategy
    scheduler = new StrategyBasedTaskScheduler();
    
    // Create agent with minimal config for testing
    agent = new DefaultAgent({
      id: 'async-test-agent',
      name: 'Async Test Agent',
      componentsConfig: {
        memoryManager: { enabled: true },
        toolManager: { enabled: true },
        schedulerManager: { enabled: true },
        planningManager: { enabled: false },
        knowledgeManager: { enabled: false }
      }
    });

    await agent.initialize();
  });

  afterAll(async () => {
    await agent?.shutdown();
  });

  test('Time-delayed task execution: "in 3 seconds, execute X"', async () => {
    console.log('🎯 Testing time-delayed task execution...');
    
    const startTime = Date.now();
    const delaySeconds = 3;
    
    // User input with explicit time delay
    const userInput = `In ${delaySeconds} seconds, analyze the current time and tell me how many milliseconds have passed since ${startTime}`;
    
    console.log(`📝 User input: "${userInput}"`);
    
    // Process input - should create task, NOT immediate response about time analysis
    const response = await agent.processUserInput(userInput);
    
    expect(response).toBeDefined();
    expect(response.content).toBeTruthy();
    
    // Response should indicate task scheduling, not immediate time analysis
    expect(response.content.toLowerCase()).toMatch(/(scheduled|task|will|minutes?|seconds?)/);
    
    // Should NOT contain actual time analysis yet
    expect(response.content).not.toMatch(/milliseconds have passed/);
    
    console.log(`⚡ Immediate response: "${response.content}"`);
    
    // Check if agent has a scheduler manager that can find tasks
    const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
    if (schedulerManager && typeof (schedulerManager as any).findTasks === 'function') {
      const tasks = await (schedulerManager as any).findTasks({ status: TaskStatus.PENDING });
      
      if (tasks && tasks.length > 0) {
        const ourTask = tasks.find((task: Task) => 
          task.name.toLowerCase().includes('analyze') || 
          task.description?.toLowerCase().includes('milliseconds')
        );
        
        if (ourTask) {
          expect(ourTask.status).toBe(TaskStatus.PENDING);
          console.log(`✅ Task created: ${ourTask.id} - Status: ${ourTask.status}`);
          console.log(`📅 Scheduled for: ${ourTask.scheduledTime || 'immediate'}`);
        } else {
          console.log('⚠️ Specific task not found, but tasks exist');
        }
      } else {
        console.log('ℹ️ No pending tasks found - may indicate immediate execution');
      }
    } else {
      console.log('ℹ️ Scheduler manager not available or compatible');
    }
    
    console.log('✅ Time-delayed task test completed');
  });

  test('Tool-based task with verification: "Find Bitcoin posts and count URLs"', async () => {
    console.log('🎯 Testing tool-based task with verification...');
    
    // This should require tools and take time to execute
    const userInput = "Find 3 posts about Bitcoin from today, summarize the content, and provide the URLs. I want to verify you found exactly 3 URLs in your response.";
    
    console.log(`📝 User input: "${userInput}"`);
    
    const startTime = Date.now();
    const response = await agent.processUserInput(userInput);
    
    expect(response).toBeDefined();
    expect(response.content).toBeTruthy();
    
    console.log(`⚡ Immediate response: "${response.content}"`);
    
    // Should indicate task creation/scheduling, not actual Bitcoin post URLs yet
    const hasTaskIndicators = response.content.toLowerCase().match(/(searching|finding|task|will|look|check)/);
    expect(hasTaskIndicators).toBeTruthy();
    
    // Should NOT have actual URLs or Bitcoin post content yet
    const hasUrlPattern = response.content.match(/https?:\/\/[^\s]+/g);
    expect(hasUrlPattern).toBeFalsy();
    
    // Check if scheduler manager exists and has methods
    const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
    if (schedulerManager && typeof (schedulerManager as any).findTasks === 'function') {
      const tasks = await (schedulerManager as any).findTasks({ status: TaskStatus.PENDING });
      
      const toolTask = tasks?.find((task: Task) => 
        task.name.toLowerCase().includes('bitcoin') || 
        task.name.toLowerCase().includes('posts') ||
        task.description?.toLowerCase().includes('bitcoin')
      );
      
      if (toolTask) {
        console.log(`✅ Tool-based task created: ${toolTask.id}`);
        
        // Monitor task for a short time
        let attempts = 0;
        const maxAttempts = 10; // 10 seconds max
        
        console.log('⏳ Monitoring task execution...');
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
          
          const freshTasks = await (schedulerManager as any).findTasks({ ids: [toolTask.id] });
          if (freshTasks && freshTasks.length > 0) {
            const currentTask = freshTasks[0];
            console.log(`🔄 Attempt ${attempts}: Status = ${currentTask.status}`);
            
            if (currentTask.status === TaskStatus.COMPLETED || currentTask.status === TaskStatus.FAILED) {
              console.log(`🏁 Task finished with status: ${currentTask.status}`);
              break;
            }
          }
        }
      } else {
        console.log('ℹ️ Tool-based task not found in expected format');
      }
    }
    
    console.log('✅ Tool-based task test completed');
  });

  test('Complex multi-step task: "Research and analyze crypto trends"', async () => {
    console.log('🎯 Testing complex multi-step task...');
    
    const userInput = "Research the top 3 trending cryptocurrencies today, check their 24h price changes, find recent news about each one, and create a summary report with recommendations. This should take several steps to complete.";
    
    console.log(`📝 User input: "${userInput}"`);
    
    const startTime = Date.now();
    const response = await agent.processUserInput(userInput);
    
    expect(response).toBeDefined();
    expect(response.content).toBeTruthy();
    
    console.log(`⚡ Immediate response: "${response.content}"`);
    
    // Should indicate complex task creation, not immediate crypto analysis
    expect(response.content.toLowerCase()).toMatch(/(research|analyze|steps|task|will|working)/);
    
    // Should NOT contain specific crypto prices or news yet
    expect(response.content).not.toMatch(/\$[\d,]+\.\d{2}/); // No price patterns
    expect(response.content).not.toMatch(/(bitcoin|ethereum|dogecoin) .*\d+%/); // No specific crypto performance
    
    // Check for complex task creation
    const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
    if (schedulerManager && typeof (schedulerManager as any).findTasks === 'function') {
      const tasks = await (schedulerManager as any).findTasks({ status: TaskStatus.PENDING });
      
      const complexTask = tasks?.find((task: Task) => 
        task.name.toLowerCase().includes('research') || 
        task.name.toLowerCase().includes('crypto') ||
        task.description?.toLowerCase().includes('trending')
      );
      
      if (complexTask) {
        console.log(`✅ Complex task created: ${complexTask.id}`);
        console.log(`📊 Task priority: ${complexTask.priority}`);
        
        // Complex tasks should have reasonable priority
        expect(complexTask.priority).toBeGreaterThan(0);
      } else {
        console.log('ℹ️ Complex task not found in expected format');
      }
    }
    
    console.log('✅ Complex multi-step task test completed');
  });

  test('Task interruption and priority handling', async () => {
    console.log('🎯 Testing task interruption and priority handling...');
    
    // Create a low priority background task
    const backgroundInput = "Organize and analyze my old files, this is low priority and can take time";
    
    console.log(`📝 Background task: "${backgroundInput}"`);
    const backgroundResponse = await agent.processUserInput(backgroundInput);
    expect(backgroundResponse).toBeDefined();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create high priority interruption
    const urgentInput = "URGENT: Stop everything and immediately check the system status - this is critical!";
    
    console.log(`🚨 Urgent interruption: "${urgentInput}"`);
    const urgentResponse = await agent.processUserInput(urgentInput);
    expect(urgentResponse).toBeDefined();
    
    // Wait for task processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check that tasks were handled with appropriate urgency indicators
    const backgroundHasLowPriorityIndicators = backgroundResponse.content.toLowerCase().match(/(low|organize|files|take time)/);
    const urgentHasHighPriorityIndicators = urgentResponse.content.toLowerCase().match(/(urgent|critical|immediately|stop)/);
    
    expect(backgroundHasLowPriorityIndicators).toBeTruthy();
    expect(urgentHasHighPriorityIndicators).toBeTruthy();
    
    console.log('✅ Priority handling verified!');
  });
}); 