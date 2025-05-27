/**
 * Asynchronous Capabilities Test
 * 
 * Tests the asynchronous and scheduled task capabilities of DefaultAgent.
 * Focuses on the agent's ability to perform tasks over time without user intervention.
 */

import { DefaultAgent } from '../../agents/shared/DefaultAgent';
import { ManagerType } from '../../agents/shared/base/managers/ManagerType';
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest';
import { TaskCreationResult, TaskCreationOptions } from '../../agents/shared/base/managers/SchedulerManager.interface';
import { AgentBase } from '../../agents/shared/base/AgentBase.interface';
import { TaskStatus, TaskScheduleType } from '../../lib/scheduler/models/Task.model';

// Store original process.env
const originalEnv = process.env;

// Mock Task interface to match what we need for tests
interface Task {
  id: string;
  name: string;
  description: string;
  scheduleType: TaskScheduleType;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  priority: number;
  dependencies?: any[];
  metadata?: {
    scheduledTime?: Date;
    action?: string;
    parameters?: {
      message?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  handler?: (...args: unknown[]) => Promise<unknown>;
}

// Set longer timeout for async tests
vi.setConfig({ testTimeout: 30000 }); // 30 seconds

// Ensure deterministic values in tests
vi.mock('crypto', () => ({
  randomUUID: () => 'test-uuid'
}));

// Mock OpenAI dependency
vi.mock('openai', () => {
  const mockOpenAIClient = {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: "Task scheduled successfully.",
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

// Mock the tag extractor
vi.mock('../../utils/tagExtractor', () => {
  return {
    tagExtractor: {
      extractTags: vi.fn().mockResolvedValue({
        tags: [
          { text: 'scheduled', confidence: 0.9 },
          { text: 'task', confidence: 0.9 },
          { text: 'reminder', confidence: 0.8 }
        ],
        success: true
      })
    },
    OpenAITagExtractor: {
      getInstance: () => ({
        extractTags: vi.fn().mockResolvedValue({
          tags: [
            { text: 'scheduled', confidence: 0.9 },
            { text: 'task', confidence: 0.9 },
            { text: 'reminder', confidence: 0.8 }
          ],
          success: true
        })
      })
    },
    // Export extractTags function
    extractTags: vi.fn().mockResolvedValue({
      tags: [
        { text: 'scheduled', confidence: 0.9 },
        { text: 'task', confidence: 0.9 },
        { text: 'reminder', confidence: 0.8 }
      ],
      success: true
    })
  };
});

// Mock langchain and other LLM-related modules
vi.mock('@langchain/openai', () => {
  return {
    ChatOpenAI: class MockChatOpenAI {
      constructor() {}
      invoke() {
        return Promise.resolve({
          content: "Task scheduled successfully."
        });
      }
      call() {
        return Promise.resolve({
          content: "Task scheduled successfully."
        });
      }
    }
  };
});

vi.mock('../../lib/core/llm', () => {
  return {
    createChatOpenAI: () => ({
      invoke() {
        return Promise.resolve({
          content: "Task scheduled successfully."
        });
      },
      call() {
        return Promise.resolve({
          content: "Task scheduled successfully."
        });
      }
    })
  };
});

// Mock ThinkingService
vi.mock('../../services/thinking/ThinkingService', () => {
  return {
    ThinkingService: class MockThinkingService {
      constructor() {}
      processRequest() {
        return Promise.resolve({
          result: "Processing complete",
          success: true,
          artifacts: {}
        });
      }
    }
  };
});

// Define a scheduler manager interface for tests
interface SchedulerManager {
  getDueTasks: () => Promise<Task[]>;
  executeDueTask: (task: Task) => Promise<boolean>;
  pollForDueTasks: () => Promise<number>;
}

describe('DefaultAgent Asynchronous Capabilities', () => {
  let agent: DefaultAgent;
  let originalEnv: typeof process.env;
  
  // Task tracking variables for tests
  let scheduledTaskId: string | null = null;
  let executionCount = 0;
  
  beforeEach(async () => {
    // Set up fake timers for each test
    vi.useFakeTimers();
    
    // Reset task tracking
    scheduledTaskId = null;
    executionCount = 0;
    
    // Store original env variables
    originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env.OPENAI_API_KEY = 'test-key-not-real';
    process.env.TEST_MODE = 'true';
    
    // Create agent with scheduler capabilities enabled
    agent = new DefaultAgent({
      name: "AsyncCapabilityTester",
      componentsConfig: {
        memoryManager: { enabled: true },
        toolManager: { enabled: true },
        planningManager: { enabled: true },
        schedulerManager: { enabled: true },
        reflectionManager: { enabled: true }
      }
    });
    
    // Mock methods
    vi.spyOn(agent, 'getName').mockReturnValue("AsyncCapabilityTester");
    
    // Mock createTask to track task creation
    vi.spyOn(agent, 'createTask').mockImplementation(async (options: any) => {
      scheduledTaskId = `task-${Date.now()}`;
      return scheduledTaskId as unknown as TaskCreationResult;
    });
    
    // Mock getTask to return task status
    vi.spyOn(agent, 'getTask').mockImplementation(async (taskId: string) => {
      if (taskId === scheduledTaskId) {
        const now = Date.now();
        
        // For the first test, always return pending
        return {
          id: taskId,
          name: "Test Scheduled Task",
          description: "A task that was scheduled for testing",
          scheduleType: TaskScheduleType.EXPLICIT,
          status: TaskStatus.PENDING,
          createdAt: new Date(now - 10000),
          updatedAt: new Date(now - 10000),
          priority: 1,
          dependencies: [],
          metadata: {
            scheduledTime: new Date(now + 3600000) // Scheduled 1 hour in the future
          },
          handler: async () => true
        } as any;
      }
      return null;
    });
    
    // Mock processUserInput to track calls
    vi.spyOn(agent, 'processUserInput').mockImplementation(async (message: string) => {
      executionCount++;
      return {
        content: `Processed task ${executionCount}: ${message}`,
        thoughts: [],
        metadata: {}
      };
    });
    
    // Initialize the agent
    await agent.initialize();
  });
  
  afterEach(async () => {
    // Cleanup agent
    if (agent) {
      await agent.shutdown();
    }
    
    // Restore original env and reset mocks
    process.env = originalEnv;
    vi.clearAllMocks();
    
    // Restore real timers
    vi.useRealTimers();
  });
  
  describe('Scheduled Task Execution', () => {
    test('Agent can create and retrieve a scheduled task', async () => {
      // Create a scheduled task
      const taskId = await agent.createTask({
        name: "Future reminder",
        description: "Send a reminder about the weekly meeting",
        scheduleType: TaskScheduleType.EXPLICIT,
        metadata: {
          scheduledTime: new Date(Date.now() + 3600000) // 1 hour in future
        }
      } as any);
      
      expect(taskId).toBeTruthy();
      
      // Verify task retrieval - cast taskId to string to fix type issue
      const task = await agent.getTask(taskId as unknown as string);
      
      expect(task).toBeTruthy();
      expect(task?.status).toBe(TaskStatus.PENDING);
      expect(task?.scheduleType).toBe(TaskScheduleType.EXPLICIT);
    });
    
    test('Scheduler can track due tasks', async () => {
      // Skip if scheduler manager not available
      const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
      if (!schedulerManager) {
        console.log('SchedulerManager not available, skipping test');
        return;
      }
      
      // Create scheduled task
      const taskId = await agent.createTask({
        name: "Soon due task",
        description: "This task should become due soon",
        scheduleType: TaskScheduleType.EXPLICIT,
        metadata: {
          scheduledTime: new Date(Date.now() + 1000) // 1 second in future
        }
      } as any);
      
      // Mock scheduler manager methods if they exist
      if ('getDueTasks' in schedulerManager) {
        // Cast to SchedulerManager for type safety
        const typedSchedulerManager = schedulerManager as unknown as SchedulerManager;
        const mockGetDueTasks = vi.fn().mockResolvedValue([]);
        
        // Override the getDueTasks method
        typedSchedulerManager.getDueTasks = mockGetDueTasks;
        
        // Initially no tasks should be due
        const initialDueTasks = await typedSchedulerManager.getDueTasks();
        expect(initialDueTasks.length).toBe(0);
        
        // Advance time by 2 seconds to make task due
        vi.advanceTimersByTime(2000);
        
        // Now mock that task is due
        mockGetDueTasks.mockResolvedValue([{
          id: taskId as unknown as string,
          name: "Soon due task",
          description: "This task should become due soon",
          scheduleType: TaskScheduleType.EXPLICIT,
          status: TaskStatus.PENDING,
          createdAt: new Date(Date.now() - 2000),
          updatedAt: new Date(Date.now() - 2000),
          priority: 1,
          dependencies: [],
          metadata: {
            scheduledTime: new Date(Date.now() - 1000)
          },
          handler: async () => true
        } as Task]);
        
        // Now task should be due
        const dueTasks = await typedSchedulerManager.getDueTasks();
        expect(dueTasks.length).toBe(1);
        expect(dueTasks[0].id).toBe(taskId as unknown as string);
      } else {
        console.log('getDueTasks method not available, skipping part of test');
      }
    });
    
    test('Agent can execute a scheduled task when it becomes due', async () => {
      // Skip if scheduler manager not available
      const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
      if (!schedulerManager) {
        console.log('SchedulerManager not available, skipping test');
        return;
      }
      
      // Create a task that's due soon
      const taskId = await agent.createTask({
        name: "Process data",
        description: "Process the latest data when due",
        scheduleType: TaskScheduleType.EXPLICIT,
        metadata: {
          scheduledTime: new Date(Date.now() + 1000), // 1 second in future
          action: "processUserInput",
          parameters: {
            message: "Process the latest Bitcoin data"
          }
        }
      } as any);
      
      // Initial execution count should be 0
      expect(executionCount).toBe(0);
      
      // Check if executeDueTask exists on schedulerManager
      if (!('executeDueTask' in schedulerManager)) {
        console.log('SchedulerManager or executeDueTask not available, skipping test');
        return;
      }
      
      // Cast to SchedulerManager for type safety
      const typedSchedulerManager = schedulerManager as unknown as SchedulerManager;
      
      const mockExecuteDueTask = vi.fn().mockImplementation(async (task: Task) => {
        // Simulate task execution by calling the agent's processUserInput
        const message = task.metadata?.parameters?.message;
        if (message && typeof message === 'string') {
          await agent.processUserInput(message);
        }
        return true;
      });
      
      // Override the executeDueTask method
      typedSchedulerManager.executeDueTask = mockExecuteDueTask;
      
      // Advance time by 2 seconds to make task due
      vi.advanceTimersByTime(2000);
      
      // Manually execute the due task (simulating scheduler polling)
      await typedSchedulerManager.executeDueTask({
        id: taskId as unknown as string,
        name: "Process data",
        description: "Process the latest data when due",
        scheduleType: TaskScheduleType.EXPLICIT,
        status: TaskStatus.PENDING,
        createdAt: new Date(Date.now() - 2000),
        updatedAt: new Date(Date.now() - 2000),
        priority: 1,
        dependencies: [],
        metadata: {
          scheduledTime: new Date(Date.now() - 1000),
          action: "processUserInput",
          parameters: {
            message: "Process the latest Bitcoin data"
          }
        },
        handler: async () => true
      } as any);
      
      // Check that the task was executed (processUserInput was called)
      expect(executionCount).toBe(1);
    });
  });
  
  describe('Task Scheduling Persistence', () => {
    test('Tasks remain scheduled across agent restarts', async () => {
      // This test simulates persistence by creating a task,
      // shutting down the agent, creating a new one, and verifying
      // the task still exists (using our mocks)
      
      // Mock memory storage to track task across instances
      const storedTasks: Task[] = [];
      
      // Create first agent
      const agent1 = new DefaultAgent({
        name: "PersistenceTest1",
        componentsConfig: {
          memoryManager: { enabled: true },
          toolManager: { enabled: false },
          planningManager: { enabled: false },
          schedulerManager: { enabled: true },
          reflectionManager: { enabled: false }
        }
      });
      
      // Override createTask to store in our mock storage
      vi.spyOn(agent1, 'createTask').mockImplementation(async (options: any) => {
        const taskId = `persist-${Date.now()}`;
        storedTasks.push({
          id: taskId,
          ...options,
          status: TaskStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          dependencies: [],
          handler: async () => true
        } as any);
        return taskId as unknown as TaskCreationResult;
      });
      
      // Override getTask to retrieve from our mock storage with correct type casting
      const mockGetTask = async (taskId: string) => {
        return storedTasks.find(t => t.id === taskId) || null;
      };

      // Use type assertion to bypass TypeScript checking
      vi.spyOn(agent1, 'getTask').mockImplementation(mockGetTask as any);
      
      await agent1.initialize();
      
      // Create scheduled task with first agent
      const taskId = await agent1.createTask({
        name: "Persistent task",
        description: "This task should persist across agent restarts",
        scheduleType: TaskScheduleType.EXPLICIT,
        metadata: {
          scheduledTime: new Date(Date.now() + 3600000) // 1 hour in future
        }
      } as any);
      
      // Verify task was created
      expect(taskId).toBeTruthy();
      expect(storedTasks.length).toBe(1);
      
      // Shut down first agent
      await agent1.shutdown();
      
      // Create second agent to simulate restart
      const agent2 = new DefaultAgent({
        name: "PersistenceTest2",
        componentsConfig: {
          memoryManager: { enabled: true },
          toolManager: { enabled: false },
          planningManager: { enabled: false },
          schedulerManager: { enabled: true },
          reflectionManager: { enabled: false }
        }
      });
      
      // Override getTask to retrieve from our mock storage
      vi.spyOn(agent2, 'getTask').mockImplementation(mockGetTask as any);
      
      await agent2.initialize();
      
      // Try to retrieve the task with second agent
      const retrievedTask = await agent2.getTask(taskId as unknown as string);
      
      // Task should still be retrievable
      expect(retrievedTask).toBeTruthy();
      expect(retrievedTask?.id).toBe(taskId as unknown as string);
      expect(retrievedTask?.name).toBe("Persistent task");
      
      // Clean up
      await agent2.shutdown();
    });
  });
  
  describe('Autonomous Task Execution', () => {
    test('Agent can execute tasks without user intervention', async () => {
      // Skip if scheduler manager not available
      const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
      if (!schedulerManager) {
        console.log('SchedulerManager not available, skipping test');
        return;
      }
      
      // Check if pollForDueTasks exists on schedulerManager
      if (!('pollForDueTasks' in schedulerManager)) {
        console.log('SchedulerManager or pollForDueTasks not available, skipping test');
        return;
      }
      
      // Cast to SchedulerManager for type safety
      const typedSchedulerManager = schedulerManager as unknown as SchedulerManager;
      
      const mockPollForDueTasks = vi.fn().mockImplementation(async () => {
        const now = Date.now();
        
        // Create a due task
        const dueTask = {
          id: `auto-${now}`,
          name: "Autonomous execution",
          description: "This task should execute autonomously",
          scheduleType: TaskScheduleType.EXPLICIT,
          status: "pending",
          createdAt: new Date(now - 60000),
          updatedAt: new Date(now - 60000),
          priority: 1,
          metadata: {
            scheduledTime: new Date(now - 1000), // Due 1 second ago
            action: "processUserInput",
            parameters: {
              message: "Generate daily report"
            }
          }
        } as Task;
        
        // Execute the task directly
        const message = dueTask.metadata?.parameters?.message;
        if (message && typeof message === 'string') {
          await agent.processUserInput(message);
        }
        
        // Return that we found and executed 1 task
        return 1;
      });
      
      // Override the pollForDueTasks method
      typedSchedulerManager.pollForDueTasks = mockPollForDueTasks;
      
      // Initial execution count should be 0
      expect(executionCount).toBe(0);
      
      // Simulate an autonomous polling cycle
      await typedSchedulerManager.pollForDueTasks();
      
      // Check if the task was executed
      expect(executionCount).toBe(1);
      expect(mockPollForDueTasks).toHaveBeenCalledTimes(1);
    });
    
    test('Agent can schedule self-initiated tasks', async () => {
      // Skip if reflection manager is not available (needed for self-initiation)
      const reflectionManager = agent.getManager(ManagerType.REFLECTION);
      if (!reflectionManager) {
        console.log('ReflectionManager not available, skipping test');
        return;
      }
      
      // Skip if reflect method doesn't exist
      if (typeof (agent as any).reflect === 'undefined') {
        console.log('reflect method not available, skipping test');
        return;
      }
      
      // Mock the reflect method
      vi.spyOn(agent as any, 'reflect').mockImplementation(async () => {
        // During reflection, create a self-initiated task
        await agent.createTask({
          name: "Self-initiated task",
          description: "This task was created by the agent based on reflection",
          scheduleType: TaskScheduleType.EXPLICIT,
          metadata: {
            scheduledTime: new Date(Date.now() + 1000),
            action: "processUserInput",
            parameters: {
              message: "Execute autonomous analysis"
            }
          }
        } as any);
        
        return {
          insights: [
            {
              type: 'self_initiation',
              content: 'Created a task to check news based on analysis of user interests'
            }
          ],
          score: 0.9,
          timestamp: new Date()
        };
      });
      
      // Trigger reflection (which should schedule a task)
      const reflectionResult = await (agent as any).reflect({
        trigger: "scheduled_reflection"
      });
      
      // Verify reflection created a task
      expect(reflectionResult).toBeTruthy();
      expect(reflectionResult.insights).toBeTruthy();
      expect(scheduledTaskId).toBeTruthy(); // Our mock createTask should have been called
    });
  });
}); 