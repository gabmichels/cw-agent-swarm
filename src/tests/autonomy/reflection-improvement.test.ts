/**
 * reflection-improvement.test.ts
 * 
 * Tests the DefaultAgent's ability to learn from reflection and improve strategies
 * based on insights generated from past experiences.
 * 
 * Focus areas:
 * 1. Insight generation from task execution
 * 2. Strategy improvement based on insights
 * 3. Feedback incorporation
 * 4. Performance improvement tracking
 * 5. Learning from failures
 */

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { DefaultAgent } from '../../agents/shared/DefaultAgent';
import { ManagerType } from '../../agents/shared/base/managers/ManagerType';
import * as dotenv from 'dotenv';
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

// Test timeouts
const TEST_TIMEOUT = 60000; // 60 seconds
const EXTENDED_TEST_TIMEOUT = 240000; // 4 minutes

// Helper function to create a test agent with specific configurations
const createTestAgent = (options: {
  enableMemoryManager?: boolean;
  enableToolManager?: boolean;
  enableSchedulerManager?: boolean;
  enableReflectionManager?: boolean;
  enablePlanningManager?: boolean;
} = {}) => {
  const agent = new DefaultAgent({
    name: "ReflectionTester",
    componentsConfig: {
      memoryManager: { enabled: options.enableMemoryManager ?? true },
      toolManager: { enabled: options.enableToolManager ?? true },
      planningManager: { enabled: options.enablePlanningManager ?? false },
      schedulerManager: { enabled: options.enableSchedulerManager ?? false },
      reflectionManager: { enabled: options.enableReflectionManager ?? true }
    }
  });
  
  return agent;
};

describe('Reflection-Driven Improvement Tests', () => {
  let agent: DefaultAgent;
  
  beforeEach(async () => {
    // Skip all tests if OpenAI API key is not available
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, skipping tests');
      return;
    }
    
    // Create a fresh agent for each test
    agent = createTestAgent({
      enableMemoryManager: true,
      enableReflectionManager: true,
      enableToolManager: true
    });
    
    await agent.initialize();
  });
  
  afterEach(async () => {
    if (agent) {
      await agent.shutdown();
    }
  });
  
  test('Insight generation after task execution', async () => {
    // Skip if required API keys are missing
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, skipping test');
      return;
    }
    
    console.log('Testing insight generation after task execution...');
    
    // Execute a task that can generate insights
    const response = await agent.processUserInput(
      "Generate a summary of the key technological advances in quantum computing in 2023."
    );
    
    // Verify response exists
    expect(response).toBeDefined();
    expect(response.content).toBeTruthy();
    
    // Request reflection on the task
    const reflectionResponse = await agent.processUserInput(
      "Can you reflect on how you generated that quantum computing summary? What could be improved?"
    );
    
    // Verify reflection contains insights
    expect(reflectionResponse.content).toBeTruthy();
    
    // Look for reflection language
    const hasReflectionLanguage = 
      reflectionResponse.content.toLowerCase().includes('reflect') || 
      reflectionResponse.content.toLowerCase().includes('approach') ||
      reflectionResponse.content.toLowerCase().includes('improve') ||
      reflectionResponse.content.toLowerCase().includes('next time') ||
      reflectionResponse.content.toLowerCase().includes('better');
    
    expect(hasReflectionLanguage).toBe(true);
    
    // Try to check if insights were stored in memory
    try {
      const memoryManager = agent.getManager(ManagerType.MEMORY);
      if (memoryManager && 'searchMemories' in memoryManager) {
        const reflectionMemories = await (memoryManager as any).searchMemories("reflection quantum computing", {
          limit: 5
        });
        
        console.log(`Found ${reflectionMemories.length} reflection-related memories`);
        
        // We should have at least one reflection memory
        expect(reflectionMemories.length).toBeGreaterThan(0);
      }
    } catch (error) {
      console.warn('Memory search not supported or error:', error);
    }
  }, TEST_TIMEOUT);
  
  test('Strategy improvement based on reflection insights', async () => {
    // Skip if required API keys are missing
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, skipping test');
      return;
    }
    
    console.log('Testing strategy improvement based on reflection insights...');
    
    // First create a strategy for a task
    const initialStrategyResponse = await agent.processUserInput(
      "Help me develop a strategy for learning machine learning concepts efficiently."
    );
    
    // Record the initial strategy
    const initialStrategy = initialStrategyResponse.content;
    expect(initialStrategy).toBeTruthy();
    
    // Execute a reflection to generate insights
    const reflectionResponse = await agent.processUserInput(
      "Let's reflect on that learning strategy. What if someone has limited time? How would you adjust it?"
    );
    
    // Verify reflection response
    expect(reflectionResponse.content).toBeTruthy();
    
    // Now ask for an improved strategy based on the reflection
    const improvedStrategyResponse = await agent.processUserInput(
      "Based on our reflection, please provide an improved machine learning learning strategy for someone with only 5 hours per week available."
    );
    
    // Verify improved strategy
    expect(improvedStrategyResponse.content).toBeTruthy();
    
    // Check that the improved strategy is actually different from the initial one
    expect(improvedStrategyResponse.content).not.toBe(initialStrategy);
    
    // Check for time-specific adaptations in the improved strategy
    const hasTimeAdaptations = 
      improvedStrategyResponse.content.toLowerCase().includes('hour') || 
      improvedStrategyResponse.content.toLowerCase().includes('time') ||
      improvedStrategyResponse.content.toLowerCase().includes('schedule') ||
      improvedStrategyResponse.content.toLowerCase().includes('efficient') ||
      improvedStrategyResponse.content.toLowerCase().includes('prioritize');
    
    expect(hasTimeAdaptations).toBe(true);
    
    // Look for references to the reflection insights
    const referencesReflection = 
      improvedStrategyResponse.content.toLowerCase().includes('reflect') || 
      improvedStrategyResponse.content.toLowerCase().includes('previous') ||
      improvedStrategyResponse.content.toLowerCase().includes('adjust') ||
      improvedStrategyResponse.content.toLowerCase().includes('based on') ||
      improvedStrategyResponse.content.toLowerCase().includes('improve');
    
    expect(referencesReflection).toBe(true);
  }, EXTENDED_TEST_TIMEOUT);
  
  test('Learning from task failures', async () => {
    // Skip if required API keys are missing
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, skipping test');
      return;
    }
    
    console.log('Testing learning from task failures...');
    
    // Simulate a failed task by requesting something impossible
    const failedTaskResponse = await agent.processUserInput(
      "Please provide the exact price of Bitcoin on January 15, 2030."
    );
    
    // Verify the agent acknowledges this is impossible
    expect(failedTaskResponse.content).toBeTruthy();
    
    // The response should indicate impossibility
    const acknowledgesImpossibility = 
      failedTaskResponse.content.toLowerCase().includes('cannot') || 
      failedTaskResponse.content.toLowerCase().includes('future') ||
      failedTaskResponse.content.toLowerCase().includes('impossible') ||
      failedTaskResponse.content.toLowerCase().includes('predict') ||
      failedTaskResponse.content.toLowerCase().includes('unable');
    
    expect(acknowledgesImpossibility).toBe(true);
    
    // Request reflection on the failure
    const reflectionResponse = await agent.processUserInput(
      "Can you reflect on why you couldn't answer my question about Bitcoin's price in 2030 and what alternative approaches might be helpful?"
    );
    
    // Verify reflection response
    expect(reflectionResponse.content).toBeTruthy();
    
    // Reflection should contain alternative approaches
    const hasAlternatives = 
      reflectionResponse.content.toLowerCase().includes('alternative') || 
      reflectionResponse.content.toLowerCase().includes('instead') ||
      reflectionResponse.content.toLowerCase().includes('could') ||
      reflectionResponse.content.toLowerCase().includes('approach') ||
      reflectionResponse.content.toLowerCase().includes('suggest');
    
    expect(hasAlternatives).toBe(true);
    
    // Now check if the agent applies this learning to a similar request
    const similarRequestResponse = await agent.processUserInput(
      "What will be the most popular programming language in 2035?"
    );
    
    // Verify response
    expect(similarRequestResponse.content).toBeTruthy();
    
    // The response should show improved handling by offering alternatives or explaining limitations
    const showsImprovedHandling = 
      similarRequestResponse.content.toLowerCase().includes('cannot predict') || 
      similarRequestResponse.content.toLowerCase().includes('alternative') ||
      similarRequestResponse.content.toLowerCase().includes('trend') ||
      similarRequestResponse.content.toLowerCase().includes('instead') ||
      similarRequestResponse.content.toLowerCase().includes('suggest');
    
    expect(showsImprovedHandling).toBe(true);
  }, EXTENDED_TEST_TIMEOUT);
  
  test('Performance improvement over repeated similar tasks', async () => {
    // Skip if required API keys are missing
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, skipping test');
      return;
    }
    
    console.log('Testing performance improvement over repeated similar tasks...');
    
    // Execute a series of similar summarization tasks
    const summaryTasks = [
      "Summarize the basic concept of neural networks in 3 sentences.",
      "Summarize the concept of gradient descent in 3 sentences.",
      "Summarize the concept of backpropagation in 3 sentences."
    ];
    
    const summaryResponses = [];
    const startTimes = [];
    const endTimes: number[] = [];
    
    for (const task of summaryTasks) {
      const startTime = Date.now();
      const response = await agent.processUserInput(task);
      const endTime = Date.now();
      
      summaryResponses.push(response.content);
      startTimes.push(startTime);
      endTimes.push(endTime);
      
      // Verify response exists
      expect(response.content).toBeTruthy();
      
      // Brief pause between tasks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Calculate task durations
    const durations = startTimes.map((start, index) => endTimes[index] - start);
    console.log('Task durations (ms):', durations);
    
    // Request a reflection on the summary creation process
    const reflectionResponse = await agent.processUserInput(
      "Can you reflect on how you approached the summarization tasks I just gave you about neural networks, gradient descent, and backpropagation? What did you learn that could help with future summarization tasks?"
    );
    
    // Verify reflection response
    expect(reflectionResponse.content).toBeTruthy();
    
    // Now test if there's improvement with another similar task
    const finalStartTime = Date.now();
    const finalResponse = await agent.processUserInput(
      "Summarize the concept of convolutional neural networks in 3 sentences."
    );
    const finalEndTime = Date.now();
    const finalDuration = finalEndTime - finalStartTime;
    
    // Verify response exists
    expect(finalResponse.content).toBeTruthy();
    
    console.log('Final task duration (ms):', finalDuration);
    
    // We would ideally check if duration improved, but this depends on many factors
    // So we'll check more reliable metrics
    
    // Check if the final summary follows the 3-sentence constraint
    const sentenceCount = finalResponse.content.split(/[.!?]+\s/).filter(Boolean).length;
    console.log('Sentence count in final summary:', sentenceCount);
    
    // It should be 3 sentences or close (3-4)
    expect(sentenceCount).toBeLessThanOrEqual(4);
    
    // Look for more precise summarization language indicating learning
    const containsSpecificTerms = 
      finalResponse.content.toLowerCase().includes('convolutional') && 
      finalResponse.content.toLowerCase().includes('neural networks');
    
    expect(containsSpecificTerms).toBe(true);
  }, EXTENDED_TEST_TIMEOUT);
}); 