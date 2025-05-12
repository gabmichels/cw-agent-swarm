import { EventEmitter } from 'node:events';
import type { SystemMetrics, MonitoringConfig, HealthStatus, IMonitoringService, Alert, ExtendedQueryMetrics, ExtendedTaskMetrics, ExtendedQueueStats } from './types';
import type { QueryMetrics, QueryAnalysis } from '../query/query-performance';
import type { TaskMetrics } from '../../../../lib/agents/base/managers/TaskManager';
import type { PerformanceMetrics as AgentPerformanceMetrics } from '../../../../lib/agents/base/managers/ReflectionManager';
import type { OperationQueueStats } from '../client/types';
import { QueryOptimizationStrategy } from '../query/types';

const DEFAULT_CONFIG: MonitoringConfig = {
  enableDetailedMetrics: true,
  collectionIntervalMs: 60000, // 1 minute
  metricsRetentionMs: 86400000, // 24 hours
  alertThresholds: {
    maxCpuUsage: 80,
    maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
    maxErrorRate: 10,
    maxAvgResponseTime: 1000,
    minCacheHitRate: 0.8
  },
  enableAutoOptimization: true
};

export class MonitoringService implements IMonitoringService {
  private config: MonitoringConfig;
  private systemMetrics: SystemMetrics[] = [];
  private queryMetrics: Map<string, ExtendedQueryMetrics[]> = new Map();
  private taskMetrics: ExtendedTaskMetrics[] = [];
  private agentMetrics: Map<string, AgentPerformanceMetrics[]> = new Map();
  private queueStats: ExtendedQueueStats[] = [];
  private alertHandlers: Set<(alert: Alert) => void> = new Set();
  private collectionInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCollection();
    this.startCleanup();
  }

  private emitAlert(alert: Alert): void {
    this.alertHandlers.forEach(handler => handler(alert));
  }

  async recordSystemMetrics(metrics: SystemMetrics): Promise<void> {
    this.systemMetrics.push(metrics);
    await this.checkSystemAlerts(metrics);
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const latest = this.systemMetrics[this.systemMetrics.length - 1];
    if (!latest) {
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
        requestRate: 0,
        errorRate: 0,
        avgResponseTime: 0,
        timestamp: new Date()
      };
    }
    return latest;
  }

  async recordQueryMetrics(metrics: QueryMetrics, queryId: string): Promise<void> {
    const extendedMetrics: ExtendedQueryMetrics = {
      ...metrics,
      timestamp: new Date(),
      queryId
    } as ExtendedQueryMetrics;
    const metricsList = this.queryMetrics.get(queryId) || [];
    metricsList.push(extendedMetrics);
    this.queryMetrics.set(queryId, metricsList);
    await this.checkQueryAlerts(extendedMetrics, queryId);
  }

  async getQueryAnalysis(queryId: string): Promise<QueryAnalysis> {
    const metrics = this.queryMetrics.get(queryId) || [];
    if (metrics.length === 0) {
      throw new Error(`No metrics found for query ${queryId}`);
    }

    const latest = metrics[metrics.length - 1];
    const pattern = this.analyzeQueryPattern(latest);
    const bottlenecks = this.identifyQueryBottlenecks(latest);
    const suggestions = this.generateQuerySuggestions(latest, bottlenecks);

    return {
      pattern,
      recommendedStrategy: this.getRecommendedStrategy(latest, pattern),
      bottlenecks,
      suggestions
    };
  }

  async recordAgentMetrics(metrics: AgentPerformanceMetrics, agentId: string): Promise<void> {
    const metricsList = this.agentMetrics.get(agentId) || [];
    metricsList.push(metrics);
    this.agentMetrics.set(agentId, metricsList);
    await this.checkAgentAlerts(metrics, agentId);
  }

  async getAgentMetrics(agentId: string): Promise<AgentPerformanceMetrics> {
    const metrics = this.agentMetrics.get(agentId) || [];
    if (metrics.length === 0) {
      throw new Error(`No metrics found for agent ${agentId}`);
    }
    return metrics[metrics.length - 1];
  }

  async recordTaskMetrics(metrics: TaskMetrics): Promise<void> {
    const extendedMetrics: ExtendedTaskMetrics = {
      ...metrics,
      timestamp: new Date(),
      tasksByStatus: {
        pending: metrics.tasksByStatus.pending || 0,
        running: metrics.tasksByStatus.running || 0,
        completed: metrics.completedTasks,
        failed: metrics.failedTasks,
        cancelled: metrics.tasksByStatus.cancelled || 0,
        timeout: metrics.tasksByStatus.timeout || 0
      }
    };
    this.taskMetrics.push(extendedMetrics);
    await this.checkTaskAlerts(extendedMetrics);
  }

  async recordQueueMetrics(stats: OperationQueueStats): Promise<void> {
    const extendedStats: ExtendedQueueStats = {
      ...stats,
      timestamp: new Date()
    };
    this.queueStats.push(extendedStats);
    await this.checkQueueAlerts(extendedStats);
  }

  private async checkSystemAlerts(metrics: SystemMetrics): Promise<void> {
    const { alertThresholds } = this.config;
    const alerts: Alert[] = [];

    if (metrics.cpuUsage >= alertThresholds.maxCpuUsage) {
      alerts.push({
        type: 'system',
        severity: metrics.cpuUsage >= 90 ? 'critical' : 'warning',
        message: `High CPU usage: ${metrics.cpuUsage.toFixed(1)}%`,
        metrics
      });
    }

    if (metrics.memoryUsage >= alertThresholds.maxMemoryUsage) {
      alerts.push({
        type: 'system',
        severity: metrics.memoryUsage >= alertThresholds.maxMemoryUsage * 1.5 ? 'critical' : 'warning',
        message: `High memory usage: ${(metrics.memoryUsage / (1024 * 1024)).toFixed(1)}MB`,
        metrics
      });
    }

    if (metrics.errorRate >= alertThresholds.maxErrorRate) {
      alerts.push({
        type: 'system',
        severity: metrics.errorRate >= alertThresholds.maxErrorRate * 2 ? 'critical' : 'warning',
        message: `High error rate: ${metrics.errorRate.toFixed(1)}%`,
        metrics
      });
    }

    if (metrics.avgResponseTime >= alertThresholds.maxAvgResponseTime) {
      alerts.push({
        type: 'system',
        severity: metrics.avgResponseTime >= alertThresholds.maxAvgResponseTime * 2 ? 'critical' : 'warning',
        message: `Slow response time: ${metrics.avgResponseTime}ms`,
        metrics
      });
    }

    for (const alert of alerts) {
      this.emitAlert(alert);
    }
  }

  private async checkQueryAlerts(metrics: ExtendedQueryMetrics, queryId: string): Promise<void> {
    const { alertThresholds } = this.config;
    const alerts: Alert[] = [];

    if (metrics.executionTimeMs >= alertThresholds.maxAvgResponseTime) {
      alerts.push({
        type: 'query',
        severity: metrics.executionTimeMs >= alertThresholds.maxAvgResponseTime * 2 ? 'critical' : 'warning',
        message: `Slow query execution: ${metrics.executionTimeMs}ms`,
        metrics,
        queryId
      });
    }

    if (metrics.cacheStatus === 'miss' && metrics.complexityScore > 0.7) {
      alerts.push({
        type: 'query',
        severity: 'warning',
        message: 'Complex query with cache miss',
        metrics,
        queryId
      });
    }

    for (const alert of alerts) {
      this.emitAlert(alert);
    }
  }

  private async checkTaskAlerts(metrics: ExtendedTaskMetrics): Promise<void> {
    const alerts: Alert[] = [];

    const successRate = (metrics.completedTasks / metrics.totalTasks) * 100;
    if (successRate < 50) {
      alerts.push({
        type: 'task',
        severity: successRate < 30 ? 'critical' : 'warning',
        message: `Low task success rate: ${successRate.toFixed(1)}%`,
        metrics
      });
    }

    for (const alert of alerts) {
      this.emitAlert(alert);
    }
  }

  private async checkAgentAlerts(metrics: AgentPerformanceMetrics, agentId: string): Promise<void> {
    const alerts: Alert[] = [];

    if (metrics.successRate < 0.5) {
      alerts.push({
        type: 'agent',
        severity: metrics.successRate < 0.3 ? 'critical' : 'warning',
        message: `Low agent success rate: ${(metrics.successRate * 100).toFixed(1)}%`,
        metrics,
        agentId
      });
    }

    if (metrics.errors.count > 10) {
      alerts.push({
        type: 'agent',
        severity: metrics.errors.count > 20 ? 'critical' : 'warning',
        message: `High error count: ${metrics.errors.count}`,
        metrics,
        agentId
      });
    }

    for (const alert of alerts) {
      this.emitAlert(alert);
    }
  }

  private async checkQueueAlerts(stats: ExtendedQueueStats): Promise<void> {
    const alerts: Alert[] = [];

    if (stats.size > 100) {
      alerts.push({
        type: 'queue',
        severity: stats.size > 200 ? 'critical' : 'warning',
        message: `Large queue size: ${stats.size} items`,
        metrics: stats
      });
    }

    for (const alert of alerts) {
      this.emitAlert(alert);
    }
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    const latestSystemMetrics = this.systemMetrics[this.systemMetrics.length - 1];
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!latestSystemMetrics) {
      return { status: 'healthy', issues: [], recommendations: [] };
    }

    const { alertThresholds } = this.config;

    if (latestSystemMetrics.cpuUsage >= alertThresholds.maxCpuUsage) {
      issues.push(`High CPU usage: ${latestSystemMetrics.cpuUsage.toFixed(1)}%`);
      recommendations.push('Consider scaling up CPU resources or optimizing CPU-intensive operations');
    }

    if (latestSystemMetrics.memoryUsage >= alertThresholds.maxMemoryUsage) {
      issues.push(`High memory usage: ${(latestSystemMetrics.memoryUsage / (1024 * 1024)).toFixed(1)}MB`);
      recommendations.push('Consider increasing memory allocation or investigating memory leaks');
    }

    if (latestSystemMetrics.errorRate >= alertThresholds.maxErrorRate) {
      issues.push(`High error rate: ${latestSystemMetrics.errorRate.toFixed(1)}%`);
      recommendations.push('Investigate error patterns and fix underlying issues');
    }

    if (latestSystemMetrics.avgResponseTime >= alertThresholds.maxAvgResponseTime) {
      issues.push(`Slow response time: ${latestSystemMetrics.avgResponseTime.toFixed(1)}ms`);
      recommendations.push('Optimize query performance and consider caching frequently accessed data');
    }

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (issues.length > 0) {
      // Check for critical conditions
      const hasCriticalConditions = 
        latestSystemMetrics.cpuUsage >= 90 ||
        latestSystemMetrics.memoryUsage >= alertThresholds.maxMemoryUsage * 1.5 ||
        latestSystemMetrics.errorRate >= alertThresholds.maxErrorRate * 2 ||
        latestSystemMetrics.avgResponseTime >= alertThresholds.maxAvgResponseTime * 2;

      status = hasCriticalConditions ? 'critical' : 'degraded';
    }

    return { status, issues, recommendations };
  }

  private startCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    this.collectionInterval = setInterval(async () => {
      const metrics = await this.getSystemMetrics();
      await this.recordSystemMetrics(metrics);
    }, this.config.collectionIntervalMs);
  }

  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.clearOldMetrics();
    }, 3600000); // Clean up every hour
  }

  private restartCollection(): void {
    this.startCollection();
  }

  async clearOldMetrics(): Promise<void> {
    const cutoffTime = Date.now() - this.config.metricsRetentionMs;
    
    this.systemMetrics = this.systemMetrics.filter(m => m.timestamp.getTime() > cutoffTime);
    
    const queryMetricsEntries = Array.from(this.queryMetrics.entries());
    for (const [queryId, metrics] of queryMetricsEntries) {
      const filteredMetrics = metrics.filter((m: ExtendedQueryMetrics) => m.timestamp.getTime() > cutoffTime);
      if (filteredMetrics.length === 0) {
        this.queryMetrics.delete(queryId);
      } else {
        this.queryMetrics.set(queryId, filteredMetrics);
      }
    }
    
    this.taskMetrics = this.taskMetrics.filter(m => m.timestamp.getTime() > cutoffTime);
    
    const agentMetricsEntries = Array.from(this.agentMetrics.entries());
    for (const [agentId, metrics] of agentMetricsEntries) {
      const filteredMetrics = metrics.filter((m: AgentPerformanceMetrics) => m.period.end.getTime() > cutoffTime);
      if (filteredMetrics.length === 0) {
        this.agentMetrics.delete(agentId);
      } else {
        this.agentMetrics.set(agentId, filteredMetrics);
      }
    }
    
    this.queueStats = this.queueStats.filter(s => s.timestamp.getTime() > cutoffTime);
  }

  onAlert(handler: (alert: Alert) => void): void {
    this.alertHandlers.add(handler);
  }

  private analyzeQueryPattern(metrics: QueryMetrics): 'simple' | 'complex' | 'filter-heavy' | 'result-heavy' {
    if (metrics.complexityScore < 0.3) {
      return 'simple';
    } else if (metrics.complexityScore > 0.7) {
      return 'complex';
    } else if (metrics.filterComplexityScore > 0.5) {
      return 'filter-heavy';
    } else {
      return 'result-heavy';
    }
  }

  private identifyQueryBottlenecks(metrics: QueryMetrics): string[] {
    const bottlenecks: string[] = [];
    if (metrics.executionTimeMs > this.config.alertThresholds.maxAvgResponseTime) {
      bottlenecks.push('high_execution_time');
    }
    if (metrics.cacheStatus === 'miss' && metrics.complexityScore > 0.7) {
      bottlenecks.push('low_cache_hit_rate');
    }
    if (metrics.resultCount > 100) {
      bottlenecks.push('large_result_set');
    }
    return bottlenecks;
  }

  private generateQuerySuggestions(metrics: QueryMetrics, bottlenecks: string[]): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.includes('high_execution_time')) {
      recommendations.push('Consider using HIGH_SPEED optimization strategy');
      recommendations.push('Implement query caching for frequently used queries');
    }

    if (bottlenecks.includes('low_cache_hit_rate')) {
      recommendations.push('Review cache invalidation strategy');
      recommendations.push('Consider implementing query pattern-based caching');
    }

    if (bottlenecks.includes('large_result_set')) {
      recommendations.push('Implement pagination for large result sets');
      recommendations.push('Consider using more specific filters');
    }

    return recommendations;
  }

  private getRecommendedStrategy(metrics: QueryMetrics, pattern: 'simple' | 'complex' | 'filter-heavy' | 'result-heavy'): QueryOptimizationStrategy {
    switch (pattern) {
      case 'simple':
        return QueryOptimizationStrategy.HIGH_SPEED;
      case 'complex':
        return QueryOptimizationStrategy.HIGH_QUALITY;
      case 'filter-heavy':
        return QueryOptimizationStrategy.HIGH_SPEED;
      case 'result-heavy':
        return QueryOptimizationStrategy.BALANCED;
      default:
        return QueryOptimizationStrategy.BALANCED;
    }
  }

  async getTaskMetrics(): Promise<ExtendedTaskMetrics[]> {
    return this.taskMetrics;
  }

  async getQueueStats(): Promise<ExtendedQueueStats[]> {
    return this.queueStats;
  }

  async updateConfig(config: Partial<MonitoringConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.restartCollection();
  }
} 