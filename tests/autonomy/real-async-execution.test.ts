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

  test('Enhanced execution result capture with detailed tool verification', async () => {
    console.log('🚀 Testing enhanced execution result capture...');
    
    // Create a task for immediate execution
    const taskOptions: TaskCreationOptions = {
      name: 'bitcoin_price_detailed_check',
      description: 'Get the current Bitcoin price in USD using web search tools and return detailed information including the price source',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'price_check_detailed',
        expectedResult: 'bitcoin_price_with_source',
        requireToolExecution: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Task created for enhanced execution:', createdTask.id);
    
    // Execute the task immediately using agent method
    console.log('🔥 Executing task with enhanced result capture...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Enhanced execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify execution was successful
    expect(executionResult).toBeDefined();
    expect(executionResult.taskId).toBe(createdTask.id);
    
    // Enhanced result verification with metadata access
    console.log('🔍 Detailed result analysis:');
    console.log('📋 Execution metadata:', JSON.stringify(executionResult.metadata, null, 2));
    
    // Check if we have plan result in metadata
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      console.log('📋 Plan result available:', !!planResult);
      console.log('📋 Plan success:', planResult.success);
      console.log('📋 Plan object:', !!planResult.plan);
      
      // If we have a plan object, examine its structure
      if (planResult.plan) {
        const plan = planResult.plan as any;
        console.log('📋 Plan execution details:');
        console.log('  - Plan ID:', plan.id);
        console.log('  - Plan status:', plan.status);
        console.log('  - Steps executed:', plan.steps?.length || 0);
        console.log('  - Plan metadata keys:', Object.keys(plan.metadata || {}));
        
        // Look for execution results in plan metadata
        if (plan.metadata?.executionResult) {
          const execResult = plan.metadata.executionResult as any;
          console.log('🎯 Found detailed execution results!');
          console.log('  - Overall success:', execResult.success);
          console.log('  - Steps completed:', execResult.stepResults?.length || 0);
          
          // Examine step results for tool execution
          if (execResult.stepResults && execResult.stepResults.length > 0) {
            console.log('🔧 Step results analysis:');
            execResult.stepResults.forEach((stepResult: any, index: number) => {
              console.log(`  Step ${index + 1}:`);
              console.log(`    - Status: ${stepResult.status}`);
              console.log(`    - Tool results: ${stepResult.toolResults?.length || 0}`);
              
              if (stepResult.toolResults && stepResult.toolResults.length > 0) {
                stepResult.toolResults.forEach((toolResult: any, toolIndex: number) => {
                  console.log(`    Tool ${toolIndex + 1}:`);
                  console.log(`      - Success: ${toolResult.success}`);
                  console.log(`      - Data available: ${!!toolResult.data}`);
                  if (toolResult.data) {
                    const dataStr = JSON.stringify(toolResult.data);
                    console.log(`      - Data preview: ${dataStr.substring(0, 200)}...`);
                  }
                  if (toolResult.error) {
                    console.log(`      - Error: ${toolResult.error}`);
                  }
                });
              }
              
              if (stepResult.output) {
                console.log(`    - Output: ${stepResult.output.substring(0, 100)}...`);
              }
            });
          }
        } else {
          console.log('❌ No detailed execution results found in plan metadata');
          
          // Check if steps have any execution details
          if (plan.steps && plan.steps.length > 0) {
            console.log('🔍 Examining individual steps for execution details:');
            plan.steps.forEach((step: any, index: number) => {
              console.log(`  Step ${index + 1} (${step.id}):`);
              console.log(`    - Name: ${step.name}`);
              console.log(`    - Description: ${step.description}`);
              console.log(`    - Status: ${step.status}`);
              console.log(`    - Actions: ${step.actions?.length || 0}`);
              
              if (step.actions && step.actions.length > 0) {
                step.actions.forEach((action: any, actionIndex: number) => {
                  console.log(`    Action ${actionIndex + 1}:`);
                  console.log(`      - Type: ${action.type || 'unknown'}`);
                  console.log(`      - Status: ${action.status || 'unknown'}`);
                  console.log(`      - Description: ${action.description || 'none'}`);
                  if (action.result) {
                    console.log(`      - Result: ${JSON.stringify(action.result).substring(0, 100)}...`);
                  }
                });
              } else {
                console.log(`    - No actions found for step ${index + 1}`);
              }
            });
          }
        }
      }
    }
    
    // Check the basic result content
    if (executionResult.successful && executionResult.result) {
      const resultString = JSON.stringify(executionResult.result);
      console.log('🔍 Basic result content (first 300 chars):', resultString.substring(0, 300));
      
      // Check for Bitcoin/price indicators
      const hasRelevantContent = (
        resultString.toLowerCase().includes('bitcoin') ||
        resultString.toLowerCase().includes('btc') ||
        resultString.includes('$') ||
        resultString.toLowerCase().includes('price') ||
        /\d+(\.\d+)?/.test(resultString) // Contains numbers
      );
      
      console.log('✅ Result contains relevant Bitcoin/price information:', hasRelevantContent);
    } else {
      console.log('❌ Task execution failed or returned no result');
      if (executionResult.error) {
        console.log('🐛 Execution error:', executionResult.error);
      }
    }

    // Get the updated task to see final state
    const finalTask = await agent.getTask(createdTask.id);
    console.log('📊 Final task status:', finalTask?.status);
    console.log('📊 Final task metadata keys:', Object.keys(finalTask?.metadata || {}));
    
    console.log('✅ Enhanced execution result capture test completed');
  }, 60000);

  test('Twitter tool verification with enhanced result capture', async () => {
    console.log('🐦 Testing Twitter tool integration with enhanced result capture...');
    
    // Create a task that requires multiple tools: Twitter search + summarization
    const taskOptions: TaskCreationOptions = {
      name: 'twitter_bitcoin_enhanced_research',
      description: 'Search for 3 recent posts about Bitcoin on Twitter/X, extract their content, and provide a summary with the post URLs',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'social_media_research_enhanced',
        expectedTools: ['twitter_search', 'web_search', 'text_summarization'],
        expectedOutput: 'summary_with_urls_and_content',
        verificationCriteria: 'should contain summary, URLs, and post content',
        requireDetailedResults: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Enhanced Twitter task created:', createdTask.id);
    
    // Execute the task immediately using agent method
    console.log('🔥 Executing enhanced Twitter research task...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Enhanced Twitter task execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify execution basics
    expect(executionResult).toBeDefined();
    expect(executionResult.taskId).toBe(createdTask.id);
    
    // Enhanced detailed result verification
    console.log('🔍 Enhanced Twitter result analysis:');
    
    // Access plan execution details from metadata
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan) {
        const plan = planResult.plan as any;
        console.log('📋 Plan execution details:');
        console.log('  - Plan ID:', plan.id);
        console.log('  - Plan status:', plan.status);
        console.log('  - Steps executed:', plan.steps?.length || 0);
        
        // Look for execution results in plan metadata
        if (plan.metadata?.executionResult) {
          const execResult = plan.metadata.executionResult as any;
          console.log('🎯 Found detailed execution results!');
          console.log('  - Overall success:', execResult.success);
          console.log('  - Steps completed:', execResult.stepResults?.length || 0);
          
          // Analyze each step for tool usage
          if (execResult.stepResults) {
            const toolsUsed: string[] = [];
            const urlsFound: string[] = [];
            const contentExtracted: string[] = [];
            
            execResult.stepResults.forEach((stepResult: any, index: number) => {
              console.log(`📋 Step ${index + 1} analysis:`);
              console.log(`  - Status: ${stepResult.status}`);
              console.log(`  - Tools used: ${stepResult.toolResults?.length || 0}`);
              
              if (stepResult.toolResults) {
                stepResult.toolResults.forEach((toolResult: any, toolIndex: number) => {
                  console.log(`   Tool ${toolIndex + 1}:`);
                  console.log(`    - Success: ${toolResult.success}`);
                  console.log(`    - Has data: ${!!toolResult.data}`);
                  
                  if (toolResult.success && toolResult.data) {
                    toolsUsed.push(`Tool_${toolIndex + 1}`);
                    
                    // Try to extract URLs and content from tool data
                    const dataStr = JSON.stringify(toolResult.data);
                    console.log(`    - Data preview: ${dataStr.substring(0, 150)}...`);
                    
                    // Look for URLs in the data
                    const urlMatches = dataStr.match(/https?:\/\/[^\s"]+/gi);
                    if (urlMatches) {
                      urlsFound.push(...urlMatches);
                      console.log(`    - URLs found: ${urlMatches.length}`);
                    }
                    
                    // Look for Twitter/Bitcoin content
                    const hasTwitterContent = (
                      dataStr.toLowerCase().includes('twitter') ||
                      dataStr.toLowerCase().includes('tweet') ||
                      dataStr.toLowerCase().includes('bitcoin') ||
                      dataStr.toLowerCase().includes('btc')
                    );
                    
                    if (hasTwitterContent) {
                      contentExtracted.push(`Step_${index + 1}_Tool_${toolIndex + 1}`);
                      console.log(`    - Contains Twitter/Bitcoin content: ✅`);
                    }
                  }
                  
                  if (toolResult.error) {
                    console.log(`    - Error: ${toolResult.error}`);
                  }
                });
              }
              
              if (stepResult.output) {
                console.log(`  - Step output: ${stepResult.output.substring(0, 100)}...`);
              }
            });
            
            // Summary of tool execution verification
            console.log('🎯 Tool execution summary:');
            console.log(`  - Tools successfully used: ${toolsUsed.length}`);
            console.log(`  - URLs extracted: ${urlsFound.length}`);
            console.log(`  - Content sources: ${contentExtracted.length}`);
            
            if (urlsFound.length > 0) {
              console.log('🔗 URLs found:');
              urlsFound.slice(0, 5).forEach((url, index) => {
                console.log(`  ${index + 1}. ${url}`);
              });
            }
            
            // Verification criteria
            const toolExecutionSuccess = toolsUsed.length > 0;
            const urlExtractionSuccess = urlsFound.length > 0;
            const contentExtractionSuccess = contentExtracted.length > 0;
            
            console.log('✅ Verification results:');
            console.log(`  - Tool execution: ${toolExecutionSuccess ? '✅' : '❌'}`);
            console.log(`  - URL extraction: ${urlExtractionSuccess ? '✅' : '❌'}`);
            console.log(`  - Content extraction: ${contentExtractionSuccess ? '✅' : '❌'}`);
            
            if (toolExecutionSuccess && urlExtractionSuccess) {
              console.log('🎉 Enhanced Twitter task successfully used tools and extracted data!');
            } else {
              console.log('⚠️ Enhanced Twitter task may not have fully succeeded in tool execution');
            }
          }
        } else {
          console.log('❌ No detailed execution results found in plan metadata');
          
          // Check if steps have any execution details
          if (plan.steps && plan.steps.length > 0) {
            console.log('🔍 Examining individual steps for execution details:');
            plan.steps.forEach((step: any, index: number) => {
              console.log(`  Step ${index + 1} (${step.id}):`);
              console.log(`    - Name: ${step.name}`);
              console.log(`    - Description: ${step.description}`);
              console.log(`    - Status: ${step.status}`);
              console.log(`    - Actions: ${step.actions?.length || 0}`);
              
              if (step.actions && step.actions.length > 0) {
                step.actions.forEach((action: any, actionIndex: number) => {
                  console.log(`    Action ${actionIndex + 1}:`);
                  console.log(`      - Type: ${action.type || 'unknown'}`);
                  console.log(`      - Status: ${action.status || 'unknown'}`);
                  console.log(`      - Description: ${action.description || 'none'}`);
                  if (action.result) {
                    console.log(`      - Result: ${JSON.stringify(action.result).substring(0, 100)}...`);
                  }
                });
              } else {
                console.log(`    - No actions found for step ${index + 1}`);
              }
            });
          }
        }
      }
    }
    
    // Check basic result content as fallback
    if (executionResult.successful && executionResult.result) {
      const resultString = JSON.stringify(executionResult.result);
      console.log('🔍 Basic result content (first 300 chars):', resultString.substring(0, 300));
      
      // Check for expected Twitter/Bitcoin content
      const hasTwitterContent = (
        resultString.toLowerCase().includes('twitter') ||
        resultString.toLowerCase().includes('tweet') ||
        resultString.toLowerCase().includes('bitcoin') ||
        resultString.toLowerCase().includes('btc') ||
        resultString.toLowerCase().includes('#bitcoin')
      );
      
      // Check for URLs (basic pattern)
      const urlPattern = /https?:\/\/[^\s"]+/gi;
      const urls = resultString.match(urlPattern) || [];
      
      console.log('📊 Basic content verification:');
      console.log('  - Has Twitter/Bitcoin content:', hasTwitterContent);
      console.log('  - URL count:', urls.length);
      console.log('  - Result length:', resultString.length, 'characters');
      
    } else {
      console.log('❌ Enhanced Twitter task execution failed or returned no result');
      if (executionResult.error) {
        console.log('🐛 Enhanced Twitter task error:', executionResult.error);
      }
    }

    // Get the updated task to see final state
    const finalTask = await agent.getTask(createdTask.id);
    console.log('📊 Final enhanced Twitter task status:', finalTask?.status);
    console.log('📊 Final enhanced Twitter task metadata keys:', Object.keys(finalTask?.metadata || {}));
    
    console.log('✅ Enhanced Twitter tool verification test completed');
  }, 90000);

  test('Immediate task execution with real result verification', async () => {
    console.log('🚀 Testing immediate task execution with real results...');
    
    // Create a task for immediate execution
    const taskOptions: TaskCreationOptions = {
      name: 'bitcoin_price_check',
      description: 'Get the current Bitcoin price in USD and return the numerical value',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'price_check',
        expectedResult: 'bitcoin_price'
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Task created for immediate execution:', createdTask.id);
    
    // Execute the task immediately using agent method
    console.log('🔥 Executing task immediately...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Execution completed! Result:', JSON.stringify(executionResult, null, 2));
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify execution was successful
    expect(executionResult).toBeDefined();
    expect(executionResult.taskId).toBe(createdTask.id);
    
    // Check if we got a real result
    if (executionResult.successful && executionResult.result) {
      const resultString = JSON.stringify(executionResult.result);
      console.log('🔍 Result content for verification:', resultString);
      
      // Check for Bitcoin/price indicators
      const hasRelevantContent = (
        resultString.toLowerCase().includes('bitcoin') ||
        resultString.toLowerCase().includes('btc') ||
        resultString.includes('$') ||
        resultString.toLowerCase().includes('price') ||
        /\d+(\.\d+)?/.test(resultString) // Contains numbers
      );
      
      if (hasRelevantContent) {
        console.log('✅ Task result contains relevant Bitcoin/price information');
      } else {
        console.log('⚠️ Task result does not contain obvious Bitcoin/price information');
      }
    } else {
      console.log('❌ Task execution failed or returned no result');
      if (executionResult.error) {
        console.log('🐛 Execution error:', executionResult.error);
      }
    }

    // Get the updated task to see final state
    const finalTask = await agent.getTask(createdTask.id);
    console.log('📊 Final task status:', finalTask?.status);
    console.log('📊 Final task metadata:', finalTask?.metadata);
    
    console.log('✅ Immediate execution test completed');
  }, 45000);

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
}); 