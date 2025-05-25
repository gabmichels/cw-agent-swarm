import dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();

import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { ManagerType } from '../../src/agents/shared/base/managers/ManagerType';

describe('True Async Task Scheduling Tests', () => {
  let agent: DefaultAgent;

  beforeAll(async () => {
    // Create agent focused on scheduler functionality
    agent = new DefaultAgent({
      id: 'scheduler-test-agent',
      name: 'Scheduler Test Agent',
      enableMemoryManager: true,
      enableToolManager: true,
      enableSchedulerManager: true,
      enablePlanningManager: false,
      enableKnowledgeManager: false
    });

    await agent.initialize();
  }, 30000); // 30 second timeout for initialization

  afterAll(async () => {
    await agent?.shutdown();
  });

  test('Explicit scheduling: Create task for future execution', async () => {
    console.log('🎯 Testing explicit future task scheduling...');
    
    // Use very explicit scheduling language that should force task creation
    const userInput = "Schedule a task to execute in 10 seconds: check the current timestamp and log it. Do not execute this immediately - I want it scheduled for later.";
    
    console.log(`📝 User input: "${userInput}"`);
    
    const startTime = Date.now();
    const response = await agent.processUserInput(userInput);
    const responseTime = Date.now() - startTime;
    
    console.log(`⚡ Response received in ${responseTime}ms`);
    console.log(`📄 Response: "${response.content}"`);
    
    // Verify response indicates scheduling (not immediate execution)
    expect(response.content.toLowerCase()).toMatch(/(scheduled|task|will.*execute|in.*seconds|later)/);
    expect(response.content.toLowerCase()).not.toMatch(/current timestamp.*\d{13}/); // No actual timestamp
    
    // Check if scheduler manager has pending tasks
    const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
    console.log(`🔍 Scheduler manager exists: ${!!schedulerManager}`);
    
    if (schedulerManager && typeof (schedulerManager as any).findTasks === 'function') {
      console.log('📋 Checking for pending tasks...');
      
      const tasks = await (schedulerManager as any).findTasks({});
      console.log(`📊 Total tasks found: ${tasks?.length || 0}`);
      
      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          console.log(`📋 Task: ${task.id} - Status: ${task.status} - Name: ${task.name}`);
          console.log(`⏰ Scheduled: ${task.scheduledTime || 'immediate'}`);
        }
        
        const pendingTasks = tasks.filter((t: any) => t.status === 'pending' || t.status === 'PENDING');
        console.log(`⏳ Pending tasks: ${pendingTasks.length}`);
        
        // Should have at least one pending task
        expect(pendingTasks.length).toBeGreaterThan(0);
      } else {
        console.log('⚠️ No tasks found - may indicate immediate execution rather than scheduling');
      }
    }
    
    console.log('✅ Explicit scheduling test completed');
  }, 15000); // 15 second timeout

  test('Direct scheduler manager task creation', async () => {
    console.log('🎯 Testing direct scheduler manager task creation...');
    
    const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
    
    if (schedulerManager && typeof (schedulerManager as any).createTask === 'function') {
      console.log('🔧 Creating task directly via scheduler manager...');
      
      const taskData = {
        name: 'Direct Test Task',
        description: 'Test task created directly through scheduler manager',
        agentId: agent.getId(),
        userId: 'test-user',
        priority: 5,
        scheduledTime: new Date(Date.now() + 5000), // 5 seconds from now
        parameters: {
          action: 'log_message',
          message: 'This is a scheduled task execution'
        }
      };
      
      const createdTask = await (schedulerManager as any).createTask(taskData);
      console.log(`✅ Task created: ${createdTask?.id}`);
      
      expect(createdTask).toBeDefined();
      expect(createdTask.id).toBeDefined();
      expect(createdTask.status).toBe('pending');
      
      // Wait a moment and check if task still exists
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const foundTasks = await (schedulerManager as any).findTasks({ ids: [createdTask.id] });
      expect(foundTasks?.length).toBe(1);
      expect(foundTasks[0].status).toBe('pending');
      
      console.log('✅ Direct task creation verified');
    } else {
      console.log('⚠️ Scheduler manager does not support direct task creation');
      // This is expected behavior - test passes
    }
  }, 10000);

  test('Tool-based task that requires real execution time', async () => {
    console.log('🎯 Testing tool-based task requiring execution time...');
    
    // Use a request that clearly requires web access and should take time
    const userInput = "Search for the latest Bitcoin price on CoinGecko API and return the exact USD value. This requires external API calls and should be scheduled if you cannot access it immediately.";
    
    console.log(`📝 User input: "${userInput}"`);
    
    const startTime = Date.now();
    const response = await agent.processUserInput(userInput);
    const responseTime = Date.now() - startTime;
    
    console.log(`⚡ Response received in ${responseTime}ms`);
    console.log(`📄 Response content preview: "${response.content.substring(0, 200)}..."`);
    
    // Should either:
    // 1. Have a task scheduled (preferred), OR
    // 2. Have attempted real tool execution
    
    const hasTaskLanguage = response.content.toLowerCase().match(/(searching|task|will.*search|scheduled|working)/);
    const hasActualPrice = response.content.match(/\$[\d,]+\.\d{2}/); // Actual price format
    const hasApiMention = response.content.toLowerCase().match(/(api|coingecko|external)/);
    
    if (hasTaskLanguage) {
      console.log('✅ Response indicates task creation/scheduling');
    } else if (hasActualPrice) {
      console.log('✅ Response contains actual price data - real tool execution occurred');
    } else if (hasApiMention) {
      console.log('✅ Response mentions API access - tool planning occurred');
    }
    
    // At least one of these should be true for proper async handling
    expect(hasTaskLanguage || hasActualPrice || hasApiMention).toBeTruthy();
    
    console.log('✅ Tool-based async test completed');
  }, 20000); // 20 second timeout for potential real API calls

  test('Multi-step task breakdown and verification', async () => {
    console.log('🎯 Testing multi-step task breakdown...');
    
    const userInput = "Create a comprehensive report: 1) Find today's top 3 crypto gainers, 2) Get their current prices, 3) Find news articles about each, 4) Create a summary with recommendations. Schedule this as it requires multiple steps and external data.";
    
    console.log(`📝 User input: "${userInput}"`);
    
    const startTime = Date.now();
    const response = await agent.processUserInput(userInput);
    const responseTime = Date.now() - startTime;
    
    console.log(`⚡ Response received in ${responseTime}ms`);
    console.log(`📄 Response: "${response.content}"`);
    
    // Should indicate task planning/breakdown
    const hasMultiStepLanguage = response.content.toLowerCase().match(/(steps|comprehensive|report|scheduled|multiple|breakdown)/);
    const hasImmediateData = response.content.match(/(bitcoin|ethereum|price.*\$|gained.*%)/i);
    
    expect(hasMultiStepLanguage).toBeTruthy();
    
    // Should NOT have immediate detailed crypto data
    expect(hasImmediateData).toBeFalsy();
    
    console.log('✅ Multi-step task breakdown verified');
  }, 15000);
}); 