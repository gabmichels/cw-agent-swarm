/**
 * Performance Analyzer
 * 
 * Handles performance metrics collection, analysis, trend detection, and optimization
 * suggestions for the reflection system. Extracted from DefaultReflectionManager.
 */

import { ulid } from 'ulid';
import { 
  PerformanceAnalyzer as IPerformanceAnalyzer,
  TimeRange,
  TrendAnalysis,
  Anomaly,
  PerformanceAnalysis
} from '../interfaces/ReflectionInterfaces';
import { PerformanceMetrics } from '../../base/managers/ReflectionManager.interface';
import {
  PerformanceAnalysisConfig,
  PerformanceAnalysisResult,
  PerformanceMetricsCollection,
  OptimizationSuggestion,
  PerformanceBenchmarks,
  PerformanceComparison,
  MetricsCollectionOptions,
  AnalysisResult,
  AnalysisError
} from '../interfaces/AnalysisInterfaces';

/**
 * Error class for performance analysis errors
 */
export class PerformanceAnalysisError extends Error implements AnalysisError {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {},
    public readonly recoverable: boolean = true,
    public readonly suggestions: string[] = []
  ) {
    super(message);
    this.name = 'PerformanceAnalysisError';
  }
}

/**
 * Default configuration for performance analysis
 */
const DEFAULT_CONFIG: Required<PerformanceAnalysisConfig> = {
  enableTrendAnalysis: true,
  enableAnomalyDetection: true,
  enableBenchmarking: true,
  enableOptimizationSuggestions: true,
  trendAnalysisWindow: 30, // 30 days
  anomalyThreshold: 2.0, // 2 standard deviations
  benchmarkUpdateInterval: 24, // 24 hours
  maxOptimizationSuggestions: 10
};

/**
 * Implementation of performance analyzer for reflection system
 */
export class PerformanceAnalyzer implements IPerformanceAnalyzer {
  private config: Required<PerformanceAnalysisConfig>;
  private metricsHistory: PerformanceMetricsCollection[] = [];
  private benchmarks: PerformanceBenchmarks | null = null;
  private lastBenchmarkUpdate: Date | null = null;
  private analysisCache = new Map<string, { result: AnalysisResult<PerformanceAnalysis>; timestamp: Date }>();

  constructor(config: PerformanceAnalysisConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Collect performance metrics from various sources
   */
  async collectMetrics(options: MetricsCollectionOptions = {}): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    
    try {
      // Validate options
      this.validateCollectionOptions(options);

      // Determine time range
      const timeRange = options.timeRange || {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: new Date()
      };

      // Filter metrics history based on options
      const filteredMetrics = this.filterMetricsHistory(timeRange, options);

      // Aggregate metrics based on granularity
      const aggregatedMetrics = this.aggregateMetrics(filteredMetrics, options);

      // Calculate derived metrics
      const derivedMetrics = this.calculateDerivedMetrics(aggregatedMetrics);

      // Combine all metrics
      const allMetrics = { ...aggregatedMetrics, ...derivedMetrics };

      // Store collection for future analysis
      this.storeMetricsCollection({
        timestamp: new Date(),
        metrics: allMetrics,
        context: { options, timeRange },
        source: 'performance_analyzer'
      });

      return {
        period: timeRange,
        metrics: allMetrics,
        trends: options.includeHistorical ? this.getTrendsForMetrics(allMetrics, timeRange) : undefined
      };

    } catch (error) {
      // If it's already a PerformanceAnalysisError, re-throw it to preserve the specific error code
      if (error instanceof PerformanceAnalysisError) {
        throw error;
      }
      
      throw new PerformanceAnalysisError(
        `Failed to collect metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'METRICS_COLLECTION_FAILED',
        { options, error },
        true,
        ['Check data sources', 'Verify time range', 'Validate options']
      );
    }
  }

  /**
   * Analyze performance data and generate insights
   */
  async analyzePerformance(fromDate?: Date, toDate?: Date): Promise<PerformanceAnalysis> {
    const analysisId = ulid();
    const startTime = Date.now();

    try {
      // Set default time range if not provided
      const timeRange: TimeRange = {
        start: fromDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        end: toDate || new Date()
      };

      // Check cache first
      const cacheKey = this.generateCacheKey('performance_analysis', timeRange);
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached.data!;
      }

      // Collect metrics for analysis
      const metrics = await this.collectMetrics({ timeRange, includeHistorical: true });

      // Perform different types of analysis
      const trends = this.config.enableTrendAnalysis ? await this.analyzeTrends(timeRange) : [];
      const anomalies = this.config.enableAnomalyDetection ? await this.detectAnomalies(timeRange) : [];
      const recommendations = this.config.enableOptimizationSuggestions ? await this.generateOptimizationSuggestions(metrics) : [];
      const benchmarks = this.config.enableBenchmarking ? await this.getBenchmarks() : this.createEmptyBenchmarks();

      // Calculate overall performance score
      const overallScore = this.calculateOverallScore(metrics, trends, anomalies);

      // Generate summary
      const summary = this.generateAnalysisSummary(overallScore, trends, anomalies, recommendations);

      const result: PerformanceAnalysis = {
        summary,
        score: overallScore,
        trends,
        anomalies,
        recommendations: recommendations.map(r => r.description)
      };

      // Cache the result
      this.cacheResult(cacheKey, {
        success: true,
        data: result,
        metadata: {
          analysisId,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          confidence: 0.8,
          methodology: 'statistical_analysis',
          version: '1.0.0'
        }
      });

      return result;

    } catch (error) {
      throw new PerformanceAnalysisError(
        `Performance analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ANALYSIS_FAILED',
        { fromDate, toDate, analysisId, error },
        true,
        ['Check data availability', 'Verify time range', 'Review configuration']
      );
    }
  }

  /**
   * Identify trends in specific metrics
   */
  async identifyTrends(metricName: string, timeRange: TimeRange): Promise<TrendAnalysis> {
    try {
      // Get metric data for the time range
      const metricData = this.getMetricData(metricName, timeRange);
      
      if (metricData.length < 3) {
        return {
          metric: metricName,
          direction: 'stable',
          strength: 0,
          confidence: 0,
          timeRange
        };
      }

      // Calculate trend using linear regression
      const trend = this.calculateLinearTrend(metricData);
      
      // Determine trend direction and strength
      const direction = this.determineTrendDirection(trend.slope);
      const strength = Math.abs(trend.slope);
      const confidence = trend.rSquared;

      return {
        metric: metricName,
        direction,
        strength,
        confidence,
        timeRange
      };

    } catch (error) {
      throw new PerformanceAnalysisError(
        `Trend analysis failed for metric ${metricName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TREND_ANALYSIS_FAILED',
        { metricName, timeRange, error },
        true,
        ['Check metric data availability', 'Verify metric name', 'Ensure sufficient data points']
      );
    }
  }

  /**
   * Generate performance benchmarks
   */
  async generateBenchmarks(): Promise<PerformanceBenchmarks> {
    try {
      // Check if benchmarks need updating
      if (this.benchmarks && this.lastBenchmarkUpdate && 
          Date.now() - this.lastBenchmarkUpdate.getTime() < this.config.benchmarkUpdateInterval * 60 * 60 * 1000) {
        return this.benchmarks;
      }

      // Calculate baseline from historical data (last 30 days)
      const baselineTimeRange: TimeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      const baselineMetrics = await this.collectMetrics({ timeRange: baselineTimeRange });
      const baseline = baselineMetrics.metrics;

      // Set targets (20% improvement over baseline)
      const targets = Object.entries(baseline).reduce((acc, [key, value]) => {
        acc[key] = value * 1.2;
        return acc;
      }, {} as Record<string, number>);

      // Industry benchmarks (placeholder - would come from external sources)
      const industry = Object.entries(baseline).reduce((acc, [key, value]) => {
        acc[key] = value * 1.5; // Assume industry is 50% better
        return acc;
      }, {} as Record<string, number>);

      // Historical benchmarks (last quarter)
      const historicalTimeRange: TimeRange = {
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      };
      
      const historicalMetrics = await this.collectMetrics({ timeRange: historicalTimeRange });
      const historical = historicalMetrics.metrics;

      // Calculate confidence scores
      const confidence = Object.keys(baseline).reduce((acc, key) => {
        acc[key] = this.calculateBenchmarkConfidence(key);
        return acc;
      }, {} as Record<string, number>);

      this.benchmarks = {
        baseline,
        targets,
        industry,
        historical,
        lastUpdated: new Date(),
        confidence
      };

      this.lastBenchmarkUpdate = new Date();
      return this.benchmarks;

    } catch (error) {
      throw new PerformanceAnalysisError(
        `Benchmark generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BENCHMARK_GENERATION_FAILED',
        { error },
        true,
        ['Check historical data availability', 'Verify metrics collection', 'Review benchmark configuration']
      );
    }
  }

  /**
   * Suggest performance optimizations
   */
  async suggestOptimizations(): Promise<OptimizationSuggestion[]> {
    try {
      const suggestions: OptimizationSuggestion[] = [];

      // Analyze recent performance
      const recentMetrics = await this.collectMetrics({
        timeRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      });

      // Get benchmarks for comparison
      const benchmarks = await this.generateBenchmarks();

      // Generate suggestions based on performance gaps
      for (const [metric, value] of Object.entries(recentMetrics.metrics)) {
        const target = benchmarks.targets[metric];
        const baseline = benchmarks.baseline[metric];
        
        if (target && baseline && value < target) {
          const gap = (target - value) / baseline;
          
          if (gap > 0.1) { // 10% gap threshold
            suggestions.push(this.createOptimizationSuggestion(metric, gap, value, target));
          }
        }
      }

      // Add general optimization suggestions
      suggestions.push(...this.getGeneralOptimizationSuggestions());

      // Sort by priority and limit results
      suggestions.sort((a, b) => b.priority - a.priority);
      return suggestions.slice(0, this.config.maxOptimizationSuggestions);

    } catch (error) {
      throw new PerformanceAnalysisError(
        `Optimization suggestion generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OPTIMIZATION_SUGGESTION_FAILED',
        { error },
        true,
        ['Check performance data', 'Verify benchmarks', 'Review optimization criteria']
      );
    }
  }

  /**
   * Compare performance between two periods
   */
  async comparePerformance(baseline: PerformanceMetrics, current: PerformanceMetrics): Promise<PerformanceComparison> {
    try {
      const improvements: Record<string, number> = {};
      const regressions: Record<string, number> = {};
      const significantChanges: Array<{
        metric: string;
        change: number;
        significance: 'low' | 'medium' | 'high';
        description: string;
      }> = [];

      // Compare each metric
      for (const [metric, currentValue] of Object.entries(current.metrics)) {
        const baselineValue = baseline.metrics[metric];
        
        if (baselineValue !== undefined) {
          const change = (currentValue - baselineValue) / baselineValue;
          const absoluteChange = Math.abs(change);
          
          if (change > 0) {
            improvements[metric] = change;
          } else if (change < 0) {
            regressions[metric] = Math.abs(change);
          }

          // Determine significance
          let significance: 'low' | 'medium' | 'high' = 'low';
          if (absoluteChange > 0.5) significance = 'high';
          else if (absoluteChange > 0.2) significance = 'medium';

          if (absoluteChange > 0.1) { // 10% change threshold
            significantChanges.push({
              metric,
              change,
              significance,
              description: this.generateChangeDescription(metric, change, significance)
            });
          }
        }
      }

      // Calculate overall score
      const improvementScore = Object.values(improvements).reduce((sum, val) => sum + val, 0);
      const regressionScore = Object.values(regressions).reduce((sum, val) => sum + val, 0);
      const overallScore = Math.max(0, Math.min(10, 5 + (improvementScore - regressionScore) * 5));

      // Generate summary
      const summary = this.generateComparisonSummary(improvements, regressions, overallScore);

              return {
          timeRange: {
            start: baseline.period.start,
            end: current.period.end
          },
        improvements,
        regressions,
        summary,
        overallScore,
        significantChanges
      };

    } catch (error) {
      throw new PerformanceAnalysisError(
        `Performance comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'COMPARISON_FAILED',
        { baseline, current, error },
        true,
        ['Check metrics compatibility', 'Verify data integrity', 'Review comparison logic']
      );
    }
  }

  /**
   * Get analysis statistics
   */
  getStats(): Record<string, unknown> {
    return {
      metricsHistorySize: this.metricsHistory.length,
      cacheSize: this.analysisCache.size,
      lastBenchmarkUpdate: this.lastBenchmarkUpdate,
      benchmarksAvailable: !!this.benchmarks,
      config: this.config,
      analysisCapabilities: {
        trendAnalysis: this.config.enableTrendAnalysis,
        anomalyDetection: this.config.enableAnomalyDetection,
        benchmarking: this.config.enableBenchmarking,
        optimizationSuggestions: this.config.enableOptimizationSuggestions
      }
    };
  }

  /**
   * Clear all cached data and reset state
   */
  async clear(): Promise<void> {
    this.metricsHistory.length = 0;
    this.analysisCache.clear();
    this.benchmarks = null;
    this.lastBenchmarkUpdate = null;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateCollectionOptions(options: MetricsCollectionOptions): void {
    if (options.timeRange) {
      if (options.timeRange.start >= options.timeRange.end) {
        throw new PerformanceAnalysisError(
          'Invalid time range: start must be before end',
          'INVALID_TIME_RANGE',
          { timeRange: options.timeRange }
        );
      }
    }

    if (options.granularity && !['minute', 'hour', 'day', 'week'].includes(options.granularity)) {
      throw new PerformanceAnalysisError(
        `Invalid granularity: ${options.granularity}`,
        'INVALID_GRANULARITY',
        { granularity: options.granularity }
      );
    }

    if (options.aggregation && !['sum', 'average', 'min', 'max', 'count'].includes(options.aggregation)) {
      throw new PerformanceAnalysisError(
        `Invalid aggregation: ${options.aggregation}`,
        'INVALID_AGGREGATION',
        { aggregation: options.aggregation }
      );
    }
  }

  private filterMetricsHistory(timeRange: TimeRange, options: MetricsCollectionOptions): PerformanceMetricsCollection[] {
    return this.metricsHistory.filter(collection => {
      // Time range filter
      if (collection.timestamp < timeRange.start || collection.timestamp > timeRange.end) {
        return false;
      }

      // Metrics filter
      if (options.metrics && options.metrics.length > 0) {
        const hasRequiredMetrics = options.metrics.some(metric => 
          collection.metrics.hasOwnProperty(metric)
        );
        if (!hasRequiredMetrics) return false;
      }

      // Custom filters
      if (options.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (collection.context[key] !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }

  private aggregateMetrics(collections: PerformanceMetricsCollection[], options: MetricsCollectionOptions): Record<string, number> {
    if (collections.length === 0) {
      return {};
    }

    const aggregation = options.aggregation || 'average';
    const allMetrics = new Set<string>();
    
    // Collect all metric names
    collections.forEach(collection => {
      Object.keys(collection.metrics).forEach(metric => allMetrics.add(metric));
    });

    const result: Record<string, number> = {};

    // Aggregate each metric
    for (const metric of allMetrics) {
      const values = collections
        .map(collection => collection.metrics[metric])
        .filter(value => value !== undefined);

      if (values.length === 0) continue;

      switch (aggregation) {
        case 'sum':
          result[metric] = values.reduce((sum, val) => sum + val, 0);
          break;
        case 'average':
          result[metric] = values.reduce((sum, val) => sum + val, 0) / values.length;
          break;
        case 'min':
          result[metric] = Math.min(...values);
          break;
        case 'max':
          result[metric] = Math.max(...values);
          break;
        case 'count':
          result[metric] = values.length;
          break;
        default:
          result[metric] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    }

    return result;
  }

  private calculateDerivedMetrics(metrics: Record<string, number>): Record<string, number> {
    const derived: Record<string, number> = {};

    // Calculate efficiency metrics
    if (metrics.totalReflections && metrics.totalTime) {
      derived.reflectionsPerHour = metrics.totalReflections / (metrics.totalTime / 3600);
    }

    if (metrics.successfulReflections && metrics.totalReflections) {
      derived.successRate = metrics.successfulReflections / metrics.totalReflections;
    }

    if (metrics.totalInsights && metrics.totalReflections) {
      derived.insightsPerReflection = metrics.totalInsights / metrics.totalReflections;
    }

    // Calculate quality metrics
    if (metrics.appliedInsights && metrics.totalInsights) {
      derived.insightApplicationRate = metrics.appliedInsights / metrics.totalInsights;
    }

    return derived;
  }

  private storeMetricsCollection(collection: PerformanceMetricsCollection): void {
    this.metricsHistory.push(collection);
    
    // Trim history to prevent memory issues (keep last 1000 entries)
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory.splice(0, this.metricsHistory.length - 1000);
    }
  }

  private calculateMetricsConfidence(sampleCount: number): number {
    // Confidence increases with sample size, plateaus at 100 samples
    return Math.min(1.0, sampleCount / 100);
  }

  private async analyzeTrends(timeRange: TimeRange): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    const metricNames = this.getAvailableMetricNames();

    for (const metricName of metricNames) {
      try {
        const trend = await this.identifyTrends(metricName, timeRange);
        if (trend.confidence > 0.3) { // Only include trends with reasonable confidence
          trends.push(trend);
        }
      } catch (error) {
        // Skip metrics that can't be analyzed
        continue;
      }
    }

    return trends;
  }

  private async detectAnomalies(timeRange: TimeRange): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const metricNames = this.getAvailableMetricNames();

    for (const metricName of metricNames) {
      const metricData = this.getMetricData(metricName, timeRange);
      
      if (metricData.length < 10) continue; // Need sufficient data for anomaly detection

      const mean = metricData.reduce((sum, point) => sum + point.value, 0) / metricData.length;
      const variance = metricData.reduce((sum, point) => sum + Math.pow(point.value - mean, 2), 0) / metricData.length;
      const stdDev = Math.sqrt(variance);

      // Detect anomalies using standard deviation threshold
      for (const point of metricData) {
        const zScore = Math.abs(point.value - mean) / stdDev;
        
        if (zScore > this.config.anomalyThreshold) {
          anomalies.push({
            metric: metricName,
            timestamp: point.timestamp,
            expectedValue: mean,
            actualValue: point.value,
            severity: this.calculateAnomalySeverity(zScore),
            description: `${metricName} value ${point.value} is ${zScore.toFixed(2)} standard deviations from the mean (${mean.toFixed(2)})`
          });
        }
      }
    }

    return anomalies;
  }

  private async generateOptimizationSuggestions(metrics: PerformanceMetrics): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Analyze reflection frequency
    if (metrics.metrics.reflectionsPerHour && metrics.metrics.reflectionsPerHour < 1) {
      suggestions.push({
        id: ulid(),
        area: 'reflection_frequency',
        description: 'Increase reflection frequency to improve learning rate',
        expectedImprovement: 0.3,
        effort: 'low',
        priority: 8,
        implementationSteps: [
          'Set up automated reflection triggers',
          'Reduce reflection threshold',
          'Add periodic reflection reminders'
        ],
        estimatedTimeToImpact: 7,
        confidence: 0.8,
        category: 'efficiency'
      });
    }

    // Analyze insight application rate
    if (metrics.metrics.insightApplicationRate && metrics.metrics.insightApplicationRate < 0.5) {
      suggestions.push({
        id: ulid(),
        area: 'insight_application',
        description: 'Improve insight application process to increase learning effectiveness',
        expectedImprovement: 0.4,
        effort: 'medium',
        priority: 9,
        implementationSteps: [
          'Review insight quality criteria',
          'Implement better action tracking',
          'Add insight application reminders'
        ],
        estimatedTimeToImpact: 14,
        confidence: 0.7,
        category: 'quality'
      });
    }

    return suggestions;
  }

  private getAvailableMetricNames(): string[] {
    const metricNames = new Set<string>();
    this.metricsHistory.forEach(collection => {
      Object.keys(collection.metrics).forEach(name => metricNames.add(name));
    });
    return Array.from(metricNames);
  }

  private getMetricData(metricName: string, timeRange: TimeRange): Array<{ timestamp: Date; value: number }> {
    return this.metricsHistory
      .filter(collection => 
        collection.timestamp >= timeRange.start && 
        collection.timestamp <= timeRange.end &&
        collection.metrics[metricName] !== undefined
      )
      .map(collection => ({
        timestamp: collection.timestamp,
        value: collection.metrics[metricName]
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateLinearTrend(data: Array<{ timestamp: Date; value: number }>): { slope: number; rSquared: number } {
    const n = data.length;
    const xValues = data.map((_, i) => i); // Use index as x-value
    const yValues = data.map(point => point.value);

    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = yValues.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = yValues.reduce((sum, y, i) => {
      const predicted = slope * xValues[i] + (sumY - slope * sumX) / n;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = 1 - (ssResidual / ssTotal);

    return { slope, rSquared: Math.max(0, rSquared) };
  }

  private determineTrendDirection(slope: number): 'increasing' | 'decreasing' | 'stable' {
    const threshold = 0.01; // 1% threshold
    if (Math.abs(slope) < threshold) return 'stable';
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  private calculateOverallScore(metrics: PerformanceMetrics, trends: TrendAnalysis[], anomalies: Anomaly[]): number {
    let score = 5; // Start with neutral score

    // Adjust based on key metrics
    if (metrics.metrics.successRate) {
      score += (metrics.metrics.successRate - 0.5) * 4; // -2 to +2 adjustment
    }

    if (metrics.metrics.insightApplicationRate) {
      score += (metrics.metrics.insightApplicationRate - 0.5) * 3; // -1.5 to +1.5 adjustment
    }

    // Adjust based on trends
    const positiveTrends = trends.filter(t => t.direction === 'increasing').length;
    const negativeTrends = trends.filter(t => t.direction === 'decreasing').length;
    score += (positiveTrends - negativeTrends) * 0.5;

    // Penalize for anomalies
    const highSeverityAnomalies = anomalies.filter(a => a.severity === 'high').length;
    score -= highSeverityAnomalies * 0.5;

    return Math.max(0, Math.min(10, score));
  }

  private generateAnalysisSummary(score: number, trends: TrendAnalysis[], anomalies: Anomaly[], recommendations: OptimizationSuggestion[]): string {
    const scoreDescription = score >= 8 ? 'excellent' : score >= 6 ? 'good' : score >= 4 ? 'fair' : 'poor';
    const trendSummary = trends.length > 0 ? `${trends.filter(t => t.direction === 'increasing').length} improving, ${trends.filter(t => t.direction === 'decreasing').length} declining` : 'no significant trends';
    const anomalySummary = anomalies.length > 0 ? `${anomalies.length} anomalies detected` : 'no anomalies';
    
    return `Performance is ${scoreDescription} (score: ${score.toFixed(1)}/10). Trends: ${trendSummary}. ${anomalySummary}. ${recommendations.length} optimization suggestions available.`;
  }

  private calculateAnalysisConfidence(trends: TrendAnalysis[], anomalies: Anomaly[], recommendations: OptimizationSuggestion[]): number {
    // Base confidence on data quality and analysis completeness
    let confidence = 0.5; // Base confidence

    // Increase confidence based on trend analysis quality
    if (trends.length > 0) {
      const avgTrendConfidence = trends.reduce((sum, t) => sum + t.confidence, 0) / trends.length;
      confidence += avgTrendConfidence * 0.3;
    }

    // Increase confidence based on anomaly detection
    if (anomalies.length >= 0) { // Even zero anomalies increases confidence
      confidence += 0.1;
    }

    // Increase confidence based on recommendations
    if (recommendations.length > 0) {
      const avgRecommendationConfidence = recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length;
      confidence += avgRecommendationConfidence * 0.1;
    }

    return Math.min(1.0, confidence);
  }

  private calculateAnomalySeverity(zScore: number): 'low' | 'medium' | 'high' {
    if (zScore > 3) return 'high';
    if (zScore > 2.5) return 'medium';
    return 'low';
  }

  private createOptimizationSuggestion(metric: string, gap: number, current: number, target: number): OptimizationSuggestion {
    return {
      id: ulid(),
      area: metric,
      description: `Improve ${metric} from ${current.toFixed(2)} to ${target.toFixed(2)} (${(gap * 100).toFixed(1)}% improvement needed)`,
      expectedImprovement: gap,
      effort: gap > 0.5 ? 'high' : gap > 0.2 ? 'medium' : 'low',
      priority: Math.round(gap * 10),
      implementationSteps: [
        `Analyze current ${metric} performance`,
        `Identify bottlenecks affecting ${metric}`,
        `Implement targeted improvements`,
        `Monitor ${metric} progress`
      ],
      estimatedTimeToImpact: gap > 0.5 ? 30 : gap > 0.2 ? 14 : 7,
      confidence: 0.7,
      category: 'performance'
    };
  }

  private getGeneralOptimizationSuggestions(): OptimizationSuggestion[] {
    return [
      {
        id: ulid(),
        area: 'data_quality',
        description: 'Improve data collection and validation processes',
        expectedImprovement: 0.2,
        effort: 'medium',
        priority: 6,
        implementationSteps: [
          'Review data collection processes',
          'Implement data validation rules',
          'Add data quality monitoring'
        ],
        estimatedTimeToImpact: 21,
        confidence: 0.6,
        category: 'quality'
      }
    ];
  }

  private getBenchmarks(): PerformanceBenchmarks {
    return this.benchmarks || this.createEmptyBenchmarks();
  }

  private createEmptyBenchmarks(): PerformanceBenchmarks {
    return {
      baseline: {},
      targets: {},
      industry: {},
      historical: {},
      lastUpdated: new Date(),
      confidence: {}
    };
  }

  private calculateBenchmarkConfidence(metric: string): number {
    // Calculate confidence based on data availability and quality
    const metricData = this.metricsHistory.filter(collection => 
      collection.metrics[metric] !== undefined
    );
    
    return Math.min(1.0, metricData.length / 100); // Max confidence at 100 data points
  }

  private generateChangeDescription(metric: string, change: number, significance: 'low' | 'medium' | 'high'): string {
    const direction = change > 0 ? 'increased' : 'decreased';
    const percentage = Math.abs(change * 100).toFixed(1);
    const significanceText = significance === 'high' ? 'significantly' : significance === 'medium' ? 'moderately' : 'slightly';
    
    return `${metric} ${significanceText} ${direction} by ${percentage}%`;
  }

  private generateComparisonSummary(improvements: Record<string, number>, regressions: Record<string, number>, overallScore: number): string {
    const improvementCount = Object.keys(improvements).length;
    const regressionCount = Object.keys(regressions).length;
    const scoreDescription = overallScore >= 7 ? 'positive' : overallScore >= 4 ? 'mixed' : 'concerning';
    
    return `Performance comparison shows ${scoreDescription} results (score: ${overallScore.toFixed(1)}/10). ${improvementCount} metrics improved, ${regressionCount} metrics regressed.`;
  }

  private generateCacheKey(operation: string, timeRange: TimeRange): string {
    return `${operation}_${timeRange.start.getTime()}_${timeRange.end.getTime()}`;
  }

  private getCachedResult(key: string): AnalysisResult<PerformanceAnalysis> | null {
    const cached = this.analysisCache.get(key);
    if (cached && Date.now() - cached.timestamp.getTime() < 300000) { // 5 minute cache
      return cached.result;
    }
    return null;
  }

  private getTrendsForMetrics(metrics: Record<string, number>, timeRange: TimeRange): Record<string, Array<{ timestamp: Date; value: number }>> {
    const trends: Record<string, Array<{ timestamp: Date; value: number }>> = {};
    
    for (const metricName of Object.keys(metrics)) {
      trends[metricName] = this.getMetricData(metricName, timeRange);
    }
    
    return trends;
  }

  private cacheResult(key: string, result: AnalysisResult<PerformanceAnalysis>): void {
    this.analysisCache.set(key, { result, timestamp: new Date() });
    
    // Trim cache if it gets too large
    if (this.analysisCache.size > 100) {
      const oldestKey = this.analysisCache.keys().next().value;
      if (oldestKey) {
        this.analysisCache.delete(oldestKey);
      }
    }
  }
} 