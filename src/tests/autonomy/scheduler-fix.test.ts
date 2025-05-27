/**
 * scheduler-fix.test.ts
 * 
 * This test verifies that the ModularSchedulerManager works correctly in the agent system.
 */

import { DefaultAgent } from '../../agents/shared/DefaultAgent';
import { ManagerType } from '../../agents/shared/base/managers/ManagerType';
import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { AgentResponse, MessageProcessingOptions } from '../../agents/shared/base/AgentBase.interface';
import { SchedulerManager } from '../../agents/shared/base/managers/SchedulerManager.interface';

// Mock OpenAI for responses
vi.mock('openai', () => {
  const mockOpenAIClient = {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: "Test response",
                role: 'assistant'
              },
              finish_reason: 'stop'
            }
          ]
        })
      }
    }
  };
  
  const MockOpenAI = vi.fn(() => mockOpenAIClient);
  
  return {
    OpenAI: MockOpenAI,
    default: MockOpenAI
  };
});

// Mock LLM modules for testing
vi.mock('@langchain/openai', () => {
  return {
    ChatOpenAI: class MockChatOpenAI {
      constructor() {}
      invoke() {
        return Promise.resolve({
          content: "Test response"
        });
      }
      call() {
        return Promise.resolve({
          content: "Test response"
        });
      }
    }
  };
});

describe('ModularSchedulerManager Tests', () => {
  let agent: DefaultAgent;
  let executedTaskMessages: string[] = [];

  beforeEach(async () => {
    // Reset task execution tracking
    executedTaskMessages = [];
    
    // Create a fresh agent for each test
    agent = new DefaultAgent({
      name: 'Scheduler Test Agent',
      systemPrompt: 'You are a test agent for scheduler functionality',
      componentsConfig: {
        memoryManager: { enabled: false },
        planningManager: { enabled: false },
        toolManager: { enabled: false },
        reflectionManager: { enabled: false },
        schedulerManager: {
          enabled: true,
          enableAutoScheduling: true,
          schedulingIntervalMs: 1000
        }
      }
    });

    // Initialize the agent
    const initialized = await agent.initialize();
    if (!initialized) throw new Error('Failed to initialize agent');

    // Mock processUserInput to track task execution
    vi.spyOn(agent, 'processUserInput').mockImplementation(async (message: string, options?: MessageProcessingOptions): Promise<AgentResponse> => {
      console.log(`[MOCK] Executed task message: ${message}`);
      executedTaskMessages.push(message);
      return { 
        content: `Processed: ${message}`,
        metadata: {}
      };
    });
  });

  afterEach(async () => {
    // Shutdown the agent
    await agent.shutdown();
  });

  test('Agent can initialize and access the ModularSchedulerManager', async () => {
    // Get the scheduler manager
    const schedulerManager = agent.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    
    // Verify that the scheduler manager is available
    expect(schedulerManager).toBeTruthy();
    
    // Check that createTask method is available
    expect(typeof schedulerManager?.createTask).toBe('function');
  });
  
  test('Agent can create tasks', async () => {
    // Get the scheduler manager
    const schedulerManager = agent.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    expect(schedulerManager).toBeTruthy();
    if (!schedulerManager) return;
    
    // Create a simple task
    const taskResult = await schedulerManager.createTask({
      name: "Simple test task",
      description: "A basic task to verify creation works",
      priority: 1,
      metadata: {
        test: true
      }
    } as any);
    
    // Verify that the result is truthy
    expect(taskResult).toBeTruthy();
  });
}); 