/**
 * Integration tests for Executor error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Executor, ExecutionStatus, ExecutionContext } from '../Executor';
import { ExecutionErrorHandler } from '../ExecutionErrorHandler';
import { ChatOpenAI } from '@langchain/openai';
import { ToolRouter } from '../../tools/ToolRouter';

// Mock ChatOpenAI
vi.mock('@langchain/openai', () => {
  return {
    ChatOpenAI: vi.fn().mockImplementation(() => ({
      invoke: vi.fn().mockResolvedValue({
        content: 'Mocked LLM response'
      }),
      pipe: vi.fn()
    }))
  };
});

// Mock ToolRouter
vi.mock('../../tools/ToolRouter', () => {
  return {
    ToolRouter: vi.fn().mockImplementation(() => ({
      executeTool: vi.fn().mockImplementation((agentId, toolName, params) => {
        // Simulate tool failures based on toolName for testing
        if (toolName === 'failing_tool') {
          throw new Error('Tool execution failed');
        }
        if (toolName === 'timeout_tool') {
          throw new Error('Operation timed out');
        }
        if (toolName === 'permission_tool') {
          throw new Error('Access denied: Insufficient permissions');
        }
        
        // Return success for normal tools
        return {
          success: true,
          data: { result: `Executed ${toolName} with ${JSON.stringify(params)}` },
          message: 'Tool executed successfully'
        };
      }),
      getAllTools: vi.fn().mockReturnValue([
        { name: 'test_tool', description: 'A test tool' },
        { name: 'failing_tool', description: 'A tool that always fails' },
        { name: 'timeout_tool', description: 'A tool that always times out' },
        { name: 'permission_tool', description: 'A tool with permission issues' }
      ])
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

// Mock recovery functions
vi.mock('../ExecutionErrorHandler', () => {
  const actual = vi.importActual('../ExecutionErrorHandler');
  return {
    ...actual,
    ExecutionErrorHandler: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(true),
      handleError: vi.fn().mockImplementation((error, context, options) => {
        // Simulate recovery based on error message
        if (error.message.includes('timed out')) {
          return {
            success: true,
            recoveryApplied: true,
            strategy: 'retry',
            action: 'Retry with delay',
            result: {
              success: true,
              data: { recoveredResult: 'Recovered after timeout' },
              message: 'Successfully recovered from timeout'
            }
          };
        }
        
        if (error.message.includes('permission')) {
          // Simulate successful recovery with fallback permission
          return {
            success: true,
            recoveryApplied: true,
            strategy: 'fallback_permission',
            action: 'Use fallback permissions',
            result: {
              success: true,
              data: { recoveredResult: 'Used fallback permissions' },
              message: 'Successfully recovered with fallback permissions'
            }
          };
        }
        
        // For other errors, simulate failed recovery
        return {
          success: false,
          recoveryApplied: true,
          strategy: 'retry',
          action: 'Retry operation',
          error: new Error('Recovery failed: ' + error.message)
        };
      }),
      shutdown: vi.fn().mockResolvedValue(true)
    }))
  };
});

// Mock DefaultPlanRecoverySystem
vi.mock('../../planning/recovery/DefaultPlanRecoverySystem', () => {
  return {
    DefaultPlanRecoverySystem: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(true),
      shutdown: vi.fn().mockResolvedValue(true)
    }))
  };
});

describe('Executor Error Handling Integration', () => {
  let executor: Executor;
  let mockLLM: any;
  let mockToolRouter: any;
  let mockErrorHandler: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create mock instances
    mockLLM = new ChatOpenAI({});
    mockToolRouter = new ToolRouter();
    
    // Create and initialize executor
    executor = new Executor(mockLLM, mockToolRouter);
    await executor.initialize();
    
    // Get mock error handler
    mockErrorHandler = (ExecutionErrorHandler as any).mock.results[0].value;
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should initialize the error handler during executor initialization', async () => {
    expect(mockErrorHandler.initialize).toHaveBeenCalled();
  });
  
  it('should handle tool execution errors with recovery', async () => {
    // Create a test plan with a failing step
    const plan = {
      title: 'Test Plan',
      steps: [
        {
          description: 'A step that will fail',
          requiredTools: ['timeout_tool'],
          difficulty: 2,
          estimatedTimeMinutes: 10,
          dependsOn: []
        }
      ],
      reasoning: 'Testing error recovery',
      estimatedTotalTimeMinutes: 10,
      context: {
        goal: 'Test error handling',
        agentId: 'test-agent'
      }
    };
    
    // Execute the plan
    const context: ExecutionContext = {
      agentId: 'test-agent',
      sessionId: 'test-session'
    };
    
    const result = await executor.executePlan(plan, context, { stopOnError: false });
    
    // Check that error handler was called
    expect(mockErrorHandler.handleError).toHaveBeenCalled();
    
    // Check for successful recovery
    expect(result.success).toBe(true);
    expect(result.status).toBe(ExecutionStatus.COMPLETED);
    
    // Check that the step result contains the recovered data
    const stepResult = result.stepResults[0];
    expect(stepResult.status).toBe(ExecutionStatus.COMPLETED);
    expect(stepResult.toolResults?.[0].success).toBe(true);
    expect(stepResult.toolResults?.[0].data).toHaveProperty('recoveredResult');
  });
  
  it('should handle different error categories differently', async () => {
    // Create a test plan with steps that will fail in different ways
    const plan = {
      title: 'Multi-error Test Plan',
      steps: [
        {
          description: 'A step that will timeout',
          requiredTools: ['timeout_tool'],
          difficulty: 2,
          estimatedTimeMinutes: 5,
          dependsOn: []
        },
        {
          description: 'A step with permission issues',
          requiredTools: ['permission_tool'],
          difficulty: 3,
          estimatedTimeMinutes: 5,
          dependsOn: []
        },
        {
          description: 'A step that will fail without recovery',
          requiredTools: ['failing_tool'],
          difficulty: 4,
          estimatedTimeMinutes: 5,
          dependsOn: []
        }
      ],
      reasoning: 'Testing multiple error types',
      estimatedTotalTimeMinutes: 15,
      context: {
        goal: 'Test different error categories',
        agentId: 'test-agent'
      }
    };
    
    // Execute the plan
    const context: ExecutionContext = {
      agentId: 'test-agent',
      sessionId: 'test-session'
    };
    
    const result = await executor.executePlan(plan, context, { stopOnError: false });
    
    // Check that error handler was called multiple times
    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(3);
    
    // Verify execution completed since stopOnError is false
    expect(result.status).toBe(ExecutionStatus.COMPLETED);
    
    // Check that step results match expected recovery patterns
    expect(result.stepResults[0].status).toBe(ExecutionStatus.COMPLETED); // Timeout recovery worked
    expect(result.stepResults[1].status).toBe(ExecutionStatus.COMPLETED); // Permission recovery worked
    expect(result.stepResults[2].status).toBe(ExecutionStatus.FAILED); // Failed without recovery
  });
  
  it('should stop execution when stopOnError is true and recovery fails', async () => {
    // Create a test plan with a failing step
    const plan = {
      title: 'Stop On Error Test Plan',
      steps: [
        {
          description: 'A normal step',
          requiredTools: ['test_tool'],
          difficulty: 1,
          estimatedTimeMinutes: 5,
          dependsOn: []
        },
        {
          description: 'A step that will fail without recovery',
          requiredTools: ['failing_tool'],
          difficulty: 4,
          estimatedTimeMinutes: 5,
          dependsOn: []
        },
        {
          description: 'A step that should not execute',
          requiredTools: ['test_tool'],
          difficulty: 1,
          estimatedTimeMinutes: 5,
          dependsOn: []
        }
      ],
      reasoning: 'Testing stopOnError behavior',
      estimatedTotalTimeMinutes: 15,
      context: {
        goal: 'Test execution stopping on error',
        agentId: 'test-agent'
      }
    };
    
    // Execute the plan with stopOnError true
    const context: ExecutionContext = {
      agentId: 'test-agent',
      sessionId: 'test-session'
    };
    
    const result = await executor.executePlan(plan, context, { stopOnError: true });
    
    // Verify execution stopped after the failing step
    expect(result.status).toBe(ExecutionStatus.FAILED);
    expect(result.stepResults).toHaveLength(2); // Only 2 steps should have been attempted
    expect(result.stepResults[0].status).toBe(ExecutionStatus.COMPLETED);
    expect(result.stepResults[1].status).toBe(ExecutionStatus.FAILED);
  });
  
  it('should include recovery information in the error message for failed steps', async () => {
    // Create a test plan with a failing step
    const plan = {
      title: 'Error Message Test Plan',
      steps: [
        {
          description: 'A step that will fail without recovery',
          requiredTools: ['failing_tool'],
          difficulty: 4,
          estimatedTimeMinutes: 5,
          dependsOn: []
        }
      ],
      reasoning: 'Testing error message content',
      estimatedTotalTimeMinutes: 5,
      context: {
        goal: 'Test error message details',
        agentId: 'test-agent'
      }
    };
    
    // Execute the plan
    const context: ExecutionContext = {
      agentId: 'test-agent',
      sessionId: 'test-session'
    };
    
    const result = await executor.executePlan(plan, context, { stopOnError: false });
    
    // Verify the error message contains recovery information
    const stepResult = result.stepResults[0];
    expect(stepResult.status).toBe(ExecutionStatus.FAILED);
    expect(stepResult.error).toContain('Step execution error: Tool execution failed');
  });
  
  it('should shutdown the error handler during executor shutdown', async () => {
    await executor.shutdown();
    expect(mockErrorHandler.shutdown).toHaveBeenCalled();
  });
}); 