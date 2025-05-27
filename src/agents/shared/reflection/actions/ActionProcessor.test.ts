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
        targetArea: 'execution',
        expectedImpact: 0.8,
        difficulty: 0.6,
        implementationSteps: [
          { description: 'Analyze current error patterns', status: 'pending' },
          { description: 'Design error handling strategy', status: 'pending' },
          { description: 'Implement error recovery mechanisms', status: 'pending' }
        ]
      };

      const result = await processor.processAction(action);

      expect(result.success).toBe(true);
      expect(result.actionId).toBe(action.id);
      expect(result.results).toBeDefined();
      expect(result.nextSteps).toHaveLength(4); // 2 target area specific + 2 generic
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.metadata.processingTimestamp).toBeInstanceOf(Date);
    });

    it('should throw error for invalid action status', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Test action',
        description: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'suggested', // Invalid status for processing
        priority: 'medium',
        targetArea: 'tools',
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: []
      };

      await expect(processor.processAction(action)).rejects.toThrow(ActionProcessingError);
    });

    it('should throw error when capacity is exceeded', async () => {
      const smallProcessor = new ActionProcessor({ maxConcurrentActions: 1 });
      
      const action1: ImprovementAction = {
        id: 'action-1',
        title: 'Test action 1',
        description: 'Test description',
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

      const action2: ImprovementAction = {
        ...action1,
        id: 'action-2',
        title: 'Test action 2'
      };

      // Start first action (will be processing)
      const promise1 = smallProcessor.processAction(action1);

      // Second action should fail due to capacity
      await expect(smallProcessor.processAction(action2)).rejects.toThrow(ActionProcessingError);

      // Wait for first action to complete
      await promise1;
      await smallProcessor.clear();
    });

    it('should handle action without implementation steps', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Simple action',
        description: 'A simple action without specific steps',
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
      expect(result.results.step_1).toBeDefined();
    });
  });

  describe('trackProgress', () => {
    it('should track progress for an active action', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Test action',
        description: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'tools',
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: [
          { description: 'Step 1', status: 'pending' },
          { description: 'Step 2', status: 'pending' }
        ]
      };

      // Start processing
      const processPromise = processor.processAction(action);

      // Track progress while processing
      const progress = await processor.trackProgress(action.id);

      expect(progress.actionId).toBe(action.id);
      expect(progress.status).toBe('in_progress');
      expect(progress.totalSteps).toBe(2);
      expect(progress.estimatedCompletion).toBeInstanceOf(Date);

      // Wait for processing to complete
      await processPromise;
    });

    it('should throw error for non-existent action', async () => {
      await expect(processor.trackProgress('non-existent-id')).rejects.toThrow(ActionProcessingError);
    });
  });

  describe('assessImpact', () => {
    it('should assess impact for a completed action', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Test action',
        description: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'high',
        targetArea: 'planning',
        expectedImpact: 0.8,
        difficulty: 0.5,
        implementationSteps: [
          { description: 'Implement feature', status: 'pending' }
        ]
      };

      // Process action first
      await processor.processAction(action);

      // Assess impact
      const impact = await processor.assessImpact(action.id);

      expect(impact.actionId).toBe(action.id);
      expect(impact.overallImpact).toBeGreaterThan(0);
      expect(impact.impactAreas.performance).toBeDefined();
      expect(impact.impactAreas.quality).toBeDefined();
      expect(impact.impactAreas.efficiency).toBeDefined();
      expect(impact.impactAreas.userSatisfaction).toBeDefined();
      expect(impact.confidence).toBeGreaterThan(0);
      expect(impact.recommendations).toHaveLength(3);
    });

    it('should throw error for non-existent action', async () => {
      await expect(processor.assessImpact('non-existent-id')).rejects.toThrow(ActionProcessingError);
    });

    it('should throw error for failed action', async () => {
      // Create a failed result manually for testing
      const failedResult = {
        actionId: 'failed-action',
        success: false,
        results: {},
        nextSteps: [],
        executionTime: 1000,
        error: 'Test failure',
        metadata: {
          processingTimestamp: new Date(),
          executionContext: {}
        }
      };

      // Access private property for testing
      (processor as any).actionResults.set('failed-action', failedResult);

      await expect(processor.assessImpact('failed-action')).rejects.toThrow(ActionProcessingError);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report for completed action', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Test action',
        description: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'knowledge',
        expectedImpact: 0.6,
        difficulty: 0.4,
        implementationSteps: [
          { description: 'Research topic', status: 'pending' },
          { description: 'Update knowledge base', status: 'pending' }
        ]
      };

      // Process action
      await processor.processAction(action);

      // Generate report
      const report = await processor.generateReport(action.id);

      expect(report.actionId).toBe(action.id);
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.summary).toContain(action.id);
      expect(report.result).toBeDefined();
      expect(report.progress).toBeDefined();
      expect(report.impact).toBeDefined();
      expect(report.recommendations).toHaveLength(6); // 1 success + 1 efficiency + 4 next steps
      expect(report.metadata.reportVersion).toBe('1.0');
    });

    it('should generate report for failed action without impact', async () => {
      // Create a failed result manually for testing
      const failedResult = {
        actionId: 'failed-action',
        success: false,
        results: {},
        nextSteps: ['Retry action'],
        executionTime: 1000,
        error: 'Test failure',
        metadata: {
          processingTimestamp: new Date(),
          executionContext: {}
        }
      };

      (processor as any).actionResults.set('failed-action', failedResult);

      const report = await processor.generateReport('failed-action');

      expect(report.actionId).toBe('failed-action');
      expect(report.result.success).toBe(false);
      expect(report.impact).toBeUndefined();
      expect(report.recommendations).toContain('Analyze failure causes and update implementation strategy');
    });

    it('should throw error for non-existent action', async () => {
      await expect(processor.generateReport('non-existent-id')).rejects.toThrow(ActionProcessingError);
    });
  });

  describe('cancelAction', () => {
    it('should cancel an active action', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Long running action',
        description: 'An action that takes time to complete',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'low',
        targetArea: 'interaction',
        expectedImpact: 0.3,
        difficulty: 0.7,
        implementationSteps: [
          { description: 'Long step 1', status: 'pending' },
          { description: 'Long step 2', status: 'pending' },
          { description: 'Long step 3', status: 'pending' }
        ]
      };

      // Start processing
      const processPromise = processor.processAction(action);

      // Cancel the action
      const cancelled = await processor.cancelAction(action.id);

      expect(cancelled).toBe(true);

      // The process should throw an error due to cancellation
      await expect(processPromise).rejects.toThrow(ActionProcessingError);
    });

    it('should return false for non-active action', async () => {
      const cancelled = await processor.cancelAction('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', async () => {
      const stats = processor.getProcessingStats();

      expect(stats.activeActions).toBe(0);
      expect(stats.totalProcessed).toBe(0);
      expect(stats.totalProgress).toBe(0);
      expect(stats.totalImpactAssessments).toBe(0);
      expect(stats.config).toBeDefined();
      expect(stats.metrics).toBeDefined();
    });

    it('should update statistics after processing actions', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Test action',
        description: 'Test description',
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

      await processor.processAction(action);

      const stats = processor.getProcessingStats();
      expect(stats.totalProcessed).toBe(1);
      expect(stats.totalProgress).toBe(1);
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
      expect(stats.metrics).toBeUndefined();

      await customProcessor.clear();
    });
  });

  describe('target area specific next steps', () => {
    it('should generate tools-specific next steps', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Tool improvement',
        description: 'Improve tool performance',
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

      const result = await processor.processAction(action);

      expect(result.nextSteps).toContain('Monitor tool performance metrics');
      expect(result.nextSteps).toContain('Gather user feedback on tool improvements');
    });

    it('should generate planning-specific next steps', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Planning improvement',
        description: 'Improve planning efficiency',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'planning',
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: []
      };

      const result = await processor.processAction(action);

      expect(result.nextSteps).toContain('Evaluate planning efficiency improvements');
      expect(result.nextSteps).toContain('Update planning templates and strategies');
    });
  });

  describe('quality metrics calculation', () => {
    it('should calculate quality metrics for processed results', async () => {
      const action: ImprovementAction = {
        id: 'action-1',
        title: 'Quality test action',
        description: 'Test quality metrics calculation',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceInsightId: 'insight-123',
        status: 'accepted',
        priority: 'medium',
        targetArea: 'execution',
        expectedImpact: 0.5,
        difficulty: 0.3,
        implementationSteps: [
          { description: 'Step 1', status: 'pending' },
          { description: 'Step 2', status: 'pending' }
        ]
      };

      const result = await processor.processAction(action);

      expect(result.results.qualityMetrics).toBeDefined();
      const qualityMetrics = result.results.qualityMetrics as Record<string, number>;
      expect(qualityMetrics.completeness).toBeGreaterThan(0);
      expect(qualityMetrics.consistency).toBeGreaterThan(0);
      expect(qualityMetrics.reliability).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle validation errors gracefully', async () => {
      const invalidAction: ImprovementAction = {
        id: '', // Invalid ID
        title: 'Test action',
        description: 'Test description',
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
        id: 'action-1',
        title: 'Test action',
        description: 'Test description',
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
      const promise1 = processor.processAction(action);

      // Try to process same action again
      await expect(processor.processAction(action)).rejects.toThrow(ActionProcessingError);

      // Wait for first processing to complete
      await promise1;
    });
  });
}); 