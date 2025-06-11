/**
 * Agent Metrics Collection
 * 
 * This module provides functionality to collect and track metrics
 * about agent initialization and performance.
 */

import { AgentBase } from '../../agents/shared/base/AgentBase.interface';
import { logger } from '../../lib/logging';
import { agentBootstrapRegistry, AgentBootstrapState } from './agent-bootstrap-registry';
import { AgentHealthStatus } from './agent-health-check';

/**
 * Agent metrics categories
 */
export enum MetricCategory {
  INITIALIZATION = 'initialization',
  PERFORMANCE = 'performance',
  HEALTH = 'health',
  RESOURCE_USAGE = 'resource_usage',
  OPERATION = 'operation'
}

/**
 * Agent metric data point
 */
export interface AgentMetric {
  agentId: string;
  metricName: string;
  category: MetricCategory;
  value: number | string | boolean | Record<string, any>;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * In-memory storage for recent metrics
 */
class AgentMetricsStore {
  private static instance: AgentMetricsStore;
  private metrics: Map<string, AgentMetric[]>;
  private maxMetricsPerAgent: number = 1000;
  
  private constructor() {
    this.metrics = new Map();
    logger.info('Agent metrics store initialized');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): AgentMetricsStore {
    if (!AgentMetricsStore.instance) {
      AgentMetricsStore.instance = new AgentMetricsStore();
    }
    return AgentMetricsStore.instance;
  }
  
  /**
   * Record a new metric for an agent
   * 
   * @param metric The metric to record
   */
  public recordMetric(metric: AgentMetric): void {
    if (!this.metrics.has(metric.agentId)) {
      this.metrics.set(metric.agentId, []);
    }
    
    const agentMetrics = this.metrics.get(metric.agentId)!;
    
    // Add the new metric
    agentMetrics.push(metric);
    
    // Trim if we have too many metrics
    if (agentMetrics.length > this.maxMetricsPerAgent) {
      this.metrics.set(
        metric.agentId,
        agentMetrics.slice(agentMetrics.length - this.maxMetricsPerAgent)
      );
    }
  }
  
  /**
   * Get metrics for a specific agent
   * 
   * @param agentId The agent ID
   * @param category Optional category filter
   * @param limit Maximum number of metrics to return
   * @returns The agent's metrics
   */
  public getAgentMetrics(
    agentId: string,
    category?: MetricCategory,
    limit?: number
  ): AgentMetric[] {
    if (!this.metrics.has(agentId)) {
      return [];
    }
    
    let metrics = this.metrics.get(agentId)!;
    
    // Filter by category if provided
    if (category) {
      metrics = metrics.filter(m => m.category === category);
    }
    
    // Sort by timestamp (newest first)
    metrics = metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Apply limit if provided
    if (limit && limit > 0) {
      metrics = metrics.slice(0, limit);
    }
    
    return metrics;
  }
  
  /**
   * Get the latest value of a specific metric for an agent
   * 
   * @param agentId The agent ID
   * @param metricName The metric name
   * @returns The latest metric value or undefined if not found
   */
  public getLatestMetricValue(
    agentId: string,
    metricName: string
  ): AgentMetric | undefined {
    if (!this.metrics.has(agentId)) {
      return undefined;
    }
    
    const metrics = this.metrics.get(agentId)!
      .filter(m => m.metricName === metricName)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return metrics.length > 0 ? metrics[0] : undefined;
  }
  
  /**
   * Get all agent IDs with recorded metrics
   * 
   * @returns Array of agent IDs
   */
  public getAgentIds(): string[] {
    return Array.from(this.metrics.keys());
  }
  
  /**
   * Clear metrics for a specific agent or all agents
   * 
   * @param agentId Optional agent ID to clear metrics for
   */
  public clearMetrics(agentId?: string): void {
    if (agentId) {
      this.metrics.delete(agentId);
    } else {
      this.metrics.clear();
    }
  }
}

// Export the singleton instance
export const agentMetricsStore = AgentMetricsStore.getInstance();

/**
 * Record an initialization metric for an agent
 * 
 * @param agent The agent
 * @param metricName The metric name
 * @param value The metric value
 * @param metadata Additional metadata
 */
export function recordInitializationMetric(
  agent: AgentBase,
  metricName: string,
  value: number | string | boolean | Record<string, any>,
  metadata: Record<string, any> = {}
): void {
  const agentId = agent.getAgentId();
  
  const metric: AgentMetric = {
    agentId,
    metricName,
    category: MetricCategory.INITIALIZATION,
    value,
    timestamp: new Date(),
    metadata
  };
  
  agentMetricsStore.recordMetric(metric);
  
  logger.debug(`Recorded initialization metric for agent ${agentId}: ${metricName}`, {
    agentId,
    metricName,
    value,
    metadata
  });
}

/**
 * Record an agent operation metric
 * 
 * @param agent The agent
 * @param operation The operation name
 * @param durationMs The operation duration in milliseconds
 * @param success Whether the operation was successful
 * @param metadata Additional metadata
 */
export function recordOperationMetric(
  agent: AgentBase,
  operation: string,
  durationMs: number,
  success: boolean,
  metadata: Record<string, any> = {}
): void {
  const agentId = agent.getAgentId();
  
  const metric: AgentMetric = {
    agentId,
    metricName: `operation_${operation}`,
    category: MetricCategory.OPERATION,
    value: {
      durationMs,
      success
    },
    timestamp: new Date(),
    metadata
  };
  
  agentMetricsStore.recordMetric(metric);
  
  logger.debug(`Recorded operation metric for agent ${agentId}: ${operation}`, {
    agentId,
    operation,
    durationMs,
    success,
    metadata
  });
}

/**
 * Record a health metric for an agent
 * 
 * @param agent The agent
 * @param status The health status
 * @param checksPerformed Array of checks performed
 * @param metadata Additional metadata
 */
export function recordHealthMetric(
  agent: AgentBase,
  status: AgentHealthStatus,
  checksPerformed: string[],
  metadata: Record<string, any> = {}
): void {
  const agentId = agent.getAgentId();
  
  const metric: AgentMetric = {
    agentId,
    metricName: 'health_status',
    category: MetricCategory.HEALTH,
    value: {
      status,
      checksPerformed
    },
    timestamp: new Date(),
    metadata
  };
  
  agentMetricsStore.recordMetric(metric);
  
  logger.debug(`Recorded health metric for agent ${agentId}: ${status}`, {
    agentId,
    status,
    checksPerformed,
    metadata
  });
}

/**
 * Record resource usage metrics for an agent
 * 
 * @param agent The agent
 * @param memoryUsageBytes Memory usage in bytes
 * @param cpuUsagePercent CPU usage percentage
 * @param metadata Additional metadata
 */
export function recordResourceUsageMetric(
  agent: AgentBase,
  memoryUsageBytes: number,
  cpuUsagePercent: number,
  metadata: Record<string, any> = {}
): void {
  const agentId = agent.getAgentId();
  
  const metric: AgentMetric = {
    agentId,
    metricName: 'resource_usage',
    category: MetricCategory.RESOURCE_USAGE,
    value: {
      memoryUsageBytes,
      cpuUsagePercent
    },
    timestamp: new Date(),
    metadata
  };
  
  agentMetricsStore.recordMetric(metric);
  
  // Only log in development or when debug flag is set
  if (process.env.NODE_ENV === 'development' || process.env.AGENT_METRICS_DEBUG === 'true') {
    logger.debug(`Recorded resource usage metric for agent ${agentId}`, {
      agentId,
      memoryUsageBytes,
      cpuUsagePercent,
      metadata
    });
  }
}

/**
 * Get summary metrics for all agents
 * 
 * @returns Summary metrics for all agents
 */
export function getAgentsSummaryMetrics(): Record<string, any> {
  // Get all agents from bootstrap registry
  const agentIds = agentBootstrapRegistry.getAllRegisteredAgentIds();
  
  const summary: Record<string, any> = {
    totalAgents: agentIds.length,
    agentsByState: {
      [AgentBootstrapState.NOT_STARTED]: 0,
      [AgentBootstrapState.IN_PROGRESS]: 0,
      [AgentBootstrapState.COMPLETED]: 0,
      [AgentBootstrapState.FAILED]: 0
    },
    initializationSuccessRate: 0,
    averageInitializationTime: 0,
    failedAgents: []
  };
  
  // Count agents by state
  for (const agentId of agentIds) {
    const info = agentBootstrapRegistry.getAgentBootstrapInfo(agentId);
    if (info) {
      summary.agentsByState[info.state]++;
      
      // Collect failed agents
      if (info.state === AgentBootstrapState.FAILED) {
        summary.failedAgents.push({
          agentId,
          agentName: info.agentName,
          error: info.error?.message || 'Unknown error'
        });
      }
      
      // Calculate initialization time if completed
      if (info.state === AgentBootstrapState.COMPLETED && info.startTime && info.endTime) {
        const initTime = info.endTime.getTime() - info.startTime.getTime();
        
        // Record this for averaging later
        if (!summary.initTimes) {
          summary.initTimes = [];
        }
        summary.initTimes.push(initTime);
      }
    }
  }
  
  // Calculate success rate
  const attemptedAgents = summary.agentsByState[AgentBootstrapState.COMPLETED] + 
                          summary.agentsByState[AgentBootstrapState.FAILED];
  
  if (attemptedAgents > 0) {
    summary.initializationSuccessRate = summary.agentsByState[AgentBootstrapState.COMPLETED] / attemptedAgents;
  }
  
  // Calculate average initialization time
  if (summary.initTimes && summary.initTimes.length > 0) {
    const totalTime = summary.initTimes.reduce((sum: number, time: number) => sum + time, 0);
    summary.averageInitializationTime = totalTime / summary.initTimes.length;
    delete summary.initTimes; // Remove the raw data
  }
  
  return summary;
}

/**
 * Start collecting agent resource usage metrics
 * 
 * @param agent The agent to monitor
 * @param intervalMs Interval between collections in milliseconds
 * @returns Function to stop metrics collection
 */
export function startResourceMetricsCollection(
  agent: AgentBase,
  intervalMs: number = 60000 // 1 minute
): () => void {
  const agentId = agent.getAgentId();
  
  logger.info(`Starting resource metrics collection for agent ${agentId}`, {
    agentId,
    intervalMs
  });
  
  // Schedule periodic collection
  const intervalId = setInterval(() => {
    try {
      // This is a simplified version - in a real implementation,
      // you would use process.memoryUsage() or a similar method
      // to get actual resource usage
      
      // Mock values for demonstration
      const memoryUsageBytes = Math.floor(Math.random() * 100000000); // Random value up to ~100MB
      const cpuUsagePercent = Math.random() * 10; // Random value up to 10%
      
      recordResourceUsageMetric(agent, memoryUsageBytes, cpuUsagePercent);
    } catch (error) {
      logger.error(`Error collecting resource metrics for agent ${agentId}`, {
        agentId,
        error
      });
    }
  }, intervalMs);
  
  // Return function to stop collection
  return () => {
    clearInterval(intervalId);
    logger.info(`Stopped resource metrics collection for agent ${agentId}`, { agentId });
  };
} 