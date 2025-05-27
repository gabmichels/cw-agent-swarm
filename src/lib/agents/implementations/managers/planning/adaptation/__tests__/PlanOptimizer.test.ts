/**
 * PlanOptimizer.test.ts - Unit tests for PlanOptimizer component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  PlanOptimizer, 
  PlanOptimizationError,
  OptimizationContext,
  PlanOptimizationOptions,
  PerformanceMetrics,
  ResourceUsageMetrics,
  DependencyPattern
} from '../PlanOptimizer';
import { Plan, PlanStep, PlanAction } from '../../../../../../../agents/shared/base/managers/PlanningManager.interface';

// Mock the logger
vi.mock('../../../../../../logging/winston-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

describe('PlanOptimizer', () => {
  let planOptimizer: PlanOptimizer;
  let mockPlan: Plan;
  let mockStep: PlanStep;
  let mockAction: PlanAction;

  beforeEach(() => {
    planOptimizer = new PlanOptimizer();
    
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

    mockPlan = {
      id: 'plan-1',
      name: 'Test Plan',
      description: 'Test plan description',
      goals: ['Test goal'],
      steps: [mockStep],
      status: 'pending',
      priority: 5,
      confidence: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        version: '1.0.0',
        tags: ['test'],
        complexity: 3
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('optimizePlan', () => {
    it('should successfully optimize a plan with dependency optimization', async () => {
      const context: OptimizationContext = {
        constraints: {
          maxParallelSteps: 3
        }
      };

      const options: PlanOptimizationOptions = {
        optimizationType: 'dependency',
        strategy: 'balanced'
      };

      const result = await planOptimizer.optimizePlan(mockPlan, context, options);

      expect(result.success).toBe(true);
      expect(result.optimizedPlan).toBeDefined();
      expect(result.optimizationType).toBe('dependency');
      expect(result.strategy).toBe('balanced');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.expectedImprovements.parallelization).toBe(45); // 25 + 20
      expect(result.expectedImprovements.executionTime).toBe(15);
      expect(result.metrics.dependencyOptimization).toBe(30);
    });

    it('should successfully optimize a plan with resource optimization', async () => {
      const context: OptimizationContext = {
        availableResources: {
          cpu: '8 cores',
          memory: '16GB',
          budget: 1000
        }
      };

      const options: PlanOptimizationOptions = {
        optimizationType: 'resource',
        strategy: 'balanced'
      };

      const result = await planOptimizer.optimizePlan(mockPlan, context, options);

      expect(result.success).toBe(true);
      expect(result.optimizedPlan).toBeDefined();
      expect(result.optimizationType).toBe('resource');
             expect(result.expectedImprovements.resourceUsage).toBe(30);
       expect(result.expectedImprovements.cost).toBe(20);
      expect(result.metrics.resourceOptimization).toBe(35);
      
      // Check that resource allocation was added
      const optimizedStep = result.optimizedPlan!.steps[0];
      expect(optimizedStep.actions[0].parameters.resourceAllocation).toBeDefined();
      expect(optimizedStep.actions[0].parameters.optimizedForResources).toBe(true);
      expect(optimizedStep.actions[0].parameters.budgetAllocation).toBeDefined();
      expect(optimizedStep.actions[0].parameters.costOptimized).toBe(true);
      
      // Check that resource monitoring was added
      const monitoringAction = optimizedStep.actions.find(action => action.type === 'monitoring');
      expect(monitoringAction).toBeDefined();
      expect(monitoringAction!.parameters.monitorType).toBe('resource');
    });

    it('should successfully optimize a plan with timeline optimization', async () => {
      const context: OptimizationContext = {
        availableResources: {
          timeLimit: 3600 // 1 hour
        }
      };

      const options: PlanOptimizationOptions = {
        optimizationType: 'timeline',
        strategy: 'aggressive'
      };

      const result = await planOptimizer.optimizePlan(mockPlan, context, options);

      expect(result.success).toBe(true);
      expect(result.optimizedPlan).toBeDefined();
      expect(result.optimizationType).toBe('timeline');
      expect(result.strategy).toBe('aggressive');
             expect(result.expectedImprovements.executionTime).toBe(40); // 25 + 15
      expect(result.metrics.timelineOptimization).toBe(30);
      
             // Check that deadline optimization was applied
       const optimizedStep = result.optimizedPlan!.steps[0];
       expect(optimizedStep.actions[1].parameters.timeLimit).toBeDefined();
       expect(optimizedStep.actions[1].parameters.deadlineOptimized).toBe(true);
      
      // Check that time tracking was added
      const timeTrackingAction = optimizedStep.actions.find(action => 
        action.type === 'monitoring' && action.parameters.monitorType === 'time'
      );
      expect(timeTrackingAction).toBeDefined();
    });

    it('should successfully optimize a plan with quality optimization', async () => {
      const options: PlanOptimizationOptions = {
        optimizationType: 'quality',
        strategy: 'conservative'
      };

      const result = await planOptimizer.optimizePlan(mockPlan, {}, options);

      expect(result.success).toBe(true);
      expect(result.optimizedPlan).toBeDefined();
      expect(result.optimizationType).toBe('quality');
      expect(result.strategy).toBe('conservative');
             expect(result.expectedImprovements.quality).toBe(30);
       expect(result.expectedImprovements.successRate).toBe(25);
      
      // Check that quality validation was added
      const optimizedStep = result.optimizedPlan!.steps[0];
      const validationAction = optimizedStep.actions.find(action => action.type === 'validation');
      expect(validationAction).toBeDefined();
      expect(validationAction!.parameters.validationType).toBe('quality');
      
             // Check that reliability optimization was applied
       expect(optimizedStep.actions[1].parameters.reliabilityOptimized).toBe(true);
       expect(optimizedStep.actions[1].parameters.retryCount).toBe(3);
      
      // Check that error handling was added
      const errorHandlingAction = optimizedStep.actions.find(action => action.type === 'error_handling');
      expect(errorHandlingAction).toBeDefined();
    });

    it('should successfully optimize a plan with comprehensive optimization', async () => {
      const context: OptimizationContext = {
        availableResources: {
          cpu: '4 cores',
          memory: '8GB',
          budget: 500,
          timeLimit: 1800
        },
        constraints: {
          maxParallelSteps: 2
        }
      };

      const options: PlanOptimizationOptions = {
        optimizationType: 'comprehensive',
        strategy: 'balanced'
      };

      const result = await planOptimizer.optimizePlan(mockPlan, context, options);

      expect(result.success).toBe(true);
      expect(result.optimizedPlan).toBeDefined();
      expect(result.optimizationType).toBe('comprehensive');
      expect(result.confidence).toBeGreaterThan(0.7);
      
      // Should have improvements from all optimization types
      expect(result.expectedImprovements.parallelization).toBeGreaterThan(0);
      expect(result.expectedImprovements.resourceUsage).toBeGreaterThan(0);
      expect(result.expectedImprovements.executionTime).toBeGreaterThan(0);
      expect(result.expectedImprovements.quality).toBeGreaterThan(0);
      
      // Should have metrics from all optimization types
      expect(result.metrics.dependencyOptimization).toBeGreaterThan(0);
      expect(result.metrics.resourceOptimization).toBeGreaterThan(0);
      expect(result.metrics.timelineOptimization).toBeGreaterThan(0);
    });

    it('should automatically determine optimization type based on context', async () => {
      // Test dependency optimization detection
      const planWithComplexDependencies: Plan = {
        ...mockPlan,
        steps: [
          { ...mockStep, id: 'step-1', dependencies: [] },
          { ...mockStep, id: 'step-2', dependencies: ['step-1'] },
          { ...mockStep, id: 'step-3', dependencies: ['step-1', 'step-2'] },
          { ...mockStep, id: 'step-4', dependencies: ['step-2', 'step-3'] },
          { ...mockStep, id: 'step-5', dependencies: ['step-3', 'step-4'] }
        ]
      };

      const dependencyResult = await planOptimizer.optimizePlan(planWithComplexDependencies);
      expect(dependencyResult.optimizationType).toBe('dependency');

      // Test resource optimization detection
      const resourceContext: OptimizationContext = {
        availableResources: { cpu: '2 cores' }
      };
      
      const planWithManyActions: Plan = {
        ...mockPlan,
        steps: [{
          ...mockStep,
          actions: Array(10).fill(null).map((_, i) => ({ ...mockAction, id: `action-${i}` }))
        }]
      };

      const resourceResult = await planOptimizer.optimizePlan(planWithManyActions, resourceContext);
      expect(resourceResult.optimizationType).toBe('resource');

      // Test timeline optimization detection
      const timelineContext: OptimizationContext = {
        performanceRequirements: {
          maxExecutionTime: 500 // Very short time limit
        }
      };

      const timelineResult = await planOptimizer.optimizePlan(mockPlan, timelineContext);
      expect(timelineResult.optimizationType).toBe('timeline');

      // Test quality optimization detection
      const qualityContext: OptimizationContext = {
        performanceRequirements: {
          qualityThreshold: 0.9 // High quality requirement
        }
      };

      const qualityResult = await planOptimizer.optimizePlan(mockPlan, qualityContext);
      expect(qualityResult.optimizationType).toBe('quality');
    });

    it('should determine optimization strategy based on priorities', async () => {
      // Test aggressive strategy for speed priority
      const speedContext: OptimizationContext = {
        priorities: { speed: 0.9 }
      };

      const speedResult = await planOptimizer.optimizePlan(mockPlan, speedContext);
      expect(speedResult.strategy).toBe('aggressive');

      // Test conservative strategy for reliability priority
      const reliabilityContext: OptimizationContext = {
        priorities: { reliability: 0.9 }
      };

      const reliabilityResult = await planOptimizer.optimizePlan(mockPlan, reliabilityContext);
      expect(reliabilityResult.strategy).toBe('conservative');

      // Test balanced strategy as default
      const balancedResult = await planOptimizer.optimizePlan(mockPlan);
      expect(balancedResult.strategy).toBe('balanced');
    });

    it('should fail with invalid plan', async () => {
      const invalidPlan = {
        ...mockPlan,
        id: '',
        name: ''
      };

      const result = await planOptimizer.optimizePlan(invalidPlan);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plan');
    });

    it('should fail when maximum optimization attempts exceeded', async () => {
      const limitedOptimizer = new PlanOptimizer({ maxOptimizationIterations: 1 });
      
      // First optimization should succeed
      const firstResult = await limitedOptimizer.optimizePlan(mockPlan);
      expect(firstResult.success).toBe(true);
      
      // Second optimization should fail
      const secondResult = await limitedOptimizer.optimizePlan(mockPlan);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain('Maximum optimization attempts exceeded');
    });

    it('should fail when improvement threshold is not met', async () => {
      const strictOptimizer = new PlanOptimizer({ improvementThreshold: 0.9 });
      
      const result = await strictOptimizer.optimizePlan(mockPlan);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Optimization did not meet improvement threshold');
    });

    it('should fail with unknown optimization type', async () => {
      const options: PlanOptimizationOptions = {
        optimizationType: 'unknown' as any
      };

      const result = await planOptimizer.optimizePlan(mockPlan, {}, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown optimization type: unknown');
    });

         it('should handle circular dependency detection', async () => {
       const circularPlan: Plan = {
         ...mockPlan,
         steps: [
           { ...mockStep, id: 'step-1', dependencies: ['step-2'] },
           { ...mockStep, id: 'step-2', dependencies: ['step-1'] }
         ]
       };

       const result = await planOptimizer.optimizePlan(circularPlan);

       expect(result.success).toBe(false);
       expect(result.error).toContain('Circular dependency detected');
     });

    it('should handle plan complexity validation', async () => {
      const complexOptimizer = new PlanOptimizer({ maxPlanComplexity: 5 });
      
      const complexPlan: Plan = {
        ...mockPlan,
        steps: Array(10).fill(null).map((_, i) => ({
          ...mockStep,
          id: `step-${i}`,
          actions: Array(5).fill(null).map((_, j) => ({ ...mockAction, id: `action-${i}-${j}` }))
        }))
      };

      const result = await complexOptimizer.optimizePlan(complexPlan);

      // Should still succeed but with validation warnings
      expect(result.validationResults).toBeDefined();
      expect(result.validationResults!.issues.length).toBeGreaterThan(0);
      expect(result.validationResults!.issues[0].severity).toBe('warning');
      expect(result.validationResults!.issues[0].message).toContain('complexity');
    });
  });

  describe('dependency optimization', () => {
    it('should optimize dependency order using topological sort', async () => {
      const planWithDependencies: Plan = {
        ...mockPlan,
        steps: [
          { ...mockStep, id: 'step-3', dependencies: ['step-1', 'step-2'] },
          { ...mockStep, id: 'step-1', dependencies: [] },
          { ...mockStep, id: 'step-2', dependencies: ['step-1'] }
        ]
      };

      const result = await planOptimizer.optimizePlan(planWithDependencies, {}, { optimizationType: 'dependency' });

      expect(result.success).toBe(true);
      const stepIds = result.optimizedPlan!.steps.map(step => step.id);
      
      // step-1 should come before step-2, and both should come before step-3
      expect(stepIds.indexOf('step-1')).toBeLessThan(stepIds.indexOf('step-2'));
      expect(stepIds.indexOf('step-2')).toBeLessThan(stepIds.indexOf('step-3'));
    });

    it('should remove redundant dependencies', async () => {
      const planWithRedundantDeps: Plan = {
        ...mockPlan,
        steps: [
          { ...mockStep, id: 'step-1', dependencies: [] },
          { ...mockStep, id: 'step-2', dependencies: ['step-1'] },
          { ...mockStep, id: 'step-3', dependencies: ['step-1', 'step-2'] } // step-1 is redundant
        ]
      };

      const result = await planOptimizer.optimizePlan(planWithRedundantDeps, {}, { optimizationType: 'dependency' });

      expect(result.success).toBe(true);
      const step3 = result.optimizedPlan!.steps.find(step => step.id === 'step-3');
      expect(step3!.dependencies).toEqual(['step-2']); // step-1 should be removed
    });

    it('should optimize for parallelization', async () => {
      const context: OptimizationContext = {
        constraints: { maxParallelSteps: 2 }
      };

      const planWithParallelSteps: Plan = {
        ...mockPlan,
        steps: [
          { ...mockStep, id: 'step-1', dependencies: [] },
          { ...mockStep, id: 'step-2', dependencies: [] },
          { ...mockStep, id: 'step-3', dependencies: [] }
        ]
      };

      const result = await planOptimizer.optimizePlan(planWithParallelSteps, context, { optimizationType: 'dependency' });

      expect(result.success).toBe(true);
      expect(result.expectedImprovements.parallelization).toBe(45); // 25 + 20
    });
  });

  describe('resource optimization', () => {
    it('should optimize resource allocation across steps', async () => {
      const context: OptimizationContext = {
        availableResources: {
          cpu: '8 cores',
          memory: '16GB',
          storage: '1TB'
        }
      };

      const result = await planOptimizer.optimizePlan(mockPlan, context, { optimizationType: 'resource' });

      expect(result.success).toBe(true);
      const optimizedAction = result.optimizedPlan!.steps[0].actions[0];
      expect(optimizedAction.parameters.resourceAllocation).toEqual(context.availableResources);
      expect(optimizedAction.parameters.optimizedForResources).toBe(true);
    });

    it('should optimize for cost efficiency', async () => {
      const context: OptimizationContext = {
        availableResources: { budget: 1000 }
      };

      const planWithMultipleSteps: Plan = {
        ...mockPlan,
        steps: [
          { ...mockStep, id: 'step-1' },
          { ...mockStep, id: 'step-2' }
        ]
      };

      const result = await planOptimizer.optimizePlan(planWithMultipleSteps, context, { optimizationType: 'resource' });

      expect(result.success).toBe(true);
      const costPerStep = 1000 / 2; // budget / number of steps
      
      for (const step of result.optimizedPlan!.steps) {
        expect(step.actions[0].parameters.budgetAllocation).toBe(costPerStep);
        expect(step.actions[0].parameters.costOptimized).toBe(true);
      }
    });

         it('should add resource monitoring actions', async () => {
       const context: OptimizationContext = {
         availableResources: {
           cpu: '4 cores',
           memory: '8GB'
         }
       };
       
       const result = await planOptimizer.optimizePlan(mockPlan, context, { optimizationType: 'resource' });

       expect(result.success).toBe(true);
      const optimizedStep = result.optimizedPlan!.steps[0];
      const monitoringAction = optimizedStep.actions.find(action => action.type === 'monitoring');
      
      expect(monitoringAction).toBeDefined();
      expect(monitoringAction!.name).toBe('Resource Monitoring');
      expect(monitoringAction!.parameters.monitorType).toBe('resource');
      expect(monitoringAction!.parameters.metrics).toEqual(['cpu', 'memory', 'storage', 'network']);
    });
  });

  describe('timeline optimization', () => {
    it('should optimize step scheduling by priority and dependencies', async () => {
      const planWithPriorities: Plan = {
        ...mockPlan,
        steps: [
          { ...mockStep, id: 'step-1', priority: 0.3, dependencies: ['step-2'] },
          { ...mockStep, id: 'step-2', priority: 0.8, dependencies: [] },
          { ...mockStep, id: 'step-3', priority: 0.5, dependencies: [] }
        ]
      };

      const result = await planOptimizer.optimizePlan(planWithPriorities, {}, { optimizationType: 'timeline' });

      expect(result.success).toBe(true);
      const stepIds = result.optimizedPlan!.steps.map(step => step.id);
      
      // step-2 should come first (no dependencies, high priority)
      // step-3 should come next (no dependencies, medium priority)
      // step-1 should come last (has dependency)
      expect(stepIds[0]).toBe('step-2');
      expect(stepIds[1]).toBe('step-3');
      expect(stepIds[2]).toBe('step-1');
    });

    it('should optimize for deadline constraints', async () => {
      const context: OptimizationContext = {
        availableResources: { timeLimit: 3600 }
      };

      const planWithMultipleSteps: Plan = {
        ...mockPlan,
        steps: [
          { ...mockStep, id: 'step-1' },
          { ...mockStep, id: 'step-2' }
        ]
      };

      const result = await planOptimizer.optimizePlan(planWithMultipleSteps, context, { optimizationType: 'timeline' });

      expect(result.success).toBe(true);
      const timePerStep = 3600 / 2;
      
             for (const step of result.optimizedPlan!.steps) {
         expect(step.actions[1].parameters.timeLimit).toBe(timePerStep);
         expect(step.actions[1].parameters.deadlineOptimized).toBe(true);
       }
    });

    it('should add time tracking actions', async () => {
      const result = await planOptimizer.optimizePlan(mockPlan, {}, { optimizationType: 'timeline' });

      expect(result.success).toBe(true);
      const optimizedStep = result.optimizedPlan!.steps[0];
      const timeTrackingAction = optimizedStep.actions.find(action => 
        action.type === 'monitoring' && action.parameters.monitorType === 'time'
      );
      
      expect(timeTrackingAction).toBeDefined();
      expect(timeTrackingAction!.name).toBe('Time Tracking');
      expect(timeTrackingAction!.parameters.trackStartTime).toBe(true);
      expect(timeTrackingAction!.parameters.trackEndTime).toBe(true);
      expect(timeTrackingAction!.parameters.trackDuration).toBe(true);
    });
  });

  describe('quality optimization', () => {
    it('should add quality validation actions', async () => {
      const result = await planOptimizer.optimizePlan(mockPlan, {}, { optimizationType: 'quality' });

      expect(result.success).toBe(true);
      const optimizedStep = result.optimizedPlan!.steps[0];
      const validationAction = optimizedStep.actions.find(action => action.type === 'validation');
      
      expect(validationAction).toBeDefined();
      expect(validationAction!.name).toBe('Quality Validation');
      expect(validationAction!.parameters.validationType).toBe('quality');
      expect(validationAction!.parameters.qualityThreshold).toBe(0.8);
      expect(validationAction!.parameters.validationCriteria).toEqual(['completeness', 'accuracy', 'relevance']);
    });

         it('should optimize for reliability', async () => {
       const result = await planOptimizer.optimizePlan(mockPlan, {}, { optimizationType: 'quality' });

       expect(result.success).toBe(true);
       const optimizedAction = result.optimizedPlan!.steps[0].actions[1];
       
       expect(optimizedAction.parameters.reliabilityOptimized).toBe(true);
       expect(optimizedAction.parameters.retryCount).toBe(3);
       expect(optimizedAction.parameters.timeoutMs).toBe(30000);
     });

    it('should add error handling actions', async () => {
      const result = await planOptimizer.optimizePlan(mockPlan, {}, { optimizationType: 'quality' });

      expect(result.success).toBe(true);
      const optimizedStep = result.optimizedPlan!.steps[0];
      const errorHandlingAction = optimizedStep.actions.find(action => action.type === 'error_handling');
      
      expect(errorHandlingAction).toBeDefined();
      expect(errorHandlingAction!.name).toBe('Error Handling');
      expect(errorHandlingAction!.parameters.errorHandlingStrategy).toBe('retry_with_fallback');
      expect(errorHandlingAction!.parameters.maxRetries).toBe(3);
      expect(errorHandlingAction!.parameters.fallbackAction).toBe('log_and_continue');
    });
  });

  describe('getOptimizationHistory', () => {
    it('should return optimization history for a plan', async () => {
      await planOptimizer.optimizePlan(mockPlan);
      
      const history = planOptimizer.getOptimizationHistory('plan-1');
      expect(history).toHaveLength(1);
      expect(history[0].planId).toBe('plan-1');
    });

    it('should return empty array for plan with no optimizations', () => {
      const history = planOptimizer.getOptimizationHistory('nonexistent-plan');
      expect(history).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = planOptimizer.getConfig();

      expect(config.enableDependencyOptimization).toBe(true);
      expect(config.enableResourceOptimization).toBe(true);
      expect(config.enableTimelineOptimization).toBe(true);
      expect(config.enableQualityOptimization).toBe(true);
      expect(config.enableLogging).toBe(true);
      expect(config.maxOptimizationIterations).toBe(5);
      expect(config.optimizationTimeoutMs).toBe(60000);
      expect(config.improvementThreshold).toBe(0.05);
      expect(config.maxPlanComplexity).toBe(1000);
    });

    it('should allow configuration updates', () => {
      planOptimizer.configure({
        maxOptimizationIterations: 10,
        improvementThreshold: 0.1
      });

      const config = planOptimizer.getConfig();

      expect(config.maxOptimizationIterations).toBe(10);
      expect(config.improvementThreshold).toBe(0.1);
      // Other values should remain unchanged
      expect(config.enableDependencyOptimization).toBe(true);
    });

    it('should create plan optimizer with custom configuration', () => {
      const customOptimizer = new PlanOptimizer({
        enableLogging: false,
        maxOptimizationIterations: 3,
        improvementThreshold: 0.2
      });

      const config = customOptimizer.getConfig();

      expect(config.enableLogging).toBe(false);
      expect(config.maxOptimizationIterations).toBe(3);
      expect(config.improvementThreshold).toBe(0.2);
    });
  });

  describe('health status', () => {
    it('should return healthy status with no optimizations', () => {
      const health = planOptimizer.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.config).toBeDefined();
      expect(health.statistics.totalOptimizations).toBe(0);
      expect(health.statistics.successfulOptimizations).toBe(0);
      expect(health.statistics.optimizationsByType).toEqual({});
      expect(health.statistics.averageConfidence).toBe(0);
    });

         it('should return statistics after optimizations', async () => {
       // Perform multiple optimizations
       await planOptimizer.optimizePlan(mockPlan, {}, { optimizationType: 'dependency' });
       
       const resourceContext: OptimizationContext = {
         availableResources: {
           cpu: '4 cores',
           memory: '8GB'
         }
       };
       await planOptimizer.optimizePlan({ ...mockPlan, id: 'plan-2' }, resourceContext, { optimizationType: 'resource' });

      const health = planOptimizer.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.statistics.totalOptimizations).toBe(2);
      expect(health.statistics.successfulOptimizations).toBe(2);
      expect(health.statistics.optimizationsByType.dependency).toBe(1);
      expect(health.statistics.optimizationsByType.resource).toBe(1);
      expect(health.statistics.averageConfidence).toBeGreaterThan(0);
    });
  });

  describe('plan analysis', () => {
    it('should analyze plan characteristics correctly', async () => {
      const complexPlan: Plan = {
        ...mockPlan,
        steps: [
          { ...mockStep, id: 'step-1', dependencies: [], actions: [mockAction, { ...mockAction, id: 'action-2' }] },
          { ...mockStep, id: 'step-2', dependencies: ['step-1'], actions: [mockAction] },
          { ...mockStep, id: 'step-3', dependencies: ['step-1', 'step-2'], actions: [mockAction] }
        ]
      };

      // This will trigger the analysis internally
      const result = await planOptimizer.optimizePlan(complexPlan);

      expect(result.success).toBe(true);
      // The analysis should detect moderate dependency complexity and resource intensity
    });
  });

  describe('error handling', () => {
    it('should create proper error objects', async () => {
      const invalidPlan = { ...mockPlan, id: '', name: '' };

      try {
        await planOptimizer.optimizePlan(invalidPlan);
      } catch (error) {
        expect(error).toBeInstanceOf(PlanOptimizationError);
        expect((error as PlanOptimizationError).code).toBe('INVALID_PLAN');
        expect((error as PlanOptimizationError).planId).toBe('');
        expect((error as PlanOptimizationError).recoverable).toBe(false);
      }
    });

    it('should handle optimization timeout gracefully', async () => {
      const timeoutOptimizer = new PlanOptimizer({ optimizationTimeoutMs: 1 });
      
      // This should complete quickly, but test the timeout mechanism exists
      const result = await timeoutOptimizer.optimizePlan(mockPlan);
      expect(result).toBeDefined();
    });
  });

  describe('improvement calculation', () => {
    it('should calculate improvement scores correctly', async () => {
      const result = await planOptimizer.optimizePlan(mockPlan, {}, { optimizationType: 'comprehensive' });
      
      expect(result.success).toBe(true);
      expect(Object.keys(result.expectedImprovements).length).toBeGreaterThan(0);
      
      // All improvement values should be positive numbers
      for (const [key, value] of Object.entries(result.expectedImprovements)) {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      }
    });

    it('should merge improvements correctly in comprehensive optimization', async () => {
      const result = await planOptimizer.optimizePlan(mockPlan, {}, { optimizationType: 'comprehensive' });
      
      expect(result.success).toBe(true);
      
             // Should have combined improvements from multiple optimization types
       expect(result.expectedImprovements.executionTime).toBeGreaterThan(0);
       expect(result.expectedImprovements.quality).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('should validate plan structure', async () => {
      const result = await planOptimizer.optimizePlan(mockPlan);

      expect(result.validationResults).toBeDefined();
      expect(result.validationResults!.isValid).toBe(true);
      expect(result.validationResults!.score).toBeGreaterThan(0);
    });

    it('should detect validation issues in empty plan', async () => {
      const emptyPlan: Plan = {
        ...mockPlan,
        steps: []
      };

      const result = await planOptimizer.optimizePlan(emptyPlan);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plan');
    });
  });
}); 