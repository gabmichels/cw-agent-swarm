/**
 * ActionExecutor.test.ts - Unit tests for ActionExecutor component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ActionExecutor } from '../ActionExecutor';
import { 
  ExecutionContext,
  ExecutionStatus,
  ActionExecutionOptions 
} from '../../interfaces/ExecutionInterfaces';
import { PlanAction } from '../../../../../../../agents/shared/base/managers/PlanningManager.interface';

// Mock the logger
vi.mock('@/lib/logging/winston-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

describe('ActionExecutor', () => {
  let actionExecutor: ActionExecutor;
  let mockContext: ExecutionContext;
  let mockAction: PlanAction;

  beforeEach(() => {
    actionExecutor = new ActionExecutor();
    
    // Create mock execution context
    mockContext = {
      executionId: 'exec-123',
      plan: {
        id: 'plan-123',
        name: 'Test Plan',
        description: 'Test plan description',
        goals: ['Test goal'],
        steps: [],
        status: 'pending',
        priority: 5,
        confidence: 0.8,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          version: '1.0.0',
          tags: ['test'],
          estimatedDuration: 3600
        }
      },
      state: {
        status: ExecutionStatus.RUNNING,
        completedSteps: [],
        failedSteps: [],
        stepStates: {},
        progress: 0
      },
      sharedData: {},
      config: {
        maxConcurrentSteps: 3,
        maxConcurrentActions: 5,
        stepTimeoutMs: 300000,
        actionTimeoutMs: 60000,
        continueOnStepFailure: false,
        continueOnActionFailure: true,
        maxRetryAttempts: 3,
        retryDelayMs: 2000
      },
      startTime: new Date(),
      currentTime: new Date()
    } as ExecutionContext;

    // Create mock action
    mockAction = {
      id: 'action-123',
      type: 'generic',
      description: 'Test action description',
      parameters: {},
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    } as PlanAction;
  });

  afterEach(() => {
    actionExecutor.cancelAllExecutions();
  });

  describe('executeAction', () => {
    it('should execute a generic action successfully', async () => {
      const result = await actionExecutor.executeAction(mockAction, mockContext);

      expect(result.success).toBe(true);
      expect(result.actionId).toBe(mockAction.id);
      expect(result.output).toContain('Executed generic action');
      expect(result.metrics.executionTime).toBeGreaterThan(0);
      expect(result.metadata.actionType).toBe('generic');
      expect(result.metadata.executedAt).toBeDefined();
    });

    it('should execute tool action with mock tool manager', async () => {
      // Mock tool manager
      const mockToolManager = {
        executeTool: vi.fn().mockResolvedValue({
          success: true,
          data: { result: 'Tool execution result' },
          error: null
        })
      };

      // Add mock agent with tool manager to context
      (mockContext as any).agent = {
        getManager: vi.fn().mockReturnValue(mockToolManager)
      };

      const toolAction = {
        ...mockAction,
        type: 'tool_execution',
        parameters: {
          toolName: 'test-tool',
          toolParams: { param1: 'value1' }
        }
      };

      const result = await actionExecutor.executeAction(toolAction, mockContext);

      expect(result.success).toBe(true);
      expect(result.actionId).toBe(toolAction.id);
      expect(result.output).toEqual({ result: 'Tool execution result' });
      expect(result.toolResults).toHaveLength(1);
      expect(result.toolResults![0].toolName).toBe('test-tool');
      expect(result.toolResults![0].success).toBe(true);
      expect(result.metadata.toolName).toBe('test-tool');
      expect(mockToolManager.executeTool).toHaveBeenCalledWith('test-tool', { param1: 'value1' });
    });

    it('should handle missing tool manager', async () => {
      (mockContext as any).agent = {
        getManager: vi.fn().mockReturnValue(null)
      };

      const toolAction = {
        ...mockAction,
        type: 'tool_execution',
        parameters: {
          toolName: 'test-tool'
        }
      };

      const result = await actionExecutor.executeAction(toolAction, mockContext);

      expect(result.success).toBe(false);
      expect(result.metadata.error).toContain('Tool manager not available');
    });

    it('should handle missing tool name', async () => {
      const mockToolManager = {
        executeTool: vi.fn()
      };

      (mockContext as any).agent = {
        getManager: vi.fn().mockReturnValue(mockToolManager)
      };

      const toolAction = {
        ...mockAction,
        type: 'tool_execution',
        parameters: {} // Missing toolName
      };

      const result = await actionExecutor.executeAction(toolAction, mockContext);

      expect(result.success).toBe(false);
      expect(result.metadata.error).toContain('Tool name not specified');
    });
  });

  describe('executeActionsConcurrently', () => {
    it('should execute multiple actions concurrently', async () => {
      const actions = [
        { ...mockAction, id: 'action-1', description: 'Action 1' },
        { ...mockAction, id: 'action-2', description: 'Action 2' },
        { ...mockAction, id: 'action-3', description: 'Action 3' }
      ];

      const results = await actionExecutor.executeActionsConcurrently(actions, mockContext);

      expect(results).toHaveLength(3);
      expect(results[0].actionId).toBe('action-1');
      expect(results[1].actionId).toBe('action-2');
      expect(results[2].actionId).toBe('action-3');
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('executeActionsSequentially', () => {
    it('should execute actions in sequence', async () => {
      const actions = [
        { ...mockAction, id: 'action-1', description: 'Action 1' },
        { ...mockAction, id: 'action-2', description: 'Action 2' },
        { ...mockAction, id: 'action-3', description: 'Action 3' }
      ];

      const results = await actionExecutor.executeActionsSequentially(actions, mockContext);

      expect(results).toHaveLength(3);
      expect(results[0].actionId).toBe('action-1');
      expect(results[1].actionId).toBe('action-2');
      expect(results[2].actionId).toBe('action-3');
      expect(results.every(r => r.success)).toBe(true);

      // Check that results are stored in shared data
      expect(mockContext.sharedData['action_action-1_result']).toBeDefined();
      expect(mockContext.sharedData['action_action-2_result']).toBeDefined();
      expect(mockContext.sharedData['action_action-3_result']).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = actionExecutor.getConfig();

      expect(config.defaultTimeoutMs).toBe(30000);
      expect(config.defaultMaxRetries).toBe(3);
      expect(config.defaultRetryDelayMs).toBe(1000);
      expect(config.defaultUseFallbacks).toBe(true);
      expect(config.maxConcurrentTools).toBe(5);
      expect(config.enableMetrics).toBe(true);
      expect(config.enableLogging).toBe(true);
    });

    it('should allow configuration updates', () => {
      actionExecutor.configure({
        defaultTimeoutMs: 60000,
        defaultMaxRetries: 5,
        enableLogging: false
      });

      const config = actionExecutor.getConfig();

      expect(config.defaultTimeoutMs).toBe(60000);
      expect(config.defaultMaxRetries).toBe(5);
      expect(config.enableLogging).toBe(false);
      // Other values should remain unchanged
      expect(config.defaultRetryDelayMs).toBe(1000);
    });

    it('should create executor with custom configuration', () => {
      const customExecutor = new ActionExecutor({
        defaultTimeoutMs: 45000,
        maxConcurrentTools: 10,
        enableMetrics: false
      });

      const config = customExecutor.getConfig();

      expect(config.defaultTimeoutMs).toBe(45000);
      expect(config.maxConcurrentTools).toBe(10);
      expect(config.enableMetrics).toBe(false);
    });
  });

  describe('health status', () => {
    it('should return healthy status', () => {
      const health = actionExecutor.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.activeExecutions).toBe(0);
      expect(health.config).toBeDefined();
    });
  });

  describe('cancellation', () => {
    it('should cancel all active executions', () => {
      // Test that cancellation doesn't throw errors
      expect(() => actionExecutor.cancelAllExecutions()).not.toThrow();
      
      const health = actionExecutor.getHealthStatus();
      expect(health.activeExecutions).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should create proper error results', async () => {
      const mockAgent = {
        getLLMResponse: vi.fn().mockRejectedValue(new Error('Test error'))
      };

      (mockContext as any).agent = mockAgent;

      const llmAction = {
        ...mockAction,
        type: 'llm_query'
      };

      const result = await actionExecutor.executeAction(llmAction, mockContext);

      expect(result.success).toBe(false);
      expect(result.output).toBeUndefined();
      expect(result.metadata.error).toContain('Test error');
      expect(result.metadata.errorType).toBe('ActionExecutionError');
      expect(result.metadata.executedAt).toBeDefined();
      expect(result.metrics.executionTime).toBeGreaterThan(0);
    });

    it('should handle non-Error exceptions', async () => {
      const mockAgent = {
        getLLMResponse: vi.fn().mockRejectedValue('String error')
      };

      (mockContext as any).agent = mockAgent;

      const llmAction = {
        ...mockAction,
        type: 'llm_query'
      };

      const result = await actionExecutor.executeAction(llmAction, mockContext);

      expect(result.success).toBe(false);
      expect(result.metadata.error).toContain('String error');
      expect(result.metadata.errorType).toBe('ActionExecutionError');
    });
  });
}); 