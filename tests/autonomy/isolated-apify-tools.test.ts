import dotenv from 'dotenv';
dotenv.config();

import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';
import { TaskCreationOptions, TaskCreationResult } from '../../src/agents/shared/base/managers/SchedulerManager.interface';
import { ManagerType } from '../../src/agents/shared/base/managers/ManagerType';
import { ToolManager } from '../../src/agents/shared/base/managers/ToolManager.interface';
import { DefaultApifyManager } from '../../src/agents/shared/tools/integrations/apify/DefaultApifyManager';
import { 
  createInstagramTools,
  createFacebookTools,
  createYouTubeTools,
  createLinkedInTools,
  createTwitterTools,
  createRedditTools,
  createWebScrapingTools,
  createCoreApifyTools
} from '../../src/agents/shared/tools/integrations/apify/tools';

describe('Isolated Apify Tools Verification', () => {
  let agent: DefaultAgent;

  beforeAll(async () => {
    agent = new DefaultAgent({
      id: 'isolated-apify-test-agent',
      name: 'Isolated Apify Test Agent',
      componentsConfig: {
        memoryManager: { enabled: true },
        planningManager: { enabled: true },
        toolManager: { 
          enabled: true,
          defaultToolTimeoutMs: 180000 // 3 minutes for Instagram API calls
        },
        schedulerManager: { enabled: true }
      }
    });

    await agent.initialize();
    
    // Register all Apify tools
    const toolManager = agent.getManager<ToolManager>(ManagerType.TOOL);
    if (toolManager) {
      // Create Apify manager
      const apifyManager = new DefaultApifyManager();
      
      // Create all tool sets
      const instagramTools = createInstagramTools(apifyManager);
      const facebookTools = createFacebookTools(apifyManager);
      const youtubeTools = createYouTubeTools(apifyManager);
      const linkedinTools = createLinkedInTools(apifyManager);
      const twitterTools = createTwitterTools(apifyManager);
      const redditTools = createRedditTools(apifyManager);
      const webScrapingTools = createWebScrapingTools(apifyManager);
      const coreApifyTools = createCoreApifyTools(apifyManager);
      
      // Combine all tools
      const allTools = {
        ...instagramTools,
        ...facebookTools,
        ...youtubeTools,
        ...linkedinTools,
        ...twitterTools,
        ...redditTools,
        ...webScrapingTools,
        ...coreApifyTools
      };
      
      // Register all tools
      for (const [toolName, toolDef] of Object.entries(allTools)) {
        await toolManager.registerTool({
          id: toolDef.name,
          name: toolDef.name,
          description: toolDef.description,
          version: '1.0.0',
          enabled: true,
          execute: toolDef.func
        });
        console.log(`✅ ${toolName} tool registered`);
      }
      
      console.log(`✅ Total tools registered: ${Object.keys(allTools).length}`);
    }
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
                
                // Check if we got actual results (not just dry run)
                if (action.result && typeof action.result === 'string') {
                  if (action.result.includes('Successfully scraped') && 
                      !action.result.includes('[DRY RUN]')) {
                    gotResults = true;
                    console.log('✅ Got real Instagram data');
                  } else if (action.result.includes('[DRY RUN]')) {
                    console.log('⚠️ Instagram tool ran in dry run mode');
                  } else {
                    console.log('⚠️ Instagram tool completed but no data returned');
                    console.log('🔍 Action result:', action.result.substring(0, 300));
                  }
                } else if (action.result && typeof action.result === 'object') {
                  // Handle object result format
                  gotResults = true;
                  console.log('✅ Got Instagram data (object format)');
                  console.log('🔍 Result keys:', Object.keys(action.result));
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
  }, 180000);

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
                } else if (action.result && typeof action.result === 'string') {
                  if (action.result.includes('Successfully scraped') && 
                      !action.result.includes('[DRY RUN]')) {
                    gotResults = true;
                    console.log('✅ Got real Instagram profile data');
                  } else if (action.result.includes('[DRY RUN]')) {
                    console.log('⚠️ Instagram profile tool ran in dry run mode');
                  } else {
                    console.log('⚠️ Instagram profile tool completed but no data returned');
                    console.log('🔍 Action result:', action.result.substring(0, 300));
                  }
                } else if (action.result && typeof action.result === 'object') {
                  // Handle object result format
                  gotResults = true;
                  console.log('✅ Got Instagram profile data (object format)');
                  console.log('🔍 Result keys:', Object.keys(action.result));
                } else if (action.result?.error) {
                  console.log('❌ Instagram profile tool error:', action.result.error);
                } else {
                  console.log('⚠️ Instagram profile tool completed but no data returned');
                  console.log('🔍 Action result type:', typeof action.result);
                  console.log('🔍 Action result:', JSON.stringify(action.result).substring(0, 200));
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
  }, 180000);

  test('YouTube video scraper - minimal cost test', async () => {
    console.log('📺 Testing YouTube video scraper with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'youtube_video_minimal',
      description: 'Use youtube-video-scraper to get basic info from a popular YouTube video. Limit to minimal data to reduce costs.',
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
                if (action.result && typeof action.result === 'string') {
                  if (action.result.includes('Successfully scraped') && 
                      !action.result.includes('[DRY RUN]')) {
                    gotResults = true;
                    console.log('✅ Got real YouTube data');
                  } else if (action.result.includes('[DRY RUN]')) {
                    console.log('⚠️ YouTube tool ran in dry run mode');
                  } else {
                    console.log('⚠️ YouTube tool completed but no data returned');
                    console.log('🔍 Action result:', action.result.substring(0, 300));
                  }
                } else if (action.result && typeof action.result === 'object') {
                  // Handle object result format
                  gotResults = true;
                  console.log('✅ Got YouTube data (object format)');
                  console.log('🔍 Result keys:', Object.keys(action.result));
                } else if (action.result?.error) {
                  console.log('❌ YouTube tool error:', action.result.error);
                } else {
                  console.log('⚠️ YouTube tool completed but no data returned');
                  console.log('🔍 Action result type:', typeof action.result);
                  console.log('🔍 Action result:', JSON.stringify(action.result).substring(0, 200));
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
  }, 180000);

  test('LinkedIn profile scraper - minimal cost test', async () => {
    console.log('💼 Testing LinkedIn profile scraper with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'linkedin_profile_minimal',
      description: 'Use linkedin-profile-scraper to get basic info from a LinkedIn profile. Limit to minimal data to reduce costs.',
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
                if (action.result && typeof action.result === 'string') {
                  if (action.result.includes('Successfully scraped') && 
                      !action.result.includes('[DRY RUN]')) {
                    gotResults = true;
                    console.log('✅ Got real LinkedIn data');
                  } else if (action.result.includes('[DRY RUN]')) {
                    console.log('⚠️ LinkedIn tool ran in dry run mode');
                  } else {
                    console.log('⚠️ LinkedIn tool completed but no data returned');
                    console.log('🔍 Action result:', action.result.substring(0, 300));
                  }
                } else if (action.result && typeof action.result === 'object') {
                  // Handle object result format
                  gotResults = true;
                  console.log('✅ Got LinkedIn data (object format)');
                  console.log('🔍 Result keys:', Object.keys(action.result));
                } else if (action.result?.error) {
                  console.log('❌ LinkedIn tool error:', action.result.error);
                } else {
                  console.log('⚠️ LinkedIn tool completed but no data returned');
                  console.log('🔍 Action result type:', typeof action.result);
                  console.log('🔍 Action result:', JSON.stringify(action.result).substring(0, 200));
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
  }, 180000);

  test('Facebook page scraper - minimal cost test', async () => {
    console.log('📘 Testing Facebook page scraper with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'facebook_page_minimal',
      description: 'Use facebook-pages-scraper to get basic info from a Facebook page. Limit to minimal data to reduce costs.',
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
                if (action.result && typeof action.result === 'string') {
                  if (action.result.includes('Successfully scraped') && 
                      !action.result.includes('[DRY RUN]')) {
                    gotResults = true;
                    console.log('✅ Got real Facebook data');
                  } else if (action.result.includes('[DRY RUN]')) {
                    console.log('⚠️ Facebook tool ran in dry run mode');
                  } else {
                    console.log('⚠️ Facebook tool completed but no data returned');
                    console.log('🔍 Action result:', action.result.substring(0, 300));
                  }
                } else if (action.result && typeof action.result === 'object') {
                  // Handle object result format
                  gotResults = true;
                  console.log('✅ Got Facebook data (object format)');
                  console.log('🔍 Result keys:', Object.keys(action.result));
                } else if (action.result?.error) {
                  console.log('❌ Facebook tool error:', action.result.error);
                } else {
                  console.log('⚠️ Facebook tool completed but no data returned');
                  console.log('🔍 Action result type:', typeof action.result);
                  console.log('🔍 Action result:', JSON.stringify(action.result).substring(0, 200));
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
  }, 180000);

  test('Reddit search - minimal cost test', async () => {
    console.log('🔍 Testing Reddit search with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'reddit_search_minimal',
      description: 'Use apify-reddit-search to search for posts about technology. Limit to minimal data to reduce costs.',
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
                console.log('✅ Reddit scraper tool was used');
                
                // Check if we got actual results
                if (action.result && typeof action.result === 'string') {
                  if (action.result.includes('Successfully scraped') && 
                      !action.result.includes('[DRY RUN]')) {
                    gotResults = true;
                    console.log('✅ Got real Reddit data');
                  } else if (action.result.includes('[DRY RUN]')) {
                    console.log('⚠️ Reddit tool ran in dry run mode');
                  } else {
                    console.log('⚠️ Reddit tool completed but no data returned');
                    console.log('🔍 Action result:', action.result.substring(0, 300));
                  }
                } else if (action.result && typeof action.result === 'object') {
                  // Handle object result format
                  gotResults = true;
                  console.log('✅ Got Reddit data (object format)');
                  console.log('🔍 Result keys:', Object.keys(action.result));
                } else if (action.result?.error) {
                  console.log('❌ Reddit tool error:', action.result.error);
                } else {
                  console.log('⚠️ Reddit tool completed but no data returned');
                  console.log('🔍 Action result type:', typeof action.result);
                  console.log('🔍 Action result:', JSON.stringify(action.result).substring(0, 200));
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
  }, 180000);

  test('Website crawler - minimal cost test', async () => {
    console.log('🌐 Testing Website crawler with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'website_crawler_minimal',
      description: 'Use apify-website-crawler to crawl a simple website. Limit to minimal data to reduce costs.',
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
    let websiteToolUsed = false;
    let gotResults = false;
    
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        planResult.plan.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.type === 'tool_execution' && 
                  action.parameters?.toolName === 'apify-website-crawler') {
                websiteToolUsed = true;
                console.log('✅ Website crawler tool was used');
                
                // Check if we got actual results
                if (action.result && typeof action.result === 'string') {
                  if (action.result.includes('Successfully scraped') && 
                      !action.result.includes('[DRY RUN]')) {
                    gotResults = true;
                    console.log('✅ Got real website data');
                  } else if (action.result.includes('[DRY RUN]')) {
                    console.log('⚠️ Website crawler ran in dry run mode');
                  } else {
                    console.log('⚠️ Website crawler completed but no data returned');
                    console.log('🔍 Action result:', action.result.substring(0, 300));
                  }
                } else if (action.result && typeof action.result === 'object') {
                  // Handle object result format
                  gotResults = true;
                  console.log('✅ Got website data (object format)');
                  console.log('🔍 Result keys:', Object.keys(action.result));
                } else if (action.result?.error) {
                  console.log('❌ Website crawler error:', action.result.error);
                } else {
                  console.log('⚠️ Website crawler completed but no data returned');
                  console.log('🔍 Action result type:', typeof action.result);
                  console.log('🔍 Action result:', JSON.stringify(action.result).substring(0, 200));
                }
              }
            });
          }
        });
      }
    }
    
    console.log(`📊 Website Crawler Tool Verification:`);
    console.log(`  - Tool used: ${websiteToolUsed ? '✅' : '❌'}`);
    console.log(`  - Got results: ${gotResults ? '✅' : '❌'}`);
    console.log(`  - Overall success: ${executionResult.successful ? '✅' : '❌'}`);
    
    // Test is successful only if tool was used AND returned results
    expect(websiteToolUsed).toBe(true);
    expect(gotResults).toBe(true);
    expect(executionResult.successful).toBe(true);
    
    console.log('✅ Website crawler test completed');
  }, 180000);

  test('Actor discovery - minimal cost test', async () => {
    console.log('🔍 Testing Actor discovery with minimal cost...');
    
    const taskOptions: TaskCreationOptions = {
      name: 'actor_discovery_minimal',
      description: 'Use apify-actor-discovery to discover available actors. Limit to minimal data to reduce costs.',
      scheduleType: TaskScheduleType.PRIORITY,
      priority: 10,
      metadata: {
        taskType: 'isolated_tool_test',
        expectedTool: 'apify-actor-discovery',
        maxResults: 1,
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
    let actorDiscoveryToolUsed = false;
    let gotResults = false;
    
    if (executionResult.metadata?.planResult) {
      const planResult = executionResult.metadata.planResult as any;
      if (planResult.plan?.steps) {
        planResult.plan.steps.forEach((step: any) => {
          if (step.actions) {
            step.actions.forEach((action: any) => {
              if (action.type === 'tool_execution' && 
                  action.parameters?.toolName === 'apify-actor-discovery') {
                actorDiscoveryToolUsed = true;
                console.log('✅ Actor discovery tool was used');
                
                // Check if we got actual results
                if (action.result && typeof action.result === 'string') {
                  if (action.result.includes('Successfully scraped') && 
                      !action.result.includes('[DRY RUN]')) {
                    gotResults = true;
                    console.log('✅ Got real actor discovery data');
                  } else if (action.result.includes('[DRY RUN]')) {
                    console.log('⚠️ Actor discovery ran in dry run mode');
                  } else {
                    console.log('⚠️ Actor discovery completed but no data returned');
                    console.log('🔍 Action result:', action.result.substring(0, 300));
                  }
                } else if (action.result && typeof action.result === 'object') {
                  // Handle object result format
                  gotResults = true;
                  console.log('✅ Got actor discovery data (object format)');
                  console.log('🔍 Result keys:', Object.keys(action.result));
                } else if (action.result?.error) {
                  console.log('❌ Actor discovery error:', action.result.error);
                } else {
                  console.log('⚠️ Actor discovery completed but no data returned');
                  console.log('🔍 Action result type:', typeof action.result);
                  console.log('🔍 Action result:', JSON.stringify(action.result).substring(0, 200));
                }
              }
            });
          }
        });
      }
    }
    
    console.log(`📊 Actor Discovery Tool Verification:`);
    console.log(`  - Tool used: ${actorDiscoveryToolUsed ? '✅' : '❌'}`);
    console.log(`  - Got results: ${gotResults ? '✅' : '❌'}`);
    console.log(`  - Overall success: ${executionResult.successful ? '✅' : '❌'}`);
    
    // Test is successful only if tool was used AND returned results
    expect(actorDiscoveryToolUsed).toBe(true);
    expect(gotResults).toBe(true);
    expect(executionResult.successful).toBe(true);
    
    console.log('✅ Actor discovery test completed');
  }, 180000);
}); 