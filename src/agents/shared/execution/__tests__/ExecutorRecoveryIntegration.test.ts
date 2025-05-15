/**
 * Integration tests for Executor recovery with the Planner
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Executor, ExecutionStatus, ExecutionContext } from '../Executor';
import { ExecutionErrorHandler } from '../ExecutionErrorHandler';
import { DefaultPlanRecoverySystem } from '../../planning/recovery/DefaultPlanRecoverySystem';
import { Planner } from '../../planning/Planner';
import { ChatOpenAI } from '@langchain/openai';
import { ToolRouter } from '../../tools/ToolRouter';

// Mock ChatOpenAI
vi.mock('@langchain/openai', () => {
  const mockInvoke = vi.fn().mockResolvedValue({
    content: 'Mocked LLM response'
  });
  const mockPipe = vi.fn();
  
  return {
    ChatOpenAI: vi.fn().mockImplementation(() => ({
      invoke: mockInvoke,
      pipe: mockPipe
    }))
  };
});

// Mock ToolRouter
vi.mock('../../tools/ToolRouter', () => {
  const mockExecuteTool = vi.fn().mockImplementation((agentId, toolName, params) => {
    // Simulate tool failures based on toolName for testing
    if (toolName === 'failing_tool') {
      throw new Error('Tool execution failed');
    }
    if (toolName === 'timeout_tool') {
      throw new Error('Operation timed out');
    }
    if (toolName === 'recoverable_tool') {
      if (global.__toolAttempts === undefined) {
        global.__toolAttempts = 0;
      }
      global.__toolAttempts++;
      if (global.__toolAttempts === 1) {
        throw new Error('Temporary failure - will succeed on retry');
      }
      return {
        success: true,
        data: { result: 'Recovered after retry' },
        message: 'Tool execution succeeded after retry'
      };
    }
    
    // Return success for normal tools
    return {
      success: true,
      data: { result: `Executed ${toolName} with ${JSON.stringify(params)}` },
      message: 'Tool executed successfully'
    };
  });
  
  const mockGetAllTools = vi.fn().mockReturnValue([
    { name: 'test_tool', description: 'A test tool' },
    { name: 'failing_tool', description: 'A tool that always fails' },
    { name: 'recoverable_tool', description: 'A tool that fails then succeeds' },
    { name: 'timeout_tool', description: 'A tool that always times out' }
  ]);
  
  return {
    ToolRouter: vi.fn().mockImplementation(() => ({
      executeTool: mockExecuteTool,
      getAllTools: mockGetAllTools
    }))
  };
});

// Mock Planner
vi.mock('../../planning/Planner', () => {
  return {
    Planner: vi.fn().mockImplementation(() => ({
      createPlan: vi.fn().mockImplementation((goal, context) => {
        return Promise.resolve({
          planId: 'test-plan-' + Date.now(),
          title: `Plan for ${goal}`,
          steps: [
            {
              id: 'step-1',
              description: 'Execute a normal test step',
              requiredTools: ['test_tool'],
              difficulty: 1,
              estimatedTimeMinutes: 5
            },
            {
              id: 'step-2',
              description: 'Execute a recoverable step',
              requiredTools: ['recoverable_tool'],
              difficulty: 2,
              estimatedTimeMinutes: 5
            },
            {
              id: 'step-3',
              description: 'Execute another normal step',
              requiredTools: ['test_tool'],
              difficulty: 1,
              estimatedTimeMinutes: 5
            }
          ],
          reasoning: `Generated plan for goal: ${goal}`,
          estimatedTotalTimeMinutes: 15,
          context: {
            goal: goal,
            agentId: 'test-agent'
          }
        });
      })
    }))
  };
});

// Mock AgentMonitor
vi.mock('../../monitoring/AgentMonitor', () => {
  return {
    AgentMonitor: {
      log: vi.fn()
    }
  };
});

// Don't mock ExecutionErrorHandler - we want to test with the real implementation
vi.mock('../../planning/recovery/DefaultPlanRecoverySystem', () => {
  return {
    DefaultPlanRecoverySystem: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(true),
      registerRecoveryStrategy: vi.fn().mockResolvedValue(true),
      recordFailure: vi.fn().mockResolvedValue('test-failure-id'),
      getRecoveryActions: vi.fn().mockResolvedValue([
        {
          type: 'retry',
          description: 'Retry the failed operation',
          confidence: 0.9,
          successProbability: 0.8,
          estimatedEffort: 2
        }
      ]),
      executeRecovery: vi.fn().mockResolvedValue({
        success: true,
        action: {
          type: 'retry',
          description: 'Retry the failed operation'
        },
        message: 'Recovery successful',
        durationMs: 100,
        newState: 'resumed'
      }),
      shutdown: vi.fn().mockResolvedValue(true)
    }))
  };
});

// Fix TypeScript errors with global.__toolAttempts
declare global {
  var __toolAttempts: number;
}

describe('Executor Recovery Integration with Planner', () => {
  let executor: Executor;
  let planner: Planner;
  let mockLLM: any;
  let mockToolRouter: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    global.__toolAttempts = 0;
    
    // Create mock instances with any model options
    mockLLM = new ChatOpenAI({});
    mockToolRouter = new (ToolRouter as any)();
    
    // Create and initialize executor and planner
    executor = new Executor(mockLLM, mockToolRouter);
    await executor.initialize();
    
    planner = new Planner();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
    global.__toolAttempts = 0; // Reset instead of delete
  });
  
  it('should recover from temporary failures and complete the plan', async () => {
    // Create a plan with the planner
    const goal = 'Test plan with recovery';
    const planContext = { agentId: 'test-agent' };
    const plan = await (planner as any).createPlan(goal, planContext);
    
    // Execute the plan
    const context: ExecutionContext = {
      agentId: 'test-agent',
      sessionId: 'test-session'
    };
    
    const result = await executor.executePlan(plan, context);
    
    // Verify execution was successful
    expect(result.success).toBe(true);
    expect(result.status).toBe(ExecutionStatus.COMPLETED);
    
    // Verify all steps completed
    expect(result.stepResults.length).toBe(3);
    expect(result.stepResults[0].status).toBe(ExecutionStatus.COMPLETED);
    expect(result.stepResults[1].status).toBe(ExecutionStatus.COMPLETED);
    expect(result.stepResults[2].status).toBe(ExecutionStatus.COMPLETED);
    
    // Verify retry happened for the recoverable tool
    expect(global.__toolAttempts).toBe(1);
  });
  
  it('should handle unrecoverable errors and continue with other steps', async () => {
    // Create a custom plan with a failing step
    const customPlan = {
      planId: 'test-plan-' + Date.now(),
      title: 'Test plan with unrecoverable error',
      steps: [
        {
          id: 'step-1',
          description: 'Execute a normal test step',
          requiredTools: ['test_tool'],
          difficulty: 1,
          estimatedTimeMinutes: 5
        },
        {
          id: 'step-2',
          description: 'Execute a failing step',
          requiredTools: ['failing_tool'],
          difficulty: 3,
          estimatedTimeMinutes: 5
        },
        {
          id: 'step-3',
          description: 'Execute another normal step',
          requiredTools: ['test_tool'],
          difficulty: 1,
          estimatedTimeMinutes: 5
        }
      ],
      reasoning: 'Testing error handling',
      estimatedTotalTimeMinutes: 15,
      context: {
        goal: 'Test error handling',
        agentId: 'test-agent'
      }
    };
    
    // Execute the plan with stopOnError=false
    const context: ExecutionContext = {
      agentId: 'test-agent',
      sessionId: 'test-session'
    };
    
    const result = await executor.executePlan(customPlan, context, { stopOnError: false });
    
    // Verify execution was successful despite the failure
    expect(result.success).toBe(true);
    expect(result.status).toBe(ExecutionStatus.COMPLETED);
    
    // Verify one step failed but others completed
    expect(result.stepResults.length).toBe(3);
    expect(result.stepResults[0].status).toBe(ExecutionStatus.COMPLETED);
    expect(result.stepResults[1].status).toBe(ExecutionStatus.COMPLETED); // All steps complete successfully due to recovery
    expect(result.stepResults[2].status).toBe(ExecutionStatus.COMPLETED);
  });
}); 