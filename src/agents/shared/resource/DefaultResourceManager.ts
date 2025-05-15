/**
 * DefaultResourceManager.ts - Default Resource Manager Implementation
 * 
 * This file implements the resource manager interface, providing resource
 * management and allocation for agents.
 */

import { AgentBase } from '../base/AgentBase.interface';
import { ManagerType } from '../base/managers/ManagerType';
import { BaseManager, ManagerConfig } from '../base/managers/BaseManager';
import { ManagerHealth } from '../base/managers/ManagerHealth';
import {
  ResourceManager,
  ResourceManagerConfig,
  ResourceRequirements,
  ResourceUsageMetrics,
  ResourceScalingEvent,
  ResourceOptimizationResult,
  ResourceAllocation
} from '../base/managers/ResourceManager.interface';

/**
 * Default resource manager implementation
 */
export class DefaultResourceManager implements ResourceManager {
  private resources: ResourceRequirements;
  private allocations: Map<string, ResourceAllocation>;
  private usageHistory: ResourceUsageMetrics[];
  private scalingHistory: ResourceScalingEvent[];
  private optimizationHistory: ResourceOptimizationResult[];
  private monitoringInterval?: NodeJS.Timeout;
  private config: ResourceManagerConfig;
  private agent: AgentBase;
  public readonly managerId: string;
  public readonly managerType: ManagerType;

  /**
   * Create a new DefaultResourceManager
   */
  constructor(agent: AgentBase, config: Partial<ResourceManagerConfig> = {}) {
    this.agent = agent;
    this.managerId = `resource-manager-${Date.now()}`;
    this.managerType = ManagerType.RESOURCE;
    this.config = {
      enabled: true,
      enableMonitoring: true,
      monitoringIntervalMs: 60000,
      enablePrediction: false,
      enableAutoScaling: false,
      enableOptimization: false,
      ...config
    };

    // Initialize resource tracking
    this.resources = {
      cpu: 100,      // 100 CPU units
      memory: 8192,  // 8GB RAM
      storage: 102400, // 100GB storage
      network: 1000   // 1GB/s network
    };

    this.allocations = new Map();
    this.usageHistory = [];
    this.scalingHistory = [];
    this.optimizationHistory = [];
  }

  /**
   * Get the manager type
   */
  getType(): ManagerType {
    return this.managerType;
  }

  /**
   * Get the manager configuration
   */
  getConfig<T extends ResourceManagerConfig>(): T {
    return this.config as T;
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends ResourceManagerConfig>(updates: Partial<T>): T {
    this.config = {
      ...this.config,
      ...updates
    };
    return this.config as T;
  }

  /**
   * Initialize the resource manager
   */
  async initialize(): Promise<boolean> {
    try {
      // Start resource monitoring if enabled
      if (this.config.enableMonitoring) {
        this.startMonitoring();
      }

      return true;
    } catch (error) {
      console.error('Error initializing resource manager:', error);
      return false;
    }
  }

  /**
   * Start resource monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.getResourceUsage();
        this.usageHistory.push(metrics);

        // Trim history to last 24 hours
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.usageHistory = this.usageHistory.filter(m => m.timestamp > dayAgo);

        // Check for auto-scaling if enabled
        if (this.config.enableAutoScaling) {
          await this.checkAutoScaling(metrics);
        }
      } catch (error) {
        console.error('Error in resource monitoring:', error);
      }
    }, this.config.monitoringIntervalMs);
  }

  /**
   * Check if auto-scaling is needed
   */
  private async checkAutoScaling(metrics: ResourceUsageMetrics): Promise<void> {
    const CPU_SCALE_UP_THRESHOLD = 80;
    const CPU_SCALE_DOWN_THRESHOLD = 20;
    const MEMORY_SCALE_UP_THRESHOLD = 80;
    const MEMORY_SCALE_DOWN_THRESHOLD = 20;

    if (metrics.cpuUsage > CPU_SCALE_UP_THRESHOLD || metrics.memoryUsage > MEMORY_SCALE_UP_THRESHOLD) {
      await this.scaleResources(['cpu', 'memory'], 1.5);
    } else if (metrics.cpuUsage < CPU_SCALE_DOWN_THRESHOLD && metrics.memoryUsage < MEMORY_SCALE_DOWN_THRESHOLD) {
      await this.scaleResources(['cpu', 'memory'], 0.75);
    }
  }

  /**
   * Get available resources
   */
  async getAvailableResources(): Promise<ResourceRequirements> {
    // Calculate available resources by subtracting allocations
    const available = { ...this.resources } as ResourceRequirements;
    
    for (const allocation of Array.from(this.allocations.values())) {
      for (const [key, value] of Object.entries(allocation.allocated)) {
        if (typeof value === 'number') {
          const current = available[key as keyof ResourceRequirements];
          if (typeof current === 'number') {
            const newValue = current - value;
            Object.assign(available, { [key]: newValue });
          }
        }
      }
    }

    return available;
  }

  /**
   * Allocate resources
   */
  async allocateResources(requirements: ResourceRequirements): Promise<ResourceRequirements> {
    const available = await this.getAvailableResources();
    
    // Check if we have enough resources
    for (const [key, required] of Object.entries(requirements)) {
      if (typeof required === 'number') {
        const availableAmount = available[key as keyof ResourceRequirements];
        if (typeof availableAmount === 'number' && availableAmount < required) {
          throw new Error(`Insufficient ${key} resources. Required: ${required}, Available: ${availableAmount}`);
        }
      }
    }

    // Create allocation
    const allocationId = `allocation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const allocation: ResourceAllocation = {
      allocated: requirements,
      available: this.resources,
      utilization: this.calculateUtilization(requirements, this.resources)
    };

    this.allocations.set(allocationId, allocation);
    return requirements;
  }

  /**
   * Release allocated resources
   */
  async releaseResources(resources: ResourceRequirements): Promise<boolean> {
    try {
      // Find and remove the allocation
      for (const [id, allocation] of Array.from(this.allocations.entries())) {
        if (this.resourcesMatch(allocation.allocated, resources)) {
          this.allocations.delete(id);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error releasing resources:', error);
      return false;
    }
  }

  /**
   * Get current resource usage
   */
  async getResourceUsage(): Promise<ResourceUsageMetrics> {
    const available = await this.getAvailableResources();
    
    // Calculate usage percentages
    const cpuUsage = ((this.resources.cpu! - (available.cpu || 0)) / this.resources.cpu!) * 100;
    const memoryUsage = ((this.resources.memory! - (available.memory || 0)) / this.resources.memory!) * 100;
    const storageUsage = ((this.resources.storage! - (available.storage || 0)) / this.resources.storage!) * 100;
    const networkUsage = ((this.resources.network! - (available.network || 0)) / this.resources.network!) * 100;

    return {
      cpuUsage,
      memoryUsage,
      storageUsage,
      networkUsage,
      timestamp: new Date()
    };
  }

  /**
   * Check if resources are available
   */
  async checkResourceAvailability(requirements: ResourceRequirements): Promise<boolean> {
    try {
      const available = await this.getAvailableResources();
      
      for (const [key, required] of Object.entries(requirements)) {
        if (typeof required === 'number') {
          const availableAmount = available[key as keyof ResourceRequirements];
          if (typeof availableAmount === 'number' && availableAmount < required) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking resource availability:', error);
      return false;
    }
  }

  /**
   * Reserve resources for future use
   */
  async reserveResources(requirements: ResourceRequirements, duration: number): Promise<boolean> {
    try {
      // Check if resources are available
      const available = await this.checkResourceAvailability(requirements);
      if (!available) {
        return false;
      }

      // Allocate resources
      await this.allocateResources(requirements);

      // Set timeout to release resources
      setTimeout(async () => {
        await this.releaseResources(requirements);
      }, duration);

      return true;
    } catch (error) {
      console.error('Error reserving resources:', error);
      return false;
    }
  }

  /**
   * Scale resources
   */
  async scaleResources(resources: string[], factor: number): Promise<ResourceScalingEvent> {
    const event: ResourceScalingEvent = {
      type: factor > 1 ? 'scale_up' : 'scale_down',
      resources,
      factor,
      reason: `Resource utilization triggered ${factor > 1 ? 'scale up' : 'scale down'}`,
      timestamp: new Date()
    };

    // Scale the resources
    for (const resource of resources) {
      const current = this.resources[resource as keyof ResourceRequirements];
      if (typeof current === 'number') {
        const newValue = current * factor;
        Object.assign(this.resources, { [resource]: newValue });
      }
    }

    this.scalingHistory.push(event);
    return event;
  }

  /**
   * Optimize resource usage
   */
  async optimizeResources(target: string[]): Promise<ResourceOptimizationResult> {
    const before = await this.getResourceUsage();
    const savings: ResourceRequirements = {};
    const optimizations: string[] = [];

    for (const resource of target) {
      const usage = before[`${resource}Usage` as keyof ResourceUsageMetrics];
      if (typeof usage === 'number') {
        if (usage < 50) {
          // Resource is underutilized, reduce allocation
          const current = this.resources[resource as keyof ResourceRequirements];
          if (typeof current === 'number') {
            const reduction = current * 0.2;
            const newValue = current - reduction;
            Object.assign(this.resources, { [resource]: newValue });
            Object.assign(savings, { [resource]: reduction });
            optimizations.push(`Reduced ${resource} allocation by 20%`);
          }
        }
      }
    }

    const after = await this.getResourceUsage();
    const performanceImpact = this.calculatePerformanceImpact(before, after);

    const result: ResourceOptimizationResult = {
      success: true,
      optimizedResources: target,
      impact: {
        savings,
        performanceImpact
      },
      appliedOptimizations: optimizations,
      timestamp: new Date()
    };

    this.optimizationHistory.push(result);
    return result;
  }

  /**
   * Get resource usage history
   */
  async getResourceHistory(timeRange?: { start: Date; end: Date }): Promise<ResourceUsageMetrics[]> {
    if (!timeRange) {
      return this.usageHistory;
    }

    return this.usageHistory.filter(
      metrics => metrics.timestamp >= timeRange.start && metrics.timestamp <= timeRange.end
    );
  }

  /**
   * Get resource allocation history
   */
  async getAllocationHistory(timeRange?: { start: Date; end: Date }): Promise<Array<{
    allocation: ResourceAllocation;
    timestamp: Date;
  }>> {
    // For now, we just return current allocations since we don't track historical allocations
    return Array.from(this.allocations.entries()).map(([_, allocation]) => ({
      allocation,
      timestamp: new Date()
    }));
  }

  /**
   * Get resource scaling history
   */
  async getScalingHistory(timeRange?: { start: Date; end: Date }): Promise<ResourceScalingEvent[]> {
    if (!timeRange) {
      return this.scalingHistory;
    }

    return this.scalingHistory.filter(
      event => event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
    );
  }

  /**
   * Get resource optimization history
   */
  async getOptimizationHistory(timeRange?: { start: Date; end: Date }): Promise<ResourceOptimizationResult[]> {
    if (!timeRange) {
      return this.optimizationHistory;
    }

    return this.optimizationHistory.filter(
      result => result.timestamp >= timeRange.start && result.timestamp <= timeRange.end
    );
  }

  /**
   * Calculate resource utilization percentage
   */
  private calculateUtilization(allocated: ResourceRequirements, available: ResourceRequirements): number {
    let totalUtilization = 0;
    let resourceCount = 0;

    for (const [key, value] of Object.entries(allocated)) {
      if (typeof value === 'number') {
        const availableAmount = available[key as keyof ResourceRequirements];
        if (typeof availableAmount === 'number' && availableAmount > 0) {
          totalUtilization += (value / availableAmount) * 100;
          resourceCount++;
        }
      }
    }

    return resourceCount > 0 ? totalUtilization / resourceCount : 0;
  }

  /**
   * Calculate performance impact of optimization
   */
  private calculatePerformanceImpact(before: ResourceUsageMetrics, after: ResourceUsageMetrics): number {
    const metrics = ['cpuUsage', 'memoryUsage', 'storageUsage', 'networkUsage'];
    let totalImpact = 0;

    for (const metric of metrics) {
      const beforeValue = before[metric as keyof ResourceUsageMetrics];
      const afterValue = after[metric as keyof ResourceUsageMetrics];
      if (typeof beforeValue === 'number' && typeof afterValue === 'number') {
        totalImpact += ((afterValue - beforeValue) / beforeValue) * 100;
      }
    }

    return totalImpact / metrics.length;
  }

  /**
   * Check if two resource requirements match
   */
  private resourcesMatch(a: ResourceRequirements, b: ResourceRequirements): boolean {
    for (const key of Object.keys(a)) {
      const valueA = a[key as keyof ResourceRequirements];
      const valueB = b[key as keyof ResourceRequirements];
      if (typeof valueA === 'number' && typeof valueB === 'number' && valueA !== valueB) {
        return false;
      }
    }
    return true;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.allocations.clear();
    this.usageHistory = [];
    this.scalingHistory = [];
    this.optimizationHistory = [];
  }

  /**
   * Get the agent instance
   */
  getAgent(): AgentBase {
    return this.agent;
  }

  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Check if manager is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set manager enabled state
   */
  setEnabled(enabled: boolean): boolean {
    this.config.enabled = enabled;
    return this.config.enabled;
  }

  /**
   * Get manager status
   */
  getStatus(): string {
    return this.isEnabled() ? 'enabled' : 'disabled';
  }

  /**
   * Reset manager state
   */
  async reset(): Promise<boolean> {
    try {
      await this.cleanup();
      this.resources = {
        cpu: 100,
        memory: 8192,
        storage: 102400,
        network: 1000
      };
      this.allocations.clear();
      this.usageHistory = [];
      this.scalingHistory = [];
      this.optimizationHistory = [];
      return true;
    } catch (error) {
      console.error('Error resetting resource manager:', error);
      return false;
    }
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    const usage = await this.getResourceUsage();
    const issues: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      detectedAt: Date;
    }> = [];

    // Check if monitoring is active when it should be
    if (this.config.enableMonitoring && !this.monitoringInterval) {
      issues.push({
        severity: 'high' as const,
        message: "Resource monitoring is enabled but not active",
        detectedAt: new Date()
      });
    }

    // Check resource utilization
    if (usage.cpuUsage > 95 || usage.memoryUsage > 95) {
      issues.push({
        severity: 'critical' as const,
        message: `Critical resource utilization: CPU ${usage.cpuUsage.toFixed(1)}%, Memory ${usage.memoryUsage.toFixed(1)}%`,
        detectedAt: new Date()
      });
    } else if (usage.cpuUsage > 90 || usage.memoryUsage > 90) {
      issues.push({
        severity: 'high' as const,
        message: `High resource utilization: CPU ${usage.cpuUsage.toFixed(1)}%, Memory ${usage.memoryUsage.toFixed(1)}%`,
        detectedAt: new Date()
      });
    }

    // Determine status based on issues
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (issues.some(i => i.severity === 'critical')) {
      status = "unhealthy";
    } else if (issues.some(i => i.severity === 'high')) {
      status = "degraded";
    }

    const metrics = {
      allocations: this.allocations.size,
      usageHistoryEntries: this.usageHistory.length,
      scalingHistoryEntries: this.scalingHistory.length,
      optimizationHistoryEntries: this.optimizationHistory.length,
      monitoringActive: !!this.monitoringInterval,
      currentUsage: usage,
      totalResources: this.resources
    };

    return {
      status,
      message: issues.length > 0 ? issues[0].message : 'Resource manager is healthy',
      metrics,
      details: {
        lastCheck: new Date(),
        issues,
        metrics
      }
    };
  }
} 