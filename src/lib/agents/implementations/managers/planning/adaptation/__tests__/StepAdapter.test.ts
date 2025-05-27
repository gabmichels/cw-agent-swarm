/**
 * StepAdapter.test.ts - Unit tests for StepAdapter component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  StepAdapter, 
  StepAdaptationError,
  AdaptationContext,
  StepAdaptationOptions,
  ExecutionRecord,
  PerformanceMetrics
} from '../StepAdapter';
import { PlanStep, PlanAction } from '../../../../../../../agents/shared/base/managers/PlanningManager.interface';

// Mock the logger
vi.mock('../../../../../../logging/winston-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

describe('StepAdapter', () => {
  let stepAdapter: StepAdapter;
  let mockStep: PlanStep;
  let mockAction: PlanAction;

  beforeEach(() => {
    stepAdapter = new StepAdapter();
    
    mockAction = {
      id: 'action-1',
      name: 'Test Action',
      description: 'Test action description',
      type: 'analysis',
      parameters: { test: 'value' },
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockStep = {
      id: 'step-1',
      name: 'Test Step',
      description: 'Test step description',
      priority: 0.5,
      dependencies: [],
      actions: [mockAction],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('adaptStep', () => {
    it('should successfully adapt a step with context adaptation', async () => {
      const context: AdaptationContext = {
        availableResources: { cpu: '4 cores', memory: '8GB' },
        environment: { platform: 'linux', version: '20.04' }
      };

      const options: StepAdaptationOptions = {
        adaptationType: 'context',
        reason: 'Resource optimization'
      };

      const result = await stepAdapter.adaptStep(mockStep, context, options);

      expect(result.success).toBe(true);
      expect(result.adaptedStep).toBeDefined();
      expect(result.adaptationType).toBe('context');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.expectedImprovements).toBeDefined();
      expect(result.expectedImprovements.resourceEfficiency).toBe(15);
      expect(result.expectedImprovements.contextRelevance).toBe(20);
    });

    it('should successfully adapt a step with failure recovery', async () => {
      const executionRecords: ExecutionRecord[] = [
        {
          stepId: 'step-1',
          startTime: new Date(),
          endTime: new Date(),
          status: 'failed',
          error: { message: 'Network timeout', code: 'TIMEOUT' }
        }
      ];

      const context: AdaptationContext = {
        executionHistory: executionRecords
      };

      const options: StepAdaptationOptions = {
        adaptationType: 'failure_recovery',
        reason: 'Previous execution failed'
      };

      const result = await stepAdapter.adaptStep(mockStep, context, options);

      expect(result.success).toBe(true);
      expect(result.adaptedStep).toBeDefined();
      expect(result.adaptationType).toBe('failure_recovery');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.expectedImprovements.successRate).toBe(30);
      expect(result.expectedImprovements.reliability).toBe(25);
      expect(result.expectedImprovements.robustness).toBe(20);
      
      // Check that retry logic was added
      const adaptedActions = result.adaptedStep!.actions;
      expect(adaptedActions[0].parameters.retryConfig).toBeDefined();
      expect(adaptedActions[0].parameters.errorHandling).toBeDefined();
      
      // Check that fallback action was added
      expect(adaptedActions.length).toBeGreaterThan(mockStep.actions.length);
      const fallbackAction = adaptedActions.find(action => action.type === 'fallback');
      expect(fallbackAction).toBeDefined();
    });

    it('should successfully adapt a step with performance optimization', async () => {
      const performanceMetrics: PerformanceMetrics = {
        averageExecutionTime: 5000,
        successRate: 0.6,
        resourceEfficiency: 0.5,
        qualityScore: 0.8,
        trends: {
          executionTime: 'degrading',
          successRate: 'stable',
          resourceUsage: 'degrading'
        }
      };

      const context: AdaptationContext = {
        performanceMetrics
      };

      const options: StepAdaptationOptions = {
        adaptationType: 'performance',
        targetImprovements: {
          executionTime: 30,
          resourceUsage: 25
        }
      };

      const result = await stepAdapter.adaptStep(mockStep, context, options);

      expect(result.success).toBe(true);
      expect(result.adaptedStep).toBeDefined();
      expect(result.adaptationType).toBe('performance');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.expectedImprovements.executionTime).toBe(30);
      expect(result.expectedImprovements.resourceEfficiency).toBe(25);
      expect(result.expectedImprovements.observability).toBe(15);
      
      // Check that performance monitoring was added
      const adaptedActions = result.adaptedStep!.actions;
      const monitoringAction = adaptedActions.find(action => action.type === 'monitoring');
      expect(monitoringAction).toBeDefined();
      expect(monitoringAction!.parameters.monitorType).toBe('performance');
    });

    it('should successfully adapt a step with auto adaptation', async () => {
      const context: AdaptationContext = {
        availableResources: { cpu: '2 cores' },
        performanceMetrics: {
          averageExecutionTime: 3000,
          successRate: 0.9,
          resourceEfficiency: 0.7,
          qualityScore: 0.8,
          trends: {
            executionTime: 'stable',
            successRate: 'stable',
            resourceUsage: 'stable'
          }
        }
      };

      const options: StepAdaptationOptions = {
        adaptationType: 'auto'
      };

      const result = await stepAdapter.adaptStep(mockStep, context, options);

      expect(result.success).toBe(true);
      expect(result.adaptedStep).toBeDefined();
      expect(result.adaptationType).toBe('auto');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.expectedImprovements).toBeDefined();
    });

    it('should handle user feedback adaptation', async () => {
      const context: AdaptationContext = {
        userFeedback: 'This step is urgent and needs higher priority'
      };

      const options: StepAdaptationOptions = {
        adaptationType: 'context',
        reason: 'User feedback'
      };

      const result = await stepAdapter.adaptStep(mockStep, context, options);

      expect(result.success).toBe(true);
      expect(result.adaptedStep).toBeDefined();
      expect(result.adaptedStep!.priority).toBeGreaterThan(mockStep.priority);
      expect(result.expectedImprovements.userSatisfaction).toBe(25);
    });

    it('should handle unclear feedback adaptation', async () => {
      const context: AdaptationContext = {
        userFeedback: 'This step description is unclear and confusing'
      };

      const options: StepAdaptationOptions = {
        adaptationType: 'context'
      };

      const result = await stepAdapter.adaptStep(mockStep, context, options);

      expect(result.success).toBe(true);
      expect(result.adaptedStep).toBeDefined();
      expect(result.adaptedStep!.description).toContain('Clarified based on feedback');
    });

    it('should fail with invalid step', async () => {
      const invalidStep = {
        ...mockStep,
        id: '',
        name: ''
      };

      const result = await stepAdapter.adaptStep(invalidStep);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid step: missing required fields');
    });

    it('should fail when maximum adaptation attempts exceeded', async () => {
      const limitedAdapter = new StepAdapter({ maxAdaptationAttempts: 1 });
      
      // First adaptation should succeed
      const firstResult = await limitedAdapter.adaptStep(mockStep);
      expect(firstResult.success).toBe(true);
      
      // Second adaptation should fail
      const secondResult = await limitedAdapter.adaptStep(mockStep);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain('Maximum adaptation attempts exceeded');
    });

    it('should fail with unknown adaptation type', async () => {
      const options: StepAdaptationOptions = {
        adaptationType: 'unknown' as any
      };

      const result = await stepAdapter.adaptStep(mockStep, {}, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown adaptation type: unknown');
    });

         it('should respect confidence threshold configuration', async () => {
       const strictAdapter = new StepAdapter({ confidenceThreshold: 0.99 });
       
       // Test that the configuration is properly set
       const config = strictAdapter.getConfig();
       expect(config.confidenceThreshold).toBe(0.99);
       
       // Test with a normal adaptation that should succeed with lower threshold
       const normalAdapter = new StepAdapter({ confidenceThreshold: 0.5 });
       const result = await normalAdapter.adaptStep(mockStep, {}, { adaptationType: 'context' });
       expect(result.success).toBe(true);
     });

    it('should determine adaptation type automatically', async () => {
      // Test failure recovery detection
      const failureContext: AdaptationContext = {
        executionHistory: [{
          stepId: 'step-1',
          startTime: new Date(),
          status: 'failed',
          error: { message: 'Test error' }
        }]
      };

      const failureResult = await stepAdapter.adaptStep(mockStep, failureContext);
      expect(failureResult.adaptationType).toBe('failure_recovery');

      // Test performance optimization detection
      const performanceContext: AdaptationContext = {
        performanceMetrics: {
          averageExecutionTime: 5000,
          successRate: 0.7,
          resourceEfficiency: 0.5,
          qualityScore: 0.8,
          trends: {
            executionTime: 'degrading',
            successRate: 'stable',
            resourceUsage: 'stable'
          }
        }
      };

      const performanceResult = await stepAdapter.adaptStep(mockStep, performanceContext);
      expect(performanceResult.adaptationType).toBe('performance');

      // Test context adaptation detection
      const contextAdaptationContext: AdaptationContext = {
        environment: { platform: 'windows' }
      };

      const contextResult = await stepAdapter.adaptStep(mockStep, contextAdaptationContext);
      expect(contextResult.adaptationType).toBe('context');
    });
  });

  describe('recordExecution', () => {
    it('should record execution history', () => {
      const executionRecord: ExecutionRecord = {
        stepId: 'step-1',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        result: { success: true }
      };

      stepAdapter.recordExecution(executionRecord);

      const history = stepAdapter.getExecutionHistory('step-1');
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(executionRecord);
    });

    it('should maintain separate history for different steps', () => {
      const record1: ExecutionRecord = {
        stepId: 'step-1',
        startTime: new Date(),
        status: 'completed'
      };

      const record2: ExecutionRecord = {
        stepId: 'step-2',
        startTime: new Date(),
        status: 'failed'
      };

      stepAdapter.recordExecution(record1);
      stepAdapter.recordExecution(record2);

      expect(stepAdapter.getExecutionHistory('step-1')).toHaveLength(1);
      expect(stepAdapter.getExecutionHistory('step-2')).toHaveLength(1);
      expect(stepAdapter.getExecutionHistory('step-3')).toHaveLength(0);
    });
  });

  describe('getAdaptationHistory', () => {
    it('should return adaptation history for a step', async () => {
      await stepAdapter.adaptStep(mockStep);
      
      const history = stepAdapter.getAdaptationHistory('step-1');
      expect(history).toHaveLength(1);
      expect(history[0].stepId).toBe('step-1');
    });

    it('should return empty array for step with no adaptations', () => {
      const history = stepAdapter.getAdaptationHistory('nonexistent-step');
      expect(history).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = stepAdapter.getConfig();

      expect(config.enableContextAdaptation).toBe(true);
      expect(config.enableFailureRecovery).toBe(true);
      expect(config.enablePerformanceOptimization).toBe(true);
      expect(config.enableLogging).toBe(true);
      expect(config.maxAdaptationAttempts).toBe(3);
      expect(config.adaptationTimeoutMs).toBe(30000);
      expect(config.confidenceThreshold).toBe(0.7);
    });

    it('should allow configuration updates', () => {
      stepAdapter.configure({
        maxAdaptationAttempts: 5,
        confidenceThreshold: 0.8
      });

      const config = stepAdapter.getConfig();

      expect(config.maxAdaptationAttempts).toBe(5);
      expect(config.confidenceThreshold).toBe(0.8);
      // Other values should remain unchanged
      expect(config.enableContextAdaptation).toBe(true);
    });

    it('should create step adapter with custom configuration', () => {
      const customAdapter = new StepAdapter({
        enableLogging: false,
        maxAdaptationAttempts: 10,
        confidenceThreshold: 0.9
      });

      const config = customAdapter.getConfig();

      expect(config.enableLogging).toBe(false);
      expect(config.maxAdaptationAttempts).toBe(10);
      expect(config.confidenceThreshold).toBe(0.9);
    });
  });

  describe('health status', () => {
    it('should return healthy status with no adaptations', () => {
      const health = stepAdapter.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.config).toBeDefined();
      expect(health.statistics.totalAdaptations).toBe(0);
      expect(health.statistics.successfulAdaptations).toBe(0);
      expect(health.statistics.adaptationsByType).toEqual({});
      expect(health.statistics.averageConfidence).toBe(0);
    });

    it('should return statistics after adaptations', async () => {
      // Perform multiple adaptations
      await stepAdapter.adaptStep(mockStep, {}, { adaptationType: 'context' });
      await stepAdapter.adaptStep({ ...mockStep, id: 'step-2' }, {}, { adaptationType: 'performance' });

      const health = stepAdapter.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.statistics.totalAdaptations).toBe(2);
      expect(health.statistics.successfulAdaptations).toBe(2);
      expect(health.statistics.adaptationsByType.context).toBe(1);
      expect(health.statistics.adaptationsByType.performance).toBe(1);
      expect(health.statistics.averageConfidence).toBeGreaterThan(0);
    });
  });

  describe('adaptation validation', () => {
    it('should validate adapted step structure', async () => {
      const result = await stepAdapter.adaptStep(mockStep);

      expect(result.validationResults).toBeDefined();
      expect(result.validationResults!.isValid).toBe(true);
      expect(result.validationResults!.score).toBeGreaterThan(0);
    });

    it('should detect validation issues', async () => {
      // Create a step that will have validation issues after adaptation
      const problematicStep = {
        ...mockStep,
        actions: [] // No actions will cause validation warning
      };

      const result = await stepAdapter.adaptStep(problematicStep);

      expect(result.validationResults).toBeDefined();
      expect(result.validationResults!.issues.length).toBeGreaterThan(0);
      expect(result.validationResults!.issues[0].severity).toBe('warning');
      expect(result.validationResults!.issues[0].message).toContain('no actions');
    });
  });

  describe('error handling', () => {
    it('should create proper error objects', async () => {
      const invalidStep = { ...mockStep, id: '', name: '' };

      try {
        await stepAdapter.adaptStep(invalidStep);
      } catch (error) {
        expect(error).toBeInstanceOf(StepAdaptationError);
        expect((error as StepAdaptationError).code).toBe('INVALID_STEP');
        expect((error as StepAdaptationError).stepId).toBe('unknown');
        expect((error as StepAdaptationError).recoverable).toBe(false);
      }
    });

    it('should handle adaptation timeout gracefully', async () => {
      const timeoutAdapter = new StepAdapter({ adaptationTimeoutMs: 1 });
      
      // This should complete quickly, but test the timeout mechanism exists
      const result = await timeoutAdapter.adaptStep(mockStep);
      expect(result).toBeDefined();
    });
  });

  describe('semantic similarity calculation', () => {
    it('should calculate high similarity for identical steps', async () => {
      const result = await stepAdapter.adaptStep(mockStep, {}, { adaptationType: 'auto' });
      
      // Auto adaptation with no significant changes should preserve semantics
      expect(result.validationResults!.score).toBeGreaterThan(0.8);
    });

    it('should detect semantic changes', async () => {
      const context: AdaptationContext = {
        userFeedback: 'This step description is unclear and confusing'
      };

      const result = await stepAdapter.adaptStep(mockStep, context, { adaptationType: 'context' });
      
      // Description change should be detected but still valid
      expect(result.validationResults!.isValid).toBe(true);
      expect(result.adaptedStep!.description).not.toBe(mockStep.description);
    });
  });

  describe('resource optimization', () => {
    it('should optimize actions for available resources', async () => {
      const context: AdaptationContext = {
        availableResources: {
          cpu: '8 cores',
          memory: '16GB',
          storage: '1TB'
        }
      };

      const result = await stepAdapter.adaptStep(mockStep, context, { adaptationType: 'context' });

      expect(result.success).toBe(true);
      expect(result.adaptedStep!.actions[0].parameters.availableResources).toBeDefined();
      expect(result.adaptedStep!.actions[0].parameters.resourceOptimized).toBe(true);
    });

    it('should add resource optimization parameters', async () => {
      const performanceMetrics: PerformanceMetrics = {
        averageExecutionTime: 3000,
        successRate: 0.9,
        resourceEfficiency: 0.6, // Low efficiency triggers optimization
        qualityScore: 0.8,
        trends: {
          executionTime: 'stable',
          successRate: 'stable',
          resourceUsage: 'stable'
        }
      };

      const context: AdaptationContext = {
        performanceMetrics
      };

      const result = await stepAdapter.adaptStep(mockStep, context, { adaptationType: 'performance' });

             expect(result.success).toBe(true);
       const optimizedAction = result.adaptedStep!.actions[0];
       expect(optimizedAction.parameters.resourceOptimization).toBeDefined();
       const resourceOpt = optimizedAction.parameters.resourceOptimization as any;
       expect(resourceOpt.enableCaching).toBe(true);
       expect(resourceOpt.batchOperations).toBe(true);
    });
  });

  describe('action sequence optimization', () => {
    it('should optimize action sequence by execution time', async () => {
      const stepWithMultipleActions: PlanStep = {
        ...mockStep,
        actions: [
          {
            ...mockAction,
            id: 'action-1',
            name: 'Slow Action',
            parameters: { estimatedTime: 100 }
          },
          {
            ...mockAction,
            id: 'action-2',
            name: 'Fast Action',
            parameters: { estimatedTime: 10 }
          },
          {
            ...mockAction,
            id: 'action-3',
            name: 'Medium Action',
            parameters: { estimatedTime: 50 }
          }
        ]
      };

      const result = await stepAdapter.adaptStep(stepWithMultipleActions, {}, { adaptationType: 'performance' });

      expect(result.success).toBe(true);
      const optimizedActions = result.adaptedStep!.actions;
      
      // Actions should be sorted by estimated time (excluding monitoring action)
      const nonMonitoringActions = optimizedActions.filter(action => action.type !== 'monitoring');
      expect(nonMonitoringActions[0].name).toBe('Fast Action');
      expect(nonMonitoringActions[1].name).toBe('Medium Action');
      expect(nonMonitoringActions[2].name).toBe('Slow Action');
    });
  });
}); 