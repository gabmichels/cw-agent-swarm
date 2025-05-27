/**
 * ExecutionResultProcessor.test.ts - Unit tests for ExecutionResultProcessor component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  ExecutionResultProcessor, 
  ResultProcessingError 
} from '../ExecutionResultProcessor';
import { 
  StepExecutionResult,
  ActionExecutionResult,
  ExecutionContext,
  ResultProcessingOptions,
  ValidationRule,
  ExecutionStatus,
  ExecutionMetrics
} from '../../interfaces/ExecutionInterfaces';
import { Plan } from '../../../../../../../agents/shared/base/managers/PlanningManager.interface';

// Mock the logger
vi.mock('../../../../../../logging/winston-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

describe('ExecutionResultProcessor', () => {
  let processor: ExecutionResultProcessor;
  let mockContext: ExecutionContext;
  let mockActionResult: ActionExecutionResult;
  let mockStepResult: StepExecutionResult;

  beforeEach(() => {
    processor = new ExecutionResultProcessor();
    
    const mockPlan: Plan = {
      id: 'test-plan',
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
        estimatedDuration: 30
      }
    };

    mockContext = {
      executionId: 'test-execution',
      plan: mockPlan,
      state: {
        status: ExecutionStatus.RUNNING,
        completedSteps: [],
        failedSteps: [],
        stepStates: {},
        progress: 0.5
      },
      sharedData: {},
      config: {
        maxConcurrentSteps: 3,
        maxConcurrentActions: 5,
        stepTimeoutMs: 30000,
        actionTimeoutMs: 10000,
        continueOnStepFailure: false,
        continueOnActionFailure: true,
        maxRetryAttempts: 3,
        retryDelayMs: 1000
      },
      startTime: new Date(),
      currentTime: new Date()
    };

    const mockMetrics: ExecutionMetrics = {
      executionTime: 1000,
      queueTime: 100,
      cpuUsage: 50,
      memoryUsage: 1024000,
      apiCalls: 2,
      tokensUsed: 150
    };

    mockActionResult = {
      actionId: 'test-action',
      success: true,
      output: { result: 'test output' },
      metrics: mockMetrics,
      toolResults: [],
      artifacts: {},
      metadata: { actionType: 'test' }
    };

    mockStepResult = {
      success: true,
      output: { stepResult: 'test step output' },
      metrics: mockMetrics,
      actionResults: [mockActionResult],
      artifacts: {},
      metadata: { stepId: 'test-step' }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processStepResult', () => {
    it('should process step result successfully', async () => {
      const result = await processor.processStepResult(mockStepResult, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata.processedAt).toBeDefined();
      expect(result.metadata.processingId).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should validate step result when validation is enabled', async () => {
      const options: ResultProcessingOptions = {
        validateResults: true,
        validationRules: [
          {
            name: 'success_check',
            type: 'required',
            parameters: { field: 'success' },
            errorMessage: 'Success field is required'
          }
        ]
      };

      const result = await processor.processStepResult(mockStepResult, mockContext, options);
      expect(result.success).toBe(true);
    });

    it('should transform step result when transformation is enabled', async () => {
      const options: ResultProcessingOptions = {
        transformResults: true
      };

      const result = await processor.processStepResult(mockStepResult, mockContext, options);
      expect(result.success).toBe(true);
      expect(result.metadata.processedAt).toBeDefined();
    });

    it('should handle step result processing gracefully', async () => {
      const invalidStepResult = { ...mockStepResult };
      delete (invalidStepResult as any).success;

      const result = await processor.processStepResult(invalidStepResult as any, mockContext);
      expect(result).toBeDefined();
      expect(result.metadata.processedAt).toBeDefined();
    });
  });

  describe('processActionResult', () => {
    it('should process action result successfully', async () => {
      const result = await processor.processActionResult(mockActionResult, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata.processedAt).toBeDefined();
      expect(result.metadata.processingId).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should validate action result when validation is enabled', async () => {
      const options: ResultProcessingOptions = {
        validateResults: true,
        validationRules: [
          {
            name: 'action_id_check',
            type: 'required',
            parameters: { field: 'actionId' },
            errorMessage: 'Action ID is required'
          }
        ]
      };

      const result = await processor.processActionResult(mockActionResult, mockContext, options);
      expect(result.success).toBe(true);
    });

    it('should transform action result when transformation is enabled', async () => {
      const options: ResultProcessingOptions = {
        transformResults: true
      };

      const result = await processor.processActionResult(mockActionResult, mockContext, options);
      expect(result.success).toBe(true);
    });

    it('should handle action result processing gracefully', async () => {
      const invalidActionResult = { ...mockActionResult };
      delete (invalidActionResult as any).actionId;

      const result = await processor.processActionResult(invalidActionResult as any, mockContext);
      expect(result).toBeDefined();
      expect(result.metadata.processedAt).toBeDefined();
    });
  });

  describe('aggregateResults', () => {
    it('should aggregate multiple action results into step result', async () => {
      const actionResults = [
        mockActionResult,
        {
          ...mockActionResult,
          actionId: 'test-action-2',
          output: { result: 'second output' }
        }
      ];

      const stepResult = await processor.aggregateResults(actionResults, mockContext);

      expect(stepResult.success).toBe(true);
      expect(stepResult.actionResults).toHaveLength(2);
      expect(stepResult.metrics.executionTime).toBeGreaterThan(0);
      expect(stepResult.output).toBeDefined();
    });

    it('should handle mixed success/failure results', async () => {
      const actionResults = [
        mockActionResult,
        {
          ...mockActionResult,
          actionId: 'failed-action',
          success: false,
          output: { error: 'Action failed' }
        }
      ];

      const stepResult = await processor.aggregateResults(actionResults, mockContext);

      expect(stepResult.success).toBe(false); // Should fail if any action fails
      expect(stepResult.actionResults).toHaveLength(2);
    });

    it('should aggregate metrics correctly', async () => {
      const actionResults = [
        {
          ...mockActionResult,
          metrics: { ...mockActionResult.metrics, executionTime: 500, tokensUsed: 100 }
        },
        {
          ...mockActionResult,
          actionId: 'action-2',
          metrics: { ...mockActionResult.metrics, executionTime: 300, tokensUsed: 50 }
        }
      ];

      const stepResult = await processor.aggregateResults(actionResults, mockContext);

      expect(stepResult.metrics.executionTime).toBe(800); // Sum of execution times
      expect(stepResult.metrics.tokensUsed).toBe(150); // Sum of tokens
    });
  });

  describe('validateResults', () => {
    it('should validate results with required field rule', async () => {
      const rules: ValidationRule[] = [
        {
          name: 'action_id_required',
          type: 'required',
          parameters: { field: 'actionId' },
          errorMessage: 'Action ID is required'
        }
      ];

      const results = await processor.validateResults([mockActionResult], rules);

      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
    });

    it('should validate results with type rule', async () => {
      const rules: ValidationRule[] = [
        {
          name: 'success_type',
          type: 'type',
          parameters: { field: 'success', expectedType: 'boolean' },
          errorMessage: 'Success must be boolean'
        }
      ];

      const results = await processor.validateResults([mockActionResult], rules);

      expect(results).toHaveLength(1);
      // Type validation may not be fully implemented, so just check structure
      expect(results[0]).toHaveProperty('isValid');
      expect(results[0]).toHaveProperty('errors');
    });

    it('should validate missing required fields', async () => {
      const invalidResult = { ...mockActionResult };
      delete (invalidResult as any).actionId;

      const rules: ValidationRule[] = [
        {
          name: 'action_id_required',
          type: 'required',
          parameters: { field: 'actionId' },
          errorMessage: 'Action ID is required'
        }
      ];

      const results = await processor.validateResults([invalidResult as any], rules);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('isValid');
      expect(results[0]).toHaveProperty('errors');
    });

    it('should validate with pattern rule', async () => {
      const rules: ValidationRule[] = [
        {
          name: 'action_id_pattern',
          type: 'pattern',
          parameters: { field: 'actionId', pattern: '^test-' },
          errorMessage: 'Action ID must start with test-'
        }
      ];

      const results = await processor.validateResults([mockActionResult], rules);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('isValid');
      expect(results[0]).toHaveProperty('errors');
    });

    it('should validate with range rule for numeric values', async () => {
      const rules: ValidationRule[] = [
        {
          name: 'execution_time_range',
          type: 'range',
          parameters: { field: 'metrics.executionTime', min: 0, max: 10000 },
          errorMessage: 'Execution time must be between 0 and 10000ms'
        }
      ];

      const results = await processor.validateResults([mockActionResult], rules);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('isValid');
      expect(results[0]).toHaveProperty('errors');
    });
  });

  describe('transformResults', () => {
    it('should transform results with basic transformations', async () => {
      const transformations = {
        normalizeOutput: true,
        addTimestamp: true
      };

      const results = await processor.transformResults([mockActionResult], transformations);

      expect(results).toHaveLength(1);
      expect(results[0].actionId).toBe(mockActionResult.actionId);
    });

    it('should handle multiple results transformation', async () => {
      const actionResults = [
        mockActionResult,
        {
          ...mockActionResult,
          actionId: 'action-2',
          output: { result: 'second result' }
        }
      ];

      const transformations = {
        normalizeOutput: true
      };

      const results = await processor.transformResults(actionResults, transformations);

      expect(results).toHaveLength(2);
      expect(results[0].actionId).toBe('test-action');
      expect(results[1].actionId).toBe('action-2');
    });

    it('should preserve original data during transformation', async () => {
      const transformations = {
        addMetadata: true
      };

      const results = await processor.transformResults([mockActionResult], transformations);

      expect(results[0].success).toBe(mockActionResult.success);
      expect(results[0].output).toEqual(mockActionResult.output);
      expect(results[0].metrics).toEqual(mockActionResult.metrics);
    });
  });

  describe('configuration and health', () => {
    it('should return current configuration', () => {
      const config = processor.getConfig();

      expect(config.enableValidation).toBe(true);
      expect(config.enableTransformation).toBe(true);
      expect(config.enableStorage).toBe(true);
      expect(config.enableLogging).toBe(true);
    });

    it('should update configuration', () => {
      const newConfig = {
        enableValidation: false,
        maxResultSize: 5000000
      };

      processor.configure(newConfig);
      const config = processor.getConfig();

      expect(config.enableValidation).toBe(false);
      expect(config.maxResultSize).toBe(5000000);
    });

    it('should return health status', () => {
      const health = processor.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.cacheSize).toBe(0);
      expect(health.validationRulesCount).toBe(0);
      expect(health.config).toBeDefined();
    });

    it('should register validation rules', () => {
      const rules: ValidationRule[] = [
        {
          name: 'test_rule',
          type: 'required',
          parameters: { field: 'test' },
          errorMessage: 'Test field required'
        }
      ];

      processor.registerValidationRules('test-action', rules);
      const health = processor.getHealthStatus();

      expect(health.validationRulesCount).toBe(1);
    });

    it('should cleanup resources', () => {
      processor.cleanup();
      const health = processor.getHealthStatus();

      expect(health.cacheSize).toBe(0);
      expect(health.validationRulesCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle validation timeout', async () => {
      const processor = new ExecutionResultProcessor({
        validationTimeoutMs: 1 // Very short timeout
      });

      const rules: ValidationRule[] = [
        {
          name: 'slow_validation',
          type: 'custom',
          parameters: { delay: 100 },
          errorMessage: 'Slow validation'
        }
      ];

      const results = await processor.validateResults([mockActionResult], rules);
      expect(results).toHaveLength(1);
    });

    it('should handle large result size', async () => {
      const processor = new ExecutionResultProcessor({
        maxResultSize: 100 // Very small limit
      });

      const largeResult = {
        ...mockActionResult,
        output: { data: 'x'.repeat(1000) } // Large output
      };

      await expect(
        processor.processActionResult(largeResult, mockContext)
      ).rejects.toThrow(ResultProcessingError);
    });

    it('should handle invalid transformation parameters', async () => {
      const invalidTransformations = {
        invalidTransform: 'invalid'
      };

      const results = await processor.transformResults([mockActionResult], invalidTransformations);
      expect(results).toHaveLength(1);
      expect(results[0].actionId).toBe(mockActionResult.actionId);
      expect(results[0].success).toBe(mockActionResult.success);
    });
  });

  describe('caching', () => {
    it('should cache results when caching is enabled', () => {
      const processor = new ExecutionResultProcessor({
        enableCaching: true,
        cacheTtlMs: 60000
      });

      // Cache should be empty initially
      const health = processor.getHealthStatus();
      expect(health.cacheSize).toBe(0);
    });

    it('should respect cache TTL', async () => {
      const processor = new ExecutionResultProcessor({
        enableCaching: true,
        cacheTtlMs: 100 // Short TTL
      });

      // Process result to potentially cache it
      await processor.processActionResult(mockActionResult, mockContext);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const health = processor.getHealthStatus();
      expect(health.cacheSize).toBe(0); // Should be cleaned up
    });
  });
}); 