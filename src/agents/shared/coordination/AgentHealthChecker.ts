/**
 * AgentHealthChecker.ts - Monitors agent health, load, and quotas
 * 
 * This module provides:
 * - Tracking of agent health status
 * - Per-agent quota enforcement
 * - Failure rate monitoring
 * - Fallback routing to healthy agents
 */

import { AgentMonitor } from '../monitoring/AgentMonitor';

/**
 * Health status for an agent
 */
export interface AgentHealthStatus {
  agentId: string;             // Unique agent identifier
  healthy: boolean;            // Whether the agent is considered healthy
  failureRate: number;         // Current failure rate (0-1)
  lastActive: number;          // Last activity timestamp
  currentLoad: number;         // Current task count
  quota: number;               // Maximum concurrent tasks
  totalTasks: number;          // Lifetime total tasks
  successfulTasks: number;     // Lifetime successful tasks
  failedTasks: number;         // Lifetime failed tasks
  lastError?: string;          // Last error message
  lastErrorTime?: number;      // Last error timestamp
  metrics: {                   // Additional performance metrics
    avgResponseTimeMs?: number;
    uptimeMs?: number;
    startTime: number;
  };
}

/**
 * Agent health check configuration
 */
export interface AgentHealthConfig {
  healthCheckIntervalMs?: number;    // How often to run automatic health checks
  unhealthyFailureThreshold?: number; // Failure rate threshold to mark unhealthy
  inactivityThresholdMs?: number;    // Time after which inactive agents are marked unhealthy
  enableDetailedMetrics?: boolean;   // Whether to collect detailed metrics
  quotaEnforcement?: boolean;        // Whether to enforce quotas strictly
}

/**
 * Singleton class that tracks agent health and availability
 */
export class AgentHealthChecker {
  // Map of agent ID to health status
  private static healthMap: Record<string, AgentHealthStatus> = {};

  // Default configuration
  private static config: AgentHealthConfig = {
    healthCheckIntervalMs: 60000,           // 1 minute
    unhealthyFailureThreshold: 0.6,         // 60% failure rate = unhealthy
    inactivityThresholdMs: 5 * 60 * 1000,   // 5 minutes of inactivity = unhealthy
    enableDetailedMetrics: true,
    quotaEnforcement: true
  };

  // Interval handle for background health checks
  private static healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the health checker with config
   */
  static initialize(config?: Partial<AgentHealthConfig>): void {
    // Apply custom config over defaults
    if (config) {
      AgentHealthChecker.config = {
        ...AgentHealthChecker.config,
        ...config
      };
    }

    // Set up automatic health checks if interval is specified
    if (AgentHealthChecker.config.healthCheckIntervalMs) {
      AgentHealthChecker.startHealthChecks();
    }

    console.log('AgentHealthChecker initialized');
  }

  /**
   * Register an agent for health monitoring
   */
  static register(agentId: string, quota: number = 5): void {
    const now = Date.now();

    AgentHealthChecker.healthMap[agentId] = {
      agentId,
      healthy: true,
      failureRate: 0,
      lastActive: now,
      currentLoad: 0,
      quota,
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      metrics: {
        startTime: now
      }
    };

    // Log registration
    console.log(`Registered agent ${agentId} with quota of ${quota}`);
  }

  /**
   * Report successful task completion
   */
  static reportSuccess(agentId: string): void {
    const agent = AgentHealthChecker.healthMap[agentId];
    if (!agent) return;

    // Update metrics
    agent.successfulTasks++;
    agent.totalTasks++;
    agent.lastActive = Date.now();
    agent.currentLoad = Math.max(0, agent.currentLoad - 1);
    agent.failureRate = Math.max(0, agent.failureRate - 0.1);  // Gradually improve failure rate

    // Mark as healthy if failure rate is below threshold
    agent.healthy = agent.failureRate < AgentHealthChecker.config.unhealthyFailureThreshold!;

    // Log in AgentMonitor
    AgentMonitor.log({
      agentId,
      taskId: `health_check_${Date.now()}`,
      eventType: 'message',
      timestamp: Date.now(),
      metadata: {
        type: 'health_update',
        currentLoad: agent.currentLoad,
        quota: agent.quota,
        healthy: agent.healthy,
        failureRate: agent.failureRate,
        action: 'task_success'
      }
    });
  }

  /**
   * Report task failure
   */
  static reportFailure(agentId: string, error?: string): void {
    const agent = AgentHealthChecker.healthMap[agentId];
    if (!agent) return;

    const now = Date.now();

    // Update metrics
    agent.failedTasks++;
    agent.totalTasks++;
    agent.lastActive = now;
    agent.currentLoad = Math.max(0, agent.currentLoad - 1);
    agent.failureRate = Math.min(1, agent.failureRate + 0.2);  // Increase failure rate more quickly
    agent.lastError = error;
    agent.lastErrorTime = now;

    // Check if agent crossed unhealthy threshold
    const wasHealthy = agent.healthy;
    agent.healthy = agent.failureRate < AgentHealthChecker.config.unhealthyFailureThreshold!;

    // If agent became unhealthy, log the state change
    if (wasHealthy && !agent.healthy) {
      console.warn(`Agent ${agentId} marked unhealthy - failure rate: ${agent.failureRate.toFixed(2)}`);
      
      // Log in AgentMonitor
      AgentMonitor.log({
        agentId,
        taskId: `health_status_${Date.now()}`,
        eventType: 'error',
        timestamp: now,
        errorMessage: `Agent marked unhealthy due to high failure rate: ${agent.failureRate.toFixed(2)}`,
        metadata: {
          type: 'health_status_change',
          previousStatus: 'healthy',
          newStatus: 'unhealthy',
          failureRate: agent.failureRate,
          lastError: error
        }
      });
    } else {
      // Regular failure logging
      AgentMonitor.log({
        agentId,
        taskId: `health_check_${now}`,
        eventType: 'message',
        timestamp: now,
        metadata: {
          type: 'health_update',
          currentLoad: agent.currentLoad,
          quota: agent.quota,
          healthy: agent.healthy,
          failureRate: agent.failureRate,
          action: 'task_failure',
          error
        }
      });
    }
  }

  /**
   * Report that an agent is beginning a new task
   */
  static beginTask(agentId: string): boolean {
    const agent = AgentHealthChecker.healthMap[agentId];
    if (!agent) return false;

    // Check if adding this task would exceed quota
    if (AgentHealthChecker.config.quotaEnforcement && agent.currentLoad >= agent.quota) {
      console.warn(`Task rejected: Agent ${agentId} at quota limit (${agent.currentLoad}/${agent.quota})`);
      return false;
    }

    // Update metrics
    agent.currentLoad++;
    agent.lastActive = Date.now();

    // Log in AgentMonitor
    AgentMonitor.log({
      agentId,
      taskId: `health_check_${Date.now()}`,
      eventType: 'message',
      timestamp: Date.now(),
      metadata: {
        type: 'health_update',
        currentLoad: agent.currentLoad,
        quota: agent.quota,
        healthy: agent.healthy,
        action: 'task_begin'
      }
    });

    return true;
  }

  /**
   * Check if an agent is available for new tasks
   */
  static isAvailable(agentId: string): boolean {
    const agent = AgentHealthChecker.healthMap[agentId];
    
    // Agent must exist, be healthy, and have capacity
    return !!agent && agent.healthy && agent.currentLoad < agent.quota;
  }

  /**
   * Find the first available agent from a list of candidates
   */
  static getFallback(candidates: string[]): string | null {
    // Find first available agent
    const available = candidates.find(agentId => AgentHealthChecker.isAvailable(agentId));
    return available || null;
  }

  /**
   * Find the best available agent from a list of candidates
   * Considers not just availability but also health metrics to pick the most reliable option
   */
  static getBestAvailable(candidates: string[]): string | null {
    // Filter to available agents
    const availableAgents = candidates
      .filter(agentId => AgentHealthChecker.isAvailable(agentId))
      .map(agentId => AgentHealthChecker.healthMap[agentId])
      .filter(Boolean);

    if (availableAgents.length === 0) return null;
    
    // Sort by health metrics (lower failure rate, lower load)
    availableAgents.sort((a, b) => {
      // First priority: failure rate (lower is better)
      if (a.failureRate !== b.failureRate) {
        return a.failureRate - b.failureRate;
      }
      
      // Second priority: current load vs quota (lower percentage is better)
      const aLoadPercentage = a.currentLoad / a.quota;
      const bLoadPercentage = b.currentLoad / b.quota;
      return aLoadPercentage - bLoadPercentage;
    });

    // Return the best option's agentId
    return availableAgents[0].agentId;
  }

  /**
   * Get the full health status for an agent
   */
  static getStatus(agentId: string): AgentHealthStatus | undefined {
    return AgentHealthChecker.healthMap[agentId];
  }

  /**
   * Get health statuses for all registered agents
   */
  static getAllStatuses(): Record<string, AgentHealthStatus> {
    return { ...AgentHealthChecker.healthMap };
  }

  /**
   * Start automatic health checks
   */
  private static startHealthChecks(): void {
    // Cancel existing interval if any
    if (AgentHealthChecker.healthCheckInterval) {
      clearInterval(AgentHealthChecker.healthCheckInterval);
    }

    // Set up new interval
    AgentHealthChecker.healthCheckInterval = setInterval(() => {
      AgentHealthChecker.runHealthChecks();
    }, AgentHealthChecker.config.healthCheckIntervalMs);

    console.log(`Automatic health checks started (interval: ${AgentHealthChecker.config.healthCheckIntervalMs}ms)`);
  }

  /**
   * Run health checks on all registered agents
   */
  static runHealthChecks(): void {
    const now = Date.now();
    const inactivityThreshold = AgentHealthChecker.config.inactivityThresholdMs!;

    // Check each agent
    Object.values(AgentHealthChecker.healthMap).forEach(agent => {
      const previousHealth = agent.healthy;
      
      // Check for inactivity
      const inactiveDuration = now - agent.lastActive;
      const inactive = inactiveDuration > inactivityThreshold;

      if (inactive && agent.healthy) {
        // Mark as unhealthy due to inactivity
        agent.healthy = false;

        console.warn(`Agent ${agent.agentId} marked unhealthy due to inactivity (${inactiveDuration}ms)`);
        
        // Log in AgentMonitor
        AgentMonitor.log({
          agentId: agent.agentId,
          taskId: `health_status_${now}`,
          eventType: 'error',
          timestamp: now,
          errorMessage: `Agent marked unhealthy due to inactivity (${Math.round(inactiveDuration / 1000)}s)`,
          metadata: {
            type: 'health_status_change',
            previousStatus: 'healthy',
            newStatus: 'unhealthy',
            reason: 'inactivity',
            inactiveDuration
          }
        });
      } else if (!inactive && !agent.healthy && agent.failureRate < AgentHealthChecker.config.unhealthyFailureThreshold!) {
        // Agent is active again and failure rate is acceptable, mark as healthy
        agent.healthy = true;

        console.log(`Agent ${agent.agentId} marked healthy again after recovery`);
        
        // Log in AgentMonitor
        AgentMonitor.log({
          agentId: agent.agentId,
          taskId: `health_status_${now}`,
          eventType: 'message',
          timestamp: now,
          metadata: {
            type: 'health_status_change',
            previousStatus: 'unhealthy',
            newStatus: 'healthy',
            reason: 'recovery',
            failureRate: agent.failureRate
          }
        });
      }

      // Calculate uptime
      agent.metrics.uptimeMs = now - agent.metrics.startTime;

      // If status changed, log it
      if (previousHealth !== agent.healthy) {
        console.log(`Agent ${agent.agentId} health status changed: ${previousHealth ? 'healthy' : 'unhealthy'} -> ${agent.healthy ? 'healthy' : 'unhealthy'}`);
      }
    });
  }

  /**
   * Update agent's quota limit
   */
  static updateQuota(agentId: string, newQuota: number): boolean {
    const agent = AgentHealthChecker.healthMap[agentId];
    if (!agent) return false;

    // Update quota
    agent.quota = newQuota;
    console.log(`Updated quota for agent ${agentId}: ${newQuota}`);
    return true;
  }

  /**
   * Manually reset agent's health status
   */
  static resetHealthStatus(agentId: string): boolean {
    const agent = AgentHealthChecker.healthMap[agentId];
    if (!agent) return false;

    // Reset health metrics
    agent.healthy = true;
    agent.failureRate = 0;
    agent.lastActive = Date.now();
    agent.lastError = undefined;
    agent.lastErrorTime = undefined;

    console.log(`Reset health status for agent ${agentId}`);
    return true;
  }

  /**
   * Shutdown the health checker
   */
  static shutdown(): void {
    // Clear interval
    if (AgentHealthChecker.healthCheckInterval) {
      clearInterval(AgentHealthChecker.healthCheckInterval);
      AgentHealthChecker.healthCheckInterval = null;
    }

    console.log('AgentHealthChecker shutdown');
  }
} 