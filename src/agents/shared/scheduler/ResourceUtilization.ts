/**
 * ResourceUtilization.ts
 * 
 * This module provides utilities for tracking and managing resource utilization
 * for scheduler operations. It monitors CPU, memory, API usage, and other metrics
 * to ensure the scheduler operates within defined resource constraints.
 */

import type { ResourceUtilization } from '../base/managers/SchedulerManager.interface';

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
 * Interface for task-specific resource utilization
 */
interface TaskResourceUtilization {
  cpuUtilization: number;
  memoryBytes: number;
  tokensPerMinute: number;
  apiCallsPerMinute: number;
}

/**
 * Class to track and manage resource utilization
 */
export class ResourceUtilizationTracker {
  private options: ResourceUtilizationTrackerOptions;
  private currentUtilization: ResourceUtilization;
  private utilizationHistory: ResourceUtilization[] = [];
  private taskUtilization: Map<string, TaskResourceUtilization> = new Map();
  private limits: {
    cpuUtilization: number;
    memoryBytes: number;
    tokensPerMinute: number;
    apiCallsPerMinute: number;
  };
  private samplingInterval: NodeJS.Timeout | null = null;
  private listeners: ResourceUsageListener[] = [];
  private warningFlags: Record<keyof ResourceUtilization, boolean> = {
    cpuUtilization: false,
    memoryBytes: false,
    tokensPerMinute: false,
    apiCallsPerMinute: false,
    activeTasks: false,
    pendingTasks: false,
    timestamp: false
  };
  private exceedingFlags: Record<keyof ResourceUtilization, boolean> = {
    cpuUtilization: false,
    memoryBytes: false,
    tokensPerMinute: false,
    apiCallsPerMinute: false,
    activeTasks: false,
    pendingTasks: false,
    timestamp: false
  };
  
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
   * @returns Whether the listener was found and removed
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
   * Record task-specific resource utilization
   * 
   * @param taskId Task identifier
   * @param metrics Resource metrics to record
   */
  recordTaskUtilization(
    taskId: string,
    metrics: Partial<TaskResourceUtilization>
  ): void {
    if (!this.options.trackPerTaskUtilization) {
      return;
    }
    
    const current = this.taskUtilization.get(taskId) || {
      cpuUtilization: 0,
      memoryBytes: 0,
      tokensPerMinute: 0,
      apiCallsPerMinute: 0
    };
    
    this.taskUtilization.set(taskId, {
      ...current,
      ...metrics
    });
    
    // Update total utilization
    this.updateTotalUtilization();
  }
  
  /**
   * Clear task-specific resource utilization
   * 
   * @param taskId Task identifier
   */
  clearTaskUtilization(taskId: string): void {
    if (this.taskUtilization.delete(taskId)) {
      this.updateTotalUtilization();
    }
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
   * Check if a specific resource limit is exceeded
   * 
   * @param resource Resource to check
   */
  isResourceLimitExceeded(resource: keyof typeof this.limits): boolean {
    return this.exceedingFlags[resource] || false;
  }
  
  /**
   * Check if any resource limits are exceeded
   */
  areAnyResourceLimitsExceeded(): boolean {
    return Object.values(this.exceedingFlags).some(flag => flag);
  }
  
  /**
   * Sample current resource utilization
   */
  private sampleResourceUtilization(): void {
    // Update timestamp
    this.currentUtilization.timestamp = new Date();
    
    // Sample CPU utilization
    this.currentUtilization.cpuUtilization = this.estimateCpuUtilization();
    
    // Sample memory utilization
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      this.currentUtilization.memoryBytes = memoryUsage.heapUsed;
    }
    
    // Add to history
    this.utilizationHistory.push({ ...this.currentUtilization });
    
    // Trim history if needed
    if (this.utilizationHistory.length > this.options.maxHistorySamples) {
      this.utilizationHistory.shift();
    }
    
    // Check resource limits
    if (this.options.enforceResourceLimits) {
      this.checkResourceLimits();
    }
  }
  
  /**
   * Update total resource utilization based on task utilization
   */
  private updateTotalUtilization(): void {
    if (!this.options.trackPerTaskUtilization) {
      return;
    }
    
    let totalCpu = 0;
    let totalMemory = 0;
    let totalTokens = 0;
    let totalApiCalls = 0;
    
    // Use Array.from to convert Map values to array for iteration
    Array.from(this.taskUtilization.values()).forEach(metrics => {
      totalCpu += metrics.cpuUtilization;
      totalMemory += metrics.memoryBytes;
      totalTokens += metrics.tokensPerMinute;
      totalApiCalls += metrics.apiCallsPerMinute;
    });
    
    this.currentUtilization.cpuUtilization = totalCpu;
    this.currentUtilization.memoryBytes = totalMemory;
    this.currentUtilization.tokensPerMinute = totalTokens;
    this.currentUtilization.apiCallsPerMinute = totalApiCalls;
    
    // Check resource limits
    if (this.options.enforceResourceLimits) {
      this.checkResourceLimits();
    }
  }
  
  /**
   * Calculate average sample from a set of samples
   * 
   * @param samples Samples to average
   */
  private calculateAverageSample(samples: ResourceUtilization[]): ResourceUtilization {
    if (samples.length === 0) {
      return {
        timestamp: new Date(),
        cpuUtilization: 0,
        memoryBytes: 0,
        tokensPerMinute: 0,
        apiCallsPerMinute: 0,
        activeTasks: 0,
        pendingTasks: 0
      };
    }
    
    let totalCpu = 0;
    let totalMemory = 0;
    let totalTokens = 0;
    let totalApiCalls = 0;
    let totalActiveTasks = 0;
    let totalPendingTasks = 0;
    
    for (const sample of samples) {
      totalCpu += sample.cpuUtilization;
      totalMemory += sample.memoryBytes;
      totalTokens += sample.tokensPerMinute;
      totalApiCalls += sample.apiCallsPerMinute;
      totalActiveTasks += sample.activeTasks;
      totalPendingTasks += sample.pendingTasks;
    }
    
    return {
      timestamp: samples[samples.length - 1].timestamp,
      cpuUtilization: totalCpu / samples.length,
      memoryBytes: totalMemory / samples.length,
      tokensPerMinute: totalTokens / samples.length,
      apiCallsPerMinute: totalApiCalls / samples.length,
      activeTasks: Math.round(totalActiveTasks / samples.length),
      pendingTasks: Math.round(totalPendingTasks / samples.length)
    };
  }
  
  /**
   * Estimate current CPU utilization
   */
  private estimateCpuUtilization(): number {
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();
      
      // Wait a short time to measure CPU usage
      const endUsage = process.cpuUsage(startUsage);
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const elapsedMs = seconds * 1000 + nanoseconds / 1e6;
      
      // Calculate percentage
      const totalUsage = endUsage.user + endUsage.system;
      return totalUsage / (elapsedMs * 1000); // Convert to percentage
    }
    
    return 0;
  }
  
  /**
   * Check current resource utilization against limits
   */
  private checkResourceLimits(): void {
    const metrics: Array<keyof typeof this.limits> = [
      'cpuUtilization',
      'memoryBytes',
      'tokensPerMinute',
      'apiCallsPerMinute'
    ];
    
    for (const metric of metrics) {
      const currentValue = this.currentUtilization[metric];
      const limit = this.limits[metric];
      const warningThreshold = limit * (1 - this.options.limitWarningBuffer);
      
      // Check if exceeding limit
      if (currentValue > limit) {
        if (!this.exceedingFlags[metric]) {
          this.exceedingFlags[metric] = true;
          this.notifyListeners('onResourceLimitExceeded', metric, currentValue, limit);
        }
      }
      // Check if approaching limit
      else if (currentValue > warningThreshold) {
        if (!this.warningFlags[metric]) {
          this.warningFlags[metric] = true;
          this.notifyListeners('onResourceWarning', metric, currentValue, limit);
        }
      }
      // Check if returned to normal
      else if (this.warningFlags[metric] || this.exceedingFlags[metric]) {
        this.warningFlags[metric] = false;
        this.exceedingFlags[metric] = false;
        this.notifyListeners('onResourceUsageNormalized', metric, currentValue, limit);
      }
    }
  }
  
  /**
   * Notify listeners of resource utilization events
   * 
   * @param eventName Event to notify
   * @param metric Resource metric
   * @param value Current value
   * @param limit Resource limit
   */
  private notifyListeners(
    eventName: 'onResourceWarning' | 'onResourceLimitExceeded' | 'onResourceUsageNormalized',
    metric: keyof ResourceUtilization,
    value: number,
    limit: number
  ): void {
    for (const listener of this.listeners) {
      try {
        listener[eventName](metric, value, limit);
      } catch (error) {
        console.error(`Error notifying listener of ${eventName}:`, error);
      }
    }
  }
} 