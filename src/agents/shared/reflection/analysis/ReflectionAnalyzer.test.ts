/**
 * Reflection Analyzer Tests
 * 
 * Comprehensive test suite for the ReflectionAnalyzer component.
 */

import { ReflectionAnalyzer, ReflectionAnalysisError } from './ReflectionAnalyzer';
import { Reflection, ReflectionTrigger } from '../../base/managers/ReflectionManager.interface';

describe('ReflectionAnalyzer', () => {
  let analyzer: ReflectionAnalyzer;

  beforeEach(() => {
    analyzer = new ReflectionAnalyzer();
  });

  afterEach(async () => {
    await analyzer.clear();
  });

  describe('Constructor and Configuration', () => {
    it('should create analyzer with default configuration', () => {
      const defaultAnalyzer = new ReflectionAnalyzer();
      expect(defaultAnalyzer).toBeInstanceOf(ReflectionAnalyzer);
      
      const stats = defaultAnalyzer.getStats();
      expect(stats.analysisCapabilities).toEqual({
        qualityAssessment: true,
        insightExtraction: true,
        patternRecognition: true,
        effectivenessMeasurement: true,
        applicationAnalysis: true
      });
    });
  });

  describe('Quality Assessment', () => {
    it('should assess quality for a reflection', async () => {
      const reflection = createMockReflection();
      
      const assessment = await analyzer.assessQuality(reflection);
      
      expect(assessment).toBeDefined();
      expect(assessment.reflectionId).toBe(reflection.id);
      expect(assessment.score).toBeGreaterThan(0);
      expect(assessment.score).toBeLessThanOrEqual(10);
      expect(assessment.dimensions).toHaveLength(5);
      expect(assessment.strengths).toBeInstanceOf(Array);
      expect(assessment.weaknesses).toBeInstanceOf(Array);
      expect(assessment.suggestions).toBeInstanceOf(Array);
    });

    it('should validate quality dimensions structure', async () => {
      const reflection = createMockReflection();
      
      const assessment = await analyzer.assessQuality(reflection);
      
      assessment.dimensions.forEach(dimension => {
        expect(dimension).toHaveProperty('name');
        expect(dimension).toHaveProperty('score');
        expect(dimension).toHaveProperty('weight');
        expect(dimension).toHaveProperty('description');
        expect(dimension.score).toBeGreaterThan(0);
        expect(dimension.score).toBeLessThanOrEqual(10);
        expect(dimension.weight).toBeGreaterThan(0);
        expect(dimension.weight).toBeLessThanOrEqual(1);
      });
    });

    it('should cache quality assessments', async () => {
      const reflection = createMockReflection();
      
      const assessment1 = await analyzer.assessQuality(reflection);
      const assessment2 = await analyzer.assessQuality(reflection);
      
      expect(assessment1).toEqual(assessment2);
    });

    it('should handle errors in quality assessment gracefully', async () => {
      const reflection = createMockReflection();
      
      // Mock a method to throw an error
      const originalMethod = (analyzer as any).performQualityAssessment;
      (analyzer as any).performQualityAssessment = () => {
        throw new Error('Test error');
      };
      
      await expect(analyzer.assessQuality(reflection)).rejects.toThrow(ReflectionAnalysisError);
      
      // Restore original method
      (analyzer as any).performQualityAssessment = originalMethod;
    });
  });

  describe('Insight Extraction', () => {
    it('should extract insights from a reflection', async () => {
      const reflection = createMockReflection();
      
      const insights = await analyzer.extractInsights(reflection);
      
      expect(insights).toBeInstanceOf(Array);
      expect(insights.length).toBeGreaterThan(0);
      
      insights.forEach(insight => {
        expect(insight).toHaveProperty('id');
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('content');
        expect(insight).toHaveProperty('timestamp');
        expect(insight).toHaveProperty('reflectionId');
        expect(insight).toHaveProperty('confidence');
        expect(insight).toHaveProperty('metadata');
        expect(insight.reflectionId).toBe(reflection.id);
        expect(insight.confidence).toBeGreaterThan(0);
        expect(insight.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should validate insight metadata structure', async () => {
      const reflection = createMockReflection();
      
      const insights = await analyzer.extractInsights(reflection);
      
      insights.forEach(insight => {
        expect(insight.metadata).toHaveProperty('source');
        expect(insight.metadata).toHaveProperty('applicationStatus');
        expect(insight.metadata).toHaveProperty('category');
        expect(insight.metadata).toHaveProperty('relatedInsights');
        expect(insight.metadata.applicationStatus).toMatch(/^(pending|applied|rejected)$/);
        expect(insight.metadata.relatedInsights).toBeInstanceOf(Array);
      });
    });

    it('should cache insight extractions', async () => {
      const reflection = createMockReflection();
      
      const insights1 = await analyzer.extractInsights(reflection);
      const insights2 = await analyzer.extractInsights(reflection);
      
      expect(insights1).toEqual(insights2);
    });

    it('should handle errors in insight extraction gracefully', async () => {
      const reflection = createMockReflection();
      
      // Mock a method to throw an error
      const originalMethod = (analyzer as any).performInsightExtraction;
      (analyzer as any).performInsightExtraction = () => {
        throw new Error('Test error');
      };
      
      await expect(analyzer.extractInsights(reflection)).rejects.toThrow(ReflectionAnalysisError);
      
      // Restore original method
      (analyzer as any).performInsightExtraction = originalMethod;
    });
  });

  describe('Pattern Recognition', () => {
    it('should recognize patterns with multiple reflections', async () => {
      const reflections = [
        createMockReflection(),
        createMockReflection(),
        createMockReflection()
      ];
      
      const recognition = await analyzer.recognizePatterns(reflections);
      
      expect(recognition).toBeDefined();
      expect(recognition.patterns).toBeInstanceOf(Array);
      expect(recognition.confidence).toBeGreaterThanOrEqual(0);
      expect(recognition.confidence).toBeLessThanOrEqual(1);
      expect(recognition.insights).toBeInstanceOf(Array);
      expect(recognition.recommendations).toBeInstanceOf(Array);
    });

    it('should validate pattern structure', async () => {
      const reflections = [
        createMockReflection(),
        createMockReflection(),
        createMockReflection()
      ];
      
      const recognition = await analyzer.recognizePatterns(reflections);
      
      recognition.patterns.forEach(pattern => {
        expect(pattern).toHaveProperty('type');
        expect(pattern).toHaveProperty('frequency');
        expect(pattern).toHaveProperty('examples');
        expect(pattern).toHaveProperty('significance');
        expect(pattern).toHaveProperty('description');
        expect(pattern.examples).toBeInstanceOf(Array);
        expect(pattern.frequency).toBeGreaterThan(0);
        expect(pattern.significance).toBeGreaterThanOrEqual(0);
        expect(pattern.significance).toBeLessThanOrEqual(1);
      });
    });

    it('should handle empty reflection list gracefully', async () => {
      const recognition = await analyzer.recognizePatterns([]);
      
      expect(recognition.patterns).toHaveLength(0);
      expect(recognition.confidence).toBe(0);
      expect(recognition.insights).toHaveLength(0);
      expect(recognition.recommendations).toHaveLength(0);
    });

    it('should handle single reflection gracefully', async () => {
      const reflections = [createMockReflection()];
      
      const recognition = await analyzer.recognizePatterns(reflections);
      
      expect(recognition).toBeDefined();
      expect(recognition.patterns).toBeInstanceOf(Array);
    });

    it('should handle errors in pattern recognition gracefully', async () => {
      const reflections = [createMockReflection()];
      
      // Mock a method to throw an error
      const originalMethod = (analyzer as any).identifyReflectionPatterns;
      (analyzer as any).identifyReflectionPatterns = () => {
        throw new Error('Test error');
      };
      
      await expect(analyzer.recognizePatterns(reflections)).rejects.toThrow(ReflectionAnalysisError);
      
      // Restore original method
      (analyzer as any).identifyReflectionPatterns = originalMethod;
    });
  });

  describe('Effectiveness Measurement', () => {
    it('should measure effectiveness for existing reflection', async () => {
      const reflection = createMockReflection();
      analyzer.addReflection(reflection);
      
      const metrics = await analyzer.measureEffectiveness(reflection.id);
      
      expect(metrics).toBeDefined();
      expect(metrics.reflectionId).toBe(reflection.id);
      expect(metrics.insightsGenerated).toBeGreaterThanOrEqual(0);
      expect(metrics.actionsCreated).toBeGreaterThanOrEqual(0);
      expect(metrics.actionsCompleted).toBeGreaterThanOrEqual(0);
      expect(metrics.impactScore).toBeGreaterThan(0);
      expect(metrics.timeToImpact).toBeGreaterThan(0);
    });

    it('should cache effectiveness metrics', async () => {
      const reflection = createMockReflection();
      analyzer.addReflection(reflection);
      
      const metrics1 = await analyzer.measureEffectiveness(reflection.id);
      const metrics2 = await analyzer.measureEffectiveness(reflection.id);
      
      expect(metrics1).toEqual(metrics2);
    });

    it('should throw error for non-existent reflection', async () => {
      await expect(analyzer.measureEffectiveness('non-existent')).rejects.toThrow(ReflectionAnalysisError);
    });

    it('should handle errors in effectiveness measurement gracefully', async () => {
      const reflection = createMockReflection();
      analyzer.addReflection(reflection);
      
      // Mock a method to throw an error
      const originalMethod = (analyzer as any).calculateEffectivenessMetrics;
      (analyzer as any).calculateEffectivenessMetrics = () => {
        throw new Error('Test error');
      };
      
      await expect(analyzer.measureEffectiveness(reflection.id)).rejects.toThrow(ReflectionAnalysisError);
      
      // Restore original method
      (analyzer as any).calculateEffectivenessMetrics = originalMethod;
    });
  });

  describe('Application Analysis', () => {
    it('should analyze insight application', async () => {
      const insightId = 'test-insight-id';
      
      const analysis = await analyzer.analyzeInsightApplication(insightId);
      
      expect(analysis).toBeDefined();
      expect(analysis.insightId).toBe(insightId);
      expect(analysis.applicationRate).toBeGreaterThanOrEqual(0);
      expect(analysis.applicationRate).toBeLessThanOrEqual(1);
      expect(analysis.successRate).toBeGreaterThanOrEqual(0);
      expect(analysis.successRate).toBeLessThanOrEqual(1);
      expect(analysis.timeToApplication).toBeGreaterThan(0);
      expect(analysis.barriers).toBeInstanceOf(Array);
      expect(analysis.facilitators).toBeInstanceOf(Array);
    });

    it('should handle errors in application analysis gracefully', async () => {
      const insightId = 'test-insight-id';
      
      // Mock the internal method to throw an error
      const originalMethod = (analyzer as any).performApplicationAnalysis;
      (analyzer as any).performApplicationAnalysis = async () => {
        throw new Error('Test error');
      };
      
      await expect(analyzer.analyzeInsightApplication(insightId)).rejects.toThrow(ReflectionAnalysisError);
      
      // Restore original method
      (analyzer as any).performApplicationAnalysis = originalMethod;
    });
  });

  describe('Reflection Management', () => {
    it('should add and remove reflections', () => {
      const reflection = createMockReflection();
      
      analyzer.addReflection(reflection);
      let stats = analyzer.getStats();
      expect(stats.totalReflections).toBe(1);
      
      analyzer.removeReflection(reflection.id);
      stats = analyzer.getStats();
      expect(stats.totalReflections).toBe(0);
    });

    it('should clean up related data when removing reflection', async () => {
      const reflection = createMockReflection();
      analyzer.addReflection(reflection);
      
      // Generate some cached data
      await analyzer.assessQuality(reflection);
      await analyzer.extractInsights(reflection);
      await analyzer.measureEffectiveness(reflection.id);
      
      let stats = analyzer.getStats();
      expect(stats.qualityAssessments).toBe(1);
      expect(stats.insightExtractions).toBe(1);
      expect(stats.effectivenessMetrics).toBe(1);
      
      analyzer.removeReflection(reflection.id);
      
      stats = analyzer.getStats();
      expect(stats.qualityAssessments).toBe(0);
      expect(stats.insightExtractions).toBe(0);
      expect(stats.effectivenessMetrics).toBe(0);
    });
  });

  describe('Statistics and State Management', () => {
    it('should provide comprehensive statistics', () => {
      const stats = analyzer.getStats();
      
      expect(stats).toHaveProperty('totalReflections');
      expect(stats).toHaveProperty('qualityAssessments');
      expect(stats).toHaveProperty('insightExtractions');
      expect(stats).toHaveProperty('effectivenessMetrics');
      expect(stats).toHaveProperty('analysisCapabilities');
      
      expect(stats.analysisCapabilities).toHaveProperty('qualityAssessment');
      expect(stats.analysisCapabilities).toHaveProperty('insightExtraction');
      expect(stats.analysisCapabilities).toHaveProperty('patternRecognition');
      expect(stats.analysisCapabilities).toHaveProperty('effectivenessMeasurement');
      expect(stats.analysisCapabilities).toHaveProperty('applicationAnalysis');
    });

    it('should clear all data and reset state', async () => {
      const reflection = createMockReflection();
      analyzer.addReflection(reflection);
      
      // Generate some data
      await analyzer.assessQuality(reflection);
      await analyzer.extractInsights(reflection);
      await analyzer.measureEffectiveness(reflection.id);
      
      let stats = analyzer.getStats();
      expect(stats.totalReflections).toBeGreaterThan(0);
      
      await analyzer.clear();
      
      stats = analyzer.getStats();
      expect(stats.totalReflections).toBe(0);
      expect(stats.qualityAssessments).toBe(0);
      expect(stats.insightExtractions).toBe(0);
      expect(stats.effectivenessMetrics).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should provide helpful error context', async () => {
      try {
        await analyzer.measureEffectiveness('non-existent-id');
      } catch (error) {
        expect(error).toBeInstanceOf(ReflectionAnalysisError);
        expect((error as ReflectionAnalysisError).code).toBe('REFLECTION_NOT_FOUND');
        expect((error as ReflectionAnalysisError).context).toBeDefined();
        expect((error as ReflectionAnalysisError).recoverable).toBe(true);
        expect((error as ReflectionAnalysisError).suggestions).toBeInstanceOf(Array);
      }
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle concurrent operations', async () => {
      const reflection = createMockReflection();
      
      // Run multiple operations concurrently
      const promises = [
        analyzer.assessQuality(reflection),
        analyzer.extractInsights(reflection),
        analyzer.recognizePatterns([reflection])
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toBeDefined(); // quality assessment
      expect(results[1]).toBeDefined(); // insights
      expect(results[2]).toBeDefined(); // patterns
    });

    it('should handle reflections with minimal data', async () => {
      const minimalReflection: Reflection = {
        id: 'minimal-reflection',
        timestamp: new Date(),
        trigger: ReflectionTrigger.MANUAL,
        context: { content: 'Minimal content' },
        depth: 'light',
        insights: [],
        metrics: {}
      };
      
      const assessment = await analyzer.assessQuality(minimalReflection);
      const insights = await analyzer.extractInsights(minimalReflection);
      
      expect(assessment).toBeDefined();
      expect(insights).toBeInstanceOf(Array);
    });

    it('should handle large numbers of reflections', async () => {
      const reflections = Array.from({ length: 100 }, (_, i) => ({
        id: `reflection-${i}`,
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        trigger: ReflectionTrigger.PERIODIC,
        context: { content: `Reflection content ${i}` },
        depth: 'standard' as const,
        insights: [],
        metrics: {}
      }));
      
      const recognition = await analyzer.recognizePatterns(reflections);
      
      expect(recognition).toBeDefined();
      expect(recognition.patterns).toBeInstanceOf(Array);
    });
  });
});

// Helper function to create mock reflections
function createMockReflection(): Reflection {
  return {
    id: `reflection-${Date.now()}-${Math.random()}`,
    timestamp: new Date(),
    trigger: ReflectionTrigger.MANUAL,
    context: { content: 'This is a test reflection with meaningful content for analysis.' },
    depth: 'standard',
    insights: [],
    metrics: {}
  };
} 