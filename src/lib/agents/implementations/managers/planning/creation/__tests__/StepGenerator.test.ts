/**
 * StepGenerator.test.ts - Unit tests for StepGenerator component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StepGenerator, StepGenerationError } from '../StepGenerator';
import { ActionGenerator } from '../ActionGenerator';

// Mock the logger
vi.mock('../../../../../logging/winston-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

describe('StepGenerator', () => {
  let stepGenerator: StepGenerator;
  let mockActionGenerator: ActionGenerator;

  beforeEach(() => {
    // Create mock action generator
    mockActionGenerator = {
      generateActions: vi.fn().mockResolvedValue({
        actions: [
          {
            id: 'action-1',
            name: 'Test Action',
            description: 'Test action description',
            type: 'tool',
            toolName: 'test-tool',
            parameters: {},
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        confidence: 0.8,
        estimatedTime: 10,
        requiredTools: ['test-tool']
      }),
      optimizeActions: vi.fn()
    } as any;

    stepGenerator = new StepGenerator({}, mockActionGenerator);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSteps', () => {
    it('should generate steps from template for research goal', async () => {
      const goal = 'Research market trends for Q4';
      
      const result = await stepGenerator.generateSteps(goal);

      expect(result.steps).toHaveLength(4);
      expect(result.steps[0].name).toBe('Gather initial information');
      expect(result.steps[1].name).toBe('Analyze collected data');
      expect(result.steps[2].name).toBe('Identify key insights');
      expect(result.steps[3].name).toBe('Document findings');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.estimatedTime).toBeGreaterThan(0);
    });

    it('should generate steps from template for create goal', async () => {
      const goal = 'Create a web application for task management';
      
      const result = await stepGenerator.generateSteps(goal);

      expect(result.steps).toHaveLength(5);
      expect(result.steps[0].name).toBe('Plan and design');
      expect(result.steps[1].name).toBe('Set up environment');
      expect(result.steps[2].name).toBe('Implement core functionality');
      expect(result.steps[3].name).toBe('Test and validate');
      expect(result.steps[4].name).toBe('Finalize and document');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should generate steps from template for process goal', async () => {
      const goal = 'Process customer data and transform it to new format';
      
      const result = await stepGenerator.generateSteps(goal);

      expect(result.steps).toHaveLength(5);
      expect(result.steps[0].name).toBe('Prepare source data');
      expect(result.steps[1].name).toBe('Set up processing pipeline');
      expect(result.steps[2].name).toBe('Execute transformation');
      expect(result.steps[3].name).toBe('Validate results');
      expect(result.steps[4].name).toBe('Store processed data');
    });

    it('should generate steps from template for communication goal', async () => {
      const goal = 'Send quarterly report to stakeholders';
      
      const result = await stepGenerator.generateSteps(goal);

      expect(result.steps).toHaveLength(4);
      expect(result.steps[0].name).toBe('Prepare content');
      expect(result.steps[1].name).toBe('Format for audience');
      expect(result.steps[2].name).toBe('Deliver communication');
      expect(result.steps[3].name).toBe('Gather feedback');
    });

    it('should generate generic steps for unmatched goals', async () => {
      const goal = 'Organize team meeting for project planning';
      
      const result = await stepGenerator.generateSteps(goal);

      expect(result.steps.length).toBeGreaterThanOrEqual(2);
      expect(result.steps.length).toBeLessThanOrEqual(20);
      expect(result.steps[0].description).toContain(goal);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle complex goals with more steps', async () => {
      const goal = 'Create comprehensive enterprise application with multiple integrations and advanced features';
      
      const result = await stepGenerator.generateSteps(goal);

      expect(result.steps.length).toBeGreaterThan(2);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should generate steps with proper dependencies', async () => {
      const goal = 'Build a data analysis system';
      
      const result = await stepGenerator.generateSteps(goal);

      // Check that steps have proper sequential dependencies
      for (let i = 1; i < result.steps.length; i++) {
        expect(result.steps[i].dependencies.length).toBeGreaterThan(0);
      }
    });

    it('should include actions in generated steps', async () => {
      const goal = 'Create a simple website';
      
      const result = await stepGenerator.generateSteps(goal);

      // Verify that action generator was called for each step
      expect(mockActionGenerator.generateActions).toHaveBeenCalledTimes(result.steps.length);
      
      // Verify that steps have actions
      result.steps.forEach(step => {
        expect(step.actions).toHaveLength(1);
        expect(step.actions[0].name).toBe('Test Action');
      });
    });

    it('should handle empty goal', async () => {
      await expect(stepGenerator.generateSteps('')).rejects.toThrow(StepGenerationError);
      await expect(stepGenerator.generateSteps('   ')).rejects.toThrow(StepGenerationError);
    });

    it('should handle action generation failure', async () => {
      mockActionGenerator.generateActions = vi.fn().mockRejectedValue(new Error('Action generation failed'));
      
      await expect(stepGenerator.generateSteps('Test goal')).rejects.toThrow();
    });

    it('should respect configuration limits', async () => {
      const limitedGenerator = new StepGenerator({ maxStepsPerPlan: 3 });
      const goal = 'Create comprehensive system with many features and integrations';
      
      const result = await limitedGenerator.generateSteps(goal);

      expect(result.steps.length).toBeLessThanOrEqual(3);
    });

    it('should handle step generation with context', async () => {
      const goal = 'Analyze user feedback';
      const context = { 
        userPreferences: 'detailed analysis',
        availableData: ['feedback.csv', 'survey.json']
      };
      
      const result = await stepGenerator.generateSteps(goal, context);

      expect(result.steps).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle step generation with options', async () => {
      const goal = 'Create project plan';
      const options = {
        timeConstraints: { maxDuration: 120 },
        qualityRequirements: { minConfidence: 0.8 }
      };
      
      const result = await stepGenerator.generateSteps(goal, {}, options);

      expect(result.steps).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('refineSteps', () => {
    it('should refine existing steps with feedback', async () => {
      const initialSteps = [
        {
          id: 'step-1',
          name: 'Initial Step',
          description: 'Initial step description',
          priority: 0.5,
          dependencies: [],
          actions: [],
          status: 'pending' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          estimatedTimeMinutes: 20
        }
      ];
      const feedback = 'Make the steps more detailed';
      
      const result = await stepGenerator.refineSteps(initialSteps, feedback);

      expect(result.steps).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(mockActionGenerator.generateActions).toHaveBeenCalled();
    });

    it('should refine steps without feedback', async () => {
      const initialSteps = [
        {
          id: 'step-1',
          name: 'Initial Step',
          description: 'Initial step description',
          priority: 0.5,
          dependencies: [],
          actions: [],
          status: 'pending' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          estimatedTimeMinutes: 20
        }
      ];
      
      const result = await stepGenerator.refineSteps(initialSteps);

      expect(result.steps).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle empty steps array', async () => {
      const result = await stepGenerator.refineSteps([]);

      expect(result.steps).toEqual([]);
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('step optimization', () => {
    it('should optimize steps when enabled', async () => {
      const optimizingGenerator = new StepGenerator({ enableOptimization: true });
      const goal = 'Create and test application';
      
      const result = await optimizingGenerator.generateSteps(goal);

      expect(result.steps).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should skip optimization when disabled', async () => {
      const nonOptimizingGenerator = new StepGenerator({ enableOptimization: false });
      const goal = 'Create and test application';
      
      const result = await nonOptimizingGenerator.generateSteps(goal);

      expect(result.steps).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('step validation', () => {
    it('should validate steps when enabled', async () => {
      const validatingGenerator = new StepGenerator({ enableValidation: true });
      const goal = 'Create simple application';
      
      const result = await validatingGenerator.generateSteps(goal);

      expect(result.steps).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should skip validation when disabled', async () => {
      const nonValidatingGenerator = new StepGenerator({ enableValidation: false });
      const goal = 'Create simple application';
      
      const result = await nonValidatingGenerator.generateSteps(goal);

      expect(result.steps).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle validation failure', async () => {
      // Create a generator that will fail validation by having very high confidence threshold
      const strictGenerator = new StepGenerator({ 
        enableValidation: true,
        defaultStepPriority: -1 // Invalid priority to trigger validation failure
      });
      
      const goal = 'Create application';
      
      await expect(strictGenerator.generateSteps(goal)).rejects.toThrow(StepGenerationError);
    });
  });

  describe('dependency analysis', () => {
    it('should analyze dependencies when enabled', async () => {
      const dependencyGenerator = new StepGenerator({ enableDependencyAnalysis: true });
      const goal = 'Build complex system';
      
      const result = await dependencyGenerator.generateSteps(goal);

      expect(result.steps).toBeDefined();
      // Steps should have dependencies
      const stepsWithDeps = result.steps.filter(step => step.dependencies.length > 0);
      expect(stepsWithDeps.length).toBeGreaterThan(0);
    });

    it('should skip dependency analysis when disabled', async () => {
      const noDependencyGenerator = new StepGenerator({ enableDependencyAnalysis: false });
      const goal = 'Build complex system';
      
      const result = await noDependencyGenerator.generateSteps(goal);

      expect(result.steps).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = stepGenerator.getConfig();

      expect(config.maxStepsPerPlan).toBe(20);
      expect(config.maxDecompositionDepth).toBe(3);
      expect(config.enableDependencyAnalysis).toBe(true);
      expect(config.enableOptimization).toBe(true);
      expect(config.enableValidation).toBe(true);
      expect(config.enableLogging).toBe(true);
      expect(config.defaultStepPriority).toBe(0.5);
      expect(config.generationTimeoutMs).toBe(30000);
    });

    it('should allow configuration updates', () => {
      stepGenerator.configure({
        maxStepsPerPlan: 15,
        enableOptimization: false
      });

      const config = stepGenerator.getConfig();

      expect(config.maxStepsPerPlan).toBe(15);
      expect(config.enableOptimization).toBe(false);
      // Other values should remain unchanged
      expect(config.maxDecompositionDepth).toBe(3);
    });

    it('should create step generator with custom configuration', () => {
      const customGenerator = new StepGenerator({
        maxStepsPerPlan: 25,
        enableValidation: false
      });

      const config = customGenerator.getConfig();

      expect(config.maxStepsPerPlan).toBe(25);
      expect(config.enableValidation).toBe(false);
    });
  });

  describe('health status', () => {
    it('should return healthy status', () => {
      const health = stepGenerator.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.config).toBeDefined();
      expect(health.templateCount).toBe(4); // Number of predefined templates
    });
  });

  describe('template matching', () => {
    it('should match research template', async () => {
      const goals = [
        'Research market trends',
        'Analyze customer behavior',
        'Investigate security issues',
        'Study user patterns',
        'Examine data quality'
      ];

      for (const goal of goals) {
        const result = await stepGenerator.generateSteps(goal);
        expect(result.steps).toHaveLength(4); // Research template has 4 steps
        expect(result.steps[0].name).toBe('Gather initial information');
      }
    });

    it('should match create template', async () => {
      const goals = [
        'Create web application',
        'Build mobile app',
        'Develop API service',
        'Implement feature',
        'Design user interface',
        'Make dashboard'
      ];

      for (const goal of goals) {
        const result = await stepGenerator.generateSteps(goal);
        expect(result.steps).toHaveLength(5); // Create template has 5 steps
        expect(result.steps[0].name).toBe('Plan and design');
      }
    });

    it('should match process template', async () => {
      const goals = [
        'Process customer data',
        'Transform file format',
        'Convert database',
        'Migrate user accounts',
        'Import legacy data',
        'Export reports'
      ];

      for (const goal of goals) {
        const result = await stepGenerator.generateSteps(goal);
        expect(result.steps).toHaveLength(5); // Process template has 5 steps
        expect(result.steps[0].name).toBe('Prepare source data');
      }
    });

    it('should match communication template', async () => {
      const goals = [
        'Send project update',
        'Share quarterly results',
        'Notify team members',
        'Report system status',
        'Present findings'
      ];

      for (const goal of goals) {
        const result = await stepGenerator.generateSteps(goal);
        expect(result.steps).toHaveLength(4); // Communication template has 4 steps
        expect(result.steps[0].name).toBe('Prepare content');
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid goal gracefully', async () => {
      await expect(stepGenerator.generateSteps('')).rejects.toThrow(StepGenerationError);
      await expect(stepGenerator.generateSteps('   ')).rejects.toThrow(StepGenerationError);
    });

    it('should handle action generator errors', async () => {
      mockActionGenerator.generateActions = vi.fn().mockRejectedValue(new Error('Mock error'));
      
      await expect(stepGenerator.generateSteps('Test goal')).rejects.toThrow();
    });

    it('should create proper error objects', async () => {
      try {
        await stepGenerator.generateSteps('');
      } catch (error) {
        expect(error).toBeInstanceOf(StepGenerationError);
        expect((error as StepGenerationError).code).toBe('INVALID_GOAL');
        expect((error as StepGenerationError).goal).toBe('');
        expect((error as StepGenerationError).recoverable).toBe(false);
      }
    });
  });

  describe('metrics and calculations', () => {
    it('should calculate confidence correctly', async () => {
      const goal = 'Create simple application';
      
      const result = await stepGenerator.generateSteps(goal);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should calculate total time correctly', async () => {
      const goal = 'Research market data';
      
      const result = await stepGenerator.generateSteps(goal);

      expect(result.estimatedTime).toBeGreaterThan(0);
      // Should be sum of step times plus action times
      const stepTime = result.steps.reduce((sum, step) => sum + (step.estimatedTimeMinutes || 0), 0);
      expect(result.estimatedTime).toBeGreaterThanOrEqual(stepTime);
    });

    it('should analyze resource requirements', async () => {
      const goal = 'Build web application';
      
      const result = await stepGenerator.generateSteps(goal);

      expect(result.resourceRequirements).toBeDefined();
      expect(result.resourceRequirements?.totalSteps).toBe(result.steps.length);
      expect(result.resourceRequirements?.totalActions).toBeGreaterThan(0);
    });
  });
}); 