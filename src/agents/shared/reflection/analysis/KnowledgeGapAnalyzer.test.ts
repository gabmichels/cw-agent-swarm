/**
 * Knowledge Gap Analyzer Tests
 * 
 * Comprehensive test suite for the KnowledgeGapAnalyzer component.
 */

import { KnowledgeGapAnalyzer, KnowledgeGapAnalysisError } from './KnowledgeGapAnalyzer';
import { KnowledgeGapAnalysisConfig } from '../interfaces/AnalysisInterfaces';

describe('KnowledgeGapAnalyzer', () => {
  let analyzer: KnowledgeGapAnalyzer;

  beforeEach(() => {
    analyzer = new KnowledgeGapAnalyzer();
  });

  afterEach(async () => {
    await analyzer.clear();
  });

  describe('Constructor and Configuration', () => {
    it('should create analyzer with default configuration', () => {
      const defaultAnalyzer = new KnowledgeGapAnalyzer();
      const stats = defaultAnalyzer.getStats();
      
      expect(stats.config).toEqual({
        enablePatternAnalysis: true,
        enableImpactAssessment: true,
        enableLearningPlanGeneration: true,
        enableGapPrioritization: true,
        maxGapsToAnalyze: 50,
        impactAssessmentDepth: 'standard',
        learningPlanComplexity: 'intermediate',
        prioritizationCriteria: ['impact', 'urgency', 'feasibility', 'resources']
      });
    });

    it('should create analyzer with custom configuration', () => {
      const config: KnowledgeGapAnalysisConfig = {
        enablePatternAnalysis: false,
        maxGapsToAnalyze: 25,
        impactAssessmentDepth: 'deep'
      };
      
      const customAnalyzer = new KnowledgeGapAnalyzer(config);
      const stats = customAnalyzer.getStats();
      
      expect(stats.config).toMatchObject(config);
      expect((stats.config as KnowledgeGapAnalysisConfig).enableImpactAssessment).toBe(true); // Default value
    });
  });

  describe('Gap Identification', () => {
    it('should identify gaps with default options', async () => {
      const gaps = await analyzer.identifyGaps();
      
      expect(Array.isArray(gaps)).toBe(true);
      gaps.forEach(gap => {
        expect(gap).toHaveProperty('id');
        expect(gap).toHaveProperty('description');
        expect(gap).toHaveProperty('identifiedAt');
        expect(gap).toHaveProperty('priority');
        expect(gap).toHaveProperty('impactLevel');
        expect(gap).toHaveProperty('status');
        expect(gap).toHaveProperty('domain');
        expect(gap).toHaveProperty('relatedReflectionIds');
        expect(typeof gap.description).toBe('string');
        expect(gap.identifiedAt).toBeInstanceOf(Date);
        expect(['low', 'medium', 'high', 'critical']).toContain(gap.priority);
        expect(gap.impactLevel).toBeGreaterThanOrEqual(0);
        expect(gap.impactLevel).toBeLessThanOrEqual(1);
        expect(['identified', 'planned', 'addressing', 'resolved', 'ignored']).toContain(gap.status);
      });
    });

    it('should identify gaps from specific sources', async () => {
      const gaps = await analyzer.identifyGaps({
        sources: ['conversations', 'documents']
      });
      
      expect(Array.isArray(gaps)).toBe(true);
      expect(gaps.length).toBeGreaterThan(0);
    });

    it('should respect maxGaps limit', async () => {
      const maxGaps = 2;
      const gaps = await analyzer.identifyGaps({ maxGaps });
      
      expect(gaps.length).toBeLessThanOrEqual(maxGaps);
    });

    it('should filter by minimum confidence', async () => {
      const minConfidence = 0.8;
      const gaps = await analyzer.identifyGaps({ minConfidence });
      
      gaps.forEach(gap => {
        expect(gap.impactLevel).toBeGreaterThanOrEqual(minConfidence);
      });
    });

    it('should filter by categories', async () => {
      const categories = ['technical', 'communication'];
      const gaps = await analyzer.identifyGaps({ categories });
      
      gaps.forEach(gap => {
        expect(categories).toContain(gap.domain);
      });
    });

    it('should exclude resolved gaps when requested', async () => {
      const gaps = await analyzer.identifyGaps({ excludeResolved: true });
      
      gaps.forEach(gap => {
        expect(gap.status).not.toBe('resolved');
      });
    });

    it('should validate identification options', async () => {
      const invalidTimeRange = {
        start: new Date(),
        end: new Date(Date.now() - 24 * 60 * 60 * 1000) // End before start
      };
      
      await expect(analyzer.identifyGaps({ timeRange: invalidTimeRange }))
        .rejects.toThrow(KnowledgeGapAnalysisError);
    });

    it('should validate maxGaps option', async () => {
      await expect(analyzer.identifyGaps({ maxGaps: -1 }))
        .rejects.toThrow(KnowledgeGapAnalysisError);
    });

    it('should validate minConfidence option', async () => {
      await expect(analyzer.identifyGaps({ minConfidence: 1.5 }))
        .rejects.toThrow(KnowledgeGapAnalysisError);
    });
  });

  describe('Impact Assessment', () => {
    let gapId: string;

    beforeEach(async () => {
      const gaps = await analyzer.identifyGaps({ maxGaps: 1 });
      gapId = gaps[0].id;
    });

    it('should assess impact for existing gap', async () => {
      const assessment = await analyzer.assessImpact(gapId);
      
      expect(assessment).toHaveProperty('gapId', gapId);
      expect(assessment).toHaveProperty('assessedAt');
      expect(assessment).toHaveProperty('impactLevel');
      expect(assessment).toHaveProperty('affectedAreas');
      expect(assessment).toHaveProperty('urgency');
      expect(assessment).toHaveProperty('estimatedCost');
      expect(assessment).toHaveProperty('riskFactors');
      expect(assessment).toHaveProperty('dependencies');
      expect(assessment).toHaveProperty('confidence');
      expect(assessment).toHaveProperty('methodology');
      
      expect(assessment.assessedAt).toBeInstanceOf(Date);
      expect(assessment.impactLevel).toBeGreaterThanOrEqual(1);
      expect(assessment.impactLevel).toBeLessThanOrEqual(10);
      expect(Array.isArray(assessment.affectedAreas)).toBe(true);
      expect(['low', 'medium', 'high', 'critical']).toContain(assessment.urgency);
      expect(typeof assessment.estimatedCost).toBe('number');
      expect(Array.isArray(assessment.riskFactors)).toBe(true);
      expect(Array.isArray(assessment.dependencies)).toBe(true);
      expect(assessment.confidence).toBeGreaterThanOrEqual(0);
      expect(assessment.confidence).toBeLessThanOrEqual(1);
    });

    it('should cache impact assessments', async () => {
      const assessment1 = await analyzer.assessImpact(gapId);
      const assessment2 = await analyzer.assessImpact(gapId);
      
      expect(assessment1.assessedAt).toEqual(assessment2.assessedAt);
    });

    it('should throw error for non-existent gap', async () => {
      await expect(analyzer.assessImpact('non-existent-id'))
        .rejects.toThrow(KnowledgeGapAnalysisError);
    });
  });

  describe('Learning Plan Generation', () => {
    let gapId: string;

    beforeEach(async () => {
      const gaps = await analyzer.identifyGaps({ maxGaps: 1 });
      gapId = gaps[0].id;
    });

    it('should generate learning plan for existing gap', async () => {
      const plan = await analyzer.generateLearningPlan(gapId);
      
      expect(plan).toHaveProperty('gapId', gapId);
      expect(plan).toHaveProperty('objectives');
      expect(plan).toHaveProperty('resources');
      expect(plan).toHaveProperty('timeline');
      expect(plan).toHaveProperty('assessments');
      
      expect(Array.isArray(plan.objectives)).toBe(true);
      expect(Array.isArray(plan.resources)).toBe(true);
      expect(plan.timeline).toHaveProperty('startDate');
      expect(plan.timeline).toHaveProperty('endDate');
      expect(Array.isArray(plan.assessments)).toBe(true);
    });

    it('should validate learning objectives structure', async () => {
      const plan = await analyzer.generateLearningPlan(gapId);
      
      plan.objectives.forEach(objective => {
        expect(typeof objective).toBe('string');
        expect(objective.length).toBeGreaterThan(0);
      });
    });

    it('should validate learning resources structure', async () => {
      const plan = await analyzer.generateLearningPlan(gapId);
      
      plan.resources.forEach(resource => {
        expect(resource).toHaveProperty('type');
        expect(resource).toHaveProperty('title');
        expect(resource).toHaveProperty('estimatedTime');
        expect(resource).toHaveProperty('difficulty');
        expect(['document', 'course', 'practice', 'mentoring']).toContain(resource.type);
        expect(typeof resource.title).toBe('string');
        expect(typeof resource.estimatedTime).toBe('number');
        expect(['beginner', 'intermediate', 'advanced']).toContain(resource.difficulty);
      });
    });

    it('should cache learning plans', async () => {
      const plan1 = await analyzer.generateLearningPlan(gapId);
      const plan2 = await analyzer.generateLearningPlan(gapId);
      
      expect(plan1).toEqual(plan2);
    });

    it('should throw error for non-existent gap', async () => {
      await expect(analyzer.generateLearningPlan('non-existent-id'))
        .rejects.toThrow(KnowledgeGapAnalysisError);
    });
  });

  describe('Pattern Analysis', () => {
    beforeEach(async () => {
      // Generate some gaps for pattern analysis
      await analyzer.identifyGaps({ maxGaps: 10 });
    });

    it('should analyze patterns with default configuration', async () => {
      const timeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      const analysis = await analyzer.analyzePatterns(timeRange);
      
      expect(analysis).toHaveProperty('analysisDate');
      expect(analysis).toHaveProperty('timeRange');
      expect(analysis).toHaveProperty('commonGaps');
      expect(analysis).toHaveProperty('gapCategories');
      expect(analysis).toHaveProperty('trends');
      expect(analysis).toHaveProperty('correlations');
      expect(analysis).toHaveProperty('recommendations');
      expect(analysis).toHaveProperty('confidence');
      
      expect(analysis.analysisDate).toBeInstanceOf(Date);
      expect(analysis.timeRange).toEqual(timeRange);
      expect(Array.isArray(analysis.commonGaps)).toBe(true);
      expect(typeof analysis.gapCategories).toBe('object');
      expect(Array.isArray(analysis.trends)).toBe(true);
      expect(Array.isArray(analysis.correlations)).toBe(true);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });

    it('should validate common gap patterns structure', async () => {
      const timeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      const analysis = await analyzer.analyzePatterns(timeRange);
      
      analysis.commonGaps.forEach(pattern => {
        expect(pattern).toHaveProperty('pattern');
        expect(pattern).toHaveProperty('frequency');
        expect(pattern).toHaveProperty('examples');
        expect(pattern).toHaveProperty('significance');
        expect(pattern).toHaveProperty('description');
        expect(pattern).toHaveProperty('suggestedActions');
        expect(typeof pattern.pattern).toBe('string');
        expect(typeof pattern.frequency).toBe('number');
        expect(Array.isArray(pattern.examples)).toBe(true);
        expect(typeof pattern.significance).toBe('number');
        expect(typeof pattern.description).toBe('string');
        expect(Array.isArray(pattern.suggestedActions)).toBe(true);
      });
    });

    it('should validate trend analysis structure', async () => {
      const timeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      const analysis = await analyzer.analyzePatterns(timeRange);
      
      analysis.trends.forEach(trend => {
        expect(trend).toHaveProperty('metric');
        expect(trend).toHaveProperty('direction');
        expect(trend).toHaveProperty('strength');
        expect(trend).toHaveProperty('confidence');
        expect(trend).toHaveProperty('timeRange');
        expect(typeof trend.metric).toBe('string');
        expect(['increasing', 'decreasing', 'stable']).toContain(trend.direction);
        expect(typeof trend.strength).toBe('number');
        expect(typeof trend.confidence).toBe('number');
        expect(trend.timeRange).toEqual(timeRange);
      });
    });

    it('should validate correlation analysis structure', async () => {
      const timeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      const analysis = await analyzer.analyzePatterns(timeRange);
      
      analysis.correlations.forEach(correlation => {
        expect(correlation).toHaveProperty('gap1');
        expect(correlation).toHaveProperty('gap2');
        expect(correlation).toHaveProperty('correlation');
        expect(correlation).toHaveProperty('significance');
        expect(correlation).toHaveProperty('description');
        expect(correlation).toHaveProperty('implications');
        expect(typeof correlation.gap1).toBe('string');
        expect(typeof correlation.gap2).toBe('string');
        expect(typeof correlation.correlation).toBe('number');
        expect(typeof correlation.significance).toBe('number');
        expect(typeof correlation.description).toBe('string');
        expect(Array.isArray(correlation.implications)).toBe(true);
      });
    });

    it('should handle empty time range gracefully', async () => {
      const timeRange = {
        start: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future start
        end: new Date(Date.now() + 48 * 60 * 60 * 1000)    // Future end
      };
      
      const analysis = await analyzer.analyzePatterns(timeRange);
      
      expect(analysis.commonGaps).toHaveLength(0);
      expect(Object.keys(analysis.gapCategories)).toHaveLength(0);
      expect(analysis.trends).toHaveLength(0);
      expect(analysis.correlations).toHaveLength(0);
      expect(analysis.confidence).toBe(0);
    });

    it('should handle disabled pattern analysis', async () => {
      const disabledAnalyzer = new KnowledgeGapAnalyzer({
        enablePatternAnalysis: false
      });
      
      const timeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      const analysis = await disabledAnalyzer.analyzePatterns(timeRange);
      
      expect(analysis.commonGaps).toHaveLength(0);
      expect(Object.keys(analysis.gapCategories)).toHaveLength(0);
      expect(analysis.trends).toHaveLength(0);
      expect(analysis.correlations).toHaveLength(0);
      expect(analysis.confidence).toBe(0);
    });
  });

  describe('Progress Tracking', () => {
    let gapId: string;

    beforeEach(async () => {
      const gaps = await analyzer.identifyGaps({ maxGaps: 1 });
      gapId = gaps[0].id;
    });

    it('should track progress for existing gap', async () => {
      const progress = await analyzer.trackProgress(gapId);
      
      expect(progress).toHaveProperty('gapId', gapId);
      expect(progress).toHaveProperty('progress');
      expect(progress).toHaveProperty('milestones');
      expect(progress).toHaveProperty('estimatedCompletion');
      expect(progress).toHaveProperty('blockers');
      expect(progress).toHaveProperty('resources');
      expect(progress).toHaveProperty('lastUpdated');
      expect(progress).toHaveProperty('confidence');
      
      expect(typeof progress.progress).toBe('number');
      expect(progress.progress).toBeGreaterThanOrEqual(0);
      expect(progress.progress).toBeLessThanOrEqual(100);
      expect(Array.isArray(progress.milestones)).toBe(true);
      expect(progress.estimatedCompletion).toBeInstanceOf(Date);
      expect(Array.isArray(progress.blockers)).toBe(true);
      expect(Array.isArray(progress.resources)).toBe(true);
      expect(progress.lastUpdated).toBeInstanceOf(Date);
      expect(progress.confidence).toBeGreaterThanOrEqual(0);
      expect(progress.confidence).toBeLessThanOrEqual(1);
    });

    it('should validate milestone structure', async () => {
      const progress = await analyzer.trackProgress(gapId);
      
      progress.milestones.forEach(milestone => {
        expect(milestone).toHaveProperty('id');
        expect(milestone).toHaveProperty('description');
        expect(milestone).toHaveProperty('completed');
        expect(milestone).toHaveProperty('dueDate');
        expect(typeof milestone.id).toBe('string');
        expect(typeof milestone.description).toBe('string');
        expect(typeof milestone.completed).toBe('boolean');
        expect(milestone.dueDate).toBeInstanceOf(Date);
      });
    });

    it('should validate blocker structure', async () => {
      const progress = await analyzer.trackProgress(gapId);
      
      progress.blockers.forEach(blocker => {
        expect(blocker).toHaveProperty('id');
        expect(blocker).toHaveProperty('description');
        expect(blocker).toHaveProperty('severity');
        expect(blocker).toHaveProperty('identifiedAt');
        expect(blocker).toHaveProperty('category');
        expect(blocker).toHaveProperty('suggestedResolution');
        expect(blocker).toHaveProperty('estimatedResolutionTime');
        expect(typeof blocker.id).toBe('string');
        expect(typeof blocker.description).toBe('string');
        expect(['low', 'medium', 'high', 'critical']).toContain(blocker.severity);
        expect(blocker.identifiedAt).toBeInstanceOf(Date);
        expect(typeof blocker.category).toBe('string');
        expect(typeof blocker.suggestedResolution).toBe('string');
        expect(typeof blocker.estimatedResolutionTime).toBe('number');
      });
    });

    it('should validate resource structure', async () => {
      const progress = await analyzer.trackProgress(gapId);
      
      progress.resources.forEach(resource => {
        expect(resource).toHaveProperty('type');
        expect(resource).toHaveProperty('title');
        expect(resource).toHaveProperty('estimatedTime');
        expect(resource).toHaveProperty('difficulty');
        expect(resource).toHaveProperty('cost');
        expect(resource).toHaveProperty('availability');
        expect(resource).toHaveProperty('effectiveness');
        expect(['document', 'course', 'practice', 'mentoring', 'tool', 'expert']).toContain(resource.type);
        expect(typeof resource.title).toBe('string');
        expect(typeof resource.estimatedTime).toBe('number');
        expect(['beginner', 'intermediate', 'advanced']).toContain(resource.difficulty);
        expect(typeof resource.cost).toBe('number');
        expect(['immediate', 'scheduled', 'on-demand']).toContain(resource.availability);
        expect(typeof resource.effectiveness).toBe('number');
      });
    });

    it('should throw error for non-existent gap', async () => {
      await expect(analyzer.trackProgress('non-existent-id'))
        .rejects.toThrow(KnowledgeGapAnalysisError);
    });
  });

  describe('Statistics and State Management', () => {
    it('should provide comprehensive statistics', async () => {
      // Generate some data first
      await analyzer.identifyGaps({ maxGaps: 5 });
      
      const stats = analyzer.getStats();
      
      expect(stats).toHaveProperty('totalGaps');
      expect(stats).toHaveProperty('statusDistribution');
      expect(stats).toHaveProperty('priorityDistribution');
      expect(stats).toHaveProperty('impactAssessments');
      expect(stats).toHaveProperty('learningPlans');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('analysisCapabilities');
      
      expect(typeof stats.totalGaps).toBe('number');
      expect(typeof stats.statusDistribution).toBe('object');
      expect(typeof stats.priorityDistribution).toBe('object');
      expect(typeof stats.impactAssessments).toBe('number');
      expect(typeof stats.learningPlans).toBe('number');
      expect(typeof stats.cacheSize).toBe('number');
      expect(typeof stats.config).toBe('object');
      expect(typeof stats.analysisCapabilities).toBe('object');
    });

    it('should track status distribution correctly', async () => {
      await analyzer.identifyGaps({ maxGaps: 3 });
      
      const stats = analyzer.getStats();
      const statusDistribution = stats.statusDistribution as Record<string, number>;
      
      expect(statusDistribution.identified).toBeGreaterThan(0);
      
      // Verify all counts add up to total gaps
      const totalFromDistribution = Object.values(statusDistribution).reduce((sum, count) => sum + count, 0);
      expect(totalFromDistribution).toBe(stats.totalGaps);
    });

    it('should track priority distribution correctly', async () => {
      await analyzer.identifyGaps({ maxGaps: 3 });
      
      const stats = analyzer.getStats();
      const priorityDistribution = stats.priorityDistribution as Record<string, number>;
      
      // Should have at least one priority level
      expect(Object.keys(priorityDistribution).length).toBeGreaterThan(0);
      
      // Verify all counts add up to total gaps
      const totalFromDistribution = Object.values(priorityDistribution).reduce((sum, count) => sum + count, 0);
      expect(totalFromDistribution).toBe(stats.totalGaps);
    });

    it('should clear all data and reset state', async () => {
      // Generate some data
      const gaps = await analyzer.identifyGaps({ maxGaps: 2 });
      await analyzer.assessImpact(gaps[0].id);
      await analyzer.generateLearningPlan(gaps[0].id);
      
      let stats = analyzer.getStats();
      expect(stats.totalGaps).toBeGreaterThan(0);
      expect(stats.impactAssessments).toBeGreaterThan(0);
      expect(stats.learningPlans).toBeGreaterThan(0);
      
      await analyzer.clear();
      
      stats = analyzer.getStats();
      expect(stats.totalGaps).toBe(0);
      expect(stats.impactAssessments).toBe(0);
      expect(stats.learningPlans).toBe(0);
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in gap identification gracefully', async () => {
      // Mock a method to throw an error
      const originalMethod = (analyzer as any).validateIdentificationOptions;
      (analyzer as any).validateIdentificationOptions = () => {
        throw new Error('Test error');
      };
      
      await expect(analyzer.identifyGaps()).rejects.toThrow(KnowledgeGapAnalysisError);
      
      // Restore original method
      (analyzer as any).validateIdentificationOptions = originalMethod;
    });

    it('should handle errors in impact assessment gracefully', async () => {
      const gaps = await analyzer.identifyGaps({ maxGaps: 1 });
      const gapId = gaps[0].id;
      
      // Mock a method to throw an error
      const originalMethod = (analyzer as any).performImpactAssessment;
      (analyzer as any).performImpactAssessment = () => {
        throw new Error('Test error');
      };
      
      await expect(analyzer.assessImpact(gapId)).rejects.toThrow(KnowledgeGapAnalysisError);
      
      // Restore original method
      (analyzer as any).performImpactAssessment = originalMethod;
    });

    it('should handle errors in learning plan generation gracefully', async () => {
      const gaps = await analyzer.identifyGaps({ maxGaps: 1 });
      const gapId = gaps[0].id;
      
      // Mock a method to throw an error
      const originalMethod = (analyzer as any).createLearningPlan;
      (analyzer as any).createLearningPlan = () => {
        throw new Error('Test error');
      };
      
      await expect(analyzer.generateLearningPlan(gapId)).rejects.toThrow(KnowledgeGapAnalysisError);
      
      // Restore original method
      (analyzer as any).createLearningPlan = originalMethod;
    });

    it('should handle errors in pattern analysis gracefully', async () => {
      // Generate some gaps first to ensure the method gets called
      await analyzer.identifyGaps({ maxGaps: 5 });
      
      const timeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      // Mock a method to throw an error
      const originalMethod = (analyzer as any).identifyCommonGapPatterns;
      (analyzer as any).identifyCommonGapPatterns = () => {
        throw new Error('Test error');
      };
      
      await expect(analyzer.analyzePatterns(timeRange)).rejects.toThrow(KnowledgeGapAnalysisError);
      
      // Restore original method
      (analyzer as any).identifyCommonGapPatterns = originalMethod;
    });

    it('should provide helpful error context', async () => {
      try {
        await analyzer.identifyGaps({
          timeRange: {
            start: new Date(),
            end: new Date(Date.now() - 1000)
          }
        });
      } catch (error) {
        expect(error).toBeInstanceOf(KnowledgeGapAnalysisError);
        expect((error as KnowledgeGapAnalysisError).code).toBe('GAP_IDENTIFICATION_FAILED');
        expect((error as KnowledgeGapAnalysisError).context).toBeDefined();
        expect((error as KnowledgeGapAnalysisError).recoverable).toBe(true);
        expect((error as KnowledgeGapAnalysisError).suggestions).toBeInstanceOf(Array);
      }
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle zero gaps gracefully', async () => {
      // Clear any existing gaps
      await analyzer.clear();
      
      const timeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      const analysis = await analyzer.analyzePatterns(timeRange);
      expect(analysis.commonGaps).toHaveLength(0);
      expect(analysis.confidence).toBe(0);
    });

    it('should handle very large gap collections', async () => {
      // This test verifies the system can handle the maximum configured gaps
      const maxGaps = 50;
      const gaps = await analyzer.identifyGaps({ maxGaps });
      
      expect(gaps.length).toBeLessThanOrEqual(maxGaps);
      
      const stats = analyzer.getStats();
      expect(stats.totalGaps).toBeLessThanOrEqual(maxGaps);
    });

    it('should handle gaps with extreme impact levels', async () => {
      // Test with minimum confidence
      const gaps = await analyzer.identifyGaps({ minConfidence: 0.0 });
      expect(gaps.length).toBeGreaterThanOrEqual(0);
      
      // Test with maximum confidence
      const highConfidenceGaps = await analyzer.identifyGaps({ minConfidence: 1.0 });
      expect(highConfidenceGaps.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle concurrent operations', async () => {
      // Test concurrent gap identification
      const promises = [
        analyzer.identifyGaps({ maxGaps: 2 }),
        analyzer.identifyGaps({ maxGaps: 2 }),
        analyzer.identifyGaps({ maxGaps: 2 })
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach(gaps => {
        expect(Array.isArray(gaps)).toBe(true);
        expect(gaps.length).toBeLessThanOrEqual(2);
      });
    });

    it('should handle invalid source types gracefully', async () => {
      // The analyzer should handle unknown sources by skipping them
      const gaps = await analyzer.identifyGaps({
        sources: ['unknown_source' as any, 'conversations']
      });
      
      expect(Array.isArray(gaps)).toBe(true);
    });
  });
}); 