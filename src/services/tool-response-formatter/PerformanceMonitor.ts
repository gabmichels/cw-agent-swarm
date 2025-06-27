/**
 * Performance Monitor for Tool Response Formatter Phase 5
 * 
 * Provides comprehensive performance monitoring and bottleneck identification:
 * - Real-time processing stage tracking
 * - Performance bottleneck detection
 * - Optimization recommendation generation
 * - Historical performance analysis
 * - Scalability assessment
 * 
 * Features:
 * - Multi-stage performance profiling
 * - Threshold-based alerting
 * - Performance trend analysis
 * - Resource utilization monitoring
 * - Automated optimization suggestions
 */

import { generateULID } from '../../lib/core/id-generation';
import { createLogger } from '../../lib/logging/winston-logger';
import {
  FormattedToolResponse,
  PerformanceBottleneck,
  PerformanceMonitoringMetrics,
  ProcessingStageMetrics,
  ResponseStyleType,
  ToolCategory,
  ToolResponseContext,
  ULID
} from './types';

/**
 * Performance Monitor for response formatting optimization
 */
export class PerformanceMonitor {
  private readonly logger: ReturnType<typeof createLogger>;
  private performanceHistory: Map<string, PerformanceHistoryEntry[]> = new Map();
  private stageThresholds: Map<string, number> = new Map();
  private performanceAlerts: PerformanceAlert[] = [];
  private monitoringEnabled: boolean = true;

  constructor() {
    this.logger = createLogger({
      moduleId: 'performance-monitor'
    });
    this.initializeStageThresholds();
  }

  /**
   * Start performance monitoring for a response generation request
   */
  startMonitoring(context: ToolResponseContext): PerformanceTracker {
    if (!this.monitoringEnabled) {
      return this.createDisabledTracker();
    }

    const tracker: PerformanceTracker = {
      contextId: context.id,
      agentId: context.agentId,
      toolCategory: context.toolCategory,
      responseStyle: context.responseConfig.responseStyle,
      startTime: process.hrtime.bigint(),
      stageTimings: new Map(),
      isCompleted: false
    };

    this.logger.debug('Performance monitoring started', {
      contextId: context.id,
      agentId: context.agentId,
      toolCategory: context.toolCategory
    });

    return tracker;
  }

  /**
   * Record stage completion time
   */
  recordStageCompletion(
    tracker: PerformanceTracker,
    stage: keyof ProcessingStageMetrics,
    startTime: bigint
  ): void {
    if (!this.monitoringEnabled || !tracker.isCompleted === false) {
      return;
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

    tracker.stageTimings.set(stage, duration);

    this.logger.debug('Processing stage completed', {
      contextId: tracker.contextId,
      stage,
      duration: `${duration.toFixed(2)}ms`
    });

    // Check for stage-specific performance issues
    this.checkStagePerformance(tracker, stage, duration);
  }

  /**
   * Complete monitoring and generate performance metrics
   */
  completeMonitoring(
    tracker: PerformanceTracker,
    response: FormattedToolResponse
  ): PerformanceMonitoringMetrics {
    if (!this.monitoringEnabled) {
      return this.createEmptyMetrics(tracker);
    }

    tracker.isCompleted = true;
    const endTime = process.hrtime.bigint();
    const totalTime = Number(endTime - tracker.startTime) / 1_000_000;

    // Build processing stage metrics
    const processingStages: ProcessingStageMetrics = {
      templateRetrieval: tracker.stageTimings.get('templateRetrieval') || 0,
      systemPromptGeneration: tracker.stageTimings.get('systemPromptGeneration') || 0,
      llmGeneration: tracker.stageTimings.get('llmGeneration') || 0,
      postProcessing: tracker.stageTimings.get('postProcessing') || 0,
      qualityScoring: tracker.stageTimings.get('qualityScoring') || 0,
      cacheOperations: tracker.stageTimings.get('cacheOperations') || 0,
      totalProcessingTime: totalTime
    };

    // Identify performance bottlenecks
    const bottlenecks = this.identifyBottlenecks(processingStages, tracker);

    // Generate optimization suggestions
    const optimizationSuggestions = this.generateOptimizationSuggestions(
      processingStages,
      bottlenecks,
      tracker
    );

    const metrics: PerformanceMonitoringMetrics = {
      timestamp: new Date(),
      contextId: tracker.contextId,
      agentId: tracker.agentId,
      toolCategory: tracker.toolCategory,
      responseStyle: tracker.responseStyle,
      processingStages,
      bottlenecks,
      optimizationSuggestions
    };

    // Store performance history
    this.storePerformanceHistory(metrics);

    // Check for performance alerts
    this.checkPerformanceAlerts(metrics);

    this.logger.info('Performance monitoring completed', {
      contextId: tracker.contextId,
      totalTime: `${totalTime.toFixed(2)}ms`,
      bottleneckCount: bottlenecks.length,
      suggestionCount: optimizationSuggestions.length
    });

    return metrics;
  }

  /**
   * Get performance summary for time period
   */
  async getPerformanceSummary(
    timeWindow: TimeWindow,
    filters?: PerformanceFilters
  ): Promise<PerformanceSummary> {
    try {
      const entries = this.getFilteredPerformanceEntries(timeWindow, filters);

      if (entries.length === 0) {
        return this.createEmptyPerformanceSummary(timeWindow);
      }

      // Calculate aggregate metrics
      const averageMetrics = this.calculateAverageMetrics(entries);
      const trendAnalysis = this.analyzeTrends(entries);
      const bottleneckAnalysis = this.analyzeBottlenecks(entries);
      const recommendations = this.generatePerformanceRecommendations(entries);

      return {
        timeWindow,
        sampleSize: entries.length,
        averageMetrics,
        trendAnalysis,
        bottleneckAnalysis,
        recommendations,
        generatedAt: new Date()
      };

    } catch (error) {
      this.logger.error('Failed to generate performance summary', {
        timeWindow,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get current performance alerts
   */
  getActivePerformanceAlerts(): readonly PerformanceAlert[] {
    const now = Date.now();
    return this.performanceAlerts.filter(alert =>
      alert.isActive && (now - alert.timestamp.getTime()) < alert.ttlMs
    );
  }

  /**
   * Update performance monitoring configuration
   */
  updateConfiguration(config: PerformanceMonitoringConfig): void {
    this.monitoringEnabled = config.enabled;

    // Update stage thresholds
    if (config.stageThresholds) {
      for (const [stage, threshold] of Object.entries(config.stageThresholds)) {
        this.stageThresholds.set(stage, threshold);
      }
    }

    this.logger.info('Performance monitoring configuration updated', {
      enabled: this.monitoringEnabled,
      thresholdCount: this.stageThresholds.size
    });
  }

  /**
   * Clear performance history (for testing/cleanup)
   */
  clearPerformanceHistory(): void {
    this.performanceHistory.clear();
    this.performanceAlerts = [];

    this.logger.info('Performance history cleared');
  }

  /**
   * Initialize default stage performance thresholds
   */
  private initializeStageThresholds(): void {
    // Default thresholds in milliseconds
    this.stageThresholds.set('templateRetrieval', 50);
    this.stageThresholds.set('systemPromptGeneration', 100);
    this.stageThresholds.set('llmGeneration', 2000);
    this.stageThresholds.set('postProcessing', 50);
    this.stageThresholds.set('qualityScoring', 100);
    this.stageThresholds.set('cacheOperations', 25);
    this.stageThresholds.set('totalProcessingTime', 3000);
  }

  /**
   * Check stage performance against thresholds
   */
  private checkStagePerformance(
    tracker: PerformanceTracker,
    stage: keyof ProcessingStageMetrics,
    duration: number
  ): void {
    const threshold = this.stageThresholds.get(stage);

    if (threshold && duration > threshold) {
      this.logger.warn('Performance threshold exceeded', {
        contextId: tracker.contextId,
        stage,
        duration: `${duration.toFixed(2)}ms`,
        threshold: `${threshold}ms`,
        overrun: `${(duration - threshold).toFixed(2)}ms`
      });

      // Create performance alert
      this.createPerformanceAlert({
        type: 'threshold_exceeded',
        stage,
        duration,
        threshold,
        contextId: tracker.contextId,
        agentId: tracker.agentId,
        toolCategory: tracker.toolCategory
      });
    }
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(
    stages: ProcessingStageMetrics,
    tracker: PerformanceTracker
  ): readonly PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];

    // Check each stage against thresholds
    for (const [stageName, duration] of Object.entries(stages)) {
      const stage = stageName as keyof ProcessingStageMetrics;
      const threshold = this.stageThresholds.get(stage);

      if (threshold && duration > threshold) {
        const severity = this.calculateBottleneckSeverity(duration, threshold);

        bottlenecks.push({
          stage,
          duration,
          threshold,
          severity,
          impact: this.getBottleneckImpact(stage, duration, threshold),
          recommendation: this.getBottleneckRecommendation(stage, severity)
        });
      }
    }

    return bottlenecks;
  }

  /**
   * Calculate bottleneck severity
   */
  private calculateBottleneckSeverity(
    duration: number,
    threshold: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = duration / threshold;

    if (ratio >= 5.0) return 'critical';
    if (ratio >= 3.0) return 'high';
    if (ratio >= 2.0) return 'medium';
    return 'low';
  }

  /**
   * Get bottleneck impact description
   */
  private getBottleneckImpact(
    stage: keyof ProcessingStageMetrics,
    duration: number,
    threshold: number
  ): string {
    const overrun = duration - threshold;

    switch (stage) {
      case 'templateRetrieval':
        return `Template lookup delay adds ${overrun.toFixed(1)}ms to response time`;
      case 'systemPromptGeneration':
        return `Prompt formatting delay adds ${overrun.toFixed(1)}ms to generation`;
      case 'llmGeneration':
        return `LLM processing delay adds ${overrun.toFixed(1)}ms to response time`;
      case 'postProcessing':
        return `Response processing delay adds ${overrun.toFixed(1)}ms to completion`;
      case 'qualityScoring':
        return `Quality assessment delay adds ${overrun.toFixed(1)}ms to response time`;
      case 'cacheOperations':
        return `Cache operations delay adds ${overrun.toFixed(1)}ms to processing`;
      case 'totalProcessingTime':
        return `Total processing delay of ${overrun.toFixed(1)}ms affects user experience`;
      default:
        return `Processing delay of ${overrun.toFixed(1)}ms in ${stage}`;
    }
  }

  /**
   * Get bottleneck recommendation
   */
  private getBottleneckRecommendation(
    stage: keyof ProcessingStageMetrics,
    severity: string
  ): string {
    const recommendations: Record<keyof ProcessingStageMetrics, Record<string, string>> = {
      templateRetrieval: {
        low: 'Consider template caching optimization',
        medium: 'Implement template pre-loading for common categories',
        high: 'Redesign template storage for faster lookup',
        critical: 'Emergency template optimization required'
      },
      systemPromptGeneration: {
        low: 'Optimize prompt template compilation',
        medium: 'Cache compiled prompts for reuse',
        high: 'Simplify prompt generation logic',
        critical: 'Refactor prompt generation system'
      },
      llmGeneration: {
        low: 'Review LLM request parameters',
        medium: 'Consider LLM response caching',
        high: 'Optimize LLM prompt length and complexity',
        critical: 'Switch to faster LLM model or provider'
      },
      postProcessing: {
        low: 'Optimize response validation logic',
        medium: 'Streamline post-processing steps',
        high: 'Parallelize post-processing operations',
        critical: 'Redesign post-processing pipeline'
      },
      qualityScoring: {
        low: 'Optimize quality metric calculations',
        medium: 'Cache quality scoring results',
        high: 'Simplify quality assessment algorithm',
        critical: 'Make quality scoring asynchronous'
      },
      cacheOperations: {
        low: 'Optimize cache key generation',
        medium: 'Review cache serialization performance',
        high: 'Consider faster cache backend',
        critical: 'Redesign caching strategy'
      },
      totalProcessingTime: {
        low: 'Monitor individual stage performance',
        medium: 'Parallelize independent operations',
        high: 'Optimize critical path stages',
        critical: 'Implement asynchronous processing'
      }
    };

    return recommendations[stage]?.[severity] || `Optimize ${stage} performance`;
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(
    stages: ProcessingStageMetrics,
    bottlenecks: readonly PerformanceBottleneck[],
    tracker: PerformanceTracker
  ): readonly string[] {
    const suggestions: string[] = [];

    // General optimization suggestions
    if (stages.totalProcessingTime > 1000) {
      suggestions.push('Consider implementing response streaming for better perceived performance');
    }

    if (stages.llmGeneration > 1500) {
      suggestions.push('Optimize LLM prompts to reduce generation time');
      suggestions.push('Consider using a faster LLM model for this tool category');
    }

    if (stages.cacheOperations > 100) {
      suggestions.push('Review cache performance and consider optimization');
    }

    // Category-specific suggestions
    this.addCategorySpecificSuggestions(suggestions, tracker.toolCategory, stages);

    // Bottleneck-specific suggestions
    for (const bottleneck of bottlenecks) {
      if (bottleneck.severity === 'high' || bottleneck.severity === 'critical') {
        suggestions.push(bottleneck.recommendation);
      }
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Add category-specific optimization suggestions
   */
  private addCategorySpecificSuggestions(
    suggestions: string[],
    category: ToolCategory,
    stages: ProcessingStageMetrics
  ): void {
    switch (category) {
      case ToolCategory.WORKSPACE:
        if (stages.qualityScoring > 75) {
          suggestions.push('Simplify business value assessment for workspace tools');
        }
        break;
      case ToolCategory.SOCIAL_MEDIA:
        if (stages.systemPromptGeneration > 150) {
          suggestions.push('Pre-compile social media prompt templates');
        }
        break;
      case ToolCategory.EXTERNAL_API:
        if (stages.postProcessing > 100) {
          suggestions.push('Optimize API response data transformation');
        }
        break;
      case ToolCategory.WORKFLOW:
        if (stages.templateRetrieval > 75) {
          suggestions.push('Cache workflow-specific templates');
        }
        break;
      case ToolCategory.RESEARCH:
        if (stages.llmGeneration > 2000) {
          suggestions.push('Simplify research result summarization prompts');
        }
        break;
    }
  }

  /**
   * Store performance history
   */
  private storePerformanceHistory(metrics: PerformanceMonitoringMetrics): void {
    const key = `${metrics.agentId}:${metrics.toolCategory}`;

    if (!this.performanceHistory.has(key)) {
      this.performanceHistory.set(key, []);
    }

    const history = this.performanceHistory.get(key)!;
    history.push({
      timestamp: metrics.timestamp,
      metrics,
      contextId: metrics.contextId
    });

    // Keep only recent history (last 1000 entries)
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Create performance alert
   */
  private createPerformanceAlert(alertData: {
    type: string;
    stage: keyof ProcessingStageMetrics;
    duration: number;
    threshold: number;
    contextId: ULID;
    agentId: string;
    toolCategory: ToolCategory;
  }): void {
    const alert: PerformanceAlert = {
      id: generateULID(),
      type: alertData.type,
      severity: this.calculateBottleneckSeverity(alertData.duration, alertData.threshold),
      message: `Performance threshold exceeded in ${alertData.stage}: ${alertData.duration.toFixed(2)}ms > ${alertData.threshold}ms`,
      contextId: alertData.contextId,
      agentId: alertData.agentId,
      toolCategory: alertData.toolCategory,
      stage: alertData.stage,
      duration: alertData.duration,
      threshold: alertData.threshold,
      timestamp: new Date(),
      isActive: true,
      ttlMs: 5 * 60 * 1000 // 5 minutes
    };

    this.performanceAlerts.push(alert);

    // Keep only recent alerts (last 100)
    if (this.performanceAlerts.length > 100) {
      this.performanceAlerts = this.performanceAlerts.slice(-100);
    }
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(metrics: PerformanceMonitoringMetrics): void {
    // Check for critical total processing time
    if (metrics.processingStages.totalProcessingTime > 5000) {
      this.createPerformanceAlert({
        type: 'critical_performance',
        stage: 'totalProcessingTime',
        duration: metrics.processingStages.totalProcessingTime,
        threshold: 5000,
        contextId: metrics.contextId,
        agentId: metrics.agentId,
        toolCategory: metrics.toolCategory
      });
    }

    // Check for excessive LLM generation time
    if (metrics.processingStages.llmGeneration > 3000) {
      this.createPerformanceAlert({
        type: 'llm_performance',
        stage: 'llmGeneration',
        duration: metrics.processingStages.llmGeneration,
        threshold: 3000,
        contextId: metrics.contextId,
        agentId: metrics.agentId,
        toolCategory: metrics.toolCategory
      });
    }
  }

  /**
   * Create disabled tracker for when monitoring is off
   */
  private createDisabledTracker(): PerformanceTracker {
    return {
      contextId: 'disabled',
      agentId: 'disabled',
      toolCategory: ToolCategory.CUSTOM,
      responseStyle: 'conversational',
      startTime: BigInt(0),
      stageTimings: new Map(),
      isCompleted: true
    };
  }

  /**
   * Create empty metrics for disabled monitoring
   */
  private createEmptyMetrics(tracker: PerformanceTracker): PerformanceMonitoringMetrics {
    return {
      timestamp: new Date(),
      contextId: tracker.contextId,
      agentId: tracker.agentId,
      toolCategory: tracker.toolCategory,
      responseStyle: tracker.responseStyle,
      processingStages: {
        templateRetrieval: 0,
        systemPromptGeneration: 0,
        llmGeneration: 0,
        postProcessing: 0,
        qualityScoring: 0,
        cacheOperations: 0,
        totalProcessingTime: 0
      },
      bottlenecks: [],
      optimizationSuggestions: []
    };
  }

  private getFilteredPerformanceEntries(timeWindow: TimeWindow, filters?: PerformanceFilters): PerformanceHistoryEntry[] {
    // Implementation for filtering performance entries
    return [];
  }

  private createEmptyPerformanceSummary(timeWindow: TimeWindow): PerformanceSummary {
    // Implementation for empty summary
    return {} as PerformanceSummary;
  }

  private calculateAverageMetrics(entries: PerformanceHistoryEntry[]): ProcessingStageMetrics {
    // Implementation for calculating averages
    return {} as ProcessingStageMetrics;
  }

  private analyzeTrends(entries: PerformanceHistoryEntry[]): any {
    // Implementation for trend analysis
    return {};
  }

  private analyzeBottlenecks(entries: PerformanceHistoryEntry[]): any {
    // Implementation for bottleneck analysis
    return {};
  }

  private generatePerformanceRecommendations(entries: PerformanceHistoryEntry[]): readonly string[] {
    // Implementation for recommendations
    return [];
  }
}

// Supporting interfaces and types

interface PerformanceTracker {
  readonly contextId: ULID;
  readonly agentId: string;
  readonly toolCategory: ToolCategory;
  readonly responseStyle: ResponseStyleType;
  readonly startTime: bigint;
  readonly stageTimings: Map<keyof ProcessingStageMetrics, number>;
  isCompleted: boolean;
}

interface PerformanceHistoryEntry {
  readonly timestamp: Date;
  readonly metrics: PerformanceMonitoringMetrics;
  readonly contextId: ULID;
}

interface PerformanceAlert {
  readonly id: ULID;
  readonly type: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly message: string;
  readonly contextId: ULID;
  readonly agentId: string;
  readonly toolCategory: ToolCategory;
  readonly stage: keyof ProcessingStageMetrics;
  readonly duration: number;
  readonly threshold: number;
  readonly timestamp: Date;
  isActive: boolean;
  readonly ttlMs: number;
}

interface PerformanceMonitoringConfig {
  readonly enabled: boolean;
  readonly stageThresholds?: Partial<Record<keyof ProcessingStageMetrics, number>>;
}

interface TimeWindow {
  readonly start: Date;
  readonly end: Date;
}

interface PerformanceFilters {
  readonly agentId?: string;
  readonly toolCategory?: ToolCategory;
  readonly responseStyle?: ResponseStyleType;
}

interface PerformanceSummary {
  readonly timeWindow: TimeWindow;
  readonly sampleSize: number;
  readonly averageMetrics: ProcessingStageMetrics;
  readonly trendAnalysis: any;
  readonly bottleneckAnalysis: any;
  readonly recommendations: readonly string[];
  readonly generatedAt: Date;
} 