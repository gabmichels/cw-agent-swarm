/**
 * Unit tests for ActionProcessor
 */

import { ActionProcessor, ActionProcessingError } from './ActionProcessor';
import { ImprovementAction } from '../interfaces/ReflectionInterfaces';

describe('ActionProcessor', () => {
  let processor: ActionProcessor;

  beforeEach(() => {
    processor = new ActionProcessor();
  });

  afterEach(async () => {
    await processor.clear();
  });

  describe('processAction', () => {
    it('should process a valid improvement action successfully', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Improve error handling',
        description: 'Add comprehensive error handling to the system',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'high',
        targetArea: 'tools',
        expectedImpact: 0.8,
        difficulty: 0.6,
        implementationSteps: [
          { description: 'Analyze current error patterns', status: 'pending' },
          { description: 'Design new error handling strategy', status: 'pending' },
          { description: 'Implement error recovery mechanisms', status: 'pending' }
        ]
      };

      const result = await processor.processAction(action);

      expect(result.success).toBe(true);
      expect(result.actionId).toBe(action.id);
      expect(result.results).toBeDefined();
      expect(result.nextSteps).toBeInstanceOf(Array);
      expect(result.nextSteps.length).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.metadata.processingTimestamp).toBeInstanceOf(Date);
    });

    it('should throw error for invalid action status', async () => {
      const action: ImprovementAction = {
        id: 'action-2',
        title: 'Invalid action',
        description: 'This action has invalid status',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'suggested', // Invalid for processing
        priority: 'medium',
        targetArea: 'planning',
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: []
      };

      await expect(processor.processAction(action)).rejects.toThrow(ActionProcessingError);
    });

    it('should handle concurrent processing within limits', async () => {
      const customProcessor = new ActionProcessor({ maxConcurrentActions: 2 });
      
      const action1: ImprovementAction = {
        id: 'action-1',
        title: 'First action',
        description: 'First concurrent action',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-1',
        status: 'accepted',
        priority: 'high',
        targetArea: 'tools',
        expectedImpact: 0.7,
        difficulty: 0.4,
        implementationSteps: [{ description: 'Quick step', status: 'pending' }]
      };

      const action2: ImprovementAction = {
        id: 'action-2',
        title: 'Second action',
        description: 'Second concurrent action',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-2',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'planning',
        expectedImpact: 0.6,
        difficulty: 0.3,
        implementationSteps: [{ description: 'Another quick step', status: 'pending' }]
      };

      // Process both actions concurrently
      const [result1, result2] = await Promise.all([
        customProcessor.processAction(action1),
        customProcessor.processAction(action2)
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.actionId).toBe('action-1');
      expect(result2.actionId).toBe('action-2');

      await customProcessor.clear();
    });

    it('should handle action without implementation steps', async () => {
      const action: ImprovementAction = {
        id: 'action-3',
        title: 'Simple action',
        description: 'Action without implementation steps',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'low',
        targetArea: 'learning',
        expectedImpact: 0.4,
        difficulty: 0.2,
        implementationSteps: []
      };

      const result = await processor.processAction(action);

      expect(result.success).toBe(true);
      expect(result.actionId).toBe(action.id);
      expect(result.results).toBeDefined();
      expect(result.nextSteps).toBeInstanceOf(Array);
    });
  });

  describe('trackProgress', () => {
    it('should track progress for an active action', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Test action',
        description: 'Action for progress tracking',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'tools',
        expectedImpact: 0.6,
        difficulty: 0.4,
        implementationSteps: [
          { description: 'Step 1', status: 'pending' },
          { description: 'Step 2', status: 'pending' }
        ]
      };

      // Start processing the action (don't await to keep it active)
      const processingPromise = processor.processAction(action);

      // Give it a moment to initialize progress tracking
      await new Promise(resolve => setTimeout(resolve, 50));

      const progress = await processor.trackProgress(action.id);

      expect(progress.actionId).toBe(action.id);
      expect(progress.status).toBe('in_progress');
      expect(progress.totalSteps).toBe(2);
      expect(progress.percentComplete).toBeGreaterThanOrEqual(0);
      expect(progress.percentComplete).toBeLessThanOrEqual(100);
      expect(progress.lastUpdated).toBeInstanceOf(Date);

      // Wait for processing to complete
      await processingPromise;
    });

    it('should throw error for non-existent action', async () => {
      await expect(processor.trackProgress('non-existent')).rejects.toThrow(ActionProcessingError);
    });
  });

  describe('assessImpact', () => {
    it('should assess impact for a completed action', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Completed action',
        description: 'Action for impact assessment',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'high',
        targetArea: 'execution',
        expectedImpact: 0.8,
        difficulty: 0.5,
        implementationSteps: []  // Simplified - no steps to avoid timing issues
      };

      // Process the action first
      const result = await processor.processAction(action);
      expect(result.success).toBe(true);

      // Now assess impact
      const impact = await processor.assessImpact(action.id);

      expect(impact.actionId).toBe(action.id);
      expect(impact.overallImpact).toBeGreaterThan(0);
      expect(impact.overallImpact).toBeLessThanOrEqual(1);
      expect(impact.impactAreas).toBeDefined();
      expect(impact.impactAreas.performance).toBeGreaterThanOrEqual(0);
      expect(impact.impactAreas.quality).toBeGreaterThanOrEqual(0);
      expect(impact.impactAreas.efficiency).toBeGreaterThanOrEqual(0);
      expect(impact.impactAreas.userSatisfaction).toBeGreaterThanOrEqual(0);
      expect(impact.confidence).toBeGreaterThan(0);
      expect(impact.confidence).toBeLessThanOrEqual(1);
      expect(impact.recommendations).toBeInstanceOf(Array);
    }, 15000); // Increase timeout for this specific test

    it('should throw error for non-existent action', async () => {
      await expect(processor.assessImpact('non-existent')).rejects.toThrow(ActionProcessingError);
    });

    it('should throw error for failed action', async () => {
      const action: ImprovementAction = {
        id: 'action-fail',
        title: 'Failing action',
        description: 'Action that will fail',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'rejected', // This will cause validation to fail
        priority: 'low',
        targetArea: 'tools',
        expectedImpact: 0.3,
        difficulty: 0.2,
        implementationSteps: []
      };

      try {
        await processor.processAction(action);
      } catch (error) {
        // Expected to fail
      }

      await expect(processor.assessImpact(action.id)).rejects.toThrow(ActionProcessingError);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report for completed action', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Report action',
        description: 'Action for report generation',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'interaction',
        expectedImpact: 0.7,
        difficulty: 0.4,
        implementationSteps: []  // Simplified - no steps to avoid timing issues
      };

      // Process the action first
      const result = await processor.processAction(action);
      expect(result.success).toBe(true);

      // Generate report
      const report = await processor.generateReport(action.id);

      expect(report.actionId).toBe(action.id);
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
      expect(typeof report.summary).toBe('string');
      expect(report.summary.length).toBeGreaterThan(0);
      expect(report.result).toBeDefined();
      expect(report.result.actionId).toBe(action.id);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.metadata).toBeDefined();
      expect(report.metadata.reportVersion).toBeDefined();
    }, 15000); // Increase timeout for this specific test

    it('should generate report for failed action without impact', async () => {
      const action: ImprovementAction = {
        id: 'action-fail',
        title: 'Failed action',
        description: 'Action that failed',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'rejected', // Will cause failure
        priority: 'low',
        targetArea: 'tools',
        expectedImpact: 0.2,
        difficulty: 0.1,
        implementationSteps: []
      };

      try {
        await processor.processAction(action);
      } catch (error) {
        // Expected to fail, but result should be stored
      }

      const report = await processor.generateReport(action.id);

      expect(report.actionId).toBe(action.id);
      expect(report.result.success).toBe(false);
      expect(report.impact).toBeUndefined(); // No impact for failed actions
    });

    it('should throw error for non-existent action', async () => {
      await expect(processor.generateReport('non-existent')).rejects.toThrow(ActionProcessingError);
    });
  });

  describe('cancelAction', () => {
    it('should cancel an active action', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Cancellable action',
        description: 'Action that can be cancelled',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'tools',
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: [
          { description: 'Long running step', status: 'pending' }
        ]
      };

      // Start processing (don't await)
      const processingPromise = processor.processAction(action);

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Cancel the action
      const cancelled = await processor.cancelAction(action.id);

      expect(cancelled).toBe(true);

      // The processing should eventually fail due to cancellation
      await expect(processingPromise).rejects.toThrow(ActionProcessingError);
    });

    it('should return false for non-active action', async () => {
      const cancelled = await processor.cancelAction('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', async () => {
      const stats = processor.getProcessingStats();

      expect(stats).toHaveProperty('activeActions');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('metrics');

      expect(typeof stats.activeActions).toBe('number');
      expect(typeof stats.totalProcessed).toBe('number');
      expect(typeof stats.successRate).toBe('number');
      expect(typeof stats.averageExecutionTime).toBe('number');
    });

    it('should update statistics after processing actions', async () => {
      const initialStats = processor.getProcessingStats();
      const initialProcessed = initialStats.totalProcessed as number;

      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Stats action',
        description: 'Action for statistics testing',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'tools',
        expectedImpact: 0.6,
        difficulty: 0.4,
        implementationSteps: []
      };

      await processor.processAction(action);

      const updatedStats = processor.getProcessingStats();
      expect(updatedStats.totalProcessed).toBe(initialProcessed + 1);
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', async () => {
      const customProcessor = new ActionProcessor({
        maxConcurrentActions: 2,
        defaultTimeout: 10000,
        retryAttempts: 5,
        progressUpdateInterval: 1000,
        impactMeasurementDelay: 100,
        enableMetrics: false
      });

      const stats = customProcessor.getProcessingStats();
      const config = stats.config as Record<string, unknown>;
      expect(config.maxConcurrentActions).toBe(2);
      expect(config.defaultTimeout).toBe(10000);
      expect(config.retryAttempts).toBe(5);
      expect(config.progressUpdateInterval).toBe(1000);
      expect(config.impactMeasurementDelay).toBe(100);
      expect(config.enableMetrics).toBe(false);
      expect(stats.metrics).toEqual({});

      await customProcessor.clear();
    });
  });

  describe('target area specific next steps', () => {
    it('should generate tools-specific next steps', async () => {
      const action: ImprovementAction = {
        id: 'action-tools',
        title: 'Tools improvement',
        description: 'Improve tool functionality',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'tools',
        expectedImpact: 0.6,
        difficulty: 0.4,
        implementationSteps: []
      };

      const result = await processor.processAction(action);

      expect(result.nextSteps).toContain('Monitor tool performance metrics');
      expect(result.nextSteps).toContain('Gather user feedback on tool improvements');
    });

    it('should generate planning-specific next steps', async () => {
      const action: ImprovementAction = {
        id: 'action-planning',
        title: 'Planning improvement',
        description: 'Improve planning algorithms',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'high',
        targetArea: 'planning',
        expectedImpact: 0.8,
        difficulty: 0.6,
        implementationSteps: []
      };

      const result = await processor.processAction(action);

      expect(result.nextSteps).toContain('Evaluate planning algorithm effectiveness');
      expect(result.nextSteps).toContain('Test planning improvements with sample scenarios');
    });
  });

  describe('quality metrics calculation', () => {
    it('should calculate quality metrics for processed results', async () => {
      const action: ImprovementAction = {
        id: 'action-quality',
        title: 'Quality test action',
        description: 'Action for testing quality metrics',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'execution',
        expectedImpact: 0.7,
        difficulty: 0.5,
        implementationSteps: [
          { description: 'Quality step 1', status: 'pending' },
          { description: 'Quality step 2', status: 'pending' },
          { description: 'Quality step 3', status: 'pending' }
        ]
      };

      const result = await processor.processAction(action);

      expect(result.results.qualityMetrics).toBeDefined();
      const qualityMetrics = result.results.qualityMetrics as Record<string, number>;
      expect(qualityMetrics.completeness).toBeGreaterThan(0);
      expect(qualityMetrics.completeness).toBeLessThanOrEqual(1);
      expect(qualityMetrics.consistency).toBeGreaterThan(0);
      expect(qualityMetrics.consistency).toBeLessThanOrEqual(1);
      expect(qualityMetrics.reliability).toBeGreaterThan(0);
      expect(qualityMetrics.reliability).toBeLessThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('should handle validation errors gracefully', async () => {
      const invalidAction: ImprovementAction = {
        id: '', // Invalid empty ID
        title: 'Invalid action',
        description: 'Action with invalid data',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'tools',
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: []
      };

      await expect(processor.processAction(invalidAction)).rejects.toThrow(ActionProcessingError);
    });

    it('should handle already processing actions', async () => {
      const action: ImprovementAction = {
        id: 'action-duplicate',
        title: 'Duplicate action',
        description: 'Action that will be processed twice',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'tools',
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: [
          { description: 'Long step', status: 'pending' }
        ]
      };

      // Start first processing
      const firstProcessing = processor.processAction(action);

      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Try to process the same action again
      await expect(processor.processAction(action)).rejects.toThrow(ActionProcessingError);

      // Wait for first processing to complete
      await firstProcessing;
    });
  });
}); 