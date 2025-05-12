import type { QueryMetrics } from '../query/query-performance';
import type { TaskMetrics } from '../../../../lib/agents/base/managers/TaskManager';
import type { PerformanceMetrics as AgentPerformanceMetrics } from '../../../../lib/agents/base/managers/ReflectionManager';
import type { OperationQueueStats } from '../client/types';

/**
 * System-wide performance metrics
 */
export interface SystemMetrics {
  /** CPU usage percentage */
  cpuUsage: number;
  
  /** Memory usage in bytes */
  memoryUsage: number;
  
  /** Active connections count */
  activeConnections: number;
  
  /** Request rate (requests per second) */
  requestRate: number;
  
  /** Error rate (errors per second) */
  errorRate: number;
  
  /** Average response time in milliseconds */
  avgResponseTime: number;
  
  /** Timestamp of metrics collection */
  timestamp: Date;
}

/**
 * Unified monitoring service configuration
 */
export interface MonitoringConfig {
  /** Whether to enable detailed metrics collection */
  enableDetailedMetrics: boolean;
  
  /** Metrics collection interval in milliseconds */
  collectionIntervalMs: number;
  
  /** Metrics retention period in milliseconds */
  metricsRetentionMs: number;
  
  /** Alert thresholds */
  alertThresholds: {
    /** Maximum CPU usage percentage */
    maxCpuUsage: number;
    
    /** Maximum memory usage in bytes */
    maxMemoryUsage: number;
    
    /** Maximum error rate (errors per second) */
    maxErrorRate: number;
    
    /** Maximum average response time in milliseconds */
    maxAvgResponseTime: number;
    
    /** Minimum cache hit rate (0-1) */
    minCacheHitRate: number;
  };
  
  /** Whether to enable automatic optimization */
  enableAutoOptimization: boolean;
}

/**
 * Unified monitoring service interface
 */
export interface IMonitoringService {
  /**
   * Record system metrics
   */
  recordSystemMetrics(metrics: SystemMetrics): Promise<void>;
  
  /**
   * Record query performance metrics
   */
  recordQueryMetrics(metrics: QueryMetrics, queryId: string): Promise<void>;
  
  /**
   * Record task performance metrics
   */
  recordTaskMetrics(metrics: TaskMetrics): Promise<void>;
  
  /**
   * Record agent performance metrics
   */
  recordAgentMetrics(metrics: AgentPerformanceMetrics, agentId: string): Promise<void>;
  
  /**
   * Record operation queue metrics
   */
  recordQueueMetrics(stats: OperationQueueStats): Promise<void>;
  
  /**
   * Get current system metrics
   */
  getSystemMetrics(): Promise<SystemMetrics>;
  
  /**
   * Get query performance analysis
   */
  getQueryAnalysis(queryId: string): Promise<{
    pattern: 'simple' | 'complex' | 'filter-heavy' | 'result-heavy';
    recommendedStrategy: string;
    bottlenecks: string[];
    suggestions: string[];
  }>;
  
  /**
   * Get task performance metrics
   */
  getTaskMetrics(): Promise<ExtendedTaskMetrics[]>;
  
  /**
   * Get agent performance metrics
   */
  getAgentMetrics(agentId: string): Promise<AgentPerformanceMetrics>;
  
  /**
   * Get operation queue statistics
   */
  getQueueStats(): Promise<ExtendedQueueStats[]>;
  
  /**
   * Get system health status
   */
  getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    recommendations: string[];
  }>;
  
  /**
   * Update monitoring configuration
   */
  updateConfig(config: Partial<MonitoringConfig>): Promise<void>;
  
  /**
   * Clear old metrics
   */
  clearOldMetrics(): Promise<void>;
  
  /**
   * Register alert handler
   */
  onAlert(handler: (alert: any) => void): void;
}

/**
 * Default monitoring configuration
 */
export const DEFAULT_MONITORING_CONFIG: Required<MonitoringConfig> = {
  enableDetailedMetrics: true,
  collectionIntervalMs: 5000, // 5 seconds
  metricsRetentionMs: 86400000, // 24 hours
  alertThresholds: {
    maxCpuUsage: 80, // 80%
    maxMemoryUsage: 1073741824, // 1GB
    maxErrorRate: 10, // 10 errors per second
    maxAvgResponseTime: 1000, // 1 second
    minCacheHitRate: 0.8 // 80%
  },
  enableAutoOptimization: true
};

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  issues: string[];
  recommendations: string[];
}

export interface ExtendedQueryMetrics extends QueryMetrics {
  timestamp: Date;
}

export interface ExtendedTaskMetrics extends TaskMetrics {
  timestamp: Date;
}

export interface ExtendedQueueStats extends OperationQueueStats {
  timestamp: Date;
}

export type AlertType = 'system' | 'query' | 'task' | 'agent' | 'queue';
export type AlertSeverity = 'warning' | 'critical';

export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metrics: unknown;
  queryId?: string;
  agentId?: string;
} 