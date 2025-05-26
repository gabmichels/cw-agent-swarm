import dotenv from 'dotenv';
dotenv.config();

import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';
import { TaskCreationOptions, TaskCreationResult } from '../../src/agents/shared/base/managers/SchedulerManager.interface';

describe('Isolated Apify Tools Verification', () => {
  let agent: DefaultAgent;

  beforeAll(async () => {
    agent = new DefaultAgent({
      id: 'isolated-apify-test-agent',
      name: 'Isolated Apify Test Agent',
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

  test('Instagram hashtag scraper - minimal cost test', async () => {
    console.log('📸 Testing Instagram hashtag scraper with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'instagram_hashtag_minimal',
      description: 'Use instagram-hashtag-scraper to find exactly 1 post with hashtag #tech. Limit to 1 result only to minimize costs.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'isolated_tool_test',
        expectedTool: 'instagram-hashtag-scraper',
        maxResults: 1,
        costControl: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Instagram hashtag task created:', createdTask.id);
    
    console.log('🔥 Executing Instagram hashtag scraper...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Instagram hashtag execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify the Instagram tool was used and got results
    let instagramToolUsed = false;
    let gotResults = false;
    
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        planResult.plan.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.type === 'tool_execution' && 
                  action.parameters?.toolName === 'instagram-hashtag-scraper') {
                instagramToolUsed = true;
                console.log('✅ Instagram hashtag scraper tool was used');
                
                // Check if we got actual results
                if (action.result?.data && action.result.data.length > 0) {
                  gotResults = true;
                  console.log('✅ Instagram tool returned results:', action.result.data.length, 'items');
                  console.log('📊 Sample result:', JSON.stringify(action.result.data[0]).substring(0, 200));
                } else if (action.result?.error) {
                  console.log('❌ Instagram tool error:', action.result.error);
                } else {
                  console.log('⚠️ Instagram tool completed but no data returned');
                }
              }
            });
          }
        });
      }
    }
    
    console.log(`📊 Instagram Tool Verification:`);
    console.log(`  - Tool used: ${instagramToolUsed ? '✅' : '❌'}`);
    console.log(`  - Got results: ${gotResults ? '✅' : '❌'}`);
    console.log(`  - Overall success: ${executionResult.successful ? '✅' : '❌'}`);
    
    // Test is successful only if tool was used AND returned results
    expect(instagramToolUsed).toBe(true);
    expect(gotResults).toBe(true);
    expect(executionResult.successful).toBe(true);
    
    console.log('✅ Instagram hashtag scraper test completed');
  }, 120000);

  test('Instagram profile scraper - minimal cost test', async () => {
    console.log('📸 Testing Instagram profile scraper with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'instagram_profile_minimal',
      description: 'Use instagram-profile-scraper to get basic info from instagram.com/instagram profile. Limit to minimal data to reduce costs.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'isolated_tool_test',
        expectedTool: 'instagram-profile-scraper',
        maxResults: 1,
        costControl: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Instagram profile task created:', createdTask.id);
    
    console.log('🔥 Executing Instagram profile scraper...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Instagram profile execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify the Instagram profile tool was used and got results
    let instagramProfileToolUsed = false;
    let gotResults = false;
    
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        planResult.plan.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.type === 'tool_execution' && 
                  action.parameters?.toolName === 'instagram-profile-scraper') {
                instagramProfileToolUsed = true;
                console.log('✅ Instagram profile scraper tool was used');
                
                // Check if we got actual results
                if (action.result?.data && action.result.data.length > 0) {
                  gotResults = true;
                  console.log('✅ Instagram profile tool returned results:', action.result.data.length, 'items');
                  console.log('📊 Sample result:', JSON.stringify(action.result.data[0]).substring(0, 200));
                } else if (action.result?.error) {
                  console.log('❌ Instagram profile tool error:', action.result.error);
                } else {
                  console.log('⚠️ Instagram profile tool completed but no data returned');
                }
              }
            });
          }
        });
      }
    }
    
    console.log(`📊 Instagram Profile Tool Verification:`);
    console.log(`  - Tool used: ${instagramProfileToolUsed ? '✅' : '❌'}`);
    console.log(`  - Got results: ${gotResults ? '✅' : '❌'}`);
    console.log(`  - Overall success: ${executionResult.successful ? '✅' : '❌'}`);
    
    // Test is successful only if tool was used AND returned results
    expect(instagramProfileToolUsed).toBe(true);
    expect(gotResults).toBe(true);
    expect(executionResult.successful).toBe(true);
    
    console.log('✅ Instagram profile scraper test completed');
  }, 120000);

  test('YouTube video scraper - minimal cost test', async () => {
    console.log('📺 Testing YouTube video scraper with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'youtube_video_minimal',
      description: 'Use youtube-video-scraper to get info about 1 YouTube video. Search for "programming tutorial" and get details for just 1 video to minimize costs.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'isolated_tool_test',
        expectedTool: 'youtube-video-scraper',
        maxResults: 1,
        costControl: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ YouTube video task created:', createdTask.id);
    
    console.log('🔥 Executing YouTube video scraper...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 YouTube video execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify the YouTube tool was used and got results
    let youtubeToolUsed = false;
    let gotResults = false;
    
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        planResult.plan.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.type === 'tool_execution' && 
                  action.parameters?.toolName === 'youtube-video-scraper') {
                youtubeToolUsed = true;
                console.log('✅ YouTube video scraper tool was used');
                
                // Check if we got actual results
                if (action.result?.data && action.result.data.length > 0) {
                  gotResults = true;
                  console.log('✅ YouTube tool returned results:', action.result.data.length, 'items');
                  console.log('📊 Sample result:', JSON.stringify(action.result.data[0]).substring(0, 200));
                } else if (action.result?.error) {
                  console.log('❌ YouTube tool error:', action.result.error);
                } else {
                  console.log('⚠️ YouTube tool completed but no data returned');
                }
              }
            });
          }
        });
      }
    }
    
    console.log(`📊 YouTube Tool Verification:`);
    console.log(`  - Tool used: ${youtubeToolUsed ? '✅' : '❌'}`);
    console.log(`  - Got results: ${gotResults ? '✅' : '❌'}`);
    console.log(`  - Overall success: ${executionResult.successful ? '✅' : '❌'}`);
    
    // Test is successful only if tool was used AND returned results
    expect(youtubeToolUsed).toBe(true);
    expect(gotResults).toBe(true);
    expect(executionResult.successful).toBe(true);
    
    console.log('✅ YouTube video scraper test completed');
  }, 120000);

  test('LinkedIn profile scraper - minimal cost test', async () => {
    console.log('💼 Testing LinkedIn profile scraper with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'linkedin_profile_minimal',
      description: 'Use linkedin-profile-scraper to get basic info from a LinkedIn profile. Get minimal data for just 1 profile to reduce costs.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'isolated_tool_test',
        expectedTool: 'linkedin-profile-scraper',
        maxResults: 1,
        costControl: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ LinkedIn profile task created:', createdTask.id);
    
    console.log('🔥 Executing LinkedIn profile scraper...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 LinkedIn profile execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify the LinkedIn tool was used and got results
    let linkedinToolUsed = false;
    let gotResults = false;
    
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        planResult.plan.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.type === 'tool_execution' && 
                  action.parameters?.toolName === 'linkedin-profile-scraper') {
                linkedinToolUsed = true;
                console.log('✅ LinkedIn profile scraper tool was used');
                
                // Check if we got actual results
                if (action.result?.data && action.result.data.length > 0) {
                  gotResults = true;
                  console.log('✅ LinkedIn tool returned results:', action.result.data.length, 'items');
                  console.log('📊 Sample result:', JSON.stringify(action.result.data[0]).substring(0, 200));
                } else if (action.result?.error) {
                  console.log('❌ LinkedIn tool error:', action.result.error);
                } else {
                  console.log('⚠️ LinkedIn tool completed but no data returned');
                }
              }
            });
          }
        });
      }
    }
    
    console.log(`📊 LinkedIn Tool Verification:`);
    console.log(`  - Tool used: ${linkedinToolUsed ? '✅' : '❌'}`);
    console.log(`  - Got results: ${gotResults ? '✅' : '❌'}`);
    console.log(`  - Overall success: ${executionResult.successful ? '✅' : '❌'}`);
    
    // Test is successful only if tool was used AND returned results
    expect(linkedinToolUsed).toBe(true);
    expect(gotResults).toBe(true);
    expect(executionResult.successful).toBe(true);
    
    console.log('✅ LinkedIn profile scraper test completed');
  }, 120000);

  test('Facebook page scraper - minimal cost test', async () => {
    console.log('📘 Testing Facebook page scraper with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'facebook_page_minimal',
      description: 'Use facebook-pages-scraper to get basic info from a Facebook page. Get minimal data for just 1 page to reduce costs.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'isolated_tool_test',
        expectedTool: 'facebook-pages-scraper',
        maxResults: 1,
        costControl: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Facebook page task created:', createdTask.id);
    
    console.log('🔥 Executing Facebook page scraper...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Facebook page execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify the Facebook tool was used and got results
    let facebookToolUsed = false;
    let gotResults = false;
    
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        planResult.plan.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.type === 'tool_execution' && 
                  action.parameters?.toolName === 'facebook-pages-scraper') {
                facebookToolUsed = true;
                console.log('✅ Facebook page scraper tool was used');
                
                // Check if we got actual results
                if (action.result?.data && action.result.data.length > 0) {
                  gotResults = true;
                  console.log('✅ Facebook tool returned results:', action.result.data.length, 'items');
                  console.log('📊 Sample result:', JSON.stringify(action.result.data[0]).substring(0, 200));
                } else if (action.result?.error) {
                  console.log('❌ Facebook tool error:', action.result.error);
                } else {
                  console.log('⚠️ Facebook tool completed but no data returned');
                }
              }
            });
          }
        });
      }
    }
    
    console.log(`📊 Facebook Tool Verification:`);
    console.log(`  - Tool used: ${facebookToolUsed ? '✅' : '❌'}`);
    console.log(`  - Got results: ${gotResults ? '✅' : '❌'}`);
    console.log(`  - Overall success: ${executionResult.successful ? '✅' : '❌'}`);
    
    // Test is successful only if tool was used AND returned results
    expect(facebookToolUsed).toBe(true);
    expect(gotResults).toBe(true);
    expect(executionResult.successful).toBe(true);
    
    console.log('✅ Facebook page scraper test completed');
  }, 120000);

  test('Reddit search - minimal cost test', async () => {
    console.log('🔴 Testing Reddit search with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'reddit_search_minimal',
      description: 'Use apify-reddit-search to find exactly 1 post about programming from r/programming. Limit to 1 result only to minimize costs.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'isolated_tool_test',
        expectedTool: 'apify-reddit-search',
        maxResults: 1,
        costControl: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Reddit search task created:', createdTask.id);
    
    console.log('🔥 Executing Reddit search...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Reddit search execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify the Reddit tool was used and got results
    let redditToolUsed = false;
    let gotResults = false;
    
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        planResult.plan.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.type === 'tool_execution' && 
                  action.parameters?.toolName === 'apify-reddit-search') {
                redditToolUsed = true;
                console.log('✅ Reddit search tool was used');
                
                // Check if we got actual results
                if (action.result?.data && action.result.data.length > 0) {
                  gotResults = true;
                  console.log('✅ Reddit tool returned results:', action.result.data.length, 'items');
                  console.log('📊 Sample result:', JSON.stringify(action.result.data[0]).substring(0, 200));
                } else if (action.result?.error) {
                  console.log('❌ Reddit tool error:', action.result.error);
                } else {
                  console.log('⚠️ Reddit tool completed but no data returned');
                }
              }
            });
          }
        });
      }
    }
    
    console.log(`📊 Reddit Tool Verification:`);
    console.log(`  - Tool used: ${redditToolUsed ? '✅' : '❌'}`);
    console.log(`  - Got results: ${gotResults ? '✅' : '❌'}`);
    console.log(`  - Overall success: ${executionResult.successful ? '✅' : '❌'}`);
    
    // Test is successful only if tool was used AND returned results
    expect(redditToolUsed).toBe(true);
    expect(gotResults).toBe(true);
    expect(executionResult.successful).toBe(true);
    
    console.log('✅ Reddit search test completed');
  }, 120000);

  test('Website crawler - minimal cost test', async () => {
    console.log('🌐 Testing Website crawler with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'website_crawler_minimal',
      description: 'Use apify-website-crawler to crawl only the homepage of example.com. Limit to 1 page only to minimize costs.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'isolated_tool_test',
        expectedTool: 'apify-website-crawler',
        maxResults: 1,
        costControl: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Website crawler task created:', createdTask.id);
    
    console.log('🔥 Executing Website crawler...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Website crawler execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify the Website crawler tool was used and got results
    let crawlerToolUsed = false;
    let gotResults = false;
    
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        planResult.plan.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.type === 'tool_execution' && 
                  action.parameters?.toolName === 'apify-website-crawler') {
                crawlerToolUsed = true;
                console.log('✅ Website crawler tool was used');
                
                // Check if we got actual results
                if (action.result?.data && action.result.data.length > 0) {
                  gotResults = true;
                  console.log('✅ Website crawler returned results:', action.result.data.length, 'items');
                  console.log('📊 Sample result:', JSON.stringify(action.result.data[0]).substring(0, 200));
                } else if (action.result?.error) {
                  console.log('❌ Website crawler error:', action.result.error);
                } else {
                  console.log('⚠️ Website crawler completed but no data returned');
                }
              }
            });
          }
        });
      }
    }
    
    console.log(`📊 Website Crawler Tool Verification:`);
    console.log(`  - Tool used: ${crawlerToolUsed ? '✅' : '❌'}`);
    console.log(`  - Got results: ${gotResults ? '✅' : '❌'}`);
    console.log(`  - Overall success: ${executionResult.successful ? '✅' : '❌'}`);
    
    // Test is successful only if tool was used AND returned results
    expect(crawlerToolUsed).toBe(true);
    expect(gotResults).toBe(true);
    expect(executionResult.successful).toBe(true);
    
    console.log('✅ Website crawler test completed');
  }, 120000);

  test('Actor discovery - minimal cost test', async () => {
    console.log('🔍 Testing Actor discovery with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'actor_discovery_minimal',
      description: 'Use apify-actor-discovery to find exactly 2 actors related to social media scraping. Limit to 2 results only to minimize costs.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'isolated_tool_test',
        expectedTool: 'apify-actor-discovery',
        maxResults: 2,
        costControl: true
      }
    };

    const taskResult: TaskCreationResult = await agent.createTask(taskOptions);
    expect(taskResult.success).toBe(true);
    const createdTask = taskResult.task;
    console.log('✅ Actor discovery task created:', createdTask.id);
    
    console.log('🔥 Executing Actor discovery...');
    const executionResult = await agent.executeTask(createdTask.id);
    
    console.log('📊 Actor discovery execution completed!');
    console.log('🎯 Execution successful:', executionResult.successful);
    console.log('⏱️ Execution duration:', executionResult.duration, 'ms');
    
    // Verify the Actor discovery tool was used and got results
    let discoveryToolUsed = false;
    let gotResults = false;
    
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        planResult.plan.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.type === 'tool_execution' && 
                  action.parameters?.toolName === 'apify-actor-discovery') {
                discoveryToolUsed = true;
                console.log('✅ Actor discovery tool was used');
                
                // Check if we got actual results
                if (action.result?.data && action.result.data.length > 0) {
                  gotResults = true;
                  console.log('✅ Actor discovery returned results:', action.result.data.length, 'items');
                  console.log('📊 Sample result:', JSON.stringify(action.result.data[0]).substring(0, 200));
                } else if (action.result?.error) {
                  console.log('❌ Actor discovery error:', action.result.error);
                } else {
                  console.log('⚠️ Actor discovery completed but no data returned');
                }
              }
            });
          }
        });
      }
    }
    
    console.log(`📊 Actor Discovery Tool Verification:`);
    console.log(`  - Tool used: ${discoveryToolUsed ? '✅' : '❌'}`);
    console.log(`  - Got results: ${gotResults ? '✅' : '❌'}`);
    console.log(`  - Overall success: ${executionResult.successful ? '✅' : '❌'}`);
    
    // Test is successful only if tool was used AND returned results
    expect(discoveryToolUsed).toBe(true);
    expect(gotResults).toBe(true);
    expect(executionResult.successful).toBe(true);
    
    console.log('✅ Actor discovery test completed');
  }, 120000);
}); 