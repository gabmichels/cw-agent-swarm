import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MonitoringService } from './monitoring-service';
import { QueryOptimizationStrategy } from '../query/types';
import { TaskStatus, TaskPriority } from '../../../../lib/agents/base/managers/TaskManager';
import type { SystemMetrics, MonitoringConfig } from './types';
import type { QueryMetrics } from '../query/query-performance';
import type { TaskMetrics } from '../../../../lib/agents/base/managers/TaskManager';
import type { PerformanceMetrics as AgentPerformanceMetrics } from '../../../../lib/agents/base/managers/ReflectionManager';
import type { OperationQueueStats } from '../client/types';
import { EventEmitter } from 'node:events';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let mockConfig: Partial<MonitoringConfig>;

  beforeEach(() => {
    mockConfig = {
      collectionIntervalMs: 100, // Short interval for testing
      metricsRetentionMs: 1000, // Short retention for testing
      alertThresholds: {
        maxCpuUsage: 80,
        maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
        maxErrorRate: 10,
        maxAvgResponseTime: 1000,
        minCacheHitRate: 0.8
      }
    };
    service = new MonitoringService(mockConfig);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    service = new MonitoringService(mockConfig); // Reset service state
  });

  describe('System Metrics', () => {
    it('should record and retrieve system metrics', async () => {
      const metrics: SystemMetrics = {
        cpuUsage: 50,
        memoryUsage: 512 * 1024 * 1024, // 512MB
        activeConnections: 10,
        requestRate: 5,
        errorRate: 1,
        avgResponseTime: 100,
        timestamp: new Date()
      };

      await service.recordSystemMetrics(metrics);
      const retrieved = await service.getSystemMetrics();

      expect(retrieved.cpuUsage).toBeGreaterThan(0);
      expect(retrieved.memoryUsage).toBeGreaterThan(0);
      expect(retrieved.activeConnections).toBeDefined();
      expect(retrieved.requestRate).toBeDefined();
      expect(retrieved.errorRate).toBeDefined();
      expect(retrieved.avgResponseTime).toBeDefined();
    });

    it('should emit alerts for high system metrics', async () => {
      const alertHandler = vi.fn();
      service.onAlert(alertHandler);

      const metrics: SystemMetrics = {
        cpuUsage: 90, // Above threshold
        memoryUsage: 512 * 1024 * 1024,
        activeConnections: 10,
        requestRate: 5,
        errorRate: 1,
        avgResponseTime: 100,
        timestamp: new Date()
      };

      await service.recordSystemMetrics(metrics);

      expect(alertHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'system',
        severity: 'critical',
        message: expect.stringContaining('High CPU usage')
      }));
    });
  });

  describe('Query Metrics', () => {
    it('should record and analyze query metrics', async () => {
      const metrics: QueryMetrics = {
        executionTimeMs: 500,
        cacheStatus: 'hit',
        resultCount: 10,
        strategy: QueryOptimizationStrategy.BALANCED,
        complexityScore: 0.5,
        filterComplexityScore: 0.3,
        memoryUsageBytes: 1024 * 1024 // 1MB
      };

      const queryId = 'test-query-1';
      await service.recordQueryMetrics(metrics, queryId);
      const analysis = await service.getQueryAnalysis(queryId);

      expect(analysis.pattern).toBeDefined();
      expect(analysis.recommendedStrategy).toBeDefined();
      expect(analysis.bottlenecks).toBeInstanceOf(Array);
      expect(analysis.suggestions).toBeInstanceOf(Array);
    });

    it('should emit alerts for slow queries', async () => {
      const alertHandler = vi.fn();
      service.onAlert(alertHandler);

      const metrics: QueryMetrics = {
        executionTimeMs: 2000, // Above threshold
        cacheStatus: 'miss',
        resultCount: 10,
        strategy: QueryOptimizationStrategy.BALANCED,
        complexityScore: 0.8,
        filterComplexityScore: 0.3,
        memoryUsageBytes: 1024 * 1024
      };

      const queryId = 'test-query-2';
      await service.recordQueryMetrics(metrics, queryId);

      expect(alertHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'query',
        severity: 'critical',
        message: expect.stringContaining('Slow query execution')
      }));
    });
  });

  describe('Task Metrics', () => {
    it('should record and retrieve task metrics', async () => {
      const metrics: TaskMetrics = {
        totalTasks: 100,
        completedTasks: 90,
        failedTasks: 10,
        avgCompletionTimeMs: 500,
        successRate: 90,
        tasksByStatus: {
          [TaskStatus.PENDING]: 10,
          [TaskStatus.RUNNING]: 20,
          [TaskStatus.COMPLETED]: 60,
          [TaskStatus.FAILED]: 10
        } as Record<TaskStatus, number>,
        tasksByPriority: {
          [TaskPriority.LOW]: 20,
          [TaskPriority.NORMAL]: 50,
          [TaskPriority.HIGH]: 20,
          [TaskPriority.CRITICAL]: 10
        } as Record<TaskPriority, number>
      };

      await service.recordTaskMetrics(metrics);
      const retrieved = await service.getTaskMetrics();
      const latest = retrieved[retrieved.length - 1];

      expect(latest.totalTasks).toBe(100);
      expect(latest.completedTasks).toBe(90);
      expect(latest.failedTasks).toBe(10);
      expect(latest.successRate).toBe(90);
    });

    it('should emit alerts for low task success rate', async () => {
      const alertHandler = vi.fn();
      service.onAlert(alertHandler);

      const metrics: TaskMetrics = {
        totalTasks: 100,
        completedTasks: 25, // Below critical threshold (30%)
        failedTasks: 75,
        avgCompletionTimeMs: 500,
        successRate: 25,
        tasksByStatus: {
          [TaskStatus.PENDING]: 10,
          [TaskStatus.RUNNING]: 20,
          [TaskStatus.COMPLETED]: 25,
          [TaskStatus.FAILED]: 45
        } as Record<TaskStatus, number>,
        tasksByPriority: {
          [TaskPriority.LOW]: 20,
          [TaskPriority.NORMAL]: 50,
          [TaskPriority.HIGH]: 20,
          [TaskPriority.CRITICAL]: 10
        } as Record<TaskPriority, number>
      };

      await service.recordTaskMetrics(metrics);

      expect(alertHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'task',
        severity: 'critical',
        message: expect.stringContaining('Low task success rate')
      }));
    });
  });

  describe('Agent Metrics', () => {
    it('should record and retrieve agent metrics', async () => {
      const metrics: AgentPerformanceMetrics = {
        successRate: 0.9,
        taskCompletion: {
          completed: 90,
          failed: 10,
          averageTimeMs: 500
        },
        errors: {
          count: 5,
          byCategory: {
            'timeout': 2,
            'validation': 3
          },
          mostCommon: {
            type: 'validation',
            count: 3
          }
        },
        period: {
          start: new Date(Date.now() - 3600000),
          end: new Date()
        }
      };

      const agentId = 'test-agent-1';
      await service.recordAgentMetrics(metrics, agentId);
      const retrieved = await service.getAgentMetrics(agentId);

      expect(retrieved.successRate).toBe(0.9);
      expect(retrieved.taskCompletion.completed).toBe(90);
      expect(retrieved.taskCompletion.failed).toBe(10);
    });

    it('should emit alerts for low agent success rate', async () => {
      const alertHandler = vi.fn();
      service.onAlert(alertHandler);

      const metrics: AgentPerformanceMetrics = {
        successRate: 0.25, // Below critical threshold (30%)
        taskCompletion: {
          completed: 25,
          failed: 75,
          averageTimeMs: 500
        },
        errors: {
          count: 15,
          byCategory: {
            'timeout': 5,
            'validation': 10
          },
          mostCommon: {
            type: 'validation',
            count: 10
          }
        },
        period: {
          start: new Date(Date.now() - 3600000),
          end: new Date()
        }
      };

      const agentId = 'test-agent-2';
      await service.recordAgentMetrics(metrics, agentId);

      expect(alertHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent',
        severity: 'critical',
        message: expect.stringContaining('Low agent success rate')
      }));
    });
  });

  describe('Queue Metrics', () => {
    it('should record and retrieve queue metrics', async () => {
      const stats: OperationQueueStats = {
        size: 100,
        processing: 10,
        completed: 80,
        failed: 10,
        averageWaitTime: 500,
        averageProcessingTime: 200,
        rateLimit: 100
      };

      await service.recordQueueMetrics(stats);
      const retrieved = await service.getQueueStats();
      const latest = retrieved[retrieved.length - 1];

      expect(latest.size).toBe(100);
      expect(latest.processing).toBe(10);
      expect(latest.completed).toBe(80);
      expect(latest.failed).toBe(10);
    });

    it('should emit alerts for large queue size', async () => {
      const alertHandler = vi.fn();
      service.onAlert(alertHandler);

      const stats: OperationQueueStats = {
        size: 250, // Above critical threshold (200)
        processing: 100,
        completed: 5000,
        failed: 100,
        averageWaitTime: 500,
        averageProcessingTime: 200,
        rateLimit: 100
      };

      await service.recordQueueMetrics(stats);

      expect(alertHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'queue',
        severity: 'critical',
        message: expect.stringContaining('Large queue size')
      }));
    });
  });

  describe('Health Status', () => {
    it('should report healthy status when metrics are good', async () => {
      const metrics: SystemMetrics = {
        cpuUsage: 50,
        memoryUsage: 512 * 1024 * 1024,
        activeConnections: 10,
        requestRate: 5,
        errorRate: 1,
        avgResponseTime: 100,
        timestamp: new Date()
      };

      await service.recordSystemMetrics(metrics);
      const health = await service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.issues).toHaveLength(0);
    });

    it('should report degraded status when metrics are concerning', async () => {
      const metrics: SystemMetrics = {
        cpuUsage: 85,
        memoryUsage: 512 * 1024 * 1024,
        activeConnections: 10,
        requestRate: 5,
        errorRate: 1,
        avgResponseTime: 100,
        timestamp: new Date()
      };

      await service.recordSystemMetrics(metrics);
      const health = await service.getHealthStatus();

      expect(health.status).toBe('degraded');
      expect(health.issues).toContain('High CPU usage: 85.0%');
      expect(health.recommendations).toHaveLength(1);
    });

    it('should report critical status when metrics are severe', async () => {
      const metrics: SystemMetrics = {
        cpuUsage: 90, // At critical threshold (90%)
        memoryUsage: 1.5 * 1024 * 1024 * 1024, // 1.5GB (above critical threshold)
        activeConnections: 10,
        requestRate: 5,
        errorRate: 20, // At critical threshold (20%)
        avgResponseTime: 2000, // At critical threshold (2000ms)
        timestamp: new Date()
      };

      await service.recordSystemMetrics(metrics);
      const health = await service.getHealthStatus();

      expect(health.status).toBe('critical');
      expect(health.issues.length).toBeGreaterThan(1);
      expect(health.recommendations.length).toBeGreaterThan(1);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', async () => {
      const newConfig: Partial<MonitoringConfig> = {
        collectionIntervalMs: 200,
        alertThresholds: {
          maxCpuUsage: 90,
          maxMemoryUsage: 2 * 1024 * 1024 * 1024, // 2GB
          maxErrorRate: 20,
          maxAvgResponseTime: 2000,
          minCacheHitRate: 0.7
        }
      };

      await service.updateConfig(newConfig);
      const metrics: SystemMetrics = {
        cpuUsage: 85, // Would trigger alert with old config
        memoryUsage: 512 * 1024 * 1024,
        activeConnections: 10,
        requestRate: 5,
        errorRate: 1,
        avgResponseTime: 100,
        timestamp: new Date()
      };

      const alertHandler = vi.fn();
      service.onAlert(alertHandler);
      await service.recordSystemMetrics(metrics);

      expect(alertHandler).not.toHaveBeenCalled(); // No alert with new config
    });
  });

  describe('Metrics Cleanup', () => {
    it('should clear old metrics', async () => {
      const metrics: SystemMetrics = {
        cpuUsage: 50,
        memoryUsage: 512 * 1024 * 1024,
        activeConnections: 10,
        requestRate: 5,
        errorRate: 1,
        avgResponseTime: 100,
        timestamp: new Date(Date.now() - 2000) // 2 seconds old
      };

      await service.recordSystemMetrics(metrics);
      await service.clearOldMetrics();

      const retrieved = await service.getSystemMetrics();
      expect(retrieved.timestamp.getTime()).toBeGreaterThan(metrics.timestamp.getTime());
    });
  });
}); 