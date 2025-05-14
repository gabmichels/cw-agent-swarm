/**
 * ResourceUtilization.ts
 * 
 * This module provides utilities for tracking and managing resource utilization
 * for scheduler operations. It monitors CPU, memory, API usage, and other metrics
 * to ensure the scheduler operates within defined resource constraints.
 */

import { ResourceUtilization } from '../../../lib/agents/base/managers/SchedulerManager';

/**
 * Options for resource utilization tracking
 */
export interface ResourceUtilizationTrackerOptions {
  /** How frequently to sample utilization in milliseconds */
  samplingIntervalMs: number;
  
  /** How many history samples to keep */
  maxHistorySamples: number;
  
  /** Default resource limits */
  defaultLimits: {
    cpuUtilization: number;
    memoryBytes: number;
    tokensPerMinute: number;
    apiCallsPerMinute: number;
  };
  
  /** Whether to automatically enforce limits */
  enforceResourceLimits: boolean;
  
  /** Buffer percentage before limits are enforced (0-1) */
  limitWarningBuffer: number;
  
  /** Whether to track per-task utilization */
  trackPerTaskUtilization: boolean;
}

/**
 * Interface for resource usage notifications
 */
export interface ResourceUsageListener {
  onResourceWarning(metric: keyof ResourceUtilization, value: number, limit: number): void;
  onResourceLimitExceeded(metric: keyof ResourceUtilization, value: number, limit: number): void;
  onResourceUsageNormalized(metric: keyof ResourceUtilization): void;
}

/**
 * Interface for a bucket of resource utilization samples
 */
interface UtilizationBucket {
  samples: ResourceUtilization[];
  interval: Date;
}

/**
 * Class to track and manage resource utilization
 */
export class ResourceUtilizationTracker {
  private options: ResourceUtilizationTrackerOptions;
  private currentUtilization: ResourceUtilization;
  private utilizationHistory: ResourceUtilization[] = [];
  private taskUtilization: Map<string, {
    cpuUtilization: number;
    memoryBytes: number;
    tokensPerMinute: number;
    apiCallsPerMinute: number;
  }> = new Map();
  private limits: {
    cpuUtilization: number;
    memoryBytes: number;
    tokensPerMinute: number;
    apiCallsPerMinute: number;
  };
  private samplingInterval: NodeJS.Timeout | null = null;
  private listeners: ResourceUsageListener[] = [];
  private warningFlags: Record<string, boolean> = {};
  private exceedingFlags: Record<string, boolean> = {};
  
  /**
   * Create a new ResourceUtilizationTracker
   * 
   * @param options Configuration options
   */
  constructor(options: Partial<ResourceUtilizationTrackerOptions> = {}) {
    // Set default options
    this.options = {
      samplingIntervalMs: options.samplingIntervalMs ?? 10000, // 10 seconds
      maxHistorySamples: options.maxHistorySamples ?? 60, // 10 minutes at default interval
      defaultLimits: options.defaultLimits ?? {
        cpuUtilization: 0.8, // 80% maximum CPU usage
        memoryBytes: 1024 * 1024 * 512, // 512MB memory limit
        tokensPerMinute: 50000, // 50K tokens per minute
        apiCallsPerMinute: 100 // 100 API calls per minute
      },
      enforceResourceLimits: options.enforceResourceLimits ?? true,
      limitWarningBuffer: options.limitWarningBuffer ?? 0.2, // Warn at 80% of limit
      trackPerTaskUtilization: options.trackPerTaskUtilization ?? false
    };
    
    // Initialize current utilization
    this.currentUtilization = {
      timestamp: new Date(),
      cpuUtilization: 0,
      memoryBytes: 0,
      tokensPerMinute: 0,
      apiCallsPerMinute: 0,
      activeTasks: 0,
      pendingTasks: 0
    };
    
    // Set initial limits
    this.limits = { ...this.options.defaultLimits };
  }
  
  /**
   * Start resource utilization tracking
   */
  start(): void {
    if (this.samplingInterval) {
      return; // Already started
    }
    
    // Start sampling interval
    this.samplingInterval = setInterval(() => {
      this.sampleResourceUtilization();
    }, this.options.samplingIntervalMs);
    
    // Take an initial sample
    this.sampleResourceUtilization();
  }
  
  /**
   * Stop resource utilization tracking
   */
  stop(): void {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = null;
    }
  }
  
  /**
   * Set resource limits
   * 
   * @param limits New resource limits to apply
   */
  setLimits(limits: Partial<{
    cpuUtilization: number;
    memoryBytes: number;
    tokensPerMinute: number;
    apiCallsPerMinute: number;
  }>): void {
    // Update limits
    this.limits = {
      ...this.limits,
      ...limits
    };
    
    // Check current utilization against new limits
    this.checkResourceLimits();
  }
  
  /**
   * Get current resource utilization
   */
  getCurrentUtilization(): ResourceUtilization {
    return { ...this.currentUtilization };
  }
  
  /**
   * Get resource utilization history
   * 
   * @param options History retrieval options
   */
  getUtilizationHistory(options?: {
    from?: Date;
    to?: Date;
    interval?: 'minute' | 'hour' | 'day';
    limit?: number;
  }): ResourceUtilization[] {
    let history = [...this.utilizationHistory];
    
    // Apply date range filter if specified
    if (options?.from || options?.to) {
      history = history.filter(entry => {
        if (options.from && entry.timestamp < options.from) {
          return false;
        }
        if (options.to && entry.timestamp > options.to) {
          return false;
        }
        return true;
      });
    }
    
    // Apply interval sampling if specified
    if (options?.interval) {
      const sampledHistory: ResourceUtilization[] = [];
      const buckets = new Map<number, ResourceUtilization[]>();
      
      const getBucketTime = (date: Date, interval: string): number => {
        const result = new Date(date);
        if (interval === 'minute') {
          result.setSeconds(0, 0);
        } else if (interval === 'hour') {
          result.setMinutes(0, 0, 0);
        } else if (interval === 'day') {
          result.setHours(0, 0, 0, 0);
        }
        return result.getTime();
      };
      
      // Group samples by time buckets
      for (const sample of history) {
        const bucketTime = getBucketTime(sample.timestamp, options.interval);
        if (!buckets.has(bucketTime)) {
          buckets.set(bucketTime, []);
        }
        buckets.get(bucketTime)!.push(sample);
      }
      
      // Process each bucket
      const sortedBucketTimes = Array.from(buckets.keys()).sort();
      for (const bucketTime of sortedBucketTimes) {
        const samples = buckets.get(bucketTime)!;
        if (samples.length > 0) {
          const avgSample = this.calculateAverageSample(samples);
          sampledHistory.push(avgSample);
        }
      }
      
      history = sampledHistory;
    }
    
    // Apply limit if specified
    if (options?.limit && options.limit > 0 && history.length > options.limit) {
      history = history.slice(history.length - options.limit);
    }
    
    return history;
  }
  
  /**
   * Register a utilization listener
   * 
   * @param listener The listener to register
   */
  addListener(listener: ResourceUsageListener): void {
    this.listeners.push(listener);
  }
  
  /**
   * Remove a utilization listener
   * 
   * @param listener The listener to remove
   */
  removeListener(listener: ResourceUsageListener): boolean {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * Record task utilization
   * 
   * @param taskId ID of the task
   * @param metrics Utilization metrics for the task
   */
  recordTaskUtilization(
    taskId: string,
    metrics: Partial<{
      cpuUtilization: number;
      memoryBytes: number;
      tokensPerMinute: number;
      apiCallsPerMinute: number;
    }>
  ): void {
    if (!this.options.trackPerTaskUtilization) {
      return;
    }
    
    const existingMetrics = this.taskUtilization.get(taskId) || {
      cpuUtilization: 0,
      memoryBytes: 0,
      tokensPerMinute: 0,
      apiCallsPerMinute: 0
    };
    
    // Update metrics
    this.taskUtilization.set(taskId, {
      ...existingMetrics,
      ...metrics
    });
    
    // Update total utilization
    this.updateTotalUtilization();
  }
  
  /**
   * Clear task utilization record
   * 
   * @param taskId ID of the task to clear
   */
  clearTaskUtilization(taskId: string): void {
    this.taskUtilization.delete(taskId);
    this.updateTotalUtilization();
  }
  
  /**
   * Update task counts
   * 
   * @param activeTasks Number of active tasks
   * @param pendingTasks Number of pending tasks
   */
  updateTaskCounts(activeTasks: number, pendingTasks: number): void {
    this.currentUtilization.activeTasks = activeTasks;
    this.currentUtilization.pendingTasks = pendingTasks;
  }
  
  /**
   * Check if a specific resource limit is currently exceeded
   * 
   * @param resource The resource to check
   */
  isResourceLimitExceeded(resource: keyof typeof this.limits): boolean {
    return this.exceedingFlags[resource] || false;
  }
  
  /**
   * Check if any resource limit is currently exceeded
   */
  areAnyResourceLimitsExceeded(): boolean {
    return Object.values(this.exceedingFlags).some(Boolean);
  }
  
  /**
   * Sample current resource utilization
   */
  private sampleResourceUtilization(): void {
    // Get process resource usage
    const memoryUsage = process.memoryUsage();
    
    // Update current utilization with real metrics
    const newSample: ResourceUtilization = {
      timestamp: new Date(),
      cpuUtilization: this.estimateCpuUtilization(),
      memoryBytes: memoryUsage.heapUsed,
      tokensPerMinute: this.currentUtilization.tokensPerMinute, // This needs to be updated by external API tracking
      apiCallsPerMinute: this.currentUtilization.apiCallsPerMinute, // This needs to be updated by external API tracking
      activeTasks: this.currentUtilization.activeTasks,
      pendingTasks: this.currentUtilization.pendingTasks
    };
    
    // Add per-task utilization if enabled
    if (this.options.trackPerTaskUtilization) {
      newSample.taskUtilization = {};
      
      this.taskUtilization.forEach((metrics, taskId) => {
        newSample.taskUtilization![taskId] = { ...metrics };
      });
    }
    
    // Update current utilization
    this.currentUtilization = newSample;
    
    // Add to history
    this.utilizationHistory.push(newSample);
    
    // Trim history if needed
    if (this.utilizationHistory.length > this.options.maxHistorySamples) {
      this.utilizationHistory.shift();
    }
    
    // Check resource limits
    this.checkResourceLimits();
  }
  
  /**
   * Update total utilization based on per-task metrics
   */
  private updateTotalUtilization(): void {
    if (!this.options.trackPerTaskUtilization || this.taskUtilization.size === 0) {
      return;
    }
    
    let totalCpu = 0;
    let totalMemory = 0;
    let totalTokens = 0;
    let totalApiCalls = 0;
    
    this.taskUtilization.forEach(metrics => {
      totalCpu += metrics.cpuUtilization;
      totalMemory += metrics.memoryBytes;
      totalTokens += metrics.tokensPerMinute;
      totalApiCalls += metrics.apiCallsPerMinute;
    });
    
    // Update current utilization
    this.currentUtilization.cpuUtilization = totalCpu;
    this.currentUtilization.memoryBytes = totalMemory;
    this.currentUtilization.tokensPerMinute = totalTokens;
    this.currentUtilization.apiCallsPerMinute = totalApiCalls;
    
    // Check resource limits
    this.checkResourceLimits();
  }
  
  /**
   * Calculate average sample from multiple samples
   * 
   * @param samples The samples to average
   */
  private calculateAverageSample(samples: ResourceUtilization[]): ResourceUtilization {
    if (samples.length === 0) {
      throw new Error('Cannot calculate average from empty sample set');
    }
    
    // Use the timestamp from the most recent sample
    const lastSample = samples[samples.length - 1];
    const result: ResourceUtilization = {
      timestamp: lastSample.timestamp,
      cpuUtilization: 0,
      memoryBytes: 0,
      tokensPerMinute: 0,
      apiCallsPerMinute: 0,
      activeTasks: 0,
      pendingTasks: 0
    };
    
    // Calculate sums
    samples.forEach(sample => {
      result.cpuUtilization += sample.cpuUtilization;
      result.memoryBytes += sample.memoryBytes;
      result.tokensPerMinute += sample.tokensPerMinute;
      result.apiCallsPerMinute += sample.apiCallsPerMinute;
      result.activeTasks += sample.activeTasks;
      result.pendingTasks += sample.pendingTasks;
    });
    
    // Calculate averages
    const count = samples.length;
    result.cpuUtilization /= count;
    result.memoryBytes /= count;
    result.tokensPerMinute /= count;
    result.apiCallsPerMinute /= count;
    result.activeTasks = Math.round(result.activeTasks / count);
    result.pendingTasks = Math.round(result.pendingTasks / count);
    
    // Merge task utilization if present
    if (this.options.trackPerTaskUtilization) {
      result.taskUtilization = {};
      const taskSampleCounts: Record<string, number> = {};
      
      samples.forEach(sample => {
        if (sample.taskUtilization) {
          Object.entries(sample.taskUtilization).forEach(([taskId, metrics]) => {
            if (!result.taskUtilization![taskId]) {
              result.taskUtilization![taskId] = {
                cpuUtilization: 0,
                memoryBytes: 0,
                tokensPerMinute: 0,
                apiCallsPerMinute: 0
              };
              taskSampleCounts[taskId] = 0;
            }
            
            taskSampleCounts[taskId]++;
            result.taskUtilization![taskId].cpuUtilization! += metrics.cpuUtilization || 0;
            result.taskUtilization![taskId].memoryBytes! += metrics.memoryBytes || 0;
            result.taskUtilization![taskId].tokensPerMinute! += metrics.tokensPerMinute || 0;
            result.taskUtilization![taskId].apiCallsPerMinute! += metrics.apiCallsPerMinute || 0;
          });
        }
      });
      
      // Calculate per-task averages
      Object.entries(result.taskUtilization).forEach(([taskId, metrics]) => {
        const taskCount = taskSampleCounts[taskId];
        if (taskCount > 0) {
          metrics.cpuUtilization! /= taskCount;
          metrics.memoryBytes! /= taskCount;
          metrics.tokensPerMinute! /= taskCount;
          metrics.apiCallsPerMinute! /= taskCount;
        }
      });
    }
    
    return result;
  }
  
  /**
   * Estimate CPU utilization
   * 
   * This is a simplified version - in a real implementation, this would
   * use a more accurate way to measure CPU usage
   */
  private estimateCpuUtilization(): number {
    // Get current CPU usage - in a real implementation this would
    // use a proper CPU usage monitoring approach
    // For this implementation we'll use a simulated value based on active tasks
    const simulatedCpuLoad = Math.min(
      1.0,
      0.1 + (this.currentUtilization.activeTasks * 0.15)
    );
    
    return simulatedCpuLoad;
  }
  
  /**
   * Check if resource limits are being exceeded
   */
  private checkResourceLimits(): void {
    if (!this.options.enforceResourceLimits) {
      return;
    }
    
    const metrics: Array<keyof typeof this.limits> = [
      'cpuUtilization',
      'memoryBytes',
      'tokensPerMinute',
      'apiCallsPerMinute'
    ];
    
    metrics.forEach(metric => {
      const currentValue = this.currentUtilization[metric];
      const limit = this.limits[metric];
      const warningThreshold = limit * (1 - this.options.limitWarningBuffer);
      
      // Check if exceeding limit
      if (currentValue >= limit) {
        if (!this.exceedingFlags[metric]) {
          this.exceedingFlags[metric] = true;
          this.notifyListeners('onResourceLimitExceeded', metric, currentValue, limit);
        }
      } else if (currentValue >= warningThreshold) {
        // Check if approaching limit
        if (!this.warningFlags[metric]) {
          this.warningFlags[metric] = true;
          this.notifyListeners('onResourceWarning', metric, currentValue, limit);
        }
      } else {
        // Resource usage has normalized
        if (this.exceedingFlags[metric] || this.warningFlags[metric]) {
          this.exceedingFlags[metric] = false;
          this.warningFlags[metric] = false;
          this.notifyListeners('onResourceUsageNormalized', metric, currentValue, limit);
        }
      }
    });
  }
  
  /**
   * Notify all listeners of an event
   */
  private notifyListeners(
    eventName: 'onResourceWarning' | 'onResourceLimitExceeded' | 'onResourceUsageNormalized',
    metric: keyof ResourceUtilization,
    value: number,
    limit: number
  ): void {
    this.listeners.forEach(listener => {
      try {
        listener[eventName](metric, value, limit);
      } catch (error) {
        console.error(`Error notifying listener of ${eventName}:`, error);
      }
    });
  }
} 