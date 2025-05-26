import { createLogger } from '../../../lib/logging/winston-logger';

export interface MetricValue {
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface MetricSeries {
  name: string;
  values: MetricValue[];
  aggregationType: AggregationType;
  retentionPeriod: number; // in milliseconds
}

export enum AggregationType {
  SUM = 'sum',
  AVERAGE = 'average',
  COUNT = 'count',
  MIN = 'min',
  MAX = 'max',
  LAST = 'last',
  RATE = 'rate',
  PERCENTILE = 'percentile'
}

export interface MetricAggregation {
  value: number;
  count: number;
  min: number;
  max: number;
  sum: number;
  average: number;
  percentiles?: Record<number, number>;
}

export interface PerformanceMetrics {
  executionTime: MetricAggregation;
  memoryUsage: MetricAggregation;
  cpuUsage: MetricAggregation;
  taskThroughput: MetricAggregation;
  errorRate: MetricAggregation;
  successRate: MetricAggregation;
}

export interface ResourceMetrics {
  memoryAllocated: number;
  memoryUsed: number;
  cpuTime: number;
  networkRequests: number;
  diskOperations: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface OperationalMetrics {
  tasksCompleted: number;
  tasksInProgress: number;
  tasksFailed: number;
  averageResponseTime: number;
  uptime: number;
  restarts: number;
  configChanges: number;
}

export interface MetricAlert {
  id: string;
  metricName: string;
  condition: AlertCondition;
  threshold: number;
  severity: AlertSeverity;
  isActive: boolean;
  triggeredAt?: Date;
  resolvedAt?: Date;
  message: string;
}

export interface AlertCondition {
  operator: ComparisonOperator;
  timeWindow: number; // in milliseconds
  evaluationPeriod: number; // in milliseconds
}

export enum ComparisonOperator {
  GREATER_THAN = 'gt',
  LESS_THAN = 'lt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN_OR_EQUAL = 'lte',
  EQUAL = 'eq',
  NOT_EQUAL = 'ne'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface MetricsConfig {
  enableCollection: boolean;
  collectionInterval: number;
  retentionPeriod: number;
  enableAggregation: boolean;
  aggregationInterval: number;
  enableAlerts: boolean;
  maxMetricSeries: number;
  enableExport: boolean;
  exportInterval: number;
  exportFormat: ExportFormat;
}

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  PROMETHEUS = 'prometheus',
  INFLUXDB = 'influxdb'
}

export interface MetricExport {
  timestamp: Date;
  agentId: string;
  metrics: Record<string, MetricAggregation>;
  format: ExportFormat;
  data: string;
}

export interface MetricQuery {
  metricName: string;
  startTime: Date;
  endTime: Date;
  aggregationType?: AggregationType;
  groupBy?: string[];
  filters?: Record<string, string>;
}

export interface MetricQueryResult {
  metricName: string;
  aggregation: MetricAggregation;
  series: MetricValue[];
  groupedResults?: Record<string, MetricAggregation>;
}

export class AgentMetrics {
  private logger: ReturnType<typeof createLogger>;
  private config: MetricsConfig;
  private metrics: Map<string, MetricSeries>;
  private alerts: Map<string, MetricAlert>;
  private aggregations: Map<string, MetricAggregation>;
  private collectionTimer?: NodeJS.Timeout;
  private aggregationTimer?: NodeJS.Timeout;
  private exportTimer?: NodeJS.Timeout;
  private startTime: Date;
  private agentId: string;

  constructor(agentId: string, config: MetricsConfig, logger?: ReturnType<typeof createLogger>) {
    this.agentId = agentId;
    this.config = config;
    this.logger = logger || createLogger({
      moduleId: 'agent-metrics',
      agentId: agentId
    });
    this.metrics = new Map();
    this.alerts = new Map();
    this.aggregations = new Map();
    this.startTime = new Date();

    if (this.config.enableCollection) {
      this.startCollection();
    }

    if (this.config.enableAggregation) {
      this.startAggregation();
    }

    if (this.config.enableExport) {
      this.startExport();
    }

    this.initializeDefaultMetrics();
  }

  public recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enableCollection) {
      return;
    }

    try {
      let series = this.metrics.get(name);
      if (!series) {
        series = {
          name,
          values: [],
          aggregationType: AggregationType.AVERAGE,
          retentionPeriod: this.config.retentionPeriod
        };
        this.metrics.set(name, series);
      }

      const metricValue: MetricValue = {
        value,
        timestamp: new Date(),
        tags,
        metadata
      };

      series.values.push(metricValue);
      this.cleanupOldValues(series);

      // Check if we've exceeded the maximum number of series
      if (this.metrics.size > this.config.maxMetricSeries) {
        this.pruneOldestSeries();
      }

      // Check alerts
      if (this.config.enableAlerts) {
        this.checkAlerts(name, value);
      }

      this.logger.debug('Metric recorded', {
        name,
        value,
        tags,
        seriesLength: series.values.length
      });

    } catch (error) {
      this.logger.error('Failed to record metric', {
        name,
        value,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  public incrementCounter(name: string, tags?: Record<string, string>): void {
    this.recordMetric(name, 1, tags);
  }

  public recordTiming(name: string, duration: number, tags?: Record<string, string>): void {
    this.recordMetric(name, duration, { ...tags, type: 'timing' });
  }

  public recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, { ...tags, type: 'gauge' });
  }

  public recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, { ...tags, type: 'histogram' });
  }

  public getMetric(name: string): MetricSeries | undefined {
    return this.metrics.get(name);
  }

  public getAllMetrics(): Map<string, MetricSeries> {
    return new Map(this.metrics);
  }

  public getAggregation(name: string): MetricAggregation | undefined {
    return this.aggregations.get(name);
  }

  public getAllAggregations(): Map<string, MetricAggregation> {
    return new Map(this.aggregations);
  }

  public queryMetrics(query: MetricQuery): MetricQueryResult | null {
    const series = this.metrics.get(query.metricName);
    if (!series) {
      return null;
    }

    // Filter by time range
    const filteredValues = series.values.filter(value => 
      value.timestamp >= query.startTime && value.timestamp <= query.endTime
    );

    // Apply additional filters
    let finalValues = filteredValues;
    if (query.filters) {
      finalValues = filteredValues.filter(value => {
        if (!value.tags) return false;
        return Object.entries(query.filters!).every(([key, filterValue]) => 
          value.tags![key] === filterValue
        );
      });
    }

    // Calculate aggregation
    const aggregation = this.calculateAggregation(finalValues);

    // Group by if specified
    let groupedResults: Record<string, MetricAggregation> | undefined;
    if (query.groupBy && query.groupBy.length > 0) {
      groupedResults = this.groupMetrics(finalValues, query.groupBy);
    }

    return {
      metricName: query.metricName,
      aggregation,
      series: finalValues,
      groupedResults
    };
  }

  public createAlert(alert: Omit<MetricAlert, 'id' | 'isActive'>): string {
    const alertId = this.generateAlertId();
    const fullAlert: MetricAlert = {
      ...alert,
      id: alertId,
      isActive: false
    };

    this.alerts.set(alertId, fullAlert);
    this.logger.info('Alert created', { alertId, metricName: alert.metricName });
    
    return alertId;
  }

  public removeAlert(alertId: string): boolean {
    const removed = this.alerts.delete(alertId);
    if (removed) {
      this.logger.info('Alert removed', { alertId });
    }
    return removed;
  }

  public getAlert(alertId: string): MetricAlert | undefined {
    return this.alerts.get(alertId);
  }

  public getActiveAlerts(): MetricAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.isActive);
  }

  public getPerformanceMetrics(): PerformanceMetrics {
    return {
      executionTime: this.getAggregation('execution_time') || this.createEmptyAggregation(),
      memoryUsage: this.getAggregation('memory_usage') || this.createEmptyAggregation(),
      cpuUsage: this.getAggregation('cpu_usage') || this.createEmptyAggregation(),
      taskThroughput: this.getAggregation('task_throughput') || this.createEmptyAggregation(),
      errorRate: this.getAggregation('error_rate') || this.createEmptyAggregation(),
      successRate: this.getAggregation('success_rate') || this.createEmptyAggregation()
    };
  }

  public getResourceMetrics(): ResourceMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memoryAllocated: memUsage.heapTotal,
      memoryUsed: memUsage.heapUsed,
      cpuTime: cpuUsage.user + cpuUsage.system,
      networkRequests: this.getLatestValue('network_requests') || 0,
      diskOperations: this.getLatestValue('disk_operations') || 0,
      cacheHits: this.getLatestValue('cache_hits') || 0,
      cacheMisses: this.getLatestValue('cache_misses') || 0
    };
  }

  public getOperationalMetrics(): OperationalMetrics {
    const uptime = Date.now() - this.startTime.getTime();

    return {
      tasksCompleted: this.getLatestValue('tasks_completed') || 0,
      tasksInProgress: this.getLatestValue('tasks_in_progress') || 0,
      tasksFailed: this.getLatestValue('tasks_failed') || 0,
      averageResponseTime: this.getAggregation('response_time')?.average || 0,
      uptime,
      restarts: this.getLatestValue('restarts') || 0,
      configChanges: this.getLatestValue('config_changes') || 0
    };
  }

  public exportMetrics(format: ExportFormat = this.config.exportFormat): MetricExport {
    const aggregations: Record<string, MetricAggregation> = {};
    Array.from(this.aggregations.entries()).forEach(([name, agg]) => {
      aggregations[name] = agg;
    });

    let data: string;
    switch (format) {
      case ExportFormat.JSON:
        data = JSON.stringify(aggregations, null, 2);
        break;
      case ExportFormat.CSV:
        data = this.exportToCSV(aggregations);
        break;
      case ExportFormat.PROMETHEUS:
        data = this.exportToPrometheus(aggregations);
        break;
      case ExportFormat.INFLUXDB:
        data = this.exportToInfluxDB(aggregations);
        break;
      default:
        data = JSON.stringify(aggregations);
    }

    return {
      timestamp: new Date(),
      agentId: this.agentId,
      metrics: aggregations,
      format,
      data
    };
  }

  public reset(): void {
    this.metrics.clear();
    this.aggregations.clear();
    this.alerts.clear();
    this.startTime = new Date();
    this.logger.info('Metrics reset');
  }

  public stop(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    if (this.exportTimer) {
      clearInterval(this.exportTimer);
    }
    this.logger.info('Metrics collection stopped');
  }

  private startCollection(): void {
    this.collectionTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.collectionInterval);
  }

  private startAggregation(): void {
    this.aggregationTimer = setInterval(() => {
      this.updateAggregations();
    }, this.config.aggregationInterval);
  }

  private startExport(): void {
    this.exportTimer = setInterval(() => {
      const exported = this.exportMetrics();
      this.logger.info('Metrics exported', {
        format: exported.format,
        dataSize: exported.data.length
      });
    }, this.config.exportInterval);
  }

  private collectSystemMetrics(): void {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      this.recordGauge('memory_heap_used', memUsage.heapUsed);
      this.recordGauge('memory_heap_total', memUsage.heapTotal);
      this.recordGauge('memory_external', memUsage.external);
      this.recordGauge('cpu_user', cpuUsage.user);
      this.recordGauge('cpu_system', cpuUsage.system);

      // Record uptime
      const uptime = Date.now() - this.startTime.getTime();
      this.recordGauge('uptime', uptime);

    } catch (error) {
      this.logger.error('Failed to collect system metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private updateAggregations(): void {
    Array.from(this.metrics.entries()).forEach(([name, series]) => {
      try {
        const aggregation = this.calculateAggregation(series.values);
        this.aggregations.set(name, aggregation);
      } catch (error) {
        this.logger.error('Failed to update aggregation', {
          metricName: name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  private calculateAggregation(values: MetricValue[]): MetricAggregation {
    if (values.length === 0) {
      return this.createEmptyAggregation();
    }

    const numericValues = values.map(v => v.value);
    const sum = numericValues.reduce((a, b) => a + b, 0);
    const count = numericValues.length;
    const average = sum / count;
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);

    // Calculate percentiles
    const sorted = [...numericValues].sort((a, b) => a - b);
    const percentiles: Record<number, number> = {};
    [50, 90, 95, 99].forEach(p => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      percentiles[p] = sorted[Math.max(0, index)];
    });

    return {
      value: numericValues[numericValues.length - 1], // last value
      count,
      min,
      max,
      sum,
      average,
      percentiles
    };
  }

  private groupMetrics(values: MetricValue[], groupBy: string[]): Record<string, MetricAggregation> {
    const groups: Record<string, MetricValue[]> = {};

    for (const value of values) {
      if (!value.tags) continue;

      const groupKey = groupBy
        .map(key => `${key}:${value.tags![key] || 'unknown'}`)
        .join(',');

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(value);
    }

    const result: Record<string, MetricAggregation> = {};
    for (const [groupKey, groupValues] of Object.entries(groups)) {
      result[groupKey] = this.calculateAggregation(groupValues);
    }

    return result;
  }

  private checkAlerts(metricName: string, value: number): void {
    Array.from(this.alerts.values()).forEach(alert => {
      if (alert.metricName !== metricName) return;

      const shouldTrigger = this.evaluateAlertCondition(alert, value);

      if (shouldTrigger && !alert.isActive) {
        alert.isActive = true;
        alert.triggeredAt = new Date();
        this.logger.warn('Alert triggered', {
          alertId: alert.id,
          metricName,
          value,
          threshold: alert.threshold
        });
      } else if (!shouldTrigger && alert.isActive) {
        alert.isActive = false;
        alert.resolvedAt = new Date();
        this.logger.info('Alert resolved', {
          alertId: alert.id,
          metricName,
          value
        });
      }
    });
  }

  private evaluateAlertCondition(alert: MetricAlert, value: number): boolean {
    switch (alert.condition.operator) {
      case ComparisonOperator.GREATER_THAN:
        return value > alert.threshold;
      case ComparisonOperator.LESS_THAN:
        return value < alert.threshold;
      case ComparisonOperator.GREATER_THAN_OR_EQUAL:
        return value >= alert.threshold;
      case ComparisonOperator.LESS_THAN_OR_EQUAL:
        return value <= alert.threshold;
      case ComparisonOperator.EQUAL:
        return value === alert.threshold;
      case ComparisonOperator.NOT_EQUAL:
        return value !== alert.threshold;
      default:
        return false;
    }
  }

  private cleanupOldValues(series: MetricSeries): void {
    const cutoffTime = Date.now() - series.retentionPeriod;
    series.values = series.values.filter(value => 
      value.timestamp.getTime() > cutoffTime
    );
  }

  private pruneOldestSeries(): void {
    // Find the series with the oldest last update
    let oldestSeries: string | null = null;
    let oldestTime = Date.now();

    Array.from(this.metrics.entries()).forEach(([name, series]) => {
      if (series.values.length === 0) {
        oldestSeries = name;
        return;
      }

      const lastUpdate = series.values[series.values.length - 1].timestamp.getTime();
      if (lastUpdate < oldestTime) {
        oldestTime = lastUpdate;
        oldestSeries = name;
      }
    });

    if (oldestSeries) {
      this.metrics.delete(oldestSeries);
      this.aggregations.delete(oldestSeries);
      this.logger.info('Pruned oldest metric series', { seriesName: oldestSeries });
    }
  }

  private getLatestValue(metricName: string): number | undefined {
    const series = this.metrics.get(metricName);
    if (!series || series.values.length === 0) {
      return undefined;
    }
    return series.values[series.values.length - 1].value;
  }

  private createEmptyAggregation(): MetricAggregation {
    return {
      value: 0,
      count: 0,
      min: 0,
      max: 0,
      sum: 0,
      average: 0,
      percentiles: { 50: 0, 90: 0, 95: 0, 99: 0 }
    };
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private exportToCSV(aggregations: Record<string, MetricAggregation>): string {
    const headers = ['metric_name', 'value', 'count', 'min', 'max', 'sum', 'average'];
    const rows = [headers.join(',')];

    for (const [name, agg] of Object.entries(aggregations)) {
      const row = [
        name,
        agg.value.toString(),
        agg.count.toString(),
        agg.min.toString(),
        agg.max.toString(),
        agg.sum.toString(),
        agg.average.toString()
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private exportToPrometheus(aggregations: Record<string, MetricAggregation>): string {
    const lines: string[] = [];

    for (const [name, agg] of Object.entries(aggregations)) {
      const metricName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`# HELP ${metricName} Agent metric`);
      lines.push(`# TYPE ${metricName} gauge`);
      lines.push(`${metricName}{agent_id="${this.agentId}"} ${agg.value}`);
    }

    return lines.join('\n');
  }

  private exportToInfluxDB(aggregations: Record<string, MetricAggregation>): string {
    const lines: string[] = [];
    const timestamp = Date.now() * 1000000; // nanoseconds

    for (const [name, agg] of Object.entries(aggregations)) {
      const measurement = name.replace(/[^a-zA-Z0-9_]/g, '_');
      const tags = `agent_id=${this.agentId}`;
      const fields = [
        `value=${agg.value}`,
        `count=${agg.count}`,
        `min=${agg.min}`,
        `max=${agg.max}`,
        `sum=${agg.sum}`,
        `average=${agg.average}`
      ].join(',');
      
      lines.push(`${measurement},${tags} ${fields} ${timestamp}`);
    }

    return lines.join('\n');
  }

  private initializeDefaultMetrics(): void {
    // Initialize some default metrics
    this.recordGauge('agent_started', 1, { agent_id: this.agentId });
    this.recordGauge('start_time', this.startTime.getTime());
  }
}

export default AgentMetrics; 