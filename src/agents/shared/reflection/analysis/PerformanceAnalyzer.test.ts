/**
 * Performance Analyzer Tests
 * 
 * Comprehensive test suite for the PerformanceAnalyzer component.
 */

import { PerformanceAnalyzer, PerformanceAnalysisError } from './PerformanceAnalyzer';
import { PerformanceAnalysisConfig } from '../interfaces/AnalysisInterfaces';

describe('PerformanceAnalyzer', () => {
  let analyzer: PerformanceAnalyzer;

  beforeEach(() => {
    analyzer = new PerformanceAnalyzer();
  });

  afterEach(async () => {
    await analyzer.clear();
  });

  describe('Constructor and Configuration', () => {
    it('should create analyzer with default configuration', () => {
      const defaultAnalyzer = new PerformanceAnalyzer();
      const stats = defaultAnalyzer.getStats();
      
      expect(stats.config).toEqual({
        enableTrendAnalysis: true,
        enableAnomalyDetection: true,
        enableBenchmarking: true,
        enableOptimizationSuggestions: true,
        trendAnalysisWindow: 30,
        anomalyThreshold: 2.0,
        benchmarkUpdateInterval: 24,
        maxOptimizationSuggestions: 10
      });
    });

    it('should create analyzer with custom configuration', () => {
      const config: PerformanceAnalysisConfig = {
        enableTrendAnalysis: false,
        anomalyThreshold: 3.0,
        maxOptimizationSuggestions: 5
      };
      
      const customAnalyzer = new PerformanceAnalyzer(config);
      const stats = customAnalyzer.getStats();
      
      expect(stats.config).toMatchObject(config);
      expect((stats.config as PerformanceAnalysisConfig).enableBenchmarking).toBe(true); // Default value
    });
  });

  describe('Metrics Collection', () => {
    it('should collect basic metrics with default options', async () => {
      const metrics = await analyzer.collectMetrics();
      
      expect(metrics).toHaveProperty('period');
      expect(metrics).toHaveProperty('metrics');
      expect(metrics.period).toHaveProperty('start');
      expect(metrics.period).toHaveProperty('end');
      expect(typeof metrics.metrics).toBe('object');
    });

    it('should collect metrics with custom time range', async () => {
      const timeRange = {
        start: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        end: new Date()
      };
      
      const metrics = await analyzer.collectMetrics({ timeRange });
      
      expect(metrics.period.start).toEqual(timeRange.start);
      expect(metrics.period.end).toEqual(timeRange.end);
    });

    it('should validate collection options', async () => {
      const invalidTimeRange = {
        start: new Date(),
        end: new Date(Date.now() - 24 * 60 * 60 * 1000) // End before start
      };
      
      await expect(analyzer.collectMetrics({ timeRange: invalidTimeRange }))
        .rejects.toThrow(PerformanceAnalysisError);
    });

    it('should validate granularity option', async () => {
      await expect(analyzer.collectMetrics({ granularity: 'invalid' as any }))
        .rejects.toThrow(PerformanceAnalysisError);
    });

    it('should validate aggregation option', async () => {
      await expect(analyzer.collectMetrics({ aggregation: 'invalid' as any }))
        .rejects.toThrow(PerformanceAnalysisError);
    });

    it('should handle different aggregation methods', async () => {
      // Add some test data first
      const testMetrics = { testMetric: 10 };
      (analyzer as any).storeMetricsCollection({
        timestamp: new Date(),
        metrics: testMetrics,
        context: {},
        source: 'test'
      });

      const sumMetrics = await analyzer.collectMetrics({ aggregation: 'sum' });
      const avgMetrics = await analyzer.collectMetrics({ aggregation: 'average' });
      const minMetrics = await analyzer.collectMetrics({ aggregation: 'min' });
      const maxMetrics = await analyzer.collectMetrics({ aggregation: 'max' });
      
      expect(sumMetrics.metrics).toBeDefined();
      expect(avgMetrics.metrics).toBeDefined();
      expect(minMetrics.metrics).toBeDefined();
      expect(maxMetrics.metrics).toBeDefined();
    });
  });

  describe('Performance Analysis', () => {
    it('should analyze performance with default time range', async () => {
      const analysis = await analyzer.analyzePerformance();
      
      expect(analysis).toHaveProperty('summary');
      expect(analysis).toHaveProperty('score');
      expect(analysis).toHaveProperty('trends');
      expect(analysis).toHaveProperty('anomalies');
      expect(analysis).toHaveProperty('recommendations');
      expect(typeof analysis.summary).toBe('string');
      expect(typeof analysis.score).toBe('number');
      expect(Array.isArray(analysis.trends)).toBe(true);
      expect(Array.isArray(analysis.anomalies)).toBe(true);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    it('should analyze performance with custom time range', async () => {
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const toDate = new Date();
      
      const analysis = await analyzer.analyzePerformance(fromDate, toDate);
      
      expect(analysis.summary).toContain('Performance is');
      expect(analysis.score).toBeGreaterThanOrEqual(0);
      expect(analysis.score).toBeLessThanOrEqual(10);
    });

    it('should cache analysis results', async () => {
      const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const toDate = new Date();
      
      const analysis1 = await analyzer.analyzePerformance(fromDate, toDate);
      const analysis2 = await analyzer.analyzePerformance(fromDate, toDate);
      
      expect(analysis1).toEqual(analysis2);
    });

    it('should handle analysis with disabled features', async () => {
      const configuredAnalyzer = new PerformanceAnalyzer({
        enableTrendAnalysis: false,
        enableAnomalyDetection: false,
        enableOptimizationSuggestions: false
      });
      
      const analysis = await configuredAnalyzer.analyzePerformance();
      
      expect(analysis.trends).toHaveLength(0);
      expect(analysis.anomalies).toHaveLength(0);
      expect(analysis.recommendations).toHaveLength(0);
    });
  });

  describe('Trend Analysis', () => {
    beforeEach(() => {
      // Add test data for trend analysis
      const baseTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      for (let i = 0; i < 10; i++) {
        (analyzer as any).storeMetricsCollection({
          timestamp: new Date(baseTime + i * 24 * 60 * 60 * 1000),
          metrics: { testMetric: 10 + i * 2 }, // Increasing trend
          context: {},
          source: 'test'
        });
      }
    });

    it('should identify increasing trends', async () => {
      const timeRange = {
        start: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      const trend = await analyzer.identifyTrends('testMetric', timeRange);
      
      expect(trend.metric).toBe('testMetric');
      expect(trend.direction).toBe('increasing');
      expect(trend.strength).toBeGreaterThan(0);
      expect(trend.confidence).toBeGreaterThan(0);
      expect(trend.timeRange).toEqual(timeRange);
    });

    it('should handle insufficient data for trend analysis', async () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      const trend = await analyzer.identifyTrends('nonexistentMetric', timeRange);
      
      expect(trend.direction).toBe('stable');
      expect(trend.strength).toBe(0);
      expect(trend.confidence).toBe(0);
    });

    it('should detect stable trends', async () => {
      // Add stable data
      const baseTime = Date.now() - 5 * 24 * 60 * 60 * 1000;
      for (let i = 0; i < 5; i++) {
        (analyzer as any).storeMetricsCollection({
          timestamp: new Date(baseTime + i * 24 * 60 * 60 * 1000),
          metrics: { stableMetric: 50 }, // Stable value
          context: {},
          source: 'test'
        });
      }

      const timeRange = {
        start: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      const trend = await analyzer.identifyTrends('stableMetric', timeRange);
      
      expect(trend.direction).toBe('stable');
    });
  });

  describe('Benchmark Generation', () => {
    it('should generate benchmarks', async () => {
      // Add historical data
      const baseTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
      for (let i = 0; i < 30; i++) {
        (analyzer as any).storeMetricsCollection({
          timestamp: new Date(baseTime + i * 24 * 60 * 60 * 1000),
          metrics: { performanceMetric: 100 + Math.random() * 20 },
          context: {},
          source: 'test'
        });
      }

      const benchmarks = await analyzer.generateBenchmarks();
      
      expect(benchmarks).toHaveProperty('baseline');
      expect(benchmarks).toHaveProperty('targets');
      expect(benchmarks).toHaveProperty('industry');
      expect(benchmarks).toHaveProperty('historical');
      expect(benchmarks).toHaveProperty('lastUpdated');
      expect(benchmarks).toHaveProperty('confidence');
      expect(benchmarks.lastUpdated).toBeInstanceOf(Date);
    });

    it('should cache benchmarks', async () => {
      const benchmarks1 = await analyzer.generateBenchmarks();
      const benchmarks2 = await analyzer.generateBenchmarks();
      
      expect(benchmarks1.lastUpdated).toEqual(benchmarks2.lastUpdated);
    });

    it('should update benchmarks after interval', async () => {
      const shortIntervalAnalyzer = new PerformanceAnalyzer({
        benchmarkUpdateInterval: 0.001 // Very short interval for testing
      });
      
      const benchmarks1 = await shortIntervalAnalyzer.generateBenchmarks();
      
      // Wait longer to ensure interval has passed
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const benchmarks2 = await shortIntervalAnalyzer.generateBenchmarks();
      
      expect(benchmarks2.lastUpdated.getTime()).toBeGreaterThanOrEqual(benchmarks1.lastUpdated.getTime());
    });
  });

  describe('Optimization Suggestions', () => {
    it('should generate optimization suggestions', async () => {
      const suggestions = await analyzer.suggestOptimizations();
      
      expect(Array.isArray(suggestions)).toBe(true);
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('id');
        expect(suggestion).toHaveProperty('area');
        expect(suggestion).toHaveProperty('description');
        expect(suggestion).toHaveProperty('expectedImprovement');
        expect(suggestion).toHaveProperty('effort');
        expect(suggestion).toHaveProperty('priority');
        expect(suggestion).toHaveProperty('implementationSteps');
        expect(suggestion).toHaveProperty('estimatedTimeToImpact');
        expect(suggestion).toHaveProperty('confidence');
        expect(suggestion).toHaveProperty('category');
      });
    });

    it('should limit suggestions based on configuration', async () => {
      const limitedAnalyzer = new PerformanceAnalyzer({
        maxOptimizationSuggestions: 3
      });
      
      const suggestions = await limitedAnalyzer.suggestOptimizations();
      
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should prioritize suggestions correctly', async () => {
      const suggestions = await analyzer.suggestOptimizations();
      
      if (suggestions.length > 1) {
        for (let i = 1; i < suggestions.length; i++) {
          expect(suggestions[i].priority).toBeLessThanOrEqual(suggestions[i - 1].priority);
        }
      }
    });
  });

  describe('Performance Comparison', () => {
    it('should compare performance between periods', async () => {
      const baseline = {
        period: {
          start: new Date(Date.now() - 48 * 60 * 60 * 1000),
          end: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        metrics: { metric1: 100, metric2: 200 }
      };
      
      const current = {
        period: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date()
        },
        metrics: { metric1: 120, metric2: 180 }
      };
      
      const comparison = await analyzer.comparePerformance(baseline, current);
      
      expect(comparison).toHaveProperty('timeRange');
      expect(comparison).toHaveProperty('improvements');
      expect(comparison).toHaveProperty('regressions');
      expect(comparison).toHaveProperty('summary');
      expect(comparison).toHaveProperty('overallScore');
      expect(comparison).toHaveProperty('significantChanges');
      
      expect(comparison.improvements.metric1).toBeCloseTo(0.2); // 20% improvement
      expect(comparison.regressions.metric2).toBeCloseTo(0.1); // 10% regression
      expect(typeof comparison.summary).toBe('string');
      expect(comparison.overallScore).toBeGreaterThanOrEqual(0);
      expect(comparison.overallScore).toBeLessThanOrEqual(10);
    });

    it('should handle metrics with no baseline', async () => {
      const baseline = {
        period: { start: new Date(), end: new Date() },
        metrics: { metric1: 100 }
      };
      
      const current = {
        period: { start: new Date(), end: new Date() },
        metrics: { metric1: 120, metric2: 50 } // metric2 is new
      };
      
      const comparison = await analyzer.comparePerformance(baseline, current);
      
      expect(comparison.improvements.metric1).toBeCloseTo(0.2);
      expect(comparison.improvements.metric2).toBeUndefined();
      expect(comparison.regressions.metric2).toBeUndefined();
    });

    it('should identify significant changes', async () => {
      const baseline = {
        period: { start: new Date(), end: new Date() },
        metrics: { metric1: 100 }
      };
      
      const current = {
        period: { start: new Date(), end: new Date() },
        metrics: { metric1: 160 } // 60% improvement - should be significant
      };
      
      const comparison = await analyzer.comparePerformance(baseline, current);
      
      expect(comparison.significantChanges.length).toBeGreaterThan(0);
      expect(comparison.significantChanges[0].significance).toBe('high');
    });
  });

  describe('Statistics and State Management', () => {
    it('should provide comprehensive statistics', () => {
      const stats = analyzer.getStats();
      
      expect(stats).toHaveProperty('metricsHistorySize');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('lastBenchmarkUpdate');
      expect(stats).toHaveProperty('benchmarksAvailable');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('analysisCapabilities');
      
      expect(typeof stats.metricsHistorySize).toBe('number');
      expect(typeof stats.cacheSize).toBe('number');
      expect(typeof stats.benchmarksAvailable).toBe('boolean');
      expect(typeof stats.config).toBe('object');
      expect(typeof stats.analysisCapabilities).toBe('object');
    });

    it('should clear all data and reset state', async () => {
      // Add some data
      (analyzer as any).storeMetricsCollection({
        timestamp: new Date(),
        metrics: { testMetric: 100 },
        context: {},
        source: 'test'
      });
      
      await analyzer.generateBenchmarks();
      
      let stats = analyzer.getStats();
      expect(stats.metricsHistorySize).toBeGreaterThan(0);
      expect(stats.benchmarksAvailable).toBe(true);
      
      await analyzer.clear();
      
      stats = analyzer.getStats();
      expect(stats.metricsHistorySize).toBe(0);
      expect(stats.cacheSize).toBe(0);
      expect(stats.benchmarksAvailable).toBe(false);
      expect(stats.lastBenchmarkUpdate).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in metrics collection gracefully', async () => {
      // Mock a method to throw an error
      const originalMethod = (analyzer as any).validateCollectionOptions;
      (analyzer as any).validateCollectionOptions = () => {
        throw new Error('Test error');
      };
      
      await expect(analyzer.collectMetrics()).rejects.toThrow(PerformanceAnalysisError);
      
      // Restore original method
      (analyzer as any).validateCollectionOptions = originalMethod;
    });

    it('should handle errors in performance analysis gracefully', async () => {
      // Mock a method to throw an error
      const originalMethod = (analyzer as any).collectMetrics;
      (analyzer as any).collectMetrics = () => {
        throw new Error('Test error');
      };
      
      await expect(analyzer.analyzePerformance()).rejects.toThrow(PerformanceAnalysisError);
      
      // Restore original method
      (analyzer as any).collectMetrics = originalMethod;
    });

    it('should provide helpful error context', async () => {
      try {
        await analyzer.collectMetrics({
          timeRange: {
            start: new Date(),
            end: new Date(Date.now() - 1000)
          }
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PerformanceAnalysisError);
        expect((error as PerformanceAnalysisError).code).toBe('INVALID_TIME_RANGE');
        expect((error as PerformanceAnalysisError).context).toBeDefined();
        expect((error as PerformanceAnalysisError).recoverable).toBe(true);
        expect((error as PerformanceAnalysisError).suggestions).toBeInstanceOf(Array);
      }
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty metrics history', async () => {
      const metrics = await analyzer.collectMetrics();
      expect(metrics.metrics).toEqual({});
    });

    it('should handle very large metrics history', async () => {
      // Add many metrics to test memory management
      for (let i = 0; i < 1500; i++) {
        (analyzer as any).storeMetricsCollection({
          timestamp: new Date(Date.now() - i * 1000),
          metrics: { testMetric: i },
          context: {},
          source: 'test'
        });
      }
      
      const stats = analyzer.getStats();
      expect(stats.metricsHistorySize).toBeLessThanOrEqual(1000); // Should be trimmed
    });

    it('should handle cache overflow', async () => {
      // Fill cache beyond limit
      for (let i = 0; i < 150; i++) {
        const timeRange = {
          start: new Date(Date.now() - (i + 1) * 60 * 60 * 1000),
          end: new Date(Date.now() - i * 60 * 60 * 1000)
        };
        await analyzer.analyzePerformance(timeRange.start, timeRange.end);
      }
      
      const stats = analyzer.getStats();
      expect(stats.cacheSize).toBeLessThanOrEqual(100); // Should be trimmed
    });

    it('should handle zero and negative metric values', async () => {
      (analyzer as any).storeMetricsCollection({
        timestamp: new Date(),
        metrics: { zeroMetric: 0, negativeMetric: -10 },
        context: {},
        source: 'test'
      });
      
      const metrics = await analyzer.collectMetrics();
      expect(metrics.metrics.zeroMetric).toBe(0);
      expect(metrics.metrics.negativeMetric).toBe(-10);
    });
  });
}); 