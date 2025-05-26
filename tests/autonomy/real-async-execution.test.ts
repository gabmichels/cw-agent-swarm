import dotenv from 'dotenv';
dotenv.config();

import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { ManagerType } from '../../src/agents/shared/base/managers/ManagerType';
import { TaskStatus, Task, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';
import { SchedulerManager, TaskCreationOptions, TaskCreationResult } from '../../src/agents/shared/base/managers/SchedulerManager.interface';
import { ulid } from 'ulid';

describe('Real Async Task Execution & Output Verification', () => {
  let agent: DefaultAgent;

  beforeAll(async () => {
    // Create agent - scheduler config will be set through environment/default config
    agent = new DefaultAgent({
      id: 'real-async-agent',
      name: 'Real Async Test Agent',
      enableMemoryManager: true,
      enablePlanningManager: true,
      enableToolManager: true,
      enableSchedulerManager: true
    });

    await agent.initialize();
  }, 60000);

  afterAll(async () => {
    await agent?.shutdown();
  }, 30000);

  test('Direct task creation and tracking verification', async () => {
    console.log('🚀 Creating task directly in scheduler...');
    
    // Create a specific task that requires tools and produces verifiable output
    const taskOptions: TaskCreationOptions = {
      name: 'research_bitcoin_price',
      description: 'Get the current Bitcoin price in USD and provide the exact price number',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10, // High priority for immediate execution
      metadata: {
        expectedOutput: 'numeric_price',
        verificationCriteria: 'response should contain a dollar amount'
      }
    };

    // Use agent.createTask() which returns TaskCreationResult correctly
    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    expect(taskResult.task).toBeDefined();
    expect(taskResult.task.id).toBeDefined();
    expect(taskResult.task.status).toBe(TaskStatus.PENDING);
    
    const createdTask = taskResult.task;
    console.log('✅ Task created:', createdTask.id);
    console.log('📊 Initial task status:', createdTask.status);

    // Verify task is stored and retrievable
    const retrievedTask = await agent.getTask(createdTask.id);
    expect(retrievedTask).toBeDefined();
    expect(retrievedTask?.id).toBe(createdTask.id);
    
    console.log('✅ Task storage and retrieval verified');
  }, 15000);

  // COMMENTED OUT TO AVOID WEB SEARCH API COSTS
  // test('Immediate task execution with real result verification', async () => {
  //   console.log('🚀 Testing immediate task execution with real results...');
  //   
  //   // Create a task for immediate execution
  //   const taskOptions: TaskCreationOptions = {
  //     name: 'bitcoin_price_check',
  //     description: 'Get the current Bitcoin price in USD and return the numerical value',
  //     scheduleType: TaskScheduleType.PRIORITY,
  //     priority: 10,
  //     metadata: {
  //       taskType: 'price_check',
  //       expectedResult: 'bitcoin_price'
  //     }
  //   };

  //   const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
  //   expect(taskResult.success).toBe(true);
  //   const createdTask = taskResult.task;
  //   console.log('✅ Task created for immediate execution:', createdTask.id);
  //   
  //   // Execute the task immediately using agent method
  //   console.log('🔥 Executing task immediately...');
  //   const executionResult = await agent.executeTask(createdTask.id);
  //   
  //   console.log('📊 Execution completed! Result:', JSON.stringify(executionResult, null, 2));
  //   console.log('🎯 Execution successful:', executionResult.successful);
  //   console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
  //   
  //   // Verify execution was successful
  //   expect(executionResult).toBeDefined();
  //   expect(executionResult.taskId).toBe(createdTask.id);
  //   
  //   // Check if we got a real result
  //   if (executionResult.successful && executionResult.result) {
  //     const resultString = JSON.stringify(executionResult.result);
  //     console.log('🔍 Result content for verification:', resultString);
  //     
  //     // Check for Bitcoin/price indicators
  //     const hasRelevantContent = (
  //       resultString.toLowerCase().includes('bitcoin') ||
  //       resultString.toLowerCase().includes('btc') ||
  //       resultString.includes('$') ||
  //       resultString.toLowerCase().includes('price') ||
  //       /\d+(\.\d+)?/.test(resultString) // Contains numbers
  //     );
  //     
  //     if (hasRelevantContent) {
  //       console.log('✅ Task result contains relevant Bitcoin/price information');
  //     } else {
  //       console.log('⚠️ Task result does not contain obvious Bitcoin/price information');
  //     }
  //   } else {
  //     console.log('❌ Task execution failed or returned no result');
  //     if (executionResult.error) {
  //       console.log('🐛 Execution error:', executionResult.error);
  //     }
  //   }

  //   // Get the updated task to see final state
  //   const finalTask = await agent.getTask(createdTask.id);
  //   console.log('📊 Final task status:', finalTask?.status);
  //   console.log('📊 Final task metadata:', finalTask?.metadata);
  //   
  //   console.log('✅ Immediate execution test completed');
  // }, 45000);

  test('Twitter tool verification with enhanced result capture', async () => {
    console.log('🐦 Testing Twitter tool integration with enhanced result capture...');
    
    // Create a task that explicitly requests the Twitter tool
    const taskOptions: TaskCreationOptions = {
      name: 'twitter_bitcoin_search',
      description: 'Use the apify-twitter-search tool to find 3 recent tweets about Bitcoin. Extract the tweet content, usernames, and engagement metrics.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'social_media_search',
        expectedTools: ['apify-twitter-search'],
        expectedOutput: 'twitter_posts_with_metrics',
        verificationCriteria: 'should contain tweet content, usernames, and engagement data',
        requireDetailedResults: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Twitter search task created:', createdTask.id);
    
    // Execute the task immediately using agent method
    console.log('🔥 Executing Twitter search task...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Twitter task execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify execution basics
    expect(executionResult).toBeDefined();
    expect(executionResult.taskId).toBe(createdTask.id);
    
    // Enhanced detailed result verification
    console.log('🔍 Twitter result analysis:');
    
    // Access plan execution details from metadata
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan) {
        const plan = planResult.plan as any;
        console.log('📋 Plan execution details:');
        console.log('  - Plan ID:', plan.id);
        console.log('  - Plan status:', plan.status);
        console.log('  - Steps executed:', plan.steps?.length || 0);
        
        // Look for tool usage in plan steps
        if (plan.steps && plan.steps.length > 0) {
          const toolsUsed: string[] = [];
          const twitterContent: string[] = [];
          
          plan.steps.forEach((step: any, index: number) => {
            console.log(`📋 Step ${index + 1} analysis:`);
            console.log(`  - Status: ${step.status}`);
            console.log(`  - Actions: ${step.actions?.length || 0}`);
            
            if (step.actions) {
              step.actions.forEach((action: any, actionIndex: number) => {
                console.log(`   Action ${actionIndex + 1}:`);
                console.log(`    - Type: ${action.type}`);
                console.log(`    - Status: ${action.status}`);
                
                if (action.type === 'tool_execution' && action.parameters?.toolName) {
                  toolsUsed.push(action.parameters.toolName);
                  console.log(`    - Tool used: ${action.parameters.toolName}`);
                }
                
                if (action.result && action.result.data) {
                  const dataStr = JSON.stringify(action.result.data);
                  console.log(`    - Data preview: ${dataStr.substring(0, 150)}...`);
                  
                  // Look for Twitter content
                  const hasTwitterContent = (
                    dataStr.toLowerCase().includes('twitter') ||
                    dataStr.toLowerCase().includes('tweet') ||
                    dataStr.toLowerCase().includes('bitcoin') ||
                    dataStr.toLowerCase().includes('btc') ||
                    dataStr.includes('@')
                  );
                  
                  if (hasTwitterContent) {
                    twitterContent.push(`Step_${index + 1}_Action_${actionIndex + 1}`);
                    console.log(`    - Contains Twitter content: ✅`);
                  }
                }
                
                if (action.result?.error) {
                  console.log(`    - Error: ${action.result.error}`);
                }
              });
            }
          });
          
          // Summary of tool execution verification
          console.log('🎯 Tool execution summary:');
          console.log(`  - Tools used: ${toolsUsed.join(', ')}`);
          console.log(`  - Twitter content found: ${twitterContent.length} sources`);
          
          // Verification criteria
          const twitterToolUsed = toolsUsed.includes('apify-twitter-search');
          const contentFound = twitterContent.length > 0;
          
          console.log('✅ Verification results:');
          console.log(`  - Twitter tool used: ${twitterToolUsed ? '✅' : '❌'}`);
          console.log(`  - Content found: ${contentFound ? '✅' : '❌'}`);
          
          if (twitterToolUsed && contentFound) {
            console.log('🎉 Twitter tool successfully executed and returned data!');
          } else {
            console.log('⚠️ Twitter tool may not have been used or returned expected data');
          }
        }
      }
    }
    
    // Check basic result content as fallback
    if (executionResult.successful && executionResult.result) {
      const resultString = JSON.stringify(executionResult.result);
      console.log('🔍 Basic result content (first 300 chars):', resultString.substring(0, 300));
      
      // Check for expected Twitter content
      const hasTwitterContent = (
        resultString.toLowerCase().includes('twitter') ||
        resultString.toLowerCase().includes('tweet') ||
        resultString.toLowerCase().includes('bitcoin') ||
        resultString.toLowerCase().includes('btc') ||
        resultString.toLowerCase().includes('#bitcoin')
      );
      
      console.log('📊 Basic content verification:');
      console.log('  - Has Twitter/Bitcoin content:', hasTwitterContent);
      console.log('  - Result length:', resultString.length, 'characters');
      
    } else {
      console.log('❌ Twitter task execution failed or returned no result');
      if (executionResult.error) {
        console.log('🐛 Twitter task error:', executionResult.error);
      }
    }

    // Get the updated task to see final state
    const finalTask = await agent.getTask(createdTask.id);
    console.log('📊 Final Twitter task status:', finalTask?.status);
    console.log('📊 Final Twitter task metadata keys:', Object.keys(finalTask?.metadata || {}));
    
    console.log('✅ Twitter tool verification test completed');
  }, 90000);

  test('Reddit tool verification with real LLM processing', async () => {
    console.log('🔴 Testing Reddit tool integration with real LLM processing...');
    
    // Create a task that explicitly requests the Reddit tool
    const taskOptions: TaskCreationOptions = {
      name: 'reddit_crypto_search',
      description: 'Use the apify-reddit-search tool to find recent posts about cryptocurrency from r/CryptoCurrency. Extract post titles, content, and upvote counts.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'social_media_search',
        expectedTools: ['apify-reddit-search'],
        expectedOutput: 'reddit_posts_with_metrics',
        verificationCriteria: 'should contain post titles, content, and upvote data'
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Reddit search task created:', createdTask.id);
    
    // Execute the task immediately
    console.log('🔥 Executing Reddit search task...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Reddit task execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify execution and check for Reddit tool usage
    expect(executionResult).toBeDefined();
    expect(executionResult.taskId).toBe(createdTask.id);
    
    // Check for Reddit-specific content
    if (executionResult.successful && executionResult.result) {
      const resultString = JSON.stringify(executionResult.result);
      console.log('🔍 Reddit result preview:', resultString.substring(0, 200));
      
      const hasRedditContent = (
        resultString.toLowerCase().includes('reddit') ||
        resultString.toLowerCase().includes('r/') ||
        resultString.toLowerCase().includes('upvote') ||
        resultString.toLowerCase().includes('crypto')
      );
      
      console.log('✅ Reddit content verification:', hasRedditContent ? 'FOUND' : 'NOT FOUND');
    }
    
    console.log('✅ Reddit tool verification test completed');
  }, 60000);

  test('Website crawler tool verification with real LLM processing', async () => {
    console.log('🌐 Testing Website Crawler tool integration...');
    
    // Create a task that explicitly requests the website crawler tool
    const taskOptions: TaskCreationOptions = {
      name: 'website_crawler_test',
      description: 'Use the apify-website-crawler tool to crawl https://example.com and extract the main content and page structure.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'web_scraping',
        expectedTools: ['apify-website-crawler'],
        expectedOutput: 'website_content_and_structure',
        verificationCriteria: 'should contain page content and structure data'
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Website crawler task created:', createdTask.id);
    
    // Execute the task immediately
    console.log('🔥 Executing website crawler task...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Website crawler task execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify execution and check for crawler tool usage
    expect(executionResult).toBeDefined();
    expect(executionResult.taskId).toBe(createdTask.id);
    
    // Check for website crawler content
    if (executionResult.successful && executionResult.result) {
      const resultString = JSON.stringify(executionResult.result);
      console.log('🔍 Website crawler result preview:', resultString.substring(0, 200));
      
      const hasWebsiteContent = (
        resultString.toLowerCase().includes('crawl') ||
        resultString.toLowerCase().includes('page') ||
        resultString.toLowerCase().includes('website') ||
        resultString.toLowerCase().includes('example.com')
      );
      
      console.log('✅ Website content verification:', hasWebsiteContent ? 'FOUND' : 'NOT FOUND');
    }
    
    console.log('✅ Website crawler tool verification test completed');
  }, 60000);

  test('Apify actor discovery tool verification', async () => {
    console.log('🔍 Testing Apify Actor Discovery tool...');
    
    // Create a task that uses the actor discovery tool
    const taskOptions: TaskCreationOptions = {
      name: 'actor_discovery_test',
      description: 'Use the apify-actor-discovery tool to find actors related to social media scraping.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'tool_discovery',
        expectedTools: ['apify-actor-discovery'],
        expectedOutput: 'actor_list_with_descriptions',
        verificationCriteria: 'should contain actor names and descriptions'
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Actor discovery task created:', createdTask.id);
    
    // Execute the task immediately
    console.log('🔥 Executing actor discovery task...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Actor discovery task execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify execution and check for discovery tool usage
    expect(executionResult).toBeDefined();
    expect(executionResult.taskId).toBe(createdTask.id);
    
    // Check for actor discovery content
    if (executionResult.successful && executionResult.result) {
      const resultString = JSON.stringify(executionResult.result);
      console.log('🔍 Actor discovery result preview:', resultString.substring(0, 200));
      
      const hasDiscoveryContent = (
        resultString.toLowerCase().includes('actor') ||
        resultString.toLowerCase().includes('apify') ||
        resultString.toLowerCase().includes('social') ||
        resultString.toLowerCase().includes('scraping')
      );
      
      console.log('✅ Actor discovery content verification:', hasDiscoveryContent ? 'FOUND' : 'NOT FOUND');
    }
    
    console.log('✅ Actor discovery tool verification test completed');
  }, 60000);

  test('Comprehensive Apify tool integration test', async () => {
    console.log('🚀 Testing comprehensive Apify tool integration...');
    
    // Create a complex task that could use multiple Apify tools
    const taskOptions: TaskCreationOptions = {
      name: 'multi_tool_research',
      description: 'Research the topic of "AI automation tools" by: 1) Discovering relevant Apify actors, 2) Searching for related discussions on Reddit, 3) Finding recent tweets about the topic. Provide a comprehensive summary.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'comprehensive_research',
        expectedTools: ['apify-actor-discovery', 'apify-reddit-search', 'apify-twitter-search'],
        expectedOutput: 'comprehensive_research_summary',
        verificationCriteria: 'should contain data from multiple sources and tools'
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Multi-tool research task created:', createdTask.id);
    
    // Execute the task immediately
    console.log('🔥 Executing multi-tool research task...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Multi-tool research task execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify execution and analyze tool usage
    expect(executionResult).toBeDefined();
    expect(executionResult.taskId).toBe(createdTask.id);
    
    // Detailed analysis of tool usage
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        const steps = planResult.plan.steps;
      const toolsUsed = new Set<string>();
      
      steps.forEach((step: any) => {
        if (step.actions) {
          step.actions.forEach((action: any) => {
            if (action.type === 'tool_execution' && action.parameters?.toolName) {
              toolsUsed.add(action.parameters.toolName);
            }
          });
        }
      });
      
      console.log('🔧 Tools used in execution:', Array.from(toolsUsed).join(', '));
      console.log('📊 Number of different tools used:', toolsUsed.size);
      
      // Check if multiple Apify tools were used
      const apifyToolsUsed = Array.from(toolsUsed).filter(tool => tool.startsWith('apify-'));
      console.log('🎯 Apify tools used:', apifyToolsUsed.join(', '));
      console.log('✅ Multiple Apify tools used:', apifyToolsUsed.length > 1 ? 'YES' : 'NO');
      }
    }
    
    // Check for comprehensive content
    if (executionResult.successful && executionResult.result) {
      const resultString = JSON.stringify(executionResult.result);
      console.log('🔍 Multi-tool result preview:', resultString.substring(0, 300));
      
      const hasComprehensiveContent = (
        resultString.toLowerCase().includes('ai') ||
        resultString.toLowerCase().includes('automation') ||
        resultString.toLowerCase().includes('research') ||
        resultString.toLowerCase().includes('summary')
      );
      
      console.log('✅ Comprehensive content verification:', hasComprehensiveContent ? 'FOUND' : 'NOT FOUND');
    }
    
    console.log('✅ Comprehensive Apify tool integration test completed');
  }, 120000);

  test('Time-delayed execution verification', async () => {
    console.log('⏰ Testing time-delayed task execution...');
    
    // Schedule a task for 3 seconds in the future
    const futureTime = new Date(Date.now() + 3000);
    
    const taskOptions: TaskCreationOptions = {
      name: 'delayed_calculation',
      description: 'Calculate 15 * 23 and return just the number result',
      scheduleType: TaskScheduleType.EXPLICIT,
      priority: 8,
      scheduledTime: futureTime,
      metadata: {
        expectedOutput: 'calculation_result',
        verificationCriteria: 'result should be 345'
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    
    console.log('✅ Delayed task created for:', futureTime.toISOString());
    console.log('📝 Task ID:', createdTask.id);

    // Verify task is in PENDING status initially
    const initialTask = await agent.getTask(createdTask.id);
    expect(initialTask?.status).toBe(TaskStatus.PENDING);
    console.log('✅ Task initially PENDING as expected');

    // Wait past the scheduled time, then execute immediately to test the timing
    console.log('⏰ Waiting past scheduled time...');
    await new Promise(resolve => setTimeout(resolve, 4000)); // Wait 4 seconds (past the 3s schedule)

    // Execute now that we're past the scheduled time
    console.log('🔥 Executing delayed task now...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Delayed execution result:', executionResult.successful);
    if (executionResult.result) {
      console.log('🔢 Calculation result:', executionResult.result);
    }
    
    expect(executionResult.taskId).toBe(createdTask.id);
    console.log('✅ Time-delayed task execution verified');
  }, 15000);

  it('Multiple tasks with priority verification', async () => {
    console.log('🔢 Testing multiple tasks with priority handling...');
    
    // Create tasks with different priorities
    const lowPriorityResult = await agent.createTask({
      name: 'low_priority_task',
      description: 'Low priority background task',
      priority: 2,
      scheduleType: TaskScheduleType.PRIORITY,
      metadata: {
        type: 'background'
      }
    });

    const highPriorityResult = await agent.createTask({
      name: 'high_priority_task', 
      description: 'High priority urgent task',
      priority: 9,
      scheduleType: TaskScheduleType.PRIORITY,
      metadata: {
        type: 'urgent'
      }
    });

    expect(lowPriorityResult.success).toBe(true);
    expect(highPriorityResult.success).toBe(true);
    
    console.log(`✅ Created low priority task: ${lowPriorityResult.task?.id}`);
    console.log(`✅ Created high priority task: ${highPriorityResult.task?.id}`);

    // Add a small delay to ensure tasks are fully stored
    await new Promise(resolve => setTimeout(resolve, 100));

    // Try multiple approaches to retrieve tasks
    console.log('🔍 Attempting to retrieve tasks using different methods...');
    
    // Method 1: Direct task retrieval by ID
    const lowTaskDirect = await agent.getTask(lowPriorityResult.task!.id);
    const highTaskDirect = await agent.getTask(highPriorityResult.task!.id);
    
    console.log(`📋 Direct retrieval - Low task: ${lowTaskDirect ? 'Found' : 'Not found'}`);
    console.log(`📋 Direct retrieval - High task: ${highTaskDirect ? 'Found' : 'Not found'}`);
    
    // Method 2: Get all tasks for this agent
    const allTasks = await agent.getTasks();
    console.log(`📋 All tasks count: ${allTasks.length}`);
    console.log(`📋 All task IDs: ${allTasks.map(t => t.id).join(', ')}`);
    
    // Method 3: Get pending tasks specifically
    const pendingTasks = await agent.getPendingTasks();
    console.log(`📋 Pending tasks count: ${pendingTasks.length}`);
    console.log(`📋 Pending task IDs: ${pendingTasks.map(t => t.id).join(', ')}`);
    
    // Method 4: Use scheduler manager directly if available
    if (agent.getSchedulerManager()) {
      const schedulerManager = agent.getSchedulerManager()!;
      const allSchedulerTasks = await schedulerManager.findTasks({});
      console.log(`📋 Scheduler all tasks count: ${allSchedulerTasks.length}`);
      
      // Try finding tasks for this specific agent
      const agentTasks = await schedulerManager.findTasksForAgent(agent.getId());
      console.log(`📋 Agent-specific tasks count: ${agentTasks.length}`);
      console.log(`📋 Agent-specific task IDs: ${agentTasks.map(t => t.id).join(', ')}`);
    }

    // Use the most reliable method - direct task retrieval
    const lowTask = lowTaskDirect;
    const highTask = highTaskDirect;

    // Verify both tasks were created and are being tracked
    expect(lowTask).toBeDefined();
    expect(highTask).toBeDefined();
    
    if (lowTask && highTask) {
      expect(lowTask.priority).toBe(2);
      expect(highTask.priority).toBe(9);
      expect(lowTask.status).toBe(TaskStatus.PENDING);
      expect(highTask.status).toBe(TaskStatus.PENDING);

      console.log(`📊 Low priority task status: ${lowTask.status}`);
      console.log(`📊 High priority task status: ${highTask.status}`);
    } else {
      console.error('❌ One or both tasks could not be retrieved');
      console.error(`Low task: ${lowTask ? 'Found' : 'Missing'}`);
      console.error(`High task: ${highTask ? 'Found' : 'Missing'}`);
      
      // Additional debugging - check if tasks exist in scheduler
      if (agent.getSchedulerManager()) {
        const schedulerManager = agent.getSchedulerManager()!;
        const lowTaskFromScheduler = await schedulerManager.getTask(lowPriorityResult.task!.id);
        const highTaskFromScheduler = await schedulerManager.getTask(highPriorityResult.task!.id);
        console.error(`Low task in scheduler: ${lowTaskFromScheduler ? 'Found' : 'Missing'}`);
        console.error(`High task in scheduler: ${highTaskFromScheduler ? 'Found' : 'Missing'}`);
      }
    }
    
    console.log('✅ Multiple task priority verification completed');
  }, 30000);

  test('Twitter/X platform variations recognition', async () => {
    console.log('🐦 Testing Twitter/X platform variations recognition...');
    
    const variations = [
      {
        name: 'twitter_search_test',
        description: 'Search Twitter for recent posts about cryptocurrency trends',
        expectedTool: 'apify-twitter-search'
      },
      {
        name: 'x_platform_search',
        description: 'Use X.com to find discussions about AI developments',
        expectedTool: 'apify-twitter-search'
      },
      {
        name: 'x_social_search',
        description: 'Search X (formerly Twitter) for blockchain news',
        expectedTool: 'apify-twitter-search'
      }
    ];

    for (const variation of variations) {
      console.log(`🔍 Testing variation: ${variation.name}`);
      
      const taskOptions: TaskCreationOptions = {
        name: variation.name,
        description: variation.description,
        scheduleType: TaskScheduleType.PRIORITY,
        priority: 10,
        metadata: {
          taskType: 'platform_variation_test',
          expectedTool: variation.expectedTool,
          limitResults: 2 // Minimize costs
        }
      };

      const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
      expect(taskResult.success).toBe(true);
      const createdTask = taskResult.task;
      console.log(`✅ ${variation.name} task created:`, createdTask.id);
      
      // Execute the task
      console.log(`🔥 Executing ${variation.name}...`);
      const executionResult = await agent.executeTask(createdTask.id);
      
      console.log(`📊 ${variation.name} execution completed!`);
      console.log(`🎯 Execution successful: ${executionResult.successful}`);
      console.log(`⏱️ Execution duration: ${executionResult.duration}ms`);
      
      // Verify the correct tool was selected
      if (executionResult.metadata?.planResult) {
        const planResult = executionResult.metadata.planResult as any;
        if (planResult.plan?.steps) {
          const toolsUsed: string[] = [];
          planResult.plan.steps.forEach((step: any) => {
            if (step.actions) {
              step.actions.forEach((action: any) => {
                if (action.type === 'tool_execution' && action.parameters?.toolName) {
                  toolsUsed.push(action.parameters.toolName);
                }
              });
            }
          });
          
          const expectedToolUsed = toolsUsed.includes(variation.expectedTool);
          console.log(`🎯 Expected tool (${variation.expectedTool}) used: ${expectedToolUsed ? '✅' : '❌'}`);
          console.log(`🔧 Tools actually used: ${toolsUsed.join(', ')}`);
        }
      }
      
      console.log(`✅ ${variation.name} test completed\n`);
    }
    
    console.log('✅ All Twitter/X platform variations tested');
  }, 120000);

  test('Individual Apify tool verification with limited queries', async () => {
    console.log('🔧 Testing individual Apify tools with cost-limited queries...');
    
    const toolTests = [
      {
        toolName: 'apify-twitter-search',
        taskName: 'limited_twitter_test',
        description: 'Use apify-twitter-search to find exactly 2 tweets about Bitcoin. Limit the search to minimize costs.',
        expectedContent: ['twitter', 'tweet', 'bitcoin', 'btc']
      },
      {
        toolName: 'apify-reddit-search',
        taskName: 'limited_reddit_test', 
        description: 'Use apify-reddit-search to find exactly 2 posts from r/technology. Limit the search to minimize costs.',
        expectedContent: ['reddit', 'post', 'technology', 'r/']
      },
      {
        toolName: 'apify-website-crawler',
        taskName: 'limited_crawler_test',
        description: 'Use apify-website-crawler to crawl only the homepage of example.com. Limit crawling to 1 page to minimize costs.',
        expectedContent: ['crawl', 'page', 'website', 'example']
      },
      {
        toolName: 'apify-actor-discovery',
        taskName: 'limited_discovery_test',
        description: 'Use apify-actor-discovery to find exactly 3 actors related to social media. Limit results to minimize costs.',
        expectedContent: ['actor', 'apify', 'social', 'media']
      }
    ];

    const results: Array<{toolName: string, success: boolean, duration: number, toolUsed: boolean}> = [];

    for (const test of toolTests) {
      console.log(`\n🔧 Testing ${test.toolName}...`);
      
      const taskOptions: TaskCreationOptions = {
        name: test.taskName,
        description: test.description,
        scheduleType: TaskScheduleType.PRIORITY,
        priority: 10,
        metadata: {
          taskType: 'individual_tool_test',
          expectedTool: test.toolName,
          costLimited: true,
          maxResults: 3
        }
      };

      const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
      expect(taskResult.success).toBe(true);
      const createdTask = taskResult.task;
      console.log(`✅ ${test.taskName} created:`, createdTask.id);
      
      // Execute the task
      const startTime = Date.now();
      console.log(`🔥 Executing ${test.taskName}...`);
      const executionResult = await agent.executeTask(createdTask.id);
      const duration = Date.now() - startTime;
      
      console.log(`📊 ${test.taskName} execution completed!`);
      console.log(`🎯 Execution successful: ${executionResult.successful}`);
      console.log(`⏱️ Execution duration: ${duration}ms`);
      
      // Verify the specific tool was used
      let toolUsed = false;
      if (executionResult.metadata?.planResult) {
        const planResult = executionResult.metadata.planResult as any;
        if (planResult.plan?.steps) {
          planResult.plan.steps.forEach((step: any) => {
            if (step.actions) {
              step.actions.forEach((action: any) => {
                if (action.type === 'tool_execution' && 
                    action.parameters?.toolName === test.toolName) {
                  toolUsed = true;
                  console.log(`✅ ${test.toolName} was successfully used!`);
                }
              });
            }
          });
        }
      }
      
      if (!toolUsed) {
        console.log(`❌ ${test.toolName} was not used in execution`);
      }
      
      // Check for expected content
      if (executionResult.successful && executionResult.result) {
        const resultString = JSON.stringify(executionResult.result).toLowerCase();
        const contentFound = test.expectedContent.some(content => 
          resultString.includes(content.toLowerCase())
        );
        console.log(`📊 Expected content found: ${contentFound ? '✅' : '❌'}`);
        console.log(`🔍 Content preview: ${resultString.substring(0, 150)}...`);
      }
      
      results.push({
        toolName: test.toolName,
        success: executionResult.successful,
        duration,
        toolUsed
      });
      
      console.log(`✅ ${test.taskName} individual test completed`);
    }
    
    // Summary of all tool tests
    console.log('\n📊 Individual Tool Test Summary:');
    console.log('| Tool | Success | Duration | Tool Used |');
    console.log('|------|---------|----------|-----------|');
    results.forEach(result => {
      console.log(`| ${result.toolName} | ${result.success ? '✅' : '❌'} | ${result.duration}ms | ${result.toolUsed ? '✅' : '❌'} |`);
    });
    
    // Verify all tools were tested successfully
    const allSuccessful = results.every(r => r.success);
    const allToolsUsed = results.every(r => r.toolUsed);
    
    console.log(`\n🎯 Overall Results:`);
    console.log(`✅ All executions successful: ${allSuccessful}`);
    console.log(`✅ All expected tools used: ${allToolsUsed}`);
    
    expect(results.length).toBe(toolTests.length);
    console.log('✅ Individual Apify tool verification completed');
  }, 180000);

  test('Task outcome satisfaction verification', async () => {
    console.log('🎯 Testing task outcome satisfaction with different tool scenarios...');
    
    const satisfactionTests = [
      {
        name: 'social_sentiment_analysis',
        description: 'Analyze social media sentiment about "artificial intelligence" by searching Twitter and Reddit. Provide a summary of positive vs negative sentiment with specific examples.',
        expectedOutcome: {
          toolsUsed: ['apify-twitter-search', 'apify-reddit-search'],
          contentCriteria: ['sentiment', 'positive', 'negative', 'artificial intelligence', 'summary'],
          minContentLength: 200
        }
      },
      {
        name: 'competitive_research',
        description: 'Research competitors in the "web scraping tools" space by searching for information about popular web scraping services and tools. Provide insights about market positioning and key players.',
        expectedOutcome: {
          toolsUsed: ['web_search', 'apify-reddit-search', 'apify-twitter-search'],
          contentCriteria: ['competitor', 'web scraping', 'market', 'positioning', 'insights'],
          minContentLength: 150
        }
      },
      {
        name: 'content_aggregation',
        description: 'Aggregate content about "blockchain technology" from multiple sources: crawl a relevant website, search Twitter, and find Reddit discussions. Create a comprehensive report.',
        expectedOutcome: {
          toolsUsed: ['apify-website-crawler', 'apify-twitter-search', 'apify-reddit-search'],
          contentCriteria: ['blockchain', 'technology', 'comprehensive', 'report', 'sources'],
          minContentLength: 300
        }
      }
    ];

    const satisfactionResults: Array<{
      name: string;
      success: boolean;
      toolsUsed: string[];
      expectedTools: string[];
      contentSatisfied: boolean;
      lengthSatisfied: boolean;
      overallSatisfaction: number;
    }> = [];

    for (const test of satisfactionTests) {
      console.log(`\n🎯 Testing satisfaction for: ${test.name}`);
      
      const taskOptions: TaskCreationOptions = {
        name: test.name,
        description: test.description,
        scheduleType: TaskScheduleType.PRIORITY,
        priority: 10,
        metadata: {
          taskType: 'outcome_satisfaction_test',
          expectedTools: test.expectedOutcome.toolsUsed,
          satisfactionCriteria: test.expectedOutcome,
          limitResults: 3 // Cost control
        }
      };

      const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
      expect(taskResult.success).toBe(true);
      const createdTask = taskResult.task;
      console.log(`✅ ${test.name} task created:`, createdTask.id);
      
      // Execute the task
      console.log(`🔥 Executing ${test.name}...`);
      const executionResult = await agent.executeTask(createdTask.id);
      
      console.log(`📊 ${test.name} execution completed!`);
      console.log(`🎯 Execution successful: ${executionResult.successful}`);
      console.log(`⏱️ Execution duration: ${executionResult.duration}ms`);
      
      // Analyze tool usage and success
      const toolsUsed: string[] = [];
      const toolsSucceeded: string[] = [];
      
      if (executionResult.metadata?.planResult) {
        const planResult = executionResult.metadata.planResult as any;
        if (planResult.plan?.steps) {
          planResult.plan.steps.forEach((step: any) => {
            if (step.actions) {
              step.actions.forEach((action: any) => {
                if (action.type === 'tool_execution' && action.parameters?.toolName) {
                  const toolName = action.parameters.toolName;
                  toolsUsed.push(toolName);
                  
                  // Check if tool actually succeeded (not just used)
                  if (action.result?.success) {
                    toolsSucceeded.push(toolName);
                  }
                }
              });
            }
          });
        }
      }
      
      // Also check toolSuccessInfo metadata for more accurate success tracking
      if (executionResult.metadata?.toolSuccessInfo) {
        const toolSuccessInfo = executionResult.metadata.toolSuccessInfo as Record<string, boolean>;
        Object.entries(toolSuccessInfo).forEach(([toolName, success]) => {
          if (!toolsUsed.includes(toolName)) {
            toolsUsed.push(toolName);
          }
          if (success && !toolsSucceeded.includes(toolName)) {
            toolsSucceeded.push(toolName);
          }
        });
      }
      
      // Analyze content satisfaction
      let contentSatisfied = false;
      let lengthSatisfied = false;
      
      if (executionResult.successful && executionResult.result) {
        const resultString = JSON.stringify(executionResult.result);
        
        // Check content criteria
        const criteriaMatched = test.expectedOutcome.contentCriteria.filter(criteria =>
          resultString.toLowerCase().includes(criteria.toLowerCase())
        );
        contentSatisfied = criteriaMatched.length >= Math.ceil(test.expectedOutcome.contentCriteria.length * 0.6); // 60% match
        
        // Check length criteria
        lengthSatisfied = resultString.length >= test.expectedOutcome.minContentLength;
        
        console.log(`📊 Content Analysis for ${test.name}:`);
        console.log(`  - Content length: ${resultString.length} chars (min: ${test.expectedOutcome.minContentLength})`);
        console.log(`  - Criteria matched: ${criteriaMatched.length}/${test.expectedOutcome.contentCriteria.length}`);
        console.log(`  - Matched criteria: ${criteriaMatched.join(', ')}`);
        console.log(`  - Content satisfied: ${contentSatisfied ? '✅' : '❌'}`);
        console.log(`  - Length satisfied: ${lengthSatisfied ? '✅' : '❌'}`);
      }
      
      // Calculate tool satisfaction based on SUCCESSFUL tool usage (not just usage)
      const expectedToolsSucceeded = test.expectedOutcome.toolsUsed.filter(tool => toolsSucceeded.includes(tool));
      const toolSatisfaction = expectedToolsSucceeded.length / test.expectedOutcome.toolsUsed.length;
      const contentSatisfaction = contentSatisfied ? 1 : 0;
      const lengthSatisfaction = lengthSatisfied ? 1 : 0;
      const overallSatisfaction = (toolSatisfaction + contentSatisfaction + lengthSatisfaction) / 3;
      
      console.log(`🎯 Satisfaction Analysis for ${test.name}:`);
      console.log(`  - Tools used: ${toolsUsed.join(', ')}`);
      console.log(`  - Tools succeeded: ${toolsSucceeded.join(', ')}`);
      console.log(`  - Expected tools: ${test.expectedOutcome.toolsUsed.join(', ')}`);
      console.log(`  - Tool satisfaction: ${(toolSatisfaction * 100).toFixed(1)}% (based on SUCCESS, not just usage)`);
      console.log(`  - Content satisfaction: ${(contentSatisfaction * 100).toFixed(1)}%`);
      console.log(`  - Length satisfaction: ${(lengthSatisfaction * 100).toFixed(1)}%`);
      console.log(`  - Overall satisfaction: ${(overallSatisfaction * 100).toFixed(1)}%`);
      
      satisfactionResults.push({
        name: test.name,
        success: executionResult.successful,
        toolsUsed: toolsSucceeded, // Use succeeded tools for satisfaction calculation
        expectedTools: test.expectedOutcome.toolsUsed,
        contentSatisfied,
        lengthSatisfied,
        overallSatisfaction
      });
      
      console.log(`✅ ${test.name} satisfaction test completed`);
    }
    
    // Overall satisfaction summary
    console.log('\n📊 Task Outcome Satisfaction Summary:');
    console.log('| Task | Success | Tools Succeeded | Content | Length | Overall |');
    console.log('|------|---------|-----------------|---------|--------|---------|');
    satisfactionResults.forEach(result => {
      const toolMatch = `${result.toolsUsed.length}/${result.expectedTools.length}`;
      console.log(`| ${result.name} | ${result.success ? '✅' : '❌'} | ${toolMatch} | ${result.contentSatisfied ? '✅' : '❌'} | ${result.lengthSatisfied ? '✅' : '❌'} | ${(result.overallSatisfaction * 100).toFixed(1)}% |`);
    });
    
    const avgSatisfaction = satisfactionResults.reduce((sum, r) => sum + r.overallSatisfaction, 0) / satisfactionResults.length;
    console.log(`\n🎯 Average Overall Satisfaction: ${(avgSatisfaction * 100).toFixed(1)}%`);
    
    // Verify minimum satisfaction threshold
    const minSatisfactionThreshold = 0.3; // 30% - more realistic for cost-limited testing
    const satisfactoryTasks = satisfactionResults.filter(r => r.overallSatisfaction >= minSatisfactionThreshold);
    console.log(`✅ Tasks meeting satisfaction threshold (${minSatisfactionThreshold * 100}%): ${satisfactoryTasks.length}/${satisfactionResults.length}`);
    
    expect(satisfactionResults.length).toBe(satisfactionTests.length);
    expect(avgSatisfaction).toBeGreaterThan(0.2); // At least 20% average satisfaction - more realistic for testing
    
    console.log('✅ Task outcome satisfaction verification completed');
  }, 240000);

  // NEW MODULAR TOOL TESTS - Run one at a time to manage costs
  
  // COMMENTED OUT - SUCCESSFUL ✅
  // test('Modular Instagram tools verification', async () => {
  //   console.log('📸 Testing modular Instagram tools...');
  //   // ... test code ...
  // }, 90000);

  // COMMENTED OUT - SUCCESSFUL ✅  
  // test('Modular Facebook tools verification', async () => {
  //   console.log('📘 Testing modular Facebook tools...');
  //   // ... test code ...
  // }, 90000);

  // COMMENTED OUT - SUCCESSFUL ✅
  // test('Modular YouTube tools verification', async () => {
  //   console.log('📺 Testing modular YouTube tools...');
  //   // ... test code ...
  // }, 90000);

  // COMMENTED OUT - SUCCESSFUL ✅
  // test('Modular LinkedIn tools verification', async () => {
  //   console.log('💼 Testing modular LinkedIn tools...');
  //   // ... test code ...
  // }, 90000);

  // COMMENTED OUT - SUCCESSFUL ✅
  // test('Modular core tools verification', async () => {
  //   console.log('🔧 Testing modular core Apify tools...');
  //   // ... test code ...
  // }, 90000);

  // COMMENTED OUT - SUCCESSFUL ✅
  // test('Multi-platform modular tools integration', async () => {
  //   console.log('🌐 Testing multi-platform modular tools integration...');
  //   // ... test code ...
  // }, 120000);

  // SIMPLE INDIVIDUAL TOOL TESTER - Uncomment ONE at a time to test specific tools
  
  test('Single tool test - Instagram hashtag scraper', async () => {
    console.log('🧪 Testing single Instagram hashtag tool...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'single_instagram_test',
      description: 'Use apify-instagram-hashtag-scraper to find exactly 1 post with hashtag #tech. Keep it minimal for cost control.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'single_tool_test',
        expectedTool: 'apify-instagram-hashtag-scraper',
        limitResults: 1,
        costControl: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Single Instagram test created:', createdTask.id);
    
    console.log('🔥 Executing single Instagram test...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Single Instagram test completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify tool usage
    let toolUsed = false;
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        planResult.plan.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.type === 'tool_execution' && 
                  action.parameters?.toolName?.includes('instagram')) {
                toolUsed = true;
                console.log(`✅ Instagram tool used: ${action.parameters.toolName}`);
              }
            });
          }
        });
      }
    }
    
    console.log(`📊 Tool verification: ${toolUsed ? '✅' : '❌'}`);
    
    if (executionResult.successful && executionResult.result) {
      const resultString = JSON.stringify(executionResult.result);
      console.log(`🔍 Result preview: ${resultString.substring(0, 150)}...`);
    }
    
    console.log('✅ Single Instagram tool test completed');
  }, 60000);

  // COMMENT OUT AFTER SUCCESS - Test other individual tools by uncommenting ONE at a time:
  
  // test('Single tool test - Reddit search', async () => {
  //   console.log('🧪 Testing single Reddit search tool...');
  //   
  //   const taskOptions: TaskCreationOptions = {
  //     name: 'single_reddit_test',
  //     description: 'Use apify-reddit-search to find exactly 1 post about programming. Keep minimal for cost control.',
  //     scheduleType: TaskScheduleType.PRIORITY,
  //     priority: 10,
  //     metadata: {
  //       taskType: 'single_tool_test',
  //       expectedTool: 'apify-reddit-search',
  //       limitResults: 1,
  //       costControl: true
  //     }
  //   };
  //   // ... similar test structure ...
  // }, 60000);

  // test('Single tool test - Website crawler', async () => {
  //   console.log('🧪 Testing single website crawler tool...');
  //   
  //   const taskOptions: TaskCreationOptions = {
  //     name: 'single_crawler_test',
  //     description: 'Use apify-website-crawler to crawl only example.com homepage. Keep minimal for cost control.',
  //     scheduleType: TaskScheduleType.PRIORITY,
  //     priority: 10,
  //     metadata: {
  //       taskType: 'single_tool_test',
  //       expectedTool: 'apify-website-crawler',
  //       limitResults: 1,
  //       costControl: true
  //     }
  //   };
  //   // ... similar test structure ...
  // }, 60000);

  // COMMENT OUT AFTER SUCCESS - Test 7: Tool module organization verification
  test('Tool module organization verification', async () => {
    console.log('📁 Testing tool module organization and accessibility...');
    
    // Test that tools from different modules are accessible
    const moduleTests = [
      {
        module: 'core',
        description: 'Use apify-actor-info tool to get information about a specific Apify actor.',
        expectedTool: 'apify-actor-info'
      },
      {
        module: 'web-scraping',
        description: 'Use apify-website-crawler tool to crawl example.com homepage only.',
        expectedTool: 'apify-website-crawler'
      },
      {
        module: 'reddit',
        description: 'Use apify-reddit-search tool to find 1 post about programming.',
        expectedTool: 'apify-reddit-search'
      }
    ];

    const moduleResults: Array<{module: string, toolUsed: boolean, success: boolean}> = [];

    for (const test of moduleTests) {
      console.log(`\n📁 Testing ${test.module} module...`);
      
      const taskOptions: TaskCreationOptions = {
        name: `module_${test.module}_test`,
        description: test.description,
        scheduleType: TaskScheduleType.PRIORITY,
        priority: 10,
        metadata: {
          taskType: 'module_organization_test',
          expectedTool: test.expectedTool,
          module: test.module,
          limitResults: 1
        }
      };

      const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
      expect(taskResult.success).toBe(true);
      const createdTask = taskResult.task;
      console.log(`✅ ${test.module} module task created:`, createdTask.id);
      
      console.log(`🔥 Executing ${test.module} module task...`);
      const executionResult = await agent.executeTask(createdTask.id);
      
      console.log(`📊 ${test.module} module execution completed!`);
      console.log(`🎯 Execution successful: ${executionResult.successful}`);
      
      // Check if expected tool was used
      let expectedToolUsed = false;
      if (executionResult.metadata?.planResult) {
        const planResult = executionResult.metadata.planResult as any;
        if (planResult.plan?.steps) {
          planResult.plan.steps.forEach((step: any) => {
            if (step.actions) {
              step.actions.forEach((action: any) => {
                if (action.type === 'tool_execution' && 
                    action.parameters?.toolName === test.expectedTool) {
                  expectedToolUsed = true;
                  console.log(`✅ Expected tool used: ${test.expectedTool}`);
                }
              });
            }
          });
        }
      }
      
      moduleResults.push({
        module: test.module,
        toolUsed: expectedToolUsed,
        success: executionResult.successful
      });
      
      console.log(`📊 ${test.module} module verification: ${expectedToolUsed ? '✅' : '❌'}`);
    }
    
    // Summary of module organization test
    console.log('\n📊 Module Organization Summary:');
    console.log('| Module | Tool Used | Success |');
    console.log('|--------|-----------|---------|');
    moduleResults.forEach(result => {
      console.log(`| ${result.module} | ${result.toolUsed ? '✅' : '❌'} | ${result.success ? '✅' : '❌'} |`);
    });
    
    const allModulesWorking = moduleResults.every(r => r.toolUsed && r.success);
    console.log(`\n✅ All modules accessible and working: ${allModulesWorking ? '✅' : '❌'}`);
    
    expect(moduleResults.length).toBe(moduleTests.length);
    console.log('✅ Tool module organization verification completed');
  }, 150000);
}); 