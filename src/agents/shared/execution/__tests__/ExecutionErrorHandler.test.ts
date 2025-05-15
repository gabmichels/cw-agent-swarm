/**
 * Tests for ExecutionErrorHandler
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExecutionErrorHandler, ExecutionErrorCategory } from '../ExecutionErrorHandler';
import { DefaultPlanRecoverySystem } from '../../planning/recovery/DefaultPlanRecoverySystem';
import { 
  PlanFailureCategory, 
  PlanFailureSeverity, 
  PlanRecoveryActionType 
} from '../../planning/interfaces/PlanRecovery.interface';

// Mock the DefaultPlanRecoverySystem
vi.mock('../../planning/recovery/DefaultPlanRecoverySystem', () => {
  return {
    DefaultPlanRecoverySystem: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(true),
      registerRecoveryStrategy: vi.fn().mockResolvedValue(true),
      recordFailure: vi.fn().mockResolvedValue('test-failure-id'),
      getRecoveryActions: vi.fn().mockResolvedValue([
        {
          type: PlanRecoveryActionType.RETRY,
          description: 'Retry the failed operation',
          confidence: 0.9,
          successProbability: 0.8,
          estimatedEffort: 2
        }
      ]),
      executeRecovery: vi.fn().mockResolvedValue({
        success: true,
        action: {
          type: PlanRecoveryActionType.RETRY,
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

// Mock AgentMonitor
vi.mock('../../monitoring/AgentMonitor', () => {
  return {
    AgentMonitor: {
      log: vi.fn()
    }
  };
});

describe('ExecutionErrorHandler', () => {
  let errorHandler: ExecutionErrorHandler;
  let mockRecoverySystem: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRecoverySystem = new DefaultPlanRecoverySystem();
    errorHandler = new ExecutionErrorHandler(mockRecoverySystem);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize the recovery system and register strategies', async () => {
      await errorHandler.initialize();
      
      expect(mockRecoverySystem.initialize).toHaveBeenCalledWith({ registerDefaultStrategies: true });
      expect(mockRecoverySystem.registerRecoveryStrategy).toHaveBeenCalledTimes(3); // Should register 3 strategies
    });

    it('should not reinitialize if already initialized', async () => {
      await errorHandler.initialize();
      await errorHandler.initialize(); // Second call should be a no-op
      
      expect(mockRecoverySystem.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('categorizeError', () => {
    it('should categorize timeout errors correctly', () => {
      const error = new Error('Operation timed out');
      const category = errorHandler.categorizeError(error);
      
      expect(category).toBe(ExecutionErrorCategory.TIMEOUT_ERROR);
    });

    it('should categorize permission errors correctly', () => {
      const error = new Error('Access denied for this resource');
      const category = errorHandler.categorizeError(error);
      
      expect(category).toBe(ExecutionErrorCategory.PERMISSION_ERROR);
    });

    it('should categorize resource errors correctly', () => {
      const error = new Error('Resource not found or unavailable');
      const category = errorHandler.categorizeError(error);
      
      expect(category).toBe(ExecutionErrorCategory.RESOURCE_ERROR);
    });

    it('should categorize validation errors correctly', () => {
      const error = new Error('Invalid input: schema validation failed');
      const category = errorHandler.categorizeError(error);
      
      expect(category).toBe(ExecutionErrorCategory.VALIDATION_ERROR);
    });

    it('should categorize LLM errors correctly', () => {
      const error = new Error('OpenAI API call failed: token limit exceeded');
      const category = errorHandler.categorizeError(error);
      
      expect(category).toBe(ExecutionErrorCategory.LLM_ERROR);
    });

    it('should categorize tool errors correctly', () => {
      const error = new Error('Tool execution failed');
      const category = errorHandler.categorizeError(error);
      
      expect(category).toBe(ExecutionErrorCategory.TOOL_ERROR);
    });

    it('should categorize dependency errors correctly', () => {
      const error = new Error('Required dependency step failed');
      const category = errorHandler.categorizeError(error);
      
      expect(category).toBe(ExecutionErrorCategory.DEPENDENCY_ERROR);
    });

    it('should categorize unknown errors correctly', () => {
      const error = new Error('Some unknown error');
      const category = errorHandler.categorizeError(error);
      
      expect(category).toBe(ExecutionErrorCategory.UNKNOWN_ERROR);
    });
  });

  describe('handleError', () => {
    it('should handle and recover from errors successfully', async () => {
      await errorHandler.initialize();
      
      const error = new Error('Tool execution failed');
      const context = {
        taskId: 'test-task-id',
        stepId: 'test-step-id',
        agentId: 'test-agent-id'
      };
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.success).toBe(true);
      expect(result.recoveryApplied).toBe(true);
      expect(result.strategy).toBe(PlanRecoveryActionType.RETRY);
      expect(mockRecoverySystem.recordFailure).toHaveBeenCalled();
      expect(mockRecoverySystem.getRecoveryActions).toHaveBeenCalled();
      expect(mockRecoverySystem.executeRecovery).toHaveBeenCalled();
    });

    it('should handle case with no recovery actions', async () => {
      await errorHandler.initialize();
      
      // Override mock to return empty recovery actions
      mockRecoverySystem.getRecoveryActions.mockResolvedValueOnce([]);
      
      const error = new Error('Unrecoverable error');
      const context = {
        taskId: 'test-task-id',
        stepId: 'test-step-id',
        agentId: 'test-agent-id'
      };
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.success).toBe(false);
      expect(result.recoveryApplied).toBe(false);
      expect(result.error).toBe(error);
    });

    it('should handle recovery failures', async () => {
      await errorHandler.initialize();
      
      // Override mock to return failed recovery
      mockRecoverySystem.executeRecovery.mockResolvedValueOnce({
        success: false,
        action: {
          type: PlanRecoveryActionType.RETRY,
          description: 'Retry the failed operation'
        },
        message: 'Recovery failed',
        durationMs: 50,
        error: 'Could not retry the operation'
      });
      
      const error = new Error('Tool execution failed');
      const context = {
        taskId: 'test-task-id',
        stepId: 'test-step-id',
        agentId: 'test-agent-id'
      };
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.success).toBe(false);
      expect(result.recoveryApplied).toBe(true);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Could not retry the operation');
    });

    it('should use fallback action when recovery fails entirely', async () => {
      await errorHandler.initialize();
      
      // Override mock to throw an error during recovery
      mockRecoverySystem.executeRecovery.mockRejectedValueOnce(new Error('Recovery system failed'));
      
      const fallbackAction = vi.fn().mockResolvedValue({ status: 'fallback successful' });
      const error = new Error('Tool execution failed');
      const context = {
        taskId: 'test-task-id',
        stepId: 'test-step-id',
        agentId: 'test-agent-id'
      };
      
      const result = await errorHandler.handleError(error, context, { fallbackAction });
      
      expect(result.success).toBe(true);
      expect(result.recoveryApplied).toBe(true);
      expect(result.strategy).toBe('fallback');
      expect(fallbackAction).toHaveBeenCalled();
    });
  });

  describe('recovery history', () => {
    it('should track recovery history correctly', async () => {
      await errorHandler.initialize();
      
      const error = new Error('Tool execution failed');
      const context = {
        taskId: 'test-task-id',
        stepId: 'test-step-id',
        agentId: 'test-agent-id'
      };
      
      await errorHandler.handleError(error, context);
      
      const history = errorHandler.getRecoveryHistory('test-task-id');
      expect(history.length).toBe(1);
      expect(history[0].taskId).toBe('test-task-id');
      expect(history[0].stepId).toBe('test-step-id');
      expect(history[0].errorCategory).toBe(ExecutionErrorCategory.TOOL_ERROR);
    });

    it('should clear history when requested', async () => {
      await errorHandler.initialize();
      
      const error = new Error('Tool execution failed');
      const context = {
        taskId: 'test-task-id',
        stepId: 'test-step-id',
        agentId: 'test-agent-id'
      };
      
      await errorHandler.handleError(error, context);
      errorHandler.clearErrorHistory();
      
      const history = errorHandler.getRecoveryHistory('test-task-id');
      expect(history.length).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should shutdown properly', async () => {
      await errorHandler.initialize();
      await errorHandler.shutdown();
      
      expect(mockRecoverySystem.shutdown).toHaveBeenCalled();
    });
  });
}); 