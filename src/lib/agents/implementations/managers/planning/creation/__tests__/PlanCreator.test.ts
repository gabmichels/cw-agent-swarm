/**
 * PlanCreator.test.ts - Unit tests for PlanCreator component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PlanCreator } from '../PlanCreator';
import { StepGenerator } from '../StepGenerator';

// Mock the logger
vi.mock('@/lib/logging/winston-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

describe('PlanCreator', () => {
  let planCreator: PlanCreator;
  let mockStepGenerator: StepGenerator;

  beforeEach(() => {
    // Create mock step generator
    mockStepGenerator = {
      generateSteps: vi.fn().mockResolvedValue({
        steps: [
          {
            id: 'step-1',
            name: 'Test Step',
            description: 'Test step description',
            priority: 0.5,
            dependencies: [],
            actions: [],
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
            estimatedTimeMinutes: 20
          }
        ],
        confidence: 0.8,
        estimatedTime: 20,
        resourceRequirements: {
          totalSteps: 1,
          totalActions: 0,
          requiredTools: [],
          estimatedDuration: 20
        }
      }),
      refineSteps: vi.fn(),
      configure: vi.fn(),
      getConfig: vi.fn(),
      getHealthStatus: vi.fn()
    } as any;

    planCreator = new PlanCreator({}, mockStepGenerator);
  });

  describe('createPlan', () => {
    it('should create a plan from a simple goal', async () => {
      const goal = 'Create a simple web application';
      
      const result = await planCreator.createPlan(goal);

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan!.name).toContain('Create');
      expect(result.plan!.description).toBe(goal);
      expect(result.plan!.goals).toEqual([goal]);
      expect(result.plan!.steps).toHaveLength(1);
      expect(result.plan!.status).toBe('pending');
      expect(result.plan!.confidence).toBeGreaterThan(0);
      expect(result.plan!.metadata).toBeDefined();
      expect(mockStepGenerator.generateSteps).toHaveBeenCalledWith(
        goal,
        expect.objectContaining({
          goalAnalysis: expect.any(Object),
          strategy: expect.any(Object)
        }),
        expect.objectContaining({
          qualityRequirements: expect.any(Object)
        })
      );
    });

    it('should create a plan with custom options', async () => {
      const goal = 'Build a data analysis system';
      const options = {
        priority: 8,
        context: { userPreferences: 'fast execution' }
      };
      
      const result = await planCreator.createPlan(goal, options);

      expect(result.success).toBe(true);
      expect(result.plan!.priority).toBe(8);
      expect(mockStepGenerator.generateSteps).toHaveBeenCalledWith(
        goal,
        expect.objectContaining({
          userPreferences: 'fast execution'
        }),
        expect.any(Object)
      );
    });

    it('should handle empty goal', async () => {
      const result = await planCreator.createPlan('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Goal description cannot be empty');
    });

    it('should handle whitespace-only goal', async () => {
      const result = await planCreator.createPlan('   ');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Goal description cannot be empty');
    });

    it('should analyze goal complexity correctly', async () => {
      const complexGoal = 'Create a comprehensive, multi-platform application with advanced analytics, real-time processing, and multiple integrations';
      
      const result = await planCreator.createPlan(complexGoal);

      expect(result.success).toBe(true);
      expect(result.plan!.metadata.complexity).toBeGreaterThan(5);
      expect(result.plan!.metadata.tags).toContain('complex');
    });

    it('should identify required capabilities', async () => {
      const goal = 'Search for data online and analyze it using machine learning';
      
      const result = await planCreator.createPlan(goal);

      expect(result.success).toBe(true);
      expect(result.plan!.metadata.requiredCapabilities).toContain('web');
      expect(result.plan!.metadata.requiredCapabilities).toContain('data');
    });

    it('should select appropriate strategy based on complexity', async () => {
      const simpleGoal = 'Create a basic text file';
      const complexGoal = 'Develop a complex distributed system with multiple microservices';
      
      const simpleResult = await planCreator.createPlan(simpleGoal);
      const complexResult = await planCreator.createPlan(complexGoal);

      expect(simpleResult.success).toBe(true);
      expect(complexResult.success).toBe(true);
      
      // Complex goals should get different strategy than simple ones
      expect(simpleResult.plan!.metadata.strategy).toBeDefined();
      expect(complexResult.plan!.metadata.strategy).toBeDefined();
    });

    it('should handle step generation failure', async () => {
      mockStepGenerator.generateSteps = vi.fn().mockRejectedValue(new Error('Step generation failed'));
      
      const result = await planCreator.createPlan('Test goal');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Step generation failed');
    });

    it('should validate plan when validation is enabled', async () => {
      planCreator.configure({ enableValidation: true });
      
      const result = await planCreator.createPlan('Create a test plan');

      expect(result.success).toBe(true);
      // Plan should pass validation with proper structure
    });

    it('should optimize plan when optimization is enabled', async () => {
      planCreator.configure({ enableOptimization: true });
      
      const result = await planCreator.createPlan('Create a test plan');

      expect(result.success).toBe(true);
      // Plan should be optimized
    });
  });

  describe('goal analysis', () => {
    it('should parse objectives from goal', async () => {
      const goal = 'Create a website and implement user authentication';
      
      const result = await planCreator.createPlan(goal);

      expect(result.success).toBe(true);
      expect(result.plan!.metadata.successCriteria).toContain('Successfully a website');
      expect(result.plan!.metadata.successCriteria).toContain('Successfully user authentication');
    });

    it('should identify constraints', async () => {
      const goal = 'Build an app within 2 weeks using React';
      
      const result = await planCreator.createPlan(goal);

      expect(result.success).toBe(true);
      // Should identify time and technology constraints
    });

    it('should estimate duration based on complexity', async () => {
      const simpleGoal = 'Create a simple text file';
      const complexGoal = 'Build a comprehensive enterprise application with multiple integrations';
      
      const simpleResult = await planCreator.createPlan(simpleGoal);
      const complexResult = await planCreator.createPlan(complexGoal);

      expect(simpleResult.success).toBe(true);
      expect(complexResult.success).toBe(true);
             expect(Number(complexResult.plan!.metadata.estimatedDuration)).toBeGreaterThan(
         Number(simpleResult.plan!.metadata.estimatedDuration)
       );
    });

    it('should identify potential risks', async () => {
      const riskyGoal = 'Build a large-scale real-time system with external dependencies';
      
      const result = await planCreator.createPlan(riskyGoal);

      expect(result.success).toBe(true);
      expect(result.plan!.metadata.risks).toContain('External dependencies may be unreliable');
      expect(result.plan!.metadata.risks).toContain('Real-time requirements may be challenging to meet');
    });
  });

  describe('strategy selection', () => {
    it('should select sequential strategy for simple goals', async () => {
      const simpleGoal = 'Create a basic document';
      
      const result = await planCreator.createPlan(simpleGoal);

      expect(result.success).toBe(true);
      expect(['sequential', 'conservative']).toContain(result.plan!.metadata.strategy);
    });

    it('should select parallel strategy for complex goals', async () => {
      const complexGoal = 'Build a comprehensive system with multiple independent components and advanced features';
      
      const result = await planCreator.createPlan(complexGoal);

      expect(result.success).toBe(true);
      expect(['parallel', 'adaptive']).toContain(result.plan!.metadata.strategy);
    });

    it('should select conservative strategy for high-risk goals', async () => {
      const riskyGoal = 'Build a system with external dependencies and real-time requirements and multiple constraints';
      
      const result = await planCreator.createPlan(riskyGoal);

      expect(result.success).toBe(true);
      // Should prefer conservative strategy due to high risk
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = planCreator.getConfig();

      expect(config.maxStepsPerPlan).toBe(20);
      expect(config.maxActionsPerStep).toBe(10);
      expect(config.confidenceThreshold).toBe(0.7);
      expect(config.enableOptimization).toBe(true);
      expect(config.enableValidation).toBe(true);
             expect(config.enableValidation).toBe(true);
    });

    it('should allow configuration updates', () => {
             planCreator.configure({
         maxStepsPerPlan: 15,
         confidenceThreshold: 0.8
       });

       const config = planCreator.getConfig();

       expect(config.maxStepsPerPlan).toBe(15);
       expect(config.confidenceThreshold).toBe(0.8);
      // Other values should remain unchanged
      expect(config.maxActionsPerStep).toBe(10);
    });

    it('should create plan creator with custom configuration', () => {
             const customCreator = new PlanCreator({
         maxStepsPerPlan: 25,
         enableOptimization: false
       });

       const config = customCreator.getConfig();

       expect(config.maxStepsPerPlan).toBe(25);
       expect(config.enableOptimization).toBe(false);
    });
  });

  describe('health status', () => {
    it('should return healthy status', () => {
      const health = planCreator.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.config).toBeDefined();
    });
  });

  describe('plan generation', () => {
    it('should generate appropriate plan name', async () => {
      const goal = 'Create a user management system';
      
      const result = await planCreator.createPlan(goal);

      expect(result.success).toBe(true);
      expect(result.plan!.name).toContain('Create');
      expect(result.plan!.name.length).toBeLessThanOrEqual(50);
    });

    it('should generate plan tags based on analysis', async () => {
      const goal = 'Build a simple web application';
      
      const result = await planCreator.createPlan(goal);

      expect(result.success).toBe(true);
      expect(result.plan!.metadata.tags).toContain('web');
      expect(result.plan!.metadata.tags).toContain('goal-oriented');
    });

    it('should set appropriate plan priority', async () => {
      const result = await planCreator.createPlan('Test goal', { priority: 7 });

      expect(result.success).toBe(true);
      expect(result.plan!.priority).toBe(7);
    });

    it('should use default priority when not specified', async () => {
      const result = await planCreator.createPlan('Test goal');

      expect(result.success).toBe(true);
      expect(result.plan!.priority).toBe(5); // Default priority
    });
  });

  describe('error handling', () => {
    it('should handle step generator errors gracefully', async () => {
      mockStepGenerator.generateSteps = vi.fn().mockRejectedValue(new Error('Mock error'));
      
      const result = await planCreator.createPlan('Test goal');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle validation errors when validation is strict', async () => {
      planCreator.configure({ 
        enableValidation: true,
        confidenceThreshold: 0.95 // Very high threshold
      });
      
      // Mock step generator to return low confidence
      mockStepGenerator.generateSteps = vi.fn().mockResolvedValue({
        steps: [],
        confidence: 0.5, // Low confidence
        estimatedTime: 0,
        resourceRequirements: {}
      });
      
      const result = await planCreator.createPlan('Test goal');

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });
  });
}); 