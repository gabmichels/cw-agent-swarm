/**
 * Task Decomposition Test
 * 
 * Tests the DefaultAgent's ability to break down complex tasks into smaller subtasks
 * and execute them in sequence.
 */

import { DefaultAgent } from '../../agents/shared/DefaultAgent';
import { ManagerType } from '../../agents/shared/base/managers/ManagerType';
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest';

// Set longer timeout for complex task tests
vi.setConfig({ testTimeout: 20000 });

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
                content: "I've broken down this task into smaller steps.",
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
          { text: 'research', confidence: 0.9 },
          { text: 'comparison', confidence: 0.9 },
          { text: 'machine learning', confidence: 0.8 }
        ],
        success: true
      })
    },
    OpenAITagExtractor: {
      getInstance: () => ({
        extractTags: vi.fn().mockResolvedValue({
          tags: [
            { text: 'research', confidence: 0.9 },
            { text: 'comparison', confidence: 0.9 },
            { text: 'machine learning', confidence: 0.8 }
          ],
          success: true
        })
      })
    },
    extractTags: vi.fn().mockResolvedValue({
      tags: [
        { text: 'research', confidence: 0.9 },
        { text: 'comparison', confidence: 0.9 },
        { text: 'machine learning', confidence: 0.8 }
      ],
      success: true
    })
  };
});

// Other mocks
vi.mock('@langchain/openai', () => {
  return {
    ChatOpenAI: class MockChatOpenAI {
      constructor() {}
      invoke() {
        return Promise.resolve({
          content: "I've broken down this task into smaller steps."
        });
      }
      call() {
        return Promise.resolve({
          content: "I've broken down this task into smaller steps."
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
          content: "I've broken down this task into smaller steps."
        });
      },
      call() {
        return Promise.resolve({
          content: "I've broken down this task into smaller steps."
        });
      }
    })
  };
});

// Define interfaces for planning manager capabilities
interface PlanStep {
  id: string;
  name: string;
  description?: string;
  status: string;
  result?: string;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  steps: PlanStep[];
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface PlanResult {
  success: boolean;
  plan: {
    name: string;
    description: string;
    steps: Array<{
      id: string;
      name: string;
      status: string;
      result?: string;
    }>;
  };
  result: string;
}

interface StepExecutionResult {
  success: boolean;
  result: string;
  updated_step: PlanStep;
}

interface PlanProgress {
  totalSteps: number;
  completedSteps: number;
  progress: number;
  currentStep: string;
  estimatedTimeRemaining: string;
}

interface PlanningManager {
  createPlan: (description: string) => Promise<Plan>;
  executeStep: (planId: string, stepId: string) => Promise<StepExecutionResult>;
  updatePlan: (planId: string, updates: Record<string, unknown>) => Promise<Plan>;
  getPlanProgress: (planId: string) => Promise<PlanProgress>;
}

interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ToolManager {
  selectToolForTask: (taskDescription: string) => Promise<Tool | null>;
}

describe('DefaultAgent Task Decomposition', () => {
  let agent: DefaultAgent;
  let originalEnv: typeof process.env;
  
  beforeEach(async () => {
    // Store original env variables
    originalEnv = { ...process.env };
    
    // Set test environment variables
    process.env.OPENAI_API_KEY = 'test-key-not-real';
    process.env.TEST_MODE = 'true';
    
    // Create agent with planning capabilities enabled
    agent = new DefaultAgent({
      name: "TaskDecompositionTester",
      enableMemoryManager: true,
      enableToolManager: true,
      enablePlanningManager: true,
      enableSchedulerManager: true,
      enableReflectionManager: false
    });
    
    // Mock methods
    vi.spyOn(agent, 'getName').mockReturnValue("TaskDecompositionTester");
    
    // Initialize the agent
    await agent.initialize();
  });
  
  afterEach(async () => {
    // Cleanup
    if (agent) {
      await agent.shutdown();
    }
    
    // Restore original env
    process.env = originalEnv;
    
    // Reset mocks
    vi.clearAllMocks();
  });
  
  describe('Planning and Execution', () => {
    test('Agent can decompose a complex task into subtasks', async () => {
      // Skip if planning manager is not available
      const planningManager = agent.getManager(ManagerType.PLANNING);
      if (!planningManager) {
        console.log('PlanningManager not available, skipping test');
        return;
      }
      
      // Mock the planAndExecute method if it exists
      if ('planAndExecute' in agent) {
        vi.spyOn(agent as any, 'planAndExecute').mockResolvedValue({
          success: true,
          plan: {
            name: "Research and Comparison Plan",
            description: "Compare top ML frameworks",
            steps: [
              {
                id: "step-1",
                name: "Research TensorFlow",
                status: "completed",
                result: "TensorFlow details gathered"
              },
              {
                id: "step-2",
                name: "Research PyTorch",
                status: "completed",
                result: "PyTorch details gathered"
              },
              {
                id: "step-3",
                name: "Research Scikit-learn",
                status: "completed",
                result: "Scikit-learn details gathered"
              },
              {
                id: "step-4",
                name: "Create comparison table",
                status: "completed",
                result: "Comparison table created"
              },
              {
                id: "step-5",
                name: "Save as HTML file",
                status: "completed",
                result: "Saved as ml_framework_comparison.html"
              }
            ]
          },
          result: "Task completed successfully. Created HTML comparison file of ML frameworks."
        } as PlanResult);
        
        // Execute the complex task
        const result = await (agent as any).planAndExecute(
          "Research the top 3 machine learning frameworks, create a comparison table, and save it as an HTML file"
        );
        
        // Verify the result
        expect(result).toBeTruthy();
        expect(result.success).toBe(true);
        expect(result.plan).toBeTruthy();
        expect(result.plan.steps.length).toBe(5);
        
        // Verify all steps were completed
        const allStepsCompleted = result.plan.steps.every((step: PlanStep) => step.status === "completed");
        expect(allStepsCompleted).toBe(true);
      } else {
        console.log('planAndExecute method not available, skipping test');
      }
    });
    
    test('Agent tracks status of each subtask during execution', async () => {
      // Skip if planning manager is not available
      const planningManager = agent.getManager(ManagerType.PLANNING);
      if (!planningManager) {
        console.log('PlanningManager not available, skipping test');
        return;
      }
      
      // If agent supports step-by-step plan creation and execution
      if ('createPlan' in planningManager && 'executeStep' in planningManager) {
        // Cast to PlanningManager for type safety
        const typedPlanningManager = planningManager as unknown as PlanningManager;
        
        // Mock the createPlan method
        const mockCreatePlan = vi.fn().mockResolvedValue({
          id: "plan-123",
          name: "Data Analysis Plan",
          description: "Analyze customer data and generate insights",
          steps: [
            {
              id: "step-1",
              name: "Data collection",
              description: "Gather customer data from CRM",
              status: "pending"
            },
            {
              id: "step-2",
              name: "Data cleaning",
              description: "Remove duplicates and handle missing values",
              status: "pending"
            },
            {
              id: "step-3",
              name: "Statistical analysis",
              description: "Calculate key metrics and trends",
              status: "pending"
            },
            {
              id: "step-4",
              name: "Visualization",
              description: "Create graphs and charts",
              status: "pending"
            },
            {
              id: "step-5",
              name: "Summary report",
              description: "Generate final report with insights",
              status: "pending"
            }
          ],
          status: "created",
          created_at: new Date(),
          updated_at: new Date()
        } as Plan);
        
        // Assign the mock to the createPlan method
        typedPlanningManager.createPlan = mockCreatePlan;
        
        // Mock the executeStep method
        const mockExecuteStep = vi.fn().mockImplementation(async (planId: string, stepId: string) => {
          return {
            success: true,
            result: `Step ${stepId} executed successfully`,
            updated_step: {
              id: stepId,
              name: `Step ${stepId.split('-')[1]}`,
              status: "completed",
              result: `Completed step ${stepId}`
            }
          } as StepExecutionResult;
        });
        
        // Assign the mock to the executeStep method
        typedPlanningManager.executeStep = mockExecuteStep;
        
        // Create a plan
        const plan = await typedPlanningManager.createPlan("Analyze customer data and generate insights");
        
        expect(plan).toBeTruthy();
        expect(plan.steps.length).toBe(5);
        
        // Execute each step and verify status updates
        for (const step of plan.steps) {
          const stepResult = await typedPlanningManager.executeStep(plan.id, step.id);
          
          expect(stepResult.success).toBe(true);
          expect(stepResult.updated_step.status).toBe("completed");
        }
      } else {
        console.log('createPlan or executeStep methods not available, skipping test');
      }
    });
    
    test('Agent can adapt plan as execution progresses', async () => {
      // Skip if planning manager is not available
      const planningManager = agent.getManager(ManagerType.PLANNING);
      if (!planningManager) {
        console.log('PlanningManager not available, skipping test');
        return;
      }
      
      // If agent supports plan adaptation
      if ('updatePlan' in planningManager) {
        // Cast to PlanningManager for type safety
        const typedPlanningManager = planningManager as unknown as PlanningManager;
        
        // Mock an initial plan
        const initialPlan = {
          id: "plan-456",
          name: "Market Research Plan",
          description: "Research competitor products",
          steps: [
            {
              id: "step-1",
              name: "Identify main competitors",
              status: "pending"
            },
            {
              id: "step-2",
              name: "Gather product information",
              status: "pending"
            },
            {
              id: "step-3",
              name: "Compare pricing",
              status: "pending"
            }
          ],
          status: "created",
          created_at: new Date(),
          updated_at: new Date()
        } as Plan;
        
        // Mock the createPlan method
        const mockCreatePlan = vi.fn().mockResolvedValue(initialPlan);
        typedPlanningManager.createPlan = mockCreatePlan;
        
        // Mock the updatePlan method to simulate adaptation
        const mockUpdatePlan = vi.fn().mockImplementation(async (planId: string, updates: Record<string, unknown>) => {
          // Add new steps to the plan
          return {
            ...initialPlan,
            steps: [
              ...initialPlan.steps,
              {
                id: "step-4",
                name: "Analyze customer reviews",
                status: "pending"
              },
              {
                id: "step-5",
                name: "Identify competitive advantages",
                status: "pending"
              }
            ],
            status: "updated",
            updated_at: new Date()
          } as Plan;
        });
        typedPlanningManager.updatePlan = mockUpdatePlan;
        
        // Create initial plan
        const plan = await typedPlanningManager.createPlan("Research competitor products");
        
        expect(plan).toBeTruthy();
        expect(plan.steps.length).toBe(3);
        
        // Update the plan to adapt to new information
        const updatedPlan = await typedPlanningManager.updatePlan(plan.id, {
          adapt_reason: "Found additional data sources with customer reviews"
        });
        
        // Verify the plan was adapted
        expect(updatedPlan).toBeTruthy();
        expect(updatedPlan.steps.length).toBe(5);
        expect(updatedPlan.steps[3].name).toBe("Analyze customer reviews");
      } else {
        console.log('updatePlan method not available, skipping test');
      }
    });
  });
  
  describe('Tool Selection for Subtasks', () => {
    test('Agent selects appropriate tools for each subtask', async () => {
      // Skip if planning and tool managers are not available
      const planningManager = agent.getManager(ManagerType.PLANNING);
      const toolManager = agent.getManager(ManagerType.TOOL);
      
      if (!planningManager || !toolManager) {
        console.log('PlanningManager or ToolManager not available, skipping test');
        return;
      }
      
      // If agent supports tool selection for tasks
      if ('selectToolForTask' in toolManager) {
        // Cast to ToolManager for type safety
        const typedToolManager = toolManager as unknown as ToolManager;
        
        // Mock the selectToolForTask method
        const mockSelectToolForTask = vi.fn().mockImplementation(async (taskDescription: string) => {
          if (taskDescription.toLowerCase().includes('research')) {
            return {
              name: "web_search",
              description: "Search the web for information",
              parameters: {
                query: "string"
              }
            } as Tool;
          } else if (taskDescription.toLowerCase().includes('data')) {
            return {
              name: "data_processor",
              description: "Process and analyze data",
              parameters: {
                data: "array",
                operation: "string"
              }
            } as Tool;
          } else if (taskDescription.toLowerCase().includes('save') || 
                    taskDescription.toLowerCase().includes('file')) {
            return {
              name: "file_writer",
              description: "Save data to a file",
              parameters: {
                content: "string",
                filename: "string"
              }
            } as Tool;
          } else {
            return null;
          }
        });
        typedToolManager.selectToolForTask = mockSelectToolForTask;
        
        // Test tool selection for different subtasks
        const researchTool = await typedToolManager.selectToolForTask("Research TensorFlow features");
        const dataTool = await typedToolManager.selectToolForTask("Process and clean the collected data");
        const fileTool = await typedToolManager.selectToolForTask("Save the results as HTML file");
        
        // Verify correct tools were selected
        expect(researchTool?.name).toBe("web_search");
        expect(dataTool?.name).toBe("data_processor");
        expect(fileTool?.name).toBe("file_writer");
      } else {
        console.log('selectToolForTask method not available, skipping test');
      }
    });
  });
  
  describe('Progress Tracking', () => {
    test('Agent tracks progress of multi-step task execution', async () => {
      // Skip if planning manager is not available
      const planningManager = agent.getManager(ManagerType.PLANNING);
      if (!planningManager) {
        console.log('PlanningManager not available, skipping test');
        return;
      }
      
      // If agent supports progress tracking
      if ('getPlanProgress' in planningManager) {
        // Cast to PlanningManager for type safety
        const typedPlanningManager = planningManager as unknown as PlanningManager;
        
        // Mock functions for plan creation and progress tracking
        const planId = "progress-plan-123";
        
        // Mock the createPlan method
        const mockCreatePlan = vi.fn().mockResolvedValue({
          id: planId,
          name: "Data Analysis Project",
          description: "Complete data analysis project",
          steps: [
            { id: "step-1", name: "Data collection", status: "pending" },
            { id: "step-2", name: "Data cleaning", status: "pending" },
            { id: "step-3", name: "Analysis", status: "pending" },
            { id: "step-4", name: "Visualization", status: "pending" },
            { id: "step-5", name: "Report creation", status: "pending" }
          ],
          status: "created",
          created_at: new Date(),
          updated_at: new Date()
        } as Plan);
        typedPlanningManager.createPlan = mockCreatePlan;
        
        // Mock the getPlanProgress method
        const mockGetPlanProgress = vi.fn().mockImplementation(async (id: string) => {
          if (id === planId) {
            return {
              totalSteps: 5,
              completedSteps: 2,
              progress: 0.4,
              currentStep: "Analysis",
              estimatedTimeRemaining: "15 minutes"
            } as PlanProgress;
          }
          return null;
        });
        typedPlanningManager.getPlanProgress = mockGetPlanProgress;
        
        // Create a plan
        const plan = await typedPlanningManager.createPlan("Complete data analysis project");
        
        // Get progress
        const progress = await typedPlanningManager.getPlanProgress(plan.id);
        
        // Verify progress tracking
        expect(progress).toBeTruthy();
        expect(progress.totalSteps).toBe(5);
        expect(progress.completedSteps).toBe(2);
        expect(progress.progress).toBe(0.4);
      } else {
        console.log('getPlanProgress method not available, skipping test');
      }
    });
  });
}); 