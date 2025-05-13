// @ts-ignore - These imports would exist in actual implementation
import { AgentBase } from '../../src/agents/shared/interfaces/AgentBase.interface';
// @ts-ignore - These imports would exist in actual implementation
import { DefaultAgentFactory } from '../../src/agents/shared/factories/DefaultAgentFactory';

describe('Agent Planning System E2E Tests', () => {
  let agent: AgentBase;
  let agentFactory: DefaultAgentFactory;
  
  // Setup before all tests
  beforeAll(async () => {
    // Create agent factory
    agentFactory = new DefaultAgentFactory();
    
    // Initialize agent with planning capabilities
    agent = await agentFactory.createAgent({
      agentId: 'planning-agent-' + Date.now(),
      config: {
        enablePlanningManager: true,
        enableMemoryManager: true,
        enableToolManager: true,
        enableSchedulerManager: true,
        planningConfig: {
          enablePlanAdaptation: true,
          enablePlanOptimization: true,
          maxPlanSteps: 10,
          defaultPlanFormat: 'sequential'
        }
      }
    });
  });
  
  // Cleanup after all tests
  afterAll(async () => {
    if (agent) {
      await agent.shutdown();
    }
  });
  
  // Basic plan creation and execution test
  test('Should create and execute a simple plan', async () => {
    // Create a plan
    const planId = await agent.createPlan({
      goal: 'Summarize a web article',
      context: 'Need to extract key information from a news article',
      constraints: {
        timeLimit: 60, // seconds
        maxSteps: 5
      }
    });
    
    // Verify plan was created
    expect(planId).toBeDefined();
    
    // Get the plan
    const plan = await agent.getPlan(planId);
    
    // Verify plan structure
    expect(plan).toBeDefined();
    expect(plan.goal).toBe('Summarize a web article');
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps.length).toBeLessThanOrEqual(5);
    
    // Execute plan
    const executionId = await agent.executePlan(planId, {
      parameters: {
        articleUrl: 'https://example.com/sample-article'
      }
    });
    
    // Verify execution started
    expect(executionId).toBeDefined();
    
    // Wait for execution to complete (with timeout)
    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();
    
    let executionStatus = await agent.getPlanExecutionStatus(executionId);
    while (
      executionStatus.status !== 'COMPLETED' && 
      executionStatus.status !== 'FAILED' &&
      Date.now() - startTime < maxWaitTime
    ) {
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
      executionStatus = await agent.getPlanExecutionStatus(executionId);
    }
    
    // Verify plan completed successfully
    expect(executionStatus.status).toBe('COMPLETED');
    
    // Get results
    const results = await agent.getPlanResults(executionId);
    
    // Verify results
    expect(results).toBeDefined();
    expect(results.summary).toBeDefined();
    expect(typeof results.summary).toBe('string');
    expect(results.summary.length).toBeGreaterThan(0);
    
    // Clean up
    await agent.deletePlan(planId);
  });
  
  // Plan adaptation test
  test('Should adapt plan when obstacles are encountered', async () => {
    // Register test tools
    await agent.registerTool({
      name: 'fetchArticle',
      description: 'Fetches article content from URL',
      parameters: {
        url: {
          type: 'string',
          description: 'The URL of the article to fetch'
        }
      },
      handler: async (params) => {
        // Simulate network error for specific URL to trigger adaptation
        if (params.url === 'https://example.com/unavailable-article') {
          throw new Error('Network error: Unable to access article');
        }
        
        // Return mock article for other URLs
        return {
          title: 'Test Article',
          content: 'This is a test article content for E2E testing.'
        };
      }
    });
    
    // Create a plan with intentional obstacle
    const planId = await agent.createPlan({
      goal: 'Summarize a web article that may be unavailable',
      context: 'Need to extract key information with fallback options',
      constraints: {
        timeLimit: 60, // seconds
        maxSteps: 10
      }
    });
    
    // Execute plan with URL that will fail
    const executionId = await agent.executePlan(planId, {
      parameters: {
        articleUrl: 'https://example.com/unavailable-article',
        backupArticleUrl: 'https://example.com/backup-article'
      }
    });
    
    // Wait for execution to complete (with timeout)
    const maxWaitTime = 15000; // 15 seconds
    const startTime = Date.now();
    
    let executionStatus = await agent.getPlanExecutionStatus(executionId);
    let adaptationCount = 0;
    
    while (
      executionStatus.status !== 'COMPLETED' && 
      executionStatus.status !== 'FAILED' &&
      Date.now() - startTime < maxWaitTime
    ) {
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get updated status
      executionStatus = await agent.getPlanExecutionStatus(executionId);
      
      // Count adaptations
      if (executionStatus.adaptations && executionStatus.adaptations.length > adaptationCount) {
        adaptationCount = executionStatus.adaptations.length;
      }
    }
    
    // Verify plan completed successfully despite obstacle
    expect(executionStatus.status).toBe('COMPLETED');
    
    // Verify plan was adapted
    expect(adaptationCount).toBeGreaterThan(0);
    expect(executionStatus.adaptations.length).toBeGreaterThan(0);
    
    // Get execution details
    const executionDetails = await agent.getPlanExecutionDetails(executionId);
    
    // Verify that backup URL was used
    const usedBackup = executionDetails.steps.some(step => 
      step.parameters?.url === 'https://example.com/backup-article'
    );
    
    expect(usedBackup).toBeTruthy();
    
    // Get results
    const results = await agent.getPlanResults(executionId);
    
    // Verify results
    expect(results).toBeDefined();
    expect(results.summary).toBeDefined();
    
    // Clean up
    await agent.deletePlan(planId);
    await agent.unregisterTool('fetchArticle');
  });
  
  // Plan optimization test
  test('Should optimize plan for better efficiency', async () => {
    // Create a deliberately inefficient plan
    const inefficientPlanId = await agent.createPlan({
      goal: 'Perform data analysis',
      context: 'Need to analyze data from multiple sources',
      strategy: 'UNOPTIMIZED', // Tell the system not to optimize initially
      steps: [
        { 
          action: 'fetchData', 
          parameters: { source: 'source1' }
        },
        {
          action: 'pauseExecution',
          parameters: { durationMs: 1000 } // Artificial delay
        },
        { 
          action: 'fetchData', 
          parameters: { source: 'source2' }
        },
        {
          action: 'pauseExecution',
          parameters: { durationMs: 1000 } // Artificial delay
        },
        { 
          action: 'fetchData', 
          parameters: { source: 'source3' }
        },
        { 
          action: 'analyzeData', 
          parameters: { sources: ['source1', 'source2', 'source3'] }
        }
      ]
    });
    
    // Register test tools
    await agent.registerTool({
      name: 'fetchData',
      description: 'Fetches data from a source',
      parameters: {
        source: {
          type: 'string',
          description: 'The data source'
        }
      },
      handler: async (params) => {
        return { source: params.source, data: 'mock data' };
      }
    });
    
    await agent.registerTool({
      name: 'pauseExecution',
      description: 'Pauses execution for testing',
      parameters: {
        durationMs: {
          type: 'number',
          description: 'Duration in milliseconds'
        }
      },
      handler: async (params) => {
        await new Promise(resolve => setTimeout(resolve, params.durationMs));
        return { success: true };
      }
    });
    
    await agent.registerTool({
      name: 'analyzeData',
      description: 'Analyzes data from sources',
      parameters: {
        sources: {
          type: 'array',
          description: 'The data sources'
        }
      },
      handler: async (params) => {
        return { 
          result: `Analyzed data from ${params.sources.length} sources`,
          summary: 'This is a test analysis result.'
        };
      }
    });
    
    // Execute the inefficient plan and measure time
    const startTimeInefficient = Date.now();
    const inefficientExecutionId = await agent.executePlan(inefficientPlanId);
    
    // Wait for execution to complete
    let inefficientStatus = await agent.getPlanExecutionStatus(inefficientExecutionId);
    while (inefficientStatus.status !== 'COMPLETED' && inefficientStatus.status !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 500));
      inefficientStatus = await agent.getPlanExecutionStatus(inefficientExecutionId);
    }
    
    const endTimeInefficient = Date.now();
    const inefficientDuration = endTimeInefficient - startTimeInefficient;
    
    // Now optimize the plan
    const optimizedPlanId = await agent.optimizePlan(inefficientPlanId, {
      strategy: 'EFFICIENCY',
      targetResource: 'TIME'
    });
    
    // Get the optimized plan
    const optimizedPlan = await agent.getPlan(optimizedPlanId);
    
    // Get the inefficient plan for comparison
    const inefficientPlan = await agent.getPlan(inefficientPlanId);
    
    // Execute the optimized plan and measure time
    const startTimeOptimized = Date.now();
    const optimizedExecutionId = await agent.executePlan(optimizedPlanId);
    
    // Wait for execution to complete
    let optimizedStatus = await agent.getPlanExecutionStatus(optimizedExecutionId);
    while (optimizedStatus.status !== 'COMPLETED' && optimizedStatus.status !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 500));
      optimizedStatus = await agent.getPlanExecutionStatus(optimizedExecutionId);
    }
    
    const endTimeOptimized = Date.now();
    const optimizedDuration = endTimeOptimized - startTimeOptimized;
    
    // Verify optimization results
    
    // 1. Check that optimization happened
    expect(optimizedPlan.steps.length).toBeLessThanOrEqual(inefficientPlan.steps.length);
    
    // 2. Check that the optimized plan was faster
    expect(optimizedDuration).toBeLessThan(inefficientDuration);
    
    // 3. Check that both plans produced the same results
    const inefficientResults = await agent.getPlanResults(inefficientExecutionId);
    const optimizedResults = await agent.getPlanResults(optimizedExecutionId);
    
    expect(optimizedResults.result).toEqual(inefficientResults.result);
    
    // Clean up
    await agent.deletePlan(inefficientPlanId);
    await agent.deletePlan(optimizedPlanId);
    await agent.unregisterTool('fetchData');
    await agent.unregisterTool('pauseExecution');
    await agent.unregisterTool('analyzeData');
  });
  
  // Long-running plan with progress updates test
  test('Should provide progress updates for long-running plans', async () => {
    // Create a multi-step plan
    const planId = await agent.createPlan({
      goal: 'Process large dataset',
      context: 'Need to process data in multiple steps with progress tracking',
      steps: [
        { action: 'initializeProcessing', parameters: {} },
        { action: 'processDataChunk', parameters: { chunk: 1, totalChunks: 5 } },
        { action: 'processDataChunk', parameters: { chunk: 2, totalChunks: 5 } },
        { action: 'processDataChunk', parameters: { chunk: 3, totalChunks: 5 } },
        { action: 'processDataChunk', parameters: { chunk: 4, totalChunks: 5 } },
        { action: 'processDataChunk', parameters: { chunk: 5, totalChunks: 5 } },
        { action: 'finalizeProcessing', parameters: {} }
      ]
    });
    
    // Register test tools
    await agent.registerTool({
      name: 'initializeProcessing',
      description: 'Initializes data processing',
      parameters: {},
      handler: async () => {
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate work
        return { success: true, message: 'Processing initialized' };
      }
    });
    
    await agent.registerTool({
      name: 'processDataChunk',
      description: 'Processes a chunk of data',
      parameters: {
        chunk: {
          type: 'number',
          description: 'The chunk number'
        },
        totalChunks: {
          type: 'number',
          description: 'Total number of chunks'
        }
      },
      handler: async (params) => {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate work
        return { 
          success: true, 
          message: `Processed chunk ${params.chunk} of ${params.totalChunks}` 
        };
      }
    });
    
    await agent.registerTool({
      name: 'finalizeProcessing',
      description: 'Finalizes data processing',
      parameters: {},
      handler: async () => {
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate work
        return { success: true, message: 'Processing finalized', result: 'All data processed successfully' };
      }
    });
    
    // Execute plan
    const executionId = await agent.executePlan(planId);
    
    // Track progress updates - fix array type
    const progressUpdates: Array<{
      timestamp: number;
      progress: number;
      currentStep: number;
      stepName: string;
    }> = [];
    let lastProgress = -1;
    
    // Poll for updates until complete
    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();
    
    let executionStatus = await agent.getPlanExecutionStatus(executionId);
    while (
      executionStatus.status !== 'COMPLETED' && 
      executionStatus.status !== 'FAILED' &&
      Date.now() - startTime < maxWaitTime
    ) {
      // Record progress if it changed
      if (executionStatus.progress !== lastProgress) {
        progressUpdates.push({
          timestamp: Date.now(),
          progress: executionStatus.progress,
          currentStep: executionStatus.currentStepIndex,
          stepName: executionStatus.currentStepName
        });
        lastProgress = executionStatus.progress;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 300));
      executionStatus = await agent.getPlanExecutionStatus(executionId);
    }
    
    // Verify execution completed
    expect(executionStatus.status).toBe('COMPLETED');
    
    // Verify we got multiple progress updates
    expect(progressUpdates.length).toBeGreaterThan(3);
    
    // Verify progress increased monotonically
    for (let i = 1; i < progressUpdates.length; i++) {
      expect(progressUpdates[i].progress).toBeGreaterThanOrEqual(progressUpdates[i-1].progress);
    }
    
    // Verify final progress is 100%
    expect(progressUpdates[progressUpdates.length - 1].progress).toBe(100);
    
    // Get results
    const results = await agent.getPlanResults(executionId);
    
    // Verify results
    expect(results).toBeDefined();
    expect(results.result).toBe('All data processed successfully');
    
    // Clean up
    await agent.deletePlan(planId);
    await agent.unregisterTool('initializeProcessing');
    await agent.unregisterTool('processDataChunk');
    await agent.unregisterTool('finalizeProcessing');
  });
}); 